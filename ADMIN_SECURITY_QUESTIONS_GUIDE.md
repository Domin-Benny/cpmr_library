# Admin Security Questions & Password Reset Guide

## Overview
The CPMR Library Management System now includes a built-in password reset mechanism for the admin user using security questions. This allows the admin to recover their password if forgotten without needing direct database access.

## Features

### 1. **Security Question Management**
- Set custom or predefined security questions
- Update questions at any time from Settings page
- Case-insensitive answer matching for ease of use
- Simple and intuitive interface

### 2. **Password Reset Process**
Three-step process to reset forgotten password:
- **Step 1:** User identifies account by username/email
- **Step 2:** User answers security question correctly
- **Step 3:** User sets a new password

### 3. **Security Measures**
- ✅ Temporary reset tokens (valid for 15 minutes)
- ✅ Single-use tokens
- ✅ Bcrypt password hashing
- ✅ Secure token generation

## How to Set Your Security Question

### First Time Setup
1. Log in to the Admin Dashboard
2. Navigate to **⚙️ Settings** (in the main navigation menu)
3. Scroll down to **🔐 Admin Security Questions** section
4. Click **"Set Security Question"** button
5. Choose a question from the predefined list or click **Custom** to create your own
6. Enter your answer (should be memorable and not easily guessable)
7. Click **"Save Security Question"**

### Predefined Security Questions Available
- In what city were you born?
- What is your mother's maiden name?
- What was the name of your first pet?
- What is your favorite book?
- What was the name of your first school?
- What is your favorite movie?
- What street did you live on in third grade?
- What is your favorite sports team?
- What is the name of your best friend?
- In what city or town did your mother and father meet?
- What is your favorite food?
- What is your favorite color?
- What is the name of your first crush?
- What was your childhood phone number (including area code)?
- On what date was your mother born?
- What is the name of a college you applied to but did not attend?
- What is your favorite holiday?
- What is the brand of your first car?
- What is your favorite artist or band?
- What high school did you attend?

### Creating a Custom Question
If none of the predefined questions suit you:
1. Click the **✏️ Custom** button
2. Enter your custom question (minimum 5 characters)
3. Enter your answer
4. Click **"Save Security Question"**

### Updating Your Security Question
1. Go to Settings → Admin Security Questions
2. Click **"Update Security Question"** button
3. Select or create a new question
4. Enter your answer
5. Click **"Save Security Question"**

## How to Reset Your Password (If Forgotten)

### From the Login Page
1. Click **"Forgot Password?"** link below the login form
2. Enter your username or email address
3. Click **"Next"**
4. You'll see your security question
5. Enter your answer correctly
6. If correct, you'll proceed to Step 3
7. Enter your new password (minimum 6 characters)
8. Confirm the new password
9. Click **"Reset Password"**
10. You're now ready to log in with your new password

### Important Notes
- The reset token is **valid for only 15 minutes**
- You must answer the security question **correctly** (case-insensitive but content must match)
- Your answer should be exactly as you set it during initial setup
- After successfully resetting your password, the reset token is automatically deleted for security

## Security Best Practices

### Do's
✅ Choose security questions with answers only you would know
✅ Use specific, memorable answers
✅ Update your security question if you've shared the answer with someone
✅ Change your password regularly
✅ Write down your security question and answer in a secure location (password manager)

### Don'ts
❌ Don't use publicly available information as answers (birthplace, famous people, etc.)
❌ Don't share your security question and answer with others
❌ Don't use obvious answers (pet names from social media, etc.)
❌ Don't forget your answer - it's needed for password recovery
❌ Don't use the same answer for multiple security questions

## Default Security Question

When you first access the system, a default security question is set:
- **Question:** "What was the name of your first pet?"
- **Answer:** "fluffy"

**⚠️ IMPORTANT:** You should immediately change this default to your own custom question for security!

## API Endpoints (For Developers)

### Get Admin Security Questions
```
POST /backend/api/admin_security_questions.php
{
    "action": "get-admin-questions",
    "user_id": 1
}
```

### Set Security Question
```
POST /backend/api/admin_security_questions.php
{
    "action": "set-security-question",
    "user_id": 1,
    "security_question": "Your custom question?",
    "security_answer": "your answer"
}
```

### Get Predefined Questions
```
GET /backend/api/admin_security_questions.php?action=get-predefined-questions
```

## Troubleshooting

### "Incorrect security answer" Error
- The answer is case-insensitive, but must match exactly what you entered
- Make sure you're entering the exact answer you saved
- Check for leading/trailing spaces in your answer

### "Reset token has expired" Error
- The token is only valid for 15 minutes
- Start the password reset process again
- Click "Forgot Password?" and begin from Step 1

### "Cannot find admin questions" or "Security question not set"
- Your security question hasn't been set up yet
- Log in with your current credentials
- Go to Settings and set up your security question

## Database Schema

The following columns are used:
- `security_question` VARCHAR(255) - The security question
- `security_answer` VARCHAR(255) - The answer to the question
- `reset_token` VARCHAR(255) - Temporary token for password reset
- `reset_token_expiry` DATETIME - When the reset token expires

## File Locations

### Backend
- `/backend/api/admin_security_questions.php` - Security questions management API
- `/database/setup_admin_security_questions.php` - Initial setup script

### Frontend
- `/frontend/index.html` - Admin settings page contains security questions section
- `/frontend/js/script.js` - JavaScript functions for managing questions

### Database
- `/database/add_admin_security_questions.sql` - SQL migration script

## Getting Help

If you encounter issues:
1. Check the browser console (F12) for error messages
2. Verify that your security question is set in Settings → Admin Security Questions
3. Ensure the answer matches exactly what you entered
4. Check that the system isn't in offline mode
5. Contact your system administrator if problems persist

## Security Incident Response

If you suspect someone knows your security question:
1. Log in with your current password
2. Go to Settings → Admin Security Questions
3. Update to a completely new question
4. Save the new question
5. Consider changing your password as well

---

**Last Updated:** March 3, 2026
**System:** CPMR Library Management System v1.0
