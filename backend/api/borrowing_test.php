<?php
// =============================================
// Borrowing Test API (No Auth Required)
// File: backend/api/borrowing_test.php
// Description: Test endpoint for borrowing deletion
// =============================================

header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

require_once '../../config/database.php';

// Handle preflight
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

try {
    $database = new Database();
    $conn = $database->getConnection();
    
    $action = $_GET['action'] ?? '';
    
    switch ($action) {
        case 'getReturned':
            getReturnedRecords($conn);
            break;
        case 'delete':
            deleteRecord($conn);
            break;
        default:
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Invalid action']);
    }
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}

function getReturnedRecords($conn) {
    $sql = "SELECT 
                br.record_id as id,
                m.name as member_name,
                b.title as book_title,
                br.borrow_date,
                br.return_date,
                br.status
            FROM borrowing_records br
            JOIN members m ON br.member_id = m.member_id
            JOIN books b ON br.book_id = b.book_id
            WHERE br.status = 'Returned'
            ORDER BY br.return_date DESC";
    
    $stmt = $conn->prepare($sql);
    $stmt->execute();
    $records = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    echo json_encode([
        'success' => true,
        'records' => $records,
        'count' => count($records)
    ]);
}

function deleteRecord($conn) {
    $data = json_decode(file_get_contents('php://input'), true);
    
    if (!isset($data['id'])) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'No record ID provided']);
        return;
    }
    
    $id = $data['id'];
    error_log("[TEST DELETE] Attempting to delete record_id: $id");
    
    try {
        // Check record exists
        $checkSql = "SELECT record_id, status FROM borrowing_records WHERE record_id = ?";
        $checkStmt = $conn->prepare($checkSql);
        $checkStmt->bindValue(1, $id, PDO::PARAM_INT);
        $checkStmt->execute();
        $record = $checkStmt->fetch(PDO::FETCH_ASSOC);
        
        error_log("[TEST DELETE] Record check: " . json_encode($record));
        
        if (!$record) {
            echo json_encode([
                'success' => false,
                'message' => "Record $id not found",
                'debug' => ['searched_id' => $id, 'status' => 'NOT_FOUND']
            ]);
            return;
        }
        
        if ($record['status'] !== 'Returned') {
            echo json_encode([
                'success' => false,
                'message' => "Cannot delete: status is '{$record['status']}'",
                'debug' => ['record_id' => $id, 'status' => $record['status']]
            ]);
            return;
        }
        
        // Delete the record
        $deleteSql = "DELETE FROM borrowing_records WHERE record_id = ? AND status = 'Returned'";
        $deleteStmt = $conn->prepare($deleteSql);
        $deleteStmt->bindValue(1, $id, PDO::PARAM_INT);
        $deleteStmt->execute();
        $deleted = $deleteStmt->rowCount();
        
        error_log("[TEST DELETE] Deleted $deleted rows");
        
        // Verify deletion
        $verifySql = "SELECT COUNT(*) as count FROM borrowing_records WHERE record_id = ?";
        $verifyStmt = $conn->prepare($verifySql);
        $verifyStmt->bindValue(1, $id, PDO::PARAM_INT);
        $verifyStmt->execute();
        $verify = $verifyStmt->fetch(PDO::FETCH_ASSOC);
        
        echo json_encode([
            'success' => $deleted > 0,
            'deleted' => $deleted,
            'message' => $deleted > 0 ? 'Record deleted successfully' : 'Deletion failed',
            'debug' => [
                'record_id' => $id,
                'rows_deleted' => $deleted,
                'record_still_exists' => $verify['count']
            ]
        ]);
        
    } catch (Exception $e) {
        error_log("[TEST DELETE] Error: " . $e->getMessage());
        echo json_encode([
            'success' => false,
            'message' => 'Error: ' . $e->getMessage()
        ]);
    }
}
?>
