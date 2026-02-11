/**
 * =====================================================
 * Authentication Module
 * Handles login, logout, and token management
 * =====================================================
 */

const API_BASE_URL = window.location.origin;

// Tab switching for login
document.querySelectorAll('.tab-button').forEach(button => {
    button.addEventListener('click', function() {
        const tab = this.dataset.tab;
        
        // Update tab buttons
        document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
        this.classList.add('active');
        
        // Update form containers
        document.querySelectorAll('.login-form-container').forEach(container => {
            container.classList.remove('active');
        });
        document.getElementById(`${tab}-login`).classList.add('active');
    });
});

// Admin/Engineer Login
document.getElementById('adminLoginForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const submitBtn = this.querySelector('button[type="submit"]');
    const btnText = submitBtn.querySelector('.btn-text');
    const btnLoader = submitBtn.querySelector('.btn-loader');
    const alertDiv = document.getElementById('admin-alert');
    
    // Get form data
    const username = document.getElementById('admin-username').value;
    const password = document.getElementById('admin-password').value;
    
    // Show loading
    btnText.style.display = 'none';
    btnLoader.style.display = 'inline-flex';
    submitBtn.disabled = true;
    alertDiv.style.display = 'none';
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password })
        });
        
        const data = await response.json();
        
        if (data.success) {
            // Store token and user info
            localStorage.setItem('auth_token', data.token);
            localStorage.setItem('user_info', JSON.stringify(data.user));
            
            // Show success and redirect
            showAlert(alertDiv, 'success', 'Login successful! Redirecting...');
            setTimeout(() => {
                window.location.href = '/dashboard.html';
            }, 1000);
        } else {
            showAlert(alertDiv, 'danger', data.message || 'Login failed');
            btnText.style.display = 'inline';
            btnLoader.style.display = 'none';
            submitBtn.disabled = false;
        }
    } catch (error) {
        console.error('Login error:', error);
        showAlert(alertDiv, 'danger', 'Network error. Please try again.');
        btnText.style.display = 'inline';
        btnLoader.style.display = 'none';
        submitBtn.disabled = false;
    }
});

// Substation Login
document.getElementById('substationLoginForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const submitBtn = this.querySelector('button[type="submit"]');
    const btnText = submitBtn.querySelector('.btn-text');
    const btnLoader = submitBtn.querySelector('.btn-loader');
    const alertDiv = document.getElementById('substation-alert');
    
    // Get form data
    const substation_code = document.getElementById('substation-code').value;
    const password = document.getElementById('substation-password').value;
    
    // Show loading
    btnText.style.display = 'none';
    btnLoader.style.display = 'inline-flex';
    submitBtn.disabled = true;
    alertDiv.style.display = 'none';
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/auth/substation-login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ substation_code, password })
        });
        
        const data = await response.json();
        
        if (data.success) {
            // Store token and substation info
            localStorage.setItem('auth_token', data.token);
            localStorage.setItem('user_info', JSON.stringify(data.substation));
            
            // Show success and redirect
            showAlert(alertDiv, 'success', 'Login successful! Redirecting...');
            setTimeout(() => {
                window.location.href = '/dashboard.html';
            }, 1000);
        } else {
            showAlert(alertDiv, 'danger', data.message || 'Login failed');
            btnText.style.display = 'inline';
            btnLoader.style.display = 'none';
            submitBtn.disabled = false;
        }
    } catch (error) {
        console.error('Login error:', error);
        showAlert(alertDiv, 'danger', 'Network error. Please try again.');
        btnText.style.display = 'inline';
        btnLoader.style.display = 'none';
        submitBtn.disabled = false;
    }
});

// Helper function to show alerts
function showAlert(element, type, message) {
    element.className = `alert alert-${type}`;
    element.textContent = message;
    element.style.display = 'block';
}

// Check if already logged in
if (window.location.pathname === '/' || window.location.pathname === '/index.html') {
    const token = localStorage.getItem('auth_token');
    if (token) {
        // Verify token
        fetch(`${API_BASE_URL}/api/auth/verify`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                window.location.href = '/dashboard.html';
            }
        })
        .catch(() => {
            // Token invalid, stay on login page
            localStorage.removeItem('auth_token');
            localStorage.removeItem('user_info');
        });
    }
}
