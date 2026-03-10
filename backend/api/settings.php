<?php
// =============================================
// Settings API Endpoint
// File: backend/api/settings.php
// Description: Handle system settings operations
// =============================================

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

require_once '../../config/database.php';
require_once 'auth_helper.php';

// Check authentication for POST requests
$user = null;
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    error_log("Settings API: POST request - checking authentication");
    
    $user = isAuthenticated();
    if (!$user) {
        error_log("Settings API: POST - Authentication failed");
        http_response_code(401);
        echo json_encode([
            'success' => false,
            'message' => 'Unauthorized access - authentication required'
        ]);
        exit();
    }
    
    // Only allow admin users to modify settings
    error_log("Settings API: POST - User role: " . ($user['role'] ?? 'unknown'));
    if (!requireRole($user, ['Admin'])) {
        error_log("Settings API: POST - Authorization failed, user is not Admin");
        exit(); // requireRole handles the response
    }
    error_log("Settings API: POST - Authorization successful");
} else {
    // For GET requests, authentication is optional
    $user = isAuthenticated();
    if (!$user) {
        error_log("Settings API: GET - No authentication, allowing public access");
    }
}

$database = new Database();
$conn = $database->getConnection();

try {
    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        // Get all settings
        $sql = "SELECT setting_key, setting_value, description FROM system_settings ORDER BY setting_key";
        $stmt = $conn->prepare($sql);
        $stmt->execute();
        $settings = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        // Convert to key-value pairs for easier frontend use
        $settingsData = [];
        foreach ($settings as $setting) {
            $settingsData[$setting['setting_key']] = $setting['setting_value'];
        }
        
        echo json_encode([
            'success' => true,
            'data' => $settingsData,
            'message' => 'Settings retrieved successfully'
        ]);
        
    } elseif ($_SERVER['REQUEST_METHOD'] === 'POST') {
        // Update settings
        $input = json_decode(file_get_contents('php://input'), true);
        
        if (!$input || !is_array($input)) {
            http_response_code(400);
            echo json_encode([
                'success' => false,
                'message' => 'Invalid input data'
            ]);
            exit();
        }
        
        // Validate required settings
        $requiredSettings = [
            'library_name',
            'max_borrow_days', 
            'max_books_per_member',
            'late_fee_per_day',
            'enable_email_reminders',
            'reminder_days_before'
        ];
        
        foreach ($requiredSettings as $setting) {
            if (!isset($input[$setting])) {
                http_response_code(400);
                echo json_encode([
                    'success' => false,
                    'message' => "Missing required setting: $setting"
                ]);
                exit();
            }
        }
        
        // Start transaction
        $conn->beginTransaction();
        
        try {
            // Update each setting
            $updateSql = "UPDATE system_settings SET setting_value = :value WHERE setting_key = :key";
            $updateStmt = $conn->prepare($updateSql);
            
            foreach ($input as $key => $value) {
                // Validate numeric values
                if (in_array($key, ['max_borrow_days', 'max_books_per_member', 'reminder_days_before'])) {
                    if (!is_numeric($value) || intval($value) <= 0) {
                        throw new Exception("Invalid value for $key: must be a positive number");
                    }
                    $value = intval($value);
                } elseif ($key === 'late_fee_per_day') {
                    if (!is_numeric($value) || floatval($value) < 0) {
                        throw new Exception("Invalid value for $key: must be a non-negative number");
                    }
                    $value = number_format(floatval($value), 2, '.', '');
                } elseif ($key === 'enable_email_reminders') {
                    if (!in_array($value, ['yes', 'no'])) {
                        throw new Exception("Invalid value for $key: must be 'yes' or 'no'");
                    }
                }
                
                $updateStmt->bindParam(':key', $key);
                $updateStmt->bindParam(':value', $value);
                $updateStmt->execute();
            }
            
            // Commit transaction
            $conn->commit();
            
            // Log the activity
            logActivity($conn, $user['user_id'], 'UPDATE', 'system_settings', 0, 'Updated system settings');
            
            echo json_encode([
                'success' => true,
                'message' => 'Settings updated successfully',
                'data' => $input
            ]);
            
        } catch (Exception $e) {
            // Rollback transaction on error
            $conn->rollBack();
            throw $e;
        }
        
    } else {
        http_response_code(405);
        echo json_encode([
            'success' => false,
            'message' => 'Method not allowed'
        ]);
    }
    
} catch (Exception $e) {
    error_log("Settings API Error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Internal server error: ' . $e->getMessage()
    ]);
}

$database->closeConnection();
?>