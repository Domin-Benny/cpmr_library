<?php
// Test database connection and user table
header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");

require_once '../../config/database.php';

try {
    $database = new Database();
    $conn = $database->getConnection();
    
    // Test database connection
    $stmt = $conn->query("SELECT 1 as test");
    $result = $stmt->fetch();
    
    // Check if users table exists
    $stmt = $conn->query("SHOW TABLES LIKE 'users'");
    $tableExists = $stmt->rowCount() > 0;
    
    if ($tableExists) {
        // Get user table structure
        $stmt = $conn->query("DESCRIBE users");
        $columns = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        // Get sample users
        $stmt = $conn->query("SELECT user_id, username, name, email, role, status FROM users LIMIT 5");
        $users = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        echo json_encode([
            'success' => true,
            'message' => 'Database connection successful',
            'database' => 'connected',
            'test_query' => $result['test'] === 1 ? 'passed' : 'failed',
            'users_table' => 'exists',
            'columns' => $columns,
            'sample_users' => $users
        ]);
    } else {
        echo json_encode([
            'success' => false,
            'message' => 'Users table not found',
            'database' => 'connected',
            'users_table' => 'missing'
        ]);
    }
    
} catch (Exception $e) {
    echo json_encode([
        'success' => false,
        'message' => 'Database connection failed',
        'error' => $e->getMessage()
    ]);
}
?>