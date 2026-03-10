<?php
// Prevent any output before headers
ob_start();

// Turn on error reporting to see what's happening
error_reporting(E_ALL);
ini_set('display_errors', 0); // Don't display errors to output

// Use absolute path for includes
$basePath = dirname(dirname(__FILE__)); // This gets us to the backend directory
$configPath = $basePath . '/config/database.php';

// Check if files exist before including
if (!file_exists($configPath)) {
    error_log("Config file not found: " . $configPath);
    header('Content-Type: application/json');
    echo json_encode(['success' => false, 'message' => 'Server configuration error']);
    exit;
}

require_once $configPath;

// Enable CORS
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    exit(0);
}

header('Content-Type: application/json');

// Try to get user from session or from the request
// Check if session is active, if not start it
if (session_status() == PHP_SESSION_NONE) {
    session_start();
}

$user_id = null;
$username = null;

// Log incoming request for debugging
error_log("Upload profile picture request received");
error_log("Session data: " . print_r($_SESSION, true));
error_log("Auth header: " . ($_SERVER['HTTP_AUTHORIZATION'] ?? 'None'));
error_log("_POST data: " . print_r($_POST, true));
error_log("_FILES data: " . print_r($_FILES, true));
error_log("Session status: " . session_status());

if (isset($_SESSION['user_id']) && isset($_SESSION['username'])) {
    $user_id = $_SESSION['user_id'];
    $username = $_SESSION['username'];
    error_log("Authenticated via session: user_id=$user_id, username=$username");
} else {
    // Check if there's a token in headers (like the existing auth system)
    $auth_header = $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['HTTP_X_AUTHORIZATION'] ?? '';
    
    if (!empty($auth_header)) {
        // Try to decode token similar to login system
        $auth_header = trim(str_replace('Bearer ', '', $auth_header));
        if ($decoded_token = json_decode(base64_decode($auth_header), true)) {
            if (isset($decoded_token['user_id']) && isset($decoded_token['username'])) {
                $user_id = $decoded_token['user_id'];
                $username = $decoded_token['username'];
                
                // Also set session variables for consistency
                $_SESSION['user_id'] = $user_id;
                $_SESSION['username'] = $username;
                
                error_log("Authenticated via token: user_id=$user_id, username=$username");
            } else {
                error_log("Token decoded but missing user_id or username: " . print_r($decoded_token, true));
            }
        } else {
            error_log("Failed to decode token from auth header: " . $auth_header);
        }
    } else {
        error_log("No auth header provided");
    }
}

// Check if user is logged in
if (!$user_id || !$username) {
    error_log("Authentication failed: user_id=$user_id, username=$username");
    echo json_encode(['success' => false, 'message' => 'User not logged in. Please log in first.']);
    exit;
}

try {
    // Create database connection
    $database = new Database();
    $pdo = $database->getConnection();

    if (!isset($_FILES['profile_picture'])) {
        error_log("No file uploaded in request");
        echo json_encode(['success' => false, 'message' => 'No file uploaded']);
        exit;
    }

    $file = $_FILES['profile_picture'];
    
    // Validate file - accept all common image formats
    $allowed_types = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/bmp', 'image/tiff', 'image/x-icon', 'image/vnd.microsoft.icon', 'image/svg+xml', 'image/heic', 'image/heif', 'image/avif'];
    $allowed_extensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'tif', 'tiff', 'ico', 'svg', 'heic', 'heif', 'avif'];
    
    if (!isset($file['type']) || !in_array($file['type'], $allowed_types)) {
        $actual_type = isset($file['type']) ? $file['type'] : 'UNDEFINED';
        error_log("Invalid file type: $actual_type. Expected: " . implode(', ', $allowed_types));
        echo json_encode(['success' => false, 'message' => 'Invalid file type. Only JPG, JPEG, PNG, GIF, WebP, BMP, TIFF, and ICO are allowed.']);
        exit;
    }
    
    if (!isset($file['size']) || $file['size'] > 5 * 1024 * 1024) { // 5MB limit
        $actual_size = isset($file['size']) ? round($file['size'] / (1024*1024), 2) . 'MB' : 'UNDEFINED';
        error_log("File size exceeds limit. Size: $actual_size, Limit: 5MB");
        echo json_encode(['success' => false, 'message' => 'File size exceeds 5MB limit.']);
        exit;
    }
    
    if (!isset($file['name'])) {
        error_log("File name is missing");
        echo json_encode(['success' => false, 'message' => 'File name is missing.']);
        exit;
    }
    
    $file_extension = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
    if (!in_array($file_extension, $allowed_extensions)) {
        error_log("Invalid file extension: $file_extension. Expected: " . implode(', ', $allowed_extensions));
        echo json_encode(['success' => false, 'message' => 'Invalid file extension.']);
        exit;
    }
    
    // Create upload directory if it doesn't exist
    $upload_dir = dirname(dirname(dirname(__FILE__))) . '/frontend/images/profile_pictures/'; // Goes to root directory
    if (!file_exists($upload_dir)) {
        error_log("Creating upload directory: $upload_dir");
        if (!mkdir($upload_dir, 0777, true)) {
            error_log("Failed to create upload directory: " . $upload_dir);
            echo json_encode(['success' => false, 'message' => 'Failed to create upload directory.']);
            exit;
        }
    }
    
    // Generate unique filename
    $filename = 'profile_' . $user_id . '_' . time() . '.' . $file_extension;
    $filepath = $upload_dir . $filename;
    
    // Move uploaded file
    if (!isset($file['tmp_name']) || !move_uploaded_file($file['tmp_name'], $filepath)) {
        error_log("Failed to move uploaded file from " . ($file['tmp_name'] ?? 'undefined') . " to $filepath");
        error_log("File upload error: " . (isset($file['tmp_name']) ? error_get_last()['message'] ?? 'Unknown error' : 'tmp_name missing'));
        echo json_encode(['success' => false, 'message' => 'Failed to move uploaded file. Check file permissions.']);
        exit;
    }
    
    // Update user's profile picture in database
    $stmt = $pdo->prepare("UPDATE users SET profile_picture = ? WHERE user_id = ?");
    $result = $stmt->execute([$filename, $user_id]);
    
    if (!$result) {
        error_log("Failed to update user profile in database for user_id: $user_id");
        error_log("Database error info: " . print_r($stmt->errorInfo(), true));
        // If database update fails, delete the uploaded file
        if (file_exists($filepath)) {
            unlink($filepath);
        }
        ob_clean();
        echo json_encode(['success' => false, 'message' => 'Failed to update user profile in database.']);
        exit;
    }
    
    error_log("Profile picture uploaded successfully for user_id: $user_id, filename: $filename");
    
    // Clean any previous output and return success response
    ob_clean();
    echo json_encode([
        'success' => true, 
        'message' => 'Profile picture uploaded successfully',
        'file_path' => 'images/profile_pictures/' . $filename
    ]);
    exit;
    
} catch (Exception $e) {
    error_log("Profile picture upload error: " . $e->getMessage());
    error_log("Stack trace: " . $e->getTraceAsString());
    // Ensure clean JSON output even in error cases
    ob_clean();
    echo json_encode(['success' => false, 'message' => 'Error processing upload: ' . $e->getMessage()]);
    exit;
}

// Ensure clean output
ob_end_flush();
?>