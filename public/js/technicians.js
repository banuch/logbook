/**
 * Technicians Management
 */

let allSubstations = [];
let currentTechnicians = [];

// Load technicians page
async function loadTechniciansPage() {
    await loadSubstationsForFilter();
}

// Load substations for filter dropdown
async function loadSubstationsForFilter() {
    try {
        const response = await fetchAPI('/substations');
        if (response.success) {
            allSubstations = response.substations;
            
            const filter = document.getElementById('tech-substation-filter');
            const techSubstation = document.getElementById('tech-substation');
            
            filter.innerHTML = '<option value="">Select Substation</option>';
            techSubstation.innerHTML = '<option value="">Select Substation</option>';
            
            response.substations.forEach(sub => {
                const option1 = document.createElement('option');
                option1.value = sub.id;
                option1.textContent = `${sub.substation_code} - ${sub.substation_name}`;
                filter.appendChild(option1);
                
                const option2 = document.createElement('option');
                option2.value = sub.id;
                option2.textContent = `${sub.substation_code} - ${sub.substation_name}`;
                techSubstation.appendChild(option2);
            });
            
            // Auto-select if engineer
            if (currentUser.role === 'engineer' && currentUser.substation_id) {
                filter.value = currentUser.substation_id;
                filter.disabled = true;
                techSubstation.value = currentUser.substation_id;
                techSubstation.disabled = true;
                loadTechnicians();
            }
        }
    } catch (error) {
        console.error('Error loading substations:', error);
    }
}

// Load technicians for selected substation
async function loadTechnicians() {
    const substationId = document.getElementById('tech-substation-filter').value;
    const tbody = document.getElementById('technicians-tbody');
    
    if (!substationId) {
        tbody.innerHTML = '<tr><td colspan="8" class="text-center">Select a substation to view technicians</td></tr>';
        return;
    }
    
    tbody.innerHTML = '<tr><td colspan="8" class="text-center">Loading...</td></tr>';
    
    try {
        const response = await fetchAPI(`/technicians/${substationId}`);
        if (response.success) {
            currentTechnicians = response.technicians;
            displayTechnicians(response.technicians);
        }
    } catch (error) {
        console.error('Error loading technicians:', error);
        tbody.innerHTML = '<tr><td colspan="8" class="text-center">Error loading technicians</td></tr>';
    }
}

// Display technicians in table
function displayTechnicians(technicians) {
    const tbody = document.getElementById('technicians-tbody');
    
    if (technicians.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="text-center">No technicians found for this substation</td></tr>';
        return;
    }
    
    tbody.innerHTML = technicians.map(tech => {
        const substation = allSubstations.find(s => s.id === tech.substation_id);
        const substationName = substation ? `${substation.substation_code} - ${substation.substation_name}` : 'N/A';
        
        return `
            <tr>
                <td>${tech.name}</td>
                <td>${tech.employee_id}</td>
                <td>${tech.designation || '-'}</td>
                <td>${tech.contact_number || '-'}</td>
                <td>${tech.email || '-'}</td>
                <td>${substationName}</td>
                <td>
                    <span class="badge badge-${tech.is_active ? 'success' : 'danger'}">
                        ${tech.is_active ? 'Active' : 'Inactive'}
                    </span>
                </td>
                <td>
                    <button class="btn btn-sm btn-info" onclick="editTechnician(${tech.id})" title="Edit">
                        ✏️
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="deleteTechnician(${tech.id})" title="Delete">
                        🗑️
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

// Show add technician modal
function showAddTechnicianModal() {
    document.getElementById('technician-modal-title').textContent = 'Add Technician';
    document.getElementById('technician-form').reset();
    document.getElementById('tech-id').value = '';
    document.getElementById('tech-form-alert').innerHTML = '';
    
    // Set substation if engineer
    if (currentUser.role === 'engineer' && currentUser.substation_id) {
        document.getElementById('tech-substation').value = currentUser.substation_id;
    }
    
    openModal('technician-modal');
}

// Edit technician
function editTechnician(id) {
    const tech = currentTechnicians.find(t => t.id === id);
    if (!tech) return;
    
    document.getElementById('technician-modal-title').textContent = 'Edit Technician';
    document.getElementById('tech-id').value = tech.id;
    document.getElementById('tech-substation').value = tech.substation_id;
    document.getElementById('tech-name').value = tech.name;
    document.getElementById('tech-emp-id').value = tech.employee_id;
    document.getElementById('tech-designation').value = tech.designation || '';
    document.getElementById('tech-contact').value = tech.contact_number || '';
    document.getElementById('tech-email').value = tech.email || '';
    document.getElementById('tech-form-alert').innerHTML = '';
    
    openModal('technician-modal');
}

// Save technician
async function saveTechnician() {
    const id = document.getElementById('tech-id').value;
    const data = {
        substation_id: document.getElementById('tech-substation').value,
        name: document.getElementById('tech-name').value,
        employee_id: document.getElementById('tech-emp-id').value,
        designation: document.getElementById('tech-designation').value,
        contact_number: document.getElementById('tech-contact').value,
        email: document.getElementById('tech-email').value
    };
    
    if (!data.substation_id || !data.name || !data.employee_id) {
        showAlert('tech-form-alert', 'danger', 'Please fill all required fields');
        return;
    }
    
    try {
        const url = id ? `/technicians/${id}` : '/technicians';
        const method = id ? 'PUT' : 'POST';
        
        const response = await fetchAPI(url, {
            method: method,
            body: JSON.stringify(data)
        });
        
        if (response.success) {
            showAlert('tech-form-alert', 'success', id ? 'Technician updated successfully!' : 'Technician added successfully!');
            setTimeout(() => {
                closeModal('technician-modal');
                loadTechnicians();
            }, 1500);
        } else {
            showAlert('tech-form-alert', 'danger', response.message || 'Error saving technician');
        }
    } catch (error) {
        console.error('Error saving technician:', error);
        showAlert('tech-form-alert', 'danger', 'Error saving technician');
    }
}

// Delete technician
async function deleteTechnician(id) {
    if (!confirm('Are you sure you want to delete this technician?')) {
        return;
    }
    
    try {
        const response = await fetchAPI(`/technicians/${id}`, {
            method: 'DELETE'
        });
        
        if (response.success) {
            alert('Technician deleted successfully!');
            loadTechnicians();
        } else {
            alert(response.message || 'Error deleting technician');
        }
    } catch (error) {
        console.error('Error deleting technician:', error);
        alert('Error deleting technician');
    }
}
