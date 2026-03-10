<?php
// =============================================
// Authentication Helpers
// File: backend/api/auth_helper.php
// Description: Helper functions for authentication
// =============================================

/**
 * Validate JWT token (placeholder function)
 * In production, implement proper JWT validation
 * @param string $token - JWT token
 * @return array|bool - Decoded token data or false
 */
function validateToken($token) {
    error_log("validateToken called with token: " . substr($token, 0, 20) . "...");
    
    if (empty($token)) {
        error_log("validateToken: Empty token");
        return false;
    }

    // Try to decode a base64-encoded JSON token produced by login.php
    $decoded = base64_decode($token, true);
    error_log("validateToken: Decoded token length: " . strlen($decoded));
    
    if ($decoded !== false) {
        $data = json_decode($decoded, true);
        error_log("validateToken: Token data: " . json_encode($data));
        
        if (is_array($data) && isset($data['user_id'])) {
            // Basic expiration check
            if (isset($data['exp']) && time() > (int)$data['exp']) {
                error_log("validateToken: Token expired. Current time: " . time() . ", Exp time: " . $data['exp']);
                return false;
            }
            // Normalize role to match DB values if provided
            if (isset($data['role'])) {
                $data['role'] = ucfirst(strtolower($data['role']));
            }
            error_log("validateToken: Valid token for user_id: " . $data['user_id']);
            return $data;
        } else {
            error_log("validateToken: Invalid token structure");
        }
    } else {
        error_log("validateToken: Failed to decode token");
    }

    // Fallback: token not in expected format
    return false;
}

/**
 * Check if request is authenticated
 * @return array|bool - User data or false
 */
function isAuthenticated() {
    error_log("isAuthenticated called");
    
    // Helper used by nearly every API; we enforce not only a valid token but
    // also that the corresponding user account is still active. If the status
    // has changed (e.g. suspended while the user was logged in), we return
    // false *and* emit a 403 response so the frontend can take appropriate
    // action (logout, display message, etc.).
    
    // internal helper to validate the token and then check DB status
    $checkToken = function($token) {
        $result = validateToken($token);
        if (!$result) {
            return false;
        }
        // query database for current status
        try {
            $database = new Database();
            $conn = $database->getConnection();
            $sql = "SELECT status FROM users WHERE user_id = :uid LIMIT 1";
            $stmt = $conn->prepare($sql);
            $stmt->bindParam(':uid', $result['user_id'], PDO::PARAM_INT);
            $stmt->execute();
            if ($stmt->rowCount() > 0) {
                $row = $stmt->fetch(PDO::FETCH_ASSOC);
                $status = $row['status'] ?? 'Inactive';
                if ($status !== 'Active') {
                    http_response_code(403);
                    echo json_encode([
                        'success' => false,
                        'message' => "Account {$status}.",
                        'account_status' => $status
                    ]);
                    return false;
                }
            }
        } catch (Exception $e) {
            error_log("isAuthenticated status check error: " . $e->getMessage());
            // if DB fails we still allow the request to proceed (will fail later)
        } finally {
            if (isset($conn)) {
                $database->closeConnection();
            }
        }
        return $result;
    };
    
    // Handle CLI environment
    if (php_sapi_name() === 'cli') {
        error_log("isAuthenticated: CLI environment");
        if (isset($_SERVER['HTTP_AUTHORIZATION'])) {
            $authHeader = $_SERVER['HTTP_AUTHORIZATION'];
            $token = str_replace('Bearer ', '', $authHeader);
            error_log("isAuthenticated: CLI token found: " . substr($token, 0, 20) . "...");
            $validated = $checkToken($token);
            error_log("isAuthenticated: CLI validation result: " . ($validated ? "valid" : "invalid"));
            return $validated;
        }
        error_log("isAuthenticated: No CLI auth header");
        return false;
    }
    
    // Handle web environment
    $headers = getallheaders();
    error_log("isAuthenticated: Web headers: " . json_encode(array_keys($headers)));
    
    // Check Authorization header (standard)
    if (isset($headers['Authorization'])) {
        $authHeader = $headers['Authorization'];
        $token = str_replace('Bearer ', '', $authHeader);
        error_log("isAuthenticated: Web token found: " . substr($token, 0, 20) . "...");
        $validated = $checkToken($token);
        error_log("isAuthenticated: Web validation result: " . ($validated ? "valid" : "invalid"));
        return $validated;
    }
    
    // Fallback for cases where headers might be differently named
    foreach ($headers as $name => $value) {
        if (strtolower($name) === 'authorization') {
            $token = str_replace('Bearer ', '', $value);
            error_log("isAuthenticated: Fallback token found: " . substr($token, 0, 20) . "...");
            $validated = $checkToken($token);
            error_log("isAuthenticated: Fallback validation result: " . ($validated ? "valid" : "invalid"));
            return $validated;
        }
    }
    
    error_log("isAuthenticated: No authorization header found");
    return false;
}

/**
 * Require that a user has one of the allowed roles. Returns true if allowed,
 * otherwise emits a 403 JSON response and returns false.
 * @param array|false $user
 * @param array $allowedRoles
 * @return bool
 */
function requireRole($user, $allowedRoles = []) {
    if (!$user || empty($allowedRoles)) {
        http_response_code(403);
        echo json_encode([
            'success' => false,
            'message' => 'Forbidden'
        ]);
        return false;
    }

    $userRole = isset($user['role']) ? ucfirst(strtolower($user['role'])) : '';
    foreach ($allowedRoles as $r) {
        if ($userRole === ucfirst(strtolower($r))) {
            return true;
        }
    }

    http_response_code(403);
    echo json_encode([
        'success' => false,
        'message' => 'Insufficient permissions'
    ]);
    return false;
}
?>