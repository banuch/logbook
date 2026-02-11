-- Quick Database Check for Technicians Issue
-- Run these queries in your MySQL console

-- 1. Check if there are any technicians at all
SELECT COUNT(*) AS total_technicians FROM technicians;

-- 2. Check technicians by substation
SELECT 
    s.id AS substation_id,
    s.substation_code,
    s.substation_name,
    COUNT(t.id) AS technician_count,
    GROUP_CONCAT(t.name SEPARATOR ', ') AS technician_names
FROM substations s
LEFT JOIN technicians t ON s.id = t.substation_id AND t.is_active = TRUE
GROUP BY s.id, s.substation_code, s.substation_name
ORDER BY s.id;

-- 3. Check all technicians with details
SELECT 
    t.id,
    t.name,
    t.employee_id,
    t.designation,
    t.substation_id,
    s.substation_code,
    s.substation_name,
    t.is_active
FROM technicians t
LEFT JOIN substations s ON t.substation_id = s.id
ORDER BY s.id, t.name;

-- 4. Check users and their substation assignments
SELECT 
    u.id,
    u.username,
    u.role,
    u.substation_id,
    s.substation_code,
    s.substation_name
FROM users u
LEFT JOIN substations s ON u.substation_id = s.id
ORDER BY u.role, u.username;

-- 5. Check substations
SELECT 
    id,
    substation_code,
    substation_name,
    is_active
FROM substations
ORDER BY id;

-- ==========================================
-- SAMPLE INSERT QUERIES (if no technicians exist)
-- ==========================================

-- First, find your substation ID
-- SELECT id, substation_code FROM substations;

-- Then insert technicians (replace substation_id with actual ID)
/*
INSERT INTO technicians (substation_id, name, employee_id, designation, contact_number, email, is_active)
VALUES 
(1, 'Rajesh Kumar', 'EMP001', 'Senior Technician', '9876543210', 'rajesh@example.com', TRUE),
(1, 'Suresh Babu', 'EMP002', 'Technician', '9876543211', 'suresh@example.com', TRUE),
(1, 'Priya Sharma', 'EMP003', 'Junior Technician', '9876543212', 'priya@example.com', TRUE);
*/

-- ==========================================
-- DIAGNOSTIC QUERIES
-- ==========================================

-- Check if problem is with specific substation
-- Replace 1 with your substation_id
SELECT * FROM technicians WHERE substation_id = 1 AND is_active = TRUE;

-- Check inactive technicians
SELECT COUNT(*) AS inactive_technicians FROM technicians WHERE is_active = FALSE;

-- Check orphaned technicians (substation doesn't exist)
SELECT t.* 
FROM technicians t
LEFT JOIN substations s ON t.substation_id = s.id
WHERE s.id IS NULL;
