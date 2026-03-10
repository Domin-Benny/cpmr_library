<?php
// =============================================
// Database Migration: Add 'Other' Role
// File: database/migrate_add_other_role.php
// Description: Update the users table to support 'Other' role for registration
// =============================================

require_once __DIR__ . '/../backend/config/database.php';

try {
    $database = new Database();
    $conn = $database->getConnection();

    echo "Starting migration to add 'Other' role to users table...\n\n";

    // Check current ENUM values
    $result = $conn->query("SELECT COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'users' AND COLUMN_NAME = 'role' AND TABLE_SCHEMA = 'cpmr_library'");
    $currentEnum = $result->fetch(PDO::FETCH_ASSOC);
    echo "Current role ENUM definition: " . $currentEnum['COLUMN_TYPE'] . "\n\n";

    // Update the role column to include 'Other'
    $alterSql = "ALTER TABLE users MODIFY COLUMN role ENUM('Admin', 'Librarian', 'Staff', 'Student', 'Other') DEFAULT 'Staff'";
    
    echo "Executing: " . $alterSql . "\n";
    $conn->query($alterSql);
    
    echo "✓ Successfully updated role ENUM to include 'Other'\n\n";

    // Verify the update
    $result = $conn->query("SELECT COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'users' AND COLUMN_NAME = 'role' AND TABLE_SCHEMA = 'cpmr_library'");
    $updatedEnum = $result->fetch(PDO::FETCH_ASSOC);
    echo "Updated role ENUM definition: " . $updatedEnum['COLUMN_TYPE'] . "\n";

    echo "\n✓ Migration completed successfully!\n";
    echo "Users can now register with the 'Other' role.\n";

} catch (Exception $e) {
    echo "✗ Migration failed: " . $e->getMessage() . "\n";
    exit(1);
}

?>
