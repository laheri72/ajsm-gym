/**
 * This script handles session validation, logout, and the forced password change workflow.
 */

// --- PASSWORD CHANGE LOGIC ---

function handleInitialPasswordSet() {
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
    validateSessionInBackground();
    setActiveNavbarLink();

    document.getElementById('logoutLink').addEventListener('click', function (e) {
        e.preventDefault();
        fetch('/api/logout', { method: 'POST', credentials: 'include' })
            .then(() => {
                localStorage.removeItem('staffUser');
                sessionStorage.removeItem('isDefaultPassword');
                window.location.href = '../homepage.html';
            }).catch(err => console.error('Logout failed:', err));
    });

    // --- Check for the password change flag on page load ---
    if (sessionStorage.getItem('isDefaultPassword') === 'true') {
        const passwordModalEl = document.getElementById('forcePasswordChangeModal');
        if (passwordModalEl) {
            const passwordModal = new bootstrap.Modal(passwordModalEl);
            passwordModal.show();
            handleInitialPasswordSet();
        }
    }
});