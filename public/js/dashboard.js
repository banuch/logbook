/**
 * Dashboard Functions
 */

async function loadDashboardData() {
    await loadDashboardStats();
    await loadRecentEntries();
}

async function loadDashboardStats() {
    try {
        const params = new URLSearchParams();
        if (currentUser.substation_id) {
            params.append('substation_id', currentUser.substation_id);
        }
        
        const today = new Date().toISOString().split('T')[0];
        params.append('start_date', today);
        params.append('end_date', today);

        const data = await fetchAPI(`/logbook/entries?${params.toString()}`);
        
        if (data.success) {
            const entries = data.entries;
            
            // Count by severity
            const total = entries.length;
            const normal = entries.filter(e => e.severity === 'Normal').length;
            const warning = entries.filter(e => e.severity === 'Warning').length;
            const critical = entries.filter(e => e.severity === 'Critical').length;
            
            // Update cards
            document.getElementById('total-entries').textContent = total;
            document.getElementById('normal-entries').textContent = normal;
            document.getElementById('warning-entries').textContent = warning;
            document.getElementById('critical-entries').textContent = critical;
        }
    } catch (error) {
        console.error('Load stats error:', error);
    }
}

async function loadRecentEntries() {
    try {
        const container = document.getElementById('recent-entries-container');
        container.innerHTML = '<div class="loading-spinner">Loading entries...</div>';
        
        const params = new URLSearchParams({ limit: 10, page: 1 });
        if (currentUser.substation_id) {
            params.append('substation_id', currentUser.substation_id);
        }

        const data = await fetchAPI(`/logbook/entries?${params.toString()}`);
        
        if (data.success && data.entries.length > 0) {
            container.innerHTML = data.entries.map(entry => createEntryCard(entry)).join('');
        } else {
            container.innerHTML = '<div class="empty-state"><p>No entries found</p></div>';
        }
    } catch (error) {
        console.error('Load recent entries error:', error);
        container.innerHTML = '<div class="empty-state"><p>Failed to load entries</p></div>';
    }
}

function createEntryCard(entry) {
    const severityClass = entry.severity.toLowerCase();
    
    return `
        <div class="entry-card severity-${severityClass}">
            <div class="entry-header">
                <div class="entry-title">
                    <h4>${entry.substation_name}</h4>
                    <div class="entry-meta">
                        <span>📅 ${formatDateTime(entry.entry_datetime)}</span>
                        ${entry.event_category ? `<span> • 🏷️ ${entry.event_category}</span>` : ''}
                        ${entry.equipment ? `<span> • ⚙️ ${entry.equipment}</span>` : ''}
                    </div>
                    ${entry.technicians ? `<div class="entry-meta">👷 ${entry.technicians}</div>` : ''}
                </div>
                <span class="badge badge-${severityClass}">${entry.severity}</span>
            </div>
            <div class="entry-body">${entry.message.substring(0, 200)}${entry.message.length > 200 ? '...' : ''}</div>
            <div class="entry-footer">
                <div class="entry-tags">
                    ${entry.voltage_kv ? `<span class="tag">⚡ ${entry.voltage_kv} kV</span>` : ''}
                    ${entry.current_a ? `<span class="tag">🔌 ${entry.current_a} A</span>` : ''}
                    ${entry.comment_count > 0 ? `<span class="tag">💬 ${entry.comment_count} comments</span>` : ''}
                </div>
                <button class="btn btn-sm btn-primary" onclick="viewEntryDetails(${entry.id})">View Details</button>
            </div>
        </div>
    `;
}

async function viewEntryDetails(entryId) {
    try {
        const data = await fetchAPI(`/logbook/entries/${entryId}`);
        
        if (data.success) {
            const entry = data.entry;
            const content = document.getElementById('entry-detail-content');
            
            content.innerHTML = `
                <div class="entry-detail">
                    <div class="form-row">
                        <div class="form-group col-md-6">
                            <label>Substation</label>
                            <p><strong>${entry.substation_name}</strong></p>
                        </div>
                        <div class="form-group col-md-6">
                            <label>Date & Time</label>
                            <p><strong>${formatDateTime(entry.entry_datetime)}</strong></p>
                        </div>
                    </div>
                    
                    <div class="form-row">
                        <div class="form-group col-md-4">
                            <label>Severity</label>
                            <p><span class="badge badge-${entry.severity.toLowerCase()}">${entry.severity}</span></p>
                        </div>
                        <div class="form-group col-md-4">
                            <label>Category</label>
                            <p>${entry.event_category || 'N/A'}</p>
                        </div>
                        <div class="form-group col-md-4">
                            <label>Equipment</label>
                            <p>${entry.equipment || 'N/A'}</p>
                        </div>
                    </div>
                    
                    ${entry.technicians ? `
                    <div class="form-group">
                        <label>Technicians</label>
                        <p>${entry.technicians}</p>
                    </div>
                    ` : ''}
                    
                    <div class="form-group">
                        <label>Message</label>
                        <div style="padding: 15px; background: #f8f9fa; border-radius: 6px; white-space: pre-wrap;">${entry.message}</div>
                    </div>
                    
                    ${entry.voltage_kv || entry.current_a || entry.power_mw ? `
                    <div class="form-section-header"><h4>Electrical Parameters</h4></div>
                    <div class="form-row">
                        ${entry.voltage_kv ? `<div class="form-group col-md-4"><label>Voltage</label><p>${entry.voltage_kv} kV</p></div>` : ''}
                        ${entry.current_a ? `<div class="form-group col-md-4"><label>Current</label><p>${entry.current_a} A</p></div>` : ''}
                        ${entry.power_mw ? `<div class="form-group col-md-4"><label>Power</label><p>${entry.power_mw} MW</p></div>` : ''}
                        ${entry.frequency_hz ? `<div class="form-group col-md-4"><label>Frequency</label><p>${entry.frequency_hz} Hz</p></div>` : ''}
                        ${entry.power_factor ? `<div class="form-group col-md-4"><label>Power Factor</label><p>${entry.power_factor}</p></div>` : ''}
                        ${entry.energy_mwh ? `<div class="form-group col-md-4"><label>Energy</label><p>${entry.energy_mwh} MWh</p></div>` : ''}
                    </div>
                    ` : ''}
                    
                    ${entry.attachment_path ? `
                    <div class="form-group">
                        <label>Attachment</label>
                        <p><a href="/uploads/${entry.attachment_path}" target="_blank" class="btn btn-sm btn-secondary">View Attachment</a></p>
                    </div>
                    ` : ''}
                </div>
            `;
            
            openModal('entry-detail-modal');
        }
    } catch (error) {
        console.error('View entry error:', error);
        alert('Failed to load entry details');
    }
}
