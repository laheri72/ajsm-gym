// A single, unified script to manage all analytics on the progress page.

// Global variables to hold the DataTable instances
let trainingPlansTable, summaryTable, engagementTable, goalAlignmentTable;
let bodyPartChartInstance = null; // Store chart instances
let peakHoursChartInstance = null;

// === NEW: Main data loading function ===
async function loadAllProgressData() {
    // Show some initial loading state if desired (e.g., in cards/charts)
    updateStat('stat-workouts-this-week', '...');
    updateStat('stat-workouts-change', '...');
    // ... potentially add loaders to chart areas ...
    showLoadingIndicator('bodyPartChartContainer');
    showLoadingIndicator('peakHoursChartContainer');

    try {
        const res = await fetch('/api/staff/progress-page-data', { credentials: 'include' });
        const result = await res.json();

        if (!result.success) {
            throw new Error(result.message || 'Failed to load data');
        }

        const data = result.data;

        // --- Distribute the fetched data ---
        renderActivitySummary(data.activitySummary);
        renderBodyPartChart(data.bodyPartTrends);
        renderStatCards(data.durationSummary);
        renderPeakHoursChart(data.peakHours);
        renderTrainingPlansTable(data.allTrainingPlans); // Pass data directly
        renderEngagementTable(data.engagementReport);   // Pass data directly

        // --- NEW: Load Leaderboards ---
        loadAchievementLeaderboard();
        loadTodayLeaderboard();

    } catch (err) {
        console.error('Failed to load progress page data:', err);
        Swal.fire('Error', `Could not load page data: ${err.message}`, 'error');
        // Update UI to show errors in cards/tables
        updateStat('stat-workouts-this-week', 'Error');
        updateStat('stat-avg-duration', 'Error');
        // Update chart containers to show error message instead of loader
        const bpContainer = document.getElementById('bodyPartChartContainer');
        if (bpContainer) bpContainer.innerHTML = '<p class="text-danger p-5 text-center">Error loading chart data.</p>';
        const phContainer = document.getElementById('peakHoursChartContainer');
        if (phContainer) phContainer.innerHTML = '<p class="text-danger p-5 text-center">Error loading chart data.</p>';
        $('#training-plans-table').DataTable().clear().draw(); // Clear tables
        $('#engagement-table').DataTable().clear().draw();
    }
}


// Main entry point when the page loads
document.addEventListener('DOMContentLoaded', () => {

    // 1. Initialize the default tables that are visible on load
    initializeTrainingPlansTable();
    initializeEngagementTable();

    // 2. Load all data from the single endpoint
    loadAllProgressData();


    // 3. Set up all interactive elements like buttons and dropdowns
    setupEventListeners();
    populateFilters();
});

// A central place to manage all event listeners
function setupEventListeners() {
    // --- Training Plan Analytics Listeners ---
    document.getElementById('viewLogsBtn').addEventListener('click', () => toggleView('logs'));
    document.getElementById('viewSummaryBtn').addEventListener('click', () => toggleView('summary'));
    document.getElementById('trainingBodyPartFilter').addEventListener('change', (e) => loadTrainingSummaryData(e.target.value));
    document.getElementById('exportTrainingPlansBtn').addEventListener('click', () => exportTable(trainingPlansTable, 'Training_Logs.xlsx'));

    // --- Duration Analytics Listeners ---
    document.getElementById('viewEngagementBtn').addEventListener('click', () => toggleView('engagement'));
    document.getElementById('viewGoalBtn').addEventListener('click', () => toggleView('goal'));
    document.getElementById('goalAlignmentGoalFilter').addEventListener('change', loadGoalAlignmentData);
    document.getElementById('goalAlignmentBodyPartFilter').addEventListener('change', loadGoalAlignmentData);
}

// --- Helper Functions for Toggling Views ---
function toggleView(viewName) {
    if (viewName === 'logs') {
        document.getElementById('logs-view').style.display = 'block';
        document.getElementById('summary-view').style.display = 'none';
        document.getElementById('training-summary-filter-container').style.display = 'none';
        document.getElementById('viewLogsBtn').classList.add('active');
        document.getElementById('viewSummaryBtn').classList.remove('active');
    } else if (viewName === 'summary') {
        document.getElementById('logs-view').style.display = 'none';
        document.getElementById('summary-view').style.display = 'block';
        document.getElementById('training-summary-filter-container').style.display = 'block';
        document.getElementById('viewSummaryBtn').classList.add('active');
        document.getElementById('viewLogsBtn').classList.remove('active');
        const part = document.getElementById('trainingBodyPartFilter').value;
        if (part) loadTrainingSummaryData(part);
    } else if (viewName === 'engagement') {
        document.getElementById('engagement-view').style.display = 'block';
        document.getElementById('goal-view').style.display = 'none';
        document.getElementById('viewEngagementBtn').classList.add('active');
        document.getElementById('viewGoalBtn').classList.remove('active');
    } else if (viewName === 'goal') {
        document.getElementById('engagement-view').style.display = 'none';
        document.getElementById('goal-view').style.display = 'block';
        document.getElementById('viewGoalBtn').classList.add('active');
        document.getElementById('viewEngagementBtn').classList.remove('active');
        loadGoalAlignmentData();
    }
}

// Populates all dropdown filters on the page with unique IDs
function populateFilters() {
    const goals = ['General Fitness', 'Weight Loss', 'Muscle Gain', 'Strength', 'Endurance', 'Flexibility', 'Energy Boost', 'Stress Relief', 'Overall Health'];
    const bodyParts = ['Cardio', 'Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps', 'Legs', 'Core', 'Full Body', 'Upper Body', 'Lower Body'];

    // ✅ Use the new unique ID for the training summary filter
    const trainingFilter = document.getElementById('trainingBodyPartFilter');
    trainingFilter.innerHTML = '<option value="" disabled selected>Select a part...</option>';
    bodyParts.forEach(part => trainingFilter.innerHTML += `<option value="${part}">${part}</option>`);

    // ✅ Use the new unique IDs for the goal alignment filters
    const goalFilter = document.getElementById('goalAlignmentGoalFilter');
    goalFilter.innerHTML = '<option value="" disabled selected>Select a goal...</option>';
    goals.forEach(g => goalFilter.innerHTML += `<option value="${g}">${g}</option>`);    const goalBodyPartFilter = document.getElementById('goalAlignmentBodyPartFilter');
    goalBodyPartFilter.innerHTML = '<option value="" disabled selected>Select a part...</option>';
    bodyParts.forEach(p => goalBodyPartFilter.innerHTML += `<option value="${p}">${p}</option>`);
}

// --- Data Loading and Rendering Functions ---ions ---

function updateStat(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
}

function showLoadingIndicator(containerId) {
    const container = document.getElementById(containerId);
    if (container) {
        container.innerHTML = `
            <div class="d-flex justify-content-center align-items-center p-5">
                <div class="loader me-3"></div> 
                <span class="text-muted">Loading Chart...</span>
            </div>
        `;
    }
}

function hideLoadingIndicator(containerId, canvasId) {
    const container = document.getElementById(containerId);
    if (container) {
        container.innerHTML = `<canvas id="${canvasId}"></canvas>`;
    }
}

// Renders Activity Summary card data
function renderActivitySummary(summary) {
    if (!summary) return;
    updateStat('stat-workouts-this-week', summary.workoutsThisWeek);
    updateStat('stat-most-trained', summary.mostTrained);
    let change = 0;
    if (summary.workoutsLastWeek > 0) {
        change = ((summary.workoutsThisWeek - summary.workoutsLastWeek) / summary.workoutsLastWeek) * 100;
    } else if (summary.workoutsThisWeek > 0) { change = 100; }
    const changeEl = document.getElementById('stat-workouts-change');
    if (changeEl) {
        changeEl.textContent = `${change.toFixed(0)}%`;
        changeEl.style.color = change >= 0 ? 'var(--primary)' : 'var(--danger)';
    }
}

// Renders Body Part Chart data
function renderBodyPartChart(trends) {
    const containerId = 'bodyPartChartContainer';
    const canvasId = 'bodyPartChart';

    if (bodyPartChartInstance) {
        bodyPartChartInstance.destroy();
    }

    if (!trends || trends.length === 0) {
        const container = document.getElementById('bodyPartChartContainer');
        if (container) {
            container.innerHTML = '<p class="text-muted p-5 text-center">No body part data yet.</p>';
        }
        return;
    }

    hideLoadingIndicator(containerId, canvasId);

    const ctx = document.getElementById('bodyPartChart')?.getContext('2d');
    if (!ctx) return;

    const labels = trends.map(item => item.bodyPart);
    const data = trends.map(item => item.count);
    bodyPartChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Total Workouts Logged',
                data: data,
                backgroundColor: 'rgba(76, 175, 80, 0.5)',
                borderColor: 'rgba(76, 175, 80, 1)',
                borderWidth: 1
            }]
        },
        options: { responsive: true, plugins: { legend: { display: false } } }
    });
}

// Renders Duration Stat card data
function renderStatCards(summary) {
    if (!summary) return;
    updateStat('stat-avg-duration', summary.avgDuration?.toFixed(0) || '--');
    updateStat('stat-busiest-slot', summary.busiestSlot);
    updateStat('stat-total-hours', summary.totalHoursThisWeek?.toFixed(1) || '--');
}

// Renders Peak Hours Chart data
function renderPeakHoursChart(peakHours) {
    const containerId = 'peakHoursChartContainer';
    const canvasId = 'peakHoursChart';

    if (peakHoursChartInstance) {
        peakHoursChartInstance.destroy();
    }

    if (!peakHours || peakHours.length === 0) {
        const container = document.getElementById('peakHoursChartContainer');
        if (container) {
            container.innerHTML = '<p class="text-muted p-5 text-center">No peak hours data available yet.</p>';
        }
        return;
    }

    hideLoadingIndicator(containerId, canvasId);

    const ctx = document.getElementById('peakHoursChart')?.getContext('2d');
    if (!ctx) return;

    const labels = peakHours.map(item => moment().hour(item.hour).format('h A'));
    const data = peakHours.map(item => item.count);
    peakHoursChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Number of Active Members',
                data: data,
                backgroundColor: 'rgba(76, 175, 80, 0.2)',
                borderColor: 'rgba(76, 175, 80, 1)',
                borderWidth: 2, fill: true, tension: 0.4
            }]
        },
        options: { responsive: true, plugins: { legend: { display: false } } }
    });
}

// Initializes the Training Plans Table
function initializeTrainingPlansTable() {
    if (trainingPlansTable) return;
    trainingPlansTable = $('#training-plans-table').DataTable({
        columns: [
            { data: 'CreatedAt', render: d => d ? new Date(d).toLocaleDateString() : 'N/A' },
            { data: 'TR' },
            { 
                data: 'Name',
                render: function(data, type, row) {
                    let badge = row.IsBlacklisted ? `<span class="badge bg-danger-subtle text-danger border border-danger-subtle ms-1" title="${row.BlacklistReason || 'Blacklisted'}">🚩 Blacklisted</span>` : '';
                    return `<span>${data || '-'}</span>${badge}`;
                }
            },
            { data: 'BodyParts', render: data => data ? data.split(', ').map(part => `<span class="body-part-pill">${part}</span>`).join(' ') : '' },
            {
                data: 'CreatedAt', render: data => {
                    if (!data) return 'N/A';
                    const daysSince = Math.floor((new Date() - new Date(data)) / (1000 * 3600 * 24));
                    let color = daysSince <= 6 ? 'green' : (daysSince <= 13 ? 'orange' : 'red');
                    return `<span style="color: ${color}; font-weight: bold;">${daysSince} days ago</span>`;
                }
            }
        ],
        data: [],
        order: [[0, 'desc']], pageLength: 25, responsive: true,
        language: { emptyTable: "Loading data or no logs found." }
    });
}

function renderTrainingPlansTable(plans) {
    if (!trainingPlansTable) initializeTrainingPlansTable();
    trainingPlansTable.clear().rows.add(plans || []).draw();
}

function initializeEngagementTable() {
    if (engagementTable) return;
    engagementTable = $('#engagement-table').DataTable({
        columns: [
            { 
                data: 'Name',
                render: function(data, type, row) {
                    let badge = row.IsBlacklisted ? `<span class="badge bg-danger-subtle text-danger border border-danger-subtle ms-1" title="${row.BlacklistReason || 'Blacklisted'}">🚩 Blacklisted</span>` : '';
                    return `<span>${data || '-'}</span>${badge}`;
                }
            },
            { data: 'TotalHours', render: d => d?.toFixed(1) || '0.0' },
            { data: 'AvgDuration', render: d => d?.toFixed(0) || '0' },
            {
                data: 'DaysSinceLastVisit', render: data => {
                    const days = data != null ? data : Infinity;
                    let color = days <= 6 ? 'green' : (days <= 13 ? 'orange' : 'red');
                    return `<span style="color: ${color}; font-weight: bold;">${days === Infinity ? 'N/A' : days}</span>`;
                }
            }
        ],
        data: [],
        order: [[1, 'desc']], responsive: true,
        language: { emptyTable: "Loading data or no engagement data found." }
    });
}

function renderEngagementTable(engagementData) {
    if (!engagementTable) initializeEngagementTable();
    engagementTable.clear().rows.add(engagementData || []).draw();
}

function loadTrainingSummaryData(partName) {
    if (!partName) return;
    if (summaryTable) summaryTable.destroy();
    summaryTable = $('#summary-table').DataTable({
        ajax: { url: `/api/staff/workout-summary-by-bodypart?partName=${partName}`, credentials: 'include', dataSrc: 'data' },
        columns: [
            { data: null, render: (data, type, row, meta) => meta.row + 1 },
            { data: 'TR' }, { data: 'Name' }, { data: 'WorkoutCount' }
        ],
        order: [[3, 'desc']], responsive: true, searching: false, paging: false, info: false
    });
}

function loadGoalAlignmentData() {
    const goal = document.getElementById('goalAlignmentGoalFilter')?.value;
    const part = document.getElementById('goalAlignmentBodyPartFilter')?.value;
    if (!goal || !part) return;
    if (goalAlignmentTable) goalAlignmentTable.destroy();
    goalAlignmentTable = $('#goal-alignment-table').DataTable({
        ajax: { url: `/api/staff/goal-alignment?goal=${goal}&partName=${part}`, credentials: 'include', dataSrc: 'data' },
        columns: [
            { data: 'Name' }, { data: 'Goal' }, { data: 'TimesTrained' }
        ],
        order: [[2, 'desc']], responsive: true
    });
}

function exportTable(tableInstance, fileName) {
    if (!tableInstance) return;
    const data = tableInstance.rows({ search: 'applied' }).data().toArray();
    if (data.length === 0) return Swal.fire('No Data', 'There is no data to export.', 'info');
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Data');
    XLSX.writeFile(workbook, fileName);
}

async function loadAchievementLeaderboard() {
    const listElement = document.getElementById('achievementLeaderboardList');
    if (!listElement) return;

    try {
        const res = await fetch('/api/achievements/leaderboard');
        const result = await res.json();

        if (result.success && result.data.length > 0) {
            listElement.innerHTML = '';
            const medals = ['🥇', '🥈', '🥉'];

            result.data.forEach((player, index) => {
                const badges = Number(player.TotalAchievements) || 0;
                const level = Number(player.FitnessLevel) || 1;
                const currentXP = Number(player.CurrentXP) || 0;
                const nextLevelXP = Number(player.NextLevelXP) || level * 100;
                const totalXP = Number(player.TotalXP) || currentXP;
                const li = document.createElement('li');
                li.innerHTML = `
                    <div class="rank">${medals[index] || index + 1}</div>
                    <div class="name">${player.Name}</div>
                    <div class="score">${badges} Badges | LVL ${level} | ${totalXP} XP <small>(${currentXP}/${nextLevelXP} to next)</small></div>
                `;
                listElement.appendChild(li);
            });
        }
    } catch (err) {
        console.error('Error loading achievement leaderboard:', err);
    }
}

async function loadTodayLeaderboard() {
    const list = document.getElementById('todayLeaderboardList');
    if (!list) return;

    try {
        const res = await fetch('/api/leaderboard');
        const result = await res.json();

        if (result.success && result.data.length > 0) {
            const medals = ['🥇', '🥈', '🥉'];
            list.innerHTML = '';

            result.data.forEach((student, index) => {
                const medal = medals[index] || index + 1;
                const li = `
                    <li>
                        <span class="rank">${medal}</span>
                        <span class="name">${student.Name}</span>
                        <span class="score">${student.Score || 0} mins</span>
                    </li>`;
                list.insertAdjacentHTML('beforeend', li);
            });
        } else {
            list.innerHTML = '<li class="loading text-muted py-4">No performance data available for today.</li>';
        }
    } catch (err) {
        console.error('Error loading today leaderboard:', err);
        list.innerHTML = '<li class="loading text-danger py-4">Error loading data.</li>';
    }
}
