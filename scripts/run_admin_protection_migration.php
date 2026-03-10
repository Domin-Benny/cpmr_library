<?php
/**
 * Admin Protection Database Migration Runner
 * File: database/run_admin_protection_migration.php
 * Description: Executes the admin protection SQL migration
 */

header('Content-Type: application/json');

// Database configuration
$host = 'localhost';
$dbname = 'cpmr_library';
$username = 'root'; // Default XAMPP username
$password = ''; // Default XAMPP password (empty)

try {
    // Connect to database
    $pdo = new PDO("mysql:host=$host;dbname=$dbname", $username, $password);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    
    echo json_encode([
        'success' => true,
        'message' => 'Connected to database successfully',
        'step' => 1
    ]);
    flush();
    ob_flush();
    
    // Read the SQL file
    $sqlFile = __DIR__ . '/add_admin_protection.sql';
    if (!file_exists($sqlFile)) {
        throw new Exception("SQL file not found: $sqlFile");
    }
    
    $sql = file_get_contents($sqlFile);
    
    echo json_encode([
        'success' => true,
        'message' => 'SQL file loaded successfully',
        'step' => 2
    ]);
    flush();
    ob_flush();
    
    // Execute the SQL statements
    // Split by DELIMITER and execute each part
    $statements = preg_split('/DELIMITER\s+;/i', $sql);
    
    foreach ($statements as $statement) {
        $statement = trim($statement);
        if (empty($statement)) continue;
        
        // Replace DELIMITER $$ temporarily
        $statement = str_replace('DELIMITER $$', '', $statement);
        
        try {
            $pdo->exec($statement);
        } catch (PDOException $e) {
            // Some errors are expected (like "object already exists")
            if (strpos($e->getMessage(), 'already exists') !== false) {
                echo json_encode([
                    'success' => true,
                    'message' => 'Object already exists (skipping)',
                    'error' => $e->getMessage()
                ]);
                flush();
                ob_flush();
            } else {
                throw $e;
            }
        }
    }
    
    // Verify the trigger was created
    $verifyTrigger = $pdo->query("
        SELECT TRIGGER_NAME 
        FROM information_schema.TRIGGERS 
        WHERE TRIGGER_SCHEMA = 'cpmr_library' 
        AND TRIGGER_NAME = 'before_user_delete'
    ")->fetchColumn();
    
    if ($verifyTrigger) {
        echo json_encode([
            'success' => true,
            'message' => '✅ Trigger created successfully: before_user_delete',
            'step' => 3
        ]);
        flush();
        ob_flush();
    } else {
        throw new Exception('Trigger verification failed - trigger not found');
    }
    
    // Verify the stored procedure was created
    $verifyProcedure = $pdo->query("
        SELECT ROUTINE_NAME 
        FROM information_schema.ROUTINES 
        WHERE ROUTINE_SCHEMA = 'cpmr_library' 
        AND ROUTINE_NAME = 'safe_delete_user'
    ")->fetchColumn();
    
    if ($verifyProcedure) {
        echo json_encode([
            'success' => true,
            'message' => '✅ Stored procedure created successfully: safe_delete_user',
            'step' => 4
        ]);
        flush();
        ob_flush();
    } else {
        throw new Exception('Stored procedure verification failed - procedure not found');
    }
    
    // Final success message
    echo json_encode([
        'success' => true,
        'message' => '🎉 ADMIN PROTECTION MIGRATION COMPLETED SUCCESSFULLY!',
        'details' => [
            'trigger' => 'before_user_delete',
            'procedure' => 'safe_delete_user',
            'protection_level' => 'Database-level (highest security)',
            'protected_roles' => ['Admin'],
            'protected_users' => [1] // user_id = 1
        ],
        'next_steps' => [
            '1. The trigger will now automatically block any DELETE attempts on admin users',
            '2. You can use the safe_delete_user() procedure for safer deletions',
            '3. Test by trying to delete an admin account - it should fail with protected message'
        ]
    ]);
    
} catch (PDOException $e) {
    echo json_encode([
        'success' => false,
        'message' => '❌ Database error during migration',
        'error' => $e->getMessage(),
        'code' => $e->getCode()
    ]);
} catch (Exception $e) {
    echo json_encode([
        'success' => false,
        'message' => '❌ Migration failed',
        'error' => $e->getMessage()
    ]);
}
?>
