import { loadHallOfFameData } from './hallOfFame.js';
import { loadLeaveData } from './leaves.js';
import { loadOverviewAnalytics, loadWorkoutConsistency } from './analysis.js'; 
import { loadTipsSection } from './tips.js';
import { loadWeightLogHistory, loadFitnessProgress, loadCurrentWeightStat } from './progression.js';
import { initializeFitness, showFitnessTab } from './fitness.js';
import { loadAttendanceHero } from './attendance.js';
import { loadWeeklyPlan, loadPlannerInsights, exerciseModule } from './planner.js';
import { loadDashboardStats } from './dashboard.js';

/**
 * Programmatically switches the dashboard view to a specific section.
 */
export function navigateToSection(targetSectionId, fitnessTab = 'overview') {
    // --- RESTRICTION CHECK ---
    // Prevent non-members/inactive users from accessing functional gym sections
    const restrictedSections = ['planner-low','logs-low','attendance-low','leaves-low','tips-low','fame-low'];
    const isRestricted = document.body.classList.contains('is-inactive');

    if (isRestricted && restrictedSections.includes(targetSectionId)) {
        console.warn(`Access to ${targetSectionId} is restricted.`);
        window.location.hash = 'fitness';
        return;
    }

    const mainNav = document.querySelector('.main-nav-list'); 
    const contentSections = document.querySelectorAll('.content .card');
    
    if (!mainNav) return; 
    const targetLink = mainNav.querySelector(`[data-target="${targetSectionId}"]`);

    if (!targetLink) return;

    // Update nav link states
    mainNav.querySelectorAll('.nav-link').forEach(a => a.classList.remove('active'));
    targetLink.classList.add('active');

    // Update section visibility
    contentSections.forEach(section => {
        section.style.display = (section.id === targetSectionId) ? 'block' : 'none';
    });

    // Trigger data loading for the new section if needed
    if (targetSectionId === 'fame-low') {
        loadHallOfFameData();
    }
    if (targetSectionId === 'leaves-low') {
        loadLeaveData();
    }
    if (targetSectionId === 'logs-low') {
        loadOverviewAnalytics();
        loadWorkoutConsistency();
        loadWeightLogHistory();     // ⬅️ Always reload from cache or fresh
        loadFitnessProgress(); 
    }
    if (targetSectionId === 'fitness-low') {
        initializeFitness();
        showFitnessTab(fitnessTab);
    }
    if (targetSectionId === 'attendance-low') {
        loadAttendanceHero(true);
    }
    if (targetSectionId === 'planner-low') {
        loadDashboardStats();
        loadWeeklyPlan();
        loadPlannerInsights();
    }
    if (targetSectionId === 'tips-low') {
        loadTipsSection();
        exerciseModule.renderWorkoutList();
    }
}

/**
 * Reads the URL hash and routes to the correct section and sub-tab.
 */
export function routeFromHash() {
    let hash = window.location.hash.replace('#', '') || 'fitness';
    let mainHash = hash;
    let subTab = null;

    if (hash.includes('&tab=')) {
        const parts = hash.split('&tab=');
        mainHash = parts[0];
        subTab = parts[1];
    }

    const map = {
        planner: 'planner-low',
        logs: 'logs-low',
        attendance: 'attendance-low',
        fitness: 'fitness-low',
        leaves: 'leaves-low',
        tips: 'tips-low',
        fame: 'fame-low'
    }; 
    
    const targetSectionId = map[mainHash] || 'fitness-low';
    
    const fitnessTab = ['overview', 'test', 'evaluations', 'history'].includes(subTab) ? subTab : 'overview';
    navigateToSection(targetSectionId, fitnessTab);

    if (subTab && targetSectionId !== 'fitness-low') {
        const tabLink = document.querySelector(`#${targetSectionId} .tab-nav .tab-link[data-tab="${subTab}"]`);
        if (tabLink) {
            tabLink.click();
        }
    }

    // 🔥 When user opens the progression tab, always reload weight logs fresh
    if (subTab === 'progression') {
        loadWeightLogHistory(true);
        loadFitnessProgress();
        loadCurrentWeightStat(true);
    }
}
