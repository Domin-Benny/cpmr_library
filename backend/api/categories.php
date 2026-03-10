<?php
// =============================================
// Categories Management API
// File: backend/api/categories.php
// Description: Handle all category-related operations
// =============================================

header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");

require_once '../../config/database.php';
require_once 'auth_helper.php';

// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Check authentication for write operations
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
    // Only Admin and Librarian can modify categories
    if (!requireRole($user, ['Admin', 'Librarian'])) {
        exit();
    }
} else {
    // For GET requests, authentication is optional
    $user = isAuthenticated(); // This will return false if no token, but that's OK
}

// Get action parameter
$action = isset($_GET['action']) ? $_GET['action'] : '';

try {
    $database = new Database();
    $conn = $database->getConnection();

    switch ($_SERVER['REQUEST_METHOD']) {
        case 'GET':
            handleGetRequest($conn, $action);
            break;
            
        case 'POST':
            handlePostRequest($conn, $action, $user['user_id']);
            break;
            
        case 'PUT':
            $data = json_decode(file_get_contents("php://input"), true);
            updateCategory($conn, $data, $user['user_id']);
            break;
            
        case 'DELETE':
            $id = isset($_GET['id']) ? $_GET['id'] : 0;
            deleteCategory($conn, $id, $user['user_id']);
            break;
            
        default:
            http_response_code(405);
            echo json_encode([
                'success' => false,
                'message' => 'Method not allowed'
            ]);
    }
} catch (Exception $e) {
    error_log("Categories API error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Internal server error'
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
            getAllCategories($conn);
            break;
            
        case 'getBooks':
            $id = isset($_GET['id']) ? $_GET['id'] : 0;
            getCategoryBooks($conn, $id);
            break;
            
        case 'getStats':
            getCategoryStatistics($conn);
            break;
            
        default:
            http_response_code(400);
            echo json_encode([
                'success' => false,
                'message' => 'Invalid action'
            ]);
    }
}

function getAllCategories($conn) {
    $sql = "SELECT 
                c.category_id as id,
                c.name,
                c.description,
                COUNT(b.book_id) as book_count
            FROM categories c
            LEFT JOIN books b ON c.category_id = b.category_id
            GROUP BY c.category_id, c.name, c.description
            ORDER BY c.name";
    
    $stmt = $conn->prepare($sql);
    $stmt->execute();
    
    $categories = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    echo json_encode([
        'success' => true,
        'categories' => $categories,
        'count' => count($categories)
    ]);
}

function getCategoryBooks($conn, $categoryId) {
    if (!$categoryId) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'message' => 'Category ID is required'
        ]);
        return;
    }
    
    // First get category details
    $categorySql = "SELECT * FROM categories WHERE category_id = :category_id";
    $categoryStmt = $conn->prepare($categorySql);
    $categoryStmt->bindParam(':category_id', $categoryId, PDO::PARAM_INT);
    $categoryStmt->execute();
    $category = $categoryStmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$category) {
        http_response_code(404);
        echo json_encode([
            'success' => false,
            'message' => 'Category not found'
        ]);
        return;
    }
    
    // Get books in this category
    $booksSql = "SELECT 
                    book_id as id,
                    title,
                    author,
                    publication_year as year,
                    status,
                    total_copies,
                    available_copies
                FROM books
                WHERE category_id = :category_id
                ORDER BY title";
    
    $booksStmt = $conn->prepare($booksSql);
    $booksStmt->bindParam(':category_id', $categoryId, PDO::PARAM_INT);
    $booksStmt->execute();
    $books = $booksStmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Calculate book count based on the books retrieved
    $bookCount = count($books);
    
    echo json_encode([
        'success' => true,
        'category' => $category,
        'books' => $books,
        'book_count' => $bookCount
    ]);
}

function getCategoryStatistics($conn) {
    $sql = "SELECT 
                c.name as category_name,
                COUNT(b.book_id) as total_books,
                SUM(b.total_copies) as total_copies,
                SUM(b.available_copies) as available_copies,
                (SELECT COUNT(DISTINCT br.member_id) 
                 FROM borrowing_records br
                 JOIN books b2 ON br.book_id = b2.book_id
                 WHERE b2.category_id = c.category_id) as unique_borrowers
            FROM categories c
            LEFT JOIN books b ON c.category_id = b.category_id
            GROUP BY c.category_id, c.name
            ORDER BY total_books DESC";
    
    $stmt = $conn->prepare($sql);
    $stmt->execute();
    
    $stats = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    echo json_encode([
        'success' => true,
        'statistics' => $stats
    ]);
}

// =============================================
// POST Request Handlers
// =============================================

function handlePostRequest($conn, $action, $userId) {
    $data = json_decode(file_get_contents("php://input"), true);
    
    switch ($action) {
        case 'add':
            addCategory($conn, $data, $userId);
            break;
            
        case 'update':
            updateCategory($conn, $data, $userId);
            break;
            
        default:
            http_response_code(400);
            echo json_encode([
                'success' => false,
                'message' => 'Invalid action'
            ]);
    }
}

function addCategory($conn, $data, $userId) {
    // Validate required fields
    if (!isset($data['name']) || empty($data['name'])) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'message' => 'Category name is required'
        ]);
        return;
    }
    
    // Check if category already exists
    $checkSql = "SELECT COUNT(*) as category_count FROM categories WHERE name = :name";
    $checkStmt = $conn->prepare($checkSql);
    $checkStmt->bindParam(':name', $data['name']);
    $checkStmt->execute();
    $result = $checkStmt->fetch(PDO::FETCH_ASSOC);
    
    if ($result['category_count'] > 0) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'message' => 'Category already exists'
        ]);
        return;
    }
    
    try {
        $conn->beginTransaction();
        
        $sql = "INSERT INTO categories (name, description) VALUES (:name, :description)";
        
        $stmt = $conn->prepare($sql);
        $stmt->bindParam(':name', $data['name']);
        $stmt->bindParam(':description', $data['description']);
        
        $stmt->execute();
        
        $categoryId = $conn->lastInsertId();
        
        // Log activity
        logActivity($conn, $userId, 'ADD', 'categories', $categoryId, "Added category: {$data['name']}");
        
        $conn->commit();
        
        echo json_encode([
            'success' => true,
            'message' => 'Category added successfully',
            'category_id' => $categoryId
        ]);
    } catch (Exception $e) {
        $conn->rollBack();
        throw $e;
    }
}

function updateCategory($conn, $data, $userId) {
    if (!isset($data['category_id'])) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'message' => 'Category ID is required'
        ]);
        return;
    }
    
    try {
        $conn->beginTransaction();
        
        // Build update query dynamically
        $updates = [];
        $params = ['category_id' => $data['category_id']];
        
        if (isset($data['name'])) {
            // Check if new name already exists (excluding current category)
            $checkSql = "SELECT COUNT(*) as category_count 
                        FROM categories 
                        WHERE name = :name AND category_id != :category_id";
            $checkStmt = $conn->prepare($checkSql);
            $checkStmt->bindParam(':name', $data['name']);
            $checkStmt->bindParam(':category_id', $data['category_id'], PDO::PARAM_INT);
            $checkStmt->execute();
            $result = $checkStmt->fetch(PDO::FETCH_ASSOC);
            
            if ($result['category_count'] > 0) {
                $conn->rollBack();
                http_response_code(400);
                echo json_encode([
                    'success' => false,
                    'message' => 'Category name already exists'
                ]);
                return;
            }
            
            $updates[] = "name = :name";
            $params['name'] = $data['name'];
        }
        
        if (isset($data['description'])) {
            $updates[] = "description = :description";
            $params['description'] = $data['description'];
        }
        
        if (empty($updates)) {
            http_response_code(400);
            echo json_encode([
                'success' => false,
                'message' => 'No fields to update'
            ]);
            return;
        }
        
        $sql = "UPDATE categories SET " . implode(', ', $updates) . " WHERE category_id = :category_id";
        
        $stmt = $conn->prepare($sql);
        foreach ($params as $key => $value) {
            $paramType = is_int($value) ? PDO::PARAM_INT : PDO::PARAM_STR;
            $stmt->bindValue(":$key", $value, $paramType);
        }
        
        $stmt->execute();
        
        // Log activity
        logActivity($conn, $userId, 'UPDATE', 'categories', $data['category_id'], "Updated category details");
        
        $conn->commit();
        
        echo json_encode([
            'success' => true,
            'message' => 'Category updated successfully'
        ]);
    } catch (Exception $e) {
        $conn->rollBack();
        throw $e;
    }
}

/**
 * Delete category
 * @param PDO $conn - Database connection
 * @param int $categoryId - Category ID to delete
 * @param int $userId - User ID performing the action
 */
function deleteCategory($conn, $categoryId, $userId) {
    if (!$categoryId) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'message' => 'Category ID is required'
        ]);
        return;
    }
    
    try {
        $conn->beginTransaction();
        
        // Check if category exists
        $checkSql = "SELECT name FROM categories WHERE category_id = :category_id";
        $checkStmt = $conn->prepare($checkSql);
        $checkStmt->bindParam(':category_id', $categoryId, PDO::PARAM_INT);
        $checkStmt->execute();
        $category = $checkStmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$category) {
            $conn->rollBack();
            http_response_code(404);
            echo json_encode([
                'success' => false,
                'message' => 'Category not found'
            ]);
            return;
        }
        
        // Check if there are books in this category
        $bookCheckSql = "SELECT COUNT(*) as book_count FROM books WHERE category_id = :category_id";
        $bookCheckStmt = $conn->prepare($bookCheckSql);
        $bookCheckStmt->bindParam(':category_id', $categoryId, PDO::PARAM_INT);
        $bookCheckStmt->execute();
        $bookResult = $bookCheckStmt->fetch(PDO::FETCH_ASSOC);
        
        if ($bookResult['book_count'] > 0) {
            $conn->rollBack();
            http_response_code(400);
            echo json_encode([
                'success' => false,
                'message' => 'Cannot delete category. There are ' . $bookResult['book_count'] . ' books in this category. Please move or delete the books first.'
            ]);
            return;
        }
        
        // Delete the category
        $deleteSql = "DELETE FROM categories WHERE category_id = :category_id";
        $deleteStmt = $conn->prepare($deleteSql);
        $deleteStmt->bindParam(':category_id', $categoryId, PDO::PARAM_INT);
        $deleteStmt->execute();
        
        // Log activity
        logActivity($conn, $userId, 'DELETE', 'categories', $categoryId, "Deleted category: {$category['name']}");
        
        $conn->commit();
        
        echo json_encode([
            'success' => true,
            'message' => 'Category deleted successfully'
        ]);
        
    } catch (Exception $e) {
        $conn->rollBack();
        error_log("Delete category error: " . $e->getMessage());
        throw $e;
    }
}
?>