# Admin Security Questions - Installation & Setup Guide

## Quick Start

The Admin Security Questions feature has been fully implemented in the CPMR Library Management System. Follow these steps to activate it.

## Step 1: Run the Migration Script

### Option A: Using PHP (Recommended)
1. Open your browser and navigate to:
   ```
   http://localhost/cpmr_library/database/setup_admin_security_questions.php
   ```
2. You should see a success JSON response
3. The default security question will be set for the admin user

### Option B: Using MySQL Directly
1. Open phpMyAdmin or MySQL command line
2. Execute the SQL from:
   ```
   /database/add_admin_security_questions.sql
   ```
3. Or run these commands:
   ```sql
   USE cpmr_library;
   UPDATE users 
   SET security_question = "What was the name of your first pet?",
       security_answer = "fluffy"
   WHERE username = 'admin' AND role = 'Admin';
   ```

## Step 2: Verify Installation

### Check Database
Log in to phpMyAdmin and verify the admin user has the security question set:

```sql
SELECT user_id, username, role, security_question, security_answer 
FROM users 
WHERE username = 'admin' AND role = 'Admin';
```

Expected result should show:
- **security_question:** "What was the name of your first pet?" (or custom)
- **security_answer:** "fluffy" (or custom answer)

### Check Frontend
1. Log in to the Admin Dashboard as admin user
2. Go to **⚙️ Settings** from the left navigation menu
3. Scroll down to **🔐 Admin Security Questions** section
4. You should see the security question displayed with an **"Update Security Question"** button

## Step 3: Update Default Security Question (IMPORTANT!)

The system comes with a default security question. You should immediately change this to a custom question:

1. Log in as Admin
2. Navigate to **⚙️ Settings**
3. Find **🔐 Admin Security Questions** section
4. Click **"Update Security Question"**
5. Choose a question you'll remember or create a custom one
6. Enter an answer that only you would know
7. Click **"Save Security Question"**

## Files Installed

### Backend API
- **Path:** `/backend/api/admin_security_questions.php`
- **Actions:** 
  - `get-admin-questions` - Retrieve admin's current question
  - `set-security-question` - Update admin's question
  - `get-predefined-questions` - List available questions

### Frontend
- **Updated:** `/frontend/index.html`
  - Added Security Questions section in Settings
  - Shows current question status with update option
  - Custom question creation option

- **Updated:** `/frontend/js/script.js`
  - `loadAdminSecurityQuestions()` - Load questions interface
  - `loadPredefinedSecurityQuestions()` - Load predefined list
  - `showAdminSecurityQuestionForm()` - Show question form
  - `toggleCustomQuestion()` - Toggle custom question input
  - `saveAdminSecurityQuestion()` - Save new question
  - `cancelAdminSecurityQuestion()` - Cancel editing

### Database Scripts
- **Migration:** `/database/setup_admin_security_questions.php`
- **SQL Script:** `/database/add_admin_security_questions.sql`

### Documentation
- **Main Guide:** `/ADMIN_SECURITY_QUESTIONS_GUIDE.md`
- **This File:** `/ADMIN_SECURITY_QUESTIONS_INSTALLATION.md`

## Features Enabled

✅ **Set Security Question** - Admin can choose from 20 predefined questions or create custom ones
✅ **Update Question Anytime** - Change security question whenever needed from Settings
✅ **Password Reset** - Forgot password link on login page uses security question
✅ **Token-Based Reset** - 15-minute temporary tokens for password reset
✅ **Secure Storage** - Answers stored in database for verification

## How It Works

### For the Admin User
1. Set a security question and answer in Settings
2. If password is forgotten, use "Forgot Password?" on login page
3. Answer the security question correctly
4. Set a new password within 15 minutes

### For the System
1. Security question is stored in `users.security_question`
2. Answer is stored in `users.security_answer` (cleartext for matching)
3. Reset process creates temporary tokens in `users.reset_token` and `users.reset_token_expiry`
4. Token expires after 15 minutes for security

## Integration with Existing Features

### Password Reset Flow
The security questions integrate with the existing password reset system:
1. Admin visits forgot password page
2. Enters username/email
3. System retrieves their security question
4. Admin answers the question
5. If correct, system generates 15-minute reset token
6. Admin sets new password with valid token
7. Token is automatically destroyed

### Available to Login Users
- **Reset Token Column:** Already exists in database
- **Reset Token Expiry Column:** Already exists in database
- **Forgot Password Endpoint:** `/backend/api/forgot_password.php`
- **Security Question Answer:** Matched case-insensitively

## Testing the Feature

### Manual Testing Steps

1. **Test Setting Question:**
   - Log in as admin
   - Go to Settings → Admin Security Questions
   - Set a new question and answer
   - Verify success message
   - Refresh page and verify it's saved

2. **Test Password Reset Flow:**
   - Log out
   - Click "Forgot Password?" on login page
   - Enter admin username
   - Answer the security question correctly
   - Create new password
   - Log in with new password

3. **Test Invalid Answer:**
   - Click "Forgot Password?" again
   - Enter wrong answer to security question
   - Should see "Incorrect security answer" error

4. **Test Token Expiry:**
   - Start password reset
   - Answer security question
   - Wait more than 15 minutes
   - Try to reset password
   - Should see "Reset token has expired" error

## Important Notes

⚠️ **Default Question:** The system sets a default question "What was the name of your first pet?" with answer "fluffy". **Change this immediately** to your own private question!

⚠️ **Security:** Don't use publicly available information as answers (like information from social media profiles)

⚠️ **Remember Your Answer:** The answer must match exactly (case-insensitive) what you entered. Write it down securely.

⚠️ **Token Expiry:** Reset tokens are only valid for 15 minutes. If you don't reset your password in time, you must start over.

## Troubleshooting

### Security Questions Not Showing in Settings
- Verify you're logged in as Admin user
- Check browser console (F12) for errors
- Verify API endpoint exists at `/backend/api/admin_security_questions.php`

### "Method not allowed" Error
- Ensure the backend API file is in the correct location
- Verify PHP is properly configured
- Check file permissions

### Database Errors
- Verify database has required columns: `security_question`, `security_answer`, `reset_token`, `reset_token_expiry`
- Run the migration script again
- Check database user has UPDATE privileges

### Password Reset Not Working
- Verify current security question is set
- Check that answer matches exactly (spaces are significant)
- Ensure token hasn't expired (15 minute limit)
- Check browser console for API errors

## Support & Documentation

For more detailed information, see:
- **User Guide:** `/ADMIN_SECURITY_QUESTIONS_GUIDE.md`
- **Forgot Password System:** `/IMPLEMENT_PASSWORD_RESET.md`
- **System Architecture:** `/SYSTEM_ARCHITECTURE_DIAGRAMS.md`

## Rollback Instructions

If you need to remove this feature:

1. Remove the security questions section from HTML
2. Delete the backend API file
3. Reset admin user columns in database:
   ```sql
   UPDATE users 
   SET security_question = NULL, security_answer = NULL 
   WHERE username = 'admin' AND role = 'Admin';
   ```
4. Refresh browser cache

## Success Indicators

After installation, you should see:
- ✅ Settings page loads without errors
- ✅ Security Questions section visible to admin user
- ✅ Predefined questions load in dropdown
- ✅ Current question displays if already set
- ✅ Can set and update security questions
- ✅ Forgot password flow works with questions

---

**Installation Date:** March 3, 2026
**System Version:** CPMR Library v1.0
**Admin Feature:** Built-in Password Recovery with Security Questions
