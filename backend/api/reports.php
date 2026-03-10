<?php
// =============================================
// Reports API
// File: backend/api/reports.php
// Description: Handle all reporting operations
// =============================================

header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");

require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/auth_helper.php';

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

// Get action parameter
$action = isset($_GET['action']) ? $_GET['action'] : '';

try {
    $database = new Database();
    $conn = $database->getConnection();

    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        handleGetRequest($conn, $action);
    } else {
        http_response_code(405);
        echo json_encode([
            'success' => false,
            'message' => 'Method not allowed'
        ]);
    }
} catch (Exception $e) {
    error_log("Reports API error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Internal server error'
    ]);
} finally {
    if (isset($conn)) {
        $database->closeConnection();
    }
}

// =============================================
// GET Request Handlers
// =============================================

function handleGetRequest($conn, $action) {
    switch ($action) {
        case 'dashboard':
            // Dashboard stats are allowed for authenticated users (role-specific content handled on frontend)
            getDashboardStats($conn);
            break;
        
        case 'userRoleStats':
            // User role stats restricted to Admin only
            if (!requireRole(isAuthenticated(), ['Admin'])) return;
            getUserRoleStats($conn);
            break;
            
        case 'monthly':
        case 'category':
        case 'borrowing':
        case 'members':
        case 'detailed':
        case 'monthly_trends':
            // All reports restricted to Admin and Librarian
            if (!requireRole(isAuthenticated(), ['Admin', 'Librarian'])) return;
            switch ($action) {
                case 'monthly':
                    getMonthlyReport($conn);
                    break;
                case 'category':
                    getCategoryReport($conn);
                    break;
                case 'borrowing':
                    getBorrowingReport($conn);
                    break;
                case 'members':
                    getMembersReport($conn);
                    break;
                case 'detailed':
                    getDetailedReport($conn);
                    break;
                case 'monthly_trends':
                    getMonthlyTrends($conn);
                    break;
            }
            break;
            
        default:
            http_response_code(400);
            echo json_encode([
                'success' => false,
                'message' => 'Invalid action'
            ]);
    }
}

function getDashboardStats($conn) {
    // Total unique books (different book titles)
    $uniqueBooksSql = "SELECT COUNT(*) as unique_books FROM books";
    $uniqueBooksStmt = $conn->prepare($uniqueBooksSql);
    $uniqueBooksStmt->execute();
    $uniqueBooks = $uniqueBooksStmt->fetch(PDO::FETCH_ASSOC)['unique_books'] ?? 0;
    
    // Total physical copies
    $totalCopiesSql = "SELECT SUM(total_copies) as total_copies FROM books";
    $totalCopiesStmt = $conn->prepare($totalCopiesSql);
    $totalCopiesStmt->execute();
    $totalCopies = $totalCopiesStmt->fetch(PDO::FETCH_ASSOC)['total_copies'] ?? 0;
    
    // Total active members
    $totalMembersSql = "SELECT COUNT(*) as total_members FROM members WHERE status = 'Active'";
    $totalMembersStmt = $conn->prepare($totalMembersSql);
    $totalMembersStmt->execute();
    $totalMembers = $totalMembersStmt->fetch(PDO::FETCH_ASSOC)['total_members'] ?? 0;
    
    // Active borrowings
    $booksBorrowedSql = "SELECT COUNT(*) as books_borrowed FROM borrowing_records WHERE status = 'Active'";
    $booksBorrowedStmt = $conn->prepare($booksBorrowedSql);
    $booksBorrowedStmt->execute();
    $booksBorrowed = $booksBorrowedStmt->fetch(PDO::FETCH_ASSOC)['books_borrowed'] ?? 0;
    
    // Overdue books
    $overdueBooksSql = "SELECT COUNT(*) as overdue_books 
                       FROM borrowing_records 
                       WHERE status = 'Active' AND due_date < CURDATE()";
    $overdueBooksStmt = $conn->prepare($overdueBooksSql);
    $overdueBooksStmt->execute();
    $overdueBooks = $overdueBooksStmt->fetch(PDO::FETCH_ASSOC)['overdue_books'] ?? 0;
    
    // Recent books (last 30 days)
    $recentBooksSql = "SELECT COUNT(*) as recent_books 
                      FROM books 
                      WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)";
    $recentBooksStmt = $conn->prepare($recentBooksSql);
    $recentBooksStmt->execute();
    $recentBooks = $recentBooksStmt->fetch(PDO::FETCH_ASSOC)['recent_books'] ?? 0;
    
    // Recent members (last 30 days)
    $recentMembersSql = "SELECT COUNT(*) as recent_members 
                        FROM members 
                        WHERE join_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)";
    $recentMembersStmt = $conn->prepare($recentMembersSql);
    $recentMembersStmt->execute();
    $recentMembers = $recentMembersStmt->fetch(PDO::FETCH_ASSOC)['recent_members'] ?? 0;
    
    // Category statistics
    $categoryStatsSql = "SELECT 
                            c.name as category_name,
                            COUNT(b.book_id) as book_count
                        FROM categories c
                        LEFT JOIN books b ON c.category_id = b.category_id
                        GROUP BY c.category_id, c.name
                        ORDER BY book_count DESC
                        LIMIT 5";
    $categoryStatsStmt = $conn->prepare($categoryStatsSql);
    $categoryStatsStmt->execute();
    $categoryStats = $categoryStatsStmt->fetchAll(PDO::FETCH_ASSOC);
    
    echo json_encode([
        'success' => true,
        'stats' => [
            'total_unique_books' => (int)$uniqueBooks,
            'total_physical_copies' => (int)$totalCopies,
            'total_members' => (int)$totalMembers,
            'books_borrowed' => (int)$booksBorrowed,
            'overdue_books' => (int)$overdueBooks,
            'recent_books' => (int)$recentBooks,
            'recent_members' => (int)$recentMembers
        ],
        'category_stats' => $categoryStats
    ]);
}

function getUserRoleStats($conn) {
    // Count users by role
    $userRolesSql = "SELECT role, COUNT(*) as count FROM users GROUP BY role";
    $userRolesStmt = $conn->prepare($userRolesSql);
    $userRolesStmt->execute();
    $userRoles = $userRolesStmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Initialize counts
    $stats = [
        'staff_count' => 0,
        'student_count' => 0,
        'other_count' => 0,
        'admin_count' => 0,
        'librarian_count' => 0
    ];
    
    // Populate counts
    foreach ($userRoles as $role) {
        $roleKey = strtolower($role['role']) . '_count';
        if (isset($stats[$roleKey])) {
            $stats[$roleKey] = (int)$role['count'];
        }
    }
    
    echo json_encode([
        'success' => true,
        'stats' => $stats
    ]);
}

function getMonthlyReport($conn) {
    $month = isset($_GET['month']) ? $_GET['month'] : date('Y-m');
    
    // Parse month parameter
    $startDate = date('Y-m-01', strtotime($month));
    $endDate = date('Y-m-t', strtotime($month));
    
    error_log("=== MONTHLY REPORT REQUEST ===");
    error_log("Month: $month, Start: $startDate, End: $endDate");
    
    // Monthly borrowings
    $monthlyBorrowingsSql = "SELECT COUNT(*) as monthly_borrowings
                            FROM borrowing_records
                            WHERE borrow_date BETWEEN :start_date AND :end_date";
    $monthlyBorrowingsStmt = $conn->prepare($monthlyBorrowingsSql);
    $monthlyBorrowingsStmt->bindParam(':start_date', $startDate);
    $monthlyBorrowingsStmt->bindParam(':end_date', $endDate);
    $monthlyBorrowingsStmt->execute();
    $monthlyBorrowings = $monthlyBorrowingsStmt->fetch(PDO::FETCH_ASSOC)['monthly_borrowings'] ?? 0;
    error_log("Monthly Borrowings: $monthlyBorrowings");
    
    // Monthly returns
    $monthlyReturnsSql = "SELECT COUNT(*) as monthly_returns
                         FROM borrowing_records
                         WHERE return_date BETWEEN :start_date AND :end_date";
    $monthlyReturnsStmt = $conn->prepare($monthlyReturnsSql);
    $monthlyReturnsStmt->bindParam(':start_date', $startDate);
    $monthlyReturnsStmt->bindParam(':end_date', $endDate);
    $monthlyReturnsStmt->execute();
    $monthlyReturns = $monthlyReturnsStmt->fetch(PDO::FETCH_ASSOC)['monthly_returns'] ?? 0;
    
    // Overdue rate
    $activeBorrowingsSql = "SELECT COUNT(*) as active_borrowings
                           FROM borrowing_records
                           WHERE status = 'Active'";
    $activeBorrowingsStmt = $conn->prepare($activeBorrowingsSql);
    $activeBorrowingsStmt->execute();
    $activeBorrowings = $activeBorrowingsStmt->fetch(PDO::FETCH_ASSOC)['active_borrowings'] ?? 0;
    
    $overdueBorrowingsSql = "SELECT COUNT(*) as overdue_borrowings
                            FROM borrowing_records
                            WHERE status = 'Active' AND due_date < CURDATE()";
    $overdueBorrowingsStmt = $conn->prepare($overdueBorrowingsSql);
    $overdueBorrowingsStmt->execute();
    $overdueBorrowings = $overdueBorrowingsStmt->fetch(PDO::FETCH_ASSOC)['overdue_borrowings'] ?? 0;
    
    $overdueRate = $activeBorrowings > 0 ? round(($overdueBorrowings / $activeBorrowings) * 100, 1) : 0;
    
    // Overdue books count (current overdue)
    $overdueBooksCount = $overdueBorrowings;
    
    // Fines collected this month (from returns with late fees)
    $finesCollectedSql = "SELECT SUM(late_fee) as fines_collected
                         FROM borrowing_records
                         WHERE return_date BETWEEN :start_date AND :end_date AND late_fee > 0";
    $finesCollectedStmt = $conn->prepare($finesCollectedSql);
    $finesCollectedStmt->bindParam(':start_date', $startDate);
    $finesCollectedStmt->bindParam(':end_date', $endDate);
    $finesCollectedStmt->execute();
    $finesCollected = $finesCollectedStmt->fetch(PDO::FETCH_ASSOC)['fines_collected'] ?? 0;
    
    // Outstanding fines (current overdue fines)
    $outstandingFinesSql = "SELECT SUM((DATEDIFF(CURDATE(), br.due_date) * 
                                       (SELECT COALESCE(setting_value, 0.50) FROM system_settings WHERE setting_key = 'late_fee_per_day'))) as outstanding_fines
                           FROM borrowing_records br
                           WHERE br.status = 'Active' AND br.due_date < CURDATE()";
    $outstandingFinesStmt = $conn->prepare($outstandingFinesSql);
    $outstandingFinesStmt->execute();
    $outstandingFines = $outstandingFinesStmt->fetch(PDO::FETCH_ASSOC)['outstanding_fines'] ?? 0;
    
    // Total books in collection
    $totalBooksSql = "SELECT COUNT(*) as total_books FROM books";
    $totalBooksStmt = $conn->prepare($totalBooksSql);
    $totalBooksStmt->execute();
    $totalBooks = $totalBooksStmt->fetch(PDO::FETCH_ASSOC)['total_books'] ?? 0;
    
    // Total physical copies
    $totalCopiesSql = "SELECT SUM(total_copies) as total_copies FROM books";
    $totalCopiesStmt = $conn->prepare($totalCopiesSql);
    $totalCopiesStmt->execute();
    $totalCopies = $totalCopiesStmt->fetch(PDO::FETCH_ASSOC)['total_copies'] ?? 0;
    
    // Total active members
    $totalMembersSql = "SELECT COUNT(*) as total_members FROM members WHERE status = 'Active'";
    $totalMembersStmt = $conn->prepare($totalMembersSql);
    $totalMembersStmt->execute();
    $totalMembers = $totalMembersStmt->fetch(PDO::FETCH_ASSOC)['total_members'] ?? 0;
    
    // Most borrowed category
    $mostBorrowedCategorySql = "SELECT 
                                   c.name as category_name,
                                   COUNT(br.record_id) as borrow_count
                               FROM borrowing_records br
                               JOIN books b ON br.book_id = b.book_id
                               JOIN categories c ON b.category_id = c.category_id
                               WHERE br.borrow_date BETWEEN :start_date AND :end_date
                               GROUP BY c.category_id, c.name
                               ORDER BY borrow_count DESC
                               LIMIT 1";
    $mostBorrowedCategoryStmt = $conn->prepare($mostBorrowedCategorySql);
    $mostBorrowedCategoryStmt->bindParam(':start_date', $startDate);
    $mostBorrowedCategoryStmt->bindParam(':end_date', $endDate);
    $mostBorrowedCategoryStmt->execute();
    $mostBorrowedCategory = $mostBorrowedCategoryStmt->fetch(PDO::FETCH_ASSOC);
    
    // New members this month
    $newMembersSql = "SELECT COUNT(*) as new_members
                     FROM members
                     WHERE join_date BETWEEN :start_date AND :end_date";
    $newMembersStmt = $conn->prepare($newMembersSql);
    $newMembersStmt->bindParam(':start_date', $startDate);
    $newMembersStmt->bindParam(':end_date', $endDate);
    $newMembersStmt->execute();
    $newMembers = $newMembersStmt->fetch(PDO::FETCH_ASSOC)['new_members'] ?? 0;
    
    // New books added this month
    $newBooksSql = "SELECT COUNT(*) as new_books
                   FROM books
                   WHERE created_at BETWEEN :start_date AND :end_date";
    $newBooksStmt = $conn->prepare($newBooksSql);
    $newBooksStmt->bindParam(':start_date', $startDate);
    $newBooksStmt->bindParam(':end_date', $endDate);
    $newBooksStmt->execute();
    $newBooks = $newBooksStmt->fetch(PDO::FETCH_ASSOC)['new_books'] ?? 0;
    
    // Top borrowed books
    $topBooksSql = "SELECT 
                       b.title,
                       b.author,
                       COUNT(br.record_id) as borrow_count
                   FROM borrowing_records br
                   JOIN books b ON br.book_id = b.book_id
                   WHERE br.borrow_date BETWEEN :start_date AND :end_date
                   GROUP BY b.book_id, b.title, b.author
                   ORDER BY borrow_count DESC
                   LIMIT 5";
    $topBooksStmt = $conn->prepare($topBooksSql);
    $topBooksStmt->bindParam(':start_date', $startDate);
    $topBooksStmt->bindParam(':end_date', $endDate);
    $topBooksStmt->execute();
    $topBooks = $topBooksStmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Top borrowing members
    $topMembersSql = "SELECT 
                         m.name,
                         m.email,
                         m.membership_type,
                         COUNT(br.record_id) as borrow_count
                     FROM borrowing_records br
                     JOIN members m ON br.member_id = m.member_id
                     WHERE br.borrow_date BETWEEN :start_date AND :end_date
                     GROUP BY m.member_id, m.name, m.email, m.membership_type
                     ORDER BY borrow_count DESC
                     LIMIT 5";
    $topMembersStmt = $conn->prepare($topMembersSql);
    $topMembersStmt->bindParam(':start_date', $startDate);
    $topMembersStmt->bindParam(':end_date', $endDate);
    $topMembersStmt->execute();
    $topMembers = $topMembersStmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Category breakdown for the month
    $categoryBreakdownSql = "SELECT 
                                c.name as category_name,
                                COUNT(br.record_id) as borrow_count,
                                COUNT(DISTINCT b.book_id) as unique_books_borrowed
                             FROM borrowing_records br
                             JOIN books b ON br.book_id = b.book_id
                             JOIN categories c ON b.category_id = c.category_id
                             WHERE br.borrow_date BETWEEN :start_date AND :end_date
                             GROUP BY c.category_id, c.name
                             ORDER BY borrow_count DESC";
    $categoryBreakdownStmt = $conn->prepare($categoryBreakdownSql);
    $categoryBreakdownStmt->bindParam(':start_date', $startDate);
    $categoryBreakdownStmt->bindParam(':end_date', $endDate);
    $categoryBreakdownStmt->execute();
    $categoryBreakdown = $categoryBreakdownStmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Member type distribution for the month
    $memberTypeDistributionSql = "SELECT 
                                     m.membership_type,
                                     COUNT(DISTINCT br.member_id) as active_members,
                                     COUNT(br.record_id) as borrow_count
                                 FROM borrowing_records br
                                 JOIN members m ON br.member_id = m.member_id
                                 WHERE br.borrow_date BETWEEN :start_date AND :end_date
                                 GROUP BY m.membership_type
                                 ORDER BY borrow_count DESC";
    $memberTypeDistributionStmt = $conn->prepare($memberTypeDistributionSql);
    $memberTypeDistributionStmt->bindParam(':start_date', $startDate);
    $memberTypeDistributionStmt->bindParam(':end_date', $endDate);
    $memberTypeDistributionStmt->execute();
    $memberTypeDistribution = $memberTypeDistributionStmt->fetchAll(PDO::FETCH_ASSOC);
    
    // User role statistics (system users)
    $userRoleStatsSql = "SELECT role, COUNT(*) as count FROM users GROUP BY role";
    $userRoleStatsStmt = $conn->prepare($userRoleStatsSql);
    $userRoleStatsStmt->execute();
    $userRoleStats = $userRoleStatsStmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Journal statistics (if journals table exists)
    $journalStats = null;
    try {
        $journalStatsSql = "SELECT COUNT(*) as total_journals FROM journals";
        $journalStatsStmt = $conn->prepare($journalStatsSql);
        $journalStatsStmt->execute();
        $journalStats = $journalStatsStmt->fetch(PDO::FETCH_ASSOC);
    } catch (Exception $e) {
        // Journals table might not exist
        $journalStats = ['total_journals' => 0];
    }
    
    // Policy statistics (if policies table exists)
    $policyStats = null;
    try {
        $policyStatsSql = "SELECT COUNT(*) as total_policies FROM policies";
        $policyStatsStmt = $conn->prepare($policyStatsSql);
        $policyStatsStmt->execute();
        $policyStats = $policyStatsStmt->fetch(PDO::FETCH_ASSOC);
    } catch (Exception $e) {
        // Policies table might not exist
        $policyStats = ['total_policies' => 0];
    }
    
    // Build comprehensive report data
    $reportData = [
        'month' => $month,
        'monthly_borrowings' => (int)$monthlyBorrowings,
        'monthly_returns' => (int)$monthlyReturns,
        'overdue_rate' => $overdueRate,
        'overdue_books' => (int)$overdueBooksCount,
        'fines_collected' => round((float)$finesCollected, 2),
        'outstanding_fines' => round((float)$outstandingFines, 2),
        'total_books' => (int)$totalBooks,
        'total_physical_copies' => (int)$totalCopies,
        'total_members' => (int)$totalMembers,
        'most_borrowed_category' => $mostBorrowedCategory['category_name'] ?? '-',
        'new_members_month' => (int)$newMembers,
        'new_books_month' => (int)$newBooks,
        'category_breakdown' => $categoryBreakdown,
        'member_type_distribution' => $memberTypeDistribution,
        'user_role_stats' => $userRoleStats,
        'journal_stats' => $journalStats,
        'policy_stats' => $policyStats
    ];
    
    error_log("=== REPORT DATA PREPARED ===");
    error_log(json_encode($reportData));
    
    echo json_encode([
        'success' => true,
        'report' => $reportData,
        'top_books' => $topBooks,
        'top_members' => $topMembers
    ]);
}

function getCategoryReport($conn) {
    $categoryId = isset($_GET['category_id']) ? $_GET['category_id'] : null;
    
    if ($categoryId) {
        // Report for specific category
        $categorySql = "SELECT * FROM categories WHERE category_id = :category_id";
        $categoryStmt = $conn->prepare($categorySql);
        $categoryStmt->bindParam(':category_id', $categoryId, PDO::PARAM_INT);
        $categoryStmt->execute();
        $category = $categoryStmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$category) {
            http_response_code(404);
            echo json_encode([
                'success' => false,
                'message' => 'Category not found'
            ]);
            return;
        }
        
        // Books in this category
        $booksSql = "SELECT 
                        book_id,
                        title,
                        author,
                        available_copies,
                        total_copies,
                        status
                    FROM books
                    WHERE category_id = :category_id
                    ORDER BY title";
        $booksStmt = $conn->prepare($booksSql);
        $booksStmt->bindParam(':category_id', $categoryId, PDO::PARAM_INT);
        $booksStmt->execute();
        $books = $booksStmt->fetchAll(PDO::FETCH_ASSOC);
        
        // Borrowing statistics for this category
        $statsSql = "SELECT 
                        COUNT(DISTINCT br.member_id) as unique_borrowers,
                        COUNT(br.record_id) as total_borrowings,
                        SUM(CASE WHEN br.status = 'Active' THEN 1 ELSE 0 END) as active_borrowings,
                        SUM(br.late_fee) as total_late_fees
                    FROM borrowing_records br
                    JOIN books b ON br.book_id = b.book_id
                    WHERE b.category_id = :category_id";
        $statsStmt = $conn->prepare($statsSql);
        $statsStmt->bindParam(':category_id', $categoryId, PDO::PARAM_INT);
        $statsStmt->execute();
        $stats = $statsStmt->fetch(PDO::FETCH_ASSOC);
        
        echo json_encode([
            'success' => true,
            'category' => $category,
            'books' => $books,
            'statistics' => $stats
        ]);
    } else {
        // Report for all categories
        $categoriesSql = "SELECT 
                             c.category_id,
                             c.name,
                             c.description,
                             COUNT(b.book_id) as book_count,
                             SUM(b.total_copies) as total_copies,
                             SUM(b.available_copies) as available_copies
                         FROM categories c
                         LEFT JOIN books b ON c.category_id = b.category_id
                         GROUP BY c.category_id, c.name, c.description
                         ORDER BY c.name";
        $categoriesStmt = $conn->prepare($categoriesSql);
        $categoriesStmt->execute();
        $categories = $categoriesStmt->fetchAll(PDO::FETCH_ASSOC);
        
        echo json_encode([
            'success' => true,
            'categories' => $categories
        ]);
    }
}

function getBorrowingReport($conn) {
    $startDate = isset($_GET['start_date']) ? $_GET['start_date'] : date('Y-m-01');
    $endDate = isset($_GET['end_date']) ? $_GET['end_date'] : date('Y-m-t');
    
    // Daily borrowing trend
    $dailyTrendSql = "SELECT 
                         DATE(borrow_date) as date,
                         COUNT(*) as borrow_count
                     FROM borrowing_records
                     WHERE borrow_date BETWEEN :start_date AND :end_date
                     GROUP BY DATE(borrow_date)
                     ORDER BY date";
    $dailyTrendStmt = $conn->prepare($dailyTrendSql);
    $dailyTrendStmt->bindParam(':start_date', $startDate);
    $dailyTrendStmt->bindParam(':end_date', $endDate);
    $dailyTrendStmt->execute();
    $dailyTrend = $dailyTrendStmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Category-wise borrowing
    $categoryBorrowingSql = "SELECT 
                                c.name as category_name,
                                COUNT(br.record_id) as borrow_count
                            FROM borrowing_records br
                            JOIN books b ON br.book_id = b.book_id
                            JOIN categories c ON b.category_id = c.category_id
                            WHERE br.borrow_date BETWEEN :start_date AND :end_date
                            GROUP BY c.category_id, c.name
                            ORDER BY borrow_count DESC";
    $categoryBorrowingStmt = $conn->prepare($categoryBorrowingSql);
    $categoryBorrowingStmt->bindParam(':start_date', $startDate);
    $categoryBorrowingStmt->bindParam(':end_date', $endDate);
    $categoryBorrowingStmt->execute();
    $categoryBorrowing = $categoryBorrowingStmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Member type statistics
    $memberTypeSql = "SELECT 
                         m.membership_type,
                         COUNT(DISTINCT br.member_id) as member_count,
                         COUNT(br.record_id) as borrow_count
                     FROM borrowing_records br
                     JOIN members m ON br.member_id = m.member_id
                     WHERE br.borrow_date BETWEEN :start_date AND :end_date
                     GROUP BY m.membership_type
                     ORDER BY borrow_count DESC";
    $memberTypeStmt = $conn->prepare($memberTypeSql);
    $memberTypeStmt->bindParam(':start_date', $startDate);
    $memberTypeStmt->bindParam(':end_date', $endDate);
    $memberTypeStmt->execute();
    $memberTypeStats = $memberTypeStmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Overdue analysis
    $overdueAnalysisSql = "SELECT 
                              CASE 
                                  WHEN DATEDIFF(return_date, due_date) <= 0 THEN 'On Time'
                                  WHEN DATEDIFF(return_date, due_date) BETWEEN 1 AND 7 THEN '1-7 Days Late'
                                  WHEN DATEDIFF(return_date, due_date) BETWEEN 8 AND 30 THEN '8-30 Days Late'
                                  ELSE 'More than 30 Days Late'
                              END as late_category,
                              COUNT(*) as record_count,
                              AVG(DATEDIFF(return_date, due_date)) as avg_days_late,
                              SUM(late_fee) as total_late_fees
                          FROM borrowing_records
                          WHERE return_date IS NOT NULL 
                            AND borrow_date BETWEEN :start_date AND :end_date
                          GROUP BY late_category
                          ORDER BY record_count DESC";
    $overdueAnalysisStmt = $conn->prepare($overdueAnalysisSql);
    $overdueAnalysisStmt->bindParam(':start_date', $startDate);
    $overdueAnalysisStmt->bindParam(':end_date', $endDate);
    $overdueAnalysisStmt->execute();
    $overdueAnalysis = $overdueAnalysisStmt->fetchAll(PDO::FETCH_ASSOC);
    
    echo json_encode([
        'success' => true,
        'period' => [
            'start_date' => $startDate,
            'end_date' => $endDate
        ],
        'daily_trend' => $dailyTrend,
        'category_borrowing' => $categoryBorrowing,
        'member_type_stats' => $memberTypeStats,
        'overdue_analysis' => $overdueAnalysis
    ]);
}

function getMembersReport($conn) {
    $status = isset($_GET['status']) ? $_GET['status'] : 'Active';
    
    $whereClause = "";
    $params = [];
    
    if ($status !== 'All') {
        $whereClause = "WHERE m.status = :status";
        $params['status'] = $status;
    }
    
    // Basic member statistics
    $memberStatsSql = "SELECT 
                          COUNT(*) as total_members,
                          AVG(DATEDIFF(CURDATE(), join_date)) as avg_membership_days,
                          COUNT(CASE WHEN join_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY) THEN 1 END) as new_members_30d
                      FROM members m
                      $whereClause";
    
    $memberStatsStmt = $conn->prepare($memberStatsSql);
    foreach ($params as $key => $value) {
        $memberStatsStmt->bindValue(":$key", $value);
    }
    $memberStatsStmt->execute();
    $memberStats = $memberStatsStmt->fetch(PDO::FETCH_ASSOC);
    
    // Membership type distribution
    $typeDistributionSql = "SELECT 
                               membership_type,
                               COUNT(*) as member_count,
                               ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM members $whereClause), 1) as percentage
                           FROM members m
                           $whereClause
                           GROUP BY membership_type
                           ORDER BY member_count DESC";
    
    $typeDistributionStmt = $conn->prepare($typeDistributionSql);
    foreach ($params as $key => $value) {
        $typeDistributionStmt->bindValue(":$key", $value);
    }
    $typeDistributionStmt->execute();
    $typeDistribution = $typeDistributionStmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Top borrowing members
    $topBorrowersSql = "SELECT 
                           m.name,
                           m.email,
                           m.membership_type,
                           COUNT(br.record_id) as total_borrowings,
                           SUM(CASE WHEN br.status = 'Active' THEN 1 ELSE 0 END) as active_borrowings,
                           SUM(br.late_fee) as total_late_fees
                       FROM members m
                       LEFT JOIN borrowing_records br ON m.member_id = br.member_id
                       $whereClause
                       GROUP BY m.member_id, m.name, m.email, m.membership_type
                       ORDER BY total_borrowings DESC
                       LIMIT 10";
    
    $topBorrowersStmt = $conn->prepare($topBorrowersSql);
    foreach ($params as $key => $value) {
        $topBorrowersStmt->bindValue(":$key", $value);
    }
    $topBorrowersStmt->execute();
    $topBorrowers = $topBorrowersStmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Inactive members (no borrowings in last 90 days)
    $inactiveMembersSql = "SELECT 
                              m.name,
                              m.email,
                              m.join_date,
                              MAX(br.borrow_date) as last_borrowing
                          FROM members m
                          LEFT JOIN borrowing_records br ON m.member_id = br.member_id
                          WHERE m.status = 'Active'
                          GROUP BY m.member_id, m.name, m.email, m.join_date
                          HAVING last_borrowing IS NULL 
                             OR last_borrowing < DATE_SUB(CURDATE(), INTERVAL 90 DAY)
                          ORDER BY last_borrowing";
    
    $inactiveMembersStmt = $conn->prepare($inactiveMembersSql);
    $inactiveMembersStmt->execute();
    $inactiveMembers = $inactiveMembersStmt->fetchAll(PDO::FETCH_ASSOC);
    
    echo json_encode([
        'success' => true,
        'status_filter' => $status,
        'member_statistics' => $memberStats,
        'type_distribution' => $typeDistribution,
        'top_borrowers' => $topBorrowers,
        'inactive_members' => $inactiveMembers
    ]);
}

function getDetailedReport($conn) {
    // Comprehensive library report
    $reportDate = date('Y-m-d');
    
    // Basic counts
    $basicCountsSql = "SELECT 
                        (SELECT COUNT(*) FROM books) as total_books,
                        (SELECT COUNT(*) FROM members) as total_members,
                        (SELECT COUNT(*) FROM borrowing_records WHERE status = 'Active') as active_borrowings,
                        (SELECT COUNT(*) FROM borrowing_records WHERE status = 'Active' AND due_date < CURDATE()) as overdue_borrowings,
                        (SELECT COUNT(*) FROM categories) as total_categories";
    $basicCountsStmt = $conn->prepare($basicCountsSql);
    $basicCountsStmt->execute();
    $basicCounts = $basicCountsStmt->fetch(PDO::FETCH_ASSOC);
    
    // Monthly statistics
    $currentMonth = date('Y-m');
    $startDate = date('Y-m-01');
    $endDate = date('Y-m-t');
    
    $monthlyStatsSql = "SELECT 
                        (SELECT COUNT(*) FROM borrowing_records WHERE borrow_date BETWEEN :start_date AND :end_date) as monthly_borrowings,
                        (SELECT COUNT(*) FROM borrowing_records WHERE return_date BETWEEN :start_date AND :end_date) as monthly_returns,
                        (SELECT COUNT(*) FROM members WHERE join_date BETWEEN :start_date AND :end_date) as new_members,
                        (SELECT COUNT(*) FROM books WHERE created_at BETWEEN :start_date AND :end_date) as new_books";
    $monthlyStatsStmt = $conn->prepare($monthlyStatsSql);
    $monthlyStatsStmt->bindParam(':start_date', $startDate);
    $monthlyStatsStmt->bindParam(':end_date', $endDate);
    $monthlyStatsStmt->execute();
    $monthlyStats = $monthlyStatsStmt->fetch(PDO::FETCH_ASSOC);
    
    // Category breakdown
    $categoryBreakdownSql = "SELECT 
                             c.name as category_name,
                             COUNT(b.book_id) as book_count,
                             SUM(b.total_copies) as total_copies,
                             SUM(b.available_copies) as available_copies
                         FROM categories c
                         LEFT JOIN books b ON c.category_id = b.category_id
                         GROUP BY c.category_id, c.name
                         ORDER BY c.name";
    $categoryBreakdownStmt = $conn->prepare($categoryBreakdownSql);
    $categoryBreakdownStmt->execute();
    $categoryBreakdown = $categoryBreakdownStmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Top borrowed books
    $topBooksSql = "SELECT 
                     b.title,
                     b.author,
                     c.name as category,
                     COUNT(br.record_id) as borrow_count
                 FROM borrowing_records br
                 JOIN books b ON br.book_id = b.book_id
                 JOIN categories c ON b.category_id = c.category_id
                 WHERE br.borrow_date >= DATE_SUB(CURDATE(), INTERVAL 90 DAY)
                 GROUP BY b.book_id, b.title, b.author, c.name
                 ORDER BY borrow_count DESC
                 LIMIT 10";
    $topBooksStmt = $conn->prepare($topBooksSql);
    $topBooksStmt->execute();
    $topBooks = $topBooksStmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Member statistics
    $memberStatsSql = "SELECT 
                        membership_type,
                        COUNT(*) as member_count,
                        AVG(DATEDIFF(CURDATE(), join_date)) as avg_membership_days
                    FROM members
                    GROUP BY membership_type
                    ORDER BY member_count DESC";
    $memberStatsStmt = $conn->prepare($memberStatsSql);
    $memberStatsStmt->execute();
    $memberStats = $memberStatsStmt->fetchAll(PDO::FETCH_ASSOC);
    
    echo json_encode([
        'success' => true,
        'report_date' => $reportDate,
        'basic_counts' => $basicCounts,
        'monthly_stats' => $monthlyStats,
        'category_breakdown' => $categoryBreakdown,
        'top_borrowed_books' => $topBooks,
        'member_statistics' => $memberStats
    ]);
}

function getMonthlyTrends($conn) {
    $year = isset($_GET['year']) ? $_GET['year'] : date('Y');
    $currentMonth = (int)date('n'); // Current month as integer (1-12)
    
    // Debug: log the query execution
    error_log('getMonthlyTrends called for year: ' . $year . ', current month: ' . $currentMonth);
    
    // Get monthly borrowings for the year
    $borrowingSql = "SELECT 
                       MONTH(borrow_date) as month,
                       COUNT(*) as count
                   FROM borrowing_records
                   WHERE YEAR(borrow_date) = :year
                   GROUP BY MONTH(borrow_date)
                   ORDER BY MONTH(borrow_date)";
    error_log('Borrowing SQL: ' . $borrowingSql);
    $borrowingStmt = $conn->prepare($borrowingSql);
    $borrowingStmt->bindParam(':year', $year, PDO::PARAM_INT);
    $borrowingStmt->execute();
    $borrowingResults = $borrowingStmt->fetchAll(PDO::FETCH_ASSOC);
    error_log('Borrowing results: ' . json_encode($borrowingResults));
    
    // Get monthly returns for the year
    $returningSql = "SELECT 
                        MONTH(return_date) as month,
                        COUNT(*) as count
                    FROM borrowing_records
                    WHERE YEAR(return_date) = :year AND return_date IS NOT NULL
                    GROUP BY MONTH(return_date)
                    ORDER BY MONTH(return_date)";
    error_log('Returning SQL: ' . $returningSql);
    $returningStmt = $conn->prepare($returningSql);
    $returningStmt->bindParam(':year', $year, PDO::PARAM_INT);
    $returningStmt->execute();
    $returningResults = $returningStmt->fetchAll(PDO::FETCH_ASSOC);
    error_log('Returning results: ' . json_encode($returningResults));
    
    // Initialize arrays with zeros for all 12 months
    $borrowed = array_fill(1, 12, 0);
    $returned = array_fill(1, 12, 0);
    
    // Fill in the actual data
    foreach ($borrowingResults as $row) {
        $borrowed[$row['month']] = (int)$row['count'];
        error_log('Setting borrowed[' . $row['month'] . '] = ' . $row['count']);
    }
    
    foreach ($returningResults as $row) {
        $returned[$row['month']] = (int)$row['count'];
        error_log('Setting returned[' . $row['month'] . '] = ' . $row['count']);
    }
    
    // Convert to indexed arrays (0-11 for Jan-Dec) and only include up to current month
    $borrowedData = [];
    $returnedData = [];
    $labels = [];
    
    // Only include months up to current month
    for ($i = 1; $i <= $currentMonth; $i++) {
        $borrowedData[] = $borrowed[$i];
        $returnedData[] = $returned[$i];
        $labels[] = date('M', mktime(0, 0, 0, $i, 1)); // Get month abbreviation
    }
    
    // Debug: log the final data being returned
    error_log('Final Monthly Trends Data - Borrowed: ' . json_encode($borrowedData));
    error_log('Final Monthly Trends Data - Returned: ' . json_encode($returnedData));
    error_log('Final Labels: ' . json_encode($labels));
    
    echo json_encode([
        'success' => true,
        'borrowingTrends' => [
            'labels' => $labels,
            'borrowed' => $borrowedData,
            'returned' => $returnedData,
            'year' => $year,
            'currentMonth' => $currentMonth
        ]
    ]);
}



?>