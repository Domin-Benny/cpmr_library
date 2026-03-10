<?php
// =============================================
// Registration Data API
// File: backend/api/registration_data.php
// Description: Provide data for registration dropdowns
// =============================================

header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");

require_once '../../config/database.php';

// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Only handle GET requests
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode([
        'success' => false,
        'message' => 'Method not allowed'
    ]);
    exit();
}

try {
    $database = new Database();
    $conn = $database->getConnection();
    
    $type = $_GET['type'] ?? '';
    
    switch ($type) {
        case 'institutions':
            getInstitutions($conn);
            break;
        case 'departments':
            getDepartments($conn);
            break;
        case 'id_types':
            getIdTypes();
            break;
        case 'security_questions':
            getSecurityQuestions($conn);
            break;
        default:
            http_response_code(400);
            echo json_encode([
                'success' => false,
                'message' => 'Invalid data type requested'
            ]);
    }
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Database error: ' . $e->getMessage()
    ]);
}

function getInstitutions($conn) {
    $sql = "SELECT id, name FROM institutions ORDER BY name ASC";
    $stmt = $conn->prepare($sql);
    $stmt->execute();
    $institutions = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    echo json_encode([
        'success' => true,
        'data' => $institutions
    ]);
}

function getDepartments($conn) {
    // canonical list of CPMR Mampong departments (administrative & research)
    $default = [
        "Administration",
        "Finance Department",
        "Human Resources",
        "Information Technology",
        "Library Services",
        "Procurement",
        "Public Relations",
        "Quality Assurance",
        "Research Department",
        "Security Services",
        "Herbology Department",
        "Phytochemistry Department",
        "Ethnobotany Department",
        "Traditional Medicine Department",
        "Pharmacology Department",
        "Toxicology Department",
        "Microbiology Department",
        "Biochemistry Department",
        "Plant Science Department"
    ];

    // synchronize table contents with default list; this will add new names and remove any obsolete entries
    $insertSql = "INSERT IGNORE INTO departments (name) VALUES (:name)";
    $stmt = $conn->prepare($insertSql);
    foreach ($default as $name) {
        $stmt->bindParam(':name', $name);
        $stmt->execute();
    }

    // delete any rows not part of the canonical set
    $placeholders = implode(',', array_fill(0, count($default), '?'));
    $deleteSql = "DELETE FROM departments WHERE name NOT IN ($placeholders)";
    $delStmt = $conn->prepare($deleteSql);
    foreach ($default as $idx => $name) {
        $delStmt->bindValue($idx + 1, $name);
    }
    $delStmt->execute();

    // fetch final list from database
    $sql = "SELECT id, name FROM departments ORDER BY name ASC";
    $stmt = $conn->prepare($sql);
    $stmt->execute();
    $departments = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode([
        'success' => true,
        'data' => $departments
    ]);
}

function getIdTypes() {
    $idTypes = [
        ['value' => 'National ID', 'label' => 'National ID (Ghana Card)'],
        ['value' => 'Voter ID', 'label' => 'Voter ID'],
        ['value' => 'Passport', 'label' => 'International Passport'],
        ['value' => 'Driver License', 'label' => 'Driver License'],
        ['value' => 'SSNIT', 'label' => 'SSNIT ID'],
        ['value' => 'NHIS', 'label' => 'NHIS ID'],
        ['value' => 'OTHER', 'label' => 'Other (Please specify)']
    ];
    
    echo json_encode([
        'success' => true,
        'data' => $idTypes
    ]);
}

function getSecurityQuestions($conn) {
    $sql = "SELECT id, question FROM security_questions ORDER BY id ASC";
    $stmt = $conn->prepare($sql);
    $stmt->execute();
    $questions = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    echo json_encode([
        'success' => true,
        'data' => $questions
    ]);
}
?>