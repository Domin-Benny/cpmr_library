<?php
// =============================================
// Books Management API
// File: backend/api/books.php
// Description: Handle all book-related operations
// =============================================

header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");

// Use absolute path for web server compatibility
$basePath = __DIR__ . '/../../';
require_once $basePath . 'config/database.php';
require_once 'auth_helper.php'; // For authentication functions

// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Check authentication for all requests except GET (for retrieving data)
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    $user = isAuthenticated();
    if (!$user) {
        http_response_code(401);
        echo json_encode([
            'success' => false,
            'message' => 'Authentication required'
        ]);
        exit();
    }
    // Only Admin and Librarian can perform write actions on books
    if (!requireRole($user, ['Admin', 'Librarian'])) {
        http_response_code(403);
        echo json_encode([
            'success' => false,
            'message' => 'Access denied. Only Admin and Librarian can perform this action.'
        ]);
        exit();
    }
} else {
    // For GET requests, we still check authentication but don't require it
    $user = isAuthenticated();
}

$showWarning = false;

// Check if this is a sensitive action that should show warning
if (($_SERVER['REQUEST_METHOD'] !== 'GET') || 
    (isset($_GET['action']) && in_array($_GET['action'], ['getDetails', 'update', 'delete']))) {
    $showWarning = true;
    // Log the action for monitoring
    if (isset($user) && $user) {
        error_log("Book action performed by user {$user['username']} - Action: " . ($_GET['action'] ?? 'unknown'));
    } else {
        error_log("WARNING: Book action performed without authentication - Action: " . ($_GET['action'] ?? 'unknown'));
    }
}

// Get action parameter - only from GET for initial setting
$action = isset($_GET['action']) ? $_GET['action'] : '';

try {
    $database = new Database();
    $conn = $database->getConnection();

    error_log("Books API called with method: " . $_SERVER['REQUEST_METHOD']);
    error_log("Books API action parameter: " . $action);
    error_log("Books API POST data: " . json_encode($_POST));
    error_log("Books API FILES data: " . json_encode($_FILES));
    
    switch ($_SERVER['REQUEST_METHOD']) {
        case 'GET':
            error_log("Handling GET request");
            handleGetRequest($conn, $action);
            break;
            
        case 'POST':
            error_log("Handling POST request");
            // For POST requests, determine action from POST data if available
            $postAction = $_POST['action'] ?? $action;
            error_log("POST action: " . $postAction);
            error_log("User ID: " . ($user ? $user['user_id'] : 'null'));
            handlePostRequest($conn, $postAction, $user ? $user['user_id'] : null);
            break;
            
        case 'PUT':
            // Map PUT to updateBook via handlePostRequest logic or similar
            $data = json_decode(file_get_contents("php://input"), true);
            updateBook($conn, $data, $user ? $user['user_id'] : null);
            break;
            
        case 'DELETE':
            // Extract ID from query string for DELETE requests
            $id = isset($_GET['id']) ? $_GET['id'] : 0;
            // Pass 'delete' as action for DELETE method
            handleDeleteRequest($conn, 'delete', $user ? $user['user_id'] : null, $id);
            break;
            
        default:
            http_response_code(405);
            echo json_encode([
                'success' => false,
                'message' => 'Method not allowed'
            ]);
    }
} catch (Exception $e) {
    error_log("Books API error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Internal server error: ' . $e->getMessage()
    ]);
} finally {
    if (isset($conn)) {
        $database->closeConnection();
    }
}

// =============================================
// GET Request Handlers
// =============================================

function handleGetRequest($conn, $action) {
    switch ($action) {
        case 'getAll':
            getAllBooks($conn);
            break;
            
        case 'getRecent':
            $limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 10;
            getRecentBooks($conn, $limit);
            break;
            
        case 'getDetails':
            $id = isset($_GET['id']) ? $_GET['id'] : 0;
            getBookDetails($conn, $id);
            break;
            
        case 'getAvailableBooks':
            getAvailableBooks($conn);
            break;
            
        case 'search':
            $searchTerm = isset($_GET['q']) ? $_GET['q'] : '';
            searchBooks($conn, $searchTerm);
            break;
            
        default:
            http_response_code(400);
            echo json_encode([
                'success' => false,
                'message' => 'Invalid action'
            ]);
    }
}

function getAllBooks($conn) {
    // support simple pagination for faster loading
    $limit = isset($_GET['limit']) ? (int)$_GET['limit'] : null;
    $offset = isset($_GET['offset']) ? (int)$_GET['offset'] : 0;

    $sql = "SELECT 
                b.book_id as id,
                b.custom_id,
                b.title,
                b.author,
                b.isbn,
                c.name as category_name,
                c.category_id,
                b.shelf,
                b.publication_year as year,
                b.publisher,
                b.description,
                b.total_copies,
                b.available_copies,
                b.status,
                b.cover_image,
                b.created_at as added_date
            FROM books b
            LEFT JOIN categories c ON b.category_id = c.category_id
            ORDER BY b.created_at DESC";

    if ($limit !== null) {
        $sql .= " LIMIT :limit OFFSET :offset";
    }
    
    $stmt = $conn->prepare($sql);
    if ($limit !== null) {
        $stmt->bindParam(':limit', $limit, PDO::PARAM_INT);
        $stmt->bindParam(':offset', $offset, PDO::PARAM_INT);
    }
    $stmt->execute();
    
    $books = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    echo json_encode([
        'success' => true,
        'books' => $books,
        'count' => count($books)
    ]);
}

function getRecentBooks($conn, $limit = 10) {
    $sql = "SELECT 
                b.book_id as id,
                b.custom_id,
                b.title,
                b.author,
                b.isbn,
                c.name as category_name,
                b.publication_year as year,
                b.status,
                b.cover_image,
                b.created_at as added_date
            FROM books b
            LEFT JOIN categories c ON b.category_id = c.category_id
            ORDER BY b.created_at DESC
            LIMIT :limit";
    
    $stmt = $conn->prepare($sql);
    $stmt->bindParam(':limit', $limit, PDO::PARAM_INT);
    $stmt->execute();
    
    $books = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    echo json_encode([
        'success' => true,
        'books' => $books
    ]);
}

function getBookDetails($conn, $id) {
    if (!$id) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'message' => 'Book ID is required'
        ]);
        return;
    }
    
    // Check if the ID is a custom_id (string) or database ID (integer)
    if (is_numeric($id)) {
        // It's a database ID
        $sql = "SELECT 
                    b.book_id,
                    b.custom_id,
                    b.title,
                    b.author,
                    b.isbn,
                    c.name as category_name,
                    c.category_id,
                    b.publication_year,
                    b.publisher,
                    b.description,
                    b.total_copies,
                    b.available_copies,
                    b.status,
                    b.cover_image,
                    b.created_at,
                    b.updated_at
                FROM books b
                LEFT JOIN categories c ON b.category_id = c.category_id
                WHERE b.book_id = :id";
        $stmt = $conn->prepare($sql);
        $stmt->bindParam(':id', $id, PDO::PARAM_INT);
    } else {
        // It's a custom_id
        $sql = "SELECT 
                    b.book_id,
                    b.custom_id,
                    b.title,
                    b.author,
                    b.isbn,
                    c.name as category_name,
                    c.category_id,
                    b.publication_year,
                    b.publisher,
                    b.description,
                    b.total_copies,
                    b.available_copies,
                    b.status,
                    b.cover_image,
                    b.created_at,
                    b.updated_at
                FROM books b
                LEFT JOIN categories c ON b.category_id = c.category_id
                WHERE b.custom_id = :id";
        $stmt = $conn->prepare($sql);
        $stmt->bindParam(':id', $id, PDO::PARAM_STR);
    }
    
    $stmt->execute();
    
    if ($stmt->rowCount() > 0) {
        $book = $stmt->fetch(PDO::FETCH_ASSOC);
        
        echo json_encode([
            'success' => true,
            'book' => $book
        ]);
    } else {
        http_response_code(404);
        echo json_encode([
            'success' => false,
            'message' => 'Book not found'
        ]);
    }
}

function searchBooks($conn, $searchTerm) {
    $sql = "SELECT 
                b.book_id as id,
                b.custom_id,
                b.title,
                b.author,
                b.isbn,
                c.name as category_name,
                b.publication_year as year,
                b.status,
                b.available_copies,
                b.cover_image
            FROM books b
            LEFT JOIN categories c ON b.category_id = c.category_id
            WHERE b.title LIKE :search 
               OR b.author LIKE :search 
               OR b.isbn LIKE :search 
               OR c.name LIKE :search
            ORDER BY b.title";
    
    $stmt = $conn->prepare($sql);
    $searchParam = "%$searchTerm%";
    $stmt->bindParam(':search', $searchParam);
    $stmt->execute();
    
    $books = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    echo json_encode([
        'success' => true,
        'books' => $books,
        'count' => count($books)
    ]);
}

/**
 * Get count of available books
 * @param PDO $conn - Database connection
 */
function getAvailableBooks($conn) {
    $sql = "SELECT 
                COUNT(*) as count
            FROM books 
            WHERE available_copies > 0";
    
    $stmt = $conn->prepare($sql);
    $stmt->execute();
    
    $result = $stmt->fetch(PDO::FETCH_ASSOC);
    
    echo json_encode([
        'success' => true,
        'count' => (int)$result['count']
    ]);
}

// =============================================
// POST Request Handlers
// =============================================

function handlePostRequest($conn, $action, $userId) {
    error_log("handlePostRequest called with action: " . $action . ", userId: " . $userId);
    error_log("handlePostRequest POST data: " . json_encode($_POST));
    error_log("handlePostRequest FILES data: " . json_encode($_FILES));
    
    // Handle multipart/form-data (file uploads) vs JSON data
    if (!empty($_FILES)) {
        // Use $_POST data for form submissions
        $data = $_POST;
        error_log("Initial POST data: " . json_encode($_POST));
        
        // Handle cover image upload if provided
        if (isset($_FILES['cover_image_file']) && $_FILES['cover_image_file']['error'] === UPLOAD_ERR_OK) {
            $file = $_FILES['cover_image_file'];
            error_log("Processing cover image file: " . $file['name']);
            error_log("File type reported: " . $file['type']);
            
            // Accept any image file type
            $extension = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
            
            // Common image extensions
            $allowedExtensions = [
                'jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg', 'tiff', 'ico', 'heic', 'heif'
            ];
            
            // Check if it's an image by MIME type or extension
            $isImage = false;
            
            // Check MIME type
            if (strpos($file['type'], 'image/') === 0) {
                $isImage = true;
                error_log("Valid image MIME type: " . $file['type']);
            }
            
            // Check extension
            if (in_array($extension, $allowedExtensions)) {
                $isImage = true;
                error_log("Valid image extension: " . $extension);
            }
            
            // Additional check using finfo if available
            if (!$isImage && function_exists('finfo_file')) {
                $finfo = finfo_open(FILEINFO_MIME_TYPE);
                $mimeType = finfo_file($finfo, $file['tmp_name']);
                finfo_close($finfo);
                error_log("MIME type detected by finfo: " . $mimeType);
                if (strpos($mimeType, 'image/') === 0) {
                    $isImage = true;
                }
            }
            
            if (!$isImage) {
                error_log("Invalid file type: " . $file['type'] . ", extension: " . $extension);
                http_response_code(400);
                echo json_encode([
                    'success' => false,
                    'message' => 'Invalid file. Please upload an image file (JPG, PNG, GIF, BMP, WebP, etc.)'
                ]);
                return;
            }
            
            // Validate file size (max 10MB for more flexibility)
            if ($file['size'] > 10 * 1024 * 1024) {
                error_log("File too large: " . $file['size']);
                http_response_code(400);
                echo json_encode([
                    'success' => false,
                    'message' => 'File size too large. Maximum size is 10MB.'
                ]);
                return;
            }
            
            // Create uploads directory if it doesn't exist
            $uploadDir = __DIR__ . '/../uploads/book_covers/';
            if (!is_dir($uploadDir)) {
                mkdir($uploadDir, 0755, true);
            }
            
            // Generate unique filename
            $extension = pathinfo($file['name'], PATHINFO_EXTENSION);
            $filename = 'book_cover_' . uniqid() . '_' . time() . '.' . $extension;
            $filePath = $uploadDir . $filename;
            
            // Move uploaded file
            if (move_uploaded_file($file['tmp_name'], $filePath)) {
                // Add filename to data
                $data['cover_image'] = $filename;
                error_log("Cover image uploaded successfully. Data now: " . json_encode($data));
            } else {
                error_log("Failed to move uploaded file to: " . $filePath);
                http_response_code(500);
                echo json_encode([
                    'success' => false,
                    'message' => 'Failed to save uploaded file'
                ]);
                return;
            }
        }
    } else {
        // Handle JSON data - only if there's actual JSON content
        $input = file_get_contents("php://input");
        if (!empty($input)) {
            $data = json_decode($input, true);
            
            // Check if JSON decoding was successful
            if (json_last_error() !== JSON_ERROR_NONE) {
                http_response_code(400);
                echo json_encode([
                    'success' => false,
                    'message' => 'Invalid JSON data: ' . json_last_error_msg()
                ]);
                return;
            }
        } else {
            // No JSON data provided, use empty array
            $data = [];
        }
    }
    
    // Log incoming request data for debugging
    error_log("Books API handlePostRequest: action={$action}, userId={$userId}, POST_DATA=" . json_encode($_POST) . ", FILES_DATA=" . json_encode($_FILES) . ", INPUT_DATA=" . file_get_contents('php://input') . ", data=" . json_encode($data));
    
    // If we have POST data and data is empty, use POST data
    if (!empty($_POST) && empty($data)) {
        $data = $_POST;
        error_log("Using POST data as main data source: " . json_encode($data));
    }
    
    switch ($action) {
        case 'add':
            addBook($conn, $data, $userId);
            break;
            
        case 'update':
            updateBook($conn, $data, $userId);
            break;
            
        case 'delete':
            // For delete via POST, get ID from data
            $deleteId = isset($data['id']) ? $data['id'] : (isset($_GET['id']) ? $_GET['id'] : 0);
            handleDeleteRequest($conn, 'delete', $userId, $deleteId);
            break;
            
        default:
            http_response_code(400);
            echo json_encode([
                'success' => false,
                'message' => 'Invalid action: ' . $action
            ]);
    }
}

function addBook($conn, $data, $userId) {
    // Validate required fields
    $requiredFields = ['title', 'author', 'category_id', 'copies'];
    foreach ($requiredFields as $field) {
        if (!isset($data[$field]) || empty($data[$field])) {
            http_response_code(400);
            echo json_encode([
                'success' => false,
                'message' => "Missing required field: $field"
            ]);
            return;
        }
    }
    
    try {
        $conn->beginTransaction();
        
        // Validate category_id exists
        $categoryId = $data['category_id'];
        error_log("Validating category ID: " . $categoryId . " (type: " . gettype($categoryId) . ")");
        
        // Ensure category_id is an integer
        if (!is_numeric($categoryId)) {
            error_log("Category ID is not numeric: " . $categoryId);
            http_response_code(400);
            echo json_encode([
                'success' => false,
                'message' => 'Invalid category ID format. Must be a number.'
            ]);
            return;
        }
        
        $categoryId = (int)$categoryId;
        
        $validateSql = "SELECT category_id FROM categories WHERE category_id = :category_id";
        $validateStmt = $conn->prepare($validateSql);
        $validateStmt->bindParam(':category_id', $categoryId, PDO::PARAM_INT);
        $validateStmt->execute();
        
        $categoryExists = $validateStmt->fetch();
        error_log("Category exists result: " . ($categoryExists ? "true" : "false") . " for ID: " . $categoryId);
        
        if (!$categoryExists) {
            // Log all available categories for debugging
            $allCategoriesSql = "SELECT category_id, name FROM categories";
            $allCategoriesStmt = $conn->prepare($allCategoriesSql);
            $allCategoriesStmt->execute();
            $allCategories = $allCategoriesStmt->fetchAll(PDO::FETCH_ASSOC);
            error_log("All categories: " . json_encode($allCategories));
            
            http_response_code(400);
            echo json_encode([
                'success' => false,
                'message' => 'Invalid category ID. The specified category does not exist. Provided ID: ' . $categoryId . '. Available categories: ' . json_encode($allCategories)
            ]);
            return;
        }
        
        $sql = "INSERT INTO books (
                    title, author, isbn, category_id, shelf, publication_year, 
                    publisher, description, total_copies, available_copies, 
                    status, added_by, cover_image
                ) VALUES (
                    :title, :author, :isbn, :category_id, :shelf, :year,
                    :publisher, :description, :copies, :copies,
                    'Available', :added_by, :cover_image
                )";
        
        $stmt = $conn->prepare($sql);
        
        $stmt->bindParam(':title', $data['title']);
        $stmt->bindParam(':author', $data['author']);
        $stmt->bindParam(':isbn', $data['isbn']);
        $stmt->bindParam(':category_id', $data['category_id'], PDO::PARAM_INT);
        $shelf = $data['shelf'] ?? null;
        $stmt->bindParam(':shelf', $shelf);
        $stmt->bindParam(':year', $data['year']);
        $stmt->bindParam(':publisher', $data['publisher']);
        $stmt->bindParam(':description', $data['description']);
        $stmt->bindParam(':copies', $data['copies'], PDO::PARAM_INT);
        $stmt->bindParam(':added_by', $userId, PDO::PARAM_INT);
        $coverImage = $data['cover_image'] ?? null;
        $stmt->bindParam(':cover_image', $coverImage);
        
        $stmt->execute();
        
        $bookId = $conn->lastInsertId();
        
        // Log activity
        logActivity($conn, $userId, 'ADD', 'books', $bookId, "Added book: {$data['title']}");
        
        $conn->commit();
        
        echo json_encode([
            'success' => true,
            'message' => 'Book added successfully',
            'book_id' => $bookId
        ]);
    } catch (Exception $e) {
        $conn->rollBack();
        throw $e;
    }
}

function updateBook($conn, $data, $userId) {
    error_log("updateBook called with data: " . json_encode($data));
    error_log("updateBook called with userId: " . $userId);
    
    if (!isset($data['book_id'])) {
        error_log("Book ID missing in update request");
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'message' => 'Book ID is required'
        ]);
        return;
    }
    
    $bookId = $data['book_id'];
    
    // Check if the ID is a custom_id (string) or database ID (integer)
    if (is_numeric($bookId)) {
        // It's a database ID
        $whereClause = "book_id = :book_id";
        $paramType = PDO::PARAM_INT;
    } else {
        // It's a custom_id
        $whereClause = "custom_id = :book_id";
        $paramType = PDO::PARAM_STR;
    }
    
    try {
        $conn->beginTransaction();
        
        // Build update query dynamically based on provided fields
        $updates = [];
        $params = ['book_id' => $bookId];
        
        $allowedFields = [
            'title', 'author', 'isbn', 'category_id', 'shelf', 'publication_year',
            'publisher', 'description', 'total_copies', 'status', 'cover_image'
        ];
        
        // Log the data being received for debugging
        error_log("Update book data: " . json_encode($data));
        
        foreach ($allowedFields as $field) {
            if (isset($data[$field]) && $field !== 'custom_id') {  // Exclude custom_id from updates
                $updates[] = "$field = :$field";
                $params[$field] = $data[$field];
            }
        }
        
        if (empty($updates)) {
            http_response_code(400);
            echo json_encode([
                'success' => false,
                'message' => 'No fields to update'
            ]);
            return;
        }
        
        $sql = "UPDATE books SET " . implode(', ', $updates) . " WHERE " . $whereClause;
        
        // If category_id is being updated, validate it exists
        if (isset($params['category_id'])) {
            $categoryId = $params['category_id'];
            $validateSql = "SELECT category_id FROM categories WHERE category_id = :category_id";
            $validateStmt = $conn->prepare($validateSql);
            $validateStmt->bindParam(':category_id', $categoryId, PDO::PARAM_INT);
            $validateStmt->execute();
            
            if (!$validateStmt->fetch()) {
                $conn->rollBack();
                http_response_code(400);
                echo json_encode([
                    'success' => false,
                    'message' => 'Invalid category ID. The specified category does not exist.'
                ]);
                return;
            }
        }
        
        $stmt = $conn->prepare($sql);
        foreach ($params as $key => $value) {
            $paramType = is_int($value) ? PDO::PARAM_INT : PDO::PARAM_STR;
            $stmt->bindValue(":$key", $value, $paramType);
        }
        
        $result = $stmt->execute();
        
        if (!$result) {
            $conn->rollBack();
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => 'Failed to update book in database'
            ]);
            return;
        }
        
        // Log activity
        if (function_exists('logActivity')) {
            logActivity($conn, $userId, 'UPDATE', 'books', $data['book_id'], "Updated book details");
        }
        
        $conn->commit();
        
        echo json_encode([
            'success' => true,
            'message' => 'Book updated successfully'
        ]);
    } catch (Exception $e) {
        $conn->rollBack();
        error_log("Error updating book: " . $e->getMessage());
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'message' => 'Error updating book: ' . $e->getMessage()
        ]);
    }
}

// =============================================
// DELETE Request Handler
// =============================================

function handleDeleteRequest($conn, $action, $userId, $id = null) {
    if ($action !== 'delete') {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'message' => 'Invalid action'
        ]);
        return;
    }
    
    // Use provided ID or fallback to GET parameter
    $id = $id ?: (isset($_GET['id']) ? $_GET['id'] : 0);
    
    if (!$id) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'message' => 'Book ID is required'
        ]);
        return;
    }
    
    try {
        // Check if book has active borrowings
        $checkSql = "SELECT COUNT(*) as active_borrowings 
                     FROM borrowing_records 
                     WHERE book_id = :book_id AND status = 'Active'";
        
        $checkStmt = $conn->prepare($checkSql);
        $checkStmt->bindParam(':book_id', $id, PDO::PARAM_INT);
        $checkStmt->execute();
        $result = $checkStmt->fetch(PDO::FETCH_ASSOC);
        
        if ($result['active_borrowings'] > 0) {
            http_response_code(400);
            echo json_encode([
                'success' => false,
                'message' => 'Cannot delete book with active borrowings'
            ]);
            return;
        }
        
        // Check if the ID is a custom_id (string) or database ID (integer)
        if (is_numeric($id)) {
            // It's a database ID
            $whereClause = "book_id = :book_id";
            $paramType = PDO::PARAM_INT;
        } else {
            // It's a custom_id
            $whereClause = "custom_id = :book_id";
            $paramType = PDO::PARAM_STR;
        }
        
        $conn->beginTransaction();
        
        // Get book title for logging
        $getBookSql = "SELECT title, book_id FROM books WHERE " . $whereClause;
        $getBookStmt = $conn->prepare($getBookSql);
        $getBookStmt->bindParam(':book_id', $id, $paramType);
        $getBookStmt->execute();
        $book = $getBookStmt->fetch(PDO::FETCH_ASSOC);
        
        // Delete the book
        $deleteSql = "DELETE FROM books WHERE " . $whereClause;
        $deleteStmt = $conn->prepare($deleteSql);
        $deleteStmt->bindParam(':book_id', $id, $paramType);
        $deleteStmt->execute();
        
        if ($deleteStmt->rowCount() > 0) {
            // Log activity
            logActivity($conn, $userId, 'DELETE', 'books', $book['book_id'], "Deleted book: {$book['title']}");
            
            $conn->commit();
            
            echo json_encode([
                'success' => true,
                'message' => 'Book deleted successfully'
            ]);
        } else {
            $conn->rollBack();
            http_response_code(404);
            echo json_encode([
                'success' => false,
                'message' => 'Book not found'
            ]);
        }
    } catch (Exception $e) {
        $conn->rollBack();
        throw $e;
    }
}
