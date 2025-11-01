/**
 * Initializes all Bootstrap Popovers in the new header.
 * This powers the Welcome Info and Rank Roadmap hover cards.
 */
export function initializeHeaderPopovers() {
    
    // 1. Initialize the Brand/Welcome Info Popover
    // This now reads the data-bs-content attribute set by getStudentSession
    const brandTrigger = document.getElementById('brand-info-trigger');
    if (brandTrigger) {
        new bootstrap.Popover(brandTrigger, {
            placement: 'bottom',
            html: true, // Allows the <br> tag to work
            customClass: 'header-popover'
            // No 'content' needed here, it reads from data-bs-content
        });
    }

    // 2. Initialize the Rank Roadmap Popover
    const rankTrigger = document.getElementById('rankTag');
    if (rankTrigger) {
        // This now runs AFTER updateXPBarUI, so the level text is correct
        const level = parseInt(document.getElementById('fitnessLevel').textContent || '1');
        
        const roadmapHTML = `
            <ul class="rank-roadmap-list">
                <li class="${level < 10 ? 'active-rank rank-bronze' : 'rank-bronze'}">
                    LVL 1-9: Rookie / Challenger
                </li>
                <li class="${(level >= 10 && level < 20) ? 'active-rank rank-silver' : 'rank-silver'}">
                    LVL 10-19: Athlete
                </li>
                <li class="${(level >= 20 && level < 30) ? 'active-rank rank-gold' : 'rank-gold'}">
                    LVL 20-29: Pro
                </li>
                <li class="${level >= 30 ? 'active-rank rank-emerald' : 'rank-emerald'}">
                    LVL 30+: Elite
                </li>
            </ul>
        `;
        
        new bootstrap.Popover(rankTrigger, {
            placement: 'bottom',
            html: true,
            content: roadmapHTML,
            customClass: 'header-popover'
        });
    }
}