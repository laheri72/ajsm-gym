/**
 * This script runs on EVERY staff page.
 * 1. Validates the user's session. Redirects to Forbidden.html if not logged in.
 * 2. Fetches user details (Role, Branch, Gender) and stores them for other scripts.
 * 3. Dynamically handles the visibility of Admin/Fitness Test tabs.
 * 4. Sets the 'active' class on the correct navbar link.
 */
document.addEventListener('DOMContentLoaded', () => {
    validateStaffSession();
    setActiveNavbarLink();
});

async function validateStaffSession() {
    try {
        const res = await fetch('/api/session-user', {
            method: 'GET',
            credentials: 'include'
        });
        const data = await res.json();

        // If session is invalid or user is not found, kick them out.
        if (!data.success || !data.user) {
            window.location.href = '../Forbidden.html';
            return;
        }

        // If a Staff member with 'Trainer' role tries to access, kick them out.
        if (data.user.Role === 'Trainer') {
            window.location.href = '../Forbidden.html';
            return;
        }

        // Store user details in localStorage so other page-specific scripts can use them.
        localStorage.setItem('user', JSON.stringify(data.user));

        // Handle UI elements common to all pages
        handleCommonUI(data.user);

    } catch (err) {
        console.error('Failed to validate session:', err);
        window.location.href = '../Forbidden.html';
    }
}

function handleCommonUI(user) {
    const { Branch, Gender, Role } = user;

    // Show/hide Admin tab based on role
    const adminTab = document.getElementById('tab-admin');
    if (adminTab) {
        adminTab.style.display = (Role === 'Admin') ? 'inline-block' : 'none';
    }

    // Show/hide Fitness Test tab based on branch and gender
    const fitnessTab = document.getElementById('tab-test');
    if (fitnessTab) {
        fitnessTab.style.display = (Branch === 'Marol' && Gender === 'Male') ? 'inline-block' : 'none';
    }
    
    // Handle logout link
     document.getElementById('logoutLink').addEventListener('click', function (e) {
        e.preventDefault();
        fetch('/api/logout', { method: 'POST', credentials: 'include' })
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    localStorage.clear();
                    window.location.href = '../homepage.html';
                }
            }).catch(err => console.error('Logout failed:', err));
    });
}

function setActiveNavbarLink() {
    // Get the current page's filename (e.g., "overview.html")
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