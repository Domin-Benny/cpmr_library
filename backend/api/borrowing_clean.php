<?php
// =============================================
// Borrowing Management API
// File: backend/api/borrowing.php
// Description: Handle all borrowing-related operations
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

// Check authentication
$user = isAuthenticated();
if (!$user) {
    http_response_code(401);
    echo json_encode([
        'success' => false,
        'message' => 'Authentication required'
    ]);
    exit();
}

// For borrowing write operations, require appropriate roles
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    // Only Admin and Librarian can create/return borrowings (staff/students make requests)
    if (!requireRole($user, ['Admin', 'Librarian'])) {
        exit();
    }
}

// Get action parameter
$action = isset($_GET['action']) ? $_GET['action'] : '';

try {
    $database = new Database();
    $conn = $database->getConnection();

    switch ($_SERVER['REQUEST_METHOD']) {
        case 'GET':
            handleGetRequest($conn, $action, $user);
            break;
            
        case 'POST':
            handlePostRequest($conn, $action, $user['user_id']);
            break;
            
        default:
            http_response_code(405);
            echo json_encode([
                'success' => false,
                'message' => 'Method not allowed'
            ]);
    }
} catch (Exception $e) {
    error_log("Borrowing API error: " . $e->getMessage());
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

function handleGetRequest($conn, $action, $user) {
    switch ($action) {
        case 'getAll':
            getAllBorrowingRecords($conn);
            break;
            
        case 'getRecent':
            $limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 10;
            getRecentBorrowingRecords($conn, $limit);
            break;
            
        case 'getActive':
            getActiveBorrowings($conn);
            break;
            
        case 'getOverdue':
            getOverdueBorrowings($conn);
            break;
            
        case 'getIssuedToday':
            getIssuedToday($conn);
            break;
            
        case 'getMyBorrowing':
            $userId = $user['user_id'];
            getUserBorrowingRecords($conn, $userId);
            break;
            
        case 'getDetails':
            $id = isset($_GET['id']) ? (int)$_GET['id'] : 0;
            if ($id > 0) {
                getBorrowingRecordDetails($conn, $id);
            } else {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'Invalid record ID']);
            }
            break;
            
        case 'getOverdueBooks':
            getOverdueBooksCount($conn);
            break;
            
        case 'getOverdueBooksDetailed':
            getOverdueBooksDetailed($conn);
            break;
            
        case 'getFineRecords':
            getFineRecords($conn);
            break;
            
        default:
            http_response_code(400);
            echo json_encode([
                'success' => false,
                'message' => 'Invalid action parameter'
            ]);
    }
}

function getAllBorrowingRecords($conn) {
    $sql = "SELECT 
                br.record_id,
                br.member_id,
                br.book_id,
                br.borrow_date,
                br.due_date,
                br.return_date,
                br.status,
                br.late_fee,
                br.notes,
                m.name as member_name,
                m.email as member_email,
                b.title as book_title,
                b.author as book_author,
                b.isbn as book_isbn
            FROM borrowing_records br
            LEFT JOIN members m ON br.member_id = m.member_id
            LEFT JOIN books b ON br.book_id = b.book_id
            ORDER BY br.borrow_date DESC";
    
    $stmt = $conn->prepare($sql);
    $stmt->execute();
    
    $records = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    echo json_encode([
        'success' => true,
        'records' => $records,
        'count' => count($records)
    ]);
}

function getRecentBorrowingRecords($conn, $limit = 10) {
    $sql = "SELECT 
                br.record_id,
                br.member_id,
                br.book_id,
                br.borrow_date,
                br.due_date,
                br.return_date,
                br.status,
                m.name as member_name,
                b.title as book_title
            FROM borrowing_records br
            LEFT JOIN members m ON br.member_id = m.member_id
            LEFT JOIN books b ON br.book_id = b.book_id
            ORDER BY br.borrow_date DESC
            LIMIT :limit";
    
    $stmt = $conn->prepare($sql);
    $stmt->bindParam(':limit', $limit, PDO::PARAM_INT);
    $stmt->execute();
    
    $records = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    echo json_encode([
        'success' => true,
        'records' => $records,
        'count' => count($records)
    ]);
}

function getActiveBorrowings($conn) {
    $sql = "SELECT 
                br.record_id,
                br.member_id,
                br.book_id,
                br.borrow_date,
                br.due_date,
                br.status,
                m.name as member_name,
                b.title as book_title
            FROM borrowing_records br
            LEFT JOIN members m ON br.member_id = m.member_id
            LEFT JOIN books b ON br.book_id = b.book_id
            WHERE br.status = 'Active'
            ORDER BY br.due_date ASC";
    
    $stmt = $conn->prepare($sql);
    $stmt->execute();
    
    $records = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    echo json_encode([
        'success' => true,
        'records' => $records,
        'count' => count($records)
    ]);
}

function getOverdueBorrowings($conn) {
    $sql = "SELECT 
                br.record_id,
                br.member_id,
                br.book_id,
                br.borrow_date,
                br.due_date,
                br.status,
                br.late_fee,
                DATEDIFF(CURDATE(), br.due_date) as days_overdue,
                m.name as member_name,
                m.email as member_email,
                b.title as book_title
            FROM borrowing_records br
            LEFT JOIN members m ON br.member_id = m.member_id
            LEFT JOIN books b ON br.book_id = b.book_id
            WHERE br.status = 'Active' AND br.due_date < CURDATE()
            ORDER BY br.due_date ASC";
    
    $stmt = $conn->prepare($sql);
    $stmt->execute();
    
    $records = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    echo json_encode([
        'success' => true,
        'records' => $records,
        'count' => count($records)
    ]);
}

function getBorrowingRecordDetails($conn, $id) {
    $sql = "SELECT 
                br.*,
                m.name as member_name,
                m.email as member_email,
                m.phone as member_phone,
                b.title as book_title,
                b.author as book_author,
                b.isbn as book_isbn
            FROM borrowing_records br
            LEFT JOIN members m ON br.member_id = m.member_id
            LEFT JOIN books b ON br.book_id = b.book_id
            WHERE br.record_id = :id";
    
    $stmt = $conn->prepare($sql);
    $stmt->bindParam(':id', $id, PDO::PARAM_INT);
    $stmt->execute();
    
    if ($stmt->rowCount() > 0) {
        $record = $stmt->fetch(PDO::FETCH_ASSOC);
        echo json_encode([
            'success' => true,
            'record' => $record
        ]);
    } else {
        http_response_code(404);
        echo json_encode([
            'success' => false,
            'message' => 'Borrowing record not found'
        ]);
    }
}

function getOverdueBooksCount($conn) {
    $sql = "SELECT COUNT(*) as count 
            FROM borrowing_records 
            WHERE status = 'Active' AND due_date < CURDATE()";
    
    $stmt = $conn->prepare($sql);
    $stmt->execute();
    $result = $stmt->fetch(PDO::FETCH_ASSOC);
    
    echo json_encode([
        'success' => true,
        'count' => (int)$result['count']
    ]);
}

function getOverdueBooksDetailed($conn) {
    $sql = "SELECT 
                br.record_id,
                br.member_id,
                br.book_id,
                br.due_date,
                br.late_fee,
                DATEDIFF(CURDATE(), br.due_date) as days_overdue,
                m.name as member_name,
                b.title as book_title
            FROM borrowing_records br
            LEFT JOIN members m ON br.member_id = m.member_id
            LEFT JOIN books b ON br.book_id = b.book_id
            WHERE br.status = 'Active' AND br.due_date < CURDATE()
            ORDER BY br.due_date ASC";
    
    $stmt = $conn->prepare($sql);
    $stmt->execute();
    
    $records = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    echo json_encode([
        'success' => true,
        'records' => $records,
        'count' => count($records)
    ]);
}

function getFineRecords($conn) {
    $sql = "SELECT 
                br.record_id,
                br.member_id,
                br.late_fee,
                br.status,
                m.name as member_name,
                b.title as book_title
            FROM borrowing_records br
            LEFT JOIN members m ON br.member_id = m.member_id
            LEFT JOIN books b ON br.book_id = b.book_id
            WHERE br.late_fee > 0
            ORDER BY br.late_fee DESC";
    
    $stmt = $conn->prepare($sql);
    $stmt->execute();
    
    $records = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    echo json_encode([
        'success' => true,
        'records' => $records,
        'count' => count($records)
    ]);
}

function getIssuedToday($conn) {
    $sql = "SELECT 
                br.record_id,
                br.member_id,
                br.book_id,
                br.borrow_date,
                br.due_date,
                m.name as member_name,
                b.title as book_title
            FROM borrowing_records br
            LEFT JOIN members m ON br.member_id = m.member_id
            LEFT JOIN books b ON br.book_id = b.book_id
            WHERE DATE(br.borrow_date) = CURDATE()
            ORDER BY br.borrow_date DESC";
    
    $stmt = $conn->prepare($sql);
    $stmt->execute();
    
    $records = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    echo json_encode([
        'success' => true,
        'records' => $records,
        'count' => count($records)
    ]);
}

// =============================================
// POST Request Handlers
// =============================================

function handlePostRequest($conn, $action, $userId) {
    $data = json_decode(file_get_contents("php://input"), true);
    
    switch ($action) {
        case 'borrow':
            borrowBook($conn, $data, $userId);
            break;
            
        case 'return':
            returnBook($conn, $data, $userId);
            break;
            
        default:
            http_response_code(400);
            echo json_encode([
                'success' => false,
                'message' => 'Invalid action'
            ]);
    }
}

function borrowBook($conn, $data, $userId) {
    // Validate required fields
    $requiredFields = ['member_id', 'book_id', 'borrow_date', 'due_date'];
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
        
        // Check if book is available
        $checkSql = "SELECT status FROM books WHERE book_id = :book_id";
        $checkStmt = $conn->prepare($checkSql);
        $checkStmt->bindParam(':book_id', $data['book_id']);
        $checkStmt->execute();
        $book = $checkStmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$book) {
            throw new Exception('Book not found');
        }
        
        if ($book['status'] === 'Borrowed') {
            throw new Exception('Book is already borrowed');
        }
        
        // Insert borrowing record
        $sql = "INSERT INTO borrowing_records (
                    member_id, book_id, borrow_date, due_date, status, notes
                ) VALUES (
                    :member_id, :book_id, :borrow_date, :due_date, 'Active', :notes
                )";
        
        $stmt = $conn->prepare($sql);
        $stmt->bindParam(':member_id', $data['member_id'], PDO::PARAM_INT);
        $stmt->bindParam(':book_id', $data['book_id'], PDO::PARAM_INT);
        $stmt->bindParam(':borrow_date', $data['borrow_date']);
        $stmt->bindParam(':due_date', $data['due_date']);
        $stmt->bindParam(':notes', $data['notes']);
        
        $stmt->execute();
        
        $recordId = $conn->lastInsertId();
        
        // Update book status
        $updateBookSql = "UPDATE books SET status = 'Borrowed' WHERE book_id = :book_id";
        $updateBookStmt = $conn->prepare($updateBookSql);
        $updateBookStmt->bindParam(':book_id', $data['book_id'], PDO::PARAM_INT);
        $updateBookStmt->execute();
        
        // Log activity
        logActivity($conn, $userId, 'ADD', 'borrowing_records', $recordId, "Book borrowed - Record ID: $recordId");
        
        $conn->commit();
        
        echo json_encode([
            'success' => true,
            'message' => 'Book borrowed successfully',
            'record_id' => $recordId
        ]);
    } catch (Exception $e) {
        $conn->rollBack();
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'message' => $e->getMessage()
        ]);
    }
}

function returnBook($conn, $data, $userId) {
    if (!isset($data['record_id'])) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'message' => 'Record ID is required'
        ]);
        return;
    }
    
    try {
        $conn->beginTransaction();
        
        // Get borrowing record
        $getSql = "SELECT * FROM borrowing_records WHERE record_id = :record_id";
        $getStmt = $conn->prepare($getSql);
        $getStmt->bindParam(':record_id', $data['record_id'], PDO::PARAM_INT);
        $getStmt->execute();
        
        if ($getStmt->rowCount() === 0) {
            throw new Exception('Borrowing record not found');
        }
        
        $record = $getStmt->fetch(PDO::FETCH_ASSOC);
        
        // Calculate late fee if applicable
        $lateFee = 0;
        $dueDate = new DateTime($record['due_date']);
        $returnDate = new DateTime();
        
        if ($returnDate > $dueDate) {
            $diff = $dueDate->diff($returnDate);
            $daysLate = $diff->days;
            $lateFee = $daysLate * 10; // Assuming 10 currency units per day
        }
        
        // Update borrowing record
        $updateSql = "UPDATE borrowing_records 
                     SET return_date = CURDATE(), 
                         status = 'Returned', 
                         late_fee = :late_fee 
                     WHERE record_id = :record_id";
        
        $updateStmt = $conn->prepare($updateSql);
        $updateStmt->bindParam(':late_fee', $lateFee);
        $updateStmt->bindParam(':record_id', $data['record_id'], PDO::PARAM_INT);
        $updateStmt->execute();
        
        // Update book status
        $updateBookSql = "UPDATE books SET status = 'Available' WHERE book_id = :book_id";
        $updateBookStmt = $conn->prepare($updateBookSql);
        $updateBookStmt->bindParam(':book_id', $record['book_id'], PDO::PARAM_INT);
        $updateBookStmt->execute();
        
        // Log activity
        logActivity($conn, $userId, 'UPDATE', 'borrowing_records', $data['record_id'], "Book returned - Record ID: {$data['record_id']}");
        
        $conn->commit();
        
        echo json_encode([
            'success' => true,
            'message' => 'Book returned successfully',
            'late_fee' => $lateFee
        ]);
    } catch (Exception $e) {
        $conn->rollBack();
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'message' => $e->getMessage()
        ]);
    }
}

/**
 * Get borrowing records for a specific user
 * @param PDO $conn Database connection
 * @param int $userId User ID
 */
function getUserBorrowingRecords($conn, $userId) {
    try {
        // Find member record directly by user_id (assuming members table has user_id column)
        $memberSql = "SELECT member_id FROM members WHERE user_id = :user_id LIMIT 1";
        $memberStmt = $conn->prepare($memberSql);
        $memberStmt->bindParam(':user_id', $userId, PDO::PARAM_INT);
        $memberStmt->execute();
        $member = $memberStmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$member) {
            // No member record found for this user
            echo json_encode(['success' => true, 'records' => [], 'message' => 'No member record found for this user']);
            return;
        }
        
        $memberId = $member['member_id'];
        
        // Get borrowing records for this member
        $sql = "SELECT br.record_id, br.member_id, br.book_id, br.borrow_date, br.due_date, 
                       br.return_date, br.status, br.late_fee, br.notes,
                       b.title as book_title, b.author, b.isbn
                FROM borrowing_records br
                LEFT JOIN books b ON br.book_id = b.book_id
                WHERE br.member_id = :member_id
                ORDER BY br.borrow_date DESC";
                
        $stmt = $conn->prepare($sql);
        $stmt->bindParam(':member_id', $memberId, PDO::PARAM_INT);
        $stmt->execute();
        $records = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        echo json_encode(['success' => true, 'records' => $records]);
        
    } catch (Exception $e) {
        error_log("Error getting user borrowing records: " . $e->getMessage());
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Error retrieving borrowing records']);
    }
}

// ... rest of the existing functions would go here ...
// (keeping all the original functions that were in the file)

?>