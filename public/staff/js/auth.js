/**
 * This script handles session validation, logout, and the forced password change workflow.
 */

// --- PASSWORD CHANGE LOGIC --- (Unchanged)
function handleInitialPasswordSet() {
    // ... (your existing function is perfect) ...
    const form = document.getElementById('setPasswordForm');
    if (form.dataset.listenerAttached) return;
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const newPassword = document.getElementById('newPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;
        if (newPassword !== confirmPassword) {
            return Swal.fire('Error', 'Passwords do not match.', 'error');
        }
        try {
            const res = await fetch('/api/staff/set-initial-password', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ newPassword })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message);
            await Swal.fire('Success!', 'Your new password has been set.', 'success');
            const modalEl = document.getElementById('forcePasswordChangeModal');
            const modal = bootstrap.Modal.getInstance(modalEl);
            modal.hide();
            sessionStorage.removeItem('isDefaultPassword');
        } catch (err) {
            Swal.fire('Error', err.message, 'error');
        }
    });
    form.dataset.listenerAttached = 'true';
}

// --- Background Security Check --- (Unchanged)
async function validateSessionInBackground() {
    // ... (your existing function is perfect) ...
    try {
        const res = await fetch('/api/session-user', { method: 'GET', credentials: 'include' });
        const data = await res.json();
        if (!data.success || !data.user) {
            localStorage.removeItem('staffUser');
            window.location.href = '../Forbidden.html';
            return;
        }
        const userRole = data.user.Role;
        const currentPage = window.location.pathname.split('/').pop();
        if (userRole === 'Evaluator') {
            const allowedPages = ['evaluation.html', 'comment-entry.html'];
            if (!allowedPages.includes(currentPage)) {
                window.location.href = 'evaluation.html';
                return; 
            }
        } 
        else if (userRole === 'Trainer') {
            localStorage.removeItem('staffUser');
            window.location.href = '../Forbidden.html';
            return;
        }
        else if (userRole === 'Staff' || userRole === 'Admin') {
            const evaluatorPages = ['evaluation.html', 'comment-entry.html'];
            if (evaluatorPages.includes(currentPage)) {
                window.location.href = 'overview.html';
                return;
            }
        }
        localStorage.setItem('staffUser', JSON.stringify(data.user));
    } catch (err) {
        console.error('Session validation failed:', err);
        localStorage.removeItem('staffUser');
        window.location.href = '../Forbidden.html';
    }
}

// --- Set Active Navbar Link --- (Unchanged)
function setActiveNavbarLink() {
    // ... (your existing function is perfect) ...
    const currentPage = window.location.pathname.split('/').pop();
    document.querySelectorAll('.navbar a, .navbar .dropdown-toggle').forEach(link => {
        link.classList.remove('active');
    });
    let activeLink = document.querySelector(`.navbar a[href="${currentPage}"]`);
    if (currentPage === 'overview.html' || currentPage === '') {
        return; 
    }
    if (activeLink) {
        activeLink.classList.add('active');
        const dropdown = activeLink.closest('.dropdown');
        if (dropdown) {
            const toggle = dropdown.querySelector('.dropdown-toggle');
            if (toggle) {
                toggle.classList.add('active');
            }
        }
    }
}

// --- ★★★ UPDATED: Populate Username (Fix #1) ★★★ ---
function populateUsername() {
    try {
        const userString = localStorage.getItem('staffUser');
        if (userString) {
            const user = JSON.parse(userString);
            
            // Find both mobile and desktop display elements
            const mobileDisplay = document.getElementById('staff-username-display');
            const desktopDisplay = document.getElementById('staff-username-display-desktop');
            
            if (user.Username) {
                // Build the popover content
                const popoverTitle = `<strong>${user.Username}</strong> (${user.Role})`;
                const popoverContent = `
                    <strong>Branch:</strong> ${user.Branch}<br/>
                    <strong>Gender:</strong> ${user.Gender}
                `;
                
                // Set for Mobile
                if (mobileDisplay) {
                    mobileDisplay.innerHTML = `👤 ${user.Username}`; // Add emoji back for mobile sidebar
                    // Initialize popover
                    new bootstrap.Popover(mobileDisplay, {
                        title: popoverTitle,
                        content: popoverContent,
                        html: true,
                        customClass: 'staff-popover'
                    });
                }
                
                // Set for Desktop
                if (desktopDisplay) {
                    desktopDisplay.innerHTML = user.Username; // No emoji on desktop
                    // Initialize popover
                    new bootstrap.Popover(desktopDisplay, {
                        title: popoverTitle,
                        content: popoverContent,
                        html: true,
                        customClass: 'staff-popover'
                    });
                }
            }
        }
    } catch (e) {
        console.error('Failed to set username', e);
    }
}

// --- Main Execution Block (Updated for Fix #2) ---
document.addEventListener('DOMContentLoaded', () => {
    
    // Run validation first
    validateSessionInBackground().then(() => {
        // Now that localStorage is set, populate the name
        populateUsername();
        
        // ★★★ FIX #2: Show the body only AFTER auth is complete ★★★
        document.body.style.visibility = 'visible';
    });
    
    setActiveNavbarLink();

    // --- Logout Listeners (Unchanged) ---
    const logoutLinks = document.querySelectorAll('#logoutLink, #logoutLinkMobile, #logoutLinkDesktop');
    logoutLinks.forEach(link => {
        if(link) { 
            link.addEventListener('click', function (e) {
                e.preventDefault();
                fetch('/api/logout', { method: 'POST', credentials: 'include' })
                    .then(() => {
                        localStorage.removeItem('staffUser');
                        sessionStorage.removeItem('isDefaultPassword');
                        window.location.href = '../homepage.html';
                    }).catch(err => console.error('Logout failed:', err));
            });
        }
    });

    // --- Password Change Modal (Unchanged) ---
    if (sessionStorage.getItem('isDefaultPassword') === 'true') {
        const passwordModalEl = document.getElementById('forcePasswordChangeModal');
        if (passwordModalEl) {
            const passwordModal = new bootstrap.Modal(passwordModalEl);
            passwordModal.show();
            handleInitialPasswordSet();
        }
    }
});