// =============================================
// CPMR Library Management System - JavaScript
// File: frontend/js/script.js
// Description: Main JavaScript file with all functionality
// =============================================

// API Configuration - Use dynamic config if available, fallback to default
const API_BASE_URL = window.APP_CONFIG ? window.APP_CONFIG.apiBase : '/cpmr_library/backend/api';

// Authentication System
let currentUser = null;
let authToken = null;

// Notification Sound System
let previousNotificationCount = 0;
let notificationSoundEnabled = true;
let audioContext = null;
// merge auth token into every request and log out on forbidden status
(function() {
    const originalFetch = window.fetch;
    window.fetch = async function(input, init = {}) {
        if (!init.headers) init.headers = {};
        if (authToken) {
            init.headers['Authorization'] = 'Bearer ' + authToken;
        }
        const response = await originalFetch(input, init);
        if (response.status === 403) {
            let data;
            try {
                data = await response.clone().json();
            } catch (e) {
                data = null;
            }
            if (data && data.message && /account/i.test(data.message)) {
                forceLogout(data.message);
            }
        }
        return response;
    };
})();

function forceLogout(reason) {
    console.warn('forceLogout invoked:', reason);
    sessionStorage.clear();
    currentUser = null;
    authToken = null;
    
    // Show logout message immediately
    showModal('Account Suspended', `
        <div style="text-align: center; padding: 20px;">
            <div style="font-size: 48px; color: #ff6b6b; margin-bottom: 20px;">🚫</div>
            <h3>Account Suspended</h3>
            <p>${reason}</p>
            <p>You have been logged out.</p>
        </div>
    `);
    
    // hide main app and show login
    document.getElementById('mainApp').style.display = 'none';
    document.getElementById('loginContainer').style.display = 'flex';
    // show dashboard selection and hide login form
    document.getElementById('loginFormContainer').style.display = 'none';
    document.querySelector('.dashboard-selection').style.display = 'block';
    // reset login form
    document.getElementById('loginForm').reset();
    document.getElementById('loginError').style.display = 'none';
}// Periodic status check to catch suspensions performed while user is idle
async function checkSessionStatus() {
    if (!authToken) return;
    try {
        const res = await fetch(`${API_BASE_URL}/check_status.php`, { headers: { 'Authorization': `Bearer ${authToken}` } });
        if (res.status === 403) {
            const data = await res.json().catch(() => null);
            const msg = data && data.message ? data.message : 'Your account status changed';
            forceLogout(msg);
        }
    } catch (err) {
        console.warn('Status poll failed:', err);
    }
}

setInterval(checkSessionStatus, 60000);
// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    if (document.getElementById('mainApp') || document.getElementById('loginContainer') || document.querySelector('.dashboard-selection')) {
        initApp();
    } else {
        console.log('initApp skipped: not running in main app context');
    }
});

// =============================================
// INITIALIZATION FUNCTIONS
// =============================================

/**
 * Initialize the application
 */
function initApp() {
    checkLoginStatus();
    setupEventListeners();
    
    // Load custom login background if it exists
    loadLoginBackground();
    
    // Initialize modern notification system
    initializeNotifications(); // Async function - no need to await initialization
    
    // Initialize push notifications (browser notifications)
    initializePushNotifications(); // Async function
    
    // Make helper functions globally available
    window.simulateExport = simulateExport;
    window.simulateReportExport = simulateReportExport;
    
    // Ensure dashboard selection is visible initially
    if (!sessionStorage.getItem('loggedIn')) {
        document.getElementById('loginFormContainer').style.display = 'none';
        document.querySelector('.dashboard-selection').style.display = 'block';
    }
}

/**
 * Check if user is already logged in
 */
function checkLoginStatus() {
    const loggedIn = sessionStorage.getItem('loggedIn');
    const userData = sessionStorage.getItem('user');
    const token = sessionStorage.getItem('authToken');
    
    console.log('Checking login status:', { loggedIn, hasUserData: !!userData, hasToken: !!token });
    
    if (loggedIn === 'true' && userData && token) {
        currentUser = JSON.parse(userData);
        if (currentUser && currentUser.role) {
            currentUser.role = currentUser.role.toString().charAt(0).toUpperCase() + currentUser.role.toString().slice(1).toLowerCase();
        }
        authToken = token;
        console.log('✅ Restored user:', currentUser);
        console.log('✅ Auth token restored (length: ' + authToken.length + ')');
        
        // Set the header text IMMEDIATELY before showing anything
        const logoSection = document.querySelector('.logo-section h1');
        if (logoSection && currentUser.role) {
            const role = currentUser.role.toLowerCase();
            switch(role) {
                case 'admin':
                    logoSection.innerHTML = '<i class="bi bi-tree-fill"></i> CPMR <span style="color: #ff9800;">ADMIN</span> DASHBOARD';
                    break;
                case 'librarian':
                    logoSection.innerHTML = '<i class="bi bi-book"></i> CPMR <span style="color: #2196f3;">LIBRARIAN</span> DASHBOARD';
                    break;
                case 'student':
                case 'staff':
                case 'other':
                    logoSection.innerHTML = '👤 CPMR <span style="color: #9c27b0;">USER</span> DASHBOARD';
                    break;
                default:
                    logoSection.innerHTML = '<i class="bi bi-tree-fill"></i> CPMR <span style="color: #4caf50;">DASHBOARD</span>';
            }
        }
        
        showMainApp();
        
        // Also apply dashboard customizations after a delay to ensure everything is loaded
        setTimeout(() => {
            if (currentUser && currentUser.role) {
                console.log('Applying dashboard customizations after page refresh');
                applyDashboardCustomizations();
            }
        }, 100);
    } else {
        console.warn('❌ Not logged in or missing data. loggedIn:', loggedIn, 'hasUser:', !!userData, 'hasToken:', !!token);
        
        // No logout message handling needed - messages are shown immediately on logout
    }
}

/**
 * Get auth token with validation
 */
function getAuthToken() {
    // Check if token is in-memory
    if (authToken) {
        return authToken;
    }
    
    // Try to restore from sessionStorage
    const token = sessionStorage.getItem('authToken');
    if (token) {
        authToken = token;
        console.log('✅ Token restored from sessionStorage');
        return token;
    }
    
    console.warn('❌ No auth token available! User might not be logged in.');
    return null;
}

/**
 * Check if user is authenticated, show login if not
 */
function ensureAuthenticated() {
    const token = getAuthToken();
    if (!token) {
        console.warn('⚠️ Authentication required. Redirecting to login.');
        showModal('Session Expired', '<p>Your session has expired. Please log in again.</p>', false);
        // Force logout
        handleLogout();
        return false;
    }
    return true;
}

/**
 * Setup all event listeners
 */
function setupEventListeners() {
    // Login form
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }
    
    // Logout button
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }
    
    // Menu toggle for mobile
    const menuToggle = document.getElementById('menuToggle');
    if (menuToggle) {
        menuToggle.addEventListener('click', toggleSidebar);
    }
    
    // Book gallery view toggle
    const listViewBtn = document.getElementById('listViewBtn');
    const galleryViewBtn = document.getElementById('galleryViewBtn');
    const galleryBooksSearch = document.getElementById('galleryBooksSearch');
    
    // Get the books section and its table containers
    const booksSection = document.getElementById('books');
    const tableContainers = booksSection ? booksSection.querySelectorAll('.table-container') : [];
    const listViewContainer = tableContainers[0]; // First table container is list view
    const galleryViewContainer = tableContainers[1]; // Second table container is gallery view
    
    if (listViewBtn && galleryViewBtn && listViewContainer && galleryViewContainer) {
        // Set default view to gallery view
        listViewContainer.style.display = 'none';
        galleryViewContainer.style.display = 'block';
        
        // Add active class to gallery view button by default
        galleryViewBtn.classList.add('active');
        
        listViewBtn.addEventListener('click', function() {
            listViewBtn.classList.add('active');
            galleryViewBtn.classList.remove('active');
            listViewContainer.style.display = 'block';
            galleryViewContainer.style.display = 'none';
        });
        
        galleryViewBtn.addEventListener('click', function() {
            galleryViewBtn.classList.add('active');
            listViewBtn.classList.remove('active');
            listViewContainer.style.display = 'none';
            galleryViewContainer.style.display = 'block';
            
            // Load gallery view if books are already loaded
            if (typeof currentBooks !== 'undefined' && currentBooks.length > 0) {
                displayBooksInGallery(currentBooks);
            }
        });
    }
    
    // Gallery search functionality
    if (galleryBooksSearch) {
        galleryBooksSearch.addEventListener('input', function() {
            if (typeof currentBooks !== 'undefined') {
                const searchTerm = this.value.toLowerCase();
                const filteredBooks = currentBooks.filter(book => 
                    book.title.toLowerCase().includes(searchTerm) || 
                    book.author.toLowerCase().includes(searchTerm) || 
                    book.isbn.toLowerCase().includes(searchTerm)
                );
                displayBooksInGallery(filteredBooks);
            }
        });
    }
    
    // Navigation links
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const target = this.getAttribute('data-target');
            
            // Update active link
            navLinks.forEach(link => link.classList.remove('active'));
            this.classList.add('active');
            
            // Show the selected section
            showSection(target);
            
            // Close sidebar on mobile after selection
            if (window.innerWidth <= 768) {
                const sidebar = document.getElementById('sidebar');
                sidebar.classList.remove('active');
            }
        });
    });
    
    // Apply role-based navigation after login
    if (currentUser && currentUser.role) {
        applyRoleBasedNavigation(currentUser.role);
    }
    
    // Dashboard action buttons
    const addBookBtn = document.getElementById('addBookBtn');
    if (addBookBtn) {
        addBookBtn.addEventListener('click', () => {
            showSection('add-book');
            // Load categories quickly when navigating to add-book section
            setTimeout(() => loadCategories(), 25);
        });
    }
    
    // Admin user management buttons
    const adminEditBtn = document.querySelector('.action-btn.edit-btn[data-user="admin"]');
    const adminResetBtn = document.querySelector('.action-btn.delete-btn[data-user="admin"]');

    // Load more books button (pagination)
    const loadMoreBtn = document.getElementById('loadMoreBooksBtn');
    if (loadMoreBtn) {
        loadMoreBtn.addEventListener('click', () => {
            loadBooksData(booksPage + 1, true);
        });
    }
    
    if (adminEditBtn) {
        adminEditBtn.addEventListener('click', () => editAdminUser());
    }
    
    if (adminResetBtn) {
        adminResetBtn.addEventListener('click', () => resetAdminPassword());
    }
    
    const registerMemberBtn = document.getElementById('registerMemberBtn');
    if (registerMemberBtn) {
        console.log('Register Member button found and listener added');
        registerMemberBtn.addEventListener('click', showRegisterMemberModal);
    } else {
        console.log('Register Member button NOT found');
    }

    const registerNewMemberBtn = document.getElementById('registerNewMemberBtn');
    if (registerNewMemberBtn) {
        console.log('Register New Member button found and listener added');
        registerNewMemberBtn.addEventListener('click', showRegisterMemberModal);
    } else {
        console.log('Register New Member button NOT found');
    }

    const requestBookBtn = document.getElementById('requestBookBtn');
    if (requestBookBtn) {
        requestBookBtn.addEventListener('click', showRequestBookModal);
    }
    
    const requestBookBtnDashboard = document.getElementById('requestBookBtnDashboard');
    if (requestBookBtnDashboard) {
        requestBookBtnDashboard.addEventListener('click', showRequestBookModal);
    }

    const sendRemindersBtn = document.getElementById('sendRemindersBtn');
    if (sendRemindersBtn) {
        sendRemindersBtn.addEventListener('click', simulateSendReminders);
    }
    
    const viewReportsBtn = document.getElementById('viewReportsBtn');
    if (viewReportsBtn) {
        viewReportsBtn.addEventListener('click', () => showSection('reports'));
    }

    const generateReportBtn = document.getElementById('generateReportBtn');
    if (generateReportBtn) {
        generateReportBtn.addEventListener('click', generateMonthlyReport);
    }

    const exportReportBtn = document.getElementById('exportReportBtn');
    if (exportReportBtn) {
        exportReportBtn.addEventListener('click', exportMonthlyReport);
    }

    const addCategoryBtn = document.getElementById('addCategoryBtn');
    if (addCategoryBtn) {
        addCategoryBtn.addEventListener('click', showAddCategoryModal);
    }

    const newBorrowingBtn = document.getElementById('newBorrowingBtn');
    if (newBorrowingBtn) {
        newBorrowingBtn.addEventListener('click', showNewBorrowingModal);
    }

    const returnBookBtn = document.getElementById('returnBookBtn');
    if (returnBookBtn) {
        returnBookBtn.addEventListener('click', () => showSection('borrowing'));
    }
    
    // Send Due Notification Button
    const sendDueNotificationBtn = document.getElementById('sendDueNotificationBtn');
    if (sendDueNotificationBtn) {
        sendDueNotificationBtn.addEventListener('click', showSendDueNotificationModal);
    }
    
    // Books section buttons
    const addNewBookBtn = document.getElementById('addNewBookBtn');
    if (addNewBookBtn) {
        addNewBookBtn.addEventListener('click', () => {
            showSection('add-book');
            // Load categories when navigating to add-book section
            setTimeout(() => loadCategories(), 100);
        });
    }
    
    const exportBooksBtn = document.getElementById('exportBooksBtn');
    if (exportBooksBtn) {
        exportBooksBtn.addEventListener('click', exportBooksList);
    }
    
    // Add book form
    const addBookForm = document.getElementById('addBookForm');
    if (addBookForm) {
        addBookForm.addEventListener('submit', handleAddBook);
        
        // Add event listener for cover image preview
        const bookCoverInput = document.getElementById('bookCover');
        const coverPreview = document.getElementById('coverPreview');
        const coverPreviewImg = document.getElementById('coverPreviewImg');
        
        if (bookCoverInput && coverPreview && coverPreviewImg) {
            bookCoverInput.addEventListener('change', function(e) {
                const file = e.target.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = function(event) {
                        coverPreviewImg.src = event.target.result;
                        coverPreview.style.display = 'block';
                    };
                    reader.readAsDataURL(file);
                }
            });
        }
    }
    
    // Settings form
    const settingsForm = document.getElementById('settingsForm');
    if (settingsForm) {
        settingsForm.addEventListener('submit', handleSaveSettings);
        
        // Handle reset button to restore default values
        settingsForm.addEventListener('reset', function(e) {
            setTimeout(() => {
                // Set default values
                document.getElementById('libraryName').value = 'CPMR Library';
                document.getElementById('maxBorrowDays').value = 30;
                document.getElementById('maxBooksPerMember').value = 5;
                document.getElementById('lateFeePerDay').value = 0.50;
                document.getElementById('enableEmailReminders').value = 'yes';
                document.getElementById('reminderDaysBefore').value = 3;
            }, 10);
        });
    }

    // Journals upload button and modal handlers
    const uploadJournalBtn = document.getElementById('uploadJournalBtn');
    if (uploadJournalBtn) uploadJournalBtn.addEventListener('click', showUploadJournalModal);
    const closeUploadJournalModal = document.getElementById('closeUploadJournalModal');
    if (closeUploadJournalModal) closeUploadJournalModal.addEventListener('click', hideUploadJournalModal);
    const cancelUploadJournal = document.getElementById('cancelUploadJournal');
    if (cancelUploadJournal) cancelUploadJournal.addEventListener('click', hideUploadJournalModal);
    const submitUploadJournal = document.getElementById('submitUploadJournal');
    if (submitUploadJournal) submitUploadJournal.addEventListener('click', handleUploadJournal);

    // CPMR Policies - Open Policies button
    const openPoliciesBtn = document.getElementById('openPoliciesBtn');
    if (openPoliciesBtn) {
        console.log('frontend: openPoliciesBtn listener attached');
        openPoliciesBtn.addEventListener('click', function() {
            showSection('cpmr-policies');
        });
    }

    // Policies drag & drop zone
    const policyDropZone = document.getElementById('policyDropZone');
    const policyFileInput = document.getElementById('policyFileInput');
    
    if (policyDropZone && policyFileInput) {
        console.log('frontend: wiring policy drop zone events');
        // Click to browse
        policyDropZone.addEventListener('click', function() {
            policyFileInput.click();
        });
        
        // File input change
        policyFileInput.addEventListener('change', function(e) {
            if (e.target.files && e.target.files[0]) {
                console.log('frontend: policyFileInput change');
                handlePolicyFileSelect(e.target.files[0]);
            }
        });
        
        // Drag events
        policyDropZone.addEventListener('dragover', function(e) {
            e.preventDefault();
            this.classList.add('drag-over');
        });
        
        policyDropZone.addEventListener('dragleave', function() {
            this.classList.remove('drag-over');
        });
        
        policyDropZone.addEventListener('drop', function(e) {
            e.preventDefault();
            this.classList.remove('drag-over');
            if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                console.log('frontend: policy file dropped');
                handlePolicyFileSelect(e.dataTransfer.files[0]);
            }
        });
    }

    // Upload policy button
    const uploadPolicyBtn = document.getElementById('uploadPolicyBtn');
    if (uploadPolicyBtn) {
        console.log('frontend: attach uploadPolicy handler');
        uploadPolicyBtn.addEventListener('click', uploadPolicy);
    }

    // Policies search and sort
    const policiesSearch = document.getElementById('policiesSearch');
    const policiesSort = document.getElementById('policiesSort');
    
    if (policiesSearch) {
        policiesSearch.addEventListener('input', function() {
            loadPolicies();
        });
    }
    
    if (policiesSort) {
        policiesSort.addEventListener('change', function() {
            loadPolicies();
        });
    }

    // Librarian signup
    const createLibrarianBtn = document.getElementById('createLibrarianBtn');
    if (createLibrarianBtn) {
        createLibrarianBtn.addEventListener('click', showLibrarianModal);
    }

    const closeLibrarianModal = document.getElementById('closeLibrarianModal');
    if (closeLibrarianModal) {
        closeLibrarianModal.addEventListener('click', hideLibrarianModal);
    }

    const cancelLibrarianModal = document.getElementById('cancelLibrarianModal');
    if (cancelLibrarianModal) {
        cancelLibrarianModal.addEventListener('click', hideLibrarianModal);
    }

    const submitLibrarianForm = document.getElementById('submitLibrarianForm');
    if (submitLibrarianForm) {
        submitLibrarianForm.addEventListener('click', handleCreateLibrarian);
    }

    const librarianForm = document.getElementById('librarianForm');
    if (librarianForm) {
        librarianForm.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                handleCreateLibrarian();
            }
        });
    }

    const librarianModalOverlay = document.getElementById('librarianModalOverlay');
    if (librarianModalOverlay) {
        librarianModalOverlay.addEventListener('click', function(e) {
            if (e.target === librarianModalOverlay) {
                hideLibrarianModal();
            }
        });
    }
    
    // Modal buttons
    const closeModal = document.getElementById('closeModal');
    if (closeModal) {
        closeModal.addEventListener('click', hideModal);
    }
    
    const cancelModal = document.getElementById('cancelModal');
    if (cancelModal) {
        cancelModal.addEventListener('click', hideModal);
    }
    
    const confirmModal = document.getElementById('confirmModal');
    if (confirmModal) {
        confirmModal.addEventListener('click', handleModalConfirm);
    }
    
    // Close modal when clicking outside
    const modalOverlay = document.getElementById('modalOverlay');
    if (modalOverlay) {
        modalOverlay.addEventListener('click', function(e) {
            // Prevent closing modal if preventClose is set (for admin password verification)
            if (e.target === modalOverlay && modalOverlay.dataset.preventClose !== 'true') {
                hideModal();
            }
        });
    }
    
    // Search functionality
    const bookSearch = document.getElementById('bookSearch');
    if (bookSearch) {
        bookSearch.addEventListener('input', filterBooksTable);
    }
    
    const allBooksSearch = document.getElementById('allBooksSearch');
    if (allBooksSearch) {
        allBooksSearch.addEventListener('input', filterAllBooksTable);
    }
    
    // Search functionality for members and borrowing
    const memberSearch = document.getElementById('memberSearch');
    if (memberSearch) {
        memberSearch.addEventListener('input', function() {
            const searchTerm = this.value.toLowerCase();
            filterMembers(searchTerm);
        });
    }
    
    const borrowingSearch = document.getElementById('borrowingSearch');
    if (borrowingSearch) {
        borrowingSearch.addEventListener('input', function() {
            const searchTerm = this.value.toLowerCase();
            filterBorrowingRecords(searchTerm);
        });
    }
    
    // Handle window resize
    window.addEventListener('resize', handleResize);
    
    // Signup form
    const signupForm = document.getElementById('signupForm');
    if (signupForm) {
        signupForm.addEventListener('submit', handleSignup);
    }
    
    // Load registration dropdowns ONCE during initialization
    loadRegistrationDropdowns();
    
    // Add event listeners for signup form dropdowns (only once!)
    const roleSelect = document.getElementById('signupRole');
    const institutionSelect = document.getElementById('signupInstitution');
    const departmentSelect = document.getElementById('signupDepartment');
    const idTypeSelect = document.getElementById('signupIdType');
    
    if (roleSelect && !roleSelect.dataset.listenerAdded) {
        roleSelect.addEventListener('change', handleRoleSelection);
        roleSelect.dataset.listenerAdded = 'true';
    }
    
    if (institutionSelect && !institutionSelect.dataset.listenerAdded) {
        institutionSelect.addEventListener('change', () => {
            handleInstitutionChange.call(institutionSelect);
            toggleCustomInstitution();
        });
        institutionSelect.dataset.listenerAdded = 'true';
    }
    
    if (departmentSelect && !departmentSelect.dataset.listenerAdded) {
        departmentSelect.addEventListener('change', () => {
            handleDepartmentChange.call(departmentSelect);
            toggleCustomDepartment();
        });
        departmentSelect.dataset.listenerAdded = 'true';
    }
    
    if (idTypeSelect && !idTypeSelect.dataset.listenerAdded) {
        idTypeSelect.addEventListener('change', () => {
            handleIdTypeChange.call(idTypeSelect);
            toggleCustomIdType();
        });
        idTypeSelect.dataset.listenerAdded = 'true';
    }
    
    // Global event delegation for dynamically created buttons
    document.addEventListener('click', function(e) {
        console.log('=== CLICK EVENT DETECTED ===');
        console.log('Target element:', e.target);
        console.log('Target classes:', e.target.className);
        console.log('Target dataset:', e.target.dataset);
        console.log('Target text content:', e.target.textContent);
        console.log('Target parent elements:', e.target.parentElement);
        
        // Handle borrowing return buttons FIRST (they use the edit-btn class but say "Return")
        if (e.target.classList.contains('action-btn') && e.target.classList.contains('edit-btn') && e.target.textContent && e.target.textContent.trim() === 'Return') {
            console.log('RETURN BUTTON DETECTED');
            const recordId = e.target.dataset.id;
            if (recordId) {
                e.preventDefault();
                returnBorrowedBook(recordId);
            }
            return; // Exit early to prevent other handlers from processing this click
        }
        // Alternative selector for return buttons in borrowing context
        else if ((e.target.classList.contains('action-btn') && e.target.textContent && e.target.textContent.trim() === 'Return') || 
                 (e.target.classList.contains('return-btn'))) {
            console.log('ALTERNATIVE RETURN BUTTON DETECTED');
            const recordId = e.target.dataset.id;
            if (recordId) {
                e.preventDefault();
                returnBorrowedBook(recordId);
            }
            return; // Exit early to prevent other handlers from processing this click
        }
        
        // Handle edit buttons - distinguish between books, members, and other entities
        console.log('Checking for edit button...');
        console.log('Has edit-btn class:', e.target.classList.contains('edit-btn'));
        console.log('Has action-btn class:', e.target.classList.contains('action-btn'));
        console.log('Has view-btn class:', e.target.classList.contains('view-btn'));
        console.log('Has data-id:', e.target.dataset.id);
        
        if (e.target.classList.contains('edit-btn') && !e.target.classList.contains('view-btn')) {
            console.log('EDIT BUTTON DETECTED!');
            const itemId = e.target.dataset.id;
            console.log('Item ID found:', itemId);
            if (itemId) {
                e.preventDefault();
                console.log('Preventing default and calling edit function');
                
                // Determine the entity type based on the context
                console.log('Checking context...');
                console.log('Closest members table:', e.target.closest('table.members-table'));
                console.log('Closest members section:', e.target.closest('#members'));
                console.log('Closest member data-entity:', e.target.closest('[data-entity="member"]'));
                console.log('Closest categories table:', e.target.closest('table.categories-table'));
                console.log('Closest categories section:', e.target.closest('#categories'));
                console.log('Closest category data-entity:', e.target.closest('[data-entity="category"]'));
                console.log('Closest books section:', e.target.closest('#books'));
                console.log('Closest books table:', e.target.closest('table.books-table'));
                console.log('Closest allBooksSection:', e.target.closest('#allBooksSection'));
                
                if (e.target.closest('table.members-table') || 
                    e.target.closest('#members') ||
                    e.target.closest('[data-entity="member"]')) {
                    console.log('CALLING editMember');
                    editMember(itemId);
                } else if (e.target.closest('table.categories-table') ||
                          e.target.closest('#categories') ||
                          e.target.closest('[data-entity="category"]')) {
                    console.log('CALLING editCategory');
                    editCategory(itemId);
                } else if (e.target.closest('#books') ||
                          e.target.closest('table.books-table') ||
                          e.target.closest('#allBooksSection')) {
                    console.log('SIMPLE BOOK EDIT CLICKED');
                    editBook(itemId);
                } else {
                    // Default to book for books table or other contexts
                    console.log('SIMPLE BOOK EDIT DEFAULT');
                    editBook(itemId);
                }
            } else {
                console.log('NO ITEM ID FOUND');
            }
        } else {
            console.log('NOT AN EDIT BUTTON');
            console.log('Class list:', e.target.classList);
        }
        
        // Handle delete buttons - distinguish between books, members, and other entities
        if (e.target.classList.contains('delete-btn') && !e.target.classList.contains('view-btn')) {
            const itemId = e.target.dataset.id;
            if (itemId) {
                e.preventDefault();
                
                // Determine the entity type based on the context
                if (e.target.closest('table.members-table') || 
                    e.target.closest('#members') ||
                    e.target.closest('[data-entity="member"]')) {
                    deleteMember(itemId);
                } else if (e.target.closest('table.categories-table') ||
                          e.target.closest('#categories') ||
                          e.target.closest('[data-entity="category"]')) {
                    deleteCategory(itemId);
                } else if (e.target.closest('#books') ||
                          e.target.closest('table.books-table') ||
                          e.target.closest('#allBooksSection')) {
                    deleteBook(itemId);
                } else {
                    // Default to book for books table or other contexts
                    deleteBook(itemId);
                }
            }
        }
        
        // Handle view buttons - distinguish between books, members, and other entities
        if (e.target.classList.contains('view-btn')) {
            const itemId = e.target.dataset.id;
            if (itemId) {
                e.preventDefault();
                
                // Determine the entity type based on the context
                if (e.target.closest('table.members-table') || 
                    e.target.closest('#members') ||
                    e.target.closest('[data-entity="member"]')) {
                    viewMemberDetails(itemId);
                } else if (e.target.closest('table.categories-table') ||
                          e.target.closest('#categories') ||
                          e.target.closest('[data-entity="category"]')) {
                    viewCategoryBooks(itemId);
                } else if (e.target.closest('#books') ||
                          e.target.closest('table.books-table') ||
                          e.target.closest('#allBooksSection')) {
                    viewBookDetails(itemId);
                } else {
                    // Default to book for books table or other contexts
                    viewBookDetails(itemId);
                }
            }
        }
        
        // Handle borrowing return buttons (they use the edit-btn class but say "Return")
        if (e.target.classList.contains('action-btn') && e.target.classList.contains('edit-btn') && e.target.textContent && e.target.textContent.trim() === 'Return') {
            const recordId = e.target.dataset.id;
            if (recordId) {
                e.preventDefault();
                returnBorrowedBook(recordId);
            }
        }
        // Alternative selector for return buttons in borrowing context
        else if ((e.target.classList.contains('action-btn') && e.target.textContent && e.target.textContent.trim() === 'Return') || 
                 (e.target.classList.contains('return-btn'))) {
            const recordId = e.target.dataset.id;
            if (recordId) {
                e.preventDefault();
                returnBorrowedBook(recordId);
            }
        }
        
        // Handle borrowing view buttons in borrowing records (before general view buttons)
        if (e.target.classList.contains('action-btn') && e.target.classList.contains('view-btn')) {
            const recordId = e.target.dataset.id;
            if (recordId) {
                e.preventDefault();
                // Check if this is in the pending-requests section
                if (e.target.closest('#pending-requests')) {
                    viewRequestDetails(recordId);
                }
                else {
                    viewBorrowingRecordDetails(recordId);
                }
            }
            return; // Exit early to prevent other handlers from processing this click
        }
    });
}

// =============================================
// AUTHENTICATION FUNCTIONS
// =============================================

/**
 * Handle login form submission
 * @param {Event} e - Form submit event
 */
async function handleLogin(e) {
    e.preventDefault();
    
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const loginError = document.getElementById('loginError');
    
    try {
        // CRITICAL: Clear ALL session data before attempting login to prevent stale session issues
        sessionStorage.clear();
        
        console.log('[LOGIN] Attempting login for:', username);
        
        // Send login request to backend
        const response = await fetch(`${API_BASE_URL}/login.php`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ username, password })
        });
        
        // Check if response is valid JSON
        const responseText = await response.text();
        console.log('[LOGIN] Response status:', response.status);
        console.log('[LOGIN] Response data:', responseText);
        
        let data;
        try {
            data = JSON.parse(responseText);
        } catch (parseError) {
            console.error('[LOGIN] JSON parse error:', parseError);
            console.error('[LOGIN] Raw response:', responseText);
            throw new Error('Invalid response from server');
        }
        
        if (data.success) {
            console.log('[LOGIN] ✅ Login successful!');
            
            // Successful login
            currentUser = data.user;
            // normalize role to capitalized form for consistent comparisons
            if (currentUser && currentUser.role) {
                currentUser.role = currentUser.role.toString().charAt(0).toUpperCase() + currentUser.role.toString().slice(1).toLowerCase();
            }
            authToken = data.token;
            loginError.style.display = 'none';
            
            console.log('[LOGIN] User data:', currentUser);
            console.log('[LOGIN] Role:', currentUser.role);
            console.log('[LOGIN] Token:', authToken ? 'Present' : 'Missing');
            
            // Store login state
            sessionStorage.setItem('loggedIn', 'true');
            sessionStorage.setItem('user', JSON.stringify(currentUser));
            sessionStorage.setItem('authToken', authToken);
            sessionStorage.setItem('currentUser', JSON.stringify(currentUser)); // Also store as currentUser for compatibility
            
            // Show main application
            showMainApp();
            
            // Load initial data
            console.log('[LOGIN] Loading initial data...');
            loadInitialData();
        } else {
            console.log('[LOGIN] ❌ Login failed:', data.message);
            
            // Failed login - Check if it's account suspension
            console.log('[LOGIN DEBUG] Response data:', data);
            
            if (data.account_status && data.account_status !== 'Active') {
                // Show detailed suspension message with admin contact info
                console.log('[SUSPENSION] Account status:', data.account_status);
                console.log('[SUSPENSION] Message from server:', data.message);
                
                // ALWAYS use the message from the server - it contains the complete sentence
                const displayMessage = data.message || `Your account has been ${data.account_status}. Please contact the administrator.`;
                
                console.log('[SUSPENSION] Will display:', displayMessage);
                
                // display inline error as well in case modal fails to appear
                loginError.textContent = displayMessage;
                loginError.style.display = 'block';

                showModal('Account Access Denied', `
                    <div style="text-align: center; padding: 20px;">
                        <div style="font-size: 64px; margin-bottom: 20px;">${data.account_status === 'Suspended' ? '🚫' : '⚠️'}</div>
                        <h3 style="color: #dc3545; margin-bottom: 15px;">${data.account_status === 'Suspended' ? 'Account Suspended' : 'Account Inactive'}</h3>
                        <p style="color: #666; margin: 20px 0; line-height: 1.6; font-size: 16px; font-weight: bold;">${displayMessage}</p>
                        <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin-top: 20px; text-align: left; border-radius: 4px;">
                            <strong style="color: #856404;">📞 Contact Information:</strong>
                            <ul style="margin: 10px 0; padding-left: 20px; color: #856404; line-height: 1.8;">
                                <li>Please contact the system administrator</li>
                                <li>Request account reactivation</li>
                                <li>Verify your account status</li>
                            </ul>
                        </div>
                    </div>
                `, false, null);
                
                // Clear password field
                document.getElementById('password').value = '';
                document.getElementById('password').focus();
            } else {
                // Standard login failure
                loginError.textContent = data.message || 'Invalid username or password';
                loginError.style.display = 'block';
                document.getElementById('password').value = '';
                document.getElementById('password').focus();
            }
        }
    } catch (error) {
        console.error('[LOGIN] Error:', error);
        loginError.textContent = 'Network error. Please try again.';
        loginError.style.display = 'block';
    }
}

/**
 * Handle signup form submission
 * @param {Event} e - Form submit event
 */
/**
 * Direct button click handler for Create Account
 */
function handleCreateAccountClick() {
    console.log('=== CREATE ACCOUNT BUTTON CLICKED DIRECTLY ===');
    console.log('[CLICK] Button clicked!');
    console.log('[CLICK] Current step:', currentStep);
    console.log('[CLICK] Step 3 display:', document.getElementById('step3').style.display);
    
    // Check if we're actually on step 3
    if (currentStep !== 3) {
        console.error('[CLICK] ERROR: Not on step 3! Current step:', currentStep);
        alert('Please complete all steps first. You are currently on step ' + currentStep);
        return;
    }
    
    // Manually trigger form validation and submission
    const signupForm = document.getElementById('signupForm');
    console.log('[CLICK] Triggering form submit...');
    
    // Create and dispatch submit event
    const submitEvent = new Event('submit', {
        bubbles: true,
        cancelable: true
    });
    
    if (signupForm.dispatchEvent(submitEvent)) {
        console.log('[CLICK] Submit event dispatched successfully');
        // Call handleSignup directly
        handleSignup(submitEvent);
    } else {
        console.error('[CLICK] Submit event was prevented');
    }
}

async function handleSignup(e) {
    console.log('=== HANDLE SIGNUP CALLED ===');
    console.log('[SIGNUP] Function executed');
    console.log('[SIGNUP] Event type:', e.type);
    console.log('[SIGNUP] Current step:', currentStep);
    console.log('[SIGNUP] Step 3 visible?', document.getElementById('step3').style.display);
    
    e.preventDefault();
    
    const signupError = document.getElementById('signupError');
    
    // Validate all steps before submission
    let isValid = true;
    
    // Validate Step 1
    const name = document.getElementById('signupName').value.trim();
    const email = document.getElementById('signupEmail').value.trim();
    const username = document.getElementById('signupUsername').value.trim();
    const password = document.getElementById('signupPassword').value;
    
    if (!name || !email || !username || !password || password.length < 6) {
        showError(signupError, 'Please complete all fields in Step 1 (Basic Info)');
        goToStep(1);
        return;
    }
    
    // Validate Step 2
    const role = document.getElementById('signupRole').value;
    if (!role) {
        showError(signupError, 'Please select your role in Step 2');
        goToStep(2);
        return;
    }
    
    // Validate role-specific fields
    if (role === 'student') {
        const institution = document.getElementById('signupInstitution').value;
        const program = document.getElementById('signupProgram').value.trim();
        const studentPhone = document.getElementById('signupStudentPhone').value.trim();
        if (!institution || !program) {
            showError(signupError, 'Please complete university and program fields in Step 2');
            goToStep(2);
            return;
        }
        if (institution === 'OTHER' && !document.getElementById('signupCustomInstitution').value.trim()) {
            showError(signupError, 'Please specify your university in Step 2');
            goToStep(2);
            return;
        }
        if (!studentPhone) {
            showError(signupError, 'Please enter your phone number in Step 2');
            goToStep(2);
            return;
        }
    } else if (role === 'staff') {
        const department = document.getElementById('signupDepartment').value;
        const staffPhone = document.getElementById('signupStaffPhone').value.trim();
        if (!department) {
            showError(signupError, 'Please select your department in Step 2');
            goToStep(2);
            return;
        }
        if (department === 'OTHER' && !document.getElementById('signupCustomDepartment').value.trim()) {
            showError(signupError, 'Please specify your department in Step 2');
            goToStep(2);
            return;
        }
        if (!staffPhone) {
            showError(signupError, 'Please enter your phone number in Step 2');
            goToStep(2);
            return;
        }
    } else if (role === 'other') {
        const phone = document.getElementById('signupPhone').value.trim();
        const idType = document.getElementById('signupIdType').value;
        const idNumber = document.getElementById('signupIdNumber').value.trim();
        if (!phone || !idType || !idNumber) {
            showError(signupError, 'Please complete phone and ID fields in Step 2');
            goToStep(2);
            return;
        }
        if (idType === 'OTHER' && !document.getElementById('signupCustomIdType').value.trim()) {
            showError(signupError, 'Please specify ID type in Step 2');
            goToStep(2);
            return;
        }
    }
    
    // Validate Step 3
    const securityQuestion = document.getElementById('signupSecurityQuestion').value;
    const securityAnswer = document.getElementById('signupSecurityAnswer').value.trim();
    
    if (!securityQuestion || !securityAnswer) {
        showError(signupError, 'Please complete security question fields in Step 3');
        goToStep(3);
        return;
    }
    
    // All validations passed, proceed with submission
    signupError.style.display = 'none';
    
    // Get role-specific data
    let institution = '';
    let department = '';
    let program = '';
    let phone = '';
    let id_number = '';
    let id_type = '';
    
    if (role === 'student') {
        if (document.getElementById('signupInstitution').value === 'OTHER') {
            institution = document.getElementById('signupCustomInstitution').value.trim();
        } else {
            institution = document.getElementById('signupInstitution').value;
        }
        program = document.getElementById('signupProgram').value.trim();
        phone = document.getElementById('signupStudentPhone').value.trim();
    } else if (role === 'staff') {
        if (document.getElementById('signupDepartment').value === 'OTHER') {
            department = document.getElementById('signupCustomDepartment').value.trim();
        } else {
            department = document.getElementById('signupDepartment').value;
        }
        phone = document.getElementById('signupStaffPhone').value.trim();
    } else if (role === 'other') {
        phone = document.getElementById('signupPhone').value.trim();
        
        if (document.getElementById('signupIdType').value === 'OTHER') {
            id_type = document.getElementById('signupCustomIdType').value.trim();
        } else {
            id_type = document.getElementById('signupIdType').value;
        }
        
        id_number = document.getElementById('signupIdNumber').value.trim();
        
        // Validate phone and ID for others
        if (!phone || !id_type || !id_number) {
            signupError.textContent = 'Please fill in all required fields for Others role.';
            signupError.style.display = 'block';
            return;
        }
    }
    
    try {
        // Send signup request to backend
        const response = await fetch(`${API_BASE_URL}/register.php`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                name,
                email,
                phone,
                username,
                password,
                role,
                institution,
                department,
                program,
                id_number,
                id_type,
                security_question: securityQuestion,
                security_answer: securityAnswer
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            // user account created; previously we auto-logged in here, but the flow has been
            // disabled per user request so they remain on the signup page and see a message.
            signupError.textContent = 'Account created successfully! You can now log in.';
            signupError.style.display = 'block';
            signupError.style.color = 'green';
            
            // Reset form after successful signup
            document.getElementById('signupForm').reset();
            
            // Reset dynamic fields visibility
            document.getElementById('studentFields').style.display = 'none';
            document.getElementById('staffFields').style.display = 'none';
            document.getElementById('otherFields').style.display = 'none';
            
            // Hide custom input fields
            document.getElementById('customInstitutionField').style.display = 'none';
            document.getElementById('customDepartmentField').style.display = 'none';
            document.getElementById('customIdTypeField').style.display = 'none';
            
            // After 2 seconds, redirect to login
            setTimeout(() => {
                showLoginForm();
            }, 2000);
        } else {
            signupError.textContent = data.message || 'Registration failed. Please try again.';
            signupError.style.display = 'block';
            signupError.style.color = '#dc3545';
        }
    } catch (error) {
        console.error('Signup error:', error);
        signupError.textContent = 'Network error. Please try again.';
        signupError.style.display = 'block';
        signupError.style.color = '#dc3545';
    }
}

/**
 * Handle logout
 */
function handleLogout() {
    showModal('Logout', `
        <div style="text-align: center; padding: 20px;">
            <div style="font-size: 48px; color: var(--primary-green); margin-bottom: 20px;">🚪</div>
            <h3>Logout</h3>
            <p>Are you sure you want to logout from the system?</p>
        </div>
    `, true, function() {
        // Clear ALL session data including verification flags
        sessionStorage.removeItem('loggedIn');
        sessionStorage.removeItem('user');
        sessionStorage.removeItem('currentUser');
        sessionStorage.removeItem('authToken');
        
        // Clear critical action verifications
        sessionStorage.removeItem('criticalActionVerified');
        sessionStorage.removeItem('criticalActionTime');
        sessionStorage.removeItem('criticalActionType');
        sessionStorage.removeItem('verifiedUserRole');
        
        // Clear settings access verification
        sessionStorage.removeItem('settingsAccessVerified');
        sessionStorage.removeItem('settingsAccessTime');
        
        // Clear any other session flags
        sessionStorage.clear();
        
        currentUser = null;
        authToken = null;
        
        // Hide main app and show login
        document.getElementById('mainApp').style.display = 'none';
        document.getElementById('loginContainer').style.display = 'flex';
        
        // Show dashboard selection and hide login form
        document.getElementById('loginFormContainer').style.display = 'none';
        document.querySelector('.dashboard-selection').style.display = 'block';
        
        // Reset login form
        document.getElementById('loginForm').reset();
        document.getElementById('loginError').style.display = 'none';
        
        showModal('Logged Out', `
            <div style="text-align: center; padding: 20px;">
                <div style="font-size: 48px; color: var(--primary-green); margin-bottom: 20px;">👋</div>
                <h3>Logged Out Successfully</h3>
                <p>You have been logged out of the system.</p>
            </div>
        `);
    });
    
    // Due Date Card - Click to view my borrowing records
    const dueDateCard = document.getElementById('dueDateCard');
    if (dueDateCard) {
        dueDateCard.addEventListener('click', function() {
            showSection('borrowing');
            // Optionally scroll to my borrowing section
            setTimeout(() => {
                const myBorrowingSection = document.querySelector('[data-role~="staff"][data-role~="student"][data-role~="other"]');
                if (myBorrowingSection) {
                    myBorrowingSection.scrollIntoView({ behavior: 'smooth' });
                }
            }, 100);
        });
    }
}

// =============================================
// UI FUNCTIONS
// =============================================

/**
 * Show main application after login
 */
function showMainApp() {
    // Show everything immediately - header text was already set in checkLoginStatus()
    document.getElementById('loginContainer').style.display = 'none';
    document.getElementById('mainApp').style.display = 'block';
    document.getElementById('header').style.display = 'block';
    document.getElementById('sidebar').style.display = 'block';
    document.getElementById('mainContainer').style.display = 'block';
    document.getElementById('footer').style.display = 'block';
    
    // Update user info first
    if (currentUser) {
        document.getElementById('userName').textContent = currentUser.name;
        
        // Display role with proper formatting for Student and Staff
        const roleDisplay = document.getElementById('userRoleDisplay');
        if (roleDisplay && currentUser.role) {
            let displayRole = currentUser.role;
            if (currentUser.role.toLowerCase() === 'student') {
                displayRole = 'Student';
            } else if (currentUser.role.toLowerCase() === 'staff') {
                displayRole = 'Staff';
            }
            roleDisplay.textContent = displayRole;
        }
        
        // Set the avatar using profile picture from user data or fallback
        const userAvatar = document.getElementById('userAvatar');
        userAvatar.textContent = ''; // Clear the text content
        
        // Check if user has a profile picture
        if (currentUser.profile_picture) {
            // Use the user's uploaded profile picture
            const img = new Image();
            img.onload = function() {
                console.log('User profile image loaded successfully');
                userAvatar.style.backgroundImage = `url("images/profile_pictures/${currentUser.profile_picture}?t=${new Date().getTime()}")`;
                userAvatar.style.backgroundSize = 'cover';
                userAvatar.style.backgroundPosition = 'center';
                userAvatar.style.backgroundColor = 'transparent';
                userAvatar.style.color = 'transparent'; // Hide any text
                userAvatar.style.borderRadius = '50%'; // Ensure it stays circular
            };
            img.onerror = function() {
                console.log('User profile image failed to load, using fallback');
                // Fallback to default styling
                setFallbackAvatar(userAvatar, currentUser.name);
            };
            img.src = `images/profile_pictures/${currentUser.profile_picture}?t=${new Date().getTime()}`;
        } else {
            // Use the default profile image
            const img = new Image();
                img.onload = function() {
                console.log('Profile image loaded successfully');
                userAvatar.style.backgroundImage = `url("images/profile-pictures/profile.jpeg?t=${new Date().getTime()}")`;
                userAvatar.style.backgroundSize = 'cover';
                userAvatar.style.backgroundPosition = 'center';
                userAvatar.style.backgroundColor = 'transparent';
                userAvatar.style.color = 'transparent'; // Hide any text
                userAvatar.style.borderRadius = '50%'; // Ensure it stays circular
            };
            img.onerror = function() {
                console.log('Profile image failed to load');
                // Fallback to default styling
                setFallbackAvatar(userAvatar, currentUser.name);
            };
            img.src = `images/profile-pictures/profile.jpeg?t=${new Date().getTime()}`;
        }
        
        // Update last login time
        const now = new Date();
        document.getElementById('adminLastLogin').textContent = now.toLocaleString();
    }
    
    // Apply role-based navigation if user is logged in
    if (currentUser && currentUser.role) {
        applyRoleBasedNavigation(currentUser.role);
        applyRoleBasedStats(currentUser.role);
    }
    
    // Apply dashboard-specific customizations once more to ensure everything is correct
    applyDashboardCustomizations();
}

// Function to set fallback avatar (initials or default color)
function setFallbackAvatar(avatarElement, userName) {
    avatarElement.style.backgroundImage = '';
    avatarElement.style.backgroundColor = 'var(--accent-green)';
    avatarElement.style.color = 'var(--primary-green)';
    avatarElement.textContent = userName.charAt(0).toUpperCase();
}

// Function to open the profile picture selector
function openProfilePictureSelector() {
    document.getElementById('profilePictureInput').click();
}

// Function to handle profile picture upload with fallback
function handleProfilePictureUpload(event) {
    const file = event.target.files[0];
    if (!file) {
        console.log('No file selected');
        return;
    }
    
    console.log('Selected file:', file.name, file.size, file.type);
    
    // Validate file type - accept all image formats
    if (!file.type.match('image.*')) {
        alert('Please select a valid image file (JPEG, PNG, GIF, WebP, BMP, TIFF, etc.)');
        return;
    }
    
    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
        alert('Please select an image smaller than 5MB');
        return;
    }
    
    // Create a FormData object to send the file
    const formData = new FormData();
    formData.append('profile_picture', file);
    formData.append('user_id', currentUser ? currentUser.id : '');
    
    // Show loading indicator
    const userAvatar = document.getElementById('userAvatar');
    userAvatar.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    
    // Create the request with authorization
    const xhr = new XMLHttpRequest();
    // Use absolute path for Apache/XAMPP compatibility
    xhr.open('POST', '/cpmr_library/backend/api/upload_profile_picture.php', true);
    
    // Set up request headers
    const token = sessionStorage.getItem('authToken') || '';
    console.log('Sending request with token:', token ? 'Present' : 'Missing');
    xhr.setRequestHeader('Authorization', 'Bearer ' + token);
    
    // Handle response
    xhr.onreadystatechange = function() {
        if (xhr.readyState === 4) {
            console.log('Request completed with status:', xhr.status);
            console.log('Response text:', xhr.responseText);
            
            if (xhr.status === 200) {
                try {
                    const data = JSON.parse(xhr.responseText);
                    if (data.success) {
                        // Update the profile picture in currentUser object
                        if (currentUser) {
                            currentUser.profile_picture = data.file_path.split('/').pop(); // Extract just the filename
                            // Also update sessionStorage to persist the change
                            sessionStorage.setItem('user', JSON.stringify(currentUser));
                        }
                        // Update the profile picture display in all relevant spots
                        updateUserAvatar(data.file_path);
                        // ensure <img id="profileAvatar"> stays in sync even if updateUserAvatar didn't run
                        const profileImg = document.getElementById('profileAvatar');
                        if (profileImg) {
                            profileImg.src = data.file_path + '?t=' + new Date().getTime();
                        }
                        alert('Profile picture updated successfully!');
                    } else {
                        console.error('Upload failed:', data.message);
                        throw new Error(data.message || 'Failed to upload profile picture');
                    }
                } catch (e) {
                    console.error('Error parsing JSON response:', e);
                    console.log('Response text:', xhr.responseText);
                    alert('Error: Invalid response from server');
                }
            } else {
                console.error('Upload failed with status:', xhr.status);
                console.log('Response text:', xhr.responseText);
                
                // Restore the original avatar
                if (currentUser) {
                    const img = new Image();
                    if (currentUser.profile_picture) {
                        img.onload = function() {
                            userAvatar.style.backgroundImage = `url("images/profile_pictures/${currentUser.profile_picture}?t=${new Date().getTime()}")`;
                            userAvatar.style.backgroundSize = 'cover';
                            userAvatar.style.backgroundPosition = 'center';
                            userAvatar.style.backgroundColor = 'transparent';
                            userAvatar.style.color = 'transparent';
                            userAvatar.style.borderRadius = '50%';
                        };
                        img.onerror = function() {
                            setFallbackAvatar(userAvatar, currentUser.name);
                        };
                        img.src = `images/profile_pictures/${currentUser.profile_picture}?t=${new Date().getTime()}`;
                    } else {
                        img.onload = function() {
                            userAvatar.style.backgroundImage = `url("images/profile-pictures/profile.jpeg?t=${new Date().getTime()}")`;
                            userAvatar.style.backgroundSize = 'cover';
                            userAvatar.style.backgroundPosition = 'center';
                            userAvatar.style.backgroundColor = 'transparent';
                            userAvatar.style.color = 'transparent';
                            userAvatar.style.borderRadius = '50%';
                        };
                        img.onerror = function() {
                            setFallbackAvatar(userAvatar, currentUser.name);
                        };
                        img.src = `images/profile-pictures/profile.jpeg?t=${new Date().getTime()}`;
                    }
                }
                
                alert('Upload failed. Please try again.');
            }
        }
    };
    
    // Send the file to the server
    xhr.send(formData);
}

// Function to update user avatar display
function updateUserAvatar(imagePath) {
    const userAvatar = document.getElementById('userAvatar');
    userAvatar.textContent = '';
    
    const img = new Image();
    img.onload = function() {
        userAvatar.style.backgroundImage = `url("${imagePath}?t=${new Date().getTime()}")`;
        userAvatar.style.backgroundSize = 'cover';
        userAvatar.style.backgroundPosition = 'center';
        userAvatar.style.backgroundColor = 'transparent';
        userAvatar.style.color = 'transparent';
        userAvatar.style.borderRadius = '50%';

        // also update the static <img> used in the profile modal if present
        const profileAvatar = document.getElementById('profileAvatar');
        if (profileAvatar) {
            profileAvatar.src = imagePath + '?t=' + new Date().getTime();
        }
    };
    img.onerror = function() {
        // Fallback to initials if image fails to load
        userAvatar.style.backgroundImage = '';
        userAvatar.style.backgroundColor = 'var(--accent-green)';
        userAvatar.style.color = 'var(--primary-green)';
        if (currentUser) {
            userAvatar.textContent = currentUser.name.charAt(0).toUpperCase();
        }
    };
    // Add timestamp to bypass cache
    img.src = imagePath + '?t=' + new Date().getTime();
}

/**
 * Apply dashboard-specific customizations based on user role
 */
function applyDashboardCustomizations() {
    // Hide forgot password form when navigating to dashboard
    const forgotPasswordContainer = document.getElementById('forgotPasswordFormContainer');
    if (forgotPasswordContainer) {
        forgotPasswordContainer.style.display = 'none';
    }
    
    // Get DOM elements FIRST
    const header = document.getElementById('header');
    const logoSection = document.querySelector('.logo-section h1');
    const sidebar = document.getElementById('sidebar');
    
    console.log('DEBUG applyDashboardCustomizations:');
    console.log('  currentUser:', currentUser);
    console.log('  logoSection found:', !!logoSection);
    console.log('  header found:', !!header);
    
    // Ensure DOM is ready
    if (document.readyState !== 'complete' || !logoSection) {
        console.log('DOM not ready or logoSection missing, waiting...');
        setTimeout(() => applyDashboardCustomizations(), 100);
        return;
    }
    
    if (!currentUser || !currentUser.role) {
        console.log('No current user or role found - applying default user dashboard');
        // Apply default user dashboard for users without a role
        logoSection.innerHTML = '👤 CPMR <span style="color: #9c27b0;">USER</span> DASHBOARD';
        if (header) {
            header.style.background = 'linear-gradient(135deg, #2e7d32, #1b5e20)';
        }
        document.querySelector('.main-container')?.classList.add('user-dashboard');
        
        // Apply user-level visibility to elements
        setTimeout(() => {
            if (currentUser) {
                // Set role to 'other' for visibility purposes since it's an unknown user
                applyRoleBasedNavigation('other');
                applyRoleBasedStats('other');
            }
        }, 100);
        return;
    }
    
    const role = (currentUser.role || '').toString().toLowerCase().trim();
    console.log('  role (original):', currentUser.role);
    console.log('  role (lowercase):', role);
    
    console.log('Applying dashboard customizations for role:', role);
    console.log('Current user:', currentUser);
    
    if (!logoSection) {
        console.error('Logo section h1 element not found!');
        return;
    }
    
    // Set dashboard-specific header text and styling
    switch(role) {
        case 'admin':
            console.log('Applying ADMIN dashboard');
            logoSection.innerHTML = '<i class="bi bi-tree-fill"></i> CPMR <span style="color: #ff9800;">ADMIN</span> DASHBOARD';
            if (header) {
                header.style.background = 'linear-gradient(135deg, #2e7d32, #1b5e20)';
            }
            // Add dashboard class for styling
            document.querySelector('.main-container')?.classList.add('admin-dashboard');
            break;
        case 'librarian':
            console.log('Applying LIBRARIAN dashboard');
            logoSection.innerHTML = '<i class="bi bi-book"></i> CPMR <span style="color: #2196f3;">LIBRARIAN</span> DASHBOARD';
            if (header) {
                header.style.background = 'linear-gradient(135deg, #2e7d32, #1b5e20)';
            }
            // Add dashboard class for styling
            document.querySelector('.main-container')?.classList.add('librarian-dashboard');
            break;
        case 'student':
            console.log('Applying STUDENT dashboard (as USER)');
            logoSection.innerHTML = '👤 CPMR <span style="color: #9c27b0;">USER</span> DASHBOARD';
            if (header) {
                header.style.background = 'linear-gradient(135deg, #2e7d32, #1b5e20)';
            }
            // Add dashboard class for styling
            document.querySelector('.main-container')?.classList.add('user-dashboard');
            break;
        case 'staff':
            console.log('Applying STAFF dashboard (as USER)');
            logoSection.innerHTML = '👤 CPMR <span style="color: #9c27b0;">USER</span> DASHBOARD';
            if (header) {
                header.style.background = 'linear-gradient(135deg, #2e7d32, #1b5e20)';
            }
            // Add dashboard class for styling
            document.querySelector('.main-container')?.classList.add('user-dashboard');
            break;
        case 'other':
            console.log('Applying OTHER dashboard (as USER)');
            logoSection.innerHTML = '👤 CPMR <span style="color: #9c27b0;">USER</span> DASHBOARD';
            console.log('Other role dashboard header set to:', logoSection.innerHTML);
            if (header) {
                header.style.background = 'linear-gradient(135deg, #2e7d32, #1b5e20)';
            }
            // Add dashboard class for styling
            document.querySelector('.main-container')?.classList.add('user-dashboard');
            break;

        default:
            console.log('Applying DEFAULT dashboard (no role matched!)', role);
            // For any other roles, use a generic dashboard header
            logoSection.innerHTML = '<i class="bi bi-tree-fill"></i> CPMR <span style="color: #4caf50;">DASHBOARD</span>';
            if (header) {
                header.style.background = 'linear-gradient(135deg, #2e7d32, #1b5e20)';
            }
            // Add generic dashboard class
            document.querySelector('.main-container')?.classList.add('default-dashboard');
    }
    
    // Apply role-based navigation after a short delay to ensure DOM is ready
    setTimeout(() => {
        if (currentUser && currentUser.role) {
            applyRoleBasedNavigation(currentUser.role);
            applyRoleBasedStats(currentUser.role);
        }
    }, 100);
}

/**
 * Load librarian-specific dashboard data
 */
async function loadLibrarianDashboardData() {
    try {
        // Check if user is logged in
        if (!authToken) {
            console.log('No auth token found in loadLibrarianDashboardData');
            return;
        }
        
        // Load issued today count
        const issuedTodayResponse = await fetch(`${API_BASE_URL}/borrowing.php?action=getIssuedToday`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        // Handle 401 Unauthorized
        if (issuedTodayResponse.status === 401) {
            console.log('Authentication failed in loadLibrarianDashboardData');
            sessionStorage.clear();
            showLoginForm();
            return;
        }
        const issuedTodayData = await issuedTodayResponse.json();
        if (issuedTodayData.success) {
            document.getElementById('issuedTodayCount').textContent = issuedTodayData.count || 0;
        }
        
        // Load overdue books count
        const overdueResponse = await fetch(`${API_BASE_URL}/borrowing.php?action=getOverdueBooks`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        // Handle 401 Unauthorized
        if (overdueResponse.status === 401) {
            console.log('Authentication failed in loadLibrarianDashboardData (overdue)');
            sessionStorage.clear();
            showLoginForm();
            return;
        }
        const overdueData = await overdueResponse.json();
        if (overdueData.success) {
            document.getElementById('overdueBooksCount').textContent = overdueData.count || 0;
            
            // Also update user-facing version of this stat if it exists
            const userOverdueBooksElement = document.getElementById('userOverdueBooksCount');
            if (userOverdueBooksElement) userOverdueBooksElement.textContent = overdueData.count || 0;
        }
        
        // Load available books count
        const availableResponse = await fetch(`${API_BASE_URL}/books.php?action=getAvailableBooks`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        const availableData = await availableResponse.json();
        if (availableData.success) {
            document.getElementById('availableBooksCount').textContent = availableData.count || 0;
            // Also update the user-facing available books count if the element exists
            const userAvailableCountElement = document.getElementById('userAvailableBooksCount');
            if (userAvailableCountElement) {
                userAvailableCountElement.textContent = availableData.count || 0;
            }
        }
        
        // Load pending requests count
        const pendingResponse = await fetch(`${API_BASE_URL}/borrowing.php?action=getPendingRequests`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        // Handle 401 Unauthorized
        if (pendingResponse.status === 401) {
            console.log('Authentication failed in loadLibrarianDashboardData (pending)');
            sessionStorage.clear();
            showLoginForm();
            return;
        }
        const pendingData = await pendingResponse.json();
        if (pendingData.success) {
            document.getElementById('pendingRequestsCount').textContent = pendingData.count || 0;
            
            // Also update user-facing version of this stat if it exists
            const myPendingRequestsElement = document.getElementById('myPendingRequestsCount');
            if (myPendingRequestsElement) myPendingRequestsElement.textContent = pendingData.count || 0;
        }
        
    } catch (error) {
        console.error('Error loading librarian dashboard data:', error);
    }
}



/**
 * Initialize return book form
 */
function initializeReturnBookForm() {
    const returnBookForm = document.getElementById('returnBookForm');
    if (returnBookForm) {
        returnBookForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            // Check if user is Admin or Librarian - ROBUST CHECK
            // NOTE: User data is stored in sessionStorage, not localStorage!
            const currentUserRaw = sessionStorage.getItem('currentUser') || sessionStorage.getItem('user');
            console.log('=== RETURN BOOK - SESSION STORAGE CHECK ===');
            console.log('SessionStorage currentUser:', currentUserRaw);
            
            let currentUser;
            try {
                currentUser = JSON.parse(currentUserRaw || '{}');
            } catch (e) {
                console.error('Failed to parse currentUser from sessionStorage:', e);
                showModal('Error', 'Session data corrupted. Please log in again.');
                sessionStorage.removeItem('currentUser');
                sessionStorage.removeItem('user');
                return;
            }
            
            console.log('Parsed user object:', currentUser);
            console.log('User properties:', Object.keys(currentUser));
            console.log('User role raw value:', currentUser.role);
            console.log('User role type:', typeof currentUser.role);
            
            // ROBUST role check - handle all edge cases
            let userRole = '';
            if (currentUser.role) {
                userRole = String(currentUser.role).trim().toLowerCase();
            }
            
            console.log('Normalized role:', userRole);
            console.log('Is "admin"?', userRole === 'admin');
            console.log('Is "librarian"?', userRole === 'librarian');
            
            const isAdmin = userRole === 'admin' || userRole === 'Admin' || userRole === 'ADMIN';
            const isLibrarian = userRole === 'librarian' || userRole === 'Librarian' || userRole === 'LIBRARIAN';
            
            if (!isAdmin && !isLibrarian) {
                console.error('❌ ACCESS DENIED: Role check failed');
                console.error('Expected: "admin" or "librarian"');
                console.error('Got:', JSON.stringify(userRole));
                showModal('Access Denied', `Only Admin and Librarian users can process returns.\n\nYour role: "${currentUser.role}"`);
                return;
            }
            
            console.log('✅ Role check PASSED - User is', isAdmin ? 'ADMIN' : 'LIBRARIAN');
            
            // Check if already verified in this session (within 5 minutes)
            let verified = isCriticalActionValid();
            
            if (!verified) {
                // Require password verification first
                console.log('Password verification required for return book...');
                verified = await verifyUserPassword('return_book');
                
                if (!verified) {
                    console.error('❌ VERIFICATION FAILED - BLOCKING RETURN BOOK');
                    return;
                }
                
                console.log('✅ Verification successful - processing return');
            } else {
                console.log('✅ Already verified for critical action - proceeding');
            }
            
            const recordId = document.getElementById('borrowingRecordId').value;
            const condition = document.getElementById('returnCondition').value;
            const notes = document.getElementById('returnNotes').value;
            
            try {
                const response = await fetch(`${API_BASE_URL}/borrowing.php`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${authToken}`
                    },
                    body: JSON.stringify({
                        action: 'returnBook',
                        record_id: recordId,
                        return_condition: condition,
                        notes: notes
                    })
                });
                
                const result = await response.json();
                
                if (result.success) {
                    showModal('Success', `
                        <div style="text-align: center; padding: 20px;">
                            <div style="font-size: 48px; color: var(--primary-green); margin-bottom: 20px;">✓</div>
                            <h3>Book Returned Successfully</h3>
                            <p>Record ID: ${recordId} has been marked as returned.</p>
                            <p>Late fee: ₵${result.late_fee || 0}</p>
                        </div>
                    `);
                    
                    // Reset the form
                    returnBookForm.reset();
                    
                    // Clear verification after successful return
                    clearCriticalActionVerification();
                } else {
                    showModal('Error', `
                        <div style="text-align: center; padding: 20px;">
                            <div style="font-size: 48px; color: #dc3545; margin-bottom: 20px;">✗</div>
                            <h3>Return Failed</h3>
                            <p>${result.message}</p>
                        </div>
                    `);
                }
            } catch (error) {
                console.error('Error processing book return:', error);
                showModal('Error', 'Failed to process book return. Please try again.');
            }
        });
    }
}

// loadMyRequests function removed for staff/student/other roles

/**
 * Cancel a book request
 */
async function cancelRequest(requestId) {
    if (!confirm('Are you sure you want to cancel this request?')) {
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/requests.php`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                action: 'cancelRequest',
                request_id: requestId
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            showModal('Success', 'Request cancelled successfully');
            // Reload the requests table
            
        } else {
            showModal('Error', result.message || 'Failed to cancel request');
        }
    } catch (error) {
        console.error('Error cancelling request:', error);
        showModal('Error', 'Failed to cancel request. Please try again.');
    }
}
/**
 * Load pending requests
 */
async function loadPendingRequests() {
    try {
        const response = await fetch(`${API_BASE_URL}/requests.php?action=getPending`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            const tbody = document.getElementById('pendingRequestsTable');
            tbody.innerHTML = '';
            
            if (data.requests && data.requests.length > 0) {
                data.requests.forEach(request => {
                    const row = document.createElement('tr');
                    const decided = request.decided_at ? ` (decided: ${request.decided_at})` : '';
                    // Only show approve/reject buttons for admin and librarian roles
                    const showActionButtons = currentUser && (currentUser.role === 'Admin' || currentUser.role === 'Librarian');
                    
                    row.innerHTML = `
                        <td>${request.request_id || 'N/A'}</td>
                        <td>${request.requester_name || 'N/A'}</td>
                        <td>${request.book_title || 'N/A'}</td>
                        <td>${request.created_at || 'N/A'}</td>
                        <td>${request.status || 'N/A'}${decided}</td>
                        <td>
                            <div class="action-buttons-cell">
                                <button class="action-btn view-btn" data-id="${request.request_id}">View</button>
                                ${showActionButtons ? 
                                    `<button class="action-btn approve-btn" onclick="approveRequest(${request.request_id})" ${request.status !== 'Pending' ? 'disabled' : ''}>Approve</button>
                                     <button class="action-btn delete-btn" onclick="rejectRequest(${request.request_id})" ${request.status !== 'Pending' ? 'disabled' : ''}>Reject</button>` : 
                                    '<span>-</span>'}
                            </div>
                        </td>
                    `;
                    tbody.appendChild(row);
                });
            } else {
                const row = document.createElement('tr');
                row.innerHTML = `<td colspan="6" style="text-align: center;">No pending requests found</td>`;
                tbody.appendChild(row);
            }
        }
    } catch (error) {
        console.error('Error loading pending requests:', error);
    }
}

// loadMyRequests function removed for staff/student/other roles

/**
 * Cancel a book request
 */
async function cancelRequest(requestId) {
    if (!confirm('Are you sure you want to cancel this request?')) {
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/requests.php`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                action: 'cancelRequest',
                request_id: requestId
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            showModal('Success', 'Request cancelled successfully');
            // Reload the requests table
            
        } else {
            showModal('Error', result.message || 'Failed to cancel request');
        }
    } catch (error) {
        console.error('Error cancelling request:', error);
        showModal('Error', 'Failed to cancel request. Please try again.');
    }
}

/**
 * Approve a request
 * @param {number} requestId - ID of the request to approve
 */
async function approveRequest(requestId) {
    // Show confirmation prompt
    const confirmHTML = `
        <div style="padding: 20px; text-align: center;">
            <div style="font-size: 48px; color: #28a745; margin-bottom: 15px;">✅</div>
            <h3 style="margin-bottom: 15px; color: #333;">Confirm Approval</h3>
            <p style="color: #666; margin-bottom: 20px; line-height: 1.5;">
                Are you sure you want to approve this request?<br>
                This will create a borrowing record and notify the requester.
            </p>
            <div style="background-color: #d4edda; border: 1px solid #c3e6cb; border-radius: 6px; padding: 12px; margin: 15px 0; text-align: left;">
                <strong>⚠️ Note:</strong> Once approved, the book will be marked as borrowed and cannot be available for other members until returned.
            </div>
        </div>
    `;
    
    showModal('Approve Request', confirmHTML, true, async () => {
        try {
            const token = getAuthToken();
            if (!token) {
                showModal('Error', 'Authentication required. Please log in again.');
                handleLogout();
                return;
            }
            
            const response = await fetch(`${API_BASE_URL}/requests.php`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    action: 'approve',
                    request_id: requestId
                })
            });
            
            const result = await response.json();
            
            if (result.success) {
                showModal('Success', 'Request approved successfully!');
                
                // Send push notification to all users about the approval
                sendPushNotification('📚 Request Approved', {
                    body: '✅ A book request has been approved and is ready for pickup!',
                    tag: `request-approval-${requestId}`,
                    requireInteraction: false
                });
                
                loadPendingRequests(); // Refresh the list
            } else {
                // Check if it's an auth error
                if (response.status === 401 || result.message === 'Authentication required') {
                    showModal('Error', 'Your session has expired. Please log in again.');
                    handleLogout();
                } else {
                    showModal('Error', result.message || 'Failed to approve request');
                }
            }
        } catch (error) {
            console.error('Error approving request:', error);
            showModal('Error', 'Failed to approve request. Please try again.');
        }
    });
}

/**
 * Reject a request
 * @param {number} requestId - ID of the request to reject
 */
async function rejectRequest(requestId) {
    // Show confirmation prompt
    const confirmHTML = `
        <div style="padding: 20px; text-align: center;">
            <div style="font-size: 48px; color: #dc3545; margin-bottom: 15px;">❌</div>
            <h3 style="margin-bottom: 15px; color: #333;">Confirm Rejection</h3>
            <p style="color: #666; margin-bottom: 20px; line-height: 1.5;">
                Are you sure you want to reject this request?<br>
                The requester will be notified and the book will remain available.
            </p>
            <div style="background-color: #f8d7da; border: 1px solid #f5c6cb; border-radius: 6px; padding: 12px; margin: 15px 0; text-align: left;">
                <strong>⚠️ Note:</strong> This action cannot be undone. The member will need to submit a new request if they still want the book.
            </div>
        </div>
    `;
    
    showModal('Reject Request', confirmHTML, true, async () => {
        try {
            const token = getAuthToken();
            if (!token) {
                showModal('Error', 'Authentication required. Please log in again.');
                handleLogout();
                return;
            }
            
            const response = await fetch(`${API_BASE_URL}/requests.php`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    action: 'decline',
                    request_id: requestId
                })
            });
            
            const result = await response.json();
            
            if (result.success) {
                showModal('Success', 'Request rejected successfully!');
                
                // Send push notification about the rejection
                sendPushNotification('📚 Request Declined', {
                    body: '❌ Your book request has been declined.',
                    tag: `request-decline-${requestId}`,
                    requireInteraction: false
                });
                
                loadPendingRequests(); // Refresh the list
            } else {
                // Check if it's an auth error
                if (response.status === 401 || result.message === 'Authentication required') {
                    showModal('Error', 'Your session has expired. Please log in again.');
                    handleLogout();
                } else {
                    showModal('Error', result.message || 'Failed to reject request');
                }
            }
        } catch (error) {
            console.error('Error rejecting request:', error);
            showModal('Error', 'Failed to reject request. Please try again.');
        }
    });
}

/**
 * Load overdue books
 */
async function loadOverdueBooks() {
    try {
        // Check if user is logged in
        if (!authToken) {
            console.log('No auth token found in loadOverdueBooks');
            return;
        }
        
        const response = await fetch(`${API_BASE_URL}/borrowing.php?action=getOverdueBooksDetailed`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        // Handle 401 Unauthorized
        if (response.status === 401) {
            console.log('Authentication failed in loadOverdueBooks');
            sessionStorage.clear();
            showLoginForm();
            return;
        }
        
        const data = await response.json();
        
        if (data.success) {
            const tbody = document.getElementById('overdueBooksTable');
            tbody.innerHTML = '';
            
            if (data.books && data.books.length > 0) {
                data.books.forEach(book => {
                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td>${book.member_name || 'N/A'}</td>
                        <td>${book.book_title || 'N/A'}</td>
                        <td>${book.borrow_date || 'N/A'}</td>
                        <td>${book.due_date || 'N/A'}</td>
                        <td>${book.days_overdue || 'N/A'}</td>
                        <td>₵${book.fine_amount || '0.00'}</td>
                        <td>
                            <div class="action-buttons-cell">
                                <button class="action-btn view-btn" onclick="processFinePayment(${book.record_id})">Offline Payment</button>
                                <button class="action-btn edit-btn" onclick="contactMember('${book.member_email}')">Contact</button>
                            </div>
                        </td>
                    `;
                    tbody.appendChild(row);
                });
            } else {
                const row = document.createElement('tr');
                row.innerHTML = `<td colspan="7" style="text-align: center;">No overdue books found</td>`;
                tbody.appendChild(row);
            }
        }
    } catch (error) {
        console.error('Error loading overdue books:', error);
    }
}

/**
 * Load fine records
 */
async function loadFineRecords() {
    try {
        // Check if user is logged in
        if (!authToken) {
            console.log('No auth token found in loadFineRecords');
            return;
        }
        
        const response = await fetch(`${API_BASE_URL}/borrowing.php?action=getFineRecords`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        // Handle 401 Unauthorized
        if (response.status === 401) {
            console.log('Authentication failed in loadFineRecords');
            sessionStorage.clear();
            showLoginForm();
            return;
        }
        
        const data = await response.json();
        
        if (data.success) {
            const tbody = document.getElementById('finesTable');
            tbody.innerHTML = '';
            
            if (data.fines && data.fines.length > 0) {
                data.fines.forEach(fine => {
                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td>${fine.record_id || 'N/A'}</td>
                        <td>${fine.member_name || 'N/A'}</td>
                        <td>${fine.book_title || 'N/A'}</td>
                        <td>${fine.due_date || 'N/A'}</td>
                        <td>₵${fine.fine_amount || '0.00'}</td>
                        <td>${fine.status || 'N/A'}</td>
                        <td>
                            <div class="action-buttons-cell">
                                <button class="action-btn view-btn" onclick="confirmPayFine(${fine.record_id}, this)">Pay Fine</button>
                                <button class="action-btn edit-btn" onclick="confirmWaiveFine(${fine.record_id}, this)">Waive</button>
                            </div>
                        </td>
                    `;
                    tbody.appendChild(row);
                });
            } else {
                const row = document.createElement('tr');
                row.innerHTML = `<td colspan="7" style="text-align: center;">No fine records found</td>`;
                tbody.appendChild(row);
            }
        }
    } catch (error) {
        console.error('Error loading fine records:', error);
    }
}

/**
 * Process fine payment
 * @param {number} recordId - ID of the record to process payment for
 */
async function processFinePayment(recordId) {
    // Show offline payment information
    showModal('Offline Payment', `
        <div style="padding: 20px; text-align: center;">
            <h3>Payment Information</h3>
            <p style="margin: 20px 0; font-size: 18px; font-weight: bold;">We only accept mobile money or cash</p>
            <div class="action-buttons" style="margin-top: 30px;">
                <button class="btn btn-secondary" onclick="closeCurrentModal();">
                    <span>❌</span>
                    Close
                </button>
            </div>
        </div>
    `);
}

async function confirmPayFine(recordId, buttonElement) {
    // Check if already waived
    const waiveButton = document.querySelector(`[onclick*="confirmWaiveFine(${recordId}"]`);
    if (waiveButton && (waiveButton.textContent === 'Waived' || waiveButton.disabled)) {
        showModal('Error', 'This fine has already been waived and cannot be paid.');
        return;
    }
    
    // Show confirmation dialog
    showModal('Confirm Payment', `
        <div style="padding: 20px; text-align: center;">
            <h3>Confirm Payment</h3>
            <p style="margin: 20px 0;">Are you sure you want to mark this fine as paid?</p>
            <div class="action-buttons" style="margin-top: 20px;">
                <button class="btn btn-primary" onclick="markAsPaid(${recordId}, '${buttonElement.id}'); closeCurrentModal();">
                    <span>✅</span>
                    Yes, Confirm
                </button>
                <button class="btn btn-secondary" onclick="closeCurrentModal();">
                    <span>❌</span>
                    Cancel
                </button>
            </div>
        </div>
    `);
}

function markAsPaid(recordId, buttonId) {
    // Find the Pay button and change its text
    const payButton = document.querySelector(`[onclick*="confirmPayFine(${recordId}"]`);
    if (payButton) {
        payButton.textContent = 'Paid';
        payButton.disabled = true;
        payButton.style.backgroundColor = '#28a745';
        payButton.style.color = 'white';
    }
    
    // Disable the Waive button for this record
    const waiveButton = document.querySelector(`[onclick*="confirmWaiveFine(${recordId}"]`);
    if (waiveButton) {
        waiveButton.disabled = true;
        waiveButton.style.opacity = '0.5';
    }
    
    // Show success message
    showModal('Success', 'Fine marked as paid successfully!');
}

async function confirmWaiveFine(recordId, buttonElement) {
    // Check if already paid
    const payButton = document.querySelector(`[onclick*="confirmPayFine(${recordId}"]`);
    if (payButton && (payButton.textContent === 'Paid' || payButton.disabled)) {
        showModal('Error', 'This fine has already been paid and cannot be waived.');
        return;
    }
    
    // Show confirmation dialog
    showModal('Confirm Waive', `
        <div style="padding: 20px; text-align: center;">
            <h3>Confirm Waive</h3>
            <p style="margin: 20px 0;">Are you sure you want to waive this fine?</p>
            <div class="action-buttons" style="margin-top: 20px;">
                <button class="btn btn-primary" onclick="markAsWaived(${recordId}, '${buttonElement.id}'); closeCurrentModal();">
                    <span>✅</span>
                    Yes, Confirm
                </button>
                <button class="btn btn-secondary" onclick="closeCurrentModal();">
                    <span>❌</span>
                    Cancel
                </button>
            </div>
        </div>
    `);
}

function markAsWaived(recordId, buttonId) {
    // Find the Waive button and change its text
    const waiveButton = document.querySelector(`[onclick*="confirmWaiveFine(${recordId}"]`);
    if (waiveButton) {
        waiveButton.textContent = 'Waived';
        waiveButton.disabled = true;
        waiveButton.style.backgroundColor = '#ffc107';
        waiveButton.style.color = 'black';
    }
    
    // Disable the Pay button for this record
    const payButton = document.querySelector(`[onclick*="confirmPayFine(${recordId}"]`);
    if (payButton) {
        payButton.disabled = true;
        payButton.style.opacity = '0.5';
    }
    
    // Show success message
    showModal('Success', 'Fine waived successfully!');
}



/**
 * Waive a fine
 * @param {number} recordId - ID of the record to waive fine for
 */
async function waiveFine(recordId) {
    try {
        const response = await fetch(`${API_BASE_URL}/borrowing.php`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                action: 'waiveFine',
                record_id: recordId
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            showModal('Success', 'Fine waived successfully!');
            loadFineRecords(); // Refresh the list
            loadOverdueBooks(); // Refresh overdue books too
        } else {
            showModal('Error', result.message || 'Failed to waive fine');
        }
    } catch (error) {
        console.error('Error waiving fine:', error);
        showModal('Error', 'Failed to waive fine. Please try again.');
    }
}

/**
 * Contact member
 * @param {string} email - Email of the member to contact
 */
function contactMember(email) {
    showModal('Contact Member', `
        <div style="padding: 20px;">
            <h3>Contact Member</h3>
            <p>Email: <a href="mailto:${email}">${email}</a></p>
            <div class="action-buttons" style="margin-top: 20px;">
                <button class="btn btn-primary" onclick="window.open('mailto:${email}', '_blank'); closeCurrentModal();">
                    <span>📧</span>
                    Send Email
                </button>
                <button class="btn btn-secondary" onclick="closeCurrentModal();">
                    <span>❌</span>
                    Cancel
                </button>
            </div>
        </div>
    `);
}



/**
 * Apply role-based navigation
 * @param {string} userRole - The role of the current user
 */
function applyRoleBasedNavigation(userRole) {
    // Ensure userRole is a string and normalize it
    const normalizedRole = (userRole || '').toString().toLowerCase().trim();
    
    if (!normalizedRole) {
        console.warn('No valid user role for navigation - defaulting to user permissions');
    }
    
    const navItems = document.querySelectorAll('#navMenu .nav-item');
    
    navItems.forEach(item => {
        const roles = item.getAttribute('data-role');
        const target = item.querySelector('.nav-link')?.getAttribute('data-target');
        
        if (roles) {
            const allowedRoles = roles.split(' ').map(r => r.toLowerCase());
            
            // Special handling for request sections to avoid conflicts
            
            if (allowedRoles.includes(normalizedRole) || allowedRoles.includes('all')) {
                item.style.display = 'list-item';
            } else {
                item.style.display = 'none';
            }
        } else {
            // Items without data-role are visible to all users
            item.style.display = 'list-item';
        }
    });
    
    // Adjust main container margin based on sidebar width
    adjustMainContainerMargin();
    // Apply role-based visibility to other controls and stat cards
    applyRoleBasedStats(userRole);
    applyRoleBasedControls(userRole);
}

/**
 * Apply role-based visibility to stat cards
 * @param {string} userRole - The role of the current user
 */
function applyRoleBasedStats(userRole) {
    // Normalize role
    const normalizedRole = (userRole || '').toString().toLowerCase().trim();
    
    const statCards = document.querySelectorAll('.stat-card');
    
    statCards.forEach(card => {
        const roles = card.getAttribute('data-role');
        
        if (roles) {
            const allowedRoles = roles.split(' ').map(r => r.toLowerCase());
            
            if (allowedRoles.includes(normalizedRole) || allowedRoles.includes('all')) {
                card.style.display = 'block';
            } else {
                card.style.display = 'none';
            }
        } else {
            // Cards without data-role are visible to all users
            card.style.display = 'block';
        }
    });
}

/**
 * Show/hide any DOM elements that have a `data-role` attribute.
 * @param {string} userRole
 */
function applyRoleBasedControls(userRole) {
    // Normalize role
    const normalizedRole = (userRole || '').toString().toLowerCase().trim();
    
    const elems = document.querySelectorAll('[data-role]');
    elems.forEach(el => {
        const roles = el.getAttribute('data-role');
        if (!roles) return;
        const allowedRoles = roles.split(/\s+/).map(r => r.toLowerCase());
        if (allowedRoles.includes(normalizedRole) || allowedRoles.includes('all')) {
            // Restore default display by removing inline display style
            el.style.display = '';
        } else {
            el.style.display = 'none';
        }
    });
}

/**
 * Adjust main container margin based on sidebar width
 */
function adjustMainContainerMargin() {
    const sidebar = document.getElementById('sidebar');
    const mainContainer = document.getElementById('mainContainer');
    const footer = document.getElementById('footer');
    
    if (sidebar && mainContainer) {
        const sidebarWidth = sidebar.offsetWidth;
        mainContainer.style.marginLeft = `${sidebarWidth}px`;
        
        if (footer) {
            footer.style.marginLeft = `${sidebarWidth}px`;
        }
    }
}

/**
 * Close current modal
 */
function closeCurrentModal() {
    const modalOverlay = document.getElementById('modalOverlay');
    if (modalOverlay) {
        modalOverlay.style.display = 'none';
    }
}

/**
 * Select dashboard and show login form
 * @param {string} role - The role to select
 */
function selectDashboard(role) {
    document.getElementById('selectedRole').value = role;
    
    // Set placeholder username based on role with proper display names
    const usernameInput = document.getElementById('username');
    let displayName;
    
    switch(role) {
        case 'admin':
            displayName = 'admin';
            break;
        case 'librarian':
            displayName = 'librarian';
            break;
        case 'staff':
            displayName = 'user';
            break;
        case 'student':
            displayName = 'student';
            break;
        default:
            displayName = role;
    }
    
    usernameInput.placeholder = `Enter ${displayName} username or email`;
    usernameInput.value = ''; // Clear any previous value
    
    // Set focus to username field
    usernameInput.focus();
    
    // Show login form and hide dashboard selection
    document.getElementById('loginFormContainer').style.display = 'block';
    document.querySelector('.dashboard-selection').style.display = 'none';
    
    // DO NOT set default password - this can cause autocomplete issues with search boxes
    // Instead, let users enter their own credentials
    document.getElementById('password').value = '';
}

/**
 * Show dashboard selection and hide login form
 */
function showDashboardSelection() {
    document.getElementById('loginFormContainer').style.display = 'none';
    document.getElementById('signupFormContainer').style.display = 'none';
    document.getElementById('forgotPasswordFormContainer').style.display = 'none';
    document.querySelector('.dashboard-selection').style.display = 'block';
}

/**
 * Show login form and hide dashboard selection
 */
function showLoginForm() {
    document.querySelector('.dashboard-selection').style.display = 'none';
    document.getElementById('signupFormContainer').style.display = 'none';
    document.getElementById('forgotPasswordFormContainer').style.display = 'none';
    document.getElementById('loginFormContainer').style.display = 'block';
}

/**
 * Show signup form and hide other forms
 */
function showSignupForm() {
    document.querySelector('.dashboard-selection').style.display = 'none';
    document.getElementById('loginFormContainer').style.display = 'none';
    document.getElementById('forgotPasswordFormContainer').style.display = 'none';
    document.getElementById('signupFormContainer').style.display = 'block';
    
    // Clear the signup form fields to prevent autocomplete issues
    const signupForm = document.getElementById('signupForm');
    if (signupForm) {
        signupForm.reset();
        
        // Specifically clear the name field to prevent browser autocomplete
        const nameField = document.getElementById('signupName');
        if (nameField) {
            nameField.value = '';
            // Add a small delay to ensure browser doesn't auto-fill
            setTimeout(() => {
                if (nameField.value !== '') {
                    nameField.value = '';
                }
            }, 50);
        }
    }
    
    // Reset to step 1
    currentStep = 1;
    
    // Hide all steps initially
    document.querySelectorAll('.form-step').forEach(el => {
        el.style.display = 'none';
    });
    
    // Show first step
    const step1 = document.getElementById('step1');
    if (step1) {
        step1.style.display = 'block';
    }
    
    // Initialize progress bar
    updateProgressBar();
    
    // Scroll to show the form on mobile devices
    if (window.innerWidth <= 480) {
        setTimeout(() => {
            document.getElementById('signupFormContainer').scrollIntoView({ 
                behavior: 'smooth', 
                block: 'start' 
            });
        }, 100);
    }
    
    // NOTE: Dropdowns are loaded once in setupEventListeners(), not here
    // This prevents duplicate options from being added
}

/**
 * Show forgot password form
 */
function showForgotPasswordForm() {
    document.querySelector('.dashboard-selection').style.display = 'none';
    document.getElementById('loginFormContainer').style.display = 'none';
    document.getElementById('signupFormContainer').style.display = 'none';
    document.getElementById('forgotPasswordFormContainer').style.display = 'block';
    
    // Reset the forget password form
    document.getElementById('forgotPasswordVerifyForm').reset();
    document.getElementById('verifySecurityAnswerForm').reset();
    document.getElementById('resetPasswordForm').reset();
    
    // Show only the first step
    document.getElementById('forgotPasswordStep').style.display = 'block';
    document.getElementById('verifySecurityAnswerStep').style.display = 'none';
    document.getElementById('resetPasswordStep').style.display = 'none';
}

/**
 * Get security question for forgot password
 */
async function getForgotPasswordQuestion() {
    const username = document.getElementById('forgotUsername').value.trim();
    const errorDiv = document.getElementById('forgotPasswordError');
    
    if (!username) {
        errorDiv.textContent = 'Please enter your username or email';
        errorDiv.style.display = 'block';
        return;
    }
    
    errorDiv.style.display = 'none';
    
    try {
        const response = await fetch(`${API_BASE_URL}/forgot_password.php`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                action: 'get-security-question',
                username: username
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            // Store user info for next step
            window.resetUserData = data;
            
            // Show security question
            document.getElementById('securityQuestionLabel').textContent = data.security_question;
            document.getElementById('userInfoDisplay').innerHTML = `
                Account: <strong>${data.username}</strong><br>
                Name: <strong>${data.name}</strong>
            `;
            
            // Move to step 2
            document.getElementById('forgotPasswordStep').style.display = 'none';
            document.getElementById('verifySecurityAnswerStep').style.display = 'block';
            document.getElementById('securityAnswerInput').focus();
        } else {
            errorDiv.textContent = data.message || 'User not found';
            errorDiv.style.display = 'block';
        }
    } catch (error) {
        errorDiv.textContent = 'Error: ' + error.message;
        errorDiv.style.display = 'block';
    }
}

/**
 * Verify security answer
 */
async function verifySecurityAnswer() {
    const answer = document.getElementById('securityAnswerInput').value.trim();
    const errorDiv = document.getElementById('forgotPasswordError2');
    
    if (!answer) {
        errorDiv.textContent = 'Please enter your security answer';
        errorDiv.style.display = 'block';
        return;
    }
    
    errorDiv.style.display = 'none';
    
    try {
        const response = await fetch(`${API_BASE_URL}/forgot_password.php`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                action: 'verify-security-answer',
                user_id: window.resetUserData.user_id,
                security_answer: answer
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            // Store reset token
            window.resetUserData.reset_token = data.reset_token;
            
            // Move to step 3
            document.getElementById('verifySecurityAnswerStep').style.display = 'none';
            document.getElementById('resetPasswordStep').style.display = 'block';
            document.getElementById('newPassword').focus();
        } else {
            errorDiv.textContent = data.message || 'Verification failed';
            errorDiv.style.display = 'block';
        }
    } catch (error) {
        errorDiv.textContent = 'Error: ' + error.message;
        errorDiv.style.display = 'block';
    }
}

/**
 * Reset password with new password
 */
async function resetPassword() {
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    const errorDiv = document.getElementById('forgotPasswordError3');
    
    // Validate
    if (!newPassword || !confirmPassword) {
        errorDiv.textContent = 'Please enter and confirm your new password';
        errorDiv.style.display = 'block';
        return;
    }
    
    if (newPassword.length < 6) {
        errorDiv.textContent = 'Password must be at least 6 characters long';
        errorDiv.style.display = 'block';
        return;
    }
    
    if (newPassword !== confirmPassword) {
        errorDiv.textContent = 'Passwords do not match';
        errorDiv.style.display = 'block';
        return;
    }
    
    errorDiv.style.display = 'none';
    
    try {
        const response = await fetch(`${API_BASE_URL}/forgot_password.php`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                action: 'reset-password',
                user_id: window.resetUserData.user_id,
                reset_token: window.resetUserData.reset_token,
                new_password: newPassword
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            // Show success message
            const successDiv = document.getElementById('resetPasswordStep');
            successDiv.innerHTML = `
                <div style="text-align: center; padding: 40px 20px;">
                    <div style="font-size: 48px; margin-bottom: 20px;">✅</div>
                    <h3 style="color: #1b5e20; margin-bottom: 10px;">Password Reset Successful!</h3>
                    <p style="color: #666; margin-bottom: 20px;">Your password has been reset. You can now log in with your new password.</p>
                    <button class="auth-btn auth-btn-primary" onclick="showLoginForm()" style="width: 100%;">Back to Login</button>
                </div>
            `;
        } else {
            errorDiv.textContent = data.message || 'Password reset failed';
            errorDiv.style.display = 'block';
        }
    } catch (error) {
        errorDiv.textContent = 'Error: ' + error.message;
        errorDiv.style.display = 'block';
    }
}

/**
 * Toggle password visibility
 * @param {string} inputId - The ID of the password input field
 */
/**
 * Toggle password visibility with proper event handling
 * @param {Event} event - The click event from the button
 * @param {string} inputId - The ID of the password input field
 */
function togglePasswordVisibilityButton(event, inputId) {
    // Prevent the button click from affecting the input field
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
    
    const input = document.getElementById(inputId);
    if (!input) {
        console.error('Password input with id:', inputId, 'not found');
        return false;
    }
    
    // Toggle password visibility
    if (input.type === 'password') {
        input.type = 'text';
        input.setAttribute('data-visible', 'true');
    } else {
        input.type = 'password';
        input.setAttribute('data-visible', 'false');
    }
    
    return false; // Prevent any default button behavior
}

/**
 * Legacy function for backwards compatibility
 */
function togglePasswordVisibility(inputId) {
    // Create a synthetic event object since this is called from onclick
    const input = document.getElementById(inputId);
    if (!input) {
        console.error('Password input with id:', inputId, 'not found');
        return false;
    }
    
    // Toggle password visibility
    if (input.type === 'password') {
        input.type = 'text';
        input.setAttribute('data-visible', 'true');
    } else {
        input.type = 'password';
        input.setAttribute('data-visible', 'false');
    }
    
    return false;
}

// =============================================
// REGISTRATION FUNCTIONS
// =============================================

/**
 * Load dropdown data for registration form
 */
let isLoadingDropdowns = false;
let dropdownsLoaded = false;

async function loadRegistrationDropdowns() {
    // Prevent multiple simultaneous calls
    if (isLoadingDropdowns || dropdownsLoaded) {
        console.log('[DROPDOWNS] Already loading or already loaded, skipping...');
        return;
    }
    
    isLoadingDropdowns = true;
    console.log('[DROPDOWNS] Starting to load dropdowns...');
    
    try {
        // Load institutions
        const institutionsResponse = await fetch(`${API_BASE_URL}/registration_data.php?type=institutions`);
        const institutionsData = await institutionsResponse.json();
        
        if (institutionsData.success) {
            const institutionSelect = document.getElementById('signupInstitution');
            
            // COMPLETELY clear all options except first 2 defaults
            if (institutionSelect) {
                const initialLength = institutionSelect.options.length;
                for (let i = initialLength - 1; i >= 2; i--) {
                    institutionSelect.remove(i);
                }
                
                // Add institutions WITHOUT duplicates
                const addedValues = new Set();
                institutionsData.data.forEach(institution => {
                    if (!addedValues.has(institution.name)) {
                        const option = document.createElement('option');
                        option.value = institution.name;
                        option.textContent = institution.name;
                        institutionSelect.appendChild(option);
                        addedValues.add(institution.name);
                    }
                });
            }
            console.log('[DROPDOWNS] Institution options after load:', institutionSelect.options.length);
        }
        
        // Load departments
        const departmentsResponse = await fetch(`${API_BASE_URL}/registration_data.php?type=departments`);
        const departmentsData = await departmentsResponse.json();
        
        if (departmentsData.success) {
            const departmentSelect = document.getElementById('signupDepartment');
            // COMPLETELY clear all options except first 2 defaults
            if (departmentSelect) {
                // Remove ALL options starting from index 2
                const initialLength = departmentSelect.options.length;
                for (let i = initialLength - 1; i >= 2; i--) {
                    departmentSelect.remove(i);
                }
                
                // Add departments WITHOUT duplicates
                const addedValues = new Set();
                departmentsData.data.forEach(department => {
                    if (!addedValues.has(department.name)) {
                        const option = document.createElement('option');
                        option.value = department.name;
                        option.textContent = department.name;
                        departmentSelect.appendChild(option);
                        addedValues.add(department.name);
                    }
                });
            }
        }
        
        // Load ID types
        const idTypesResponse = await fetch(`${API_BASE_URL}/registration_data.php?type=id_types`);
        const idTypesData = await idTypesResponse.json();
        
        if (idTypesData.success) {
            const idTypeSelect = document.getElementById('signupIdType');
            // Clear existing options except the first two (default and OTHER)
            if (idTypeSelect) {
                while (idTypeSelect.options.length > 2) {
                    idTypeSelect.remove(2);
                }
                
                idTypesData.data.forEach(idType => {
                    const option = document.createElement('option');
                    option.value = idType.value;
                    option.textContent = idType.label;
                    idTypeSelect.appendChild(option);
                });
            }
        }
        
        // Load security questions
        const securityQuestionsResponse = await fetch(`${API_BASE_URL}/registration_data.php?type=security_questions`);
        const securityQuestionsData = await securityQuestionsResponse.json();
        
        if (securityQuestionsData.success) {
            const securityQuestionSelect = document.getElementById('signupSecurityQuestion');
            // Clear existing options except the first one (default)
            if (securityQuestionSelect) {
                while (securityQuestionSelect.options.length > 1) {
                    securityQuestionSelect.remove(1);
                }
                
                securityQuestionsData.data.forEach(question => {
                    const option = document.createElement('option');
                    option.value = question.question;
                    option.textContent = question.question;
                    securityQuestionSelect.appendChild(option);
                });
            }
        }
        
        // Mark dropdowns as loaded
        dropdownsLoaded = true;
        isLoadingDropdowns = false;
        console.log('[DROPDOWNS] Dropdowns loaded successfully!');
        
    } catch (error) {
        console.error('Error loading registration dropdowns:', error);
        isLoadingDropdowns = false;
    }
}

/**
 * Handle role selection change
 */
function handleRoleChange() {
    const role = this.value;
    
    // Hide all role-specific fields
    const studentFields = document.getElementById('studentFields');
    const staffFields = document.getElementById('staffFields');
    const otherFields = document.getElementById('otherFields');
    
    if (studentFields) studentFields.style.display = 'none';
    if (staffFields) staffFields.style.display = 'none';
    if (otherFields) otherFields.style.display = 'none';
    
    // Reset required attributes for hidden fields and set accessibility attributes
    if (studentFields) {
        studentFields.querySelectorAll('input[required], select[required]').forEach(field => {
            field.removeAttribute('required');
            // Add accessibility attributes to hidden required fields
            if (field.offsetParent === null) { // Check if element is hidden
                field.setAttribute('tabindex', '-1');
                field.setAttribute('aria-hidden', 'true');
            }
        });
    }
    if (staffFields) {
        staffFields.querySelectorAll('input[required], select[required]').forEach(field => {
            field.removeAttribute('required');
            // Add accessibility attributes to hidden required fields
            if (field.offsetParent === null) { // Check if element is hidden
                field.setAttribute('tabindex', '-1');
                field.setAttribute('aria-hidden', 'true');
            }
        });
    }
    if (otherFields) {
        otherFields.querySelectorAll('input[required], select[required]').forEach(field => {
            field.removeAttribute('required');
            // Add accessibility attributes to hidden required fields
            if (field.offsetParent === null) { // Check if element is hidden
                field.setAttribute('tabindex', '-1');
                field.setAttribute('aria-hidden', 'true');
            }
        });
    }
    
    // Show relevant fields based on role and set required attributes appropriately
    if (role === 'student') {
        if (studentFields) {
            studentFields.style.display = 'block';
            // Set required attributes for student fields
            const studentInputs = studentFields.querySelectorAll('input[data-required-when-visible], select[data-required-when-visible]');
            studentInputs.forEach(field => {
                if (field.hasAttribute('data-required-when-visible')) {
                    field.setAttribute('required', 'required');
                    // Remove accessibility attributes when field becomes visible
                    field.removeAttribute('tabindex');
                    field.removeAttribute('aria-hidden');
                }
            });
        }
    } else if (role === 'staff') {
        if (staffFields) {
            staffFields.style.display = 'block';
            // Set required attributes for staff fields
            const staffInputs = staffFields.querySelectorAll('input[data-required-when-visible], select[data-required-when-visible]');
            staffInputs.forEach(field => {
                if (field.hasAttribute('data-required-when-visible')) {
                    field.setAttribute('required', 'required');
                    // Remove accessibility attributes when field becomes visible
                    field.removeAttribute('tabindex');
                    field.removeAttribute('aria-hidden');
                }
            });
        }
    } else if (role === 'other') {
        if (otherFields) {
            otherFields.style.display = 'block';
            
            // Set required attributes for other fields
            const otherInputs = otherFields.querySelectorAll('input[data-required-when-visible], select[data-required-when-visible]');
            otherInputs.forEach(field => {
                if (field.hasAttribute('data-required-when-visible')) {
                    field.setAttribute('required', 'required');
                    // Remove accessibility attributes when field becomes visible
                    field.removeAttribute('tabindex');
                    field.removeAttribute('aria-hidden');
                }
            });
            
            // Specifically handle ID number field for 'other' role
            const idNumberInput = document.getElementById('signupIdNumber');
            if (idNumberInput && idNumberInput.hasAttribute('data-required-when-visible')) {
                idNumberInput.setAttribute('required', 'required');
                idNumberInput.removeAttribute('tabindex');
                idNumberInput.removeAttribute('aria-hidden');
            }
        }
    }
}

// ==================== MULTI-STEP FORM NAVIGATION ====================

let currentStep = 1;

/**
 * Go to specific step
 */
function goToStep(step) {
    // Validate previous steps before jumping forward
    if (step > currentStep && !validateCurrentStep()) {
        return;
    }
    
    currentStep = step;
    
    // Hide all steps
    document.querySelectorAll('.form-step').forEach(el => {
        el.style.display = 'none';
    });
    
    // Show current step
    const currentStepEl = document.getElementById(`step${step}`);
    if (currentStepEl) {
        currentStepEl.style.display = 'block';
    }
    
    // Update progress bar
    updateProgressBar();
    
    // Scroll to top of form on mobile
    if (window.innerWidth <= 480) {
        document.getElementById('signupFormContainer').scrollIntoView({ 
            behavior: 'smooth', 
            block: 'start' 
        });
    }
}

/**
 * Move to next step
 */
function nextStep(targetStep) {
    if (!validateCurrentStep()) {
        return;
    }
    
    goToStep(targetStep);
}

/**
 * Move to previous step
 */
function previousStep(targetStep) {
    currentStep = targetStep;
    
    // Hide all steps
    document.querySelectorAll('.form-step').forEach(el => {
        el.style.display = 'none';
    });
    
    // Show current step
    const currentStepEl = document.getElementById(`step${targetStep}`);
    if (currentStepEl) {
        currentStepEl.style.display = 'block';
    }
    
    // Update progress bar
    updateProgressBar();
}

/**
 * Update progress bar state
 */
function updateProgressBar() {
    const steps = document.querySelectorAll('.progress-step');
    const lines = document.querySelectorAll('.progress-line');
    
    steps.forEach((step, index) => {
        const stepNum = index + 1;
        
        // Reset classes
        step.classList.remove('active', 'completed');
        
        if (stepNum < currentStep) {
            step.classList.add('completed');
        } else if (stepNum === currentStep) {
            step.classList.add('active');
        }
    });
    
    // Update progress lines
    lines.forEach((line, index) => {
        const lineNum = index + 1;
        if (lineNum < currentStep) {
            line.classList.add('filled');
        } else {
            line.classList.remove('filled');
        }
    });
}

/**
 * Validate current step fields
 */
function validateCurrentStep() {
    let isValid = true;
    const errorEl = document.getElementById('signupError');
    
    if (currentStep === 1) {
        // Validate Step 1: Basic Info
        const name = document.getElementById('signupName');
        const email = document.getElementById('signupEmail');
        const username = document.getElementById('signupUsername');
        const password = document.getElementById('signupPassword');
        
        // Check required fields
        if (!name.value.trim()) {
            showError(errorEl, 'Please enter your full name');
            name.focus();
            return false;
        }
        
        if (!email.value.trim() || !isValidEmail(email.value)) {
            showError(errorEl, 'Please enter a valid email address');
            email.focus();
            return false;
        }
        
        if (!username.value.trim()) {
            showError(errorEl, 'Please choose a username');
            username.focus();
            return false;
        }
        
        if (!password.value || password.value.length < 6) {
            showError(errorEl, 'Password must be at least 6 characters');
            password.focus();
            return false;
        }
        
        // Clear any previous errors
        hideError(errorEl);
    }
    
    if (currentStep === 2) {
        // Validate Step 2: Role Details
        const role = document.getElementById('signupRole');
        
        if (!role.value) {
            showError(errorEl, 'Please select your role (Student/Staff/Other)');
            role.focus();
            return false;
        }
        
        // Validate role-specific fields
        if (role.value === 'student') {
            const institution = document.getElementById('signupInstitution');
            const program = document.getElementById('signupProgram');
            
            if (!institution.value) {
                showError(errorEl, 'Please select your university');
                institution.focus();
                return false;
            }
            
            if (institution.value === 'OTHER') {
                const customInstitution = document.getElementById('signupCustomInstitution');
                if (!customInstitution.value.trim()) {
                    showError(errorEl, 'Please specify your university');
                    customInstitution.focus();
                    return false;
                }
            }
            
            if (!program.value.trim()) {
                showError(errorEl, 'Please enter your program of study');
                program.focus();
                return false;
            }
        }
        
        if (role.value === 'staff') {
            const department = document.getElementById('signupDepartment');
            
            if (!department.value) {
                showError(errorEl, 'Please select your department');
                department.focus();
                return false;
            }
            
            if (department.value === 'OTHER') {
                const customDepartment = document.getElementById('signupCustomDepartment');
                if (!customDepartment.value.trim()) {
                    showError(errorEl, 'Please specify your department');
                    customDepartment.focus();
                    return false;
                }
            }
        }
        
        if (role.value === 'other') {
            const phone = document.getElementById('signupPhone');
            const idType = document.getElementById('signupIdType');
            const idNumber = document.getElementById('signupIdNumber');
            
            if (!phone.value.trim()) {
                showError(errorEl, 'Please enter your phone number');
                phone.focus();
                return false;
            }
            
            if (!idType.value) {
                showError(errorEl, 'Please select an ID type');
                idType.focus();
                return false;
            }
            
            if (idType.value === 'OTHER') {
                const customIdType = document.getElementById('signupCustomIdType');
                if (!customIdType.value.trim()) {
                    showError(errorEl, 'Please specify the ID type');
                    customIdType.focus();
                    return false;
                }
            }
            
            if (!idNumber.value.trim()) {
                showError(errorEl, 'Please enter your ID number');
                idNumber.focus();
                return false;
            }
        }
        
        hideError(errorEl);
    }
    
    if (currentStep === 3) {
        // Validate Step 3: Security
        console.log('[VALIDATION] Validating Step 3...');
        const securityQuestion = document.getElementById('signupSecurityQuestion');
        const securityAnswer = document.getElementById('signupSecurityAnswer');
        
        console.log('[VALIDATION] Security Question value:', securityQuestion.value);
        console.log('[VALIDATION] Security Answer value:', securityAnswer.value);
        
        if (!securityQuestion.value) {
            console.log('[VALIDATION] Failed: No security question selected');
            showError(errorEl, 'Please select a security question');
            securityQuestion.focus();
            return false;
        }
        
        if (!securityAnswer.value.trim()) {
            console.log('[VALIDATION] Failed: No security answer provided');
            showError(errorEl, 'Please provide an answer to your security question');
            securityAnswer.focus();
            return false;
        }
        
        console.log('[VALIDATION] Step 3 validation passed!');
        hideError(errorEl);
    }
    
    return true;
}

/**
 * Show error message
 */
function showError(element, message) {
    element.textContent = message;
    element.style.display = 'block';
    element.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

/**
 * Hide error message
 */
function hideError(element) {
    element.textContent = '';
    element.style.display = 'none';
}

/**
 * Validate email format
 */
function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

/**
 * Handle role selection (updated for multi-step)
 */
function handleRoleSelection() {
    const role = document.getElementById('signupRole').value;
    
    // Hide all role-specific fields
    const studentFields = document.getElementById('studentFields');
    const staffFields = document.getElementById('staffFields');
    const otherFields = document.getElementById('otherFields');
    
    if (studentFields) studentFields.style.display = 'none';
    if (staffFields) staffFields.style.display = 'none';
    if (otherFields) otherFields.style.display = 'none';
    
    // Show relevant fields based on role
    if (role === 'student') {
        if (studentFields) studentFields.style.display = 'block';
    } else if (role === 'staff') {
        if (staffFields) staffFields.style.display = 'block';
    } else if (role === 'other') {
        if (otherFields) otherFields.style.display = 'block';
    }
}

/**
 * Toggle custom institution field
 */
function toggleCustomInstitution() {
    const institutionSelect = document.getElementById('signupInstitution');
    const customField = document.getElementById('customInstitutionField');
    
    if (customField) {
        customField.style.display = institutionSelect.value === 'OTHER' ? 'block' : 'none';
    }
}

/**
 * Toggle custom department field
 */
function toggleCustomDepartment() {
    const departmentSelect = document.getElementById('signupDepartment');
    const customField = document.getElementById('customDepartmentField');
    
    if (customField) {
        customField.style.display = departmentSelect.value === 'OTHER' ? 'block' : 'none';
    }
}

/**
 * Toggle custom ID type field
 */
function toggleCustomIdType() {
    const idTypeSelect = document.getElementById('signupIdType');
    const customField = document.getElementById('customIdTypeField');
    
    if (customField) {
        customField.style.display = idTypeSelect.value === 'OTHER' ? 'block' : 'none';
    }
}

// ======================================================================


/**
 * Toggle custom department field for staff
 */
function toggleCustomDepartmentField() {
    const customField = document.getElementById('customDepartmentField');
    if (this.checked) {
        customField.style.display = 'block';
        document.getElementById('signupDepartment').required = false;
        document.getElementById('signupCustomDepartment').required = true;
    } else {
        customField.style.display = 'none';
        document.getElementById('signupDepartment').required = true;
        document.getElementById('signupCustomDepartment').required = false;
    }
}


/**
 * Handle institution dropdown change
 */
function handleInstitutionChange() {
    const customField = document.getElementById('customInstitutionField');
    const customInput = document.getElementById('signupCustomInstitution');
    
    if (this.value === 'OTHER') {
        if (customField) customField.style.display = 'block';
        if (customInput) {
            // Only set required if the data attribute is present
            if (customInput.hasAttribute('data-required-when-visible')) {
                customInput.setAttribute('required', 'required');
            }
            customInput.removeAttribute('tabindex');
            customInput.removeAttribute('aria-hidden');
        }
    } else {
        if (customInput) {
            // Remove required attribute when field is hidden
            customInput.removeAttribute('required');
            customInput.setAttribute('tabindex', '-1');
            customInput.setAttribute('aria-hidden', 'true');
        }
        if (customField) customField.style.display = 'none';
    }
}

/**
 * Handle department dropdown change
 */
function handleDepartmentChange() {
    const customField = document.getElementById('customDepartmentField');
    const customInput = document.getElementById('signupCustomDepartment');
    
    if (this.value === 'OTHER') {
        if (customField) customField.style.display = 'block';
        if (customInput) {
            // Only set required if the data attribute is present
            if (customInput.hasAttribute('data-required-when-visible')) {
                customInput.setAttribute('required', 'required');
            }
            customInput.removeAttribute('tabindex');
            customInput.removeAttribute('aria-hidden');
        }
    } else {
        if (customInput) {
            // Remove required attribute when field is hidden
            customInput.removeAttribute('required');
            customInput.setAttribute('tabindex', '-1');
            customInput.setAttribute('aria-hidden', 'true');
        }
        if (customField) customField.style.display = 'none';
    }
}


/**
 * Handle ID type dropdown change
 */
function handleIdTypeChange() {
    const customField = document.getElementById('customIdTypeField');
    const formatGuide = document.getElementById('idFormatGuide');
    const formatText = document.getElementById('formatText');
    const customIdInput = document.getElementById('signupCustomIdType');
    const idNumberInput = document.getElementById('signupIdNumber');
    
    if (this.value === 'OTHER') {
        customField.style.display = 'block';
        if (customIdInput) {
            // Only set required if the data attribute is present
            if (customIdInput.hasAttribute('data-required-when-visible')) {
                customIdInput.setAttribute('required', 'required');
            }
            // Ensure the field is visible and can receive focus
            customIdInput.removeAttribute('tabindex');
            customIdInput.removeAttribute('aria-hidden');
        }
        // Hide format guide for custom ID types
        if (formatGuide) formatGuide.style.display = 'none';
    } else {
        if (customIdInput) {
            // Remove required attribute when field is hidden
            customIdInput.removeAttribute('required');
            // Hide the field visually but also ensure proper accessibility attributes
            customIdInput.setAttribute('tabindex', '-1');
            customIdInput.setAttribute('aria-hidden', 'true');
        }
        customField.style.display = 'none';
        
        // Show format guide for standard ID types
        if (formatGuide) {
            formatGuide.style.display = 'block';
            showIdFormatGuide(this.value, formatText);
        }
    }
    
    // Also handle the ID number field which should always be required when "other" fields are shown
    if (idNumberInput) {
        // Only set required if the data attribute is present
        if (this.value === 'OTHER' || document.getElementById('signupRole').value === 'other') {
            if (idNumberInput.hasAttribute('data-required-when-visible')) {
                idNumberInput.setAttribute('required', 'required');
            }
        } else {
            idNumberInput.removeAttribute('required');
        }
    }
}

function showIdFormatGuide(idType, formatElement) {
    const formatGuides = {
        'National ID': 'Format: GHA-XXXXXXXXX (9 digits after GHA-)',
        'Voter ID': 'Format: XXXXXXXXXX to XXXXXXXXXXXX (10-12 digits)',
        'Passport': 'Format: X1234567 (1 letter + 7 digits)',
        'Driver License': 'Format: XXXXXX (6 digits, e.g., 070667)',
        'SSNIT': 'Format: XXXXXXXX (8 digits)',
        'NHIS': 'Format: XXXXXXXXXX (10 digits)'
    };
    
    formatElement.textContent = formatGuides[idType] || 'Please enter the number as it appears on your ID';
}

/**
 * Toggle sidebar for mobile
    sidebar.classList.toggle('active');
}

/**
 * Show a specific section
 * @param {string} sectionId - ID of the section to show
 */
async function showSection(sectionId) {
    console.log('showSection called with:', sectionId);
    
    const pageSections = document.querySelectorAll('.page-section');
    pageSections.forEach(section => {
        section.classList.remove('active');
    });
    
    const targetSection = document.getElementById(sectionId);
    if (targetSection) {
        targetSection.classList.add('active');
        
        // Load data for the section with optimized timing
        switch(sectionId) {
            case 'dashboard':
                // Load essential dashboard data immediately
                loadDashboardData();
                
                // Load additional data in parallel with small delays to prevent blocking
                setTimeout(() => {
                    // Load role-specific data
                    if (currentUser && ['Librarian','Staff','Admin'].includes(currentUser.role)) {
                        loadLibrarianDashboardData();
                    } else {
                        // For other roles, load available books count separately
                        loadAvailableBooksCount();
                    }
                }, 50);
                
                // Update category counts
                setTimeout(async () => {
                    try {
                        const response = await fetch(`${API_BASE_URL}/categories.php?action=getAll`, {
                            headers: {
                                'Authorization': `Bearer ${authToken}`
                            }
                        });
                        const data = await response.json();
                        if (data.success) {
                            updateCategoryCounts(data.categories);
                        }
                    } catch (error) {
                        console.error('Error updating dashboard category counts:', error);
                    }
                }, 100);
                
                // Load recent items with minimal delay
                setTimeout(() => {
                    loadRecentBooks();
                    // Only load recent borrowing for admin/librarian roles
                    if (currentUser && (currentUser.role === 'Admin' || currentUser.role === 'Librarian')) {
                        loadRecentBorrowing();
                    }
                }, 150);
                
                // Apply role-based controls
                if (currentUser && currentUser.role) {
                    setTimeout(() => {
                        applyRoleBasedControls(currentUser.role);
                    }, 25);
                }
                break;
            case 'books':
                loadBooksData();
                break;
            case 'add-book':
                loadCategories(); // Load categories for the book category dropdown
                break;
            case 'members':
                loadMembersData();
                break;
            case 'borrowing':
                loadBorrowingData();
                break;
            case 'return-book':
                initializeReturnBookForm();
                break;
            case 'pending-requests':
                loadPendingRequests();
                break;
            // my-requests case removed for staff/student/other roles
            case 'overdue-books':
                loadOverdueBooks();
                break;
            case 'overdue-fines':
                loadFineRecords();
                break;
            case 'categories':
                loadCategoriesData();
                // Update category counts quickly
                setTimeout(async () => {
                    try {
                        const response = await fetch(`${API_BASE_URL}/categories.php?action=getAll`, {
                            headers: {
                                'Authorization': `Bearer ${authToken}`
                            }
                        });
                        const data = await response.json();
                        if (data.success) {
                            updateCategoryCounts(data.categories);
                        }
                    } catch (error) {
                        console.error('Error updating category counts:', error);
                    }
                }, 50);
                break;
            case 'reports':
                loadReportsData();        
                // Initialize charts when reports section is loaded
                console.log('Initializing charts for reports section');
                initializeCharts();   
                break;
            case 'journals':
                loadJournals();
                // Initialize search and filter functionality quickly
                setTimeout(initJournalSearchAndFilters, 25);
                break;
            case 'cpmr-policies':
                loadPolicies();
                break;
            case 'settings':
                console.log('=== SETTINGS ACCESS ATTEMPT ===');
                console.log('Current user:', currentUser);
                console.log('User role:', currentUser?.role);
                
                // Check if user is admin and requires password verification
                if (currentUser && currentUser.role === 'Admin') {
                    console.log('Admin user detected - checking verification status...');
                    
                    // Check if already verified in this session (within 5 minutes)
                    const isVerified = isSettingsAccessValid();
                    console.log('Is already verified:', isVerified);
                    
                    if (!isVerified) {
                        console.log('Not verified - requiring password verification...');
                        
                        // Require password verification
                        console.log('Calling verifyAdminPassword()...');
                        const verified = await verifyAdminPassword();
                        console.log('Verification result:', verified);
                        
                        if (!verified) {
                            console.error('❌ VERIFICATION FAILED - BLOCKING ACCESS TO SETTINGS');
                            // Show explicit error message
                            alert('⛔ ACCESS DENIED\n\nPassword verification failed.\nYou must enter the CORRECT admin password to access settings.');
                            
                            // CRITICAL: Return immediately - DO NOT load settings!
                            // Navigate back to dashboard instead
                            showSection('dashboard');
                            return;
                        }
                        
                        console.log('✅ Verification successful - allowing access');
                    } else {
                        console.log('✅ Already verified - allowing immediate access');
                    }
                }
                
                // Load current settings from database immediately
                console.log('Loading settings page...');
                loadCurrentSettings();
                // Load admin security questions if user is admin
                if (currentUser && currentUser.role === 'Admin') {
                    setTimeout(() => {
                        loadAdminSecurityQuestions();
                    }, 50);
                }
                break;
            case 'my-profile':
                // Load profile data quickly
                setTimeout(() => {
                    loadProfileData();
                }, 25);
                break;
            case 'my-gallery':
                loadMyGallery();
                break;

        }
    }
    
    // Update page title
    document.title = `${targetSection.querySelector('h2')?.textContent || 'CPMR Library'} - CPMR Library Management System`;
}

/**
 * Toggle sidebar visibility on mobile devices
 */
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    if (sidebar) {
        sidebar.classList.toggle('active');
        // Adjust footer position after sidebar state change
        setTimeout(adjustFooterPosition, 300); // Wait for CSS transition
    }
}

/**
 * Handle window resize
 */
function handleResize() {
    const sidebar = document.getElementById('sidebar');
    if (window.innerWidth > 768 && sidebar) {
        sidebar.classList.remove('active');
    }
    
    // Adjust footer position
    adjustFooterPosition();
    
    // Resize charts if they exist
    if (borrowingTrendsChart) {
        setTimeout(() => {
            borrowingTrendsChart.resize();
        }, 100);
    }
    
    if (popularBooksChart) {
        setTimeout(() => {
            popularBooksChart.resize();
        }, 100);
    }
}

/**
 * Adjust footer position based on sidebar state
 */
function adjustFooterPosition() {
    const sidebar = document.getElementById('sidebar');
    const footer = document.getElementById('footer');
    
    if (sidebar && footer) {
        if (sidebar.classList.contains('active')) {
            // Sidebar is visible
            footer.style.left = '250px';
        } else {
            // Sidebar is collapsed
            footer.style.left = '0';
        }
    }
}

// =============================================
// MODAL FUNCTIONS
// =============================================

let currentModalCallback = null;
let currentModalFormHTML = null;

/**
 * Show modal with content
 * @param {string} title - Modal title
 * @param {string} content - Modal body content
 * @param {boolean} showConfirm - Whether to show confirm button
 * @param {Function} confirmCallback - Callback for confirm button
 * @param {string} formHTML - Form HTML for modal
 */
function showModal(title, content, showConfirm = false, confirmCallback = null, formHTML = null, preventClose = false) {
    console.log('showModal called with:', { title, showConfirm, hasCallback: !!confirmCallback, callbackType: typeof confirmCallback, preventClose });
    console.log('Content length:', content ? content.length : 0);
    
    const modalTitle = document.getElementById('modalTitle');
    const modalBody = document.getElementById('modalBody');
    const confirmModal = document.getElementById('confirmModal');
    const modalOverlay = document.getElementById('modalOverlay');
    const cancelBtn = document.getElementById('cancelModal');

    console.log('Modal elements found:', { 
        modalTitle: !!modalTitle, 
        modalBody: !!modalBody, 
        confirmModal: !!confirmModal, 
        modalOverlay: !!modalOverlay 
    });

    if (modalTitle && modalBody && confirmModal && modalOverlay) {
        console.log('Setting modal content...');
        modalTitle.textContent = title;
        modalBody.innerHTML = content;
        console.log('Modal body content set. InnerHTML length:', modalBody.innerHTML.length);
        currentModalFormHTML = formHTML || content;
        
        // CRITICAL FIX: Reset confirm button to default state before showing
        // This prevents "Verifying..." or other loading states from persisting
        confirmModal.disabled = false;
        confirmModal.innerHTML = 'Confirm';
        confirmModal.style.opacity = '1';
        confirmModal.style.display = showConfirm ? 'inline-block' : 'none';
        
        // Also reset cancel button to default state
        if (cancelBtn) {
            cancelBtn.disabled = false;
            cancelBtn.style.opacity = '1';
        }
        
        // Store preventClose flag on the modal overlay
        modalOverlay.dataset.preventClose = preventClose ? 'true' : 'false';
        
        currentModalCallback = confirmCallback;
        console.log('Set currentModalCallback to:', typeof currentModalCallback, currentModalCallback ? currentModalCallback.constructor.name : 'null');
        modalOverlay.style.display = 'flex';
        console.log('Modal overlay display set to flex');
        modalOverlay.style.zIndex = '100000';
        console.log('Modal overlay computed style:', window.getComputedStyle(modalOverlay).display, 'z-index', window.getComputedStyle(modalOverlay).zIndex);
    } else {
        console.error('Modal elements not found');
    }
}

/**
 * Verify admin password before accessing settings
 * @returns {Promise<boolean>} - True if verified, false otherwise
 */
async function verifyAdminPassword() {
    return new Promise((resolve) => {
        const formHTML = `
            <form id="adminPasswordForm" style="margin-top: 15px;">
                <div class="form-group">
                    <label for="adminPassword">Enter Your Admin Password</label>
                    <input type="password" id="adminPassword" placeholder="Enter your password" required style="width: 100%; padding: 10px; border: 2px solid #ddd; border-radius: 6px; font-size: 14px;">
                    <small id="passwordError" style="color: #d32f2f; display: none; margin-top: 5px;">Incorrect password. Please try again.</small>
                </div>
            </form>
        `;
        
        showModal('🔐 Admin Verification Required', 
            '<p>To access the admin settings, please verify your identity by entering your admin password.</p>' + formHTML, 
            true,  // Show confirm button
            async () => {
                // This callback will be called when user clicks Confirm
                console.log('>>> CONFIRM BUTTON CLICKED <<<');
                
                // Wait a tiny bit for DOM to update, then get fresh reference
                await new Promise(resolve => setTimeout(resolve, 50));
                
                const passwordInput = document.getElementById('adminPassword');
                const passwordError = document.getElementById('passwordError');
                
                console.log('Password input element found:', !!passwordInput);
                console.log('Password input value length:', passwordInput ? passwordInput.value.length : 'N/A');
                
                if (!passwordInput) {
                    console.error('ERROR: Password input field not found in DOM!');
                    showModal('Error', 'System error: Password field not found. Please try again.');
                    resolve(false);
                    return;
                }
                
                const password = passwordInput.value.trim();
                
                console.log('Password input value length:', password.length);
                
                if (!password || password.trim() === '') {
                    passwordError.textContent = 'Please enter your password';
                    passwordError.style.display = 'block';
                    resolve(false);
                    return;
                }
                
                // Show loading state - disable both buttons to prevent multiple clicks
                const confirmBtn = document.getElementById('confirmModal');
                const cancelBtn = document.getElementById('cancelModal');
                
                console.log('Confirm button found:', !!confirmBtn);
                console.log('Cancel button found:', !!cancelBtn);
                
                // Store original button states
                const confirmBtnDisabled = confirmBtn.disabled;
                const confirmBtnHTML = confirmBtn.innerHTML;
                const confirmBtnText = confirmBtn.textContent || confirmBtn.innerText;
                
                console.log('Original button HTML:', confirmBtnHTML);
                console.log('Original button text:', confirmBtnText);
                
                // Disable buttons during verification
                confirmBtn.disabled = true;
                if (cancelBtn) cancelBtn.disabled = true;
                
                // Show loading indicator with simple text
                confirmBtn.innerHTML = '⏳ Verifying...';
                confirmBtn.style.opacity = '0.7';
                
                let apiCalled = false;
                let verificationComplete = false;
                
                try {
                    console.log('=== PASSWORD VERIFICATION START ===');
                    console.log('API URL:', `${API_BASE_URL}/verify_admin_password.php`);
                    console.log('Password length:', password.length);
                    console.log('Auth token exists:', !!authToken);
                    
                    apiCalled = true;
                    const response = await fetch(`${API_BASE_URL}/verify_admin_password.php`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${authToken}`
                        },
                        body: JSON.stringify({ password: password })
                    });
                    
                    console.log('Response status:', response.status);
                    console.log('Response OK:', response.ok);
                    
                    const result = await response.json();
                    console.log('Response data:', JSON.stringify(result));
                    
                    // CRITICAL CHECK 1: HTTP status must be 200 for success
                    if (!response.ok) {
                        console.error('❌ HTTP ERROR STATUS:', response.status);
                        console.error('Response body:', result);
                        
                        // Show detailed error to help debugging
                        let errorMsg = `Verification failed (HTTP ${response.status})\n\n`;
                        errorMsg += `Password length: ${password.length} characters\n`;
                        errorMsg += `Server message: ${result.message || 'Invalid credentials'}\n\n`;
                        errorMsg += `TROUBLESHOOTING:\n`;
                        errorMsg += `• Check that you entered the correct password\n`;
                        errorMsg += `• Try logging out and back in\n`;
                        errorMsg += `• Check browser console for more details`;
                        
                        passwordError.textContent = result.message || 'Verification failed. Please try again.';
                        passwordError.style.display = 'block';
                        
                        // Restore button states carefully
                        if (confirmBtn) {
                            confirmBtn.disabled = false;
                            confirmBtn.innerHTML = confirmBtnHTML;
                            confirmBtn.style.opacity = '1';
                        }
                        if (cancelBtn) cancelBtn.disabled = false;
                        
                        // Log the full error for debugging
                        console.error('Full error context:');
                        console.error('- Password sent:', password.length + ' chars');
                        console.error('- Response:', result);
                        
                        resolve(false);
                        return;
                    }
                    
                    // CRITICAL CHECK 2: Must have BOTH success=true AND verified=true
                    if (result.success === true && result.verified === true) {
                        console.log('✅ Password verification SUCCESSFUL');
                        verificationComplete = true;
                        sessionStorage.setItem('settingsAccessVerified', 'true');
                        sessionStorage.setItem('settingsAccessTime', Date.now().toString());
                        
                        // Restore button state BEFORE hiding modal to prevent stuck states
                        if (confirmBtn) {
                            confirmBtn.disabled = confirmBtnDisabled;
                            confirmBtn.innerHTML = confirmBtnHTML;
                            confirmBtn.style.opacity = '1';
                        }
                        if (cancelBtn) cancelBtn.disabled = false;
                        
                        hideModal();
                        resolve(true);
                    } else {
                        // EXPLICIT FAILURE - Wrong password
                        console.error('❌ PASSWORD VERIFICATION FAILED');
                        console.error('Result:', result);
                        passwordError.textContent = result.message || 'Incorrect password. Please try again.';
                        passwordError.style.display = 'block';
                        
                        // Restore button states carefully
                        if (confirmBtn) {
                            confirmBtn.disabled = false;
                            confirmBtn.innerHTML = confirmBtnHTML;
                            confirmBtn.style.opacity = '1';
                        }
                        if (cancelBtn) cancelBtn.disabled = false;
                        
                        resolve(false);
                        return;
                    }
                } catch (error) {
                    console.error('❌ EXCEPTION CAUGHT in verifyAdminPassword');
                    console.error('Error name:', error.name);
                    console.error('Error message:', error.message);
                    console.error('Full error:', error);
                    console.error('API was called:', apiCalled);
                    
                    passwordError.textContent = 'Verification error: ' + (error.message || 'Please try again');
                    passwordError.style.display = 'block';
                    
                    // Restore button states carefully
                    if (confirmBtn) {
                        confirmBtn.disabled = false;
                        confirmBtn.innerHTML = confirmBtnHTML;
                        confirmBtn.style.opacity = '1';
                    }
                    if (cancelBtn) cancelBtn.disabled = false;
                    
                    resolve(false);
                    // NEVER allow access on error!
                }
                
                console.log('=== PASSWORD VERIFICATION END ===');
            },
            formHTML,
            true   // preventClose = true - CANNOT close by clicking outside!
        );
        
        // Focus on password input after modal is shown
        setTimeout(() => {
            const passwordInput = document.getElementById('adminPassword');
            if (passwordInput) {
                passwordInput.focus();
            }
        }, 100);
    });
}

/**
 * Verify current user's password before performing critical actions
 * Only Admin and Librarian roles can perform these actions
 * @returns {Promise<boolean>} - True if verified, false otherwise
 */
async function verifyUserPassword(actionType = 'critical_action') {
    return new Promise((resolve) => {
        // FIX: Get user from sessionStorage, not localStorage
        const currentUserRaw = sessionStorage.getItem('currentUser') || sessionStorage.getItem('user');
        console.log('=== VERIFY USER PASSWORD ===');
        console.log('SessionStorage raw:', currentUserRaw);
        
        let currentUser;
        try {
            currentUser = JSON.parse(currentUserRaw || '{}');
        } catch (e) {
            console.error('Failed to parse user from sessionStorage');
            showModal('Error', 'Session data corrupted. Please log in again.');
            resolve(false);
            return;
        }
        
        console.log('Parsed user:', currentUser);
        console.log('Username:', currentUser.username);
        console.log('Role:', currentUser.role);
        
        // Only Admin and Librarian can perform critical actions (case-insensitive)
        const userRole = (currentUser.role || '').toLowerCase();
        if (!currentUser || !['admin', 'librarian'].includes(userRole)) {
            console.error('Role check failed in verifyUserPassword');
            showModal('Access Denied', 'Only Admin and Librarian users can perform this action.');
            resolve(false);
            return;
        }
        
        const formHTML = `
            <form id="userPasswordForm" style="margin-top: 15px;">
                <div class="form-group">
                    <label for="userPassword">Enter Your Password (${currentUser.role})</label>
                    <input type="password" id="userPassword" placeholder="Enter your password" required style="width: 100%; padding: 10px; border: 2px solid #ddd; border-radius: 6px; font-size: 14px;">
                    <small id="passwordError" style="color: #d32f2f; display: none; margin-top: 5px;">Incorrect password. Please try again.</small>
                </div>
            </form>
        `;
        
        showModal('🔐 User Verification Required', 
            `<p>To perform this action, please verify your identity as <strong>${currentUser.name || currentUser.username}</strong>.</p>` + formHTML, 
            true,  // Show confirm button
            async () => {
                console.log('=== PASSWORD MODAL CALLBACK STARTED ===');
                
                // CRITICAL FIX: Wait a tiny bit for DOM to update, then get fresh reference
                await new Promise(resolve => setTimeout(resolve, 50));
                
                const passwordInput = document.getElementById('userPassword');
                const passwordError = document.getElementById('passwordError');
                
                console.log('Password input element:', !!passwordInput);
                console.log('Password input value length:', passwordInput ? passwordInput.value.length : 'N/A');
                console.log('Password input type:', passwordInput ? passwordInput.type : 'N/A');
                console.log('Current user at callback:', currentUser);
                console.log('Username:', currentUser?.username);
                
                // Validate username exists before proceeding
                if (!currentUser.username) {
                    console.error('ERROR: Username is missing from currentUser!');
                    if (passwordError) {
                        passwordError.textContent = 'User session error. Please log in again.';
                        passwordError.style.display = 'block';
                    }
                    resolve(false);
                    return;
                }
                
                if (!passwordInput) {
                    console.error('ERROR: Password input field not found in DOM!');
                    if (passwordError) {
                        passwordError.textContent = 'System error: Password field not found. Please try again.';
                        passwordError.style.display = 'block';
                    }
                    resolve(false);
                    return;
                }
                
                const password = passwordInput.value.trim();
                console.log('Password captured - length:', password.length);
                console.log('Password first char code:', password.length > 0 ? password.charCodeAt(0) : 'N/A');
                
                if (!password) {
                    passwordError.textContent = 'Please enter your password';
                    passwordError.style.display = 'block';
                    resolve(false);
                    return;
                }
                
                // Get references to buttons for state management
                const confirmBtn = document.getElementById('confirmModal');
                const cancelBtn = document.getElementById('cancelModal');
                
                console.log('Confirm button found:', !!confirmBtn);
                console.log('Cancel button found:', !!cancelBtn);
                
                // Store original button states
                const confirmBtnDisabled = confirmBtn.disabled;
                const confirmBtnHTML = confirmBtn.innerHTML;
                const confirmBtnText = confirmBtn.textContent || confirmBtn.innerText;
                
                console.log('Original button HTML:', confirmBtnHTML);
                console.log('Original button text:', confirmBtnText);
                
                // Disable buttons during verification
                confirmBtn.disabled = true;
                if (cancelBtn) cancelBtn.disabled = true;
                
                // Show loading indicator with simple text
                confirmBtn.innerHTML = '⏳ Verifying...';
                confirmBtn.style.opacity = '0.7';
                
                let apiCalled = false;
                let verificationComplete = false;
                
                try {
                    console.log('=== USER PASSWORD VERIFICATION START ===');
                    console.log('API URL:', `${API_BASE_URL}/login.php`);
                    console.log('Username:', currentUser.username);
                    console.log('Password length:', password.length);
                    console.log('Request body:', JSON.stringify({ username: currentUser.username, password: '***' }));
                    
                    apiCalled = true;
                    const response = await fetch(`${API_BASE_URL}/login.php`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ 
                            username: currentUser.username,
                            password: password
                        })
                    });
                    
                    console.log('Response status:', response.status);
                    console.log('Response OK:', response.ok);
                    
                    const result = await response.json();
                    console.log('Response data:', JSON.stringify(result));
                    
                    // CRITICAL CHECK 1: HTTP status must be 200 for success
                    if (!response.ok) {
                        console.error('❌ HTTP ERROR STATUS:', response.status);
                        console.error('Response body:', result);
                        
                        // Show detailed error to help debugging
                        let errorMsg = `Verification failed (HTTP ${response.status})\n\n`;
                        errorMsg += `Username: ${currentUser.username}\n`;
                        errorMsg += `Password length: ${password.length} characters\n`;
                        errorMsg += `Server message: ${result.message || 'Invalid credentials'}\n\n`;
                        errorMsg += `TROUBLESHOOTING:\n`;
                        errorMsg += `• Check backend/api/login.php exists\n`;
                        errorMsg += `• Check database connection\n`;
                        errorMsg += `• Try logging out and back in\n`;
                        errorMsg += `• Check browser console for more details`;
                        
                        passwordError.textContent = result.message || 'Verification failed. Please try again.';
                        passwordError.style.display = 'block';
                        
                        // Restore button states carefully
                        if (confirmBtn) {
                            confirmBtn.disabled = confirmBtnDisabled;
                            confirmBtn.innerHTML = confirmBtnHTML;
                            confirmBtn.style.opacity = '1';
                        }
                        if (cancelBtn) cancelBtn.disabled = false;
                        
                        // Log the full error for debugging
                        console.error('Full error context:');
                        console.error('- User:', currentUser);
                        console.error('- Password sent:', password.length + ' chars');
                        console.error('- Response:', result);
                        
                        resolve(false);
                        return;
                    }
                    
                    // CRITICAL CHECK 2: Must have success=true and valid token
                    if (result.success === true && result.token) {
                        console.log('✅ User password verification SUCCESSFUL');
                        verificationComplete = true;
                        
                        // Store verification in session storage with timestamp and action type
                        sessionStorage.setItem('criticalActionVerified', 'true');
                        sessionStorage.setItem('criticalActionTime', Date.now().toString());
                        sessionStorage.setItem('criticalActionType', actionType);
                        sessionStorage.setItem('verifiedUserRole', currentUser.role);
                        
                        // Restore button state BEFORE hiding modal to prevent stuck states
                        if (confirmBtn) {
                            confirmBtn.disabled = confirmBtnDisabled;
                            confirmBtn.innerHTML = confirmBtnHTML;
                            confirmBtn.style.opacity = '1';
                        }
                        if (cancelBtn) cancelBtn.disabled = false;
                        
                        hideModal();
                        resolve(true);
                    } else {
                        // EXPLICIT FAILURE - Wrong password
                        console.error('❌ PASSWORD VERIFICATION FAILED');
                        console.error('Result:', result);
                        passwordError.textContent = result.message || 'Incorrect password. Please try again.';
                        passwordError.style.display = 'block';
                        
                        // Restore button states carefully
                        if (confirmBtn) {
                            confirmBtn.disabled = confirmBtnDisabled;
                            confirmBtn.innerHTML = confirmBtnHTML;
                            confirmBtn.style.opacity = '1';
                        }
                        if (cancelBtn) cancelBtn.disabled = false;
                        
                        resolve(false);
                        return;
                    }
                } catch (error) {
                    console.error('❌ EXCEPTION CAUGHT in verifyUserPassword');
                    console.error('Error name:', error.name);
                    console.error('Error message:', error.message);
                    console.error('Full error:', error);
                    console.error('API was called:', apiCalled);
                    
                    passwordError.textContent = 'Verification error: ' + (error.message || 'Please try again');
                    passwordError.style.display = 'block';
                    
                    // Restore button states carefully
                    if (confirmBtn) {
                        confirmBtn.disabled = confirmBtnDisabled;
                        confirmBtn.innerHTML = confirmBtnHTML;
                        confirmBtn.style.opacity = '1';
                    }
                    if (cancelBtn) cancelBtn.disabled = false;
                    
                    resolve(false);
                    // NEVER allow access on error!
                }
                
                console.log('=== USER PASSWORD VERIFICATION END ===');
            },
            formHTML
        );
        
        // Focus on password input after modal is shown
        setTimeout(() => {
            const passwordInput = document.getElementById('userPassword');
            if (passwordInput) {
                passwordInput.focus();
                console.log('✅ Password input focused');
            } else {
                console.error('❌ Password input not found for focusing');
            }
        }, 100);
    });
}

/**
 * Check if critical action access is still valid (within 5 minutes)
 * @returns {boolean} - True if access is still valid
 */
function isCriticalActionValid() {
    const verified = sessionStorage.getItem('criticalActionVerified');
    const actionTime = sessionStorage.getItem('criticalActionTime');
    const verifiedRole = sessionStorage.getItem('verifiedUserRole');
    
    // FIX: Use sessionStorage instead of localStorage for consistency
    const currentUserRaw = sessionStorage.getItem('currentUser') || sessionStorage.getItem('user');
    let currentUser;
    try {
        currentUser = JSON.parse(currentUserRaw || '{}');
    } catch (e) {
        console.error('Failed to parse user from sessionStorage in isCriticalActionValid');
        return false;
    }
    
    if (!verified || verified !== 'true') {
        return false;
    }
    
    // Check if role matches
    if (verifiedRole !== currentUser.role) {
        // Role changed, invalidate verification
        sessionStorage.removeItem('criticalActionVerified');
        sessionStorage.removeItem('criticalActionTime');
        sessionStorage.removeItem('criticalActionType');
        sessionStorage.removeItem('verifiedUserRole');
        return false;
    }
    
    if (!actionTime) {
        return false;
    }
    
    const now = Date.now();
    const twoMinutes = 2 * 60 * 1000; // 2 minutes in milliseconds - REDUCED from 5 for better security
    
    if (now - parseInt(actionTime) > twoMinutes) {
        // Verification expired
        sessionStorage.removeItem('criticalActionVerified');
        sessionStorage.removeItem('criticalActionTime');
        sessionStorage.removeItem('criticalActionType');
        sessionStorage.removeItem('verifiedUserRole');
        return false;
    }
    
    return true;
}

/**
 * Clear critical action verification
 */
function clearCriticalActionVerification() {
    sessionStorage.removeItem('criticalActionVerified');
    sessionStorage.removeItem('criticalActionTime');
    sessionStorage.removeItem('criticalActionType');
    sessionStorage.removeItem('verifiedUserRole');
}

/**
 * Check if settings access is still valid (within 5 minutes)
 * @returns {boolean} - True if access is still valid
 */
function isSettingsAccessValid() {
    const verified = sessionStorage.getItem('settingsAccessVerified');
    const accessTime = sessionStorage.getItem('settingsAccessTime');
    
    if (verified !== 'true' || !accessTime) {
        return false;
    }
    
    const now = Date.now();
    const elapsed = now - parseInt(accessTime);
    
    // Valid for 2 minutes (120000 ms) - REDUCED from 5 minutes for better security
    if (elapsed > 120000) {
        // Expired, clear the flag
        sessionStorage.removeItem('settingsAccessVerified');
        sessionStorage.removeItem('settingsAccessTime');
        return false;
    }
    
    return true;
}

/**
 * Show request book modal for staff/researcher
 */
async function showRequestBookModal() {
    try {
        // Load available books
        const response = await fetch(`${API_BASE_URL}/books.php?action=getAll`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        const data = await response.json();
        if (!data.success) {
            showModal('Error', 'Failed to load books');
            return;
        }

        // Load admin settings for borrow duration
        const settingsResponse = await fetch(`${API_BASE_URL}/settings.php`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        const settingsData = await settingsResponse.json();
        const maxBorrowDays = settingsData.data?.max_borrow_days || 30;

        const books = data.books || [];
        if (books.length === 0) {
            showModal('Notice', 'No books available to request');
            return;
        }

        // Create book options for dropdown
        const options = books.map(b => `<option value="${b.id}" data-title="${b.title.toLowerCase()}" data-author="${b.author.toLowerCase()}">${escapeHtml(b.title)} — ${escapeHtml(b.author)} (${b.status})</option>`).join('');

        const formHTML = `
            <form id="requestForm">
                <div class="form-group">
                    <label for="requestBookSearch">Search Book *</label>
                    <input type="text" id="requestBookSearch" placeholder="Type to search by title or author..." style="width: 100%; padding: 10px; border: 2px solid #ddd; border-radius: 6px; font-size: 14px; margin-bottom: 10px;">
                    <label for="requestBook">Select Book *</label>
                    <select id="requestBook" name="book_id" required size="8" style="width: 100%; padding: 8px; border: 2px solid #ddd; border-radius: 6px; font-size: 14px;">
                        <option value="">-- Select a book --</option>
                        ${options}
                    </select>
                    <small style="color: #666; display: block; margin-top: 5px;">Start typing to filter books, then click to select</small>
                </div>
                <div class="form-group">
                    <label>Borrow Duration (Days)</label>
                    <div style="padding: 10px; background: #f0f8f0; border: 1px solid #4CAF50; border-radius: 4px; color: #1b5e20; font-weight: 500;">
                        ${maxBorrowDays} days <small style="color: #666; font-weight: normal;">(set by library admin)</small>
                    </div>
                    <input type="hidden" name="requested_days" value="${maxBorrowDays}">
                </div>
                <div class="form-group">
                    <label for="requestMessage">Message / Notes</label>
                    <textarea id="requestMessage" name="message" rows="3" placeholder="Optional: Add any special requests or notes..."></textarea>
                </div>
            </form>
        `;

        const createHandler = async () => {
            await handleCreateRequest();
        };

        showModal('Request Book', formHTML, true, createHandler, formHTML);
        
        // Initialize search functionality after modal is displayed
        setTimeout(() => {
            const searchInput = document.getElementById('requestBookSearch');
            const select = document.getElementById('requestBook');
            
            if (searchInput && select) {
                searchInput.addEventListener('input', function(e) {
                    const searchTerm = e.target.value.toLowerCase();
                    const options = select.getElementsByTagName('option');
                    
                    for (let i = 0; i < options.length; i++) {
                        const option = options[i];
                        const title = option.getAttribute('data-title') || '';
                        const author = option.getAttribute('data-author') || '';
                        
                        if (i === 0) {
                            // Always show the "Select a book" option
                            continue;
                        }
                        
                        if (searchTerm === '' || title.includes(searchTerm) || author.includes(searchTerm)) {
                            option.style.display = '';
                        } else {
                            option.style.display = 'none';
                        }
                    }
                });
            }
        }, 100);
    } catch (error) {
        console.error('Error preparing request modal:', error);
        showModal('Error', 'Failed to prepare request form');
    }
}

/**
 * Handle create request submission
 */
async function handleCreateRequest() {
    const form = document.getElementById('requestForm');
    if (!form) return;
    
    const token = getAuthToken();
    if (!token) {
        showModal('Error', 'Authentication required. Please log in again.');
        handleLogout();
        return;
    }
    
    const formData = new FormData(form);
    const payload = {
        action: 'create',
        book_id: formData.get('book_id'),
        requested_days: formData.get('requested_days'),
        message: formData.get('message')
    };

    try {
        const response = await fetch(`${API_BASE_URL}/requests.php`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json();
        if (data.success) {
            showModal('Success', 'Request created successfully!');
            
            // Send push notification about the request creation
            sendPushNotification('📚 Request Submitted', {
                body: '✅ Your book request has been submitted and is pending approval.',
                tag: 'request-created',
                requireInteraction: false
            });
            
            // Refresh pending requests view if visible
            loadPendingRequests();
        } else {
            // Check if it's an auth error
            if (response.status === 401 || data.message === 'Authentication required') {
                showModal('Error', 'Your session has expired. Please log in again.');
                handleLogout();
            } else {
                showModal('Error', data.message || 'Failed to create request');
            }
        }
    } catch (error) {
        console.error('Error creating request:', error);
        showModal('Error', 'Failed to create request. Please try again.');
    }
}

/**
 * Hide modal
 */
function hideModal() {
    const modalOverlay = document.getElementById('modalOverlay');
    if (modalOverlay) {
        modalOverlay.style.display = 'none';
        currentModalCallback = null;
        currentModalFormHTML = null;
    }
}

/**
 * Handle modal confirm button
 */
function handleModalConfirm() {
    console.log('handleModalConfirm called');
    console.log('currentModalCallback type:', typeof currentModalCallback);
    console.log('currentModalCallback constructor:', currentModalCallback ? currentModalCallback.constructor.name : 'null');
    console.log('currentModalCallback is function:', typeof currentModalCallback === 'function');
    
    if (currentModalCallback && typeof currentModalCallback === 'function') {
        console.log('Callback exists and is a function, attempting to call');
        try {
            // Check if it's an async function
            if (currentModalCallback.constructor.name === 'AsyncFunction') {
                console.log('Calling async callback without parameters');
                // Don't pass any parameters - let the callback get what it needs from DOM
                currentModalCallback().catch(error => {
                    console.error('Error in async callback:', error);
                });
            } else {
                console.log('Calling regular callback without parameters');
                // Don't pass any parameters - let the callback get what it needs from DOM
                currentModalCallback();
            }
        } catch (error) {
            console.error('Error calling callback:', error);
        }
    } else {
        console.log('No valid callback found');
        console.log('currentModalCallback value:', currentModalCallback);
    }
    hideModal();
}

// =============================================
// DATA LOADING FUNCTIONS
// =============================================

/**
 * Load initial data after login
 */
async function loadInitialData() {
    try {
        // CRITICAL: Verify user status before loading data
        await verifyUserStatus();
        
        // Load categories for dropdowns
        await loadCategories();
        
        // Load dashboard data
        await loadDashboardData();
        // Modern notification system initialized above
    } catch (error) {
        console.error('Error loading initial data:', error);
    }
}

/**
 * Verify user status (for status changes during session)
 */
async function verifyUserStatus() {
    try {
        const currentUserRaw = sessionStorage.getItem('currentUser') || sessionStorage.getItem('user');
        if (!currentUserRaw) {
            return true; // Not logged in
        }

        const currentUser = JSON.parse(currentUserRaw);
        const userStatus = currentUser.status || 'Active';

        console.log('[STATUS CHECK] User:', currentUser.username, '| Status:', userStatus);

        // If user status changed to Suspended/Inactive during their session
        if (userStatus === 'Suspended' || userStatus === 'Inactive') {
            console.warn(`[STATUS CHECK] User ${currentUser.username} status changed to ${userStatus} during session`);

            // Show warning message but don't auto-logout (login API should prevent this)
            showModal('Account Status Changed', `
                <div style="text-align: center; padding: 20px;">
                    <div style="font-size: 48px; color: #f39c12; margin-bottom: 20px;">⚠️</div>
                    <h3>Account ${userStatus}</h3>
                    <p>Your account status has changed to <strong>${userStatus}</strong> during your session.</p>
                    <p style="color: #666; margin-top: 15px;">Please contact the administrator for assistance.</p>
                    <p style="color: #dc3545; margin-top: 15px; font-weight: bold;">You may lose access soon.</p>
                </div>
            `, false, null);

            return false;
        }

        console.log('[STATUS CHECK] User status is Active - continuing');
        return true;
    } catch (error) {
        console.error('[STATUS CHECK] Error verifying user status:', error);
        return true; // Allow access on error
    }
}

/**
 * Load categories from backend
 */
async function loadCategories() {
    console.log('loadCategories called');
    console.log('authToken:', authToken ? 'present' : 'missing');
    
    try {
        const response = await fetch(`${API_BASE_URL}/categories.php?action=getAll`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        console.log('Categories API response status:', response.status);
        const data = await response.json();
        console.log('Categories API response data:', data);
        
        if (data.success) {
            // Populate category dropdown in add book form
            const categorySelect = document.getElementById('bookCategory');
            console.log('Category select element:', categorySelect);
            
            if (categorySelect) {
                let optionsHtml = '<option value="">Select Category</option>';
                data.categories.forEach(cat => {
                    // Use cat.id (which is category_id from API) for the value
                    const categoryId = cat.id || cat.category_id;
                    optionsHtml += `<option value="${categoryId}">${cat.name}</option>`;
                });
                categorySelect.innerHTML = optionsHtml;
                console.log('Category dropdown populated with', data.categories.length, 'categories');
                console.log('Sample category data:', data.categories[0]);
            } else {
                console.log('Category select element not found!');
            }
            
            // Store categories globally if needed
            window.categories = data.categories;
        } else {
            console.log('Categories API returned error:', data.message);
        }
    } catch (error) {
        console.error('Error loading categories:', error);
    }
}

/**
 * Load dashboard data
 */
async function loadDashboardData() {
    try {
        const response = await fetch(`${API_BASE_URL}/reports.php?action=dashboard`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            // Update dashboard stats - data is in the stats object
            // Update both admin and librarian cards with the same data
            const uniqueBooksCount = data.stats.total_unique_books || 0;
            const physicalCopiesCount = data.stats.total_physical_copies || 0;
            
            // Update admin cards
            const adminBooksElement = document.getElementById('adminTotalBooksCount');
            const adminCopiesElement = document.getElementById('adminTotalPhysicalCopiesCount');
            if (adminBooksElement) adminBooksElement.textContent = uniqueBooksCount;
            if (adminCopiesElement) adminCopiesElement.textContent = physicalCopiesCount;
            
            // Update librarian cards
            const librarianBooksElement = document.getElementById('librarianTotalBooksCount');
            const librarianCopiesElement = document.getElementById('librarianTotalPhysicalCopiesCount');
            if (librarianBooksElement) librarianBooksElement.textContent = uniqueBooksCount;
            if (librarianCopiesElement) librarianCopiesElement.textContent = physicalCopiesCount;
            
            // Also update user-facing versions of these stats if they exist
            const userBooksElement = document.getElementById('userTotalBooksCount');
            if (userBooksElement) userBooksElement.textContent = uniqueBooksCount;
            
            const userCopiesElement = document.getElementById('userTotalPhysicalCopiesCount');
            if (userCopiesElement) userCopiesElement.textContent = physicalCopiesCount;
            
            // Update other shared elements
            document.getElementById('totalMembersCount').textContent = data.stats.total_members || 0;
            document.getElementById('booksBorrowedCount').textContent = data.stats.books_borrowed || 0;
            document.getElementById('overdueBooksCount').textContent = data.stats.overdue_books || 0;
            
            // Also update user-facing versions of these stats if they exist
            const userTotalMembersElement = document.getElementById('userTotalMembersCount');
            if (userTotalMembersElement) userTotalMembersElement.textContent = data.stats.total_members || 0;
            
            const userBooksBorrowedElement = document.getElementById('userBooksBorrowedCount');
            if (userBooksBorrowedElement) userBooksBorrowedElement.textContent = data.stats.books_borrowed || 0;
            
            const userOverdueBooksElement = document.getElementById('userOverdueBooksCount');
            if (userOverdueBooksElement) userOverdueBooksElement.textContent = data.stats.overdue_books || 0;
            
            // Update category counts on dashboard
            if (data.category_stats) {
                updateCategoryCounts(data.category_stats);
            }
            
            // Load recent books
            await loadRecentBooks();
            
            // Load recent borrowing records (admin/librarian only)
            if (currentUser && (currentUser.role === 'Admin' || currentUser.role === 'Librarian')) {
                await loadRecentBorrowing();
                await loadNewUsers();
            }
            
            // Load user role stats (admin only)
            if (currentUser && currentUser.role === 'Admin') {
                await loadUserRoleStats();
            }
            // Load journals list
            await loadJournals();
        }
    } catch (error) {
        console.error('Error loading dashboard data:', error);
    }
    
    // Load user-specific data for staff, student, and other roles
    if (currentUser && (currentUser.role === 'Staff' || currentUser.role === 'Student' || currentUser.role === 'Other')) {
        await loadUserSpecificDashboardData();
    }
}

/**
 * Load user-specific dashboard data for staff, student, and other roles
 */
async function loadUserSpecificDashboardData() {
    try {
        const response = await fetch(`${API_BASE_URL}/borrowing.php?action=getMyBorrowing`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            // Count active borrowings (books currently borrowed)
            const activeBorrowings = data.records.filter(record => record.status === 'Active');
            const borrowedCount = activeBorrowings.length;
            
            // Enhanced due date calculations
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const sevenDaysFromNow = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days from now
            
            // Separate overdue and upcoming due items
            const overdueItems = activeBorrowings.filter(record => {
                const dueDate = new Date(record.due_date);
                dueDate.setHours(0, 0, 0, 0);
                return dueDate < today;
            });
            
            const dueItems = activeBorrowings.filter(record => {
                const dueDate = new Date(record.due_date);
                dueDate.setHours(0, 0, 0, 0);
                return dueDate >= today && dueDate <= sevenDaysFromNow;
            });
            
            // Find earliest due date
            let earliestDueDate = null;
            if (activeBorrowings.length > 0) {
                const allDueDates = activeBorrowings
                    .map(record => new Date(record.due_date))
                    .sort((a, b) => a - b);
                earliestDueDate = allDueDates[0];
            }
            
            // Update user-specific dashboard cards
            const borrowedCountElement = document.getElementById('myBorrowedBooksCount');
            const overdueCountElement = document.getElementById('overdueCount');
            const dueCountElement = document.getElementById('dueCount');
            const earliestDateElement = document.getElementById('earliestDueDate');
            const dueDateCard = document.getElementById('dueDateCard');
            
            if (borrowedCountElement) borrowedCountElement.textContent = borrowedCount;
            if (overdueCountElement) overdueCountElement.textContent = overdueItems.length;
            if (dueCountElement) dueCountElement.textContent = dueItems.length;
            
            // Update earliest due date display
            if (earliestDateElement) {
                if (earliestDueDate) {
                    earliestDateElement.textContent = earliestDueDate.toLocaleDateString('en-US', { 
                        month: 'short', 
                        day: 'numeric',
                        year: 'numeric'
                    });
                } else {
                    earliestDateElement.textContent = 'None';
                }
            }
            
            // Update card styling based on status
            if (dueDateCard) {
                dueDateCard.classList.remove('has-overdue', 'has-due-soon', 'no-due');
                if (overdueItems.length > 0) {
                    dueDateCard.classList.add('has-overdue');
                } else if (dueItems.length > 0) {
                    dueDateCard.classList.add('has-due-soon');
                } else {
                    dueDateCard.classList.add('no-due');
                }
            }
            
            // Store due items for click handler
            window.myDueItems = {
                overdue: overdueItems,
                dueSoon: dueItems,
                all: activeBorrowings
            };
        }
        
        // Load user's pending requests
        const pendingResponse = await fetch(`${API_BASE_URL}/requests.php?action=getMy`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        if (pendingResponse.status === 401) {
            console.log('Authentication failed in loadUserSpecificDashboardData (pending requests)');
            sessionStorage.clear();
            showLoginForm();
            return;
        }
        
        const pendingData = await pendingResponse.json();
        if (pendingData.success) {
            // Filter for pending requests only
            const pendingRequests = pendingData.requests.filter(request => request.status === 'Pending');
            const myPendingRequestsElement = document.getElementById('myPendingRequestsCount');
            if (myPendingRequestsElement) {
                myPendingRequestsElement.textContent = pendingRequests.length || 0;
            }
        }
    } catch (error) {
        console.error('Error loading user-specific dashboard data:', error);
    }
}

/**
 * Load available books count for all users
 */
async function loadAvailableBooksCount() {
    try {
        const availableResponse = await fetch(`${API_BASE_URL}/books.php?action=getAvailableBooks`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        const availableData = await availableResponse.json();
        if (availableData.success) {
            document.getElementById('availableBooksCount').textContent = availableData.count || 0;
            // Also update the user-facing available books count if the element exists
            const userAvailableCountElement = document.getElementById('userAvailableBooksCount');
            if (userAvailableCountElement) {
                userAvailableCountElement.textContent = availableData.count || 0;
            }
        }
    } catch (error) {
        console.error('Error loading available books count:', error);
    }
}

// ----------------------
// Journals functions
// ----------------------
async function loadJournals(searchTerm = '', yearFilter = '', sortBy = 'date_desc') {
    try {
        // Build query parameters
        let queryParams = `action=list&limit=50`;
        if (searchTerm) queryParams += `&search=${encodeURIComponent(searchTerm)}`;
        if (yearFilter) queryParams += `&year=${encodeURIComponent(yearFilter)}`;
        if (sortBy) queryParams += `&sort=${encodeURIComponent(sortBy)}`;
        
        const res = await fetch(`${API_BASE_URL}/journals.php?${queryParams}`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        const data = await res.json();
        
        // Also fetch journal links
        const linksRes = await fetch(`${API_BASE_URL}/journals.php?action=get_links`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        const linksData = await linksRes.json();
        
        if (data.success) {
            const grid = document.getElementById('journalsGrid');
            if (!grid) return;
            grid.innerHTML = '';
            
            const journals = data.journals || [];
            const links = linksData.success ? linksData.links : [];
            
            if (journals.length > 0 || links.length > 0) {
                // Populate years filter dropdown
                const yearFilterElement = document.getElementById('journalsYearFilter');
                if (yearFilterElement) {
                    // Clear existing options except the first one
                    while (yearFilterElement.children.length > 1) {
                        yearFilterElement.removeChild(yearFilterElement.lastChild);
                    }
                    
                    // Extract unique years and populate the dropdown
                    const years = [...new Set(journals
                        .filter(j => j.year)
                        .map(j => j.year)
                        .sort((a, b) => parseInt(b) - parseInt(a))
                    )];
                    
                    years.forEach(year => {
                        const option = document.createElement('option');
                        option.value = year;
                        option.textContent = year;
                        yearFilterElement.appendChild(option);
                    });
                }
                
                // Display journal links first
                if (links.length > 0) {
                    links.forEach(link => {
                        const card = document.createElement('div');
                        card.className = 'stat-card';
                        card.style.backgroundImage = "linear-gradient(135deg, #667eea 0%, #764ba2 100%)";
                        card.style.backgroundSize = 'cover';
                        card.style.backgroundPosition = 'center';
                        card.style.backgroundRepeat = 'no-repeat';
                        card.style.position = 'relative';
                        card.style.borderRadius = '12px';
                        card.style.boxShadow = '0 6px 20px rgba(0, 0, 0, 0.4), inset 0 2px 4px rgba(255, 255, 255, 0.1)';
                        card.style.border = '2px solid rgba(255, 255, 255, 0.3)';
                        card.style.cursor = 'pointer';
                        card.onclick = () => window.open(link.url, '_blank');
                        
                        const canEdit = currentUser && (currentUser.role === 'Admin' || currentUser.role === 'Librarian');
                        
                        card.innerHTML = `
                            <div style="position: relative; z-index: 1; padding: 18px; min-height: 200px; display: flex; flex-direction: column;">
                                <!-- Link icon overlay -->
                                <div style="position: absolute; top: 10px; right: 10px; background: rgba(255,255,255,0.9); border-radius: 50%; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; font-size: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.2);">🔗</div>
                                
                                <!-- Content -->
                                <div style="flex: 1; display: flex; flex-direction: column; justify-content: space-between;">
                                    <div>
                                        <div style="font-weight:700;margin-bottom:8px; color: #ffffff; font-size: 16px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.4; text-shadow: 1px 1px 2px rgba(0,0,0,0.3);">${escapeHtml(link.name)}</div>
                                        ${link.description ? `<div style="font-size:13px;color:#f0f0f0;margin-bottom:15px; line-height: 1.6; background: rgba(255, 255, 255, 0.15); padding: 10px; border-radius: 6px; border-left: 3px solid #fff;">${escapeHtml(link.description).slice(0,150)}${(link.description||'').length>150?'...':''}</div>` : ''}
                                    </div>
                                    
                                    <div style="margin-top: auto;">
                                        <button class="btn" style="width:100%;font-size:13px;padding:10px;background: linear-gradient(135deg, #ffffff 0%, #f0f0f0 100%); border: none; color: #667eea; font-weight: 700; box-shadow: 0 3px 6px rgba(0,0,0,0.3); border-radius: 5px; cursor: pointer; transition: all 0.3s ease;" onclick="event.stopPropagation(); window.open('${link.url.replace(/'/g, "\\'")}', '_blank')">
                                            🌐 Visit Website
                                        </button>
                                        ${canEdit ? `
                                        <button class="btn btn-danger" onclick="event.stopPropagation(); deleteJournalLink(${link.link_id}, '${escapeHtml(link.name)}')" style="width:100%;font-size:12px;padding:6px;margin-top:8px;background: rgba(244, 67, 54, 0.8); border: none; color: #ffffff; font-weight: 600; box-shadow: 0 2px 4px rgba(0,0,0,0.3); border-radius: 5px; cursor: pointer; transition: all 0.3s ease;">
                                            🗑️ Delete Link
                                        </button>
                                        ` : ''}
                                        <div style="margin-top:8px;font-size:10px;color:#e0e0e0; padding: 6px; background: rgba(255, 255, 255, 0.1); border-radius: 4px;">
                                            <strong>Uploaded by:</strong> ${link.uploaded_by_name || 'Unknown'} • ${new Date(link.created_at).toLocaleDateString()}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        `;
                        grid.appendChild(card);
                    });
                }
                
                // Display PDF journals
                journals.forEach(j => {
                    const card = document.createElement('div');
                    card.className = 'stat-card';
                    // Set uniform journal cover image for all cards
                    card.style.backgroundImage = "url('images/journal-covers/journals.jpeg')";
                    card.style.backgroundSize = 'cover';
                    card.style.backgroundPosition = 'center';
                    card.style.backgroundRepeat = 'no-repeat';
                    card.style.position = 'relative';
                    
                    // Add elegant border and shadow
                    card.style.borderRadius = '12px';
                    card.style.boxShadow = '0 6px 20px rgba(0, 0, 0, 0.4), inset 0 2px 4px rgba(255, 255, 255, 0.1)';
                    card.style.border = '2px solid rgba(218, 165, 32, 0.3)';
                    
                    // Check if current user can edit/delete (Admin or Librarian)
                    const canEdit = currentUser && (currentUser.role === 'Admin' || currentUser.role === 'Librarian');
                    card.innerHTML = `
                        <div style="position: relative; z-index: 1;">
                            <!-- Content with uniform journal background and better readability -->
                            <div style="position: relative; z-index: 1; padding: 18px; background-image: url('images/journal-covers/journals.jpeg'); background-size: cover; background-position: center; background-repeat: no-repeat; border-radius: 10px; border: 2px solid rgba(0, 0, 0, 0.3); box-shadow: 0 4px 12px rgba(0,0,0,0.5);">
                                <!-- Semi-transparent white overlay for better text readability -->
                                <div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: rgba(255, 255, 255, 0.85); border-radius: 8px; pointer-events: none;"></div>
                                
                                <!-- Actual content -->
                                <div style="position: relative; z-index: 1;">
                                    <div style="font-weight:700;margin-bottom:8px; color: #000000; font-size: 15px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.4;">${escapeHtml(j.title)}</div>
                                    <div style="font-size:13px;color:#333333; font-weight: 500; margin-bottom: 10px;">${escapeHtml(j.authors || '')} ${j.year ? '<span style="color: #666;">• ' + j.year + '</span>' : ''}</div>
                                    <div style="font-size:13px;color:#444444;margin-bottom:15px; line-height: 1.6; background: rgba(255, 255, 255, 0.6); padding: 10px; border-radius: 6px; border-left: 3px solid #4CAF50;">${escapeHtml(j.abstract || '').slice(0,200)}${(j.abstract||'').length>200?'...':''}</div>
                                    <div style="margin-top:12px;display:flex;justify-content:space-between;align-items:center; padding: 10px; background: rgba(255, 255, 255, 0.7); border-radius: 6px;">
                                        <button class="btn btn-secondary" onclick="downloadJournal(${j.journal_id})" style="font-size:13px;padding:8px 16px;background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%); border: none; color: #ffffff; font-weight: 600; box-shadow: 0 3px 6px rgba(0,0,0,0.3); border-radius: 5px; cursor: pointer; transition: all 0.3s ease;">
                                            📥 Download
                                        </button>
                                        <span style="font-size:12px;color:#555; font-style: italic; max-width: 60%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${j.original_name}</span>
                                    </div>
                                    ${canEdit ? `
                                    <div style="margin-top:12px;display:flex;gap:8px;">
                                        <button class="btn btn-primary" onclick="editJournal(${j.journal_id})" style="flex:1;font-size:13px;padding:8px 12px;background: linear-gradient(135deg, #2196F3 0%, #1976D2 100%); border: none; color: #ffffff; font-weight: 600; box-shadow: 0 3px 6px rgba(0,0,0,0.3); border-radius: 5px; cursor: pointer; transition: all 0.3s ease;">
                                            ✏️ Edit
                                        </button>
                                        <button class="btn btn-danger" onclick="deleteJournal(${j.journal_id}, '${escapeHtml(j.title)}')" style="flex:1;font-size:13px;padding:8px 12px;background: linear-gradient(135deg, #f44336 0%, #d32f2f 100%); border: none; color: #ffffff; font-weight: 600; box-shadow: 0 3px 6px rgba(0,0,0,0.3); border-radius: 5px; cursor: pointer; transition: all 0.3s ease;">
                                            🗑️ Delete
                                        </button>
                                    </div>
                                    ` : ''}
                                    <div style="margin-top:12px;font-size:11px;color:#666; padding: 8px; background: rgba(255, 255, 255, 0.5); border-radius: 5px; border-top: 1px solid rgba(0,0,0,0.1);">
                                        <strong>📜 Uploaded by:</strong> ${j.uploaded_by_name || 'Unknown'} • <strong>Date:</strong> ${new Date(j.created_at).toLocaleDateString()}
                                    </div>
                                </div>
                            </div>
                        </div>
                    `;
                    grid.appendChild(card);
                });
            } else {
                // Display an empty state message when no journals exist
                grid.innerHTML = `
                    <div class="empty-state">
                        <div class="empty-state-icon"><i class="bi bi-file-earmark-text"></i></div>
                        <h3>No Journals Available</h3>
                        <p>There are currently no journal entries in the system.</p>
                        <p>Please check back later when journals become available.</p>
                    </div>
                `;
            }
        } else {
            const grid = document.getElementById('journalsGrid');
            if (grid) {
                grid.innerHTML = `
                    <div class="empty-state">
                        <div class="empty-state-icon"><i class="bi bi-exclamation-triangle"></i></div>
                        <h3>Error Loading Journals</h3>
                        <p>Failed to load journal data. Please try refreshing the page.</p>
                    </div>
                `;
            }
        }
    } catch (error) {
        console.error('Error loading journals:', error);
        const grid = document.getElementById('journalsGrid');
        if (grid) {
            grid.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon"><i class="bi bi-exclamation-triangle"></i></div>
                    <h3>Connection Error</h3>
                    <p>Unable to connect to the server. Please check your connection and try again.</p>
                </div>
            `;
        }
    }
}

/**
 * Initialize journal search and filter functionality
 */
function initJournalSearchAndFilters() {
    const searchInput = document.getElementById('journalsSearch');
    const yearFilter = document.getElementById('journalsYearFilter');
    const sortSelect = document.getElementById('journalsSort');
    
    if (searchInput) {
        searchInput.addEventListener('input', function() {
            const searchTerm = this.value.trim();
            const yearFilterValue = document.getElementById('journalsYearFilter').value;
            const sortValue = document.getElementById('journalsSort').value;
            loadJournals(searchTerm, yearFilterValue, sortValue);
        });
    }
    
    if (yearFilter) {
        yearFilter.addEventListener('change', function() {
            const searchTerm = document.getElementById('journalsSearch').value.trim();
            const sortValue = document.getElementById('journalsSort').value;
            loadJournals(searchTerm, this.value, sortValue);
        });
    }
    
    if (sortSelect) {
        sortSelect.addEventListener('change', function() {
            const searchTerm = document.getElementById('journalsSearch').value.trim();
            const yearFilterValue = document.getElementById('journalsYearFilter').value;
            loadJournals(searchTerm, yearFilterValue, this.value);
        });
    }
}

function showUploadJournalModal() {
    const modal = document.getElementById('uploadJournalModal');
    if (modal) modal.style.display = 'flex';
}

function hideUploadJournalModal() {
    const modal = document.getElementById('uploadJournalModal');
    if (modal) {
        modal.style.display = 'none';
        const pdfForm = document.getElementById('uploadJournalPdfForm');
        const linkForm = document.getElementById('uploadJournalLinkForm');
        if (pdfForm) pdfForm.reset();
        if (linkForm) linkForm.reset();
        const msg = document.getElementById('uploadJournalMessage');
        if (msg) { msg.style.display = 'none'; msg.textContent = ''; }
    }
}

// Toggle between PDF and Link upload forms
function toggleJournalUploadForm() {
    const uploadType = document.getElementById('journalUploadType');
    const pdfForm = document.getElementById('uploadJournalPdfForm');
    const linkForm = document.getElementById('uploadJournalLinkForm');
    
    if (!uploadType || !pdfForm || !linkForm) return;
    
    if (uploadType.value === 'pdf') {
        pdfForm.style.display = 'block';
        linkForm.style.display = 'none';
    } else {
        pdfForm.style.display = 'none';
        linkForm.style.display = 'block';
    }
}

async function handleUploadJournal() {
    const uploadType = document.getElementById('journalUploadType');
    const msg = document.getElementById('uploadJournalMessage');
    
    if (!uploadType) return;
    
    try {
        const btn = document.getElementById('submitUploadJournal');
        btn.disabled = true; btn.textContent = 'Uploading...';
        
        let res, data;
        
        if (uploadType.value === 'pdf') {
            // Handle PDF upload
            const form = document.getElementById('uploadJournalPdfForm');
            if (!form) return;
            const fd = new FormData(form);
            
            res = await fetch(`${API_BASE_URL}/journals.php`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${authToken}` },
                body: fd
            });
        } else {
            // Handle link upload
            const name = document.getElementById('journalLinkName').value.trim();
            const url = document.getElementById('journalLinkUrl').value.trim();
            const description = document.getElementById('journalLinkDescription').value.trim();
            
            if (!name || !url) {
                msg.style.display = 'block';
                msg.style.backgroundColor = '#f8d7da';
                msg.textContent = 'Name and URL are required';
                btn.disabled = false;
                btn.textContent = 'Upload';
                return;
            }
            
            res = await fetch(`${API_BASE_URL}/journals.php?action=add_link`, {
                method: 'POST',
                headers: { 
                    'Authorization': `Bearer ${authToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ name, url, description })
            });
        }
        
        data = await res.json();
        
        if (data.success) {
            msg.style.display = 'block';
            msg.style.backgroundColor = '#d4edda';
            msg.textContent = uploadType.value === 'pdf' ? 'PDF uploaded successfully' : 'Link card created successfully';
            await loadJournals();
            setTimeout(hideUploadJournalModal, 1200);
        } else {
            msg.style.display = 'block';
            msg.style.backgroundColor = '#f8d7da';
            msg.textContent = data.message || 'Upload failed';
        }
    } catch (error) {
        console.error('Upload error:', error);
        msg.style.display = 'block';
        msg.style.backgroundColor = '#f8d7da';
        msg.textContent = 'Network error during upload';
    } finally {
        const btn = document.getElementById('submitUploadJournal');
        if (btn) { btn.disabled = false; btn.textContent = 'Upload'; }
    }
}

// =============================================
// JOURNAL EDIT AND DELETE FUNCTIONS
// =============================================

/**
 * Edit journal modal
 */
async function editJournal(journalId) {
    try {
        // Fetch journal details
        const res = await fetch(`${API_BASE_URL}/journals.php?action=get&id=${journalId}`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        const data = await res.json();
        
        if (!data.success) {
            showModal('Error', data.message || 'Failed to load journal details');
            return;
        }
        
        const journal = data.journal;
        
        // Create edit form
        const formHTML = `
            <form id="editJournalForm">
                <input type="hidden" id="editJournalId" value="${journalId}">
                <div class="form-group">
                    <label for="editJournalTitle">Title *</label>
                    <input type="text" id="editJournalTitle" name="title" value="${escapeHtml(journal.title)}" required>
                </div>
                <div class="form-group">
                    <label for="editJournalAuthors">Authors</label>
                    <input type="text" id="editJournalAuthors" name="authors" value="${escapeHtml(journal.authors || '')}">
                </div>
                <div class="form-group">
                    <label for="editJournalYear">Year</label>
                    <input type="number" id="editJournalYear" name="year" value="${journal.year || ''}" min="1900" max="2100">
                </div>
                <div class="form-group">
                    <label for="editJournalPublisher">Publisher</label>
                    <input type="text" id="editJournalPublisher" name="publisher" value="${escapeHtml(journal.publisher || '')}">
                </div>
                <div class="form-group">
                    <label for="editJournalAbstract">Abstract</label>
                    <textarea id="editJournalAbstract" name="abstract" rows="4">${escapeHtml(journal.abstract || '')}</textarea>
                </div>
            </form>
            <div id="editJournalMessage" style="display:none;margin-top:8px;padding:8px;border-radius:4px;"></div>
        `;
        
        const editHandler = async () => {
            await handleEditJournal();
        };
        
        showModal('Edit Journal', formHTML, true, editHandler);
    } catch (error) {
        console.error('Error preparing edit modal:', error);
        showModal('Error', 'Failed to prepare edit form');
    }
}

/**
 * Handle journal edit submission
 */
async function handleEditJournal() {
    const form = document.getElementById('editJournalForm');
    const msg = document.getElementById('editJournalMessage');
    if (!form) return;
    
    const journalId = document.getElementById('editJournalId').value;
    const formData = new FormData(form);
    
    // Convert FormData to URL-encoded string for PUT request
    const params = new URLSearchParams();
    for (const [key, value] of formData.entries()) {
        params.append(key, value);
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/journals.php?id=${journalId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': `Bearer ${authToken}`
            },
            body: params
        });
        
        const data = await response.json();
        if (data.success) {
            showModal('Success', 'Journal updated successfully!');
            await loadJournals(); // Refresh the journals list
        } else {
            if (msg) {
                msg.style.display = 'block';
                msg.style.backgroundColor = '#f8d7da';
                msg.textContent = data.message || 'Failed to update journal';
            }
        }
    } catch (error) {
        console.error('Error updating journal:', error);
        if (msg) {
            msg.style.display = 'block';
            msg.style.backgroundColor = '#f8d7da';
            msg.textContent = 'Network error during update';
        }
    }
}

/**
 * Download journal PDF
 */
function downloadJournal(journalId) {
    try {
        // Create a temporary iframe to handle the download with authentication
        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        iframe.src = `${API_BASE_URL}/journals.php?action=download&id=${journalId}`;
        
        // Add authorization header using a trick with the iframe
        const xhr = new XMLHttpRequest();
        xhr.open('GET', `${API_BASE_URL}/journals.php?action=download&id=${journalId}`, true);
        xhr.setRequestHeader('Authorization', `Bearer ${authToken}`);
        xhr.responseType = 'blob';
        
        xhr.onload = function() {
            if (xhr.status === 200) {
                // Get filename from Content-Disposition header
                const disposition = xhr.getResponseHeader('Content-Disposition');
                let filename = 'journal.pdf';
                if (disposition && disposition.indexOf('attachment') !== -1) {
                    const filenameRegex = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/;
                    const matches = filenameRegex.exec(disposition);
                    if (matches != null && matches[1]) {
                        filename = matches[1].replace(/['"]/g, '');
                    }
                }
                
                // Create download link
                const blob = xhr.response;
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = filename;
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);
            } else {
                // Handle error
                const reader = new FileReader();
                reader.onload = function() {
                    try {
                        const errorData = JSON.parse(reader.result);
                        showModal('Download Error', errorData.message || 'Failed to download journal');
                    } catch (e) {
                        showModal('Download Error', 'Failed to download journal. Please try again.');
                    }
                };
                reader.readAsText(xhr.response);
            }
        };
        
        xhr.onerror = function() {
            showModal('Download Error', 'Network error during download. Please try again.');
        };
        
        xhr.send();
        
    } catch (error) {
        console.error('Download error:', error);
        showModal('Download Error', 'Failed to download journal. Please try again.');
    }
}

/**
 * Delete journal with confirmation
 */
function deleteJournal(journalId, title) {
    const confirmCallback = async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/journals.php?id=${journalId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${authToken}`
                }
            });
            
            const data = await response.json();
            if (data.success) {
                showModal('Success', 'Journal deleted successfully!');
                await loadJournals(); // Refresh the journals list
            } else {
                showModal('Error', data.message || 'Failed to delete journal');
            }
        } catch (error) {
            console.error('Error deleting journal:', error);
            showModal('Error', 'Network error during deletion');
        }
    };
    
    showModal('Confirm Delete', `Are you sure you want to delete the journal "<strong>${escapeHtml(title)}</strong>"? This action cannot be undone.`, true, confirmCallback);
}

/**
 * Delete journal link
 */
function deleteJournalLink(linkId, name) {
    const confirmCallback = async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/journals.php?action=delete_link&id=${linkId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${authToken}`
                }
            });
            
            const data = await response.json();
            if (data.success) {
                showModal('Success', 'Link card deleted successfully!');
                await loadJournals(); // Refresh the journals list
            } else {
                showModal('Error', data.message || 'Failed to delete link');
            }
        } catch (error) {
            console.error('Error deleting journal link:', error);
            showModal('Error', 'Network error during deletion');
        }
    };
    
    showModal('Confirm Delete', `Are you sure you want to delete the link card "<strong>${escapeHtml(name)}</strong>"? This action cannot be undone.`, true, confirmCallback);
}

// =============================================
// CPMR POLICIES FUNCTIONS
// =============================================

/**
 * Format file size
 */
function formatFileSize(bytes) {
    if (!bytes || bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
    if (!text) return '';
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>\"']/g, function(m) { return map[m]; });
}

/**
 * Load and display all policies
 */
async function loadPolicies() {
    console.log('frontend loadPolicies called');
    const policiesGrid = document.getElementById('policiesGrid');
    if (!policiesGrid) return;
    
    try {
        const searchTerm = document.getElementById('policiesSearch')?.value || '';
        const sortBy = document.getElementById('policiesSort')?.value || 'date_desc';
        
        const response = await fetch(`${API_BASE_URL}/policies.php?action=list&search=${encodeURIComponent(searchTerm)}&sort=${sortBy}`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        const data = await response.json();
        
        if (data.success && data.policies) {
            displayPolicies(data.policies);
        } else {
            policiesGrid.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon"><i class="bi bi-file-earmark-text"></i></div>
                    <h3 class="empty-state-title">No Policies Found</h3>
                    <p class="empty-state-text">Upload your first policy document using the form above.</p>
                </div>
            `;
        }
    } catch (error) {
        console.error('Error loading policies:', error);
        policiesGrid.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon"><i class="bi bi-x-circle"></i></div>
                <h3 class="empty-state-title">Error Loading Policies</h3>
                <p class="empty-state-text">Unable to load policies. Please refresh the page.</p>
            </div>
        `;
    }
}

/**
 * Display policies in grid
 */
function displayPolicies(policies) {
    const policiesGrid = document.getElementById('policiesGrid');
    if (!policiesGrid) return;
    
    if (!policies || policies.length === 0) {
        policiesGrid.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon"><i class="bi bi-file-earmark-text"></i></div>
                <h3 class="empty-state-title">No Policies Found</h3>
                <p class="empty-state-text">Upload your first policy document using the form above.</p>
            </div>
        `;
        return;
    }
    
    policiesGrid.innerHTML = policies.map(policy => {
        const canEditDelete = currentUser && ['Admin', 'Librarian'].includes(currentUser.role);
        
        return `
            <div class="policy-card" data-id="${policy.policy_id}">
                <div class="policy-card-cover">
                    <img src="images/policy-covers/policy_profile.jpeg?v=" + (window.VERSION||Date.now()) + "" alt="Policy Cover" class="policy-cover-img" onerror="this.src='images/book-covers/default-book-cover.jfif'">
                </div>
                <div class="policy-overlay">
                    <div class="policy-overlay-info">
                        <h4 class="policy-title">${escapeHtml(policy.title)}</h4>
                        <span class="policy-year">${policy.year || 'N/A'}</span>
                    </div>
                    <div class="policy-actions">
                        <button class="policy-action-btn policy-download-btn" onclick="downloadPolicy(${policy.policy_id})">
                            <i class="fas fa-download"></i> Download
                        </button>
                        ${canEditDelete ? `
                            <div class="admin-actions">
                                <button class="policy-action-btn policy-edit-btn" onclick="editPolicy(${policy.policy_id})">
                                    <i class="fas fa-edit"></i> Edit
                                </button>
                                <button class="policy-action-btn policy-delete-btn" onclick="deletePolicy(${policy.policy_id})">
                                    <i class="fas fa-trash"></i> Delete
                                </button>
                            </div>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

/**
 * Handle policy file selection from drag & drop or file input
 */
function handlePolicyFileSelect(file) {
    // Validate file
    const validation = validatePolicyFile(file);
    
    if (!validation.valid) {
        showModal('Validation Error', validation.message);
        return;
    }
    
    // Show selected file name
    const dropZone = document.getElementById('policyDropZone');
    if (dropZone) {
        dropZone.innerHTML = `
            <i class="fas fa-file-pdf upload-icon" style="color: #2e7d32;"></i>
            <p class="drop-text" style="color: #2e7d32;">${escapeHtml(file.name)}</p>
            <p class="drop-subtext">${formatFileSize(file.size)}</p>
        `;
    }
    
    // Store the file for upload
    window.selectedPolicyFile = file;
}

/**
 * Validate policy file
 */
function validatePolicyFile(file) {
    if (!file) {
        return { valid: false, message: 'No file selected' };
    }
    
    // Check file type
    if (file.type !== 'application/pdf') {
        return { valid: false, message: 'Only PDF files are allowed. Please select a PDF document.' };
    }
    
    // Check file size (10MB max)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
        return { valid: false, message: 'File size exceeds 10MB limit. Please select a smaller file.' };
    }
    
    return { valid: true };
}

/**
 * Upload policy
 */
async function uploadPolicy() {
    console.log('frontend: uploadPolicy invoked');
    const titleEl = document.getElementById('policyTitle');
    const title = titleEl ? titleEl.value.trim() : '';
    const yearEl = document.getElementById('policyYear');
    const year = yearEl ? yearEl.value : '';
    const descEl = document.getElementById('policyDescription');
    const description = descEl ? descEl.value.trim() : '';
    const file = window.selectedPolicyFile;
    
    // Validation
    if (!title) {
        showModal('Validation Error', 'Please enter a policy title');
        return;
    }
    
    if (!file) {
        showModal('Validation Error', 'Please select a PDF file to upload');
        return;
    }
    
    // Validate file again before upload
    const validation = validatePolicyFile(file);
    if (!validation.valid) {
        showModal('Validation Error', validation.message);
        return;
    }
    
    try {
        // Disable upload button
        const uploadBtn = document.getElementById('uploadPolicyBtn');
        if (uploadBtn) {
            uploadBtn.disabled = true;
            uploadBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Uploading...';
        }
        
        // Create FormData
        const formData = new FormData();
        formData.append('title', title);
        formData.append('year', year || new Date().getFullYear());
        formData.append('description', description);
        formData.append('pdf', file);
        
        // Show progress container
        const progressContainer = document.getElementById('uploadProgressContainer');
        const progressFill = document.getElementById('uploadProgressFill');
        const progressText = document.getElementById('uploadProgressText');
        
        if (progressContainer) progressContainer.style.display = 'block';
        if (progressFill) progressFill.style.width = '0%';
        if (progressText) progressText.textContent = 'Uploading... 0%';
        
        // Upload with XMLHttpRequest for progress tracking
        await new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            
            // Track upload progress
            xhr.upload.addEventListener('progress', function(e) {
                if (e.lengthComputable) {
                    const percentComplete = (e.loaded / e.total) * 100;
                    if (progressFill) progressFill.style.width = percentComplete + '%';
                    if (progressText) progressText.textContent = 'Uploading... ' + Math.round(percentComplete) + '%';
                }
            });
            
            xhr.addEventListener('load', function() {
                if (xhr.status === 200) {
                    try {
                        const response = JSON.parse(xhr.responseText);
                        if (response.success) {
                            resolve(response);
                        } else {
                            reject(new Error(response.message || 'Upload failed'));
                        }
                    } catch (e) {
                        reject(new Error('Invalid response from server'));
                    }
                } else {
                    reject(new Error('Upload failed with status: ' + xhr.status));
                }
            });
            
            xhr.addEventListener('error', function() {
                reject(new Error('Network error during upload'));
            });
            
            xhr.open('POST', `${API_BASE_URL}/policies.php`);
            xhr.setRequestHeader('Authorization', `Bearer ${authToken}`);
            xhr.send(formData);
        });
        
        // Hide progress bar
        if (progressContainer) progressContainer.style.display = 'none';
        if (progressFill) progressFill.style.width = '0%';
        
        // Show success message
        const successMessage = document.getElementById('uploadSuccessMessage');
        if (successMessage) {
            successMessage.style.display = 'flex';
            setTimeout(() => {
                successMessage.style.display = 'none';
            }, 3000);
        }
        
        // Clear form
        document.getElementById('policyTitle').value = '';
        document.getElementById('policyYear').value = new Date().getFullYear();
        document.getElementById('policyDescription').value = '';
        window.selectedPolicyFile = null;
        
        // Reset drop zone
        const dropZone = document.getElementById('policyDropZone');
        if (dropZone) {
            dropZone.innerHTML = `
                <i class="fas fa-file-pdf upload-icon"></i>
                <p class="drop-text">Drag & drop your PDF here</p>
                <p class="drop-subtext">or click to browse</p>
            `;
        }
        
        // Reload policies list
        await loadPolicies();
        
    } catch (error) {
        console.error('Upload error:', error);
        showModal('Upload Error', error.message || 'Failed to upload policy. Please try again.');
        
        // Hide progress bar
        const progressContainer = document.getElementById('uploadProgressContainer');
        if (progressContainer) progressContainer.style.display = 'none';
    } finally {
        // Re-enable upload button
        const uploadBtn = document.getElementById('uploadPolicyBtn');
        if (uploadBtn) {
            uploadBtn.disabled = false;
            uploadBtn.innerHTML = '<i class="fas fa-upload"></i> Upload Policy';
        }
    }
}

/**
 * Download policy PDF
 */
function downloadPolicy(policyId) {
    try {
        // Use XMLHttpRequest to handle authenticated download
        const xhr = new XMLHttpRequest();
        xhr.open('GET', `${API_BASE_URL}/policies.php?action=download&id=${policyId}`, true);
        xhr.setRequestHeader('Authorization', `Bearer ${authToken}`);
        xhr.responseType = 'blob';
        
        xhr.onload = function() {
            if (xhr.status === 200) {
                // Check if response is an error
                if (xhr.response.type === 'application/json') {
                    const reader = new FileReader();
                    reader.onload = function() {
                        try {
                            const errorData = JSON.parse(reader.result);
                            showModal('Download Error', errorData.message || 'Failed to download policy');
                        } catch (e) {
                            showModal('Download Error', 'Failed to download policy. Please try again.');
                        }
                    };
                    reader.readAsText(xhr.response);
                } else {
                    // Create blob and download
                    const blob = xhr.response;
                    const url = window.URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = url;
                    
                    // Get filename from content-disposition header
                    const disposition = xhr.getResponseHeader('Content-Disposition');
                    let filename = 'policy.pdf';
                    if (disposition) {
                        const filenameMatch = disposition.match(/filename="(.+)"/);
                        if (filenameMatch && filenameMatch[1]) {
                            filename = filenameMatch[1];
                        }
                    }
                    
                    link.download = filename;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    window.URL.revokeObjectURL(url);
                }
            } else {
                showModal('Download Error', 'Failed to download policy. Please try again.');
            }
        };
        
        xhr.onerror = function() {
            showModal('Download Error', 'Network error during download. Please try again.');
        };
        
        xhr.send();
    } catch (error) {
        console.error('Download error:', error);
        showModal('Download Error', 'Failed to download policy. Please try again.');
    }
}

/**
 * Edit policy metadata
 */
async function editPolicy(policyId) {
    try {
        // Fetch policy details
        const response = await fetch(`${API_BASE_URL}/policies.php?action=get&id=${policyId}`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        const data = await response.json();
        
        if (!data.success) {
            showModal('Error', data.message || 'Failed to load policy details');
            return;
        }
        
        const policy = data.policy;
        
        // Create edit form
        const formHTML = `
            <form id="editPolicyForm">
                <input type="hidden" id="editPolicyId" value="${policyId}">
                <div class="form-group">
                    <label for="editPolicyTitle">Title *</label>
                    <input type="text" id="editPolicyTitle" name="title" value="${escapeHtml(policy.title)}" required>
                </div>
                <div class="form-group">
                    <label for="editPolicyYear">Year</label>
                    <input type="number" id="editPolicyYear" name="year" value="${policy.year || ''}" min="1900" max="2100">
                </div>
                <div class="form-group">
                    <label for="editPolicyDescription">Description</label>
                    <textarea id="editPolicyDescription" name="description" rows="4">${escapeHtml(policy.description || '')}</textarea>
                </div>
            </form>
            <div id="editPolicyMessage" style="display:none;margin-top:8px;padding:8px;border-radius:4px;"></div>
        `;
        
        const editHandler = async () => {
            await handleEditPolicy();
        };
        
        showModal('Edit Policy', formHTML, true, editHandler);
    } catch (error) {
        console.error('Error preparing edit modal:', error);
        showModal('Error', 'Failed to prepare edit form');
    }
}

/**
 * Handle policy edit submission
 */
async function handleEditPolicy() {
    const form = document.getElementById('editPolicyForm');
    if (!form) return;
    
    const policyId = document.getElementById('editPolicyId').value;
    const formData = new FormData(form);
    
    try {
        const response = await fetch(`${API_BASE_URL}/policies.php?action=update&id=${policyId}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: new URLSearchParams(formData).toString()
        });
        
        const data = await response.json();
        
        if (data.success) {
            hideModal();
            showModal('Success', 'Policy updated successfully!');
            await loadPolicies();
        } else {
            showModal('Error', data.message || 'Failed to update policy');
        }
    } catch (error) {
        console.error('Update error:', error);
        showModal('Error', 'Failed to update policy. Please try again.');
    }
}

/**
 * Delete policy
 */
async function deletePolicy(policyId) {
    const confirmed = confirm('Are you sure you want to delete this policy? This action cannot be undone.');
    
    if (!confirmed) return;
    
    try {
        const response = await fetch(`${API_BASE_URL}/policies.php?id=${policyId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            showModal('Success', 'Policy deleted successfully!');
            await loadPolicies();
        } else {
            showModal('Error', data.message || 'Failed to delete policy');
        }
    } catch (error) {
        console.error('Delete error:', error);
        showModal('Error', 'Failed to delete policy. Please try again.');
    }
}

/**
 * Load recent books
 */
async function loadRecentBooks() {
    try {
        // Add timestamp to bypass cache
        const timestamp = new Date().getTime();
        const response = await fetch(`${API_BASE_URL}/books.php?action=getRecent&limit=5&_t=${timestamp}`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            populateRecentBooksTable(data.books);
        }
    } catch (error) {
        console.error('Error loading recent books:', error);
    }
}

/**
 * Load recent borrowing records
 */
async function loadRecentBorrowing() {
    // Only load recent borrowing records for admin and librarian roles
    if (!currentUser || !currentUser.role) return;
    
    const role = currentUser.role.toLowerCase();
    if (role !== 'admin' && role !== 'librarian') {
        // Clear the table for non-admin/librarian roles
        const tableBody = document.getElementById('dashboardBorrowingRecordsTable');
        if (tableBody) {
            tableBody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 20px;">Access restricted to administrators and librarians</td></tr>';
        }
        return;
    }
    
    try {
        // Add timestamp to bypass cache
        const timestamp = new Date().getTime();
        const response = await fetch(`${API_BASE_URL}/borrowing.php?action=getRecent&limit=5&_t=${timestamp}`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            populateRecentBorrowingTable(data.records);
        }
    } catch (error) {
        console.error('Error loading recent borrowing:', error);
    }
}

/**
 * Load 10 newest users for admin/librarian dashboard
 */
async function loadNewUsers() {
    try {
        const response = await fetch(`${API_BASE_URL}/users.php?action=getRecent&limit=10`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        const data = await response.json();
        const newUsersList = document.getElementById('newUsersList');
        
        if (!newUsersList) return;
        
        if (data.success && data.users && data.users.length > 0) {
            // Create list items for each new user
            const userItems = data.users.map(user => {
                const createdDate = new Date(user.created_at).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric'
                });
                return `<li style="padding: 5px 0; border-bottom: 1px solid #eee; display: flex; justify-content: space-between;">
                    <span><strong>${user.name}</strong> <span style="color: #999; font-size: 11px;">(${user.role})</span></span>
                    <span style="color: #999; font-size: 11px;">${createdDate}</span>
                </li>`;
            }).join('');
            
            newUsersList.innerHTML = userItems;
        } else {
            newUsersList.innerHTML = '<li style="padding: 5px 0; color: #999;">No new users</li>';
        }
    } catch (error) {
        console.error('Error loading new users:', error);
        const newUsersList = document.getElementById('newUsersList');
        if (newUsersList) {
            newUsersList.innerHTML = '<li style="padding: 5px 0; color: #999;">Error loading users</li>';
        }
    }
}

/**
 * Load user role statistics (admin only)
 */
async function loadUserRoleStats() {
    try {
        const response = await fetch(`${API_BASE_URL}/reports.php?action=userRoleStats`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            document.getElementById('staffCount').textContent = data.stats.staff_count || 0;
            document.getElementById('studentCount').textContent = data.stats.student_count || 0;
            document.getElementById('otherCount').textContent = data.stats.other_count || 0;
        }
    } catch (error) {
        console.error('Error loading user role stats:', error);
        document.getElementById('staffCount').textContent = '0';
        document.getElementById('studentCount').textContent = '0';
        document.getElementById('otherCount').textContent = '0';
    }
}

/**
 * Load all books data
 */
// pagination state for books
let booksPage = 1;
const BOOKS_PAGE_SIZE = 100;

// Gallery auto-cleanup configuration
const MAX_GALLERY_BOOKS = 50; // Maximum books to show in gallery before auto-removing old ones
let galleryAutoCleanupEnabled = true; // Enable/disable auto-cleanup feature

async function loadBooksData(page = 1, append = false) {
    try {
        const offset = (page - 1) * BOOKS_PAGE_SIZE;
        const url = `${API_BASE_URL}/books.php?action=getAll&limit=${BOOKS_PAGE_SIZE}&offset=${offset}`;
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            // update global page and store books
            booksPage = page;
            if (!append) {
                window.currentBooks = data.books;
                populateAllBooksTable(window.currentBooks);
            } else {
                // append new results without re-rendering entire table
                window.currentBooks = (window.currentBooks || []).concat(data.books);
                populateAllBooksTableAppend(data.books);
            }
            
            // If gallery view is currently active, display books in gallery
            const booksSection = document.getElementById('books');
            const tableContainers = booksSection ? booksSection.querySelectorAll('.table-container') : [];
            const galleryViewContainer = tableContainers[1]; // Second table container is gallery view
            if (galleryViewContainer && galleryViewContainer.style.display !== 'none') {
                displayBooksInGallery(window.currentBooks);
            }

            // show/hide "load more" button
            const loadMoreBtn = document.getElementById('loadMoreBooksBtn');
            if (loadMoreBtn) {
                loadMoreBtn.style.display = data.books.length === BOOKS_PAGE_SIZE ? 'inline-block' : 'none';
            }
        }
    } catch (error) {
        console.error('Error loading books:', error);
    }
}

/**
 * Display books in gallery view with auto-cleanup when exceeding limit
 * @param {Array} books - Array of book objects
 */
function displayBooksInGallery(books) {
    const gallery = document.getElementById('booksGallery');
    if (!gallery) return;
    
    gallery.innerHTML = '';
    
    // Check if current user is admin or librarian
    const isAdminOrLibrarian = currentUser && (currentUser.role === 'Admin' || currentUser.role === 'Librarian');
    
    if (books && books.length > 0) {
        // Apply auto-cleanup if enabled and books exceed limit
        let booksToShow = books;
        if (galleryAutoCleanupEnabled && books.length > MAX_GALLERY_BOOKS) {
            // Keep only the most recent MAX_GALLERY_BOOKS
            // Assuming books are sorted by newest first, take the first MAX_GALLERY_BOOKS
            booksToShow = books.slice(0, MAX_GALLERY_BOOKS);
            console.log(`Gallery auto-cleanup: Showing ${booksToShow.length} most recent books out of ${books.length} total`);
        }
        
        booksToShow.forEach(book => {
            const bookCard = document.createElement('div');
            bookCard.className = 'book-cover-card';
            bookCard.dataset.bookId = book.custom_id || book.id || book.book_id;
            
            // Build the image source
            let imageSrc = 'images/default-book-cover.jfif'; // Default cover - using the actual file extension
            if (book.cover_image) {
                imageSrc = `/cpmr_library/backend/uploads/book_covers/${book.cover_image}`;
            }
            
            bookCard.innerHTML = `
                <div class="book-cover-placeholder">
                    <img src="${imageSrc}" 
                         alt="${book.title}" 
                         class="book-cover-image" 
                         loading="lazy"
                         onerror="this.src='/cpmr_library/frontend/images/default-book-cover.jfif'; this.classList.add('loaded');"
                         onload="this.classList.add('loaded');">
                </div>
                <div class="book-cover-info">
                    <div class="book-cover-title" title="${book.title}">${book.title}</div>
                    <div class="book-cover-author" title="${book.author}">${book.author}</div>
                    <div class="book-cover-category">${book.category_name || book.category || 'Uncategorized'}</div>
                </div>
                <div class="book-cover-tooltip">Double-tap to borrow</div>
            `;
            
            if (isAdminOrLibrarian) {
                // Admin/Librarian: Single tap only for viewing details
                bookCard.addEventListener('click', () => {
                    viewBookDetails(book.custom_id || book.id || book.book_id, book, imageSrc);
                });
            } else {
                // Regular users: Single tap for details, double tap for borrow
                let tapCount = 0;
                let tapTimer = null;
                
                bookCard.addEventListener('click', () => {
                    tapCount++;
                    
                    if (tapCount === 1) {
                        // First tap - view details
                        tapTimer = setTimeout(() => {
                            viewBookDetails(book.custom_id || book.id || book.book_id, book, imageSrc);
                            tapCount = 0;
                        }, 300);
                    } else if (tapCount === 2) {
                        // Second tap within 300ms - borrow book
                        clearTimeout(tapTimer);
                        borrowBookFromGallery(book);
                        tapCount = 0;
                    }
                });
            }
            
            // Hover/touch tooltip events
            const tooltip = bookCard.querySelector('.book-cover-tooltip');
            if (tooltip) {
                // Desktop hover
                bookCard.addEventListener('mouseenter', () => {
                    tooltip.style.opacity = '1';
                    tooltip.style.visibility = 'visible';
                });
                bookCard.addEventListener('mouseleave', () => {
                    tooltip.style.opacity = '0';
                    tooltip.style.visibility = 'hidden';
                });
                
                // Mobile touch
                bookCard.addEventListener('touchstart', () => {
                    tooltip.style.opacity = '1';
                    tooltip.style.visibility = 'visible';
                });
                bookCard.addEventListener('touchend', () => {
                    setTimeout(() => {
                        tooltip.style.opacity = '0';
                        tooltip.style.visibility = 'hidden';
                    }, 1500); // Show for 1.5 seconds after touch
                });
            }
            
            gallery.appendChild(bookCard);
        });
        
        // Show cleanup indicator if books were trimmed
        if (booksToShow.length < books.length) {
            const infoDiv = document.createElement('div');
            infoDiv.style.cssText = 'grid-column: 1 / -1; text-align: center; padding: 15px; background: #fff3cd; border: 2px solid #ffc107; border-radius: 8px; margin-top: 20px; color: #856404; font-size: 13px;';
            infoDiv.innerHTML = `
                <i class="fas fa-sync-alt"></i> 
                <strong>Gallery Auto-Cleanup Active:</strong> 
                Showing ${booksToShow.length} most recent books out of ${books.length} total. 
                Older books are automatically rotated out to keep the gallery fresh.
            `;
            gallery.appendChild(infoDiv);
        }
    } else {
        gallery.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: #666;">
                No books found.
            </div>
        `;
    }
}

// =============================================
// TABLE POPULATION FUNCTIONS
// =============================================

/**
 * Gallery Auto-Cleanup Configuration
 * This feature automatically limits the gallery to show only the most recent books
 * when the total exceeds MAX_GALLERY_BOOKS, creating a rotating carousel effect.
 * 
 * To disable this feature, set: galleryAutoCleanupEnabled = false;
 * To change the limit, modify: MAX_GALLERY_BOOKS = <desired_number>;
 */

/**
 * Populate recent books table
 * @param {Array} books - Array of book objects
 */
function populateRecentBooksTable(books) {
    const tableBody = document.getElementById('recentBooksTable');
    if (!tableBody) return;
    
    tableBody.innerHTML = '';
    
    if (books && books.length > 0) {
        books.forEach(book => {
            const row = createBookRow(book, false);
            tableBody.appendChild(row);
        });
    } else {
        tableBody.innerHTML = `
            <tr>
                <td colspan="8" style="text-align: center; padding: 40px; color: #666;">
                    No books found. Add your first book!
                </td>
            </tr>
        `;
    }
}

/**
 * Populate all books table
 * @param {Array} books - Array of book objects
 */
function populateAllBooksTable(books) {
    const tableBody = document.getElementById('allBooksTable');
    if (!tableBody) return;
    
    tableBody.innerHTML = '';
    
    if (books && books.length > 0) {
        books.forEach(book => {
            const row = createBookRow(book, true);
            tableBody.appendChild(row);
        });
    } else {
        tableBody.innerHTML = `
            <tr>
                <td colspan="9" style="text-align: center; padding: 40px; color: #666;">
                    No books found in the library.
                </td>
            </tr>
        `;
    }
}

// append a set of book rows to existing table (for pagination)
function populateAllBooksTableAppend(books) {
    const tableBody = document.getElementById('allBooksTable');
    if (!tableBody || !books || books.length === 0) return;
    
    books.forEach(book => {
        const row = createBookRow(book, true);
        tableBody.appendChild(row);
    });
}

/**
 * Create a book table row
 * @param {Object} book - Book object
 * @param {boolean} includeActions - Whether to include action buttons
 * @returns {HTMLElement} Table row element
 */
function createBookRow(book, includeActions = true) {
    const row = document.createElement('tr');
    const bookId = book.custom_id || book.id || book.book_id;
    row.setAttribute('data-book-id', bookId);
    
    let statusBadge;
    switch(book.status) {
        case 'Available': 
            statusBadge = '<span class="badge badge-available">Available</span>'; 
            break;
        case 'Borrowed': 
            statusBadge = '<span class="badge badge-borrowed">Borrowed</span>'; 
            break;
        case 'Reserved': 
            statusBadge = '<span class="badge badge-reserved">Reserved</span>'; 
            break;
        default: 
            statusBadge = `<span class="badge">${book.status}</span>`;
    }
    
    // Check if user is admin or librarian to determine if action buttons should be shown
    const showActionButtons = includeActions && currentUser && (currentUser.role === 'Admin' || currentUser.role === 'Librarian');
    
    if (includeActions) {
        // Full table row with all columns (for main books table)
        row.innerHTML = `
            <td>${book.custom_id || book.id || book.book_id}</td>
            <td>${book.title}</td>
            <td>${book.author}</td>
            <td>${book.isbn || 'N/A'}</td>
            <td>${book.category_name || book.category}</td>
            <td>${book.shelf || 'Not Assigned'}</td>
            <td>${book.total_copies || book.copies || 1}</td>
            <td>${book.year || book.publication_year}</td>
            <td>${statusBadge}</td>
            <td>
                <div class="action-buttons-cell">
                    <button class="action-btn view-btn" data-id="${book.custom_id || book.id || book.book_id}">View</button>
                    ${showActionButtons ? `<button class="action-btn edit-btn" data-id="${book.custom_id || book.id || book.book_id}">Edit</button>` : ''}
                    ${showActionButtons ? `<button class="action-btn delete-btn" data-id="${book.custom_id || book.id || book.book_id}">Delete</button>` : ''}
                </div>
            </td>
        `;
    } else {
        // Simplified row for dashboard (recent books table) with action buttons
        row.innerHTML = `
            <td>${book.custom_id || book.id || book.book_id}</td>
            <td>${book.title}</td>
            <td>${book.author}</td>
            <td>${book.category_name || book.category}</td>
            <td>${book.total_copies || book.copies || 1}</td>
            <td>${book.added_date || book.created_at}</td>
            <td>
                <div class="action-buttons-cell">
                    <button class="action-btn view-btn" data-id="${book.custom_id || book.id || book.book_id}" style="padding: 4px 8px; font-size: 11px;">View</button>
                    ${showActionButtons ? `<button class="action-btn edit-btn" data-id="${book.custom_id || book.id || book.book_id}" style="padding: 4px 8px; font-size: 11px;">Edit</button>` : ''}
                    ${showActionButtons ? `<button class="action-btn delete-btn" data-id="${book.custom_id || book.id || book.book_id}" style="padding: 4px 8px; font-size: 11px;">Delete</button>` : ''}
                </div>
            </td>
        `;
    }
    
    // Event listeners will be handled via delegation (see setupGlobalEventListeners below)
    // This ensures events work for dynamically created elements
    
    return row;
}

/**
 * Populate recent borrowing table
 * @param {Array} records - Array of borrowing records
 */
function populateRecentBorrowingTable(records) {
    const tableBody = document.getElementById('dashboardBorrowingRecordsTable');
    if (!tableBody) return;
    
    tableBody.innerHTML = '';
    
    if (records && records.length > 0) {
        records.forEach(record => {
            const row = createDashboardBorrowingRow(record);
            tableBody.appendChild(row);
        });
    } else {
        tableBody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align: center; padding: 40px; color: #666;">
                    No borrowing records found.
                </td>
            </tr>
        `;
    }
}

/**
 * Create a borrowing table row
 * @param {Object} record - Borrowing record object
 * @param {boolean} includeActions - Whether to include action buttons
 * @returns {HTMLElement} Table row element
 */
function createBorrowingRow(record, includeActions = false) {
    const row = document.createElement('tr');
    
    let statusBadge;
    if (record.status === 'Active') {
        statusBadge = '<span class="badge badge-borrowed">Active</span>';
    } else if (record.status === 'Returned') {
        statusBadge = '<span class="badge badge-available">Returned</span>';
    } else {
        statusBadge = `<span class="badge">${record.status}</span>`;
    }
    
    // Check if user is admin or librarian to determine if action buttons should be shown
    const showActionButtons = includeActions && currentUser && (currentUser.role === 'Admin' || currentUser.role === 'Librarian');
    
    row.innerHTML = `
        <td>${record.id || ''}</td>
        <td>${record.member_name || record.memberName || ''}</td>
        <td>${record.book_title || record.bookTitle || ''}</td>
        <td>${record.borrow_date || record.borrowDate || ''}</td>
        <td>${record.due_date || record.dueDate || ''}</td>
        <td>${record.return_date || record.returnDate || ''}</td>
        <td>${statusBadge}</td>
        ${includeActions ? `
        <td>
            <div class="action-buttons-cell">
                <button class="action-btn view-btn" data-id="${record.id}">View</button>
                ${record.status === 'Active' && showActionButtons ? `<button class="action-btn edit-btn" data-id="${record.id}">Return</button>` : ''}
            </div>
        </td>
        ` : '<td></td>'}
    `;
    
    // Event listeners will be handled via delegation (see setupGlobalEventListeners)
    // This ensures events work for dynamically created elements
    
    return row;
}

/**
 * Create a dashboard borrowing table row
 * @param {Object} record - Borrowing record object
 * @returns {HTMLElement} Table row element
 */
function createDashboardBorrowingRow(record) {
    const row = document.createElement('tr');
    
    let statusBadge;
    if (record.status === 'Active') {
        statusBadge = '<span class="badge badge-borrowed">Active</span>';
    } else if (record.status === 'Returned') {
        statusBadge = '<span class="badge badge-available">Returned</span>';
    } else {
        statusBadge = `<span class="badge">${record.status}</span>`;
    }
    
    // Check if user is admin or librarian to determine if action buttons should be shown
    const showActionButtons = currentUser && (currentUser.role === 'Admin' || currentUser.role === 'Librarian');
    
    row.innerHTML = `
        <td>${record.member_name || record.memberName || ''}</td>
        <td>${record.book_title || record.bookTitle || ''}</td>
        <td>${record.borrow_date || record.borrowDate || ''}</td>
        <td>${record.due_date || record.dueDate || ''}</td>
        <td>${statusBadge}</td>
        <td>
            <div class="action-buttons-cell">
                <button class="action-btn view-btn" data-id="${record.id}" style="padding: 4px 8px; font-size: 11px;">View</button>
                ${record.status === 'Active' && showActionButtons ? 
                    `<button class="action-btn edit-btn" data-id="${record.id}" style="padding: 4px 8px; font-size: 11px;">Return</button>` : 
                    ''
                }
                ${showActionButtons ? `<button class="action-btn delete-btn" data-id="${record.id}" style="padding: 4px 8px; font-size: 11px;">Delete</button>` : ''}
            </div>
        </td>
    `;
    
    // Event listeners will be handled via delegation (see setupGlobalEventListeners)
    // This ensures events work for dynamically created elements
    
    return row;
}

// =============================================
// TEST FUNCTION FOR MODAL
// =============================================

function testEditModal() {
    console.log('Testing edit modal...');
    const testHTML = `
        <form id="testEditForm">
            <div class="form-group">
                <label for="testField">Test Field</label>
                <input type="text" id="testField" value="Test Value" placeholder="Enter test value">
            </div>
            <p>This is a test modal to verify the modal system is working.</p>
        </form>
    `;
    
    showModal('Test Edit Modal', testHTML, true, () => {
        console.log('Test modal callback executed');
        alert('Test modal is working!');
    });
}

// Make it available globally for testing
window.testEditModal = testEditModal;

// =============================================
// FORM HANDLERS
// =============================================

/**
 * Handle add book form submission
 * @param {Event} e - Form submit event
 */
async function handleAddBook(e) {
    e.preventDefault();
    
    console.log('handleAddBook called');
    
    const formData = new FormData(e.target);
    const bookCover = document.getElementById('bookCover').files[0];
    
    // Debug: Log form data
    console.log('Form data:', {
        title: formData.get('bookTitle'),
        author: formData.get('bookAuthor'),
        isbn: formData.get('bookISBN'),
        category: formData.get('bookCategory'),
        categoryIdType: typeof formData.get('bookCategory'),
        categoryIdValue: formData.get('bookCategory'),
        year: formData.get('bookYear'),
        publisher: formData.get('bookPublisher'),
        description: formData.get('bookDescription'),
        copies: formData.get('bookCopies')
    });
    
    // Validate required fields
    if (!formData.get('bookTitle') || !formData.get('bookAuthor') || !formData.get('bookCategory')) {
        console.log('Validation failed - missing required fields');
        showModal('Validation Error', 'Please fill in all required fields (Title, Author, and Category).');
        return;
    }
    
    // First create the book without the cover image
    const requestData = new FormData();
    requestData.append('action', 'add');
    requestData.append('title', formData.get('bookTitle'));
    requestData.append('author', formData.get('bookAuthor'));
    requestData.append('isbn', formData.get('bookISBN'));
    requestData.append('category_id', formData.get('bookCategory'));
    requestData.append('shelf', formData.get('bookShelf') || '');
    requestData.append('year', formData.get('bookYear'));
    requestData.append('publisher', formData.get('bookPublisher'));
    requestData.append('description', formData.get('bookDescription'));
    requestData.append('copies', formData.get('bookCopies'));
    
    console.log('Creating book without cover image...');
    
    try {
        const response = await fetch(`${API_BASE_URL}/books.php`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`
            },
            body: requestData
        });
        
        console.log('API Response status:', response.status);
        
        // Check if authentication failed (401 or 403)
        if (response.status === 401 || response.status === 403) {
            console.error('Authentication failed. Status:', response.status);
            showModal('Session Expired', `
                <div style="text-align: center; padding: 20px;">
                    <div style="font-size: 48px; color: #ff6b6b; margin-bottom: 20px;">⚠️</div>
                    <h3>Session Expired</h3>
                    <p>Your login session has expired for security reasons.</p>
                    <p>Please log in again to continue.</p>
                </div>
            `);
            // Clear session and redirect to login
            sessionStorage.clear();
            authToken = null;
            currentUser = null;
            setTimeout(() => {
                window.location.reload();
            }, 2000);
            return;
        }
        
        const data = await response.json();
        console.log('API Response data:', data);
        
        if (data.success) {
            const bookId = data.book_id;
            console.log('Book created successfully with ID:', bookId);
            
            // Now upload the cover image if provided
            if (bookCover) {
                console.log('Uploading book cover image...');
                try {
                    const imageFormData = new FormData();
                    imageFormData.append('cover_image', bookCover);
                    imageFormData.append('book_id', bookId);
                    
                    const imageResponse = await fetch(`${API_BASE_URL}/upload_book_cover.php`, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${authToken}`
                        },
                        body: imageFormData
                    });
                    
                    const imageUpload = await imageResponse.json();
                    
                    if (imageUpload.success) {
                        console.log('Cover image uploaded successfully:', imageUpload);
                        // Wait a moment to ensure the image is saved before reloading
                        await new Promise(resolve => setTimeout(resolve, 500));
                    } else {
                        console.error('Cover image upload failed:', imageUpload.message);
                        // Don't fail the whole operation if image upload fails
                    }
                } catch (uploadError) {
                    console.error('Cover image upload failed:', uploadError);
                    // Continue with success even if image upload fails
                }
            }
            
            showModal('Success', `
                <div style="text-align: center; padding: 20px;">
                    <div style="font-size: 48px; color: var(--primary-green); margin-bottom: 20px;">✓</div>
                    <h3>Book Added Successfully!</h3>
                    <p><strong>Title:</strong> ${formData.get('bookTitle')}</p>
                    <p><strong>Book ID:</strong> ${bookId}</p>
                    <p><strong>Author:</strong> ${formData.get('bookAuthor')}</p>
                    <p><strong>Copies:</strong> ${formData.get('bookCopies')}</p>
                </div>
            `);
            
            // Reset the form
            e.target.reset();
            // Hide the add-book section and show books section
            showSection('books');
            // Reset cover preview
            const coverPreview = document.getElementById('coverPreview');
            if (coverPreview) {
                coverPreview.style.display = 'none';
            }
            const coverPreviewImg = document.getElementById('coverPreviewImg');
            if (coverPreviewImg) {
                coverPreviewImg.src = '';
            }
            
            // Reload books data to ensure the new book with its cover image is displayed
            await loadBooksData();
            // Add a small delay to ensure DB transaction completes before refreshing dashboard
            setTimeout(async () => {
                await loadDashboardData();
            }, 300);
        } else {
            console.error('API Error:', data.message);
            showModal('Error', data.message || 'Failed to add book');
        }
    } catch (error) {
        console.error('Error adding book:', error);
        showModal('Error', 'Failed to add book. Please try again.');
    }
}

/**
 * Handle save settings form submission
 * @param {Event} e - Form submit event
 */
async function handleSaveSettings(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const settings = {
        library_name: formData.get('libraryName'),
        max_borrow_days: parseInt(formData.get('maxBorrowDays')) || 30,
        max_books_per_member: parseInt(formData.get('maxBooksPerMember')) || 5,
        late_fee_per_day: parseFloat(formData.get('lateFeePerDay')) || 0.50,
        enable_email_reminders: formData.get('enableEmailReminders'),
        reminder_days_before: parseInt(formData.get('reminderDaysBefore')) || 3
    };
    
    console.log('🔐 User role:', currentUser?.role);
    console.log('🔐 Auth token exists:', !!authToken);
    console.log('📋 Sending settings:', settings);
    
    // Show loading state
    showModal('Saving', '<div style="text-align: center;"><div class="loading-spinner"></div><p>Saving settings...</p></div>');
    
    try {
        const response = await fetch(`${API_BASE_URL}/settings.php`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(settings)
        });
        
        console.log('✓ Response status:', response.status);
        const data = await response.json();
        console.log('✓ Response data:', data);
        
        hideModal();
        
        if (data.success) {
            showModal('Settings Saved', `
                <div style="text-align: center; padding: 20px;">
                    <div style="font-size: 48px; color: var(--primary-green); margin-bottom: 20px;">✓</div>
                    <h3>Settings Saved Successfully!</h3>
                    <p>Your library settings have been updated.</p>
                    <p><strong>Library Name:</strong> ${settings.library_name}</p>
                    <p><strong>Max Borrow Days:</strong> ${settings.max_borrow_days}</p>
                    <p><strong>Late Fee per Day:</strong> ₵${settings.late_fee_per_day}</p>
                    <p><small>Last updated: ${new Date().toLocaleString()}</small></p>
                </div>
            `);
            
            // Save to localStorage for offline use
            localStorage.setItem('cpmrLibrarySettings', JSON.stringify({
                ...settings,
                lastUpdated: new Date().toLocaleString()
            }));
        } else {
            console.error('❌ Save failed:', data.message);
            showModal('Error', `<div style="padding: 20px;">
                <p><strong>Failed to save settings</strong></p>
                <p>${data.message}</p>
                <p style="font-size: 12px; color: #666; margin-top: 15px;">
                    <strong>Debug Info:</strong><br>
                    Your Role: ${currentUser?.role || 'Unknown'}<br>
                    Auth Status: ${authToken ? 'Logged in' : 'No token'}
                </p>
            </div>`);
        }
    } catch (error) {
        console.error('❌ Error saving settings:', error);
        hideModal();
        showModal('Error', `<div style="padding: 20px;">
            <p><strong>Failed to save settings</strong></p>
            <p>${error.message}</p>
            <p style="font-size: 12px; color: #666; margin-top: 15px;">
                <strong>Debug Info:</strong><br>
                Your Role: ${currentUser?.role || 'Unknown'}<br>
                Auth Status: ${authToken ? 'Logged in' : 'No token'}<br>
                Error: ${error.message}
            </p>
        </div>`);
    }
}

/**
 * Load saved settings from localStorage
 */
function loadSavedSettings() {
    const savedSettings = localStorage.getItem('cpmrLibrarySettings');
    if (savedSettings) {
        const settings = JSON.parse(savedSettings);
        document.getElementById('libraryName').value = settings.library_name || 'CPMR Library';
        document.getElementById('maxBorrowDays').value = settings.max_borrow_days || 30;
        document.getElementById('maxBooksPerMember').value = settings.max_books_per_member || 5;
        document.getElementById('lateFeePerDay').value = settings.late_fee_per_day || 0.50;
        document.getElementById('enableEmailReminders').value = settings.enable_email_reminders || 'yes';
        document.getElementById('reminderDaysBefore').value = settings.reminder_days_before || 3;
    }
}

/**
 * Load current settings from database
 */
async function loadCurrentSettings() {
    try {
        const response = await fetch(`${API_BASE_URL}/settings.php`, {
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            }
        });
        
        const data = await response.json();
        
        if (data.success && data.data) {
            const settings = data.data;
            document.getElementById('libraryName').value = settings.library_name || 'CPMR Library';
            document.getElementById('maxBorrowDays').value = settings.max_borrow_days || 30;
            document.getElementById('maxBooksPerMember').value = settings.max_books_per_member || 5;
            document.getElementById('lateFeePerDay').value = settings.late_fee_per_day || 0.50;
            document.getElementById('enableEmailReminders').value = settings.enable_email_reminders || 'yes';
            document.getElementById('reminderDaysBefore').value = settings.reminder_days_before || 3;
            
            // Save to localStorage for offline use
            localStorage.setItem('cpmrLibrarySettings', JSON.stringify({
                ...settings,
                lastUpdated: new Date().toLocaleString()
            }));
        }
    } catch (error) {
        console.error('Error loading settings:', error);
        // Fallback to localStorage
        loadSavedSettings();
    }
}

/**
 * Show librarian account creation modal
 */
function showLibrarianModal() {
    const modal = document.getElementById('librarianModalOverlay');
    if (modal) {
        modal.style.display = 'flex';
        document.getElementById('libUsername').focus();
    }
}

/**
 * Hide librarian account creation modal
 */
function hideLibrarianModal() {
    const modal = document.getElementById('librarianModalOverlay');
    if (modal) {
        modal.style.display = 'none';
        document.getElementById('librarianForm').reset();
        const msgDiv = document.getElementById('librarianFormMessage');
        if (msgDiv) {
            msgDiv.style.display = 'none';
            msgDiv.textContent = '';
        }
    }
}

/**
 * Show message in librarian form
 */
function showLibrarianFormMessage(message, type = 'info') {
    const msgDiv = document.getElementById('librarianFormMessage');
    if (msgDiv) {
        msgDiv.style.display = 'block';
        msgDiv.textContent = message;
        msgDiv.style.backgroundColor = type === 'success' ? '#d4edda' : type === 'error' ? '#f8d7da' : '#d1ecf1';
        msgDiv.style.borderLeft = `4px solid ${type === 'success' ? '#28a745' : type === 'error' ? '#dc3545' : '#17a2b8'}`;
        msgDiv.style.color = type === 'success' ? '#155724' : type === 'error' ? '#721c24' : '#0c5460';
    }
}

/**
 * Handle librarian account creation
 */
async function handleCreateLibrarian() {
    const username = document.getElementById('libUsername').value.trim();
    const password = document.getElementById('libPassword').value;
    const confirmPassword = document.getElementById('libConfirmPassword').value;
    const fullName = document.getElementById('libFullName').value.trim();
    const email = document.getElementById('libEmail').value.trim();

    // Validation
    if (!username || !password || !confirmPassword || !fullName || !email) {
        showLibrarianFormMessage('Please fill in all fields', 'error');
        return;
    }

    if (username.length < 3) {
        showLibrarianFormMessage('Username must be at least 3 characters', 'error');
        return;
    }

    if (password.length < 6) {
        showLibrarianFormMessage('Password must be at least 6 characters', 'error');
        return;
    }

    if (password !== confirmPassword) {
        showLibrarianFormMessage('Passwords do not match', 'error');
        return;
    }

    if (!email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
        showLibrarianFormMessage('Invalid email address', 'error');
        return;
    }

    try {
        // Disable submit button
        const submitBtn = document.getElementById('submitLibrarianForm');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Creating...';

        // Create librarian account via API
        const response = await fetch(`${API_BASE_URL}/users.php`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                action: 'create',
                username: username,
                password: password,
                name: fullName,
                email: email,
                role: 'Librarian'
            })
        });

        const data = await response.json();

        if (data.success) {
            showLibrarianFormMessage('Librarian account created successfully!', 'success');
            
            // Clear form
            document.getElementById('librarianForm').reset();
            
            // Close modal after 2 seconds
            setTimeout(() => {
                hideLibrarianModal();
                showModal('Success', `
                    <div style="text-align: center; padding: 20px;">
                        <div style="font-size: 48px; color: var(--primary-green); margin-bottom: 20px;">✓</div>
                        <h3>Librarian Account Created!</h3>
                        <p><strong>Username:</strong> ${username}</p>
                        <p><strong>Name:</strong> ${fullName}</p>
                        <p><strong>Email:</strong> ${email}</p>
                        <p style="margin-top: 20px; font-size: 14px; color: #666;">
                            The librarian can now log in with their username and password.
                        </p>
                    </div>
                `);
            }, 1500);
        } else {
            showLibrarianFormMessage(data.message || 'Failed to create account', 'error');
        }

    } catch (error) {
        console.error('Error creating librarian account:', error);
        showLibrarianFormMessage('Network error. Please try again.', 'error');
    } finally {
        // Re-enable submit button
        const submitBtn = document.getElementById('submitLibrarianForm');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Create Account';
    }
}

// =============================================
// HELPER FUNCTIONS
// =============================================

// ----------------------
// Notifications
// ----------------------
// Old notification system functions removed to prevent duplicates
// Modern notification system is implemented above in initializeNotifications()

function escapeHtml(text) {
    if (!text) return '';
    return text.replace(/[&<>"']/g, function (c) {
        return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"}[c];
    });
}

function formatDate(dt) {
    if (!dt) return '';
    const d = new Date(dt);
    return d.toLocaleString();
}

/**
 * Show register member modal
 */
function showRegisterMemberModal() {
    console.log('showRegisterMemberModal called');
    
    const formHTML = `
        <form id="memberRegistrationForm" onsubmit="event.preventDefault(); handleMemberFormSubmit();">
            <div class="form-grid">
                <div class="form-group">
                    <label for="memberName">Full Name *</label>
                    <input type="text" id="memberName" name="memberName" required>
                </div>
                <div class="form-group">
                    <label for="memberEmail">Email *</label>
                    <input type="email" id="memberEmail" name="memberEmail" required>
                </div>
                <div class="form-group">
                    <label for="memberPhone">Phone Number</label>
                    <input type="tel" id="memberPhone" name="memberPhone">
                </div>
                <div class="form-group">
                    <label for="memberType">Membership Type *</label>
                    <select id="memberType" name="memberType" required>
                        <option value="">Select Type</option>
                        <option value="Researcher">Researcher</option>
                        <option value="Faculty">Faculty</option>
                        <option value="Student">Student</option>
                        <option value="External">External</option>
                    </select>
                </div>
                <div class="form-group">
                    <label for="memberDepartment">Department/Institution</label>
                    <input type="text" id="memberDepartment" name="memberDepartment">
                </div>
                <div class="form-group">
                    <label for="memberStaffId">Staff/Student ID</label>
                    <input type="text" id="memberStaffId" name="memberStaffId">
                </div>
                <div class="form-group" style="grid-column: 1 / -1;">
                    <label for="memberAddress">Address</label>
                    <textarea id="memberAddress" name="memberAddress" rows="2"></textarea>
                </div>
            </div>
        </form>
    `;
    
    console.log('Calling showModal with formHTML');
    
    // Create a wrapper function for the async callback
    const handleRegisterMember = async () => {
        try {
            await registerNewMember();
        } catch (error) {
            console.error('Error in register member:', error);
        }
    };
    
    showModal('Register New Member', formHTML, true, handleRegisterMember, formHTML);
}

/**
 * Show add category modal
 */
function showAddCategoryModal() {
    const formHTML = `
        <form id="categoryForm">
            <div class="form-group">
                <label for="categoryName">Category Name *</label>
                <input type="text" id="categoryName" name="categoryName" required>
            </div>
            <div class="form-group">
                <label for="categoryDescription">Description</label>
                <textarea id="categoryDescription" name="categoryDescription" rows="3"></textarea>
            </div>
        </form>
    `;
    
    showModal('Add New Category', formHTML, true, handleAddCategory, formHTML);
}

/**
 * Handle add category
 */
async function handleAddCategory() {
    console.log('handleAddCategory called');
    
    const form = document.getElementById('categoryForm');
    if (!form) {
        console.log('No form found');
        return;
    }
    
    const formData = new FormData(form);
    const categoryData = {
        name: formData.get('categoryName'),
        description: formData.get('categoryDescription')
    };
    
    console.log('Category data:', categoryData);
    
    try {
        const response = await fetch(`${API_BASE_URL}/categories.php?action=add`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(categoryData)
        });
        
        const data = await response.json();
        console.log('Add category response:', data);
        
        if (data.success) {
            showModal('Success', 'Category added successfully!');
            await loadCategoriesData();
            await loadCategories(); // Update dropdowns
            await loadDashboardData(); // Update dashboard to refresh category counts
            
            // Force update category counts immediately
            console.log('Forcing category count update after add');
            setTimeout(async () => {
                try {
                    const response = await fetch(`${API_BASE_URL}/categories.php?action=getAll`, {
                        headers: {
                            'Authorization': `Bearer ${authToken}`
                        }
                    });
                    const data = await response.json();
                    if (data.success) {
                        console.log('Updating category counts with:', data.categories);
                        updateCategoryCounts(data.categories);
                    }
                } catch (error) {
                    console.error('Error updating category counts after add:', error);
                }
            }, 200);
        } else {
            showModal('Error', data.message || 'Failed to add category.');
        }
    } catch (error) {
        console.error('Error adding category:', error);
        showModal('Error', 'Failed to add category.');
    }
}

/**
 * Show new borrowing modal
 */
async function showNewBorrowingModal() {
    // We need members and books for the dropdowns
    try {
        const [membersRes, booksRes] = await Promise.all([
            fetch(`${API_BASE_URL}/members.php?action=getAll`, { headers: { 'Authorization': `Bearer ${authToken}` } }),
            fetch(`${API_BASE_URL}/books.php?action=getAll`, { headers: { 'Authorization': `Bearer ${authToken}` } })
        ]);
        
        const membersData = await membersRes.json();
        const booksData = await booksRes.json();
        
        if (!membersData.success || !booksData.success) {
            showModal('Error', 'Failed to load members or books for borrowing.');
            return;
        }
        
        const members = membersData.members;
        const books = booksData.books.filter(b => b.status === 'Available');
        
        if (books.length === 0) {
            showModal('Notice', 'No books are currently available for borrowing.');
            return;
        }
        
        // Get current settings for defaults
        const settingsResponse = await fetch(`${API_BASE_URL}/settings.php`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        const settingsData = await settingsResponse.json();
        const maxBorrowDays = settingsData.data?.max_borrow_days || 30;
        const maxBooksPerMember = settingsData.data?.max_books_per_member || 5;
        
        const formHTML = `
            <form id="borrowingForm">
                <div class="form-group">
                    <label for="borrowMember">Select Member *</label>
                    <select id="borrowMember" name="borrowMember" required>
                        <option value="">Select Member</option>
                        ${members.map(m => `<option value="${m.id}">${m.name} (${m.email})</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label for="borrowBook">Select Book *</label>
                    <select id="borrowBook" name="borrowBook" required>
                        <option value="">Select Book</option>
                        ${books.map(b => `<option value="${b.id}">${b.title} by ${b.author}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label for="borrowDays">Borrow Duration (Days) * <small style="color: #666;">(Default: ${maxBorrowDays} days, Max: ${maxBorrowDays})</small></label>
                    <input type="number" id="borrowDays" name="borrowDays" value="${maxBorrowDays}" min="1" max="${maxBorrowDays}" required>
                </div>
            </form>
        `;
        
        showModal('New Borrowing Record', formHTML, true, handleNewBorrowing, formHTML);
    } catch (error) {
        console.error('Error preparing borrowing modal:', error);
        showModal('Error', 'Failed to prepare borrowing form.');
    }
}

/**
 * Show send due notification modal with custom message editor
 */
function showSendDueNotificationModal() {
    // Default message templates with placeholders
    const defaultOverdueMessage = "Your book '{book_title}' by {book_author} is overdue by {days_overdue} day(s). Due date was {due_date}. Please return it as soon as possible.";
    const defaultDueSoonMessage = "Friendly reminder: Your book '{book_title}' by {book_author} is due in {days_until_due} day(s) on {due_date}. Please return it on time to avoid fines.";
    
    const formHTML = `
        <div style="padding: 15px 0;">
            <p style="margin-bottom: 20px; font-weight: bold;">Configure and send notifications to members about overdue and upcoming due dates.</p>
            
            <div class="form-group">
                <label for="notificationType">Notification Type *</label>
                <select id="notificationType" name="notificationType" required onchange="toggleMessageEditor()" style="width: 100%; padding: 10px; border: 2px solid #ddd; border-radius: 6px; font-size: 14px;">
                    <option value="all">All Notifications (Overdue + Due Soon)</option>
                    <option value="overdue">Overdue Books Only</option>
                    <option value="due_soon">Due Soon Reminders Only</option>
                </select>
            </div>
            
            <div class="form-group" id="daysBeforeGroup">
                <label for="daysBefore">Days Before Due Date *</label>
                <input type="number" id="daysBefore" name="daysBefore" value="3" min="1" max="14" 
                       placeholder="Notify X days before due date"
                       style="width: 100%; padding: 10px; border: 2px solid #ddd; border-radius: 6px; font-size: 14px;">
                <small style="color: #666; display: block; margin-top: 5px;">Members will be notified if their book is due within this many days.</small>
            </div>
            
            <hr style="margin: 25px 0; border: none; border-top: 2px solid #eee;">
            
            <h4 style="margin-bottom: 15px; color: #1976d2;">📝 Customize Your Messages</h4>
            
            <!-- Overdue Message Editor -->
            <div id="overdueMessageSection" style="margin-bottom: 25px;">
                <label style="font-weight: bold; color: #d32f2f; display: block; margin-bottom: 8px;">
                    📚 Overdue Book Message Template
                </label>
                <textarea id="overdueMessageTemplate" rows="4" 
                          style="width: 100%; padding: 12px; border: 2px solid #ffcdd2; border-radius: 6px; font-size: 13px; font-family: 'Courier New', monospace; resize: vertical;"
                          placeholder="Enter your custom overdue message...">${defaultOverdueMessage}</textarea>
                
                <div style="background: #ffebee; padding: 12px; border-radius: 6px; margin-top: 8px; border-left: 3px solid #d32f2f;">
                    <strong style="color: #c62828;">Available Placeholders:</strong>
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 8px; margin-top: 8px; font-size: 11px;">
                        <code style="background: white; padding: 4px 8px; border-radius: 3px;">{book_title}</code>
                        <code style="background: white; padding: 4px 8px; border-radius: 3px;">{book_author}</code>
                        <code style="background: white; padding: 4px 8px; border-radius: 3px;">{member_name}</code>
                        <code style="background: white; padding: 4px 8px; border-radius: 3px;">{days_overdue}</code>
                        <code style="background: white; padding: 4px 8px; border-radius: 3px;">{due_date}</code>
                        <code style="background: white; padding: 4px 8px; border-radius: 3px;">{member_email}</code>
                    </div>
                    <button onclick="resetMessage('overdue')" 
                            style="margin-top: 8px; background: #d32f2f; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 11px;">
                        🔄 Reset to Default
                    </button>
                </div>
            </div>
            
            <!-- Due Soon Message Editor -->
            <div id="dueSoonMessageSection" style="margin-bottom: 25px;">
                <label style="font-weight: bold; color: #f57c00; display: block; margin-bottom: 8px;">
                    ⏰ Due Soon Reminder Message Template
                </label>
                <textarea id="dueSoonMessageTemplate" rows="4" 
                          style="width: 100%; padding: 12px; border: 2px solid #ffe0b2; border-radius: 6px; font-size: 13px; font-family: 'Courier New', monospace; resize: vertical;"
                          placeholder="Enter your custom due soon message...">${defaultDueSoonMessage}</textarea>
                
                <div style="background: #fff3e0; padding: 12px; border-radius: 6px; margin-top: 8px; border-left: 3px solid #f57c00;">
                    <strong style="color: #e65100;">Available Placeholders:</strong>
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 8px; margin-top: 8px; font-size: 11px;">
                        <code style="background: white; padding: 4px 8px; border-radius: 3px;">{book_title}</code>
                        <code style="background: white; padding: 4px 8px; border-radius: 3px;">{book_author}</code>
                        <code style="background: white; padding: 4px 8px; border-radius: 3px;">{member_name}</code>
                        <code style="background: white; padding: 4px 8px; border-radius: 3px;">{days_until_due}</code>
                        <code style="background: white; padding: 4px 8px; border-radius: 3px;">{due_date}</code>
                        <code style="background: white; padding: 4px 8px; border-radius: 3px;">{member_email}</code>
                    </div>
                    <button onclick="resetMessage('due_soon')" 
                            style="margin-top: 8px; background: #f57c00; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 11px;">
                        🔄 Reset to Default
                    </button>
                </div>
            </div>
            
            <div style="background: #e3f2fd; padding: 15px; border-radius: 6px; margin-top: 15px; border-left: 4px solid #2196f3;">
                <strong>ℹ️ Tips:</strong>
                <ul style="margin: 10px 0 0 20px; color: #555; font-size: 12px;">
                    <li>Use the placeholders above to dynamically insert book and member information</li>
                    <li>Keep messages clear and professional</li>
                    <li>You can use emojis to make notifications more friendly 😊</li>
                    <li>Messages will be previewed before sending</li>
                </ul>
            </div>
        </div>
    `;
    
    showModal('📬 Send Due Notifications - Customize Messages', formHTML, true, handleSendDueNotifications, formHTML);
}

/**
 * Toggle message editor visibility based on notification type
 */
function toggleMessageEditor() {
    const type = document.getElementById('notificationType').value;
    const overdueSection = document.getElementById('overdueMessageSection');
    const dueSoonSection = document.getElementById('dueSoonMessageSection');
    
    if (type === 'overdue') {
        overdueSection.style.display = 'block';
        dueSoonSection.style.display = 'none';
    } else if (type === 'due_soon') {
        overdueSection.style.display = 'none';
        dueSoonSection.style.display = 'block';
    } else {
        overdueSection.style.display = 'block';
        dueSoonSection.style.display = 'block';
    }
}

/**
 * Reset message template to default
 */
function resetMessage(type) {
    const defaults = {
        overdue: "Your book '{book_title}' by {book_author} is overdue by {days_overdue} day(s). Due date was {due_date}. Please return it as soon as possible.",
        due_soon: "Friendly reminder: Your book '{book_title}' by {book_author} is due in {days_until_due} day(s) on {due_date}. Please return it on time to avoid fines."
    };
    
    if (type === 'overdue') {
        document.getElementById('overdueMessageTemplate').value = defaults.overdue;
    } else if (type === 'due_soon') {
        document.getElementById('dueSoonMessageTemplate').value = defaults.due_soon;
    }
}

/**
 * Handle send due notifications with custom messages
 */
async function handleSendDueNotifications() {
    try {
        const notificationType = document.getElementById('notificationType').value;
        const daysBefore = parseInt(document.getElementById('daysBefore').value) || 3;
        
        // Get custom message templates
        const overdueTemplate = document.getElementById('overdueMessageTemplate').value.trim();
        const dueSoonTemplate = document.getElementById('dueSoonMessageTemplate').value.trim();
        
        // Validate templates
        if ((notificationType === 'all' || notificationType === 'overdue') && !overdueTemplate) {
            showModal('Validation Error', 'Please enter a custom message for overdue books or reset to default.');
            return;
        }
        
        if ((notificationType === 'all' || notificationType === 'due_soon') && !dueSoonTemplate) {
            showModal('Validation Error', 'Please enter a custom message for due soon reminders or reset to default.');
            return;
        }
        
        console.log('Sending due notifications...', { 
            type: notificationType, 
            days: daysBefore,
            hasOverdueTemplate: !!overdueTemplate,
            hasDueSoonTemplate: !!dueSoonTemplate
        });
        
        const requestBody = {
            action: 'sendDueNotifications',
            type: notificationType,
            days_before: daysBefore
        };
        
        // Add custom templates if provided
        if (overdueTemplate) {
            requestBody.overdue_template = overdueTemplate;
        }
        if (dueSoonTemplate) {
            requestBody.due_soon_template = dueSoonTemplate;
        }
        
        const response = await fetch(`${API_BASE_URL}/notifications.php`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify(requestBody)
        });
        
        const result = await response.json();
        
        if (result.success) {
            // Show preview of actual messages that were sent
            let previewHTML = `<div style="padding: 20px 0;">
                <p style="font-size: 16px; margin-bottom: 20px; font-weight: bold;">${result.message}</p>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px;">
                    <div style="background: #ffebee; padding: 15px; border-radius: 8px; text-align: center;">
                        <div style="font-size: 24px; font-weight: bold; color: #d32f2f;">${result.details.overdue_notifications || 0}</div>
                        <div style="font-size: 12px; color: #666;">Overdue Notices Sent</div>
                    </div>
                    <div style="background: #fff3e0; padding: 15px; border-radius: 8px; text-align: center;">
                        <div style="font-size: 24px; font-weight: bold; color: #f57c00;">${result.details.due_soon_notifications || 0}</div>
                        <div style="font-size: 12px; color: #666;">Due Soon Reminders Sent</div>
                    </div>
                </div>`;
            
            // Show message preview if available
            if (result.messages_preview) {
                previewHTML += `<hr style="margin: 20px 0; border: none; border-top: 2px solid #eee;">
                    <h5 style="margin-bottom: 15px; color: #1976d2;">📋 Messages Sent:</h5>`;
                
                if (result.messages_preview.overdue) {
                    previewHTML += `<div style="background: #ffebee; padding: 15px; border-radius: 8px; margin-bottom: 15px; border-left: 4px solid #d32f2f;">
                        <strong style="color: #c62828;">📚 Overdue Message:</strong>
                        <p style="margin-top: 8px; font-size: 13px; line-height: 1.6; color: #555;">${result.messages_preview.overdue}</p>
                    </div>`;
                }
                
                if (result.messages_preview.due_soon) {
                    previewHTML += `<div style="background: #fff3e0; padding: 15px; border-radius: 8px; border-left: 4px solid #f57c00;">
                        <strong style="color: #e65100;">⏰ Due Soon Message:</strong>
                        <p style="margin-top: 8px; font-size: 13px; line-height: 1.6; color: #555;">${result.messages_preview.due_soon}</p>
                    </div>`;
                }
            }
            
            previewHTML += `<p style="margin-top: 20px; font-size: 13px; color: #666;">
                💡 Tip: Members will see these notifications when they log in. Check the notifications panel to verify.
            </p></div>`;
            
            showModal('✅ Success!', previewHTML);
            
            // Refresh notifications count
            if (typeof updateNotificationCount === 'function') {
                updateNotificationCount();
            }
        } else {
            showModal('Error', result.message || 'Failed to send notifications.');
        }
    } catch (error) {
        console.error('Error sending due notifications:', error);
        showModal('Error', 'An error occurred while sending notifications: ' + error.message);
    }
}

/**
 * Handle new borrowing
 */
async function handleNewBorrowing() {
    const form = document.getElementById('borrowingForm');
    if (!form) return;
    
    const formData = new FormData(form);
    const borrowingData = {
        member_id: formData.get('borrowMember'),
        book_id: formData.get('borrowBook'),
        borrow_days: formData.get('borrowDays')
    };
    
    try {
        const response = await fetch(`${API_BASE_URL}/borrowing.php?action=borrow`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(borrowingData)
        });
        
        const data = await response.json();
        
        if (data.success) {
            showModal('Success', `Book borrowed successfully! Due date: ${data.due_date}`);
            await loadBorrowingData();
            // Add a small delay to ensure DB transaction completes before refreshing dashboard
            setTimeout(async () => {
                await loadDashboardData();
            }, 300);
            await loadBooksData(); // Refresh book status
        } else {
            showModal('Error', data.message || 'Failed to create borrowing record.');
        }
    } catch (error) {
        console.error('Error creating borrowing record:', error);
        showModal('Error', 'Failed to create borrowing record.');
    }
}

/**
 * Generate monthly report
 */
async function generateMonthlyReport() {
    // Show month selection modal
    const currentDate = new Date();
    const currentMonth = currentDate.getFullYear() + '-' + String(currentDate.getMonth() + 1).padStart(2, '0');
    
    const monthSelectionHTML = `
        <div style="padding: 20px;">
            <div style="margin-bottom: 20px;">
                <label for="reportMonth" style="display: block; margin-bottom: 8px; font-weight: 600; color: var(--primary-green); font-size: 14px;">
                    Select Month for Report
                </label>
                <input type="month" id="reportMonth" value="${currentMonth}" 
                       style="width: 100%; padding: 12px 15px; border: 1px solid var(--border-color); border-radius: 6px; font-size: 16px;">
            </div>
            <div style="background: #f5f5f5; padding: 15px; border-radius: 6px; margin-top: 15px;">
                <p style="margin: 0; font-size: 13px; color: #666;">
                    <strong>ℹ️ Report info:</strong> The system will analyze all borrowing records, returns, overdue items, new members, and top books for the selected month.
                </p>
            </div>
        </div>
    `;
    
    showModal('Generate Monthly Report', monthSelectionHTML, true, async () => {
        const monthInput = document.getElementById('reportMonth');
        const selectedMonth = monthInput ? monthInput.value : currentMonth;
        
        if (!selectedMonth) {
            showModal('Error', 'Please select a month.');
            return;
        }
        
        // Show loading state
        showModal('Generating Report', `
            <div style="text-align: center; padding: 30px;">
                <div style="font-size: 48px; margin-bottom: 20px; animation: spin 2s linear infinite;">⏳</div>
                <p style="color: #666; font-size: 14px;">Processing report for ${new Date(selectedMonth + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}...</p>
            </div>
            <style>
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            </style>
        `);
        
        try {
            // Load report with specified month
            const reportResponse = await fetch(`${API_BASE_URL}/reports.php?action=monthly&month=${selectedMonth}`, {
                headers: {
                    'Authorization': `Bearer ${authToken}`
                }
            });
            
            const reportData = await reportResponse.json();
            
            if (reportData.success) {
                // Load trends data with the specified month
                const trendsResponse = await fetch(`${API_BASE_URL}/reports.php?action=monthly_trends&month=${selectedMonth}`, {
                    headers: {
                        'Authorization': `Bearer ${authToken}`
                    }
                });
                
                const trendsData = await trendsResponse.json();
                const reportMonth = new Date(selectedMonth + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
                
                // Combine data
                const combinedData = {
                    ...reportData.report,
                    top_books: reportData.top_books,
                    top_members: reportData.top_members
                };
                
                if (trendsData.success && trendsData.borrowingTrends) {
                    combinedData.borrowingTrends = trendsData.borrowingTrends;
                }
                
                // Update dashboard
                updateReportData(combinedData);
                
                // Show comprehensive report summary
                showMonthlyReportSummary(reportData, reportMonth);
            } else {
                showModal('Error', 'Failed to generate report. ' + (reportData.message || ''));
            }
        } catch (error) {
            console.error('Error generating report:', error);
            showModal('Error', 'Failed to generate report: ' + error.message);
        }
    });
}

/**
 * Register new member
 */
async function registerNewMember() {
    console.log('registerNewMember called');
    
    const form = document.querySelector('#memberRegistrationForm');
    if (!form) {
        console.log('Form not found!');
        return;
    }

    const formData = new FormData(form);
    const memberData = {
        name: formData.get('memberName'),
        email: formData.get('memberEmail'),
        phone: formData.get('memberPhone'),
        membership_type: formData.get('memberType'),
        department: formData.get('memberDepartment'),
        staff_id: formData.get('memberStaffId'),
        address: formData.get('memberAddress')
    };

    console.log('Member data:', memberData);

    if (!memberData.name || !memberData.email || !memberData.membership_type) {
        showModal('Validation Error', 'Please fill in all required fields marked with *');
        return;
    }

    try {
        console.log('Sending request to API...');
        const response = await fetch(`${API_BASE_URL}/members.php?action=add`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(memberData)
        });

        const data = await response.json();
        console.log('API response:', data);

        if (data.success) {
            showModal('Registration Successful', `
                <div style="text-align: center; padding: 20px;">
                    <div style="font-size: 48px; color: var(--primary-green); margin-bottom: 20px;">✓</div>
                    <h3>Member Registered Successfully!</h3>
                    <p><strong>Member Name:</strong> ${memberData.name}</p>
                    <p><strong>Member ID:</strong> ${data.member_id}</p>
                    <p><strong>Email:</strong> ${memberData.email}</p>
                    <p><strong>Membership Type:</strong> ${memberData.membership_type}</p>
                    <p><small>Registration Date: ${new Date().toLocaleDateString()}</small></p>
                </div>
            `);

            // Reload members data if on members page
            const currentSection = document.querySelector('.page-section.active');
            if (currentSection && currentSection.id === 'members') {
                await loadMembersData();
            }
            // Add a small delay to ensure DB transaction completes before refreshing dashboard
            setTimeout(async () => {
                await loadDashboardData();
            }, 300);
        } else {
            showModal('Error', data.message || 'Failed to register member.');
        }
    } catch (error) {
        console.error('Error registering member:', error);
        showModal('Error', 'Failed to register member. Please try again.');
    }
}

// Handle form submission when user presses Enter
async function handleMemberFormSubmit() {
    await registerNewMember();
}

/**
 * Export books list (simulated)
 */
function exportBooksList() {
    showModal('Export Books List', `
        <div style="text-align: center; padding: 20px;">
            <div style="font-size: 48px; color: var(--primary-green); margin-bottom: 20px;">📤</div>
            <h3>Export Books List</h3>
            <p>Export the complete books list in your preferred format.</p>
            <div style="margin-top: 20px;">
                <p><strong>Select Format:</strong></p>
                <div style="display: flex; gap: 10px; justify-content: center; flex-wrap: wrap;">
                    <button class="btn btn-primary" style="padding: 12px 20px;" onclick="downloadExport('books', 'csv')">
                        <i class="bi bi-bar-chart"></i> CSV
                    </button>
                    <button class="btn btn-primary" style="padding: 12px 20px;" onclick="downloadExport('books', 'excel')">
                        <i class="bi bi-bar-chart"></i> Excel
                    </button>
                    <button class="btn btn-primary" style="padding: 12px 20px;" onclick="downloadExport('books', 'pdf')">
                        <i class="bi bi-file-earmark-pdf"></i> PDF
                    </button>
                </div>
            </div>
        </div>
    `);
}

/**
 * Download export file
 * @param {string} type - Export type (books, members, borrowing)
 * @param {string} format - Export format (pdf, excel, csv)
 */
function downloadExport(type, format) {
    // Close current modal
    hideModal();
    
    // Show loading modal
    showModal('Generating Export', `
        <div style="text-align: center; padding: 30px;">
            <div style="font-size: 48px; color: var(--primary-green); margin-bottom: 20px;">⏳</div>
            <h3>Generating ${format.toUpperCase()} Export</h3>
            <p>Preparing your ${type} report in ${format.toUpperCase()} format...</p>
            <div class="progress-bar" style="height: 12px; background: #f0f0f0; border-radius: 6px; margin: 25px 0; overflow: hidden;">
                <div class="progress" style="height: 100%; background: var(--primary-green); width: 0%; transition: width 1.5s;"></div>
            </div>
            <p style="font-size: 14px; color: #666;">This may take a few moments</p>
        </div>
    `);
    
    // Animate progress
    setTimeout(() => {
        const progressBar = document.querySelector('.progress');
        if (progressBar) {
            progressBar.style.width = '70%';
        }
    }, 500);
    
    // Make API call to generate and download file
    setTimeout(async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/export.php?action=${type}&format=${format}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${authToken}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (response.ok) {
                // Get filename from Content-Disposition header
                const contentDisposition = response.headers.get('Content-Disposition');
                let filename = `${type}_report_${format}_${new Date().toISOString().split('T')[0]}.${format}`;
                
                if (contentDisposition) {
                    const filenameMatch = contentDisposition.match(/filename="(.+)"/);
                    if (filenameMatch) {
                        filename = filenameMatch[1];
                    }
                }
                
                // Create download link
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = filename;
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);
                
                // Update progress to complete
                const progressBar = document.querySelector('.progress');
                if (progressBar) {
                    progressBar.style.width = '100%';
                }
                
                // Show success message
                setTimeout(() => {
                    showModal('Export Complete', `
                        <div style="text-align: center; padding: 30px;">
                            <div style="font-size: 48px; color: var(--primary-green); margin-bottom: 20px;">✅</div>
                            <h3>Export Successful!</h3>
                            <p>Your ${type} report has been downloaded as ${format.toUpperCase()}.</p>
                            <div style="margin-top: 20px; padding: 15px; background: #f8f9fa; border-radius: 8px; text-align: left;">
                                <p><strong>File Details:</strong></p>
                                <p>📁 Name: ${filename}</p>
                                <p>📊 Format: ${format.toUpperCase()}</p>
                                <p>📅 Generated: ${new Date().toLocaleString()}</p>
                                <p>💾 Size: ${(blob.size / 1024).toFixed(1)} KB</p>
                            </div>
                            <button class="btn btn-primary" onclick="hideModal()" style="margin-top: 20px;">
                                Close
                            </button>
                        </div>
                    `);
                }, 800);
                
            } else {
                throw new Error('Export failed');
            }
        } catch (error) {
            console.error('Export error:', error);
            showModal('Export Failed', `
                <div style="text-align: center; padding: 30px;">
                    <div style="font-size: 48px; color: #dc3545; margin-bottom: 20px;">❌</div>
                    <h3>Export Failed</h3>
                    <p>Sorry, there was an error generating your export file.</p>
                    <p style="color: #666; font-size: 14px; margin-top: 15px;">
                        Error: ${error.message}
                    </p>
                    <button class="btn btn-primary" onclick="hideModal()" style="margin-top: 20px;">
                        Try Again
                    </button>
                </div>
            `);
        }
    }, 2000);
}

/**
 * Export members list
 */
function exportMembersList() {
    showModal('Export Members List', `
        <div style="text-align: center; padding: 20px;">
            <div style="font-size: 48px; color: var(--primary-green); margin-bottom: 20px;">👥</div>
            <h3>Export Members List</h3>
            <p>Export the complete members list in your preferred format.</p>
            <div style="margin-top: 20px;">
                <p><strong>Select Format:</strong></p>
                <div style="display: flex; gap: 10px; justify-content: center; flex-wrap: wrap;">
                    <button class="btn btn-primary" style="padding: 12px 20px;" onclick="downloadExport('members', 'csv')">
                        <i class="bi bi-bar-chart"></i> CSV
                    </button>
                    <button class="btn btn-primary" style="padding: 12px 20px;" onclick="downloadExport('members', 'excel')">
                        <i class="bi bi-bar-chart"></i> Excel
                    </button>
                    <button class="btn btn-primary" style="padding: 12px 20px;" onclick="downloadExport('members', 'pdf')">
                        <i class="bi bi-file-earmark-pdf"></i> PDF
                    </button>
                </div>
            </div>
        </div>
    `);
}

/**
 * Export the complete monthly report in selected format
 */
async function exportMonthlyReport() {
    // Get current month or fall back to today
    const currentDate = new Date();
    const currentMonth = currentDate.getFullYear() + '-' + String(currentDate.getMonth() + 1).padStart(2, '0');
    
    const exportFormatHTML = `
        <div style="padding: 20px;">
            <div style="margin-bottom: 20px;">
                <label for="reportExportMonth" style="display: block; margin-bottom: 8px; font-weight: 600; color: var(--primary-green); font-size: 14px;">
                    Select Month to Export
                </label>
                <input type="month" id="reportExportMonth" value="${currentMonth}" 
                       style="width: 100%; padding: 12px 15px; border: 1px solid var(--border-color); border-radius: 6px; font-size: 16px;">
            </div>
            
            <div style="margin-bottom: 20px;">
                <label style="display: block; margin-bottom: 8px; font-weight: 600; color: var(--primary-green); font-size: 14px;">
                    Select Export Format
                </label>
                <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px;">
                    <label style="display: flex; align-items: center; padding: 12px; border: 2px solid #ddd; border-radius: 6px; cursor: pointer; transition: all 0.3s;" 
                           onmouseover="this.style.borderColor='var(--primary-green)'; this.style.backgroundColor='#f0f8f5';" 
                           onmouseout="this.style.borderColor='#ddd'; this.style.backgroundColor='white';">
                        <input type="radio" name="reportExportFormat" value="pdf" checked style="margin-right: 8px;">
                        <span style="font-weight: 600;">📄 PDF</span>
                    </label>
                    <label style="display: flex; align-items: center; padding: 12px; border: 2px solid #ddd; border-radius: 6px; cursor: pointer; transition: all 0.3s;" 
                           onmouseover="this.style.borderColor='var(--primary-green)'; this.style.backgroundColor='#f0f8f5';" 
                           onmouseout="this.style.borderColor='#ddd'; this.style.backgroundColor='white';">
                        <input type="radio" name="reportExportFormat" value="excel" style="margin-right: 8px;">
                        <span style="font-weight: 600;">📊 Excel</span>
                    </label>
                    <label style="display: flex; align-items: center; padding: 12px; border: 2px solid #ddd; border-radius: 6px; cursor: pointer; transition: all 0.3s;" 
                           onmouseover="this.style.borderColor='var(--primary-green)'; this.style.backgroundColor='#f0f8f5';" 
                           onmouseout="this.style.borderColor='#ddd'; this.style.backgroundColor='white';">
                        <input type="radio" name="reportExportFormat" value="csv" style="margin-right: 8px;">
                        <span style="font-weight: 600;">📋 CSV</span>
                    </label>
                </div>
            </div>
            
            <div style="background: #f5f5f5; padding: 15px; border-radius: 6px; margin-top: 15px;">
                <p style="margin: 0; font-size: 13px; color: #666;">
                    <strong>ℹ️ Report Export:</strong> Generates a comprehensive monthly report with executive summary, KPIs, statistics, top books and members.
                </p>
            </div>
        </div>
    `;
    
    showModal('Export Monthly Report', exportFormatHTML, true, async () => {
        const monthInput = document.getElementById('reportExportMonth');
        const selectedMonth = monthInput ? monthInput.value : currentMonth;
        const formatInput = document.querySelector('input[name="reportExportFormat"]:checked');
        const selectedFormat = formatInput ? formatInput.value : 'pdf';
        
        if (!selectedMonth) {
            showModal('Error', 'Please select a month.');
            return;
        }
        
        // Show loading state
        showModal('Exporting Report', `
            <div style="text-align: center; padding: 30px;">
                <div style="font-size: 48px; margin-bottom: 20px; animation: spin 2s linear infinite;">⏳</div>
                <p style="color: #666; font-size: 14px;">Generating ${selectedFormat.toUpperCase()} report for ${new Date(selectedMonth + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}...</p>
            </div>
            <style>
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            </style>
        `);
        
        try {
            // Fetch the report data
            const reportResponse = await fetch(`${API_BASE_URL}/reports.php?action=monthly&month=${selectedMonth}`, {
                headers: {
                    'Authorization': `Bearer ${authToken}`
                }
            });
            
            const reportData = await reportResponse.json();
            
            if (reportData.success) {
                // Prepare export data
                const report = reportData.report;
                const topBooks = reportData.top_books || [];
                const topMembers = reportData.top_members || [];
                
                // Generate export based on format
                if (selectedFormat === 'pdf') {
                    exportReportAsPDF(report, topBooks, topMembers, selectedMonth);
                } else if (selectedFormat === 'excel') {
                    exportReportAsExcel(report, topBooks, topMembers, selectedMonth);
                } else if (selectedFormat === 'csv') {
                    exportReportAsCSV(report, topBooks, topMembers, selectedMonth);
                }
                
                // Show success
                setTimeout(() => {
                    showModal('Export Complete', `
                        <div style="text-align: center; padding: 30px;">
                            <div style="font-size: 48px; color: var(--primary-green); margin-bottom: 20px;">✅</div>
                            <h3>Report Exported Successfully!</h3>
                            <p>Your monthly report has been exported in ${selectedFormat.toUpperCase()} format.</p>
                            <div style="margin-top: 20px; padding: 15px; background: #f8f9fa; border-radius: 8px; text-align: left;">
                                <p><strong>Report Details:</strong></p>
                                <p>📅 Period: ${new Date(selectedMonth + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</p>
                                <p>📊 Format: ${selectedFormat.toUpperCase()}</p>
                                <p>⏰ Generated: ${new Date().toLocaleString()}</p>
                            </div>
                        </div>
                    `);
                }, 1500);
            } else {
                showModal('Error', 'Failed to export report. ' + (reportData.message || ''));
            }
        } catch (error) {
            console.error('Error exporting report:', error);
            showModal('Error', 'Failed to export report: ' + error.message);
        }
    });
}

/**
 * Export report as PDF
 */
function exportReportAsPDF(report, topBooks, topMembers, reportMonth) {
    const monthDate = new Date(reportMonth + '-01');
    const monthName = monthDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    
    // Calculate metrics
    const totalTransactions = (report.monthly_borrowings || 0) + (report.monthly_returns || 0);
    const availableBooks = report.total_books || 0;
    const totalPhysicalCopies = report.total_physical_copies || 0;
    const circulationRate = availableBooks > 0 ? ((report.monthly_borrowings || 0) / availableBooks * 100).toFixed(1) : 0;
    const memberEngagement = (report.total_members || 0) > 0 ? ((report.monthly_borrowings || 0) / (report.total_members || 1)).toFixed(1) : 0;
    
    let pdfContent = `
    CPMR LIBRARY - COMPREHENSIVE MONTHLY OPERATIONS REPORT
    Centre for Plant Medicine Research
    ========================================
    
    Report Period: ${monthName}
    Generated: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
    
    EXECUTIVE SUMMARY
    -----------------
    This month, the library processed ${totalTransactions} transactions involving borrowing and returns.
    The collection engagement rate reached ${circulationRate}%, with an average of ${memberEngagement} books per member.
    The library continues to serve ${report.total_members || 0} active members with a comprehensive collection of ${availableBooks} unique titles (${totalPhysicalCopies} total copies).
    
    KEY PERFORMANCE INDICATORS (KPI)
    --------------------------------
    Books Borrowed:          ${report.monthly_borrowings || 0}
    Books Returned:          ${report.monthly_returns || 0}
    Overdue Books:           ${report.overdue_books || 0}
    Fines Collected:         ₵${(report.fines_collected || 0).toFixed(2)}
    Outstanding Fines:       ₵${(report.outstanding_fines || 0).toFixed(2)}
    New Members:             ${report.new_members_month || 0}
    New Books Added:         ${report.new_books_month || 0}
    Total Transactions:      ${totalTransactions}
    Overdue Rate:            ${report.overdue_rate || '0%'}
    Circulation Rate:        ${circulationRate}%
    Member Engagement:       ${memberEngagement} books/member
    
    COLLECTION OVERVIEW
    -------------------
    Unique Titles:           ${availableBooks}
    Total Physical Copies:   ${totalPhysicalCopies}
    New Books This Month:    ${report.new_books_month || 0}
    
    TOP PERFORMING CATEGORY
    -----------------------
    ${report.most_borrowed_category || 'Not Available'}
    
    CATEGORY BREAKDOWN
    ------------------
    `;
    
    if (report.category_breakdown && report.category_breakdown.length > 0) {
        report.category_breakdown.forEach((cat, index) => {
            pdfContent += `${index + 1}. ${cat.category_name}: ${cat.borrow_count} borrows (${cat.unique_books_borrowed || 0} unique books)\n`;
        });
    } else {
        pdfContent += 'No category data available\n';
    }
    
    pdfContent += `
    MEMBER TYPE DISTRIBUTION
    ------------------------
    `;
    
    if (report.member_type_distribution && report.member_type_distribution.length > 0) {
        report.member_type_distribution.forEach((type) => {
            pdfContent += `${type.membership_type || 'N/A'}: ${type.active_members || 0} active members, ${type.borrow_count || 0} borrows\n`;
        });
    } else {
        pdfContent += 'No member type data available\n';
    }
    
    pdfContent += `
    SYSTEM USERS BY ROLE
    --------------------
    `;
    
    if (report.user_role_stats && report.user_role_stats.length > 0) {
        report.user_role_stats.forEach((role) => {
            pdfContent += `${role.role}: ${role.count} users\n`;
        });
    } else {
        pdfContent += 'No user role data available\n';
    }
    
    pdfContent += `
    TOP 5 MOST BORROWED LITERATURE
    ---------------------------------
    `;
    
    if (topBooks.length === 0) {
        pdfContent += 'No data available\n';
    } else {
        topBooks.slice(0, 5).forEach((book, index) => {
            pdfContent += `${index + 1}. "${book.title}" by ${book.author} - ${book.borrow_count} borrows\n`;
        });
    }
    
    pdfContent += `
    TOP 5 ACTIVE MEMBERS
    ----------------------
    `;
    
    if (topMembers.length === 0) {
        pdfContent += 'No data available\n';
    } else {
        topMembers.slice(0, 5).forEach((member, index) => {
            pdfContent += `${index + 1}. ${member.name} - ${member.borrow_count} books (${member.membership_type || 'Member'})\n`;
        });
    }
    
    pdfContent += `
    INSIGHTS & OBSERVATIONS
    -----------------------
    Collection Health: ${circulationRate}% circulation rate indicates ${parseFloat(circulationRate) > 30 ? 'strong' : 'moderate'} collection usage
    Member Compliance: ${report.overdue_rate || '0%'} overdue rate shows ${parseFloat(report.overdue_rate || 0) < 5 ? 'excellent' : 'good'} member responsibility
    Growth Trend: ${report.new_members_month || 0} new members added this month, expanding the user base
    `;
    
    if (report.journal_stats) {
        pdfContent += `Digital Resources: ${report.journal_stats.total_journals || 0} journals available in the system\n`;
    }
    
    if (report.policy_stats) {
        pdfContent += `Policy Documents: ${report.policy_stats.total_policies || 0} policies documented\n`;
    }
    
    pdfContent += `
    ========================================
    Report Status: COMPLETED
    This comprehensive report was automatically generated by the CPMR Library Management System
    For questions or additional analysis, please contact the Library Administration
    © CPMR Library System | Confidential
    `;
    
    // Create and download text file (PDF-like format)
    const blob = new Blob([pdfContent], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `CPMR_Monthly_Report_${reportMonth}.pdf`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
}

/**
 * Export report as Excel
 */
function exportReportAsExcel(report, topBooks, topMembers, reportMonth) {
    const monthDate = new Date(reportMonth + '-01');
    const monthName = monthDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    
    // Calculate metrics
    const totalTransactions = (report.monthly_borrowings || 0) + (report.monthly_returns || 0);
    const availableBooks = report.total_books || 0;
    const totalPhysicalCopies = report.total_physical_copies || 0;
    const circulationRate = availableBooks > 0 ? ((report.monthly_borrowings || 0) / availableBooks * 100).toFixed(1) : 0;
    const memberEngagement = (report.total_members || 0) > 0 ? ((report.monthly_borrowings || 0) / (report.total_members || 1)).toFixed(1) : 0;
    
    // Create CSV-like content for Excel
    let excelContent = `CPMR LIBRARY - COMPREHENSIVE MONTHLY OPERATIONS REPORT\n`;
    excelContent += `Centre for Plant Medicine Research\n`;
    excelContent += `Report Period,${monthName}\n`;
    excelContent += `Generated,${new Date().toLocaleDateString()}\n\n`;
    
    excelContent += `KEY PERFORMANCE INDICATORS\n`;
    excelContent += `Metric,Value\n`;
    excelContent += `Books Borrowed,${report.monthly_borrowings || 0}\n`;
    excelContent += `Books Returned,${report.monthly_returns || 0}\n`;
    excelContent += `Overdue Books,${report.overdue_books || 0}\n`;
    excelContent += `Fines Collected,₵${(report.fines_collected || 0).toFixed(2)}\n`;
    excelContent += `Outstanding Fines,₵${(report.outstanding_fines || 0).toFixed(2)}\n`;
    excelContent += `New Members,${report.new_members_month || 0}\n`;
    excelContent += `New Books Added,${report.new_books_month || 0}\n`;
    excelContent += `Total Transactions,${totalTransactions}\n`;
    excelContent += `Overdue Rate,${report.overdue_rate || '0%'}\n`;
    excelContent += `Circulation Rate,${circulationRate}%\n`;
    excelContent += `Member Engagement,${memberEngagement} books/member\n\n`;
    
    excelContent += `COLLECTION OVERVIEW\n`;
    excelContent += `Metric,Value\n`;
    excelContent += `Unique Titles,${availableBooks}\n`;
    excelContent += `Total Physical Copies,${totalPhysicalCopies}\n`;
    excelContent += `New Books This Month,${report.new_books_month || 0}\n\n`;
    
    excelContent += `TOP PERFORMING CATEGORY\n`;
    excelContent += `Category,${report.most_borrowed_category || 'Not Available'}\n\n`;
    
    excelContent += `CATEGORY BREAKDOWN\n`;
    excelContent += `Category Name,Borrows,Unique Books Borrowed\n`;
    if (report.category_breakdown && report.category_breakdown.length > 0) {
        report.category_breakdown.forEach((cat) => {
            excelContent += `"${cat.category_name}",${cat.borrow_count},${cat.unique_books_borrowed || 0}\n`;
        });
    } else {
        excelContent += `No data available\n`;
    }
    excelContent += `\n`;
    
    excelContent += `MEMBER TYPE DISTRIBUTION\n`;
    excelContent += `Membership Type,Active Members,Borrows\n`;
    if (report.member_type_distribution && report.member_type_distribution.length > 0) {
        report.member_type_distribution.forEach((type) => {
            excelContent += `"${type.membership_type || 'N/A'}",${type.active_members || 0},${type.borrow_count || 0}\n`;
        });
    } else {
        excelContent += `No data available\n`;
    }
    excelContent += `\n`;
    
    excelContent += `SYSTEM USERS BY ROLE\n`;
    excelContent += `Role,User Count\n`;
    if (report.user_role_stats && report.user_role_stats.length > 0) {
        report.user_role_stats.forEach((role) => {
            excelContent += `"${role.role}",${role.count}\n`;
        });
    } else {
        excelContent += `No data available\n`;
    }
    excelContent += `\n`;
    
    excelContent += `TOP 5 MOST BORROWED BOOKS\n`;
    excelContent += `Rank,Title,Author,Borrow Count\n`;
    topBooks.slice(0, 5).forEach((book, index) => {
        excelContent += `${index + 1},"${book.title}","${book.author}",${book.borrow_count}\n`;
    });
    
    excelContent += `\nTOP 5 ACTIVE MEMBERS\n`;
    excelContent += `Rank,Name,Borrow Count,Membership Type\n`;
    topMembers.slice(0, 5).forEach((member, index) => {
        excelContent += `${index + 1},"${member.name}",${member.borrow_count},"${member.membership_type || 'Member'}"\n`;
    });
    
    excelContent += `\nINSIGHTS & OBSERVATIONS\n`;
    excelContent += `Collection Health,${circulationRate}% circulation rate indicates ${parseFloat(circulationRate) > 30 ? 'strong' : 'moderate'} collection usage\n`;
    excelContent += `Member Compliance,${report.overdue_rate || '0%'} overdue rate shows ${parseFloat(report.overdue_rate || 0) < 5 ? 'excellent' : 'good'} member responsibility\n`;
    excelContent += `Growth Trend,${report.new_members_month || 0} new members added this month\n`;
    if (report.journal_stats) {
        excelContent += `Digital Resources,${report.journal_stats.total_journals || 0} journals available\n`;
    }
    if (report.policy_stats) {
        excelContent += `Policy Documents,${report.policy_stats.total_policies || 0} policies documented\n`;
    }
    
    excelContent += `\n========================================\n`;
    excelContent += `Report Status: COMPLETED\n`;
    excelContent += `This comprehensive report was automatically generated by the CPMR Library Management System\n`;
    excelContent += `For questions or additional analysis, please contact the Library Administration\n`;
    excelContent += `© CPMR Library System | Confidential\n`;
    
    const blob = new Blob([excelContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `CPMR_Monthly_Report_${reportMonth}.xlsx`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
}

/**
 * Export report as CSV
 */
function exportReportAsCSV(report, topBooks, topMembers, reportMonth) {
    const monthDate = new Date(reportMonth + '-01');
    const monthName = monthDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    
    // Calculate metrics
    const totalTransactions = (report.monthly_borrowings || 0) + (report.monthly_returns || 0);
    const availableBooks = report.total_books || 0;
    const circulationRate = availableBooks > 0 ? ((report.monthly_borrowings || 0) / availableBooks * 100).toFixed(1) : 0;
    const memberEngagement = (report.total_members || 0) > 0 ? ((report.monthly_borrowings || 0) / (report.total_members || 1)).toFixed(1) : 0;
    
    let csvContent = `CPMR LIBRARY MONTHLY OPERATIONS REPORT\n`;
    csvContent += `Centre for Plant Medicine Research\n`;
    csvContent += `Report Period: ${monthName}\n`;
    csvContent += `Generated: ${new Date().toLocaleDateString()}\n\n`;
    
    csvContent += `KEY PERFORMANCE INDICATORS\n`;
    csvContent += `Metric,Value\n`;
    csvContent += `Books Borrowed,${report.monthly_borrowings || 0}\n`;
    csvContent += `Books Returned,${report.monthly_returns || 0}\n`;
    csvContent += `Overdue Books,${report.overdue_books || 0}\n`;
    csvContent += `Fines Collected,₵${(report.fines_collected || 0).toFixed(2)}\n`;
    csvContent += `Outstanding Fines,₵${(report.outstanding_fines || 0).toFixed(2)}\n`;
    csvContent += `New Members,${report.new_members_month || 0}\n`;
    csvContent += `Total Transactions,${totalTransactions}\n`;
    csvContent += `Overdue Rate,${report.overdue_rate || '0%'}\n`;
    csvContent += `Circulation Rate,${circulationRate}%\n`;
    csvContent += `Member Engagement,${memberEngagement} books/member\n\n`;
    
    csvContent += `TOP PERFORMING CATEGORY: ${report.most_borrowed_category || 'Not Available'}\n\n`;
    
    csvContent += `TOP 5 MOST BORROWED BOOKS\n`;
    csvContent += `Rank,Title,Author,Borrow Count\n`;
    topBooks.slice(0, 5).forEach((book, index) => {
        csvContent += `${index + 1},"${book.title}","${book.author}",${book.borrow_count}\n`;
    });
    
    csvContent += `\nTOP 5 ACTIVE MEMBERS\n`;
    csvContent += `Rank,Name,Borrow Count,Membership Type\n`;
    topMembers.slice(0, 5).forEach((member, index) => {
        csvContent += `${index + 1},"${member.name}",${member.borrow_count},"${member.membership_type || 'Member'}"\n`;
    });
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `CPMR_Monthly_Report_${reportMonth}.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
}

/**
 * Export borrowing records
 */
function exportBorrowingRecords() {
    showModal('Export Borrowing Records', `
        <div style="text-align: center; padding: 20px;">
            <div style="font-size: 48px; color: var(--primary-green); margin-bottom: 20px;">📚</div>
            <h3>Export Borrowing Records</h3>
            <p>Export all borrowing records in your preferred format.</p>
            <div style="margin-top: 20px;">
                <p><strong>Select Format:</strong></p>
                <div style="display: flex; gap: 10px; justify-content: center; flex-wrap: wrap;">
                    <button class="btn btn-primary" style="padding: 12px 20px;" onclick="downloadExport('borrowing', 'csv')">
                        <i class="bi bi-bar-chart"></i> CSV
                    </button>
                    <button class="btn btn-primary" style="padding: 12px 20px;" onclick="downloadExport('borrowing', 'excel')">
                        <i class="bi bi-bar-chart"></i> Excel
                    </button>
                    <button class="btn btn-primary" style="padding: 12px 20px;" onclick="downloadExport('borrowing', 'pdf')">
                        <i class="bi bi-file-earmark-pdf"></i> PDF
                    </button>
                </div>
            </div>
        </div>
    `);
}

/**
 * Simulate report export
 * @param {string} format - Export format
 */
function simulateReportExport(format) {
    showModal('Exporting Report', `
        <div style="text-align: center; padding: 20px;">
            <div style="font-size: 48px; color: var(--primary-green); margin-bottom: 20px;">⏳</div>
            <h3>Exporting Report</h3>
            <p>Preparing ${format} report...</p>
            <div class="progress-bar" style="height: 10px; background: #f0f0f0; border-radius: 5px; margin: 20px 0; overflow: hidden;">
                <div class="progress" style="height: 100%; background: var(--primary-green); width: 0%; transition: width 2s;"></div>
            </div>
        </div>
    `);
    
    setTimeout(() => {
        const progressBar = document.querySelector('.progress');
        if (progressBar) {
            progressBar.style.width = '100%';
        }
        
        setTimeout(() => {
            showModal('Report Exported', `
                <div style="text-align: center; padding: 20px;">
                    <div style="font-size: 48px; color: var(--primary-green); margin-bottom: 20px;">✅</div>
                    <h3>Report Exported Successfully!</h3>
                    <p>Your report has been exported in ${format} format.</p>
                    <div style="margin-top: 20px; padding: 15px; background: #f8f9fa; border-radius: 5px;">
                        <p><strong>File Details:</strong></p>
                        <p>Format: ${format}</p>
                        <p>Generated: ${new Date().toLocaleString()}</p>
                    </div>
                </div>
            `);
        }, 2000);
    }, 100);
}

/**
 * Simulate sending reminders
 */
function simulateSendReminders() {
    showModal('Sending Reminders', `
        <div style="text-align: center; padding: 20px;">
            <div style="font-size: 48px; color: var(--primary-green); margin-bottom: 20px;">📧</div>
            <h3>Sending Due Date Reminders</h3>
            <p>Scanning for overdue and upcoming due dates...</p>
            <div class="progress-bar" style="height: 10px; background: #f0f0f0; border-radius: 5px; margin: 20px 0; overflow: hidden;">
                <div class="progress" style="height: 100%; background: var(--primary-green); width: 0%; transition: width 3s;"></div>
            </div>
        </div>
    `);
    
    setTimeout(() => {
        const progressBar = document.querySelector('.progress');
        if (progressBar) progressBar.style.width = '100%';
        
        setTimeout(() => {
            showModal('Reminders Sent', `
                <div style="text-align: center; padding: 20px;">
                    <div style="font-size: 48px; color: var(--primary-green); margin-bottom: 20px;">✅</div>
                    <h3>Reminders Sent Successfully!</h3>
                    <p>Due date notifications have been sent to all relevant members.</p>
                </div>
            `);
        }, 3000);
    }, 100);
}

// =============================================
// BOOK MANAGEMENT FUNCTIONS
// =============================================

/**
 * View book details
 * @param {string|number} bookId - Book ID
 */
async function viewBookDetails(bookId, bookData = null, imageSrc = null) {
    try {
        // If book data is provided from gallery click, use it directly
        if (bookData) {
            const book = bookData;
            const coverImage = imageSrc || (book.cover_image ? `/cpmr_library/backend/uploads/book_covers/${book.cover_image}` : '/cpmr_library/frontend/images/default-book-cover.jfif');
            
            const details = `
                <div style="padding: 10px;">
                    <div style="text-align: center; margin-bottom: 15px;">
                        <div class="book-cover-placeholder" style="max-width: 200px; height: 250px; margin: 0 auto;">
                            <img src="${coverImage}" 
                                 alt="${book.title} Cover" 
                                 class="book-cover-image"
                                 loading="lazy"
                                 onload="this.classList.add('loaded');"
                                 onerror="this.src='/cpmr_library/frontend/images/default-book-cover.jfif'; this.classList.add('loaded');">
                        </div>
                    </div>
                    <h4 style="color: var(--primary-green); margin-bottom: 15px;">${book.title}</h4>
                    <p><strong>Custom ID:</strong> ${book.custom_id || book.book_id || book.id}</p>
                    <p><strong>Database ID:</strong> ${book.book_id || book.id}</p>
                    <p><strong>Author:</strong> ${book.author}</p>
                    <p><strong>ISBN:</strong> ${book.isbn || 'N/A'}</p>
                    <p><strong>Category:</strong> ${book.category_name || book.category}</p>
                    <p><strong>Shelf Location:</strong> ${book.shelf || 'Not Assigned'}</p>
                    <p><strong>Publication Year:</strong> ${book.publication_year || book.year}</p>
                    <p><strong>Publisher:</strong> ${book.publisher || 'Unknown'}</p>
                    <p><strong>Copies Available:</strong> ${book.available_copies || book.copies}</p>
                    <p><strong>Total Copies:</strong> ${book.total_copies || book.copies}</p>
                    <p><strong>Status:</strong> ${book.status}</p>
                    <p><strong>Description:</strong> ${book.description || 'No description available'}</p>
                    <p><strong>Date Added:</strong> ${book.created_at || book.added_date}</p>
                </div>
            `;
            showModal('Book Details', details);
            return;
        }
        
        // Otherwise fetch from API (for fallback cases)
        const response = await fetch(`${API_BASE_URL}/books.php?action=getDetails&id=${bookId}`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            const book = data.book;
            const coverImage = book.cover_image ? `/cpmr_library/backend/uploads/book_covers/${book.cover_image}` : '/cpmr_library/frontend/images/default-book-cover.jfif';
            
            const details = `
                <div style="padding: 10px;">
                    <div style="text-align: center; margin-bottom: 15px;">
                        <div class="book-cover-placeholder" style="max-width: 200px; height: 250px; margin: 0 auto;">
                            <img src="${coverImage}" 
                                 alt="${book.title} Cover" 
                                 class="book-cover-image"
                                 loading="lazy"
                                 onload="this.classList.add('loaded');"
                                 onerror="this.src='/cpmr_library/frontend/images/default-book-cover.jfif'; this.classList.add('loaded');">
                        </div>
                    </div>
                    <h4 style="color: var(--primary-green); margin-bottom: 15px;">${book.title}</h4>
                    <p><strong>Custom ID:</strong> ${book.custom_id || book.book_id || book.id}</p>
                    <p><strong>Database ID:</strong> ${book.book_id || book.id}</p>
                    <p><strong>Author:</strong> ${book.author}</p>
                    <p><strong>ISBN:</strong> ${book.isbn || 'N/A'}</p>
                    <p><strong>Category:</strong> ${book.category_name || book.category}</p>
                    <p><strong>Shelf Location:</strong> ${book.shelf || 'Not Assigned'}</p>
                    <p><strong>Publication Year:</strong> ${book.publication_year || book.year}</p>
                    <p><strong>Publisher:</strong> ${book.publisher || 'Unknown'}</p>
                    <p><strong>Copies Available:</strong> ${book.available_copies || book.copies}</p>
                    <p><strong>Total Copies:</strong> ${book.total_copies || book.copies}</p>
                    <p><strong>Status:</strong> ${book.status}</p>
                    <p><strong>Description:</strong> ${book.description || 'No description available'}</p>
                    <p><strong>Date Added:</strong> ${book.created_at || book.added_date}</p>
                </div>
            `;
            showModal('Book Details', details);
        }
    } catch (error) {
        console.error('Error loading book details:', error);
        showModal('Error', 'Failed to load book details.');
    }
}

/**
 * Borrow book from gallery (double-tap)
 * @param {Object} book - Book object to borrow
 */
async function borrowBookFromGallery(book) {
    // Check if user is authenticated
    const token = getAuthToken();
    if (!token) {
        showModal('Error', 'Authentication required. Please log in again.');
        handleLogout();
        return;
    }
    
    // Check if user is admin or librarian - they cannot borrow books
    if (currentUser && (currentUser.role === 'Admin' || currentUser.role === 'Librarian')) {
        showModal('Not Allowed', '<p>❌ Admin and Librarian users cannot borrow books.</p><p>Only regular users can request to borrow books.</p>', false);
        return;
    }
    
    // Check if book is available
    if (!book.available_copies || book.available_copies < 1) {
        showModal('Not Available', `<p>Sorry, "<strong>${book.title}</strong>" is not currently available for borrowing.</p><p>Available Copies: ${book.available_copies || 0}</p>`, false);
        return;
    }
    
    // Get settings for max borrow days
    try {
        const settingsResponse = await fetch(`${API_BASE_URL}/settings.php`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const settingsData = await settingsResponse.json();
        const maxBorrowDays = settingsData.data?.max_borrow_days || 30;

        const borrowFormHTML = `
            <form id="quickBorrowForm">
                <div style="text-align: center; margin-bottom: 15px;">
                    <div class="book-cover-placeholder" style="max-width: 150px; height: 200px; margin: 0 auto;">
                        <img src="${book.cover_image ? '/cpmr_library/backend/uploads/book_covers/' + book.cover_image : '/cpmr_library/frontend/images/default-book-cover.jfif'}" 
                             alt="${book.title} Cover" 
                             style="width: 100%; height: 100%; object-fit: cover; border-radius: 4px;">
                    </div>
                </div>
                
                <h4 style="color: var(--primary-green); margin: 15px 0;">${book.title}</h4>
                <p><strong>Author:</strong> ${book.author}</p>
                
                <div style="background: #e8f5e9; padding: 10px; border-radius: 4px; margin: 15px 0; border-left: 4px solid #4CAF50;">
                    <p style="margin: 0;"><strong>✓ Available Copies:</strong> ${book.available_copies}</p>
                </div>
                
                <div class="form-group" style="margin: 15px 0;">
                    <label style="display: block; margin-bottom: 5px; font-weight: bold;">Borrow Duration</label>
                    <div style="padding: 10px; background: #f0f8f0; border: 1px solid #4CAF50; border-radius: 4px; color: #1b5e20; font-weight: 500;">
                        ${maxBorrowDays} days <small style="color: #666; font-weight: normal;">(set by library admin)</small>
                    </div>
                    <input type="hidden" name="requested_days" value="${maxBorrowDays}">
                </div>
                
                <div class="form-group" style="margin: 15px 0;">
                    <label for="borrowMessage" style="display: block; margin-bottom: 5px; font-weight: bold;">Message / Notes (Optional)</label>
                    <textarea id="borrowMessage" name="message" rows="2" placeholder="Add any special requests..." style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;"></textarea>
                </div>
            </form>
        `;

        showModal('Request to Borrow', borrowFormHTML, true, async () => {
            const form = document.getElementById('quickBorrowForm');
            if (!form) return;
            
            const formData = new FormData(form);
            const payload = {
                action: 'create',
                book_id: book.id || book.book_id,
                requested_days: formData.get('requested_days'),
                message: formData.get('message')
            };

            try {
                const response = await fetch(`${API_BASE_URL}/requests.php`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify(payload)
                });

                const data = await response.json();
                if (data.success) {
                    showModal('Success', '✅ Your request to borrow has been submitted! Waiting for admin approval.');
                    
                    // Send push notification about the request
                    sendPushNotification('📚 Request Submitted', {
                        body: `✅ Your request for "${book.title}" has been submitted!`,
                        tag: 'borrow-request',
                        requireInteraction: false
                    });
                } else {
                    showModal('Error', data.message || 'Failed to submit borrow request');
                }
            } catch (error) {
                console.error('Error submitting borrow request:', error);
                showModal('Error', 'Failed to submit request. Please try again.');
            }
        });
    } catch (error) {
        console.error('Error in borrow process:', error);
        showModal('Error', 'Failed to process borrow request.');
    }
}


/**
 * Edit book (placeholder function)
 * @param {string|number} bookId - Book ID
 */
/**
 * Edit book
 * @param {string|number} bookId - Book ID
 */


/**
 * Delete book
 * @param {string|number} bookId - Book ID
 */
async function deleteBook(bookId) {
    // Check if user is Admin or Librarian - ROBUST CHECK
    // NOTE: User data is stored in sessionStorage, not localStorage!
    const currentUserRaw = sessionStorage.getItem('currentUser') || sessionStorage.getItem('user');
    console.log('=== DELETE BOOK - SESSION STORAGE CHECK ===');
    console.log('SessionStorage currentUser:', currentUserRaw);
    
    let currentUser;
    try {
        currentUser = JSON.parse(currentUserRaw || '{}');
    } catch (e) {
        console.error('Failed to parse currentUser from sessionStorage:', e);
        showModal('Error', 'Session data corrupted. Please log in again.');
        sessionStorage.removeItem('currentUser');
        sessionStorage.removeItem('user');
        return;
    }
    
    console.log('Parsed user object:', currentUser);
    console.log('User properties:', Object.keys(currentUser));
    console.log('User role raw value:', currentUser.role);
    console.log('User role type:', typeof currentUser.role);
    
    // ROBUST role check - handle all edge cases
    let userRole = '';
    if (currentUser.role) {
        userRole = String(currentUser.role).trim().toLowerCase();
    }
    
    console.log('Normalized role:', userRole);
    console.log('Is "admin"?', userRole === 'admin');
    console.log('Is "librarian"?', userRole === 'librarian');
    
    const isAdmin = userRole === 'admin' || userRole === 'Admin' || userRole === 'ADMIN';
    const isLibrarian = userRole === 'librarian' || userRole === 'Librarian' || userRole === 'LIBRARIAN';
    
    if (!isAdmin && !isLibrarian) {
        console.error('❌ ACCESS DENIED: Role check failed');
        console.error('Expected: "admin" or "librarian"');
        console.error('Got:', JSON.stringify(userRole));
        showModal('Access Denied', `Only Admin and Librarian users can delete books.\n\nYour role: "${currentUser.role}"`);
        return;
    }
    
    console.log('✅ Role check PASSED - User is', isAdmin ? 'ADMIN' : 'LIBRARIAN');
    
    // Check if already verified in this session (within 5 minutes)
    if (isCriticalActionValid()) {
        console.log('✅ Already verified for critical action - showing delete confirmation');
        // Show warning confirmation modal directly
        showDeleteBookConfirmationModal(bookId);
    } else {
        // Require password verification first
        console.log('Password verification required for delete book...');
        const verified = await verifyUserPassword('delete_book');
        
        if (!verified) {
            console.error('❌ VERIFICATION FAILED - BLOCKING DELETE BOOK');
            return;
        }
        
        console.log('✅ Verification successful - showing delete confirmation');
        // Show warning confirmation modal after verification
        showDeleteBookConfirmationModal(bookId);
    }
}

/**
 * Show delete book confirmation modal with DELETE typing requirement
 * @param {string|number} bookId - Book ID
 */
function showDeleteBookConfirmationModal(bookId) {
    const warningModalHTML = `
        <div style="padding: 20px; text-align: center;">
            <div style="font-size: 48px; color: #f44336; margin-bottom: 15px;">❌</div>
            <h3 style="margin-bottom: 15px; color: #333;">Confirm Deletion</h3>
            <p style="color: #666; margin-bottom: 20px; line-height: 1.5;">
                You are about to <strong style="color: #f44336;">PERMANENTLY DELETE</strong> a book record.<br>
                <strong>This action cannot be undone!</strong>
            </p>
            <div style="background-color: #f8d7da; border: 1px solid #f5c6cb; border-radius: 6px; padding: 12px; margin: 15px 0; text-align: left;">
                <strong>Warning:</strong> Once deleted, the book record and all associated information will be permanently removed from the system.
            </div>
            <p style="color: #dc3545; font-weight: bold; margin-top: 15px;">
                Type "DELETE" in the field below to confirm this action:
            </p>
            <input type="text" id="deleteConfirmationInput" 
                   placeholder="Type DELETE to confirm" 
                   style="width: 100%; padding: 10px; margin: 10px 0; border: 1px solid #ddd; border-radius: 4px; text-align: center; font-weight: bold;"
                   autocomplete="off">
        </div>
    `;
    
    // Wait for DOM to be ready before accessing the input element
    setTimeout(() => {
        showModal('Delete Book Confirmation', warningModalHTML, true, () => {
            const confirmationInput = document.getElementById('deleteConfirmationInput');
            console.log('Confirmation input element:', confirmationInput);
            
            if (!confirmationInput) {
                console.error('Could not find confirmation input element');
                showModal('Error', 'Could not find confirmation input. Please try again.');
                return;
            }
            
            const confirmationValue = confirmationInput.value.trim();
            console.log('Confirmation value entered:', confirmationValue);
            console.log('Confirmation value after trim and uppercase:', confirmationValue.toUpperCase());
            
            if (confirmationValue.toUpperCase() !== 'DELETE') {
                console.log('Confirmation failed - value did not match DELETE');
                showModal('Action Cancelled', `Deletion cancelled. You typed "${confirmationValue}" but must type "DELETE" to confirm.`);
                return;
            }
            
            console.log('Confirmation successful, calling deleteBookConfirmed');
            deleteBookConfirmed({ bookId });
        });
    }, 100); // Small delay to ensure DOM elements are rendered
}

/**
 * Confirmed delete book function after admin password validation
 */
async function deleteBookConfirmed(params) {
    const { bookId } = params;
    
    try {
        console.log('Attempting to delete book with ID:', bookId);
        console.log('API URL:', `${API_BASE_URL}/books.php`);
        console.log('Auth token present:', !!authToken);
        
        // Use POST method with form data instead of DELETE to avoid potential issues
        const formData = new FormData();
        formData.append('action', 'delete');
        formData.append('id', bookId);
        
        const response = await fetch(`${API_BASE_URL}/books.php`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`
                // Don't set Content-Type header when using FormData, browser sets it automatically
            },
            body: formData
        });
        
        console.log('Response status:', response.status);
        
        // Check if response is OK before parsing JSON
        if (!response.ok) {
            const errorText = await response.text();
            console.error('HTTP error response:', response.status, response.statusText, errorText);
            throw new Error(`HTTP ${response.status}: ${errorText}`);
        }
        
        const data = await response.json();
        console.log('Delete response data:', data);
        
        if (data.success) {
            showModal('Success', 'Book has been deleted successfully.');
            
            // Reload books data
            await loadBooksData();
            await loadDashboardData();
            
            // Clear verification after successful delete
            clearCriticalActionVerification();
        } else {
            showModal('Error', data.message || 'Failed to delete book.');
        }
    } catch (error) {
        console.error('Error deleting book:', error);
        showModal('Error', 'Failed to delete book. Error: ' + error.message);
    }
}

/**
 * View borrowing record details
 * @param {string|number} recordId - Borrowing record ID
 */
async function viewBorrowingRecordDetails(recordId) {
    try {
        const response = await fetch(`${API_BASE_URL}/borrowing.php?action=getDetails&id=${recordId}`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            const record = data.record;
            const details = `
                <div style="padding: 15px; max-width: 500px;">
                    <h4 style="color: var(--primary-green); margin-bottom: 20px; border-bottom: 2px solid var(--primary-green); padding-bottom: 10px;">
                        📋 Borrowing Record Details
                    </h4>
                    <div style="display: grid; gap: 12px;">
                        <div><strong>Record ID:</strong> ${record.id}</div>
                        <div><strong>Member:</strong> ${record.member_name}</div>
                        <div><strong>Member Email:</strong> ${record.member_email || 'N/A'}</div>
                        <div><strong>Member Phone:</strong> ${record.member_phone || 'N/A'}</div>
                        <div><strong>Book:</strong> ${record.book_title}</div>
                        <div><strong>Author:</strong> ${record.book_author || 'N/A'}</div>
                        <div><strong>ISBN:</strong> ${record.isbn || 'N/A'}</div>
                        <div><strong>Borrow Date:</strong> ${record.borrow_date}</div>
                        <div><strong>Due Date:</strong> ${record.due_date}</div>
                        <div><strong>Return Date:</strong> ${record.return_date || 'Not returned'}</div>
                        <div><strong>Status:</strong> <span class="badge ${record.status === 'Active' ? 'badge-borrowed' : 'badge-available'}">${record.status}</span></div>
                        ${record.late_fee ? `<div><strong>Late Fee:</strong> ₵${record.late_fee}</div>` : ''}
                        ${record.notes ? `<div><strong>Notes:</strong> ${record.notes}</div>` : ''}
                    </div>
                </div>
            `;
            showModal('Borrowing Record Details', details);
        } else {
            showModal('Error', data.message || 'Failed to load borrowing record details.');
        }
    } catch (error) {
        console.error('Error loading borrowing record details:', error);
        showModal('Error', 'Failed to load borrowing record details.');
    }
}

/**
 * Delete borrowing record
 * @param {string|number} recordId - Borrowing record ID
 */
async function deleteBorrowingRecord(recordId) {
    // Show admin password confirmation modal before proceeding
    showAdminPasswordConfirmation('deleteBorrowingRecordConfirmed', { recordId });
}

/**
 * Confirmed delete borrowing record function after admin password validation
 */
async function deleteBorrowingRecordConfirmed(params) {
    const { recordId } = params;
    showModal(
        'Delete Borrowing Record',
        `Are you sure you want to delete this borrowing record? This action cannot be undone.`,
        true,
        async () => {
            try {
                const response = await fetch(`${API_BASE_URL}/borrowing.php?action=delete&id=${recordId}`, {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `Bearer ${authToken}`
                    }
                });
                
                const data = await response.json();
                
                if (data.success) {
                    showModal('Success', 'Borrowing record has been deleted successfully.');
                    
                    // Reload borrowing data
                    await loadRecentBorrowing();
                    await loadDashboardData();
                } else {
                    showModal('Error', data.message || 'Failed to delete borrowing record.');
                }
            } catch (error) {
                console.error('Error deleting borrowing record:', error);
                showModal('Error', 'Failed to delete borrowing record. Please try again.');
            }
        }
    );
}

/**
 * Filter books table
 */
function filterBooksTable() {
    const searchTerm = document.getElementById('bookSearch').value.toLowerCase();
    const rows = document.querySelectorAll('#recentBooksTable tr');
    rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(searchTerm) ? '' : 'none';
    });
}

/**
 * Filter all books table
 */
function filterAllBooksTable() {
    const searchTerm = document.getElementById('allBooksSearch').value.toLowerCase();
    const rows = document.querySelectorAll('#allBooksTable tr');
    rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(searchTerm) ? '' : 'none';
    });
}

/**
 * Filter members table based on search term
 * @param {string} searchTerm - The search term to filter by
 */
function filterMembers(searchTerm) {
    const tableBody = document.getElementById('membersTable');
    if (!tableBody) return;
    
    const rows = tableBody.querySelectorAll('tr');
    
    rows.forEach(row => {
        const cells = row.querySelectorAll('td');
        let match = false;
        
        // Check each cell for the search term
        for (let cell of cells) {
            if (cell.textContent.toLowerCase().includes(searchTerm)) {
                match = true;
                break;
            }
        }
        
        // Show/hide row based on match
        row.style.display = match ? '' : 'none';
    });
}

/**
 * Filter borrowing records table based on search term
 * @param {string} searchTerm - The search term to filter by
 */
function filterBorrowingRecords(searchTerm) {
    const tableBody = document.getElementById('allBorrowingRecordsTable');
    if (!tableBody) return;
    
    const rows = tableBody.querySelectorAll('tr');
    
    rows.forEach(row => {
        const cells = row.querySelectorAll('td');
        let match = false;
        
        // Check each cell for the search term
        for (let cell of cells) {
            if (cell.textContent.toLowerCase().includes(searchTerm)) {
                match = true;
                break;
            }
        }
        
        // Show/hide row based on match
        row.style.display = match ? '' : 'none';
    });
}

// =============================================
// DATA LOADING FUNCTIONS (Additional)
// =============================================

/**
 * Load members data
 */
async function loadMembersData() {
    try {
        const response = await fetch(`${API_BASE_URL}/members.php?action=getAll`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            populateMembersTable(data.members);
        }
    } catch (error) {
        console.error('Error loading members:', error);
    }
}

/**
 * Load borrowing data
 */
async function loadBorrowingData() {
    try {
        // Check if user is logged in
        if (!authToken) {
            console.log('No auth token found, redirecting to login');
            showLoginForm();
            return;
        }
        
        const response = await fetch(`${API_BASE_URL}/borrowing.php?action=getAll`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        // Handle 401 Unauthorized
        if (response.status === 401) {
            console.log('Authentication failed, redirecting to login');
            sessionStorage.clear();
            showLoginForm();
            return;
        }
        
        const data = await response.json();
        
        if (data.success) {
            populateAllBorrowingTable(data.records);
        }
    } catch (error) {
        console.error('Error loading borrowing records:', error);
        // If there's a network error, show login form
        showLoginForm();
    }
}

/**
 * Load categories data
 */
async function loadCategoriesData() {
    console.log('loadCategoriesData called');
    console.log('authToken:', authToken ? 'present' : 'missing');
    
    try {
        const response = await fetch(`${API_BASE_URL}/categories.php?action=getAll`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        console.log('Categories API response status:', response.status);
        const data = await response.json();
        console.log('Categories API response data:', data);
        
        if (data.success) {
            populateCategoriesTable(data.categories);
            
            // Update category counts in cards
            console.log('Calling updateCategoryCounts with:', data.categories);
            updateCategoryCounts(data.categories);

            // Load and display dynamic category cards
            const gridContainer = document.querySelector('#categories .dashboard-grid');
            if (gridContainer) {
                gridContainer.innerHTML = '';
                const iconMap = {
                    'Herbology': '🌿',
                    'Phytochemistry': '🧪',
                    'Ethnobotany': '🌍',
                    'Traditional Medicine': '🏥',
                    'Pharmacology': '💊',
                    'Research': '🔬',
                    'Clinical Studies': '📋',
                    'Toxicology': '☢️'
                };
                
                data.categories.forEach(cat => {
                    const icon = iconMap[cat.name] || '📚';
                    const card = document.createElement('div');
                    card.className = 'stat-card';
                    card.innerHTML = `
                        <div class="stat-icon">${icon}</div>
                        <div class="stat-label">${cat.name}</div>
                        <div class="stat-value">${cat.book_count || 0}</div>
                        <div style="font-size: 12px; color: #666; margin-top: 8px; text-align: center;">${cat.description || 'Category'}</div>
                    `;
                    gridContainer.appendChild(card);
                });
            }
        }
    } catch (error) {
        console.error('Error loading categories:', error);
    }
}

/**
 * Load reports data with optional month parameter
 */
async function loadReportsData(month = null) {
    try {
        console.log('loadReportsData called with month:', month);
        
        // Build URL with optional month parameter
        const monthParam = month ? `&month=${month}` : '';
        
        // Load monthly report data
        const reportResponse = await fetch(`${API_BASE_URL}/reports.php?action=monthly${monthParam}`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        const reportData = await reportResponse.json();
        console.log('Monthly report data:', reportData);

        // Load monthly trends data
        const trendsResponse = await fetch(`${API_BASE_URL}/reports.php?action=monthly_trends${monthParam}`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        const trendsData = await trendsResponse.json();
        console.log('Monthly trends data:', trendsData);

        if (reportData.success) {
            // Combine report and trends data, including top books
            const combinedData = {
                ...reportData.report,
                top_books: reportData.top_books,  // Include top books data for the chart
                top_members: reportData.top_members
            };
            
            if (trendsData.success && trendsData.borrowingTrends) {
                combinedData.borrowingTrends = trendsData.borrowingTrends;
            }
            
            console.log('Combined data:', combinedData);
            updateReportData(combinedData);
        }
    } catch (error) {
        console.error('Error loading reports:', error);
    }
}

/**
 * Load profile data
 */
async function loadProfileData() {
    try {
        console.log('loadProfileData called, currentUser:', currentUser);
        
        // Populate profile fields with currentUser data
        if (currentUser) {
            console.log('Populating profile with user data:', currentUser);
            
            // Set profile information with extra debugging
            console.log('Updating profile UI elements...');
            
            // Format dates properly with fallbacks
            const createdAtRaw = currentUser.created_at || '2024-01-15';
            const createdAt = new Date(createdAtRaw).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
            
            const lastLoginRaw = currentUser.last_login || new Date().toISOString();
            const lastLogin = new Date(lastLoginRaw).toLocaleString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
            
            // Determine real status based on user data
            let userStatus = 'Active';
            if (currentUser.status === 'Inactive' || currentUser.status === 'Suspended') {
                userStatus = currentUser.status;
            }
            
            const elementsToUpdate = {
                'profileName': currentUser.name || 'N/A',
                'profileRole': currentUser.role || 'N/A',
                'profileUsername': currentUser.username || 'N/A',
                'profileEmail': currentUser.email || 'N/A',
                'profileRealName': currentUser.name || 'N/A',
                'profilePhone': currentUser.phone || '-',
                'profileInstitution': currentUser.institution || '-',
                'profileDepartment': currentUser.department || '-',
                'profileProgram': currentUser.program || '-',
                'profileIdNumber': currentUser.id_number || '-',
                'profileIdType': currentUser.id_type || '-',
                'profileStatus': userStatus,
                'profileCreatedAt': createdAt,
                'profileLastLogin': lastLogin
            };
            
            for (const [elementId, value] of Object.entries(elementsToUpdate)) {
                const element = document.getElementById(elementId);
                if (element) {
                    element.textContent = value;
                    console.log(`Updated ${elementId} with value: ${value}`);
                } else {
                    console.error(`Element with ID ${elementId} not found!`);
                }
            }
            
            // Update profile avatar
            const profileAvatar = document.getElementById('profileAvatar');
            if (profileAvatar) {
                if (currentUser.profile_picture) {
                    profileAvatar.src = `images/profile_pictures/${currentUser.profile_picture}?t=${new Date().getTime()}`;
                } else {
                    profileAvatar.src = 'images/profile-pictures/profile.jpeg?t=' + new Date().getTime();
                }
                profileAvatar.onerror = function() {
                    this.src = 'images/profile-pictures/profile.jpeg?t=' + new Date().getTime();
                    this.onerror = null;
                };
                console.log('Profile avatar updated');
            } else {
                console.error('Profile avatar element not found!');
            }
            
            // Add event listeners for profile buttons
            const editProfileBtn = document.getElementById('editProfileBtn');
            const changePasswordBtn = document.getElementById('changePasswordBtn');
            const changePictureBtn = document.getElementById('changePictureBtn');
            
                editProfileBtn.onclick = function() {
                    // Create edit profile form HTML with all fields
                    const editProfileHTML = 
                        '<form id="editProfileForm" style="max-height: 500px; overflow-y: auto; padding-right: 10px;">' +
                        '    <h4 style="color: var(--primary-green); margin-bottom: 15px;">Basic Information</h4>' +
                        '    <div class="form-group">' +
                        '        <label for="editProfileName">Full Name *</label>' +
                        '        <input type="text" id="editProfileName" name="name" value="' + (currentUser.name || '') + '" required>' +
                        '    </div>' +
                        '    <div class="form-group">' +
                        '        <label for="editProfileEmail">Email *</label>' +
                        '        <input type="email" id="editProfileEmail" name="email" value="' + (currentUser.email || '') + '" required>' +
                        '    </div>' +
                        '    <div class="form-group">' +
                        '        <label for="editProfileUsername">Username *</label>' +
                        '        <input type="text" id="editProfileUsername" name="username" value="' + (currentUser.username || '') + '" required>' +
                        '    </div>' +
                        '    <h4 style="color: var(--primary-green); margin-top: 20px; margin-bottom: 15px;">Additional Information (Optional)</h4>' +
                        '    <div class="form-group">' +
                        '        <label for="editProfilePhone">Phone Number</label>' +
                        '        <input type="tel" id="editProfilePhone" name="phone" value="' + (currentUser.phone || '') + '" placeholder="e.g., +233 123 456 7890">' +
                        '    </div>' +
                        '    <div class="form-group">' +
                        '        <label for="editProfileInstitution">Institution</label>' +
                        '        <input type="text" id="editProfileInstitution" name="institution" value="' + (currentUser.institution || '') + '" placeholder="e.g., University of Ghana">' +
                        '    </div>' +
                        '    <div class="form-group">' +
                        '        <label for="editProfileDepartment">Department</label>' +
                        '        <input type="text" id="editProfileDepartment" name="department" value="' + (currentUser.department || '') + '" placeholder="e.g., Computer Science">' +
                        '    </div>' +
                        '    <div class="form-group">' +
                        '        <label for="editProfileProgram">Program/Course</label>' +
                        '        <input type="text" id="editProfileProgram" name="program" value="' + (currentUser.program || '') + '" placeholder="e.g., Bachelor of Science">' +
                        '    </div>' +
                        '    <div class="form-group">' +
                        '        <label for="editProfileIdNumber">ID Number</label>' +
                        '        <input type="text" id="editProfileIdNumber" name="id_number" value="' + (currentUser.id_number || '') + '" placeholder="e.g., 10345678">' +
                        '    </div>' +
                        '    <div class="form-group">' +
                        '        <label for="editProfileIdType">ID Type</label>' +
                        '        <select id="editProfileIdType" name="id_type">' +
                        '            <option value="">Select ID Type</option>' +
                        '            <option value="Student ID" ' + (currentUser.id_type === 'Student ID' ? 'selected' : '') + '>Student ID</option>' +
                        '            <option value="Staff ID" ' + (currentUser.id_type === 'Staff ID' ? 'selected' : '') + '>Staff ID</option>' +
                        '            <option value="National ID" ' + (currentUser.id_type === 'National ID' ? 'selected' : '') + '>National ID</option>' +
                        '            <option value="Passport" ' + (currentUser.id_type === 'Passport' ? 'selected' : '') + '>Passport</option>' +
                        '            <option value="Driver\'s License" ' + (currentUser.id_type === 'Driver\'s License' ? 'selected' : '') + '>Driver\'s License</option>' +
                        '        </select>' +
                        '    </div>' +
                        '</form>';
                    
                    showModal('Edit Profile', editProfileHTML, true, async function() {
                        const form = document.getElementById('editProfileForm');
                        const name = document.getElementById('editProfileName').value;
                        const email = document.getElementById('editProfileEmail').value;
                        const username = document.getElementById('editProfileUsername').value;
                        const phone = document.getElementById('editProfilePhone').value;
                        const institution = document.getElementById('editProfileInstitution').value;
                        const department = document.getElementById('editProfileDepartment').value;
                        const program = document.getElementById('editProfileProgram').value;
                        const idNumber = document.getElementById('editProfileIdNumber').value;
                        const idType = document.getElementById('editProfileIdType').value;
                        
                        const profileData = {
                            name: name,
                            email: email,
                            username: username,
                            phone: phone || null,
                            institution: institution || null,
                            department: department || null,
                            program: program || null,
                            id_number: idNumber || null,
                            id_type: idType || null
                        };
                        
                        try {
                            const response = await fetch(API_BASE_URL + '/users.php', {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                    'Authorization': 'Bearer ' + authToken
                                },
                                body: JSON.stringify({
                                    action: 'update_profile',
                                    ...profileData
                                })
                            });
                            
                            const result = await response.json();
                            
                            if (result.success) {
                                // Update the current user object with all fields
                                for (let key in profileData) {
                                    currentUser[key] = profileData[key];
                                }
                                
                                // Update the profile display
                                await loadProfileData();
                                
                                showModal('Success', '<p>✅ Profile updated successfully!</p>', false);
                            } else {
                                throw new Error(result.message || 'Failed to update profile');
                            }
                        } catch (error) {
                            console.error('Error updating profile:', error);
                            showModal('Error', '<p>❌ Error updating profile:<br>' + error.message + '</p>', false);
                        }
                    }, 'Save Changes');
                };
            
            if (changePasswordBtn) {
                changePasswordBtn.onclick = function() {
                    // Create change password form HTML with password toggle buttons
                    const changePasswordHTML = 
                        '<form id="changePasswordForm">' +
                        '    <div class="form-group">' +
                        '        <label for="currentPassword">Current Password</label>' +
                        '        <div class="password-input-wrapper">' +
                        '            <input type="password" id="currentPassword" name="currentPassword" required>' +
                        '            <button type="button" class="password-toggle" onclick="togglePasswordVisibility(\'currentPassword\')" title="Show/Hide Password">' +
                        '                <span class="eye-icon">👁️‍🗨️</span>' +
                        '            </button>' +
                        '        </div>' +
                        '    </div>' +
                        '    <div class="form-group">' +
                        '        <label for="changeNewPassword">New Password</label>' +
                        '        <div class="password-input-wrapper">' +
                        '            <input type="password" id="changeNewPassword" name="changeNewPassword" required>' +
                        '            <button type="button" class="password-toggle" onclick="togglePasswordVisibility(\'changeNewPassword\')" title="Show/Hide Password">' +
                            '                <span class="eye-icon">👁️‍🗨️</span>' +
                        '            </button>' +
                        '        </div>' +
                        '    </div>' +
                        '    <div class="form-group">' +
                        '        <label for="confirmNewPassword">Confirm New Password</label>' +
                        '        <div class="password-input-wrapper">' +
                        '            <input type="password" id="confirmNewPassword" name="confirmNewPassword" required>' +
                        '            <button type="button" class="password-toggle" onclick="togglePasswordVisibility(\'confirmNewPassword\')" title="Show/Hide Password">' +
                            '                <span class="eye-icon">👁️‍🗨️</span>' +
                        '            </button>' +
                        '        </div>' +
                        '    </div>' +
                        '</form>';
                    
                    showModal('Change Password', changePasswordHTML, true, async function() {
                        const currentPassword = document.getElementById('currentPassword').value;
                        const newPassword = document.getElementById('changeNewPassword').value;
                        const confirmNewPassword = document.getElementById('confirmNewPassword').value;
                        
                        // Validate passwords match
                        if (newPassword !== confirmNewPassword) {
                            showModal('Error', '<p>New passwords do not match!</p>', false);
                            return;
                        }
                        
                        // Validate password strength (at least 6 characters)
                        if (newPassword.length < 6) {
                            showModal('Error', '<p>Password must be at least 6 characters long!</p>', false);
                            return;
                        }
                        
                        try {
                            const response = await fetch(API_BASE_URL + '/users.php', {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                    'Authorization': 'Bearer ' + authToken
                                },
                                body: JSON.stringify({
                                    action: 'change_password',
                                    current_password: currentPassword,
                                    new_password: newPassword
                                })
                            });
                            
                            const result = await response.json();
                            
                            if (result.success) {
                                showModal('Success', '<p>Password changed successfully! You will be logged out for security.</p>', false);
                                
                                // Wait a moment then log the user out
                                setTimeout(() => {
                                    // Trigger logout
                                    const logoutBtn = document.getElementById('logoutBtn');
                                    if (logoutBtn) {
                                        logoutBtn.click();
                                    }
                                }, 2000);
                            } else {
                                throw new Error(result.message || 'Failed to change password');
                            }
                        } catch (error) {
                            console.error('Error changing password:', error);
                            showModal('Error', '<p>Error changing password:<br>' + error.message + '</p>', false);
                        }
                    }, 'Change Password');
                };
            }
            
            if (changePictureBtn) {
                changePictureBtn.onclick = function() {
                    document.getElementById('profilePictureInput').click();
                };
            }
        } else {
            console.error('currentUser is null or undefined');
            // Set default values if currentUser is not available
            const elements = ['profileName', 'profileRole', 'profileUsername', 'profileEmail', 
                            'profileRealName', 'profileStatus', 'profileCreatedAt', 'profileLastLogin'];
            elements.forEach(id => {
                const element = document.getElementById(id);
                if (element) element.textContent = 'Loading...';
            });
        }
    } catch (error) {
        console.error('Error loading profile data:', error);
    }
}

/**
 * Populate members table
 * @param {Array} members - Array of member objects
 */
function populateMembersTable(members) {
    const tableBody = document.getElementById('membersTable');
    if (!tableBody) return;
    
    tableBody.innerHTML = '';
    
    if (members && members.length > 0) {
        members.forEach(member => {
            // Check if user is admin or librarian to determine if action buttons should be shown
            const showActionButtons = currentUser && (currentUser.role === 'Admin' || currentUser.role === 'Librarian');
            
            // Check if this member is an admin (protected from deletion)
            const isAdminUser = member.role && member.role.toLowerCase() === 'admin';
            const canDelete = showActionButtons && !isAdminUser; // Admins cannot be deleted
            const canEdit = showActionButtons; // Edit is still allowed
            
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${member.member_id || member.id}</td>
                <td>${member.name}</td>
                <td>${member.email}</td>
                <td>${member.phone || 'N/A'}</td>
                <td>${member.membership_type || member.type}</td>
                <td>${member.join_date || member.created_at}</td>
                <td><span class="badge ${member.status === 'Active' ? 'badge-available' : 'badge-borrowed'}">${member.status}</span></td>
                <td>
                    <div class="action-buttons-cell">
                        <button class="action-btn view-btn" data-id="${member.member_id || member.id}">View</button>
                        ${canEdit ? `<button class="action-btn edit-btn" data-id="${member.member_id || member.id}">Edit</button>` : ''}
                        ${canDelete ? `<button class="action-btn delete-btn" data-id="${member.member_id || member.id}">Delete</button>` : ''}
                        ${isAdminUser ? '<span style="color: #ff9800; font-size: 11px; font-weight: bold;">🔒 PROTECTED</span>' : ''}
                    </div>
                </td>
            `;
            
            const viewBtn = row.querySelector('.view-btn');
            
            if (viewBtn) {
                viewBtn.addEventListener('click', () => viewMemberDetails(member.member_id || member.id));
            }
            
            // Only add event listeners for edit and delete if buttons exist and user is not staff
            if (showActionButtons) {
                const editBtn = row.querySelector('.edit-btn:not(.view-btn)');
                const deleteBtn = row.querySelector('.delete-btn');
                
                if (editBtn) {
                    editBtn.addEventListener('click', () => editMember(member.member_id || member.id));
                }
                if (deleteBtn) {
                    deleteBtn.addEventListener('click', () => deleteMember(member.member_id || member.id));
                }
            }
            
            tableBody.appendChild(row);
        });
    } else {
        tableBody.innerHTML = `
            <tr>
                <td colspan="8" style="text-align: center; padding: 40px; color: #666;">
                    No members found.
                </td>
            </tr>
        `;
    }
}

/**
 * Populate all borrowing table
 * @param {Array} records - Array of borrowing records
 */
function populateAllBorrowingTable(records) {
    const tableBody = document.getElementById('allBorrowingTable');
    if (!tableBody) return;
    
    tableBody.innerHTML = '';
    
    if (records && records.length > 0) {
        records.forEach(record => {
            const row = createBorrowingRow(record, true);
            tableBody.appendChild(row);
        });
    } else {
        tableBody.innerHTML = `
            <tr>
                <td colspan="8" style="text-align: center; padding: 40px; color: #666;">
                    No borrowing records found.
                </td>
            </tr>
        `;
    }
}

/**
 * Populate categories table
 * @param {Array} categories - Array of category objects
 */
function populateCategoriesTable(categories) {
    const tableBody = document.getElementById('categoriesTable');
    if (!tableBody) return;
    
    tableBody.innerHTML = '';
    
    if (categories && categories.length > 0) {
        categories.forEach(category => {
            const row = document.createElement('tr');
            // Check if user is admin or librarian to determine if action buttons should be shown
            const showActionButtons = currentUser && (currentUser.role === 'Admin' || currentUser.role === 'Librarian');
            
            row.innerHTML = `
                <td>${category.category_id || category.id}</td>
                <td>${category.name}</td>
                <td>${category.description || 'No description'}</td>
                <td>${category.book_count || 0}</td>
                <td>
                    <div class="action-buttons-cell">
                        <button class="action-btn view-btn" data-id="${category.category_id || category.id}">View Books</button>
                        ${showActionButtons ? `<button class="action-btn edit-btn" data-id="${category.category_id || category.id}">Edit</button>` : ''}
                        ${showActionButtons ? `<button class="action-btn delete-btn" data-id="${category.category_id || category.id}">Delete</button>` : ''}
                    </div>
                </td>
            `;
            
            const viewBtn = row.querySelector('.view-btn');
            
            if (viewBtn) {
                viewBtn.addEventListener('click', () => viewCategoryBooks(category.category_id || category.id));
            }
            
            // Only add event listeners for edit and delete if buttons exist and user is admin/librarian
            if (showActionButtons) {
                const editBtn = row.querySelector('.edit-btn');
                const deleteBtn = row.querySelector('.delete-btn');
                
                if (editBtn) {
                    editBtn.addEventListener('click', () => editCategory(category.category_id || category.id));
                }
                if (deleteBtn) {
                    deleteBtn.addEventListener('click', () => deleteCategory(category.category_id || category.id));
                }
            }
            
            tableBody.appendChild(row);
        });
    } else {
        tableBody.innerHTML = `
            <tr>
                <td colspan="5" style="text-align: center; padding: 40px; color: #666;">
                    No categories found.
                </td>
            </tr>
        `;
    }
}

/**
 * Update category counts in dashboard cards
 * @param {Array} categories - Array of category objects
 */
function updateCategoryCounts(categories) {
    console.log('updateCategoryCounts called with:', categories);
    
    if (!categories || !Array.isArray(categories)) {
        console.log('No valid categories array provided');
        return;
    }
    
    // More flexible matching - case insensitive and partial matching with safety checks
    const herbology = categories.find(c => 
        c.name && c.name.toLowerCase().includes('herbology') || 
        c.name && c.name.toLowerCase() === 'herbology'
    );
    const phytochemistry = categories.find(c => 
        c.name && c.name.toLowerCase().includes('phytochemistry') || 
        c.name && c.name.toLowerCase() === 'phytochemistry'
    );
    const ethnobotany = categories.find(c => 
        c.name && c.name.toLowerCase().includes('ethnobotany') || 
        c.name && c.name.toLowerCase() === 'ethnobotany'
    );
    const tradMed = categories.find(c => 
        c.name && c.name.toLowerCase().includes('traditional medicine') || 
        c.name && c.name.toLowerCase().includes('traditional') ||
        c.name && c.name.toLowerCase() === 'traditional medicine'
    );
    
    console.log('Found categories:', { herbology, phytochemistry, ethnobotany, tradMed });
    
    // Update the category count elements in the Categories section
    const herbologyElement = document.getElementById('herbologyCount');
    const phytochemistryElement = document.getElementById('phytochemistryCount');
    const ethnobotanyElement = document.getElementById('ethnobotanyCount');
    const tradMedElement = document.getElementById('tradMedCount');
    
    console.log('Elements found:', { herbologyElement, phytochemistryElement, ethnobotanyElement, tradMedElement });
    
    if (herbologyElement && herbology) {
        console.log('Updating herbology count to:', herbology.book_count || 0);
        herbologyElement.textContent = herbology.book_count || 0;
    }
    if (phytochemistryElement && phytochemistry) {
        console.log('Updating phytochemistry count to:', phytochemistry.book_count || 0);
        phytochemistryElement.textContent = phytochemistry.book_count || 0;
    }
    if (ethnobotanyElement && ethnobotany) {
        console.log('Updating ethnobotany count to:', ethnobotany.book_count || 0);
        ethnobotanyElement.textContent = ethnobotany.book_count || 0;
    }
    if (tradMedElement && tradMed) {
        console.log('Updating traditional medicine count to:', tradMed.book_count || 0);
        tradMedElement.textContent = tradMed.book_count || 0;
    }
    
    // Also update any category counts in the Dashboard section if they exist
    const dashboardHerbology = document.getElementById('dashboardHerbologyCount');
    const dashboardPhytochemistry = document.getElementById('dashboardPhytochemistryCount');
    const dashboardEthnobotany = document.getElementById('dashboardEthnobotanyCount');
    const dashboardTradMed = document.getElementById('dashboardTradMedCount');
    
    if (dashboardHerbology && herbology) {
        dashboardHerbology.textContent = herbology.book_count || 0;
    }
    if (dashboardPhytochemistry && phytochemistry) {
        dashboardPhytochemistry.textContent = phytochemistry.book_count || 0;
    }
    if (dashboardEthnobotany && ethnobotany) {
        dashboardEthnobotany.textContent = ethnobotany.book_count || 0;
    }
    if (dashboardTradMed && tradMed) {
        dashboardTradMed.textContent = tradMed.book_count || 0;
    }
}

/**
 * Update report data
 * @param {Object} report - Report data object
 */
function updateReportData(report) {
    if (!report) return;
    
    console.log('updateReportData called with report:', report);
    
    document.getElementById('monthlyBorrowings').textContent = report.monthly_borrowings || 0;
    document.getElementById('overdueRate').textContent = report.overdue_rate || '0%';
    document.getElementById('mostBorrowedCategory').textContent = report.most_borrowed_category || '-';
    document.getElementById('newMembersMonth').textContent = report.new_members_month || 0;
    
    // Update charts with the report data
    console.log('Calling updateCharts with report data');
    updateCharts(report);
}

// Global chart instances
let borrowingTrendsChart = null;
let popularBooksChart = null;

/**
 * Show comprehensive monthly report summary
 */
function showMonthlyReportSummary(reportData, reportMonth) {
    if (!reportData || !reportData.report) {
        showModal('Error', 'Invalid report data.');
        return;
    }
    
    const report = reportData.report;
    const topBooks = reportData.top_books || [];
    const topMembers = reportData.top_members || [];
    
    // Parse month for formatting
    const monthDate = new Date(reportMonth + '-01');
    const monthName = monthDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    const reportDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    
    // Calculate additional metrics
    const totalTransactions = (report.monthly_borrowings || 0) + (report.monthly_returns || 0);
    const availableBooks = report.total_books || 0;
    const totalPhysicalCopies = report.total_physical_copies || 0;
    const totalMembers = report.total_members || 0;
    const overdueLiterature = report.overdue_books || 0;
    const circulationRate = availableBooks > 0 ? ((report.monthly_borrowings || 0) / availableBooks * 100).toFixed(1) : 0;
    const memberEngagement = totalMembers > 0 ? ((report.monthly_borrowings || 0) / totalMembers).toFixed(1) : 0;
    
    // Format category breakdown table
    let categoryBreakdownHTML = '<div style="overflow-x: auto;"><table style="width: 100%; border-collapse: collapse; font-size: 12px;">';
    categoryBreakdownHTML += '<thead><tr style="background: var(--light-green); color: white;"><th style="padding: 10px; text-align: left;">Category</th><th style="padding: 10px;">Borrows</th><th style="padding: 10px;">Unique Books</th></tr></thead><tbody>';
    if (report.category_breakdown && report.category_breakdown.length > 0) {
        report.category_breakdown.forEach((cat, index) => {
            const bgColor = index % 2 === 0 ? '#f9f9f9' : '#ffffff';
            categoryBreakdownHTML += `<tr style="background: ${bgColor};">
                <td style="padding: 10px; border-bottom: 1px solid #ddd;">${cat.category_name}</td>
                <td style="padding: 10px; text-align: center; border-bottom: 1px solid #ddd;">${cat.borrow_count}</td>
                <td style="padding: 10px; text-align: center; border-bottom: 1px solid #ddd;">${cat.unique_books_borrowed || 0}</td>
            </tr>`;
        });
    } else {
        categoryBreakdownHTML += '<tr><td colspan="3" style="padding: 10px; text-align: center; color: #999;">No data available</td></tr>';
    }
    categoryBreakdownHTML += '</tbody></table></div>';
    
    // Format member type distribution
    let memberTypeHTML = '<div style="overflow-x: auto;"><table style="width: 100%; border-collapse: collapse; font-size: 12px;">';
    memberTypeHTML += '<thead><tr style="background: #2196F3; color: white;"><th style="padding: 10px; text-align: left;">Membership Type</th><th style="padding: 10px;">Active Members</th><th style="padding: 10px;">Borrows</th></tr></thead><tbody>';
    if (report.member_type_distribution && report.member_type_distribution.length > 0) {
        report.member_type_distribution.forEach((type, index) => {
            const bgColor = index % 2 === 0 ? '#f9f9f9' : '#ffffff';
            memberTypeHTML += `<tr style="background: ${bgColor};">
                <td style="padding: 10px; border-bottom: 1px solid #ddd;">${type.membership_type || 'N/A'}</td>
                <td style="padding: 10px; text-align: center; border-bottom: 1px solid #ddd;">${type.active_members || 0}</td>
                <td style="padding: 10px; text-align: center; border-bottom: 1px solid #ddd;">${type.borrow_count || 0}</td>
            </tr>`;
        });
    } else {
        memberTypeHTML += '<tr><td colspan="3" style="padding: 10px; text-align: center; color: #999;">No data available</td></tr>';
    }
    memberTypeHTML += '</tbody></table></div>';
    
    // Format user role statistics
    let userRoleHTML = '<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 10px;">';
    if (report.user_role_stats && report.user_role_stats.length > 0) {
        report.user_role_stats.forEach(role => {
            userRoleHTML += `<div style="background: #f5f5f5; padding: 12px; border-radius: 6px; text-align: center; border-left: 3px solid var(--light-green);">
                <div style="font-size: 20px; font-weight: 700; color: var(--light-green);">${role.count}</div>
                <div style="font-size: 11px; color: #666; text-transform: uppercase; margin-top: 4px;">${role.role}</div>
            </div>`;
        });
    } else {
        userRoleHTML += '<p style="color: #999; font-size: 12px;">No user role data available</p>';
    }
    userRoleHTML += '</div>';
    
    // Format top books list
    let topBooksHTML = '<ul style="margin: 10px 0; padding-left: 20px;">';
    if (topBooks.length === 0) {
        topBooksHTML += '<li style="color: #999; font-size: 13px;">No data available</li>';
    } else {
        topBooks.slice(0, 5).forEach((book, index) => {
            topBooksHTML += `<li style="margin: 8px 0; font-size: 13px;">
                <span style="display: inline-block; width: 25px; font-weight: 700;">${index + 1}.</span>
                <strong>${book.title}</strong><br/>
                <span style="font-size: 12px; color: #666; margin-left: 25px;">by ${book.author} | ${book.borrow_count} borrows</span>
            </li>`;
        });
    }
    topBooksHTML += '</ul>';
    
    // Format top members list
    let topMembersHTML = '<ul style="margin: 10px 0; padding-left: 20px;">';
    if (topMembers.length === 0) {
        topMembersHTML += '<li style="color: #999; font-size: 13px;">No data available</li>';
    } else {
        topMembers.slice(0, 5).forEach((member, index) => {
            topMembersHTML += `<li style="margin: 8px 0; font-size: 13px;">
                <span style="display: inline-block; width: 25px; font-weight: 700;">${index + 1}.</span>
                <strong>${member.name}</strong> - ${member.borrow_count} books | <span style="color: #999;">${member.membership_type || 'Member'}</span>
            </li>`;
        });
    }
    topMembersHTML += '</ul>';
    
    const reportSummaryHTML = `
        <div style="padding: 25px; max-height: 700px; overflow-y: auto; font-family: 'Segoe UI', Arial, sans-serif;">
            <!-- Official Header -->
            <div style="text-align: center; border-bottom: 3px solid var(--light-green); padding-bottom: 20px; margin-bottom: 25px;">
                <div style="font-size: 28px; margin-bottom: 8px; font-weight: 700; color: var(--light-green);">CPMR LIBRARY</div>
                <div style="font-size: 13px; color: #666; margin-bottom: 15px; letter-spacing: 0.5px;">Centre for Plant Medicine Research</div>
                <h2 style="margin: 10px 0; color: #1a1a1a; font-size: 18px;">COMPREHENSIVE MONTHLY OPERATIONS REPORT</h2>
                <p style="margin: 10px 0 5px 0; color: #666; font-size: 14px;"><strong>Report Period:</strong> ${monthName}</p>
                <p style="margin: 0; color: #999; font-size: 12px;"><strong>Generated:</strong> ${reportDate}</p>
            </div>
            
            <!-- Executive Summary Section -->
            <div style="background: linear-gradient(135deg, #e8f5e9 0%, #f1f8f6 100%); padding: 18px; border-radius: 8px; margin-bottom: 24px; border-left: 5px solid var(--light-green);">
                <h3 style="margin: 0 0 12px 0; color: var(--light-green); font-size: 13px; text-transform: uppercase; letter-spacing: 1px;">📋 EXECUTIVE SUMMARY</h3>
                <p style="margin: 0; color: #2e7d32; font-size: 13px; line-height: 1.6;">
                    This month, the library processed <strong>${totalTransactions} transactions</strong> involving borrowing and returns. 
                    The collection engagement rate reached <strong>${circulationRate}%</strong>, with an average of <strong>${memberEngagement} books per member</strong>. 
                    The library continues to serve <strong>${totalMembers} active members</strong> with a comprehensive collection of <strong>${availableBooks} unique titles</strong> (${totalPhysicalCopies} total copies).
                </p>
            </div>
            
            <!-- Key Performance Indicators -->
            <div style="margin-bottom: 24px;">
                <h3 style="margin: 0 0 14px 0; color: var(--light-green); font-size: 13px; text-transform: uppercase; letter-spacing: 1px;">📊 KEY PERFORMANCE INDICATORS (KPI)</h3>
                <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px;">
                    <div style="background: linear-gradient(135deg, var(--light-green) 0%, #4CAF50 100%); color: white; padding: 16px; border-radius: 6px; text-align: center;">
                        <div style="font-size: 28px; font-weight: 700; margin-bottom: 6px;">${report.monthly_borrowings || 0}</div>
                        <div style="font-size: 11px; opacity: 0.95; text-transform: uppercase; letter-spacing: 0.5px;">Books Borrowed</div>
                    </div>
                    <div style="background: linear-gradient(135deg, #2196F3 0%, #1976D2 100%); color: white; padding: 16px; border-radius: 6px; text-align: center;">
                        <div style="font-size: 28px; font-weight: 700; margin-bottom: 6px;">${report.monthly_returns || 0}</div>
                        <div style="font-size: 11px; opacity: 0.95; text-transform: uppercase; letter-spacing: 0.5px;">Books Returned</div>
                    </div>
                    <div style="background: linear-gradient(135deg, #FF9800 0%, #F57C00 100%); color: white; padding: 16px; border-radius: 6px; text-align: center;">
                        <div style="font-size: 28px; font-weight: 700; margin-bottom: 6px;">${overdueLiterature}</div>
                        <div style="font-size: 11px; opacity: 0.95; text-transform: uppercase; letter-spacing: 0.5px;">Overdue Books</div>
                    </div>
                    <div style="background: linear-gradient(135deg, #E91E63 0%, #C2185B 100%); color: white; padding: 16px; border-radius: 6px; text-align: center;">
                        <div style="font-size: 28px; font-weight: 700; margin-bottom: 6px;">₵${(report.fines_collected || 0).toFixed(2)}</div>
                        <div style="font-size: 11px; opacity: 0.95; text-transform: uppercase; letter-spacing: 0.5px;">Fines Collected</div>
                    </div>
                    <div style="background: linear-gradient(135deg, #607D8B 0%, #455A64 100%); color: white; padding: 16px; border-radius: 6px; text-align: center;">
                        <div style="font-size: 28px; font-weight: 700; margin-bottom: 6px;">₵${(report.outstanding_fines || 0).toFixed(2)}</div>
                        <div style="font-size: 11px; opacity: 0.95; text-transform: uppercase; letter-spacing: 0.5px;">Outstanding Fines</div>
                    </div>
                    <div style="background: linear-gradient(135deg, #9C27B0 0%, #7B1FA2 100%); color: white; padding: 16px; border-radius: 6px; text-align: center;">
                        <div style="font-size: 28px; font-weight: 700; margin-bottom: 6px;">${report.new_members_month || 0}</div>
                        <div style="font-size: 11px; opacity: 0.95; text-transform: uppercase; letter-spacing: 0.5px;">New Members</div>
                    </div>
                </div>
            </div>
            
            <!-- Operational Statistics Section -->
            <div style="margin-bottom: 24px;">
                <h3 style="margin: 0 0 14px 0; color: var(--light-green); font-size: 13px; text-transform: uppercase; letter-spacing: 1px;">📈 OPERATIONAL STATISTICS</h3>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px;">
                    <div style="background: #f9f9f9; padding: 14px; border-radius: 6px; border-left: 4px solid var(--light-green);">
                        <div style="font-size: 11px; color: #999; text-transform: uppercase; margin-bottom: 6px; letter-spacing: 0.5px;">Total Transactions</div>
                        <div style="font-size: 20px; font-weight: 700; color: var(--light-green);">${totalTransactions}</div>
                    </div>
                    <div style="background: #f9f9f9; padding: 14px; border-radius: 6px; border-left: 4px solid #FF9800;">
                        <div style="font-size: 11px; color: #999; text-transform: uppercase; margin-bottom: 6px; letter-spacing: 0.5px;">Overdue Rate</div>
                        <div style="font-size: 20px; font-weight: 700; color: #FF9800;">${report.overdue_rate || '0%'}</div>
                    </div>
                    <div style="background: #f9f9f9; padding: 14px; border-radius: 6px; border-left: 4px solid #2196F3;">
                        <div style="font-size: 11px; color: #999; text-transform: uppercase; margin-bottom: 6px; letter-spacing: 0.5px;">Collection Circulation Rate</div>
                        <div style="font-size: 20px; font-weight: 700; color: #2196F3;">${circulationRate}%</div>
                    </div>
                    <div style="background: #f9f9f9; padding: 14px; border-radius: 6px; border-left: 4px solid #9C27B0;">
                        <div style="font-size: 11px; color: #999; text-transform: uppercase; margin-bottom: 6px; letter-spacing: 0.5px;">Member Engagement</div>
                        <div style="font-size: 20px; font-weight: 700; color: #9C27B0;">${memberEngagement}</div>
                    </div>
                </div>
            </div>
            
            <!-- Collection Overview -->
            <div style="margin-bottom: 24px;">
                <h3 style="margin: 0 0 12px 0; color: var(--light-green); font-size: 13px; text-transform: uppercase; letter-spacing: 1px;">📚 COLLECTION OVERVIEW</h3>
                <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px;">
                    <div style="background: #f5f5f5; padding: 14px; border-radius: 6px; text-align: center; border-left: 4px solid var(--light-green);">
                        <div style="font-size: 24px; font-weight: 700; color: var(--light-green);">${availableBooks}</div>
                        <div style="font-size: 11px; color: #666; text-transform: uppercase; margin-top: 4px;">Unique Titles</div>
                    </div>
                    <div style="background: #f5f5f5; padding: 14px; border-radius: 6px; text-align: center; border-left: 4px solid #2196F3;">
                        <div style="font-size: 24px; font-weight: 700; color: #2196F3;">${totalPhysicalCopies}</div>
                        <div style="font-size: 11px; color: #666; text-transform: uppercase; margin-top: 4px;">Total Copies</div>
                    </div>
                    <div style="background: #f5f5f5; padding: 14px; border-radius: 6px; text-align: center; border-left: 4px solid #9C27B0;">
                        <div style="font-size: 24px; font-weight: 700; color: #9C27B0;">${report.new_books_month || 0}</div>
                        <div style="font-size: 11px; color: #666; text-transform: uppercase; margin-top: 4px;">New Books Added</div>
                    </div>
                </div>
            </div>
            
            <!-- Top Borrowed Category -->
            <div style="margin-bottom: 24px;">
                <h3 style="margin: 0 0 12px 0; color: var(--light-green); font-size: 13px; text-transform: uppercase; letter-spacing: 1px;">🏆 TOP PERFORMING CATEGORY</h3>
                <div style="background: linear-gradient(135deg, #fff3e0 0%, #ffe0b2 100%); padding: 16px; border-radius: 6px; border-left: 5px solid #FF9800;">
                    <div style="font-size: 14px; font-weight: 700; color: #E65100; margin-bottom: 6px;">${report.most_borrowed_category || 'Not Available'}</div>
                    <div style="font-size: 12px; color: #666;">This category demonstrated the highest circulation this month</div>
                </div>
            </div>
            
            <!-- Category Breakdown -->
            <div style="margin-bottom: 24px;">
                <h3 style="margin: 0 0 12px 0; color: var(--light-green); font-size: 13px; text-transform: uppercase; letter-spacing: 1px;">📊 CATEGORY BREAKDOWN</h3>
                <div style="background: #f5f5f5; padding: 16px; border-radius: 6px; border-left: 4px solid var(--light-green);">
                    ${categoryBreakdownHTML}
                </div>
            </div>
            
            <!-- Member Type Distribution -->
            <div style="margin-bottom: 24px;">
                <h3 style="margin: 0 0 12px 0; color: var(--light-green); font-size: 13px; text-transform: uppercase; letter-spacing: 1px;">👥 MEMBER TYPE DISTRIBUTION</h3>
                <div style="background: #f5f5f5; padding: 16px; border-radius: 6px; border-left: 4px solid #2196F3;">
                    ${memberTypeHTML}
                </div>
            </div>
            
            <!-- System Users -->
            <div style="margin-bottom: 24px;">
                <h3 style="margin: 0 0 12px 0; color: var(--light-green); font-size: 13px; text-transform: uppercase; letter-spacing: 1px;">💻 SYSTEM USERS BY ROLE</h3>
                <div style="background: #f5f5f5; padding: 16px; border-radius: 6px; border-left: 4px solid #9C27B0;">
                    ${userRoleHTML}
                </div>
            </div>
            
            <!-- Top 5 Most Borrowed Books -->
            <div style="margin-bottom: 24px;">
                <h3 style="margin: 0 0 12px 0; color: var(--light-green); font-size: 13px; text-transform: uppercase; letter-spacing: 1px;">📚 TOP 5 MOST BORROWED LITERATURE</h3>
                <div style="background: #f5f5f5; padding: 16px; border-radius: 6px; border-left: 4px solid var(--light-green);">
                    ${topBooksHTML}
                </div>
            </div>
            
            <!-- Top 5 Active Members -->
            <div style="margin-bottom: 24px;">
                <h3 style="margin: 0 0 12px 0; color: var(--light-green); font-size: 13px; text-transform: uppercase; letter-spacing: 1px;">👥 TOP 5 ACTIVE MEMBERS</h3>
                <div style="background: #f5f5f5; padding: 16px; border-radius: 6px; border-left: 4px solid var(--light-green);">
                    ${topMembersHTML}
                </div>
            </div>
            
            <!-- Additional Insights Section -->
            <div style="margin-bottom: 24px;">
                <h3 style="margin: 0 0 12px 0; color: var(--light-green); font-size: 13px; text-transform: uppercase; letter-spacing: 1px;">💡 INSIGHTS & OBSERVATIONS</h3>
                <div style="background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%); padding: 14px; border-radius: 6px; border-left: 4px solid #2196F3;">
                    <ul style="margin: 0; padding-left: 20px;">
                        <li style="margin: 8px 0; font-size: 12px; color: #1565C0;"><strong>Collection Health:</strong> ${circulationRate}% circulation rate indicates ${parseFloat(circulationRate) > 30 ? 'strong' : 'moderate'} collection usage</li>
                        <li style="margin: 8px 0; font-size: 12px; color: #1565C0;"><strong>Member Compliance:</strong> ${report.overdue_rate || '0%'} overdue rate shows ${parseFloat(report.overdue_rate || 0) < 5 ? 'excellent' : 'good'} member responsibility</li>
                        <li style="margin: 8px 0; font-size: 12px; color: #1565C0;"><strong>Growth Trend:</strong> ${report.new_members_month || 0} new members added, expanding the user base</li>
                        ${report.journal_stats ? `<li style="margin: 8px 0; font-size: 12px; color: #1565C0;"><strong>Digital Resources:</strong> ${report.journal_stats.total_journals || 0} journals available in the system</li>` : ''}
                        ${report.policy_stats ? `<li style="margin: 8px 0; font-size: 12px; color: #1565C0;"><strong>Policy Documents:</strong> ${report.policy_stats.total_policies || 0} policies documented</li>` : ''}
                    </ul>
                </div>
            </div>
            
            <!-- Official Footer -->
            <div style="border-top: 2px solid #ddd; padding-top: 18px; margin-top: 20px; text-align: center; background: #f9f9f9; padding: 18px; margin-left: -25px; margin-right: -25px; margin-bottom: -25px; border-radius: 0 0 8px 8px;">
                <p style="margin: 6px 0; font-size: 12px; color: #666;">
                    <strong>Report Status:</strong> <span style="color: var(--light-green); font-weight: 700;">✓ COMPLETED</span>
                </p>
                <p style="margin: 6px 0; font-size: 12px; color: #666;">
                    This comprehensive report was automatically generated by the CPMR Library Management System
                </p>
                <p style="margin: 6px 0; font-size: 11px; color: #999;">
                    For questions or additional analysis, please contact the Library Administration
                </p>
                <p style="margin: 10px 0 0 0; font-size: 11px; color: #999; border-top: 1px solid #ddd; padding-top: 10px;">
                    © CPMR Library System | Confidential
                </p>
            </div>
        </div>
    `;
    
    showModal('Official Monthly Report - ' + monthName, reportSummaryHTML);
}

/**
 * Show admin password confirmation modal
 * @param {string} callbackFunction - Function to call after successful password verification
 * @param {Object} params - Parameters to pass to the callback function
 */
function showAdminPasswordConfirmation(callbackFunction, params) {
    const passwordModalHTML = `
        <div style="padding: 20px;">
            <div style="font-size: 24px; color: #dc3545; margin-bottom: 15px; text-align: center;">⚠️</div>
            <h3 style="text-align: center; margin-bottom: 20px; color: #333;">Admin Authentication Required</h3>
            <p style="text-align: center; color: #666; margin-bottom: 20px;">
                This is a sensitive operation. Please enter the admin password to proceed.
            </p>
            <div class="form-group" style="margin-bottom: 20px;">
                <label for="adminPassword" style="display: block; margin-bottom: 8px; font-weight: 600; color: var(--primary-green);">Admin Password</label>
                <input type="password" id="adminPassword" name="adminPassword" 
                       placeholder="Enter admin password" 
                       style="width: 100%; padding: 12px 15px; border: 1px solid var(--border-color); 
                              border-radius: 6px; font-size: 16px; transition: border-color 0.3s ease;" 
                       autocomplete="new-password" autocapitalize="off" autocorrect="off" spellcheck="false">
            </div>
        </div>
    `;
    
    showModal('Admin Authentication', passwordModalHTML, true, async () => {
        const passwordInput = document.getElementById('adminPassword');
        const password = passwordInput ? passwordInput.value.trim() : '';
        
        if (!password) {
            showModal('Error', 'Please enter the admin password.');
            return;
        }
        
        // Verify admin password by attempting a login with the entered credentials
        try {
            // Get the current username to attempt login with the new password
            // FIX: Use sessionStorage instead of localStorage to match where user data is stored
            const currentUserRaw = sessionStorage.getItem('currentUser') || sessionStorage.getItem('user');
            let currentUser;
            try {
                currentUser = JSON.parse(currentUserRaw || '{}');
            } catch (e) {
                console.error('Failed to parse user from sessionStorage');
                showModal('Error', 'Session data corrupted. Please log in again.');
                return;
            }
            
            const username = currentUser.username || 'admin';
            
            console.log('=== SHOW ADMIN PASSWORD CONFIRMATION ===');
            console.log('Username for verification:', username);
            console.log('User role:', currentUser.role);
            
            const response = await fetch(`${API_BASE_URL}/login.php`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, password })
            });
            
            const data = await response.json();
            
            if (data.success && data.token) {
                // Password verified, proceed with the sensitive operation
                // Temporarily store the token if needed for the operation
                window[callbackFunction](params);
            } else {
                showModal('Authentication Failed', 'Invalid admin password. Access denied.');
            }
        } catch (error) {
            console.error('Error verifying admin password:', error);
            showModal('Error', 'Failed to verify admin password. Please try again.');
        }
    });
    
    // Add additional security measures after modal is shown
    setTimeout(() => {
        const passwordInput = document.getElementById('adminPassword');
        if (passwordInput) {
            // Prevent copying password to other fields
            passwordInput.addEventListener('paste', function(e) {
                e.preventDefault();
                return false;
            });
            
            // Prevent drag and drop
            passwordInput.addEventListener('drop', function(e) {
                e.preventDefault();
                return false;
            });
            
            // Clear any existing values and set focus
            passwordInput.value = '';
            passwordInput.focus();
            
            // NOTE: Aggressive autocomplete interference code removed
            // The following code was clearing other fields if they matched the password,
            // which was interfering with normal form input
            /*
            // Prevent autocomplete from other fields
            passwordInput.addEventListener('input', function() {
                // Ensure no other input fields receive this value
                const allInputs = document.querySelectorAll('input[type="text"], input[type="search"]');
                allInputs.forEach(input => {
                    if (input !== passwordInput && input.value === passwordInput.value) {
                        input.value = '';
                    }
                });
            });
            
            // Additional protection: monitor all input fields
            const observer = new MutationObserver(function(mutations) {
                mutations.forEach(function(mutation) {
                    if (mutation.type === 'attributes' && mutation.attributeName === 'value') {
                        const target = mutation.target;
                        if (target.type === 'text' || target.type === 'search') {
                            if (target.value === passwordInput.value && target !== passwordInput) {
                                target.value = '';
                            }
                        }
                    }
                });
            });
            
            // Observe all input fields
            document.querySelectorAll('input').forEach(input => {
                observer.observe(input, { attributes: true });
            });
            */
        }
    }, 100);
}

/**
 * Edit admin user
 */
async function editAdminUser() {
    // Show admin password confirmation before proceeding
        // Show warning confirmation modal before proceeding with admin edit
        const warningModalHTML = `
            <div style="padding: 20px; text-align: center;">
                <div style="font-size: 48px; color: #ff9800; margin-bottom: 15px;">⚠️</div>
                <h3 style="margin-bottom: 15px; color: #333;">Confirm Admin Edit</h3>
                <p style="color: #666; margin-bottom: 20px; line-height: 1.5;">
                    You are about to edit admin account settings.<br>
                    <strong>Are you sure you want to proceed?</strong>
                </p>
                <div style="background-color: #fff3cd; border: 1px solid #ffeaa7; border-radius: 6px; padding: 12px; margin: 15px 0; text-align: left;">
                    <strong>Note:</strong> This will allow you to modify administrator account details.
                </div>
            </div>
        `;
        
        showModal('Edit Admin Confirmation', warningModalHTML, true, () => {
            editAdminUserConfirmed({});
        });
}

/**
 * Confirmed edit admin user function after admin password validation
 */
async function editAdminUserConfirmed(params) {
    const editUserHTML = `
        <form id="editUserForm">
            <div class="form-group">
                <label for="editUsername">Username *</label>
                <input type="text" id="editUsername" name="username" value="admin" required readonly>
            </div>
            <div class="form-group">
                <label for="editUserRole">Role *</label>
                <select id="editUserRole" name="role" required>
                    <option value="Administrator" selected>Administrator</option>
                    <option value="Librarian">Librarian</option>
                </select>
            </div>
            <div class="form-group">
                <label for="editUserEmail">Email</label>
                <input type="email" id="editUserEmail" name="email" value="admin@cpmr.edu.gh">
            </div>
            <div class="form-group">
                <label for="editUserStatus">Status</label>
                <select id="editUserStatus" name="status">
                    <option value="Active" selected>Active</option>
                    <option value="Inactive">Inactive</option>
                </select>
            </div>
        </form>
    `;
    
    showModal('Edit Admin User', editUserHTML, true, async () => {
        const form = document.getElementById('editUserForm');
        const formData = new FormData(form);
        const userData = Object.fromEntries(formData.entries());
        
        try {
            // For demo purposes, just show success message
            // In a real implementation, this would update the user in the database
            showModal('Success', 'Admin user updated successfully!');
            
            // Update the display
            const roleCell = document.querySelector('td:nth-child(2)');
            const statusCell = document.querySelector('td:nth-child(4)');
            
            if (roleCell) roleCell.textContent = userData.role;
            if (statusCell) {
                statusCell.innerHTML = `<span class="badge ${userData.status === 'Active' ? 'badge-available' : 'badge-borrowed'}">${userData.status}</span>`;
            }
            
        } catch (error) {
            console.error('Error updating admin user:', error);
            showModal('Error', 'Failed to update admin user. Please try again.');
        }
    });
}

/**
 * Reset admin password
 */
async function resetAdminPassword() {
    // Show admin password confirmation before proceeding
        // Show warning confirmation modal before proceeding with password reset
        const warningModalHTML = `
            <div style="padding: 20px; text-align: center;">
                <div style="font-size: 48px; color: #f44336; margin-bottom: 15px;">⚠️</div>
                <h3 style="margin-bottom: 15px; color: #333;">Confirm Password Reset</h3>
                <p style="color: #666; margin-bottom: 20px; line-height: 1.5;">
                    You are about to reset the admin password.<br>
                    <strong>This action affects system security!</strong>
                </p>
                <div style="background-color: #f8d7da; border: 1px solid #f5c6cb; border-radius: 6px; padding: 12px; margin: 15px 0; text-align: left;">
                    <strong>Warning:</strong> After resetting, you will need to remember the new password. This action cannot be undone.
                </div>
            </div>
        `;
        
        showModal('Reset Admin Password Confirmation', warningModalHTML, true, () => {
            resetAdminPasswordConfirmed({});
        });
}

/**
 * Confirmed reset admin password function after admin password validation
 */
async function resetAdminPasswordConfirmed(params) {
    const resetPasswordHTML = `
        <form id="resetPasswordForm">
            <div class="form-group">
                <label for="newPassword">New Password *</label>
                <input type="password" id="newPassword" name="newPassword" required minlength="6">
            </div>
            <div class="form-group">
                <label for="confirmPassword">Confirm Password *</label>
                <input type="password" id="confirmPassword" name="confirmPassword" required minlength="6">
            </div>
        </form>
    `;
    
    showModal('Reset Admin Password', resetPasswordHTML, true, async () => {
        const form = document.getElementById('resetPasswordForm');
        const newPassword = form.newPassword.value;
        const confirmPassword = form.confirmPassword.value;
        
        if (newPassword !== confirmPassword) {
            showModal('Error', 'Passwords do not match.');
            return;
        }
        
        if (newPassword.length < 6) {
            showModal('Error', 'Password must be at least 6 characters long.');
            return;
        }
        
        try {
            // Hash the new password
            const hashedPassword = await hashPassword(newPassword);
            
            // Update password in database (this would be a real API call in production)
            // For demo purposes, we'll just show success
            showModal('Success', `
                <div style="text-align: center; padding: 20px;">
                    <div style="font-size: 48px; color: var(--primary-green); margin-bottom: 20px;">✓</div>
                    <h3>Password Reset Successfully!</h3>
                    <p><strong>New Password:</strong> ${newPassword}</p>
                    <p><small>Please store this password securely.</small></p>
                </div>
            `);
            
        } catch (error) {
            console.error('Error resetting password:', error);
            showModal('Error', 'Failed to reset password. Please try again.');
        }
    });
}

/**
 * Hash password using bcrypt (simulated)
 * @param {string} password - Plain text password
 * @returns {string} - Hashed password
 */
async function hashPassword(password) {
    // In a real implementation, this would use bcrypt or similar
    // For demo purposes, we'll create a simple hash-like string
    return btoa(password + new Date().getTime());
}

/**
 * Initialize charts for the reports section
 */
function initializeCharts() {
    console.log('initializeCharts called');
    
    // Destroy existing charts if they exist
    if (borrowingTrendsChart) {
        console.log('Destroying existing borrowingTrendsChart');
        borrowingTrendsChart.destroy();
        borrowingTrendsChart = null;
    }
    
    if (popularBooksChart) {
        console.log('Destroying existing popularBooksChart');
        popularBooksChart.destroy();
        popularBooksChart = null;
    }
    
    // Create borrowing trends chart (showing both borrowed and returned for all 12 months)
    const borrowingCtx = document.getElementById('borrowingTrendsChart');
    console.log('borrowingCtx element:', borrowingCtx);
    
    if (borrowingCtx) {
        borrowingTrendsChart = new Chart(borrowingCtx, {
            type: 'line',
            data: {
                labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
                datasets: [{
                    label: 'Borrowed',
                    data: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], // Initialize with zeros, will be updated with real data
                    borderColor: '#28a745',
                    backgroundColor: 'rgba(40, 167, 69, 0.1)',
                    tension: 0.4,
                    fill: false,
                    pointRadius: 3,
                    pointHoverRadius: 5,
                    pointBackgroundColor: '#28a745',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 1,
                    borderWidth: 2,
                    borderCapStyle: 'round',
                    borderJoinStyle: 'round'
                }, {
                    label: 'Returned',
                    data: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], // Initialize with zeros, will be updated with real data
                    borderColor: '#007bff',
                    backgroundColor: 'rgba(0, 123, 255, 0.1)',
                    tension: 0.4,
                    fill: false,
                    pointRadius: 3,
                    pointHoverRadius: 5,
                    pointBackgroundColor: '#007bff',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 1,
                    borderWidth: 2,
                    borderCapStyle: 'round',
                    borderJoinStyle: 'round'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                aspectRatio: 4,
                layout: {
                    padding: 10
                },
                plugins: {
                    legend: {
                        display: true,
                        position: 'bottom',
                        labels: {
                            font: {
                                size: 10
                            },
                            usePointStyle: true,
                            pointStyle: 'circle',
                            boxWidth: 8,
                            padding: 15
                        }
                    },
                    title: {
                        display: false
                    },
                    tooltip: {
                        enabled: true,
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        titleFont: {
                            size: 11
                        },
                        bodyFont: {
                            size: 10
                        },
                        padding: 8,
                        callbacks: {
                            label: function(context) {
                                const monthIndex = context.dataIndex;
                                const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                                const monthName = monthNames[monthIndex] || '';
                                return monthName + ': ' + context.dataset.label + ' ' + context.parsed.y + ' books';
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        display: true,
                        grid: {
                            display: false
                        },
                        ticks: {
                            display: false
                        },
                        border: {
                            display: false
                        }
                    },
                    x: {
                        display: true,
                        grid: {
                            display: false
                        },
                        ticks: {
                            display: true,
                            font: {
                                size: 8
                            }
                        },
                        border: {
                            display: false
                        }
                    }
                },
                interaction: {
                    mode: 'index',
                    intersect: false
                },
                animation: {
                    duration: 700,
                    easing: 'easeOutQuart'
                }
            }
        });
        
        console.log('borrowingTrendsChart created:', borrowingTrendsChart);
    } else {
        console.log('borrowingTrendsChart element not found');
    }

    // Create popular books chart (with book names)
    const popularCtx = document.getElementById('popularBooksChart');
    console.log('popularCtx element:', popularCtx);
    
    if (popularCtx) {
        popularBooksChart = new Chart(popularCtx, {
            type: 'bar',
            data: {
                labels: ['Book 1', 'Book 2', 'Book 3', 'Book 4', 'Book 5'],
                datasets: [{
                    label: 'Times Borrowed',
                    data: [45, 38, 32, 28, 22],
                    backgroundColor: [
                        'rgba(40, 167, 69, 0.8)',
                        'rgba(0, 123, 255, 0.8)',
                        'rgba(255, 193, 7, 0.8)',
                        'rgba(220, 53, 69, 0.8)',
                        'rgba(108, 117, 125, 0.8)'
                    ],
                    borderColor: [
                        '#28a745',
                        '#007bff',
                        '#ffc107',
                        '#dc3545',
                        '#6c757d'
                    ],
                    borderWidth: 1,
                    borderRadius: 3,
                    borderSkipped: false,
                    barPercentage: 0.8,
                    categoryPercentage: 0.9
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                aspectRatio: 3,
                indexAxis: 'y', // Horizontal bar chart
                layout: {
                    padding: 5
                },
                plugins: {
                    legend: {
                        display: false
                    },
                    title: {
                        display: false
                    },
                    tooltip: {
                        enabled: true,
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        titleFont: {
                            size: 10
                        },
                        bodyFont: {
                            size: 9
                        },
                        padding: 6,
                        callbacks: {
                            label: function(context) {
                                return context.dataset.label + ': ' + context.parsed.x + ' times';
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        display: true,
                        grid: {
                            display: false
                        },
                        ticks: {
                            display: true,
                            font: {
                                size: 8
                            }
                        },
                        border: {
                            display: false
                        }
                    },
                    y: {
                        display: true,
                        grid: {
                            display: false
                        },
                        ticks: {
                            display: true,
                            font: {
                                size: 9
                            }
                        },
                        border: {
                            display: false
                        }
                    }
                },
                animation: {
                    duration: 700,
                    easing: 'easeOutQuart'
                }
            }
        });
        
        console.log('popularBooksChart created:', popularBooksChart);
    } else {
        console.log('popularBooksChart element not found');
    }
}

/**
 * Update charts with new data
 * @param {Object} data - Chart data
 */
function updateCharts(data) {
    console.log('updateCharts called with data:', data);
    
    // Update borrowing trends chart with real data from monthly trends API
    if (borrowingTrendsChart && data.borrowingTrends) {
        console.log('Using borrowingTrends format:', data.borrowingTrends);
        
        // Ensure we have 12 months of data (Jan to Dec)
        const allMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        
        // Initialize arrays with zeros for all 12 months
        const borrowedData = new Array(12).fill(0);
        const returnedData = new Array(12).fill(0);
        
        // If the API returns data with specific months, use it
        if (data.borrowingTrends.borrowed && data.borrowingTrends.labels) {
            // Map the returned data to the correct month indices
            data.borrowingTrends.labels.forEach((monthLabel, index) => {
                const monthIndex = allMonths.indexOf(monthLabel);
                if (monthIndex !== -1 && data.borrowingTrends.borrowed[index] !== undefined) {
                    borrowedData[monthIndex] = data.borrowingTrends.borrowed[index];
                }
            });
        }
        
        if (data.borrowingTrends.returned && data.borrowingTrends.labels) {
            // Map the returned data to the correct month indices
            data.borrowingTrends.labels.forEach((monthLabel, index) => {
                const monthIndex = allMonths.indexOf(monthLabel);
                if (monthIndex !== -1 && data.borrowingTrends.returned[index] !== undefined) {
                    returnedData[monthIndex] = data.borrowingTrends.returned[index];
                }
            });
        }
        
        // Update chart data
        borrowingTrendsChart.data.datasets[0].data = borrowedData;
        borrowingTrendsChart.data.datasets[1].data = returnedData;
        
        // Always use all 12 months as labels
        borrowingTrendsChart.data.labels = allMonths;
        
        // Update chart with animation
        borrowingTrendsChart.update('active');
    } else if (borrowingTrendsChart && data.borrowed && data.returned) {
        console.log('Updating borrowing trends chart with borrowed:', data.borrowed);
        console.log('Updating borrowing trends chart with returned:', data.returned);
        
        // Ensure we have 12 months of data
        const allMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        
        // Initialize arrays with zeros for all 12 months
        const borrowedData = new Array(12).fill(0);
        const returnedData = new Array(12).fill(0);
        
        // Copy the provided data
        if (Array.isArray(data.borrowed)) {
            for (let i = 0; i < Math.min(data.borrowed.length, 12); i++) {
                borrowedData[i] = data.borrowed[i];
            }
        }
        
        if (Array.isArray(data.returned)) {
            for (let i = 0; i < Math.min(data.returned.length, 12); i++) {
                returnedData[i] = data.returned[i];
            }
        }
        
        // Update chart data
        borrowingTrendsChart.data.datasets[0].data = borrowedData;
        borrowingTrendsChart.data.datasets[1].data = returnedData;
        
        // Always use all 12 months as labels
        borrowingTrendsChart.data.labels = allMonths;
        
        // Update chart with animation
        borrowingTrendsChart.update('active');
        
        console.log('Chart updated successfully');
    } else {
        console.log('Borrowing trends chart not updated - missing data or chart instance');
        console.log('borrowingTrendsChart:', borrowingTrendsChart);
        console.log('data.borrowed:', data.borrowed);
        console.log('data.returned:', data.returned);
        console.log('data.borrowingTrends:', data.borrowingTrends);
    }
    
    // Update popular books chart with real data from reports
    if (popularBooksChart && data.top_books) {
        // Extract labels and data from top_books
        const labels = data.top_books.map(book => book.title || book.name || 'Unknown Book');
        const borrowCounts = data.top_books.map(book => book.borrow_count || book.count || 0);
        
        // Update chart with real data
        popularBooksChart.data.labels = labels;
        popularBooksChart.data.datasets[0].data = borrowCounts;
        
        // Update colors dynamically based on number of books
        const backgroundColors = [
            'rgba(40, 167, 69, 0.8)',    // Green for most popular
            'rgba(0, 123, 255, 0.8)',    // Blue
            'rgba(255, 193, 7, 0.8)',    // Yellow
            'rgba(220, 53, 69, 0.8)',    // Red
            'rgba(108, 117, 125, 0.8)'   // Gray
        ];
        
        const borderColors = [
            'rgba(40, 167, 69, 1)',
            'rgba(0, 123, 255, 1)',
            'rgba(255, 193, 7, 1)',
            'rgba(220, 53, 69, 1)',
            'rgba(108, 117, 125, 1)'
        ];
        
        // Assign colors based on actual number of books
        popularBooksChart.data.datasets[0].backgroundColor = [];
        popularBooksChart.data.datasets[0].borderColor = [];
        
        for (let i = 0; i < labels.length; i++) {
            popularBooksChart.data.datasets[0].backgroundColor.push(backgroundColors[i % backgroundColors.length]);
            popularBooksChart.data.datasets[0].borderColor.push(borderColors[i % borderColors.length]);
        }
        
        popularBooksChart.update();
    }
}


/**
 * View member details
 * @param {string|number} memberId - Member ID
 */
async function viewMemberDetails(memberId) {
    try {
        const response = await fetch(`${API_BASE_URL}/members.php?action=getDetails&id=${memberId}`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            const member = data.member;
            const details = `
                <div style="padding: 10px;">
                    <h4 style="color: var(--primary-green); margin-bottom: 15px;">${member.name}</h4>
                    <p><strong>Member ID:</strong> ${member.member_id || member.id}</p>
                    <p><strong>Email:</strong> ${member.email}</p>
                    <p><strong>Phone:</strong> ${member.phone || 'N/A'}</p>
                    <p><strong>Membership Type:</strong> ${member.membership_type || member.type}</p>
                    <p><strong>Join Date:</strong> ${member.join_date || member.created_at}</p>
                    <p><strong>Status:</strong> ${member.status}</p>
                    ${member.department ? `<p><strong>Department:</strong> ${member.department}</p>` : ''}
                    ${member.staff_id ? `<p><strong>Staff/Student ID:</strong> ${member.staff_id}</p>` : ''}
                    ${member.address ? `<p><strong>Address:</strong> ${member.address}</p>` : ''}
                </div>
            `;
            showModal('Member Details', details);
        }
    } catch (error) {
        console.error('Error loading member details:', error);
        showModal('Error', 'Failed to load member details.');
    }
}

/**
 * Edit member (placeholder)
 * @param {string|number} memberId - Member ID
 */
/**
 * Edit member
 * @param {string|number} memberId - Member ID
 */
async function editMember(memberId) {
    // Check if user is Admin or Librarian - ROBUST CHECK
    // NOTE: User data is stored in sessionStorage, not localStorage!
    const currentUserRaw = sessionStorage.getItem('currentUser') || sessionStorage.getItem('user');
    console.log('=== EDIT MEMBER - SESSION STORAGE CHECK ===');
    console.log('SessionStorage currentUser:', currentUserRaw);
    
    let currentUser;
    try {
        currentUser = JSON.parse(currentUserRaw || '{}');
    } catch (e) {
        console.error('Failed to parse currentUser from sessionStorage:', e);
        showModal('Error', 'Session data corrupted. Please log in again.');
        sessionStorage.removeItem('currentUser');
        sessionStorage.removeItem('user');
        return;
    }
    
    console.log('Parsed user object:', currentUser);
    console.log('User properties:', Object.keys(currentUser));
    console.log('User role raw value:', currentUser.role);
    console.log('User role type:', typeof currentUser.role);
    
    // ROBUST role check - handle all edge cases
    let userRole = '';
    if (currentUser.role) {
        // Trim whitespace and convert to lowercase
        userRole = String(currentUser.role).trim().toLowerCase();
    }
    
    console.log('Normalized role:', userRole);
    console.log('Is "admin"?', userRole === 'admin');
    console.log('Is "librarian"?', userRole === 'librarian');
    
    // Check multiple possible role representations
    const isAdmin = userRole === 'admin' || userRole === 'Admin' || userRole === 'ADMIN';
    const isLibrarian = userRole === 'librarian' || userRole === 'Librarian' || userRole === 'LIBRARIAN';
    
    if (!isAdmin && !isLibrarian) {
        console.error('❌ ACCESS DENIED: Role check failed');
        console.error('Expected: "admin" or "librarian"');
        console.error('Got:', JSON.stringify(userRole));
        
        // Show helpful error with debugging info
        const errorMsg = `Access Denied - Role Check Failed\n\n` +
            `Your role: "${currentUser.role}"\n` +
            `Normalized: "${userRole}"\n\n` +
            `Please contact administrator or check console for details.`;
        
        showModal('Access Denied', errorMsg);
        return;
    }
    
    console.log('✅ Role check PASSED - User is', isAdmin ? 'ADMIN' : 'LIBRARIAN');
    
    // Check if already verified in this session (within 5 minutes)
    let verified = isCriticalActionValid();
    
    if (!verified) {
        // Require password verification first
        console.log('Password verification required for edit member...');
        verified = await verifyUserPassword('edit_member');
        
        if (!verified) {
            console.error('❌ VERIFICATION FAILED - BLOCKING EDIT MEMBER');
            return;
        }
        
        console.log('✅ Verification successful - proceeding with edit');
    } else {
        console.log('✅ Already verified for critical action - proceeding');
    }
    
    // Show warning confirmation modal before proceeding with edit
    const warningModalHTML = `
        <div style="padding: 20px; text-align: center;">
            <div style="font-size: 48px; color: #ff9800; margin-bottom: 15px;">⚠️</div>
            <h3 style="margin-bottom: 15px; color: #333;">Confirm Edit Member</h3>
            <p style="color: #666; margin-bottom: 20px; line-height: 1.5;">
                You are about to edit a member record. This will allow you to modify the member details.<br>
                <strong>Are you sure you want to proceed?</strong>
            </p>
            <div style="background-color: #fff3cd; border: 1px solid #ffeaa7; border-radius: 6px; padding: 12px; margin: 15px 0; text-align: left;">
                <strong>Note:</strong> Only edit member information if you need to update their details.
            </div>
        </div>
    `;
    
    showModal('Edit Member Confirmation', warningModalHTML, true, () => {
        editMemberConfirmed({ memberId });
        // Clear verification after successful edit
        clearCriticalActionVerification();
    });
}

/**
 * Confirmed edit member function after admin password validation
 */
async function editMemberConfirmed(params) {
    const { memberId } = params;
    try {
        // Fetch member details
        const response = await fetch(`${API_BASE_URL}/members.php?action=getDetails&id=${memberId}`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            const member = data.member;
            
            const editMemberHTML = `
                <form id="editMemberForm">
                    <div class="form-group">
                        <label for="editMemberName">Full Name *</label>
                        <input type="text" id="editMemberName" name="name" value="${member.name || ''}" required>
                    </div>
                    <div class="form-group">
                        <label for="editMemberEmail">Email *</label>
                        <input type="email" id="editMemberEmail" name="email" value="${member.email || ''}" required>
                    </div>
                    <div class="form-group">
                        <label for="editMemberPhone">Phone</label>
                        <input type="tel" id="editMemberPhone" name="phone" value="${member.phone || ''}">
                    </div>
                    <div class="form-group">
                        <label for="editMemberType">Membership Type *</label>
                        <select id="editMemberType" name="membership_type" required>
                            <option value="">Select Membership Type</option>
                            <option value="Staff" ${member.membership_type === 'Staff' ? 'selected' : ''}>Staff</option>
                            <option value="Student" ${member.membership_type === 'Student' ? 'selected' : ''}>Student</option>
                            <option value="Other" ${member.membership_type === 'Other' ? 'selected' : ''}>Other</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="editMemberDepartment">Department</label>
                        <input type="text" id="editMemberDepartment" name="department" value="${member.department || ''}">
                    </div>
                    <div class="form-group">
                        <label for="editMemberStaffId">Staff ID</label>
                        <input type="text" id="editMemberStaffId" name="staff_id" value="${member.staff_id || ''}">
                    </div>
                    <div class="form-group">
                        <label for="editMemberAddress">Address</label>
                        <textarea id="editMemberAddress" name="address" rows="2">${member.address || ''}</textarea>
                    </div>
                    <div class="form-group">
                        <label for="editMemberStatus">Status</label>
                        <select id="editMemberStatus" name="status">
                            <option value="Active" ${member.status === 'Active' ? 'selected' : ''}>Active</option>
                            <option value="Inactive" ${member.status === 'Inactive' ? 'selected' : ''}>Inactive</option>
                            <option value="Suspended" ${member.status === 'Suspended' ? 'selected' : ''}>Suspended</option>
                        </select>
                    </div>
                </form>
            `;
            
            showModal('Edit Member', editMemberHTML, true, async () => {
                const form = document.getElementById('editMemberForm');
                const formData = new FormData(form);
                const memberData = Object.fromEntries(formData.entries());
                
                // Prepare data for API
                memberData.member_id = memberId;
                
                try {
                    const response = await fetch(`${API_BASE_URL}/members.php?action=update&id=${memberId}`, {
                        method: 'PUT',
                        headers: {
                            'Authorization': `Bearer ${authToken}`,
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify(memberData)
                    });
                    
                    const result = await response.json();
                    
                    if (result.success) {
                        showModal('Success', 'Member updated successfully!');
                        
                        // Find and update the specific row in the members table if it exists
                        setTimeout(async () => {
                            const allRows = document.querySelectorAll('#membersTable tr');
                            for (let row of allRows) {
                                const viewBtn = row.querySelector('.view-btn');
                                const editBtn = row.querySelector('.edit-btn');
                                const existingMemberId = viewBtn?.dataset.id || editBtn?.dataset.id;
                                
                                if (existingMemberId == memberId) {  // Using == for type coercion
                                    // Get fresh member data from the API to update the row visually
                                    try {
                                        const response = await fetch(`${API_BASE_URL}/members.php?action=getDetails&id=${memberId}`, {
                                            headers: {
                                                'Authorization': `Bearer ${authToken}`
                                            }
                                        });
                                        
                                        const data = await response.json();
                                        
                                        if (data.success) {
                                            const member = data.member;
                                            
                                            // Update the row cells with fresh data
                                            const cells = row.cells;
                                            if (cells.length >= 8) {  // Make sure we have enough cells
                                                cells[1].textContent = member.name;  // Name column
                                                cells[2].textContent = member.email; // Email column
                                                cells[3].textContent = member.phone || 'N/A'; // Phone column
                                                cells[4].textContent = member.membership_type || member.type;  // Membership Type column
                                                
                                                // Update status badge
                                                let statusBadge;
                                                switch(member.status) {
                                                    case 'Active': 
                                                        statusBadge = '<span class="badge badge-available">Active</span>'; 
                                                        break;
                                                    case 'Inactive': 
                                                        statusBadge = '<span class="badge badge-borrowed">Inactive</span>'; 
                                                        break;
                                                    case 'Suspended': 
                                                        statusBadge = '<span class="badge badge-reserved">Suspended</span>'; 
                                                        break;
                                                    default: 
                                                        statusBadge = `<span class="badge">${member.status}</span>`;
                                                }
                                                cells[6].innerHTML = statusBadge; // Status column
                                            }
                                        }
                                    } catch (error) {
                                        console.error('Error updating member row after edit:', error);
                                    }
                                    break; // Found and updated the row, exit loop
                                }
                            }
                        }, 300); // Delay to ensure modal closes and DOM is stable
                        
                        // Also reload members data to ensure everything stays in sync
                        await loadMembersData();
                        await loadDashboardData();
                    } else {
                        showModal('Error', result.message || 'Failed to update member.');
                    }
                } catch (error) {
                    console.error('Error updating member:', error);
                    showModal('Error', 'Failed to update member. Please try again.');
                }
            });
        } else {
            showModal('Error', data.message || 'Failed to load member details.');
        }
    } catch (error) {
        console.error('Error loading member details:', error);
        showModal('Error', 'Failed to load member details. Please try again.');
    }
}

/**
 * Delete member
 * @param {string|number} memberId - Member ID
 */
async function deleteMember(memberId) {
    // Check if user is Admin or Librarian - ROBUST CHECK
    // NOTE: User data is stored in sessionStorage, not localStorage!
    const currentUserRaw = sessionStorage.getItem('currentUser') || sessionStorage.getItem('user');
    console.log('=== DELETE MEMBER - SESSION STORAGE CHECK ===');
    console.log('SessionStorage currentUser:', currentUserRaw);
    
    let currentUser;
    try {
        currentUser = JSON.parse(currentUserRaw || '{}');
    } catch (e) {
        console.error('Failed to parse currentUser from sessionStorage:', e);
        showModal('Error', 'Session data corrupted. Please log in again.');
        sessionStorage.removeItem('currentUser');
        sessionStorage.removeItem('user');
        return;
    }
    
    console.log('Parsed user object:', currentUser);
    console.log('User properties:', Object.keys(currentUser));
    console.log('User role raw value:', currentUser.role);
    console.log('User role type:', typeof currentUser.role);
    
    // ROBUST role check - handle all edge cases
    let userRole = '';
    if (currentUser.role) {
        // Trim whitespace and convert to lowercase
        userRole = String(currentUser.role).trim().toLowerCase();
    }
    
    console.log('Normalized role:', userRole);
    console.log('Is "admin"?', userRole === 'admin');
    console.log('Is "librarian"?', userRole === 'librarian');
    
    // Check multiple possible role representations
    const isAdmin = userRole === 'admin' || userRole === 'Admin' || userRole === 'ADMIN';
    const isLibrarian = userRole === 'librarian' || userRole === 'Librarian' || userRole === 'LIBRARIAN';
    
    if (!isAdmin && !isLibrarian) {
        console.error('❌ ACCESS DENIED: Role check failed');
        console.error('Expected: "admin" or "librarian"');
        console.error('Got:', JSON.stringify(userRole));
        
        // Show helpful error with debugging info
        const errorMsg = `Access Denied - Role Check Failed\n\n` +
            `Your role: "${currentUser.role}"\n` +
            `Normalized: "${userRole}"\n\n` +
            `Please contact administrator or check console for details.`;
        
        showModal('Access Denied', errorMsg);
        return;
    }
    
    console.log('✅ Role check PASSED - User is', isAdmin ? 'ADMIN' : 'LIBRARIAN');
    
    // Check if already verified in this session (within 5 minutes)
    if (isCriticalActionValid()) {
        console.log('✅ Already verified for critical action - proceeding');
        // Show warning confirmation modal before proceeding with delete
        const warningModalHTML = `
            <div style="padding: 20px; text-align: center;">
                <div style="font-size: 48px; color: #f44336; margin-bottom: 15px;">❌</div>
                <h3 style="margin-bottom: 15px; color: #333;">Confirm Delete Member</h3>
                <p style="color: #666; margin-bottom: 20px; line-height: 1.5;">
                    You are about to <strong style="color: #f44336;">PERMANENTLY DELETE</strong> a member record.<br>
                    <strong>This action cannot be undone!</strong>
                </p>
                <div style="background-color: #f8d7da; border: 1px solid #f5c6cb; border-radius: 6px; padding: 12px; margin: 15px 0; text-align: left;">
                    <strong>Warning:</strong> Once deleted, the member record and all associated borrowing history will be permanently removed from the system.
                </div>
                <p style="color: #dc3545; font-weight: bold; margin-top: 15px;">
                    Type "DELETE" in the field below to confirm this action:
                </p>
                <input type="text" id="deleteConfirmationInput" 
                       placeholder="Type DELETE to confirm" 
                       style="width: 100%; padding: 10px; margin: 10px 0; border: 1px solid #ddd; border-radius: 4px; text-align: center; font-weight: bold;"
                       autocomplete="off">
            </div>
        `;
        
        showModal('Delete Member Confirmation', warningModalHTML, true, () => {
            const confirmationInput = document.getElementById('deleteConfirmationInput');
            const confirmationValue = confirmationInput ? confirmationInput.value.trim() : '';
            
            if (confirmationValue.toUpperCase() !== 'DELETE') {
                showModal('Action Cancelled', 'Deletion cancelled. Please type "DELETE" to confirm.');
                return;
            }
            
            deleteMemberConfirmed({ memberId });
            // Clear verification after action
            clearCriticalActionVerification();
        });
    } else {
        // Require password verification first
        console.log('Password verification required for delete member...');
        const verified = await verifyUserPassword('delete_member');
        
        if (!verified) {
            console.error('❌ VERIFICATION FAILED - BLOCKING DELETE MEMBER');
            return;
        }
        
        console.log('✅ Verification successful - showing delete confirmation');
        // Show warning confirmation modal after verification
        const warningModalHTML = `
            <div style="padding: 20px; text-align: center;">
                <div style="font-size: 48px; color: #f44336; margin-bottom: 15px;">❌</div>
                <h3 style="margin-bottom: 15px; color: #333;">Confirm Delete Member</h3>
                <p style="color: #666; margin-bottom: 20px; line-height: 1.5;">
                    You are about to <strong style="color: #f44336;">PERMANENTLY DELETE</strong> a member record.<br>
                    <strong>This action cannot be undone!</strong>
                </p>
                <div style="background-color: #f8d7da; border: 1px solid #f5c6cb; border-radius: 6px; padding: 12px; margin: 15px 0; text-align: left;">
                    <strong>Warning:</strong> Once deleted, the member record and all associated borrowing history will be permanently removed from the system.
                </div>
                <p style="color: #dc3545; font-weight: bold; margin-top: 15px;">
                    Type "DELETE" in the field below to confirm this action:
                </p>
                <input type="text" id="deleteConfirmationInput" 
                       placeholder="Type DELETE to confirm" 
                       style="width: 100%; padding: 10px; margin: 10px 0; border: 1px solid #ddd; border-radius: 4px; text-align: center; font-weight: bold;"
                       autocomplete="off">
            </div>
        `;
        
        showModal('Delete Member Confirmation', warningModalHTML, true, () => {
            const confirmationInput = document.getElementById('deleteConfirmationInput');
            const confirmationValue = confirmationInput ? confirmationInput.value.trim() : '';
            
            if (confirmationValue.toUpperCase() !== 'DELETE') {
                showModal('Action Cancelled', 'Deletion cancelled. Please type "DELETE" to confirm.');
                return;
            }
            
            deleteMemberConfirmed({ memberId });
            // Clear verification after action
            clearCriticalActionVerification();
        });
    }
}

/**
 * Confirmed delete member function after admin password validation
 */
async function deleteMemberConfirmed(params) {
    const { memberId } = params;
    showModal(
        'Delete Member',
        `Are you sure you want to delete this member? This action cannot be undone.`,
        true,
        async () => {
            try {
                const response = await fetch(`${API_BASE_URL}/members.php?action=delete&id=${memberId}`, {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `Bearer ${authToken}`
                    }
                });
                
                const data = await response.json();
                
                if (data.success) {
                    showModal('Success', 'Member has been deleted successfully.');
                    
                    // Reload members data
                    await loadMembersData();
                    await loadDashboardData();
                } else {
                    showModal('Error', data.message || 'Failed to delete member.');
                }
            } catch (error) {
                console.error('Error deleting member:', error);
                showModal('Error', 'Failed to delete member. Please try again.');
            }
        }
    );
}

/**
 * Delete category
 * @param {string|number} categoryId - Category ID
 */
async function deleteCategory(categoryId) {
    // Check if user is Admin or Librarian - ROBUST CHECK
    // NOTE: User data is stored in sessionStorage, not localStorage!
    const currentUserRaw = sessionStorage.getItem('currentUser') || sessionStorage.getItem('user');
    console.log('=== DELETE CATEGORY - SESSION STORAGE CHECK ===');
    console.log('SessionStorage currentUser:', currentUserRaw);
    
    let currentUser;
    try {
        currentUser = JSON.parse(currentUserRaw || '{}');
    } catch (e) {
        console.error('Failed to parse currentUser from sessionStorage:', e);
        showModal('Error', 'Session data corrupted. Please log in again.');
        sessionStorage.removeItem('currentUser');
        sessionStorage.removeItem('user');
        return;
    }
    
    console.log('Parsed user object:', currentUser);
    console.log('User properties:', Object.keys(currentUser));
    console.log('User role raw value:', currentUser.role);
    console.log('User role type:', typeof currentUser.role);
    
    // ROBUST role check - handle all edge cases
    let userRole = '';
    if (currentUser.role) {
        userRole = String(currentUser.role).trim().toLowerCase();
    }
    
    console.log('Normalized role:', userRole);
    console.log('Is "admin"?', userRole === 'admin');
    console.log('Is "librarian"?', userRole === 'librarian');
    
    const isAdmin = userRole === 'admin' || userRole === 'Admin' || userRole === 'ADMIN';
    const isLibrarian = userRole === 'librarian' || userRole === 'Librarian' || userRole === 'LIBRARIAN';
    
    if (!isAdmin && !isLibrarian) {
        console.error('❌ ACCESS DENIED: Role check failed');
        console.error('Expected: "admin" or "librarian"');
        console.error('Got:', JSON.stringify(userRole));
        showModal('Access Denied', `Only Admin and Librarian users can delete categories.\n\nYour role: "${currentUser.role}"`);
        return;
    }
    
    console.log('✅ Role check PASSED - User is', isAdmin ? 'ADMIN' : 'LIBRARIAN');
    
    // Check if already verified in this session (within 5 minutes)
    if (isCriticalActionValid()) {
        console.log('✅ Already verified for critical action - proceeding');
        // Show warning confirmation modal before proceeding with delete
        const warningModalHTML = `
            <div style="padding: 20px; text-align: center;">
                <div style="font-size: 48px; color: #f44336; margin-bottom: 15px;">❌</div>
                <h3 style="margin-bottom: 15px; color: #333;">Confirm Delete Category</h3>
                <p style="color: #666; margin-bottom: 20px; line-height: 1.5;">
                    You are about to <strong style="color: #f44336;">PERMANENTLY DELETE</strong> a category.<br>
                    <strong>This action cannot be undone!</strong>
                </p>
                <div style="background-color: #f8d7da; border: 1px solid #f5c6cb; border-radius: 6px; padding: 12px; margin: 15px 0; text-align: left;">
                    <strong>Warning:</strong> Deleting this category will affect all books assigned to it. Books in this category may need to be reassigned.
                </div>
                <p style="color: #dc3545; font-weight: bold; margin-top: 15px;">
                    Type "DELETE" in the field below to confirm this action:
                </p>
                <input type="text" id="deleteConfirmationInput" 
                       placeholder="Type DELETE to confirm" 
                       style="width: 100%; padding: 10px; margin: 10px 0; border: 1px solid #ddd; border-radius: 4px; text-align: center; font-weight: bold;"
                       autocomplete="off">
            </div>
        `;
        
        showModal('Delete Category Confirmation', warningModalHTML, true, () => {
            const confirmationInput = document.getElementById('deleteConfirmationInput');
            const confirmationValue = confirmationInput ? confirmationInput.value.trim() : '';
            
            if (confirmationValue.toUpperCase() !== 'DELETE') {
                showModal('Action Cancelled', 'Deletion cancelled. Please type "DELETE" to confirm.');
                return;
            }
            
            deleteCategoryConfirmed({ categoryId });
            // Clear verification after action
            clearCriticalActionVerification();
        });
    } else {
        // Require password verification first
        console.log('Password verification required for delete category...');
        const verified = await verifyUserPassword('delete_category');
        
        if (!verified) {
            console.error('❌ VERIFICATION FAILED - BLOCKING DELETE CATEGORY');
            return;
        }
        
        console.log('✅ Verification successful - showing delete confirmation');
        // Show warning confirmation modal after verification
        const warningModalHTML = `
            <div style="padding: 20px; text-align: center;">
                <div style="font-size: 48px; color: #f44336; margin-bottom: 15px;">❌</div>
                <h3 style="margin-bottom: 15px; color: #333;">Confirm Delete Category</h3>
                <p style="color: #666; margin-bottom: 20px; line-height: 1.5;">
                    You are about to <strong style="color: #f44336;">PERMANENTLY DELETE</strong> a category.<br>
                    <strong>This action cannot be undone!</strong>
                </p>
                <div style="background-color: #f8d7da; border: 1px solid #f5c6cb; border-radius: 6px; padding: 12px; margin: 15px 0; text-align: left;">
                    <strong>Warning:</strong> Deleting this category will affect all books assigned to it. Books in this category may need to be reassigned.
                </div>
                <p style="color: #dc3545; font-weight: bold; margin-top: 15px;">
                    Type "DELETE" in the field below to confirm this action:
                </p>
                <input type="text" id="deleteConfirmationInput" 
                       placeholder="Type DELETE to confirm" 
                       style="width: 100%; padding: 10px; margin: 10px 0; border: 1px solid #ddd; border-radius: 4px; text-align: center; font-weight: bold;"
                       autocomplete="off">
            </div>
        `;
        
        showModal('Delete Category Confirmation', warningModalHTML, true, () => {
            const confirmationInput = document.getElementById('deleteConfirmationInput');
            const confirmationValue = confirmationInput ? confirmationInput.value.trim() : '';
            
            if (confirmationValue.toUpperCase() !== 'DELETE') {
                showModal('Action Cancelled', 'Deletion cancelled. Please type "DELETE" to confirm.');
                return;
            }
            
            deleteCategoryConfirmed({ categoryId });
            // Clear verification after action
            clearCriticalActionVerification();
        });
    }
}

/**
 * Confirmed delete category function after admin password validation
 */
async function deleteCategoryConfirmed(params) {
    const { categoryId } = params;
    showModal(
        'Delete Category',
        'Are you sure you want to delete this category? This action cannot be undone.',
        true,
        async () => {
            try {
                const response = await fetch(`${API_BASE_URL}/categories.php?action=delete&id=${categoryId}`, {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `Bearer ${authToken}`
                    }
                });
                
                const data = await response.json();
                
                if (data.success) {
                    showModal('Success', 'Category has been deleted successfully.');
                    
                    // Reload categories data
                    await loadCategoriesData();
                    await loadCategories(); // Update dropdowns
                    await loadDashboardData();
                    // Update category counts
                    setTimeout(async () => {
                        try {
                            const response = await fetch(`${API_BASE_URL}/categories.php?action=getAll`, {
                                headers: {
                                    'Authorization': `Bearer ${authToken}`
                                }
                            });
                            const data = await response.json();
                            if (data.success) {
                                updateCategoryCounts(data.categories);
                            }
                        } catch (error) {
                            console.error('Error updating category counts after delete:', error);
                        }
                    }, 100);
                } else {
                    showModal('Error', data.message || 'Failed to delete category.');
                }
            } catch (error) {
                console.error('Error deleting category:', error);
                showModal('Error', 'Failed to delete category. Please try again.');
            }
        }
    );
}

/**
 * View books in category
 * @param {string|number} categoryId - Category ID
 */
async function viewCategoryBooks(categoryId) {
    try {
        const response = await fetch(`${API_BASE_URL}/categories.php?action=getBooks&id=${categoryId}`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            let booksHTML = '';
            if (data.books && data.books.length > 0) {
                booksHTML = '<ul style="margin-top: 10px; padding-left: 20px; list-style-type: disc;">';
                data.books.forEach(book => {
                    booksHTML += `<li><strong>${book.title}</strong> by ${book.author} (${book.status}) 
                                 - Total Copies: ${book.total_copies || 1}, Available: ${book.available_copies || 0}</li>`;
                });
                booksHTML += '</ul>';
            } else {
                booksHTML = '<p style="color: #666; font-style: italic;">No books in this category yet.</p>';
            }

            showModal(`Books in ${data.category.name}`, `
                <div style="padding: 10px;">
                    <h4>${data.category.name}</h4>
                    <p><strong>Description:</strong> ${data.category.description}</p>
                    <p><strong>Total Books:</strong> ${data.category.book_count || 0}</p>
                    <h5 style="margin-top: 20px;">Books in this category:</h5>
                    ${booksHTML}
                </div>
            `);
        }
    } catch (error) {
        console.error('Error loading category books:', error);
        showModal('Error', 'Failed to load category books.');
    }
}

/**
 * Edit category
 * @param {string|number} categoryId - Category ID
 */
async function editCategory(categoryId) {
    // Check if user is Admin or Librarian - ROBUST CHECK
    // NOTE: User data is stored in sessionStorage, not localStorage!
    const currentUserRaw = sessionStorage.getItem('currentUser') || sessionStorage.getItem('user');
    console.log('=== EDIT CATEGORY - SESSION STORAGE CHECK ===');
    console.log('SessionStorage currentUser:', currentUserRaw);
    
    let currentUser;
    try {
        currentUser = JSON.parse(currentUserRaw || '{}');
    } catch (e) {
        console.error('Failed to parse currentUser from localStorage:', e);
        showModal('Error', 'Session data corrupted. Please log in again.');
        localStorage.removeItem('currentUser');
        return;
    }
    
    console.log('Parsed user object:', currentUser);
    console.log('User properties:', Object.keys(currentUser));
    console.log('User role raw value:', currentUser.role);
    console.log('User role type:', typeof currentUser.role);
    
    // ROBUST role check - handle all edge cases
    let userRole = '';
    if (currentUser.role) {
        // Trim whitespace and convert to lowercase
        userRole = String(currentUser.role).trim().toLowerCase();
    }
    
    console.log('Normalized role:', userRole);
    console.log('Is "admin"?', userRole === 'admin');
    console.log('Is "librarian"?', userRole === 'librarian');
    
    // Check multiple possible role representations
    const isAdmin = userRole === 'admin' || userRole === 'Admin' || userRole === 'ADMIN';
    const isLibrarian = userRole === 'librarian' || userRole === 'Librarian' || userRole === 'LIBRARIAN';
    
    if (!isAdmin && !isLibrarian) {
        console.error('❌ ACCESS DENIED: Role check failed');
        console.error('Expected: "admin" or "librarian"');
        console.error('Got:', JSON.stringify(userRole));
        
        // Show helpful error with debugging info
        const errorMsg = `Access Denied - Role Check Failed\n\n` +
            `Your role: "${currentUser.role}"\n` +
            `Normalized: "${userRole}"\n\n` +
            `Please contact administrator or check console for details.`;
        
        showModal('Access Denied', errorMsg);
        return;
    }
    
    console.log('✅ Role check PASSED - User is', isAdmin ? 'ADMIN' : 'LIBRARIAN');
    
    // Check if already verified in this session (within 5 minutes)
    let verified = isCriticalActionValid();
    
    if (!verified) {
        // Require password verification first
        console.log('Password verification required for edit category...');
        verified = await verifyUserPassword('edit_category');
        
        if (!verified) {
            console.error('❌ VERIFICATION FAILED - BLOCKING EDIT CATEGORY');
            return;
        }
        
        console.log('✅ Verification successful - proceeding with edit');
    } else {
        console.log('✅ Already verified for critical action - proceeding');
    }
    
    try {
        // First, get the current category details
        const response = await fetch(`${API_BASE_URL}/categories.php?action=getAll`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            const category = data.categories.find(cat => 
                cat.category_id == categoryId || cat.id == categoryId
            );
            
            if (category) {
                const editForm = `
                    <form id="editCategoryForm">
                        <div class="form-group">
                            <label for="editCategoryName">Category Name *</label>
                            <input type="text" id="editCategoryName" name="name" value="${category.name}" required>
                        </div>
                        <div class="form-group">
                            <label for="editCategoryDescription">Description</label>
                            <textarea id="editCategoryDescription" name="description" rows="3">${category.description || ''}</textarea>
                        </div>
                        <input type="hidden" name="category_id" value="${category.category_id || category.id}">
                    </form>
                `;
                
                showModal('Edit Category', editForm, true, async () => {
                    const form = document.getElementById('editCategoryForm');
                    if (form) {
                        const formData = new FormData(form);
                        const categoryData = {
                            category_id: formData.get('category_id'),
                            name: formData.get('name'),
                            description: formData.get('description')
                        };
                        
                        // Validate input
                        if (!categoryData.name || categoryData.name.trim() === '') {
                            showModal('Error', 'Category name is required.');
                            return;
                        }
                        
                        try {
                            const updateResponse = await fetch(`${API_BASE_URL}/categories.php`, {
                                method: 'PUT',
                                headers: {
                                    'Authorization': `Bearer ${authToken}`,
                                    'Content-Type': 'application/json'
                                },
                                body: JSON.stringify(categoryData)
                            });
                            
                            const updateData = await updateResponse.json();
                            
                            if (updateData.success) {
                                showModal('Success', `
                                    <div style="text-align: center; padding: 20px;">
                                        <div style="font-size: 48px; color: var(--primary-green); margin-bottom: 20px;">✓</div>
                                        <h3>Category Updated Successfully!</h3>
                                        <p><strong>Name:</strong> ${categoryData.name}</p>
                                        ${categoryData.description ? `<p><strong>Description:</strong> ${categoryData.description}</p>` : ''}
                                    </div>
                                `);
                                
                                // Reload categories data
                                await loadCategoriesData();
                                await loadCategories(); // Update dropdowns
                                await loadDashboardData();
                                // Update category counts
                                setTimeout(async () => {
                                    try {
                                        const response = await fetch(`${API_BASE_URL}/categories.php?action=getAll`, {
                                            headers: {
                                                'Authorization': `Bearer ${authToken}`
                                            }
                                        });
                                        const data = await response.json();
                                        if (data.success) {
                                            updateCategoryCounts(data.categories);
                                        }
                                    } catch (error) {
                                        console.error('Error updating category counts after edit:', error);
                                    }
                                }, 100);
                                
                                // Clear verification after successful edit
                                clearCriticalActionVerification();
                            } else {
                                showModal('Error', `
                                    <div style="text-align: center; padding: 20px;">
                                        <div style="font-size: 48px; color: #dc3545; margin-bottom: 20px;">✗</div>
                                        <h3>Error Updating Category</h3>
                                        <p>${updateData.message}</p>
                                    </div>
                                `);
                            }
                        } catch (error) {
                            console.error('Error updating category:', error);
                            showModal('Error', 'Failed to update category. Please try again.');
                        }
                    }
                });
            } else {
                showModal('Error', 'Category not found.');
            }
        } else {
            showModal('Error', 'Failed to load categories data.');
        }
    } catch (error) {
        console.error('Error loading category details:', error);
        showModal('Error', 'Failed to load category details. Please check your connection.');
    }
}

// ========================================
// OLD BROKEN IMPLEMENTATION COMPLETELY REMOVED
// DELETE - Book edit functions have been replaced
// New implementation is in book-edit-new.js
// Do NOT use editBook_OLD or editBookConfirmed
// ========================================


/**
 * Return borrowed book
 * @param {string|number} borrowingId - Borrowing record ID
 */
async function returnBorrowedBook(borrowingId) {
    // Check if user is Admin or Librarian - ROBUST CHECK
    // NOTE: User data is stored in sessionStorage, not localStorage!
    const currentUserRaw = sessionStorage.getItem('currentUser') || sessionStorage.getItem('user');
    console.log('=== RETURN BORROWED BOOK - SESSION STORAGE CHECK ===');
    console.log('SessionStorage currentUser:', currentUserRaw);
    
    let currentUser;
    try {
        currentUser = JSON.parse(currentUserRaw || '{}');
    } catch (e) {
        console.error('Failed to parse currentUser from sessionStorage:', e);
        showModal('Error', 'Session data corrupted. Please log in again.');
        sessionStorage.removeItem('currentUser');
        sessionStorage.removeItem('user');
        return;
    }
    
    console.log('Parsed user object:', currentUser);
    console.log('User properties:', Object.keys(currentUser));
    console.log('User role raw value:', currentUser.role);
    console.log('User role type:', typeof currentUser.role);
    
    // ROBUST role check - handle all edge cases
    let userRole = '';
    if (currentUser.role) {
        userRole = String(currentUser.role).trim().toLowerCase();
    }
    
    console.log('Normalized role:', userRole);
    console.log('Is "admin"?', userRole === 'admin');
    console.log('Is "librarian"?', userRole === 'librarian');
    
    const isAdmin = userRole === 'admin' || userRole === 'Admin' || userRole === 'ADMIN';
    const isLibrarian = userRole === 'librarian' || userRole === 'Librarian' || userRole === 'LIBRARIAN';
    
    if (!isAdmin && !isLibrarian) {
        console.error('❌ ACCESS DENIED: Role check failed');
        console.error('Expected: "admin" or "librarian"');
        console.error('Got:', JSON.stringify(userRole));
        showModal('Access Denied', `Only Admin and Librarian users can return books.\n\nYour role: "${currentUser.role}"`);
        return;
    }
    
    console.log('✅ Role check PASSED - User is', isAdmin ? 'ADMIN' : 'LIBRARIAN');
    
    // Check if already verified in this session (within 5 minutes)
    if (isCriticalActionValid()) {
        console.log('✅ Already verified for critical action - showing confirmation');
        // Show confirmation modal directly
        showReturnConfirmationModal(borrowingId);
    } else {
        // Require password verification first
        console.log('Password verification required for return book...');
        const verified = await verifyUserPassword('return_book');
        
        if (!verified) {
            console.error('❌ VERIFICATION FAILED - BLOCKING RETURN BOOK');
            return;
        }
        
        console.log('✅ Verification successful - showing return confirmation');
        // Show confirmation modal after verification
        showReturnConfirmationModal(borrowingId);
    }
}

/**
 * Show return book confirmation modal after password verification
 * @param {string|number} borrowingId - Borrowing record ID
 */
async function showReturnConfirmationModal(borrowingId) {
    const confirmationModalHTML = `
        <div style="padding: 20px; text-align: center;">
            <div style="font-size: 48px; color: #4caf50; margin-bottom: 15px;">❓</div>
            <h3 style="margin-bottom: 15px; color: #333;">Confirm Return</h3>
            <p style="color: #666; margin-bottom: 20px; line-height: 1.5;">
                Are you sure you want to mark this book as <strong style="color: #4caf50;">RETURNED</strong>?<br>
                This will update the status from Active to Returned.
            </p>
        </div>
    `;
    
    showModal('Confirm Return', confirmationModalHTML, true, async () => {
        try {
            // Direct API call to update the status to Returned
            const response = await fetch(`${API_BASE_URL}/borrowing.php?action=return`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${authToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    record_id: borrowingId,
                    return_condition: 'Good', // Default condition
                    notes: '' // No notes needed for simple return
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                // Show success message
                showModal('Success', `
                    <div style="padding: 20px; text-align: center;">
                        <div style="font-size: 48px; color: var(--primary-green); margin-bottom: 20px;">✓</div>
                        <h3>Book Returned Successfully!</h3>
                        <p>Record status updated to Returned.</p>
                    </div>
                `);
                
                // Reload borrowing data to reflect the change
                await loadBorrowingData();
                await loadDashboardData();
                
                // Clear verification after successful return
                clearCriticalActionVerification();
            } else {
                showModal('Error', data.message || 'Failed to return book.');
            }
        } catch (error) {
            console.error('Error returning book:', error);
            showModal('Error', 'Failed to return book. Please try again.');
        }
    });
}

/**
 * Confirmed return borrowed book function after admin password validation
 */


// =============================================
// PUSH NOTIFICATION SYSTEM (Browser Notifications)
// =============================================

/**
 * Initialize push notifications
 */
async function initializePushNotifications() {
    // Check if browser supports notifications
    if (!('Notification' in window)) {
        console.log('⚠️ Browser does not support notifications');
        return;
    }
    
    console.log('🔔 Initializing push notifications');
    console.log('Notification permission:', Notification.permission);
    
    // Register Service Worker with correct scope
    try {
        if ('serviceWorker' in navigator) {
            // Fix: Use correct scope that matches the service worker location
            const registration = await navigator.serviceWorker.register('/cpmr_library/frontend/service-worker.js', {
                scope: '/cpmr_library/frontend/'
            });
            console.log('✅ Service Worker registered:', registration);
            
            // Request notification permission if not already granted
            if (Notification.permission === 'default') {
                console.log('📋 Requesting notification permission');
                const permission = await Notification.requestPermission();
                console.log('📋 Notification permission:', permission);
            }
        }
    } catch (error) {
        console.warn('⚠️ Service Worker registration skipped (not critical for core functionality):', error.message);
        console.log('💡 Push notifications will not work, but login and other features will work normally');
    }
}

/**
 * Send browser push notification
 * @param {string} title - Notification title
 * @param {object} options - Notification options
 */
async function sendPushNotification(title, options = {}) {
    if (Notification.permission !== 'granted') {
        console.log('⚠️ Notification permission not granted');
        return;
    }
    
    try {
        const registration = await navigator.serviceWorker.ready;
        
        const notificationOptions = {
            body: options.body || 'New notification',
            icon: '/cpmr_library/frontend/images/icon-192x192.png',
            badge: '/cpmr_library/frontend/images/badge-72x72.png',
            tag: options.tag || 'notification',
            requireInteraction: options.requireInteraction || false,
            vibrate: [200, 100, 200],
            ...options
        };
        
        console.log('📤 Sending push notification:', title, notificationOptions);
        
        // If Service Worker is active, use it
        if (registration.active) {
            // For browsers that support Push API
            if ('pushManager' in registration) {
                // Just show local notification (client-side)
                registration.showNotification(title, notificationOptions);
            }
        } else {
            // Fallback: Use local notification
            new Notification(title, notificationOptions);
        }
    } catch (error) {
        console.error('❌ Error sending push notification:', error);
        // Fallback: Show local notification
        if (Notification.permission === 'granted') {
            new Notification(title, options);
        }
    }
}

/**
 * Request notification permission from user
 */
async function requestNotificationPermission() {
    if (!('Notification' in window)) {
        showModal('Error', '<p>Your browser does not support notifications</p>', false);
        return false;
    }
    
    if (Notification.permission === 'granted') {
        console.log('✅ Notification permission already granted');
        return true;
    }
    
    if (Notification.permission === 'denied') {
        showModal('Info', '<p>Notifications are blocked. Please enable them in browser settings.</p>', false);
        return false;
    }
    
    // Request permission
    try {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
            console.log('✅ Notification permission granted');
            showModal('Success', '<p>🔔 Push notifications enabled!</p>', false);
            return true;
        } else {
            console.log('⚠️ Notification permission denied');
            return false;
        }
    } catch (error) {
        console.error('Error requesting permission:', error);
        return false;
    }
}

// =============================================
// NOTIFICATION SOUND SYSTEM
// =============================================

/**
 * Initialize audio context (must be called after user interaction)
 */
function initializeAudioContext() {
    if (audioContext) return audioContext;
    
    try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        console.log('✅ Audio context initialized');
    } catch (error) {
        console.log('Audio context unavailable:', error);
    }
    return audioContext;
}

/**
 * Play notification sound alert
 */
function playNotificationSound() {
    if (!notificationSoundEnabled) return;
    
    try {
        // Initialize audio context if needed
        if (!audioContext) {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
        
        // Resume context if suspended (browsers suspend audio until user interaction)
        if (audioContext.state === 'suspended') {
            audioContext.resume().then(() => {
                console.log('🔊 Audio context resumed');
                playBeep();
            }).catch(err => console.log('Cannot resume audio:', err));
            return;
        }
        
        playBeep();
    } catch (error) {
        console.log('Notification sound unavailable:', error);
    }
}

/**
 * Actually play the beep sound
 */
function playBeep() {
    if (!audioContext) return;
    
    try {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        // Configure the sound
        oscillator.frequency.value = 800; // Frequency in Hz
        oscillator.type = 'sine';
        
        // Fade in and out for a pleasant "ding" effect
        gainNode.gain.setValueAtTime(0, audioContext.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.3, audioContext.currentTime + 0.05);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.5);
        
        console.log('🔊 Beep played');
    } catch (error) {
        console.log('Error playing beep:', error);
    }
}

/**
 * Toggle notification sound
 */
function toggleNotificationSound() {
    notificationSoundEnabled = !notificationSoundEnabled;
    localStorage.setItem('notificationSoundEnabled', notificationSoundEnabled);
    console.log('Notification sound:', notificationSoundEnabled ? '🔊 Enabled' : '🔇 Disabled');
    return notificationSoundEnabled;
}

/**
 * Handle sound toggle button click
 */
function handleSoundToggle(e) {
    e.stopPropagation();
    const enabled = toggleNotificationSound();
    const btn = document.querySelector('.sound-toggle-btn');
    if (btn) {
        btn.textContent = enabled ? '🔊' : '🔇';
        btn.title = enabled ? 'Disable notification sound' : 'Enable notification sound';
    }
    
    // Play a test sound so user knows it's enabled
    if (enabled) {
        playNotificationSound();
    }
}

/**
 * Handle test sound button click
 */
function handleTestSound(e) {
    e.stopPropagation();
    console.log('🔉 Test sound clicked');
    playNotificationSound();
}

/**
 * Handle push notification toggle button click
 */
async function handlePushNotificationToggle(e) {
    e.stopPropagation();
    console.log('🔔 Push notification toggle clicked');
    
    if (!('Notification' in window)) {
        showModal('Error', '<p>Your browser does not support push notifications</p>', false);
        return;
    }
    
    if (Notification.permission === 'granted') {
        showModal('Info', '<p>✅ Push notifications are already enabled!</p><p>You will receive alerts on your device.</p>', false);
        return;
    }
    
    // Request permission
    const enabled = await requestNotificationPermission();
    if (enabled) {
        // Update button UI
        const btn = document.querySelector('.push-notification-btn');
        if (btn) {
            btn.textContent = '🔔';
            btn.title = 'Push notifications enabled';
            
            // Send a test notification
            setTimeout(() => {
                sendPushNotification('🔔 Push Notifications Enabled', {
                    body: '✅ You will now receive notifications on your device!',
                    tag: 'push-enabled',
                    requireInteraction: false
                });
            }, 500);
        }
    }
}

// =============================================
// NOTIFICATION SYSTEM
// =============================================

/**
 * Initialize notification system
 */
async function initializeNotifications() {
    const notificationBell = document.getElementById('notificationBell');
    const notificationCount = document.getElementById('notificationCount');
    
    if (!notificationBell) return;
    
    // Load notification sound preference from localStorage
    const savedSoundPref = localStorage.getItem('notificationSoundEnabled');
    if (savedSoundPref !== null) {
        notificationSoundEnabled = savedSoundPref === 'true';
    }
    
    // Load previous count from localStorage
    previousNotificationCount = parseInt(localStorage.getItem('previousNotificationCount')) || 0;
    
    // Check if Font Awesome loaded, if not show fallback
    const bellIcon = notificationBell.querySelector('i');
    if (bellIcon && !bellIcon.classList.contains('fa')) {
        // Font Awesome not loaded, use fallback
        bellIcon.style.display = 'none';
        notificationBell.classList.add('no-fa');
    }
    
    // Add click event to open notification panel
    notificationBell.addEventListener('click', function(e) {
        e.stopPropagation();
        showNotificationPanel();
    });
    
    // Load initial notification count
    await updateNotificationCount();
    
    // Check for notifications periodically
    setInterval(async () => {
        await checkForNewNotifications();
    }, 5000); // Every 5 seconds for real-time updates
    
    // CRITICAL: Check user status periodically to force logout if suspended
    setInterval(async () => {
        await verifyUserStatus();
    }, 30000); // Check every 30 seconds
    
    // Demo notifications removed - only show real database notifications
    // The system now displays only actual library system notifications

/**
 * Update notification count display
 */
async function updateNotificationCount() {
    const notificationCount = document.getElementById('notificationCount');
    if (!notificationCount) return;
    
    // Get unread notifications count
    const unreadCount = await getUnreadNotificationsCount();
    
    if (unreadCount > 0) {
        notificationCount.textContent = unreadCount > 99 ? '99+' : unreadCount;
        notificationCount.style.display = 'flex';
    } else {
        notificationCount.style.display = 'none';
    }
}

/**
 * Get count of unread notifications
 * Fetches real count from backend API
 */
async function getUnreadNotificationsCount() {
    console.log('Fetching unread notifications count from API');
    console.log('Auth token available:', !!authToken);
    
    try {
        const response = await fetch(`${API_BASE_URL}/notifications.php?action=count`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        console.log('Count API response status:', response.status);
        
        if (response.ok) {
            const data = await response.json();
            console.log('Count API response data:', data);
            if (data.success) {
                console.log('✅ Returning count:', data.count || 0);
                return data.count || 0;
            } else {
                console.error('API returned success=false:', data.message);
            }
        } else {
            console.error('API request failed with status:', response.status);
            const errorText = await response.text();
            console.error('Error response:', errorText);
        }
        return 0;
    } catch (error) {
        console.error('Error fetching notification count:', error);
        return 0;
    }
}

/**
 * Show notification panel
 */
function showNotificationPanel() {
    // Create notification panel if it doesn't exist
    let panel = document.getElementById('notificationPanel');
    if (!panel) {
        panel = createNotificationPanel();
        document.body.appendChild(panel);
    }
    
    // ALWAYS attach event listeners (in case panel was recreated or listeners were lost)
    const pushBtn = panel.querySelector('.push-notification-btn');
    if (pushBtn) {
        pushBtn.removeEventListener('click', handlePushNotificationToggle);
        pushBtn.addEventListener('click', handlePushNotificationToggle);
    }
    
    const testSoundBtn = panel.querySelector('.test-sound-btn');
    if (testSoundBtn) {
        testSoundBtn.removeEventListener('click', handleTestSound);
        testSoundBtn.addEventListener('click', handleTestSound);
    }
    
    const soundToggleBtn = panel.querySelector('.sound-toggle-btn');
    if (soundToggleBtn) {
        soundToggleBtn.removeEventListener('click', handleSoundToggle);
        soundToggleBtn.addEventListener('click', handleSoundToggle);
    }
    
    const readBtn = panel.querySelector('.mark-all-read-btn');
    if (readBtn) {
        readBtn.removeEventListener('click', markAllNotificationsRead);
        readBtn.addEventListener('click', markAllNotificationsRead);
    }
    
    const clearBtn = panel.querySelector('.clear-all-btn');
    if (clearBtn) {
        clearBtn.removeEventListener('click', clearAllNotifications);
        clearBtn.addEventListener('click', clearAllNotifications);
        console.log('✅ Clear button event listener attached/re-attached');
    }
    
    // Load notifications
    loadNotifications(panel);
    
    // Show panel
    panel.style.display = 'block';
    
    // Lock body scroll when panel is open
    document.body.style.overflow = 'hidden';
    console.log('🔒 Background scroll locked');
    
    // Ensure close button has proper event listener
    const closeButton = panel.querySelector('.close-btn');
    if (closeButton) {
        // Remove any existing listener to prevent duplicates
        closeButton.removeEventListener('click', closeNotificationPanel);
        // Add the click listener
        closeButton.addEventListener('click', closeNotificationPanel);
    }
    
    // Close panel when clicking outside
    setTimeout(() => {
        document.addEventListener('click', closeNotificationPanelOnClickOutside);
    }, 100);
}

/**
 * Create notification panel element
 */
function createNotificationPanel() {
    const panel = document.createElement('div');
    panel.id = 'notificationPanel';
    panel.className = 'notification-panel modern';
    
    // Determine sound toggle text based on current setting
    const soundIconText = notificationSoundEnabled ? '🔊' : '🔇';
    
    // Determine push notification button text based on permission
    let pushIconText = '🔕';
    if ('Notification' in window) {
        pushIconText = Notification.permission === 'granted' ? '🔔' : '🔕';
    }
    
    panel.innerHTML = `
        <div class="notification-header modern">
            <div class="header-content">
                <h3>🔔 Notifications</h3>
                <div class="header-actions">
                    <button class="push-notification-btn" title="Enable push notifications">${pushIconText}</button>
                    <button class="test-sound-btn" title="Test notification sound">🔉</button>
                    <button class="sound-toggle-btn" title="Toggle notification sound">${soundIconText}</button>
                    <button class="mark-all-read-btn" title="Mark all as read">✓ Read</button>
                    <button class="clear-all-btn" title="Clear all notifications">🗑️ Clear</button>
                    <button class="close-btn" title="Close notifications">✕</button>
                </div>
            </div>
            <div class="notification-stats">
                <span class="unread-count">0 unread</span>
            </div>
        </div>
        <div class="notification-content" id="notificationContent">
            <div class="loading modern">Loading notifications...</div>
        </div>
    `;
    return panel;
}

/**
 * Load and display notifications
 * Updated to use API data and update unread count
 */
function loadNotifications(panel) {
    const content = panel.querySelector('#notificationContent');
    
    // For Admin and Librarian users, show system notifications including requests
    if (currentUser && currentUser.role && (currentUser.role.toLowerCase() === 'admin' || currentUser.role.toLowerCase() === 'librarian')) {
        fetchRealNotificationsFromAPI(content);
        return;
    }
    
    // For non-admin users, show personal notifications
    fetchRealNotificationsFromAPI(content);
}

/**
 * Fetch real notifications from API and display them
 */
async function fetchRealNotificationsFromAPI(content) {
    try {
        const response = await fetch(`${API_BASE_URL}/notifications.php?action=list&limit=10`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        const data = await response.json();
        
        if (data.success && data.notifications) {
            const notifications = data.notifications;
            const unreadCount = notifications.filter(n => n.is_read === 0).length;
            
            // Update unread count display
            updateUnreadCountDisplay(unreadCount);
            
            if (notifications.length === 0) {
                content.innerHTML = `
                    <div class="no-notifications">
                        <i class="fas fa-bell-slash"></i>
                        <p>No notifications</p>
                        <small>You're all caught up!</small>
                    </div>
                `;
                return;
            }
            
            // Get reference time for newly arrived messages (after panel opens)
            const panelOpenedTime = window.notificationPanelOpenedTime;
            console.log('Panel opened at:', panelOpenedTime);
            
            // Display notifications with their current read status
            const notificationsHTML = notifications.map(notification => {
                // Determine if notification is "newly arrived" (after panel was opened)
                let isNewlyArrived = false;
                if (panelOpenedTime) {
                    const notificationTime = new Date(notification.created_at);
                    isNewlyArrived = notificationTime > panelOpenedTime;
                    console.log('Notification:', notification.title, 'created at:', notificationTime, 'is newly arrived:', isNewlyArrived);
                }
                
                // Build class list - show unread as "new" on first open
                let itemClass = 'notification-item';
                if (notification.is_read === 0) {
                    itemClass += ' unread'; // Unread = showing as NEW
                } else {
                    itemClass += ' read';
                }
                
                // Add newly-arrived class for messages that arrive while panel is open
                if (isNewlyArrived) {
                    itemClass += ' newly-arrived';
                }
                
                return `
                    <div class="${itemClass}" data-id="${notification.notification_id}" onclick="markNotificationAsRead(this, ${notification.notification_id})">
                        <div class="notification-icon">
                            <i class="fas ${getNotificationIcon(notification.type || 'info')}"></i>
                        </div>
                        <div class="notification-body">
                            <div class="notification-title">
                                ${escapeHtml(notification.title)}
                                ${(notification.is_read === 0 && !isNewlyArrived) ? '<span class="unread-badge">NEW</span>' : ''}
                                ${isNewlyArrived ? '<span class="new-badge">🆕 NEW</span>' : ''}
                            </div>
                            <div class="notification-message">${escapeHtml(notification.message)}</div>
                            <div class="notification-time">${formatDate(notification.created_at)}</div>
                        </div>
                    </div>
                `;
            }).join('');
            
            content.innerHTML = notificationsHTML;
            
            // After displaying, mark all as read and set reference time
            markAllNotificationsReadSilent();
            
        } else {
            content.innerHTML = `
                <div class="no-notifications">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>Error loading notifications</p>
                    <small>Please try again later</small>
                </div>
            `;
        }
    } catch (error) {
        console.error('Error fetching notifications:', error);
        content.innerHTML = `
            <div class="no-notifications">
                <i class="fas fa-exclamation-triangle"></i>
                <p>Unable to load notifications</p>
                <small>Check your connection and try again</small>
            </div>
        `;
    }
}

/**
 * Mark all notifications as read silently (without UI updates)
 * This is called after displaying the notifications
 */
async function markAllNotificationsReadSilent() {
    console.log('Marking all notifications as read (silent)');
    
    // Store the current time as reference for newly arrived messages
    window.notificationPanelOpenedTime = new Date();
    console.log('Reference time set for new notifications:', window.notificationPanelOpenedTime);
    
    try {
        const response = await fetch(`${API_BASE_URL}/notifications.php`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                action: 'markAllRead'
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            console.log('All notifications marked as read in background');
            // Update the unread count to 0
            updateUnreadCountDisplay(0);
            await updateNotificationCount();
        } else {
            console.error('Failed to mark all notifications as read:', data.message);
        }
    } catch (error) {
        console.error('Error marking all notifications as read:', error);
    }
}

/**
 * Update the unread count display in the header
 */
function updateUnreadCountDisplay(count) {
    const unreadCountElement = document.querySelector('.unread-count');
    if (unreadCountElement) {
        unreadCountElement.textContent = count > 0 ? `${count} unread` : '0 unread';
    }
}

/**
 * Get icon for notification type
 */
function getNotificationIcon(type) {
    const icons = {
        'info': 'fa-info-circle',
        'warning': 'fa-exclamation-triangle',
        'success': 'fa-check-circle',
        'error': 'fa-times-circle',
        'book_due': 'fa-book',
        'book_overdue': 'fa-exclamation-circle',
        'new_member': 'fa-user-plus',
        'system': 'fa-cog'
    };
    return icons[type] || 'fa-bell';
}

/**
 * Format notification timestamp
 */
function formatNotificationTime(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    
    if (diffDays > 0) {
        return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    } else if (diffHours > 0) {
        return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    } else if (diffMinutes > 0) {
        return `${diffMinutes} minute${diffMinutes > 1 ? 's' : ''} ago`;
    } else {
        return 'Just now';
    }
}

/**
 * Close notification panel
 */
function closeNotificationPanel() {
    console.log('closeNotificationPanel function called');
    const panel = document.getElementById('notificationPanel');
    if (panel) {
        console.log('Panel found, closing it');
        panel.style.display = 'none';
        document.removeEventListener('click', closeNotificationPanelOnClickOutside);
        
        // Unlock body scroll when panel is closed
        document.body.style.overflow = 'auto';
        console.log('🔓 Background scroll unlocked');
        
        // Refresh the main notification count when panel closes
        setTimeout(() => {
            updateNotificationCount();
        }, 100);
    } else {
        console.error('Notification panel not found');
    }
}

/**
 * Close panel when clicking outside
 */
function closeNotificationPanelOnClickOutside(e) {
    const panel = document.getElementById('notificationPanel');
    if (panel && !panel.contains(e.target) && !e.target.closest('#notificationBell')) {
        closeNotificationPanel();
    }
}

/**
 * Mark notifications as read - placeholder
 */
function markNotificationsAsRead() {
    // This function now relies on the API for marking notifications as read
    console.log('Marking notifications as read via API');
}

/**
 * Mark a single notification as read
 */
async function markNotificationAsRead(element, notificationId) {
    console.log('Marking notification as read:', notificationId);
    console.log('Auth token available:', !!authToken);
    console.log('Element:', element);
    console.log('Notification ID:', notificationId);
    
    // Debug: Check if element and notificationId are valid
    if (!element) {
        console.error('Element is null or undefined');
        return;
    }
    
    if (!notificationId) {
        console.error('Notification ID is missing');
        return;
    }
    
    try {
        // Debug: Show what we're sending
        console.log('Sending request to:', `${API_BASE_URL}/notifications.php`);
        console.log('Headers:', {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken ? '[TOKEN_PRESENT]' : '[NO_TOKEN]'}`
        });
        console.log('Body:', JSON.stringify({
            action: 'markRead',
            notification_id: notificationId
        }));
        
        const response = await fetch(`${API_BASE_URL}/notifications.php`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                action: 'markRead',
                notification_id: notificationId
            })
        });
        
        console.log('Response status:', response.status);
        console.log('Response headers:', [...response.headers.entries()]);
        
        const responseText = await response.text();
        console.log('Response text:', responseText);
        
        // Try to parse JSON
        let data;
        try {
            data = JSON.parse(responseText);
        } catch (parseError) {
            console.error('Failed to parse response as JSON:', parseError);
            console.error('Raw response:', responseText);
            throw new Error('Invalid response format');
        }
        
        console.log('Parsed response data:', data);
        
        if (data.success) {
            console.log('✅ Notification marked as read successfully');
            
            // Update the UI immediately
            console.log('Updating UI elements...');
            element.classList.remove('unread');
            element.classList.add('read');
            console.log('Classes updated:', element.className);
            
            // Update the notification icon color
            const icon = element.querySelector('.notification-icon');
            if (icon) {
                icon.style.color = '#666';
                console.log('Icon color updated to #666');
            }
            
            // Update the unread count display
            const unreadCountElement = document.querySelector('.unread-count');
            if (unreadCountElement) {
                const currentCount = parseInt(unreadCountElement.textContent) || 0;
                const newCount = Math.max(0, currentCount - 1);
                console.log('Updating unread count from', currentCount, 'to', newCount);
                updateUnreadCountDisplay(newCount);
            }
            
            // Update the main notification badge
            console.log('Updating main notification count');
            await updateNotificationCount();
            
            // Also trigger a refresh after a short delay to ensure API consistency
            setTimeout(async () => {
                console.log('Refreshing notification count after delay');
                await updateNotificationCount();
            }, 500);
            
            console.log('✅ All UI updates completed');
        } else {
            console.error('❌ Failed to mark notification as read:', data.message || 'Unknown error');
            // Show user-friendly error message
            alert('Failed to mark notification as read: ' + (data.message || 'Please try again'));
        }
    } catch (error) {
        console.error('❌ Error marking notification as read:', error);
        console.error('Error stack:', error.stack);
        // Show user-friendly error message
        alert('Error marking notification as read: ' + error.message);
    }
}

/**
 * Mark all notifications as read
 */
async function markAllNotificationsRead() {
    console.log('Marking all notifications as read');
    
    try {
        const response = await fetch(`${API_BASE_URL}/notifications.php`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                action: 'markAllRead'
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            console.log('All notifications marked as read');
            
            // Update all notification items in the panel
            const notificationItems = document.querySelectorAll('.notification-item.unread');
            notificationItems.forEach(item => {
                item.classList.remove('unread');
                item.classList.add('read');
                
                const icon = item.querySelector('.notification-icon');
                if (icon) {
                    icon.style.color = '#666';
                }
            });
            
            // Update the unread count display
            updateUnreadCountDisplay(0);
            
            // Update the main notification badge
            await updateNotificationCount();
        } else {
            console.error('Failed to mark all notifications as read:', data.message);
        }
    } catch (error) {
        console.error('Error marking all notifications as read:', error);
    }
}

/**
 * Clear all notifications
 */
async function clearAllNotifications() {
    console.log('🔍 clearAllNotifications() CALLED');
    
    // Confirm before clearing
    if (!confirm('Are you sure you want to delete all notifications? This action cannot be undone.')) {
        console.log('❌ Clear notifications cancelled by user');
        return;
    }
    
    console.log('✅ User confirmed clear action');
    console.log('📍 API Base URL:', API_BASE_URL);
    console.log('🔑 Auth Token:', authToken ? '[PRESENT - ' + authToken.substring(0, 20) + '...]' : '[MISSING]');
    
    try {
        const requestBody = JSON.stringify({ action: 'clearAll' });
        console.log('📤 Request body:', requestBody);
        console.log('🚀 Sending POST to:', API_BASE_URL + '/notifications.php');
        
        const response = await fetch(`${API_BASE_URL}/notifications.php`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: requestBody
        });
        
        console.log('Response status:', response.status);
        
        const responseText = await response.text();
        console.log('Response text:', responseText);
        
        let data;
        try {
            data = JSON.parse(responseText);
        } catch (parseError) {
            console.error('Failed to parse response as JSON:', parseError);
            showModal('Error', '<p>❌ Invalid response from server</p>', false);
            return;
        }
        
        console.log('Parsed response:', data);
        
        if (data.success) {
            console.log('All notifications cleared, count:', data.deleted_count);
            
            // Update the notification panel
            const content = document.getElementById('notificationContent');
            if (content) {
                content.innerHTML = `
                    <div class="no-notifications">
                        <i class="fas fa-bell-slash"></i>
                        <p>No notifications</p>
                        <small>You're all caught up!</small>
                    </div>
                `;
            }
            
            // Update the unread count display
            updateUnreadCountDisplay(0);
            
            // Update the main notification badge
            await updateNotificationCount();
            
            // Show success message
            showModal('Success', '<p>✅ All notifications have been cleared.</p>', false);
        } else {
            console.error('Failed to clear notifications:', data.message);
            showModal('Error', '<p>❌ Failed to clear notifications: ' + (data.message || 'Unknown error') + '</p>', false);
        }
    } catch (error) {
        console.error('Error clearing notifications:', error);
        console.error('Error stack:', error.stack);
        showModal('Error', '<p>❌ Error clearing notifications: ' + error.message + '</p>', false);
    }
}

/**
 * Check for new notifications
 * Role-aware notification checking
 */
async function checkForNewNotifications() {
    // CRITICAL: Don't check notifications if user is not logged in
    const isLoggedIn = sessionStorage.getItem('loggedIn') === 'true';
    const hasAuthToken = typeof authToken !== 'undefined' && authToken;
    
    if (!isLoggedIn || !hasAuthToken) {
        // User not logged in, skip notification check
        return;
    }
    
    // All users (Admin, Librarian, Staff, Student) should check for notifications
    // Admins and Librarians get system notifications (requests, approvals)
    // Staff and Students get personal notifications
    console.log('[NOTIFICATIONS] Checking for notifications for user role:', currentUser?.role);
    
    try {
        const currentCount = await getUnreadNotificationsCount();
        
        // Check if there are new notifications
        if (currentCount > previousNotificationCount) {
            console.log(`🔔 New notifications detected! (${previousNotificationCount} → ${currentCount})`);
            playNotificationSound();
        }
        
        // Update previous count
        previousNotificationCount = currentCount;
        localStorage.setItem('previousNotificationCount', currentCount);
        
        // Also update the notification count display if panel is open
        const panel = document.getElementById('notificationPanel');
        if (panel && panel.style.display === 'block') {
            await updateNotificationCount();
        }
    } catch (error) {
        console.error('[NOTIFICATIONS] Error checking for new notifications:', error);
    }
}

/**
 * Create a new notification (DEPRECATED)
 * This function is deprecated as we now use database notifications only
 * Keeping for backward compatibility but it no longer creates localStorage notifications
 */
function createNotification(notification) {
    console.log('Notification creation requested:', notification);
    console.log('Note: Client-side notifications are disabled. Only database notifications are shown.');
    // In a real implementation, this would call an API to create a database notification
}

/**
 * Get stored notifications from localStorage (DEPRECATED)
 * This function is deprecated as we now use database notifications only
 * Returns empty array as localStorage notifications are no longer used
 */
function getStoredNotifications() {
    return []; // Return empty array - no localStorage notifications
}

// Add CSS for modern notification panel
const notificationStyles = `
.notification-panel.modern {
    position: fixed;
    top: 70px;
    right: 20px;
    width: 400px;
    max-height: 600px;
    background: #ffffff;
    border-radius: 16px;
    box-shadow: 0 10px 40px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.05);
    z-index: 1001;
    display: none;
    overflow: hidden;
    backdrop-filter: blur(10px);
    border: 1px solid rgba(0,0,0,0.08);
    animation: slideIn 0.3s ease-out;
}

@keyframes slideIn {
    from {
        opacity: 0;
        transform: translateY(-20px) scale(0.95);
    }
    to {
        opacity: 1;
        transform: translateY(0) scale(1);
    }
}

.notification-header.modern {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 20px;
    border-bottom: none;
}

.notification-header.modern .header-content {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
}

.notification-header.modern h3 {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    color: white;
    display: flex;
    align-items: center;
    gap: 8px;
}

.notification-header.modern .header-actions {
    display: flex;
    gap: 8px;
}

.mark-all-read-btn, .close-btn {
    background: rgba(255,255,255,0.2);
    border: none;
    color: white;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    cursor: pointer;
    font-size: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
}

.mark-all-read-btn:hover, .close-btn:hover {
    background: rgba(255,255,255,0.3);
    transform: scale(1.1);
}

.notification-stats {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-top: 8px;
    border-top: 1px solid rgba(255,255,255,0.2);
}

.unread-count {
    font-size: 12px;
    background: rgba(255,255,255,0.2);
    padding: 4px 8px;
    border-radius: 12px;
    color: white;
}

.notification-content {
    max-height: 480px;
    overflow-y: auto;
    background: #fafafa;
}

.notification-item {
    display: flex;
    padding: 16px 20px;
    border-bottom: 1px solid rgba(0,0,0,0.03);
    transition: all 0.2s ease;
    cursor: pointer;
    background: white;
    margin-bottom: 2px;
    border-radius: 8px;
    margin: 8px 12px;
}

.notification-item:hover {
    background: #f0f8ff;
    transform: translateX(4px);
}

.notification-item:last-child {
    border-bottom: none;
}

.notification-item.unread {
    background-color: #e8f4fd;
    border-left: 3px solid #4a90e2;
}

.notification-icon {
    margin-right: 12px;
    font-size: 18px;
    color: #666;
    min-width: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
}

.notification-item.unread .notification-icon {
    color: #4a90e2;
}

.notification-body {
    flex: 1;
}

.notification-title {
    font-weight: 600;
    margin-bottom: 4px;
    color: #333;
    font-size: 14px;
}

.notification-message {
    font-size: 13px;
    color: #666;
    margin-bottom: 6px;
    line-height: 1.4;
    max-height: 3em;
    overflow: hidden;
    text-overflow: ellipsis;
}

.notification-time {
    font-size: 11px;
    color: #999;
    text-align: right;
}

.no-notifications {
    text-align: center;
    padding: 60px 20px;
    color: #999;
    background: #fafafa;
    height: 200px;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
}

.no-notifications i {
    font-size: 48px;
    margin-bottom: 15px;
    color: #ddd;
    display: block;
}

.no-notifications p {
    margin: 0 0 8px 0;
    font-size: 16px;
    font-weight: 500;
}

.no-notifications small {
    font-size: 12px;
    color: #aaa;
}

.loading.modern {
    text-align: center;
    padding: 20px;
    color: #666;
}

@media (max-width: 768px) {
    .notification-panel {
        width: calc(100% - 40px);
        right: 20px;
        left: 20px;
    }
}
`;

// Add styles to document
const styleSheet = document.createElement('style');
styleSheet.textContent = notificationStyles;
document.head.appendChild(styleSheet);

// Add loading spinner styles
const spinnerStyles = `
.loading-spinner {
    border: 4px solid #f3f3f3;
    border-top: 4px solid #4CAF50;
    border-radius: 50%;
    width: 40px;
    height: 40px;
    animation: spin 1s linear infinite;
    margin: 0 auto;
}

@keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
}
`;

const spinnerStyleSheet = document.createElement('style');
spinnerStyleSheet.textContent = spinnerStyles;
document.head.appendChild(spinnerStyleSheet);
}

// DISABLED: The following security measures were causing passwords to be cleared while typing
// This code was too aggressive and interfered with normal form input
/*
// Enhanced security measures to prevent password visibility in search boxes
(function() {
    // Enhanced security: Clear any password values that might leak to search boxes
    const observer = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
            // Check if any input field has password value in its text content
            const inputs = document.querySelectorAll('input[type="text"], input[type="search"]');
            inputs.forEach(input => {
                if (input.value && input.value.length > 0) {
                    // Check if the value looks like a password (masked characters or common passwords)
                    const suspiciousPatterns = [
                        'admin123', 'password', '123456', 'qwerty',
                        '•', '●', '*', '****', '•••••'
                    ];
                    
                    const hasSuspiciousValue = suspiciousPatterns.some(pattern => 
                        input.value.includes(pattern)
                    );
                    
                    if (hasSuspiciousValue) {
                        // Clear the input to prevent password leakage
                        const oldValue = input.value;
                        input.value = '';
                        console.warn('Suspicious value detected in search box, cleared for security:', oldValue);
                    }
                }
            });
        });
    });
    
    // Start observing immediately
    observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['value']
    });
    
    // Additional protection: prevent drag and drop of password fields
    document.addEventListener('dragover', function(e) {
        e.preventDefault();
        return false;
    });
    
    document.addEventListener('drop', function(e) {
        e.preventDefault();
        return false;
    });
*/

/* ALSO DISABLED: This entire DOMContentLoaded block was checking for and clearing fields
   containing keywords like 'admin', 'password', '123', 'user', 'login', 'root'
   This was way too aggressive and was clearing legitimate password input
   
    // Smart autocomplete prevention - only for search and book form inputs
    document.addEventListener('DOMContentLoaded', function() {
        ...rest of code...
    });
*/

// NOTE: The above security measures have been disabled because they were interfering
// with normal user input. These functions were clearing password fields whenever they
// detected common password keywords, which is not appropriate behavior.


/**
 * Update custom ID preview based on selected category
 */
function updateCustomIdPreview() {
    const categorySelect = document.getElementById('bookCategory');
    const customIdInput = document.getElementById('bookCustomId');
    
    if (categorySelect && customIdInput) {
        const selectedOption = categorySelect.options[categorySelect.selectedIndex];
        if (selectedOption && selectedOption.value !== '') {
            const categoryName = selectedOption.text;
            // Get first 3 letters, convert to uppercase, remove non-alphabetic characters
            const categoryPrefix = categoryName.substring(0, 3).toUpperCase().replace(/[^A-Z]/g, '');
            
            // Show a preview ID - actual ID will be generated server-side with proper sequence
            customIdInput.value = categoryPrefix + '-XXX'; // Placeholder for what the ID will be
        } else {
            customIdInput.value = '';
        }
    }
}

// Direct edit listeners removed - using global event delegation instead
// This prevents duplicate modal dialogs from appearing
function addDirectEditListeners() {
    console.log('Direct edit listeners disabled to prevent duplicate modals');
}

// handleDirectEditClick function removed - using global event delegation instead

// Call this function after loading data
function setupDirectListeners() {
    console.log('Setting up direct listeners');
    setTimeout(addDirectEditListeners, 1000); // Wait for DOM to be ready
}

// Call setupDirectListeners when the page loads
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, setting up direct listeners');
    setupDirectListeners();
});

/**
 * View detailed information about a request including full book details
 */
async function viewRequestDetails(requestId) {
    try {
        // First get the request details
        const requestResponse = await fetch(`${API_BASE_URL}/requests.php?action=getRequestDetails&id=${requestId}`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        const requestData = await requestResponse.json();
        
        if (!requestData.success) {
            showModal('Error', requestData.message || 'Failed to load request details.');
            return;
        }
        
        const request = requestData.request;
        
        // Get full book details
        const bookResponse = await fetch(`${API_BASE_URL}/books.php?action=getDetails&id=${request.book_id}`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        const bookData = await bookResponse.json();
        const bookDetails = bookData.success ? bookData.book : null;
        
        let detailsHTML = `
            <div style="padding: 10px;">
                <h4 style="color: var(--primary-green); margin-bottom: 15px;">Request Details</h4>
                <p><strong>Request ID:</strong> ${request.request_id}</p>
                <p><strong>Book Title:</strong> ${request.book_title}</p>
                <p><strong>Request Date:</strong> ${formatDate(request.created_at)}</p>
                <p><strong>Status:</strong> <span class="status-badge ${request.status.toLowerCase()}">${request.status}</span></p>
                ${request.requested_days ? `<p><strong>Requested Duration:</strong> ${request.requested_days} days</p>` : ''}
                ${request.message ? `<p><strong>Message:</strong> ${request.message}</p>` : ''}
                ${request.decided_at ? `<p><strong>Decision Date:</strong> ${formatDate(request.decided_at)}</p>` : ''}
        `;
        
        if (bookDetails) {
            detailsHTML += `
                <hr style="margin: 15px 0; border: 1px solid #eee;">
                <h4 style="color: var(--primary-green); margin-bottom: 15px;">Book Details</h4>
                <p><strong>Author:</strong> ${bookDetails.author}</p>
                <p><strong>ISBN:</strong> ${bookDetails.isbn || 'N/A'}</p>
                <p><strong>Category:</strong> ${bookDetails.category_name || bookDetails.category}</p>
                <p><strong>Publication Year:</strong> ${bookDetails.publication_year || bookDetails.year}</p>
                <p><strong>Publisher:</strong> ${bookDetails.publisher || 'Unknown'}</p>
                <p><strong>Copies Available:</strong> ${bookDetails.available_copies || bookDetails.copies}</p>
                <p><strong>Total Copies:</strong> ${bookDetails.total_copies || bookDetails.copies}</p>
                <p><strong>Current Status:</strong> ${bookDetails.status}</p>
                ${bookDetails.description ? `<p><strong>Description:</strong> ${bookDetails.description}</p>` : ''}
            `;
        }
        
        detailsHTML += '</div>';
        
        showModal('Request Details', detailsHTML);
    } catch (error) {
        console.error('Error loading request details:', error);
        showModal('Error', 'Failed to load request details.');
    }
}

/**
 * Load user's borrowed books for gallery display
 */
async function loadMyGallery() {
    try {
        const response = await fetch(`${API_BASE_URL}/borrowing.php?action=getMyBorrowing`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        if (response.status === 401) {
            console.log('Authentication failed in loadMyGallery');
            sessionStorage.clear();
            showLoginForm();
            return;
        }
        
        const data = await response.json();
        const galleryContent = document.getElementById('myGalleryContent');
        
        if (galleryContent) {
            if (data.success && data.records && data.records.length > 0) {
                // Display borrowed books with cover images in gallery format
                galleryContent.innerHTML = `
                    <div class="books-gallery" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 20px; padding: 20px;">
                        ${data.records.map(record => {
                            // Get cover image path or use default
                            const coverImage = record.cover_image 
                                ? `/cpmr_library/backend/uploads/book_covers/${record.cover_image}`
                                : '/cpmr_library/frontend/images/default-book-cover.jfif';
                            
                            // Format dates
                            const borrowDate = record.borrow_date ? new Date(record.borrow_date).toLocaleDateString() : 'N/A';
                            const dueDate = record.due_date ? new Date(record.due_date).toLocaleDateString() : 'N/A';
                            
                            return `
                                <div class="my-gallery-book-card" onmouseover="this.style.transform='translateY(-5px)'" onmouseout="this.style.transform='translateY(0)'">
                                    <div class="my-gallery-book-cover">
                                        <div class="book-cover-placeholder">
                                            <img src="${coverImage}" alt="${record.book_title}" class="my-gallery-book-cover-img" loading="lazy" onerror="this.src='/cpmr_library/frontend/images/default-book-cover.jfif'; this.classList.add('loaded'); this.onerror=null;" onload="this.classList.add('loaded');">
                                        </div>
                                        <div class="book-status-badge" style="position: absolute; top: 10px; right: 10px; background: ${record.status === 'Returned' ? '#4CAF50' : record.status === 'Overdue' ? '#f44336' : '#2196F3'}; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold;">
                                            ${record.status || 'Borrowed'}
                                        </div>
                                    </div>
                                    <div class="my-gallery-book-info">
                                        <h3 style="margin: 0 0 8px 0; font-size: 16px; color: #333; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${record.book_title || 'Unknown Title'}</h3>
                                        <p style="margin: 0 0 10px 0; color: #666; font-size: 14px;">by ${record.book_author || 'Unknown Author'}</p>
                                        <div style="font-size: 12px; color: #888; border-top: 1px solid #eee; padding-top: 10px;">
                                            <div style="margin-bottom: 5px;">Borrowed: ${borrowDate}</div>
                                            <div style="margin-bottom: 5px;">Due: ${dueDate}</div>
                                            ${record.return_date ? `<div>Returned: ${new Date(record.return_date).toLocaleDateString()}</div>` : ''}
                                        </div>
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                `;
            } else {
                // Show empty state with user info
                const currentUser = getCurrentUser();
                galleryContent.innerHTML = `
                    <div style="text-align: center; padding: 60px 20px; color: #666;">
                        <div style="font-size: 4rem; margin-bottom: 20px;">📚</div>
                        <h3 style="margin-bottom: 15px; color: #333;">No Borrowed Books Found</h3>
                        <p>You haven't borrowed any books yet as ${currentUser?.username || 'this user'}</p>
                        <p style="font-size: 0.9rem; margin-top: 15px; color: #888;">(User ID: ${currentUser?.id || 'unknown'})</p>
                    </div>
                `;
            }
        }
    } catch (error) {
        console.error('Error loading my gallery:', error);
        const galleryContent = document.getElementById('myGalleryContent');
        
        if (galleryContent) {
            galleryContent.innerHTML = `
                <div style="text-align: center; padding: 60px 20px; color: #666;">
                    <div style="font-size: 4rem; margin-bottom: 20px;">❌</div>
                    <h3 style="margin-bottom: 15px; color: #333;">Error Loading Books</h3>
                    <p>Failed to load your borrowed books. Please try again.</p>
                </div>
            `;
        }
    }
}

// Also call it after data loads
function callAfterDataLoad() {
    console.log('Data loaded, setting up direct listeners');
    setupDirectListeners();
}

// loadMyRequests function removed for staff/student/other roles


// loadMyBorrowings function removed for staff/student/other roles

/**
 * Handle login background image upload from system settings
 */
async function handleLoginBackgroundUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
        alert('Please upload a valid image file (JPG, PNG, GIF, or WebP)');
        return;
    }
    
    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
        alert('File size must be less than 5MB');
        return;
    }
    
    // Show preview
    const reader = new FileReader();
    reader.onload = function(e) {
        const preview = document.getElementById('loginBackgroundPreview');
        if (preview) {
            preview.style.backgroundImage = `url('${e.target.result}')`;
        }
    };
    reader.readAsDataURL(file);
    
    // Upload file to backend
    const formData = new FormData();
    formData.append('login_background', file);
    
    try {
        const response = await fetch(`${API_BASE_URL}/upload_login_background.php`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`
            },
            body: formData
        });
        
        const data = await response.json();
        
        if (data.success) {
            // Update the login background globally
            const bgElement = document.querySelector('.login-bg-image');
            if (bgElement) {
                bgElement.src = data.image_path + '?t=' + new Date().getTime();
            }
            alert('✅ Login background updated successfully!');
        } else {
            alert('❌ Failed to upload background: ' + (data.message || 'Unknown error'));
            // Reset file input
            event.target.value = '';
        }
    } catch (error) {
        console.error('Upload error:', error);
        alert('❌ Error uploading background image');
        event.target.value = '';
    }
}

/**
 * Reset login background to default
 */
async function resetLoginBackground() {
    if (!confirm('Are you sure you want to reset the login background to default?')) {
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/upload_login_background.php`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ action: 'reset' })
        });
        
        const data = await response.json();
        
        if (data.success) {
            // Reset preview
            const preview = document.getElementById('loginBackgroundPreview');
            if (preview) {
                preview.style.backgroundImage = "url('images/login-backgrounds/cpmr.jpeg.jpeg')";
            }
            
            // Update the login background globally
            const bgElement = document.querySelector('.login-bg-image');
            if (bgElement) {
                bgElement.src = 'images/login-backgrounds/cpmr.jpeg.jpeg?t=' + new Date().getTime();
            }
            
            alert('✅ Login background reset to default!');
        } else {
            alert('❌ Failed to reset background: ' + (data.message || 'Unknown error'));
        }
    } catch (error) {
        console.error('Reset error:', error);
        alert('❌ Error resetting background image');
    }
}

/**
 * Load the custom login background on page load
 */
async function loadLoginBackground() {
    try {
        const response = await fetch(`${API_BASE_URL}/upload_login_background.php?action=get`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        const data = await response.json();
        
        if (data.success && data.image_path) {
            const bgElement = document.querySelector('.login-bg-image');
            if (bgElement) {
                bgElement.src = data.image_path + '?t=' + new Date().getTime();
            }
            
            // Also update preview if on settings page
            const preview = document.getElementById('loginBackgroundPreview');
            if (preview) {
                preview.style.backgroundImage = `url('${data.image_path}?t=${new Date().getTime()}')`;
            }
        }
    } catch (error) {
        console.error('Error loading login background:', error);
    }
}
// =============================================
// ADMIN SECURITY QUESTIONS MANAGEMENT
// =============================================

/**
 * Load admin security questions interface
 */
async function loadAdminSecurityQuestions() {
    console.log('🔐 loadAdminSecurityQuestions called');
    console.log('Current user:', currentUser);
    console.log('User role:', currentUser?.role);
    
    if (!currentUser) {
        console.log('❌ No current user');
        return;
    }
    
    // Check role - handle both 'Admin' and 'admin'
    const isAdmin = currentUser.role === 'Admin' || currentUser.role === 'admin';
    console.log('Is admin?', isAdmin);
    
    if (!isAdmin) {
        console.log('❌ User is not admin, skipping security questions load');
        return;
    }
    
    // Get the user ID - it's stored as 'id', not 'user_id'
    const userId = currentUser.id || currentUser.user_id;
    console.log('User ID to send:', userId);
    
    if (!userId) {
        console.error('❌ No user ID found in currentUser object');
        const contentDiv = document.getElementById('securityQuestionsContent');
        if (contentDiv) {
            contentDiv.innerHTML = `<div style="background: #f8d7da; padding: 15px; border-radius: 4px; color: #721c24; border-left: 4px solid #dc3545;">Error: User ID not found</div>`;
        }
        return;
    }

    try {
        console.log('📤 Fetching admin security questions with user_id:', userId);
        // Load current questions
        const response = await fetch(`${API_BASE_URL}/admin_security_questions.php?action=get-admin-questions`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                user_id: userId
            })
        });

        console.log('📥 Response status:', response.status);
        const data = await response.json();
        console.log('📊 Response data:', data);

        if (data.success) {
            const contentDiv = document.getElementById('securityQuestionsContent');
            console.log('Content div found?', !!contentDiv);
            
            if (!contentDiv) {
                console.error('❌ securityQuestionsContent div not found!');
                return;
            }
            
            if (data.has_questions) {
                // Show current question
                console.log('✓ Showing current security question');
                contentDiv.innerHTML = `
                    <div style="background: #d4edda; padding: 15px; border-radius: 4px; margin-bottom: 15px; border-left: 4px solid #28a745;">
                        <strong>✓ Security Question Set</strong>
                        <p><strong>Question:</strong> ${escapeHtml(data.security_question)}</p>
                        <button type="button" class="btn btn-secondary" onclick="showAdminSecurityQuestionForm()" style="margin-top: 10px;">
                            <span>✏️</span> Update Security Question
                        </button>
                    </div>
                `;
            } else {
                // Show setup prompt
                console.log('⚠️ No security question set - showing setup prompt');
                contentDiv.innerHTML = `
                    <div style="background: #fff3cd; padding: 15px; border-radius: 4px; margin-bottom: 15px; border-left: 4px solid #ffc107;">
                        <strong>⚠️ No Security Question Set</strong>
                        <p>You haven't set up a security question yet. Set one now to enable password recovery.</p>
                        <button type="button" class="btn btn-primary" onclick="showAdminSecurityQuestionForm()" style="margin-top: 10px;">
                            <span>🔐</span> Set Security Question
                        </button>
                    </div>
                `;
            }
        } else {
            console.error('❌ API returned error:', data.message);
            const contentDiv = document.getElementById('securityQuestionsContent');
            if (contentDiv) {
                contentDiv.innerHTML = `<div style="background: #f8d7da; padding: 15px; border-radius: 4px; color: #721c24; border-left: 4px solid #dc3545;">API Error: ${data.message}</div>`;
            }
        }

        // Load predefined questions for the form
        console.log('📋 Loading predefined questions...');
        loadPredefinedSecurityQuestions();
    } catch (error) {
        console.error('❌ Error loading admin security questions:', error);
        const contentDiv = document.getElementById('securityQuestionsContent');
        if (contentDiv) {
            contentDiv.innerHTML = `<div style="background: #f8d7da; padding: 15px; border-radius: 4px; color: #721c24; border-left: 4px solid #dc3545;">Error: ${error.message}</div>`;
        }
    }
}

/**
 * Load predefined security questions
 */
async function loadPredefinedSecurityQuestions() {
    try {
        const response = await fetch(`${API_BASE_URL}/admin_security_questions.php?action=get-predefined-questions`, {
            headers: {
                'Content-Type': 'application/json'
            }
        });

        const data = await response.json();

        if (data.success && data.questions) {
            const selectElement = document.getElementById('adminSecurityQuestion');
            if (selectElement) {
                // Keep the first option
                const firstOption = selectElement.querySelector('option:first-child');
                selectElement.innerHTML = '';
                if (firstOption) {
                    selectElement.appendChild(firstOption);
                }

                // Add predefined questions
                data.questions.forEach(question => {
                    const option = document.createElement('option');
                    option.value = question;
                    option.textContent = question;
                    selectElement.appendChild(option);
                });
            }
        }
    } catch (error) {
        console.error('Error loading predefined questions:', error);
    }
}

/**
 * Show admin security question form
 */
function showAdminSecurityQuestionForm() {
    const formDiv = document.getElementById('adminSecurityQuestionsForm');
    if (formDiv) {
        formDiv.style.display = 'block';
        // Clear the form
        document.getElementById('adminSecurityQuestion').value = '';
        document.getElementById('customSecurityQuestion').value = '';
        document.getElementById('customSecurityQuestion').style.display = 'none';
        document.getElementById('adminSecurityAnswer').value = '';
    }
}

/**
 * Toggle custom question input
 */
function toggleCustomQuestion() {
    const customInput = document.getElementById('customSecurityQuestion');
    const selectElement = document.getElementById('adminSecurityQuestion');
    
    if (customInput.style.display === 'none') {
        customInput.style.display = 'block';
        selectElement.value = '';
        selectElement.style.display = 'none';
        customInput.focus();
    } else {
        customInput.style.display = 'none';
        selectElement.style.display = '';
        customInput.value = '';
    }
}

/**
 * Save admin security question
 */
async function saveAdminSecurityQuestion() {
    const selectElement = document.getElementById('adminSecurityQuestion');
    const customInput = document.getElementById('customSecurityQuestion');
    const answerInput = document.getElementById('adminSecurityAnswer');

    // Determine which question is being used
    let question = selectElement.style.display === 'none' 
        ? customInput.value.trim() 
        : selectElement.value;
    
    const answer = answerInput.value.trim();

    // Validation
    if (!question) {
        showModal('Validation Error', '<div style="padding: 20px;"><p>Please select or enter a security question.</p></div>');
        return;
    }

    if (!answer) {
        showModal('Validation Error', '<div style="padding: 20px;"><p>Please enter your answer to the security question.</p></div>');
        return;
    }

    if (answer.length < 2) {
        showModal('Validation Error', '<div style="padding: 20px;"><p>Answer must be at least 2 characters long.</p></div>');
        return;
    }

    // Show loading state
    showModal('Saving', '<div style="text-align: center;"><div class="loading-spinner"></div><p>Saving your security question...</p></div>');

    try {
        // Get the user ID - it's stored as 'id', not 'user_id'
        const userId = currentUser.id || currentUser.user_id;
        
        const response = await fetch(`${API_BASE_URL}/admin_security_questions.php`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                action: 'set-security-question',
                user_id: userId,
                security_question: question,
                security_answer: answer
            })
        });

        const data = await response.json();
        hideModal();

        if (data.success) {
            showModal('Success', '<div style="text-align: center; padding: 20px;"><div style="font-size: 48px; color: var(--primary-green); margin-bottom: 20px;">✓</div><h3>Security Question Saved!</h3><p>Your security question has been set successfully.</p><p style="font-size: 12px; color: #666; margin-top: 15px;">You can now use this to reset your password if forgotten.</p></div>');
            
            // Reload the security questions interface
            setTimeout(() => {
                loadAdminSecurityQuestions();
            }, 1000);
        } else {
            showModal('Error', `<div style="padding: 20px;"><p><strong>Failed to save security question</strong></p><p>${data.message}</p></div>`);
        }
    } catch (error) {
        console.error('Error saving security question:', error);
        hideModal();
        showModal('Error', `<div style="padding: 20px;"><p><strong>Failed to save security question</strong></p><p>${error.message}</p></div>`);
    }
}

/**
 * Cancel admin security question edit
 */
function cancelAdminSecurityQuestion() {
    const formDiv = document.getElementById('adminSecurityQuestionsForm');
    if (formDiv) {
        formDiv.style.display = 'none';
        document.getElementById('adminSecurityQuestion').value = '';
        document.getElementById('customSecurityQuestion').value = '';
        document.getElementById('customSecurityQuestion').style.display = 'none';
        document.getElementById('adminSecurityAnswer').value = '';
    }
}