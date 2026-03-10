<?php
// =============================================
// Authentication API
// File: backend/api/login.php
// Description: Handle user login and authentication
// =============================================

header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");

// Use absolute path for web server compatibility
$basePath = __DIR__ . '/../../';
require_once $basePath . 'config/database.php';

// Ensure sanitizeInput function is available
if (!function_exists('sanitizeInput')) {
    function sanitizeInput($data) {
        if (is_array($data)) {
            return array_map('sanitizeInput', $data);
        }
        return htmlspecialchars(strip_tags(trim($data)));
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
if (!isset($data['username']) || !isset($data['password'])) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'message' => 'Username and password are required'
    ]);
    exit();
}

$username = sanitizeInput($data['username']);
$password = $data['password'];

try {
    // Create database connection
    $database = new Database();
    $conn = $database->getConnection();

    // Check if user exists - try different column names (without status filter)
    // include all profile-related columns so the frontend can pre-populate the profile page
    $sql = "SELECT user_id, username, password_hash, name, email, role, status,
                   phone, institution, department, program, id_number, id_type,
                   profile_picture, created_at, last_login
            FROM users 
            WHERE username = :username";
    
    $stmt = $conn->prepare($sql);
    $stmt->bindParam(':username', $username);
    $stmt->execute();
    
    // If no results, try with email field
    if ($stmt->rowCount() == 0) {
        $sql = "SELECT user_id, username, password_hash, name, email, role, status,
                       phone, institution, department, program, id_number, id_type,
                       profile_picture, created_at, last_login
                FROM users 
                WHERE email = :username";
        
        $stmt = $conn->prepare($sql);
        $stmt->bindParam(':username', $username);
        $stmt->execute();
    }
    
    if ($stmt->rowCount() > 0) {
        $user = $stmt->fetch(PDO::FETCH_ASSOC);
        
        // **AUTO-SYNC FALLBACK** (Only for reactivation)
        // If the user's row shows Suspended but members table shows Active,
        // repair the user row during login. This prevents the "unsuspend but still can't login" scenario.
        // NOTE: We do NOT sync suspensions - suspended users should be blocked at login.
        try {
            $syncSql = "SELECT status FROM members WHERE email = :email LIMIT 1";
            $syncStmt = $conn->prepare($syncSql);
            $syncStmt->bindParam(':email', $user['email']);
            $syncStmt->execute();
            if ($syncStmt->rowCount() > 0) {
                $memberRec = $syncStmt->fetch(PDO::FETCH_ASSOC);
                // Only sync if member is Active and user is not - this reactivates unsuspended users
                if ($memberRec['status'] === 'Active' && $user['status'] !== 'Active') {
                    // keep user table consistent by reactivating
                    $updateSql = "UPDATE users SET status = 'Active', updated_at = NOW() WHERE user_id = :user_id";
                    $updateStmt = $conn->prepare($updateSql);
                    $updateStmt->bindParam(':user_id', $user['user_id'], PDO::PARAM_INT);
                    $updateStmt->execute();
                    error_log("Login sync: reactivated user {$user['user_id']} (was {$user['status']})");
                    $user['status'] = 'Active';
                }
                // If member is Suspended/Inactive, we don't sync - just let the status check below block login
            }
        } catch (Exception $e) {
            error_log("Login sync error: " . $e->getMessage());
        }
        
        // CRITICAL: Check account status BEFORE verifying password
        // Handle null/empty status as inactive
        $userStatus = $user['status'] ?? 'Inactive';
        
        if ($userStatus !== 'Active') {
            $statusMessage = "";

            if ($userStatus === 'Suspended') {
                // give suspended users a clear, user‑friendly warning including the word
                // "suspended" so that the verify tool and end‑users can recognise it easily
                $statusMessage = "Your account has been suspended. You cannot access the system while suspended. Please contact the administrator for assistance.";
            } elseif ($userStatus === 'Inactive' || empty($userStatus)) {
                $statusMessage = "Your account is inactive. Contact administrator for assistance.";
            } else {
                $statusMessage = "Your account status is '{$userStatus}'. Contact administrator for assistance.";
            }
            
            http_response_code(403);
            echo json_encode([
                'success' => false,
                'message' => $statusMessage,
                'account_status' => $userStatus,
                'show_admin_contact' => true
            ]);
            exit();
        }
        
        // Verify password (using password_verify for bcrypt)
        if (password_verify($password, $user['password_hash'])) {
            // Update last login time
            $updateSql = "UPDATE users SET last_login = NOW() WHERE user_id = :user_id";
            $updateStmt = $conn->prepare($updateSql);
            $updateStmt->bindParam(':user_id', $user['user_id']);
            $updateStmt->execute();
            
            // Generate token (simplified): encode user info as base64 JSON
            $tokenPayload = [
                'user_id' => $user['user_id'],
                'username' => $user['username'],
                'role' => $user['role'],
                'exp' => time() + 60 * 60 // 1 hour expiration
            ];
            $token = base64_encode(json_encode($tokenPayload));
            
            // Log login activity (if function exists)
            if (function_exists('logActivity')) {
                logActivity($conn, $user['user_id'], 'LOGIN', 'users', $user['user_id'], 'User logged in');
            }
            
            // Return success response
            http_response_code(200);
            echo json_encode([
                'success' => true,
                'message' => 'Login successful',
                'token' => $token,
                'user' => [
                    'id' => $user['user_id'],
                    'username' => $user['username'],
                    'name' => $user['name'],
                    'email' => $user['email'],
                    'role' => $user['role'],
                    'status' => $user['status'] ?? 'Active',
                    'phone' => $user['phone'] ?? '',
                    'institution' => $user['institution'] ?? '',
                    'department' => $user['department'] ?? '',
                    'program' => $user['program'] ?? '',
                    'id_number' => $user['id_number'] ?? '',
                    'id_type' => $user['id_type'] ?? '',
                    'profile_picture' => $user['profile_picture'] ?? null,
                    'created_at' => $user['created_at'] ?? date('Y-m-d H:i:s'),
                    'last_login' => date('Y-m-d H:i:s')
                ]
            ]);
        } else {
            // Invalid password
            http_response_code(401);
            echo json_encode([
                'success' => false,
                'message' => 'Invalid username or password'
            ]);
        }
    } else {
        // User not found
        http_response_code(401);
        echo json_encode([
            'success' => false,
            'message' => 'Invalid username or password'
        ]);
    }
} catch (Exception $e) {
    error_log("Login error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Internal server error'
    ]);
} finally {
    // Only try to close connection if it was successfully created
    if (isset($conn) && $conn) {
        try {
            // Check if closeConnection method exists
            if (method_exists($database, 'closeConnection')) {
                $database->closeConnection();
            }
        } catch (Exception $e) {
            // Log error but don't fail the request
            error_log("Error closing database connection: " . $e->getMessage());
        }
    }
}
?>