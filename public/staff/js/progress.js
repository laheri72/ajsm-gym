// Add Chart.js to your HTML file if you haven't already:
// <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>

let trainingPlansTable = null;
let summaryTable = null;

// This single function runs when the page loads to set everything up
document.addEventListener('DOMContentLoaded', () => {
    // Load the high-level analytics that are always visible
    loadActivitySummary();
    loadBodyPartChart();
    
    // Initialize the default table view ("All Logs")
    initializeTrainingPlansTable();

    // Set up the interactive controls (toggle buttons, dropdowns)
    setupViewControls();
    populateBodyPartFilter();
});

// --- Feature 1: "At a Glance" Stat Cards ---
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
            } else if (result.workoutsThisWeek > 0) {
                change = 100;
            }
            const changeEl = document.getElementById('stat-workouts-change');
            changeEl.textContent = `${change.toFixed(0)}%`;
            changeEl.style.color = change >= 0 ? 'var(--primary)' : 'var(--danger)';
        }
    } catch (err) { console.error('Failed to load activity summary:', err); }
}

// --- Feature 3: Body Part Focus Bar Chart ---
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

// --- Logic for Interactive Tables ---
function setupViewControls() {
    const viewLogsBtn = document.getElementById('viewLogsBtn');
    const viewSummaryBtn = document.getElementById('viewSummaryBtn');
    const logsView = document.getElementById('logs-view');
    const summaryView = document.getElementById('summary-view');
    const summaryFilterContainer = document.getElementById('summary-filter-container');
    const bodyPartFilter = document.getElementById('bodyPartFilter');

    viewLogsBtn.addEventListener('click', () => {
        logsView.style.display = 'block';
        summaryView.style.display = 'none';
        summaryFilterContainer.style.display = 'none';
        viewLogsBtn.classList.add('active');
        viewSummaryBtn.classList.remove('active');
    });

    viewSummaryBtn.addEventListener('click', () => {
        logsView.style.display = 'none';
        summaryView.style.display = 'block';
        summaryFilterContainer.style.display = 'block';
        viewSummaryBtn.classList.add('active');
        viewLogsBtn.classList.remove('active');
        if (bodyPartFilter.value) {
            loadSummaryData(bodyPartFilter.value);
        }
    });

    bodyPartFilter.addEventListener('change', (event) => {
        loadSummaryData(event.target.value);
    });
}

async function populateBodyPartFilter() {
    const select = document.getElementById('bodyPartFilter');
    const bodyParts = ['Cardio', 'Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps', 'Legs', 'Core'];
    select.innerHTML = '<option value="" disabled selected>Select a part...</option>';
    bodyParts.forEach(part => {
        select.innerHTML += `<option value="${part}">${part}</option>`;
    });
}

async function loadSummaryData(partName) {
    if (!partName) return;
    if (summaryTable) {
        summaryTable.destroy();
    }
    summaryTable = $('#summary-table').DataTable({
        processing: true,
        ajax: {
            url: `/api/staff/workout-summary-by-bodypart?partName=${partName}`,
            credentials: 'include',
            dataSrc: 'data'
        },
        columns: [
            { data: null, render: (data, type, row, meta) => meta.row + 1 },
            { data: 'TR' },
            { data: 'Name' },
            { data: 'WorkoutCount' }
        ],
        order: [[3, 'desc']],
        responsive: true,
        searching: false,
        paging: false,
        info: false
    });
}

function initializeTrainingPlansTable() {
    if (trainingPlansTable) {
        trainingPlansTable.ajax.reload();
        return;
    }
    trainingPlansTable = $('#training-plans-table').DataTable({
        ajax: {
            url: '/api/all-training-plans',
            credentials: 'include',
            dataSrc: 'data'
        },
        columns: [
            { data: 'CreatedAt', render: d => new Date(d).toLocaleDateString() },
            { data: 'TR' },
            { data: 'Name' },
            { 
                data: 'BodyParts',
                render: function(data) {
                    if (!data) return '';
                    return data.split(', ').map(part => `<span class="body-part-pill">${part}</span>`).join(' ');
                }
            },
            {
                data: 'CreatedAt',
                render: function(data) {
                    const daysSince = Math.floor((new Date() - new Date(data)) / (1000 * 60 * 60 * 24));
                    let color = daysSince <= 6 ? 'green' : (daysSince <= 13 ? 'orange' : 'red');
                    return `<span style="color: ${color}; font-weight: bold;">${daysSince} days ago</span>`;
                }
            }
        ],
        order: [[0, 'desc']],
        pageLength: 25,
        responsive: true,
    });

    document.getElementById('exportTrainingPlansBtn').addEventListener('click', () => {
        const data = trainingPlansTable.rows({ search: 'applied' }).data().toArray();
        if (data.length === 0) return Swal.fire('No Data', 'There is no data to export.', 'info');
        const worksheet = XLSX.utils.json_to_sheet(data);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'TrainingPlans');
        XLSX.writeFile(workbook, 'All_Training_Plans.xlsx');
    });
}