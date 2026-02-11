/**
 * Main Application Logic
 */

const API_URL = window.location.origin + '/api';
let currentUser = null;
let authToken = null;

// Check authentication on page load
document.addEventListener('DOMContentLoaded', async function() {
    // Check if on dashboard page
    if (!window.location.pathname.includes('dashboard.html')) {
        return;
    }

    authToken = localStorage.getItem('auth_token');
    const userInfo = localStorage.getItem('user_info');

    if (!authToken || !userInfo) {
        window.location.href = '/index.html';
        return;
    }

    try {
        currentUser = JSON.parse(userInfo);
        
        // Verify token
        const response = await fetchAPI('/auth/verify');
        if (!response.success) {
            throw new Error('Invalid token');
        }

        // Initialize UI
        initializeUI();
        initializeNavigation();
        
        // Load initial page
        showPage('dashboard');
        loadDashboardData();

    } catch (error) {
        console.error('Auth error:', error);
        logout();
    }
});

// Initialize UI based on user role
function initializeUI() {
    // Set user info in navbar
    const usernameEl = document.getElementById('navbar-username');
    const roleEl = document.getElementById('navbar-role');
    
    if (currentUser.full_name) {
        usernameEl.textContent = currentUser.full_name;
        roleEl.textContent = currentUser.role;
    } else if (currentUser.substation_name) {
        usernameEl.textContent = currentUser.substation_name;
        roleEl.textContent = 'Substation';
    }

    // Hide admin-only menu items for non-admins
    if (currentUser.role !== 'admin') {
        document.querySelectorAll('.admin-only').forEach(el => {
            el.style.display = 'none';
        });
    }

    // Hide email notification for non-substation/technician users
    if (currentUser.role === 'engineer' || currentUser.role === 'admin') {
        const emailGroup = document.getElementById('email-notification-group');
        if (emailGroup) emailGroup.style.display = 'none';
    }
}

// Navigation
function initializeNavigation() {
    document.querySelectorAll('.menu-item').forEach(item => {
        item.addEventListener('click', function() {
            const page = this.dataset.page;
            
            // Update active menu item
            document.querySelectorAll('.menu-item').forEach(mi => mi.classList.remove('active'));
            this.classList.add('active');
            
            // Show page
            showPage(page);
        });
    });
}

function showPage(pageName) {
    // Hide all pages
    document.querySelectorAll('.page').forEach(page => page.classList.remove('active'));
    
    // Show selected page
    const page = document.getElementById(`${pageName}-page`);
    if (page) {
        page.classList.add('active');
        
        // Load page-specific data
        switch(pageName) {
            case 'dashboard':
                loadDashboardData();
                break;
            case 'post':
                loadPostFormData();
                break;
            case 'search':
                loadSearchFormData();
                break;
            case 'technicians':
                if (typeof loadTechniciansPage === 'function') loadTechniciansPage();
                break;
            case 'substations':
                if (typeof loadSubstationsPage === 'function') loadSubstationsPage();
                break;
            case 'users':
                if (typeof loadUsersPage === 'function') loadUsersPage();
                break;
            case 'settings':
                if (typeof loadSettingsPage === 'function') loadSettingsPage();
                break;
            case 'reports':
                if (typeof loadReportsPage === 'function') loadReportsPage();
                break;
        }
    }
}

// API helper function
async function fetchAPI(endpoint, options = {}) {
    const defaultOptions = {
        headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
        }
    };

    // Merge options
    const finalOptions = {
        ...defaultOptions,
        ...options,
        headers: {
            ...defaultOptions.headers,
            ...options.headers
        }
    };

    const response = await fetch(`${API_URL}${endpoint}`, finalOptions);
    return await response.json();
}

// Logout
function logout() {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user_info');
    window.location.href = '/index.html';
}

// Modal functions
function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('active');
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('active');
    }
}

// Format datetime
function formatDateTime(datetime) {
    const date = new Date(datetime);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${day}/${month}/${year} ${hours}:${minutes}`;
}

// Format date
function formatDate(date) {
    const d = new Date(date);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
}

// Show alert
function showAlert(elementId, type, message) {
    const alertEl = document.getElementById(elementId);
    if (alertEl) {
        alertEl.className = `alert alert-${type}`;
        alertEl.textContent = message;
        alertEl.style.display = 'block';
        
        // Auto-hide after 5 seconds
        setTimeout(() => {
            alertEl.style.display = 'none';
        }, 5000);
    }
}
