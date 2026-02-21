import { loadHallOfFameData } from './hallOfFame.js';
import { loadLeaveData } from './leaves.js';
import { loadOverviewAnalytics, loadWorkoutConsistency } from './analysis.js'; 
import { loadTipsSection } from './tips.js';
import { loadWeightLogHistory, loadFitnessProgress } from './progression.js';

/**
 * Programmatically switches the dashboard view to a specific section.
 */
export function navigateToSection(targetSectionId) {
    // --- RESTRICTION CHECK ---
    // Prevent non-members/inactive users from accessing functional gym sections
    const restrictedSections = ['attendance-low', 'leaves-low'];
    const isRestricted = document.body.classList.contains('is-inactive');

    if (isRestricted && restrictedSections.includes(targetSectionId)) {
        console.warn(`Access to ${targetSectionId} is restricted.`);
        window.location.hash = 'planner';
        return;
    }

    // --- THIS IS THE FIX ---
    // The main nav list is no longer .navbar, it's .main-nav-list
    const mainNav = document.querySelector('.main-nav-list'); 
    // --- END OF FIX ---
    
    const contentSections = document.querySelectorAll('.content .card');
    
    // The querySelector now correctly runs on mainNav
    if (!mainNav) return; // Failsafe
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
        import('./fitness.js').then(mod => {
            mod.showFitnessTab('overview');
        });
    }
if (targetSectionId === 'tips-low') {
    // initialize tips UI, tabs and loaders
    try {
        loadTipsSection();
    } catch (err) {
        console.error('Error initializing tips section:', err);
    }
}
}

/**
 * Reads the URL hash and routes to the correct section and sub-tab.
 */
export function routeFromHash() {
    let hash = window.location.hash.replace('#', '') || 'planner';
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
    
    const targetSectionId = map[mainHash] || 'planner-low';
    
    navigateToSection(targetSectionId); 

    if (subTab) {
        const tabLink = document.querySelector(`.tab-nav .tab-link[data-tab="${subTab}"]`);
        if (tabLink) {
            tabLink.click();
        }
    }

    // 🔥 When user opens the progression tab, always reload weight logs fresh
    if (subTab === 'progression') {
        import('./progression.js').then(mod => {
            mod.loadWeightLogHistory(true);
            mod.loadFitnessProgress();
            mod.loadCurrentWeightStat(true);
        });
    }

}
