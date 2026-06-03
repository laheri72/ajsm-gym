document.addEventListener("DOMContentLoaded", () => {
    
    // --- GLOBAL VARIABLES FOR STAFF WEEK PICKER ---
    let cachedStaffWeeks = [];
    let staffFlatpickrInstance = null;

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
        const payload = {
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
    async function loadDarajahs() {
        try {
            const res = await fetch('/api/darajahs');
            const data = await res.json();
            if (data.success && data.data) {
                const select = document.getElementById('bulkLeaveDarajah');
                if (!select) return;
                data.data.forEach(d => {
                    const opt = document.createElement('option');
                    opt.value = d;
                    opt.textContent = d;
                    select.appendChild(opt);
                });
            }
        } catch (e) {
            console.error('Failed to load darajahs', e);
        }
    }
    loadDarajahs();

    // Variable to hold the current fetched students to easily show in modal
    let currentDarajahStudents = [];

    async function updateStudentCount() {
        const darajah = document.getElementById('bulkLeaveDarajah')?.value || 'All';
        const countSpan = document.getElementById('bulkLeaveStudentCount');
        if (!countSpan) return;

        try {
            countSpan.textContent = 'Loading...';
            const res = await fetch(`/api/attendance/darajah-students?darajah=${encodeURIComponent(darajah)}`);
            const data = await res.json();
            if (data.success) {
                currentDarajahStudents = data.data;
                countSpan.textContent = `${data.data.length} student(s) selected (Tap to view)`;
            } else {
                countSpan.textContent = 'Error loading count';
            }
        } catch (e) {
            console.error('Failed to load darajah students count', e);
            countSpan.textContent = 'Error loading count';
        }
    }

    document.getElementById('bulkLeaveDarajah')?.addEventListener('change', updateStudentCount);
    
    // Call once initially to get the count for "All"
    // Wait for a tiny timeout to ensure loadDarajahs may have finished if we rely on its first option
    setTimeout(() => updateStudentCount(), 100);

    document.getElementById('bulkLeaveStudentCount')?.addEventListener('click', () => {
        if (currentDarajahStudents.length === 0) {
            Swal.fire('No Students', 'There are no students for this selection.', 'info');
            return;
        }

        let tableHtml = `
            <div style="max-height: 400px; overflow-y: auto;">
                <table class="table table-sm table-striped text-start">
                    <thead><tr><th>TR</th><th>Name</th><th>Darajah</th></tr></thead>
                    <tbody>
        `;
        currentDarajahStudents.forEach(s => {
            tableHtml += `<tr><td>${s.TR}</td><td>${s.Name}</td><td>${s.Darajah || '-'}</td></tr>`;
        });
        tableHtml += `</tbody></table></div>`;

        Swal.fire({
            title: 'Selected Students',
            html: tableHtml,
            width: '600px',
            confirmButtonText: 'Close'
        });
    });

    document.getElementById('bulkLeaveBtn').addEventListener('click', async () => {
        const darajah = document.getElementById('bulkLeaveDarajah')?.value || 'All';
        const startDate = document.getElementById('bulkLeaveStartDate').value;
        const endDate = document.getElementById('bulkLeaveEndDate').value;

        if (!startDate || !endDate) {
            return Swal.fire('Missing Dates', 'Please select both start and end dates.', 'warning');
        }
        if (new Date(endDate) < new Date(startDate)) {
            return Swal.fire('Invalid Dates', 'End date cannot be before start date.', 'warning');
        }

        // Fetch unique reasons for autocomplete
        let uniqueReasons = [];
        try {
            const res = await fetch('/api/staff/leaves/unique-reasons');
            const data = await res.json();
            if (data.success) uniqueReasons = data.data;
        } catch (e) {
            console.error('Failed to fetch unique reasons', e);
        }

        const { value: reason } = await Swal.fire({
            title: 'Enter Reason for Leave',
            html: `
                <div class="text-start px-2">
                    <label for="holidayReasonInput" class="form-label small text-muted mb-1">Reason (e.g., Raihaan Leave)</label>
                    <input id="holidayReasonInput" class="form-control" list="reasonsList" placeholder="Type or select a reason..." style="height: 45px;">
                    <datalist id="reasonsList">
                        ${uniqueReasons.map(r => `<option value="${r}">`).join('')}
                    </datalist>
                    <div class="form-text mt-2" style="font-size: 0.75rem;">Tip: Picking an existing reason helps keep analytics clean.</div>
                </div>
            `,
            focusConfirm: false,
            preConfirm: () => {
                const val = document.getElementById('holidayReasonInput').value;
                if (!val) {
                    Swal.showValidationMessage('You need to write a reason!');
                    return false;
                }
                return val;
            },
            showCancelButton: true,
            confirmButtonText: 'Continue'
        });

        if (!reason) return; // User cancelled

        Swal.fire({
            title: 'Are you sure?',
            text: `This will mark leaves from ${startDate} to ${endDate} for ${darajah === 'All' ? 'ALL active students' : 'students in ' + darajah}.`,
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
                        body: JSON.stringify({ darajah, startDate, endDate, reason })
                    });
                    const data = await res.json();
                    if (!res.ok) throw new Error(data.error || 'An unknown error occurred.');

                    Swal.fire('Success!', data.message, 'success');
                    if (document.getElementById('bulkLeaveStartDate')) document.getElementById('bulkLeaveStartDate').value = '';
                    if (document.getElementById('bulkLeaveEndDate')) document.getElementById('bulkLeaveEndDate').value = '';
                } catch (err) {
                    Swal.fire('Operation Failed', err.message, 'error');
                }
            }
        });
    });

    // --- HELPER: Render Attendance Cell ---
    function renderAttendanceCell(value) {
        if (value === 'Present') return `<td style="color: green; font-weight: bold;">Present</td>`;
        if (value === 'On Leave') return `<td style="color: #f59e0b; font-weight: bold;">On Leave</td>`;
        if (value === 'Absent') return `<td style="color: red; font-weight: bold;">Absent</td>`;
        return `<td>-</td>`;
    }

    // --- NEW: Initialize Staff Week Picker ---
    async function initializeStaffWeekPicker() {
        const weekPickerInput = document.getElementById('staffWeekPickerInput');
        if (!weekPickerInput) return;

        try {
            const res = await fetch('/api/weeks', { credentials: 'include' });
            const data = await res.json();

            if (!res.ok || !data.success) {
                throw new Error(data.error || 'Could not fetch weeks.');
            }

            cachedStaffWeeks = data.weeks || [];

            if (cachedStaffWeeks.length === 0) {
                weekPickerInput.placeholder = "No attendance weeks available yet.";
                weekPickerInput.disabled = true;
                return;
            }

            cachedStaffWeeks.sort((a, b) => new Date(a.WeekStartDate) - new Date(b.WeekStartDate));

            const momentRanges = cachedStaffWeeks.map(week => ({
                start: moment(week.WeekStartDate),
                end: moment(week.WeekEndDate)
            }));

            staffFlatpickrInstance = flatpickr(weekPickerInput, {
                dateFormat: "M d, Y",
                weekNumbers: false,
                enable: [
                    function(date) {
                        const currentMoment = moment(date);
                        return momentRanges.some(range =>
                            currentMoment.isBetween(range.start, range.end, 'day', '[]')
                        );
                    }
                ],
                mode: "single",
                altInput: true,
                altFormat: "D, M j, Y",
                plugins: [],
                onChange: function(selectedDates, dateStr, instance) {
                    if (selectedDates.length === 0) {
                        clearStaffAttendanceView();
                        return;
                    }
                    const selectedDate = selectedDates[0];
                    findAndLoadStaffAttendanceForDate(selectedDate);
                },
            });

            const today = moment.tz("Asia/Kolkata").toDate();
            findAndLoadStaffAttendanceForDate(today, true);

        } catch (err) {
            console.error('Failed to initialize staff week picker:', err);
            weekPickerInput.placeholder = "Error loading weeks.";
            weekPickerInput.disabled = true;
            Swal.fire({
                icon: 'error', title: 'Error',
                text: err.message || 'Could not load week data for selection.'
            });
        }
    }

    // --- NEW: Find and Load Attendance for Selected Date ---
    function findAndLoadStaffAttendanceForDate(selectedDate, setPickerValue = false) {
        if (cachedStaffWeeks.length === 0) {
            clearStaffAttendanceView("No attendance weeks available.");
            return;
        }

        const selectedMoment = moment(selectedDate);
        const targetWeek = cachedStaffWeeks.find(week => {
            const start = moment(week.WeekStartDate);
            const end = moment(week.WeekEndDate);
            return selectedMoment.isBetween(start, end, 'day', '[]');
        });

        if (targetWeek) {
            loadStaffAttendance(targetWeek.WeekID);

            if (setPickerValue && staffFlatpickrInstance) {
                const weekStartMoment = moment(targetWeek.WeekStartDate);
                staffFlatpickrInstance.setDate(weekStartMoment.toDate(), false);
            }
        } else {
            clearStaffAttendanceView("Selected date is outside available attendance weeks.");
        }
    }

    // --- REFACTORED: Load Staff Attendance by Week ID ---
    async function loadStaffAttendance(weekId) {
        if (!weekId) {
            clearStaffAttendanceView("Invalid week selected.");
            return;
        }

        const container = document.getElementById('slot-attendance-container');
        container.innerHTML = `<div class="loader-cell"><div class="loader"></div></div>`;

        try {
            const res = await fetch(`/api/weekly-attendance/${weekId}`, { credentials: 'include' });
            const result = await res.json();

            if (!result.success) throw new Error(result.error || 'Failed to fetch data.');

            const data = result.attendance;
            const startDate = result.weekStartDate ? new Date(result.weekStartDate) : null;
            if (!startDate) throw new Error('Week start date missing from API response.');

            const today = new Date();
            today.setHours(0, 0, 0, 0);

            container.innerHTML = '';
            if (!data || data.length === 0) {
                container.innerHTML = `<p class="text-center text-muted">No attendance records found for this week.</p>`;
                return;
            }

            const slots = {};
            data.forEach(student => {
                const slotName = student.SlotName || 'Unassigned';
                if (!slots[slotName]) slots[slotName] = [];
                slots[slotName].push(student);
            });

            Object.keys(slots).sort().forEach(slotName => {
                const card = document.createElement('div');
                card.className = 'card mb-4';
                card.innerHTML = `
                    <div class="card-header h5">${slotName}</div>
                    <div class="card-body p-0" style="overflow-x: auto;">
                        <table class="table table-striped table-bordered nowrap mb-0 stacking-card-table" style="width:100%;">
                            <thead>
                                <tr>
                                    <th>Tr No</th>
                                    <th>Name</th>
                                    <th>Monday</th>
                                    <th>Tuesday</th>
                                    <th>Wednesday</th>
                                    <th>Thursday</th>
                                    <th>Friday</th>
                                    <th>Saturday</th>
                                    <th>Total Absences</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody></tbody>
                        </table>
                    </div>`;
                const tbody = card.querySelector('tbody');

                slots[slotName].forEach(student => {
                    const joinedDate = new Date(student.JoinedAt);
                    joinedDate.setHours(0, 0, 0, 0);
                    let absentCount = 0;
                    const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
                    const cells = daysOfWeek.map((day, i) => {
                        const currentDate = new Date(startDate);
                        currentDate.setDate(startDate.getDate() + i);
                        if (currentDate < joinedDate) return `<td>-</td>`;
                        
                        const status = student[day];

                        // If it's today or in the future, don't show as absent if unmarked
                        if (status === 'Absent' && currentDate >= today) {
                            return `<td>-</td>`;
                        }

                        if (status === 'Absent') absentCount++;
                        return renderAttendanceCell(status);
                    });

                    const row = document.createElement('tr');
                    if (absentCount > 2) row.classList.add('attendance-danger-row');

                    let actionsCellHtml = '<td>-</td>';
                    if (absentCount > 2) {
                        actionsCellHtml = `<td><button class="btn btn-sm btn-danger deactivate-btn" data-tr="${student.TR}">Deactivate</button></td>`;
                    }

                    row.innerHTML = `
                        <td>${student.TR}</td>
                        <td>${student.Name}</td>
                        ${cells.join('')}
                        <td>${absentCount}</td>
                        ${actionsCellHtml}`;
                    
                    row.querySelectorAll('td').forEach((td, index) => {
                        const headers = ["Tr No", "Name", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Total Absences", "Actions"];
                        if (headers[index]) td.setAttribute('data-label', headers[index]);
                    });

                    tbody.appendChild(row);
                });
                container.appendChild(card);
            });

        } catch (err) {
            console.error('Failed to load staff attendance:', err);
            container.innerHTML = `<p class="text-center text-danger">Error loading attendance: ${err.message}. Please try again.</p>`;
        }
    }

    // --- NEW: Clear Staff Attendance View ---
    function clearStaffAttendanceView(message = "Select a week above to view attendance.") {
        const container = document.getElementById('slot-attendance-container');
        if (container) {
            container.innerHTML = `<p class="text-center text-muted">${message}</p>`;
        }
    }

    // --- EXPORT ATTENDANCE BUTTON (Unchanged except container ref) ---
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
            let slotName = 'Sheet';
            if (header) {
                slotName = sanitizeSheetName(header.textContent);
            }
            const worksheet = XLSX.utils.table_to_sheet(table);
            XLSX.utils.book_append_sheet(workbook, worksheet, slotName);
        });

        const weekText = staffFlatpickrInstance?.selectedDates[0] 
            ? moment(staffFlatpickrInstance.selectedDates[0]).format('MMM D, YYYY')
            : 'Week';
        const safeFilename = `Slot Attendance - ${weekText}.xlsx`.replace(/[/\\]/g, '-');
        XLSX.writeFile(workbook, safeFilename);
    });

    // --- SANITIZE SHEET NAME (Unchanged) ---
    function sanitizeSheetName(name) {
        if (!name) return 'Sheet';
        let sanitized = name.replace(/[\\/?*[\]():]/g, '');
        sanitized = sanitized.trim();
        if (sanitized.length === 0) return 'Sheet';
        return sanitized.substring(0, 31);
    }

    // --- DELEGATED DEACTIVATE BUTTON LISTENER (Updated to reload via picker) ---
    $('#slot-attendance-container').on('click', '.deactivate-btn', function () {
        const deactivateBtn = $(this);
        const originalBtnText = deactivateBtn.html(); 
        const tr = deactivateBtn.data('tr');

        Swal.fire({
            title: 'Deactivate Student?',
            text: `Are you sure you want to deactivate student TR ${tr}? Their slot will be freed up.`,
            input: 'textarea',
            inputLabel: 'Reason for deactivation',
            inputPlaceholder: 'Enter the reason shown in the audit log...',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: 'var(--primary)',
            cancelButtonColor: 'var(--danger)',
            confirmButtonText: 'Yes, deactivate.',
            inputValidator: (value) => {
                if (!String(value || '').trim()) {
                    return 'Reason is required.';
                }
                return null;
            }
        }).then(async (result) => {
            if (result.isConfirmed) {
                try {
                    deactivateBtn.prop('disabled', true);
                    deactivateBtn.html('<span class="spinner-border spinner-border-sm"></span> Deactivating...');

                    const res = await fetch(`/api/students/status/${tr}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ Status: 'Inactive', Reason: result.value })
                    });

                    const data = await res.json();
                    if (res.ok) {
                        Swal.fire('Deactivated!', data.message || 'The student has been deactivated.', 'success');
                        const currentDate = staffFlatpickrInstance?.selectedDates[0] || new Date();
                        findAndLoadStaffAttendanceForDate(currentDate);
                    } else {
                        throw new Error(data.error || data.message || 'Failed to update student.');
                    }
                } catch (err) {
                    Swal.fire('Error', err.message || 'A network error occurred.', 'error');
                    deactivateBtn.prop('disabled', false);
                    deactivateBtn.html(originalBtnText);
                }
            }
        });
    });

    // --- PAGE INITIALIZATION ---
    initializeStaffWeekPicker(); // Replaces old loadWeeks() + button listener
});
