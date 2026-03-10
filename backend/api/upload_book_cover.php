<?php
// API endpoint for uploading book cover images
header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");

require_once '../../config/database.php';
require_once 'auth_helper.php';

// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Authenticate user
$user = isAuthenticated();
if (!$user) {
    http_response_code(401);
    echo json_encode([
        'success' => false,
        'message' => 'Authentication required'
    ]);
    exit();
}

// Only Admin and Librarian can upload book covers
if (!requireRole($user, ['Admin', 'Librarian'])) {
    exit();
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode([
        'success' => false,
        'message' => 'Method not allowed'
    ]);
    exit();
}

try {
    $database = new Database();
    $conn = $database->getConnection();

    if (!isset($_FILES['cover_image']) || $_FILES['cover_image']['error'] !== UPLOAD_ERR_OK) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'message' => 'No image file uploaded or upload error occurred'
        ]);
        exit();
    }

    $file = $_FILES['cover_image'];
    $bookId = $_POST['book_id'] ?? null;

    if (!$bookId) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'message' => 'Book ID is required'
        ]);
        exit();
    }

    // Validate file type - expanded to support more image formats
    $allowedTypes = [
        'image/jpeg', 
        'image/jpg', 
        'image/png', 
        'image/gif',
        'image/webp',
        'image/bmp',
        'image/tiff',
        'image/x-icon',
        'image/vnd.microsoft.icon'
    ];
    if (!in_array($file['type'], $allowedTypes)) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'message' => 'Invalid file type. Only JPEG, JPG, PNG, GIF, WebP, BMP, TIFF, and ICO images are allowed.'
        ]);
        exit();
    }

    // Validate file size (max 5MB)
    if ($file['size'] > 5 * 1024 * 1024) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'message' => 'File size too large. Maximum size is 5MB.'
        ]);
        exit();
    }

    // Create uploads directory if it doesn't exist
    $uploadDir = __DIR__ . '/../uploads/book_covers/';
    if (!is_dir($uploadDir)) {
        mkdir($uploadDir, 0755, true);
    }

    // AUTO-CLEANUP: Check file count and remove oldest if at limit (50 files)
    $maxFiles = 50;
    $existingFiles = glob($uploadDir . '*.*');
    $fileCount = count($existingFiles);
    
    if ($fileCount >= $maxFiles) {
        // Sort files by modification time (oldest first)
        usort($existingFiles, function($a, $b) {
            return filemtime($a) - filemtime($b);
        });
        
        // Remove oldest files to make room for new one
        $filesToRemove = $fileCount - $maxFiles + 1;
        for ($i = 0; $i < $filesToRemove && $i < count($existingFiles); $i++) {
            @unlink($existingFiles[$i]);
            error_log("Auto-deleted old book cover: " . basename($existingFiles[$i]));
        }
        error_log("Book cover cleanup: Removed $filesToRemove old files (had $fileCount, max $maxFiles)");
    }

    // Generate unique filename
    $extension = pathinfo($file['name'], PATHINFO_EXTENSION);
    $filename = 'book_cover_' . uniqid() . '_' . time() . '.' . $extension;
    $filePath = $uploadDir . $filename;

    // Move uploaded file
    if (move_uploaded_file($file['tmp_name'], $filePath)) {
        // Update book record with cover image filename
        $sql = "UPDATE books SET cover_image = :cover_image WHERE book_id = :book_id";
        $stmt = $conn->prepare($sql);
        $stmt->bindParam(':cover_image', $filename);
        $stmt->bindParam(':book_id', $bookId, PDO::PARAM_INT);
        
        if ($stmt->execute() && $stmt->rowCount() > 0) {
            // Log activity
            if (function_exists('logActivity')) {
                logActivity($conn, $user['user_id'], 'UPLOAD', 'books', $bookId, "Uploaded cover image: {$filename}");
            }
            
            http_response_code(200);
            echo json_encode([
                'success' => true,
                'message' => 'Book cover uploaded successfully',
                'file_path' => 'uploads/book_covers/' . $filename
            ]);
        } else {
            // Delete the uploaded file if database update failed
            unlink($filePath);
            
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => 'Failed to update book record'
            ]);
        }
    } else {
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'message' => 'Failed to save uploaded file'
        ]);
    }
} catch (Exception $e) {
    error_log("Book cover upload error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Server error occurred'
    ]);
}
?>