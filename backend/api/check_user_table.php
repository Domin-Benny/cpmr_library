<?php
// Check user table structure
header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");

error_reporting(E_ALL);
ini_set('display_errors', 1);

try {
    require_once '../../config/database.php';
    
    $database = new Database();
    $conn = $database->getConnection();
    
    // Get table structure
    $stmt = $conn->query("DESCRIBE users");
    $columns = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    echo "User table columns:\n";
    foreach ($columns as $column) {
        echo "- " . $column['Field'] . " (" . $column['Type'] . ")\n";
    }
    
    echo "\nSample data:\n";
    $stmt = $conn->query("SELECT * FROM users LIMIT 3");
    $users = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    foreach ($users as $user) {
        echo "User: " . $user['username'] . " | Email: " . $user['email'] . " | Role: " . $user['role'] . "\n";
        echo "Password hash: " . substr($user['password_hash'], 0, 20) . "...\n\n";
    }
    
    // Test a specific login query
    $testUsername = 'admin';
    echo "Testing query for user: $testUsername\n";
    
    $sql = "SELECT user_id, username, password_hash, name, email, role, status, profile_picture 
            FROM users 
            WHERE username = :username AND status = 'Active'";
    
    $stmt = $conn->prepare($sql);
    $stmt->bindParam(':username', $testUsername);
    $stmt->execute();
    
    echo "Query row count: " . $stmt->rowCount() . "\n";
    
    if ($stmt->rowCount() > 0) {
        $user = $stmt->fetch(PDO::FETCH_ASSOC);
        echo "User found: " . print_r($user, true) . "\n";
    }
    
    $database->closeConnection();
    
} catch (Exception $e) {
    echo "ERROR: " . $e->getMessage() . "\n";
    echo "Stack trace: " . $e->getTraceAsString() . "\n";
}
?>