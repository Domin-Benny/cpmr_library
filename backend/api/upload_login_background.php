<?php
// =============================================
// Login Background Upload API
// File: backend/api/upload_login_background.php
// Description: Handle login background image upload
// =============================================

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

require_once '../../config/database.php';
require_once 'auth_helper.php';

// Define upload directory for login background
define('LOGIN_BG_UPLOAD_DIR', __DIR__ . '/../../frontend/images/login-backgrounds/');
define('LOGIN_BG_URL_PATH', '/cpmr_library/frontend/images/login-backgrounds/');

// Ensure upload directory exists
if (!is_dir(LOGIN_BG_UPLOAD_DIR)) {
    @mkdir(LOGIN_BG_UPLOAD_DIR, 0755, true);
}

try {
    // Authenticate user for all operations except viewing
    $user = isAuthenticated();
    if (!$user) {
        http_response_code(401);
        echo json_encode([
            'success' => false,
            'message' => 'Unauthorized access'
        ]);
        exit();
    }
    
    // Only Admin can change login background
    if (!requireRole($user, ['Admin'])) {
        http_response_code(403);
        echo json_encode([
            'success' => false,
            'message' => 'Only administrators can change login background'
        ]);
        exit();
    }
    
    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        // Get current login background
        $action = $_GET['action'] ?? 'get';
        
        if ($action === 'get') {
            // Check if custom background exists
            $settingsFile = LOGIN_BG_UPLOAD_DIR . 'settings.json';
            if (file_exists($settingsFile)) {
                $settings = json_decode(file_get_contents($settingsFile), true);
                if (isset($settings['current_background']) && file_exists(LOGIN_BG_UPLOAD_DIR . $settings['current_background'])) {
                    echo json_encode([
                        'success' => true,
                        'image_path' => LOGIN_BG_URL_PATH . $settings['current_background']
                    ]);
                    exit();
                }
            }
            
            // Return default if no custom background
            echo json_encode([
                'success' => true,
                'image_path' => '/cpmr_library/frontend/images/cpmr.jpeg.jpeg'
            ]);
        }
        
    } elseif ($_SERVER['REQUEST_METHOD'] === 'POST') {
        // Database connection
        $database = new Database();
        $conn = $database->getConnection();
        
        // Check for reset action
        $data = json_decode(file_get_contents('php://input'), true);
        if (isset($data['action']) && $data['action'] === 'reset') {
            // Delete custom background and settings
            $settingsFile = LOGIN_BG_UPLOAD_DIR . 'settings.json';
            
            // Remove all jpg, png, gif, webp files
            foreach (glob(LOGIN_BG_UPLOAD_DIR . '*.*') as $file) {
                if (is_file($file) && $file !== $settingsFile) {
                    @unlink($file);
                }
            }
            
            // Remove settings file
            if (file_exists($settingsFile)) {
                @unlink($settingsFile);
            }
            
            // Log activity
            logActivity($conn, $user['user_id'], 'DELETE', 'login_background', 0, 'Reset login background to default');
            
            echo json_encode([
                'success' => true,
                'message' => 'Login background reset to default',
                'image_path' => '/cpmr_library/frontend/images/cpmr.jpeg.jpeg'
            ]);
            exit();
        }
        
        // Handle file upload
        if (!isset($_FILES['login_background'])) {
            http_response_code(400);
            echo json_encode([
                'success' => false,
                'message' => 'No file uploaded'
            ]);
            exit();
        }
        
        $file = $_FILES['login_background'];
        
        // Validate file
        $allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        if (!in_array($file['type'], $allowedTypes)) {
            http_response_code(400);
            echo json_encode([
                'success' => false,
                'message' => 'Invalid file type. Only JPG, PNG, GIF, and WebP are allowed.'
            ]);
            exit();
        }
        
        // Validate file size (max 5MB)
        if ($file['size'] > 5 * 1024 * 1024) {
            http_response_code(400);
            echo json_encode([
                'success' => false,
                'message' => 'File size must be less than 5MB'
            ]);
            exit();
        }
        
        // Validate image dimensions (basic check)
        $imageInfo = getimagesize($file['tmp_name']);
        if ($imageInfo === false) {
            http_response_code(400);
            echo json_encode([
                'success' => false,
                'message' => 'File is not a valid image'
            ]);
            exit();
        }
        
        // Clean up old backgrounds
        $settingsFile = LOGIN_BG_UPLOAD_DIR . 'settings.json';
        $oldSettings = null;
        if (file_exists($settingsFile)) {
            $oldSettings = json_decode(file_get_contents($settingsFile), true);
            if (isset($oldSettings['current_background'])) {
                $oldFile = LOGIN_BG_UPLOAD_DIR . $oldSettings['current_background'];
                if (file_exists($oldFile)) {
                    @unlink($oldFile);
                }
            }
        }
        
        // Generate unique filename
        $extension = pathinfo($file['name'], PATHINFO_EXTENSION);
        $filename = 'login-bg-' . time() . '.' . strtolower($extension);
        $filePath = LOGIN_BG_UPLOAD_DIR . $filename;
        
        // Move uploaded file
        if (!move_uploaded_file($file['tmp_name'], $filePath)) {
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => 'Failed to save file'
            ]);
            exit();
        }
        
        // Save settings
        $settings = [
            'current_background' => $filename,
            'uploaded_at' => date('Y-m-d H:i:s'),
            'uploaded_by' => $user['user_id']
        ];
        
        file_put_contents($settingsFile, json_encode($settings, JSON_PRETTY_PRINT));
        
        // Log activity
        logActivity($conn, $user['user_id'], 'UPLOAD', 'login_background', 0, 'Uploaded new login background: ' . $filename);
        
        echo json_encode([
            'success' => true,
            'message' => 'Login background uploaded successfully',
            'image_path' => LOGIN_BG_URL_PATH . $filename,
            'filename' => $filename
        ]);
        
        $database->closeConnection();
        
    } else {
        http_response_code(405);
        echo json_encode([
            'success' => false,
            'message' => 'Method not allowed'
        ]);
    }
    
} catch (Exception $e) {
    error_log("Login background API Error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Internal server error: ' . $e->getMessage()
    ]);
}

?>
