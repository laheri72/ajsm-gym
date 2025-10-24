document.addEventListener("DOMContentLoaded", () => {
    // This block now contains ALL code that interacts with the page.
    // It will only run after the HTML is fully loaded.

    let cachedSlots = null;
    let waitingListDataTable = null;

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
                { data: 'WaitingID' }, { data: 'TR' }, { data: 'Name' }, { data: 'Darajah' }, { data: 'Goal' },
                { data: 'RequestedAt', render: (data) => new Date(data).toLocaleString() },
                { 
                    data: 'WaitingID', orderable: false,
                    render: function(data) {
                        let slotOptions = availableSlots.map(slot => 
                            `<option value="${slot.SlotID}" ${slot.AvailableSeats <= 0 ? 'disabled' : ''}>
                                ${slot.SlotName} (${slot.AvailableSeats} seats)
                            </option>`
                        ).join('');
                        return `
                            <select class="assign-slot-dropdown form-control" style="width: auto; display: inline-block; margin-right: 5px;">
                                <option value="" disabled selected>Select Slot</option>
                                ${slotOptions}
                            </select>
                            <button class="btn assign-btn" data-id="${data}">Assign</button>
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

    // --- DYNAMIC FORM LOGIC ---

    function updateDarajahOptionsBasedOnGender(gender) {
        if (!gender) return;
        const isFemale = gender.toLowerCase() === 'female';
        const darajahSelect = document.getElementById('darajah');
        if (!darajahSelect) return;
        const maleOptions = ["Class 5 AM", "Class 5 BM", "Class 6 AM", "Class 6 BM", "Class 7 AM", "Class 7 BM", "Class 8 AM", "Class 9 AM", "Class 10 AM", "Class 11 AM"];
        darajahSelect.innerHTML = '<option value="" disabled selected>Select Darajah</option>';
        maleOptions.forEach(optionText => {
            let displayText = isFemale ? optionText.replace('AM', 'AF').replace('BM', 'BF') : optionText;
            darajahSelect.appendChild(new Option(displayText, displayText));
        });
    }

    // --- EVENT LISTENERS (NOW SAFELY INSIDE DOMCONTENTLOADED) ---
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

    // 3. Prepare payload (same as before)
    const payload = {
        TR: document.getElementById('trNo').value.trim(), 
        Name: document.getElementById('studentName').value,
        Darajah: document.getElementById('darajah').value,
        Goal: document.getElementById('goal').value
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

    // 3. Prepare payload (same as before) [cite: 434]
    const payload = {
        SlotName: document.getElementById('slot').value.trim(),
        MaxCapacity: parseInt(document.getElementById('maxCapacity').value, 10)
    };

    try {
        // 4. Make the API call (same as before) [cite: 434-435]
        const res = await fetch('/api/slots', {
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json(); // [cite: 435]

        // 5. Handle response (same as before)
        if (res.ok) {
            Swal.fire({ 
                toast: true, 
                position: 'top-end', 
                icon: 'success', 
                title: 'Slot created!', 
                showConfirmButton: false, 
                timer: 2000 
            }); // [cite: 435]
            this.reset(); // [cite: 435]
            refreshSlotEntryPage(); // [cite: 435]
        } else {
            Swal.fire({ 
                icon: 'error', 
                title: 'Oops...', 
                text: 'Error: ' + data.error 
            }); // [cite: 436]
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

    const user = JSON.parse(localStorage.getItem('staffUser'));
    if (user && user.Gender) {
        updateDarajahOptionsBasedOnGender(user.Gender);
    }

 // --- START: NEW BULK IMPORT LOGIC ---

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

// MODIFIED function inside the DOMContentLoaded listener
async function validateAndPreview(students) {
    Swal.fire({
        title: 'Validating Students...',
        text: 'Please wait while we check for duplicates and errors.',
        didOpen: () => { Swal.showLoading() }
    });

    const res = await fetch('/api/bulk-validate-students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ students })
    });
    const result = await res.json();

    if (!res.ok) {
        Swal.fire('Validation Error', result.message || 'An unknown error occurred.', 'error');
        return;
    }

    // NEW: Handle the more detailed response
    const { validStudents, duplicateTRs, invalidRows } = result;

    // Build the HTML for the SweetAlert summary
    let summaryHtml = `<div style="text-align: left; margin-top: 1rem;">`;

    if (validStudents.length > 0) {
        summaryHtml += `<p class="text-success"><strong>✅ Students to be added: ${validStudents.length}</strong></p>`;
    }

    if (duplicateTRs.length > 0) {
        summaryHtml += `
            <hr>
            <p class="text-warning"><strong>⚠️ Skipping ${duplicateTRs.length} duplicate(s):</strong></p>
            <ul class="swal-list">
                ${duplicateTRs.map(s => `<li>TR <strong>${s.TR}</strong> (${s.Name}) already exists.</li>`).join('')}
            </ul>`;
    }
    
    if (invalidRows.length > 0) {
        summaryHtml += `
            <hr>
            <p class="text-danger"><strong>❌ Skipping ${invalidRows.length} invalid row(s):</strong></p>
            <ul class="swal-list">
                ${invalidRows.map(row => `<li>Row ${row.fileRow}: ${row.rowData.Name} - <strong>${row.reason}</strong></li>`).join('')}
            </ul>`;
    }

    summaryHtml += `</div>`;

    // Show the confirmation dialog
    Swal.fire({
        title: 'Import Summary',
        html: summaryHtml,
        icon: 'info',
        showCancelButton: true,
        confirmButtonColor: '#4CAF50',
        cancelButtonColor: '#d33',
        confirmButtonText: `Yes, add ${validStudents.length} students!`,
        preConfirm: () => {
            if (validStudents.length === 0) {
                Swal.showValidationMessage('There are no new students to import.');
                return false;
            }
            return true;
        }
    }).then((action) => {
        if (action.isConfirmed) {
            commitBulkAdd(validStudents);
        }
    });
}
    
    // 8. Function to send the final, validated list for insertion
    async function commitBulkAdd(validStudents) {
        const res = await fetch('/api/bulk-commit-students', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ students: validStudents })
        });
        const data = await res.json();

        if (res.ok) {
            Swal.fire('Success!', `${data.count} students have been added to the waiting list.`, 'success');
            refreshSlotEntryPage(); // Use your existing function to refresh tables!
        } else {
            Swal.fire('Error!', 'Could not add students: ' + data.message, 'error');
        }
    }


const downloadTemplateBtn = document.getElementById('downloadTemplateBtn');

    downloadTemplateBtn.addEventListener('click', () => {
        // Define the headers for the template file
        const headers = [
            ["TR", "Name", "Darajah", "Goal"]
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
    // --- END: NEW BULK IMPORT LOGIC ---

    loadWaitingList();
    loadSlotTable();
});