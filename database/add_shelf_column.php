<?php
/**
 * Migration: Add shelf column to books table
 * This script adds a shelf assignment feature to track where books are physically located
 */

require_once __DIR__ . '/../config/database.php';

try {
    $database = new Database();
    $conn = $database->getConnection();
    
    // Check if shelf column already exists
    $checkSql = "SHOW COLUMNS FROM books LIKE 'shelf'";
    $checkStmt = $conn->prepare($checkSql);
    $checkStmt->execute();
    $columnExists = $checkStmt->fetch();
    
    if ($columnExists) {
        echo json_encode([
            'success' => true,
            'message' => 'Shelf column already exists. No migration needed.'
        ]);
    } else {
        // Add shelf column
        $alterSql = "ALTER TABLE books ADD COLUMN shelf VARCHAR(100) DEFAULT NULL AFTER category_id";
        $alterStmt = $conn->prepare($alterSql);
        $alterStmt->execute();
        
        echo json_encode([
            'success' => true,
            'message' => 'Shelf column added successfully to books table'
        ]);
    }
    
    $database->closeConnection();
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Migration error: ' . $e->getMessage()
    ]);
}
?>
