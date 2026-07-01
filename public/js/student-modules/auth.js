import { setStudentAuthData, setStudentHeight, isPlannerDirty, setStudentGoal, studentTR, studentGoal } from './state.js';
import { showLeaderboard, updateXPBarUI, showLevelUpAnimation } from './gamification.js';
import { loadTip } from './tips.js';
import { loadWeeklyPlan } from './planner.js';
import { loadDashboardStats } from './dashboard.js';
import { loadCurrentWeightStat } from './progression.js';
import { initializeHeaderPopovers } from './new-header.js'; 

/**
 * Helper to get the current student TR
 */
export function getTR() {
    return studentTR;
}

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
    
    // Handle Member Since Date
    let memberSinceDate = 'N/A';
    if (stu.joinedAt) {
        memberSinceDate = new Date(stu.joinedAt).toLocaleDateString(undefined, { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        });
    }

    // --- GYM MEMBER & STATUS CHECK ---
    const isNotGymMember = !stu.joinedAt;
    const isInactive = stu.Status === 'Inactive';

    if (isNotGymMember) {
        // Remove Attendance and Leaves tabs for non-gym members
        const attendanceTab = document.querySelector('a[href="#attendance"]')?.closest('.nav-item');
        const leavesTab = document.querySelector('a[href="#leaves"]')?.closest('.nav-item');
        
        if (attendanceTab) attendanceTab.remove();
        if (leavesTab) leavesTab.remove();
    }

    if (isNotGymMember || isInactive) {
        const banner = document.getElementById('inactive-status-banner');
        if (banner) {
            banner.style.display = 'block'; // Show the banner
        }
        // Add a class to the body to disable features or for styling
        document.body.classList.add('is-inactive');
    }

    // --- Set Global State ---
    setStudentAuthData({
        TR: stu.TR,
        Name: stu.Name,
        Branch: stu.Branch,
        Gender: stu.Gender,
        membersince: memberSinceDate,
        FeatureFlags: stu.FeatureFlags || {}
    });
    setStudentHeight(stu.Height);
    setStudentGoal(stu.Goal);
    // --- End State Set ---

    // --- Update Goal Displays ---
    updateGoalUI(stu.Goal);

    // --- XP & Level ---
    document.getElementById('xpBarText').textContent = 'Loading...';
    const lastSeenLevel = parseInt(localStorage.getItem('lastSeenLevel') || '0');
    if (stu.FitnessLevel > lastSeenLevel) {
        showLevelUpAnimation(stu.FitnessLevel);
    }
    updateXPBarUI(stu.FitnessLevel, stu.CurrentXP);

    // --- THIS IS THE FIX for WELCOME TEXT ---
    // 1. Set the visible student name
    document.getElementById('studentName').innerText = stu.Name || 'Student';
    
    refreshHeaderPopover(stu, memberSinceDate);
    
    // --- Update Planner Slot UI ---
    const slotBadge = document.getElementById('currentSlotBadge');
    if (slotBadge) {
        slotBadge.textContent = stu.SlotName || 'No Slot Assigned';
        if (!stu.SlotName) {
            slotBadge.classList.replace('bg-secondary', 'bg-danger');
        }
    }
    checkSlotRequestStatus().catch(console.error); // Defer: do not block main thread
    handleSlotChangeRequest();

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

function refreshHeaderPopover(stu, memberSince) {
    const title =
      stu.Gender?.toLowerCase() === 'male' ? 'Talabat'
      : stu.Gender?.toLowerCase() === 'female' ? 'Talebaat'
      : 'Student';
    
    const popoverContent = `
        <p class="mb-1"><strong>Member Since:</strong> ${memberSince}</p>
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
        // Re-init popover if it already exists
        const instance = bootstrap.Popover.getInstance(brandTrigger);
        if (instance) {
            instance.setContent({ '.popover-body': popoverContent });
        }
    }
}

function updateGoalUI(goal) {
    const displayGoalText = document.getElementById('displayGoalText');
    if (displayGoalText) {
        displayGoalText.textContent = goal || 'Not Set';
    }
}

export async function handleGoalUpdate() {
    const goals = [
        'General Fitness', 'Weight Loss', 'Muscle Gain', 
        'Strength', 'Endurance', 'Flexibility', 
        'Energy Boost', 'Stress Relief', 'Overall Health'
    ];

    const { value: newGoal } = await Swal.fire({
        title: 'Select Your Fitness Goal',
        input: 'select',
        inputOptions: goals.reduce((acc, g) => ({ ...acc, [g]: g }), {}),
        inputValue: studentGoal || 'General Fitness',
        showCancelButton: true,
        inputPlaceholder: 'Select a goal',
        confirmButtonText: 'Update Goal',
        confirmButtonColor: 'var(--primary)',
        inputValidator: (value) => {
            return new Promise((resolve) => {
                if (value) resolve();
                else resolve('You must select a goal');
            });
        }
    });

    if (newGoal) {
        try {
            const res = await fetch('/api/student/set-goal', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ goal: newGoal })
            });
            const data = await res.json();

            if (data.success) {
                setStudentGoal(newGoal);
                updateGoalUI(newGoal);
                
                // Refresh personal tips based on new goal
                loadTip(newGoal);

                // Update popover content
                const brandTrigger = document.getElementById('brand-info-trigger');
                if (brandTrigger) {
                    const stuData = {
                        Name: document.getElementById('studentName').innerText,
                        TR: studentTR,
                        Goal: newGoal,
                        Branch: 'Current', // placeholder or get from state
                        Gender: 'Student', // placeholder or get from state
                        SlotName: 'Current', // placeholder or get from state
                        Darajah: 'Current' // placeholder or get from state
                    };
                    // Instead of complex logic, just re-fetch session or update string partially
                    // Quickest is to re-trigger getStudentSession or just inform user
                    Swal.fire({
                        icon: 'success',
                        title: 'Goal Updated!',
                        text: 'Your dashboard has been personalized for your new goal.',
                        timer: 2000,
                        showConfirmButton: false
                    }).then(() => {
                        window.location.reload(); // Hard refresh to sync everything easily
                    });
                }
            } else {
                throw new Error(data.message);
            }
        } catch (err) {
            Swal.fire('Error', err.message || 'Failed to update goal', 'error');
        }
    }
}

export function handleInitialPasswordSet() {
     const form = document.getElementById('setPasswordForm');
     form.addEventListener('submit', async (e) => {
         e.preventDefault();

        // 1. Get button elements
        const submitBtn = document.getElementById('setPasswordBtn');
        const buttonText = submitBtn.querySelector('.button-text');
        const spinner = submitBtn.querySelector('.spinner-border');

         const newPassword = document.getElementById('newPassword').value;
         const confirmPassword = document.getElementById('confirmPassword').value;

         if (newPassword !== confirmPassword) {
             return Swal.fire('Error', 'Passwords do not match.', 'error');
         }

        // 2. Start loader and disable button
        submitBtn.disabled = true;
        buttonText.classList.add('d-none');
        spinner.classList.remove('d-none');

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
         } finally {
            // 3. Stop loader and re-enable button (this always runs)
            submitBtn.disabled = false;
            buttonText.classList.remove('d-none');
            spinner.classList.add('d-none');
        }
     });
}

// --- Slot Change Logic ---

async function checkSlotRequestStatus() {
    try {
        const res = await fetch('/api/student/slot-request/status', { credentials: 'include' });
        const data = await res.json();
        
        const requestSlotChangeBtn = document.getElementById('requestSlotChangeBtn');
        const pendingSlotChangeIcon = document.getElementById('pendingSlotChangeIcon');
        const processedSlotChangeIcon = document.getElementById('processedSlotChangeIcon');

        if (data.success) {
            if (data.hasPending) {
                if (requestSlotChangeBtn) requestSlotChangeBtn.style.display = 'none';
                if (pendingSlotChangeIcon) pendingSlotChangeIcon.style.display = 'inline-block';
                if (processedSlotChangeIcon) processedSlotChangeIcon.style.display = 'none';
            } else {
                if (requestSlotChangeBtn) requestSlotChangeBtn.style.display = 'inline-block';
                if (pendingSlotChangeIcon) pendingSlotChangeIcon.style.display = 'none';

                if (data.hasProcessed && processedSlotChangeIcon) {
                    processedSlotChangeIcon.style.display = 'inline-block';
                    const isApproved = data.status === 'Approved';
                    const colorClass = isApproved ? 'text-success' : 'text-danger';
                    const iconClass = isApproved ? 'bi-check-circle-fill' : 'bi-x-circle-fill';

                    processedSlotChangeIcon.className = `ms-2 slot-response-anim ${colorClass}`;
                    processedSlotChangeIcon.innerHTML = `<i class="bi ${iconClass}"></i> ${data.status}`;
                    processedSlotChangeIcon.title = "Click to view staff remarks";

                    // Remove old listeners by cloning
                    const newIcon = processedSlotChangeIcon.cloneNode(true);
                    processedSlotChangeIcon.parentNode.replaceChild(newIcon, processedSlotChangeIcon);

                    newIcon.addEventListener('click', () => {
                        Swal.fire({
                            icon: isApproved ? 'success' : 'error',
                            title: `Request ${data.status}`,
                            html: `Your request to change your slot to <strong>${data.requestedSlotName}</strong> was ${data.status.toLowerCase()}.<br><br><strong>Staff Note:</strong> <i>${data.remarks || 'No remarks provided.'}</i>`,
                            confirmButtonColor: 'var(--primary)'
                        });
                    });
                } else if (processedSlotChangeIcon) {
                    processedSlotChangeIcon.style.display = 'none';
                }
            }
        }
    } catch (err) {
        console.error('Error checking slot request status:', err);
    }
}

function handleSlotChangeRequest() {
    const btn = document.getElementById('requestSlotChangeBtn');
    if (!btn) return;

    btn.addEventListener('click', async () => {
        try {
            // 1. Fetch available slots
            const res = await fetch('/api/slots', { credentials: 'include' });
            const data = await res.json();

            if (!data.success) {
                throw new Error(data.message || 'Failed to fetch slots.');
            }

            // Get the current slot name from the UI
            const currentSlotBadge = document.getElementById('currentSlotBadge');
            const currentSlotName = currentSlotBadge ? currentSlotBadge.textContent.trim() : '';

            // 2. Build options map
            const slots = data.slots;
            const slotOptions = {};
            let hasAvailableSlots = false;

            slots.forEach(slot => {
                // Filter out full slots AND the student's current slot
                if (slot.AvailableSeats > 0 && slot.SlotName !== currentSlotName) {
                    slotOptions[slot.SlotID] = `${slot.SlotName} (${slot.AvailableSeats} spots left)`;
                    hasAvailableSlots = true;
                }
            });

            if (!hasAvailableSlots) {
                Swal.fire('No Slots Available', 'All alternative slots are currently full.', 'info');
                return;
            }

            // 3. Show SweetAlert2 Modal with slot dropdown and reason input
            const { value: formValues } = await Swal.fire({
                title: 'Request Slot Change',
                html: `
                    <div class="text-start mb-2" style="font-size: 0.9rem; color: var(--text-muted); opacity: 0.85;">Select your preferred new time slot and state the reason. This request must be approved by staff.</div>
                    <select id="swal-slot-select" class="swal2-select" style="width: 100%; margin: 10px 0; box-sizing: border-box; font-size: 0.95rem;">
                        <option value="" disabled selected>Choose a new slot...</option>
                        ${Object.entries(slotOptions).map(([id, text]) => `<option value="${id}">${text}</option>`).join('')}
                    </select>
                    <input id="swal-reason-input" class="swal2-input" placeholder="Reason for slot change (max 255 chars)..." maxlength="255" style="width: 100%; margin: 10px 0; box-sizing: border-box; font-size: 0.95rem;">
                `,
                focusConfirm: false,
                showCancelButton: true,
                confirmButtonColor: 'var(--primary)',
                cancelButtonColor: 'var(--gray)',
                confirmButtonText: 'Submit Request',
                preConfirm: () => {
                    const slotSelect = document.getElementById('swal-slot-select');
                    const reasonInput = document.getElementById('swal-reason-input');
                    const selectedSlotID = slotSelect.value;
                    const reason = reasonInput.value.trim();

                    if (!selectedSlotID) {
                        Swal.showValidationMessage('You need to select a slot');
                        return false;
                    }
                    if (!reason) {
                        Swal.showValidationMessage('You need to provide a reason');
                        return false;
                    }
                    if (reason.length > 255) {
                        Swal.showValidationMessage('Reason must be 255 characters or less');
                        return false;
                    }
                    return { selectedSlotID, reason };
                }
            });

            if (formValues) {
                // 4. Submit Request
                const submitRes = await fetch('/api/student/slot-request', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ 
                        requestedSlotID: parseInt(formValues.selectedSlotID),
                        reason: formValues.reason
                    })
                });
                
                const submitData = await submitRes.json();
                
                if (submitData.success) {
                    Swal.fire('Requested!', 'Your slot change request has been submitted to staff for review.', 'success');
                    await checkSlotRequestStatus(); // Update UI to show timer icon
                } else {
                    throw new Error(submitData.message || 'Failed to submit request.');
                }
            }

        } catch (err) {
            Swal.fire('Error', err.message, 'error');
        }
    });
}


export async function logout(e) {
    e.preventDefault();
    if (isPlannerDirty) {
        const result = await Swal.fire({
            title: 'You have unsaved changes!',
            text: "Your planner hasn't been saved. Are you sure you want to log out?",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            confirmButtonText: 'Logout Anyway',
            cancelButtonText: 'Cancel'
        });

        if (!result.isConfirmed) {
            return; // User clicked "Cancel", so we stop the logout.
        }
    }
    try {
        const res = await fetch('/api/logout', {
            method: 'POST',
            credentials: 'include',
            cache: 'no-store'
        });
        const data = await res.json();
        if (data.success) {
            // Preserve a few persistent UI keys (theme, lastSeenLevel) so
            // they don't cause desirable one-time modals to reappear after logout.
            const savedTheme = localStorage.getItem('theme');
            const savedLastSeenLevel = localStorage.getItem('lastSeenLevel');

            localStorage.clear();
            sessionStorage.clear();

            if (savedTheme) localStorage.setItem('theme', savedTheme);
            if (savedLastSeenLevel) localStorage.setItem('lastSeenLevel', savedLastSeenLevel);

            if ('caches' in window) {
                const cacheNames = await caches.keys();
                await Promise.all(cacheNames.map(name => caches.delete(name)));
            }

            window.location.replace(`../homepage.html?logout=${Date.now()}`);
        } else {
            alert('Logout failed. Please try again.');
        }
    } catch (err) {
        console.error('Logout error:', err);
        alert('Could not connect to the server to log out.');
    }
}
