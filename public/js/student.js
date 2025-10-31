/* =================================================================== */
/* STUDENT DASHBOARD - MAIN ENTRY POINT
/*
/* This file imports all functional modules and sets up
/* the main event listeners for the page.
/* =================================================================== */

// Import all functional modules
import { getStudentSession, handleInitialPasswordSet, logout } from './student-modules/auth.js';
import { showXpInfoModal } from './student-modules/gamification.js';
import { navigateToSection, routeFromHash } from './student-modules/navigation.js';
import { handleWeightLogSubmit, handleWeightLogDelete, loadFitnessProgress, loadWeightLogHistory } from './student-modules/progression.js';
import { initializeWeekPicker } from './student-modules/attendance.js';
import { savePlan, clearPlanner, applyLastWeeksPlan, openQuickAddDialog, addExerciseToCard } from './student-modules/planner.js';
import { loadStudentPlans, loadTrainingAnalytics, loadSessionAnalytics, loadWorkoutConsistency, applyChartTheme } from './student-modules/analysis.js';
import { loadLeaveData, handleLeaveSubmit, handleLeaveCancel } from './student-modules/leaves.js';
import { loadBodyPartTips } from './student-modules/tips.js';

// --- DOM CONTENT LOADED EVENT ---
document.addEventListener('DOMContentLoaded', () => {
    
    // --- Setup Event Listeners ---
    
    // Header and navigation
    document.getElementById('logoutBtn').addEventListener('click', logout);
    document.getElementById('xpInfoBtn').addEventListener('click', showXpInfoModal);

    // Theme Toggle
    const rootEl = document.documentElement;
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') rootEl.setAttribute('data-theme', 'dark');
    const themeToggleBtn = document.getElementById('themeToggleBtn');
    if (themeToggleBtn) {
        themeToggleBtn.innerHTML = rootEl.getAttribute('data-theme') === 'dark' ? '<i class="bi bi-brightness-high"></i>' : '<i class="bi bi-moon-stars"></i>';
        themeToggleBtn.addEventListener('click', () => {
            const isDark = rootEl.getAttribute('data-theme') === 'dark';
            if (isDark) {
                rootEl.removeAttribute('data-theme');
                localStorage.setItem('theme', 'light');
                themeToggleBtn.innerHTML = '<i class="bi bi-moon-stars"></i>';
            } else {
                rootEl.setAttribute('data-theme', 'dark');
                localStorage.setItem('theme', 'dark');
                themeToggleBtn.innerHTML = '<i class="bi bi-brightness-high"></i>';
            }
            applyChartTheme();
        });
    }

    // Init Bootstrap Tooltips
    const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
    tooltipTriggerList.map(el => new bootstrap.Tooltip(el));

    // Leave Management
    document.getElementById('leaveRequestForm').addEventListener('submit', handleLeaveSubmit);
    document.querySelector('#leaveStatusTable tbody').addEventListener('click', handleLeaveCancel);
    
    // Planner
    document.getElementById('savePlanBtn').addEventListener('click', savePlan);
    document.getElementById('applyLastWeekBtn').addEventListener('click', applyLastWeeksPlan);
    document.getElementById('clearPlanBtn')?.addEventListener('click', clearPlanner);
    document.querySelectorAll('#weekly-view .quick-add-btn').forEach(btn => {
        btn.addEventListener('click', () => openQuickAddDialog(btn.dataset.day));
    });
    document.getElementById('today-quick-add').addEventListener('click', () => {
        openQuickAddDialog(document.getElementById('today-day-card').dataset.day);
    });

    // Planner Autosave (Weekly View)
    const weeklyPlannerCards = document.querySelectorAll('#weekly-view .day-card');
    try {
        const draft = JSON.parse(localStorage.getItem('plannerDraft') || '{}');
        weeklyPlannerCards.forEach(card => {
            const day = card.getAttribute('data-day');
            if (draft[day]) card.innerHTML = draft[day];
        });
    } catch {}
    weeklyPlannerCards.forEach(card => {
        card.addEventListener('input', () => {
            const draft = {};
            document.querySelectorAll('#weekly-view .day-card').forEach(c => {
                draft[c.getAttribute('data-day')] = c.innerHTML.trim();
            });
            localStorage.setItem('plannerDraft', JSON.stringify(draft));
        });
    });
    
    // Planner View Toggle
    const plannerViewToggle = document.getElementById('plannerViewToggle');
    plannerViewToggle.addEventListener('change', () => {
        const isWeekly = plannerViewToggle.checked;
        document.getElementById('daily-view').style.display = isWeekly ? 'none' : 'block';
        document.getElementById('weekly-view').style.display = isWeekly ? 'block' : 'none';
    });

    // Planner Sync (Today card -> Weekly card)
    const todayCard = document.getElementById('today-day-card');
    todayCard.addEventListener('input', () => {
        const todayName = todayCard.dataset.day;
        const correspondingWeeklyCard = document.querySelector(`#weekly-view .day-card[data-day="${todayName}"]`);
        if (correspondingWeeklyCard) {
            correspondingWeeklyCard.innerHTML = todayCard.innerHTML;
        }
    });

    // Progression (Weight Logging)
    document.getElementById('weightLogForm').addEventListener('submit', handleWeightLogSubmit);
    document.getElementById('weightHistoryBody').addEventListener('click', handleWeightLogDelete);
    document.getElementById('log-weight-shortcut').addEventListener('click', (e) => {
        e.preventDefault();
        window.location.hash = 'logs&tab=progression'; 
    });

    // Tips
    document.getElementById('bodyPartSelect').addEventListener('change', loadBodyPartTips);
    document.getElementById('workoutAccordion')?.addEventListener('click', (e) => {
        if (!e.target.classList.contains('add-to-plan-btn')) return;
        e.preventDefault();
        const exerciseName = e.target.dataset.exercise;
        Swal.fire({
            title: `Add "${exerciseName}"`,
            html: `
              <select id="qa-day" class="swal2-select">
                <option>Monday</option><option>Tuesday</option><option>Wednesday</option>
                <option>Thursday</option><option>Friday</option><option>Saturday</option><option>Sunday</option>
              </select>
              <div>
                <input id="qa-sets" class="swal2-input" type="number" min="1" placeholder="Sets" style="flex:1;" />
                <input id="qa-reps" class="swal2-input" type="text" placeholder="Reps (e.g., 10-12)" style="flex:1;" />
              </div>
            `,
            focusConfirm: false,
            showCancelButton: true,
            confirmButtonText: 'Add to Plan'
        }).then(result => {
            if (!result.isConfirmed) return;
            const selectedDay = document.getElementById('qa-day').value;
            const sets = (document.getElementById('qa-sets').value || '').trim();
            const reps = (document.getElementById('qa-reps').value || '').trim();
            const formatted = [exerciseName, sets && `${sets} sets`, reps && `${reps} reps`].filter(Boolean).join(' - ');
            addExerciseToCard(selectedDay, formatted);
        });
    });

    // Analytics Tabs
    document.querySelector('.tab-nav')?.addEventListener('click', (e) => {
        if (!e.target.matches('.tab-link')) return;
        
        const tabId = e.target.dataset.tab;
        document.querySelectorAll('.tab-nav .tab-link').forEach(link => link.classList.remove('active'));
        e.target.classList.add('active');
        document.querySelectorAll('.tab-pane').forEach(pane => {
            pane.classList.toggle('active', pane.id === tabId);
        });
        
        // Load data on tab click
        if (tabId === 'logs') { loadStudentPlans(); loadTrainingAnalytics(); }
        if (tabId === 'history') { loadSessionAnalytics(); }
        if (tabId === 'progression') { loadFitnessProgress(); loadWeightLogHistory(); }
        if (tabId === 'overview') { loadWorkoutConsistency(); }
    });

    // Keyboard Shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.altKey && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
            const key = e.key.toLowerCase();
            if (key === '1') window.location.hash = 'planner';
            if (key === '2') window.location.hash = 'logs';
            if (key === '3') window.location.hash = 'attendance';
            if (key === '4') window.location.hash = 'leaves';
            if (key === '5') window.location.hash = 'tips';
            if (key === '6') window.location.hash = 'fame';
        }
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
            e.preventDefault();
            document.getElementById('savePlanBtn')?.click();
        }
    });
    
    // --- Initial Data Loading ---
    getStudentSession();      // Load user data and triggers other loads
    initializeWeekPicker(); // Setup the attendance calendar
    routeFromHash();          // Route to the correct section based on URL hash
    window.addEventListener('hashchange', routeFromHash); // Listen for hash changes
});

