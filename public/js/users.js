/**
 * Users Management
 */

let allUsersData = [];
let allSubstationsForUsers = [];

// Load users page
async function loadUsersPage() {
    await Promise.all([
        loadUsers(),
        loadSubstationsForUsers()
    ]);
}

// Load all users
async function loadUsers() {
    const tbody = document.getElementById('users-tbody');
    tbody.innerHTML = '<tr><td colspan="8" class="text-center">Loading...</td></tr>';
    
    try {
        const response = await fetchAPI('/users');
        if (response.success) {
            allUsersData = response.users;
            displayUsers(response.users);
        }
    } catch (error) {
        console.error('Error loading users:', error);
        tbody.innerHTML = '<tr><td colspan="8" class="text-center">Error loading users</td></tr>';
    }
}

// Load substations for user assignment
async function loadSubstationsForUsers() {
    try {
        const response = await fetchAPI('/substations');
        if (response.success) {
            allSubstationsForUsers = response.substations;
            const select = document.getElementById('user-substation');
            select.innerHTML = '<option value="">Select Substation</option>';
            response.substations.forEach(sub => {
                const option = document.createElement('option');
                option.value = sub.id;
                option.textContent = `${sub.substation_code} - ${sub.substation_name}`;
                select.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Error loading substations:', error);
    }
}

// Display users in table
function displayUsers(users) {
    const tbody = document.getElementById('users-tbody');
    
    if (users.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="text-center">No users found</td></tr>';
        return;
    }
    
    tbody.innerHTML = users.map(user => {
        const substation = allSubstationsForUsers.find(s => s.id === user.substation_id);
        const substationName = substation ? `${substation.substation_code}` : '-';
        const lastLogin = user.last_login ? formatDateTime(user.last_login) : 'Never';
        
        return `
            <tr>
                <td><strong>${user.username}</strong></td>
                <td>${user.full_name}</td>
                <td>${user.email}</td>
                <td>
                    <span class="badge badge-${user.role === 'admin' ? 'danger' : 'primary'}">
                        ${user.role.toUpperCase()}
                    </span>
                </td>
                <td>${substationName}</td>
                <td>
                    <span class="badge badge-${user.is_active ? 'success' : 'danger'}">
                        ${user.is_active ? 'Active' : 'Inactive'}
                    </span>
                </td>
                <td><small>${lastLogin}</small></td>
                <td>
                    <button class="btn btn-sm btn-info" onclick="editUser(${user.id})" title="Edit">
                        ✏️
                    </button>
                    <button class="btn btn-sm btn-${user.is_active ? 'warning' : 'success'}" 
                            onclick="toggleUserStatus(${user.id})" 
                            title="${user.is_active ? 'Deactivate' : 'Activate'}">
                        ${user.is_active ? '🔒' : '🔓'}
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

// Show add user modal
function showAddUserModal() {
    document.getElementById('user-modal-title').textContent = 'Add User';
    document.getElementById('user-form').reset();
    document.getElementById('user-id').value = '';
    document.getElementById('user-username').disabled = false;
    document.getElementById('user-password').required = true;
    document.getElementById('user-password-confirm').required = true;
    document.getElementById('user-substation-group').style.display = 'none';
    document.getElementById('user-form-alert').innerHTML = '';
    openModal('user-modal');
}

// Edit user
function editUser(id) {
    const user = allUsersData.find(u => u.id === id);
    if (!user) return;
    
    document.getElementById('user-modal-title').textContent = 'Edit User';
    document.getElementById('user-id').value = user.id;
    document.getElementById('user-username').value = user.username;
    document.getElementById('user-username').disabled = true; // Cannot change username
    document.getElementById('user-fullname').value = user.full_name;
    document.getElementById('user-email').value = user.email;
    document.getElementById('user-phone').value = user.phone || '';
    document.getElementById('user-emp-id').value = user.employee_id || '';
    document.getElementById('user-role').value = user.role;
    document.getElementById('user-password').value = '';
    document.getElementById('user-password-confirm').value = '';
    document.getElementById('user-password').required = false;
    document.getElementById('user-password-confirm').required = false;
    
    // Show/hide substation field based on role
    if (user.role === 'engineer') {
        document.getElementById('user-substation-group').style.display = 'block';
        document.getElementById('user-substation').value = user.substation_id || '';
        document.getElementById('user-substation').required = true;
    } else {
        document.getElementById('user-substation-group').style.display = 'none';
        document.getElementById('user-substation').required = false;
    }
    
    document.getElementById('user-form-alert').innerHTML = '';
    openModal('user-modal');
}

// Toggle substation field based on role
function toggleSubstationField() {
    const role = document.getElementById('user-role').value;
    const substationGroup = document.getElementById('user-substation-group');
    const substationSelect = document.getElementById('user-substation');
    
    if (role === 'engineer') {
        substationGroup.style.display = 'block';
        substationSelect.required = true;
    } else {
        substationGroup.style.display = 'none';
        substationSelect.required = false;
        substationSelect.value = '';
    }
}

// Password validation
document.addEventListener('DOMContentLoaded', function() {
    const passwordInput = document.getElementById('user-password');
    if (passwordInput) {
        passwordInput.addEventListener('input', function() {
            const password = this.value;
            const requirements = document.getElementById('password-requirements');
            
            if (password.length > 0) {
                requirements.style.display = 'block';
                
                // Check length
                const lengthReq = document.getElementById('req-length');
                if (password.length >= 8) {
                    lengthReq.style.color = 'green';
                    lengthReq.innerHTML = '✓ At least 8 characters';
                } else {
                    lengthReq.style.color = 'red';
                    lengthReq.innerHTML = '✗ At least 8 characters';
                }
                
                // Check uppercase
                const uppercaseReq = document.getElementById('req-uppercase');
                if (/[A-Z]/.test(password)) {
                    uppercaseReq.style.color = 'green';
                    uppercaseReq.innerHTML = '✓ One uppercase letter';
                } else {
                    uppercaseReq.style.color = 'red';
                    uppercaseReq.innerHTML = '✗ One uppercase letter';
                }
                
                // Check lowercase
                const lowercaseReq = document.getElementById('req-lowercase');
                if (/[a-z]/.test(password)) {
                    lowercaseReq.style.color = 'green';
                    lowercaseReq.innerHTML = '✓ One lowercase letter';
                } else {
                    lowercaseReq.style.color = 'red';
                    lowercaseReq.innerHTML = '✗ One lowercase letter';
                }
                
                // Check number
                const numberReq = document.getElementById('req-number');
                if (/[0-9]/.test(password)) {
                    numberReq.style.color = 'green';
                    numberReq.innerHTML = '✓ One number';
                } else {
                    numberReq.style.color = 'red';
                    numberReq.innerHTML = '✗ One number';
                }
            } else {
                requirements.style.display = 'none';
            }
        });
    }
});

// Save user
async function saveUser() {
    const id = document.getElementById('user-id').value;
    const password = document.getElementById('user-password').value;
    const confirmPassword = document.getElementById('user-password-confirm').value;
    
    const data = {
        username: document.getElementById('user-username').value,
        full_name: document.getElementById('user-fullname').value,
        email: document.getElementById('user-email').value,
        phone: document.getElementById('user-phone').value,
        employee_id: document.getElementById('user-emp-id').value,
        role: document.getElementById('user-role').value
    };
    
    // Add password if provided
    if (password) {
        if (password !== confirmPassword) {
            showAlert('user-form-alert', 'danger', 'Passwords do not match');
            return;
        }
        
        // Validate password strength
        if (password.length < 8) {
            showAlert('user-form-alert', 'danger', 'Password must be at least 8 characters');
            return;
        }
        
        data.password = password;
    }
    
    // Add substation if engineer
    if (data.role === 'engineer') {
        const substationId = document.getElementById('user-substation').value;
        if (!substationId) {
            showAlert('user-form-alert', 'danger', 'Please select a substation for engineer');
            return;
        }
        data.substation_id = substationId;
    }
    
    if (!data.username || !data.full_name || !data.email || !data.role) {
        showAlert('user-form-alert', 'danger', 'Please fill all required fields');
        return;
    }
    
    if (!id && !password) {
        showAlert('user-form-alert', 'danger', 'Password is required for new user');
        return;
    }
    
    try {
        const url = id ? `/users/${id}` : '/users';
        const method = id ? 'PUT' : 'POST';
        
        const response = await fetchAPI(url, {
            method: method,
            body: JSON.stringify(data)
        });
        
        if (response.success) {
            showAlert('user-form-alert', 'success', id ? 'User updated successfully!' : 'User added successfully!');
            setTimeout(() => {
                closeModal('user-modal');
                loadUsers();
            }, 1500);
        } else {
            showAlert('user-form-alert', 'danger', response.message || 'Error saving user');
        }
    } catch (error) {
        console.error('Error saving user:', error);
        showAlert('user-form-alert', 'danger', 'Error saving user');
    }
}

// Toggle user status
async function toggleUserStatus(id) {
    const user = allUsersData.find(u => u.id === id);
    const action = user.is_active ? 'deactivate' : 'activate';
    
    if (!confirm(`Are you sure you want to ${action} this user?`)) {
        return;
    }
    
    try {
        const response = await fetchAPI(`/users/${id}/toggle-status`, {
            method: 'PATCH'
        });
        
        if (response.success) {
            alert(`User ${action}d successfully!`);
            loadUsers();
        } else {
            alert(response.message || `Error ${action}ing user`);
        }
    } catch (error) {
        console.error('Error toggling user status:', error);
        alert(`Error ${action}ing user`);
    }
}
