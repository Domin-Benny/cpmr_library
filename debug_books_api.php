<?php
// Minimal debug version to isolate the issue
header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");

require_once 'backend/config/database.php';
require_once 'backend/api/auth_helper.php';

// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Check authentication for all requests except GET (optional)
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    $user = isAuthenticated();
    if (!$user) {
        http_response_code(401);
        echo json_encode([
            'success' => false,
            'message' => 'Authentication required'
        ]);
        exit();
    }
    // Only Admin and Librarian can perform write actions on books
    if (!requireRole($user, ['Admin', 'Librarian'])) {
        http_response_code(403);
        echo json_encode([
            'success' => false,
            'message' => 'Insufficient permissions'
        ]);
        exit();
    }
}

// Get action parameter - only from GET for initial setting
$action = isset($_GET['action']) ? $_GET['action'] : '';

try {
    $database = new Database();
    $conn = $database->getConnection();

    switch ($_SERVER['REQUEST_METHOD']) {
        case 'GET':
            // Simple response for testing
            echo json_encode([
                'success' => true,
                'message' => 'GET request works',
                'action' => $action
            ]);
            break;
            
        case 'POST':
            // Simple POST response for testing
            $response = [
                'success' => true,
                'message' => 'POST request received',
                'action' => $action,
                'post_data' => $_POST,
                'files_data' => $_FILES
            ];
            echo json_encode($response);
            break;
            
        default:
            http_response_code(405);
            echo json_encode([
                'success' => false,
                'message' => 'Method not allowed'
            ]);
    }
} catch (Exception $e) {
    error_log("Debug API error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Internal server error: ' . $e->getMessage()
    ]);
}
?>