/**
 * Fetches and displays key stats for the "Today" dashboard,
 * like the consistency streak.
 */
export async function loadDashboardStats() {
    bindAttendanceSnapshotDetails();
    loadAttendanceSnapshot();

    try {
        const res = await fetch('/api/student/achievements/progress', { credentials: 'include' });
        const result = await res.json();

        if (result.success) {
            const progress = result.data;
            const consistency = progress.consistency;

            const currentStreak = consistency.current || 0;
            const personalBest = consistency.personalBest || 0; 

            document.getElementById('stat-current-streak').textContent = `${currentStreak} Days`;
            document.getElementById('stat-best-streak').textContent = `(Best: ${personalBest} Days)`;

            const progressPercent = (personalBest > 0) 
                ? Math.min((currentStreak / personalBest) * 100, 100) 
                : 0;

            const streakFill = document.getElementById('stat-streak-progress-fill');
            if (streakFill) {
                streakFill.style.width = `${progressPercent}%`;
            }

            const motivationText = document.getElementById('streak-motivation-text');
            if (currentStreak > 0) {
                if (currentStreak >= personalBest && personalBest > 0) {
                     motivationText.textContent = "You're on a new personal best streak!";
                } else if (personalBest > 0) {
                     motivationText.textContent = `You're ${progressPercent.toFixed(0)}% of your personal best!`;
                } else {
                     motivationText.textContent = "Great start! Keep it up!";
                }
            } else {
                 motivationText.textContent = "Start a new streak today!";
            }
        }
    } catch (err) {
        console.error("Could not load dashboard stats:", err);
    }
}

let attendanceSnapshotDetailsBound = false;
let attendanceDetailModalInstance = null;

function escapeHtml(value = '') {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function bindAttendanceSnapshotDetails() {
    if (attendanceSnapshotDetailsBound) return;
    attendanceSnapshotDetailsBound = true;

    document.querySelectorAll('[data-attendance-detail]').forEach(button => {
        button.addEventListener('click', () => {
            openAttendanceDetailModal(button.dataset.attendanceDetail);
        });
    });
}

function setAttendanceDetailLoading(type) {
    const titleEl = document.getElementById('attendanceDetailModalLabel');
    const subtitleEl = document.getElementById('attendanceDetailModalSubtitle');
    const headEl = document.getElementById('attendanceDetailHead');
    const bodyEl = document.getElementById('attendanceDetailBody');
    const emptyEl = document.getElementById('attendanceDetailEmpty');

    const title = type === 'present' ? 'Present Details' : 'On Leave Details';
    if (titleEl) titleEl.textContent = title;
    if (subtitleEl) subtitleEl.textContent = 'Loading records...';
    if (headEl) headEl.innerHTML = '';
    if (bodyEl) bodyEl.innerHTML = '<tr><td class="text-center text-muted py-4">Loading...</td></tr>';
    if (emptyEl) emptyEl.style.display = 'none';
}

function renderAttendanceDetailRows(type, rows) {
    const subtitleEl = document.getElementById('attendanceDetailModalSubtitle');
    const headEl = document.getElementById('attendanceDetailHead');
    const bodyEl = document.getElementById('attendanceDetailBody');
    const emptyEl = document.getElementById('attendanceDetailEmpty');

    if (!headEl || !bodyEl || !emptyEl) return;

    if (type === 'present') {
        headEl.innerHTML = `
            <tr>
              <th>Hijri Date</th>
              <th>Date</th>
              <th>Day</th>
              <th>Time of Present</th>
            </tr>
        `;
        bodyEl.innerHTML = rows.map(row => `
            <tr>
              <td>${escapeHtml(row.hijriDate || '-')}</td>
              <td>${escapeHtml(row.date || '-')}</td>
              <td>${escapeHtml(row.day || '-')}</td>
              <td>${escapeHtml(row.time || '-')}</td>
            </tr>
        `).join('');
    } else {
        headEl.innerHTML = `
            <tr>
              <th>Hijri Start</th>
              <th>Start Date</th>
              <th>End Date</th>
              <th>Day</th>
              <th>Reason</th>
            </tr>
        `;
        bodyEl.innerHTML = rows.map(row => `
            <tr>
              <td>${escapeHtml(row.hijriStartDate || '-')}</td>
              <td>${escapeHtml(row.startDate || '-')}</td>
              <td>${escapeHtml(row.endDate || '-')}</td>
              <td>${escapeHtml(row.day || '-')}</td>
              <td>${escapeHtml(row.reason || '-')}</td>
            </tr>
        `).join('');
    }

    if (subtitleEl) {
        const label = rows.length === 1 ? 'record' : 'records';
        subtitleEl.textContent = `${rows.length} ${label} found`;
    }

    const hasRows = rows.length > 0;
    bodyEl.style.display = hasRows ? '' : 'none';
    emptyEl.style.display = hasRows ? 'none' : 'block';
}

async function openAttendanceDetailModal(type) {
    if (!['present', 'onLeave'].includes(type)) return;

    const modalEl = document.getElementById('attendanceDetailModal');
    if (!modalEl) return;

    attendanceDetailModalInstance = attendanceDetailModalInstance || new bootstrap.Modal(modalEl);
    setAttendanceDetailLoading(type);
    attendanceDetailModalInstance.show();

    try {
        const res = await fetch(`/api/student/attendance-details/${type}`, {
            credentials: 'include',
            cache: 'no-store'
        });
        const result = await res.json();

        if (!res.ok || !result.success) {
            throw new Error(result.message || 'Could not load attendance details.');
        }

        renderAttendanceDetailRows(type, result.rows || []);
    } catch (err) {
        console.error('Could not load attendance details:', err);
        const subtitleEl = document.getElementById('attendanceDetailModalSubtitle');
        const bodyEl = document.getElementById('attendanceDetailBody');
        if (subtitleEl) subtitleEl.textContent = 'Unable to load records.';
        if (bodyEl) bodyEl.innerHTML = '<tr><td class="text-center text-danger py-4">Unable to load records right now.</td></tr>';
    }
}

function setSnapshotStatus(message, state = '') {
    const card = document.getElementById('attendanceSnapshotCard');
    const statusText = document.getElementById('snapshotStatusText');

    if (card) {
        card.classList.toggle('is-error', state === 'error');
        card.classList.toggle('is-empty', state === 'empty');
    }

    if (statusText) {
        statusText.textContent = message;
    }
}

function setSnapshotCounts({ present = '--', absent = '--', onLeave = '--' }) {
    const presentEl = document.getElementById('snapshotPresentCount');
    const absentEl = document.getElementById('snapshotAbsentCount');
    const leaveEl = document.getElementById('snapshotLeaveCount');

    if (presentEl) presentEl.textContent = present;
    if (absentEl) absentEl.textContent = absent;
    if (leaveEl) leaveEl.textContent = onLeave;
}

function setSnapshotRate(rate) {
    const rateEl = document.getElementById('snapshotAttendanceRate');
    const fillEl = document.getElementById('snapshotRateFill');
    const hasRate = Number.isFinite(Number(rate));
    const safeRate = hasRate ? Math.max(0, Math.min(Number(rate), 100)) : 0;

    if (rateEl) rateEl.textContent = hasRate ? `${Number(rate).toFixed(1)}%` : '--%';
    if (fillEl) fillEl.style.width = `${safeRate}%`;
}

function formatSnapshotDate(value) {
    if (!value) return '';
    const parsed = moment(value);
    return parsed.isValid() ? parsed.format('MMM D, YYYY') : '';
}

export async function loadAttendanceSnapshot() {
    const card = document.getElementById('attendanceSnapshotCard');
    if (!card) return;

    setSnapshotCounts({});
    setSnapshotRate(null);
    setSnapshotStatus('Loading your attendance summary...');

    try {
        const res = await fetch('/api/student/attendance-summary/me', { credentials: 'include' });
        const result = await res.json();

        if (!res.ok || !result.success) {
            throw new Error(result.message || result.error || 'Could not load attendance summary.');
        }

        const data = result.data || {};
        setSnapshotCounts({
            present: data.present ?? 0,
            absent: data.absent ?? 0,
            onLeave: data.onLeave ?? 0
        });
        setSnapshotRate(data.attendanceRate);

        const rangeLabel = document.getElementById('snapshotRangeLabel');
        const joinedAtLabel = formatSnapshotDate(data.joinedAt);
        if (rangeLabel) {
            rangeLabel.textContent = joinedAtLabel ? `Since ${joinedAtLabel}` : 'Since joining';
        }

        if (data.isGymMember === false) {
            setSnapshotStatus('Attendance unlocks after gym membership activation.', 'empty');
            return;
        }

        if ((data.expectedDays || 0) === 0) {
            setSnapshotStatus('No eligible attendance days yet.', 'empty');
            return;
        }

        const expectedLabel = data.expectedDays === 1 ? 'expected day' : 'expected days';
        setSnapshotStatus(`${data.expectedDays} ${expectedLabel} counted.`);
    } catch (err) {
        console.error('Could not load attendance snapshot:', err);
        setSnapshotCounts({ present: 0, absent: 0, onLeave: 0 });
        setSnapshotRate(null);
        setSnapshotStatus('Unable to load attendance summary right now.', 'error');
    }
}
