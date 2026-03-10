<?php
// =============================================
// User Management API
// File: backend/api/users.php
// Description: Manage user accounts (Admin only)
// =============================================

header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");

require_once '../../config/database.php';
require_once 'auth_helper.php';

// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Only handle POST and GET requests
if ($_SERVER['REQUEST_METHOD'] !== 'POST' && $_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode([
        'success' => false,
        'message' => 'Method not allowed'
    ]);
    exit();
}

try {
    $database = new Database();
    $conn = $database->getConnection();

    // Validate token for all operations
    $token = null;
    $headers = getallheaders();
    if (isset($headers['Authorization'])) {
        $authHeader = $headers['Authorization'];
        if (strpos($authHeader, 'Bearer ') === 0) {
            $token = substr($authHeader, 7);
        }
    }

    if (!$token) {
        http_response_code(401);
        echo json_encode(['success' => false, 'message' => 'Missing authorization token']);
        exit();
    }

    $user = validateToken($token);
    if (!$user) {
        http_response_code(401);
        echo json_encode(['success' => false, 'message' => 'Invalid or expired token']);
        exit();
    }

    // Route to appropriate handler
    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        $action = $_GET['action'] ?? 'getAll';
        
        if ($action === 'getAll') {
            getUsers($conn, $user);
        } else if ($action === 'getRecent') {
            $limit = isset($_GET['limit']) ? intval($_GET['limit']) : 10;
            getRecentUsers($conn, $user, $limit);
        } else {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Invalid action']);
        }
    } else if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $data = json_decode(file_get_contents("php://input"), true);
        $action = $data['action'] ?? 'create';

        if ($action === 'create') {
            createUser($conn, $user, $data);
        } else if ($action === 'update') {
            updateUser($conn, $user, $data);
        } else if ($action === 'delete') {
            deleteUser($conn, $user, $data);
        } else if ($action === 'update_profile') {
            updateUserProfile($conn, $user, $data);
        } else if ($action === 'change_password') {
            changeUserPassword($conn, $user, $data);
        } else {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Invalid action']);
        }
    }

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'An error occurred: ' . $e->getMessage()
    ]);
}

// =============================================
// Handler Functions
// =============================================

function getUsers($conn, $user) {
    // Only Admin can view all users
    if (!requireRole($user, ['Admin'])) {
        http_response_code(403);
        echo json_encode(['success' => false, 'message' => 'Access denied']);
        return;
    }

    $sql = "SELECT user_id, username, role, email, name, created_at FROM users ORDER BY created_at DESC";
    $stmt = $conn->prepare($sql);
    $stmt->execute();
    $users = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode([
        'success' => true,
        'users' => $users
    ]);
}

function getRecentUsers($conn, $user, $limit = 10) {
    // Only Admin and Librarian can view recent users
    if (!requireRole($user, ['Admin', 'Librarian'])) {
        http_response_code(403);
        echo json_encode(['success' => false, 'message' => 'Access denied']);
        return;
    }

    $limit = min($limit, 50); // Cap limit at 50
    $sql = "SELECT user_id, username, role, email, name, created_at FROM users ORDER BY created_at DESC LIMIT :limit";
    $stmt = $conn->prepare($sql);
    $stmt->bindParam(':limit', $limit, PDO::PARAM_INT);
    $stmt->execute();
    $users = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode([
        'success' => true,
        'users' => $users
    ]);
}

function createUser($conn, $user, $data) {
    // Only Admin can create users (specifically Librarian accounts)
    if (!requireRole($user, ['Admin'])) {
        http_response_code(403);
        echo json_encode(['success' => false, 'message' => 'Access denied']);
        return;
    }

    // Validate required fields
    if (!isset($data['username']) || !isset($data['password']) || !isset($data['name']) || !isset($data['email'])) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'message' => 'Missing required fields: username, password, name, email'
        ]);
        return;
    }

    $username = trim($data['username']);
    $password = $data['password'];
    $name = trim($data['name']);
    $email = trim($data['email']);
    
    // Determine role - only allow Admin or Librarian creation through this endpoint
    $requestedRole = isset($data['role']) ? trim($data['role']) : 'Librarian';
    
    // Validate role
    if (!in_array($requestedRole, ['Librarian', 'Admin'])) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Invalid role. Only Librarian and Admin roles can be created through this endpoint']);
        return;
    }
    
    // Only allow Admin creation if the current user is already an Admin
    if ($requestedRole === 'Admin' && $user['role'] !== 'Admin') {
        http_response_code(403);
        echo json_encode(['success' => false, 'message' => 'Access denied. Only existing Admin users can create other Admin accounts']);
        return;
    }
    
    $role = $requestedRole;

    // Validate inputs
    if (strlen($username) < 3) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Username must be at least 3 characters']);
        return;
    }

    if (strlen($password) < 6) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Password must be at least 6 characters']);
        return;
    }

    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Invalid email address']);
        return;
    }

    try {
        // Check if username or email already exists
        $checkSql = "SELECT user_id FROM users WHERE username = :username OR email = :email";
        $checkStmt = $conn->prepare($checkSql);
        $checkStmt->bindParam(':username', $username);
        $checkStmt->bindParam(':email', $email);
        $checkStmt->execute();

        if ($checkStmt->rowCount() > 0) {
            http_response_code(409);
            echo json_encode(['success' => false, 'message' => 'Username or email already exists']);
            return;
        }

        // Hash password
        $hashedPassword = password_hash($password, PASSWORD_BCRYPT);

        // Create user
        $insertSql = "INSERT INTO users (username, password_hash, name, email, role, created_at) 
                      VALUES (:username, :password, :name, :email, :role, NOW())";
        $insertStmt = $conn->prepare($insertSql);
        $insertStmt->bindParam(':username', $username);
        $insertStmt->bindParam(':password', $hashedPassword);
        $insertStmt->bindParam(':name', $name);
        $insertStmt->bindParam(':email', $email);
        $insertStmt->bindParam(':role', $role);
        $insertStmt->execute();

        // Create audit log entry
        $auditSql = "INSERT INTO audit_log (action, table_name, record_id, details, user_id, created_at)
                     VALUES ('CREATE', 'users', LAST_INSERT_ID(), :details, :changed_by, NOW())";
        $auditStmt = $conn->prepare($auditSql);
        $details = "Created new $role account: $username";
        $auditStmt->bindParam(':details', $details);
        $auditStmt->bindParam(':changed_by', $user['user_id']);
        $auditStmt->execute();

        http_response_code(201);
        echo json_encode([
            'success' => true,
            'message' => 'Librarian account created successfully',
            'user_id' => $conn->lastInsertId()
        ]);

    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'message' => 'Database error: ' . $e->getMessage()
        ]);
    }
}

function updateUser($conn, $user, $data) {
    // Only Admin can update users
    if (!requireRole($user, ['Admin'])) {
        http_response_code(403);
        echo json_encode(['success' => false, 'message' => 'Access denied']);
        return;
    }

    if (!isset($data['user_id'])) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'User ID required']);
        return;
    }

    $user_id = intval($data['user_id']);
    
    try {
        $updates = [];
        $params = [':user_id' => $user_id];

        if (isset($data['name'])) {
            $updates[] = "name = :name";
            $params[':name'] = trim($data['name']);
        }

        if (isset($data['email'])) {
            $updates[] = "email = :email";
            $params[':email'] = trim($data['email']);
        }

        if (isset($data['password'])) {
            $updates[] = "password = :password";
            $params[':password'] = password_hash($data['password'], PASSWORD_BCRYPT);
        }

        if (empty($updates)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'No fields to update']);
            return;
        }

        $updateSql = "UPDATE users SET " . implode(", ", $updates) . " WHERE user_id = :user_id";
        $updateStmt = $conn->prepare($updateSql);
        $updateStmt->execute($params);

        // Create audit log entry
        $auditSql = "INSERT INTO audit_log (action, table_name, record_id, details, user_id, created_at)
                     VALUES ('UPDATE', 'users', :record_id, :details, :changed_by, NOW())";
        $auditStmt = $conn->prepare($auditSql);
        $details = "Updated user fields: " . implode(", ", array_keys($updates));
        $auditStmt->bindParam(':record_id', $user_id);
        $auditStmt->bindParam(':details', $details);
        $auditStmt->bindParam(':changed_by', $user['user_id']);
        $auditStmt->execute();

        echo json_encode([
            'success' => true,
            'message' => 'User updated successfully'
        ]);

    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'message' => 'Database error: ' . $e->getMessage()
        ]);
    }
}

function deleteUser($conn, $user, $data) {
    // Only Admin can delete users
    if (!requireRole($user, ['Admin'])) {
        http_response_code(403);
        echo json_encode(['success' => false, 'message' => 'Access denied']);
        return;
    }

    if (!isset($data['user_id'])) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'User ID required']);
        return;
    }

    $user_id = intval($data['user_id']);

    // Prevent deleting self
    if ($user_id === intval($user['user_id'])) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Cannot delete your own account']);
        return;
    }

    // CRITICAL: Prevent deleting the main admin account (user_id = 1)
    // This protects the system from losing the primary administrator
    if ($user_id === 1) {
        http_response_code(403);
        echo json_encode([
            'success' => false,
            'message' => '⚠️ PROTECTED: Cannot delete the main admin account. This account is essential for system security and cannot be removed.'
        ]);
        return;
    }

    // Additional check: Prevent deleting any user with role 'Admin'
    try {
        $checkSql = "SELECT role FROM users WHERE user_id = :user_id";
        $checkStmt = $conn->prepare($checkSql);
        $checkStmt->bindParam(':user_id', $user_id);
        $checkStmt->execute();
        $targetUser = $checkStmt->fetch(PDO::FETCH_ASSOC);
        
        if ($targetUser && strtolower($targetUser['role']) === 'admin') {
            http_response_code(403);
            echo json_encode([
                'success' => false,
                'message' => '⚠️ PROTECTED: Cannot delete admin accounts. Admin accounts are protected to maintain system security.'
            ]);
            return;
        }
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'message' => 'Error checking user role: ' . $e->getMessage()
        ]);
        return;
    }

    try {
        // Delete user
        $deleteSql = "DELETE FROM users WHERE user_id = :user_id";
        $deleteStmt = $conn->prepare($deleteSql);
        $deleteStmt->bindParam(':user_id', $user_id);
        $deleteStmt->execute();

        if ($deleteStmt->rowCount() === 0) {
            http_response_code(404);
            echo json_encode(['success' => false, 'message' => 'User not found']);
            return;
        }

        // Create audit log entry
        $auditSql = "INSERT INTO audit_log (action, table_name, record_id, details, user_id, created_at)
                     VALUES ('DELETE', 'users', :record_id, :details, :changed_by, NOW())";
        $auditStmt = $conn->prepare($auditSql);
        $details = "Deleted user account";
        $auditStmt->bindParam(':record_id', $user_id);
        $auditStmt->bindParam(':details', $details);
        $auditStmt->bindParam(':changed_by', $user['user_id']);
        $auditStmt->execute();

        echo json_encode([
            'success' => true,
            'message' => 'User deleted successfully'
        ]);

    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'message' => 'Database error: ' . $e->getMessage()
        ]);
    }
}

// Function to update user's own profile
function updateUserProfile($conn, $user, $data) {
    // Allow user to update their own profile
    $user_id = intval($user['user_id']);
    
    try {
        $updates = [];
        $params = [':user_id' => $user_id];

        if (isset($data['name'])) {
            $updates[] = "name = :name";
            $params[':name'] = trim($data['name']);
        }

        if (isset($data['email'])) {
            $updates[] = "email = :email";
            $params[':email'] = trim($data['email']);
        }

        if (isset($data['username'])) {
            // Check if username is already taken by another user
            $checkSql = "SELECT user_id FROM users WHERE username = :username AND user_id != :user_id";
            $checkStmt = $conn->prepare($checkSql);
            $checkStmt->bindParam(':username', $data['username']);
            $checkStmt->bindParam(':user_id', $user_id);
            $checkStmt->execute();

            if ($checkStmt->rowCount() > 0) {
                http_response_code(409);
                echo json_encode(['success' => false, 'message' => 'Username already exists']);
                return;
            }
            
            $updates[] = "username = :username";
            $params[':username'] = trim($data['username']);
        }

        // Handle optional fields
        if (isset($data['phone'])) {
            $updates[] = "phone = :phone";
            $params[':phone'] = !empty(trim($data['phone'])) ? trim($data['phone']) : null;
        }

        if (isset($data['institution'])) {
            $updates[] = "institution = :institution";
            $params[':institution'] = !empty(trim($data['institution'])) ? trim($data['institution']) : null;
        }

        if (isset($data['department'])) {
            $updates[] = "department = :department";
            $params[':department'] = !empty(trim($data['department'])) ? trim($data['department']) : null;
        }

        if (isset($data['program'])) {
            $updates[] = "program = :program";
            $params[':program'] = !empty(trim($data['program'])) ? trim($data['program']) : null;
        }

        if (isset($data['id_number'])) {
            $updates[] = "id_number = :id_number";
            $params[':id_number'] = !empty(trim($data['id_number'])) ? trim($data['id_number']) : null;
        }

        if (isset($data['id_type'])) {
            $updates[] = "id_type = :id_type";
            $params[':id_type'] = !empty(trim($data['id_type'])) ? trim($data['id_type']) : null;
        }

        // Allow users to update their security question/answer
        if (isset($data['security_question'])) {
            $updates[] = "security_question = :security_question";
            $params[':security_question'] = !empty(trim($data['security_question'])) ? trim($data['security_question']) : null;
        }

        if (isset($data['security_answer'])) {
            // Require current password to change the security answer
            if (!isset($data['current_password']) || empty($data['current_password'])) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'Current password is required to change security answer']);
                return;
            }

            // Verify current password
            $pwSql = "SELECT password_hash FROM users WHERE user_id = :user_id";
            $pwStmt = $conn->prepare($pwSql);
            $pwStmt->bindParam(':user_id', $user_id);
            $pwStmt->execute();
            $pwRow = $pwStmt->fetch(PDO::FETCH_ASSOC);
            if (!$pwRow || !password_verify($data['current_password'], $pwRow['password_hash'])) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'Current password is incorrect']);
                return;
            }

            // Normalize stored answer to lowercase trimmed form to match verification behaviour
            $updates[] = "security_answer = :security_answer";
            $params[':security_answer'] = !empty(trim($data['security_answer'])) ? strtolower(trim($data['security_answer'])) : null;
        }

        if (empty($updates)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'No fields to update']);
            return;
        }

        $updateSql = "UPDATE users SET " . implode(", ", $updates) . " WHERE user_id = :user_id";
        $updateStmt = $conn->prepare($updateSql);
        $updateStmt->execute($params);

        // Create audit log entry
        $auditSql = "INSERT INTO audit_log (action, table_name, record_id, details, user_id, created_at)
                     VALUES ('UPDATE_PROFILE', 'users', :record_id, :details, :changed_by, NOW())";
        $auditStmt = $conn->prepare($auditSql);
        $details = "User updated their profile: " . implode(", ", array_keys($params));
        $auditStmt->bindParam(':record_id', $user_id);
        $auditStmt->bindParam(':details', $details);
        $auditStmt->bindParam(':changed_by', $user_id);
        $auditStmt->execute();

        echo json_encode([
            'success' => true,
            'message' => 'Profile updated successfully'
        ]);

    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'message' => 'Database error: ' . $e->getMessage()
        ]);
    }
}

// Function to change user's own password
function changeUserPassword($conn, $user, $data) {
    // Allow user to change their own password
    $user_id = intval($user['user_id']);
    
    // Validate required fields
    if (!isset($data['current_password']) || !isset($data['new_password'])) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'message' => 'Current password and new password are required'
        ]);
        return;
    }

    $currentPassword = $data['current_password'];
    $newPassword = $data['new_password'];

    // Validate new password strength
    if (strlen($newPassword) < 6) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'New password must be at least 6 characters']);
        return;
    }

    try {
        // Verify current password
        $sql = "SELECT password_hash FROM users WHERE user_id = :user_id";
        $stmt = $conn->prepare($sql);
        $stmt->bindParam(':user_id', $user_id);
        $stmt->execute();
        $result = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$result || !password_verify($currentPassword, $result['password_hash'])) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Current password is incorrect']);
            return;
        }

        // Hash new password
        $hashedNewPassword = password_hash($newPassword, PASSWORD_BCRYPT);

        // Update password
        $updateSql = "UPDATE users SET password_hash = :password WHERE user_id = :user_id";
        $updateStmt = $conn->prepare($updateSql);
        $updateStmt->bindParam(':password', $hashedNewPassword);
        $updateStmt->bindParam(':user_id', $user_id);
        $updateStmt->execute();

        // Create audit log entry
        $auditSql = "INSERT INTO audit_log (action, table_name, record_id, details, user_id, created_at)
                     VALUES ('CHANGE_PASSWORD', 'users', :record_id, :details, :changed_by, NOW())";
        $auditStmt = $conn->prepare($auditSql);
        $details = "User changed their password";
        $auditStmt->bindParam(':record_id', $user_id);
        $auditStmt->bindParam(':details', $details);
        $auditStmt->bindParam(':changed_by', $user_id);
        $auditStmt->execute();

        echo json_encode([
            'success' => true,
            'message' => 'Password changed successfully'
        ]);

    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'message' => 'Database error: ' . $e->getMessage()
        ]);
    }
}

?>
