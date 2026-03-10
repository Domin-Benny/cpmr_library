<?php
// Simple PHP test to check if server is working
echo "PHP is working! Current time: " . date('Y-m-d H:i:s') . "\n";
echo "PHP Version: " . phpversion() . "\n";

// Check if we can include the database file
if (file_exists('../config/database.php')) {
    echo "Database config file found\n";
    try {
        require_once '../../config/database.php';
        echo "Database class loaded successfully\n";
        
        $database = new Database();
        echo "Database object created\n";
        
        $conn = $database->getConnection();
        echo "Database connection established\n";
        
        // Simple query test
        $stmt = $conn->query("SELECT 1 as test");
        $result = $stmt->fetch();
        echo "Database query successful: " . $result['test'] . "\n";
        
        $database->closeConnection();
        echo "Database connection closed\n";
        
    } catch (Exception $e) {
        echo "Database error: " . $e->getMessage() . "\n";
        echo "Stack trace: " . $e->getTraceAsString() . "\n";
    }
} else {
    echo "Database config file NOT found\n";
}

// Check error reporting
echo "Error reporting level: " . error_reporting() . "\n";
?>