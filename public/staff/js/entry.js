document.addEventListener("DOMContentLoaded", () => {
    let cachedSlots = null;
    let waitingListTable = null;
    let lookupTimeout = null;

    const trInput = document.getElementById('trNo');
    const trLookupError = document.getElementById('trLookupError');
    const existingStudentDisplay = document.getElementById('existingStudentDisplay');
    const studentNameLabel = document.getElementById('studentNameLabel');
    const darajahLabel = document.getElementById('darajahLabel');
    const newStudentFields = document.getElementById('newStudentFields');
    const addStudentBtn = document.getElementById('addStudentBtn');
    const studentEntryForm = document.getElementById('studentEntryForm');
    const preferredSlotSelect = document.getElementById('preferredSlot');

    // 1. TR Lookup logic with Debounce
    trInput.addEventListener('input', () => {
        clearTimeout(lookupTimeout);
        const tr = trInput.value.trim();
        
        // Reset immediate states
        trLookupError.classList.add('d-none');
        trLookupError.textContent = '';
        
        if (tr.length < 3) {
            resetEntryForm();
            return;
        }

        lookupTimeout = setTimeout(async () => {
            try {
                const response = await fetch('/api/add-student', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ TR: tr, preview: true })
                });

                const data = await response.json();

                if (response.ok && data.success && data.canAdd) {
                    // Existing student found in TestMaster
                    existingStudentDisplay.classList.remove('d-none');
                    studentNameLabel.textContent = data.student.Name;
                    darajahLabel.textContent = data.student.Darajah;
                    newStudentFields.classList.add('d-none');
                    addStudentBtn.disabled = false;

                    // Blacklist warning badge
                    let blacklistBanner = document.getElementById('blacklistWarningBanner');
                    if (data.student.IsBlacklisted) {
                        if (!blacklistBanner) {
                            blacklistBanner = document.createElement('div');
                            blacklistBanner.id = 'blacklistWarningBanner';
                            blacklistBanner.className = 'alert alert-danger p-2 mb-2 small fw-bold d-flex align-items-center gap-2';
                            existingStudentDisplay.prepend(blacklistBanner);
                        }
                        blacklistBanner.innerHTML = `<span>🚫</span> WARNING: Student is Blacklisted! (Reason: ${data.student.BlacklistReason || 'Flagged by Admin'})`;
                        blacklistBanner.classList.remove('d-none');
                    } else if (blacklistBanner) {
                        blacklistBanner.classList.add('d-none');
                    }
                } else if (response.status === 404) {
                    // New student (Not in TestMaster)
                    existingStudentDisplay.classList.add('d-none');
                    newStudentFields.classList.remove('d-none');
                    addStudentBtn.disabled = false;
                } else {
                    // Validation error (Wrong branch, already active, etc.)
                    resetEntryForm();
                    trLookupError.textContent = data.message || 'Validation failed';
                    trLookupError.classList.remove('d-none');
                }
            } catch (err) {
                console.error('TR lookup error:', err);
                trLookupError.textContent = 'Connection error. Please try again.';
                trLookupError.classList.remove('d-none');
            }
        }, 300); // 300ms debounce
    });

    function resetEntryForm() {
        existingStudentDisplay.classList.add('d-none');
        newStudentFields.classList.add('d-none');
        addStudentBtn.disabled = true;
    }

    // 2. Submit Entry Form (Direct Activation)
    studentEntryForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const tr = trInput.value.trim();
        const slotIdValue = preferredSlotSelect.value;
        const goal = document.getElementById('preferredGoal').value;

        // If "waiting" is selected, SlotID is null but we still activate
        const slotId = slotIdValue === 'waiting' ? null : slotIdValue;

        const payload = {
            TR: tr,
            SlotID: slotId,
            Goal: goal,
            ForceActive: true // Tell backend to always activate
        };

        // If new student fields are visible, add them to payload
        if (!newStudentFields.classList.contains('d-none')) {
            payload.ITS = document.getElementById('itsNo').value;
            payload.Name = document.getElementById('studentName').value;
            payload.Darajah = document.getElementById('darajah').value;
            
            if (!payload.ITS || !payload.Name || !payload.Darajah) {
                return Swal.fire('Error', 'Please fill all new student details.', 'error');
            }
        }

        // UI Loading state
        const btnText = addStudentBtn.querySelector('.button-text');
        const spinner = addStudentBtn.querySelector('.spinner-border');
        addStudentBtn.disabled = true;
        btnText.classList.add('d-none');
        spinner.classList.remove('d-none');

        try {
            const response = await fetch('/api/add-student', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await response.json();

            if (data.success) {
                Swal.fire({
                    icon: 'success',
                    title: 'Student Activated!',
                    text: data.message,
                    timer: 2000,
                    showConfirmButton: false
                });
                studentEntryForm.reset();
                resetEntryForm();
                loadRecentActivations();
                loadSlotTable(); // Refresh availability
                loadSlots(); // Refresh dropdown counts
            } else {
                Swal.fire('Error', data.message || 'Failed to add student', 'error');
            }
        } catch (err) {
            console.error('Add student error:', err);
            Swal.fire('Error', 'Server connection failed', 'error');
        } finally {
            addStudentBtn.disabled = false;
            btnText.classList.remove('d-none');
            spinner.classList.add('d-none');
        }
    });

    // 3. Load Slots for Dropdown
    async function loadSlots() {
        try {
            const response = await fetch('/api/slots');
            const data = await response.json();
            if (data.success) {
                cachedSlots = data.slots;
                
                // Reset dropdown with "Waiting..." always at the top
                preferredSlotSelect.innerHTML = `
                    <option value="" disabled selected>Select a slot to assign...</option>
                    <option value="waiting" style="color: #666; font-style: italic;">Waiting / Pending Slot</option>
                `;

                data.slots.forEach(slot => {
                    const option = document.createElement('option');
                    option.value = slot.SlotID;
                    option.textContent = `${slot.SlotName} (${slot.AvailableSeats} left)`;
                    if (slot.AvailableSeats <= 0) {
                        option.disabled = true;
                        option.textContent += ' - FULL';
                    }
                    preferredSlotSelect.appendChild(option);
                });
            }
        } catch (err) {
            console.error('Error loading slots:', err);
        }
    }

    // 4. Load Recent Activations (Today)
    async function loadRecentActivations() {
        try {
            const response = await fetch('/api/recent-activations');
            const data = await response.json();

            if (waitingListTable) {
                waitingListTable.destroy();
            }

            const tbody = document.querySelector('#waitingListTable tbody');
            tbody.innerHTML = '';

            data.forEach(item => {
                // Use Moment.js for IST Display (prefer DisplayActivatedAt for re-activations)
                const targetTime = item.DisplayActivatedAt || item.JoinedAt;
                const istMoment = targetTime ? moment.utc(targetTime).tz("Asia/Kolkata") : null;
                const istTime = istMoment && istMoment.isValid() ? istMoment.format("hh:mm A") : 'N/A';
                const sortKey = istMoment && istMoment.isValid() ? istMoment.valueOf() : 0;
                
                const row = `
                    <tr>
                        <td>${item.TR}</td>
                        <td>${item.Name}</td>
                        <td>${item.Darajah}</td>
                        <td>${item.Goal || 'N/A'}</td>
                        <td>${item.SlotName || '<span class="text-muted italic">Waiting...</span>'}</td>
                        <td data-order="${sortKey}">${istTime}</td>
                    </tr>
                `;
                tbody.insertAdjacentHTML('beforeend', row);
            });

            waitingListTable = $('#waitingListTable').DataTable({
                pageLength: 5,
                lengthMenu: [5, 10, 25],
                order: [[5, 'desc']] // Sort by Joined At
            });

        } catch (err) {
            console.error('Error loading recent activations:', err);
        }
    }

    // 5. Slot Management Logic
    const createSlotForm = document.getElementById('createSlotForm');
    createSlotForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const slotName = document.getElementById('slot').value;
        const maxCapacity = document.getElementById('maxCapacity').value;

        const btn = document.getElementById('createSlotBtn');
        const btnText = btn.querySelector('.button-text');
        const spinner = btn.querySelector('.spinner-border');

        btn.disabled = true;
        btnText.classList.add('d-none');
        spinner.classList.remove('d-none');

        try {
            const response = await fetch('/api/slots', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ SlotName: slotName, MaxCapacity: maxCapacity })
            });

            const data = await response.json();
            if (data.success) {
                Swal.fire('Success', 'Slot created!', 'success');
                createSlotForm.reset();
                loadSlotTable();
                loadSlots(); // Update entry dropdown
            } else {
                Swal.fire('Error', data.message, 'error');
            }
        } catch (err) {
            console.error('Slot creation error:', err);
        } finally {
            btn.disabled = false;
            btnText.classList.remove('d-none');
            spinner.classList.add('d-none');
        }
    });

    async function loadSlotTable() {
        try {
            const response = await fetch('/api/slots');
            const data = await response.json();

            const tbody = document.querySelector('#slotTable tbody');
            tbody.innerHTML = '';

            data.slots.forEach(slot => {
                const assigned = slot.MaxCapacity - slot.AvailableSeats;
                const row = `
                    <tr>
                        <td>${slot.SlotID}</td>
                        <td>${slot.SlotName}</td>
                        <td>${slot.MaxCapacity}</td>
                        <td>${assigned}</td>
                        <td>${slot.AvailableSeats}</td>
                        <td>
                            <button class="btn btn-warning btn-sm edit-slot-btn" data-id="${slot.SlotID}" data-name="${slot.SlotName}" data-capacity="${slot.MaxCapacity}">Edit</button>
                            <button class="btn btn-danger btn-sm delete-slot-btn" data-id="${slot.SlotID}">Delete</button>
                        </td>
                    </tr>
                `;
                tbody.insertAdjacentHTML('beforeend', row);
            });

            // Re-attach edit listeners
            document.querySelectorAll('.edit-slot-btn').forEach(btn => {
                btn.addEventListener('click', () => editSlot(btn.dataset.id, btn.dataset.name, btn.dataset.capacity));
            });

            // Re-attach delete listeners
            document.querySelectorAll('.delete-slot-btn').forEach(btn => {
                btn.addEventListener('click', () => deleteSlot(btn.dataset.id));
            });

        } catch (err) {
            console.error('Error loading slot table:', err);
        }
    }

    async function editSlot(id, currentName, currentCapacity) {
        const { value: formValues } = await Swal.fire({
            title: 'Edit Slot',
            html:
                `<label class="swal2-label" style="display:block;text-align:left;margin-bottom:4px;font-weight:600;">Slot Name</label>` +
                `<input id="swal-slot-name" class="swal2-input" placeholder="Slot Name" value="${currentName}" style="margin-top:0;">` +
                `<label class="swal2-label" style="display:block;text-align:left;margin-bottom:4px;margin-top:12px;font-weight:600;">Max Capacity</label>` +
                `<input id="swal-max-capacity" class="swal2-input" type="number" min="1" placeholder="Max Capacity" value="${currentCapacity}" style="margin-top:0;">`,
            focusConfirm: false,
            showCancelButton: true,
            confirmButtonText: 'Save Changes',
            confirmButtonColor: '#3085d6',
            preConfirm: () => {
                const name = document.getElementById('swal-slot-name').value.trim();
                const capacity = document.getElementById('swal-max-capacity').value.trim();
                if (!name || !capacity || parseInt(capacity) < 1) {
                    Swal.showValidationMessage('Please fill in both fields with valid values.');
                    return false;
                }
                return { SlotName: name, MaxCapacity: parseInt(capacity) };
            }
        });

        if (formValues) {
            try {
                const response = await fetch(`/api/slots/${id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(formValues)
                });
                const data = await response.json();
                if (data.success) {
                    Swal.fire({ icon: 'success', title: 'Updated!', text: data.message, timer: 1500, showConfirmButton: false });
                    loadSlotTable();
                    loadSlots(); // Refresh the dropdown too
                } else {
                    Swal.fire('Error', data.message, 'error');
                }
            } catch (err) {
                console.error('Edit slot error:', err);
                Swal.fire('Error', 'Failed to update slot.', 'error');
            }
        }
    }


    async function deleteSlot(id) {
        const result = await Swal.fire({
            title: 'Are you sure?',
            text: "This will unassign all active students from this slot!",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            confirmButtonText: 'Yes, delete it!'
        });

        if (result.isConfirmed) {
            try {
                const response = await fetch(`/api/slots/${id}`, { method: 'DELETE' });
                const data = await response.json();
                if (data.success) {
                    Swal.fire('Deleted!', data.message, 'success');
                    loadSlotTable();
                    loadSlots();
                } else {
                    Swal.fire('Error', data.message, 'error');
                }
            } catch (err) {
                console.error('Error deleting slot:', err);
            }
        }
    }

    // --- NEW: Pending Slot Requests Logic ---
    let slotRequestsTable = null;

    async function loadSlotRequestsTable() {
        try {
            const res = await fetch('/api/staff/slot-requests/pending', { credentials: 'include' });
            const data = await res.json();

            if (slotRequestsTable) {
                slotRequestsTable.destroy();
            }

            const tbody = document.querySelector('#slotRequestsTable tbody');
            tbody.innerHTML = '';

            if (data.success && data.data) {
                data.data.forEach(req => {
                    // Use Moment.js for IST Display
                    const istMoment = req.RequestedAt ? moment.utc(req.RequestedAt).tz("Asia/Kolkata") : null;
                    const istTime = istMoment && istMoment.isValid() ? istMoment.format("MMM D, hh:mm A") : 'N/A';
                    const sortKey = istMoment && istMoment.isValid() ? istMoment.valueOf() : 0;
                    const availableText = req.RequestedSlotAvailable > 0 
                        ? `<span class="text-success">(${req.RequestedSlotAvailable} left)</span>` 
                        : `<span class="text-danger">(Full)</span>`;

                    // Escape user input to prevent HTML injection/breakage
                    const escapedReason = req.Reason 
                        ? req.Reason.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;")
                        : '<span class="text-muted">No reason provided</span>';

                    const row = `
                        <tr>
                            <td data-order="${sortKey}">${istTime}</td>
                            <td>${req.TR}</td>
                            <td>${req.StudentName}</td>
                            <td>${req.CurrentSlotName || '<span class="text-muted">None</span>'}</td>
                            <td>${req.RequestedSlotName} ${availableText}</td>
                            <td class="reason-cell" style="max-width: 200px; word-wrap: break-word; white-space: normal;">${escapedReason}</td>
                            <td>
                                <div class="d-flex gap-1 justify-content-center">
                                    <button class="btn btn-outline-success btn-sm approve-request-btn py-1 px-2" style="font-size: 0.75rem; font-weight: 500; border-radius: 4px;" data-id="${req.RequestID}" data-name="${req.StudentName}" data-capacity="${req.RequestedSlotAvailable}">Approve</button>
                                    <button class="btn btn-outline-danger btn-sm reject-request-btn py-1 px-2" style="font-size: 0.75rem; font-weight: 500; border-radius: 4px;" data-id="${req.RequestID}" data-name="${req.StudentName}">Reject</button>
                                </div>
                            </td>
                        </tr>
                    `;
                    tbody.insertAdjacentHTML('beforeend', row);
                });
            }

            slotRequestsTable = $('#slotRequestsTable').DataTable({
                pageLength: 5,
                lengthMenu: [5, 10, 25],
                order: [[0, 'asc']] // Oldest first
            });

            // Re-attach listeners
            document.querySelectorAll('.approve-request-btn').forEach(btn => {
                btn.addEventListener('click', () => handleSlotRequestAction(btn.dataset.id, btn.dataset.name, 'Approved', btn.dataset.capacity));
            });
            document.querySelectorAll('.reject-request-btn').forEach(btn => {
                btn.addEventListener('click', () => handleSlotRequestAction(btn.dataset.id, btn.dataset.name, 'Rejected'));
            });

        } catch (err) {
            console.error('Error loading slot requests:', err);
        }
    }

    async function handleSlotRequestAction(requestID, studentName, status, capacity) {
        if (status === 'Approved' && parseInt(capacity) <= 0) {
            Swal.fire('Cannot Approve', 'The requested slot is currently full.', 'warning');
            return;
        }

        const { value: remarks } = await Swal.fire({
            title: `${status} Slot Change?`,
            text: `Are you sure you want to ${status.toLowerCase()} the request for ${studentName}?`,
            input: 'text',
            inputPlaceholder: 'Optional remarks...',
            icon: status === 'Approved' ? 'question' : 'warning',
            showCancelButton: true,
            confirmButtonColor: status === 'Approved' ? 'var(--primary)' : 'var(--danger)',
            confirmButtonText: `Yes, ${status}`
        });

        if (remarks !== undefined) {
            try {
                const res = await fetch(`/api/staff/slot-requests/${requestID}/status`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ status, remarks })
                });

                const data = await res.json();
                if (data.success) {
                    Swal.fire('Success', data.message, 'success');
                    loadSlotRequestsTable();
                    loadSlots(); // Update counts
                    // Refresh notifications if function exists
                    if (typeof window.staffNotificationsRefresh === 'function') {
                        window.staffNotificationsRefresh();
                    }
                } else {
                    Swal.fire('Error', data.message, 'error');
                }
            } catch (err) {
                console.error('Error updating slot request:', err);
                Swal.fire('Error', 'Failed to process request.', 'error');
            }
        }
    }

    // Initialize
    loadSlots();
    loadRecentActivations();
    loadSlotRequestsTable(); // Load requests
    loadSlotTable();
});
