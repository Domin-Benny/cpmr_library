<?php
// =============================================
// Admin Security Questions Management API
// File: backend/api/admin_security_questions.php
// Description: Handle admin security questions setup and management
// =============================================

header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");

require_once '../../config/database.php';

// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Only handle POST/GET requests
if ($_SERVER['REQUEST_METHOD'] !== 'POST' && $_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode([
        'success' => false,
        'message' => 'Method not allowed'
    ]);
    exit();
}

// Get request data
$data = json_decode(file_get_contents("php://input"), true);
$action = $_GET['action'] ?? $data['action'] ?? '';

try {
    $database = new Database();
    $conn = $database->getConnection();

    if ($action === 'get-admin-questions') {
        // Get current admin security questions
        
        if (!isset($data['user_id']) || empty($data['user_id'])) {
            http_response_code(400);
            echo json_encode([
                'success' => false,
                'message' => 'User ID is required'
            ]);
            exit();
        }

        $user_id = intval($data['user_id']);

        // Verify user is admin
        $verifySQL = "SELECT role FROM users WHERE user_id = :user_id";
        $verifyStmt = $conn->prepare($verifySQL);
        $verifyStmt->bindParam(':user_id', $user_id);
        $verifyStmt->execute();

        if ($verifyStmt->rowCount() === 0) {
            http_response_code(404);
            echo json_encode([
                'success' => false,
                'message' => 'User not found'
            ]);
            exit();
        }

        $user = $verifyStmt->fetch(PDO::FETCH_ASSOC);
        if ($user['role'] !== 'Admin') {
            http_response_code(403);
            echo json_encode([
                'success' => false,
                'message' => 'Only admins can manage security questions'
            ]);
            exit();
        }

        // Get admin's security question
        $sql = "SELECT user_id, username, security_question, security_answer FROM users WHERE user_id = :user_id";
        $stmt = $conn->prepare($sql);
        $stmt->bindParam(':user_id', $user_id);
        $stmt->execute();

        if ($stmt->rowCount() > 0) {
            $admin = $stmt->fetch(PDO::FETCH_ASSOC);
            
            http_response_code(200);
            echo json_encode([
                'success' => true,
                'message' => 'Admin security questions retrieved',
                'user_id' => $admin['user_id'],
                'username' => $admin['username'],
                'security_question' => $admin['security_question'],
                'security_answer' => $admin['security_answer'],
                'has_questions' => !empty($admin['security_question']) ? true : false
            ]);
        } else {
            http_response_code(404);
            echo json_encode([
                'success' => false,
                'message' => 'Admin not found'
            ]);
        }
    }

    elseif ($action === 'set-security-question') {
        // Set/Update security question for admin
        
        if (!isset($data['user_id']) || !isset($data['security_question']) || !isset($data['security_answer'])) {
            http_response_code(400);
            echo json_encode([
                'success' => false,
                'message' => 'User ID, security question, and answer are required'
            ]);
            exit();
        }

        $user_id = intval($data['user_id']);
        $security_question = htmlspecialchars(strip_tags(trim($data['security_question'])));
        $security_answer = htmlspecialchars(strip_tags(trim(strtolower($data['security_answer']))));

        // Verify user is admin
        $verifySQL = "SELECT role FROM users WHERE user_id = :user_id";
        $verifyStmt = $conn->prepare($verifySQL);
        $verifyStmt->bindParam(':user_id', $user_id);
        $verifyStmt->execute();

        if ($verifyStmt->rowCount() === 0) {
            http_response_code(404);
            echo json_encode([
                'success' => false,
                'message' => 'User not found'
            ]);
            exit();
        }

        $user = $verifyStmt->fetch(PDO::FETCH_ASSOC);
        if ($user['role'] !== 'Admin') {
            http_response_code(403);
            echo json_encode([
                'success' => false,
                'message' => 'Only admins can set security questions'
            ]);
            exit();
        }

        // Validate inputs
        if (strlen($security_question) < 5) {
            http_response_code(400);
            echo json_encode([
                'success' => false,
                'message' => 'Security question must be at least 5 characters long'
            ]);
            exit();
        }

        if (strlen($security_answer) < 2) {
            http_response_code(400);
            echo json_encode([
                'success' => false,
                'message' => 'Security answer must be at least 2 characters long'
            ]);
            exit();
        }

        // Update security question and answer
        $updateSQL = "UPDATE users SET security_question = :question, security_answer = :answer, updated_at = NOW() WHERE user_id = :user_id";
        $updateStmt = $conn->prepare($updateSQL);
        $updateStmt->bindParam(':question', $security_question);
        $updateStmt->bindParam(':answer', $security_answer);
        $updateStmt->bindParam(':user_id', $user_id);

        if ($updateStmt->execute()) {
            http_response_code(200);
            echo json_encode([
                'success' => true,
                'message' => 'Security question updated successfully'
            ]);
        } else {
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => 'Failed to update security question'
            ]);
        }
    }

    elseif ($action === 'get-predefined-questions') {
        // Get list of predefined security questions for admin
        
        $predefinedQuestions = [
            "In what city were you born?",
            "What is your mother's maiden name?",
            "What was the name of your first pet?",
            "What is your favorite book?",
            "What was the name of your first school?",
            "What is your favorite movie?",
            "What street did you live on in third grade?",
            "What is your favorite sports team?",
            "What is the name of your best friend?",
            "In what city or town did your mother and father meet?",
            "What is your favorite food?",
            "What is your favorite color?",
            "What is the name of your first crush?",
            "What was your childhood phone number (including area code)?",
            "On what date was your mother born?",
            "What is the name of a college you applied to but did not attend?",
            "What is your favorite holiday?",
            "What is the brand of your first car?",
            "What is your favorite artist or band?",
            "What high school did you attend?"
        ];

        http_response_code(200);
        echo json_encode([
            'success' => true,
            'message' => 'Predefined security questions retrieved',
            'questions' => $predefinedQuestions
        ]);
    }

    else {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'message' => 'Invalid action'
        ]);
    }

} catch (Exception $e) {
    error_log("Admin security questions error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Internal server error'
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
