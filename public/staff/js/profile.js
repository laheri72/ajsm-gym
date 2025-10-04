// This is the complete and final profile.js file

document.addEventListener("DOMContentLoaded", () => {
    // --- Element References ---
    const searchInput = document.getElementById('studentSearchInput');
    const searchResults = document.getElementById('searchResults');
    const searchSection = document.getElementById('profile-search-section');
    const detailsSection = document.getElementById('profile-details-section');
    
    let debounceTimer;
    let fitnessChartInstance = null; // To destroy chart instances on tab switch

    // --- INITIAL PAGE LOAD ---
    const urlParams = new URLSearchParams(window.location.search);
    const trFromUrl = urlParams.get('tr');
    if (trFromUrl) {
        loadFullProfile(trFromUrl);
    }

    // --- SEARCH LOGIC ---
    searchInput.addEventListener('input', (e) => {
        const searchTerm = e.target.value.trim();
        clearTimeout(debounceTimer);
        if (searchTerm.length < 2) {
            searchResults.style.display = 'none';
            return;
        }
        debounceTimer = setTimeout(() => fetchStudents(searchTerm), 300);
    });

    async function fetchStudents(query) {
        try {
            const res = await fetch(`/api/staff/student-search?q=${encodeURIComponent(query)}`);
            const result = await res.json();
            renderSearchResults(result.success ? result.data : []);
        } catch (err) { console.error('Search fetch error:', err); }
    }

    function renderSearchResults(students) {
        searchResults.innerHTML = students.length === 0 
            ? '<div class="search-result-item">No students found.</div>'
            : students.map(s => `<div class="search-result-item" data-tr="${s.TR}"><span class="name">${s.Name}</span><span class="tr">(${s.TR})</span></div>`).join('');
        searchResults.style.display = 'block';
    }

    searchResults.addEventListener('click', (e) => {
        const targetItem = e.target.closest('.search-result-item');
        if (targetItem && targetItem.dataset.tr) {
            const tr = targetItem.dataset.tr;
            window.history.pushState({tr}, `Profile for ${tr}`, `?tr=${tr}`);
            loadFullProfile(tr);
        }
    });

    document.addEventListener('click', (e) => {
        if (!searchInput.contains(e.target)) searchResults.style.display = 'none';
    });

    // --- MAIN PROFILE LOADING & RENDERING ---
    async function loadFullProfile(tr) {
        searchSection.style.display = 'none';
        detailsSection.style.display = 'block';
        detailsSection.innerHTML = `<div class="card"><h2><div class="spinner-border text-primary" role="status"></div> Loading profile for TR: ${tr}...</h2></div>`;

        try {
            const res = await fetch(`/api/staff/student-profile/${tr}`);
            const result = await res.json();
            if (!result.success) throw new Error(result.message);
            
            detailsSection.innerHTML = document.getElementById('profile-details-template').innerHTML;
            
            const data = result.data;
            renderHeader(data.basicInfo);
            renderProgressTrackers(data.progress);
            renderTrophyCase(data.achievements);
            renderHeatmap(data.workoutCalendar);
            renderWorkoutLogs(data.workoutLogs);
            renderFitnessChart(data.fitnessTests);
            renderFitnessHistory(data.fitnessTests);
            renderAttendanceHistory(data.attendanceHistory);
            renderLeaveHistory(data.leaveHistory);

            setupTabEvents();

        } catch (err) {
            detailsSection.innerHTML = `<div class="card"><h2 class="text-danger">Error Loading Profile</h2><p>${err.message}</p><button onclick="location.reload()" class="btn">Try Again</button></div>`;
        }
    }
    
    // --- RENDER HELPER FUNCTIONS ---
// Replace the old renderHeader function in profile.js

// Replace the old renderHeader function in profile.js

function renderHeader(info) {
    // --- Existing info rendering ---
    document.getElementById('profileName').textContent = info.Name;
    document.getElementById('profileStatus').textContent = info.Status;
    document.getElementById('profileStatus').className = `status-badge ${info.Status === 'Active' ? 'status-active' : 'status-inactive'}`;
    document.getElementById('profileTR').textContent = info.TR;
    document.getElementById('profileJoined').textContent = new Date(info.JoinedAt).toLocaleDateString();
    document.getElementById('profileGoal').textContent = info.Goal;
    document.getElementById('profileSlot').textContent = info.SlotName || 'N/A';
    document.getElementById('profileDarajah').textContent = info.Darajah;

    // --- NEW: Render the improved XP Bar ---
    const level = info.FitnessLevel || 1;
    const xp = info.CurrentXP || 0;
    const xpForNextLevel = level * 100;
    const progressPercent = (xp / xpForNextLevel) * 100;

    document.getElementById('profileFitnessLevel').textContent = level;
    document.getElementById('profileCurrentXp').textContent = xp;
    document.getElementById('profileNextLevelXp').textContent = xpForNextLevel;
    document.getElementById('profileXpBarFill').style.width = `${progressPercent}%`;
}
// REPLACE your old placeholder renderProgressTrackers function with this one

function renderProgressTrackers(progress) {
    const container = document.getElementById('profile-progress-trackers');
    if (!container) return;

    // --- Calculate percentages and text for each achievement ---

    // 1. Consistency King
    const consistencyPercent = Math.min((progress.consistency.current / progress.consistency.target) * 100, 100);
    const consistencyText = `${progress.consistency.current} / ${progress.consistency.target} Day Streak`;

    // 2. Perfect 30 Days
    const monthPercent = Math.min((progress.perfectMonth.current / progress.perfectMonth.target) * 100, 100);
    const monthText = (monthPercent >= 100 && progress.perfectMonth.target > 0)
        ? "Goal Met! Awaiting Award"
        : `${progress.perfectMonth.current} / ${progress.perfectMonth.target} Days in last 30`;

    // 3. Social Butterfly
    const rank = progress.socialButterfly.current_rank;
    const butterflyPercent = (rank > 0 && rank <= 3) ? 100 : (rank > 3 && rank <= 10 ? (10 - rank) / 7 * 80 : 10);
    const butterflyText = (rank > 0 && rank <= 3)
        ? `Rank #${rank} (Weekly) - Awaiting Award!`
        : `Current Weekly Rank: #${rank || 'N/A'}`;

    // 4. Milestone Lift
    const { current_improvement, target_improvement, previous_score, current_score } = progress.milestoneLift;
    const milestonePercent = Math.min((current_improvement / target_improvement) * 100, 100);
    const milestoneText = (current_score === 'N/A')
        ? "Take 2+ tests to see progress"
        : `Prev: ${previous_score}, Current: ${current_score} (+${current_improvement.toFixed(1)}%)`;

    // --- Generate the HTML ---

    container.innerHTML = `
        <div class="progress-card">
            <img src="/images/badges/consistency-king.png" alt="Consistency King" class="progress-badge-img">
            <div class="progress-info">
                <h4>Consistency King</h4>
                <div class="progress-bar-container"><div class="progress-bar-fill" style="width: ${consistencyPercent}%;"></div></div>
                <p class="progress-text">${consistencyText}</p>
            </div>
        </div>
        <div class="progress-card">
            <img src="/images/badges/perfect-month.png" alt="Perfect 30 Days" class="progress-badge-img">
            <div class="progress-info">
                <h4>Perfect 30 Days</h4>
                <div class="progress-bar-container"><div class="progress-bar-fill" style="width: ${monthPercent}%;"></div></div>
                <p class="progress-text">${monthText}</p>
            </div>
        </div>
        <div class="progress-card">
            <img src="/images/badges/social-butterfly.png" alt="Social Butterfly" class="progress-badge-img">
            <div class="progress-info">
                <h4>Social Butterfly</h4>
                <div class="progress-bar-container"><div class="progress-bar-fill" style="width: ${butterflyPercent}%;"></div></div>
                <p class="progress-text">${butterflyText}</p>
            </div>
        </div>
        <div class="progress-card">
            <img src="/images/badges/milestone-lift.png" alt="Milestone Lift" class="progress-badge-img">
            <div class="progress-info">
                <h4>Milestone Lift</h4>
                <div class="progress-bar-container"><div class="progress-bar-fill" style="width: ${milestonePercent}%;"></div></div>
                <p class="progress-text">${milestoneText}</p>
            </div>
        </div>
    `;
}

    function renderTrophyCase(achievements) {
        const grid = document.getElementById('profile-achievements-grid');
        grid.innerHTML = achievements.length === 0 
            ? '<p class="text-muted text-center">No badges earned yet.</p>'
            : achievements.map(badge => `
                <div class="badge-card-small" title="${badge.Description} \nEarned: ${new Date(badge.DateEarned).toLocaleDateString()}">
                    <img src="${badge.BadgeImageURL}" alt="${badge.AchievementName}">
                    <span>${badge.AchievementName}</span>
                </div>`).join('');
    }

    function renderHeatmap(calendarData) {
        const container = document.getElementById('profile-consistency-heatmap');
        container.innerHTML = '';
        if (calendarData.length === 0) {
            container.innerHTML = '<p class="text-muted text-center">No workout data for the last 6 months.</p>';
            return;
        }
        const cal = new CalHeatmap();
        cal.paint({ itemSelector: container, domain: { type: 'month' }, subDomain: { type: 'day', radius: 2 }, data: { source: calendarData.map(d => ({date: d, value: 1})), x: 'date', y: 'value' }, scale: { color: { range: ['#e0f7fa', '#80deea', '#00bcd4', '#0097a7'], domain: [1,2,3,4]}}, date: { start: new Date(new Date().setMonth(new Date().getMonth() - 5)) }});
    }

    function renderFitnessChart(tests) {
        if(fitnessChartInstance) fitnessChartInstance.destroy();
        const ctx = document.getElementById('profile-fitness-chart');
        if (!ctx || tests.length < 2) {
            ctx.parentElement.innerHTML = '<p class="text-muted text-center">Not enough test data to draw a progression chart.</p>';
            return;
        }
        fitnessChartInstance = new Chart(ctx.getContext('2d'), {
            type: 'line', data: { labels: tests.map(d => new Date(d.CreatedAt).toLocaleDateString()), datasets: [{ label: 'Weight (kg)', data: tests.map(d => d.Weight), borderColor: '#007bff' }, { label: 'Body Fat (%)', data: tests.map(d => d.BodyFat), borderColor: '#dc3545' }] }
        });
    }

    function renderWorkoutLogs(logs) {
        $('#profile-workout-log-table').DataTable({
            data: logs,
            columns: [{ title: 'Date', data: 'LogDate', render: d => new Date(d).toLocaleDateString() }, { title: 'Body Parts Trained', data: 'BodyParts' }],
            order: [[0, 'desc']], destroy: true, searching: false, pageLength: 5, lengthChange: false
        });
    }

    function renderFitnessHistory(tests) {
        $('#profile-fitness-history-table').DataTable({
            data: tests,
            columns: [{ title: 'Date', data: 'CreatedAt', render: d => new Date(d).toLocaleDateString() }, { title: 'Weight', data: 'Weight' }, { title: 'Body Fat %', data: 'BodyFat' }, { title: 'Total Score', data: 'Total' }, { title: 'Grade', data: 'Grade' }],
            order: [[0, 'desc']], destroy: true, searching: false, pageLength: 5, lengthChange: false
        });
    }
    
    function renderAttendanceHistory(attendance) {
        $('#profile-attendance-history-table').DataTable({
            data: attendance,
            columns: [
                { title: 'Date', data: 'CreatedAt', render: d => new Date(d).toLocaleDateString() },
                { title: 'Status', data: null, render: row => row.IsPresent ? 'Present' : (row.OnLeave ? 'On Leave' : 'Absent') },
                { title: 'Duration (min)', data: 'DurationInMinutes', render: d => d || 'N/A' }
            ],
            order: [[0, 'desc']], destroy: true, pageLength: 10
        });
    }

    function renderLeaveHistory(leaves) {
        $('#profile-leave-history-table').DataTable({
            data: leaves,
            columns: [
                { title: 'Start Date', data: 'LeaveStartDate', render: d => new Date(d).toLocaleDateString() },
                { title: 'End Date', data: 'LeaveEndDate', render: d => new Date(d).toLocaleDateString() },
                { title: 'Status', data: 'Status' }, { title: 'Reason', data: 'Reason' },
                { title: 'Reviewed By', data: 'ReviewedBy', render: d => d || 'N/A' }
            ],
            order: [[0, 'desc']], destroy: true, pageLength: 5, lengthChange: false
        });
    }

    function setupTabEvents() {
        const tabContainer = document.querySelector('.profile-tabs');
        tabContainer.addEventListener('click', (e) => {
            if (e.target.matches('.tab-link')) {
                const tabId = e.target.dataset.tab;
                tabContainer.querySelectorAll('.tab-link').forEach(t => t.classList.remove('active'));
                e.target.classList.add('active');
                document.querySelectorAll('.tab-pane').forEach(p => { p.style.display = p.id === tabId ? 'block' : 'none'; });
            }
        });
    }
});