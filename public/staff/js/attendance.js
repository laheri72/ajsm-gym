document.addEventListener("DOMContentLoaded", () => {
    
    // --- EDIT INDIVIDUAL ATTENDANCE MODULE ---

    let currentTR = null;
    let currentDate = null;

document.getElementById('fetchAttendanceBtn').addEventListener('click', async () => {
        const fetchBtn = document.getElementById('fetchAttendanceBtn');
        const originalBtnText = fetchBtn.innerHTML; // Store original text
        const tr = document.getElementById('editTR').value.trim();
        const date = document.getElementById('editDate').value;
        const editor = document.getElementById('attendanceEditor');

        if (!tr || !date) {
            return Swal.fire('Missing Data', 'Please enter both TR and Date.', 'warning');
        }

        try {
            // --- START LOADER ---
            fetchBtn.disabled = true;
            fetchBtn.innerHTML = `<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Fetching...`;
            
            const res = await fetch(`/api/attendance-record/${tr}/${date}`);
            const data = await res.json();
            if (!data.success) throw new Error(data.error || 'Failed to fetch record');

            // ... (rest of the success logic is the same)
            currentTR = tr;
            currentDate = date;
            const statusField = document.getElementById('currentStatus');
            const newStatusSelect = document.getElementById('newStatusSelect');
            if (data.record.IsPresent) {
                statusField.value = 'Present';
                newStatusSelect.value = 'present';
            } else if (data.record.OnLeave) {
                statusField.value = 'On Leave';
                newStatusSelect.value = 'on_leave';
            } else {
                statusField.value = 'Absent (Unmarked)';
                newStatusSelect.value = 'on_leave';
            }
            editor.style.display = 'block';

        } catch (err) {
            Swal.fire('Fetch Failed', err.message, 'error');
        } finally {
            // --- STOP LOADER (runs on success or failure) ---
            fetchBtn.disabled = false;
            fetchBtn.innerHTML = originalBtnText;
        }
    });

document.getElementById('updateAttendanceBtn').addEventListener('click', async () => {
        const updateBtn = document.getElementById('updateAttendanceBtn');
        const originalBtnText = updateBtn.innerHTML; // Store original text

        if (!currentTR || !currentDate) {
            return Swal.fire('Missing Data', 'Please fetch a record first.', 'warning');
        }

        const newStatus = document.getElementById('newStatusSelect').value;
        const payload = {
            TR: parseInt(currentTR, 10),
            CreatedAt: currentDate,
            IsPresent: (newStatus === 'present'),
            OnLeave: (newStatus === 'on_leave')
        };

        try {
            // --- START LOADER ---
            updateBtn.disabled = true;
            updateBtn.innerHTML = `<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Saving...`;

            const res = await fetch('/api/attendance-record', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const result = await res.json();
            if (!result.success) throw new Error(result.error);

            Swal.fire('Updated!', 'Attendance has been updated successfully.', 'success');
            document.getElementById('attendanceEditor').style.display = 'none';
            document.getElementById('editTR').value = '';
            document.getElementById('editDate').value = '';
        } catch (err) {
            Swal.fire('Error', `Update Failed: ${err.message}`, 'error');
        } finally {
            // --- STOP LOADER ---
            updateBtn.disabled = false;
            updateBtn.innerHTML = originalBtnText;
        }
    });
    // --- BULK ATTENDANCE ACTIONS ---

    document.getElementById('bulkLeaveBtn').addEventListener('click', () => {
        const dateInput = document.getElementById('bulkLeaveDate');
        const selectedDate = dateInput.value;

        if (!selectedDate) {
            return Swal.fire('No Date Selected', 'Please select a date for the event.', 'warning');
        }

        Swal.fire({
            title: 'Are you sure?',
            text: `This will mark ALL active students in your section as "On Leave" for ${selectedDate}.`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#3085d6',
            cancelButtonColor: '#d33',
            confirmButtonText: 'Yes, proceed!'
        }).then(async (result) => {
            if (result.isConfirmed) {
                try {
                    const res = await fetch('/api/attendance/bulk-leave', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ date: selectedDate })
                    });
                    const data = await res.json();
                    if (!res.ok) throw new Error(data.error || 'An unknown error occurred.');

                    Swal.fire('Success!', data.message, 'success');
                    dateInput.value = '';
                } catch (err) {
                    Swal.fire('Operation Failed', err.message, 'error');
                }
            }
        });
    });

    // --- WEEKLY ATTENDANCE VIEW ---

    // Helper to render table cells with appropriate colors
    function renderAttendanceCell(value) {
        if (value === 'Present') return `<td style="color: green; font-weight: bold;">Present</td>`;
        if (value === 'On Leave') return `<td style="color: #f59e0b; font-weight: bold;">On Leave</td>`;
        if (value === 'Absent') return `<td style="color: red; font-weight: bold;">Absent</td>`;
        return `<td>-</td>`;
    }
    
    // Helper to format dates for the dropdown
    function formatDate(dateString) {
        return new Date(dateString).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
    }

    // Fetches the list of weeks to populate the dropdown
    async function loadWeeks() {
        try {
            const res = await fetch('/api/weeks');
            const data = await res.json();
            const weekSelect = document.getElementById('weekSelect');
            weekSelect.innerHTML = '<option value="" disabled selected>Select Week</option>';
            if (data.success && data.weeks.length > 0) {
                data.weeks.forEach(week => {
                    const startFormatted = formatDate(week.WeekStartDate);
                    const endFormatted = formatDate(week.WeekEndDate);
                    const option = new Option(`Week ${week.WeekID} (${startFormatted} → ${endFormatted})`, week.WeekID);
                    weekSelect.appendChild(option);
                });
            }
        } catch (err) {
            console.error('Failed to load weeks:', err);
        }
    }

    document.getElementById('loadAttendanceBtn').addEventListener('click', async () => {
        const weekId = document.getElementById('weekSelect').value;
        if (!weekId) {
            return Swal.fire('No Week Selected', 'Please select a week before loading.', 'warning');
        }

        const tbody = document.querySelector('#attendanceTable tbody');
        tbody.innerHTML = `<tr><td colspan="10" class="loader-cell"><div class="loader"></div></td></tr>`;

        try {
            const res = await fetch(`/api/weekly-attendance/${weekId}`);
            const data = await res.json();
            tbody.innerHTML = '';
            if (!data || data.length === 0) {
                tbody.innerHTML = `<tr><td colspan="10" class="text-center">No attendance records found for this week.</td></tr>`;
                return;
            }
            
            data.forEach(student => {
                let absentCount = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
                    .filter(day => student[day] === 'Absent').length;
                
                const row = document.createElement('tr');
                if (absentCount >= 3) {
                    row.classList.add('attendance-danger-row');
                }
                row.innerHTML = `
                    <td>${student.TR}</td>
                    <td>${student.Name}</td>
                    <td>${student.SlotName}</td>
                    ${renderAttendanceCell(student.Monday)}
                    ${renderAttendanceCell(student.Tuesday)}
                    ${renderAttendanceCell(student.Wednesday)}
                    ${renderAttendanceCell(student.Thursday)}
                    ${renderAttendanceCell(student.Friday)}
                    ${renderAttendanceCell(student.Saturday)}
                    <td>${absentCount}</td> 
                `;
                tbody.appendChild(row);
            });
        } catch (err) {
            console.error('Failed to load attendance:', err);
            tbody.innerHTML = `<tr><td colspan="10" class="text-center" style="color: var(--danger);">Error loading attendance. Please try again.</td></tr>`;
        }
    });

    document.getElementById('exportAttendanceBtn').addEventListener('click', () => {
        const table = document.getElementById('attendanceTable');
        const tbody = table.querySelector('tbody');

        if (!tbody || tbody.rows.length === 0 || tbody.rows[0].cells.length < 2) {
            return Swal.fire('No Data to Export', 'Please load attendance data first.', 'warning');
        }

        const worksheet = XLSX.utils.table_to_sheet(table);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Weekly Attendance");

        const weekSelect = document.getElementById('weekSelect');
        const selectedText = weekSelect.selectedOptions[0].text;
        const safeFilename = selectedText.replace(/→/g, 'to').replace(/[/\\]/g, '-');
        XLSX.writeFile(workbook, `${safeFilename}.xlsx`);
    });

    // --- PAGE INITIALIZATION ---
    loadWeeks(); // Load the week dropdown as soon as the page is ready
});