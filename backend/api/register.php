<?php
// =============================================
// User Registration API
// File: backend/api/register.php
// Description: Handle user registration requests
// =============================================

header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");

require_once '../../config/database.php';

/**
 * Sanitize input data for registration
 * @param string $input
 * @return string
 */
function sanitizeRegistrationInput($input) {
    return htmlspecialchars(strip_tags(trim($input)));
}

/**
 * Log registration activity to audit trail
 * @param PDO $conn Database connection
 * @param int $userId User ID
 * @param string $action Action performed
 * @param string $table Table affected
 * @param int $recordId ID of affected record
 * @param string $details Details of the action
 */
function logRegistrationActivity($conn, $userId, $action, $table, $recordId, $details) {
    try {
        $sql = "INSERT INTO audit_log (user_id, action, table_affected, record_id, details) 
                VALUES (:user_id, :action, :table, :record_id, :details)";
        $stmt = $conn->prepare($sql);
        $stmt->bindParam(':user_id', $userId);
        $stmt->bindParam(':action', $action);
        $stmt->bindParam(':table', $table);
        $stmt->bindParam(':record_id', $recordId);
        $stmt->bindParam(':details', $details);
        $stmt->execute();
    } catch (Exception $e) {
        error_log('Audit log error: ' . $e->getMessage());
    }
}

// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Only handle POST requests
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode([
        'success' => false,
        'message' => 'Method not allowed'
    ]);
    exit();
}

// Get POST data
$data = json_decode(file_get_contents("php://input"), true);

// Validate input
if (!isset($data['name']) || !isset($data['email']) || !isset($data['username']) || !isset($data['password']) || !isset($data['role'])) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'message' => 'Missing required fields'
    ]);
    exit();
}

$name = sanitizeRegistrationInput($data['name']);
$email = sanitizeRegistrationInput($data['email']);
$username = sanitizeRegistrationInput($data['username']);
$password = $data['password'];
$role = sanitizeRegistrationInput($data['role']);
$phone = isset($data['phone']) ? sanitizeRegistrationInput($data['phone']) : '';
$institution = isset($data['institution']) ? sanitizeRegistrationInput($data['institution']) : '';
$department = isset($data['department']) ? sanitizeRegistrationInput($data['department']) : '';
$program = isset($data['program']) ? sanitizeRegistrationInput($data['program']) : '';
$id_number = isset($data['id_number']) ? sanitizeRegistrationInput($data['id_number']) : '';
$id_type = isset($data['id_type']) ? sanitizeRegistrationInput($data['id_type']) : '';
$security_question = isset($data['security_question']) ? sanitizeRegistrationInput($data['security_question']) : '';
$security_answer = isset($data['security_answer']) ? sanitizeRegistrationInput($data['security_answer']) : '';

// Validate role - allow student, staff, and other
$validRoles = ['student', 'staff', 'other'];
if (!in_array($role, $validRoles)) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'message' => 'Invalid role. Please select student, staff, or other.'
    ]);
    exit();
}

// Convert role to proper database format
$roleMapping = [
    'student' => 'Student',
    'staff' => 'Staff',
    'other' => 'Other'
];

$databaseRole = $roleMapping[$role] ?? 'Staff';

// Validate phone number format (Ghanaian format)
if (!empty($phone) && !preg_match('/^(\+233|0)[\d\s\-]{9,15}$/', $phone)) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'message' => 'Invalid phone number format. Please use Ghanaian format (+233 or 0 followed by digits).'
    ]);
    exit();
}

// Validate required fields based on role
if ($role === 'student' && (empty($institution) || empty($program))) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'message' => 'Students must provide university and program of study.'
    ]);
    exit();
}

if ($role === 'staff' && empty($department)) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'message' => 'Staff members must provide department.'
    ]);
    exit();
}

if ($role === 'other' && (empty($phone) || empty($id_number) || empty($id_type))) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'message' => 'Other users must provide phone number and ID information.'
    ]);
    exit();
}

// Validate security question and answer
if (empty($security_question) || empty($security_answer)) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'message' => 'Security question and answer are required.'
    ]);
    exit();
}

// Validate password length
if (strlen($password) < 6) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'message' => 'Password must be at least 6 characters long'
    ]);
    exit();
}

try {
    // Create database connection
    $database = new Database();
    $conn = $database->getConnection();

    // Check if username already exists
    $checkUserSql = "SELECT user_id FROM users WHERE username = :username";
    $checkUserStmt = $conn->prepare($checkUserSql);
    $checkUserStmt->bindParam(':username', $username);
    $checkUserStmt->execute();

    if ($checkUserStmt->rowCount() > 0) {
        http_response_code(409);
        echo json_encode([
            'success' => false,
            'message' => 'Username already exists'
        ]);
        exit();
    }

    // Check if email already exists
    $checkEmailSql = "SELECT user_id FROM users WHERE email = :email";
    $checkEmailStmt = $conn->prepare($checkEmailSql);
    $checkEmailStmt->bindParam(':email', $email);
    $checkEmailStmt->execute();

    if ($checkEmailStmt->rowCount() > 0) {
        http_response_code(409);
        echo json_encode([
            'success' => false,
            'message' => 'Email already exists'
        ]);
        exit();
    }

    // Hash password
    $passwordHash = password_hash($password, PASSWORD_DEFAULT);

    // Insert new user
    $insertSql = "INSERT INTO users (username, password_hash, name, email, phone, institution, department, program, id_number, id_type, security_question, security_answer, role, status) VALUES (:username, :password_hash, :name, :email, :phone, :institution, :department, :program, :id_number, :id_type, :security_question, :security_answer, :role, 'Active')";
    $insertStmt = $conn->prepare($insertSql);
    $insertStmt->bindParam(':username', $username);
    $insertStmt->bindParam(':password_hash', $passwordHash);
    $insertStmt->bindParam(':name', $name);
    $insertStmt->bindParam(':email', $email);
    $insertStmt->bindParam(':phone', $phone);
    $insertStmt->bindParam(':institution', $institution);
    $insertStmt->bindParam(':department', $department);
    $insertStmt->bindParam(':program', $program);
    $insertStmt->bindParam(':id_number', $id_number);
    $insertStmt->bindParam(':id_type', $id_type);
    $insertStmt->bindParam(':security_question', $security_question);
    $insertStmt->bindParam(':security_answer', $security_answer);
    $insertStmt->bindParam(':role', $databaseRole);

    if ($insertStmt->execute()) {
        $newUserId = $conn->lastInsertId();
        
        // Create corresponding member record for the new user
        $membershipType = 'Other'; // default
        switch ($databaseRole) {
            case 'Student':
                $membershipType = 'Student';
                break;
            case 'Staff':
                $membershipType = 'Staff';
                break;
            case 'Other':
                $membershipType = 'Other';
                break;
        }
        
        $insertMemberSql = "INSERT INTO members (name, email, phone, membership_type, department, staff_id, address, status, join_date, user_id) 
            VALUES (:name, :email, :phone, :membership_type, :department, :staff_id, :address, 'Active', CURDATE(), :user_id)";
        $insertMemberStmt = $conn->prepare($insertMemberSql);
        $insertMemberStmt->bindParam(':name', $name);
        $insertMemberStmt->bindParam(':email', $email);
        $insertMemberStmt->bindParam(':phone', $phone);
        $insertMemberStmt->bindParam(':membership_type', $membershipType);
        $insertMemberStmt->bindParam(':department', $department);
        $insertMemberStmt->bindParam(':staff_id', $id_number);
        $address = ''; // Address can be empty initially
        $insertMemberStmt->bindParam(':address', $address);
        $insertMemberStmt->bindParam(':user_id', $newUserId);
        
        if (!$insertMemberStmt->execute()) {
            error_log("Failed to create member record for user ID: {$newUserId}");
        }
        
        // Log registration activity
        logRegistrationActivity($conn, $newUserId, 'REGISTER', 'users', $newUserId, "User {$username} registered with role {$role}");

        http_response_code(201);
        echo json_encode([
            'success' => true,
            'message' => 'Account created successfully'
        ]);
    } else {
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'message' => 'Failed to create account'
        ]);
    }

} catch (Exception $e) {
    error_log("Registration error: " . $e->getMessage());
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


?>