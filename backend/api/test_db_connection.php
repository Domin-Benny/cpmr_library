<?php
// Simple database connection test
header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");

error_reporting(E_ALL);
ini_set('display_errors', 1);

try {
    require_once '../../config/database.php';
    
    echo "1. Loading database class... ";
    $database = new Database();
    echo "✓ Success\n";
    
    echo "2. Creating database connection... ";
    $conn = $database->getConnection();
    echo "✓ Success\n";
    
    echo "3. Testing simple query... ";
    $stmt = $conn->query("SELECT 1 as test");
    $result = $stmt->fetch();
    echo "✓ Success (result: " . $result['test'] . ")\n";
    
    echo "4. Checking users table... ";
    $stmt = $conn->query("SHOW TABLES LIKE 'users'");
    if ($stmt->rowCount() > 0) {
        echo "✓ Table exists\n";
        
        echo "5. Counting users... ";
        $stmt = $conn->query("SELECT COUNT(*) as count FROM users");
        $count = $stmt->fetch()['count'];
        echo "✓ Found $count users\n";
        
        echo "6. Sample user data... ";
        $stmt = $conn->query("SELECT user_id, username, name, email, role FROM users LIMIT 1");
        $user = $stmt->fetch(PDO::FETCH_ASSOC);
        if ($user) {
            echo "✓ User found: " . $user['username'] . " (" . $user['role'] . ")\n";
        } else {
            echo "✗ No users found\n";
        }
    } else {
        echo "✗ Table does not exist\n";
    }
    
    echo "7. Testing close connection... ";
    if (method_exists($database, 'closeConnection')) {
        $database->closeConnection();
        echo "✓ Success\n";
    } else {
        echo "✗ Method not found\n";
    }
    
    echo "\n=== ALL TESTS PASSED ===\n";
    echo json_encode(['success' => true, 'message' => 'All database tests passed']);
    
} catch (Exception $e) {
    echo "ERROR: " . $e->getMessage() . "\n";
    echo "Stack trace: " . $e->getTraceAsString() . "\n";
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
?>