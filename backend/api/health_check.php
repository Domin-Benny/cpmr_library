<?php
// Simple API Health Check
header("Content-Type: application/json");

echo json_encode([
    'status' => 'API Server Running',
    'timestamp' => date('Y-m-d H:i:s'),
    'checks' => []
]);

// Test 1: Check if config file can be loaded
try {
    require_once '../../config/database.php';
    echo json_encode(['check' => 'Database config', 'status' => '✅ OK']);
} catch (Exception $e) {
    echo json_encode(['check' => 'Database config', 'status' => '❌ FAILED', 'error' => $e->getMessage()]);
}

// Test 2: Check database connection
try {
    $database = new Database();
    $conn = $database->getConnection();
    echo json_encode(['check' => 'Database connection', 'status' => '✅ OK']);
    
    // Test query
    $sql = "SELECT COUNT(*) as count FROM members";
    $stmt = $conn->prepare($sql);
    $stmt->execute();
    $result = $stmt->fetch(PDO::FETCH_ASSOC);
    echo json_encode(['check' => 'Members table', 'status' => '✅ OK', 'count' => $result['count']]);
} catch (Exception $e) {
    echo json_encode(['check' => 'Database connection', 'status' => '❌ FAILED', 'error' => $e->getMessage()]);
}

// Test 3: Check auth helper
try {
    require_once 'auth_helper.php';
    echo json_encode(['check' => 'Auth helper', 'status' => '✅ OK']);
} catch (Exception $e) {
    echo json_encode(['check' => 'Auth helper', 'status' => '❌ FAILED', 'error' => $e->getMessage()]);
}

?>
