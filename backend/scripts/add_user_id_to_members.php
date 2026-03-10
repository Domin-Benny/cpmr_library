<?php
require_once __DIR__ . "/../config/database.php";

try {
    $db = new Database();
    $conn = $db->getConnection();
    
    // Add user_id column to members table
    $sql = "ALTER TABLE members ADD COLUMN user_id INT UNIQUE DEFAULT NULL, ADD FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE SET NULL";
    $conn->exec($sql);
    
    echo "Column user_id added to members table successfully\n";
    
    // Try to link existing members to users based on matching email
    echo "Linking existing members to users...\n";
    
    $stmt = $conn->prepare("SELECT member_id, email FROM members WHERE user_id IS NULL");
    $stmt->execute();
    $members = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    $linkedCount = 0;
    foreach ($members as $member) {
        $userStmt = $conn->prepare("SELECT user_id FROM users WHERE email = ?");
        $userStmt->execute([$member['email']]);
        $user = $userStmt->fetch(PDO::FETCH_ASSOC);
        
        if ($user) {
            $updateStmt = $conn->prepare("UPDATE members SET user_id = ? WHERE member_id = ?");
            $updateStmt->execute([$user['user_id'], $member['member_id']]);
            echo "Linked member {$member['member_id']} to user {$user['user_id']}\n";
            $linkedCount++;
        }
    }
    
    echo "Successfully linked {$linkedCount} members to users\n";
    echo "User ID linking completed!\n";
    
} catch (Exception $e) {
    // Check if column already exists
    if (strpos($e->getMessage(), 'Duplicate column name') !== false) {
        echo "Column user_id already exists in members table\n";
    } else {
        echo "Error: " . $e->getMessage() . "\n";
    }
}
?>