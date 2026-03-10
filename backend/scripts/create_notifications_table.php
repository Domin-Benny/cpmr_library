<?php
require_once __DIR__ . '/../config/database.php';

try {
    $db = new Database();
    $conn = $db->getConnection();

    $sql = "CREATE TABLE IF NOT EXISTS notifications (
        notification_id INT PRIMARY KEY AUTO_INCREMENT,
        user_id INT NOT NULL,
        title VARCHAR(255) NOT NULL,
        message TEXT,
        is_read TINYINT(1) DEFAULT 0,
        link VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
    ) ENGINE=InnoDB;";

    $conn->exec($sql);
    echo "Notifications table created or already exists.\n";
} catch (Exception $e) {
    echo "Error creating notifications table: " . $e->getMessage() . "\n";
    exit(1);
}
?>