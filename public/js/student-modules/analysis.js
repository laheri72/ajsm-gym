import {
    bodyPartChart, weeklyHoursChart,
    setBodyPartChart, setWeeklyHoursChart
} from './state.js';
import { generateColors } from './utils.js';
import { loadWidget, fetchJSON, creditedMinutes, elapsedMinutes } from './load-state.mjs';

const escapeHtmlValue = value => $('<div>').text(value ?? '').html();
const byId = id => document.getElementById(id);

export function loadStudentPlans(refresh = false) {
    return loadWidget('training-plans', byId('studentPlanTable'), async () => {
        const result = await fetchJSON('/api/student/training-plans');
        if ($.fn.DataTable.isDataTable('#studentPlanTable')) $('#studentPlanTable').DataTable().destroy();
        const tbody = document.querySelector('#studentPlanTable tbody');
        tbody.innerHTML = '';
        for (const plan of result.data) {
            const row = document.createElement('tr');
            row.innerHTML = `<td>${escapeHtmlValue(plan.LogDate)}</td><td>${plan.BodyParts
                ? plan.BodyParts.split(', ').map(part => `<span class="body-part-pill">${escapeHtmlValue(part)}</span>`).join('')
                : 'N/A'}</td>`;
            tbody.appendChild(row);
        }
        if (!result.data.length) tbody.innerHTML = '<tr><td colspan="2">No workout logs yet.</td></tr>';
        else $('#studentPlanTable').DataTable({ order: [[0, 'desc']], responsive: true });
    }, { refresh, label: 'workout logs' });
}

export function loadTrainingAnalytics(refresh = false) {
    return loadWidget('training-analytics', byId('bodyPartChart'), async () => {
        const result = await fetchJSON('/api/student/training-analytics');
        const canvas = byId('bodyPartChart');
        if (bodyPartChart) { bodyPartChart.destroy(); setBodyPartChart(null); }
        canvas.hidden = !result.data.length;
        emptyMessage(canvas, !result.data.length, 'No workout focus data yet.');
        if (!result.data.length) return;
        setBodyPartChart(new Chart(canvas.getContext('2d'), {
            type: 'pie',
            data: { labels: result.data.map(item => item.bodyPart), datasets: [{
                label: 'Workouts', data: result.data.map(item => item.count),
                backgroundColor: generateColors(result.data.length), borderColor: '#ffffff', borderWidth: 2
            }] },
            options: { responsive: true, plugins: { legend: { position: 'top' } } }
        }));
    }, { refresh, label: 'workout focus' });
}

let consistencyChart = null;
export function loadWorkoutConsistency(refresh = false) {
    return loadWidget('consistency', byId('consistencyHeatmap'), async () => {
        const result = await fetchJSON('/api/student/workout-calendar');
        if (consistencyChart) { await consistencyChart.destroy(); consistencyChart = null; }
        const container = byId('consistencyHeatmap');
        container.innerHTML = '';
        if (!result.data.length) {
            container.textContent = 'No workout consistency data yet.';
            return;
        }
        consistencyChart = new CalHeatmap();
        await consistencyChart.paint({
            itemSelector: container,
            domain: { type: 'month', padding: [10, 10, 10, 10] },
            subDomain: { type: 'day', radius: 2 },
            data: { source: result.data.map(date => ({ date, value: 1 })), x: 'date', y: 'value' },
            scale: { color: { type: 'threshold', range: ['#cce5ff', '#80bfff', '#3399ff', '#0073e6'], domain: [1, 2, 3, 4] } },
            date: { start: new Date(new Date().getFullYear(), new Date().getMonth() - 5) }
        });
    }, { refresh, label: 'workout consistency' });
}

export function loadOverviewAnalytics(refresh = false) {
    return loadWidget('analytics-overview', byId('avg-session-time'), async () => {
        const result = await fetchJSON('/api/student/analytics/overview');
        const average = creditedMinutes(result.data.average);
        byId('avg-session-time').textContent = average === null ? '—' : Math.round(average);
        emptyMessage(byId('avg-session-time'), average === null, 'No credited sessions recorded yet.');
        renderWeeklyHoursChart(result.data.weekly);
    }, { refresh, label: 'session averages and weekly hours' });
}

export function loadHistoryAnalytics(refresh = false) {
    return loadWidget('analytics-history', byId('sessionHistoryTable'), async () => {
        const result = await fetchJSON('/api/student/analytics/history');
        renderSessionHistory(result.data.history);
        renderStudentStatusHistory(result.data.statusHistory);
    }, { refresh, label: 'session and membership history' });
}

function emptyMessage(anchor, show, text) {
    let message = anchor.parentElement.querySelector(`[data-empty-for="${anchor.id}"]`);
    if (!message) {
        message = document.createElement('p');
        message.className = 'dashboard-explanation';
        message.dataset.emptyFor = anchor.id;
        anchor.after(message);
    }
    message.textContent = text;
    message.hidden = !show;
}

function renderWeeklyHoursChart(weeklyData) {
    const canvas = byId('weeklyHoursChart');
    if (weeklyHoursChart) { weeklyHoursChart.destroy(); setWeeklyHoursChart(null); }
    canvas.hidden = !weeklyData?.length;
    emptyMessage(canvas, !weeklyData?.length, 'No weekly credited hours available yet.');
    if (!weeklyData?.length) return;
    const dark = document.documentElement.getAttribute('data-theme') === 'dark';
    setWeeklyHoursChart(new Chart(canvas.getContext('2d'), {
        type: 'bar',
        data: {
            labels: weeklyData.map(week => moment(week.WeekStartDate).format('DD MMM')),
            datasets: [{ label: 'Credited hours', data: weeklyData.map(week => Number(week.totalHours).toFixed(2)),
                backgroundColor: dark ? 'rgba(129,199,132,0.6)' : 'rgba(76,175,80,0.6)',
                borderColor: dark ? 'rgba(129,199,132,1)' : 'rgba(76,175,80,1)', borderWidth: 1 }]
        },
        options: { scales: { y: { beginAtZero: true, title: { display: true, text: 'Credited hours' } } },
            plugins: { legend: { display: false } } }
    }));
}

export function applyChartTheme() {
    if (!weeklyHoursChart) return;
    const dark = document.documentElement.getAttribute('data-theme') === 'dark';
    weeklyHoursChart.data.datasets[0].backgroundColor = dark ? 'rgba(129,199,132,0.6)' : 'rgba(76,175,80,0.6)';
    weeklyHoursChart.data.datasets[0].borderColor = dark ? 'rgba(129,199,132,1)' : 'rgba(76,175,80,1)';
    weeklyHoursChart.update();
}

function tableData(selector, bodyId, rows, columns, emptyText) {
    if ($.fn.DataTable.isDataTable(selector)) $(selector).DataTable().destroy();
    const body = byId(bodyId);
    body.innerHTML = '';
    if (!rows?.length) {
        body.innerHTML = `<tr><td colspan="${columns.length}">${emptyText}</td></tr>`;
        return;
    }
    $(selector).DataTable({ data: rows, columns, order: [[0, 'desc']], destroy: true, responsive: true });
}

function timestamp(value, type, format) {
    const date = value ? moment.utc(value) : null;
    if (!date?.isValid()) return type === 'display' ? '—' : 0;
    return type === 'display' ? date.tz('Asia/Kolkata').format(format) : date.valueOf();
}

function renderSessionHistory(rows) {
    tableData('#sessionHistoryTable', 'sessionHistoryBody', rows, [
        { data: 'CreatedAt', render: (value, type) => timestamp(value, type, 'ddd, DD MMM YYYY') },
        { data: 'CreatedAt', render: (value, type) => timestamp(value, type, 'h:mm A') },
        { data: 'OutTime', render: (value, type) => timestamp(value, type, 'h:mm A') },
        { data: null, render: (_value, type, row) => {
            const minutes = elapsedMinutes(row.CreatedAt, row.OutTime);
            return minutes ?? (type === 'display' ? '—' : -1);
        } },
        { data: 'DurationInMinutes', render: (value, type) => creditedMinutes(value) ?? (type === 'display' ? '—' : -1) }
    ], 'No completed sessions recorded yet.');
}

function renderStudentStatusHistory(rows) {
    tableData('#statusHistoryTable', 'statusHistoryBody', rows, [
        { data: 'ChangedAt', render: (value, type) => timestamp(value, type, 'ddd, DD MMM YYYY h:mm A') },
        { data: 'ActionType', render: value => escapeHtmlValue(value || '—') },
        { data: 'PreviousStatus', render: value => escapeHtmlValue(value || 'New Record') },
        { data: 'NewStatus', render: value => escapeHtmlValue(value || '—') },
        { data: 'PreviousSlotName', render: value => escapeHtmlValue(value || '—') },
        { data: 'NewSlotName', render: value => escapeHtmlValue(value || '—') }
    ], 'No membership changes recorded yet.');
}