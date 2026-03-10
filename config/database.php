<?php
// =============================================
// Database Configuration
// File: backend/config/database.php
// Description: Database connection settings
// =============================================

class Database {
    private $host;
    private $db_name;
    private $username;
    private $password;
    private $port;
    private $conn;

    public function __construct() {
        $this->host = getenv("DB_HOST") ?: "localhost";
        $this->db_name = getenv("DB_NAME") ?: "cpmr_library";
        $this->username = getenv("DB_USER") ?: "root";
        $this->password = getenv("DB_PASS") ?: "";
        $this->port = getenv("DB_PORT") ?: "3306";
    }

    // Get database connection
    public function getConnection() {
        $this->conn = null;

        try {
            $dsn = "mysql:host={$this->host};port={$this->port};dbname={$this->db_name}";
            $this->conn = new PDO($dsn, $this->username, $this->password);
            $this->conn->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
            $this->conn->exec("set names utf8");
        } catch(PDOException $exception) {
            // Show the exact error for debugging
            error_log("Connection error: " . $exception->getMessage());
            die("❌ Database connection failed: " . $exception->getMessage());
        }

        return $this->conn;
    }

    // Close database connection
    public function closeConnection() {
        $this->conn = null;
    }
}

// =============================================
// Helper Functions for Database Operations
// =============================================

/**
 * Sanitize input data
 * @param mixed $data - Input data to sanitize
 * @return mixed - Sanitized data
 */
function sanitizeInput($data) {
    if (is_array($data)) {
        return array_map('sanitizeInput', $data);
    }
    return htmlspecialchars(strip_tags(trim($data)));
}

/**
 * Prepare SQL query with parameters
 * @param PDO $conn - Database connection
 * @param string $sql - SQL query
 * @param array $params - Query parameters
 * @return PDOStatement - Prepared statement
 */
function prepareQuery($conn, $sql, $params = []) {
    $stmt = $conn->prepare($sql);
    
    foreach ($params as $key => $value) {
        $paramType = PDO::PARAM_STR;
        
        if (is_int($value)) {
            $paramType = PDO::PARAM_INT;
        } elseif (is_bool($value)) {
            $paramType = PDO::PARAM_BOOL;
        } elseif (is_null($value)) {
            $paramType = PDO::PARAM_NULL;
        }
        
        $stmt->bindValue(":$key", $value, $paramType);
    }
    
    return $stmt;
}

/**
 * Execute query and return results
 * @param PDO $conn - Database connection
 * @param string $sql - SQL query
 * @param array $params - Query parameters
 * @param string $fetchMode - Fetch mode (fetchAll or fetch)
 * @return array - Query results
 */
function executeQuery($conn, $sql, $params = [], $fetchMode = 'fetchAll') {
    try {
        $stmt = prepareQuery($conn, $sql, $params);
        $stmt->execute();
        
        if (strpos(strtoupper($sql), 'SELECT') === 0) {
            if ($fetchMode === 'fetch') {
                return $stmt->fetch(PDO::FETCH_ASSOC);
            }
            return $stmt->fetchAll(PDO::FETCH_ASSOC);
        }
        
        return ['affected_rows' => $stmt->rowCount()];
    } catch (PDOException $e) {
        error_log("Query execution error: " . $e->getMessage());
        throw new Exception("Database query failed.");
    }
}

/**
 * Begin transaction
 * @param PDO $conn - Database connection
 * @return bool - Success status
 */
function beginTransaction($conn) {
    return $conn->beginTransaction();
}

/**
 * Commit transaction
 * @param PDO $conn - Database connection
 * @return bool - Success status
 */
function commitTransaction($conn) {
    return $conn->commit();
}

/**
 * Rollback transaction
 * @param PDO $conn - Database connection
 * @return bool - Success status
 */
function rollbackTransaction($conn) {
    return $conn->rollBack();
}

/**
 * Get last inserted ID
 * @param PDO $conn - Database connection
 * @return string - Last inserted ID
 */
function getLastInsertId($conn) {
    return $conn->lastInsertId();
}

/**
 * Log database activity to audit log
 * @param PDO $conn - Database connection
 * @param int $userId - User ID
 * @param string $action - Action performed
 * @param string $tableName - Table name
 * @param int $recordId - Record ID
 * @param string $details - Action details
 * @return bool - Success status
 */
function logActivity($conn, $userId, $action, $tableName, $recordId, $details = '') {
    $sql = "INSERT INTO audit_log (user_id, action, table_name, record_id, details, ip_address, user_agent) 
            VALUES (:user_id, :action, :table_name, :record_id, :details, :ip_address, :user_agent)";
    
    $params = [
        'user_id' => $userId,
        'action' => $action,
        'table_name' => $tableName,
        'record_id' => $recordId,
        'details' => $details,
        'ip_address' => $_SERVER['REMOTE_ADDR'] ?? '',
        'user_agent' => $_SERVER['HTTP_USER_AGENT'] ?? ''
    ];
    
    try {
        executeQuery($conn, $sql, $params);
        return true;
    } catch (Exception $e) {
        error_log("Audit log error: " . $e->getMessage());
        return false;
    }
}
?>