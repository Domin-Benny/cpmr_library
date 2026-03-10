<?php
/**
 * Simple Admin Protection Installer
 * File: database/install_protection_simple.php
 * Description: Installs admin protection without complex DELIMITER issues
 */

header('Content-Type: application/json');

$host = 'localhost';
$dbname = 'cpmr_library';
$username = 'root';
$password = '';

try {
    $pdo = new PDO("mysql:host=$host;dbname=$dbname", $username, $password);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    
    echo json_encode(['step' => 1, 'message' => 'Connected to database']);
    
    // Drop existing objects if they exist (to avoid conflicts)
    try {
        $pdo->exec("DROP TRIGGER IF EXISTS before_user_delete");
        echo json_encode(['step' => 2, 'message' => 'Dropped old trigger if existed']);
    } catch (Exception $e) {
        // Ignore errors
    }
    
    try {
        $pdo->exec("DROP PROCEDURE IF EXISTS safe_delete_user");
        echo json_encode(['step' => 3, 'message' => 'Dropped old procedure if existed']);
    } catch (Exception $e) {
        // Ignore errors
    }
    
    // Create trigger using simple syntax
    $triggerSQL = "
    CREATE TRIGGER before_user_delete
    BEFORE DELETE ON users
    FOR EACH ROW
    BEGIN
        IF OLD.role = 'Admin' THEN
            SIGNAL SQLSTATE '45000' 
            SET MESSAGE_TEXT = 'PROTECTED: Cannot delete admin accounts';
        END IF;
        IF OLD.user_id = 1 THEN
            SIGNAL SQLSTATE '45000' 
            SET MESSAGE_TEXT = 'PROTECTED: Cannot delete main admin account';
        END IF;
    END
    ";
    
    $pdo->exec($triggerSQL);
    echo json_encode(['step' => 4, 'message' => '✅ Trigger created successfully']);
    
    // Create stored procedure
    $procedureSQL = "
    CREATE PROCEDURE safe_delete_user(
        IN p_user_id INT,
        OUT p_success BOOLEAN,
        OUT p_message VARCHAR(500)
    )
    BEGIN
        DECLARE v_role VARCHAR(50);
        DECLARE v_user_id INT;
        
        SELECT role, user_id INTO v_role, v_user_id
        FROM users
        WHERE user_id = p_user_id;
        
        IF v_user_id IS NULL THEN
            SET p_success = FALSE;
            SET p_message = 'User not found';
        ELSEIF v_role = 'Admin' THEN
            SET p_success = FALSE;
            SET p_message = 'PROTECTED: Cannot delete admin accounts';
        ELSEIF v_user_id = 1 THEN
            SET p_success = FALSE;
            SET p_message = 'PROTECTED: Cannot delete main admin account';
        ELSE
            DELETE FROM users WHERE user_id = p_user_id;
            SET p_success = TRUE;
            SET p_message = 'User deleted successfully';
        END IF;
    END
    ";
    
    $pdo->exec($procedureSQL);
    echo json_encode(['step' => 5, 'message' => '✅ Stored procedure created successfully']);
    
    // Verify installation
    $triggerCheck = $pdo->query("
        SELECT COUNT(*) 
        FROM information_schema.TRIGGERS 
        WHERE TRIGGER_SCHEMA = 'cpmr_library' 
        AND TRIGGER_NAME = 'before_user_delete'
    ")->fetchColumn();
    
    $procCheck = $pdo->query("
        SELECT COUNT(*) 
        FROM information_schema.ROUTINES 
        WHERE ROUTINE_SCHEMA = 'cpmr_library' 
        AND ROUTINE_NAME = 'safe_delete_user'
    ")->fetchColumn();
    
    if ($triggerCheck > 0 && $procCheck > 0) {
        echo json_encode([
            'step' => 6,
            'success' => true,
            'message' => '🎉 ADMIN PROTECTION INSTALLED SUCCESSFULLY!',
            'details' => [
                'trigger' => 'before_user_delete',
                'procedure' => 'safe_delete_user',
                'trigger_verified' => (bool)$triggerCheck,
                'procedure_verified' => (bool)$procCheck
            ]
        ]);
    } else {
        throw new Exception('Verification failed - objects not created');
    }
    
} catch (PDOException $e) {
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage(),
        'code' => $e->getCode()
    ]);
} catch (Exception $e) {
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}
?>
