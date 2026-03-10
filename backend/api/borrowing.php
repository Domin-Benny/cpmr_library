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
            handlePostRequest($conn, $action, $user);
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
            
        case 'getOverdueBooks':
            getOverdueBooksCount($conn);
            break;
            
        case 'getOverdueBooksDetailed':
            getOverdueBooksDetailed($conn);
            break;
            
        case 'getFineRecords':
            getFineRecords($conn);
            break;
            
        case 'getPendingRequests':
            getPendingRequestsCount($conn);
            break;
            
        case 'getMemberBorrowings':
            $memberId = isset($_GET['member_id']) ? $_GET['member_id'] : 0;
            getMemberBorrowings($conn, $memberId);
            break;
            
        case 'getMyBorrowing':
            getMyBorrowingRecords($conn, $user);
            break;
            
        case 'getDetails':
            $id = isset($_GET['id']) ? $_GET['id'] : 0;
            getBorrowingDetails($conn, $id);
            break;
            
        default:
            http_response_code(400);
            echo json_encode([
                'success' => false,
                'message' => 'Invalid action'
            ]);
    }
}

function getAllBorrowingRecords($conn) {
    $sql = "SELECT 
                br.record_id as id,
                m.name as member_name,
                m.member_id,
                b.title as book_title,
                b.book_id,
                br.borrow_date,
                br.due_date,
                br.return_date,
                br.status,
                br.late_fee,
                br.return_condition,
                br.notes,
                br.created_at
            FROM borrowing_records br
            JOIN members m ON br.member_id = m.member_id
            JOIN books b ON br.book_id = b.book_id
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
                br.record_id as id,
                m.name as member_name,
                b.title as book_title,
                br.borrow_date,
                br.due_date,
                br.return_date,
                br.status
            FROM borrowing_records br
            JOIN members m ON br.member_id = m.member_id
            JOIN books b ON br.book_id = b.book_id
            ORDER BY br.borrow_date DESC
            LIMIT :limit";
    
    $stmt = $conn->prepare($sql);
    $stmt->bindParam(':limit', $limit, PDO::PARAM_INT);
    $stmt->execute();
    
    $records = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    echo json_encode([
        'success' => true,
        'records' => $records
    ]);
}

function getActiveBorrowings($conn) {
    $sql = "SELECT 
                br.record_id as id,
                m.name as member_name,
                m.email as member_email,
                b.title as book_title,
                br.borrow_date,
                br.due_date,
                DATEDIFF(CURDATE(), br.due_date) as days_overdue
            FROM borrowing_records br
            JOIN members m ON br.member_id = m.member_id
            JOIN books b ON br.book_id = b.book_id
            WHERE br.status = 'Active'
            ORDER BY br.due_date";
    
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
                br.record_id as id,
                m.name as member_name,
                m.email as member_email,
                b.title as book_title,
                br.borrow_date,
                br.due_date,
                DATEDIFF(CURDATE(), br.due_date) as days_overdue
            FROM borrowing_records br
            JOIN members m ON br.member_id = m.member_id
            JOIN books b ON br.book_id = b.book_id
            WHERE br.status = 'Active' AND br.due_date < CURDATE()
            ORDER BY br.due_date";
    
    $stmt = $conn->prepare($sql);
    $stmt->execute();
    
    $records = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    echo json_encode([
        'success' => true,
        'records' => $records,
        'count' => count($records)
    ]);
}

function getMemberBorrowings($conn, $memberId) {
    if (!$memberId) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'message' => 'Member ID is required'
        ]);
        return;
    }
    
    $sql = "SELECT 
                br.record_id as id,
                b.title as book_title,
                b.author as book_author,
                br.borrow_date,
                br.due_date,
                br.return_date,
                br.status,
                br.late_fee
            FROM borrowing_records br
            JOIN books b ON br.book_id = b.book_id
            WHERE br.member_id = :member_id
            ORDER BY br.borrow_date DESC";
    
    $stmt = $conn->prepare($sql);
    $stmt->bindParam(':member_id', $memberId, PDO::PARAM_INT);
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

function handlePostRequest($conn, $action, $user) {
    $data = json_decode(file_get_contents("php://input"), true);
    $userId = $user['user_id']; // Extract userId from user object
    
    // Log incoming request data for debugging
    error_log("Borrowing API handlePostRequest: action={$action}, userId={$userId}, data=" . print_r($data, true));
    
    // CRITICAL: Check if the member is suspended or inactive before allowing borrowing
    if (isset($data['member_id']) && in_array($action, ['borrow', 'return'])) {
        $memberId = $data['member_id'];
        
        // Get member status
        $checkStatusSql = "SELECT status FROM members WHERE member_id = :member_id";
        $checkStatusStmt = $conn->prepare($checkStatusSql);
        $checkStatusStmt->bindParam(':member_id', $memberId, PDO::PARAM_INT);
        $checkStatusStmt->execute();
        
        if ($checkStatusStmt->rowCount() > 0) {
            $member = $checkStatusStmt->fetch(PDO::FETCH_ASSOC);
            
            if ($member['status'] === 'Suspended' || $member['status'] === 'Inactive') {
                http_response_code(403);
                echo json_encode([
                    'success' => false,
                    'message' => "Cannot process borrowing. Member account is {$member['status']}."
                ]);
                exit();
            }
        }
    }
    
    switch ($action) {
        case 'borrow':
            borrowBook($conn, $data, $userId);
            break;
            
        case 'return':
            returnBook($conn, $data, $userId);
            break;
            
        case 'processFinePayment':
            processFinePayment($conn);
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
    $requiredFields = ['member_id', 'book_id'];
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
        
        // Get max borrow days setting
        $maxBorrowSql = "SELECT setting_value FROM system_settings WHERE setting_key = 'max_borrow_days'";
        $maxBorrowStmt = $conn->prepare($maxBorrowSql);
        $maxBorrowStmt->execute();
        $maxBorrowDays = $maxBorrowStmt->fetch(PDO::FETCH_ASSOC)['setting_value'] ?? 30;
        
        // Use provided borrow_days or default to max_borrow_days
        $borrowDays = isset($data['borrow_days']) ? intval($data['borrow_days']) : intval($maxBorrowDays);
        
        // Validate borrow days don't exceed max
        if ($borrowDays > (int)$maxBorrowDays) {
            $conn->rollBack();
            http_response_code(400);
            echo json_encode([
                'success' => false,
                'message' => "Borrow duration cannot exceed {$maxBorrowDays} days (system setting)"
            ]);
            return;
        }
        
        // Check if book is available
        $checkBookSql = "SELECT available_copies, title FROM books WHERE book_id = :book_id";
        $checkBookStmt = $conn->prepare($checkBookSql);
        $checkBookStmt->bindParam(':book_id', $data['book_id'], PDO::PARAM_INT);
        $checkBookStmt->execute();
        $book = $checkBookStmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$book || $book['available_copies'] < 1) {
            $conn->rollBack();
            http_response_code(400);
            echo json_encode([
                'success' => false,
                'message' => 'Book is not available for borrowing'
            ]);
            return;
        }
        
        // Check if member has reached borrowing limit
        $maxBooksSql = "SELECT setting_value FROM system_settings WHERE setting_key = 'max_books_per_member'";
        $maxBooksStmt = $conn->prepare($maxBooksSql);
        $maxBooksStmt->execute();
        $maxBooks = $maxBooksStmt->fetch(PDO::FETCH_ASSOC)['setting_value'] ?? 5;
        
        $memberBooksSql = "SELECT COUNT(*) as active_books 
                          FROM borrowing_records 
                          WHERE member_id = :member_id AND status = 'Active'";
        $memberBooksStmt = $conn->prepare($memberBooksSql);
        $memberBooksStmt->bindParam(':member_id', $data['member_id'], PDO::PARAM_INT);
        $memberBooksStmt->execute();
        $activeBooks = $memberBooksStmt->fetch(PDO::FETCH_ASSOC)['active_books'];
        
        if ($activeBooks >= $maxBooks) {
            $conn->rollBack();
            http_response_code(400);
            echo json_encode([
                'success' => false,
                'message' => "Member has reached the maximum borrowing limit of $maxBooks books"
            ]);
            return;
        }
        
        // Calculate due date using the borrow days
        $dueDate = date('Y-m-d', strtotime("+{$borrowDays} days"));
        
        // Create borrowing record
        $borrowSql = "INSERT INTO borrowing_records (
                        member_id, book_id, borrow_date, due_date, created_by
                      ) VALUES (
                        :member_id, :book_id, CURDATE(), :due_date, :created_by
                      )";
        
        $borrowStmt = $conn->prepare($borrowSql);
        $borrowStmt->bindParam(':member_id', $data['member_id'], PDO::PARAM_INT);
        $borrowStmt->bindParam(':book_id', $data['book_id'], PDO::PARAM_INT);
        $borrowStmt->bindParam(':due_date', $dueDate);
        $borrowStmt->bindParam(':created_by', $userId, PDO::PARAM_INT);
        $borrowStmt->execute();
        
        $recordId = $conn->lastInsertId();
        
        // Update book availability and status
        $updateBookSql = "UPDATE books 
                         SET available_copies = available_copies - 1,
                             status = CASE 
                                 WHEN available_copies - 1 > 0 THEN 'Available'
                                 ELSE 'Borrowed'
                             END
                         WHERE book_id = :book_id";
        
        $updateBookStmt = $conn->prepare($updateBookSql);
        $updateBookStmt->bindParam(':book_id', $data['book_id'], PDO::PARAM_INT);
        $updateBookStmt->execute();
        
        // Get member name for logging
        $memberSql = "SELECT name FROM members WHERE member_id = :member_id";
        $memberStmt = $conn->prepare($memberSql);
        $memberStmt->bindParam(':member_id', $data['member_id'], PDO::PARAM_INT);
        $memberStmt->execute();
        $member = $memberStmt->fetch(PDO::FETCH_ASSOC);
        
        // Log activity
        logActivity($conn, $userId, 'BORROW', 'borrowing_records', $recordId, 
                   "{$member['name']} borrowed: {$book['title']}");
        
        $conn->commit();
        
        echo json_encode([
            'success' => true,
            'message' => 'Book borrowed successfully',
            'record_id' => $recordId,
            'due_date' => $dueDate
        ]);
    } catch (Exception $e) {
        $conn->rollBack();
        throw $e;
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
    
    $returnCondition = $data['return_condition'] ?? 'Good';
    $notes = $data['notes'] ?? '';
    
    // Log the data being received for debugging
    error_log("Return book data: " . print_r($data, true));
    
    try {
        $conn->beginTransaction();
        
        // Get borrowing record details
        $getRecordSql = "SELECT br.*, b.book_id, b.title as book_title, m.name as member_name
                        FROM borrowing_records br
                        JOIN books b ON br.book_id = b.book_id
                        JOIN members m ON br.member_id = m.member_id
                        WHERE br.record_id = :record_id AND br.status = 'Active'";
        
        $getRecordStmt = $conn->prepare($getRecordSql);
        $getRecordStmt->bindParam(':record_id', $data['record_id'], PDO::PARAM_INT);
        $getRecordStmt->execute();
        $record = $getRecordStmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$record) {
            $conn->rollBack();
            http_response_code(404);
            echo json_encode([
                'success' => false,
                'message' => 'Active borrowing record not found'
            ]);
            return;
        }
        
        // Calculate late fee
        $dueDate = new DateTime($record['due_date']);
        $today = new DateTime();
        $interval = $dueDate->diff($today);
        $daysLate = max(0, $interval->days);
        
        // Check if the book is actually overdue
        if ($dueDate > $today) {
            $daysLate = 0;
        }
        
        $lateFeePerDay = 0.50; // Default, should come from settings
        
        $settingsSql = "SELECT setting_value FROM system_settings WHERE setting_key = 'late_fee_per_day'";
        $settingsStmt = $conn->prepare($settingsSql);
        $settingsStmt->execute();
        $setting = $settingsStmt->fetch(PDO::FETCH_ASSOC);
        
        if ($setting) {
            $lateFeePerDay = floatval($setting['setting_value']);
        }
        
        $lateFee = $daysLate * $lateFeePerDay;
        
        // Update borrowing record
        $updateRecordSql = "UPDATE borrowing_records 
                           SET return_date = CURDATE(),
                               status = 'Returned',
                               return_condition = :condition,
                               late_fee = :late_fee,
                               notes = :notes
                           WHERE record_id = :record_id";
        
        $updateRecordStmt = $conn->prepare($updateRecordSql);
        $updateRecordStmt->bindParam(':record_id', $data['record_id'], PDO::PARAM_INT);
        $updateRecordStmt->bindParam(':condition', $returnCondition);
        $updateRecordStmt->bindParam(':late_fee', $lateFee);
        $updateRecordStmt->bindParam(':notes', $notes);
        $result = $updateRecordStmt->execute();
        
        if (!$result) {
            $conn->rollBack();
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => 'Failed to update borrowing record in database'
            ]);
            return;
        }
        
        // First update available copies
        $updateBookCopiesSql = "UPDATE books 
                             SET available_copies = available_copies + 1
                             WHERE book_id = :book_id";
        
        $updateBookCopiesStmt = $conn->prepare($updateBookCopiesSql);
        $updateBookCopiesStmt->bindParam(':book_id', $record['book_id'], PDO::PARAM_INT);
        $bookUpdateResult = $updateBookCopiesStmt->execute();
        
        // Then update status based on available copies
        $updateBookStatusSql = "UPDATE books 
                              SET status = CASE 
                                  WHEN available_copies > 0 THEN 'Available'
                                  ELSE 'Borrowed'
                              END
                              WHERE book_id = :book_id";
        
        $updateBookStatusStmt = $conn->prepare($updateBookStatusSql);
        $updateBookStatusStmt->bindParam(':book_id', $record['book_id'], PDO::PARAM_INT);
        $updateBookStatusStmt->execute();
        
        if (!$bookUpdateResult) {
            $conn->rollBack();
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => 'Failed to update book availability in database'
            ]);
            return;
        }
        
        // Log activity
        if (function_exists('logActivity')) {
            logActivity($conn, $userId, 'RETURN', 'borrowing_records', $data['record_id'], 
                       "{$record['member_name']} returned: {$record['book_title']}");
        }
        
        $conn->commit();
        
        echo json_encode([
            'success' => true,
            'message' => 'Book returned successfully',
            'days_late' => $daysLate,
            'late_fee' => $lateFee
        ]);
    } catch (Exception $e) {
        $conn->rollBack();
        error_log("Error returning book: " . $e->getMessage());
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'message' => 'Error returning book: ' . $e->getMessage()
        ]);
    }
}

/**
 * Get detailed information for a specific borrowing record
 */
function getBorrowingDetails($conn, $id) {
    try {
        if (!$id) {
            http_response_code(400);
            echo json_encode([
                'success' => false,
                'message' => 'Record ID is required'
            ]);
            return;
        }
        
        $sql = "SELECT 
                    br.record_id as id,
                    br.book_id,
                    br.member_id,
                    m.name as member_name,
                    m.email as member_email,
                    m.phone as member_phone,
                    b.title as book_title,
                    b.author as book_author,
                    b.isbn,
                    br.borrow_date,
                    br.due_date,
                    br.return_date,
                    br.status,
                    br.late_fee,
                    br.notes
                FROM borrowing_records br
                JOIN members m ON br.member_id = m.member_id
                JOIN books b ON br.book_id = b.book_id
                WHERE br.record_id = :id";
        
        $stmt = $conn->prepare($sql);
        $stmt->bindParam(':id', $id, PDO::PARAM_INT);
        $stmt->execute();
        
        $record = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if ($record) {
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
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'message' => 'Error fetching borrowing record: ' . $e->getMessage()
        ]);
    }
}

/**
 * Get count of books issued today
 */
function getIssuedToday($conn) {
    try {
        $sql = "SELECT COUNT(*) as count 
                FROM borrowing_records 
                WHERE DATE(borrow_date) = CURDATE()";
        
        $stmt = $conn->prepare($sql);
        $stmt->execute();
        $result = $stmt->fetch(PDO::FETCH_ASSOC);
        
        echo json_encode([
            'success' => true,
            'count' => $result['count'] ?? 0
        ]);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'message' => 'Error fetching issued today count: ' . $e->getMessage()
        ]);
    }
}

/**
 * Get count of overdue books
 */
function getOverdueBooksCount($conn) {
    try {
        $sql = "SELECT COUNT(*) as count 
                FROM borrowing_records 
                WHERE status = 'Active' AND due_date < CURDATE()";
        
        $stmt = $conn->prepare($sql);
        $stmt->execute();
        $result = $stmt->fetch(PDO::FETCH_ASSOC);
        
        echo json_encode([
            'success' => true,
            'count' => $result['count'] ?? 0
        ]);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'message' => 'Error fetching overdue books count: ' . $e->getMessage()
        ]);
    }
}

/**
 * Get count of pending requests
 */
function getMyBorrowingRecords($conn, $user) {
    try {
        $userId = $user['user_id'];
        
        // Get member ID for the current user
        $memberSql = "SELECT member_id FROM members WHERE user_id = :user_id";
        $memberStmt = $conn->prepare($memberSql);
        $memberStmt->bindParam(':user_id', $userId, PDO::PARAM_INT);
        $memberStmt->execute();
        $member = $memberStmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$member) {
            echo json_encode([
                'success' => true,
                'records' => [],
                'message' => 'No member record found for this user'
            ]);
            return;
        }
        
        $memberId = $member['member_id'];
        
        // Get borrowing records for this member with book cover images
        $sql = "SELECT 
                    br.record_id as id,
                    b.book_id,
                    b.title as book_title,
                    b.author as book_author,
                    b.isbn,
                    b.cover_image,
                    br.borrow_date,
                    br.due_date,
                    br.return_date,
                    br.status,
                    br.late_fee,
                    br.notes,
                    br.created_at
                FROM borrowing_records br
                JOIN books b ON br.book_id = b.book_id
                WHERE br.member_id = :member_id
                ORDER BY br.borrow_date DESC";
        
        $stmt = $conn->prepare($sql);
        $stmt->bindParam(':member_id', $memberId, PDO::PARAM_INT);
        $stmt->execute();
        
        $records = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        echo json_encode([
            'success' => true,
            'records' => $records,
            'count' => count($records)
        ]);
    } catch (Exception $e) {
        error_log("Error in getMyBorrowingRecords: " . $e->getMessage());
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'message' => 'Error fetching borrowing records: ' . $e->getMessage()
        ]);
    }
}

function getPendingRequestsCount($conn) {
    try {
        $sql = "SELECT COUNT(*) as count 
                FROM requests 
                WHERE status = 'Pending'";
        
        $stmt = $conn->prepare($sql);
        $stmt->execute();
        $result = $stmt->fetch(PDO::FETCH_ASSOC);
        
        echo json_encode([
            'success' => true,
            'count' => $result['count'] ?? 0
        ]);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'message' => 'Error fetching pending requests count: ' . $e->getMessage()
        ]);
    }
}

/**
 * Get detailed overdue books with fine calculations
 */
function getOverdueBooksDetailed($conn) {
    try {
        // Get late fee setting
        $settingsSql = "SELECT setting_value FROM system_settings WHERE setting_key = 'late_fee_per_day'";
        $settingsStmt = $conn->prepare($settingsSql);
        $settingsStmt->execute();
        $setting = $settingsStmt->fetch(PDO::FETCH_ASSOC);
        $lateFeePerDay = $setting ? floatval($setting['setting_value']) : 0.50;
        
        $sql = "SELECT 
                    br.record_id,
                    m.name as member_name,
                    m.email as member_email,
                    b.title as book_title,
                    br.borrow_date,
                    br.due_date,
                    DATEDIFF(CURDATE(), br.due_date) as days_overdue,
                    (DATEDIFF(CURDATE(), br.due_date) * :late_fee_per_day) as fine_amount
                FROM borrowing_records br
                JOIN members m ON br.member_id = m.member_id
                JOIN books b ON br.book_id = b.book_id
                WHERE br.status = 'Active' AND br.due_date < CURDATE()
                ORDER BY br.due_date";
        
        $stmt = $conn->prepare($sql);
        $stmt->bindParam(':late_fee_per_day', $lateFeePerDay);
        $stmt->execute();
        
        $records = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        echo json_encode([
            'success' => true,
            'books' => $records,
            'count' => count($records),
            'late_fee_per_day' => $lateFeePerDay
        ]);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'message' => 'Error fetching overdue books: ' . $e->getMessage()
        ]);
    }
}

/**
 * Get fine records (both overdue and collected fines)
 */
function getFineRecords($conn) {
    try {
        // Get late fee setting
        $settingsSql = "SELECT setting_value FROM system_settings WHERE setting_key = 'late_fee_per_day'";
        $settingsStmt = $conn->prepare($settingsSql);
        $settingsStmt->execute();
        $setting = $settingsStmt->fetch(PDO::FETCH_ASSOC);
        $lateFeePerDay = $setting ? floatval($setting['setting_value']) : 0.50;
        
        // Get current overdue books with calculated fines
        $overdueSql = "SELECT 
                        br.record_id,
                        m.name as member_name,
                        b.title as book_title,
                        br.due_date,
                        DATEDIFF(CURDATE(), br.due_date) as days_overdue,
                        (DATEDIFF(CURDATE(), br.due_date) * :late_fee_per_day) as fine_amount,
                        'Overdue' as status,
                        NULL as return_date
                    FROM borrowing_records br
                    JOIN members m ON br.member_id = m.member_id
                    JOIN books b ON br.book_id = b.book_id
                    WHERE br.status = 'Active' AND br.due_date < CURDATE()";
        
        $overdueStmt = $conn->prepare($overdueSql);
        $overdueStmt->bindParam(':late_fee_per_day', $lateFeePerDay);
        $overdueStmt->execute();
        $overdueRecords = $overdueStmt->fetchAll(PDO::FETCH_ASSOC);
        
        // Get already collected fines (returned books with late fees)
        $collectedSql = "SELECT 
                            br.record_id,
                            m.name as member_name,
                            b.title as book_title,
                            br.due_date,
                            NULL as days_overdue,
                            br.late_fee as fine_amount,
                            br.status,
                            br.return_date
                        FROM borrowing_records br
                        JOIN members m ON br.member_id = m.member_id
                        JOIN books b ON br.book_id = b.book_id
                        WHERE br.late_fee > 0
                        ORDER BY br.return_date DESC";
        
        $collectedStmt = $conn->prepare($collectedSql);
        $collectedStmt->execute();
        $collectedRecords = $collectedStmt->fetchAll(PDO::FETCH_ASSOC);
        
        // Combine both arrays
        $allFines = array_merge($overdueRecords, $collectedRecords);
        
        // Sort by fine amount (highest first)
        usort($allFines, function($a, $b) {
            return $b['fine_amount'] <=> $a['fine_amount'];
        });
        
        echo json_encode([
            'success' => true,
            'fines' => $allFines,
            'count' => count($allFines),
            'total_current_fines' => array_sum(array_column($overdueRecords, 'fine_amount')),
            'total_collected_fines' => array_sum(array_column($collectedRecords, 'fine_amount')),
            'late_fee_per_day' => $lateFeePerDay
        ]);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'message' => 'Error fetching fine records: ' . $e->getMessage()
        ]);
    }
}

/**
 * Process fine payment
 */
function processFinePayment($conn) {
    try {
        $data = json_decode(file_get_contents('php://input'), true);
        
        if (!isset($data['record_id'])) {
            http_response_code(400);
            echo json_encode([
                'success' => false,
                'message' => 'Record ID is required'
            ]);
            return;
        }
        
        $recordId = $data['record_id'];
        
        // Get the borrowing record
        $recordSql = "SELECT * FROM borrowing_records WHERE record_id = :record_id";
        $recordStmt = $conn->prepare($recordSql);
        $recordStmt->bindParam(':record_id', $recordId, PDO::PARAM_INT);
        $recordStmt->execute();
        $record = $recordStmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$record) {
            http_response_code(404);
            echo json_encode([
                'success' => false,
                'message' => 'Record not found'
            ]);
            return;
        }
        
        // If the book is still active (not returned), we need to return it first
        if ($record['status'] === 'Active') {
            // Calculate the fine
            $dueDate = new DateTime($record['due_date']);
            $today = new DateTime();
            $interval = $dueDate->diff($today);
            $daysLate = max(0, $interval->days);
            
            if ($dueDate > $today) {
                $daysLate = 0;
            }
            
            // Get late fee setting
            $settingsSql = "SELECT setting_value FROM system_settings WHERE setting_key = 'late_fee_per_day'";
            $settingsStmt = $conn->prepare($settingsSql);
            $settingsStmt->execute();
            $setting = $settingsStmt->fetch(PDO::FETCH_ASSOC);
            $lateFeePerDay = $setting ? floatval($setting['setting_value']) : 0.50;
            
            $lateFee = $daysLate * $lateFeePerDay;
            
            // Return the book and set the late fee
            $updateSql = "UPDATE borrowing_records 
                         SET return_date = CURDATE(),
                             status = 'Returned',
                             late_fee = :late_fee
                         WHERE record_id = :record_id";
            
            $updateStmt = $conn->prepare($updateSql);
            $updateStmt->bindParam(':late_fee', $lateFee);
            $updateStmt->bindParam(':record_id', $recordId, PDO::PARAM_INT);
            $updateStmt->execute();
            
            // Update book availability
            $bookSql = "UPDATE books 
                       SET available_copies = available_copies + 1,
                           status = CASE 
                               WHEN available_copies + 1 > 0 THEN 'Available' 
                               ELSE status 
                           END
                       WHERE book_id = :book_id";
            
            $bookStmt = $conn->prepare($bookSql);
            $bookStmt->bindParam(':book_id', $record['book_id'], PDO::PARAM_INT);
            $bookStmt->execute();
            
            // Log the activity
            $bookInfoSql = "SELECT b.title FROM borrowing_records br JOIN books b ON br.book_id = b.book_id WHERE br.record_id = :record_id";
            $bookInfoStmt = $conn->prepare($bookInfoSql);
            $bookInfoStmt->bindParam(':record_id', $recordId, PDO::PARAM_INT);
            $bookInfoStmt->execute();
            $bookInfo = $bookInfoStmt->fetch(PDO::FETCH_ASSOC);
            
            $bookTitle = $bookInfo ? $bookInfo['title'] : 'Unknown';
            
            echo json_encode([
                'success' => true,
                'message' => 'Fine payment processed and book returned successfully',
                'late_fee' => $lateFee,
                'days_late' => $daysLate
            ]);
        } else {
            // Book already returned, just mark fine as paid
            $updateSql = "UPDATE borrowing_records 
                         SET late_fee = 0,
                             status = 'Paid'
                         WHERE record_id = :record_id";
            
            $updateStmt = $conn->prepare($updateSql);
            $updateStmt->bindParam(':record_id', $recordId, PDO::PARAM_INT);
            $updateStmt->execute();
            
            // Log the activity
            $bookInfoSql = "SELECT b.title FROM borrowing_records br JOIN books b ON br.book_id = b.book_id WHERE br.record_id = :record_id";
            $bookInfoStmt = $conn->prepare($bookInfoSql);
            $bookInfoStmt->bindParam(':record_id', $recordId, PDO::PARAM_INT);
            $bookInfoStmt->execute();
            $bookInfo = $bookInfoStmt->fetch(PDO::FETCH_ASSOC);
            
            $bookTitle = $bookInfo ? $bookInfo['title'] : 'Unknown';
            
            echo json_encode([
                'success' => true,
                'message' => 'Fine payment processed successfully'
            ]);
        }
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'message' => 'Error processing fine payment: ' . $e->getMessage()
        ]);
    }
}

?>