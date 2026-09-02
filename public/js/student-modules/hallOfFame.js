import { studentTR } from './state.js';

/* ================================================================
   🚀 Main Loader
================================================================ */
export function loadHallOfFameData() {
  initHallOfFameTabs();
  loadAchievementProgress?.();
  loadAchievementLeaderboard?.();
  loadStudentAchievements?.();
}

/**
 * Fetches and renders the main achievement leaderboard.
 */
async function loadAchievementLeaderboard() {
    const listElement = document.getElementById('achievementLeaderboardList');
    if (!listElement) return;
    listElement.innerHTML = '<li class="loading">Loading Leaderboard...</li>';
    try {
        const res = await fetch('/api/achievements/leaderboard', { credentials: 'include' });
        const result = await res.json();
        
        if (result.success && result.data && result.data.length > 0) {
            listElement.innerHTML = '';
            const medals = ['🥇', '🥈', '🥉'];
            let prevRank = 0;
            
            result.data.forEach((player, index) => {
                const rankNum = Number(player.Rank) || (index + 1);
                const isCurrentUser = Boolean(player.IsCurrentUser || (studentTR && player.TR === studentTR));
                const badges = Number(player.TotalAchievements) || 0;
                const level = Number(player.FitnessLevel) || 1;
                const currentXP = Number(player.CurrentXP) || 0;
                const nextLevelXP = Number(player.NextLevelXP) || level * 100;
                const totalXP = Number(player.TotalXP) || currentXP;
                const xpProgress = nextLevelXP > 0 ? Math.min((currentXP / nextLevelXP) * 100, 100) : 0;

                // If there is a rank gap (e.g., student is rank #18 after rank #10)
                if (prevRank > 0 && rankNum > prevRank + 1) {
                    const divider = document.createElement('li');
                    divider.className = 'leaderboard-gap-divider';
                    divider.innerHTML = `
                        <div class="gap-line"></div>
                        <span class="gap-dots"><i class="bi bi-three-dots"></i></span>
                        <div class="gap-line"></div>
                    `;
                    listElement.appendChild(divider);
                }
                prevRank = rankNum;

                const rankDisplay = (rankNum <= 3) ? (medals[rankNum - 1] || `#${rankNum}`) : `#${rankNum}`;
                const youBadge = isCurrentUser ? `<span class="hof-you-badge"><i class="bi bi-person-fill"></i> YOU</span>` : '';

                const li = document.createElement('li');
                li.className = `achievement-leaderboard-item ${isCurrentUser ? 'is-current-user' : ''}`;
                li.innerHTML = `
                    <div class="rank hof-rank rank-${rankNum <= 3 ? rankNum : 'other'}">${rankDisplay}</div>
                    <div class="hof-player">
                        <div class="name hof-name">
                            <span class="player-name-text">${escapeHtml(player.Name || 'Student')}</span>
                            ${youBadge}
                        </div>
                        <div class="hof-metrics" aria-label="Achievement leaderboard score">
                            <span class="hof-pill">${badges} Badges</span>
                            <span class="hof-pill">Level ${level}</span>
                            <span class="hof-pill">${totalXP} XP</span>
                        </div>
                    </div>
                    <div class="hof-xp">
                        <div class="hof-xp-label">${currentXP}/${nextLevelXP} XP</div>
                        <div class="hof-xp-track" aria-hidden="true">
                            <div class="hof-xp-fill" style="width: ${xpProgress}%"></div>
                        </div>
                    </div>
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

function escapeHtml(value) {
    return String(value || '').replace(/[&<>"']/g, char => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    }[char]));
}

/**
 * Fetches and renders the student's earned achievements.
 */
async function loadStudentAchievements() {
    const gridElement = document.getElementById('achievementsGrid');
    if (!gridElement) return;
    gridElement.innerHTML = '<div class="loading">Loading your achievements...</div>';
    try {
        const res = await fetch('/api/student/achievements', { credentials: 'include' });
        const result = await res.json();

        if (result.success && result.data && result.data.length > 0) {
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
                    <div class="sparkle-wrapper"><img src="${badge.BadgeImageURL}" alt="${escapeHtml(badge.AchievementName)}" class="badge-image"></div>
                    <div class="badge-info">
                        <h5 class="badge-name">${escapeHtml(badge.AchievementName)}</h5>
                        <p class="badge-description">${escapeHtml(badge.Description)}</p>
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

        if (result.success && result.data) {
            const progress = result.data;
            
            // Consistency King
            if (progress.consistency) {
                let consistencyPercent = (progress.consistency.current / progress.consistency.target) * 100;
                const fillEl = document.getElementById('consistency-progress-fill');
                const streakEl = document.getElementById('current-streak');
                const bestEl = document.getElementById('best-streak');
                if (fillEl) fillEl.style.width = `${Math.min(consistencyPercent, 100)}%`;
                if (streakEl) streakEl.textContent = `${progress.consistency.current} / ${progress.consistency.target} Day Streak`;
                if (bestEl && progress.consistency.personalBest > 0) {
                    bestEl.textContent = `Best: ${progress.consistency.personalBest}`;
                }
            }

            // Perfect 30 Days
            if (progress.perfectMonth) {
                let monthPercent = (progress.perfectMonth.current / progress.perfectMonth.target) * 100;
                const monthFill = document.getElementById('perfect-month-progress-fill');
                const monthText = document.getElementById('perfect-month-progress-text');
                if (monthFill) monthFill.style.width = `${Math.min(monthPercent, 100)}%`;
                if (monthText) {
                    monthText.textContent = (monthPercent >= 100)
                        ? "Goal Met! Awaiting Sunday's Award"
                        : `${progress.perfectMonth.current} / ${progress.perfectMonth.target} Days in last 30`;
                }
            }
            
            // Social Butterfly
            if (progress.socialButterfly) {
                const { current, target } = progress.socialButterfly;
                let butterflyPercent = (current / target) * 100;
                const bfFill = document.getElementById('social-butterfly-progress-fill');
                const bfText = document.getElementById('social-butterfly-progress-text');
                if (bfFill) bfFill.style.width = `${Math.min(butterflyPercent, 100)}%`;
                if (bfText) {
                    bfText.textContent = (butterflyPercent >= 100)
                        ? `Weekly Score: ${current} / ${target} - Great work!`
                        : `Weekly Score: ${current} / ${target}`;
                }
            }
            
            // Milestone Lift
            if (progress.milestoneLift) {
                const { current_improvement, target_improvement, previous_score, current_score } = progress.milestoneLift;
                let milestonePercent = (current_improvement / target_improvement) * 100;
                const mlFill = document.getElementById('milestone-lift-progress-fill');
                const mlText = document.getElementById('milestone-lift-progress-text');
                if (mlFill) mlFill.style.width = `${Math.min(milestonePercent, 100)}%`;
                if (mlText) {
                    mlText.textContent = (current_score === 'N/A')
                        ? "Take 2+ tests to see progress"
                        : `Prev: ${previous_score}, Current: ${current_score} (+${current_improvement.toFixed(1)}%)`;
                }
            }

            // Iron Dedication
            if (progress.ironDedication) {
                const { current: dedicationHours, target: dedicationTarget, tierName, completed } = progress.ironDedication;
                const idFill = document.getElementById('iron-dedication-fill');
                const idText = document.getElementById('iron-dedication-text');
                const idImg = document.getElementById('iron-dedication-img');
                if (completed) {
                    if (idFill) idFill.style.width = '100%';
                    if (idText) idText.textContent = `All Tiers Completed! (${dedicationHours.toFixed(1)} Hours)`;
                    if (idImg) idImg.src = '/images/badges/dedication-gold.png';
                } else {
                    let dedicationPercent = (dedicationHours / dedicationTarget) * 100;
                    if (idFill) idFill.style.width = `${Math.min(dedicationPercent, 100)}%`;
                    if (idText) idText.textContent = `${dedicationHours.toFixed(1)} / ${dedicationTarget} Hours toward ${tierName}`;
                    if (idImg) idImg.src = `/images/badges/dedication-${tierName.toLowerCase()}.png`;
                }
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
                <img src="${badge.BadgeImageURL}" alt="${escapeHtml(badge.AchievementName)}" class="badge-unlocked-image">
            </div>
            <h3 style="color:#00FFEA; margin-top:1rem;">${escapeHtml(badge.AchievementName)}</h3>
            <p style="color:#bdc3c7;">${escapeHtml(badge.Description)}</p>
        `,
        background: '#2c3e50',
        color: '#ffffff',
        showConfirmButton: true,
        confirmButtonText: 'Awesome!',
        confirmButtonColor: '#4CAF50'
    });
}

/* ================================================================
   🧭 Hall of Fame Sub-Tabs (same logic as Analysis)
================================================================ */

export function initHallOfFameTabs() {
  const tabLinks = document.querySelectorAll('#fame-low .tab-link');
  const tabPanes = document.querySelectorAll('#fame-low .tab-pane');

  if (!tabLinks.length) return;

  tabLinks.forEach(link => {
    link.addEventListener('click', () => {
      const tabName = link.getAttribute('data-tab');

      // Active visual
      tabLinks.forEach(l => l.classList.remove('active'));
      link.classList.add('active');
      tabPanes.forEach(p => p.classList.remove('active'));
      document.querySelector(`#tab-${tabName}`)?.classList.add('active');

      // Update URL hash (for nav.js sync)
      const currentHash = window.location.hash.split('&')[0];
      window.location.hash = `${currentHash}&tab=${tabName}`;

      // Load proper data
      switch (tabName) {
        case 'progress':
          loadAchievementProgress?.();
          break;
        case 'leaderboard':
          loadAchievementLeaderboard?.();
          break;
        case 'badges':
          loadStudentAchievements?.();
          break;
        case 'today':
          populateTodayLeaderboard?.();
          break;
      }
    });
  });
}

/* ================================================================
   🏁 TODAY'S LEADERBOARD (Reuses /api/leaderboard route)
================================================================ */
export async function populateTodayLeaderboard() {
  const list = document.getElementById('todayLeaderboardList');
  if (!list) return;
  
  list.innerHTML = '<li class="loading">Loading...</li>';

  try {
    const res = await fetch('/api/leaderboard');
    const result = await res.json();

    if (result.success && result.data && result.data.length > 0) {
      const medals = ['🥇', '🥈', '🥉'];
      list.innerHTML = '';

      result.data.forEach((student, index) => {
        const medal = medals[index] || `#${index + 1}`;
        const isCurrentUser = Boolean(studentTR && student.TR === studentTR);
        const youBadge = isCurrentUser ? `<span class="hof-you-badge ms-2"><i class="bi bi-person-fill"></i> YOU</span>` : '';
        const li = `
          <li class="${isCurrentUser ? 'is-current-user' : ''}">
            <span class="rank">${medal}</span>
            <span class="name">${escapeHtml(student.Name)} ${youBadge}</span>
            <span class="score">${student.Score || 0} mins</span>
          </li>`;
        list.insertAdjacentHTML('beforeend', li);
      });
    } else {
      list.innerHTML = '<li>No leaderboard data available today.</li>';
    }
  } catch (err) {
    console.error('Error loading today leaderboard:', err);
    list.innerHTML = '<li>Error loading data.</li>';
  }
}
