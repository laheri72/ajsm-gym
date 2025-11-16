import { 
    allLeaveRequests, leaveHistoryTable, 
    setAllLeaveRequests, setLeaveHistoryTable 
} from './state.js';

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

                        return start === end ? start : `${start} to ${end}`;
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
                { title: 'Staff Remarks', data: 'Remarks', render: (data) => data || 'N/A' },
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