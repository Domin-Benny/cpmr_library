<?php
// Comprehensive login debug script
header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");

// Enable all error reporting
error_reporting(E_ALL);
ini_set('display_errors', 1);
ini_set('log_errors', 1);

// Log to file as well
ini_set('error_log', __DIR__ . '/../../logs/login_debug.log');

echo "=== LOGIN DEBUG START ===\n";
echo "Time: " . date('Y-m-d H:i:s') . "\n";
echo "Request Method: " . ($_SERVER['REQUEST_METHOD'] ?? 'Unknown') . "\n";
echo "Content Type: " . ($_SERVER['CONTENT_TYPE'] ?? 'Unknown') . "\n";

// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    echo "Handling OPTIONS request\n";
    http_response_code(200);
    exit();
}

// Only handle POST requests
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo "Invalid request method: " . $_SERVER['REQUEST_METHOD'] . "\n";
    http_response_code(405);
    echo json_encode([
        'success' => false,
        'message' => 'Method not allowed',
        'debug' => 'Expected POST request, got ' . $_SERVER['REQUEST_METHOD']
    ]);
    exit();
}

try {
    echo "=== REQUEST PROCESSING ===\n";
    
    // Get raw input
    $rawInput = file_get_contents("php://input");
    echo "Raw input length: " . strlen($rawInput) . " bytes\n";
    echo "Raw input: " . $rawInput . "\n";
    
    // Parse JSON
    $data = json_decode($rawInput, true);
    echo "JSON parsing result: " . (json_last_error() === JSON_ERROR_NONE ? "SUCCESS" : "FAILED") . "\n";
    echo "Parsed data: " . print_r($data, true) . "\n";
    
    if (json_last_error() !== JSON_ERROR_NONE) {
        echo "JSON Error: " . json_last_error_msg() . "\n";
        throw new Exception("Invalid JSON input: " . json_last_error_msg());
    }
    
    // Validate input
    if (!isset($data['username']) || !isset($data['password'])) {
        echo "Missing required fields\n";
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
    
    echo "Login attempt for username: " . $username . "\n";
    
    // Test database connection
    echo "=== DATABASE CONNECTION TEST ===\n";
    // Use absolute path for web server compatibility
    $basePath = __DIR__ . '/../../';
    require_once $basePath . 'config/database.php';
    echo "Database class loaded\n";
    
    $database = new Database();
    echo "Database object created\n";
    
    $conn = $database->getConnection();
    echo "Database connection established\n";
    
    // Test simple query
    $stmt = $conn->query("SELECT 1 as test");
    $result = $stmt->fetch();
    echo "Simple query result: " . $result['test'] . "\n";
    
    // Check users table
    echo "=== USERS TABLE CHECK ===\n";
    $stmt = $conn->query("SHOW TABLES LIKE 'users'");
    echo "Users table exists: " . ($stmt->rowCount() > 0 ? "YES" : "NO") . "\n";
    
    if ($stmt->rowCount() == 0) {
        throw new Exception("Users table does not exist");
    }
    
    // Count users
    $stmt = $conn->query("SELECT COUNT(*) as count FROM users");
    $count = $stmt->fetch()['count'];
    echo "Total users in database: " . $count . "\n";
    
    // Check if user exists
    echo "=== USER LOOKUP ===\n";
    $sql = "SELECT user_id, username, password_hash, name, email, role, status
            FROM users 
            WHERE username = :username AND status = 'Active'";
    
    $stmt = $conn->prepare($sql);
    $stmt->bindParam(':username', $username);
    $stmt->execute();
    
    echo "First query row count: " . $stmt->rowCount() . "\n";
    
    // If no results, try with email field
    if ($stmt->rowCount() == 0) {
        echo "Trying email lookup...\n";
        $sql = "SELECT user_id, username, password_hash, name, email, role, status
                FROM users 
                WHERE email = :username AND status = 'Active'";
        
        $stmt = $conn->prepare($sql);
        $stmt->bindParam(':username', $username);
        $stmt->execute();
        
        echo "Email query row count: " . $stmt->rowCount() . "\n";
    }
    
    if ($stmt->rowCount() > 0) {
        $user = $stmt->fetch(PDO::FETCH_ASSOC);
        echo "User found: " . print_r($user, true) . "\n";
        
        // Verify password
        echo "=== PASSWORD VERIFICATION ===\n";
        echo "Password hash: " . substr($user['password_hash'], 0, 20) . "...\n";
        echo "Password length: " . strlen($password) . "\n";
        
        $passwordValid = password_verify($password, $user['password_hash']);
        echo "Password verification result: " . ($passwordValid ? "SUCCESS" : "FAILED") . "\n";
        
        if ($passwordValid) {
            echo "=== LOGIN SUCCESS ===\n";
            // Update last login
            $updateSql = "UPDATE users SET last_login = NOW() WHERE user_id = :user_id";
            $updateStmt = $conn->prepare($updateSql);
            $updateStmt->bindParam(':user_id', $user['user_id']);
            $updateStmt->execute();
            echo "Last login updated\n";
            
            // Generate token
            $tokenPayload = [
                'user_id' => $user['user_id'],
                'username' => $user['username'],
                'role' => $user['role'],
                'exp' => time() + 60 * 60
            ];
            $token = base64_encode(json_encode($tokenPayload));
            echo "Token generated\n";
            
            // Close connection
            if (method_exists($database, 'closeConnection')) {
                $database->closeConnection();
                echo "Database connection closed\n";
            }
            
            // Return success
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
            echo "=== PASSWORD INVALID ===\n";
            if (method_exists($database, 'closeConnection')) {
                $database->closeConnection();
            }
            
            http_response_code(401);
            echo json_encode([
                'success' => false,
                'message' => 'Invalid username or password',
                'debug' => 'Password verification failed'
            ]);
        }
    } else {
        echo "=== USER NOT FOUND ===\n";
        if (method_exists($database, 'closeConnection')) {
            $database->closeConnection();
        }
        
        http_response_code(401);
        echo json_encode([
            'success' => false,
            'message' => 'Invalid username or password',
            'debug' => 'User not found in database'
        ]);
    }
    
} catch (Exception $e) {
    echo "=== EXCEPTION CAUGHT ===\n";
    echo "Error message: " . $e->getMessage() . "\n";
    echo "Stack trace: " . $e->getTraceAsString() . "\n";
    
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Internal server error',
        'debug' => 'Exception occurred: ' . $e->getMessage(),
        'trace' => $e->getTraceAsString()
    ]);
}

echo "=== LOGIN DEBUG END ===\n";
?>