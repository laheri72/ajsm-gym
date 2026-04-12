import { 
    bodyPartChart, weeklyHoursChart,
    setBodyPartChart, setWeeklyHoursChart 
} from './state.js';
import { generateColors } from './utils.js';

const escapeHtmlValue = (value) => $('<div>').text(value ?? '').html();

// --- (loadStudentPlans, renderTrainingPlans, loadTrainingAnalytics are unchanged) ---
/**
 * Fetches and renders the saved workout plan history table.
 */
export async function loadStudentPlans() {
  try {
    const res = await fetch('/api/student/training-plans', {
      method: 'GET',
      credentials: 'include'
    });
    const data = await res.json();

    if (data.success && data.data.length > 0) {
      renderTrainingPlans(data.data);
    } else {
      console.warn('No plans found:', data.message);
    }
  } catch (err) {
    console.error('Error loading training plans:', err);
  }
}

/**
 * Renders data into the training plans DataTable.
 */
function renderTrainingPlans(plans) {
    const tbody = document.querySelector('#studentPlanTable tbody');

    // 1. Destroy the DataTable instance FIRST
    if ($.fn.DataTable.isDataTable('#studentPlanTable')) {
        $('#studentPlanTable').DataTable().destroy();
    }
    // 2. Clear the HTML
    tbody.innerHTML = ''; 

    // 3. Populate the HTML rows
    plans.forEach(plan => {
        const tr = document.createElement('tr');
        const dateTd = document.createElement('td');
        dateTd.textContent = plan.LogDate;
        
        const partsTd = document.createElement('td');
        if (plan.BodyParts) {
            const partsArray = plan.BodyParts.split(', ');
            // --- THIS IS THE TYPO FIX ---
            partsTd.innerHTML = partsArray.map(part => 
                `<span class="body-part-pill">${part}</span>` // Was "class."
            ).join('');
        } else {
            partsTd.textContent = 'N/A';
        }
        
        tr.appendChild(dateTd);
        tr.appendChild(partsTd);
        tbody.appendChild(tr);
    });

    // 4. Re-initialize DataTable with the correct sorting
    $('#studentPlanTable').DataTable({
        "order": [[0, 'desc']], // <-- FIX 1: Sort by Date column (index 0) descending
        "responsive": true      // <-- FIX 2: Add mobile responsiveness
    });
}

/**
 * Fetches and renders the "Body Part Focus" pie chart.
 */
export async function loadTrainingAnalytics() {
  try {
    const res = await fetch('/api/student/training-analytics', {
      method: 'GET',
      credentials: 'include'
    });
    const result = await res.json();

    if (result.success && result.data.length > 0) {
      const labels = result.data.map(item => item.bodyPart);
      const data = result.data.map(item => item.count);
      const backgroundColors = generateColors(labels.length);
      const canvasElement = document.getElementById('bodyPartChart');
      if (!canvasElement) return;
      const ctx = canvasElement.getContext('2d');

      if (bodyPartChart) bodyPartChart.destroy();

      const newChart = new Chart(ctx, {
        type: 'pie',
        data: {
          labels: labels,
          datasets: [{
            label: 'Workouts',
            data: data,
            backgroundColor: backgroundColors,
            borderColor: '#ffffff',
            borderWidth: 2
          }]
        },
        options: {
          responsive: true,
          plugins: {
            legend: { position: 'top' },
            title: { display: true, text: 'Workout Focus (by Count)' }
          }
        }
      });
      setBodyPartChart(newChart); // Save instance to global state
    }
  } catch (err) {
    console.error("Failed to load analytics chart:", err);
  }
}

/**
 * Fetches and renders the "Workout Consistency" heatmap.
 */
export async function loadWorkoutConsistency() {
    try {
        const res = await fetch('/api/student/workout-calendar', { credentials: 'include' });
        const result = await res.json();
        
        if (result.success && result.data.length > 0) {
            const workoutData = result.data.map(dateString => ({ date: dateString, value: 1 }));
            const cal = new CalHeatmap();
            const container = document.getElementById('consistencyHeatmap');
            container.innerHTML = ''; 

            cal.paint({
                itemSelector: container,
                domain: { type: 'month', padding: [10, 10, 10, 10] },
                subDomain: { type: 'day', radius: 2 },
                data: { source: workoutData, x: 'date', y: 'value' },
                scale: { color: { type: 'threshold', range: ['#cce5ff', '#80bfff', '#3399ff', '#0073e6'], domain: [1, 2, 3, 4] } },
                date: { start: new Date(new Date().getFullYear(), new Date().getMonth() - 5) },
            });
        } else {
             document.getElementById('consistencyHeatmap').innerHTML = '<p>No workout consistency data to display yet.</p>';
        }
    } catch (err) { 
        console.error('Failed to load workout consistency:', err);
        document.getElementById('consistencyHeatmap').innerHTML = '<p>Could not load consistency data.</p>';
    }
}

// --- END OF UNCHANGED CODE ---

// NEW: Fetches only the "Overview" tab data
export async function loadOverviewAnalytics() {
    try {
        const res = await fetch('/api/student/analytics/overview', { credentials: 'include' });
        const result = await res.json();

        if (result.success) {
            renderAverageSession(result.data.average);
            renderWeeklyHoursChart(result.data.weekly);
        } else {
            console.error('Failed to load overview analytics');
        }
    } catch (err) {
        console.error('Error fetching overview analytics:', err);
    }
}

// NEW: Fetches only the "Session History" tab data
export async function loadHistoryAnalytics() {
    try {
        const res = await fetch('/api/student/analytics/history', { credentials: 'include' });
        const result = await res.json();

        if (result.success) {
            renderSessionHistory(result.data.history);
            renderStudentStatusHistory(result.data.statusHistory);
        } else {
            console.error('Failed to load session history');
        }
    } catch (err) {
        console.error('Error fetching session history:', err);
    }
}

/**
 * Renders the "Average Session Time" stat.
 */
function renderAverageSession(avg) {
    const avgElement = document.getElementById('avg-session-time');
    avgElement.textContent = avg ? Math.round(avg) : '0';
}

/**
 * Renders the "Weekly Hours" bar chart.
 */
function renderWeeklyHoursChart(weeklyData) {
  if (!weeklyData || weeklyData.length === 0) {
    document.getElementById('weeklyHoursChart').parentElement.innerHTML = '<p>No weekly time data available yet.</p>';
    return;
  }

  const labels = weeklyData.map(w => moment(w.WeekStartDate).format('DD MMM'));
  const data = weeklyData.map(w => w.totalHours.toFixed(2));
  const canvasElement = document.getElementById('weeklyHoursChart');
  if (!canvasElement) return;
  const ctx = canvasElement.getContext('2d');

  if (weeklyHoursChart) weeklyHoursChart.destroy();

  const newChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Total Hours',
        data: data,
        backgroundColor: getComputedStyle(document.documentElement).getPropertyValue('data-theme') ? 'rgba(129,199,132,0.6)' : 'rgba(76,175,80,0.6)',
        borderColor: getComputedStyle(document.documentElement).getPropertyValue('data-theme') ? 'rgba(129,199,132,1)' : 'rgba(76,175,80,1)',
        borderWidth: 1
      }]
    },
    options: {
      scales: { y: { beginAtZero: true, title: { display: true, text: 'Hours' } } },
      plugins: { legend: { display: false } }
    }
  });
  setWeeklyHoursChart(newChart); // Save instance to global state
}

/**
 * Re-applies theme colors to the charts.
 */
export function applyChartTheme() {
  if (weeklyHoursChart) {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    weeklyHoursChart.data.datasets[0].backgroundColor = isDark ? 'rgba(129,199,132,0.6)' : 'rgba(76,175,80,0.6)';
    weeklyHoursChart.data.datasets[0].borderColor = isDark ? 'rgba(129,199,132,1)' : 'rgba(76,175,80,1)';
    weeklyHoursChart.update();
  }
}

/**
 * Renders the session history DataTable.
 * This version passes raw data to DataTables and uses render functions.
 */
function renderSessionHistory(historyData) {
    // 1. Destroy the DataTable instance FIRST
    if ($.fn.DataTable.isDataTable('#sessionHistoryTable')) {
        $('#sessionHistoryTable').DataTable().destroy();
    }

    // 2. Clear the HTML tbody
    const tbody = document.getElementById('sessionHistoryBody');
    tbody.innerHTML = ''; // Clear old rows/messages

    // 3. Handle empty data
    if (!historyData || historyData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4">No session history found.</td></tr>';
        return; // Don't initialize DataTable on an empty table
    }

    // 4. Initialize DataTable WITH data and column definitions
    $('#sessionHistoryTable').DataTable({
        // Pass the raw, sorted JSON data directly
        data: historyData,
        
        // Define what to do with the data for each column
        columns: [
            { 
                // Column 0: Date
                data: 'CreatedAt', // Use the 'CreatedAt' field
                render: function (data, type, row) {
                    // 'type' tells us what DataTables is doing
                    if (type === 'display') {
                        // For DISPLAY: show the formatted string
                        return moment.utc(data).tz("Asia/Kolkata").format('ddd, DD MMM YYYY');
                    } else {
                        // For SORTING: use the raw numerical timestamp
                        return moment.utc(data).valueOf();
                    }
                }
            },
            { 
                // Column 1: Check-in
                data: 'CreatedAt',
                render: function (data, type, row) {
                    return moment.utc(data).tz("Asia/Kolkata").format('h:mm A');
                }
            },
            { 
                // Column 2: Check-out
                data: 'OutTime',
                render: function (data, type, row) {
                    return data ? moment.utc(data).tz("Asia/Kolkata").format('h:mm A') : 'N/A';
                }
            },
            { 
                // Column 3: Duration
                data: 'DurationInMinutes',
                render: function (data, type, row) {
                    // This handles the 'N/A' and negative values from your data
                    if (data === null || typeof data === 'undefined') {
                        return 'N/A';
                    }
                    return data;
                }
            }
        ],

        // 5. Set the default sort order
        // This explicitly tells it to sort by Column 0 (our Date)
        // in descending ('desc') order.
        "order": [[0, 'desc']],
        
        // This is a good practice to ensure it cleanly replaces any old table
        "destroy": true,

        "responsive": true, // 1. This makes the table mobile-friendly

        "createdRow": function(row, data, dataIndex) {
            // 2. This function adds our custom classes
            const duration = data.DurationInMinutes;
            
            // Find the 4th cell (index 3) which is the duration cell
            const durationCell = $(row).find('td:eq(3)');

            if (duration === null || typeof duration === 'undefined' || duration < 0) {
                durationCell.addClass('duration-na');
            } else if (duration < 15) {
                durationCell.addClass('duration-short'); // Short workout
            } else if (duration < 60) {
                durationCell.addClass('duration-good'); // Good workout
            } else {
                durationCell.addClass('duration-long'); // Long workout
            }
        }


    });
    
}

function renderStudentStatusHistory(historyData) {
    if ($.fn.DataTable.isDataTable('#statusHistoryTable')) {
        $('#statusHistoryTable').DataTable().destroy();
    }

    const tbody = document.getElementById('statusHistoryBody');
    tbody.innerHTML = '';

    if (!historyData || historyData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7">No activation history found.</td></tr>';
        return;
    }

    $('#statusHistoryTable').DataTable({
        data: historyData,
        columns: [
            {
                data: 'ChangedAt',
                render: function (data, type) {
                    if (!data) return type === 'sort' ? 0 : 'N/A';
                    const utcValue = moment.utc(data);
                    return type === 'display'
                        ? utcValue.tz("Asia/Kolkata").format('ddd, DD MMM YYYY h:mm A')
                        : utcValue.valueOf();
                }
            },
            { data: 'ActionType', render: (data) => escapeHtmlValue(data || 'N/A') },
            { data: 'PreviousStatus', render: (data) => escapeHtmlValue(data || 'New Record') },
            { data: 'NewStatus', render: (data) => escapeHtmlValue(data || 'N/A') },
            { data: 'ChangedByRole', render: (data) => escapeHtmlValue(data || 'N/A') },
            { data: 'PreviousSlotName', render: (data) => escapeHtmlValue(data || 'N/A') },
            { data: 'ChangeReason', render: (data) => escapeHtmlValue(data || 'N/A') }
        ],
        order: [[0, 'desc']],
        destroy: true,
        responsive: true
    });
}
