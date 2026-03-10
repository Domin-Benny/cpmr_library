-- =============================================
-- Add Password Reset Columns
-- File: database/add_password_reset_columns.sql
-- Description: Add reset token columns for password recovery
-- =============================================

-- Add reset token columns to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS reset_token VARCHAR(255) DEFAULT NULL AFTER security_answer,
ADD COLUMN IF NOT EXISTS reset_token_expiry DATETIME DEFAULT NULL AFTER reset_token;

-- Verify the columns were added
SELECT COLUMN_NAME, COLUMN_TYPE 
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_NAME = 'users' 
AND COLUMN_SCHEMA = 'cpmr_library'
AND COLUMN_NAME IN ('reset_token', 'reset_token_expiry');
