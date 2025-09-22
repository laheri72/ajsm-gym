document.addEventListener("DOMContentLoaded", () => {
    // This variable will hold our DataTable instance so we don't re-create it
    let studentDataTable = null;

    /**
     * Loads the active student records into the DataTable.
     * If the table is already initialized, it just reloads the data.
     */
    async function loadStudentRecords() {
        if (studentDataTable) {
            studentDataTable.ajax.reload();
            return;
        }

        studentDataTable = $('#studentTable').DataTable({
            ajax: {
                url: '/api/students',
                dataSrc: 'data' // The API response has the student array in a 'data' property
            },
            columns: [
                { data: 'TR' },
                { data: 'Name' },
                { data: 'Darajah' },
                { data: 'Goal' },
                { 
                    data: 'SlotName',
                    render: function(data, type, row) {
                        let displayText = '';
                        if (!row.SlotID) {
                            displayText = `<span class="text-muted">No slot assigned</span>`;
                        } else {
                            // In the original file, there was logic for 'Inactive' status.
                            // Since this page is only for Active students, we simplify it.
                            displayText = `<span class="slot-text">${data}</span>`;
                        }
                        return `${displayText} <button class="btn btn-sm btn-outline-secondary edit-slot-btn" data-tr="${row.TR}">✏️</button>`;
                    }
                },
                { 
                    data: 'TR',
                    orderable: false,
                    render: function(data) {
                        return `<button class="btn btn-sm btn-danger deactivate-btn" data-tr="${data}">🚫 Deactivate</button>`;
                    }
                }
            ],
            responsive: true,
            destroy: true
        });
    }

    // --- DELEGATED EVENT LISTENERS ---

// Handles clicks on any 'Deactivate' button in the table
    $('#studentTable').on('click', '.deactivate-btn', function () {
        const deactivateBtn = $(this); // Get a reference to the button that was clicked
        const originalBtnText = deactivateBtn.html(); // Store original text/icon
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

                    const res = await fetch(`/api/students/status/${tr}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ Status: 'Inactive' })
                    });

                    if (res.ok) {
                        Swal.fire('Deactivated!', 'The student has been deactivated.', 'success');
                        studentDataTable.ajax.reload(); // Reloads the table, which removes the button automatically
                    } else {
                        Swal.fire('Error', 'Failed to update student.', 'error');
                        // --- STOP LOADER (on failure) ---
                        deactivateBtn.prop('disabled', false);
                        deactivateBtn.html(originalBtnText);
                    }
                } catch (err) {
                    Swal.fire('Error', 'A network error occurred.', 'error');
                    // --- STOP LOADER (on error) ---
                    deactivateBtn.prop('disabled', false);
                    deactivateBtn.html(originalBtnText);
                }
            }
        });
    });

// Handles clicks on any 'Edit Slot' (pencil) button in the table
    $('#studentTable').on('click', '.edit-slot-btn', async function () {
        const tr = $(this).data('tr');
        const slotCell = $(this).closest('td');

        if (slotCell.find('select').length > 0) return;

        const slotRes = await fetch('/api/slots');
        const slotJson = await slotRes.json();
        const availableSlots = slotJson.slots || [];
        const currentText = slotCell.find('.slot-text').text();

        const select = $('<select class="form-select form-select-sm" style="width: auto; display: inline-block; margin-right: 5px;"></select>').append(
            availableSlots.map(slot =>
                `<option value="${slot.SlotID}"
                    ${slot.SlotName === currentText ? 'selected' : ''}
                    ${slot.AvailableSeats <= 0 && slot.SlotName !== currentText ? 'disabled' : ''}>
                    ${slot.SlotName} (${slot.AvailableSeats || 0} left)
                </option>`
            ).join('')
        );
        const saveBtn = $('<button class="btn btn-sm btn-success" style="margin-left: 5px;">💾</button>');
        
        slotCell.empty().append(select, saveBtn);

        // Add a click listener for the new save button
        saveBtn.on('click', async () => {
            const newSlotID = parseInt(select.val());
            if (!newSlotID) return Swal.fire('Warning', 'Please select a valid slot.', 'warning');
            
            // --- START LOADER ---
            saveBtn.prop('disabled', true);
            select.prop('disabled', true); // Also disable the dropdown
            saveBtn.html('<span class="spinner-border spinner-border-sm"></span>');

            try {
                const res = await fetch('/api/change-student-slot', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ TR: parseInt(tr), SlotID: newSlotID })
                });
                const data = await res.json();
                if (data.success) {
                    Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Slot updated!', showConfirmButton: false, timer: 2000 });
                } else {
                    Swal.fire('Error', 'Error updating slot: ' + data.message, 'error');
                }
            } catch(err) {
                 Swal.fire('Error', 'A network error occurred.', 'error');
            } finally {
                // The table reload will happen regardless of success or failure, removing the loader.
                studentDataTable.ajax.reload();
            }
        });
    });
    // --- PAGE INITIALIZATION ---
    loadStudentRecords();
});