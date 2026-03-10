<?php
require_once '../config/database.php';

try {
    // Create database instance and get connection
    $database = new Database();
    $pdo = $database->getConnection();

    // Add profile_picture column to users table if it doesn't exist
    $checkColumn = $pdo->query("SHOW COLUMNS FROM users LIKE 'profile_picture'");
    $columnExists = $checkColumn->rowCount() > 0;

    if (!$columnExists) {
        $sql = "ALTER TABLE users ADD COLUMN profile_picture VARCHAR(255) DEFAULT NULL";
        $pdo->exec($sql);
        echo "Profile picture column added to users table successfully.\n";
    } else {
        echo "Profile picture column already exists in users table.\n";
    }
    
    // Create the profile pictures directory if it doesn't exist
    $uploadDir = '../../../frontend/images/profile_pictures/';
    if (!file_exists($uploadDir)) {
        mkdir($uploadDir, 0777, true);
        echo "Profile pictures directory created.\n";
    } else {
        echo "Profile pictures directory already exists.\n";
    }

} catch (PDOException $e) {
    echo "Database Error: " . $e->getMessage() . "\n";
} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
?>