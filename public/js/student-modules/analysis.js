import { 
    bodyPartChart, weeklyHoursChart,
    setBodyPartChart, setWeeklyHoursChart 
} from './state.js';
import { generateColors } from './utils.js';

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
    tbody.innerHTML = ''; 

    if ($.fn.DataTable.isDataTable('#studentPlanTable')) {
        $('#studentPlanTable').DataTable().destroy();
    }

    plans.forEach(plan => {
        const tr = document.createElement('tr');
        const dateTd = document.createElement('td');
        dateTd.textContent = plan.LogDate;
        const partsTd = document.createElement('td');
        
        if (plan.BodyParts) {
            const partsArray = plan.BodyParts.split(', ');
            partsTd.innerHTML = partsArray.map(part => 
                `<span class="body-part-pill">${part}</span>`
            ).join('');
        } else {
            partsTd.textContent = 'N/A';
        }
        
        tr.appendChild(dateTd);
        tr.appendChild(partsTd);
        tbody.appendChild(tr);
    });
    $('#studentPlanTable').DataTable();
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

/**
 * Fetches all session analytics (avg time, weekly hours, history).
 */
export async function loadSessionAnalytics() {
    try {
        const res = await fetch('/api/student/session-analytics', { credentials: 'include' });
        const result = await res.json();

        if (result.success) {
            renderAverageSession(result.data.average);
            renderWeeklyHoursChart(result.data.weekly);
            renderSessionHistory(result.data.history);
        } else {
            console.error('Failed to load session analytics');
        }
    } catch (err) {
        console.error('Error fetching session analytics:', err);
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
 */
function renderSessionHistory(historyData) {
    const tbody = document.getElementById('sessionHistoryBody');
    tbody.innerHTML = ''; 

    if ($.fn.DataTable.isDataTable('#sessionHistoryTable')) {
        $('#sessionHistoryTable').DataTable().destroy();
    }

    if (!historyData || historyData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4">No session history found.</td></tr>';
        return;
    }

    historyData.forEach(session => {
        const date = moment.utc(session.CreatedAt).tz("Asia/Kolkata").format('ddd, DD MMM YYYY');
        const inTime = moment.utc(session.CreatedAt).tz("Asia/Kolkata").format('h:mm A');
        const outTime = session.OutTime ? moment.utc(session.OutTime).tz("Asia/Kolkata").format('h:mm A') : 'N/A';

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${date}</td>
            <td>${inTime}</td>
            <td>${outTime}</td>
            <td>${session.DurationInMinutes || 'N/A'}</td>
        `;
        tbody.appendChild(tr);
    });
    $('#sessionHistoryTable').DataTable();
}