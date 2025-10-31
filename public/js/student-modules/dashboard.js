/**
 * Fetches and displays key stats for the "Today" dashboard,
 * like the consistency streak.
 */
export async function loadDashboardStats() {
    try {
        const res = await fetch('/api/student/achievements/progress', { credentials: 'include' });
        const result = await res.json();

        if (result.success) {
            const progress = result.data;
            const consistency = progress.consistency;

            const currentStreak = consistency.current || 0;
            const personalBest = consistency.personalBest || 0; 

            document.getElementById('stat-current-streak').textContent = `${currentStreak} Days`;
            document.getElementById('stat-best-streak').textContent = `(Best: ${personalBest} Days)`;

            const progressPercent = (personalBest > 0) 
                ? Math.min((currentStreak / personalBest) * 100, 100) 
                : 0;

            const streakFill = document.getElementById('stat-streak-progress-fill');
            if (streakFill) {
                streakFill.style.width = `${progressPercent}%`;
            }

            const motivationText = document.getElementById('streak-motivation-text');
            if (currentStreak > 0) {
                if (currentStreak >= personalBest && personalBest > 0) {
                     motivationText.textContent = "You're on a new personal best streak!";
                } else if (personalBest > 0) {
                     motivationText.textContent = `You're ${progressPercent.toFixed(0)}% of your personal best!`;
                } else {
                     motivationText.textContent = "Great start! Keep it up!";
                }
            } else {
                 motivationText.textContent = "Start a new streak today!";
            }
        }
    } catch (err) {
        console.error("Could not load dashboard stats:", err);
    }
}