<?php
// Debug script to check the upload endpoint
echo "Upload endpoint test\n";

// Check if required files exist
$configPath = __DIR__ . '/backend/config/database.php';
$functionsPath = __DIR__ . '/backend/includes/functions.php';
$uploadScript = __DIR__ . '/backend/api/upload_profile_picture.php';

echo "Checking file existence:\n";
echo "Database config exists: " . (file_exists($configPath) ? 'YES' : 'NO') . "\n";
echo "Functions file exists: " . (file_exists($functionsPath) ? 'YES' : 'NO') . "\n";
echo "Upload script exists: " . (file_exists($uploadScript) ? 'YES' : 'NO') . "\n";

// Check file permissions
echo "\nFile permissions:\n";
echo "Database config readable: " . (is_readable($configPath) ? 'YES' : 'NO') . "\n";
echo "Functions file readable: " . (is_readable($functionsPath) ? 'YES' : 'NO') . "\n";
echo "Upload script readable: " . (is_readable($uploadScript) ? 'YES' : 'NO') . "\n";

// Check if we can include the files
echo "\nTesting includes:\n";
try {
    require_once $configPath;
    echo "Database config included successfully\n";
} catch (Exception $e) {
    echo "Error including database config: " . $e->getMessage() . "\n";
}

try {
    require_once $functionsPath;
    echo "Functions file included successfully\n";
} catch (Exception $e) {
    echo "Error including functions file: " . $e->getMessage() . "\n";
}

echo "\nScript execution completed successfully.\n";
?>