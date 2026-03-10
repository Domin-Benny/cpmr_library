<?php
// =============================================
// Journals API
// File: backend/api/journals.php
// Description: Manage journal records and PDF uploads
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
$journalId = isset($_GET['id']) ? (int)$_GET['id'] : 0;

// Handle journal link actions
if ($action === 'add_link') {
    // Add new journal link (no PDF required)
    $data = json_decode(file_get_contents('php://input'), true);
    
    if (!isset($data['name']) || !isset($data['url'])) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Name and URL are required']);
        exit();
    }
    
    // Validate URL format
    $url = trim($data['url']);
    if (!preg_match('/^https?:\/\/.+/i', $url)) {
        $url = 'https://' . $url;
    }
    
    if (!filter_var($url, FILTER_VALIDATE_URL)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Invalid URL format. Please include http:// or https://']);
        exit();
    }
    
    try {
        $stmt = $conn->prepare("INSERT INTO journal_links (name, url, description, uploaded_by) VALUES (:name, :url, :description, :uploaded_by)");
        $stmt->execute([
            ':name' => trim($data['name']),
            ':url' => $url,
            ':description' => $data['description'] ?? null,
            ':uploaded_by' => $user['user_id'] ?? null
        ]);
        
        echo json_encode(['success' => true, 'link_id' => $conn->lastInsertId()]);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Database error: ' . $e->getMessage()]);
    }
    exit();
}

if ($action === 'get_links') {
    // Get all journal links
    try {
        $stmt = $conn->query("SELECT l.*, u.name as uploaded_by_name FROM journal_links l LEFT JOIN users u ON l.uploaded_by = u.user_id ORDER BY l.created_at DESC");
        $links = $stmt->fetchAll(PDO::FETCH_ASSOC);
        echo json_encode(['success' => true, 'links' => $links]);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Database error: ' . $e->getMessage()]);
    }
    exit();
}

if ($action === 'delete_link') {
    // Delete a journal link
    $user = isAuthenticated();
    if (!$user) {
        http_response_code(401);
        echo json_encode(['success' => false, 'message' => 'Authentication required']);
        exit();
    }
    
    // Only Admin and Librarian can delete links
    if (!requireRole($user, ['Admin','Librarian'])) exit();
    
    $linkId = isset($_GET['id']) ? (int)$_GET['id'] : 0;
    if ($linkId <= 0) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Invalid link ID']);
        exit();
    }
    
    try {
        $stmt = $conn->prepare("DELETE FROM journal_links WHERE link_id = :id");
        $stmt->execute([':id' => $linkId]);
        echo json_encode(['success' => true, 'message' => 'Link deleted successfully']);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Database error: ' . $e->getMessage()]);
    }
    exit();
}

try {
    $database = new Database();
    $conn = $database->getConnection();

    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        if ($action === 'list') {
            $limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 50;
            $search = isset($_GET['search']) ? trim($_GET['search']) : '';
            $yearFilter = isset($_GET['year']) ? trim($_GET['year']) : '';
            $sortBy = isset($_GET['sort']) ? $_GET['sort'] : 'date_desc';
            
            // Build dynamic query
            $sql = "SELECT j.journal_id, j.title, j.authors, j.year, j.publisher, j.abstract, j.original_name, j.file_name, j.file_size, j.uploaded_by, j.created_at, u.name as uploaded_by_name FROM journals j LEFT JOIN users u ON j.uploaded_by = u.user_id WHERE 1=1";
            
            // Add search condition
            if (!empty($search)) {
                $sql .= " AND (j.title LIKE :search OR j.authors LIKE :search OR j.abstract LIKE :search OR j.publisher LIKE :search)";
            }
            
            // Add year filter
            if (!empty($yearFilter)) {
                $sql .= " AND j.year = :year";
            }
            
            // Add sorting
            switch ($sortBy) {
                case 'date_asc':
                    $sql .= " ORDER BY j.created_at ASC";
                    break;
                case 'title_asc':
                    $sql .= " ORDER BY j.title ASC";
                    break;
                case 'title_desc':
                    $sql .= " ORDER BY j.title DESC";
                    break;
                case 'author_asc':
                    $sql .= " ORDER BY j.authors ASC";
                    break;
                case 'author_desc':
                    $sql .= " ORDER BY j.authors DESC";
                    break;
                case 'date_desc':
                default:
                    $sql .= " ORDER BY j.created_at DESC";
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
            echo json_encode(['success' => true, 'journals' => $rows]);
            exit();
        }

        if ($action === 'download') {
            // Secure download: require authentication
            $user = isAuthenticated();
            if (!$user) {
                http_response_code(401);
                echo json_encode(['success' => false, 'message' => 'Authentication required']);
                exit();
            }

            if ($journalId <= 0) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'Invalid journal id']);
                exit();
            }

            $sql = "SELECT file_name, original_name FROM journals WHERE journal_id = :id LIMIT 1";
            $stmt = $conn->prepare($sql);
            $stmt->bindParam(':id', $journalId, PDO::PARAM_INT);
            $stmt->execute();
            $row = $stmt->fetch(PDO::FETCH_ASSOC);
            if (!$row) {
                http_response_code(404);
                echo json_encode(['success' => false, 'message' => 'Journal not found']);
                exit();
            }

            $filePath = __DIR__ . '/../uploads/journals/' . $row['file_name'];
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
        
        if ($action === 'get' && $journalId > 0) {
            // Get single journal details
            $user = isAuthenticated();
            if (!$user) {
                http_response_code(401);
                echo json_encode(['success' => false, 'message' => 'Authentication required']);
                exit();
            }
            
            $sql = "SELECT journal_id, title, authors, year, publisher, abstract, original_name, file_name, file_size, uploaded_by, created_at FROM journals WHERE journal_id = :id LIMIT 1";
            $stmt = $conn->prepare($sql);
            $stmt->bindParam(':id', $journalId, PDO::PARAM_INT);
            $stmt->execute();
            $row = $stmt->fetch(PDO::FETCH_ASSOC);
            if (!$row) {
                http_response_code(404);
                echo json_encode(['success' => false, 'message' => 'Journal not found']);
                exit();
            }
            
            echo json_encode(['success' => true, 'journal' => $row]);
            exit();
        }

        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Invalid action']);
        exit();
    }

    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        // Authenticate
        $user = isAuthenticated();
        if (!$user) {
            http_response_code(401);
            echo json_encode(['success' => false, 'message' => 'Authentication required']);
            exit();
        }

        // Only Admin and Librarian can upload
        if (!requireRole($user, ['Admin','Librarian'])) exit();

        // Expect multipart/form-data
        if (!isset($_FILES['pdf']) || $_FILES['pdf']['error'] !== UPLOAD_ERR_OK) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'PDF file is required']);
            exit();
        }

        $title = $_POST['title'] ?? '';
        $authors = $_POST['authors'] ?? '';
        $year = $_POST['year'] ?? null;
        $publisher = $_POST['publisher'] ?? '';
        $abstract = $_POST['abstract'] ?? '';

        if (trim($title) === '') {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Title is required']);
            exit();
        }

        // Validate file type (PDF)
        $uploaded = $_FILES['pdf'];
        $finfo = finfo_open(FILEINFO_MIME_TYPE);
        $mime = finfo_file($finfo, $uploaded['tmp_name']);
        finfo_close($finfo);
        if ($mime !== 'application/pdf') {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Only PDF files are allowed']);
            exit();
        }

        // Ensure uploads folder exists
        $uploadDir = __DIR__ . '/../uploads/journals/';
        if (!is_dir($uploadDir)) mkdir($uploadDir, 0755, true);

        // Generate safe filename
        $ext = pathinfo($uploaded['name'], PATHINFO_EXTENSION);
        $storedName = uniqid('journal_', true) . '.' . $ext;
        $destPath = $uploadDir . $storedName;

        if (!move_uploaded_file($uploaded['tmp_name'], $destPath)) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Failed to store uploaded file']);
            exit();
        }

        // Insert record
        $sql = "INSERT INTO journals (title, authors, year, publisher, abstract, file_name, original_name, file_size, uploaded_by) VALUES (:title, :authors, :year, :publisher, :abstract, :file_name, :original_name, :file_size, :uploaded_by)";
        $stmt = $conn->prepare($sql);
        $stmt->bindParam(':title', $title);
        $stmt->bindParam(':authors', $authors);
        $stmt->bindParam(':year', $year);
        $stmt->bindParam(':publisher', $publisher);
        $stmt->bindParam(':abstract', $abstract);
        $stmt->bindParam(':file_name', $storedName);
        $stmt->bindParam(':original_name', $uploaded['name']);
        $stmt->bindParam(':file_size', $uploaded['size'], PDO::PARAM_INT);
        $stmt->bindParam(':uploaded_by', $user['user_id'], PDO::PARAM_INT);
        $stmt->execute();

        $jid = $conn->lastInsertId();
        echo json_encode(['success' => true, 'journal_id' => $jid, 'file_url' => "/cpmr_library/backend/uploads/journals/{$storedName}"]);
        exit();
    }
    
    if ($_SERVER['REQUEST_METHOD'] === 'PUT') {
        // Authenticate
        $user = isAuthenticated();
        if (!$user) {
            http_response_code(401);
            echo json_encode(['success' => false, 'message' => 'Authentication required']);
            exit();
        }

        // Only Admin and Librarian can edit
        if (!requireRole($user, ['Admin','Librarian'])) exit();

        if ($journalId <= 0) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Invalid journal id']);
            exit();
        }

        // Get existing journal to check ownership
        $sql = "SELECT uploaded_by FROM journals WHERE journal_id = :id LIMIT 1";
        $stmt = $conn->prepare($sql);
        $stmt->bindParam(':id', $journalId, PDO::PARAM_INT);
        $stmt->execute();
        $existing = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$existing) {
            http_response_code(404);
            echo json_encode(['success' => false, 'message' => 'Journal not found']);
            exit();
        }

        // Parse PUT data
        parse_str(file_get_contents("php://input"), $putData);
        
        $title = $putData['title'] ?? '';
        $authors = $putData['authors'] ?? '';
        $year = $putData['year'] ?? null;
        $publisher = $putData['publisher'] ?? '';
        $abstract = $putData['abstract'] ?? '';

        if (trim($title) === '') {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Title is required']);
            exit();
        }

        // Update record
        $sql = "UPDATE journals SET title = :title, authors = :authors, year = :year, publisher = :publisher, abstract = :abstract WHERE journal_id = :id";
        $stmt = $conn->prepare($sql);
        $stmt->bindParam(':title', $title);
        $stmt->bindParam(':authors', $authors);
        $stmt->bindParam(':year', $year);
        $stmt->bindParam(':publisher', $publisher);
        $stmt->bindParam(':abstract', $abstract);
        $stmt->bindParam(':id', $journalId, PDO::PARAM_INT);
        $stmt->execute();

        echo json_encode(['success' => true, 'message' => 'Journal updated successfully']);
        exit();
    }
    
    if ($_SERVER['REQUEST_METHOD'] === 'DELETE') {
        // Authenticate
        $user = isAuthenticated();
        if (!$user) {
            http_response_code(401);
            echo json_encode(['success' => false, 'message' => 'Authentication required']);
            exit();
        }

        // Only Admin and Librarian can delete
        if (!requireRole($user, ['Admin','Librarian'])) exit();

        if ($journalId <= 0) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Invalid journal id']);
            exit();
        }

        // Get existing journal to check ownership and file info
        $sql = "SELECT file_name, uploaded_by FROM journals WHERE journal_id = :id LIMIT 1";
        $stmt = $conn->prepare($sql);
        $stmt->bindParam(':id', $journalId, PDO::PARAM_INT);
        $stmt->execute();
        $existing = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$existing) {
            http_response_code(404);
            echo json_encode(['success' => false, 'message' => 'Journal not found']);
            exit();
        }

        // Delete the file from filesystem
        $filePath = __DIR__ . '/../uploads/journals/' . $existing['file_name'];
        if (file_exists($filePath)) {
            unlink($filePath);
        }

        // Delete record from database
        $sql = "DELETE FROM journals WHERE journal_id = :id";
        $stmt = $conn->prepare($sql);
        $stmt->bindParam(':id', $journalId, PDO::PARAM_INT);
        $stmt->execute();

        echo json_encode(['success' => true, 'message' => 'Journal deleted successfully']);
        exit();
    }

} catch (Exception $e) {
    error_log('Journals API error: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Internal server error']);
} finally {
    if (isset($conn)) $database->closeConnection();
}
?>