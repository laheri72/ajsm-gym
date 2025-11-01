import { setStudentAuthData, setStudentHeight } from './state.js';

/**
 * Updates all XP bar UI elements with the student's current level and XP.
 */
export function updateXPBarUI(level, xp) {
    const xpForNextLevel = level * 100;
    const progressPercent = Math.min((xp / xpForNextLevel) * 100, 100);
    
    // Find the two headers
    const appHeader = document.querySelector('.app-header-main');
    const infoHeader = document.querySelector('.app-header-info');
    const bodyElement = document.body;
    
    const rankTag = document.getElementById('rankTag');
    
    let tierClass = 'xp-tier-bronze';
    let rankName = 'Challenger';
    if (level < 5) { rankName = 'Rookie'; }
    if (level >= 10) { tierClass = 'xp-tier-silver'; rankName = 'Athlete'; }
    if (level >= 20) { tierClass = 'xp-tier-gold'; rankName = 'Pro'; }
    if (level >= 30) { tierClass = 'xp-tier-emerald'; rankName = 'Elite'; }

    const tierClasses = ['xp-tier-bronze', 'xp-tier-silver', 'xp-tier-gold', 'xp-tier-emerald'];
    
    // Apply classes to all three elements
    if (appHeader) {
        appHeader.classList.remove(...tierClasses, 'loading-theme');
        appHeader.classList.add(tierClass);
    }
    if (infoHeader) {
        infoHeader.classList.remove(...tierClasses, 'loading-theme');
        infoHeader.classList.add(tierClass);
    }
    if (bodyElement) {
        bodyElement.classList.remove(...tierClasses);
        bodyElement.classList.add(tierClass);
    }

    if (rankTag) {
        rankTag.textContent = rankName;
        rankTag.className = `rank-tag`; // Reset classes
    }

    // Header Bar
    document.getElementById('fitnessLevel').textContent = level;
    document.getElementById('xpBarFill').style.width = `${progressPercent}%`;
    document.getElementById('xpBarText').textContent = `${xp} / ${xpForNextLevel} XP`;
}

/**
 * Displays a celebratory "Level Up!" animation.
 * After the user clicks "Let's Go!", it saves the new level to localStorage.
 */
export async function showLevelUpAnimation(newLevel) {
    let tierClass = '';
    if (newLevel >= 10 && newLevel < 20) tierClass = 'swal-tier-silver';
    if (newLevel >= 20 && newLevel < 30) tierClass = 'swal-tier-gold';
    if (newLevel >= 30) tierClass = 'swal-tier-emerald';

    // 1. Await the modal
    const result = await Swal.fire({
        title: 'LEVEL UP!',
        html: `
            <div class="level-up-animation">
                <span class="level-up-number">${newLevel}</span>
            </div>
            <h3 class="level-up-title">You've reached Level ${newLevel}!</h3>
            <p class="level-up-text">Your hard work is paying off. Keep pushing!</p>
        `,
        customClass: {
            popup: tierClass
        },
        background: '#2c3e50',
        showConfirmButton: true,
        confirmButtonText: 'Let\'s Go!',
        confirmButtonColor: '#4CAF50',
        allowOutsideClick: false // Prevents skipping
    });

    // 2. After the user clicks "Let's Go!" (or closes it)
    if (result.isConfirmed || result.isDismissed) {
        // THEN save the new level
        localStorage.setItem('lastSeenLevel', newLevel);
    }
}

export function showXpInfoModal() {
    const level = parseInt(document.getElementById('fitnessLevel').textContent || '1');
    const currentXP = parseInt(document.getElementById('xpBarText').textContent.split(' / ')[0] || '0');
    const xpForNextLevel = level * 100;
    const xpNeeded = xpForNextLevel - currentXP;

    const html = `
        <div class="xp-modal-content">
            <div class="xp-modal-header">
                <h3>How to Level Up</h3>
                <p>Leveling up unlocks new header themes and bragging rights! Here's how you earn XP.</p>
            </div>
            <ul class="xp-earning-list">
                <li><span class="xp-icon">⏱️</span><span class="xp-action">Time in Gym</span><span class="xp-value">10 XP / minute</span></li>
                <li><span class="xp-icon">💪</span><span class="xp-action">Body Part Logged</span><span class="xp-value">10 XP / part</span></li>
                <li><span class="xp-icon">🏆</span><span class="xp-action">Earn a New Badge</span><span class="xp-value">250 XP</span></li>
                <li><span class="xp-icon">📋</span><span class="xp-action">Complete Fitness Test</span><span class="xp-value">500 XP</span></li>
                <li><span class="xp-icon">🧑‍🏫</span><span class="xp-action">Trainer-led Fitness Test</span><span class="xp-value">750 XP</span></li>
            </ul>
            <div class="xp-modal-footer">
                <h4>Your Next Level</h4>
                <p>You are <strong>Level ${level}</strong>. You need <strong>${xpNeeded} XP</strong> to reach Level ${level + 1}.</p>
                <div class="mini-xp-bar-wrapper"><div class="mini-xp-bar-fill" style="width: ${(currentXP / xpForNextLevel) * 100}%;"></div></div>
                <p class="xp-formula">Leveling up costs <strong>(Current Level x 100) XP</strong>.</p>
            </div>
        </div>
    `;

    Swal.fire({
        title: '💎 XP & Leveling Guide',
        html: html,
        width: '600px',
        showCloseButton: true,
        showConfirmButton: false,
        customClass: { popup: 'xp-info-popup' }
    });
}

/**
 * Shows the "Today's Leaderboard" toast notification.
 */
export async function showLeaderboard() {
    try {
        const res = await fetch('/api/leaderboard');
        const result = await res.json();
        
        if (result.success && result.data.length > 0) {
            const listElement = document.getElementById('leaderboard-list');
            const toastElement = document.getElementById('leaderboard-toast');
            
            listElement.innerHTML = ''; // Clear previous entries
            const medals = ['🥇', '🥈', '🥉'];
            
            result.data.forEach((student, index) => {
                const rank_medal = medals[index] || '•';
                const li = `<li>${rank_medal} ${student.Name}</li>`;
                listElement.insertAdjacentHTML('beforeend', li);
            });

            toastElement.classList.add('show');
            setTimeout(() => {
                toastElement.classList.remove('show');
            }, 3000);
        }
    } catch (err) {
        console.error("Could not load leaderboard:", err);
    }
}