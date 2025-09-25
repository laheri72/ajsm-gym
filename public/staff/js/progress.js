// A single, unified script to manage all analytics on the progress page.

// Global variables to hold the DataTable instances
let trainingPlansTable, summaryTable, engagementTable, goalAlignmentTable;

// Main entry point when the page loads
document.addEventListener('DOMContentLoaded', () => {
    // 1. Load all static charts and cards for both sections
    loadActivitySummary();
    loadBodyPartChart();
    loadStatCards();
    loadPeakHoursChart();
    
    // 2. Initialize the default tables that are visible on load
    initializeTrainingPlansTable();
    initializeEngagementTable();

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
        if(part) loadTrainingSummaryData(part);
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
    const goals = ['Muscle Gain', 'Fat Loss', 'Increase Fitness Level'];
    const bodyParts = ['Cardio', 'Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps', 'Legs', 'Core'];
    
    // ✅ Use the new unique ID for the training summary filter
    const trainingFilter = document.getElementById('trainingBodyPartFilter');
    trainingFilter.innerHTML = '<option value="" disabled selected>Select a part...</option>';
    bodyParts.forEach(part => trainingFilter.innerHTML += `<option value="${part}">${part}</option>`);

    // ✅ Use the new unique IDs for the goal alignment filters
    const goalFilter = document.getElementById('goalAlignmentGoalFilter');
    goalFilter.innerHTML = '<option value="" disabled selected>Select a goal...</option>';
    goals.forEach(g => goalFilter.innerHTML += `<option value="${g}">${g}</option>`);

    const goalBodyPartFilter = document.getElementById('goalAlignmentBodyPartFilter');
    goalBodyPartFilter.innerHTML = '<option value="" disabled selected>Select a part...</option>';
    bodyParts.forEach(p => goalBodyPartFilter.innerHTML += `<option value="${p}">${p}</option>`);
}

// --- Data Loading and Rendering Functions ---

async function loadActivitySummary() {
    try {
        const res = await fetch('/api/staff/activity-summary', { credentials: 'include' });
        const result = await res.json();
        if (result.success) {
            document.getElementById('stat-workouts-this-week').textContent = result.workoutsThisWeek;
            document.getElementById('stat-most-trained').textContent = result.mostTrained;
            let change = 0;
            if (result.workoutsLastWeek > 0) {
                change = ((result.workoutsThisWeek - result.workoutsLastWeek) / result.workoutsLastWeek) * 100;
            } else if (result.workoutsThisWeek > 0) { change = 100; }
            const changeEl = document.getElementById('stat-workouts-change');
            changeEl.textContent = `${change.toFixed(0)}%`;
            changeEl.style.color = change >= 0 ? 'var(--primary)' : 'var(--danger)';
        }
    } catch (err) { console.error('Failed to load activity summary:', err); }
}

async function loadBodyPartChart() {
    try {
        const res = await fetch('/api/staff/body-part-trends', { credentials: 'include' });
        const result = await res.json();
        if (result.success && result.data.length > 0) {
            const labels = result.data.map(item => item.bodyPart);
            const data = result.data.map(item => item.count);
            const ctx = document.getElementById('bodyPartChart').getContext('2d');
            new Chart(ctx, {
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
    } catch (err) { console.error('Failed to load body part chart:', err); }
}

async function loadStatCards() {
    try {
        const res = await fetch('/api/staff/duration-summary', { credentials: 'include' });
        const result = await res.json();
        if (result.success) {
            document.getElementById('stat-avg-duration').textContent = result.avgDuration;
            document.getElementById('stat-busiest-slot').textContent = result.busiestSlot;
            document.getElementById('stat-total-hours').textContent = result.totalHoursThisWeek;
        }
    } catch (err) { console.error('Failed to load stat cards:', err); }
}

async function loadPeakHoursChart() {
    try {
        const res = await fetch('/api/staff/peak-hours', { credentials: 'include' });
        const result = await res.json();
        if (result.success && result.data.length > 0) {
            const labels = result.data.map(item => `${item.hour}:00`);
            const data = result.data.map(item => item.count);
            const ctx = document.getElementById('peakHoursChart').getContext('2d');
            new Chart(ctx, {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Number of Active Members',
                        data: data,
                        backgroundColor: 'rgba(76, 175, 80, 0.2)',
                        borderColor: 'rgba(76, 175, 80, 1)',
                        borderWidth: 2,
                        fill: true,
                        tension: 0.4
                    }]
                },
                options: { responsive: true, plugins: { legend: { display: false } } }
            });
        }
    } catch (err) { console.error('Failed to load peak hours chart:', err); }
}

function initializeTrainingPlansTable() {
    if (trainingPlansTable) return;
    trainingPlansTable = $('#training-plans-table').DataTable({
        ajax: { url: '/api/all-training-plans', credentials: 'include', dataSrc: 'data' },
        columns: [
            { data: 'CreatedAt', render: d => new Date(d).toLocaleDateString() },
            { data: 'TR' },
            { data: 'Name' },
            { data: 'BodyParts', render: data => data ? data.split(', ').map(part => `<span class="body-part-pill">${part}</span>`).join(' ') : '' },
            { data: 'CreatedAt', render: data => {
                const daysSince = Math.floor((new Date() - new Date(data)) / (1000 * 3600 * 24));
                let color = daysSince <= 6 ? 'green' : (daysSince <= 13 ? 'orange' : 'red');
                return `<span style="color: ${color}; font-weight: bold;">${daysSince} days ago</span>`;
            }}
        ],
        order: [[0, 'desc']], pageLength: 25, responsive: true
    });
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

function initializeEngagementTable() {
    if (engagementTable) return;
    engagementTable = $('#engagement-table').DataTable({
        ajax: { url: '/api/staff/engagement-report', credentials: 'include', dataSrc: 'data' },
        columns: [
            { data: 'Name' },
            { data: 'TotalHours', render: d => d.toFixed(1) },
            { data: 'AvgDuration', render: d => d.toFixed(0) },
            { data: 'DaysSinceLastVisit', render: data => {
                const days = data || 0;
                let color = days <= 6 ? 'green' : (days <= 13 ? 'orange' : 'red');
                return `<span style="color: ${color}; font-weight: bold;">${days}</span>`;
            }}
        ],
        order: [[1, 'desc']], responsive: true
    });
}

function loadGoalAlignmentData() {
    // ✅ Use the new unique IDs to get filter values
    const goal = document.getElementById('goalAlignmentGoalFilter').value;
    const part = document.getElementById('goalAlignmentBodyPartFilter').value;
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