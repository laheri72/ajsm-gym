document.addEventListener('DOMContentLoaded', () => {
    loadOverviewStats();
});

/**
 * Fetches and displays the statistics for the overview page.
 */
async function loadOverviewStats() {
    try {
        const res = await fetch('/api/overview-stats');
        const stats = await res.json();
        if (stats.success) {
            document.getElementById('stat-active-students').textContent = stats.data.activeStudents;
            document.getElementById('stat-inactive-students').textContent = stats.data.inactiveStudents;
            document.getElementById('stat-waiting-list').textContent = stats.data.waitingList;
            document.getElementById('stat-slots').textContent = stats.data.slots;
            document.getElementById('stat-todays-logs').textContent = stats.data.todaysLogs;
            document.getElementById('stat-fitness-tests').textContent = stats.data.fitnessTests;
            document.getElementById('stat-users').textContent = stats.data.users;
        }
    } catch (err) {
        console.error("Failed to load overview stats:", err);
        // You could update the UI to show an error message in the cards
    }
}