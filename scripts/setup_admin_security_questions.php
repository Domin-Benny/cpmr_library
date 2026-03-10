<?php
// =============================================
// Admin Security Questions Setup Migration
// File: database/setup_admin_security_questions.php
// Description: Run this to set default security questions for admin user
// =============================================

header("Content-Type: application/json");

require_once '../config/database.php';

// Check if already set
$database = new Database();
$conn = $database->getConnection();

try {
    // Get current admin settings
    $checkSQL = "SELECT user_id, username, security_question, security_answer FROM users WHERE username = 'admin' AND role = 'Admin' LIMIT 1";
    $checkStmt = $conn->prepare($checkSQL);
    $checkStmt->execute();
    
    if ($checkStmt->rowCount() > 0) {
        $admin = $checkStmt->fetch(PDO::FETCH_ASSOC);
        
        if (!empty($admin['security_question']) && !empty($admin['security_answer'])) {
            // Already has security questions set
            echo json_encode([
                'success' => true,
                'message' => 'Admin user already has security questions set',
                'admin_id' => $admin['user_id'],
                'username' => $admin['username'],
                'has_questions' => true
            ]);
            exit();
        }
    }
    
    // Set default security questions for admin user
    // Default question and answer for built-in security
    $defaultQuestion = "What was the name of your first pet?";
    $defaultAnswer = "fluffy"; // This is just an example, should be changed by admin
    
    $updateSQL = "UPDATE users 
                  SET security_question = :question, security_answer = :answer, updated_at = NOW()
                  WHERE username = 'admin' AND role = 'Admin'";
    
    $updateStmt = $conn->prepare($updateSQL);
    $updateStmt->bindParam(':question', $defaultQuestion);
    $updateStmt->bindParam(':answer', $defaultAnswer);
    
    if ($updateStmt->execute()) {
        echo json_encode([
            'success' => true,
            'message' => 'Default security questions set for admin user',
            'details' => 'The admin should change these default questions immediately in the Settings page for security',
            'rows_affected' => $updateStmt->rowCount()
        ]);
    } else {
        echo json_encode([
            'success' => false,
            'message' => 'Failed to set security questions'
        ]);
    }
    
} catch (Exception $e) {
    error_log("Setup error: " . $e->getMessage());
    echo json_encode([
        'success' => false,
        'message' => 'Error during setup: ' . $e->getMessage()
    ]);
} finally {
    if (isset($database) && method_exists($database, 'closeConnection')) {
        try {
            $database->closeConnection();
        } catch (Exception $e) {
            error_log("Error closing connection: " . $e->getMessage());
        }
    }
}
?>
