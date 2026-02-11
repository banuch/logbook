-- Electrical Substation Logbook Database Schema
-- Created: 2026-02-08
-- Database: substation_logbook

DROP DATABASE IF EXISTS substation_logbook;
CREATE DATABASE substation_logbook CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE substation_logbook;

-- =====================================================
-- Table: substations
-- Stores all substation information
-- =====================================================
CREATE TABLE substations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    substation_code VARCHAR(50) UNIQUE NOT NULL,
    substation_name VARCHAR(200) NOT NULL,
    location VARCHAR(300),
    voltage_level VARCHAR(50),
    installed_capacity VARCHAR(100),
    password_hash VARCHAR(255) NOT NULL,
    contact_info TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    INDEX idx_substation_code (substation_code),
    INDEX idx_is_active (is_active)
) ENGINE=InnoDB;

-- =====================================================
-- Table: users
-- Stores admin and engineer accounts
-- =====================================================
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(200) NOT NULL,
    email VARCHAR(200) UNIQUE NOT NULL,
    phone VARCHAR(20),
    employee_id VARCHAR(50) UNIQUE,
    role ENUM('admin', 'engineer') NOT NULL,
    substation_id INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    last_login TIMESTAMP NULL,
    FOREIGN KEY (substation_id) REFERENCES substations(id) ON DELETE SET NULL,
    INDEX idx_username (username),
    INDEX idx_role (role),
    INDEX idx_substation_id (substation_id)
) ENGINE=InnoDB;

-- =====================================================
-- Table: technicians
-- Stores technician details for each substation
-- =====================================================
CREATE TABLE technicians (
    id INT AUTO_INCREMENT PRIMARY KEY,
    substation_id INT NOT NULL,
    name VARCHAR(200) NOT NULL,
    employee_id VARCHAR(50) NOT NULL,
    contact_number VARCHAR(20),
    email VARCHAR(200),
    designation VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    FOREIGN KEY (substation_id) REFERENCES substations(id) ON DELETE CASCADE,
    UNIQUE KEY unique_emp_substation (employee_id, substation_id),
    INDEX idx_substation_id (substation_id),
    INDEX idx_is_active (is_active)
) ENGINE=InnoDB;

-- =====================================================
-- Table: equipment_types
-- Master list of equipment (managed by admin)
-- =====================================================
CREATE TABLE equipment_types (
    id INT AUTO_INCREMENT PRIMARY KEY,
    equipment_name VARCHAR(200) UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by INT,
    is_active BOOLEAN DEFAULT TRUE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_equipment_name (equipment_name)
) ENGINE=InnoDB;

-- =====================================================
-- Table: event_categories
-- Master list of event categories (managed by admin)
-- =====================================================
CREATE TABLE event_categories (
    id INT AUTO_INCREMENT PRIMARY KEY,
    category_name VARCHAR(200) UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by INT,
    is_active BOOLEAN DEFAULT TRUE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_category_name (category_name)
) ENGINE=InnoDB;

-- =====================================================
-- Table: logbook_entries
-- Main logbook entries
-- =====================================================
CREATE TABLE logbook_entries (
    id INT AUTO_INCREMENT PRIMARY KEY,
    substation_id INT NOT NULL,
    entry_datetime DATETIME NOT NULL,
    event_category_id INT,
    equipment_id INT,
    severity ENUM('Normal', 'Warning', 'Critical') DEFAULT 'Normal',
    message TEXT NOT NULL,
    attachment_path VARCHAR(500),
    posted_by_type ENUM('technician', 'substation', 'engineer') NOT NULL,
    posted_by_id INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    is_edited BOOLEAN DEFAULT FALSE,
    last_edited_at TIMESTAMP NULL,
    send_email_notification BOOLEAN DEFAULT FALSE,
    email_sent BOOLEAN DEFAULT FALSE,
    email_sent_at TIMESTAMP NULL,
    FOREIGN KEY (substation_id) REFERENCES substations(id) ON DELETE CASCADE,
    FOREIGN KEY (event_category_id) REFERENCES event_categories(id) ON DELETE SET NULL,
    FOREIGN KEY (equipment_id) REFERENCES equipment_types(id) ON DELETE SET NULL,
    INDEX idx_substation_id (substation_id),
    INDEX idx_entry_datetime (entry_datetime),
    INDEX idx_severity (severity),
    INDEX idx_created_at (created_at),
    FULLTEXT INDEX idx_message (message)
) ENGINE=InnoDB;

-- =====================================================
-- Table: log_technicians
-- Junction table for multiple technicians per log entry
-- =====================================================
CREATE TABLE log_technicians (
    id INT AUTO_INCREMENT PRIMARY KEY,
    log_id INT NOT NULL,
    technician_id INT NOT NULL,
    FOREIGN KEY (log_id) REFERENCES logbook_entries(id) ON DELETE CASCADE,
    FOREIGN KEY (technician_id) REFERENCES technicians(id) ON DELETE CASCADE,
    UNIQUE KEY unique_log_technician (log_id, technician_id),
    INDEX idx_log_id (log_id),
    INDEX idx_technician_id (technician_id)
) ENGINE=InnoDB;

-- =====================================================
-- Table: electrical_parameters
-- Electrical readings associated with log entries
-- =====================================================
CREATE TABLE electrical_parameters (
    id INT AUTO_INCREMENT PRIMARY KEY,
    log_id INT NOT NULL,
    voltage_kv DECIMAL(10, 2),
    current_a DECIMAL(10, 2),
    power_mw DECIMAL(10, 3),
    frequency_hz DECIMAL(5, 2),
    power_factor DECIMAL(4, 3),
    energy_mwh DECIMAL(12, 3),
    FOREIGN KEY (log_id) REFERENCES logbook_entries(id) ON DELETE CASCADE,
    INDEX idx_log_id (log_id)
) ENGINE=InnoDB;

-- =====================================================
-- Table: comments
-- Engineer comments on logbook entries
-- =====================================================
CREATE TABLE comments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    log_id INT NOT NULL,
    user_id INT NOT NULL,
    comment_text TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    is_edited BOOLEAN DEFAULT FALSE,
    is_deleted BOOLEAN DEFAULT FALSE,
    FOREIGN KEY (log_id) REFERENCES logbook_entries(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_log_id (log_id),
    INDEX idx_user_id (user_id),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB;

-- =====================================================
-- Table: email_config
-- Email server configuration (managed by admin)
-- =====================================================
CREATE TABLE email_config (
    id INT AUTO_INCREMENT PRIMARY KEY,
    smtp_host VARCHAR(200) NOT NULL,
    smtp_port INT NOT NULL DEFAULT 587,
    smtp_secure BOOLEAN DEFAULT FALSE,
    smtp_user VARCHAR(200) NOT NULL,
    smtp_password VARCHAR(500) NOT NULL,
    from_email VARCHAR(200) NOT NULL,
    from_name VARCHAR(200) DEFAULT 'Substation Logbook',
    is_active BOOLEAN DEFAULT TRUE,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    updated_by INT,
    FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- =====================================================
-- Table: backup_history
-- Track database backup operations
-- =====================================================
CREATE TABLE backup_history (
    id INT AUTO_INCREMENT PRIMARY KEY,
    backup_filename VARCHAR(300) NOT NULL,
    backup_path VARCHAR(500) NOT NULL,
    backup_size_mb DECIMAL(10, 2),
    backup_type ENUM('manual', 'automatic') NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by INT,
    status ENUM('success', 'failed') DEFAULT 'success',
    error_message TEXT,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_created_at (created_at),
    INDEX idx_backup_type (backup_type)
) ENGINE=InnoDB;

-- =====================================================
-- Insert Default Admin Account
-- Username: admin, Password: admin123 (CHANGE THIS!)
-- =====================================================
INSERT INTO users (username, password_hash, full_name, email, role, employee_id) 
VALUES ('admin', '$2b$10$rB8YwF5Y5PVJ5K5K5K5K5ue9W9W9W9W9W9W9W9W9W9W9W9W9W9W9W', 
        'System Administrator', 'admin@substation.local', 'admin', 'ADMIN001');

-- Note: The password_hash above is a placeholder. 
-- Actual hash will be generated by the application using bcrypt

-- =====================================================
-- Insert Default Equipment Types
-- =====================================================
INSERT INTO equipment_types (equipment_name, description) VALUES
('Transformer', 'Power transformer'),
('Circuit Breaker', 'Circuit breaker'),
('Isolator', 'Isolator switch'),
('Bus Bar', 'Bus bar system'),
('Lightning Arrester', 'Lightning protection'),
('Current Transformer', 'CT for measurement'),
('Potential Transformer', 'PT for measurement'),
('Control Panel', 'Control and protection panel'),
('Battery Bank', 'DC supply system'),
('Capacitor Bank', 'Power factor correction'),
('Protection Relay', 'Protection relay system'),
('SCADA System', 'Supervisory control system');

-- =====================================================
-- Insert Default Event Categories
-- =====================================================
INSERT INTO event_categories (category_name, description) VALUES
('Maintenance', 'Scheduled maintenance activities'),
('Fault', 'Equipment fault or failure'),
('Inspection', 'Routine inspection'),
('Switch Operation', 'Switching operations'),
('Testing', 'Equipment testing'),
('Calibration', 'Instrument calibration'),
('Shutdown', 'Planned shutdown'),
('Emergency', 'Emergency situation'),
('Commissioning', 'New equipment commissioning'),
('Modification', 'System modification');

-- =====================================================
-- Insert Default Gmail SMTP Configuration
-- (Admin needs to update with actual credentials)
-- =====================================================
INSERT INTO email_config (smtp_host, smtp_port, smtp_secure, smtp_user, smtp_password, from_email, from_name) 
VALUES ('smtp.gmail.com', 587, FALSE, 'your-email@gmail.com', 'your-app-password', 'your-email@gmail.com', 'Substation Logbook');

-- =====================================================
-- Create Views for Reporting
-- =====================================================

-- View: Complete log entries with all related information
CREATE VIEW v_logbook_entries_complete AS
SELECT 
    l.id,
    l.entry_datetime,
    s.substation_code,
    s.substation_name,
    ec.category_name AS event_category,
    eq.equipment_name AS equipment,
    l.severity,
    l.message,
    l.attachment_path,
    l.posted_by_type,
    GROUP_CONCAT(DISTINCT t.name ORDER BY t.name SEPARATOR ', ') AS technicians,
    ep.voltage_kv,
    ep.current_a,
    ep.power_mw,
    ep.frequency_hz,
    ep.power_factor,
    ep.energy_mwh,
    l.created_at,
    l.is_edited,
    l.last_edited_at,
    COUNT(DISTINCT c.id) AS comment_count
FROM logbook_entries l
LEFT JOIN substations s ON l.substation_id = s.id
LEFT JOIN event_categories ec ON l.event_category_id = ec.id
LEFT JOIN equipment_types eq ON l.equipment_id = eq.id
LEFT JOIN log_technicians lt ON l.id = lt.log_id
LEFT JOIN technicians t ON lt.technician_id = t.id
LEFT JOIN electrical_parameters ep ON l.id = ep.log_id
LEFT JOIN comments c ON l.id = c.log_id AND c.is_deleted = FALSE
GROUP BY l.id;

-- View: Daily summary
CREATE VIEW v_daily_summary AS
SELECT 
    DATE(entry_datetime) AS log_date,
    substation_id,
    s.substation_name,
    COUNT(*) AS total_logs,
    SUM(CASE WHEN severity = 'Normal' THEN 1 ELSE 0 END) AS normal_count,
    SUM(CASE WHEN severity = 'Warning' THEN 1 ELSE 0 END) AS warning_count,
    SUM(CASE WHEN severity = 'Critical' THEN 1 ELSE 0 END) AS critical_count
FROM logbook_entries l
JOIN substations s ON l.substation_id = s.id
GROUP BY DATE(entry_datetime), substation_id, s.substation_name;

-- =====================================================
-- Database Setup Complete
-- =====================================================
