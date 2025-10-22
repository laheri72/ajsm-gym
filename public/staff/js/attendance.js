document.addEventListener("DOMContentLoaded", () => {
    
  
  // --- EDIT INDIVIDUAL ATTENDANCE MODULE ---
    // (This section is unchanged)
    let currentTR = null;
    let currentDate = null;
document.getElementById('fetchAttendanceBtn').addEventListener('click', async () => {
        const fetchBtn = document.getElementById('fetchAttendanceBtn');
        const originalBtnText = fetchBtn.innerHTML; 
        const tr = document.getElementById('editTR').value.trim();
        const date = document.getElementById('editDate').value;
        const editor = document.getElementById('attendanceEditor');

        if (!tr || !date) {
            return Swal.fire('Missing Data', 'Please enter both TR and Date.', 'warning');
    
    }

        try {
            fetchBtn.disabled = true;
            fetchBtn.innerHTML = `<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Fetching...`;
            
            const res = await fetch(`/api/attendance-record/${tr}/${date}`);
          
  const data = await res.json();
            if (!data.success) throw new Error(data.error || 'Failed to fetch record');

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
            fetchBtn.disabled = false;
fetchBtn.innerHTML = originalBtnText;
        }
    });

document.getElementById('updateAttendanceBtn').addEventListener('click', async () => {
        const updateBtn = document.getElementById('updateAttendanceBtn');
        const originalBtnText = updateBtn.innerHTML; 

        if (!currentTR || !currentDate) {
            return Swal.fire('Missing Data', 'Please fetch a record first.', 'warning');
        }

        const newStatus = document.getElementById('newStatusSelect').value;
        const payload = 
{
            TR: parseInt(currentTR, 10),
            CreatedAt: currentDate,
            IsPresent: (newStatus === 'present'),
            OnLeave: (newStatus === 'on_leave')
        };

        try {
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
            updateBtn.disabled = false;
updateBtn.innerHTML = originalBtnText;
        }
    });

    // --- BULK ATTENDANCE ACTIONS ---
    // (This section is unchanged)
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

    // Helper to render table cells (unchanged)
    function renderAttendanceCell(value) {
        if (value === 'Present') return `<td style="color: green; font-weight: bold;">Present</td>`;
if (value === 'On Leave') return `<td style="color: #f59e0b; font-weight: bold;">On Leave</td>`;
if (value === 'Absent') return `<td style="color: red; font-weight: bold;">Absent</td>`;
        return `<td>-</td>`;
}
    
    // Helper to format dates (unchanged)
    function formatDate(dateString) {
        return new Date(dateString).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

    // Fetches the list of weeks (unchanged)
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

// === MODIFIED 'loadAttendanceBtn' EVENT LISTENER ===
document.getElementById('loadAttendanceBtn').addEventListener('click', async () => {
    const weekId = document.getElementById('weekSelect').value;
    if (!weekId) {
        return Swal.fire('No Week Selected', 'Please select a week.', 'warning');
    }

    const container = document.getElementById('slot-attendance-container');
    container.innerHTML = `<div class="loader-cell"><div class="loader"></div></div>`;

    try {
        const res = await fetch(`/api/weekly-attendance/${weekId}`);
const result = await res.json(); 

        if (!result.success) throw new Error(result.error || 'Failed to fetch data.');
        
const data = result.attendance; 
const startDate = new Date(result.weekStartDate); 

        container.innerHTML = ''; // Clear loader
        if (!data || data.length === 0) {
    container.innerHTML = `<p class="text-center">No attendance records found for this week.</p>`;
    return;
        }
        
        // 1. Group students by SlotName (unchanged)
        const slots = {};
        data.forEach(student => {
            const slotName = student.SlotName || 'Unassigned';
            if (!slots[slotName]) {
                slots[slotName] = [];
            }
            slots[slotName].push(student);
        });

        // 2. Render a card for each slot
        Object.keys(slots).sort().forEach(slotName => {
            const card = document.createElement('div');
            card.className = 'card mb-4';

            // === MODIFICATION: Add 'Actions' header ===
            const tableHTML = `
                <div class="card-header h5">${slotName}</div>
                <div class="card-body p-0" style="overflow-x: auto;">
                    <table class="table table-striped table-bordered nowrap mb-0" style="width:100%;">
                        <thead>
                            <tr>
                                <th>Tr No</th>
                                <th>Name</th>
                                <th>Slot</th>
                                <th>Monday</th>
                                <th>Tuesday</th>
                                <th>Wednesday</th>
                                <th>Thursday</th>
                                <th>Friday</th>
                                <th>Saturday</th>
                                <th>Total Absences</th>
                                <th>Actions</th> </tr>
                        </thead>
                        <tbody>
                            </tbody>
                    </table>
                </div>
            `;
            card.innerHTML = tableHTML;
            const tbody = card.querySelector('tbody');

            // 3. Populate the table for this slot
        slots[slotName].forEach(student => {
            const joinedDate = new Date(student.JoinedAt);
                joinedDate.setHours(0, 0, 0, 0);

                let absentCount = 0;
            const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

            daysOfWeek.forEach((day, i) => {
                const currentDate = new Date(startDate); 
                currentDate.setDate(startDate.getDate() + i);
                
                if (student[day] === 'Absent' && currentDate >= joinedDate) {
                absentCount++;
                }
            });

            const row = document.createElement('tr');
            
            // === MODIFICATION: Danger row logic updated to > 3 ===
            if (absentCount > 3) {
                row.classList.add('attendance-danger-row');
            }

            const renderCellWithJoinDateCheck = (day, status) => {
                const dayIndex = daysOfWeek.indexOf(day);
                const cellDate = new Date(startDate);
                cellDate.setDate(startDate.getDate() + dayIndex);
                if (cellDate < joinedDate) {
                    return `<td>-</td>`;
                }
                return renderAttendanceCell(status);
            };

            // === MODIFICATION: Add Actions Cell ===
            let actionsCellHtml = '<td>-</td>'; // Default
            if (absentCount > 3) {
                actionsCellHtml = `
                    <td>
                        <button class="btn btn-sm btn-danger deactivate-btn" data-tr="${student.TR}">
                            🚫 Deactivate
                        </button>
                    </td>`;
            }

            // === MODIFICATION: Add new cell to row ===
            row.innerHTML = `
                <td>${student.TR}</td>
                <td>${student.Name}</td>
                <td>${student.SlotName}</td>
                ${renderCellWithJoinDateCheck('Monday', student.Monday)}
                ${renderCellWithJoinDateCheck('Tuesday', student.Tuesday)}
                ${renderCellWithJoinDateCheck('Wednesday', student.Wednesday)}
                ${renderCellWithJoinDateCheck('Thursday', student.Thursday)}
                ${renderCellWithJoinDateCheck('Friday', student.Friday)}
                ${renderCellWithJoinDateCheck('Saturday', student.Saturday)}
                <td>${absentCount}</td> 
                ${actionsCellHtml} `;
            tbody.appendChild(row);
            });

            container.appendChild(card);
        });

    } catch (err) {
        console.error('Failed to load attendance:', err);
    container.innerHTML = `<p class="text-center" style="color: var(--danger);">Error loading attendance. Please try again.</p>`;
    }
});

// === NEW HELPER FUNCTION TO FIX EXPORT ===
    /**
     * Sanitizes a string to be a valid Excel sheet name.
     * Removes invalid characters: \ / ? * [ ] : ( )
     * Truncates to 31 characters.
     */
    function sanitizeSheetName(name) {
        if (!name) return 'Sheet';
        // Remove invalid characters
        let sanitized = name.replace(/[\\/?*[\]():]/g, '');
        sanitized = sanitized.trim();
        // Ensure it's not empty after sanitizing
        if (sanitized.length === 0) return 'Sheet';
        // Truncate to 31 characters
        return sanitized.substring(0, 31);
    }

    // === MODIFIED 'exportAttendanceBtn' EVENT LISTENER ===
document.getElementById('exportAttendanceBtn').addEventListener('click', () => {
        const container = document.getElementById('slot-attendance-container');
        const tables = container.querySelectorAll('.table');

        if (tables.length === 0) {
            return Swal.fire('No Data to Export', 'Please load attendance data first.', 'warning');
        }

        const workbook = XLSX.utils.book_new();

        tables.forEach(table => {
            const card = table.closest('.card');
            const header = card.querySelector('.card-header');
            
            // === FIX IS HERE ===
            let slotName = 'Sheet'; // Default
            if (header) {
                // Use the new sanitize function
                slotName = sanitizeSheetName(header.textContent);
            }
            // === END FIX ===

        const worksheet = XLSX.utils.table_to_sheet(table);
        XLSX.utils.book_append_sheet(workbook, worksheet, slotName);
        });

    const weekSelect = document.getElementById('weekSelect');
        const selectedText = weekSelect.selectedOptions[0].text;
    const safeFilename = selectedText.replace(/→/g, 'to').replace(/[/\\]/g, '-');
    XLSX.writeFile(workbook, `Slot Attendance - ${safeFilename}.xlsx`);
    });

// --- NEW: DELEGATED EVENT LISTENER FOR DEACTIVATION ---
// (Adapted from your records.js)
$('#slot-attendance-container').on('click', '.deactivate-btn', function () {
    const deactivateBtn = $(this); // Get a reference to the button
    const originalBtnText = deactivateBtn.html(); 
    const tr = deactivateBtn.data('tr');

    Swal.fire({
        title: 'Deactivate Student?',
        text: `Are you sure you want to deactivate student TR ${tr}? Their slot will be freed up.`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: 'var(--primary)',
        cancelButtonColor: 'var(--danger)',
        confirmButtonText: 'Yes, deactivate.'
    }).then(async (result) => {
        if (result.isConfirmed) {
            try {
                // --- START LOADER ---
                deactivateBtn.prop('disabled', true);
                deactivateBtn.html('<span class="spinner-border spinner-border-sm"></span> Deactivating...');

                // This API endpoint is from your records.js example
                const res = await fetch(`/api/students/status/${tr}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ Status: 'Inactive' })
                });

                if (res.ok) {
                    Swal.fire('Deactivated!', 'The student has been deactivated.', 'success');
                    
                    // === MODIFICATION: Reload attendance view ===
                    // This re-runs the fetch and rebuilds the cards, removing the student
                    document.getElementById('loadAttendanceBtn').click(); 
                } else {
                    Swal.fire('Error', 'Failed to update student.', 'error');
                    deactivateBtn.prop('disabled', false);
                    deactivateBtn.html(originalBtnText);
                }
            } catch (err) {
                Swal.fire('Error', 'A network error occurred.', 'error');
                deactivateBtn.prop('disabled', false);
                deactivateBtn.html(originalBtnText);
            }
        }
    });
});


// --- PAGE INITIALIZATION ---
loadWeeks(); // Load the week dropdown as soon as the page is ready
});