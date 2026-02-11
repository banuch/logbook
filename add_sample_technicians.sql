-- =====================================================
-- Quick Fix: Add Sample Technicians
-- Run this if you have NO technicians in your database
-- =====================================================

USE substation_logbook;

-- First, let's see what substations we have
SELECT 
    id AS 'Substation ID',
    substation_code AS 'Code',
    substation_name AS 'Name'
FROM substations
WHERE is_active = TRUE
ORDER BY id;

-- Show current technicians count
SELECT 
    s.id,
    s.substation_code,
    COUNT(t.id) AS technician_count
FROM substations s
LEFT JOIN technicians t ON s.id = t.substation_id AND t.is_active = TRUE
GROUP BY s.id, s.substation_code;

-- =====================================================
-- ADD SAMPLE TECHNICIANS
-- IMPORTANT: Replace substation_id = 1 with your actual substation ID
-- =====================================================

-- For Substation ID 1
INSERT INTO technicians (substation_id, name, employee_id, designation, contact_number, email, is_active)
VALUES 
(1, 'Rajesh Kumar', 'EMP001', 'Senior Technician', '9876543210', 'rajesh.kumar@power.com', TRUE),
(1, 'Suresh Babu', 'EMP002', 'Technician', '9876543211', 'suresh.babu@power.com', TRUE),
(1, 'Priya Sharma', 'EMP003', 'Junior Technician', '9876543212', 'priya.sharma@power.com', TRUE),
(1, 'Amit Patel', 'EMP004', 'Technician', '9876543213', 'amit.patel@power.com', TRUE),
(1, 'Kavita Singh', 'EMP005', 'Assistant Technician', '9876543214', 'kavita.singh@power.com', TRUE)
ON DUPLICATE KEY UPDATE 
    name = VALUES(name),
    is_active = TRUE;

-- Verify the insert worked
SELECT 
    id,
    name,
    employee_id,
    designation,
    contact_number
FROM technicians 
WHERE substation_id = 1 AND is_active = TRUE
ORDER BY name;

-- =====================================================
-- If you have multiple substations, add for each:
-- =====================================================

/*
-- For Substation ID 2
INSERT INTO technicians (substation_id, name, employee_id, designation, contact_number, email, is_active)
VALUES 
(2, 'Ravi Verma', 'EMP101', 'Senior Technician', '9876543220', 'ravi.verma@power.com', TRUE),
(2, 'Deepak Rao', 'EMP102', 'Technician', '9876543221', 'deepak.rao@power.com', TRUE),
(2, 'Anjali Mehta', 'EMP103', 'Junior Technician', '9876543222', 'anjali.mehta@power.com', TRUE);

-- For Substation ID 3
INSERT INTO technicians (substation_id, name, employee_id, designation, contact_number, email, is_active)
VALUES 
(3, 'Sanjay Gupta', 'EMP201', 'Senior Technician', '9876543230', 'sanjay.gupta@power.com', TRUE),
(3, 'Neha Reddy', 'EMP202', 'Technician', '9876543231', 'neha.reddy@power.com', TRUE),
(3, 'Vikram Joshi', 'EMP203', 'Junior Technician', '9876543232', 'vikram.joshi@power.com', TRUE);
*/

-- =====================================================
-- Final verification across all substations
-- =====================================================

SELECT 
    s.id AS substation_id,
    s.substation_code,
    s.substation_name,
    COUNT(t.id) AS total_technicians,
    GROUP_CONCAT(t.name ORDER BY t.name SEPARATOR ', ') AS technician_names
FROM substations s
LEFT JOIN technicians t ON s.id = t.substation_id AND t.is_active = TRUE
GROUP BY s.id, s.substation_code, s.substation_name
ORDER BY s.id;

-- Success message
SELECT 'Sample technicians added successfully! Refresh your browser (Ctrl+Shift+R)' AS 'Status';
