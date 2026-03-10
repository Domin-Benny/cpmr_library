-- =============================================
-- Admin Account Protection - Database Level
-- File: database/add_admin_protection.sql
-- Description: Adds database triggers and constraints to prevent deletion of admin accounts
-- Implementation: March 3, 2026
-- =============================================

USE cpmr_library;

-- =============================================
-- METHOD 1: BEFORE DELETE TRIGGER (RECOMMENDED)
-- This trigger fires before ANY DELETE on users table
-- and blocks deletion if the user is an admin
-- =============================================

DELIMITER $$

CREATE TRIGGER before_user_delete
BEFORE DELETE ON users
FOR EACH ROW
BEGIN
    -- Check if the user being deleted is an Admin
    IF OLD.role = 'Admin' THEN
        SIGNAL SQLSTATE '45000' 
        SET MESSAGE_TEXT = '⚠️ PROTECTED: Cannot delete admin accounts. Admin accounts are protected at database level to maintain system security.';
    END IF;
    
    -- Additional check: Prevent deletion of user_id = 1 (main admin)
    IF OLD.user_id = 1 THEN
        SIGNAL SQLSTATE '45000' 
        SET MESSAGE_TEXT = '⚠️ PROTECTED: Cannot delete the main admin account (user_id=1). This account is essential for system security.';
    END IF;
END$$

DELIMITER ;

-- =============================================
-- METHOD 2: STORED PROCEDURE FOR SAFE DELETION
-- Use this procedure instead of direct DELETE
-- It includes validation before attempting deletion
-- =============================================

DELIMITER $$

CREATE PROCEDURE safe_delete_user(
    IN p_user_id INT,
    OUT p_success BOOLEAN,
    OUT p_message VARCHAR(500)
)
BEGIN
    DECLARE v_role VARCHAR(50);
    DECLARE v_user_id INT;
    
    -- Get the user details
    SELECT role, user_id INTO v_role, v_user_id
    FROM users
    WHERE user_id = p_user_id;
    
    -- Check if user exists
    IF v_user_id IS NULL THEN
        SET p_success = FALSE;
        SET p_message = 'User not found';
    -- Check if trying to delete admin
    ELSEIF v_role = 'Admin' THEN
        SET p_success = FALSE;
        SET p_message = '⚠️ PROTECTED: Cannot delete admin accounts. Admin accounts are protected at database level.';
    -- Check if trying to delete main admin (user_id = 1)
    ELSEIF v_user_id = 1 THEN
        SET p_success = FALSE;
        SET p_message = '⚠️ PROTECTED: Cannot delete the main admin account (user_id=1).';
    ELSE
        -- Safe to delete - proceed with deletion
        DELETE FROM users WHERE user_id = p_user_id;
        SET p_success = TRUE;
        SET p_message = 'User deleted successfully';
    END IF;
END$$

DELIMITER ;

-- =============================================
-- VERIFICATION QUERIES
-- Run these to verify the protection is in place
-- =============================================

-- Check if trigger exists
SELECT 
    TRIGGER_NAME,
    EVENT_MANIPULATION,
    EVENT_OBJECT_TABLE,
    ACTION_TIMING
FROM information_schema.TRIGGERS
WHERE TRIGGER_SCHEMA = 'cpmr_library'
AND TRIGGER_NAME = 'before_user_delete';

-- Check if stored procedure exists
SELECT 
    ROUTINE_NAME,
    ROUTINE_TYPE,
    CREATED
FROM information_schema.ROUTINES
WHERE ROUTINE_SCHEMA = 'cpmr_library'
AND ROUTINE_NAME = 'safe_delete_user';

-- =============================================
-- TEST EXAMPLES (DO NOT RUN THESE - FOR REFERENCE ONLY)
-- =============================================

-- Example 1: This will FAIL (trying to delete admin)
-- DELETE FROM users WHERE user_id = 1;
-- Error: ⚠️ PROTECTED: Cannot delete admin accounts...

-- Example 2: This will SUCCEED (deleting non-admin)
-- DELETE FROM users WHERE user_id = 5; -- Assuming user 5 is not admin

-- Example 3: Using the safe procedure
-- CALL safe_delete_user(1, @success, @message);
-- SELECT @success, @message;

-- =============================================
-- USAGE INSTRUCTIONS
-- =============================================

-- To use in your PHP code, replace direct DELETE with:
-- 
-- Option A: Let the trigger handle it (automatic protection)
-- $stmt = $conn->prepare("DELETE FROM users WHERE user_id = ?");
-- $stmt->execute([$user_id]);
-- // Trigger will block if user is admin
--
-- Option B: Use the stored procedure (explicit validation)
-- $stmt = $conn->prepare("CALL safe_delete_user(?, @success, @message)");
-- $stmt->execute([$user_id]);
-- $result = $conn->query("SELECT @success as success, @message as message")->fetch();

-- =============================================
-- ROLLBACK (IF NEEDED)
-- Only run these if you need to remove the protection
-- =============================================

-- To drop the trigger:
-- DROP TRIGGER IF EXISTS before_user_delete;

-- To drop the stored procedure:
-- DROP PROCEDURE IF EXISTS safe_delete_user;
