<?php
// =============================================
// Account Status Checker API
// File: backend/api/check_status.php
// Description: Return the current status of the authenticated user
// =============================================

header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");

require_once '../../config/database.php';
require_once 'auth_helper.php';

// Handle preflight
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Authenticate. isAuthenticated() will also check that the account is Active
$user = isAuthenticated();
if (!$user) {
    // isAuthenticated already sent the appropriate JSON/HTTP status
    // (401 if no token; 403 if suspended/inactive)
    exit();
}

// Return current status (should always be Active at this point)
$status = isset($user['status']) ? $user['status'] : 'Active';
echo json_encode([
    'success' => true,
    'status' => $status
]);
