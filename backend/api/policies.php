<?php
// =============================================
// Policies API
// File: backend/api/policies.php
// Description: Manage CPMR policy documents and PDF uploads
// =============================================

header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");

// Use absolute path for web server compatibility
$basePath = __DIR__ . '/../../';
require_once $basePath . 'config/database.php';
require_once 'auth_helper.php';

// Handle preflight
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

$action = $_GET['action'] ?? '';
$policyId = isset($_GET['id']) ? (int)$_GET['id'] : 0;

try {
    $database = new Database();
    $conn = $database->getConnection();

    // GET Requests
    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        // List all policies - accessible to all authenticated users
        if ($action === 'list') {
            $user = isAuthenticated();
            if (!$user) {
                http_response_code(401);
                echo json_encode(['success' => false, 'message' => 'Authentication required']);
                exit();
            }
            
            $limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 50;
            $search = isset($_GET['search']) ? trim($_GET['search']) : '';
            $yearFilter = isset($_GET['year']) ? trim($_GET['year']) : '';
            $sortBy = isset($_GET['sort']) ? $_GET['sort'] : 'date_desc';
            
            // Build dynamic query
            $sql = "SELECT p.policy_id, p.title, p.description, p.year, p.original_name, p.file_name, p.file_size, p.uploaded_by, p.created_at, u.name as uploaded_by_name 
                    FROM policies p 
                    LEFT JOIN users u ON p.uploaded_by = u.user_id 
                    WHERE 1=1";
            
            // Add search condition
            if (!empty($search)) {
                $sql .= " AND (p.title LIKE :search OR p.description LIKE :search)";
            }
            
            // Add year filter
            if (!empty($yearFilter)) {
                $sql .= " AND p.year = :year";
            }
            
            // Add sorting
            switch ($sortBy) {
                case 'date_asc':
                    $sql .= " ORDER BY p.created_at ASC";
                    break;
                case 'title_asc':
                    $sql .= " ORDER BY p.title ASC";
                    break;
                case 'title_desc':
                    $sql .= " ORDER BY p.title DESC";
                    break;
                case 'date_desc':
                default:
                    $sql .= " ORDER BY p.created_at DESC";
                    break;
            }
            
            $sql .= " LIMIT :limit";
            
            $stmt = $conn->prepare($sql);
            
            // Bind search parameter
            if (!empty($search)) {
                $searchParam = '%' . $search . '%';
                $stmt->bindParam(':search', $searchParam);
            }
            
            // Bind year parameter
            if (!empty($yearFilter)) {
                $stmt->bindParam(':year', $yearFilter);
            }
            
            $stmt->bindParam(':limit', $limit, PDO::PARAM_INT);
            $stmt->execute();
            $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            echo json_encode(['success' => true, 'policies' => $rows]);
            exit();
        }

        // Download policy - accessible to all authenticated users
        if ($action === 'download') {
            $user = isAuthenticated();
            if (!$user) {
                http_response_code(401);
                echo json_encode(['success' => false, 'message' => 'Authentication required']);
                exit();
            }

            if ($policyId <= 0) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'Invalid policy id']);
                exit();
            }

            $sql = "SELECT file_name, original_name FROM policies WHERE policy_id = :id LIMIT 1";
            $stmt = $conn->prepare($sql);
            $stmt->bindParam(':id', $policyId, PDO::PARAM_INT);
            $stmt->execute();
            $row = $stmt->fetch(PDO::FETCH_ASSOC);
            
            if (!$row) {
                http_response_code(404);
                echo json_encode(['success' => false, 'message' => 'Policy not found']);
                exit();
            }

            $filePath = __DIR__ . '/../uploads/policies/' . $row['file_name'];
            if (!file_exists($filePath)) {
                http_response_code(404);
                echo json_encode(['success' => false, 'message' => 'File not found']);
                exit();
            }

            // Serve file with headers
            header('Content-Description: File Transfer');
            header('Content-Type: application/pdf');
            header('Content-Disposition: attachment; filename="' . basename($row['original_name']) . '"');
            header('Expires: 0');
            header('Cache-Control: must-revalidate');
            header('Pragma: public');
            header('Content-Length: ' . filesize($filePath));
            readfile($filePath);
            exit();
        }
        
        // Get single policy details
        if ($action === 'get' && $policyId > 0) {
            $user = isAuthenticated();
            if (!$user) {
                http_response_code(401);
                echo json_encode(['success' => false, 'message' => 'Authentication required']);
                exit();
            }
            
            $sql = "SELECT policy_id, title, description, year, original_name, file_name, file_size, uploaded_by, created_at FROM policies WHERE policy_id = :id LIMIT 1";
            $stmt = $conn->prepare($sql);
            $stmt->bindParam(':id', $policyId, PDO::PARAM_INT);
            $stmt->execute();
            $row = $stmt->fetch(PDO::FETCH_ASSOC);
            
            if (!$row) {
                http_response_code(404);
                echo json_encode(['success' => false, 'message' => 'Policy not found']);
                exit();
            }
            
            echo json_encode(['success' => true, 'policy' => $row]);
            exit();
        }

        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Invalid action']);
        exit();
    }

    // POST Request - Upload new policy (Admin & Librarian only)
    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $user = isAuthenticated();
        if (!$user) {
            http_response_code(401);
            echo json_encode(['success' => false, 'message' => 'Authentication required']);
            exit();
        }

        // Only Admin and Librarian can upload
        if (!requireRole($user, ['Admin', 'Librarian'])) {
            http_response_code(403);
            echo json_encode(['success' => false, 'message' => 'Access denied. Admin and Librarian only.']);
            exit();
        }

        // Check if PDF file was uploaded
        if (!isset($_FILES['pdf']) || $_FILES['pdf']['error'] !== UPLOAD_ERR_OK) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'PDF file is required']);
            exit();
        }

        $title = $_POST['title'] ?? '';
        $description = $_POST['description'] ?? '';
        $year = $_POST['year'] ?? null;

        // Validate title
        if (trim($title) === '') {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Title is required']);
            exit();
        }

        // Validate file type and size
        $uploaded = $_FILES['pdf'];
        $maxFileSize = 10 * 1024 * 1024; // 10MB
        
        if ($uploaded['size'] > $maxFileSize) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'File size exceeds 10MB limit']);
            exit();
        }
        
        // Validate MIME type
        $finfo = finfo_open(FILEINFO_MIME_TYPE);
        $mime = finfo_file($finfo, $uploaded['tmp_name']);
        finfo_close($finfo);
        
        if ($mime !== 'application/pdf') {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Only PDF files are allowed']);
            exit();
        }

        // Ensure uploads folder exists
        $uploadDir = __DIR__ . '/../uploads/policies/';
        if (!is_dir($uploadDir)) {
            mkdir($uploadDir, 0755, true);
        }

        // Generate safe filename
        $ext = pathinfo($uploaded['name'], PATHINFO_EXTENSION);
        $storedName = uniqid('policy_', true) . '.' . $ext;
        $destPath = $uploadDir . $storedName;

        if (!move_uploaded_file($uploaded['tmp_name'], $destPath)) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Failed to store uploaded file']);
            exit();
        }

        // Insert record
        $sql = "INSERT INTO policies (title, description, year, file_name, original_name, file_size, uploaded_by) 
                VALUES (:title, :description, :year, :file_name, :original_name, :file_size, :uploaded_by)";
        $stmt = $conn->prepare($sql);
        $stmt->bindParam(':title', $title);
        $stmt->bindParam(':description', $description);
        $stmt->bindParam(':year', $year);
        $stmt->bindParam(':file_name', $storedName);
        $stmt->bindParam(':original_name', $uploaded['name']);
        $stmt->bindParam(':file_size', $uploaded['size'], PDO::PARAM_INT);
        $stmt->bindParam(':uploaded_by', $user['user_id'], PDO::PARAM_INT);
        $stmt->execute();

        $pid = $conn->lastInsertId();
        echo json_encode([
            'success' => true, 
            'policy_id' => $pid, 
            'file_url' => "/cpmr_library/backend/uploads/policies/{$storedName}"
        ]);
        exit();
    }
    
    // PUT Request - Update policy metadata (Admin & Librarian only)
    if ($_SERVER['REQUEST_METHOD'] === 'PUT') {
        $user = isAuthenticated();
        if (!$user) {
            http_response_code(401);
            echo json_encode(['success' => false, 'message' => 'Authentication required']);
            exit();
        }

        // Only Admin and Librarian can edit
        if (!requireRole($user, ['Admin', 'Librarian'])) {
            http_response_code(403);
            echo json_encode(['success' => false, 'message' => 'Access denied']);
            exit();
        }

        if ($policyId <= 0) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Invalid policy id']);
            exit();
        }

        // Parse PUT data
        parse_str(file_get_contents("php://input"), $putData);
        
        $title = $putData['title'] ?? '';
        $description = $putData['description'] ?? '';
        $year = $putData['year'] ?? null;

        // Validate title
        if (trim($title) === '') {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Title is required']);
            exit();
        }

        // Update record
        $sql = "UPDATE policies 
                SET title = :title, description = :description, year = :year 
                WHERE policy_id = :id";
        $stmt = $conn->prepare($sql);
        $stmt->bindParam(':title', $title);
        $stmt->bindParam(':description', $description);
        $stmt->bindParam(':year', $year);
        $stmt->bindParam(':id', $policyId, PDO::PARAM_INT);
        $stmt->execute();

        echo json_encode(['success' => true, 'message' => 'Policy updated successfully']);
        exit();
    }
    
    // DELETE Request - Delete policy (Admin & Librarian only)
    if ($_SERVER['REQUEST_METHOD'] === 'DELETE') {
        $user = isAuthenticated();
        if (!$user) {
            http_response_code(401);
            echo json_encode(['success' => false, 'message' => 'Authentication required']);
            exit();
        }

        // Only Admin and Librarian can delete
        if (!requireRole($user, ['Admin', 'Librarian'])) {
            http_response_code(403);
            echo json_encode(['success' => false, 'message' => 'Access denied']);
            exit();
        }

        if ($policyId <= 0) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Invalid policy id']);
            exit();
        }

        // Get existing policy to check file info
        $sql = "SELECT file_name FROM policies WHERE policy_id = :id LIMIT 1";
        $stmt = $conn->prepare($sql);
        $stmt->bindParam(':id', $policyId, PDO::PARAM_INT);
        $stmt->execute();
        $existing = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$existing) {
            http_response_code(404);
            echo json_encode(['success' => false, 'message' => 'Policy not found']);
            exit();
        }

        // Delete the file from filesystem
        $filePath = __DIR__ . '/../uploads/policies/' . $existing['file_name'];
        if (file_exists($filePath)) {
            unlink($filePath);
        }

        // Delete record from database
        $sql = "DELETE FROM policies WHERE policy_id = :id";
        $stmt = $conn->prepare($sql);
        $stmt->bindParam(':id', $policyId, PDO::PARAM_INT);
        $stmt->execute();

        echo json_encode(['success' => true, 'message' => 'Policy deleted successfully']);
        exit();
    }

} catch (Exception $e) {
    error_log('Policies API error: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Internal server error']);
} finally {
    if (isset($conn)) {
        $database->closeConnection();
    }
}
?>
