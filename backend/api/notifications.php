<?php
// =============================================
// Notifications API
// File: backend/api/notifications.php
// Description: Fetch and manage user notifications
// =============================================

header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");

require_once '../../config/database.php';
require_once 'auth_helper.php';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

$user = isAuthenticated();
if (!$user) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Authentication required']);
    exit();
}

try {
    $database = new Database();
    $conn = $database->getConnection();

    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        $action = $_GET['action'] ?? '';

        if ($action === 'count') {
            $sql = "SELECT COUNT(*) as cnt FROM notifications WHERE user_id = :uid AND is_read = 0";
            $stmt = $conn->prepare($sql);
            $stmt->bindParam(':uid', $user['user_id'], PDO::PARAM_INT);
            $stmt->execute();
            $row = $stmt->fetch(PDO::FETCH_ASSOC);
            echo json_encode(['success' => true, 'count' => (int)$row['cnt']]);
            exit();
        }

        if ($action === 'list') {
            $limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 10;
            $sql = "SELECT notification_id, title, message, is_read, link, created_at FROM notifications WHERE user_id = :uid ORDER BY created_at DESC LIMIT :limit";
            $stmt = $conn->prepare($sql);
            $stmt->bindParam(':uid', $user['user_id'], PDO::PARAM_INT);
            $stmt->bindParam(':limit', $limit, PDO::PARAM_INT);
            $stmt->execute();
            $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
            echo json_encode(['success' => true, 'notifications' => $rows]);
            exit();
        }

        // default
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Invalid action']);
        exit();
    }

    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $data = json_decode(file_get_contents('php://input'), true);
        $act = $data['action'] ?? '';
        
        error_log('=== POST REQUEST DEBUG ===');
        error_log('Action received: ' . $act);
        error_log('Data: ' . print_r($data, true));
        error_log('User ID: ' . $user['user_id']);
        
        // Early file logging to verify POST is being reached
        file_put_contents(__DIR__ . '/../../post_test.log', "POST received - action: $act - user_id: " . $user['user_id'] . " - time: " . date('H:i:s') . "\n", FILE_APPEND);
        
        if ($act === 'markRead') {
            // Enhanced debugging
            error_log('=== MARK READ DEBUG ===');
            error_log('markRead action called');
            error_log('POST data: ' . print_r($data, true));
            error_log('User data: ' . print_r($user, true));
            error_log('User ID from token: ' . $user['user_id']);
            
            if (!isset($data['notification_id'])) {
                error_log('ERROR: Notification ID missing');
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'Notification ID required']);
                exit();
            }
            
            $nid = (int)$data['notification_id'];
            error_log('Notification ID to update: ' . $nid);
            
            // First, check if notification exists (without user filter first)
            $checkSql = "SELECT * FROM notifications WHERE notification_id = :nid";
            $checkStmt = $conn->prepare($checkSql);
            $checkStmt->bindParam(':nid', $nid, PDO::PARAM_INT);
            $checkStmt->execute();
            $notification = $checkStmt->fetch(PDO::FETCH_ASSOC);
            
            error_log('Found notification: ' . print_r($notification, true));
            
            if (!$notification) {
                error_log('ERROR: Notification not found in database');
                http_response_code(404);
                echo json_encode(['success' => false, 'message' => 'Notification not found']);
                exit();
            }
            
            error_log('Notification user_id: ' . $notification['user_id']);
            error_log('Current user_id: ' . $user['user_id']);
            
            // Check if user is authorized to modify this notification
            if ($notification['user_id'] != $user['user_id']) {
                error_log('ERROR: User ID mismatch - unauthorized access attempt');
                error_log('Expected user_id: ' . $notification['user_id'] . ', Got: ' . $user['user_id']);
                http_response_code(403);
                echo json_encode(['success' => false, 'message' => 'Not authorized to modify this notification']);
                exit();
            }
            
            // Check current read status
            error_log('Current is_read status: ' . $notification['is_read']);
            
            if ($notification['is_read'] == 1) {
                error_log('INFO: Notification already marked as read');
                echo json_encode(['success' => true, 'message' => 'Notification already read']);
                exit();
            }
            
            // Perform the update
            $sql = "UPDATE notifications SET is_read = 1 WHERE notification_id = :nid";
            $stmt = $conn->prepare($sql);
            $stmt->bindParam(':nid', $nid, PDO::PARAM_INT);
            $result = $stmt->execute();
            
            error_log('Update query result: ' . ($result ? 'success' : 'failed'));
            error_log('Rows affected: ' . $stmt->rowCount());
            
            // Verify the update
            $verifySql = "SELECT is_read FROM notifications WHERE notification_id = :nid";
            $verifyStmt = $conn->prepare($verifySql);
            $verifyStmt->bindParam(':nid', $nid, PDO::PARAM_INT);
            $verifyStmt->execute();
            $verifyResult = $verifyStmt->fetch(PDO::FETCH_ASSOC);
            
            error_log('Verification - is_read after update: ' . $verifyResult['is_read']);
            
            if ($result && $stmt->rowCount() > 0 && $verifyResult['is_read'] == 1) {
                error_log('SUCCESS: Notification marked as read');
                echo json_encode(['success' => true, 'message' => 'Notification marked as read', 'notification_id' => $nid]);
            } else {
                error_log('ERROR: Failed to update notification');
                echo json_encode(['success' => false, 'message' => 'Failed to update notification']);
            }
            exit();
        }

        if ($act === 'markAllRead') {
            $sql = "UPDATE notifications SET is_read = 1 WHERE user_id = :uid";
            $stmt = $conn->prepare($sql);
            $stmt->bindParam(':uid', $user['user_id'], PDO::PARAM_INT);
            $stmt->execute();
            echo json_encode(['success' => true]);
            exit();
        }

        if ($act === 'clearAll') {
            // VERIFY THIS CODE IS BEING REACHED
            file_put_contents(__DIR__ . '/../../clearall_reached.log', "CLEARALL HANDLER REACHED at " . date('Y-m-d H:i:s') . "\n", FILE_APPEND);
            
            // Delete all notifications for the user
            $logFile = __DIR__ . '/../../clearall_debug.log';
            file_put_contents($logFile, "\n=== CLEAR ALL DEBUG " . date('Y-m-d H:i:s') . " ===\n", FILE_APPEND);
            file_put_contents($logFile, "User data: " . json_encode($user) . "\n", FILE_APPEND);
            file_put_contents($logFile, "User ID value: " . $user['user_id'] . "\n", FILE_APPEND);
            file_put_contents($logFile, "User ID type: " . gettype($user['user_id']) . "\n", FILE_APPEND);
            
            // Explicitly convert to integer
            $user_id_int = (int)$user['user_id'];
            file_put_contents($logFile, "User ID as INT: " . $user_id_int . "\n", FILE_APPEND);
            
            // First check how many notifications exist for this user
            $countSql = "SELECT COUNT(*) as cnt FROM notifications WHERE user_id = :uid";
            $countStmt = $conn->prepare($countSql);
            $countStmt->bindParam(':uid', $user_id_int, PDO::PARAM_INT);
            $countStmt->execute();
            $countRow = $countStmt->fetch(PDO::FETCH_ASSOC);
            file_put_contents($logFile, "Notifications count for user: " . $countRow['cnt'] . "\n", FILE_APPEND);
            
            try {
                file_put_contents($logFile, "Preparing DELETE query\n", FILE_APPEND);
                $sql = "DELETE FROM notifications WHERE user_id = :uid";
                file_put_contents($logFile, "Query: " . $sql . "\n", FILE_APPEND);
                
                $stmt = $conn->prepare($sql);
                file_put_contents($logFile, "Statement prepared\n", FILE_APPEND);
                
                $stmt->bindParam(':uid', $user_id_int, PDO::PARAM_INT);
                file_put_contents($logFile, "Parameter bound: uid=" . $user_id_int . "\n", FILE_APPEND);
                
                $result = $stmt->execute();
                file_put_contents($logFile, "Execute result: " . ($result ? 'true' : 'false') . "\n", FILE_APPEND);
                
                $deletedCount = $stmt->rowCount();
                file_put_contents($logFile, "Rows deleted: " . $deletedCount . "\n", FILE_APPEND);
                
                // Verify deletion
                $verifyStmt = $conn->prepare("SELECT COUNT(*) as cnt FROM notifications WHERE user_id = :uid");
                $verifyStmt->bindParam(':uid', $user_id_int, PDO::PARAM_INT);
                $verifyStmt->execute();
                $verifyRow = $verifyStmt->fetch(PDO::FETCH_ASSOC);
                file_put_contents($logFile, "Notifications count after delete: " . $verifyRow['cnt'] . "\n", FILE_APPEND);
                
                $response = ['success' => true, 'message' => 'All notifications cleared', 'deleted_count' => $deletedCount];
                file_put_contents($logFile, "Response: " . json_encode($response) . "\n", FILE_APPEND);
                
                echo json_encode($response);
            } catch (Exception $e) {
                file_put_contents($logFile, "Exception: " . $e->getMessage() . "\n", FILE_APPEND);
                error_log('Exception in clearAll: ' . $e->getMessage());
                http_response_code(500);
                echo json_encode(['success' => false, 'message' => 'Error clearing notifications: ' . $e->getMessage()]);
            }
            exit();
        }
        
        if ($act === 'cleanup') {
            // Only allow cleanup for Admin users
            if (!isset($user['role']) || strtolower($user['role']) !== 'admin') {
                http_response_code(403);
                echo json_encode(['success' => false, 'message' => 'Insufficient permissions']);
                exit();
            }
            
            $days = isset($data['days']) ? (int)$data['days'] : 30;
            $sql = "DELETE FROM notifications WHERE created_at < DATE_SUB(NOW(), INTERVAL :days DAY)";
            $stmt = $conn->prepare($sql);
            $stmt->bindParam(':days', $days, PDO::PARAM_INT);
            $stmt->execute();
            
            $deletedCount = $stmt->rowCount();
            error_log('Cleaned up ' . $deletedCount . ' old notifications');
            
            echo json_encode(['success' => true, 'message' => 'Cleaned up ' . $deletedCount . ' old notifications', 'deleted_count' => $deletedCount]);
            exit();
        }
        
        if ($act === 'sendDueNotifications') {
            // Send due date reminders and overdue notifications
            // Only Admin and Librarian can send notifications
            if (!isset($user['role']) || !in_array(strtolower($user['role']), ['admin', 'librarian'])) {
                http_response_code(403);
                echo json_encode(['success' => false, 'message' => 'Insufficient permissions']);
                exit();
            }
            
            $notificationType = $data['type'] ?? 'all'; // 'overdue', 'due_soon', 'all'
            $daysBefore = isset($data['days_before']) ? (int)$data['days_before'] : 3; // Days before due date
            
            // Get custom message templates
            $overdueTemplate = $data['overdue_template'] ?? null;
            $dueSoonTemplate = $data['due_soon_template'] ?? null;
            
            // Default templates if not provided
            if (!$overdueTemplate) {
                $overdueTemplate = "Your book '{book_title}' by {book_author} is overdue by {days_overdue} day(s). Due date was {due_date}. Please return it as soon as possible.";
            }
            if (!$dueSoonTemplate) {
                $dueSoonTemplate = "Friendly reminder: Your book '{book_title}' by {book_author} is due in {days_until_due} day(s) on {due_date}. Please return it on time to avoid fines.";
            }
            
            error_log("=== SEND DUE NOTIFICATIONS ===");
            error_log("Type: $notificationType, Days before: $daysBefore");
            error_log("Custom overdue template: " . ($overdueTemplate ? 'yes' : 'no'));
            error_log("Custom due soon template: " . ($dueSoonTemplate ? 'yes' : 'no'));
            
            $sentCount = 0;
            $overdueCount = 0;
            $dueSoonCount = 0;
            $messagesPreview = [];
            
            try {
                // Get overdue borrowings (past due date)
                if ($notificationType === 'all' || $notificationType === 'overdue') {
                    $overdueSql = "SELECT 
                        br.record_id,
                        br.member_id,
                        br.book_id,
                        br.due_date,
                        DATEDIFF(CURDATE(), br.due_date) as days_overdue,
                        m.name as member_name,
                        m.email as member_email,
                        m.phone as member_phone,
                        b.title as book_title,
                        b.author as book_author,
                        u.name as created_by_name
                    FROM borrowing_records br
                    JOIN members m ON br.member_id = m.member_id
                    JOIN books b ON br.book_id = b.book_id
                    LEFT JOIN users u ON br.created_by = u.user_id
                    WHERE br.status = 'Active' 
                    AND br.due_date < CURDATE()
                    ORDER BY br.due_date";
                    
                    $overdueStmt = $conn->prepare($overdueSql);
                    $overdueStmt->execute();
                    $overdueBorrowings = $overdueStmt->fetchAll(PDO::FETCH_ASSOC);
                    
                    error_log("Found " . count($overdueBorrowings) . " overdue borrowings");
                    
                    // Generate preview of first message
                    if (count($overdueBorrowings) > 0) {
                        $first = $overdueBorrowings[0];
                        $previewMsg = str_replace(
                            ['{book_title}', '{book_author}', '{member_name}', '{days_overdue}', '{due_date}', '{member_email}'],
                            [$first['book_title'], $first['book_author'], $first['member_name'], $first['days_overdue'], $first['due_date'], $first['member_email']],
                            $overdueTemplate
                        );
                        $messagesPreview['overdue'] = $previewMsg;
                    }
                    
                    foreach ($overdueBorrowings as $borrowing) {
                        // Replace placeholders in custom template
                        $message = str_replace(
                            ['{book_title}', '{book_author}', '{member_name}', '{days_overdue}', '{due_date}', '{member_email}'],
                            [$borrowing['book_title'], $borrowing['book_author'], $borrowing['member_name'], $borrowing['days_overdue'], $borrowing['due_date'], $borrowing['member_email']],
                            $overdueTemplate
                        );
                        
                        // Create notification for user
                        $title = "📚 Overdue Book Notice";
                        $link = "/frontend/index.html?page=borrowing";
                        
                        $notifSql = "INSERT INTO notifications (user_id, title, message, link, created_at) 
                                    VALUES (:uid, :title, :message, :link, NOW())";
                        $notifStmt = $conn->prepare($notifSql);
                        $notifStmt->bindParam(':uid', $borrowing['member_id'], PDO::PARAM_INT);
                        $notifStmt->bindParam(':title', $title);
                        $notifStmt->bindParam(':message', $message);
                        $notifStmt->bindParam(':link', $link);
                        $notifStmt->execute();
                        
                        // TODO: Send email notification
                        // sendEmailNotification($borrowing['member_email'], $title, $message);
                        
                        // TODO: Send SMS notification
                        // sendSMSNotification($borrowing['member_phone'], $message);
                        
                        $overdueCount++;
                        $sentCount++;
                        
                        error_log("Sent overdue notification to member {$borrowing['member_id']}");
                    }
                }
                
                // Get borrowings due soon (within next X days)
                if ($notificationType === 'all' || $notificationType === 'due_soon') {
                    $dueSoonSql = "SELECT 
                        br.record_id,
                        br.member_id,
                        br.book_id,
                        br.due_date,
                        DATEDIFF(br.due_date, CURDATE()) as days_until_due,
                        m.name as member_name,
                        m.email as member_email,
                        m.phone as member_phone,
                        b.title as book_title,
                        b.author as book_author,
                        u.name as created_by_name
                    FROM borrowing_records br
                    JOIN members m ON br.member_id = m.member_id
                    JOIN books b ON br.book_id = b.book_id
                    LEFT JOIN users u ON br.created_by = u.user_id
                    WHERE br.status = 'Active' 
                    AND br.due_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL :days DAY)
                    ORDER BY br.due_date";
                    
                    $dueSoonStmt = $conn->prepare($dueSoonSql);
                    $dueSoonStmt->bindParam(':days', $daysBefore, PDO::PARAM_INT);
                    $dueSoonStmt->execute();
                    $dueSoonBorrowings = $dueSoonStmt->fetchAll(PDO::FETCH_ASSOC);
                    
                    error_log("Found " . count($dueSoonBorrowings) . " borrowings due soon");
                    
                    // Generate preview of first message
                    if (count($dueSoonBorrowings) > 0) {
                        $first = $dueSoonBorrowings[0];
                        $previewMsg = str_replace(
                            ['{book_title}', '{book_author}', '{member_name}', '{days_until_due}', '{due_date}', '{member_email}'],
                            [$first['book_title'], $first['book_author'], $first['member_name'], $first['days_until_due'], $first['due_date'], $first['member_email']],
                            $dueSoonTemplate
                        );
                        $messagesPreview['due_soon'] = $previewMsg;
                    }
                    
                    foreach ($dueSoonBorrowings as $borrowing) {
                        // Replace placeholders in custom template
                        $message = str_replace(
                            ['{book_title}', '{book_author}', '{member_name}', '{days_until_due}', '{due_date}', '{member_email}'],
                            [$borrowing['book_title'], $borrowing['book_author'], $borrowing['member_name'], $borrowing['days_until_due'], $borrowing['due_date'], $borrowing['member_email']],
                            $dueSoonTemplate
                        );
                        
                        $title = "⏰ Book Due Soon Reminder";
                        $link = "/frontend/index.html?page=borrowing";
                        
                        $notifSql = "INSERT INTO notifications (user_id, title, message, link, created_at) 
                                    VALUES (:uid, :title, :message, :link, NOW())";
                        $notifStmt = $conn->prepare($notifSql);
                        $notifStmt->bindParam(':uid', $borrowing['member_id'], PDO::PARAM_INT);
                        $notifStmt->bindParam(':title', $title);
                        $notifStmt->bindParam(':message', $message);
                        $notifStmt->bindParam(':link', $link);
                        $notifStmt->execute();
                        
                        // TODO: Send email notification
                        // sendEmailNotification($borrowing['member_email'], $title, $message);
                        
                        // TODO: Send SMS notification  
                        // sendSMSNotification($borrowing['member_phone'], $message);
                        
                        $dueSoonCount++;
                        $sentCount++;
                        
                        error_log("Sent due soon notification to member {$borrowing['member_id']}");
                    }
                }
                
                error_log("Total notifications sent: $sentCount (Overdue: $overdueCount, Due Soon: $dueSoonCount)");
                
                echo json_encode([
                    'success' => true,
                    'message' => "Sent $sentCount due date notifications",
                    'total_sent' => $sentCount,
                    'overdue_count' => $overdueCount,
                    'due_soon_count' => $dueSoonCount,
                    'details' => [
                        'overdue_notifications' => $overdueCount,
                        'due_soon_notifications' => $dueSoonCount
                    ],
                    'messages_preview' => $messagesPreview
                ]);
                
            } catch (Exception $e) {
                error_log('Error sending due notifications: ' . $e->getMessage());
                http_response_code(500);
                echo json_encode([
                    'success' => false,
                    'message' => 'Error sending notifications: ' . $e->getMessage()
                ]);
            }
            exit();
        }

        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Invalid action']);
        exit();
    }

} catch (Exception $e) {
    error_log('Notifications API error: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Internal server error']);
} finally {
    if (isset($conn)) $database->closeConnection();
}
?>