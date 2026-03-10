<?php
/**
 * Check if stored procedure exists
 */
header('Content-Type: application/json');

$host = 'localhost';
$dbname = 'cpmr_library';
$username = 'root';
$password = '';

try {
    $pdo = new PDO("mysql:host=$host;dbname=$dbname", $username, $password);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    
    $stmt = $pdo->query("
        SELECT ROUTINE_NAME 
        FROM information_schema.ROUTINES 
        WHERE ROUTINE_SCHEMA = 'cpmr_library' 
        AND ROUTINE_NAME = 'safe_delete_user'
    ");
    
    $exists = $stmt->fetchColumn();
    
    echo json_encode([
        'exists' => (bool)$exists,
        'procedure_name' => $exists ?: null
    ]);
    
} catch (PDOException $e) {
    echo json_encode([
        'exists' => false,
        'error' => $e->getMessage()
    ]);
}
?>
