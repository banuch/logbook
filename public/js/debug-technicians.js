/**
 * COMPREHENSIVE DEBUG FOR TECHNICIANS LOADING
 * Include this in dashboard.html temporarily
 */

console.log('🔍 ========================================');
console.log('🔍 TECHNICIANS LOADING DEBUG');
console.log('🔍 ========================================');

// Wait for page to load
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(async function() {
        console.log('');
        console.log('📋 STEP 1: Check Current User');
        console.log('----------------------------');
        console.log('currentUser object:', currentUser);
        console.log('currentUser.id:', currentUser?.id);
        console.log('currentUser.role:', currentUser?.role);
        console.log('currentUser.substation_id:', currentUser?.substation_id);
        console.log('currentUser.substation_code:', currentUser?.substation_code);
        
        console.log('');
        console.log('📋 STEP 2: Check localStorage');
        console.log('----------------------------');
        const token = localStorage.getItem('auth_token');
        const userInfo = localStorage.getItem('user_info');
        console.log('auth_token exists:', !!token);
        console.log('user_info:', userInfo);
        
        if (userInfo) {
            try {
                const parsed = JSON.parse(userInfo);
                console.log('Parsed user_info:', parsed);
                console.log('Parsed.id:', parsed.id);
                console.log('Parsed.substation_id:', parsed.substation_id);
            } catch(e) {
                console.error('Error parsing user_info:', e);
            }
        }
        
        console.log('');
        console.log('📋 STEP 3: Determine Substation ID');
        console.log('----------------------------');
        let substationId;
        
        if (currentUser) {
            if (currentUser.role === 'engineer' || currentUser.role === 'admin') {
                substationId = currentUser.substation_id;
                console.log('User type: engineer/admin');
            } else if (currentUser.substation_id) {
                substationId = currentUser.substation_id;
                console.log('User type: substation (has substation_id)');
            } else if (currentUser.id) {
                substationId = currentUser.id;
                console.log('User type: substation (using id)');
            }
            
            console.log('Determined substation_id:', substationId);
        }
        
        if (!substationId) {
            console.error('❌ NO SUBSTATION ID FOUND!');
            console.error('This is why technicians are not loading');
            return;
        }
        
        console.log('');
        console.log('📋 STEP 4: Fetch Technicians from API');
        console.log('----------------------------');
        console.log('Calling API: /api/technicians/' + substationId);
        
        try {
            const response = await fetch('/api/technicians/' + substationId, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            
            console.log('Response status:', response.status);
            console.log('Response ok:', response.ok);
            
            const data = await response.json();
            console.log('Response data:', data);
            console.log('data.success:', data.success);
            console.log('data.technicians:', data.technicians);
            console.log('Number of technicians:', data.technicians?.length || 0);
            
            if (data.technicians && data.technicians.length > 0) {
                console.log('✅ TECHNICIANS FOUND!');
                console.log('Technician details:');
                data.technicians.forEach((tech, index) => {
                    console.log(`  ${index + 1}. ${tech.name} (ID: ${tech.id})`);
                });
            } else {
                console.error('❌ NO TECHNICIANS IN DATABASE!');
                console.error('You need to add technicians first:');
                console.error('1. Go to Technicians page');
                console.error('2. Select substation:', substationId);
                console.error('3. Click "Add Technician"');
            }
            
        } catch (error) {
            console.error('❌ API CALL FAILED:', error);
        }
        
        console.log('');
        console.log('📋 STEP 5: Check DOM Elements');
        console.log('----------------------------');
        const container = document.getElementById('technicians-checkboxes');
        console.log('technicians-checkboxes element exists:', !!container);
        if (container) {
            console.log('Container innerHTML:', container.innerHTML);
        }
        
        console.log('');
        console.log('🔍 ========================================');
        console.log('🔍 DEBUG COMPLETE - Check logs above');
        console.log('🔍 ========================================');
        
    }, 2000); // Wait 2 seconds after page load
});

// Also add a manual test function
window.testTechniciansLoad = async function() {
    console.log('🧪 MANUAL TEST: Loading technicians...');
    
    if (typeof loadTechnicians === 'function') {
        await loadTechnicians();
        console.log('✅ loadTechnicians() executed');
    } else {
        console.error('❌ loadTechnicians() function not found!');
    }
    
    console.log('Current selectedTechnicians:', selectedTechnicians);
};

console.log('💡 Type testTechniciansLoad() in console to manually test');
