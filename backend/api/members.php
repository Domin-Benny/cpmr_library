<?php
// =============================================
// Members Management API
// File: backend/api/members.php
// Description: Handle all member-related operations
// =============================================

header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");

require_once '../../config/database.php';
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

// Enforce role-based access for write operations
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    // Only Admin and Librarian can perform write actions on members (add/update/delete)
    if (!requireRole($user, ['Admin', 'Librarian'])) {
        exit();
    }
}

// Get action parameter
$action = isset($_GET['action']) ? $_GET['action'] : '';

try {
    $database = new Database();
    $conn = $database->getConnection();

    switch ($_SERVER['REQUEST_METHOD']) {
        case 'GET':
            handleGetRequest($conn, $action);
            break;
            
        case 'POST':
            handlePostRequest($conn, $action, $user['user_id']);
            break;
            
        case 'PUT':
            $data = json_decode(file_get_contents("php://input"), true);
            updateMember($conn, $data, $user['user_id']);
            break;
            
        case 'DELETE':
            handleDeleteRequest($conn, $action, $user['user_id']);
            break;
            
        default:
            http_response_code(405);
            echo json_encode([
                'success' => false,
                'message' => 'Method not allowed'
            ]);
    }
} catch (Exception $e) {
    error_log("Members API error: " . $e->getMessage());
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
        case 'getAll':
            getAllMembers($conn);
            break;
            
        case 'getDetails':
            $id = isset($_GET['id']) ? $_GET['id'] : 0;
            getMemberDetails($conn, $id);
            break;
            
        case 'search':
            $searchTerm = isset($_GET['q']) ? $_GET['q'] : '';
            searchMembers($conn, $searchTerm);
            break;
            
        default:
            http_response_code(400);
            echo json_encode([
                'success' => false,
                'message' => 'Invalid action'
            ]);
    }
}

function getAllMembers($conn) {
    $sql = "SELECT 
                member_id as id,
                name,
                email,
                phone,
                membership_type as type,
                department,
                staff_id,
                address,
                status,
                join_date,
                created_at
            FROM members
            ORDER BY name";
    
    $stmt = $conn->prepare($sql);
    $stmt->execute();
    
    $members = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    echo json_encode([
        'success' => true,
        'members' => $members,
        'count' => count($members)
    ]);
}

function getMemberDetails($conn, $id) {
    if (!$id) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'message' => 'Member ID is required'
        ]);
        return;
    }
    
    $sql = "SELECT 
                member_id,
                name,
                email,
                phone,
                membership_type,
                department,
                staff_id,
                address,
                status,
                join_date,
                created_at
            FROM members
            WHERE member_id = :id";
    
    $stmt = $conn->prepare($sql);
    $stmt->bindParam(':id', $id, PDO::PARAM_INT);
    $stmt->execute();
    
    if ($stmt->rowCount() > 0) {
        $member = $stmt->fetch(PDO::FETCH_ASSOC);
        
        // Get member's borrowing history
        $borrowingSql = "SELECT 
                            br.record_id,
                            b.title as book_title,
                            br.borrow_date,
                            br.due_date,
                            br.return_date,
                            br.status
                        FROM borrowing_records br
                        JOIN books b ON br.book_id = b.book_id
                        WHERE br.member_id = :member_id
                        ORDER BY br.borrow_date DESC
                        LIMIT 10";
        
        $borrowingStmt = $conn->prepare($borrowingSql);
        $borrowingStmt->bindParam(':member_id', $id, PDO::PARAM_INT);
        $borrowingStmt->execute();
        $borrowingHistory = $borrowingStmt->fetchAll(PDO::FETCH_ASSOC);
        
        echo json_encode([
            'success' => true,
            'member' => $member,
            'borrowing_history' => $borrowingHistory
        ]);
    } else {
        http_response_code(404);
        echo json_encode([
            'success' => false,
            'message' => 'Member not found'
        ]);
    }
}

function searchMembers($conn, $searchTerm) {
    $sql = "SELECT 
                member_id as id,
                name,
                email,
                phone,
                membership_type as type,
                status,
                join_date
            FROM members
            WHERE name LIKE :search 
               OR email LIKE :search 
               OR phone LIKE :search
            ORDER BY name";
    
    $stmt = $conn->prepare($sql);
    $searchParam = "%$searchTerm%";
    $stmt->bindParam(':search', $searchParam);
    $stmt->execute();
    
    $members = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    echo json_encode([
        'success' => true,
        'members' => $members,
        'count' => count($members)
    ]);
}

// =============================================
// POST Request Handlers
// =============================================

function handlePostRequest($conn, $action, $userId) {
    $data = json_decode(file_get_contents("php://input"), true);
    
    switch ($action) {
        case 'add':
            addMember($conn, $data, $userId);
            break;
            
        case 'update':
            updateMember($conn, $data, $userId);
            break;
            
        default:
            http_response_code(400);
            echo json_encode([
                'success' => false,
                'message' => 'Invalid action'
            ]);
    }
}

function addMember($conn, $data, $userId) {
    // Validate required fields
    $requiredFields = ['name', 'email', 'membership_type'];
    foreach ($requiredFields as $field) {
        if (!isset($data[$field]) || empty($data[$field])) {
            http_response_code(400);
            echo json_encode([
                'success' => false,
                'message' => "Missing required field: $field"
            ]);
            return;
        }
    }
    
    // Check if email already exists
    $checkSql = "SELECT COUNT(*) as email_count FROM members WHERE email = :email";
    $checkStmt = $conn->prepare($checkSql);
    $checkStmt->bindParam(':email', $data['email']);
    $checkStmt->execute();
    $result = $checkStmt->fetch(PDO::FETCH_ASSOC);
    
    if ($result['email_count'] > 0) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'message' => 'Email already registered'
        ]);
        return;
    }
    
    try {
        $conn->beginTransaction();
        
        $sql = "INSERT INTO members (
                    name, email, phone, membership_type, 
                    department, staff_id, address, join_date, status
                ) VALUES (
                    :name, :email, :phone, :membership_type,
                    :department, :staff_id, :address, CURDATE(), 'Active'
                )";
        
        $stmt = $conn->prepare($sql);
        $stmt->bindParam(':name', $data['name']);
        $stmt->bindParam(':email', $data['email']);
        $stmt->bindParam(':phone', $data['phone']);
        $stmt->bindParam(':membership_type', $data['membership_type']);
        $stmt->bindParam(':department', $data['department']);
        $stmt->bindParam(':staff_id', $data['staff_id']);
        $stmt->bindParam(':address', $data['address']);
        
        $stmt->execute();
        
        $memberId = $conn->lastInsertId();
        
        // Log activity
        logActivity($conn, $userId, 'ADD', 'members', $memberId, "Added member: {$data['name']}");
        
        $conn->commit();
        
        echo json_encode([
            'success' => true,
            'message' => 'Member registered successfully',
            'member_id' => $memberId
        ]);
    } catch (Exception $e) {
        $conn->rollBack();
        throw $e;
    }
}

function updateMember($conn, $data, $userId) {
    if (!isset($data['member_id'])) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'message' => 'Member ID is required'
        ]);
        return;
    }
    
    try {
        $conn->beginTransaction();
        
        // Build update query dynamically
        $updates = [];
        $params = ['member_id' => $data['member_id']];
        
        $allowedFields = [
            'name', 'email', 'phone', 'membership_type',
            'department', 'staff_id', 'address', 'status'
        ];
        
        foreach ($allowedFields as $field) {
            if (isset($data[$field])) {
                $updates[] = "$field = :$field";
                $params[$field] = $data[$field];
            }
        }
        
        if (empty($updates)) {
            http_response_code(400);
            echo json_encode([
                'success' => false,
                'message' => 'No fields to update'
            ]);
            return;
        }
        
        $sql = "UPDATE members SET " . implode(', ', $updates) . " WHERE member_id = :member_id";
        
        $stmt = $conn->prepare($sql);
        foreach ($params as $key => $value) {
            $paramType = is_int($value) ? PDO::PARAM_INT : PDO::PARAM_STR;
            $stmt->bindValue(":$key", $value, $paramType);
        }
        
        $stmt->execute();
        
        // CRITICAL: If member status changes (suspend OR unsuspend), also update the user account
        if (isset($data['status'])) {
            // Find the corresponding user by email
            $checkUserSql = "SELECT u.user_id FROM users u 
                            INNER JOIN members m ON u.email = m.email 
                            WHERE m.member_id = :member_id";
            $checkUserStmt = $conn->prepare($checkUserSql);
            $checkUserStmt->bindParam(':member_id', $data['member_id'], PDO::PARAM_INT);
            $checkUserStmt->execute();
            
            if ($checkUserStmt->rowCount() > 0) {
                $userRecord = $checkUserStmt->fetch(PDO::FETCH_ASSOC);
                
                // Update user status to match member status
                $updateUserSql = "UPDATE users SET status = :status WHERE user_id = :user_id";
                $updateUserStmt = $conn->prepare($updateUserSql);
                $updateUserStmt->bindParam(':status', $data['status']);
                $updateUserStmt->bindParam(':user_id', $userRecord['user_id'], PDO::PARAM_INT);
                $updateUserStmt->execute();
                
                error_log("Updated user {$userRecord['user_id']} status to {$data['status']}");
            }
        }
        
        // Log activity
        logActivity($conn, $userId, 'UPDATE', 'members', $data['member_id'], "Updated member details");
        
        $conn->commit();
        
        echo json_encode([
            'success' => true,
            'message' => 'Member updated successfully'
        ]);
    } catch (Exception $e) {
        $conn->rollBack();
        throw $e;
    }
}

// =============================================
// DELETE Request Handler
// =============================================

function handleDeleteRequest($conn, $action, $userId) {
    if ($action !== 'delete') {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'message' => 'Invalid action'
        ]);
        return;
    }
    
    $id = isset($_GET['id']) ? $_GET['id'] : 0;
    
    if (!$id) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'message' => 'Member ID is required'
        ]);
        return;
    }
    
    try {
        // Check if member has active borrowings
        $checkSql = "SELECT COUNT(*) as active_borrowings 
                     FROM borrowing_records 
                     WHERE member_id = :member_id AND status = 'Active'";
        
        $checkStmt = $conn->prepare($checkSql);
        $checkStmt->bindParam(':member_id', $id, PDO::PARAM_INT);
        $checkStmt->execute();
        $result = $checkStmt->fetch(PDO::FETCH_ASSOC);
        
        if ($result['active_borrowings'] > 0) {
            http_response_code(400);
            echo json_encode([
                'success' => false,
                'message' => 'Cannot delete member with active borrowings'
            ]);
            return;
        }
        
        $conn->beginTransaction();
        
        // Get member name for logging
        $getMemberSql = "SELECT name FROM members WHERE member_id = :member_id";
        $getMemberStmt = $conn->prepare($getMemberSql);
        $getMemberStmt->bindParam(':member_id', $id, PDO::PARAM_INT);
        $getMemberStmt->execute();
        $member = $getMemberStmt->fetch(PDO::FETCH_ASSOC);
        
        // Delete the member
        $deleteSql = "DELETE FROM members WHERE member_id = :member_id";
        $deleteStmt = $conn->prepare($deleteSql);
        $deleteStmt->bindParam(':member_id', $id, PDO::PARAM_INT);
        $deleteStmt->execute();
        
        if ($deleteStmt->rowCount() > 0) {
            // Log activity
            logActivity($conn, $userId, 'DELETE', 'members', $id, "Deleted member: {$member['name']}");
            
            $conn->commit();
            
            echo json_encode([
                'success' => true,
                'message' => 'Member deleted successfully'
            ]);
        } else {
            $conn->rollBack();
            http_response_code(404);
            echo json_encode([
                'success' => false,
                'message' => 'Member not found'
            ]);
        }
    } catch (Exception $e) {
        $conn->rollBack();
        throw $e;
    }
}
?>