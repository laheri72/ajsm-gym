import { setStudentAuthData, setStudentHeight } from './state.js';
import { showLeaderboard, updateXPBarUI, showLevelUpAnimation } from './gamification.js';
import { loadTip } from './tips.js';
import { loadWeeklyPlan } from './planner.js';
import { loadDashboardStats } from './dashboard.js';
import { loadCurrentWeightStat } from './progression.js';
import { initializeHeaderPopovers } from './new-header.js'; // <-- This is crucial

/**
 * Fetches the student's session data, sets global state, and triggers
 * the initial load of all dashboard components.
 */
export async function getStudentSession() {
  try {
    const res = await fetch('/api/student-session', {
      method: 'GET',
      credentials: 'include'
    });
    const data = await res.json();

    if (!data.success) {
      window.location.href = '../Forbidden.html';
      return;
    }

    showLeaderboard();
    
    const stu = data.user; 
    const memberSinceDate = new Date(stu.joinedAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });

    // --- Set Global State ---
    setStudentAuthData({
        TR: stu.TR,
        Name: stu.Name,
        Branch: stu.Branch,
        Gender: stu.Gender,
        membersince: memberSinceDate
    });
    setStudentHeight(stu.Height);
    // --- End State Set ---

    // --- XP & Level ---
    document.getElementById('xpBarText').textContent = 'Loading...';
    const lastSeenLevel = parseInt(localStorage.getItem('lastSeenLevel') || '0');
    if (stu.FitnessLevel > lastSeenLevel) {
        showLevelUpAnimation(stu.FitnessLevel);
        localStorage.setItem('lastSeenLevel', stu.FitnessLevel);
    }
    updateXPBarUI(stu.FitnessLevel, stu.CurrentXP);

    // --- THIS IS THE FIX for WELCOME TEXT ---
    // 1. Set the visible student name
document.getElementById('studentName').innerText = stu.Name || 'Student';
    
    const title =
      stu.Gender?.toLowerCase() === 'male' ? 'Talabat'
      : stu.Gender?.toLowerCase() === 'female' ? 'Talebaat'
      : 'Student';
    
    // Create the full popover content with all 4 info items
    const popoverContent = `
        <p class="mb-1"><strong>Member Since:</strong> ${memberSinceDate}</p>
        <p class="mb-1"><strong>Branch:</strong> ${stu.Branch} | ${title}</p>
        <hr class="my-2">
        <p class="mb-1"><strong>Goal:</strong> ${stu.Goal || 'N/A'}</p>
        <p class="mb-1"><strong>Slot:</strong> ${stu.SlotName || 'N/A'}</p>
        <p class="mb-1"><strong>Class:</strong> ${stu.Darajah || 'N/A'}</p>
        <p class="mb-0"><strong>TR:</strong> ${stu.TR}</p>
    `;
    
    const brandTrigger = document.getElementById('brand-info-trigger');
    if (brandTrigger) {
        brandTrigger.setAttribute('data-bs-content', popoverContent);
    }
    // --- END OF FIX ---

    // --- Password Check ---
    if (stu.HasLoggedInBefore === false) {
        const passwordModal = new bootstrap.Modal(document.getElementById('forcePasswordChangeModal'));
        passwordModal.show();
        handleInitialPasswordSet(); // Set up the form listener
    }
    
    // --- Load Other Dashboard Components ---
    loadTip(stu.Goal);
    loadWeeklyPlan();
    loadDashboardStats(); 
    loadCurrentWeightStat();

    // --- Initialize popovers AFTER all data is set ---
    initializeHeaderPopovers();

  } catch (err) {
    console.error('Error fetching student session:', err);
    window.location.href = '../Forbidden.html';
  }
}

// --- (rest of auth.js file) ---

export function handleInitialPasswordSet() {
    const form = document.getElementById('setPasswordForm');
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const newPassword = document.getElementById('newPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;

        if (newPassword !== confirmPassword) {
            return Swal.fire('Error', 'Passwords do not match.', 'error');
        }

        try {
            const res = await fetch('/api/student/set-initial-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ newPassword })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message);
            
            Swal.fire('Success!', 'Your new password has been set.', 'success');
            const modal = bootstrap.Modal.getInstance(document.getElementById('forcePasswordChangeModal'));
            modal.hide();

        } catch (err) {
            Swal.fire('Error', err.message, 'error');
        }
    });
}

export async function logout(e) {
    e.preventDefault();
    try {
        const res = await fetch('/api/logout', {
            method: 'POST',
            credentials: 'include'
        });
        const data = await res.json();
        if (data.success) {
            localStorage.clear();
            window.location.href = '../homepage.html';
        } else {
            alert('Logout failed. Please try again.');
        }
    } catch (err) {
        console.error('Logout error:', err);
        alert('Could not connect to the server to log out.');
    }
}