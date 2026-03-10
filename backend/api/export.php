<?php
// =============================================
// Export API
// File: backend/api/export.php
// Description: Handle PDF, Excel, and CSV exports
// =============================================

header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");

require_once '../config/database.php';
require_once 'auth_helper.php';

// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Check authentication
$user = isAuthenticated();
if (!$user) {
    http_response_code(401);
    echo json_encode([
        'success' => false,
        'message' => 'Authentication required'
    ]);
    exit();
}

$action = isset($_GET['action']) ? $_GET['action'] : '';
$format = isset($_GET['format']) ? $_GET['format'] : 'pdf';

try {
    $database = new Database();
    $conn = $database->getConnection();
    
    switch ($action) {
        case 'books':
            exportBooks($conn, $format);
            break;
        case 'members':
            exportMembers($conn, $format);
            break;
        case 'borrowing':
            exportBorrowing($conn, $format);
            break;
        default:
            http_response_code(400);
            echo json_encode([
                'success' => false,
                'message' => 'Invalid export action'
            ]);
    }
} catch (Exception $e) {
    error_log("Export API error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Export failed: ' . $e->getMessage()
    ]);
} finally {
    if (isset($conn)) {
        $database->closeConnection();
    }
}

function exportBooks($conn, $format) {
    // Get all books data
    $sql = "SELECT 
                b.book_id,
                b.title,
                b.author,
                b.isbn,
                c.name as category,
                b.publication_year,
                b.publisher,
                b.total_copies,
                b.available_copies,
                b.status,
                b.created_at
            FROM books b
            LEFT JOIN categories c ON b.category_id = c.category_id
            ORDER BY b.title";
    
    $stmt = $conn->prepare($sql);
    $stmt->execute();
    $books = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    switch (strtolower($format)) {
        case 'pdf':
            generateBooksPDF($books);
            break;
        case 'excel':
            generateBooksExcel($books);
            break;
        case 'csv':
            generateBooksCSV($books);
            break;
        default:
            http_response_code(400);
            echo json_encode([
                'success' => false,
                'message' => 'Unsupported format'
            ]);
    }
}

function exportMembers($conn, $format) {
    // Get all members data
    $sql = "SELECT 
                member_id,
                name,
                email,
                phone,
                membership_type,
                join_date,
                status
            FROM members
            ORDER BY name";
    
    $stmt = $conn->prepare($sql);
    $stmt->execute();
    $members = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    switch (strtolower($format)) {
        case 'pdf':
            generateMembersPDF($members);
            break;
        case 'excel':
            generateMembersExcel($members);
            break;
        case 'csv':
            generateMembersCSV($members);
            break;
        default:
            http_response_code(400);
            echo json_encode([
                'success' => false,
                'message' => 'Unsupported format'
            ]);
    }
}

function exportBorrowing($conn, $format) {
    // Get borrowing records
    $sql = "SELECT 
                br.record_id,
                m.name as member_name,
                b.title as book_title,
                br.borrow_date,
                br.due_date,
                br.return_date,
                br.status,
                br.late_fee
            FROM borrowing_records br
            JOIN members m ON br.member_id = m.member_id
            JOIN books b ON br.book_id = b.book_id
            ORDER BY br.borrow_date DESC";
    
    $stmt = $conn->prepare($sql);
    $stmt->execute();
    $records = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    switch (strtolower($format)) {
        case 'pdf':
            generateBorrowingPDF($records);
            break;
        case 'excel':
            generateBorrowingExcel($records);
            break;
        case 'csv':
            generateBorrowingCSV($records);
            break;
        default:
            http_response_code(400);
            echo json_encode([
                'success' => false,
                'message' => 'Unsupported format'
            ]);
    }
}

// PDF Generation Functions
function generateBooksPDF($books) {
    // Set headers for PDF download
    header('Content-Type: application/pdf');
    header('Content-Disposition: attachment; filename="books_report_' . date('Y-m-d') . '.pdf"');
    header('Cache-Control: private, max-age=0, must-revalidate');
    header('Pragma: public');
    
    // Simple text-based PDF (in production, use TCPDF or similar library)
    $pdfContent = "CPMR Library - Books Report\n";
    $pdfContent .= "Generated on: " . date('Y-m-d H:i:s') . "\n\n";
    $pdfContent .= str_repeat("=", 50) . "\n\n";
    
    foreach ($books as $book) {
        $pdfContent .= "Title: " . $book['title'] . "\n";
        $pdfContent .= "Author: " . $book['author'] . "\n";
        $pdfContent .= "ISBN: " . $book['isbn'] . "\n";
        $pdfContent .= "Category: " . $book['category'] . "\n";
        $pdfContent .= "Available Copies: " . $book['available_copies'] . "/" . $book['total_copies'] . "\n";
        $pdfContent .= "Status: " . $book['status'] . "\n";
        $pdfContent .= str_repeat("-", 30) . "\n\n";
    }
    
    echo $pdfContent;
}

function generateMembersPDF($members) {
    header('Content-Type: application/pdf');
    header('Content-Disposition: attachment; filename="members_report_' . date('Y-m-d') . '.pdf"');
    header('Cache-Control: private, max-age=0, must-revalidate');
    header('Pragma: public');
    
    $pdfContent = "CPMR Library - Members Report\n";
    $pdfContent .= "Generated on: " . date('Y-m-d H:i:s') . "\n\n";
    $pdfContent .= str_repeat("=", 50) . "\n\n";
    
    foreach ($members as $member) {
        $pdfContent .= "Name: " . $member['name'] . "\n";
        $pdfContent .= "Email: " . $member['email'] . "\n";
        $pdfContent .= "Phone: " . $member['phone'] . "\n";
        $pdfContent .= "Membership Type: " . $member['membership_type'] . "\n";
        $pdfContent .= "Join Date: " . $member['join_date'] . "\n";
        $pdfContent .= "Status: " . $member['status'] . "\n";
        $pdfContent .= str_repeat("-", 30) . "\n\n";
    }
    
    echo $pdfContent;
}

function generateBorrowingPDF($records) {
    header('Content-Type: application/pdf');
    header('Content-Disposition: attachment; filename="borrowing_report_' . date('Y-m-d') . '.pdf"');
    header('Cache-Control: private, max-age=0, must-revalidate');
    header('Pragma: public');
    
    $pdfContent = "CPMR Library - Borrowing Records Report\n";
    $pdfContent .= "Generated on: " . date('Y-m-d H:i:s') . "\n\n";
    $pdfContent .= str_repeat("=", 50) . "\n\n";
    
    foreach ($records as $record) {
        $pdfContent .= "Member: " . $record['member_name'] . "\n";
        $pdfContent .= "Book: " . $record['book_title'] . "\n";
        $pdfContent .= "Borrow Date: " . $record['borrow_date'] . "\n";
        $pdfContent .= "Due Date: " . $record['due_date'] . "\n";
        if ($record['return_date']) {
            $pdfContent .= "Return Date: " . $record['return_date'] . "\n";
        }
        $pdfContent .= "Status: " . $record['status'] . "\n";
        if ($record['late_fee'] > 0) {
            $pdfContent .= "Late Fee: $" . number_format($record['late_fee'], 2) . "\n";
        }
        $pdfContent .= str_repeat("-", 30) . "\n\n";
    }
    
    echo $pdfContent;
}

// CSV Generation Functions
function generateBooksCSV($books) {
    header('Content-Type: text/csv');
    header('Content-Disposition: attachment; filename="books_report_' . date('Y-m-d') . '.csv"');
    header('Cache-Control: private, max-age=0, must-revalidate');
    header('Pragma: public');
    
    $output = fopen('php://output', 'w');
    
    // Add headers
    fputcsv($output, ['Book ID', 'Title', 'Author', 'ISBN', 'Category', 'Publication Year', 'Publisher', 'Total Copies', 'Available Copies', 'Status', 'Created At']);
    
    // Add data
    foreach ($books as $book) {
        fputcsv($output, [
            $book['book_id'],
            $book['title'],
            $book['author'],
            $book['isbn'],
            $book['category'],
            $book['publication_year'],
            $book['publisher'],
            $book['total_copies'],
            $book['available_copies'],
            $book['status'],
            $book['created_at']
        ]);
    }
    
    fclose($output);
}

function generateMembersCSV($members) {
    header('Content-Type: text/csv');
    header('Content-Disposition: attachment; filename="members_report_' . date('Y-m-d') . '.csv"');
    header('Cache-Control: private, max-age=0, must-revalidate');
    header('Pragma: public');
    
    $output = fopen('php://output', 'w');
    
    // Add headers
    fputcsv($output, ['Member ID', 'Name', 'Email', 'Phone', 'Membership Type', 'Join Date', 'Status']);
    
    // Add data
    foreach ($members as $member) {
        fputcsv($output, [
            $member['member_id'],
            $member['name'],
            $member['email'],
            $member['phone'],
            $member['membership_type'],
            $member['join_date'],
            $member['status']
        ]);
    }
    
    fclose($output);
}

function generateBorrowingCSV($records) {
    header('Content-Type: text/csv');
    header('Content-Disposition: attachment; filename="borrowing_report_' . date('Y-m-d') . '.csv"');
    header('Cache-Control: private, max-age=0, must-revalidate');
    header('Pragma: public');
    
    $output = fopen('php://output', 'w');
    
    // Add headers
    fputcsv($output, ['Record ID', 'Member Name', 'Book Title', 'Borrow Date', 'Due Date', 'Return Date', 'Status', 'Late Fee']);
    
    // Add data
    foreach ($records as $record) {
        fputcsv($output, [
            $record['record_id'],
            $record['member_name'],
            $record['book_title'],
            $record['borrow_date'],
            $record['due_date'],
            $record['return_date'] ?? '',
            $record['status'],
            $record['late_fee']
        ]);
    }
    
    fclose($output);
}

// Excel Generation Functions (CSV format that Excel can open)
function generateBooksExcel($books) {
    generateBooksCSV($books); // Excel can open CSV files
}

function generateMembersExcel($members) {
    generateMembersCSV($members); // Excel can open CSV files
}

function generateBorrowingExcel($records) {
    generateBorrowingCSV($records); // Excel can open CSV files
}
?>