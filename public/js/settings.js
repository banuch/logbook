/**
 * Settings Page Management
 */

// Load settings page
async function loadSettingsPage() {
    await Promise.all([
        loadEmailConfig(),
        loadEquipmentTypes(),
        loadEventCategories(),
        loadBackupHistory()
    ]);
}

// ====================
// Email Configuration
// ====================
async function loadEmailConfig() {
    try {
        const response = await fetchAPI('/email-config');
        if (response.success && response.config) {
            const config = response.config;
            document.getElementById('smtp-host').value = config.smtp_host || '';
            document.getElementById('smtp-port').value = config.smtp_port || 587;
            document.getElementById('smtp-user').value = config.smtp_user || '';
            document.getElementById('smtp-password').value = ''; // Don't show password
            document.getElementById('from-email').value = config.from_email || '';
            document.getElementById('from-name').value = config.from_name || 'Substation Logbook';
            document.getElementById('smtp-secure').value = config.smtp_secure ? 'true' : 'false';
        }
    } catch (error) {
        console.error('Error loading email config:', error);
    }
}

// Email config form submission
document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('email-config-form');
    if (form) {
        form.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const data = {
                smtp_host: document.getElementById('smtp-host').value,
                smtp_port: parseInt(document.getElementById('smtp-port').value),
                smtp_secure: document.getElementById('smtp-secure').value === 'true',
                smtp_user: document.getElementById('smtp-user').value,
                smtp_password: document.getElementById('smtp-password').value,
                from_email: document.getElementById('from-email').value,
                from_name: document.getElementById('from-name').value
            };
            
            if (!data.smtp_password) {
                showAlert('email-config-alert', 'danger', 'Please enter SMTP password');
                return;
            }
            
            try {
                const response = await fetchAPI('/email-config', {
                    method: 'POST',
                    body: JSON.stringify(data)
                });
                
                if (response.success) {
                    showAlert('email-config-alert', 'success', 'Email configuration saved successfully!');
                } else {
                    showAlert('email-config-alert', 'danger', response.message || 'Error saving email configuration');
                }
            } catch (error) {
                console.error('Error saving email config:', error);
                showAlert('email-config-alert', 'danger', 'Error saving email configuration');
            }
        });
    }
});

// ====================
// Equipment Types
// ====================
async function loadEquipmentTypes() {
    try {
        const response = await fetchAPI('/equipment');
        if (response.success) {
            displayEquipmentList(response.equipment);
        }
    } catch (error) {
        console.error('Error loading equipment types:', error);
    }
}

function displayEquipmentList(equipment) {
    const container = document.getElementById('equipment-list');
    if (equipment.length === 0) {
        container.innerHTML = '<p>No equipment types found</p>';
        return;
    }
    
    container.innerHTML = equipment.map(eq => `
        <div class="tag-item">
            <span>${eq.equipment_name}</span>
            <button class="tag-delete" onclick="deleteEquipment(${eq.id})" title="Delete">×</button>
        </div>
    `).join('');
}

function showAddEquipmentModal() {
    document.getElementById('equipment-form').reset();
    document.getElementById('equipment-form-alert').innerHTML = '';
    openModal('equipment-modal');
}

async function saveEquipment() {
    const name = document.getElementById('equipment-name').value.trim();
    const description = document.getElementById('equipment-desc').value.trim();
    
    if (!name) {
        showAlert('equipment-form-alert', 'danger', 'Please enter equipment name');
        return;
    }
    
    try {
        const response = await fetchAPI('/equipment', {
            method: 'POST',
            body: JSON.stringify({ equipment_name: name, description: description })
        });
        
        if (response.success) {
            showAlert('equipment-form-alert', 'success', 'Equipment type added successfully!');
            setTimeout(() => {
                closeModal('equipment-modal');
                loadEquipmentTypes();
            }, 1500);
        } else {
            showAlert('equipment-form-alert', 'danger', response.message || 'Error adding equipment type');
        }
    } catch (error) {
        console.error('Error adding equipment:', error);
        showAlert('equipment-form-alert', 'danger', 'Error adding equipment type');
    }
}

async function deleteEquipment(id) {
    if (!confirm('Are you sure you want to delete this equipment type?')) {
        return;
    }
    
    try {
        const response = await fetchAPI(`/equipment/${id}`, {
            method: 'DELETE'
        });
        
        if (response.success) {
            loadEquipmentTypes();
        } else {
            alert(response.message || 'Error deleting equipment type');
        }
    } catch (error) {
        console.error('Error deleting equipment:', error);
        alert('Error deleting equipment type');
    }
}

// ====================
// Event Categories
// ====================
async function loadEventCategories() {
    try {
        const response = await fetchAPI('/categories');
        if (response.success) {
            displayCategoryList(response.categories);
        }
    } catch (error) {
        console.error('Error loading event categories:', error);
    }
}

function displayCategoryList(categories) {
    const container = document.getElementById('category-list');
    if (categories.length === 0) {
        container.innerHTML = '<p>No event categories found</p>';
        return;
    }
    
    container.innerHTML = categories.map(cat => `
        <div class="tag-item">
            <span>${cat.category_name}</span>
            <button class="tag-delete" onclick="deleteCategory(${cat.id})" title="Delete">×</button>
        </div>
    `).join('');
}

function showAddCategoryModal() {
    document.getElementById('category-form').reset();
    document.getElementById('category-form-alert').innerHTML = '';
    openModal('category-modal');
}

async function saveCategory() {
    const name = document.getElementById('category-name').value.trim();
    const description = document.getElementById('category-desc').value.trim();
    
    if (!name) {
        showAlert('category-form-alert', 'danger', 'Please enter category name');
        return;
    }
    
    try {
        const response = await fetchAPI('/categories', {
            method: 'POST',
            body: JSON.stringify({ category_name: name, description: description })
        });
        
        if (response.success) {
            showAlert('category-form-alert', 'success', 'Event category added successfully!');
            setTimeout(() => {
                closeModal('category-modal');
                loadEventCategories();
            }, 1500);
        } else {
            showAlert('category-form-alert', 'danger', response.message || 'Error adding event category');
        }
    } catch (error) {
        console.error('Error adding category:', error);
        showAlert('category-form-alert', 'danger', 'Error adding event category');
    }
}

async function deleteCategory(id) {
    if (!confirm('Are you sure you want to delete this event category?')) {
        return;
    }
    
    try {
        const response = await fetchAPI(`/categories/${id}`, {
            method: 'DELETE'
        });
        
        if (response.success) {
            loadEventCategories();
        } else {
            alert(response.message || 'Error deleting event category');
        }
    } catch (error) {
        console.error('Error deleting category:', error);
        alert('Error deleting event category');
    }
}

// ====================
// Database Backup
// ====================
async function createManualBackup() {
    if (!confirm('Create a manual database backup now?')) {
        return;
    }
    
    showAlert('backup-alert', 'info', 'Creating backup... Please wait...');
    
    try {
        const response = await fetchAPI('/backup/manual', {
            method: 'POST'
        });
        
        if (response.success) {
            showAlert('backup-alert', 'success', `Backup created successfully! (${response.size_mb} MB)`);
            loadBackupHistory();
        } else {
            showAlert('backup-alert', 'danger', response.message || 'Error creating backup');
        }
    } catch (error) {
        console.error('Error creating backup:', error);
        showAlert('backup-alert', 'danger', 'Error creating backup');
    }
}

async function loadBackupHistory() {
    const tbody = document.getElementById('backup-tbody');
    tbody.innerHTML = '<tr><td colspan="6" class="text-center">Loading...</td></tr>';
    
    try {
        const response = await fetchAPI('/backup/history');
        if (response.success) {
            displayBackupHistory(response.backups);
        }
    } catch (error) {
        console.error('Error loading backup history:', error);
        tbody.innerHTML = '<tr><td colspan="6" class="text-center">Error loading backup history</td></tr>';
    }
}

function displayBackupHistory(backups) {
    const tbody = document.getElementById('backup-tbody');
    
    if (backups.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center">No backups found</td></tr>';
        return;
    }
    
    tbody.innerHTML = backups.map(backup => `
        <tr>
            <td><small>${backup.backup_filename}</small></td>
            <td>${formatDateTime(backup.created_at)}</td>
            <td>${backup.backup_size_mb ? backup.backup_size_mb.toFixed(2) : 'N/A'}</td>
            <td>
                <span class="badge badge-${backup.backup_type === 'manual' ? 'primary' : 'info'}">
                    ${backup.backup_type}
                </span>
            </td>
            <td>
                <span class="badge badge-${backup.status === 'success' ? 'success' : 'danger'}">
                    ${backup.status}
                </span>
            </td>
            <td>
                ${backup.status === 'success' ? 
                    `<a href="/api/backup/download/${backup.backup_filename}" class="btn btn-sm btn-success" download>
                        📥 Download
                    </a>` : 
                    '-'}
            </td>
        </tr>
    `).join('');
}
