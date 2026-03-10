<?php
// =============================================
// Verify Admin Password Endpoint
// File: backend/api/verify_admin_password.php
// Description: Verify admin password before accessing settings
// =============================================

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

require_once '../../config/database.php';
require_once 'auth_helper.php';

// Only handle POST requests
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode([
        'success' => false,
        'message' => 'Method not allowed'
    ]);
    exit();
}

// Check authentication
$user = isAuthenticated();
if (!$user) {
    http_response_code(401);
    echo json_encode([
        'success' => false,
        'message' => 'Unauthorized - Please login again'
    ]);
    exit();
}

// Only allow Admin role
if (!requireRole($user, ['Admin'])) {
    exit(); // requireRole handles the response
}

// Get input data
$input = json_decode(file_get_contents('php://input'), true);

if (!isset($input['password']) || empty($input['password'])) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'message' => 'Password is required'
    ]);
    exit();
}

$password = $input['password'];

// Debug logging (remove in production)
error_log("Verify Admin Password - User ID: " . $user['user_id']);
error_log("Verify Admin Password - Password length: " . strlen($password));

try {
    $database = new Database();
    $conn = $database->getConnection();
    
    // Get current user's password from database
    // NOTE: Column name is 'password_hash' NOT 'password'
    $sql = "SELECT password_hash FROM users WHERE user_id = :user_id AND role = 'Admin' LIMIT 1";
    $stmt = $conn->prepare($sql);
    $stmt->bindParam(':user_id', $user['user_id']);
    $stmt->execute();
    
    error_log("Verify Admin Password - Query executed, row count: " . $stmt->rowCount());
    
    if ($stmt->rowCount() === 0) {
        http_response_code(404);
        echo json_encode([
            'success' => false,
            'message' => 'Admin user not found'
        ]);
        exit();
    }
    
    $adminUser = $stmt->fetch(PDO::FETCH_ASSOC);
    error_log("Verify Admin Password - Password hash from DB: " . substr($adminUser['password_hash'], 0, 20) . "...");
    error_log("Verify Admin Password - Password hash starts with \$2y\$: " . (substr($adminUser['password_hash'], 0, 4) === '$2y$' ? 'YES' : 'NO'));
    
    // Verify password
    $verifyResult = password_verify($password, $adminUser['password_hash']);
    error_log("Verify Admin Password - Verification result: " . ($verifyResult ? 'SUCCESS' : 'FAILURE'));
    
    if ($verifyResult) {
        error_log("✅ PASSWORD VERIFIED SUCCESSFULLY");
        echo json_encode([
            'success' => true,
            'message' => 'Password verified successfully',
            'verified' => true
        ]);
    } else {
        error_log("❌ PASSWORD VERIFICATION FAILED - Wrong password entered");
        error_log("Provided password hash would be: " . substr(password_hash($password, PASSWORD_DEFAULT), 0, 30) . "...");
        http_response_code(401);
        echo json_encode([
            'success' => false,
            'message' => 'Incorrect password',
            'verified' => false,
            'debug_info' => 'Password does not match stored hash'
        ]);
    }
    
    $database->closeConnection();
    
} catch (Exception $e) {
    error_log("Verify Admin Password Error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Internal server error: ' . $e->getMessage()
    ]);
}
?>
