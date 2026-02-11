/**
 * =====================================================
 * Electrical Substation Logbook Management System
 * Main Server File
 * =====================================================
 * Author: NAG - SDSC SHAR
 * Created: 2026-02-08
 * Node.js Backend with Express, MySQL, JWT Authentication
 * =====================================================
 */

require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const nodemailer = require('nodemailer');
const session = require('express-session');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
const morgan = require('morgan');
const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');
const cron = require('node-cron');
const path = require('path');
const fs = require('fs').promises;
const { exec } = require('child_process');
const { promisify } = require('util');

const execPromise = promisify(exec);

// =====================================================
// Initialize Express App
// =====================================================
const app = express();
const PORT = process.env.PORT || 3000;

// =====================================================
// Database Connection Pool
// =====================================================
const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'substation_logbook',
    port: process.env.DB_PORT || 3306,
    waitForConnections: true,
    connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT) || 10,
    queueLimit: 0,
    timezone: '+05:30' // IST
};

let pool;

async function initDatabase() {
    try {
        pool = mysql.createPool(dbConfig);
        const connection = await pool.getConnection();
        console.log('✅ Database connected successfully');
        connection.release();
        return true;
    } catch (error) {
        console.error('❌ Database connection failed:', error.message);
        return false;
    }
}

// =====================================================
// Middleware Configuration
// =====================================================

// Security headers
app.use(helmet({
    contentSecurityPolicy: false // Disable for development, enable in production with proper CSP
}));

// CORS
app.use(cors());

// Request compression
app.use(compression());

// Request logging
app.use(morgan('combined'));

// Body parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Session configuration
app.use(session({
    secret: process.env.SESSION_SECRET || 'fallback-secret-change-this',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

// Rate limiting
const limiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
    message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

// Static files
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));

// =====================================================
// File Upload Configuration
// =====================================================
const storage = multer.diskStorage({
    destination: async (req, file, cb) => {
        const uploadDir = path.join(__dirname, 'uploads');
        try {
            await fs.mkdir(uploadDir, { recursive: true });
            cb(null, uploadDir);
        } catch (error) {
            cb(error);
        }
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, 'attachment-' + uniqueSuffix + ext);
    }
});

const fileFilter = (req, file, cb) => {
    const allowedTypes = (process.env.ALLOWED_FILE_TYPES || '').split(',');
    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Invalid file type. Allowed: JPG, PNG, PDF, DOC, XLS'), false);
    }
};

const upload = multer({
    storage: storage,
    limits: {
        fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024 // 10MB
    },
    fileFilter: fileFilter
});

// =====================================================
// Email Configuration
// =====================================================
let emailTransporter;

async function initEmailTransporter() {
    try {
        const [rows] = await pool.query('SELECT * FROM email_config WHERE is_active = TRUE LIMIT 1');
        
        if (rows.length > 0) {
            const config = rows[0];
            emailTransporter = nodemailer.createTransport({
                host: config.smtp_host,
                port: config.smtp_port,
                secure: config.smtp_secure,
                auth: {
                    user: config.smtp_user,
                    pass: config.smtp_password
                }
            });
        } else {
            // Use environment variables as fallback
            emailTransporter = nodemailer.createTransport({
                host: process.env.SMTP_HOST || 'smtp.gmail.com',
                port: parseInt(process.env.SMTP_PORT) || 587,
                secure: process.env.SMTP_SECURE === 'true',
                auth: {
                    user: process.env.SMTP_USER,
                    pass: process.env.SMTP_PASSWORD
                }
            });
        }
        console.log('✅ Email transporter initialized');
    } catch (error) {
        console.error('⚠️  Email transporter initialization failed:', error.message);
    }
}

// =====================================================
// Authentication Middleware
// =====================================================
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ success: false, message: 'Access token required' });
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ success: false, message: 'Invalid or expired token' });
        }
        req.user = user;
        next();
    });
}

function authorizeRole(...roles) {
    return (req, res, next) => {
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ 
                success: false, 
                message: 'You do not have permission to perform this action' 
            });
        }
        next();
    };
}

// =====================================================
// Helper Functions
// =====================================================

// Generate JWT token
function generateToken(user) {
    return jwt.sign(
        { 
            id: user.id, 
            username: user.username, 
            role: user.role,
            substation_id: user.substation_id
        },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );
}

// Hash password
async function hashPassword(password) {
    return await bcrypt.hash(password, 10);
}

// Verify password
async function verifyPassword(password, hash) {
    return await bcrypt.compare(password, hash);
}

// Format datetime for MySQL
function formatDateTimeForMySQL(datetime) {
    const date = new Date(datetime);
    return date.toISOString().slice(0, 19).replace('T', ' ');
}

// Format datetime for display (DD/MM/YYYY HH:mm)
function formatDateTimeForDisplay(datetime) {
    const date = new Date(datetime);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${day}/${month}/${year} ${hours}:${minutes}`;
}

// Check if entry is within 24 hours for editing
function isWithin24Hours(entryDatetime) {
    const entryTime = new Date(entryDatetime);
    const now = new Date();
    const diffInHours = (now - entryTime) / (1000 * 60 * 60);
    return diffInHours <= 24;
}

// Send email notification
async function sendEmailNotification(logEntry, engineerEmail) {
    if (!emailTransporter) {
        console.error('Email transporter not initialized');
        return false;
    }

    try {
        const mailOptions = {
            from: `${process.env.EMAIL_FROM_NAME || 'Substation Logbook'} <${process.env.EMAIL_FROM}>`,
            to: engineerEmail,
            subject: `[${logEntry.severity}] New Logbook Entry - ${logEntry.substation_name}`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #333; border-bottom: 3px solid #007bff; padding-bottom: 10px;">
                        Substation Logbook Notification
                    </h2>
                    
                    <div style="background-color: ${logEntry.severity === 'Critical' ? '#f8d7da' : logEntry.severity === 'Warning' ? '#fff3cd' : '#d1ecf1'}; 
                                padding: 15px; border-radius: 5px; margin: 20px 0;">
                        <strong>Severity: ${logEntry.severity}</strong>
                    </div>
                    
                    <table style="width: 100%; border-collapse: collapse;">
                        <tr>
                            <td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>Substation:</strong></td>
                            <td style="padding: 8px; border-bottom: 1px solid #ddd;">${logEntry.substation_name}</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>Date & Time:</strong></td>
                            <td style="padding: 8px; border-bottom: 1px solid #ddd;">${formatDateTimeForDisplay(logEntry.entry_datetime)}</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>Category:</strong></td>
                            <td style="padding: 8px; border-bottom: 1px solid #ddd;">${logEntry.event_category || 'N/A'}</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>Equipment:</strong></td>
                            <td style="padding: 8px; border-bottom: 1px solid #ddd;">${logEntry.equipment || 'N/A'}</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>Technicians:</strong></td>
                            <td style="padding: 8px; border-bottom: 1px solid #ddd;">${logEntry.technicians || 'N/A'}</td>
                        </tr>
                    </table>
                    
                    <div style="margin: 20px 0; padding: 15px; background-color: #f8f9fa; border-left: 4px solid #007bff;">
                        <strong>Message:</strong><br>
                        ${logEntry.message.replace(/\n/g, '<br>')}
                    </div>
                    
                    ${logEntry.voltage_kv || logEntry.current_a || logEntry.power_mw ? `
                    <div style="margin: 20px 0;">
                        <strong>Electrical Parameters:</strong>
                        <ul>
                            ${logEntry.voltage_kv ? `<li>Voltage: ${logEntry.voltage_kv} kV</li>` : ''}
                            ${logEntry.current_a ? `<li>Current: ${logEntry.current_a} A</li>` : ''}
                            ${logEntry.power_mw ? `<li>Power: ${logEntry.power_mw} MW</li>` : ''}
                            ${logEntry.frequency_hz ? `<li>Frequency: ${logEntry.frequency_hz} Hz</li>` : ''}
                            ${logEntry.power_factor ? `<li>Power Factor: ${logEntry.power_factor}</li>` : ''}
                            ${logEntry.energy_mwh ? `<li>Energy: ${logEntry.energy_mwh} MWh</li>` : ''}
                        </ul>
                    </div>
                    ` : ''}
                    
                    <div style="margin: 30px 0; text-align: center;">
                        <a href="${process.env.APP_URL || 'http://localhost:3000'}" 
                           style="background-color: #007bff; color: white; padding: 12px 30px; 
                                  text-decoration: none; border-radius: 5px; display: inline-block;">
                            View in Logbook System
                        </a>
                    </div>
                    
                    <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; 
                                font-size: 12px; color: #666; text-align: center;">
                        <p>This is an automated notification from the Substation Logbook System.</p>
                        <p>SDSC SHAR - Construction & Maintenance Group</p>
                    </div>
                </div>
            `
        };

        await emailTransporter.sendMail(mailOptions);
        return true;
    } catch (error) {
        console.error('Email sending failed:', error);
        return false;
    }
}

// =====================================================
// API ROUTES - AUTHENTICATION
// =====================================================

// Admin/Engineer Login
app.post('/api/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ 
                success: false, 
                message: 'Username and password are required' 
            });
        }

        const [users] = await pool.query(
            'SELECT * FROM users WHERE username = ? AND is_active = TRUE',
            [username]
        );

        if (users.length === 0) {
            return res.status(401).json({ 
                success: false, 
                message: 'Invalid credentials' 
            });
        }

        const user = users[0];
        const passwordValid = await verifyPassword(password, user.password_hash);

        if (!passwordValid) {
            return res.status(401).json({ 
                success: false, 
                message: 'Invalid credentials' 
            });
        }

        // Update last login
        await pool.query(
            'UPDATE users SET last_login = NOW() WHERE id = ?',
            [user.id]
        );

        const token = generateToken(user);

        res.json({
            success: true,
            message: 'Login successful',
            token: token,
            user: {
                id: user.id,
                username: user.username,
                full_name: user.full_name,
                email: user.email,
                role: user.role,
                substation_id: user.substation_id
            }
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Login failed',
            error: error.message 
        });
    }
});

// Substation Login
app.post('/api/auth/substation-login', async (req, res) => {
    try {
        const { substation_code, password } = req.body;

        if (!substation_code || !password) {
            return res.status(400).json({ 
                success: false, 
                message: 'Substation code and password are required' 
            });
        }

        const [substations] = await pool.query(
            'SELECT * FROM substations WHERE substation_code = ? AND is_active = TRUE',
            [substation_code]
        );

        if (substations.length === 0) {
            return res.status(401).json({ 
                success: false, 
                message: 'Invalid credentials' 
            });
        }

        const substation = substations[0];
        const passwordValid = await verifyPassword(password, substation.password_hash);

        if (!passwordValid) {
            return res.status(401).json({ 
                success: false, 
                message: 'Invalid credentials' 
            });
        }

        const token = jwt.sign(
            { 
                id: substation.id,
                substation_code: substation.substation_code,
                role: 'substation',
                substation_id: substation.id
            },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
        );

        res.json({
            success: true,
            message: 'Login successful',
            token: token,
            substation: {
                id: substation.id,
                substation_code: substation.substation_code,
                substation_name: substation.substation_name,
                substation_id: substation.id,  // Add this for consistency
                role: 'substation'
            }
        });

    } catch (error) {
        console.error('Substation login error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Login failed',
            error: error.message 
        });
    }
});

// Verify Token
app.get('/api/auth/verify', authenticateToken, (req, res) => {
    res.json({
        success: true,
        user: req.user
    });
});

// Logout
app.post('/api/auth/logout', authenticateToken, (req, res) => {
    res.json({
        success: true,
        message: 'Logged out successfully'
    });
});

// =====================================================
// API ROUTES - SUBSTATION MANAGEMENT (Admin Only)
// =====================================================

// Get all substations
app.get('/api/substations', authenticateToken, authorizeRole('admin'), async (req, res) => {
    try {
        const [substations] = await pool.query(
            'SELECT id, substation_code, substation_name, location, voltage_level, installed_capacity, contact_info, created_at, is_active FROM substations ORDER BY substation_name'
        );

        res.json({
            success: true,
            substations: substations
        });
    } catch (error) {
        console.error('Get substations error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch substations' });
    }
});

// Add new substation
app.post('/api/substations', authenticateToken, authorizeRole('admin'), async (req, res) => {
    try {
        const { substation_code, substation_name, location, voltage_level, installed_capacity, contact_info, password } = req.body;

        if (!substation_code || !substation_name || !password) {
            return res.status(400).json({ 
                success: false, 
                message: 'Substation code, name, and password are required' 
            });
        }

        const password_hash = await hashPassword(password);

        const [result] = await pool.query(
            'INSERT INTO substations (substation_code, substation_name, location, voltage_level, installed_capacity, contact_info, password_hash) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [substation_code, substation_name, location, voltage_level, installed_capacity, contact_info, password_hash]
        );

        res.json({
            success: true,
            message: 'Substation added successfully',
            substation_id: result.insertId
        });
    } catch (error) {
        console.error('Add substation error:', error);
        if (error.code === 'ER_DUP_ENTRY') {
            res.status(400).json({ success: false, message: 'Substation code already exists' });
        } else {
            res.status(500).json({ success: false, message: 'Failed to add substation' });
        }
    }
});

// Update substation
app.put('/api/substations/:id', authenticateToken, authorizeRole('admin'), async (req, res) => {
    try {
        const { id } = req.params;
        const { substation_name, location, voltage_level, installed_capacity, contact_info, password } = req.body;

        let query = 'UPDATE substations SET substation_name = ?, location = ?, voltage_level = ?, installed_capacity = ?, contact_info = ?';
        let params = [substation_name, location, voltage_level, installed_capacity, contact_info];

        if (password) {
            const password_hash = await hashPassword(password);
            query += ', password_hash = ?';
            params.push(password_hash);
        }

        query += ' WHERE id = ?';
        params.push(id);

        await pool.query(query, params);

        res.json({
            success: true,
            message: 'Substation updated successfully'
        });
    } catch (error) {
        console.error('Update substation error:', error);
        res.status(500).json({ success: false, message: 'Failed to update substation' });
    }
});

// Toggle substation status
app.patch('/api/substations/:id/toggle-status', authenticateToken, authorizeRole('admin'), async (req, res) => {
    try {
        const { id } = req.params;
        
        await pool.query(
            'UPDATE substations SET is_active = NOT is_active WHERE id = ?',
            [id]
        );

        res.json({
            success: true,
            message: 'Substation status updated'
        });
    } catch (error) {
        console.error('Toggle substation status error:', error);
        res.status(500).json({ success: false, message: 'Failed to update status' });
    }
});

// =====================================================
// API ROUTES - USER MANAGEMENT (Admin Only)
// =====================================================

// Get all users (engineers)
app.get('/api/users', authenticateToken, authorizeRole('admin'), async (req, res) => {
    try {
        const [users] = await pool.query(`
            SELECT u.*, s.substation_name 
            FROM users u
            LEFT JOIN substations s ON u.substation_id = s.id
            ORDER BY u.full_name
        `);

        // Remove password hash from response
        const sanitizedUsers = users.map(user => {
            const { password_hash, ...userWithoutPassword } = user;
            return userWithoutPassword;
        });

        res.json({
            success: true,
            users: sanitizedUsers
        });
    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch users' });
    }
});

// Add new user (engineer)
app.post('/api/users', authenticateToken, authorizeRole('admin'), async (req, res) => {
    try {
        const { username, password, full_name, email, phone, employee_id, role, substation_id } = req.body;

        if (!username || !password || !full_name || !email || !role) {
            return res.status(400).json({ 
                success: false, 
                message: 'Username, password, full name, email, and role are required' 
            });
        }

        if (role === 'engineer' && !substation_id) {
            return res.status(400).json({ 
                success: false, 
                message: 'Substation assignment is required for engineers' 
            });
        }

        const password_hash = await hashPassword(password);

        const [result] = await pool.query(
            'INSERT INTO users (username, password_hash, full_name, email, phone, employee_id, role, substation_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [username, password_hash, full_name, email, phone, employee_id, role, role === 'admin' ? null : substation_id]
        );

        res.json({
            success: true,
            message: 'User added successfully',
            user_id: result.insertId
        });
    } catch (error) {
        console.error('Add user error:', error);
        if (error.code === 'ER_DUP_ENTRY') {
            res.status(400).json({ success: false, message: 'Username, email, or employee ID already exists' });
        } else {
            res.status(500).json({ success: false, message: 'Failed to add user' });
        }
    }
});

// Update user
app.put('/api/users/:id', authenticateToken, authorizeRole('admin'), async (req, res) => {
    try {
        const { id } = req.params;
        const { full_name, email, phone, employee_id, substation_id, password } = req.body;

        let query = 'UPDATE users SET full_name = ?, email = ?, phone = ?, employee_id = ?, substation_id = ?';
        let params = [full_name, email, phone, employee_id, substation_id];

        if (password) {
            const password_hash = await hashPassword(password);
            query += ', password_hash = ?';
            params.push(password_hash);
        }

        query += ' WHERE id = ?';
        params.push(id);

        await pool.query(query, params);

        res.json({
            success: true,
            message: 'User updated successfully'
        });
    } catch (error) {
        console.error('Update user error:', error);
        res.status(500).json({ success: false, message: 'Failed to update user' });
    }
});

// Toggle user status
app.patch('/api/users/:id/toggle-status', authenticateToken, authorizeRole('admin'), async (req, res) => {
    try {
        const { id } = req.params;
        
        await pool.query(
            'UPDATE users SET is_active = NOT is_active WHERE id = ?',
            [id]
        );

        res.json({
            success: true,
            message: 'User status updated'
        });
    } catch (error) {
        console.error('Toggle user status error:', error);
        res.status(500).json({ success: false, message: 'Failed to update status' });
    }
});

// =====================================================
// API ROUTES - TECHNICIAN MANAGEMENT
// =====================================================

// Get technicians by substation
app.get('/api/technicians/:substation_id', authenticateToken, async (req, res) => {
    try {
        const { substation_id } = req.params;

        const [technicians] = await pool.query(
            'SELECT * FROM technicians WHERE substation_id = ? AND is_active = TRUE ORDER BY name',
            [substation_id]
        );

        res.json({
            success: true,
            technicians: technicians
        });
    } catch (error) {
        console.error('Get technicians error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch technicians' });
    }
});

// Add technician
app.post('/api/technicians', authenticateToken, async (req, res) => {
    try {
        const { substation_id, name, employee_id, contact_number, email, designation } = req.body;

        if (!substation_id || !name || !employee_id) {
            return res.status(400).json({ 
                success: false, 
                message: 'Substation, name, and employee ID are required' 
            });
        }

        const [result] = await pool.query(
            'INSERT INTO technicians (substation_id, name, employee_id, contact_number, email, designation) VALUES (?, ?, ?, ?, ?, ?)',
            [substation_id, name, employee_id, contact_number, email, designation]
        );

        res.json({
            success: true,
            message: 'Technician added successfully',
            technician_id: result.insertId
        });
    } catch (error) {
        console.error('Add technician error:', error);
        if (error.code === 'ER_DUP_ENTRY') {
            res.status(400).json({ success: false, message: 'Employee ID already exists for this substation' });
        } else {
            res.status(500).json({ success: false, message: 'Failed to add technician' });
        }
    }
});

// Update technician
app.put('/api/technicians/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { name, contact_number, email, designation } = req.body;

        await pool.query(
            'UPDATE technicians SET name = ?, contact_number = ?, email = ?, designation = ? WHERE id = ?',
            [name, contact_number, email, designation, id]
        );

        res.json({
            success: true,
            message: 'Technician updated successfully'
        });
    } catch (error) {
        console.error('Update technician error:', error);
        res.status(500).json({ success: false, message: 'Failed to update technician' });
    }
});

// Delete technician (soft delete)
app.delete('/api/technicians/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;

        await pool.query(
            'UPDATE technicians SET is_active = FALSE WHERE id = ?',
            [id]
        );

        res.json({
            success: true,
            message: 'Technician deleted successfully'
        });
    } catch (error) {
        console.error('Delete technician error:', error);
        res.status(500).json({ success: false, message: 'Failed to delete technician' });
    }
});

// =====================================================
// API ROUTES - EQUIPMENT MANAGEMENT (Admin Only)
// =====================================================

// Get all equipment types
app.get('/api/equipment', authenticateToken, async (req, res) => {
    try {
        const [equipment] = await pool.query(
            'SELECT * FROM equipment_types WHERE is_active = TRUE ORDER BY equipment_name'
        );

        res.json({
            success: true,
            equipment: equipment
        });
    } catch (error) {
        console.error('Get equipment error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch equipment' });
    }
});

// Add equipment type
app.post('/api/equipment', authenticateToken, authorizeRole('admin'), async (req, res) => {
    try {
        const { equipment_name, description } = req.body;

        if (!equipment_name) {
            return res.status(400).json({ 
                success: false, 
                message: 'Equipment name is required' 
            });
        }

        const [result] = await pool.query(
            'INSERT INTO equipment_types (equipment_name, description, created_by) VALUES (?, ?, ?)',
            [equipment_name, description, req.user.id]
        );

        res.json({
            success: true,
            message: 'Equipment type added successfully',
            equipment_id: result.insertId
        });
    } catch (error) {
        console.error('Add equipment error:', error);
        if (error.code === 'ER_DUP_ENTRY') {
            res.status(400).json({ success: false, message: 'Equipment type already exists' });
        } else {
            res.status(500).json({ success: false, message: 'Failed to add equipment type' });
        }
    }
});

// Delete equipment type (soft delete)
app.delete('/api/equipment/:id', authenticateToken, authorizeRole('admin'), async (req, res) => {
    try {
        const { id } = req.params;

        await pool.query(
            'UPDATE equipment_types SET is_active = FALSE WHERE id = ?',
            [id]
        );

        res.json({
            success: true,
            message: 'Equipment type deleted successfully'
        });
    } catch (error) {
        console.error('Delete equipment error:', error);
        res.status(500).json({ success: false, message: 'Failed to delete equipment type' });
    }
});

// =====================================================
// API ROUTES - CATEGORY MANAGEMENT (Admin Only)
// =====================================================

// Get all event categories
app.get('/api/categories', authenticateToken, async (req, res) => {
    try {
        const [categories] = await pool.query(
            'SELECT * FROM event_categories WHERE is_active = TRUE ORDER BY category_name'
        );

        res.json({
            success: true,
            categories: categories
        });
    } catch (error) {
        console.error('Get categories error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch categories' });
    }
});

// Add event category
app.post('/api/categories', authenticateToken, authorizeRole('admin'), async (req, res) => {
    try {
        const { category_name, description } = req.body;

        if (!category_name) {
            return res.status(400).json({ 
                success: false, 
                message: 'Category name is required' 
            });
        }

        const [result] = await pool.query(
            'INSERT INTO event_categories (category_name, description, created_by) VALUES (?, ?, ?)',
            [category_name, description, req.user.id]
        );

        res.json({
            success: true,
            message: 'Event category added successfully',
            category_id: result.insertId
        });
    } catch (error) {
        console.error('Add category error:', error);
        if (error.code === 'ER_DUP_ENTRY') {
            res.status(400).json({ success: false, message: 'Category already exists' });
        } else {
            res.status(500).json({ success: false, message: 'Failed to add category' });
        }
    }
});

// Delete event category (soft delete)
app.delete('/api/categories/:id', authenticateToken, authorizeRole('admin'), async (req, res) => {
    try {
        const { id } = req.params;

        await pool.query(
            'UPDATE event_categories SET is_active = FALSE WHERE id = ?',
            [id]
        );

        res.json({
            success: true,
            message: 'Event category deleted successfully'
        });
    } catch (error) {
        console.error('Delete category error:', error);
        res.status(500).json({ success: false, message: 'Failed to delete category' });
    }
});

// =====================================================
// API ROUTES - LOGBOOK ENTRIES
// =====================================================

// Create new logbook entry
app.post('/api/logbook/entries', authenticateToken, upload.single('attachment'), async (req, res) => {
    const connection = await pool.getConnection();
    
    try {
        await connection.beginTransaction();

        const {
            entry_datetime,
            event_category_id,
            equipment_id,
            severity,
            message,
            technician_ids,
            voltage_kv,
            current_a,
            power_mw,
            frequency_hz,
            power_factor,
            energy_mwh,
            send_email_notification
        } = req.body;

        // Determine substation_id and posted_by info
        let substation_id, posted_by_type, posted_by_id;
        
        if (req.user.role === 'substation') {
            substation_id = req.user.substation_id;
            posted_by_type = 'substation';
            posted_by_id = null;
        } else if (req.user.role === 'engineer') {
            substation_id = req.user.substation_id;
            posted_by_type = 'engineer';
            posted_by_id = req.user.id;
        } else {
            substation_id = req.body.substation_id; // Admin can post to any substation
            posted_by_type = 'technician';
            posted_by_id = null;
        }

        const attachment_path = req.file ? req.file.filename : null;

        // Insert logbook entry
        const [logResult] = await connection.query(
            `INSERT INTO logbook_entries 
            (substation_id, entry_datetime, event_category_id, equipment_id, severity, message, 
            attachment_path, posted_by_type, posted_by_id, send_email_notification) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [substation_id, entry_datetime, event_category_id, equipment_id, severity, message, 
            attachment_path, posted_by_type, posted_by_id, send_email_notification === 'true' || send_email_notification === true]
        );

        const log_id = logResult.insertId;

        // Insert technicians
        if (technician_ids) {
            const techIds = JSON.parse(technician_ids);
            for (const tech_id of techIds) {
                await connection.query(
                    'INSERT INTO log_technicians (log_id, technician_id) VALUES (?, ?)',
                    [log_id, tech_id]
                );
            }
        }

        // Insert electrical parameters if provided
        if (voltage_kv || current_a || power_mw || frequency_hz || power_factor || energy_mwh) {
            await connection.query(
                `INSERT INTO electrical_parameters 
                (log_id, voltage_kv, current_a, power_mw, frequency_hz, power_factor, energy_mwh) 
                VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [log_id, voltage_kv || null, current_a || null, power_mw || null, 
                frequency_hz || null, power_factor || null, energy_mwh || null]
            );
        }

        await connection.commit();

        // Send email notification if requested
        if (send_email_notification === 'true' || send_email_notification === true) {
            // Get complete log details for email
            const [logDetails] = await pool.query(`
                SELECT l.*, s.substation_name, s.substation_code,
                       ec.category_name AS event_category,
                       eq.equipment_name AS equipment,
                       GROUP_CONCAT(t.name ORDER BY t.name SEPARATOR ', ') AS technicians,
                       ep.voltage_kv, ep.current_a, ep.power_mw, 
                       ep.frequency_hz, ep.power_factor, ep.energy_mwh,
                       u.email AS engineer_email
                FROM logbook_entries l
                JOIN substations s ON l.substation_id = s.id
                LEFT JOIN event_categories ec ON l.event_category_id = ec.id
                LEFT JOIN equipment_types eq ON l.equipment_id = eq.id
                LEFT JOIN log_technicians lt ON l.id = lt.log_id
                LEFT JOIN technicians t ON lt.technician_id = t.id
                LEFT JOIN electrical_parameters ep ON l.id = ep.log_id
                LEFT JOIN users u ON s.id = u.substation_id AND u.role = 'engineer' AND u.is_active = TRUE
                WHERE l.id = ?
                GROUP BY l.id
            `, [log_id]);

            if (logDetails.length > 0 && logDetails[0].engineer_email) {
                const emailSent = await sendEmailNotification(logDetails[0], logDetails[0].engineer_email);
                
                if (emailSent) {
                    await pool.query(
                        'UPDATE logbook_entries SET email_sent = TRUE, email_sent_at = NOW() WHERE id = ?',
                        [log_id]
                    );
                }
            }
        }

        res.json({
            success: true,
            message: 'Logbook entry created successfully',
            log_id: log_id
        });

    } catch (error) {
        await connection.rollback();
        console.error('Create logbook entry error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to create logbook entry',
            error: error.message 
        });
    } finally {
        connection.release();
    }
});

// Get logbook entries with filtering and search
app.get('/api/logbook/entries', authenticateToken, async (req, res) => {
    try {
        const {
            substation_id,
            start_date,
            end_date,
            search_text,
            technician_id,
            category_id,
            severity,
            page = 1,
            limit = 50
        } = req.query;

        let whereConditions = [];
        let params = [];

        // Filter by substation based on user role
        if (req.user.role === 'engineer' || req.user.role === 'substation') {
            whereConditions.push('l.substation_id = ?');
            params.push(req.user.substation_id);
        } else if (substation_id) {
            whereConditions.push('l.substation_id = ?');
            params.push(substation_id);
        }

        // Date filters
        if (start_date) {
            whereConditions.push('DATE(l.entry_datetime) >= ?');
            params.push(start_date);
        }
        if (end_date) {
            whereConditions.push('DATE(l.entry_datetime) <= ?');
            params.push(end_date);
        }

        // Text search
        if (search_text) {
            whereConditions.push('MATCH(l.message) AGAINST (? IN NATURAL LANGUAGE MODE)');
            params.push(search_text);
        }

        // Technician filter
        if (technician_id) {
            whereConditions.push('lt.technician_id = ?');
            params.push(technician_id);
        }

        // Category filter
        if (category_id) {
            whereConditions.push('l.event_category_id = ?');
            params.push(category_id);
        }

        // Severity filter
        if (severity) {
            whereConditions.push('l.severity = ?');
            params.push(severity);
        }

        const whereClause = whereConditions.length > 0 
            ? 'WHERE ' + whereConditions.join(' AND ') 
            : '';

        // Get total count
        const countQuery = `
            SELECT COUNT(DISTINCT l.id) AS total
            FROM logbook_entries l
            LEFT JOIN log_technicians lt ON l.id = lt.log_id
            ${whereClause}
        `;
        const [countResult] = await pool.query(countQuery, params);
        const total = countResult[0].total;

        // Get entries
        const offset = (page - 1) * limit;
        const query = `
            SELECT l.*, s.substation_name, s.substation_code,
                   ec.category_name AS event_category,
                   eq.equipment_name AS equipment,
                   GROUP_CONCAT(DISTINCT t.name ORDER BY t.name SEPARATOR ', ') AS technicians,
                   GROUP_CONCAT(DISTINCT t.id ORDER BY t.name SEPARATOR ',') AS technician_ids,
                   MAX(ep.voltage_kv) AS voltage_kv, 
                   MAX(ep.current_a) AS current_a, 
                   MAX(ep.power_mw) AS power_mw, 
                   MAX(ep.frequency_hz) AS frequency_hz, 
                   MAX(ep.power_factor) AS power_factor, 
                   MAX(ep.energy_mwh) AS energy_mwh,
                   COUNT(DISTINCT c.id) AS comment_count
            FROM logbook_entries l
            JOIN substations s ON l.substation_id = s.id
            LEFT JOIN event_categories ec ON l.event_category_id = ec.id
            LEFT JOIN equipment_types eq ON l.equipment_id = eq.id
            LEFT JOIN log_technicians lt ON l.id = lt.log_id
            LEFT JOIN technicians t ON lt.technician_id = t.id
            LEFT JOIN electrical_parameters ep ON l.id = ep.log_id
            LEFT JOIN comments c ON l.id = c.log_id AND c.is_deleted = FALSE
            ${whereClause}
            GROUP BY l.id, s.substation_name, s.substation_code, 
                     ec.category_name, eq.equipment_name
            ORDER BY l.entry_datetime DESC
            LIMIT ? OFFSET ?
        `;
        params.push(parseInt(limit), offset);

        const [entries] = await pool.query(query, params);

        res.json({
            success: true,
            entries: entries,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: total,
                total_pages: Math.ceil(total / limit)
            }
        });

    } catch (error) {
        console.error('Get logbook entries error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to fetch logbook entries',
            error: error.message 
        });
    }
});

// Get single logbook entry by ID
app.get('/api/logbook/entries/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;

        const [entries] = await pool.query(`
            SELECT l.*, s.substation_name, s.substation_code,
                   ec.category_name AS event_category,
                   eq.equipment_name AS equipment,
                   GROUP_CONCAT(DISTINCT t.name ORDER BY t.name SEPARATOR ', ') AS technicians,
                   GROUP_CONCAT(DISTINCT t.id ORDER BY t.name SEPARATOR ',') AS technician_ids,
                   MAX(ep.voltage_kv) AS voltage_kv, 
                   MAX(ep.current_a) AS current_a, 
                   MAX(ep.power_mw) AS power_mw, 
                   MAX(ep.frequency_hz) AS frequency_hz, 
                   MAX(ep.power_factor) AS power_factor, 
                   MAX(ep.energy_mwh) AS energy_mwh
            FROM logbook_entries l
            JOIN substations s ON l.substation_id = s.id
            LEFT JOIN event_categories ec ON l.event_category_id = ec.id
            LEFT JOIN equipment_types eq ON l.equipment_id = eq.id
            LEFT JOIN log_technicians lt ON l.id = lt.log_id
            LEFT JOIN technicians t ON lt.technician_id = t.id
            LEFT JOIN electrical_parameters ep ON l.id = ep.log_id
            WHERE l.id = ?
            GROUP BY l.id, s.substation_name, s.substation_code,
                     ec.category_name, eq.equipment_name
        `, [id]);

        if (entries.length === 0) {
            return res.status(404).json({ 
                success: false, 
                message: 'Logbook entry not found' 
            });
        }

        res.json({
            success: true,
            entry: entries[0]
        });

    } catch (error) {
        console.error('Get logbook entry error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to fetch logbook entry' 
        });
    }
});

// Update logbook entry (within 24 hours only)
app.put('/api/logbook/entries/:id', authenticateToken, upload.single('attachment'), async (req, res) => {
    const connection = await pool.getConnection();
    
    try {
        const { id } = req.params;

        // Check if entry exists and is within 24 hours
        const [entries] = await connection.query(
            'SELECT created_at FROM logbook_entries WHERE id = ?',
            [id]
        );

        if (entries.length === 0) {
            return res.status(404).json({ 
                success: false, 
                message: 'Logbook entry not found' 
            });
        }

        if (!isWithin24Hours(entries[0].created_at)) {
            return res.status(403).json({ 
                success: false, 
                message: 'Entries can only be edited within 24 hours of creation' 
            });
        }

        await connection.beginTransaction();

        const {
            entry_datetime,
            event_category_id,
            equipment_id,
            severity,
            message,
            technician_ids,
            voltage_kv,
            current_a,
            power_mw,
            frequency_hz,
            power_factor,
            energy_mwh
        } = req.body;

        const attachment_path = req.file ? req.file.filename : undefined;

        // Update logbook entry
        let updateQuery = `
            UPDATE logbook_entries 
            SET entry_datetime = ?, event_category_id = ?, equipment_id = ?, 
                severity = ?, message = ?, is_edited = TRUE, last_edited_at = NOW()
        `;
        let updateParams = [entry_datetime, event_category_id, equipment_id, severity, message];

        if (attachment_path) {
            updateQuery += ', attachment_path = ?';
            updateParams.push(attachment_path);
        }

        updateQuery += ' WHERE id = ?';
        updateParams.push(id);

        await connection.query(updateQuery, updateParams);

        // Update technicians
        if (technician_ids) {
            await connection.query('DELETE FROM log_technicians WHERE log_id = ?', [id]);
            
            const techIds = JSON.parse(technician_ids);
            for (const tech_id of techIds) {
                await connection.query(
                    'INSERT INTO log_technicians (log_id, technician_id) VALUES (?, ?)',
                    [id, tech_id]
                );
            }
        }

        // Update electrical parameters
        if (voltage_kv !== undefined || current_a !== undefined || power_mw !== undefined || 
            frequency_hz !== undefined || power_factor !== undefined || energy_mwh !== undefined) {
            
            await connection.query('DELETE FROM electrical_parameters WHERE log_id = ?', [id]);
            
            if (voltage_kv || current_a || power_mw || frequency_hz || power_factor || energy_mwh) {
                await connection.query(
                    `INSERT INTO electrical_parameters 
                    (log_id, voltage_kv, current_a, power_mw, frequency_hz, power_factor, energy_mwh) 
                    VALUES (?, ?, ?, ?, ?, ?, ?)`,
                    [id, voltage_kv || null, current_a || null, power_mw || null, 
                    frequency_hz || null, power_factor || null, energy_mwh || null]
                );
            }
        }

        await connection.commit();

        res.json({
            success: true,
            message: 'Logbook entry updated successfully'
        });

    } catch (error) {
        await connection.rollback();
        console.error('Update logbook entry error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to update logbook entry',
            error: error.message 
        });
    } finally {
        connection.release();
    }
});

// Delete logbook entry (within 24 hours only)
app.delete('/api/logbook/entries/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;

        // Check if entry exists and is within 24 hours
        const [entries] = await pool.query(
            'SELECT created_at, attachment_path FROM logbook_entries WHERE id = ?',
            [id]
        );

        if (entries.length === 0) {
            return res.status(404).json({ 
                success: false, 
                message: 'Logbook entry not found' 
            });
        }

        if (!isWithin24Hours(entries[0].created_at)) {
            return res.status(403).json({ 
                success: false, 
                message: 'Entries can only be deleted within 24 hours of creation' 
            });
        }

        // Delete attachment file if exists
        if (entries[0].attachment_path) {
            const filePath = path.join(__dirname, 'uploads', entries[0].attachment_path);
            try {
                await fs.unlink(filePath);
            } catch (err) {
                console.error('Failed to delete attachment file:', err);
            }
        }

        // Delete entry (cascade will handle related records)
        await pool.query('DELETE FROM logbook_entries WHERE id = ?', [id]);

        res.json({
            success: true,
            message: 'Logbook entry deleted successfully'
        });

    } catch (error) {
        console.error('Delete logbook entry error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to delete logbook entry' 
        });
    }
});

// =====================================================
// API ROUTES - COMMENTS (Engineer Comments on Entries)
// =====================================================

// Get comments for a log entry
app.get('/api/logbook/entries/:log_id/comments', authenticateToken, async (req, res) => {
    try {
        const { log_id } = req.params;

        const [comments] = await pool.query(`
            SELECT c.*, u.full_name, u.role
            FROM comments c
            JOIN users u ON c.user_id = u.id
            WHERE c.log_id = ? AND c.is_deleted = FALSE
            ORDER BY c.created_at ASC
        `, [log_id]);

        res.json({
            success: true,
            comments: comments
        });

    } catch (error) {
        console.error('Get comments error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch comments' });
    }
});

// Add comment (Engineer only)
app.post('/api/logbook/entries/:log_id/comments', authenticateToken, authorizeRole('engineer'), async (req, res) => {
    try {
        const { log_id } = req.params;
        const { comment_text } = req.body;

        if (!comment_text) {
            return res.status(400).json({ 
                success: false, 
                message: 'Comment text is required' 
            });
        }

        const [result] = await pool.query(
            'INSERT INTO comments (log_id, user_id, comment_text) VALUES (?, ?, ?)',
            [log_id, req.user.id, comment_text]
        );

        res.json({
            success: true,
            message: 'Comment added successfully',
            comment_id: result.insertId
        });

    } catch (error) {
        console.error('Add comment error:', error);
        res.status(500).json({ success: false, message: 'Failed to add comment' });
    }
});

// Edit comment (Engineer can edit their own)
app.put('/api/logbook/comments/:comment_id', authenticateToken, authorizeRole('engineer'), async (req, res) => {
    try {
        const { comment_id } = req.params;
        const { comment_text } = req.body;

        // Check if comment belongs to user
        const [comments] = await pool.query(
            'SELECT user_id FROM comments WHERE id = ? AND is_deleted = FALSE',
            [comment_id]
        );

        if (comments.length === 0) {
            return res.status(404).json({ 
                success: false, 
                message: 'Comment not found' 
            });
        }

        if (comments[0].user_id !== req.user.id) {
            return res.status(403).json({ 
                success: false, 
                message: 'You can only edit your own comments' 
            });
        }

        await pool.query(
            'UPDATE comments SET comment_text = ?, is_edited = TRUE, updated_at = NOW() WHERE id = ?',
            [comment_text, comment_id]
        );

        res.json({
            success: true,
            message: 'Comment updated successfully'
        });

    } catch (error) {
        console.error('Edit comment error:', error);
        res.status(500).json({ success: false, message: 'Failed to edit comment' });
    }
});

// Delete comment (Engineer can delete their own)
app.delete('/api/logbook/comments/:comment_id', authenticateToken, authorizeRole('engineer'), async (req, res) => {
    try {
        const { comment_id } = req.params;

        // Check if comment belongs to user
        const [comments] = await pool.query(
            'SELECT user_id FROM comments WHERE id = ? AND is_deleted = FALSE',
            [comment_id]
        );

        if (comments.length === 0) {
            return res.status(404).json({ 
                success: false, 
                message: 'Comment not found' 
            });
        }

        if (comments[0].user_id !== req.user.id) {
            return res.status(403).json({ 
                success: false, 
                message: 'You can only delete your own comments' 
            });
        }

        await pool.query(
            'UPDATE comments SET is_deleted = TRUE WHERE id = ?',
            [comment_id]
        );

        res.json({
            success: true,
            message: 'Comment deleted successfully'
        });

    } catch (error) {
        console.error('Delete comment error:', error);
        res.status(500).json({ success: false, message: 'Failed to delete comment' });
    }
});

// =====================================================
// API ROUTES - REPORTS
// =====================================================

// Get daily summary
app.get('/api/reports/daily-summary', authenticateToken, async (req, res) => {
    try {
        const { substation_id, date } = req.query;

        let whereConditions = [];
        let params = [];

        // Filter by substation based on user role
        if (req.user.role === 'engineer' || req.user.role === 'substation') {
            whereConditions.push('substation_id = ?');
            params.push(req.user.substation_id);
        } else if (substation_id) {
            whereConditions.push('substation_id = ?');
            params.push(substation_id);
        }

        if (date) {
            whereConditions.push('log_date = ?');
            params.push(date);
        }

        const whereClause = whereConditions.length > 0 
            ? 'WHERE ' + whereConditions.join(' AND ') 
            : '';

        const [summary] = await pool.query(`
            SELECT * FROM v_daily_summary
            ${whereClause}
            ORDER BY log_date DESC, substation_name
        `, params);

        res.json({
            success: true,
            summary: summary
        });

    } catch (error) {
        console.error('Get daily summary error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch daily summary' });
    }
});

// Get monthly summary
app.get('/api/reports/monthly-summary', authenticateToken, async (req, res) => {
    try {
        const { substation_id, year, month } = req.query;

        let whereConditions = [];
        let params = [];

        // Filter by substation based on user role
        if (req.user.role === 'engineer' || req.user.role === 'substation') {
            whereConditions.push('l.substation_id = ?');
            params.push(req.user.substation_id);
        } else if (substation_id) {
            whereConditions.push('l.substation_id = ?');
            params.push(substation_id);
        }

        if (year && month) {
            whereConditions.push('YEAR(l.entry_datetime) = ? AND MONTH(l.entry_datetime) = ?');
            params.push(year, month);
        }

        const whereClause = whereConditions.length > 0 
            ? 'WHERE ' + whereConditions.join(' AND ') 
            : '';

        const [summary] = await pool.query(`
            SELECT 
                s.substation_name,
                COUNT(*) AS total_logs,
                SUM(CASE WHEN l.severity = 'Normal' THEN 1 ELSE 0 END) AS normal_count,
                SUM(CASE WHEN l.severity = 'Warning' THEN 1 ELSE 0 END) AS warning_count,
                SUM(CASE WHEN l.severity = 'Critical' THEN 1 ELSE 0 END) AS critical_count,
                COUNT(DISTINCT DATE(l.entry_datetime)) AS active_days
            FROM logbook_entries l
            JOIN substations s ON l.substation_id = s.id
            ${whereClause}
            GROUP BY l.substation_id, s.substation_name
        `, params);

        res.json({
            success: true,
            summary: summary
        });

    } catch (error) {
        console.error('Get monthly summary error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch monthly summary' });
    }
});

// Export to PDF
app.post('/api/reports/export-pdf', authenticateToken, async (req, res) => {
    try {
        const { entries, report_title } = req.body;

        const doc = new PDFDocument({ margin: 50 });
        
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="logbook-report-${Date.now()}.pdf"`);
        
        doc.pipe(res);

        // Header
        doc.fontSize(20).text(report_title || 'Substation Logbook Report', { align: 'center' });
        doc.fontSize(10).text(`Generated on: ${formatDateTimeForDisplay(new Date())}`, { align: 'center' });
        doc.moveDown(2);

        // Entries
        entries.forEach((entry, index) => {
            if (index > 0) doc.moveDown(1.5);

            doc.fontSize(12).fillColor('blue').text(`Entry #${index + 1}`, { underline: true });
            doc.fontSize(10).fillColor('black');
            doc.text(`Substation: ${entry.substation_name}`);
            doc.text(`Date/Time: ${formatDateTimeForDisplay(entry.entry_datetime)}`);
            doc.text(`Severity: ${entry.severity}`);
            
            if (entry.event_category) doc.text(`Category: ${entry.event_category}`);
            if (entry.equipment) doc.text(`Equipment: ${entry.equipment}`);
            if (entry.technicians) doc.text(`Technicians: ${entry.technicians}`);
            
            doc.moveDown(0.5);
            doc.text(`Message:`, { continued: false });
            doc.fontSize(9).text(entry.message, { indent: 20 });
            doc.fontSize(10);

            // Add page break if needed
            if (doc.y > 700) doc.addPage();
        });

        doc.end();

    } catch (error) {
        console.error('Export PDF error:', error);
        res.status(500).json({ success: false, message: 'Failed to export PDF' });
    }
});

// Export to Excel
app.post('/api/reports/export-excel', authenticateToken, async (req, res) => {
    try {
        const { entries, report_title } = req.body;

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Logbook Entries');

        // Define columns
        worksheet.columns = [
            { header: 'Date/Time', key: 'entry_datetime', width: 20 },
            { header: 'Substation', key: 'substation_name', width: 25 },
            { header: 'Severity', key: 'severity', width: 12 },
            { header: 'Category', key: 'event_category', width: 20 },
            { header: 'Equipment', key: 'equipment', width: 20 },
            { header: 'Technicians', key: 'technicians', width: 30 },
            { header: 'Message', key: 'message', width: 50 },
            { header: 'Voltage (kV)', key: 'voltage_kv', width: 12 },
            { header: 'Current (A)', key: 'current_a', width: 12 },
            { header: 'Power (MW)', key: 'power_mw', width: 12 }
        ];

        // Style header row
        worksheet.getRow(1).font = { bold: true };
        worksheet.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF4472C4' }
        };
        worksheet.getRow(1).font = { color: { argb: 'FFFFFFFF' }, bold: true };

        // Add data rows
        entries.forEach(entry => {
            worksheet.addRow({
                entry_datetime: formatDateTimeForDisplay(entry.entry_datetime),
                substation_name: entry.substation_name,
                severity: entry.severity,
                event_category: entry.event_category || '',
                equipment: entry.equipment || '',
                technicians: entry.technicians || '',
                message: entry.message,
                voltage_kv: entry.voltage_kv || '',
                current_a: entry.current_a || '',
                power_mw: entry.power_mw || ''
            });
        });

        // Set response headers
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="logbook-report-${Date.now()}.xlsx"`);

        await workbook.xlsx.write(res);
        res.end();

    } catch (error) {
        console.error('Export Excel error:', error);
        res.status(500).json({ success: false, message: 'Failed to export Excel' });
    }
});

// =====================================================
// API ROUTES - EMAIL CONFIGURATION (Admin Only)
// =====================================================

// Get email configuration
app.get('/api/email-config', authenticateToken, authorizeRole('admin'), async (req, res) => {
    try {
        const [configs] = await pool.query(
            'SELECT smtp_host, smtp_port, smtp_secure, smtp_user, from_email, from_name, is_active FROM email_config WHERE is_active = TRUE LIMIT 1'
        );

        res.json({
            success: true,
            config: configs.length > 0 ? configs[0] : null
        });
    } catch (error) {
        console.error('Get email config error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch email configuration' });
    }
});

// Update email configuration
app.post('/api/email-config', authenticateToken, authorizeRole('admin'), async (req, res) => {
    try {
        const { smtp_host, smtp_port, smtp_secure, smtp_user, smtp_password, from_email, from_name } = req.body;

        // Deactivate all existing configs
        await pool.query('UPDATE email_config SET is_active = FALSE');

        // Insert new configuration
        await pool.query(
            `INSERT INTO email_config 
            (smtp_host, smtp_port, smtp_secure, smtp_user, smtp_password, from_email, from_name, updated_by) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [smtp_host, smtp_port, smtp_secure, smtp_user, smtp_password, from_email, from_name, req.user.id]
        );

        // Reinitialize email transporter
        await initEmailTransporter();

        res.json({
            success: true,
            message: 'Email configuration updated successfully'
        });

    } catch (error) {
        console.error('Update email config error:', error);
        res.status(500).json({ success: false, message: 'Failed to update email configuration' });
    }
});

// =====================================================
// API ROUTES - DATABASE BACKUP (Admin Only)
// =====================================================

// Manual backup
app.post('/api/backup/manual', authenticateToken, authorizeRole('admin'), async (req, res) => {
    try {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `substation_logbook_backup_${timestamp}.sql`;
        const backupPath = path.join(__dirname, 'backups', filename);

        // Ensure backup directory exists
        await fs.mkdir(path.join(__dirname, 'backups'), { recursive: true });

        // Execute mysqldump
        const command = `mysqldump -u ${process.env.DB_USER} -p${process.env.DB_PASSWORD} ${process.env.DB_NAME} > "${backupPath}"`;
        await execPromise(command);

        // Get file size
        const stats = await fs.stat(backupPath);
        const fileSizeMB = stats.size / (1024 * 1024);

        // Record backup in database
        await pool.query(
            'INSERT INTO backup_history (backup_filename, backup_path, backup_size_mb, backup_type, created_by, status) VALUES (?, ?, ?, ?, ?, ?)',
            [filename, backupPath, fileSizeMB.toFixed(2), 'manual', req.user.id, 'success']
        );

        res.json({
            success: true,
            message: 'Backup created successfully',
            filename: filename,
            size_mb: fileSizeMB.toFixed(2)
        });

    } catch (error) {
        console.error('Manual backup error:', error);
        
        // Record failed backup
        await pool.query(
            'INSERT INTO backup_history (backup_filename, backup_path, backup_type, created_by, status, error_message) VALUES (?, ?, ?, ?, ?, ?)',
            ['failed_backup', '', 'manual', req.user.id, 'failed', error.message]
        );

        res.status(500).json({ success: false, message: 'Backup failed', error: error.message });
    }
});

// Get backup history
app.get('/api/backup/history', authenticateToken, authorizeRole('admin'), async (req, res) => {
    try {
        const [backups] = await pool.query(`
            SELECT bh.*, u.full_name AS created_by_name
            FROM backup_history bh
            LEFT JOIN users u ON bh.created_by = u.id
            ORDER BY bh.created_at DESC
            LIMIT 50
        `);

        res.json({
            success: true,
            backups: backups
        });
    } catch (error) {
        console.error('Get backup history error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch backup history' });
    }
});

// Download backup file
app.get('/api/backup/download/:filename', authenticateToken, authorizeRole('admin'), async (req, res) => {
    try {
        const { filename } = req.params;
        const filePath = path.join(__dirname, 'backups', filename);

        // Check if file exists
        await fs.access(filePath);

        res.download(filePath, filename);

    } catch (error) {
        console.error('Download backup error:', error);
        res.status(404).json({ success: false, message: 'Backup file not found' });
    }
});

// =====================================================
// AUTOMATIC BACKUP SCHEDULER
// =====================================================
async function performAutomaticBackup() {
    try {
        console.log('Starting automatic database backup...');

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `substation_logbook_auto_backup_${timestamp}.sql`;
        const backupPath = path.join(__dirname, 'backups', filename);

        // Ensure backup directory exists
        await fs.mkdir(path.join(__dirname, 'backups'), { recursive: true });

        // Execute mysqldump
        const command = `mysqldump -u ${process.env.DB_USER} -p${process.env.DB_PASSWORD} ${process.env.DB_NAME} > "${backupPath}"`;
        await execPromise(command);

        // Get file size
        const stats = await fs.stat(backupPath);
        const fileSizeMB = stats.size / (1024 * 1024);

        // Record backup in database
        await pool.query(
            'INSERT INTO backup_history (backup_filename, backup_path, backup_size_mb, backup_type, status) VALUES (?, ?, ?, ?, ?)',
            [filename, backupPath, fileSizeMB.toFixed(2), 'automatic', 'success']
        );

        console.log(`✅ Automatic backup completed: ${filename} (${fileSizeMB.toFixed(2)} MB)`);

        // Clean old backups (keep last 90 days)
        const retentionDays = parseInt(process.env.BACKUP_RETENTION_DAYS) || 90;
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

        const [oldBackups] = await pool.query(
            'SELECT backup_path FROM backup_history WHERE created_at < ? AND status = ?',
            [cutoffDate, 'success']
        );

        for (const backup of oldBackups) {
            try {
                await fs.unlink(backup.backup_path);
            } catch (err) {
                console.error(`Failed to delete old backup: ${backup.backup_path}`, err);
            }
        }

        await pool.query(
            'DELETE FROM backup_history WHERE created_at < ?',
            [cutoffDate]
        );

        console.log(`✅ Cleaned ${oldBackups.length} old backups`);

    } catch (error) {
        console.error('❌ Automatic backup failed:', error);
        
        // Record failed backup
        await pool.query(
            'INSERT INTO backup_history (backup_filename, backup_path, backup_type, status, error_message) VALUES (?, ?, ?, ?, ?)',
            ['auto_failed_backup', '', 'automatic', 'failed', error.message]
        );
    }
}

// Schedule automatic backup (default: daily at 2:00 AM)
const backupSchedule = process.env.BACKUP_SCHEDULE || '0 2 * * *';
cron.schedule(backupSchedule, performAutomaticBackup);

// =====================================================
// ERROR HANDLING
// =====================================================

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: 'Route not found'
    });
});

// Global error handler
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// =====================================================
// SERVER INITIALIZATION
// =====================================================

async function startServer() {
    try {
        // Initialize database
        const dbConnected = await initDatabase();
        if (!dbConnected) {
            console.error('Failed to connect to database. Exiting...');
            process.exit(1);
        }

        // Initialize email transporter
        await initEmailTransporter();

        // Ensure required directories exist
        await fs.mkdir(path.join(__dirname, 'uploads'), { recursive: true });
        await fs.mkdir(path.join(__dirname, 'backups'), { recursive: true });

        // Start server
        app.listen(PORT, () => {
            console.log('=====================================================');
            console.log('  Substation Logbook Management System');
            console.log('  SDSC SHAR - Construction & Maintenance Group');
            console.log('=====================================================');
            console.log(`🚀 Server running on http://localhost:${PORT}`);
            console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
            console.log(`⏰ Automatic backup scheduled: ${backupSchedule}`);
            console.log('=====================================================');
        });

    } catch (error) {
        console.error('❌ Server initialization failed:', error);
        process.exit(1);
    }
}

// Start the server
startServer();

// Graceful shutdown
process.on('SIGTERM', async () => {
    console.log('SIGTERM received. Closing server gracefully...');
    if (pool) {
        await pool.end();
    }
    process.exit(0);
});

process.on('SIGINT', async () => {
    console.log('SIGINT received. Closing server gracefully...');
    if (pool) {
        await pool.end();
    }
    process.exit(0);
});

