// --- profile.js (Final Cleaned & Safe Version) ---

document.addEventListener("DOMContentLoaded", () => {

    // === Element References ===
    const searchInput = document.getElementById('studentSearchInput');
    const searchResults = document.getElementById('searchResults');
    const searchSection = document.getElementById('profile-search-section');
    const detailsSection = document.getElementById('profile-details-section');

    let debounceTimer;
    let fitnessChartInstance = null;

    // === INITIAL PAGE LOAD ===
    const urlParams = new URLSearchParams(window.location.search);
    const trFromUrl = urlParams.get('tr');
    if (trFromUrl) loadFullProfile(trFromUrl);

    // === SEARCH LOGIC ===
    searchInput.addEventListener('input', (e) => {
        const term = e.target.value.trim();
        clearTimeout(debounceTimer);
        if (term.length < 2) {
            searchResults.style.display = 'none';
            return;
        }
        debounceTimer = setTimeout(() => fetchStudents(term), 300);
    });

    async function fetchStudents(query) {
        try {
            const res = await fetch(`/api/staff/student-search?q=${encodeURIComponent(query)}`);
            const result = await res.json();
            renderSearchResults(result.success ? result.data : []);
        } catch (err) {
            console.error('Search fetch error:', err);
        }
    }

    function renderSearchResults(students) {
        if (!Array.isArray(students) || students.length === 0) {
            searchResults.innerHTML = '<div class="search-result-item">No students found.</div>';
        } else {
            searchResults.innerHTML = students.map(s => `
                <div class="search-result-item" data-tr="${s.TR}">
                    <span class="name">${s.Name}</span>
                    <span class="tr">(${s.TR})</span>
                </div>
            `).join('');
        }
        searchResults.style.display = 'block';
    }

    searchResults.addEventListener('click', (e) => {
        const targetItem = e.target.closest('.search-result-item');
        if (targetItem && targetItem.dataset.tr) {
            const tr = targetItem.dataset.tr;
            window.history.pushState({ tr }, `Profile for ${tr}`, `?tr=${tr}`);
            loadFullProfile(tr);
        }
    });

    document.addEventListener('click', (e) => {
        if (!searchInput.contains(e.target)) searchResults.style.display = 'none';
    });

    // === MAIN PROFILE LOADING ===
    async function loadFullProfile(tr) {
        searchSection.style.display = 'none';
        detailsSection.style.display = 'block';
        detailsSection.innerHTML = `
            <div class="card text-center">
                <h2><div class="spinner-border text-primary" role="status"></div> Loading profile for TR: ${tr}...</h2>
            </div>`;

        try {
            const res = await fetch(`/api/staff/student-profile/${tr}`);
            const result = await res.json();
            if (!result.success || !result.data)
                throw new Error(result.message || 'Profile not found.');

            // Load Template
            detailsSection.innerHTML = document.getElementById('profile-details-template').innerHTML;
            const data = result.data;

            renderHeader(data.basicInfo || {});
            renderProgressTrackers(data.progress || {});
            renderTrophyCase(data.achievements || []);
            renderHeatmap(data.workoutCalendar || []);
            renderWorkoutLogs(data.workoutLogs || []);
            renderFitnessChart(data.fitnessTests || []);
            renderFitnessHistory(data.fitnessTests || []);
            renderAttendanceHistory(data.attendanceHistory || []);
            renderLeaveHistory(data.leaveHistory || []);

            setupTabEvents();

        } catch (err) {
            console.error(err);
            detailsSection.innerHTML = `
                <div class="card text-center">
                    <h2 class="text-danger">Error Loading Profile</h2>
                    <p>${err.message}</p>
                    <button onclick="location.reload()" class="btn btn-primary mt-3">Try Again</button>
                </div>`;
        }
    }

    // === RENDER HELPERS ===

    function renderHeader(info) {
        document.getElementById('profileName').textContent = info.Name || 'Unknown';
        const statusEl = document.getElementById('profileStatus');
        const status = info.Status || 'Inactive';
        statusEl.textContent = status;
        statusEl.className = `status-badge ${status === 'Active' ? 'status-active' : 'status-inactive'}`;
        document.getElementById('profileTR').textContent = info.TR || 'N/A';
        document.getElementById('profileJoined').textContent = info.JoinedAt ? new Date(info.JoinedAt).toLocaleDateString() : 'N/A';
        document.getElementById('profileGoal').textContent = info.Goal || 'N/A';
        document.getElementById('profileSlot').textContent = info.SlotName || 'N/A';
        document.getElementById('profileDarajah').textContent = info.Darajah || 'N/A';

        const lvl = info.FitnessLevel || 1;
        const xp = info.CurrentXP || 0;
        const next = lvl * 100;
        document.getElementById('profileFitnessLevel').textContent = lvl;
        document.getElementById('profileCurrentXp').textContent = xp;
        document.getElementById('profileNextLevelXp').textContent = next;
        document.getElementById('profileXpBarFill').style.width = `${(xp / next) * 100}%`;
    }

    function renderProgressTrackers(progress) {
        const container = document.getElementById('profile-progress-trackers');
        if (!container) return;

        progress = progress || {};
        const consistency = progress.consistency || { current: 0, target: 1 };
        const perfectMonth = progress.perfectMonth || { current: 0, target: 30 };
        const socialButterfly = progress.socialButterfly || { current: 0, target: 8 };
        const milestoneLift = progress.milestoneLift || { current_improvement: 0, target_improvement: 1, previous_score: 'N/A', current_score: 'N/A' };
        const ironDedication = progress.ironDedication || { current: 0, target: 1, tierName: 'bronze', completed: false };

        const cPercent = Math.min((consistency.current / consistency.target) * 100, 100);
        const mPercent = Math.min((perfectMonth.current / perfectMonth.target) * 100, 100);
        const sPercent = Math.min((socialButterfly.current / socialButterfly.target) * 100, 100);
        const msPercent = Math.min((milestoneLift.current_improvement / milestoneLift.target_improvement) * 100, 100);
        const dedicationPercent = ironDedication.completed ? 100 : Math.min((ironDedication.current / ironDedication.target) * 100, 100);

        container.innerHTML = `
            <div class="progress-card">
                <img src="/images/badges/consistency-king.png" class="progress-badge-img">
                <div class="progress-info">
                    <h4>Consistency King</h4>
                    <div class="progress-bar-container"><div class="progress-bar-fill" style="width:${cPercent}%;"></div></div>
                    <p>${consistency.current} / ${consistency.target} Day Streak</p>
                </div>
            </div>
            <div class="progress-card">
                <img src="/images/badges/perfect-month.png" class="progress-badge-img">
                <div class="progress-info">
                    <h4>Perfect 30 Days</h4>
                    <div class="progress-bar-container"><div class="progress-bar-fill" style="width:${mPercent}%;"></div></div>
                    <p>${perfectMonth.current} / ${perfectMonth.target} Days</p>
                </div>
            </div>
            <div class="progress-card">
                <img src="/images/badges/social-butterfly.png" class="progress-badge-img">
                <div class="progress-info">
                    <h4>Social Butterfly</h4>
                    <div class="progress-bar-container"><div class="progress-bar-fill" style="width:${sPercent}%;"></div></div>
                    <p>Weekly Score: ${socialButterfly.current}/${socialButterfly.target}</p>
                </div>
            </div>
            <div class="progress-card">
                <img src="/images/badges/milestone-lift.png" class="progress-badge-img">
                <div class="progress-info">
                    <h4>Milestone Lift</h4>
                    <div class="progress-bar-container"><div class="progress-bar-fill" style="width:${msPercent}%;"></div></div>
                    <p>${milestoneLift.current_score === 'N/A' ? 'Take 2+ tests' : `Prev: ${milestoneLift.previous_score}, Curr: ${milestoneLift.current_score}`}</p>
                </div>
            </div>
            <div class="progress-card">
                <img src="${ironDedication.completed ? '/images/badges/dedication-gold.png' : `/images/badges/dedication-${String(ironDedication.tierName).toLowerCase()}.png`}" class="progress-badge-img">
                <div class="progress-info">
                    <h4>Iron Dedication</h4>
                    <div class="progress-bar-container"><div class="progress-bar-fill" style="width:${dedicationPercent}%;"></div></div>
                    <p>${ironDedication.completed ? 'All tiers done!' : `${ironDedication.current} / ${ironDedication.target} hrs`}</p>
                </div>
            </div>`;
    }

    function renderTrophyCase(achievements) {
        const grid = document.getElementById('profile-achievements-grid');
        if (!grid) return;
        if (!Array.isArray(achievements) || achievements.length === 0) {
            grid.innerHTML = '<p class="text-muted text-center">No badges earned yet.</p>';
            return;
        }
        grid.innerHTML = achievements.map(b => `
            <div class="badge-card-small" title="${b.Description || ''}">
                <img src="${b.BadgeImageURL || '/images/badges/placeholder.png'}" alt="${b.AchievementName}">
                <span>${b.AchievementName}</span>
            </div>`).join('');
    }

    function renderHeatmap(calendarData) {
        const container = document.getElementById('profile-consistency-heatmap');
        if (!container) return;
        container.innerHTML = '';
        if (!Array.isArray(calendarData) || calendarData.length === 0) {
            container.innerHTML = '<p class="text-muted text-center">No workout data for the last 6 months.</p>';
            return;
        }
        try {
            const cal = new CalHeatmap();
            const dataSrc = calendarData.map(d => ({ date: d, value: 1 }));
            cal.paint({
                itemSelector: container,
                domain: { type: 'month' },
                subDomain: { type: 'day', radius: 2 },
                data: { source: dataSrc, x: 'date', y: 'value' },
                scale: { color: { range: ['#0097a7', '#80deea', '#00bcd4', '#0097a7'], domain: [1, 2, 3, 4] } },
                date: { start: new Date(new Date().setMonth(new Date().getMonth() - 5)) }
            });
        } catch (err) {
            console.error('Heatmap render error:', err);
            container.innerHTML = '<p class="text-muted text-center">Unable to render heatmap.</p>';
        }
    }

function renderFitnessChart(tests) {
    if (fitnessChartInstance) {
        try { fitnessChartInstance.destroy(); } catch (e) {}
        fitnessChartInstance = null;
    }

    const ctx = document.getElementById('profile-fitness-chart');
    if (!ctx) return;

    // Prevent accidental huge resizing
    ctx.style.height = '400px';
    ctx.style.maxHeight = '400px';
    ctx.style.width = '100%';

    if (!Array.isArray(tests) || tests.length < 2) {
        const parent = ctx.parentElement;
        if (parent) parent.innerHTML = '<p class="text-muted text-center">Not enough test data to draw chart.</p>';
        return;
    }

    const labels = tests.map(d => new Date(d.CreatedAt).toLocaleDateString());
    fitnessChartInstance = new Chart(ctx.getContext('2d'), {
        type: 'line',
        data: {
            labels,
            datasets: [
                { label: 'Weight (kg)', data: tests.map(d => d.Weight), borderColor: '#007bff', fill: false },
                { label: 'Body Fat (%)', data: tests.map(d => d.BodyFat), borderColor: '#dc3545', fill: false }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false, // still flexible, but fixed height
            scales: {
                y: { beginAtZero: true }
            },
            plugins: { legend: { position: 'bottom' } }
        }
    });
}


    function renderWorkoutLogs(logs) {
        $('#profile-workout-log-table').DataTable({
            data: logs || [],
            columns: [
                { title: 'Date', data: 'LogDate', render: d => new Date(d).toLocaleDateString() },
                { title: 'Body Parts', data: 'BodyParts' }
            ],
            order: [[0, 'desc']], destroy: true, searching: false, pageLength: 5, lengthChange: false
        });
    }

    function renderFitnessHistory(tests) {
        $('#profile-fitness-history-table').DataTable({
            data: tests || [],
            columns: [
                { title: 'Date', data: 'CreatedAt', render: d => new Date(d).toLocaleDateString() },
                { title: 'Weight', data: 'Weight' },
                { title: 'Body Fat %', data: 'BodyFat' },
                { title: 'Total Score', data: 'Total' },
                { title: 'Grade', data: 'Grade' }
            ],
            order: [[0, 'desc']], destroy: true, searching: false, pageLength: 5, lengthChange: false
        });
    }

    function renderAttendanceHistory(attendance) {
        $('#profile-attendance-history-table').DataTable({
            data: attendance || [],
            columns: [
                { title: 'Date', data: 'CreatedAt', render: d => new Date(d).toLocaleDateString() },
                { title: 'Status', data: null, render: r => r.IsPresent ? 'Present' : (r.OnLeave ? 'On Leave' : 'Absent') },
                { title: 'Duration (min)', data: 'DurationInMinutes', render: d => d || 'N/A' }
            ],
            order: [[0, 'desc']], destroy: true, pageLength: 10
        });
    }

    function renderLeaveHistory(leaves) {
        $('#profile-leave-history-table').DataTable({
            data: leaves || [],
            columns: [
                { title: 'Start Date', data: 'LeaveStartDate', render: d => new Date(d).toLocaleDateString() },
                { title: 'End Date', data: 'LeaveEndDate', render: d => new Date(d).toLocaleDateString() },
                { title: 'Status', data: 'Status' },
                { title: 'Reason', data: 'Reason' },
                { title: 'Reviewed By', data: 'ReviewedBy', render: d => d || 'N/A' }
            ],
            order: [[0, 'desc']], destroy: true, pageLength: 5, lengthChange: false
        });
    }

    function setupTabEvents() {
        const tabContainer = detailsSection.querySelector('.profile-tabs');
        if (!tabContainer) return;
        const tabPanes = Array.from(detailsSection.querySelectorAll('.tab-pane'));

        tabContainer.addEventListener('click', (e) => {
            if (e.target.matches('.tab-link')) {
                const tabId = e.target.dataset.tab;
                tabContainer.querySelectorAll('.tab-link').forEach(t => t.classList.remove('active'));
                e.target.classList.add('active');

                tabPanes.forEach(p => {
                    p.style.display = (p.id === tabId) ? 'block' : 'none';
                    p.classList.toggle('active', p.id === tabId);
                });
            }
        });
    }

});
