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
    const viewPendingBtn = document.getElementById('viewPendingBtn');
    const viewHistoryBtn = document.getElementById('viewHistoryBtn');

    viewPendingBtn.addEventListener('click', () => {
        pendingView.style.display = 'block';
        historyView.style.display = 'none';
        viewPendingBtn.classList.add('active');
        viewHistoryBtn.classList.remove('active');
    });

    viewHistoryBtn.addEventListener('click', () => {
        pendingView.style.display = 'none';
        historyView.style.display = 'block';
        viewPendingBtn.classList.remove('active');
        viewHistoryBtn.classList.add('active');
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
    ajax: { url: '/api/staff/leaves/pending', dataSrc: 'data' },
    columns: [
        { 
            data: 'StudentName',
            render: (data, type, row) => {
                const taken = row.LeavesTakenThisMonth || 0;
                const badgeClass = taken >= 4 ? 'bg-danger' : taken >= 3 ? 'bg-warning text-dark' : 'bg-info text-dark';
                const quotaBadge = `<span class="badge ${badgeClass} ms-1" title="Personal leaves used this month (excl. holidays)">${taken}/4 Leaves</span>`;
                const holdBadge = row.Status === 'On Hold' ? ` <span class="badge bg-warning text-dark">On Hold</span>` : '';
                return `${data}${holdBadge}<br><small>${quotaBadge}</small>`;
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
            ajax: { url: '/api/staff/leaves/history', dataSrc: 'data' },
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
                { data: 'Remarks', render: (data) => data || '-' }
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
});