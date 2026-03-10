<?php
require_once __DIR__ . '/../config/database.php';
try {
    $db = new Database();
    $conn = $db->getConnection();

    $tables = ['users','books'];
    foreach ($tables as $t) {
        $stmt = $conn->prepare("SHOW TABLE STATUS WHERE Name = :t");
        $stmt->bindParam(':t', $t);
        $stmt->execute();
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        if ($row) {
            echo "Table: {$t}\n";
            echo "Engine: " . ($row['Engine'] ?? 'N/A') . "\n";
            echo "Comment: " . ($row['Comment'] ?? '') . "\n\n";
        } else {
            echo "Table {$t} not found\n";
        }
    }
} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
?>