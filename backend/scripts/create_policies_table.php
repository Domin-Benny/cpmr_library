<?php
/**
 * Migration Script: Create Policies Table
 * File: backend/scripts/create_policies_table.php
 * Description: Creates the policies table for storing CPMR policy documents
 */

// Use absolute path for web server compatibility
$basePath = __DIR__ . '/../';
require_once $basePath . 'config/database.php';

try {
    $database = new Database();
    $conn = $database->getConnection();
    
    // Create policies table
    $sql = "CREATE TABLE IF NOT EXISTS policies (
        policy_id INT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        year INT,
        file_name VARCHAR(255) NOT NULL,
        original_name VARCHAR(255),
        file_size INT,
        uploaded_by INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (uploaded_by) REFERENCES users(user_id) ON DELETE SET NULL,
        INDEX idx_title (title),
        INDEX idx_year (year),
        INDEX idx_created_at (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci";
    
    $conn->exec($sql);
    
    echo "✅ Policies table created successfully!\n";
    echo "Table Structure:\n";
    echo "- policy_id (Primary Key, Auto Increment)\n";
    echo "- title (VARCHAR 255, Not Null)\n";
    echo "- description (TEXT)\n";
    echo "- year (INT)\n";
    echo "- file_name (VARCHAR 255, Not Null)\n";
    echo "- original_name (VARCHAR 255)\n";
    echo "- file_size (INT)\n";
    echo "- uploaded_by (INT, Foreign Key to users)\n";
    echo "- created_at (TIMESTAMP, Default Current Timestamp)\n";
    
} catch (PDOException $e) {
    echo "❌ Error creating policies table: " . $e->getMessage() . "\n";
    exit(1);
} finally {
    if (isset($conn)) {
        $database->closeConnection();
    }
}
?>
