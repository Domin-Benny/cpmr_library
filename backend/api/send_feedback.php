<?php
// Simple feedback endpoint
header('Content-Type: application/json');
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'message' => 'Method not allowed']);
    exit;
}

$data = [];
// Accept JSON body
$raw = file_get_contents('php://input');
$json = json_decode($raw, true);
if ($json) {
    $data = $json;
} else {
    $data = $_POST;
}

$name = isset($data['name']) ? strip_tags(trim($data['name'])) : 'Anonymous';
$email = isset($data['email']) ? filter_var(trim($data['email']), FILTER_VALIDATE_EMAIL) : false;
$subject = isset($data['subject']) ? strip_tags(trim($data['subject'])) : 'Feedback from site';
$message = isset($data['message']) ? trim($data['message']) : '';

if (!$message) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'message' => 'Message is required']);
    exit;
}

$to = 'cpmrlms@outlook.com';
$fullSubject = '[' . $_SERVER['HTTP_HOST'] . '] ' . $subject;
$body = "Name: $name\n";
$body .= $email ? "Email: $email\n" : "Email: (not provided)\n";
$body .= "\nMessage:\n" . $message . "\n";

$headers = "From: no-reply@" . $_SERVER['SERVER_NAME'] . "\r\n";
if ($email) {
    $headers .= "Reply-To: $email\r\n";
}

$sent = false;
try {
    $sent = mail($to, $fullSubject, $body, $headers);
} catch (Exception $e) {
    $sent = false;
}

if ($sent) {
    echo json_encode(['ok' => true, 'message' => 'Feedback sent']);
} else {
    http_response_code(500);
    echo json_encode(['ok' => false, 'message' => 'Failed to send feedback (check server mail configuration)']);
}

?>
