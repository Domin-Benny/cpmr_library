<?php
// Simulate the createRequest function to debug notification creation
require_once 'backend/config/database.php';

try {
    $db = new Database();
    $conn = $db->getConnection();
    
    echo "Testing request creation with notifications...\n";
    
    // Simulate user data (student)
    $user = [
        'user_id' => 22,
        'name' => 'student',
        'role' => 'Student'
    ];
    
    // Test data
    $data = [
        'book_id' => 1,
        'requested_days' => 14,
        'message' => 'Test request for debugging'
    ];
    
    $userId = $user['user_id'];
    $bookId = $data['book_id'];
    $days = $data['requested_days'];
    $message = $data['message'];
    
    // Check current notification count
    $countStmt = $conn->prepare("SELECT COUNT(*) as count FROM notifications");
    $countStmt->execute();
    $beforeCount = $countStmt->fetch(PDO::FETCH_ASSOC)['count'];
    echo "Notifications before: {$beforeCount}\n";
    
    // Start transaction
    $conn->beginTransaction();
    
    // Insert request
    $sql = "INSERT INTO requests (requester_user_id, book_id, requested_days, message) VALUES (:uid, :book_id, :days, :msg)";
    $stmt = $conn->prepare($sql);
    $stmt->bindParam(':uid', $userId, PDO::PARAM_INT);
    $stmt->bindParam(':book_id', $bookId, PDO::PARAM_INT);
    $stmt->bindParam(':days', $days, PDO::PARAM_INT);
    $stmt->bindParam(':msg', $message);
    $stmt->execute();
    $requestId = $conn->lastInsertId();
    
    echo "Created request ID: {$requestId}\n";
    
    // Log activity (this might be causing issues)
    echo "Logging activity...\n";
    if (function_exists('logActivity')) {
        $logResult = logActivity($conn, $userId, 'CREATE', 'requests', $requestId, "Created request for book_id $bookId");
        echo "Activity log result: " . ($logResult ? "SUCCESS" : "FAILED") . "\n";
    } else {
        echo "logActivity function not found\n";
    }
    
    // Create notifications for Admin and Librarian users
    echo "Creating notifications...\n";
    try {
        // Get user name and book title for better notification messages
        $userStmt = $conn->prepare("SELECT name FROM users WHERE user_id = :user_id");
        $userStmt->bindParam(':user_id', $userId, PDO::PARAM_INT);
        $userStmt->execute();
        $user = $userStmt->fetch(PDO::FETCH_ASSOC);
        $userName = $user ? $user['name'] : "User {$userId}";
        
        $bookStmt = $conn->prepare("SELECT title FROM books WHERE book_id = :book_id");
        $bookStmt->bindParam(':book_id', $bookId, PDO::PARAM_INT);
        $bookStmt->execute();
        $book = $bookStmt->fetch(PDO::FETCH_ASSOC);
        $bookTitle = $book ? $book['title'] : "Book ID {$bookId}";
        
        $notifSql = "INSERT INTO notifications (user_id, title, message, link) 
                     SELECT u.user_id, :title, :message, :link FROM users u WHERE u.role IN ('Admin','Librarian')";
        $notifStmt = $conn->prepare($notifSql);
        $notifTitle = 'New Book Request';
        $notifMessage = "{$userName} requested: {$bookTitle}";
        $notifLink = '/#pending-requests';
        $notifStmt->bindParam(':title', $notifTitle);
        $notifStmt->bindParam(':message', $notifMessage);
        $notifStmt->bindParam(':link', $notifLink);
        $notifResult = $notifStmt->execute();
        
        echo "Notification creation result: " . ($notifResult ? "SUCCESS" : "FAILED") . "\n";
        if ($notifResult) {
            $notifId = $conn->lastInsertId();
            echo "Notification ID created: {$notifId}\n";
        }
        
    } catch (Exception $e) {
        echo "Notification creation error: " . $e->getMessage() . "\n";
    }
    
    // Commit transaction
    echo "Committing transaction...\n";
    $conn->commit();
    
    // Check final notification count
    $countStmt->execute();
    $afterCount = $countStmt->fetch(PDO::FETCH_ASSOC)['count'];
    echo "Notifications after: {$afterCount}\n";
    
    if ($afterCount > $beforeCount) {
        echo "✅ SUCCESS: Notifications were created!\n";
        
        // Show the new notifications
        $newNotifStmt = $conn->prepare("SELECT * FROM notifications WHERE notification_id > (SELECT MAX(notification_id) - 3 FROM notifications)");
        $newNotifStmt->execute();
        $newNotifications = $newNotifStmt->fetchAll(PDO::FETCH_ASSOC);
        
        echo "\nNew notifications:\n";
        foreach($newNotifications as $notif) {
            echo "ID: {$notif['notification_id']} - User: {$notif['user_id']} - Title: {$notif['title']}\n";
            echo "   Message: {$notif['message']}\n";
        }
        
        // Clean up
        $cleanupStmt = $conn->prepare("DELETE FROM requests WHERE request_id = :request_id");
        $cleanupStmt->bindParam(':request_id', $requestId, PDO::PARAM_INT);
        $cleanupStmt->execute();
        echo "✅ Cleaned up test request\n";
        
    } else {
        echo "❌ FAILED: No new notifications created\n";
    }
    
} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
    if (isset($conn)) {
        $conn->rollBack();
    }
}
?>