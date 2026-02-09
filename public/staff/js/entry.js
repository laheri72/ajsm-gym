document.addEventListener("DOMContentLoaded", () => {
    // This block now contains ALL code that interacts with the page.
    // It will only run after the HTML is fully loaded.

    let cachedSlots = null;
    let waitingListDataTable = null;
    let lastPreviewedTR = null;

    // --- CORE FUNCTIONS for Slot and List Management ---

    async function getSlots() {
        if (cachedSlots) return cachedSlots;
        const res = await fetch('/api/slots');
        const data = await res.json();
        const slots = data.slots || data;
        if (!Array.isArray(slots)) {
            console.error("Slots API did not return array:", data);
            return [];
        }
        cachedSlots = slots;
        return cachedSlots;
    }

    async function refreshSlotEntryPage() {
        cachedSlots = null;
        if (waitingListDataTable) {
            waitingListDataTable.ajax.reload();
        }
        await loadSlotTable();
    }

    // --- STUDENT ENTRY AND WAITING LIST ---

    async function loadWaitingList() {
        if (waitingListDataTable) {
            waitingListDataTable.ajax.reload();
            return;
        }

        const availableSlots = await getSlots();
        
        waitingListDataTable = $('#waitingListTable').DataTable({
            ajax: { url: '/api/waiting-list', dataSrc: '' },
            columns: [
                { data: 'WaitingID' },
                { data: 'TR' },
                { data: 'Name' },
                { data: 'Darajah' },
                { data: 'RequestedAt', render: (data) => new Date(data).toLocaleString() },
                { 
                    data: 'WaitingID', 
                    orderable: false,
                    // --- 1. MODIFIED RENDER FUNCTION ---
                    render: function(data, type, row) { // Added 'row' to get student name
                        let slotOptions = availableSlots.map(slot => 
                            `<option value="${slot.SlotID}" ${slot.AvailableSeats <= 0 ? 'disabled' : ''}>
                                ${slot.SlotName} (${slot.AvailableSeats} seats)
                            </option>`
                        ).join('');
                        
                        // NEW: Added a wrapper div and the delete button
                        return `
                            <div class="action-buttons-wrapper">
                                <select class="assign-slot-dropdown form-control" style="width: auto; display: inline-block;">
                                    <option value="" disabled selected>Select Slot</option>
                                    ${slotOptions}
                                </select>
                                <button class="btn assign-btn" data-id="${data}">Assign</button>
                                
                                <button class="btn btn-sm btn-danger delete-btn" data-id="${data}" data-name="${row.Name}" title="Remove from list" style="background-color: red">
                                    <i class="bi bi-trash">Delete</i>
                                </button>
                            </div>
                        `;
                    }
                }
            ],
            responsive: true,
            destroy: true,
            language: {
                emptyTable: "No students in the waiting list."
            }
        });
    }

    // --- SLOT MANAGEMENT ---
    async function loadSlotTable() {
        const tbody = document.querySelector('#slotTable tbody');
        tbody.innerHTML = '<tr><td colspan="6" class="loader-cell"><div class="loader"></div></td></tr>';
        try {
            const slots = await getSlots();
            if (slots.length === 0) {
                tbody.innerHTML = '<tr><td colspan="6">No slots created yet</td></tr>';
                return;
            }
            tbody.innerHTML = '';
            slots.forEach(slot => {
                const assignedCount = (slot.MaxCapacity || 0) - (slot.AvailableSeats || 0);
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${slot.SlotID}</td>
                    <td>${slot.SlotName}</td>
                    <td>${slot.MaxCapacity}</td>
                    <td>${assignedCount}</td>
                    <td>${slot.AvailableSeats || 0}</td>
                    <td><button class="btn btn-sm btn-danger" onclick="deleteSlot(${slot.SlotID})">Delete</button></td>
                `;
                tbody.appendChild(tr);
            });
        } catch (err) {
            console.error('Error loading slots:', err);
            tbody.innerHTML = '<tr><td colspan="6">Error loading slots</td></tr>';
        }
    }

    window.deleteSlot = async function(slotId) { // Attached to window to be accessible from inline onclick
        Swal.fire({
            title: 'Are you sure?', text: "This will permanently delete the slot!",
            icon: 'warning', showCancelButton: true, confirmButtonColor: '#4CAF50',
            cancelButtonColor: '#d33', confirmButtonText: 'Yes, delete it!'
        }).then(async (result) => {
            if (result.isConfirmed) {
                const res = await fetch(`/api/slots/${slotId}`, { method: 'DELETE' });
                if (res.ok) {
                    Swal.fire('Deleted!', 'The slot has been deleted.', 'success');
                    refreshSlotEntryPage();
                } else {
                    const data = await res.json();
                    Swal.fire('Error!', 'Error: ' + data.error, 'error');
                }
            }
        });
    }

    // --- EVENT LISTENERS (NOW SAFELY INSIDE DOMCONTENTLOADED) ---
    const trInput = document.getElementById('trNo');
    const nameInput = document.getElementById('studentName');
    const darajahInput = document.getElementById('darajah');

    function setAddButtonEnabled(enabled) {
        const submitBtn = document.getElementById('addStudentBtn');
        if (submitBtn) submitBtn.disabled = !enabled;
    }

    function setDarajahValue(darajah) {
        if (!darajahInput) return;
        const value = (darajah || '').toString().trim();
        darajahInput.value = value;
    }

    function clearPreviewFields() {
        if (nameInput) nameInput.value = '';
        setDarajahValue('');
        setAddButtonEnabled(false);
        lastPreviewedTR = null;
    }

    async function previewStudentByTR(tr) {
        const trValue = (tr || '').toString().trim();
        const trInt = parseInt(trValue, 10);

        if (!trValue || Number.isNaN(trInt)) {
            clearPreviewFields();
            return;
        }

        if (lastPreviewedTR === trValue) {
            return;
        }
        lastPreviewedTR = trValue;

        setAddButtonEnabled(false);
        if (nameInput) nameInput.value = 'Loading...';
        setDarajahValue('');

        try {
            const res = await fetch('/api/add-student', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ TR: trValue, preview: true })
            });

            const data = await res.json();

            if (!res.ok || !data?.success) {
                const message = data?.message || data?.error || 'Could not fetch student details';
                Swal.fire({
                    toast: true,
                    position: 'top-end',
                    icon: 'error',
                    title: message,
                    showConfirmButton: false,
                    timer: 3000
                });
                clearPreviewFields();
                return;
            }

            if (nameInput) nameInput.value = data.student?.Name || '';
            setDarajahValue(data.student?.Darajah || '');
            setAddButtonEnabled(true);

        } catch (err) {
            console.error("Preview student error:", err);
            clearPreviewFields();
        }
    }

    if (trInput) {
        trInput.addEventListener('blur', () => previewStudentByTR(trInput.value));
        trInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                previewStudentByTR(trInput.value);
            }
        });
        trInput.addEventListener('input', () => {
            // If staff changes TR after a preview, invalidate the preview fields.
            const current = trInput.value.trim();
            if (lastPreviewedTR && current !== lastPreviewedTR) {
                clearPreviewFields();
            }
        });
    }

    document.getElementById('studentEntryForm').addEventListener('submit', async function (event) {
        event.preventDefault();

        // 1. Get references to the button and its parts
        const submitBtn = document.getElementById('addStudentBtn'); // Use the ID we added
        const buttonText = submitBtn.querySelector('.button-text');
        const spinner = submitBtn.querySelector('.spinner-border');

        // 2. Start Loader: Disable button, show spinner
        submitBtn.disabled = true;
        buttonText.classList.add('d-none');
        spinner.classList.remove('d-none');

        // 3. Prepare payload (TR only; backend fetches Name/Darajah from TestMaster)
        const payload = {
            TR: document.getElementById('trNo').value.trim()
        };

        try {
            // 4. Make the API call (same as before)
            const res = await fetch('/api/add-student', {
                method: 'POST', 
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const data = await res.json();

            // 5. Handle response (same as before)
            if (res.ok && data.success) {
                Swal.fire({ 
                    toast: true, 
                    position: 'top-end', 
                    icon: 'success', 
                    title: 'Student added to Waiting List!', 
                    showConfirmButton: false, 
                    timer: 2000 
                });
                refreshSlotEntryPage(); // Refreshes tables
                this.reset(); // Resets the form fields
                clearPreviewFields();
            } else {
                Swal.fire({ 
                    icon: 'error', 
                    title: 'Oops...', 
                    text: 'Error: ' + data.message 
                });
            }
        } catch (err) {
            // Handle potential network errors
            console.error("Add student error:", err);
            Swal.fire({ 
                icon: 'error', 
                title: 'Server Error', 
                text: 'Could not add student. Please try again later.' 
            });
        } finally {
            // 6. Stop Loader: Re-enable button, hide spinner (ALWAYS runs)
            submitBtn.disabled = false;
            buttonText.classList.remove('d-none');
            spinner.classList.add('d-none');
        }
    });

    // ... (waitingListTable click listener is unchanged) ...
    $('#waitingListTable tbody').on('click', '.assign-btn', async function () {
        const assignBtn = $(this); // Get the jQuery object for the clicked button
        const originalBtnText = assignBtn.html(); // Store the original button content (e.g., "Assign")
        
        const waitingID = assignBtn.data('id');
        const slotDropdown = assignBtn.closest('td').find('.assign-slot-dropdown');
        const slotID = slotDropdown.val();

        if (!slotID) {
            return Swal.fire('No Slot Selected', 'Please select a slot first!', 'warning');
        }

        try {
            // --- START LOADER EFFECT ---
            assignBtn.prop('disabled', true);
            assignBtn.html(
                `<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Assigning...`
            );

            const res = await fetch("/api/assign-student-slot", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ WaitingID: parseInt(waitingID), SlotID: parseInt(slotID) })
            });

            const data = await res.json();

            if (res.ok) {
                Swal.fire({ 
                    toast: true, 
                    position: 'top-end', 
                    icon: 'success', 
                    title: 'Student Assigned!', 
                    showConfirmButton: false, 
                    timer: 3000 
                });
                refreshSlotEntryPage(); // On success, the table redraws, removing the loader automatically.
            } else {
                Swal.fire('Assignment Failed', `Error: ${data.message}`, 'error');
                // --- STOP LOADER (on failure) ---
                assignBtn.prop('disabled', false);
                assignBtn.html(originalBtnText);
            }
        } catch (err) {
            console.error("Assign student error:", err);
            Swal.fire('Server Error', 'Failed to assign student', 'error');
            // --- STOP LOADER (on error) ---
            assignBtn.prop('disabled', false);
            assignBtn.html(originalBtnText);
        }
    });

    // --- 2. NEW EVENT LISTENER FOR DELETE BUTTON ---
    $('#waitingListTable tbody').on('click', '.delete-btn', function () {
        const waitingID = $(this).data('id');
        const studentName = $(this).data('name'); // Get name for the alert

        Swal.fire({
            title: 'Are you sure?',
            html: `This will permanently remove <strong>${studentName}</strong> from the waiting list.`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'Yes, delete it!'
        }).then(async (result) => {
            if (result.isConfirmed) {
                try {
                    const res = await fetch(`/api/waiting-list/${waitingID}`, {
                        method: 'DELETE'
                    });

                    const data = await res.json();

                    if (res.ok) {
                        Swal.fire({
                            toast: true,
                            position: 'top-end',
                            icon: 'success',
                            title: 'Student deleted.',
                            showConfirmButton: false,
                            timer: 2000
                        });
                        waitingListDataTable.ajax.reload(); // Refresh the table
                    } else {
                        Swal.fire('Error!', data.message || 'Could not delete student.', 'error');
                    }
                } catch (err) {
                    console.error('Delete student fetch error:', err);
                    Swal.fire('Error!', 'A network error occurred. Please try again.', 'error');
                }
            }
        });
    });

    // ... (createSlotForm submit listener is unchanged) ...
    document.getElementById('createSlotForm').addEventListener('submit', async function (e) {
        e.preventDefault();

        // 1. Get references to the button and its parts
        const submitBtn = document.getElementById('createSlotBtn'); // Use the ID we added
        const buttonText = submitBtn.querySelector('.button-text');
        const spinner = submitBtn.querySelector('.spinner-border');

        // 2. Start Loader: Disable button, show spinner
        submitBtn.disabled = true;
        buttonText.classList.add('d-none');
        spinner.classList.remove('d-none');

        // 3. Prepare payload (same as before)
        const payload = {
            SlotName: document.getElementById('slot').value.trim(),
            MaxCapacity: parseInt(document.getElementById('maxCapacity').value, 10)
        };

        try {
            // 4. Make the API call (same as before)
            const res = await fetch('/api/slots', {
                method: 'POST', 
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json(); //

            // 5. Handle response (same as before)
            if (res.ok) {
                Swal.fire({ 
                    toast: true, 
                    position: 'top-end', 
                    icon: 'success', 
                    title: 'Slot created!', 
                    showConfirmButton: false, 
                    timer: 2000 
                }); //
                this.reset(); //
                refreshSlotEntryPage(); //
            } else {
                Swal.fire({ 
                    icon: 'error', 
                    title: 'Oops...', 
                    text: 'Error: ' + data.error 
                }); //
            }
        } catch (err) {
            // Handle potential network errors
            console.error("Create slot error:", err);
            Swal.fire({ 
                icon: 'error', 
                title: 'Server Error', 
                text: 'Could not create slot. Please try again later.' 
            });
        } finally {
            // 6. Stop Loader: Re-enable button, hide spinner (ALWAYS runs)
            submitBtn.disabled = false;
            buttonText.classList.remove('d-none');
            spinner.classList.add('d-none');
        }
    });


    // --- PAGE INITIALIZATION ---

    // Manual entry now requires TR lookup first.
    clearPreviewFields();

    // --- START: MODIFIED BULK IMPORT LOGIC ---

    const bulkAddBtn = document.getElementById('bulkAddBtn');
    const fileInput = document.getElementById('fileInput');

    // 1. When "Import" button is clicked, trigger the hidden file input
    bulkAddBtn.addEventListener('click', () => {
        fileInput.click();
    });

    // js/entry.js

    // 2. When a file is selected, process it
    fileInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                const students = XLSX.utils.sheet_to_json(firstSheet);
                
                if (students.length === 0) {
                    Swal.fire('Empty File', 'The selected file has no student data.', 'warning');
                    return;
                }

                // --- START: NEW Client-Side TR Validation ---
                const invalidTRRows = [];
                // Regex to ensure the string contains only whole numbers from start to finish.
                const integerRegex = /^\d+$/; 

                students.forEach((student, index) => {
                    // Check if TR exists and if it's a valid integer string.
                    // We use .toString() to safely handle cases where Excel might interpret a number as a numeric type.
                    if (!student.TR || !integerRegex.test(student.TR.toString())) {
                        // Add 2 to index to match the actual row number in the Excel file (1-based + header row)
                        invalidTRRows.push(index + 2);
                    }
                });

                // If any invalid TRs were found, show an error and stop everything.
                if (invalidTRRows.length > 0) {
                    Swal.fire({
                        icon: 'error',
                        title: 'Invalid TR Number Format',
                        html: `The following rows in your file have an invalid TR number. <br><b>TR must be a whole number only (e.g., 12345).</b><br><br>Invalid row(s): <strong>${invalidTRRows.join(', ')}</strong>`,
                    });
                    return; // Stop processing before calling the backend
                }
                // --- END: NEW Client-Side TR Validation ---


                // If we get here, all TRs are in the correct format, so we can proceed to the backend.
                await validateAndPreview(students);

            } catch (err) {
                console.error('File parsing error:', err);
                Swal.fire('Error', 'Could not read or parse the file. Please ensure it is a valid Excel file.', 'error');
            } finally {
                // Reset file input to allow re-selection of the same file
                fileInput.value = '';
            }
        };
        reader.readAsArrayBuffer(file);
    });

    async function mapWithConcurrency(items, limit, mapper) {
        const results = new Array(items.length);
        let nextIndex = 0;

        async function worker() {
            while (true) {
                const index = nextIndex++;
                if (index >= items.length) return;
                results[index] = await mapper(items[index], index);
            }
        }

        const workerCount = Math.max(1, Math.min(limit, items.length));
        await Promise.all(Array.from({ length: workerCount }, () => worker()));
        return results;
    }

    async function previewTR(tr) {
        const res = await fetch('/api/add-student', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ TR: tr, preview: true })
        });

        let data = null;
        try { data = await res.json(); } catch { /* ignore */ }

        if (res.ok && data?.success) {
            return { tr, status: 'ok', name: data.student?.Name, darajah: data.student?.Darajah };
        }

        const message = data?.message || data?.error || 'Unknown error';
        if (res.status === 404) return { tr, status: 'not_found', message };
        if (res.status === 400) {
            if (message.includes('already assigned')) return { tr, status: 'already_active', message };
            if (message.includes('already in waiting list')) return { tr, status: 'already_waiting', message };
            return { tr, status: 'blocked', message };
        }
        return { tr, status: 'error', message };
    }

    async function addTRToWaitingList(tr) {
        const res = await fetch('/api/add-student', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ TR: tr })
        });

        let data = null;
        try { data = await res.json(); } catch { /* ignore */ }

        if (res.ok && data?.success) {
            return { tr, status: 'added' };
        }
        return { tr, status: 'failed', message: data?.message || data?.error || 'Unknown error' };
    }

    // MODIFIED function inside the DOMContentLoaded listener
    async function validateAndPreview(students) {
        const rawTRs = students
            .map(s => (s.TR ?? '').toString().trim())
            .filter(Boolean);

        const seen = new Set();
        const uniqueTRs = [];
        const duplicateInFile = new Set();
        rawTRs.forEach(tr => {
            if (seen.has(tr)) duplicateInFile.add(tr);
            else {
                seen.add(tr);
                uniqueTRs.push(tr);
            }
        });

        Swal.fire({
            title: 'Validating TRs...',
            text: 'Please wait while we fetch Name/Darajah from TestMaster.',
            didOpen: () => { Swal.showLoading(); }
        });

        const previews = await mapWithConcurrency(uniqueTRs, 6, (tr) => previewTR(tr));

        const toAdd = previews.filter(p => p.status === 'ok');
        const alreadyActive = previews.filter(p => p.status === 'already_active');
        const alreadyWaiting = previews.filter(p => p.status === 'already_waiting');
        const notFound = previews.filter(p => p.status === 'not_found');
        const blocked = previews.filter(p => p.status === 'blocked');
        const errors = previews.filter(p => p.status === 'error');

        const list = (items, formatter) => {
            const max = 12;
            const shown = items.slice(0, max);
            const more = items.length - shown.length;
            const html = shown.map(formatter).join('');
            return more > 0 ? `${html}<li>...and ${more} more</li>` : html;
        };

        let summaryHtml = `<div style="text-align: left; margin-top: 1rem;">`;
        summaryHtml += `<p class="text-success"><strong>✅ Ready to add: ${toAdd.length}</strong></p>`;

        if (duplicateInFile.size > 0) {
            const dupes = Array.from(duplicateInFile);
            summaryHtml += `
                <hr>
                <p class="text-warning"><strong>⚠️ Duplicate TRs in file: ${dupes.length}</strong></p>
                <ul class="swal-list">${list(dupes, (tr) => `<li>TR <strong>${tr}</strong></li>`)}</ul>
            `;
        }

        if (alreadyWaiting.length > 0) {
            summaryHtml += `
                <hr>
                <p class="text-warning"><strong>⚠️ Already in waiting list: ${alreadyWaiting.length}</strong></p>
                <ul class="swal-list">${list(alreadyWaiting, (s) => `<li>TR <strong>${s.tr}</strong></li>`)}</ul>
            `;
        }

        if (alreadyActive.length > 0) {
            summaryHtml += `
                <hr>
                <p class="text-warning"><strong>⚠️ Already Active: ${alreadyActive.length}</strong></p>
                <ul class="swal-list">${list(alreadyActive, (s) => `<li>TR <strong>${s.tr}</strong></li>`)}</ul>
            `;
        }

        if (notFound.length > 0) {
            summaryHtml += `
                <hr>
                <p class="text-danger"><strong>❌ Not found in TestMaster: ${notFound.length}</strong></p>
                <ul class="swal-list">${list(notFound, (s) => `<li>TR <strong>${s.tr}</strong></li>`)}</ul>
            `;
        }

        if (blocked.length > 0 || errors.length > 0) {
            summaryHtml += `
                <hr>
                <p class="text-danger"><strong>❌ Errors: ${blocked.length + errors.length}</strong></p>
                <ul class="swal-list">${list([...blocked, ...errors], (s) => `<li>TR <strong>${s.tr}</strong> - ${s.message}</li>`)}</ul>
            `;
        }

        summaryHtml += `</div>`;

        Swal.fire({
            title: 'Import Summary',
            html: summaryHtml,
            icon: 'info',
            showCancelButton: true,
            confirmButtonColor: '#4CAF50',
            cancelButtonColor: '#d33',
            confirmButtonText: `Yes, add ${toAdd.length} students!`,
            preConfirm: () => {
                if (toAdd.length === 0) {
                    Swal.showValidationMessage('There are no students ready to import.');
                    return false;
                }
                return true;
            }
        }).then((action) => {
            if (action.isConfirmed) {
                commitBulkAdd(toAdd.map(s => s.tr));
            }
        });
    }

    async function commitBulkAdd(trs) {
        Swal.fire({
            title: 'Adding students...',
            text: 'Please wait while we add students to the waiting list.',
            didOpen: () => { Swal.showLoading(); }
        });

        const results = await mapWithConcurrency(trs, 6, (tr) => addTRToWaitingList(tr));
        const added = results.filter(r => r.status === 'added');
        const failed = results.filter(r => r.status === 'failed');

        if (failed.length === 0) {
            Swal.fire('Success!', `${added.length} students have been added to the waiting list.`, 'success');
        } else {
            const max = 10;
            const details = failed.slice(0, max).map(f => `<li>TR <strong>${f.tr}</strong> - ${f.message}</li>`).join('');
            const more = failed.length - Math.min(max, failed.length);
            Swal.fire({
                icon: 'warning',
                title: 'Completed with issues',
                html: `Added <strong>${added.length}</strong>. Failed <strong>${failed.length}</strong>.<br><br><ul class="swal-list">${details}${more > 0 ? `<li>...and ${more} more</li>` : ''}</ul>`
            });
        }

        refreshSlotEntryPage();
    }


    const downloadTemplateBtn = document.getElementById('downloadTemplateBtn');

    downloadTemplateBtn.addEventListener('click', () => {
        // Define the headers for the template file
        const headers = [
            ["TR"]
        ];

        // Create a new worksheet from the headers
        const ws = XLSX.utils.aoa_to_sheet(headers);
        
        // Create a new workbook
        const wb = XLSX.utils.book_new();

        // Append the worksheet to the workbook
        XLSX.utils.book_append_sheet(wb, ws, "WaitingList");

        // Trigger the download of the file
        XLSX.writeFile(wb, "Fittracker_WL_Template.xlsx");
    });
    // --- END: MODIFIED BULK IMPORT LOGIC ---

    loadWaitingList();
    loadSlotTable();
});
