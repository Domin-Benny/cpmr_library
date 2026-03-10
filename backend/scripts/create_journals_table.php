<?php
require_once __DIR__ . '/../config/database.php';

try {
    $db = new Database();
    $conn = $db->getConnection();

    $sql = "CREATE TABLE IF NOT EXISTS journals (
        journal_id INT PRIMARY KEY AUTO_INCREMENT,
        title VARCHAR(255) NOT NULL,
        authors VARCHAR(255),
        year YEAR,
        publisher VARCHAR(255),
        abstract TEXT,
        file_name VARCHAR(255) NOT NULL,
        original_name VARCHAR(255) NOT NULL,
        file_size INT,
        uploaded_by INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (uploaded_by) REFERENCES users(user_id) ON DELETE SET NULL
    ) ENGINE=InnoDB;";

    $conn->exec($sql);
    echo "Journals table created or already exists.\n";
} catch (Exception $e) {
    echo "Error creating journals table: " . $e->getMessage() . "\n";
    exit(1);
}
?>