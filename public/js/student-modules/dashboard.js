/**
 * Fetches and displays key stats for the "Today" dashboard,
 * like the consistency streak.
 */
export async function loadDashboardStats() {
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
