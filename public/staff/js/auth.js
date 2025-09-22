/**
 * This script now focuses only on background validation and utility functions.
 * The initial UI setup is handled by the bootstrap script in the HTML <head> to prevent flickering.
 */

// --- Background Security Check ---
async function validateSessionInBackground() {
    try {
        const res = await fetch('/api/session-user', { method: 'GET', credentials: 'include' });
        const data = await res.json();

        if (!data.success || !data.user || data.user.Role === 'Trainer') {
            localStorage.removeItem('staffUser');
            window.location.href = '../Forbidden.html';
            return;
        }

        // Re-sync localStorage with the latest server data.
        localStorage.setItem('staffUser', JSON.stringify(data.user));

    } catch (err) {
        console.error('Session validation failed:', err);
        localStorage.removeItem('staffUser');
        window.location.href = '../Forbidden.html';
    }
}

// --- Set Active Navbar Link ---
function setActiveNavbarLink() {
    const currentPage = window.location.pathname.split('/').pop();
    document.querySelectorAll('.navbar a').forEach(link => {
        const linkPage = link.getAttribute('href');
        if (linkPage === currentPage) {
            link.classList.add('active');
        } else {
            link.classList.remove('active');
        }
    });
}

// --- Main Execution Block ---
document.addEventListener('DOMContentLoaded', () => {
    // Run the security check in the background.
    validateSessionInBackground();

    // Set the active tab style.
    setActiveNavbarLink();

    // Handle logout.
    document.getElementById('logoutLink').addEventListener('click', function (e) {
        e.preventDefault();
        fetch('/api/logout', { method: 'POST', credentials: 'include' })
            .then(() => {
                localStorage.removeItem('staffUser');
                window.location.href = '../homepage.html';
            }).catch(err => console.error('Logout failed:', err));
    });
});