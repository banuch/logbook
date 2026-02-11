/**
 * Search Functions
 */

let searchResults = [];

async function loadSearchFormData() {
    await Promise.all([
        loadCategories(),
        loadTechnicians()
    ]);
}

// Form submission
document.getElementById('searchForm')?.addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const formData = new FormData(this);
    const params = new URLSearchParams();
    
    // Add substation filter for non-admin users
    if (currentUser.substation_id) {
        params.append('substation_id', currentUser.substation_id);
    }
    
    // Add form parameters
    for (const [key, value] of formData.entries()) {
        if (value) {
            params.append(key, value);
        }
    }
    
    await performSearch(params);
});

async function performSearch(params) {
    try {
        const container = document.getElementById('search-results-container');
        const countEl = document.getElementById('search-results-count');
        
        container.innerHTML = '<div class="loading-spinner">Searching...</div>';
        
        const data = await fetchAPI(`/logbook/entries?${params.toString()}`);
        
        if (data.success) {
            searchResults = data.entries;
            
            if (searchResults.length > 0) {
                container.innerHTML = searchResults.map(entry => createEntryCard(entry)).join('');
                countEl.textContent = `${searchResults.length} results found`;
            } else {
                container.innerHTML = '<div class="empty-state"><p>No entries found matching your criteria</p></div>';
                countEl.textContent = '0 results';
            }
        } else {
            container.innerHTML = '<div class="empty-state"><p>Search failed. Please try again.</p></div>';
            countEl.textContent = '';
        }
    } catch (error) {
        console.error('Search error:', error);
        container.innerHTML = '<div class="empty-state"><p>Search error. Please try again.</p></div>';
        countEl.textContent = '';
    }
}

function resetSearchForm() {
    document.getElementById('searchForm').reset();
    document.getElementById('search-results-container').innerHTML = '<div class="empty-state"><p>Use the search form above to find logbook entries</p></div>';
    document.getElementById('search-results-count').textContent = '';
    searchResults = [];
}

async function exportSearchResults(format) {
    if (searchResults.length === 0) {
        alert('No search results to export. Please perform a search first.');
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/reports/export-${format}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                entries: searchResults,
                report_title: 'Logbook Search Results'
            })
        });
        
        if (response.ok) {
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `logbook-search-${Date.now()}.${format === 'pdf' ? 'pdf' : 'xlsx'}`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } else {
            alert('Export failed. Please try again.');
        }
    } catch (error) {
        console.error('Export error:', error);
        alert('Export error. Please try again.');
    }
}
