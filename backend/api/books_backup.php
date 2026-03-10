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

// Check authentication for all requests except GET (optional)
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
        exit();
    }
}

// Get action parameter - only from GET for initial setting
$action = isset($_GET['action']) ? $_GET['action'] : '';

try {
    $database = new Database();
    $conn = $database->getConnection();

    switch ($_SERVER['REQUEST_METHOD']) {
        case 'GET':
            handleGetRequest($conn, $action);
            break;
            
        case 'POST':
            // For POST requests, action will be determined inside handlePostRequest
            // Pass the URL action as default, but handlePostRequest will override if POST data has action
            handlePostRequest($conn, $action, $user['user_id']);
            break;
            
        case 'PUT':
            // Map PUT to updateBook via handlePostRequest logic or similar
            $data = json_decode(file_get_contents("php://input"), true);
            updateBook($conn, $data, $user['user_id']);
            break;
            
        case 'DELETE':
            handleDeleteRequest($conn, $action, $user['user_id']);
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
    $sql = "SELECT 
                b.book_id as id,
                b.title,
                b.author,
                b.isbn,
                c.name as category_name,
                c.category_id,
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
    
    $stmt = $conn->prepare($sql);
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
    
    $sql = "SELECT 
                b.book_id,
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
    // Get action from POST data if not provided via URL
    if (empty($action) && isset($_POST['action'])) {
        $action = $_POST['action'];
    }
    
    // Handle multipart/form-data (file uploads) vs JSON data
    if (!empty($_FILES)) {
        // Use $_POST data for form submissions
        $data = $_POST;
        
        // Handle cover image upload if provided
        if (isset($_FILES['cover_image_file']) && $_FILES['cover_image_file']['error'] === UPLOAD_ERR_OK) {
            $file = $_FILES['cover_image_file'];
            
            // Validate file type
            $allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
            if (!in_array($file['type'], $allowedTypes)) {
                http_response_code(400);
                echo json_encode([
                    'success' => false,
                    'message' => 'Invalid file type. Only JPEG, PNG, and GIF images are allowed.'
                ]);
                return;
            }
            
            // Validate file size (max 5MB)
            if ($file['size'] > 5 * 1024 * 1024) {
                http_response_code(400);
                echo json_encode([
                    'success' => false,
                    'message' => 'File size too large. Maximum size is 5MB.'
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
            } else {
                http_response_code(500);
                echo json_encode([
                    'success' => false,
                    'message' => 'Failed to save uploaded file'
                ]);
                return;
            }
        }
    } else {
        // Handle JSON data
        $input = file_get_contents("php://input");
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
    }
    
    // Log incoming request data for debugging
    error_log("Books API handlePostRequest: action={$action}, userId={$userId}, POST_DATA=" . print_r($_POST, true) . ", FILES_DATA=" . print_r($_FILES, true) . ", data=" . print_r($data, true));
    
    switch ($action) {
        case 'add':
            addBook($conn, $data, $userId);
            break;
            
        case 'update':
            updateBook($conn, $data, $userId);
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
        $validateSql = "SELECT category_id FROM categories WHERE category_id = :category_id";
        $validateStmt = $conn->prepare($validateSql);
        $validateStmt->bindParam(':category_id', $categoryId, PDO::PARAM_INT);
        $validateStmt->execute();
        
        if (!$validateStmt->fetch()) {
            http_response_code(400);
            echo json_encode([
                'success' => false,
                'message' => 'Invalid category ID. The specified category does not exist.'
            ]);
            return;
        }
        
        $sql = "INSERT INTO books (
                    title, author, isbn, category_id, publication_year, 
                    publisher, description, total_copies, available_copies, 
                    status, added_by, cover_image
                ) VALUES (
                    :title, :author, :isbn, :category_id, :year,
                    :publisher, :description, :copies, :copies,
                    'Available', :added_by, :cover_image
                )";
        
        $stmt = $conn->prepare($sql);
        
        $stmt->bindParam(':title', $data['title']);
        $stmt->bindParam(':author', $data['author']);
        $stmt->bindParam(':isbn', $data['isbn']);
        $stmt->bindParam(':category_id', $data['category_id'], PDO::PARAM_INT);
        $stmt->bindParam(':year', $data['year']);
        $stmt->bindParam(':publisher', $data['publisher']);
        $stmt->bindParam(':description', $data['description']);
        $stmt->bindParam(':copies', $data['copies'], PDO::PARAM_INT);
        $stmt->bindParam(':added_by', $userId, PDO::PARAM_INT);
        $stmt->bindParam(':cover_image', $data['cover_image'] ?? null);
        
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
    if (!isset($data['book_id'])) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'message' => 'Book ID is required'
        ]);
        return;
    }
    
    try {
        $conn->beginTransaction();
        
        // Build update query dynamically based on provided fields
        $updates = [];
        $params = ['book_id' => $data['book_id']];
        
        $allowedFields = [
            'title', 'author', 'isbn', 'category_id', 'publication_year',
            'publisher', 'description', 'total_copies', 'status', 'cover_image'
        ];
        
        // Log the data being received for debugging
        error_log("Update book data: " . print_r($data, true));
        
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
        
        $sql = "UPDATE books SET " . implode(', ', $updates) . " WHERE book_id = :book_id";
        
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

function handleDeleteRequest($conn, $action, $userId) {
    if ($action !== 'delete') {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'message' => 'Invalid action'
        ]);
        return;
    }
    
    $id = isset($_GET['id']) ? $_GET['id'] : 0;
    
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
        
        $conn->beginTransaction();
        
        // Get book title for logging
        $getBookSql = "SELECT title FROM books WHERE book_id = :book_id";
        $getBookStmt = $conn->prepare($getBookSql);
        $getBookStmt->bindParam(':book_id', $id, PDO::PARAM_INT);
        $getBookStmt->execute();
        $book = $getBookStmt->fetch(PDO::FETCH_ASSOC);
        
        // Delete the book
        $deleteSql = "DELETE FROM books WHERE book_id = :book_id";
        $deleteStmt = $conn->prepare($deleteSql);
        $deleteStmt->bindParam(':book_id', $id, PDO::PARAM_INT);
        $deleteStmt->execute();
        
        if ($deleteStmt->rowCount() > 0) {
            // Log activity
            logActivity($conn, $userId, 'DELETE', 'books', $id, "Deleted book: {$book['title']}");
            
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
