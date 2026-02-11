/**
 * Debug Helper for Technicians Loading Issue
 * Add this script temporarily to diagnose issues
 */

// Check if this file is included
console.log('🔍 Debug helper loaded');

// Log current user on page load
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(() => {
        console.log('=== CURRENT USER DEBUG ===');
        console.log('currentUser:', currentUser);
        console.log('currentUser.id:', currentUser?.id);
        console.log('currentUser.role:', currentUser?.role);
        console.log('currentUser.substation_id:', currentUser?.substation_id);
        console.log('currentUser.substation_code:', currentUser?.substation_code);
        console.log('=========================');
        
        // Check localStorage
        const userInfo = localStorage.getItem('user_info');
        console.log('localStorage user_info:', userInfo);
        if (userInfo) {
            try {
                const parsed = JSON.parse(userInfo);
                console.log('Parsed user_info:', parsed);
            } catch(e) {
                console.error('Error parsing user_info:', e);
            }
        }
    }, 1000);
});
