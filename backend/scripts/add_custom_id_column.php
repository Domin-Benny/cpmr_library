<?php
require_once "../config/database.php";

try {
    $db = new Database();
    $conn = $db->getConnection();
    
    // Add custom_id column to books table
    $sql = "ALTER TABLE books ADD COLUMN custom_id VARCHAR(50) UNIQUE DEFAULT NULL";
    $conn->exec($sql);
    
    echo "Column custom_id added to books table successfully\n";
    
    // Add some sample custom IDs for existing books
    echo "Generating custom IDs for existing books...\n";
    
    $stmt = $conn->prepare("SELECT book_id, category_id, title FROM books WHERE custom_id IS NULL");
    $stmt->execute();
    $books = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    foreach ($books as $book) {
        // Get category prefix
        $categoryStmt = $conn->prepare("SELECT name FROM categories WHERE category_id = ?");
        $categoryStmt->execute([$book['category_id']]);
        $category = $categoryStmt->fetch(PDO::FETCH_ASSOC);
        
        if ($category) {
            $categoryName = $category['name'];
            $categoryPrefix = substr(strtoupper($categoryName), 0, 3);
            $categoryPrefix = preg_replace('/[^A-Z]/', '', $categoryPrefix);
            
            // Get the next sequence number for this category
            $sequenceStmt = $conn->prepare("SELECT COUNT(*) as count FROM books WHERE category_id = ? AND custom_id LIKE ?");
            $sequenceStmt->execute([$book['category_id'], $categoryPrefix . '-%']);
            $sequenceResult = $sequenceStmt->fetch(PDO::FETCH_ASSOC);
            $sequence = $sequenceResult['count'] + 1;
            
            $customId = $categoryPrefix . '-' . str_pad($sequence, 3, '0', STR_PAD_LEFT);
            
            // Update the book with custom ID
            $updateStmt = $conn->prepare("UPDATE books SET custom_id = ? WHERE book_id = ?");
            $updateStmt->execute([$customId, $book['book_id']]);
            
            echo "Book ID {$book['book_id']}: {$customId}\n";
        }
    }
    
    echo "Custom ID generation completed!\n";
    
} catch (Exception $e) {
    // Check if column already exists
    if (strpos($e->getMessage(), 'Duplicate column name') !== false) {
        echo "Column custom_id already exists in books table\n";
    } else {
        echo "Error: " . $e->getMessage() . "\n";
    }
}
?>