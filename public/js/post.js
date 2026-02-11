/**
 * Post Entry Functions
 */

let selectedTechnicians = [];
let contextMenu = null;
let contextMenuTrigger = null;

async function loadPostFormData() {
    // Set current datetime
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    document.getElementById('entry-datetime').value = now.toISOString().slice(0, 16);
    
    // Load dropdown data
    await Promise.all([
        loadCategories(),
        loadEquipment(),
        loadTechnicians()
    ]);
    
    // Initialize context menu
    initializeContextMenu();
}

async function loadCategories() {
    try {
        const data = await fetchAPI('/categories');
        const select = document.getElementById('event-category');
        const searchSelect = document.getElementById('search-category');
        
        if (data.success) {
            const options = data.categories.map(cat => 
                `<option value="${cat.id}">${cat.category_name}</option>`
            ).join('');
            
            select.innerHTML = '<option value="">-- Select Category --</option>' + options;
            if (searchSelect) {
                searchSelect.innerHTML = '<option value="">All</option>' + options;
            }
        }
    } catch (error) {
        console.error('Load categories error:', error);
    }
}

async function loadEquipment() {
    try {
        const data = await fetchAPI('/equipment');
        const select = document.getElementById('equipment');
        
        if (data.success) {
            const options = data.equipment.map(eq => 
                `<option value="${eq.id}">${eq.equipment_name}</option>`
            ).join('');
            
            select.innerHTML = '<option value="">-- Select Equipment --</option>' + options;
        }
    } catch (error) {
        console.error('Load equipment error:', error);
    }
}

async function loadTechnicians() {
    try {
        // Get substation ID based on user type
        let substationId;
        
        if (currentUser.role === 'engineer' || currentUser.role === 'admin') {
            // For engineers, use their assigned substation_id
            // For admin, they should select a substation first (we'll use engineer's if available)
            substationId = currentUser.substation_id;
        } else if (currentUser.substation_id) {
            // For substation login, substation_id should be in currentUser
            substationId = currentUser.substation_id;
        } else if (currentUser.id) {
            // For substation login, the id IS the substation_id
            substationId = currentUser.id;
        }
        
        if (!substationId) {
            console.log('No substation ID found. User:', currentUser);
            const container = document.getElementById('technicians-checkboxes');
            if (container) {
                container.innerHTML = '<p class="text-muted">No substation assigned. Please contact admin.</p>';
            }
            return;
        }
        
        console.log('Loading technicians for substation:', substationId);
        const data = await fetchAPI(`/technicians/${substationId}`);
        const container = document.getElementById('technicians-checkboxes');
        const searchSelect = document.getElementById('search-technician');
        
        if (data.success && data.technicians.length > 0) {
            console.log('Loaded technicians:', data.technicians);
            container.innerHTML = data.technicians.map(tech => `
                <label class="checkbox-label">
                    <input type="checkbox" value="${tech.id}" onchange="toggleTechnician(${tech.id}, '${tech.name}')">
                    <span>${tech.name}</span>
                </label>
            `).join('');
            
            if (searchSelect) {
                const options = data.technicians.map(tech => 
                    `<option value="${tech.id}">${tech.name}</option>`
                ).join('');
                searchSelect.innerHTML = '<option value="">All</option>' + options;
            }
        } else {
            console.log('No technicians found or error:', data);
            container.innerHTML = '<p class="text-muted">No technicians found. Please add technicians first.</p>';
        }
    } catch (error) {
        console.error('Load technicians error:', error);
        const container = document.getElementById('technicians-checkboxes');
        if (container) {
            container.innerHTML = '<p class="text-danger">Error loading technicians. Please refresh the page.</p>';
        }
    }
}

function toggleTechnician(id, name) {
    const index = selectedTechnicians.findIndex(t => t.id === id);
    
    if (index > -1) {
        selectedTechnicians.splice(index, 1);
    } else {
        selectedTechnicians.push({ id, name });
    }
    
    updateSelectedTechnicians();
}

function updateSelectedTechnicians() {
    const container = document.getElementById('selected-technicians');
    
    if (selectedTechnicians.length === 0) {
        container.innerHTML = '<p class="text-muted">No technicians selected</p>';
    } else {
        container.innerHTML = selectedTechnicians.map(tech => `
            <span class="tag tag-removable">
                ${tech.name}
                <button type="button" class="tag-remove" onclick="removeTechnician(${tech.id})">×</button>
            </span>
        `).join('');
    }
}

function removeTechnician(id) {
    const checkbox = document.querySelector(`input[value="${id}"]`);
    if (checkbox) checkbox.checked = false;
    
    selectedTechnicians = selectedTechnicians.filter(t => t.id !== id);
    updateSelectedTechnicians();
}

// Context Menu for special symbols
function initializeContextMenu() {
    const messageField = document.getElementById('message');
    contextMenu = document.getElementById('context-menu');
    
    messageField.addEventListener('input', function(e) {
        const text = this.value;
        const cursorPos = this.selectionStart;
        const lastChar = text[cursorPos - 1];
        
        if (lastChar === '#') {
            showContextMenu(this, 'technicians');
        } else if (lastChar === '@') {
            showContextMenu(this, 'time');
        } else if (lastChar === '/') {
            showContextMenu(this, 'date');
        } else if (lastChar === '&') {
            showContextMenu(this, 'location');
        } else {
            hideContextMenu();
        }
    });
    
    // Hide on click outside
    document.addEventListener('click', function(e) {
        if (contextMenu && !contextMenu.contains(e.target) && e.target !== messageField) {
            hideContextMenu();
        }
    });
}

function showContextMenu(input, type) {
    contextMenuTrigger = input;
    const content = contextMenu.querySelector('.context-menu-content');
    
    if (type === 'technicians') {
        content.innerHTML = selectedTechnicians.map(tech => `
            <div class="context-menu-item" onclick="insertText('${tech.name}')">
                ${tech.name}
            </div>
        `).join('') || '<div class="context-menu-item">No technicians selected</div>';
    } else if (type === 'time') {
        const now = new Date();
        const times = [
            now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false }),
            now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
        ];
        content.innerHTML = times.map(time => `
            <div class="context-menu-item" onclick="insertText('${time}')">
                ${time}
            </div>
        `).join('');
    } else if (type === 'date') {
        const now = new Date();
        const dates = [
            now.toLocaleDateString('en-GB'),
            now.toLocaleDateString('en-IN'),
            now.toISOString().split('T')[0]
        ];
        content.innerHTML = dates.map(date => `
            <div class="context-menu-item" onclick="insertText('${date}')">
                ${date}
            </div>
        `).join('');
    } else if (type === 'location') {
        const locations = ['Main Building', 'Control Room', 'Switch Yard', 'Transformer Bay'];
        content.innerHTML = locations.map(loc => `
            <div class="context-menu-item" onclick="insertText('${loc}')">
                ${loc}
            </div>
        `).join('');
    }
    
    // Position context menu
    const rect = input.getBoundingClientRect();
    contextMenu.style.left = rect.left + 'px';
    contextMenu.style.top = (rect.bottom + 5) + 'px';
    contextMenu.style.display = 'block';
}

function hideContextMenu() {
    if (contextMenu) {
        contextMenu.style.display = 'none';
    }
}

function insertText(text) {
    if (contextMenuTrigger) {
        const start = contextMenuTrigger.selectionStart;
        const end = contextMenuTrigger.selectionEnd;
        const value = contextMenuTrigger.value;
        
        // Remove the trigger symbol and insert text
        contextMenuTrigger.value = value.substring(0, start - 1) + text + value.substring(end);
        contextMenuTrigger.focus();
        contextMenuTrigger.selectionStart = contextMenuTrigger.selectionEnd = start - 1 + text.length;
    }
    hideContextMenu();
}

// Form submission
document.getElementById('postEntryForm')?.addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const submitBtn = this.querySelector('button[type="submit"]');
    const btnText = submitBtn.querySelector('.btn-text');
    const btnLoader = submitBtn.querySelector('.btn-loader');
    
    if (selectedTechnicians.length === 0) {
        showAlert('post-alert', 'warning', 'Please select at least one technician');
        return;
    }
    
    // Show loading
    btnText.style.display = 'none';
    btnLoader.style.display = 'inline-flex';
    submitBtn.disabled = true;
    
    try {
        const formData = new FormData(this);
        formData.append('technician_ids', JSON.stringify(selectedTechnicians.map(t => t.id)));
        
        const response = await fetch(`${API_URL}/logbook/entries`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`
            },
            body: formData
        });
        
        const data = await response.json();
        
        if (data.success) {
            showAlert('post-alert', 'success', 'Entry posted successfully!');
            this.reset();
            selectedTechnicians = [];
            updateSelectedTechnicians();
            
            // Refresh dashboard
            setTimeout(() => {
                showPage('dashboard');
            }, 1500);
        } else {
            showAlert('post-alert', 'danger', data.message || 'Failed to post entry');
        }
    } catch (error) {
        console.error('Post entry error:', error);
        showAlert('post-alert', 'danger', 'Network error. Please try again.');
    } finally {
        btnText.style.display = 'inline';
        btnLoader.style.display = 'none';
        submitBtn.disabled = false;
    }
});
