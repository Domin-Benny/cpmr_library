-- =============================================
-- Database Migration: Add 'Other' Role
-- File: database/add_other_role.sql
-- Description: SQL migration to support 'Other' role for user registration
-- =============================================

-- Update the role ENUM to include 'Other' as a valid value
ALTER TABLE users MODIFY COLUMN role ENUM('Admin', 'Librarian', 'Staff', 'Student', 'Other') DEFAULT 'Staff';

-- Verify the change
SELECT COLUMN_TYPE 
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_NAME = 'users' 
AND COLUMN_NAME = 'role' 
AND TABLE_SCHEMA = 'cpmr_library';
