document.addEventListener("DOMContentLoaded", () => {
    // PASTE THIS FUNCTION HERE
    function makeTableResponsive(tableId) {
        const table = document.getElementById(tableId);
        if (!table) return;

        const headers = Array.from(table.querySelectorAll('thead th')).map(th => th.textContent.trim());

        table.querySelectorAll('tbody tr').forEach(row => {
            row.querySelectorAll('td').forEach((td, index) => {
                if (headers[index]) {
                    td.setAttribute('data-label', headers[index]);
                }
            });
        });
    }

    let pendingLeavesTable = null;
    let historyLeavesTable = null;

    // --- VIEW TOGGLING LOGIC ---
    const pendingView = document.getElementById('pending-view');
    const historyView = document.getElementById('history-view');
    const historyInsights = document.getElementById('view-history-insights');
    const viewPendingBtn = document.getElementById('viewPendingBtn');
    const viewHistoryBtn = document.getElementById('viewHistoryBtn');
    const pendingLeaveCount = document.getElementById('pendingLeaveCount');
    const historyLeaveCount = document.getElementById('historyLeaveCount');
    const pendingLeaveTabCount = document.getElementById('pendingLeaveTabCount');
    const historyLeaveTabCount = document.getElementById('historyLeaveTabCount');

    function setCounter(elements, count) {
        elements.forEach(el => {
            if (el) el.textContent = String(count);
        });
    }

    async function refreshHistoryCountPreview() {
        if (historyLeavesTable) return;

        try {
            const res = await fetch('/api/staff/leaves/history', { credentials: 'include' });
            const json = await res.json();
            if (!res.ok || !json.success) throw new Error(json.message || 'Failed to load leave history count.');
            const rows = json.data || [];
            setCounter([historyLeaveCount, historyLeaveTabCount], rows.length);
            updateReasonInsights(rows);
        } catch (err) {
            console.error('Unable to load leave history count:', err);
            setCounter([historyLeaveCount, historyLeaveTabCount], 0);
        }
    }

    function updateReasonInsights(rows) {
        const container = document.getElementById('reason-insights-container');
        if (!container) return;

        if (!rows || !rows.length) {
            container.innerHTML = '<p class="text-muted mb-0 small">No processed leave records found to analyze.</p>';
            return;
        }

        // Group by Reason (case-insensitive grouping for better clustering)
        const groups = {};
        rows.forEach(row => {
            const rawReason = (row.Reason || 'Unspecified').trim();
            const key = rawReason.toLowerCase();
            if (!groups[key]) {
                groups[key] = { text: rawReason, count: 0 };
            }
            groups[key].count++;
        });

        const sorted = Object.values(groups).sort((a, b) => b.count - a.count);

        container.innerHTML = sorted.map(g => `
            <div class="reason-insight-chip d-flex align-items-center bg-white border px-3 py-2" 
                 style="border-radius: 10px; font-size: 0.85rem; color: #555; transition: all 0.2s ease;">
                <span class="fw-medium me-2">${g.text}</span>
                <span class="badge rounded-pill bg-primary" style="font-size: 0.7rem;">${g.count}</span>
            </div>
        `).join('');
    }

    viewPendingBtn.addEventListener('click', () => {
        pendingView.style.display = 'block';
        historyView.style.display = 'none';
        if (historyInsights) historyInsights.style.display = 'none';
        viewPendingBtn.classList.add('active');
        viewHistoryBtn.classList.remove('active');
        viewPendingBtn.setAttribute('aria-selected', 'true');
        viewHistoryBtn.setAttribute('aria-selected', 'false');
    });

    viewHistoryBtn.addEventListener('click', () => {
        pendingView.style.display = 'none';
        historyView.style.display = 'block';
        if (historyInsights) historyInsights.style.display = 'block';
        viewPendingBtn.classList.remove('active');
        viewHistoryBtn.classList.add('active');
        viewPendingBtn.setAttribute('aria-selected', 'false');
        viewHistoryBtn.setAttribute('aria-selected', 'true');
        // Load history table only when it's first viewed
        if (!historyLeavesTable) {
            loadLeaveHistory();
        }
    });

    // --- DATATABLE INITIALIZATION ---

    function loadPendingLeaves() {
        if (pendingLeavesTable) {
            pendingLeavesTable.ajax.reload();
            return;
        }
// REPLACE the old pendingLeavesTable initialization with this one

pendingLeavesTable = $('#pendingLeavesTable').DataTable({
    ajax: {
        url: '/api/staff/leaves/pending',
        dataSrc: (json) => {
            const rows = json.data || [];
            setCounter([pendingLeaveCount, pendingLeaveTabCount], rows.filter(row => row.Status === 'Pending').length);
            return rows;
        }
    },
    columns: [
        { 
            data: 'StudentName',
            render: (data, type, row) => {
                const taken = row.LeavesTakenThisMonth || 0;
                const badgeClass = taken >= 4 ? 'bg-danger' : taken >= 3 ? 'bg-warning text-dark' : 'bg-info text-dark';
                const quotaBadge = `<span class="badge ${badgeClass} leave-quota-badge" title="Personal leaves used this month (excl. holidays)">${taken}/4 Leaves</span>`;
                const holdBadge = row.Status === 'On Hold' ? ` <span class="badge bg-warning text-dark leave-status-chip">On Hold</span>` : '';
                return `<div class="leave-student-cell"><strong>${data}</strong>${holdBadge}<small>${quotaBadge}</small></div>`;
            }
        },
        { data: 'TR' },
        { 
            data: null,
            render: (data, type, row) => {
                const start = moment(row.LeaveStartDate).format('MMM D');
                const end = moment(row.LeaveEndDate).format('MMM D');
                return start === end ? start : `${start} - ${end}`;
            }
        },
        { data: 'Reason' },
        { data: 'RequestedAt', render: (data) => moment(data).format('MMM D, h:mm A') },
        {
            data: 'LeaveID', 
            orderable: false,
            // --- ▼▼▼ THIS IS THE ONLY CHANGE ▼▼▼ ---
            render: (data, type, row) => {
                // Conditionally create the 'On Hold' button.
                // If the status is 'On Hold', this variable will be an empty string.
                const onHoldButton = row.Status !== 'On Hold' 
                    ? `<button class="btn btn-sm btn-warning on-hold-btn" data-id="${data}" data-name="${row.StudentName}">On Hold</button>` 
                    : '';

                // Return the full button group HTML, which now may or may not include the On Hold button.
                return `
                    <div class="btn-group" role="group">
                        <button class="btn btn-sm btn-success approve-btn" data-id="${data}" data-name="${row.StudentName}">Approve</button>
                        ${onHoldButton}
                        <button class="btn btn-sm btn-danger reject-btn" data-id="${data}" data-name="${row.StudentName}">Reject</button>
                    </div>
                `;
            }
        }
    ],
    responsive: true, 
    order: [[4, 'asc']],
    language: { emptyTable: "No pending leave requests found." },
    drawCallback: () => makeTableResponsive('pendingLeavesTable')
});
    }

    function loadLeaveHistory() {
        historyLeavesTable = $('#historyLeavesTable').DataTable({
            ajax: {
                url: '/api/staff/leaves/history',
                dataSrc: (json) => {
                    const rows = json.data || [];
                    setCounter([historyLeaveCount, historyLeaveTabCount], rows.length);
                    updateReasonInsights(rows);
                    return rows;
                }
            },
            columns: [
                { data: 'StudentName' },
                { 
                    data: null,
                    render: (data, type, row) => {
                        const start = moment(row.LeaveStartDate).format('MMM D');
                        const end = moment(row.LeaveEndDate).format('MMM D');
                        return start === end ? start : `${start} - ${end}`;
                    }
                },
                { 
                    data: 'Status',
                    render: (data) => {
                        const statusColors = {
                            'Approved': 'text-success',
                            'Rejected': 'text-danger',
                            'On Hold': 'text-warning'
                        };
                        return `<strong class="${statusColors[data] || ''}">${data}</strong>`;
                    }
                },
                { data: 'ReviewedBy' },
                { data: 'ReviewedAt', render: (data) => moment(data).format('MMM D, YYYY') },
                { data: 'Reason', render: (data) => data || '-' }
            ],
            responsive: true, order: [[4, 'desc']],
            language: { emptyTable: "No historical leave records found." },
            drawCallback: () => makeTableResponsive('historyLeavesTable')
        });
    }

    // --- ACTION HANDLING ---

    async function updateLeaveStatus(leaveID, status, remarks = '') {
        try {
            const res = await fetch(`/api/staff/leaves/${leaveID}/status`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status, remarks })
            });
            const result = await res.json();
            if (!res.ok) throw new Error(result.message);
            
            Swal.fire({
                toast: true, position: 'top-end', icon: 'success',
                title: `Request has been ${status.toLowerCase()}.`,
                showConfirmButton: false, timer: 3000
            });
            pendingLeavesTable.ajax.reload();
            if (historyLeavesTable) {
                historyLeavesTable.ajax.reload();
            } else {
                refreshHistoryCountPreview();
            }
            if (typeof window.staffNotificationsRefresh === 'function') {
                window.staffNotificationsRefresh();
            }
        } catch (err) {
            Swal.fire('Error', `Failed to update status: ${err.message}`, 'error');
        }
    }

    // --- DELEGATED EVENT LISTENERS (for buttons in the pending table) ---

    $('#pendingLeavesTable').on('click', '.approve-btn', function() {
        const leaveID = $(this).data('id');
        const studentName = $(this).data('name');
        Swal.fire({
            title: 'Approve Leave?', text: `Approve the request for ${studentName}?`,
            icon: 'question', showCancelButton: true, confirmButtonColor: 'var(--primary)',
            cancelButtonColor: 'var(--gray)', confirmButtonText: 'Yes, Approve'
        }).then((result) => {
            if (result.isConfirmed) {
                updateLeaveStatus(leaveID, 'Approved');
            }
        });
    });

    $('#pendingLeavesTable').on('click', '.on-hold-btn', function() {
        const leaveID = $(this).data('id');
        const studentName = $(this).data('name');
        Swal.fire({
            title: `Put Request On Hold for ${studentName}?`, input: 'text',
            inputLabel: 'Reason / Remarks (e.g., "Please see me in the office.")',
            inputPlaceholder: 'Enter remarks here...', showCancelButton: true,
            confirmButtonText: 'Confirm', confirmButtonColor: 'var(--primary)',
            cancelButtonColor: 'var(--gray)',
        }).then((result) => {
            if (result.isConfirmed) {
                updateLeaveStatus(leaveID, 'On Hold', result.value || '');
            }
        });
    });

    $('#pendingLeavesTable').on('click', '.reject-btn', function() {
        const leaveID = $(this).data('id');
        const studentName = $(this).data('name');
        Swal.fire({
            title: `Reject Request for ${studentName}?`, input: 'text',
            inputLabel: 'Reason for Rejection (Optional)',
            inputPlaceholder: 'Enter remarks here...', showCancelButton: true,
            confirmButtonText: 'Yes, Reject', confirmButtonColor: 'var(--danger)',
            cancelButtonColor: 'var(--gray)',
        }).then((result) => {
            if (result.isConfirmed) {
                updateLeaveStatus(leaveID, 'Rejected', result.value || '');
            }
        });
    });

    // --- INITIALIZATION ---
    loadPendingLeaves();
    refreshHistoryCountPreview();
});
