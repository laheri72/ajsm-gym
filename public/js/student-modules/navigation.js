import { loadHallOfFameData } from './hallOfFame.js';
import { loadLeaveData } from './leaves.js';
import { loadOverviewAnalytics, loadWorkoutConsistency } from './analysis.js'; 
import { loadTipsSection } from './tips.js';
import { loadWeightLogHistory, loadFitnessProgress } from './progression.js';

// Cache flags to prevent redundant API calls
let cache = {
    fame: false,
    leaves: false,
    analysis: false,
    fitness: false,
    tips: false
};

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
    if (targetSectionId === 'fame-low' && !cache.fame) {
        loadHallOfFameData();
        cache.fame = true;
    }
    if (targetSectionId === 'leaves-low' && !cache.leaves) {
        loadLeaveData();
        cache.leaves = true;
    }
    if (targetSectionId === 'logs-low') {
        if (!cache.analysis) {
            loadOverviewAnalytics();
            loadWorkoutConsistency();
            cache.analysis = true;
        }
        loadWeightLogHistory();     // ⬅️ Always reload from cache or fresh
        loadFitnessProgress(); 
    }
    if (targetSectionId === 'fitness-low') {
        import('./fitness.js').then(mod => {
            if (!cache.fitness) {
                cache.fitness = true;
                mod.initializeFitness().catch(console.error);
            }
            mod.showFitnessTab(fitnessTab);
        });
    }
    if (targetSectionId === 'attendance-low') {
        import('./attendance.js').then(mod => {
            mod.loadAttendanceHero();
        });
    }
    if (targetSectionId === 'tips-low' && !cache.tips) {
        try {
            loadTipsSection();
            import('./planner.js').then(mod => {
                mod.exerciseModule.renderWorkoutList();
            });
            cache.tips = true;
        } catch (err) {
            console.error('Error initializing tips section:', err);
        }
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
