<?php
// =============================================
// Password Reset API
// File: backend/api/forgot_password.php
// Description: Handle password reset requests via security questions
// =============================================

header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");

require_once '../../config/database.php';

// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Only handle POST requests
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode([
        'success' => false,
        'message' => 'Method not allowed'
    ]);
    exit();
}

// Get POST data
$data = json_decode(file_get_contents("php://input"), true);

// Determine the action
$action = $data['action'] ?? '';

try {
    $database = new Database();
    $conn = $database->getConnection();

    if ($action === 'get-security-question') {
        // Step 1: Get security question for username/email
        
        if (!isset($data['username']) || empty($data['username'])) {
            http_response_code(400);
            echo json_encode([
                'success' => false,
                'message' => 'Username is required'
            ]);
            exit();
        }

        $username = htmlspecialchars(strip_tags(trim($data['username'])));

        // Query by username or email
        $sql = "SELECT user_id, username, email, name, security_question 
                FROM users 
                WHERE (username = :username OR email = :username) AND status = 'Active'";
        
        $stmt = $conn->prepare($sql);
        $stmt->bindParam(':username', $username);
        $stmt->execute();

        if ($stmt->rowCount() > 0) {
            $user = $stmt->fetch(PDO::FETCH_ASSOC);
            
            // Return security question
            http_response_code(200);
            echo json_encode([
                'success' => true,
                'message' => 'Security question retrieved',
                'user_id' => $user['user_id'],
                'username' => $user['username'],
                'email' => $user['email'],
                'name' => $user['name'],
                'security_question' => $user['security_question']
            ]);
        } else {
            http_response_code(404);
            echo json_encode([
                'success' => false,
                'message' => 'User not found'
            ]);
        }
    } 
    
    elseif ($action === 'verify-security-answer') {
        // Step 2: Verify security answer
        
        if (!isset($data['user_id']) || !isset($data['security_answer'])) {
            http_response_code(400);
            echo json_encode([
                'success' => false,
                'message' => 'User ID and security answer are required'
            ]);
            exit();
        }

        $user_id = intval($data['user_id']);
        $provided_answer = htmlspecialchars(strip_tags(trim(strtolower($data['security_answer']))));

        // Get stored security answer
        $sql = "SELECT security_answer FROM users WHERE user_id = :user_id";
        $stmt = $conn->prepare($sql);
        $stmt->bindParam(':user_id', $user_id);
        $stmt->execute();

        if ($stmt->rowCount() > 0) {
            $user = $stmt->fetch(PDO::FETCH_ASSOC);
            $stored_answer = strtolower(trim($user['security_answer']));

            if ($provided_answer === $stored_answer) {
                // Generate a temporary reset token
                $reset_token = bin2hex(random_bytes(32));
                $token_expiry = date('Y-m-d H:i:s', strtotime('+15 minutes'));

                // Store reset token
                $updateSql = "UPDATE users SET reset_token = :token, reset_token_expiry = :expiry WHERE user_id = :user_id";
                $updateStmt = $conn->prepare($updateSql);
                $updateStmt->bindParam(':token', $reset_token);
                $updateStmt->bindParam(':expiry', $token_expiry);
                $updateStmt->bindParam(':user_id', $user_id);
                $updateStmt->execute();

                http_response_code(200);
                echo json_encode([
                    'success' => true,
                    'message' => 'Security answer verified',
                    'reset_token' => $reset_token
                ]);
            } else {
                http_response_code(401);
                echo json_encode([
                    'success' => false,
                    'message' => 'Incorrect security answer'
                ]);
            }
        } else {
            http_response_code(404);
            echo json_encode([
                'success' => false,
                'message' => 'User not found'
            ]);
        }
    }
    
    elseif ($action === 'reset-password') {
        // Step 3: Reset password with valid token
        
        if (!isset($data['user_id']) || !isset($data['reset_token']) || !isset($data['new_password'])) {
            http_response_code(400);
            echo json_encode([
                'success' => false,
                'message' => 'User ID, reset token, and new password are required'
            ]);
            exit();
        }

        $user_id = intval($data['user_id']);
        $reset_token = $data['reset_token'];
        $new_password = $data['new_password'];

        // Validate password
        if (strlen($new_password) < 6) {
            http_response_code(400);
            echo json_encode([
                'success' => false,
                'message' => 'Password must be at least 6 characters long'
            ]);
            exit();
        }

        // Verify token
        $sql = "SELECT user_id, reset_token_expiry FROM users 
                WHERE user_id = :user_id AND reset_token = :token";
        $stmt = $conn->prepare($sql);
        $stmt->bindParam(':user_id', $user_id);
        $stmt->bindParam(':token', $reset_token);
        $stmt->execute();

        if ($stmt->rowCount() > 0) {
            $user = $stmt->fetch(PDO::FETCH_ASSOC);
            $expiry = strtotime($user['reset_token_expiry']);

            if ($expiry > time()) {
                // Token is valid
                $password_hash = password_hash($new_password, PASSWORD_DEFAULT);

                // Update password and clear token
                $updateSql = "UPDATE users 
                            SET password_hash = :password_hash, 
                                reset_token = NULL, 
                                reset_token_expiry = NULL,
                                updated_at = NOW()
                            WHERE user_id = :user_id";
                $updateStmt = $conn->prepare($updateSql);
                $updateStmt->bindParam(':password_hash', $password_hash);
                $updateStmt->bindParam(':user_id', $user_id);

                if ($updateStmt->execute()) {
                    http_response_code(200);
                    echo json_encode([
                        'success' => true,
                        'message' => 'Password reset successful'
                    ]);
                } else {
                    http_response_code(500);
                    echo json_encode([
                        'success' => false,
                        'message' => 'Failed to reset password'
                    ]);
                }
            } else {
                http_response_code(401);
                echo json_encode([
                    'success' => false,
                    'message' => 'Reset token has expired. Please start over.'
                ]);
            }
        } else {
            http_response_code(401);
            echo json_encode([
                'success' => false,
                'message' => 'Invalid reset token'
            ]);
        }
    }
    
    else {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'message' => 'Invalid action'
        ]);
    }

} catch (Exception $e) {
    error_log("Forgot password error: " . $e->getMessage());
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
