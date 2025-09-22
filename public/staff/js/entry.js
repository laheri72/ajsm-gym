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
        const payload = {
            TR: document.getElementById('trNo').value.trim(), 
            Name: document.getElementById('studentName').value,
            Darajah: document.getElementById('darajah').value,
            Goal: document.getElementById('goal').value
        };
        const res = await fetch('/api/add-student', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (res.ok && data.success) {
            Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Student added to Waiting List!', showConfirmButton: false, timer: 2000 });
            refreshSlotEntryPage();
            this.reset();
        } else {
            Swal.fire({ icon: 'error', title: 'Oops...', text: 'Error: ' + data.message });
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
        const payload = {
            SlotName: document.getElementById('slot').value.trim(),
            MaxCapacity: parseInt(document.getElementById('maxCapacity').value, 10)
        };
        const res = await fetch('/api/slots', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (res.ok) {
            Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Slot created!', showConfirmButton: false, timer: 2000 });
            this.reset();
            refreshSlotEntryPage();
        } else {
            Swal.fire({ icon: 'error', title: 'Oops...', text: 'Error: ' + data.error });
        }
    });

    // --- PAGE INITIALIZATION ---

    const user = JSON.parse(localStorage.getItem('user'));
    if (user && user.Gender) {
        updateDarajahOptionsBasedOnGender(user.Gender);
    }

    loadWaitingList();
    loadSlotTable();
});