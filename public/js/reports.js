/**
 * Reports Page Management
 */

// Load reports page
async function loadReportsPage() {
    await loadSubstationsForReports();
    populateYears();
    setDefaultDate();
}

// Load substations for report filters
async function loadSubstationsForReports() {
    try {
        const response = await fetchAPI('/substations');
        if (response.success) {
            const dailySelect = document.getElementById('daily-report-substation');
            const monthlySelect = document.getElementById('monthly-report-substation');
            
            response.substations.forEach(sub => {
                const option1 = document.createElement('option');
                option1.value = sub.id;
                option1.textContent = `${sub.substation_code} - ${sub.substation_name}`;
                dailySelect.appendChild(option1);
                
                const option2 = document.createElement('option');
                option2.value = sub.id;
                option2.textContent = `${sub.substation_code} - ${sub.substation_name}`;
                monthlySelect.appendChild(option2);
            });
            
            // Auto-select if engineer
            if (currentUser.role === 'engineer' && currentUser.substation_id) {
                dailySelect.value = currentUser.substation_id;
                monthlySelect.value = currentUser.substation_id;
                dailySelect.disabled = true;
                monthlySelect.disabled = true;
            }
        }
    } catch (error) {
        console.error('Error loading substations:', error);
    }
}

// Populate year dropdown
function populateYears() {
    const select = document.getElementById('monthly-report-year');
    const currentYear = new Date().getFullYear();
    
    for (let year = currentYear; year >= currentYear - 5; year--) {
        const option = document.createElement('option');
        option.value = year;
        option.textContent = year;
        select.appendChild(option);
    }
}

// Set default date to today
function setDefaultDate() {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('daily-report-date').value = today;
}

// ====================
// Daily Summary Report
// ====================
document.addEventListener('DOMContentLoaded', function() {
    const dailyForm = document.getElementById('daily-report-form');
    if (dailyForm) {
        dailyForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            await generateDailyReport();
        });
    }
    
    const monthlyForm = document.getElementById('monthly-report-form');
    if (monthlyForm) {
        monthlyForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            await generateMonthlyReport();
        });
    }
});

async function generateDailyReport() {
    const date = document.getElementById('daily-report-date').value;
    const substationId = document.getElementById('daily-report-substation').value;
    const resultDiv = document.getElementById('daily-report-result');
    
    if (!date) {
        resultDiv.innerHTML = '<div class="alert alert-danger">Please select a date</div>';
        return;
    }
    
    resultDiv.innerHTML = '<div class="alert alert-info">Generating report...</div>';
    
    try {
        const url = `/reports/daily-summary?date=${date}${substationId ? '&substation_id=' + substationId : ''}`;
        const response = await fetchAPI(url);
        
        if (response.success) {
            displayDailyReport(response.summary);
        } else {
            resultDiv.innerHTML = `<div class="alert alert-danger">${response.message || 'Error generating report'}</div>`;
        }
    } catch (error) {
        console.error('Error generating daily report:', error);
        resultDiv.innerHTML = '<div class="alert alert-danger">Error generating report</div>';
    }
}

function displayDailyReport(summary) {
    const resultDiv = document.getElementById('daily-report-result');
    
    if (summary.total_entries === 0) {
        resultDiv.innerHTML = '<div class="alert alert-info">No entries found for the selected date</div>';
        return;
    }
    
    let html = `
        <div class="report-summary">
            <h4>Daily Summary - ${formatDate(summary.date)}</h4>
            <div class="summary-stats">
                <div class="stat-box">
                    <h3>${summary.total_entries}</h3>
                    <p>Total Entries</p>
                </div>
                <div class="stat-box">
                    <h3>${summary.normal_count}</h3>
                    <p>Normal</p>
                </div>
                <div class="stat-box">
                    <h3>${summary.warning_count}</h3>
                    <p>Warning</p>
                </div>
                <div class="stat-box">
                    <h3>${summary.critical_count}</h3>
                    <p>Critical</p>
                </div>
            </div>
            
            <h5 style="margin-top: 20px;">By Category</h5>
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Category</th>
                        <th>Count</th>
                    </tr>
                </thead>
                <tbody>
                    ${summary.by_category.map(cat => `
                        <tr>
                            <td>${cat.category || 'Uncategorized'}</td>
                            <td>${cat.count}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
    
    resultDiv.innerHTML = html;
}

// ====================
// Monthly Summary Report
// ====================
async function generateMonthlyReport() {
    const month = document.getElementById('monthly-report-month').value;
    const year = document.getElementById('monthly-report-year').value;
    const substationId = document.getElementById('monthly-report-substation').value;
    const resultDiv = document.getElementById('monthly-report-result');
    
    if (!month || !year) {
        resultDiv.innerHTML = '<div class="alert alert-danger">Please select month and year</div>';
        return;
    }
    
    resultDiv.innerHTML = '<div class="alert alert-info">Generating report...</div>';
    
    try {
        const url = `/reports/monthly-summary?month=${month}&year=${year}${substationId ? '&substation_id=' + substationId : ''}`;
        const response = await fetchAPI(url);
        
        if (response.success) {
            displayMonthlyReport(response.summary);
        } else {
            resultDiv.innerHTML = `<div class="alert alert-danger">${response.message || 'Error generating report'}</div>`;
        }
    } catch (error) {
        console.error('Error generating monthly report:', error);
        resultDiv.innerHTML = '<div class="alert alert-danger">Error generating report</div>';
    }
}

function displayMonthlyReport(summary) {
    const resultDiv = document.getElementById('monthly-report-result');
    
    if (summary.total_entries === 0) {
        resultDiv.innerHTML = '<div class="alert alert-info">No entries found for the selected month</div>';
        return;
    }
    
    const monthNames = ['', 'January', 'February', 'March', 'April', 'May', 'June', 
                       'July', 'August', 'September', 'October', 'November', 'December'];
    
    let html = `
        <div class="report-summary">
            <h4>Monthly Summary - ${monthNames[summary.month]} ${summary.year}</h4>
            <div class="summary-stats">
                <div class="stat-box">
                    <h3>${summary.total_entries}</h3>
                    <p>Total Entries</p>
                </div>
                <div class="stat-box">
                    <h3>${summary.normal_count}</h3>
                    <p>Normal</p>
                </div>
                <div class="stat-box">
                    <h3>${summary.warning_count}</h3>
                    <p>Warning</p>
                </div>
                <div class="stat-box">
                    <h3>${summary.critical_count}</h3>
                    <p>Critical</p>
                </div>
            </div>
            
            <div class="summary-stats" style="margin-top: 20px;">
                <div class="stat-box">
                    <h3>${summary.active_days}</h3>
                    <p>Active Days</p>
                </div>
            </div>
            
            <h5 style="margin-top: 20px;">By Category</h5>
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Category</th>
                        <th>Count</th>
                    </tr>
                </thead>
                <tbody>
                    ${summary.by_category.map(cat => `
                        <tr>
                            <td>${cat.category || 'Uncategorized'}</td>
                            <td>${cat.count}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
    
    resultDiv.innerHTML = html;
}
