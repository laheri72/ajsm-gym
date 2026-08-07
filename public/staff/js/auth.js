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
            sessionStorage.removeItem('isDefaultPassword'); // Flag is cleared

            // ★★★ NEW: Now check if profile is complete ★★★
            checkProfileCompletion();

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

        // Store the user object from the session
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

// --- Populate Username & Popover ---
function populateUsername() {
    try {
        const userString = localStorage.getItem('staffUser');
        if (userString) {
            const user = JSON.parse(userString);
            
            // Find both mobile and desktop display elements
            const mobileDisplay = document.getElementById('staff-username-display');
            const desktopDisplay = document.getElementById('staff-username-display-desktop');
            const evaluatorDisplay = document.getElementById('evaluator-username-display');
            
            if (user.Username) {
                const popoverTitle = `<strong>${user.Username}</strong> (${user.Role})`;
                const popoverContent = `
                    <strong>Branch:</strong> ${user.Branch}<br/>
                    <strong>Gender:</strong> ${user.Gender}
                `;
                
                // For main staff pages
                if (mobileDisplay) {
                    mobileDisplay.innerHTML = `👤 ${user.Username}`;
                    new bootstrap.Popover(mobileDisplay, { title: popoverTitle, content: popoverContent, html: true, customClass: 'staff-popover' });
                }
                if (desktopDisplay) {
                    desktopDisplay.innerHTML = user.Username;
                    new bootstrap.Popover(desktopDisplay, { title: popoverTitle, content: popoverContent, html: true, customClass: 'staff-popover' });
                }
                
                // For simple evaluator pages
                if (evaluatorDisplay) {
                    evaluatorDisplay.textContent = `👤 ${user.Username}`;
                }
            }
        }
    } catch (e) {
        console.error('Failed to set username', e);
    }
}

// --- ★★★ NEW: Function to check for profile completion ★★★ ---
function checkProfileCompletion() {
    // This flag is set by the login API
    const isProfileComplete = sessionStorage.getItem('isProfileComplete');
    
    // Only run this on the evaluation page
    if (document.getElementById('completeProfileModal')) {
        if (isProfileComplete === 'false') {
            // Show the profile modal
            const profileModalEl = document.getElementById('completeProfileModal');
            const profileModal = new bootstrap.Modal(profileModalEl, {
                backdrop: 'static',
                keyboard: false
            });
            profileModal.show();
        }
    }
}

// --- Staff Notification Center ---
const STAFF_NOTIFICATION_REFRESH_MS = 60000;
let staffNotificationPoller = null;
let staffNotificationInitialized = false;

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function formatNotificationCount(count) {
    return count > 99 ? '99+' : String(count);
}

function createNotificationWidget(variant) {
    const widget = document.createElement('div');
    widget.className = `staff-notification-widget staff-notification-widget-${variant}`;
    widget.innerHTML = `
        <button type="button" class="staff-notification-trigger" aria-label="Open notifications" aria-expanded="false">
            <span class="staff-notification-icon" aria-hidden="true">&#128276;</span>
            <span class="staff-notification-badge" hidden>0</span>
        </button>
        <div class="staff-notification-panel" role="menu" aria-label="Notifications">
            <div class="staff-notification-panel-header">
                <strong>Notifications</strong>
                <span class="staff-notification-total">No pending work</span>
            </div>
            <div class="staff-notification-list">
                <div class="staff-notification-empty">No pending work.</div>
            </div>
        </div>
    `;

    const trigger = widget.querySelector('.staff-notification-trigger');
    trigger.addEventListener('click', (event) => {
        event.stopPropagation();
        const isOpen = widget.classList.toggle('open');
        trigger.setAttribute('aria-expanded', String(isOpen));
    });

    widget.addEventListener('click', (event) => event.stopPropagation());
    return widget;
}

function closeNotificationPanels() {
    document.querySelectorAll('.staff-notification-widget.open').forEach((widget) => {
        widget.classList.remove('open');
        widget.querySelector('.staff-notification-trigger')?.setAttribute('aria-expanded', 'false');
    });
}

function injectNotificationCenter() {
    if (staffNotificationInitialized) return;

    const navbar = document.getElementById('navbar');
    const desktopUserMenu = document.getElementById('user-menu-desktop');
    const appHeader = document.querySelector('.app-header');
    const hamburgerBtn = document.getElementById('hamburger-btn');

    if (!navbar || !desktopUserMenu || !appHeader) return;

    const desktopWidget = createNotificationWidget('desktop');
    if (desktopUserMenu.parentNode === navbar) {
        navbar.insertBefore(desktopWidget, desktopUserMenu);
    } else if (desktopUserMenu.parentNode) {
        desktopUserMenu.parentNode.insertBefore(desktopWidget, desktopUserMenu);
    } else {
        navbar.appendChild(desktopWidget);
    }

    const mobileWidget = createNotificationWidget('mobile');
    if (hamburgerBtn && hamburgerBtn.parentNode === appHeader) {
        appHeader.insertBefore(mobileWidget, hamburgerBtn);
    } else {
        appHeader.appendChild(mobileWidget);
    }

    document.addEventListener('click', closeNotificationPanels);
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') closeNotificationPanels();
    });

    staffNotificationInitialized = true;
}

function renderNotificationState({ notifications = [], total = 0, error = false }) {
    const widgets = document.querySelectorAll('.staff-notification-widget');
    widgets.forEach((widget) => {
        const badge = widget.querySelector('.staff-notification-badge');
        const totalText = widget.querySelector('.staff-notification-total');
        const list = widget.querySelector('.staff-notification-list');
        const count = Number(total) || 0;

        if (badge) {
            badge.hidden = count <= 0;
            badge.textContent = formatNotificationCount(count);
        }

        if (error) {
            if (totalText) totalText.textContent = 'Load failed';
            if (list) list.innerHTML = '<div class="staff-notification-empty staff-notification-error">Unable to load notifications.</div>';
            return;
        }

        if (totalText) {
            totalText.textContent = count > 0 ? `${formatNotificationCount(count)} pending` : 'No pending work';
        }

        if (!list) return;

        if (!notifications.length) {
            list.innerHTML = '<div class="staff-notification-empty">No pending work.</div>';
            return;
        }

        list.innerHTML = notifications.map((notification) => `
            <a class="staff-notification-item staff-notification-priority-${escapeHtml(notification.priority || 'info')}" href="${escapeHtml(notification.href || '#')}">
                <span class="staff-notification-item-count">${formatNotificationCount(Number(notification.count) || 0)}</span>
                <span class="staff-notification-item-copy">
                    <strong>${escapeHtml(notification.title)}</strong>
                    <small>${escapeHtml(notification.message)}</small>
                </span>
            </a>
        `).join('');
    });
}

async function refreshStaffNotifications() {
    if (!staffNotificationInitialized) return;

    try {
        const res = await fetch('/api/staff/notifications', {
            method: 'GET',
            credentials: 'include',
            headers: { 'Accept': 'application/json' }
        });

        if (res.status === 401) {
            renderNotificationState({ notifications: [], total: 0 });
            return;
        }

        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.message || 'Failed to load notifications.');

        renderNotificationState({
            notifications: data.notifications || [],
            total: data.total || 0
        });
    } catch (err) {
        console.error('Notification refresh failed:', err);
        renderNotificationState({ error: true });
    }
}

function initStaffNotificationCenter() {
    injectNotificationCenter();
    if (!staffNotificationInitialized) return;

    refreshStaffNotifications();
    if (!staffNotificationPoller) {
        staffNotificationPoller = window.setInterval(refreshStaffNotifications, STAFF_NOTIFICATION_REFRESH_MS);
    }
    window.staffNotificationsRefresh = refreshStaffNotifications;
}

// --- Main Execution Block ---
document.addEventListener('DOMContentLoaded', () => {
    
    validateSessionInBackground().then(() => {
        populateUsername();
        initStaffNotificationCenter();
        document.body.style.visibility = 'visible';

        // --- ★★★ NEW MODAL LOGIC ★★★ ---
        // This logic runs *after* the page is visible.
        // It prioritizes: Password first, THEN profile.
        
        const isDefaultPassword = sessionStorage.getItem('isDefaultPassword');
        
        if (isDefaultPassword === 'true') {
            // 1. Show Password Modal
            const passwordModalEl = document.getElementById('forcePasswordChangeModal');
            if (passwordModalEl) {
                const passwordModal = new bootstrap.Modal(passwordModalEl, {
                    backdrop: 'static',
                    keyboard: false
                });
                passwordModal.show();
                handleInitialPasswordSet(); // Attaches listener
            }
        } else {
            // 2. If password is OK, check profile (only on evaluator pages)
            checkProfileCompletion();
        }
        /// ★★★ ADD THIS LINE ★★★
        // Broadcast that authentication is finished
        document.dispatchEvent(new Event('auth:finished'));
    });
    
    // This is for the main staff navbar, harmless on evaluator pages
    setActiveNavbarLink();

    // --- Logout Listeners ---
    const logoutLinks = document.querySelectorAll('#logoutLink, #logoutLinkMobile, #logoutLinkDesktop');
    logoutLinks.forEach(link => {
        if(link) { 
            link.addEventListener('click', function (e) {
                e.preventDefault();
                fetch('/api/logout', { method: 'POST', credentials: 'include' })
                    .then(() => {
                        localStorage.removeItem('staffUser');
                        sessionStorage.clear(); // Clear all session storage
                        window.location.href = '../homepage.html';
                    }).catch(err => console.error('Logout failed:', err));
            });
        }
    });

    // This is for the evaluator pages, harmless on staff pages
    if (document.getElementById('saveProfileBtn')) {
        document.getElementById('saveProfileBtn').addEventListener('click', async () => {
            const payload = {
                Name: document.getElementById('evaluatorName').value,
                Profession: document.getElementById('evaluatorProfession').value,
                Email: document.getElementById('evaluatorEmail').value,
                Contact: document.getElementById('evaluatorContact').value,
            };

            if (!payload.Name || !payload.Profession) {
                return Swal.fire('Missing Fields', 'Full Name and Profession are required.', 'warning');
            }

            try {
                const res = await fetch('/api/evaluator/profile', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Credentials': 'include' },
                    body: JSON.stringify(payload)
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.message);

                await Swal.fire('Success!', 'Your profile has been updated.', 'success');
                
                // Clear the flag and hide the modal
                sessionStorage.setItem('isProfileComplete', 'true');
                const modalEl = document.getElementById('completeProfileModal');
                const modal = bootstrap.Modal.getInstance(modalEl);
                modal.hide();

            } catch (err) {
                Swal.fire('Error', err.message, 'error');
            }
        });
    }
});
