-- =============================================
-- CPMR Library Management System Database
-- File: database/cpmr_library.sql
-- Description: Complete database schema with sample data
-- =============================================

-- Create database
CREATE DATABASE IF NOT EXISTS cpmr_library;
USE cpmr_library;

-- Table: Users (for authentication)
CREATE TABLE users (
    user_id INT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    role ENUM('Admin', 'Librarian', 'Staff', 'Student', 'Other') DEFAULT 'Staff',
    status ENUM('Active', 'Inactive', 'Suspended') DEFAULT 'Active',
    last_login DATETIME,
    phone VARCHAR(20),
    institution VARCHAR(255),
    department VARCHAR(255),
    program VARCHAR(255),
    id_number VARCHAR(50),
    id_type VARCHAR(50),
    security_question VARCHAR(255),
    security_answer VARCHAR(255),
    reset_token VARCHAR(255) DEFAULT NULL,
    reset_token_expiry DATETIME DEFAULT NULL,
    profile_picture VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Table: Categories
CREATE TABLE categories (
    category_id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table: Books
CREATE TABLE books (
    book_id INT PRIMARY KEY AUTO_INCREMENT,
    title VARCHAR(255) NOT NULL,
    author VARCHAR(255) NOT NULL,
    isbn VARCHAR(20) UNIQUE,
    category_id INT,
    publication_year YEAR,
    publisher VARCHAR(255),
    description TEXT,
    total_copies INT DEFAULT 1,
    available_copies INT DEFAULT 1,
    status ENUM('Available', 'Borrowed', 'Reserved', 'Maintenance') DEFAULT 'Available',
    added_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES categories(category_id) ON DELETE SET NULL,
    FOREIGN KEY (added_by) REFERENCES users(user_id) ON DELETE SET NULL
);

-- Table: Members
CREATE TABLE members (
    member_id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    phone VARCHAR(20),
    membership_type ENUM('Researcher', 'Faculty', 'Student', 'External') DEFAULT 'Researcher',
    department VARCHAR(100),
    staff_id VARCHAR(50),
    address TEXT,
    status ENUM('Active', 'Inactive', 'Suspended') DEFAULT 'Active',
    join_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Table: Borrowing Records
CREATE TABLE borrowing_records (
    record_id INT PRIMARY KEY AUTO_INCREMENT,
    member_id INT NOT NULL,
    book_id INT NOT NULL,
    borrow_date DATE NOT NULL,
    due_date DATE NOT NULL,
    return_date DATE,
    status ENUM('Active', 'Returned', 'Overdue') DEFAULT 'Active',
    late_fee DECIMAL(10,2) DEFAULT 0.00,
    return_condition ENUM('Good', 'Fair', 'Damaged', 'Lost') DEFAULT 'Good',
    notes TEXT,
    created_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (member_id) REFERENCES members(member_id) ON DELETE CASCADE,
    FOREIGN KEY (book_id) REFERENCES books(book_id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(user_id) ON DELETE SET NULL
);

-- Table: System Settings
CREATE TABLE system_settings (
    setting_id INT PRIMARY KEY AUTO_INCREMENT,
    setting_key VARCHAR(50) UNIQUE NOT NULL,
    setting_value TEXT,
    description TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Table: Audit Log
CREATE TABLE audit_log (
    log_id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT,
    action VARCHAR(50) NOT NULL,
    table_name VARCHAR(50),
    record_id INT,
    details TEXT,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE SET NULL
);

-- =============================================
-- INSERT SAMPLE DATA
-- =============================================

-- Insert default admin user (password: admin123)
INSERT INTO users (username, password_hash, name, email, role, status) VALUES
('admin', '$2y$10$4xe7/KTHV3mDyfAnq0TLhO33bAuei2dSyW8eHwuOVHkCdgVdLe/cm', 'Administrator', 'admin@cpmr.edu', 'Admin', 'Active'),
('librarian', '$2y$10$4xe7/KTHV3mDyfAnq0TLhO33bAuei2dSyW8eHwuOVHkCdgVdLe/cm', 'Library Staff', 'librarian@cpmr.edu', 'Librarian', 'Active'),
('staff', '$2y$10$4xe7/KTHV3mDyfAnq0TLhO33bAuei2dSyW8eHwuOVHkCdgVdLe/cm', 'Library Staff', 'staff@cpmr.edu', 'Staff', 'Active'),
('student', '$2y$10$4xe7/KTHV3mDyfAnq0TLhO33bAuei2dSyW8eHwuOVHkCdgVdLe/cm', 'Library Student', 'student@cpmr.edu', 'Student', 'Active');

-- Note: Replace $2y$10$YourHashedPasswordHere with actual bcrypt hash of 'admin123'

-- Insert categories
INSERT INTO categories (name, description) VALUES
('Herbology', 'Study of medicinal plants and herbs'),
('Phytochemistry', 'Chemical compounds derived from plants'),
('Ethnobotany', 'Relationship between people and plants'),
('Traditional Medicine', 'Indigenous healing practices'),
('Pharmacology', 'Drug action and effects'),
('Research', 'Research methodologies and findings'),
('Clinical Studies', 'Clinical research and efficacy studies'),
('Toxicology', 'Toxicological studies and safety');

-- Insert sample books
INSERT INTO books (title, author, isbn, category_id, publication_year, publisher, description, total_copies, available_copies, status) VALUES
('Medicinal Plants of Asia', 'Dr. James Wilson', '978-0123456789', 1, 2022, 'Academic Press', 'Comprehensive guide to medicinal plants found in Asia', 3, 3, 'Available'),
('Modern Ethnobotany', 'Prof. Sarah Chen', '978-0987654321', 3, 2021, 'Springer', 'Contemporary approaches to ethnobotanical research', 2, 1, 'Available'),
('Phytochemistry Handbook', 'Dr. Michael Rodriguez', '978-1122334455', 2, 2020, 'Wiley', 'Reference guide to plant chemical compounds', 4, 4, 'Available'),
('Traditional Medicine Practices', 'Dr. Amina Okonkwo', '978-5566778899', 4, 2023, 'Elsevier', 'Traditional healing practices from around the world', 2, 2, 'Available'),
('Plant Biology Research Methods', 'Prof. Lisa Anderson', '978-6677889900', 6, 2021, 'Cambridge Press', 'Research methodologies in plant biology', 5, 5, 'Available');

-- Insert sample members
INSERT INTO members (name, email, phone, membership_type, department, staff_id, address, status, join_date) VALUES
('Dr. Robert Smith', 'r.smith@cpmr.edu', '+233 24 123 4567', 'Researcher', 'Research Department', 'RS001', 'CPMR Campus, Mampong-Akwapim', 'Active', '2025-03-15'),
('Prof. Emma Davis', 'e.davis@cpmr.edu', '+233 24 234 5678', 'Faculty', 'Faculty of Science', 'ED001', 'CPMR Campus, Mampong-Akwapim', 'Active', '2025-05-22'),
('Dr. Thomas Mueller', 't.mueller@cpmr.edu', '+233 24 345 6789', 'Researcher', 'Research Department', 'TM001', 'CPMR Campus, Mampong-Akwapim', 'Active', '2025-07-10');

-- Insert sample borrowing records
INSERT INTO borrowing_records (member_id, book_id, borrow_date, due_date, status, created_by) VALUES
(2, 2, '2026-01-10', '2026-01-24', 'Active', 1),
(1, 1, '2026-01-15', '2026-02-15', 'Active', 1);

-- Insert default system settings
INSERT INTO system_settings (setting_key, setting_value, description) VALUES
('library_name', 'CPMR Library', 'Name of the library'),
('max_borrow_days', '30', 'Maximum number of days a book can be borrowed'),
('max_books_per_member', '5', 'Maximum number of books a member can borrow at once'),
('late_fee_per_day', '0.50', 'Late fee charged per day for overdue books'),
('enable_email_reminders', 'yes', 'Whether to send email reminders for due dates'),
('reminder_days_before', '3', 'Number of days before due date to send reminder');

-- =============================================
-- CREATE INDEXES FOR PERFORMANCE
-- =============================================

CREATE INDEX idx_books_title ON books(title);
CREATE INDEX idx_books_author ON books(author);
CREATE INDEX idx_books_category ON books(category_id);
CREATE INDEX idx_books_status ON books(status);

CREATE INDEX idx_members_email ON members(email);
CREATE INDEX idx_members_name ON members(name);
CREATE INDEX idx_members_status ON members(status);

CREATE INDEX idx_borrowing_member ON borrowing_records(member_id);
CREATE INDEX idx_borrowing_book ON borrowing_records(book_id);
CREATE INDEX idx_borrowing_status ON borrowing_records(status);
CREATE INDEX idx_borrowing_dates ON borrowing_records(borrow_date, due_date, return_date);

CREATE INDEX idx_audit_user ON audit_log(user_id);
CREATE INDEX idx_audit_action ON audit_log(action);
CREATE INDEX idx_audit_created ON audit_log(created_at);

-- Table: Requests (for book borrow/reservation requests)
CREATE TABLE requests (
    request_id INT PRIMARY KEY AUTO_INCREMENT,
    requester_user_id INT NOT NULL,
    book_id INT NOT NULL,
    requested_days INT DEFAULT 14,
    message TEXT,
    status ENUM('Pending', 'Approved', 'Declined') DEFAULT 'Pending',
    decided_by INT,
    decided_at DATETIME,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (requester_user_id) REFERENCES users(user_id) ON DELETE SET NULL,
    FOREIGN KEY (book_id) REFERENCES books(book_id) ON DELETE CASCADE,
    FOREIGN KEY (decided_by) REFERENCES users(user_id) ON DELETE SET NULL
);

-- =============================================
-- CREATE VIEWS FOR REPORTING
-- =============================================

-- View: Books with category information
CREATE VIEW vw_books_with_categories AS
SELECT 
    b.book_id,
    b.title,
    b.author,
    b.isbn,
    c.name as category_name,
    c.category_id,
    b.publication_year,
    b.publisher,
    b.description,
    b.total_copies,
    b.available_copies,
    b.status,
    b.created_at
FROM books b
LEFT JOIN categories c ON b.category_id = c.category_id;

-- View: Current borrowing records with member and book details
CREATE VIEW vw_current_borrowings AS
SELECT 
    br.record_id,
    br.member_id,
    m.name as member_name,
    m.email as member_email,
    br.book_id,
    b.title as book_title,
    b.author as book_author,
    br.borrow_date,
    br.due_date,
    br.return_date,
    br.status,
    br.late_fee,
    DATEDIFF(CURDATE(), br.due_date) as days_overdue
FROM borrowing_records br
JOIN members m ON br.member_id = m.member_id
JOIN books b ON br.book_id = b.book_id
WHERE br.status = 'Active';

-- View: Category statistics
CREATE VIEW vw_category_stats AS
SELECT 
    c.category_id,
    c.name as category_name,
    c.description,
    COUNT(b.book_id) as total_books,
    SUM(b.total_copies) as total_copies,
    SUM(b.available_copies) as available_copies
FROM categories c
LEFT JOIN books b ON c.category_id = b.category_id
GROUP BY c.category_id, c.name, c.description;

-- View: Member borrowing history
CREATE VIEW vw_member_borrowing_history AS
SELECT 
    m.member_id,
    m.name,
    m.email,
    m.membership_type,
    COUNT(br.record_id) as total_borrowed,
    SUM(CASE WHEN br.status = 'Active' THEN 1 ELSE 0 END) as currently_borrowed,
    SUM(br.late_fee) as total_late_fees
FROM members m
LEFT JOIN borrowing_records br ON m.member_id = br.member_id
GROUP BY m.member_id, m.name, m.email, m.membership_type;

-- =============================================
-- CREATE STORED PROCEDURES
-- =============================================

-- Procedure: Borrow a book
DELIMITER //
CREATE PROCEDURE sp_borrow_book(
    IN p_member_id INT,
    IN p_book_id INT,
    IN p_borrow_days INT,
    IN p_created_by INT
)
BEGIN
    DECLARE v_available_copies INT;
    DECLARE v_due_date DATE;
    
    -- Check if book is available
    SELECT available_copies INTO v_available_copies 
    FROM books WHERE book_id = p_book_id;
    
    IF v_available_copies > 0 THEN
        -- Calculate due date
        SET v_due_date = DATE_ADD(CURDATE(), INTERVAL p_borrow_days DAY);
        
        -- Create borrowing record
        INSERT INTO borrowing_records 
        (member_id, book_id, borrow_date, due_date, created_by)
        VALUES (p_member_id, p_book_id, CURDATE(), v_due_date, p_created_by);
        
        -- Update book availability
        UPDATE books 
        SET available_copies = available_copies - 1,
            status = CASE 
                WHEN (available_copies - 1) = 0 THEN 'Borrowed' 
                ELSE status 
            END
        WHERE book_id = p_book_id;
        
        SELECT 'Success' as result, 'Book borrowed successfully' as message;
    ELSE
        SELECT 'Error' as result, 'Book is not available' as message;
    END IF;
END//
DELIMITER ;

-- Procedure: Return a book
DELIMITER //
CREATE PROCEDURE sp_return_book(
    IN p_record_id INT,
    IN p_return_condition VARCHAR(20),
    IN p_notes TEXT
)
BEGIN
    DECLARE v_book_id INT;
    DECLARE v_due_date DATE;
    DECLARE v_days_late INT;
    DECLARE v_late_fee DECIMAL(10,2);
    DECLARE v_late_fee_per_day DECIMAL(10,2);
    
    -- Get book details
    SELECT book_id, due_date INTO v_book_id, v_due_date
    FROM borrowing_records WHERE record_id = p_record_id;
    
    -- Calculate days late
    SET v_days_late = GREATEST(0, DATEDIFF(CURDATE(), v_due_date));
    
    -- Get late fee per day from settings
    SELECT CAST(setting_value AS DECIMAL(10,2)) INTO v_late_fee_per_day
    FROM system_settings WHERE setting_key = 'late_fee_per_day';
    
    -- Calculate late fee
    SET v_late_fee = v_days_late * v_late_fee_per_day;
    
    -- Update borrowing record
    UPDATE borrowing_records 
    SET return_date = CURDATE(),
        status = 'Returned',
        return_condition = p_return_condition,
        late_fee = v_late_fee,
        notes = p_notes
    WHERE record_id = p_record_id;
    
    -- Update book availability
    UPDATE books 
    SET available_copies = available_copies + 1,
        status = CASE 
            WHEN available_copies + 1 > 0 THEN 'Available' 
            ELSE status 
        END
    WHERE book_id = v_book_id;
    
    SELECT 'Success' as result, 'Book returned successfully' as message, v_late_fee as late_fee;
END//
DELIMITER ;

-- Procedure: Get dashboard statistics
DELIMITER //
CREATE PROCEDURE sp_get_dashboard_stats()
BEGIN
    -- Total books (sum of copies)
    SELECT SUM(total_copies) as total_books FROM books;
    
    -- Total members
    SELECT COUNT(*) as total_members FROM members WHERE status = 'Active';
    
    -- Books borrowed (active borrowing records)
    SELECT COUNT(*) as books_borrowed FROM borrowing_records WHERE status = 'Active';
    
    -- Overdue books
    SELECT COUNT(*) as overdue_books 
    FROM borrowing_records 
    WHERE status = 'Active' AND due_date < CURDATE();
    
    -- Recent books (last 30 days)
    SELECT COUNT(*) as recent_books 
    FROM books 
    WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY);
    
    -- Recent members (last 30 days)
    SELECT COUNT(*) as recent_members 
    FROM members 
    WHERE join_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY);
END//
DELIMITER ;

-- =============================================
-- CREATE TRIGGERS
-- =============================================

-- Trigger: Update book status when all copies are borrowed
DELIMITER //
CREATE TRIGGER trg_update_book_status
BEFORE UPDATE ON books
FOR EACH ROW
BEGIN
    IF NEW.available_copies = 0 THEN
        SET NEW.status = 'Borrowed';
    ELSEIF NEW.available_copies > 0 AND OLD.status = 'Borrowed' THEN
        SET NEW.status = 'Available';
    END IF;
END//
DELIMITER ;

-- Trigger: Log user actions
DELIMITER //
CREATE TRIGGER trg_audit_user_changes
AFTER UPDATE ON users
FOR EACH ROW
BEGIN
    INSERT INTO audit_log (user_id, action, table_name, record_id, details)
    VALUES (NEW.user_id, 'UPDATE', 'users', NEW.user_id,
            CONCAT('Updated user: ', OLD.username, ' → ', NEW.username));
END//
DELIMITER ;

-- Trigger: Log book additions
DELIMITER //
CREATE TRIGGER trg_audit_book_additions
AFTER INSERT ON books
FOR EACH ROW
BEGIN
    INSERT INTO audit_log (user_id, action, table_name, record_id, details)
    VALUES (NEW.added_by, 'INSERT', 'books', NEW.book_id,
            CONCAT('Added book: ', NEW.title));
END//
DELIMITER ;

-- =============================================
-- CREATE FUNCTIONS
-- =============================================

-- Function: Calculate overdue days
DELIMITER //
CREATE FUNCTION fn_calculate_overdue_days(p_due_date DATE)
RETURNS INT
DETERMINISTIC
BEGIN
    DECLARE v_days INT;
    SET v_days = DATEDIFF(CURDATE(), p_due_date);
    RETURN GREATEST(0, v_days);
END//
DELIMITER ;

-- Function: Get member borrowing count
DELIMITER //
CREATE FUNCTION fn_get_member_borrowing_count(p_member_id INT)
RETURNS INT
READS SQL DATA
BEGIN
    DECLARE v_count INT;
    SELECT COUNT(*) INTO v_count
    FROM borrowing_records
    WHERE member_id = p_member_id AND status = 'Active';
    RETURN v_count;
END//
DELIMITER ;