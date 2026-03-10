<?php
/**
 * Check if trigger exists
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
        SELECT TRIGGER_NAME 
        FROM information_schema.TRIGGERS 
        WHERE TRIGGER_SCHEMA = 'cpmr_library' 
        AND TRIGGER_NAME = 'before_user_delete'
    ");
    
    $exists = $stmt->fetchColumn();
    
    echo json_encode([
        'exists' => (bool)$exists,
        'trigger_name' => $exists ?: null
    ]);
    
} catch (PDOException $e) {
    echo json_encode([
        'exists' => false,
        'error' => $e->getMessage()
    ]);
}
?>
