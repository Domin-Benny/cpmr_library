<?php
require_once __DIR__ . '/../config/database.php';

try {
    $db = new Database();
    $conn = $db->getConnection();

    $sql = "CREATE TABLE IF NOT EXISTS requests (
        request_id INT PRIMARY KEY AUTO_INCREMENT,
        requester_user_id INT DEFAULT NULL,
        book_id INT NOT NULL,
        requested_days INT DEFAULT 14,
        message TEXT,
        status ENUM('Pending','Approved','Declined') DEFAULT 'Pending',
        decided_by INT DEFAULT NULL,
        decided_at DATETIME,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (requester_user_id) REFERENCES users(user_id) ON DELETE SET NULL,
        FOREIGN KEY (book_id) REFERENCES books(book_id) ON DELETE CASCADE,
        FOREIGN KEY (decided_by) REFERENCES users(user_id) ON DELETE SET NULL
    ) ENGINE=InnoDB;";

    $conn->exec($sql);
    echo "Requests table created or already exists.\n";
} catch (Exception $e) {
    echo "Error creating requests table: " . $e->getMessage() . "\n";
    exit(1);
}
?>