<?php
/**
 * Test delete protection by attempting to delete admin user
 */
header('Content-Type: application/json');

$host = 'localhost';
$dbname = 'cpmr_library';
$username = 'root';
$password = '';

try {
    $pdo = new PDO("mysql:host=$host;dbname=$dbname", $username, $password);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    
    // Try to delete user_id = 1 (main admin)
    $stmt = $pdo->prepare("DELETE FROM users WHERE user_id = ?");
    $stmt->execute([1]);
    
    // If we get here, deletion succeeded (BAD - protection not working)
    echo json_encode([
        'blocked' => false,
        'message' => '⚠️ WARNING: Admin user was deleted! Protection is NOT working!',
        'severity' => 'critical'
    ]);
    
} catch (PDOException $e) {
    // Check if it's the protection trigger that blocked it
    $errorMsg = $e->getMessage();
    
    if (strpos($errorMsg, 'PROTECTED') !== false || 
        strpos($errorMsg, 'admin') !== false ||
        $e->getCode() === '45000') {
        
        echo json_encode([
            'blocked' => true,
            'message' => '✅ PROTECTION WORKING! Deletion blocked: ' . $errorMsg,
            'severity' => 'success',
            'errorCode' => $e->getCode()
        ]);
    } else {
        // Some other error occurred
        echo json_encode([
            'blocked' => false,
            'message' => '❌ Different error occurred: ' . $errorMsg,
            'severity' => 'error'
        ]);
    }
}
?>
