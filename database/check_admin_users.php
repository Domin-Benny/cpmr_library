<?php
/**
 * Check for admin users in database
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
        SELECT user_id, username, name, role 
        FROM users 
        WHERE role = 'Admin'
        ORDER BY user_id
    ");
    
    $admins = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    echo json_encode([
        'adminCount' => count($admins),
        'admins' => $admins
    ]);
    
} catch (PDOException $e) {
    echo json_encode([
        'adminCount' => 0,
        'error' => $e->getMessage()
    ]);
}
?>
