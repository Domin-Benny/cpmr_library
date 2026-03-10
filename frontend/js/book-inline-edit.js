/**
 * INLINE BOOK EDITING SYSTEM
 * New, simplified approach to edit books directly in the table
 */

let editingBookId = null;
let originalBookData = null;

/**
 * Enable inline editing for a specific book row
 */
function enableBookInlineEdit(bookId) {
    console.log('[INLINE EDIT] Enabling edit for book ID:', bookId);
    
    // Check permissions
    if (!currentUser || !['Admin', 'Librarian'].includes(currentUser.role)) {
        showModal('Access Denied', '❌ Only Admins and Librarians can edit books.');
        return;
    }
    
    // If already editing, cancel first
    if (editingBookId) {
        cancelBookEdit();
    }
    
    // Find the book row
    const row = document.querySelector(`tr[data-book-id="${bookId}"]`);
    if (!row) {
        console.error('[INLINE EDIT] Row not found for book ID:', bookId);
        return;
    }
    
    editingBookId = bookId;
    
    // Store original data
    originalBookData = {
        title: row.querySelector('td:nth-child(1)')?.textContent.trim(),
        author: row.querySelector('td:nth-child(2)')?.textContent.trim(),
        category: row.querySelector('td:nth-child(3)')?.textContent.trim(),
        status: row.querySelector('td:nth-child(4)')?.textContent.trim(),
        copies: row.querySelector('td:nth-child(5)')?.textContent.trim()
    };
    
    console.log('[INLINE EDIT] Original data stored:', originalBookData);
    
    // Make cells editable
    const cells = row.querySelectorAll('td');
    let cellIndex = 0;
    
    cells.forEach((cell, index) => {
        // Skip action buttons column
        if (cell.querySelector('.action-btn')) {
            return;
        }
        
        const originalContent = cell.textContent.trim();
        cell.style.backgroundColor = '#fff3cd';
        cell.style.padding = '8px';
        cell.style.minHeight = '30px';
        
        // Create input field
        const input = document.createElement('input');
        input.type = 'text';
        input.value = originalContent;
        input.style.width = '100%';
        input.style.padding = '6px';
        input.style.border = '2px solid #ffc107';
        input.style.borderRadius = '4px';
        input.style.fontSize = '14px';
        input.className = `edit-input-${cellIndex}`;
        input.dataset.fieldIndex = cellIndex;
        
        // Map column to field name
        const fieldMap = {
            0: 'title',
            1: 'author',
            2: 'category_id',
            3: 'status',
            4: 'total_copies'
        };
        input.dataset.field = fieldMap[cellIndex] || '';
        
        cell.innerHTML = '';
        cell.appendChild(input);
        
        cellIndex++;
    });
    
    // Update action buttons
    updateEditActionButtons(row, bookId);
    
    console.log('[INLINE EDIT] Editing enabled, ready for input');
}

/**
 * Update action buttons during edit mode
 */
function updateEditActionButtons(row, bookId) {
    const actionCell = row.querySelector('td:last-child');
    if (!actionCell) return;
    
    actionCell.innerHTML = `
        <button class="action-btn save-btn" onclick="saveBookInlineEdit(${bookId})" style="background-color: #4CAF50; color: white; padding: 6px 12px; border: none; border-radius: 4px; cursor: pointer; margin-right: 5px; font-weight: bold;">
            ✓ Save
        </button>
        <button class="action-btn cancel-btn" onclick="cancelBookEdit()" style="background-color: #f44336; color: white; padding: 6px 12px; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">
            ✗ Cancel
        </button>
    `;
}

/**
 * Save the inline edited book
 */
async function saveBookInlineEdit(bookId) {
    console.log('[INLINE EDIT] Saving book ID:', bookId);
    
    if (!authToken) {
        showModal('Error', '❌ Authentication required. Please log in again.');
        return;
    }
    
    const row = document.querySelector(`tr[data-book-id="${bookId}"]`);
    if (!row) {
        console.error('[INLINE EDIT] Row not found for saving');
        return;
    }
    
    // Collect edited data
    const inputs = row.querySelectorAll('input');
    const editedData = new FormData();
    editedData.append('action', 'update');
    editedData.append('book_id', bookId);
    
    const fieldMap = {
        0: 'title',
        1: 'author',
        2: 'category_id',
        3: 'status',
        4: 'total_copies'
    };
    
    inputs.forEach((input, index) => {
        const fieldName = fieldMap[index] || '';
        if (fieldName) {
            editedData.append(fieldName, input.value.trim());
            console.log(`[INLINE EDIT] Field ${fieldName}: ${input.value}`);
        }
    });
    
    try {
        // Show loading state
        showModal('Saving', '<div style="text-align: center;"><div class="loading-spinner"></div><p>Updating book...</p></div>');
        
        const response = await fetch(`${API_BASE_URL}/books.php`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`
            },
            body: editedData
        });
        
        const data = await response.json();
        hideModal();
        
        if (data.success) {
            console.log('[INLINE EDIT] Book updated successfully');
            showModal('Success', '✅ Book updated successfully!', false);
            
            setTimeout(() => {
                hideModal();
                // Refresh the books table
                loadBooks();
                editingBookId = null;
                originalBookData = null;
            }, 1500);
        } else {
            console.error('[INLINE EDIT] Update failed:', data.message);
            showModal('Error', `❌ Failed to update book: ${data.message || 'Unknown error'}`);
        }
    } catch (error) {
        console.error('[INLINE EDIT] Error saving book:', error);
        hideModal();
        showModal('Error', `❌ Error updating book: ${error.message}`);
    }
}

/**
 * Cancel inline editing and restore original state
 */
function cancelBookEdit() {
    console.log('[INLINE EDIT] Canceling edit, book ID:', editingBookId);
    
    if (!editingBookId) return;
    
    const row = document.querySelector(`tr[data-book-id="${editingBookId}"]`);
    if (!row) {
        console.error('[INLINE EDIT] Row not found for cancel');
        editingBookId = null;
        return;
    }
    
    // Restore original content
    const cells = row.querySelectorAll('td');
    let cellIndex = 0;
    const fieldNames = ['title', 'author', 'category', 'status', 'copies'];
    
    cells.forEach((cell, index) => {
        if (cell.querySelector('.action-btn') || cell.querySelector('.save-btn') || cell.querySelector('.cancel-btn')) {
            return;
        }
        
        if (cellIndex < fieldNames.length && originalBookData[fieldNames[cellIndex]]) {
            cell.textContent = originalBookData[fieldNames[cellIndex]];
            cell.style.backgroundColor = '';
        }
        cellIndex++;
    });
    
    // Restore action buttons
    const actionCell = row.querySelector('td:last-child');
    if (actionCell) {
        actionCell.innerHTML = `
            <button class="action-btn edit-btn" data-id="${editingBookId}" style="padding: 6px 12px; cursor: pointer;">Edit</button>
        `;
    }
    
    editingBookId = null;
    originalBookData = null;
    console.log('[INLINE EDIT] Edit cancelled');
}

/**
 * Attach click handler to existing edit buttons
 */
function setupInlineEditHandlers() {
    console.log('[INLINE EDIT] Setting up click handlers');
    
    // Listen for edit button clicks on book rows
    document.addEventListener('click', function(e) {
        if (e.target.classList.contains('edit-btn') && !e.target.classList.contains('view-btn')) {
            const row = e.target.closest('tr');
            if (row && row.hasAttribute('data-book-id')) {
                const bookId = row.getAttribute('data-book-id');
                enableBookInlineEdit(bookId);
                e.preventDefault();
            }
        }
    });
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupInlineEditHandlers);
} else {
    setupInlineEditHandlers();
}
