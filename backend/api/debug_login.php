<?php
// Debug login endpoint - detailed error reporting
header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");

// Enable detailed error reporting for debugging
error_reporting(E_ALL);
ini_set('display_errors', 1);

// Use absolute path for web server compatibility
$basePath = __DIR__ . '/../../';
require_once $basePath . 'config/database.php';

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
        'message' => 'Method not allowed',
        'debug' => 'Expected POST request, got ' . $_SERVER['REQUEST_METHOD']
    ]);
    exit();
}

try {
    // Get POST data
    $rawInput = file_get_contents("php://input");
    error_log("Raw input: " . $rawInput);
    
    $data = json_decode($rawInput, true);
    error_log("Parsed data: " . print_r($data, true));
    
    // Validate input
    if (!isset($data['username']) || !isset($data['password'])) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'message' => 'Username and password are required',
            'debug' => 'Missing username or password',
            'received_data' => $data
        ]);
        exit();
    }

    $username = $data['username'];
    $password = $data['password'];
    
    error_log("Attempting login for: " . $username);
    
    // Create database connection
    $database = new Database();
    error_log("Database object created");
    
    $conn = $database->getConnection();
    error_log("Database connection established");
    
    // Check if user exists - try different column names
    $sql = "SELECT user_id, username, password_hash, name, email, role, status
            FROM users 
            WHERE username = :username AND status = 'Active'";
    
    $stmt = $conn->prepare($sql);
    $stmt->bindParam(':username', $username);
    $stmt->execute();
    
    error_log("First query executed, row count: " . $stmt->rowCount());
    
    // If no results, try with email field
    if ($stmt->rowCount() == 0) {
        $sql = "SELECT user_id, username, password_hash, name, email, role, status
                FROM users 
                WHERE email = :username AND status = 'Active'";
        
        $stmt = $conn->prepare($sql);
        $stmt->bindParam(':username', $username);
        $stmt->execute();
        
        error_log("Second query executed (email search), row count: " . $stmt->rowCount());
    }
    
    if ($stmt->rowCount() > 0) {
        $user = $stmt->fetch(PDO::FETCH_ASSOC);
        error_log("User found: " . print_r($user, true));
        
        // Verify password (using password_verify for bcrypt)
        if (password_verify($password, $user['password_hash'])) {
            error_log("Password verified successfully");
            
            // Update last login time
            $updateSql = "UPDATE users SET last_login = NOW() WHERE user_id = :user_id";
            $updateStmt = $conn->prepare($updateSql);
            $updateStmt->bindParam(':user_id', $user['user_id']);
            $updateStmt->execute();
            
            // Generate token
            $tokenPayload = [
                'user_id' => $user['user_id'],
                'username' => $user['username'],
                'role' => $user['role'],
                'exp' => time() + 60 * 60 // 1 hour expiration
            ];
            $token = base64_encode(json_encode($tokenPayload));
            
            error_log("Login successful for user: " . $user['username']);
            
            // Return success response
            http_response_code(200);
            echo json_encode([
                'success' => true,
                'message' => 'Login successful',
                'token' => $token,
                'user' => [
                    'id' => $user['user_id'],
                    'username' => $user['username'],
                    'name' => $user['name'],
                    'email' => $user['email'],
                    'role' => $user['role'],
                    'profile_picture' => null
                ],
                'debug' => 'Login completed successfully'
            ]);
        } else {
            error_log("Invalid password for user: " . $username);
            // Invalid password
            http_response_code(401);
            echo json_encode([
                'success' => false,
                'message' => 'Invalid username or password',
                'debug' => 'Password verification failed'
            ]);
        }
    } else {
        error_log("User not found: " . $username);
        // User not found
        http_response_code(401);
        echo json_encode([
            'success' => false,
            'message' => 'Invalid username or password',
            'debug' => 'User not found in database'
        ]);
    }
    
} catch (Exception $e) {
    error_log("Login error: " . $e->getMessage());
    error_log("Stack trace: " . $e->getTraceAsString());
    
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Internal server error',
        'debug' => 'Exception occurred: ' . $e->getMessage(),
        'trace' => $e->getTraceAsString()
    ]);
} finally {
    // Only try to close connection if it was successfully created
    if (isset($conn) && $conn) {
        try {
            // Check if closeConnection method exists
            if (method_exists($database, 'closeConnection')) {
                $database->closeConnection();
                error_log("Database connection closed");
            } else {
                error_log("closeConnection method not found");
            }
        } catch (Exception $e) {
            error_log("Error closing connection: " . $e->getMessage());
        }
    }
}
?>