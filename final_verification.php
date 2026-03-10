<?php
// Final verification test
echo "=== FINAL LOGIN VERIFICATION ===\n";

$testUsers = [
    ['username' => 'admin', 'password' => 'admin123', 'expected_role' => 'Admin'],
    ['username' => 'librarian', 'password' => 'admin123', 'expected_role' => 'Librarian'],
    ['username' => 'staff', 'password' => 'admin123', 'expected_role' => 'Staff'],
    ['username' => 'student', 'password' => 'admin123', 'expected_role' => 'Student']
];

$successCount = 0;
$totalTests = count($testUsers);

foreach ($testUsers as $testUser) {
    echo "\nTesting: " . $testUser['username'] . " (" . $testUser['expected_role'] . ")\n";
    
    $data = json_encode([
        'username' => $testUser['username'],
        'password' => $testUser['password']
    ]);
    
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, 'http://localhost/cpmr-library/backend/api/login.php');
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, $data);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Content-Type: application/json',
        'Content-Length: ' . strlen($data)
    ]);
    curl_setopt($ch, CURLOPT_TIMEOUT, 30);
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    echo "HTTP Status: " . $httpCode . "\n";
    
    if ($httpCode === 200) {
        $responseData = json_decode($response, true);
        if ($responseData && $responseData['success']) {
            $user = $responseData['user'];
            if ($user['role'] === $testUser['expected_role']) {
                echo "✓ SUCCESS: Login successful for " . $user['username'] . " as " . $user['role'] . "\n";
                $successCount++;
            } else {
                echo "✗ FAILED: Role mismatch. Expected " . $testUser['expected_role'] . ", got " . $user['role'] . "\n";
            }
        } else {
            echo "✗ FAILED: Login unsuccessful\n";
            echo "Response: " . $response . "\n";
        }
    } else {
        echo "✗ FAILED: HTTP error " . $httpCode . "\n";
        echo "Response: " . $response . "\n";
    }
}

echo "\n=== FINAL RESULTS ===\n";
echo "Successful logins: " . $successCount . "/" . $totalTests . "\n";

if ($successCount === $totalTests) {
    echo "🎉 ALL TESTS PASSED! Login system is working correctly.\n";
} else {
    echo "❌ Some tests failed. Please check the errors above.\n";
}
?>