<?php
// =============================================
// Database Migration API: Add 'Other' Role
// File: database/run_migration.php
// Description: API endpoint to run the migration
// =============================================

header('Content-Type: application/json');

try {
    // Start output buffering to capture any debug output
    ob_start();
    
    require_once __DIR__ . '/../../config/database.php';

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

    $output = ob_get_clean();

    http_response_code(200);
    echo json_encode([
        'success' => true,
        'message' => 'Migration completed successfully',
        'output' => $output
    ]);

} catch (Exception $e) {
    $output = ob_get_clean();
    
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Migration failed: ' . $e->getMessage(),
        'output' => $output . "\n\nError: " . $e->getMessage()
    ]);
}

?>
