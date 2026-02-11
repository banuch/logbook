/**
 * Substations Management
 */

let allSubstationsData = [];

// Load substations page
async function loadSubstationsPage() {
    await loadSubstations();
}

// Load all substations
async function loadSubstations() {
    const tbody = document.getElementById('substations-tbody');
    tbody.innerHTML = '<tr><td colspan="7" class="text-center">Loading...</td></tr>';
    
    try {
        const response = await fetchAPI('/substations');
        if (response.success) {
            allSubstationsData = response.substations;
            displaySubstations(response.substations);
        }
    } catch (error) {
        console.error('Error loading substations:', error);
        tbody.innerHTML = '<tr><td colspan="7" class="text-center">Error loading substations</td></tr>';
    }
}

// Display substations in table
function displaySubstations(substations) {
    const tbody = document.getElementById('substations-tbody');
    
    if (substations.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center">No substations found</td></tr>';
        return;
    }
    
    tbody.innerHTML = substations.map(sub => `
        <tr>
            <td><strong>${sub.substation_code}</strong></td>
            <td>${sub.substation_name}</td>
            <td>${sub.location || '-'}</td>
            <td>${sub.voltage_level || '-'}</td>
            <td>${sub.installed_capacity || '-'}</td>
            <td>
                <span class="badge badge-${sub.is_active ? 'success' : 'danger'}">
                    ${sub.is_active ? 'Active' : 'Inactive'}
                </span>
            </td>
            <td>
                <button class="btn btn-sm btn-info" onclick="editSubstation(${sub.id})" title="Edit">
                    ✏️
                </button>
                <button class="btn btn-sm btn-${sub.is_active ? 'warning' : 'success'}" 
                        onclick="toggleSubstationStatus(${sub.id})" 
                        title="${sub.is_active ? 'Deactivate' : 'Activate'}">
                    ${sub.is_active ? '🔒' : '🔓'}
                </button>
            </td>
        </tr>
    `).join('');
}

// Show add substation modal
function showAddSubstationModal() {
    document.getElementById('substation-modal-title').textContent = 'Add Substation';
    document.getElementById('substation-form').reset();
    document.getElementById('sub-id').value = '';
    document.getElementById('sub-code').disabled = false;
    document.getElementById('sub-password').required = true;
    document.getElementById('sub-form-alert').innerHTML = '';
    openModal('substation-modal');
}

// Edit substation
function editSubstation(id) {
    const sub = allSubstationsData.find(s => s.id === id);
    if (!sub) return;
    
    document.getElementById('substation-modal-title').textContent = 'Edit Substation';
    document.getElementById('sub-id').value = sub.id;
    document.getElementById('sub-code').value = sub.substation_code;
    document.getElementById('sub-code').disabled = true; // Cannot change code
    document.getElementById('sub-name').value = sub.substation_name;
    document.getElementById('sub-location').value = sub.location || '';
    document.getElementById('sub-voltage').value = sub.voltage_level || '';
    document.getElementById('sub-capacity').value = sub.installed_capacity || '';
    document.getElementById('sub-contact').value = sub.contact_info || '';
    document.getElementById('sub-password').value = '';
    document.getElementById('sub-password').required = false;
    document.getElementById('sub-form-alert').innerHTML = '';
    
    openModal('substation-modal');
}

// Save substation
async function saveSubstation() {
    const id = document.getElementById('sub-id').value;
    const data = {
        substation_code: document.getElementById('sub-code').value,
        substation_name: document.getElementById('sub-name').value,
        location: document.getElementById('sub-location').value,
        voltage_level: document.getElementById('sub-voltage').value,
        installed_capacity: document.getElementById('sub-capacity').value,
        contact_info: document.getElementById('sub-contact').value
    };
    
    const password = document.getElementById('sub-password').value;
    if (password) {
        data.password = password;
    }
    
    if (!data.substation_code || !data.substation_name) {
        showAlert('sub-form-alert', 'danger', 'Please fill all required fields');
        return;
    }
    
    if (!id && !password) {
        showAlert('sub-form-alert', 'danger', 'Password is required for new substation');
        return;
    }
    
    try {
        const url = id ? `/substations/${id}` : '/substations';
        const method = id ? 'PUT' : 'POST';
        
        const response = await fetchAPI(url, {
            method: method,
            body: JSON.stringify(data)
        });
        
        if (response.success) {
            showAlert('sub-form-alert', 'success', id ? 'Substation updated successfully!' : 'Substation added successfully!');
            setTimeout(() => {
                closeModal('substation-modal');
                loadSubstations();
            }, 1500);
        } else {
            showAlert('sub-form-alert', 'danger', response.message || 'Error saving substation');
        }
    } catch (error) {
        console.error('Error saving substation:', error);
        showAlert('sub-form-alert', 'danger', 'Error saving substation');
    }
}

// Toggle substation status
async function toggleSubstationStatus(id) {
    const sub = allSubstationsData.find(s => s.id === id);
    const action = sub.is_active ? 'deactivate' : 'activate';
    
    if (!confirm(`Are you sure you want to ${action} this substation?`)) {
        return;
    }
    
    try {
        const response = await fetchAPI(`/substations/${id}/toggle-status`, {
            method: 'PATCH'
        });
        
        if (response.success) {
            alert(`Substation ${action}d successfully!`);
            loadSubstations();
        } else {
            alert(response.message || `Error ${action}ing substation`);
        }
    } catch (error) {
        console.error('Error toggling substation status:', error);
        alert(`Error ${action}ing substation`);
    }
}
