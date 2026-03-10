-- =============================================
-- Add Default Security Questions for Admin User
-- File: database/add_admin_security_questions.sql
-- Description: Set built-in security questions for admin user
-- =============================================

-- Update admin user with security questions
UPDATE users 
SET 
    security_question = "What was the name of your first pet?",
    security_answer = "fluffy"
WHERE username = 'admin' AND role = 'Admin';

-- Verify the update
SELECT user_id, username, role, security_question, security_answer 
FROM users 
WHERE username = 'admin' AND role = 'Admin';

-- Optional: If you want to set different questions per admin, you can update individually:
-- UPDATE users 
-- SET 
--     security_question = "In what city were you born?",
--     security_answer = "accra"
-- WHERE username = 'admin' AND role = 'Admin';
