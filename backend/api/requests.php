<?php
// =============================================
// Requests API
// File: backend/api/requests.php
// Description: Handle borrow/reservation requests
// =============================================

header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");

require_once '../../config/database.php';
require_once 'auth_helper.php';

// Handle preflight
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Validate authentication
$user = isAuthenticated();
if (!$user) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Authentication required']);
    exit();
}

$action = isset($_GET['action']) ? $_GET['action'] : '';
$database = null;
$conn = null;

try {
    $database = new Database();
    $conn = $database->getConnection();

    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        switch ($action) {
            case 'getPending':
                getPendingRequests($conn, $user);
                break;
            case 'getMy':
                getMyRequests($conn, $user);
                break;
            case 'getRequestDetails':
                $requestId = isset($_GET['id']) ? (int)$_GET['id'] : 0;
                getRequestDetails($conn, $user, $requestId);
                break;
            default:
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'Invalid action']);
        }
    } elseif ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $data = json_decode(file_get_contents('php://input'), true);
        $act = $data['action'] ?? '';
        switch ($act) {
            case 'create':
                createRequest($conn, $user, $data);
                break;
            case 'approve':
                if (!requireRole($user, ['Admin', 'Librarian'])) exit();
                approveRequest($conn, $user, $data);
                break;
            case 'decline':
                if (!requireRole($user, ['Admin', 'Librarian'])) exit();
                declineRequest($conn, $user, $data);
                break;
            default:
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'Invalid action']);
        }
    } else {
        http_response_code(405);
        echo json_encode(['success' => false, 'message' => 'Method not allowed']);
    }
} catch (Exception $e) {
    error_log('Requests API error: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Internal server error']);
} finally {
    if (isset($database) && $database !== null) {
        $database->closeConnection();
    }
}

// Handlers
function getPendingRequests($conn, $user) {
    // Admin/Librarian: all pending; Staff/Others: only their requests
    $userRole = isset($user['role']) ? ucfirst(strtolower($user['role'])) : '';
    $userId = isset($user['user_id']) ? $user['user_id'] : null;
    
    $sql = "SELECT r.request_id, r.book_id, r.requester_user_id, u.name as requester_name, b.title as book_title, r.requested_days, r.message, r.status, r.created_at
            FROM requests r
            LEFT JOIN users u ON r.requester_user_id = u.user_id
            LEFT JOIN books b ON r.book_id = b.book_id
            WHERE r.status = 'Pending'";
    
    // Only Admin and Librarian can see all pending requests
    // Staff and other roles can only see their own requests
    if (!in_array($userRole, ['Admin','Librarian'])) {
        if ($userId !== null) {
            $sql .= " AND r.requester_user_id = :uid";
        }
    }
    
    $stmt = $conn->prepare($sql);
    if (!in_array($userRole, ['Admin','Librarian']) && $userId !== null) {
        $stmt->bindParam(':uid', $userId, PDO::PARAM_INT);
    }
    
    $stmt->execute();
    $requests = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    echo json_encode(['success' => true, 'requests' => $requests]);
}

function getMyRequests($conn, $user) {
    $sql = "SELECT r.request_id, r.book_id, b.title as book_title, r.requested_days, r.message, r.status, r.created_at, r.decided_at
            FROM requests r
            LEFT JOIN books b ON r.book_id = b.book_id
            WHERE r.requester_user_id = :uid
            ORDER BY r.created_at DESC";
    $stmt = $conn->prepare($sql);
    $stmt->bindParam(':uid', $user['user_id'], PDO::PARAM_INT);
    $stmt->execute();
    $requests = $stmt->fetchAll(PDO::FETCH_ASSOC);
    echo json_encode(['success' => true, 'requests' => $requests]);
}

function getRequestDetails($conn, $user, $requestId) {
    // Verify the request belongs to the user or user has admin privileges
    $userRole = isset($user['role']) ? ucfirst(strtolower($user['role'])) : '';
    $userId = isset($user['user_id']) ? $user['user_id'] : 0;
    
    $sql = "SELECT r.request_id, r.book_id, r.requester_user_id, r.requested_days, r.message, r.status, r.created_at, r.decided_at, b.title as book_title
            FROM requests r
            LEFT JOIN books b ON r.book_id = b.book_id
            WHERE r.request_id = :request_id";
    
    // For non-admin users, ensure they can only see their own requests
    if (!in_array($userRole, ['Admin','Librarian','Staff'])) {
        $sql .= " AND r.requester_user_id = :user_id";
    }
    
    $stmt = $conn->prepare($sql);
    $stmt->bindParam(':request_id', $requestId, PDO::PARAM_INT);
    
    if (!in_array($userRole, ['Admin','Librarian','Staff'])) {
        $stmt->bindParam(':user_id', $userId, PDO::PARAM_INT);
    }
    
    $stmt->execute();
    $request = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$request) {
        http_response_code(404);
        echo json_encode(['success' => false, 'message' => 'Request not found or access denied']);
        return;
    }
    
    echo json_encode(['success' => true, 'request' => $request]);
}

function createRequest($conn, $user, $data) {
    if (!isset($data['book_id'])) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Book ID is required']);
        return;
    }

    $bookId = isset($data['book_id']) ? (int)$data['book_id'] : 0;
    $days = isset($data['requested_days']) ? (int)$data['requested_days'] : 14;
    $message = isset($data['message']) ? $data['message'] : '';
    $userId = isset($user['user_id']) ? $user['user_id'] : 0;
    
    // CRITICAL: Check if user is suspended or inactive
    $userStatus = $user['status'] ?? 'Active';
    if ($userStatus === 'Suspended' || $userStatus === 'Inactive') {
        http_response_code(403);
        echo json_encode([
            'success' => false,
            'message' => "Cannot create book request. Your account is {$userStatus}."
        ]);
        return;
    }

    // Log request data for debugging
    error_log("Create request data: userId={$userId}, bookId={$bookId}, days={$days}, message={$message}");

    try {
        // Validate book exists
        $bookCheckSql = "SELECT book_id FROM books WHERE book_id = :book_id";
        $bookCheckStmt = $conn->prepare($bookCheckSql);
        $bookCheckStmt->bindParam(':book_id', $bookId, PDO::PARAM_INT);
        $bookCheckStmt->execute();
        if (!$bookCheckStmt->fetch()) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Invalid book ID']);
            return;
        }

        $conn->beginTransaction();
        $sql = "INSERT INTO requests (requester_user_id, book_id, requested_days, message) VALUES (:uid, :book_id, :days, :msg)";
        $stmt = $conn->prepare($sql);
        $stmt->bindParam(':uid', $userId, PDO::PARAM_INT);
        $stmt->bindParam(':book_id', $bookId, PDO::PARAM_INT);
        $stmt->bindParam(':days', $days, PDO::PARAM_INT);
        $stmt->bindParam(':msg', $message);
        $result = $stmt->execute();
        
        if (!$result) {
            $conn->rollBack();
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Failed to insert request into database']);
            return;
        }
        
        $requestId = $conn->lastInsertId();

        // Log activity
        if (function_exists('logActivity')) {
            logActivity($conn, $userId, 'CREATE', 'requests', $requestId, "Created request for book_id $bookId");
        }

        // Create notifications for Admin and Librarian users
        try {
            // Get user name and book title for better notification messages
            $userStmt = $conn->prepare("SELECT name FROM users WHERE user_id = :user_id");
            $userStmt->bindParam(':user_id', $userId, PDO::PARAM_INT);
            $userStmt->execute();
            $userResult = $userStmt->fetch(PDO::FETCH_ASSOC);
            $userName = $userResult ? $userResult['name'] : "User {$userId}";
            
            $bookStmt = $conn->prepare("SELECT title FROM books WHERE book_id = :book_id");
            $bookStmt->bindParam(':book_id', $bookId, PDO::PARAM_INT);
            $bookStmt->execute();
            $bookResult = $bookStmt->fetch(PDO::FETCH_ASSOC);
            $bookTitle = $bookResult ? $bookResult['title'] : "Book ID {$bookId}";
            
            // First, get the IDs of Admin and Librarian users
            $adminLibSql = "SELECT user_id FROM users WHERE role IN ('Admin','Librarian')";
            $adminLibStmt = $conn->prepare($adminLibSql);
            $adminLibStmt->execute();
            $adminLibUsers = $adminLibStmt->fetchAll(PDO::FETCH_ASSOC);
            
            error_log("Found " . count($adminLibUsers) . " admin/librarian users for notifications");
            
            // Create notifications individually for each Admin/Librarian
            foreach ($adminLibUsers as $adminLibUser) {
                $notifSql = "INSERT INTO notifications (user_id, title, message, link) 
                             VALUES (:user_id, :title, :message, :link)";
                $notifStmt = $conn->prepare($notifSql);
                $notifTitle = 'New Book Request';
                $notifMessage = "{$userName} requested: {$bookTitle}";
                $notifLink = '/#pending-requests';
                $notifStmt->bindParam(':user_id', $adminLibUser['user_id'], PDO::PARAM_INT);
                $notifStmt->bindParam(':title', $notifTitle);
                $notifStmt->bindParam(':message', $notifMessage);
                $notifStmt->bindParam(':link', $notifLink);
                $notifResult = $notifStmt->execute();
                
                if (!$notifResult) {
                    error_log("Failed to create notification for user {$adminLibUser['user_id']}");
                }
            }
        } catch (Exception $e) {
            error_log('Failed to create notifications for admins: ' . $e->getMessage());
        }

        $conn->commit();
        echo json_encode(['success' => true, 'request_id' => $requestId]);
    } catch (Exception $e) {
        $conn->rollBack();
        error_log('Error creating request: ' . $e->getMessage());
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Failed to create request', 'error' => $e->getMessage()]);
    }
}

function approveRequest($conn, $user, $data) {
    if (!isset($data['request_id'])) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Request ID is required']);
        return;
    }
    $requestId = (int)$data['request_id'];
    $userId = isset($user['user_id']) ? $user['user_id'] : 0;

    try {
        $conn->beginTransaction();

        // Get request details
        $getRqSql = "SELECT requester_user_id, book_id, requested_days FROM requests WHERE request_id = :rid";
        $getRqStmt = $conn->prepare($getRqSql);
        $getRqStmt->bindParam(':rid', $requestId, PDO::PARAM_INT);
        $getRqStmt->execute();
        $rq = $getRqStmt->fetch(PDO::FETCH_ASSOC);

        if (!$rq) {
            $conn->rollBack();
            http_response_code(404);
            echo json_encode(['success' => false, 'message' => 'Request not found']);
            return;
        }

        // ensure requester is still active before approving
        $statusSql = "SELECT status FROM users WHERE user_id = :uid";
        $statusStmt = $conn->prepare($statusSql);
        $statusStmt->bindParam(':uid', $rq['requester_user_id'], PDO::PARAM_INT);
        $statusStmt->execute();
        $userRow = $statusStmt->fetch(PDO::FETCH_ASSOC);
        if ($userRow && isset($userRow['status']) && $userRow['status'] !== 'Active') {
            $conn->rollBack();
            http_response_code(403);
            echo json_encode(['success' => false, 'message' => "Cannot approve request: requester account is {$userRow['status']}."]);
            return;
        }

        // Check book availability
        $chkSql = "SELECT available_copies FROM books WHERE book_id = :bid";
        $chkStmt = $conn->prepare($chkSql);
        $chkStmt->bindParam(':bid', $rq['book_id'], PDO::PARAM_INT);
        $chkStmt->execute();
        $bk = $chkStmt->fetch(PDO::FETCH_ASSOC);

        if (!$bk || $bk['available_copies'] < 1) {
            $conn->rollBack();
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Book not available']);
            return;
        }

        // Update request status
        $upSql = "UPDATE requests SET status = 'Approved', decided_by = :did, decided_at = NOW() WHERE request_id = :rid";
        $upStmt = $conn->prepare($upSql);
        $upStmt->bindParam(':did', $userId, PDO::PARAM_INT);
        $upStmt->bindParam(':rid', $requestId, PDO::PARAM_INT);
        $upStmt->execute();

        // Auto-create borrowing record
        $dueDate = date('Y-m-d', strtotime("+{$rq['requested_days']} days"));

        // Map requesting user to a member record. If none exists, create one using user's name/email
        $memberId = null;
        $getUserSql = "SELECT user_id, name, email FROM users WHERE user_id = :uid";
        $getUserStmt = $conn->prepare($getUserSql);
        $getUserStmt->bindParam(':uid', $rq['requester_user_id'], PDO::PARAM_INT);
        $getUserStmt->execute();
        $requestingUser = $getUserStmt->fetch(PDO::FETCH_ASSOC);

        if ($requestingUser) {
            // Try to find a member by email
            $findMemberSql = "SELECT member_id FROM members WHERE email = :email LIMIT 1";
            $findMemberStmt = $conn->prepare($findMemberSql);
            $findMemberStmt->bindParam(':email', $requestingUser['email']);
            $findMemberStmt->execute();
            $member = $findMemberStmt->fetch(PDO::FETCH_ASSOC);
            if ($member && isset($member['member_id'])) {
                $memberId = (int)$member['member_id'];
            } else {
                // Create a new member record
                $insertMemberSql = "INSERT INTO members (name, email, join_date, status, created_at) VALUES (:name, :email, CURDATE(), 'Active', NOW())";
                $insertMemberStmt = $conn->prepare($insertMemberSql);
                $insertMemberStmt->bindParam(':name', $requestingUser['name']);
                $insertMemberStmt->bindParam(':email', $requestingUser['email']);
                $insertMemberStmt->execute();
                $memberId = (int)$conn->lastInsertId();
            }
        }

        if (!$memberId) {
            // Cannot determine a member to create borrowing record
            $conn->rollBack();
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Failed to map requester to a member record']);
            return;
        }

        $brSql = "INSERT INTO borrowing_records (member_id, book_id, borrow_date, due_date, created_by) VALUES (:mid, :bid, CURDATE(), :due, :cby)";
        $brStmt = $conn->prepare($brSql);
        $brStmt->bindParam(':mid', $memberId, PDO::PARAM_INT);
        $brStmt->bindParam(':bid', $rq['book_id'], PDO::PARAM_INT);
        $brStmt->bindParam(':due', $dueDate);
        $brStmt->bindParam(':cby', $userId, PDO::PARAM_INT);
        $brStmt->execute();

        // Decrement available copies and update status if all copies are now borrowed
        $decSql = "UPDATE books SET available_copies = available_copies - 1, 
                   status = CASE WHEN (available_copies - 1) <= 0 THEN 'Borrowed' ELSE status END 
                   WHERE book_id = :bid";
        $decStmt = $conn->prepare($decSql);
        $decStmt->bindParam(':bid', $rq['book_id'], PDO::PARAM_INT);
        $decStmt->execute();

        // Notify requester that request was approved
        try {
            // Get book title for better notification message
            $bookStmt = $conn->prepare("SELECT title FROM books WHERE book_id = :book_id");
            $bookStmt->bindParam(':book_id', $rq['book_id'], PDO::PARAM_INT);
            $bookStmt->execute();
            $book = $bookStmt->fetch(PDO::FETCH_ASSOC);
            $bookTitle = $book ? $book['title'] : "Book ID {$rq['book_id']}";
            
            $notifSql = "INSERT INTO notifications (user_id, title, message, link) VALUES (:uid, :title, :message, :link)";
            $notifStmt = $conn->prepare($notifSql);
            $approvalTitle = 'Request Approved';
            $approvalMessage = "Your request for '{$bookTitle}' has been approved. You can now borrow the book.";
            $approvalLink = '/#borrowing';
            $notifStmt->bindParam(':uid', $rq['requester_user_id'], PDO::PARAM_INT);
            $notifStmt->bindParam(':title', $approvalTitle);
            $notifStmt->bindParam(':message', $approvalMessage);
            $notifStmt->bindParam(':link', $approvalLink);
            $notifStmt->execute();
        } catch (Exception $e) {
            error_log('Failed to create notification for requester: ' . $e->getMessage());
        }

        // Log activity
        if (function_exists('logActivity')) {
            logActivity($conn, $userId, 'APPROVE', 'requests', $requestId, "Approved request $requestId, created borrowing record");
        }

        $conn->commit();
        echo json_encode(['success' => true, 'message' => 'Request approved and borrowing record created']);
    } catch (Exception $e) {
        $conn->rollBack();
        error_log('Error approving request: ' . $e->getMessage());
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Failed to approve request']);
    }
}

function declineRequest($conn, $user, $data) {
    if (!isset($data['request_id'])) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Request ID is required']);
        return;
    }
    $requestId = isset($data['request_id']) ? (int)$data['request_id'] : 0;
    $reason = isset($data['reason']) ? $data['reason'] : '';
    $userId = isset($user['user_id']) ? $user['user_id'] : 0;

    try {
        $sql = "UPDATE requests SET status = 'Declined', decided_by = :did, decided_at = NOW(), message = CONCAT(IFNULL(message,''), '\n\nDecline reason: ', :reason) WHERE request_id = :rid";
        $stmt = $conn->prepare($sql);
        $stmt->bindParam(':did', $userId, PDO::PARAM_INT);
        $stmt->bindParam(':reason', $reason);
        $stmt->bindParam(':rid', $requestId, PDO::PARAM_INT);
        $stmt->execute();

        if (function_exists('logActivity')) {
            logActivity($conn, $userId, 'DECLINE', 'requests', $requestId, "Declined request $requestId: $reason");
        }

        echo json_encode(['success' => true]);
    } catch (Exception $e) {
        error_log('Error declining request: ' . $e->getMessage());
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Failed to decline request']);
    }
}

?>