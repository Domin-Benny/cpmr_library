/**
 * SIMPLE BOOK EDIT SYSTEM
 * A clean, lightweight approach to book editing without complex modals
 */

// Ensure we're extending the existing system rather than replacing it
if (typeof window.editBook === 'undefined' || typeof window.editBook === 'function') {
    // Define editBook function if it doesn't exist or is a function
    window.editBook = editBook;
}

/**
 * Simple book edit function that opens a clean, minimal form
 */
async function editBook(bookId) {
    console.log('=== OPENING SIMPLE BOOK EDIT FOR ID:', bookId, '===');
    
    try {
        // Check if user is Admin or Librarian - ROBUST CHECK with sessionStorage
        const currentUserRaw = sessionStorage.getItem('currentUser') || sessionStorage.getItem('user');
        console.log('[BOOK EDIT] SessionStorage raw:', currentUserRaw);
        
        let currentUser;
        try {
            currentUser = JSON.parse(currentUserRaw || '{}');
        } catch (e) {
            console.error('[BOOK EDIT] Failed to parse user from sessionStorage');
            showModal('Error', 'Session data corrupted. Please log in again.');
            return;
        }
        
        console.log('[BOOK EDIT] Parsed user:', currentUser);
        console.log('[BOOK EDIT] Username:', currentUser.username);
        console.log('[BOOK EDIT] Role:', currentUser.role);
        
        // ROBUST role check - case insensitive
        let userRole = '';
        if (currentUser.role) {
            userRole = String(currentUser.role).trim().toLowerCase();
        }
        
        console.log('[BOOK EDIT] Normalized role:', userRole);
        
        const isAdmin = userRole === 'admin' || userRole === 'Admin' || userRole === 'ADMIN';
        const isLibrarian = userRole === 'librarian' || userRole === 'Librarian' || userRole === 'LIBRARIAN';
        
        if (!isAdmin && !isLibrarian) {
            console.error('[BOOK EDIT] ❌ ACCESS DENIED: Role check failed');
            showModal('Access Denied', `Only Admin and Librarian users can edit books.\n\nYour role: "${currentUser.role}"`);
            return;
        }
        
        console.log('[BOOK EDIT] ✅ Role check PASSED - User is', isAdmin ? 'ADMIN' : 'LIBRARIAN');
        
        // Check if already verified in this session (within 5 minutes)
        if (typeof isCriticalActionValid === 'function' && isCriticalActionValid()) {
            console.log('[BOOK EDIT] ✅ Already verified for critical action - proceeding');
            // Proceed directly to edit
            showSimpleBookEditFormForVerified(bookId);
        } else {
            // Require password verification first
            console.log('[BOOK EDIT] Password verification required...');
            
            // Check if verifyUserPassword function exists
            if (typeof verifyUserPassword !== 'function') {
                console.error('[BOOK EDIT] ❌ verifyUserPassword function not found!');
                showModal('Error', 'Password verification system not loaded. Please refresh the page.');
                return;
            }
            
            const verified = await verifyUserPassword('edit_book');
            
            if (!verified) {
                console.error('[BOOK EDIT] ❌ VERIFICATION FAILED - BLOCKING EDIT BOOK');
                return;
            }
            
            console.log('[BOOK EDIT] ✅ Verification successful - showing edit form');
            // Show edit form after verification
            showSimpleBookEditFormForVerified(bookId);
        }
        
    } catch (error) {
        console.error('[BOOK EDIT] Error:', error);
        showModal('Error', 'Error loading book for editing: ' + error.message);
    }
}

/**
 * Show simple book edit form after password verification
 * @param {string|number} bookId - Book ID to edit
 */
async function showSimpleBookEditFormForVerified(bookId) {
    console.log('[SHOW FORM] Loading book data for ID:', bookId);
    
    try {
        // Show loading state
        document.body.style.cursor = 'wait';
        
        // Fetch book data and categories in parallel
        const [bookResponse, categoriesResponse] = await Promise.all([
            fetch(`${API_BASE_URL}/books.php?action=getDetails&id=${bookId}`, {
                headers: {
                    'Authorization': `Bearer ${authToken}`
                }
            }),
            fetch(`${API_BASE_URL}/categories.php?action=getAll`, {
                headers: {
                    'Authorization': `Bearer ${authToken}`
                }
            })
        ]);
        
        if (!bookResponse.ok) {
            throw new Error(`Failed to load book: ${bookResponse.status}`);
        }
        
        const bookData = await bookResponse.json();
        const categoriesData = await categoriesResponse.json();
        
        if (!bookData.success || !bookData.book) {
            throw new Error(bookData.message || 'Book not found');
        }
        
        document.body.style.cursor = 'default';
        
        // Get categories for dropdown
        const categories = categoriesData.success ? categoriesData.categories : [];
        
        // Create a simple clean form
        const book = bookData.book;
        showSimpleBookEditForm(book, categories);
        
    } catch (error) {
        document.body.style.cursor = 'default';
        alert('Error loading book for editing: ' + error.message);
        console.error('Book edit error:', error);
    }
}

/**
 * Show a simple, clean edit form
 */
function showSimpleBookEditForm(book, categories = []) {
    // Create overlay
    const overlay = document.createElement('div');
    overlay.id = 'bookEditOverlay'; // Add ID for easier identification
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    overlay.style.backgroundColor = 'rgba(0,0,0,0.5)';
    overlay.style.zIndex = '1000';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    
    // Create form container
    const formContainer = document.createElement('div');
    formContainer.style.backgroundColor = 'white';
    formContainer.style.padding = '20px';
    formContainer.style.borderRadius = '8px';
    formContainer.style.maxWidth = '500px';
    formContainer.style.width = '90%';
    formContainer.style.maxHeight = '90vh';
    formContainer.style.overflowY = 'auto';
    
    // Build category options
    const categoryOptions = categories.map(cat => {
        const catId = cat.id || cat.category_id;
        const isSelected = book.category_id == catId ? 'selected' : '';
        return `<option value="${catId}" ${isSelected}>${escapeHtml(cat.name)}</option>`;
    }).join('');
    
    // Build simple form with image upload
    const coverImagePath = book.cover_image ? `/cpmr_library/backend/uploads/book_covers/${book.cover_image}` : '';
    
    formContainer.innerHTML = `
        <h3 style="margin-top: 0; color: #333;">Edit Book</h3>
        <form id="simpleBookEditForm" enctype="multipart/form-data" style="display: grid; gap: 15px;">
            <input type="hidden" name="book_id" value="${book.book_id}">
            <input type="hidden" name="action" value="update">
            
            <div>
                <label style="display: block; margin-bottom: 5px; font-weight: bold;">Title</label>
                <input type="text" name="title" value="${escapeHtml(book.title || '')}" 
                       style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;" required>
            </div>
            
            <div>
                <label style="display: block; margin-bottom: 5px; font-weight: bold;">Author</label>
                <input type="text" name="author" value="${escapeHtml(book.author || '')}" 
                       style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;" required>
            </div>
            
            <div>
                <label style="display: block; margin-bottom: 5px; font-weight: bold;">Category</label>
                <select name="category_id" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                    <option value="">Select Category</option>
                    ${categoryOptions}
                </select>
            </div>
            
            <div>
                <label style="display: block; margin-bottom: 5px; font-weight: bold;">ISBN</label>
                <input type="text" name="isbn" placeholder="e.g., 978-3-16-148410-0 (10 or 13 digits)" value="${escapeHtml(book.isbn || '')}" 
                       style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
            </div>
            
            <div>
                <label style="display: block; margin-bottom: 5px; font-weight: bold;">Year</label>
                <input type="number" name="publication_year" value="${book.publication_year || ''}" 
                       style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
            </div>
            
            <div>
                <label style="display: block; margin-bottom: 5px; font-weight: bold;">Publisher</label>
                <input type="text" name="publisher" value="${escapeHtml(book.publisher || '')}" 
                       style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
            </div>
            
            <div>
                <label style="display: block; margin-bottom: 5px; font-weight: bold;">Shelf Location</label>
                <input type="text" name="shelf" placeholder="e.g., Shelf A1, Main Floor Rack 2" value="${escapeHtml(book.shelf || '')}" 
                       style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                <small style="color: #666; display: block; margin-top: 3px;">Physical shelf or location where book is stored</small>
            </div>
            
            <div>
                <label style="display: block; margin-bottom: 5px; font-weight: bold;">Total Copies</label>
                <input type="number" name="total_copies" value="${book.total_copies || '1'}" min="1"
                       style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
            </div>
            
            <div>
                <label style="display: block; margin-bottom: 5px; font-weight: bold;">Available Copies</label>
                <input type="number" name="available_copies" value="${book.available_copies || '0'}" min="0"
                       style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
            </div>
            
            <div>
                <label style="display: block; margin-bottom: 5px; font-weight: bold;">Status</label>
                <select name="status" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                    <option value="Available" ${book.status === 'Available' ? 'selected' : ''}>Available</option>
                    <option value="Borrowed" ${book.status === 'Borrowed' ? 'selected' : ''}>Borrowed</option>
                    <option value="Reserved" ${book.status === 'Reserved' ? 'selected' : ''}>Reserved</option>
                    <option value="Maintenance" ${book.status === 'Maintenance' ? 'selected' : ''}>Maintenance</option>
                </select>
            </div>
            
            <div>
                <label style="display: block; margin-bottom: 5px; font-weight: bold;">Cover Image</label>
                <div id="currentCoverPreview" style="margin-bottom: 10px;">
                    ${coverImagePath ? `<img src="${coverImagePath}" id="currentCoverImage" style="max-width: 100px; max-height: 150px; border-radius: 4px; border: 1px solid #ddd;">` : '<div style="color: #999; font-style: italic; padding: 10px; background: #f5f5f5; border-radius: 4px; text-align: center;">No current cover image</div>'}
                </div>
                <input type="file" name="cover_image_file" id="coverImageFileInput" accept="image/*" 
                       style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;" onchange="previewBookCoverImage(event)">
                <small style="color: #666; display: block; margin-top: 5px;">Upload any image format (JPG, PNG, GIF, BMP, WebP, etc.) - Max 10MB</small>
            </div>
            
            <div style="margin-top: 20px; display: flex; gap: 10px; justify-content: flex-end;">
                <button type="button" id="cancelEditBtn" style="padding: 10px 20px; background: #f5f5f5; border: 1px solid #ddd; border-radius: 4px; cursor: pointer;">Cancel</button>
                <button type="submit" style="padding: 10px 20px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer;">Save Changes</button>
            </div>
        </form>
    `;
    
    // Add to overlay
    overlay.appendChild(formContainer);
    document.body.appendChild(overlay);
    
    // Handle form submission
    const form = formContainer.querySelector('#simpleBookEditForm');
    form.addEventListener('submit', (e) => handleSimpleEditSubmit(e, overlay));
    
    // Handle cancel
    const cancelBtn = formContainer.querySelector('#cancelEditBtn');
    cancelBtn.addEventListener('click', () => {
        if (overlay && overlay.parentNode) {
            overlay.remove();
        }
    });
}

/**
 * Handle simple edit form submission
 */
async function handleSimpleEditSubmit(event, overlay) {
    event.preventDefault();
    
    const form = event.target;
    const formData = new FormData(form);
    
    // CRITICAL: Check authentication before proceeding
    if (typeof authToken === 'undefined' || !authToken) {
        console.error('[BOOK SAVE] ❌ authToken is undefined or empty!');
        alert('❌ Authentication required. Please log in again.');
        // Redirect to login or reload
        if (typeof showModal === 'function') {
            showModal('Error', 'Session expired. Please log in again.');
        }
        return;
    }
    
    console.log('[BOOK SAVE] ✅ authToken present:', authToken.substring(0, 20) + '...');
    
    try {
        // Show saving state
        const submitBtn = form.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;
        submitBtn.textContent = 'Saving...';
        submitBtn.disabled = true;
        
        // Send update request with FormData (supports file uploads)
        const response = await fetch(`${API_BASE_URL}/books.php`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`
            },
            body: formData
        });
        
        console.log('[BOOK SAVE] Response status:', response.status);
        console.log('[BOOK SAVE] Response OK:', response.ok);
        
        // Check if response indicates authentication failure
        if (response.status === 401) {
            console.error('[BOOK SAVE] ❌ Authentication failed (401)');
            const errorText = await response.text();
            console.error('[BOOK SAVE] Error response:', errorText);
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
            showModal('Error', 'Authentication failed. Your session may have expired. Please log in again.');
            return;
        }
        
        const result = await response.json();
        
        // Restore button
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
        
        if (result.success) {
            // Close form overlay safely
            if (overlay && overlay.parentNode) {
                overlay.remove();
            }
            
            // Refresh book data
            if (typeof loadBooksData === 'function') {
                loadBooksData();
            }
            
            // Clear verification after successful edit
            if (typeof clearCriticalActionVerification === 'function') {
                clearCriticalActionVerification();
            }
            
            alert('✅ Book updated successfully!');
        } else {
            alert('❌ Error updating book: ' + (result.message || 'Unknown error'));
        }
    } catch (error) {
        const submitBtn = form.querySelector('button[type="submit"]');
        submitBtn.textContent = 'Save Changes';
        submitBtn.disabled = false;
        alert('❌ Error saving book: ' + error.message);
        console.error('Submit error:', error);
    }
}

/**
 * Preview book cover image when file is selected
 */
function previewBookCoverImage(event) {
    const file = event.target.files[0];
    const previewContainer = document.getElementById('currentCoverPreview');
    
    if (!previewContainer) {
        console.error('Preview container not found');
        return;
    }
    
    if (!file) {
        console.log('No file selected');
        return;
    }
    
    // Check file type
    const validImageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/bmp', 'image/webp'];
    if (!validImageTypes.includes(file.type)) {
        alert('Please select a valid image file (JPG, PNG, GIF, BMP, or WebP)');
        event.target.value = ''; // Clear the file input
        return;
    }
    
    // Check file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB in bytes
    if (file.size > maxSize) {
        alert('File size exceeds 10MB limit. Please choose a smaller file.');
        event.target.value = ''; // Clear the file input
        return;
    }
    
    // Create FileReader to preview the image
    const reader = new FileReader();
    
    reader.onload = function(e) {
        // Update the preview with the new image
        previewContainer.innerHTML = `
            <div style="position: relative; display: inline-block;">
                <img src="${e.target.result}" id="newCoverPreview" 
                     style="max-width: 100px; max-height: 150px; border-radius: 4px; border: 2px solid #007bff; box-shadow: 0 2px 8px rgba(0,123,255,0.3);"
                     alt="New cover preview">
                <div style="position: absolute; top: -8px; right: -8px; background: #28a745; color: white; 
                            border-radius: 50%; width: 24px; height: 24px; display: flex; 
                            align-items: center; justify-content: center; font-size: 14px; font-weight: bold;">✓</div>
            </div>
            <div style="margin-top: 8px; padding: 8px; background: #d4edda; border: 1px solid #c3e6cb; 
                        border-radius: 4px; color: #155724; font-size: 12px;">
                <strong>✓ New image selected:</strong> ${file.name} (${(file.size / 1024).toFixed(2)} KB)
            </div>
        `;
    };
    
    reader.onerror = function(error) {
        console.error('Error reading file:', error);
        alert('Error loading image preview. Please try again.');
    };
    
    reader.readAsDataURL(file); // Read the file as a data URL
}

/**
 * Simple HTML escape function
 */
function escapeHtml(text) {
    if (!text) return '';
    return text.toString()
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

console.log('Simple Book Edit System Loaded');
