const delay = (ms) => new Promise(res => setTimeout(res, ms));
/* =================================================================== */
/* STUDENT DASHBOARD - MAIN ENTRY POINT
/* =================================================================== */

// Import all functional modules
import { initializeHeaderPopovers } from './student-modules/new-header.js';
import { getStudentSession, handleInitialPasswordSet, logout, handleGoalUpdate } from './student-modules/auth.js';
import { showXpInfoModal } from './student-modules/gamification.js';
import { navigateToSection, routeFromHash } from './student-modules/navigation.js';
import { handleWeightLogSubmit, handleWeightLogDelete, loadFitnessProgress, loadWeightLogHistory } from './student-modules/progression.js';
import { initializeWeekPicker } from './student-modules/attendance.js';

import { loadStudentPlans, loadTrainingAnalytics, loadHistoryAnalytics, loadWorkoutConsistency, loadOverviewAnalytics, applyChartTheme } from './student-modules/analysis.js';
import { loadLeaveData, handleLeaveSubmit, handleLeaveCancel, initLeaveUX } from './student-modules/leaves.js';
import { loadBodyPartTips } from './student-modules/tips.js';
import { initializeFitness, showFitnessTab } from './student-modules/fitness.js';
import {
    savePlan, clearPlanner, applyLastWeeksPlan, openQuickAddDialog,
    initializePlannerInteractions, autoFillWeek, reuseBestWeekday,
    applyLastCompletedMonday, smartFillToday, exerciseModule, addExerciseToCard
} from './student-modules/planner.js';

/* =================================================================== */
/* MOBILE NAVBAR COLLAPSE HANDLER
/* =================================================================== */
const closeMobileMenu = async () => {
    const collapseElement = document.getElementById('mainNavCollapse');
    if (collapseElement && collapseElement.classList.contains('show')) {
        const bsCollapse = bootstrap.Collapse.getOrCreateInstance(collapseElement);
        bsCollapse.hide();
        await delay(300);
    }
};
// Make available globally
window.closeMobileMenu = closeMobileMenu;

/* =================================================================== */
/* DOM CONTENT LOADED
/* =================================================================== */
document.addEventListener('DOMContentLoaded', () => {
    // --- Setup Event Listeners ---
    document.getElementById('xpInfoBtn').addEventListener('click', showXpInfoModal);

    document.getElementById('logoutBtn').addEventListener('click', async (e) => {
        await closeMobileMenu();
        logout(e);
    });

    document.getElementById('updateGoalBtn')?.addEventListener('click', handleGoalUpdate);
    document.getElementById('snapshotUpdateGoalBtn')?.addEventListener('click', handleGoalUpdate);

    // --- Theme Toggle ---
    const rootEl = document.documentElement;
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') rootEl.setAttribute('data-theme', 'dark');
    const themeToggleBtn = document.getElementById('themeToggleBtn');

    if (themeToggleBtn) {
        themeToggleBtn.innerHTML = rootEl.getAttribute('data-theme') === 'dark'
            ? '<i class="bi bi-brightness-high"></i>'
            : '<i class="bi bi-moon-stars"></i>';

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
            closeMobileMenu();
        });
    }

    // Init Bootstrap Tooltips
    const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
    tooltipTriggerList.map(el => new bootstrap.Tooltip(el));

    // --- Leave Management ---
    initLeaveUX(); // Flatpickr + window badge + reason chips
    document.getElementById('leaveRequestForm').addEventListener('submit', handleLeaveSubmit);
    document.querySelector('#leaveStatusTable tbody').addEventListener('click', handleLeaveCancel);

    // --- Planner ---
    // Note: Magic fill buttons (autofill, reuse, etc.) and Clear/Save are now handled inside planner.js bindPlannerEvents()
    document.querySelectorAll('.quick-add-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const day = btn.dataset.day || document.getElementById('today-day-card').dataset.day;
            openQuickAddDialog(day);
        });
    });
    document.getElementById('today-autofill-btn')?.addEventListener('click', smartFillToday);
    initializePlannerInteractions();

    // --- Planner View Toggle ---
    const plannerViewToggle = document.getElementById('plannerViewToggle');
    plannerViewToggle.addEventListener('change', () => {
        const isWeekly = plannerViewToggle.checked;
        document.getElementById('daily-view').style.display = isWeekly ? 'none' : 'block';
        document.getElementById('weekly-view').style.display = isWeekly ? 'block' : 'none';
    });

    // --- Progression (Weight Logging) ---
    document.getElementById('weightLogForm').addEventListener('submit', handleWeightLogSubmit);
    document.getElementById('weightHistoryBody').addEventListener('click', handleWeightLogDelete);
    document.getElementById('log-weight-shortcut').addEventListener('click', (e) => {
        e.preventDefault();
        window.location.hash = 'logs&tab=progression';
    });

    // --- Tips ---
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

    // --- Analytics Tabs ---
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
        if (tabId === 'history') { loadHistoryAnalytics(); }
        if (tabId === 'overview') { loadOverviewAnalytics(); loadWorkoutConsistency(); }
    });

    // --- Keyboard Shortcuts ---
    document.addEventListener('keydown', (e) => {
         if (e.altKey && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
             const key = e.key.toLowerCase();
             if (key === '1') window.location.hash = 'planner';
             if (key === '2') window.location.hash = 'logs';
             if (key === '3') window.location.hash = 'attendance';
             if (key === '4') window.location.hash = 'leaves';
             if (key === '5') window.location.hash = 'tips';
             if (key === '6') window.location.hash = 'fame';
             if (key === '7') window.location.hash = 'fitness';
         }
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
            e.preventDefault();
            savePlan();
        }
    });

    // --- Final working collapsible toggler with smart dropdown handling ---
const toggler = document.querySelector('.navbar-toggler');
const collapseElement = document.getElementById('mainNavCollapse');

if (toggler && collapseElement) {
    const bsCollapse = bootstrap.Collapse.getOrCreateInstance(collapseElement, { toggle: false });

    toggler.addEventListener('click', () => {
        // toggle open/close
        if (collapseElement.classList.contains('show')) {
            bsCollapse.hide();
        } else {
            bsCollapse.show();
        }
    });

    // Close when clicking non-dropdown nav links
    collapseElement.querySelectorAll('a.nav-link:not(.dropdown-toggle)').forEach(link => {
        link.addEventListener('click', () => bsCollapse.hide());
    });

    // Close menu after selecting a dropdown item (navigation happens)
    collapseElement.querySelectorAll('.dropdown-item').forEach(item => {
        item.addEventListener('click', (e) => {
            // Delay close to allow navigation to process
            setTimeout(() => bsCollapse.hide(), 150);
        });
    });
}


    // --- Initial Data Loading ---
    getStudentSession();
    initializeWeekPicker();
    initializeFitness();
    exerciseModule.renderWorkoutList();
    routeFromHash();
    window.addEventListener('hashchange', routeFromHash);
    
});
