import { 
    allLeaveRequests, leaveHistoryTable, 
    setAllLeaveRequests, setLeaveHistoryTable 
} from './state.js';

// ─── IST time helper ────────────────────────────────────────────────────────
function getISTHourMinute() {
    const now = moment.tz('Asia/Kolkata');
    return { hour: now.hour(), minute: now.minute() };
}

function isLeaveWindowOpen() {
    const { hour, minute } = getISTHourMinute();
    if (hour < 15) return false;
    if (hour > 22) return false;
    if (hour === 22 && minute > 30) return false;
    return true;
}

// ─── Window-status badge ────────────────────────────────────────────────────
function renderWindowBadge() {
    const badge = document.getElementById('leaveWindowBadge');
    if (!badge) return;

    const { hour, minute } = getISTHourMinute();
    const open = isLeaveWindowOpen();

    if (open) {
        badge.className = 'leave-window-badge open';
        badge.innerHTML = '<i class="bi bi-circle-fill"></i> Leave window is <strong>Open</strong> — closes at 10:30 PM';
    } else {
        const isBeforeOpen = hour < 15;
        badge.className = 'leave-window-badge closed';
        if (isBeforeOpen) {
            badge.innerHTML = '<i class="bi bi-clock"></i> Leave window is <strong>Closed</strong> — opens at 3:00 PM today';
        } else {
            badge.innerHTML = '<i class="bi bi-moon-stars"></i> Leave window is <strong>Closed</strong> — opens at 3:00 PM tomorrow';
        }
    }

    // Disable/enable form fields based on window state
    const form = document.getElementById('leaveRequestForm');
    if (form) {
        const fields = form.querySelectorAll('input, textarea, button[type="submit"]');
        fields.forEach(el => {
            if (!open) {
                el.setAttribute('disabled', true);
            } else {
                el.removeAttribute('disabled');
            }
        });
    }
}

// ─── Flatpickr date pickers ─────────────────────────────────────────────────
let fpStart = null;
let fpEnd   = null;

function initLeaveDatePickers() {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    const maxDay = new Date();
    maxDay.setDate(maxDay.getDate() + 15);
    maxDay.setHours(23, 59, 59, 999);

    fpStart = flatpickr('#leaveStartDate', {
        dateFormat: 'Y-m-d',
        minDate: tomorrow,
        maxDate: maxDay,
        disableMobile: false,
        onChange(selectedDates) {
            if (fpEnd && selectedDates[0]) {
                fpEnd.set('minDate', selectedDates[0]);
            }
        }
    });

    fpEnd = flatpickr('#leaveEndDate', {
        dateFormat: 'Y-m-d',
        minDate: tomorrow,
        maxDate: maxDay,
        disableMobile: false,
    });
}

// ─── Quick-reason chips ─────────────────────────────────────────────────────
function initReasonChips() {
    const chipContainer = document.getElementById('leaveReasonChips');
    if (!chipContainer) return;

    const reasons = ['University Exam', 'Medical / Sick', 'Family Event', 'Traveling', 'Other'];
    chipContainer.innerHTML = reasons.map(r =>
        `<button type="button" class="reason-chip" data-reason="${r}">${r}</button>`
    ).join('');

    chipContainer.addEventListener('click', (e) => {
        const chip = e.target.closest('.reason-chip');
        if (!chip) return;
        const textarea = document.getElementById('leaveReason');
        if (textarea) {
            textarea.value = chip.dataset.reason;
            chipContainer.querySelectorAll('.reason-chip').forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
        }
    });
}

// ─── Leave quota progress bar ───────────────────────────────────────────────
function renderLeaveQuotaBar(leavesTaken) {
    const bar = document.getElementById('leaveQuotaBar');
    const label = document.getElementById('leaveQuotaLabel');
    if (!bar || !label) return;

    const pct = Math.min((leavesTaken / 4) * 100, 100);
    let color = 'var(--bs-success)';
    if (leavesTaken >= 3) color = 'var(--bs-danger)';
    else if (leavesTaken >= 2) color = 'var(--bs-warning)';

    bar.style.width = `${pct}%`;
    bar.style.backgroundColor = color;
    label.textContent = `${leavesTaken} / 4 personal leaves used this month`;
}

// ─── Initialise all leave UX (called on tab open) ───────────────────────────
export function initLeaveUX() {
    initLeaveDatePickers();
    initReasonChips();
    renderWindowBadge();
    // Refresh badge every minute
    setInterval(renderWindowBadge, 60_000);
}

/**
 * Main function to fetch all leave data for the student.
 */
export async function loadLeaveData(refresh = false) {
    try {
        const url = refresh 
            ? `/api/student/leaves?fresh=${Date.now()}`
            : `/api/student/leaves`;

        const res = await fetch(url, { 
            credentials: 'include',
            cache: refresh ? 'no-store' : 'default'
        });

        const data = await res.json();

        if (data.success) {
            const allRequests = data.currentMonthRequests.concat(data.historyRequests);
            
            setAllLeaveRequests(allRequests); // Save to global state

            document.getElementById('leavesTakenCount').textContent = data.leavesTaken;

            renderLeaveQuotaBar(data.leavesTaken);
            renderLeaveTable(allRequests);  // <-- always render
            
        } else {
            Swal.fire('Error', 'Could not load your leave data.', 'error');
        }
    } catch (err) {
        console.error('Error fetching leave data:', err);
    }
}


/**
 * Renders the provided leave requests into the status table using DataTables.
 */
function renderLeaveTable(leaves) {
    if ($.fn.DataTable.isDataTable('#leaveStatusTable')) {
        leaveHistoryTable.clear().rows.add(leaves).draw();
    } else {
        const newTable = $('#leaveStatusTable').DataTable({
            data: leaves,
            columns: [
                { data: 'LeaveID', visible: false },
                { 
                    title: 'Leave Dates', data: null,
                    render: (data, type, row) => {
                        const start = moment(row.LeaveStartDate).format('MMM D');
                        const end = moment(row.LeaveEndDate).format('MMM D');
                        const isBulk = row.Remarks && row.Remarks.includes('Bulk Leaves');
                        const tag = isBulk ? ' <span class="badge bg-secondary" title="Generated by Admin">Holiday</span>' : '';
                        return (start === end ? start : `${start} to ${end}`) + tag;
                    }
                },
                { 
                    title: 'Status', data: 'Status',
                    render: (data) => {
                        const statusClasses = { 'Approved': 'badge-green', 'Rejected': 'badge-red', 'On Hold': 'badge-yellow', 'Pending': 'badge-gray' };
                        return `<span class="badge ${statusClasses[data] || 'badge-gray'}">${data}</span>`;
                    }
                },
                { title: 'Reason', data: 'Reason' },
                { title: 'Staff Remarks', data: 'Remarks', render: (data) => {
                    if (!data) return 'N/A';
                    if (data.includes('Bulk Leaves')) return '<em class="text-muted">System generated</em>';
                    return data;
                }},
                { 
                    title: 'Action', data: 'LeaveID', orderable: false,
                    render: (data, type, row) => {
                        if (row.Status === 'Pending') {
                            return `<button class="btn btn-sm btn-danger cancel-leave-btn" data-id="${data}">Cancel</button>`;
                        }
                        return 'N/A';
                    }
                }
            ],
            responsive: true,
            order: [[0, 'desc']], // Sort by hidden LeaveID
            pageLength: 5,
            lengthChange: false,
            language: { emptyTable: "You have no leave requests." }
        });
        setLeaveHistoryTable(newTable); // Save instance to global state
    }
}

/**
 * Handles the submission of the leave request form.
 */
export async function handleLeaveSubmit(e) {
    e.preventDefault();
    const startDate = document.getElementById('leaveStartDate').value;
    const endDate = document.getElementById('leaveEndDate').value;
    const reason = document.getElementById('leaveReason').value.trim();
    const submitBtn = e.target.querySelector('button[type="submit"]');

    if (!startDate || !endDate || !reason) {
        Swal.fire('Missing Information', 'Please fill out all fields.', 'warning');
        return;
    }
    if (moment(endDate).isBefore(moment(startDate))) {
        Swal.fire('Invalid Dates', 'End date cannot be before the start date.', 'error');
        return;
    }

    submitBtn.disabled = true;
    submitBtn.querySelector('.button-text').classList.add('d-none');
    submitBtn.querySelector('.spinner-border').classList.remove('d-none');

    try {
        const res = await fetch('/api/student/leaves', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ leaveStartDate: startDate, leaveEndDate: endDate, reason: reason })
        });

        const result = await res.json();
        if (!res.ok) throw new Error(result.message);

        Swal.fire('Success', 'Your leave request has been submitted.', 'success');
        e.target.reset();
        // Reset flatpickr instances after form reset
        if (fpStart) fpStart.clear();
        if (fpEnd) fpEnd.clear();
        document.querySelectorAll('#leaveReasonChips .reason-chip').forEach(c => c.classList.remove('active'));
        loadLeaveData(true); // Refresh the data

    } catch (err) {
        Swal.fire('Submission Failed', err.message, 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.querySelector('.button-text').classList.remove('d-none');
        submitBtn.querySelector('.spinner-border').classList.add('d-none');
    }
}

/**
 * Handles the click event for cancelling a pending leave request.
 */
export function handleLeaveCancel(e) {
    if (!e.target.classList.contains('cancel-leave-btn')) return;
    
    const leaveID = e.target.dataset.id;
    Swal.fire({
        title: 'Are you sure?',
        text: "You won't be able to revert this!",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#3085d6',
        cancelButtonColor: '#d33',
        confirmButtonText: 'Yes, cancel it!'
    }).then(async (result) => {
        if (result.isConfirmed) {
            try {
                const res = await fetch(`/api/student/leaves/${leaveID}`, {
                    method: 'DELETE',
                    credentials: 'include'
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.message);
                
                Swal.fire('Cancelled!', 'Your leave request has been cancelled.', 'success');
                loadLeaveData(true); // Refresh the list
            } catch (err) {
                Swal.fire('Error', `Could not cancel request: ${err.message}`, 'error');
            }
        }
    });
}