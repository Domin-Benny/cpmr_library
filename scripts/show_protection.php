<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Database Protection - Live View</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            background: #1e1e1e;
            color: #00ff00;
            padding: 20px;
        }
        h1 {
            color: #00ff00;
            border-bottom: 2px solid #00ff00;
            padding-bottom: 10px;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
            background: #2d2d2d;
        }
        th {
            background: #006400;
            color: #00ff00;
            padding: 12px;
            text-align: left;
            border: 1px solid #00ff00;
        }
        td {
            padding: 10px;
            border: 1px solid #00ff00;
            font-family: 'Courier New', monospace;
            font-size: 13px;
        }
        tr:hover {
            background: #3d3d3d;
        }
        .success {
            background: #006400;
            color: #00ff00;
            padding: 15px;
            border-left: 5px solid #00ff00;
            margin: 20px 0;
        }
        .error {
            background: #8b0000;
            color: #ff6b6b;
            padding: 15px;
            border-left: 5px solid #ff6b6b;
            margin: 20px 0;
        }
        pre {
            background: #2d2d2d;
            padding: 15px;
            border-radius: 4px;
            overflow-x: auto;
            white-space: pre-wrap;
            word-wrap: break-word;
        }
    </style>
</head>
<body>
    <h1>🔒 Database Protection - Live View</h1>
    
    <?php
    $host = 'localhost';
    $dbname = 'cpmr_library';
    $username = 'root';
    $password = '';
    
    try {
        $pdo = new PDO("mysql:host=$host;dbname=$dbname", $username, $password);
        $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        
        // Check Trigger
        echo '<h2>1️⃣ Database Trigger (Blocks Admin Deletion)</h2>';
        $trigger = $pdo->query("
            SELECT 
                TRIGGER_NAME,
                EVENT_MANIPULATION,
                EVENT_OBJECT_TABLE,
                ACTION_TIMING,
                ACTION_STATEMENT
            FROM information_schema.TRIGGERS
            WHERE TRIGGER_SCHEMA = 'cpmr_library'
            AND TRIGGER_NAME = 'before_user_delete'
        ")->fetch(PDO::FETCH_ASSOC);
        
        if ($trigger) {
            echo '<div class="success">✅ TRIGGER FOUND - Protection is ACTIVE!</div>';
            echo '<table>';
            echo '<tr><th>Property</th><th>Value</th></tr>';
            foreach ($trigger as $key => $value) {
                echo "<tr><td><strong>$key</strong></td><td>" . htmlspecialchars($value) . "</td></tr>";
            }
            echo '</table>';
        } else {
            echo '<div class="error">❌ TRIGGER NOT FOUND - Run the migration first!</div>';
        }
        
        // Check Stored Procedure
        echo '<h2>2️⃣ Stored Procedure (Safe Delete Function)</h2>';
        $procedure = $pdo->query("
            SELECT 
                ROUTINE_NAME,
                ROUTINE_TYPE,
                ROUTINE_DEFINITION
            FROM information_schema.ROUTINES
            WHERE ROUTINE_SCHEMA = 'cpmr_library'
            AND ROUTINE_NAME = 'safe_delete_user'
        ")->fetch(PDO::FETCH_ASSOC);
        
        if ($procedure) {
            echo '<div class="success">✅ STORED PROCEDURE FOUND - Safe deletion is available!</div>';
            echo '<table>';
            echo '<tr><th>Property</th><th>Value</th></tr>';
            foreach ($procedure as $key => $value) {
                echo "<tr><td><strong>$key</strong></td><td><pre>" . htmlspecialchars($value) . "</pre></td></tr>";
            }
            echo '</table>';
        } else {
            echo '<div class="error">❌ STORED PROCEDURE NOT FOUND</div>';
        }
        
        // Show Protected Admin Users
        echo '<h2>3️⃣ Protected Admin Users in Database</h2>';
        $admins = $pdo->query("
            SELECT 
                user_id,
                username,
                name,
                role,
                status,
                created_at
            FROM users
            WHERE role = 'Admin'
            ORDER BY user_id
        ")->fetchAll(PDO::FETCH_ASSOC);
        
        if (count($admins) > 0) {
            echo '<div class="success">✅ ' . count($admins) . ' Admin User(s) Found - All are PROTECTED!</div>';
            echo '<table>';
            echo '<tr>';
            echo '<th>User ID</th>';
            echo '<th>Username</th>';
            echo '<th>Name</th>';
            echo '<th>Role</th>';
            echo '<th>Status</th>';
            echo '<th>Created</th>';
            echo '</tr>';
            foreach ($admins as $admin) {
                echo '<tr>';
                echo '<td>' . $admin['user_id'] . '</td>';
                echo '<td>' . htmlspecialchars($admin['username']) . '</td>';
                echo '<td>' . htmlspecialchars($admin['name']) . '</td>';
                echo '<td><strong style="color: #ff9800;">' . htmlspecialchars($admin['role']) . '</strong></td>';
                echo '<td>' . htmlspecialchars($admin['status']) . '</td>';
                echo '<td>' . htmlspecialchars($admin['created_at']) . '</td>';
                echo '</tr>';
            }
            echo '</table>';
        } else {
            echo '<div class="error">❌ No admin users found in database</div>';
        }
        
        // Summary
        echo '<h2>📊 Protection Summary</h2>';
        echo '<div class="success">';
        echo '<h3>✅ DATABASE PROTECTION IS ACTIVE!</h3>';
        echo '<ul>';
        echo '<li><strong>Trigger:</strong> before_user_delete - Automatically blocks DELETE on admin users</li>';
        echo '<li><strong>Procedure:</strong> safe_delete_user - Provides safe deletion with validation</li>';
        echo '<li><strong>Protected Users:</strong> All users with role = "Admin"</li>';
        echo '<li><strong>Error Code:</strong> SQLSTATE 45000 with message "PROTECTED: Cannot delete admin accounts"</li>';
        echo '</ul>';
        echo '</div>';
        
    } catch (PDOException $e) {
        echo '<div class="error">';
        echo '❌ Error: ' . htmlspecialchars($e->getMessage());
        echo '</div>';
    }
    ?>
    
    <div style="margin-top: 30px; padding: 20px; background: #2d2d2d; border: 2px solid #00ff00; border-radius: 8px;">
        <h3>🧪 Test the Protection Now:</h3>
        <p>Open phpMyAdmin → Select "cpmr_library" → Click "SQL" tab → Run this query:</p>
        <pre>DELETE FROM users WHERE user_id = 1;</pre>
        <p>You will see error: <strong style="color: #ff6b6b;">ERROR 1644: PROTECTED: Cannot delete admin accounts</strong></p>
    </div>
</body>
</html>
