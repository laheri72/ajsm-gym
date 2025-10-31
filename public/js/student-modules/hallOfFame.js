/**
 * Main function to load all data for the Hall of Fame section.
 */
export async function loadHallOfFameData() {
    await Promise.all([
        loadAchievementLeaderboard(),
        loadStudentAchievements(),
        loadAchievementProgress()
    ]);
}

/**
 * Fetches and renders the main achievement leaderboard.
 */
async function loadAchievementLeaderboard() {
    const listElement = document.getElementById('achievementLeaderboardList');
    listElement.innerHTML = '<li class="loading">Loading Leaderboard...</li>';
    try {
        const res = await fetch('/api/achievements/leaderboard', { credentials: 'include' });
        const result = await res.json();
        
        if (result.success && result.data.length > 0) {
            listElement.innerHTML = '';
            const medals = ['🥇', '🥈', '🥉'];
            
            result.data.forEach((player, index) => {
                const li = document.createElement('li');
                li.innerHTML = `
                    <div class="rank">${medals[index] || index + 1}</div>
                    <div class="name">${player.Name}</div>
                    <div class="score">${player.TotalAchievements} Badges</div>
                `;
                listElement.appendChild(li);
            });
        } else {
            listElement.innerHTML = '<li class="loading">No leaderboard data available yet.</li>';
        }
    } catch (err) {
        console.error("Could not load achievement leaderboard:", err);
        listElement.innerHTML = '<li class="loading">Error loading leaderboard.</li>';
    }
}

/**
 * Fetches and renders the student's earned achievements.
 */
async function loadStudentAchievements() {
    const gridElement = document.getElementById('achievementsGrid');
    gridElement.innerHTML = '<div class="loading">Loading your achievements...</div>';
    try {
        const res = await fetch('/api/student/achievements', { credentials: 'include' });
        const result = await res.json();

        if (result.success && result.data.length > 0) {
            gridElement.innerHTML = '';
            const earnedBadgeIDs = result.data.map(b => b.AchievementName);
            const seenBadges = JSON.parse(localStorage.getItem('seenBadges') || '[]');
            
            result.data.forEach(badge => {
                if (!seenBadges.includes(badge.AchievementName)) {
                    showBadgeUnlockAnimation(badge);
                }
                
                const badgeCard = document.createElement('div');
                badgeCard.className = 'badge-card';
                badgeCard.innerHTML = `
                    <div class="sparkle-wrapper"><img src="${badge.BadgeImageURL}" alt="${badge.AchievementName}" class="badge-image"></div>
                    <div class="badge-info">
                        <h5 class="badge-name">${badge.AchievementName}</h5>
                        <p class="badge-description">${badge.Description}</p>
                        <p class="badge-earned">Earned on: ${moment(badge.DateEarned).format('MMM D, YYYY')}</p>
                    </div>
                `;
                gridElement.appendChild(badgeCard);
            });
            
            localStorage.setItem('seenBadges', JSON.stringify(earnedBadgeIDs));

        } else {
            gridElement.innerHTML = '<div class="loading">You haven\'t earned any badges yet. Keep going!</div>';
        }
    } catch (err) {
        console.error("Could not load student achievements:", err);
        gridElement.innerHTML = '<div class="loading">Error loading your achievements.</div>';
    }
}

/**
 * Fetches and renders the live progress towards unearned achievements.
 */
async function loadAchievementProgress() {
    try {
        const res = await fetch('/api/student/achievements/progress', { credentials: 'include' });
        const result = await res.json();

        if (result.success) {
            const progress = result.data;
            
            // Consistency King
            let consistencyPercent = (progress.consistency.current / progress.consistency.target) * 100;
            document.getElementById('consistency-progress-fill').style.width = `${Math.min(consistencyPercent, 100)}%`;
            document.getElementById('current-streak').textContent = `${progress.consistency.current} / ${progress.consistency.target} Day Streak`;
            if(progress.consistency.personalBest > 0) {
                 document.getElementById('best-streak').textContent = `Best: ${progress.consistency.personalBest}`;
            }

            // Perfect 30 Days
            let monthPercent = (progress.perfectMonth.current / progress.perfectMonth.target) * 100;
            document.getElementById('perfect-month-progress-fill').style.width = `${Math.min(monthPercent, 100)}%`;
            document.getElementById('perfect-month-progress-text').textContent = (monthPercent >= 100)
                ? "Goal Met! Awaiting Sunday's Award"
                : `${progress.perfectMonth.current} / ${progress.perfectMonth.target} Days in last 30`;
            
            // Social Butterfly
            const { current, target } = progress.socialButterfly;
            let butterflyPercent = (current / target) * 100;
            document.getElementById('social-butterfly-progress-fill').style.width = `${Math.min(butterflyPercent, 100)}%`;
            document.getElementById('social-butterfly-progress-text').textContent = (butterflyPercent >= 100)
                ? `Weekly Score: ${current} / ${target} - Great work!`
                : `Weekly Score: ${current} / ${target}`;
            
            // Milestone Lift
            const { current_improvement, target_improvement, previous_score, current_score } = progress.milestoneLift;
            let milestonePercent = (current_improvement / target_improvement) * 100;
            document.getElementById('milestone-lift-progress-fill').style.width = `${Math.min(milestonePercent, 100)}%`;
            document.getElementById('milestone-lift-progress-text').textContent = (current_score === 'N/A')
                ? "Take 2+ tests to see progress"
                : `Prev: ${previous_score}, Current: ${current_score} (+${current_improvement.toFixed(1)}%)`;

            // Iron Dedication
            const { current: dedicationHours, target: dedicationTarget, tierName, completed } = progress.ironDedication;
            if (completed) {
                document.getElementById('iron-dedication-fill').style.width = '100%';
                document.getElementById('iron-dedication-text').textContent = `All Tiers Completed! (${dedicationHours.toFixed(1)} Hours)`;
                document.getElementById('iron-dedication-img').src = '/images/badges/dedication-gold.png';
            } else {
                let dedicationPercent = (dedicationHours / dedicationTarget) * 100;
                document.getElementById('iron-dedication-fill').style.width = `${Math.min(dedicationPercent, 100)}%`;
                document.getElementById('iron-dedication-text').textContent = `${dedicationHours.toFixed(1)} / ${dedicationTarget} Hours toward ${tierName}`;
                document.getElementById('iron-dedication-img').src = `/images/badges/dedication-${tierName.toLowerCase()}.png`;
            }
        }
    } catch (err) {
        console.error("Could not load achievement progress:", err);
    }
}

/**
 * Shows the "Badge Unlocked" modal.
 */
function showBadgeUnlockAnimation(badge) {
    Swal.fire({
        title: 'BADGE UNLOCKED!',
        html: `
            <div class="badge-unlocked-animation">
                <img src="${badge.BadgeImageURL}" alt="${badge.AchievementName}" class="badge-unlocked-image">
            </div>
            <h3 style="color:#00FFEA; margin-top:1rem;">${badge.AchievementName}</h3>
            <p style="color:#bdc3c7;">${badge.Description}</p>
        `,
        background: '#2c3e50',
        color: '#ffffff',
        showConfirmButton: true,
        confirmButtonText: 'Awesome!',
        confirmButtonColor: '#4CAF50'
    });
}