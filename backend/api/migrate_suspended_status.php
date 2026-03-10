<?php
// Database migration - Add 'Suspended' to status ENUM

error_reporting(E_ALL);
ini_set('display_errors', 1);

$basePath = __DIR__ . '/../../';
require_once($basePath . 'backend/config/Database.php');

echo "<h1>🔧 Database Migration: Add 'Suspended' Status</h1>";

try {
    $database = new Database();
    $conn = $database->getConnection();
    
    echo "<h2>Step 1: Update users table</h2>";
    
    $sql1 = "ALTER TABLE users MODIFY status ENUM('Active', 'Inactive', 'Suspended') DEFAULT 'Active'";
    $conn->exec($sql1);
    echo "<p style='color: green;'>✅ users.status updated to include 'Suspended'</p>";
    
    echo "<h2>Step 2: Update members table</h2>";
    
    $sql2 = "ALTER TABLE members MODIFY status ENUM('Active', 'Inactive', 'Suspended') DEFAULT 'Active'";
    $conn->exec($sql2);
    echo "<p style='color: green;'>✅ members.status updated to include 'Suspended'</p>";
    
    echo "<h2>✅ Migration Complete!</h2>";
    echo "<p>Both tables now support the 'Suspended' status.</p>";
    echo "<p><a href='javascript:history.back()'>← Back</a></p>";
    
} catch (Exception $e) {
    echo "<h2 style='color: red;'>❌ Error</h2>";
    echo "<p style='color: red;'>" . $e->getMessage() . "</p>";
}
?>
