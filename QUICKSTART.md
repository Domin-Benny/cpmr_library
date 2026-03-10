# Quick Start Guide - CPMR Library System

## 🚀 Get Started in 5 Minutes

### Step 1: Verify Prerequisites
Ensure you have XAMPP installed with:
- Apache running
- MySQL running
- PHP 7.4+ enabled

### Step 2: Database Setup
1. Open phpMyAdmin: `http://localhost/phpmyadmin`
2. Create new database named `cpmr_library`
3. Import the schema:
   - Click "Import" tab
   - Choose file: `database/cpmr_library.sql`
   - Click "Go"

### Step 3: Configure Database Connection
Open `config/database.php` and verify settings:
```php
$host = 'localhost';
$dbname = 'cpmr_library';
$username = 'root';
$password = ''; // Default XAMPP has no password
```

### Step 4: Set File Permissions (if on Linux/Mac)
```bash
chmod -R 755 backend/uploads/
chown -R www-data:www-data backend/uploads/
```

### Step 5: Launch Application
Open your browser and navigate to:
```
http://localhost/cpmr_library/frontend/
```

## 🔐 Default Login Credentials

**Admin Account:**
- Username: `admin`
- Password: Check with system administrator or see database seed data

**Note:** If this is a fresh installation, you may need to create an admin user directly in the database.

## 📁 Project Organization

```
cpmr_library/
├── config/              → Database & app configuration
├── backend/api/         → API endpoints
├── frontend/            → Main application
│   ├── index.html      → Entry point
│   ├── css/            → Stylesheets
│   └── js/             → JavaScript logic
├── database/            → SQL schemas & migrations
├── backend/uploads/     → User files (book covers, journals)
└── docs/                → Documentation
```

## ✅ Verify Installation

Check these items to ensure everything works:

1. **Database Connection**
   - Can you access phpMyAdmin?
   - Is `cpmr_library` database created?
   - Are tables visible?

2. **File Access**
   - Can you open `frontend/index.html`?
   - Are CSS and JS files loading?
   - No 404 errors in browser console?

3. **Login Test**
   - Try logging in with credentials
   - Does dashboard load successfully?
   - Are all menu items visible?

## 🐛 Common Issues

### Issue: Cannot Access Application
**Solution:** 
- Verify Apache is running (green checkmark in XAMPP)
- Check URL: `http://localhost/cpmr_library/frontend/`
- Clear browser cache: Ctrl+F5

### Issue: Database Connection Error
**Solution:**
- Check MySQL is running in XAMPP
- Verify database name in `config/database.php`
- Ensure username/password are correct

### Issue: Images Not Loading
**Solution:**
- Check `backend/uploads/` folder exists
- Verify folder permissions (readable by web server)
- Clear browser cache

## 🎯 Next Steps

After successful installation:

1. **Change Default Passwords** - Update all default credentials
2. **Configure Email** (optional) - Set up email notifications
3. **Add Admin Users** - Create administrative accounts
4. **Import Data** - Add initial books, members, journals
5. **Customize Settings** - Configure library policies
6. **Backup Database** - Create initial backup

## 📞 Support

For detailed documentation, see:
- [README.md](../README.md) - Complete project overview
- `/docs/` - Technical guides and tutorials
- [DATABASE_ADMIN_PROTECTION_GUIDE.md](DATABASE_ADMIN_PROTECTION_GUIDE.md) - Security features

## 🔧 Development Tips

### Adding New Books
1. Login as Admin or Librarian
2. Navigate to Books section
3. Click "Add New Book"
4. Fill in details and upload cover image

### Managing Members
1. Access Members from sidebar
2. Add new members or edit existing
3. Track borrowing history

### Generating Reports
1. Go to Reports section
2. Select month and type
3. Download or view analytics

---

**Need Help?** Check the full documentation in `/docs/` folder.

**Version:** 1.0 | **Last Updated:** March 2026
