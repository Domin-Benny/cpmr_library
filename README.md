# CPMR Library Management System

A comprehensive library management system for the Centre for Plant Medicine Research (CPMR).

## 🏗️ Project Structure

```
cpmr_library/
├── config/                  # Configuration files
│   └── database.php        # Database connection configuration
│
├── backend/                 # Backend/API code
│   ├── api/                # REST API endpoints
│   │   ├── auth*.php       # Authentication endpoints
│   │   ├── books.php       # Book management
│   │   ├── categories.php  # Category management
│   │   ├── members.php     # Member management
│   │   ├── borrowing.php   # Borrowing/return operations
│   │   ├── journals.php    # Journal management
│   │   ├── reports.php     # Report generation
│   │   └── ...            # Other API endpoints
│   ├── includes/           # Backend utilities and helpers
│   │   └── functions.php   # Helper functions
│   └── uploads/            # User uploaded files
│       ├── book_covers/    # Book cover images
│       ├── journals/       # Journal files
│       └── policies/       # Policy documents
│
├── frontend/                # Frontend application
│   ├── index.html          # Main application entry point
│   ├── preview_profile.html # Profile preview page
│   ├── service-worker.js   # PWA service worker
│   ├── css/                # Stylesheets
│   │   ├── style.css       # Main styles
│   │   ├── modern-design.css # Modern UI design
│   │   └── dashboard-redesign.css # Dashboard styles
│   ├── js/                 # JavaScript files
│   │   └── script.js       # Main application logic
│   └── images/             # Frontend images
│       ├── book-covers/    # Default book covers
│       ├── journal-covers/ # Journal cover images
│       ├── logos/          # Logo files
│       ├── login-backgrounds/ # Login page backgrounds
│       ├── policy-covers/  # Policy document covers
│       └── profile-pictures/ # User profile pictures
│
├── database/                # Database scripts
│   ├── cpmr_library.sql    # Main database schema
│   ├── migrations/         # Database migration scripts
│   └── seeds/              # Database seed data
│
├── scripts/                 # Utility and maintenance scripts
│   └── *.php               # Database migration and setup scripts
│
├── docs/                    # Documentation
│   ├── ADMIN_PROTECTION_GUIDE.md
│   ├── ADMIN_SECURITY_QUESTIONS_GUIDE.md
│   ├── DATABASE_ADMIN_PROTECTION_GUIDE.md
│   ├── IMPLEMENT_PASSWORD_RESET.md
│   ├── MIGRATION_GUIDE.md
│   └── ...                 # Other documentation
│
├── css/                     # Legacy/root stylesheets
│   └── style.css
│
├── js/                      # Legacy/root JavaScript
│   └── script.js
│
├── images/                  # Root images (legacy)
│   └── profile_pictures/   # Additional profile pictures
│
├── .htaccess               # Apache configuration
├── package.json            # Node.js dependencies
└── README.md               # This file
```

## 🚀 Features

### Core Functionality
- **Book Management** - Add, edit, delete, and categorize books
- **Member Management** - Manage library members and user accounts
- **Borrowing System** - Track book borrowings and returns
- **Journal Archive** - Digital journal repository with search capabilities
- **Policy Management** - Store and manage institutional policies
- **Reporting** - Generate monthly and custom reports
- **User Authentication** - Secure login with role-based access control

### User Roles
- **Admin** - Full system access with administrative controls
- **Librarian** - Manage library operations and resources
- **Staff/User** - Limited access for browsing and borrowing

### Technical Features
- Responsive design for all devices
- Offline support via Service Worker (PWA)
- Real-time notifications
- Advanced search and filtering
- Data export capabilities
- Customizable login interface

## 🛠️ Technology Stack

### Frontend
- HTML5, CSS3, JavaScript (ES6+)
- Chart.js for data visualization
- Font Awesome for icons
- Progressive Web App (PWA) features

### Backend
- PHP 7.4+
- MySQL/MariaDB
- RESTful API architecture

### Server
- Apache (XAMPP)
- mod_rewrite enabled

## 📋 Prerequisites

- XAMPP (Apache + MySQL + PHP 7.4+)
- Modern web browser (Chrome, Firefox, Edge, Safari)
- Text editor or IDE (VS Code recommended)

## ⚙️ Installation

### 1. Clone/Copy Project
```bash
# Copy project to your web server directory
# For XAMPP: C:\xampp\htdocs\cpmr_library
```

### 2. Database Setup
```bash
# Import the main database schema
# Using phpMyAdmin or MySQL CLI:
mysql -u root -p cpmr_library < database/cpmr_library.sql
```

### 3. Configure Database Connection
Edit `config/database.php`:
```php
<?php
$host = 'localhost';
$dbname = 'cpmr_library';
$username = 'root';
$password = ''; // Your MySQL password
?>
```

### 4. Set Permissions
Ensure the `backend/uploads/` directory is writable:
```bash
# On Linux/Mac:
chmod -R 755 backend/uploads/
chown -R www-data:www-data backend/uploads/
```

### 5. Access Application
Navigate to: `http://localhost/cpmr_library/frontend/`

## 🔧 Configuration

### Environment Variables
Copy and configure environment settings if needed.

### Apache Configuration
The `.htaccess` file handles URL rewriting and security headers.

## 📚 Usage Guide

### Admin Dashboard
1. Login with admin credentials
2. Access system settings from the sidebar
3. Manage users, books, journals, and policies
4. Generate reports and analytics

### Librarian Operations
1. Add new books with covers
2. Process borrowings and returns
3. Manage member accounts
4. Upload journals and policies

### Staff/User Access
1. Browse available books by category
2. Search and filter resources
3. View borrowing history
4. Download journals and policies

## 🗂️ Database Schema

### Main Tables
- `books` - Book catalog and metadata
- `categories` - Book categories
- `members` - Library members
- `users` - System users
- `borrowing_records` - Borrowing transactions
- `journals` - Journal archive
- `policies` - Policy documents
- `notifications` - User notifications

## 🔒 Security Features

- Password hashing with bcrypt
- SQL injection prevention via prepared statements
- XSS protection through input sanitization
- CSRF token validation
- Role-based access control (RBAC)
- Session management
- Admin protection with security questions

## 🐛 Troubleshooting

### Common Issues

**Database Connection Failed**
- Verify MySQL is running in XAMPP
- Check database credentials in `config/database.php`
- Ensure database `cpmr_library` exists

**Images Not Loading**
- Check file paths are correct
- Verify `backend/uploads/` permissions
- Clear browser cache (Ctrl+F5)

**API Errors**
- Check Apache error logs
- Verify `.htaccess` is enabled
- Ensure mod_rewrite is enabled

## 📝 Development

### Adding New Features
1. Create API endpoint in `backend/api/`
2. Add frontend logic in `frontend/js/script.js`
3. Update database schema if needed
4. Test thoroughly before deployment

### Code Style
- Follow PSR-12 for PHP code
- Use ES6+ standards for JavaScript
- Maintain responsive design patterns

## 🤝 Contributing

1. Fork the repository
2. Create feature branch
3. Make changes
4. Test thoroughly
5. Submit pull request

## 📄 License

This project is proprietary software developed for CPMR.

## 👥 Support

For issues and questions:
- Check documentation in `/docs`
- Review error logs
- Contact system administrator

## 🎯 Future Enhancements

- [ ] Email notifications
- [ ] Barcode scanning integration
- [ ] Advanced analytics dashboard
- [ ] Mobile app integration
- [ ] Multi-language support
- [ ] Automated backups

---

**Version:** 1.0  
**Last Updated:** March 2026  
**Developed for:** Centre for Plant Medicine Research (CPMR)
