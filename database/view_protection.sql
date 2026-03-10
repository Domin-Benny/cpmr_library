-- =============================================
-- VIEW ADMIN PROTECTION IN DATABASE
-- Run these queries in phpMyAdmin to see the protection
-- =============================================

-- 1. VIEW THE TRIGGER
-- This shows the trigger that blocks admin deletion
SELECT 
    TRIGGER_NAME AS 'Trigger Name',
    EVENT_MANIPULATION AS 'Event',
    EVENT_OBJECT_TABLE AS 'Table',
    ACTION_TIMING AS 'Timing',
    ACTION_STATEMENT AS 'Trigger Code'
FROM information_schema.TRIGGERS
WHERE TRIGGER_SCHEMA = 'cpmr_library'
AND TRIGGER_NAME = 'before_user_delete';

-- 2. VIEW THE STORED PROCEDURE
-- This shows the safe delete procedure
SELECT 
    ROUTINE_NAME AS 'Procedure Name',
    ROUTINE_TYPE AS 'Type',
    ROUTINE_DEFINITION AS 'Procedure Code'
FROM information_schema.ROUTINES
WHERE ROUTINE_SCHEMA = 'cpmr_library'
AND ROUTINE_NAME = 'safe_delete_user';

-- 3. VIEW ALL ADMIN USERS (PROTECTED)
-- This shows all users with Admin role
SELECT 
    user_id AS 'User ID',
    username AS 'Username',
    name AS 'Name',
    role AS 'Role',
    status AS 'Status',
    created_at AS 'Created Date'
FROM users
WHERE role = 'Admin'
ORDER BY user_id;

-- 4. TEST THE PROTECTION (UNCOMMENT TO RUN)
-- This will FAIL and show the protection working
-- DELETE FROM users WHERE user_id = 1;
