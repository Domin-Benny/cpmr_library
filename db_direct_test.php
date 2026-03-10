<?php
// Direct database test
echo "=== DATABASE CONNECTION TEST ===\n";

try {
    echo "1. Including database config...\n";
    require_once 'backend/config/database.php';
    echo "✓ Database config included\n";
    
    echo "2. Creating database object...\n";
    $database = new Database();
    echo "✓ Database object created\n";
    
    echo "3. Getting connection...\n";
    $conn = $database->getConnection();
    echo "✓ Database connection established\n";
    
    echo "4. Running simple query...\n";
    $stmt = $conn->query("SELECT 1 as test");
    $result = $stmt->fetch();
    echo "✓ Query successful: " . $result['test'] . "\n";
    
    echo "5. Checking users table...\n";
    $stmt = $conn->query("SHOW TABLES LIKE 'users'");
    echo "✓ Users table exists: " . ($stmt->rowCount() > 0 ? "YES" : "NO") . "\n";
    
    if ($stmt->rowCount() > 0) {
        echo "6. Counting users...\n";
        $stmt = $conn->query("SELECT COUNT(*) as count FROM users");
        $count = $stmt->fetch()['count'];
        echo "✓ Users found: " . $count . "\n";
        
        echo "7. Sample user data...\n";
        $stmt = $conn->query("SELECT user_id, username, name, email, role, password_hash FROM users LIMIT 1");
        $user = $stmt->fetch(PDO::FETCH_ASSOC);
        if ($user) {
            echo "✓ Sample user: " . $user['username'] . " (" . $user['role'] . ")\n";
            echo "  Password hash: " . substr($user['password_hash'], 0, 20) . "...\n";
        }
    }
    
    echo "8. Closing connection...\n";
    $database->closeConnection();
    echo "✓ Connection closed\n";
    
    echo "\n=== ALL TESTS PASSED ===\n";
    
} catch (Exception $e) {
    echo "❌ ERROR: " . $e->getMessage() . "\n";
    echo "Stack trace: " . $e->getTraceAsString() . "\n";
}
?>