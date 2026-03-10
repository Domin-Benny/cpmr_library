<?php
require_once 'backend/config/database.php';

try {
    $db = new Database();
    $conn = $db->getConnection();
    echo "Database connection successful!<br>";
    
    // Test a simple query
    $stmt = $conn->prepare("SELECT COUNT(*) as count FROM users");
    $stmt->execute();
    $result = $stmt->fetch(PDO::FETCH_ASSOC);
    echo "Users table has " . $result['count'] . " records<br>";
    
    echo "All systems working!";
} catch (Exception $e) {
    echo "Error: " . $e->getMessage();
}
?>