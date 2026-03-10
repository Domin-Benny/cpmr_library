<?php
/**
 * CPMR Library Management System - Functions
 * File: backend/includes/functions.php
 * Description: Common functions used throughout the application
 */

/**
 * Get universities in Ghana (alphabetical order)
 */
function get_ghana_universities() {
    return [
        ['value' => 'University of Ghana', 'label' => 'University of Ghana'],
        ['value' => 'Kwame Nkrumah University of Science and Technology', 'label' => 'Kwame Nkrumah University of Science and Technology'],
        ['value' => 'University of Cape Coast', 'label' => 'University of Cape Coast'],
        ['value' => 'University of Education, Winneba', 'label' => 'University of Education, Winneba'],
        ['value' => 'University of Professional Studies, Accra', 'label' => 'University of Professional Studies, Accra'],
        ['value' => 'University of Health and Allied Sciences', 'label' => 'University of Health and Allied Sciences'],
        ['value' => 'Ghana Institute of Management and Public Administration', 'label' => 'Ghana Institute of Management and Public Administration'],
        ['value' => 'Methodist University College Ghana', 'label' => 'Methodist University College Ghana'],
        ['value' => 'Presbyterian University College', 'label' => 'Presbyterian University College'],
        ['value' => 'Islamic University College', 'label' => 'Islamic University College'],
        ['value' => 'Catholic University College', 'label' => 'Catholic University College'],
        ['value' => 'Zenith University College', 'label' => 'Zenith University College'],
        ['value' => 'Regent University College of Science and Technology', 'label' => 'Regent University College of Science and Technology'],
        ['value' => 'Lancaster University Ghana', 'label' => 'Lancaster University Ghana'],
        ['value' => 'Ashesi University', 'label' => 'Ashesi University'],
        ['value' => 'Central University', 'label' => 'Central University'],
        ['value' => 'Ghana Technology University College', 'label' => 'Ghana Technology University College'],
        ['value' => 'Accra Institute of Technology', 'label' => 'Accra Institute of Technology'],
        ['value' => 'Valley View University', 'label' => 'Valley View University'],
        ['value' => 'Pan African Christian University College', 'label' => 'Pan African Christian University College']
    ];
}

/**
 * Get CPMR departments
 */
function get_cpmr_departments() {
    return [
        ['value' => 'Research', 'label' => 'Research Department'],
        ['value' => 'Administration', 'label' => 'Administration'],
        ['value' => 'Finance', 'label' => 'Finance Department'],
        ['value' => 'Human Resources', 'label' => 'Human Resources'],
        ['value' => 'IT', 'label' => 'Information Technology'],
        ['value' => 'Library', 'label' => 'Library Services'],
        ['value' => 'Quality Assurance', 'label' => 'Quality Assurance'],
        ['value' => 'Procurement', 'label' => 'Procurement Department'],
        ['value' => 'Security', 'label' => 'Security Unit'],
        ['value' => 'Maintenance', 'label' => 'Maintenance Department']
    ];
}

/**
 * Get ID types for Others role
 */
function get_id_types() {
    return [
        ['value' => 'National ID', 'label' => 'National ID (Ghana Card)'],
        ['value' => 'Driver\'s License', 'label' => 'Driver\'s License'],
        ['value' => 'Voter ID', 'label' => 'Voter ID'],
        ['value' => 'Passport', 'label' => 'International Passport'],
        ['value' => 'SSNIT', 'label' => 'SSNIT ID'],
        ['value' => 'NHIS', 'label' => 'NHIS ID']
    ];
}

/**
 * Get security questions
 */
function get_security_questions() {
    return [
        ['value' => 'What was your first pet\'s name?', 'label' => 'What was your first pet\'s name?'],
        ['value' => 'What is your mother\'s maiden name?', 'label' => 'What is your mother\'s maiden name?'],
        ['value' => 'What was the name of your first school?', 'label' => 'What was the name of your first school?'],
        ['value' => 'What is your favorite color?', 'label' => 'What is your favorite color?'],
        ['value' => 'In what city were you born?', 'label' => 'In what city were you born?'],
        ['value' => 'What was your favorite food as a child?', 'label' => 'What was your favorite food as a child?']
    ];
}
?>