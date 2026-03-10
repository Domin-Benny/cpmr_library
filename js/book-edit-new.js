/**
 * NEW SIMPLIFIED BOOK EDIT SYSTEM
 * This is a complete replacement for the complex, nested editBook/editBookConfirmed flow
 * Features:
 * - Direct, streamlined edit flow
 * - Better error handling
 * - Simplified form submission
 * - Proper file upload handling
 */

/**
 * Handle book edit - NEW SIMPLIFIED VERSION
 * Called when user clicks the Edit button on a book row
 */
async function editBook(bookId) {
    console.log('[BOOK EDIT] Starting edit process for book ID:', bookId);
    
    try {
        // Permission checks - ROBUST CHECK with sessionStorage
        if (!authToken) {
            showModal('Error', '❌ Authentication required. Please log in again.');
            return;
        }
        
        // Get user from sessionStorage (not localStorage!)
        const currentUserRaw = sessionStorage.getItem('currentUser') || sessionStorage.getItem('user');
        let currentUser;
        try {
            currentUser = JSON.parse(currentUserRaw || '{}');
        } catch (e) {
            console.error('[BOOK EDIT] Failed to parse user from sessionStorage');
            showModal('Error', 'Session data corrupted. Please log in again.');
            return;
        }
        
        // ROBUST role check - case insensitive
        let userRole = '';
        if (currentUser.role) {
            userRole = String(currentUser.role).trim().toLowerCase();
        }
        
        const isAdmin = userRole === 'admin' || userRole === 'Admin' || userRole === 'ADMIN';
        const isLibrarian = userRole === 'librarian' || userRole === 'Librarian' || userRole === 'LIBRARIAN';
        
        if (!isAdmin && !isLibrarian) {
            showModal('Error', `❌ Insufficient permissions. Only Admin and Librarian can edit books.\n\nYour role: "${currentUser.role}"`);
            return;
        }
        
        console.log('[BOOK EDIT] Role check passed - User is', isAdmin ? 'ADMIN' : 'LIBRARIAN');
        
        // Check if already verified in this session (within 5 minutes)
        if (typeof isCriticalActionValid === 'function' && isCriticalActionValid()) {
            console.log('[BOOK EDIT] Already verified for critical action - proceeding');
            // Proceed directly to edit
            showBookEditForm(bookId);
        } else {
            // Require password verification first
            console.log('[BOOK EDIT] Password verification required...');
            
            // Check if verifyUserPassword function exists
            if (typeof verifyUserPassword !== 'function') {
                console.error('[BOOK EDIT] verifyUserPassword function not found! Loading script...');
                // Fallback: load the function from script.js dynamically or proceed without verification
                showModal('Error', 'Password verification system not loaded. Please refresh the page.');
                return;
            }
            
            const verified = await verifyUserPassword('edit_book');
            
            if (!verified) {
                console.error('❌ VERIFICATION FAILED - BLOCKING EDIT BOOK');
                return;
            }
            
            console.log('✅ Verification successful - showing edit form');
            // Show edit form after verification
            showBookEditForm(bookId);
        }
    } catch (error) {
        console.error('[BOOK EDIT] Unexpected error:', error);
        showModal('Error', `❌ An unexpected error occurred: ${error.message}`);
    }
}

/**
 * Show book edit form after password verification
 * @param {string|number} bookId - Book ID to edit
 */
async function showBookEditForm(bookId) {
    console.log('[SHOW BOOK EDIT FORM] Loading book details for ID:', bookId);
    
    try {
        // Show loading state
        showModal('Loading', '<div style="text-align: center; padding: 20px;"><div class="loading-spinner"></div><p style="margin-top: 15px;">Loading book details...</p></div>');
        
        // Fetch book details
        const response = await fetch(`${API_BASE_URL}/books.php?action=getDetails&id=${bookId}`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('[BOOK EDIT] Failed to fetch book details:', response.status, errorText);
            showModal('Error', `❌ Failed to load book details. Server error: ${response.status}`);
            return;
        }
        
        const data = await response.json();
        if (!data.success || !data.book) {
            console.error('[BOOK EDIT] Invalid response:', data);
            showModal('Error', '❌ Failed to load book data. Book not found.');
            return;
        }
        
        const book = data.book;
        console.log('[BOOK EDIT] Book data loaded:', book);
        
        // Fetch categories
        const categoriesResponse = await fetch(`${API_BASE_URL}/categories.php?action=getAll`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        if (!categoriesResponse.ok) {
            console.error('[BOOK EDIT] Failed to fetch categories:', categoriesResponse.status);
            showModal('Error', '❌ Failed to load categories.');
            return;
        }
        
        const categoriesData = await categoriesResponse.json();
        const categories = categoriesData.success ? categoriesData.categories : [];
        console.log('[BOOK EDIT] Categories loaded:', categories.length);
        
        // Build category options
        const categoryOptions = categories.map(cat => 
            `<option value="${cat.category_id}" ${cat.category_id == book.category_id ? 'selected' : ''}">${cat.name}</option>`
        ).join('');
        
        // Build the edit form HTML
        const editFormHTML = buildBookEditForm(book, categoryOptions, categories);
        
        // Show edit form
        hideModal(); // Close loading modal
        showModal('Edit Book', editFormHTML, false, () => {
            setupBookEditFormHandlers(book, bookId);
        });
        
    } catch (error) {
        console.error('[SHOW BOOK EDIT FORM] Unexpected error:', error);
        showModal('Error', `❌ An unexpected error occurred: ${error.message}`);
    }
}

/**
 * Build the book edit form HTML
 */
function buildBookEditForm(book, categoryOptions, categories) {
    const bookCoverImg = book.cover_image ? 
        `/cpmr_library/backend/uploads/book_covers/${book.cover_image}` : 
        '/cpmr_library/frontend/images/default-book-cover.jfif';
    
    return `
        <div style="max-height: 85vh; overflow-y: auto;">
            <form id="bookEditForm" enctype="multipart/form-data" style="padding: 0;">
                <input type="hidden" name="action" value="update">
                <input type="hidden" name="book_id" value="${book.book_id}">
                
                <!-- Basic Information Section -->
                <div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                    <h4 style="margin-top: 0; color: #333;">Basic Information</h4>
                    
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                        <!-- Title -->
                        <div>
                            <label style="display: block; margin-bottom: 5px; font-weight: 500; color: #333;">
                                Book Title <span style="color: #e74c3c;">*</span>
                            </label>
                            <input 
                                type="text" 
                                name="title" 
                                value="${book.title || ''}" 
                                required 
                                style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px;"
                                autocomplete="off"
                            >
                        </div>
                        
                        <!-- Author -->
                        <div>
                            <label style="display: block; margin-bottom: 5px; font-weight: 500; color: #333;">
                                Author <span style="color: #e74c3c;">*</span>
                            </label>
                            <input 
                                type="text" 
                                name="author" 
                                value="${book.author || ''}" 
                                required 
                                style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px;"
                                autocomplete="off"
                            >
                        </div>
                        
                        <!-- ISBN -->
                        <div>
                            <label style="display: block; margin-bottom: 5px; font-weight: 500; color: #333;">ISBN</label>
                            <input 
                                type="text" 
                                name="isbn" 
                                placeholder="e.g., 978-3-16-148410-0 (10 or 13 digits)"
                                value="${book.isbn || ''}" 
                                style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px;"
                                autocomplete="off"
                            >
                        </div>
                        
                        <!-- Publication Year -->
                        <div>
                            <label style="display: block; margin-bottom: 5px; font-weight: 500; color: #333;">Publication Year</label>
                            <input 
                                type="number" 
                                name="publication_year" 
                                value="${book.publication_year || ''}" 
                                min="1900" 
                                max="2050" 
                                style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px;"
                                autocomplete="off"
                            >
                        </div>
                    </div>
                    
                    <!-- Publisher & Category on second row -->
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-top: 15px;">
                        <!-- Publisher -->
                        <div>
                            <label style="display: block; margin-bottom: 5px; font-weight: 500; color: #333;">Publisher</label>
                            <input 
                                type="text" 
                                name="publisher" 
                                value="${book.publisher || ''}" 
                                style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px;"
                                autocomplete="off"
                            >
                        </div>
                        
                        <!-- Category -->
                        <div>
                            <label style="display: block; margin-bottom: 5px; font-weight: 500; color: #333;">
                                Category <span style="color: #e74c3c;">*</span>
                            </label>
                            <select 
                                name="category_id" 
                                required 
                                style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px;">
                                <option value="">-- Select Category --</option>
                                ${categoryOptions}
                            </select>
                        </div>
                    </div>
                </div>
                
                <!-- Additional Details Section -->
                <div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                    <h4 style="margin-top: 0; color: #333;">Additional Details</h4>
                    
                    <!-- Description -->
                    <div style="margin-bottom: 15px;">
                        <label style="display: block; margin-bottom: 5px; font-weight: 500; color: #333;">Description</label>
                        <textarea 
                            name="description" 
                            rows="3" 
                            style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px;"
                        >${book.description || ''}</textarea>
                    </div>
                    
                    <!-- Copies & Status -->
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                        <!-- Total Copies -->
                        <div>
                            <label style="display: block; margin-bottom: 5px; font-weight: 500; color: #333;">Total Copies</label>
                            <input 
                                type="number" 
                                name="total_copies" 
                                value="${book.total_copies || '1'}" 
                                min="1" 
                                style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px;"
                                autocomplete="off"
                            >
                        </div>
                        
                        <!-- Status -->
                        <div>
                            <label style="display: block; margin-bottom: 5px; font-weight: 500; color: #333;">Status</label>
                            <select 
                                name="status" 
                                style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px;">
                                <option value="Available" ${book.status === 'Available' ? 'selected' : ''}>Available</option>
                                <option value="Borrowed" ${book.status === 'Borrowed' ? 'selected' : ''}>Borrowed</option>
                                <option value="Reserved" ${book.status === 'Reserved' ? 'selected' : ''}>Reserved</option>
                                <option value="Maintenance" ${book.status === 'Maintenance' ? 'selected' : ''}>Maintenance</option>
                            </select>
                        </div>
                    </div>
                </div>
                
                <!-- Cover Image Section -->
                <div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                    <h4 style="margin-top: 0; color: #333;">Cover Image</h4>
                    
                    <!-- Current Cover -->
                    ${book.cover_image ? `
                        <div style="margin-bottom: 15px;">
                            <p style="margin: 0 0 10px 0; color: #666; font-size: 13px;">Current Cover Image:</p>
                            <img 
                                src="${bookCoverImg}" 
                                alt="Current Book Cover" 
                                style="max-width: 150px; max-height: 200px; border: 2px solid #ddd; border-radius: 4px; display: block;"
                                onerror="this.src='/cpmr_library/frontend/images/default-book-cover.jfif';"
                            >
                        </div>
                    ` : `
                        <p style="color: #999; font-size: 13px; margin-bottom: 15px; font-style: italic;">No cover image uploaded yet</p>
                    `}
                    
                    <!-- Upload New Cover -->
                    <div>
                        <label style="display: block; margin-bottom: 5px; font-weight: 500; color: #333;">Upload New Cover</label>
                        <input 
                            type="file" 
                            id="coverImageInput"
                            name="cover_image_file" 
                            accept="image/*" 
                            style="padding: 8px; border: 1px solid #ddd; border-radius: 4px; width: 100%;"
                        >
                        <small style="color: #999; display: block; margin-top: 5px;">Supported formats: JPG, PNG, GIF (Max: 5MB)</small>
                    </div>
                    
                    <!-- Preview for new image -->
                    <div id="newCoverPreview" style="margin-top: 10px; display: none;">
                        <p style="margin: 0 0 10px 0; color: #666; font-size: 13px;">New Cover Preview:</p>
                        <img 
                            id="newCoverPreviewImg" 
                            src="" 
                            alt="New Cover Preview" 
                            style="max-width: 150px; max-height: 200px; border: 2px solid #4CAF50; border-radius: 4px; display: block;"
                        >
                    </div>
                </div>
                
                <!-- Form Actions -->
                <div style="display: flex; gap: 10px; justify-content: flex-end; padding: 15px 0; border-top: 1px solid #ddd;">
                    <button 
                        type="button" 
                        id="bookEditCancelBtn"
                        class="btn btn-secondary" 
                        style="padding: 10px 20px; background: #f5f5f5; color: #333; border: 1px solid #ddd; border-radius: 4px; cursor: pointer; font-weight: 500;"
                        onclick="hideModal()"
                    >
                        Cancel
                    </button>
                    <button 
                        type="submit" 
                        id="bookEditSubmitBtn"
                        class="btn btn-primary" 
                        style="padding: 10px 20px; background: #1b5e20; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: 500;"
                    >
                        Save Changes
                    </button>
                </div>
            </form>
        </div>
    `;
}

/**
 * Setup book edit form event handlers
 */
function setupBookEditFormHandlers(book, bookId) {
    console.log('[BOOK EDIT] Setting up form handlers');
    
    const form = document.getElementById('bookEditForm');
    if (!form) {
        console.error('[BOOK EDIT] Form not found!');
        return;
    }
    
    // Setup file input preview
    const fileInput = document.getElementById('coverImageInput');
    const previewDiv = document.getElementById('newCoverPreview');
    const previewImg = document.getElementById('newCoverPreviewImg');
    
    if (fileInput) {
        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                // Validate file size
                if (file.size > 5 * 1024 * 1024) { // 5MB
                    showModal('Error', '❌ File size exceeds 5MB limit.');
                    fileInput.value = '';
                    previewDiv.style.display = 'none';
                    return;
                }
                
                // Show preview
                const reader = new FileReader();
                reader.onload = (event) => {
                    previewImg.src = event.target.result;
                    previewDiv.style.display = 'block';
                };
                reader.readAsDataURL(file);
            }
        });
    }
    
    // Setup form submission
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        await submitBookEditForm(form, book, bookId);
    });
    
    console.log('[BOOK EDIT] Form handlers setup complete');
}

/**
 * Submit the book edit form
 */
async function submitBookEditForm(form, book, bookId) {
    console.log('[BOOK EDIT] Submitting form for book:', bookId);
    
    try {
        // Validate auth
        if (!authToken) {
            showModal('Error', '❌ Authentication required. Please log in again.');
            return;
        }
        
        // Get form data
        const formData = new FormData(form);
        
        // Log form data
        console.log('[BOOK EDIT] Form data entries:');
        for (let [key, value] of formData.entries()) {
            if (key !== 'cover_image_file') {
                console.log(`  ${key}: ${value}`);
            } else {
                console.log(`  ${key}: [File]`);
            }
        }
        
        // Show loading state
        const submitBtn = document.getElementById('bookEditSubmitBtn');
        const originalText = submitBtn.textContent;
        submitBtn.disabled = true;
        submitBtn.textContent = 'Saving...';
        
        // Make API request
        const response = await fetch(`${API_BASE_URL}/books.php`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`
            },
            body: formData
        });
        
        console.log('[BOOK EDIT] API response status:', response.status);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('[BOOK EDIT] HTTP error:', response.status, errorText);
            submitBtn.disabled = false;
            submitBtn.textContent = originalText;
            showModal('Error', `❌ Server error ${response.status}. Please try again.`);
            return;
        }
        
        const result = await response.json();
        console.log('[BOOK EDIT] API result:', result);
        
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
        
        if (!result.success) {
            showModal('Error', `❌ Failed to update book: ${result.message || 'Unknown error'}`);
            return;
        }
        
        // Success!
        console.log('[BOOK EDIT] Book updated successfully!');
        hideModal();
        
        // Show success message
        showModal('Success', `
            <div style="text-align: center; padding: 30px;">
                <div style="font-size: 50px; margin-bottom: 15px;">✓</div>
                <h3 style="margin: 15px 0; color: #333;">Book Updated Successfully!</h3>
                <p style="color: #666; margin-bottom: 15px;">${book.title || 'Unknown'}</p>
            </div>
        `);
        
        // Reload data
        setTimeout(() => {
            hideModal();
            loadBooksData().catch(err => console.error('[BOOK EDIT] Error reloading books:', err));
            loadDashboardData().catch(err => console.error('[BOOK EDIT] Error reloading dashboard:', err));
        }, 1500);
        
    } catch (error) {
        console.error('[BOOK EDIT] Error submitting form:', error);
        const submitBtn = document.getElementById('bookEditSubmitBtn');
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Save Changes';
        }
        showModal('Error', `❌ An error occurred: ${error.message}`);
    }
}

console.log('[BOOK EDIT] New book edit system loaded');
