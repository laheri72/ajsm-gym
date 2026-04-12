document.addEventListener("DOMContentLoaded", () => {

    // --- GLOBAL VARIABLES ---
    let groupedSlotsData = {};
    let staffBranch = 'Unknown';
    let allDataTables = []; // Stores all table instances

    const GOAL_OPTIONS = [
        "General Fitness", "Weight Loss", "Muscle Gain", "Strength", "Endurance", "Flexibility", "Energy Boost", "Stress Relief", "Overall Health"
    ];

    /**
     * Applies data-label attributes for mobile-stacking view
     */
    function makeTableResponsive(tableId) {
        // ... (This function is unchanged) [cite: 30-33]
        const table = document.getElementById(tableId);
        if (!table) return;
        const headers = [];
        table.querySelectorAll('thead th').forEach(th => {
            headers.push(th.textContent.trim());
        });
        table.querySelectorAll('tbody tr').forEach(row => {
            row.querySelectorAll('td').forEach((td, index) => {
                if (headers[index]) {
                    td.setAttribute('data-label', headers[index]);
                }
            });
        });
    }

    /**
     * --- Main function to load and group students ---
     */
    async function loadAndGroupStudentRecords() {
        const container = document.getElementById('slot-cards-container');
        if (!container) return;

        // Clear the table instances array on reload
        allDataTables = [];

        try {
            // 1. Fetch staff user data for branch name
            try {
                const userString = localStorage.getItem('staffUser');
                if (userString) {
                    staffBranch = JSON.parse(userString).Branch || 'Unknown';
                }
            } catch (e) { /* Fails silently */ }

            // 2. Fetch all student data
            const res = await fetch('/api/students');
            const json = await res.json();
            if (!json.success || !json.data) {
                throw new Error(json.error || 'Failed to load data');
            }

            const students = json.data;

            // 3. Group students by SlotName
            const slots = {};
            students.forEach(student => {
                const slotName = student.SlotName || 'Unassigned';
                if (!slots[slotName]) {
                    slots[slotName] = [];
                }
                slots[slotName].push(student);
            });

            groupedSlotsData = slots;

            // 4. Clear loader
            container.innerHTML = '';
            const sortedSlotNames = Object.keys(slots).sort();

            if (sortedSlotNames.length === 0) {
                container.innerHTML = '<div class="card p-3"><p class="text-muted mb-0">No active students found.</p></div>';
                return;
            }

            // 5. Create HTML for each slot card
            sortedSlotNames.forEach((slotName, index) => {
                const studentsInSlot = slots[slotName];
                const tableId = `slot-table-${index}`;

                const card = document.createElement('div');
                card.className = 'card slot-card p-3 p-md-4';

                // --- MODIFIED: Added classes to TH elements ---
                card.innerHTML = `
                    <h4 class="slot-card-header">Slot: ${slotName} (${studentsInSlot.length} Members)</h4>
                    <div style="overflow-x: auto;">
                        <table id="${tableId}" class="table table-striped table-bordered stacking-card-table" style="width:100%">
                            <thead>
                                <tr>
                                    <th class="col-tr">Tr No</th>
                                    <th class="col-name">Name</th>
                                    <th class="col-darajah">Darajah</th>
                                    <th class="col-goal">Goal</th> 
                                    <th class="col-slot">Slot</th>
                                    <th class="col-actions">Actions</th>
                                </tr>
                            </thead>
                        </table>
                    </div>
                `;
                container.appendChild(card);

                // 6. Initialize DataTable
                const newTable = $(`#${tableId}`).DataTable({
                    data: studentsInSlot,
                    columns: [
                        { data: 'TR', className: 'col-tr' },
                        { data: 'Name', className: 'col-name' },
                        { data: 'Darajah', className: 'col-darajah' },
                        {
                            data: 'Goal',
                            className: 'col-goal',
                            render: function (data, type, row) {
                                let goalText = data ? data : 'Not Set';
                                return `<span class="goal-text">${goalText}</span>
                                        <button class="btn btn-sm btn-outline-secondary edit-goal-btn" data-tr="${row.TR}">✏️</button>`;
                            }
                        },
                        {
                            data: 'SlotName',
                            className: 'col-slot',
                            render: function (data, type, row) {
                                let displayText = !row.SlotID
                                    ? `<span class="text-muted">No slot assigned</span>`
                                    : `<span class="slot-text">${data}</span>`;
                                return `${displayText} <button class="btn btn-sm btn-outline-secondary edit-slot-btn" data-tr="${row.TR}">✏️</button>`;
                            }
                        },
                        {
                            data: 'TR',
                            className: 'col-actions',
                            orderable: false,
                            render: function (data) {
                                return `<button class="btn btn-sm btn-danger deactivate-btn" data-tr="${data}">🚫 Deactivate</button>`;
                            }
                        }
                    ],
                    responsive: true,
                    destroy: true,
                    pageLength: 5,
                    lengthMenu: [[5, 10, 25, -1], [5, 10, 25, "All"]],
                    drawCallback: function (settings) {
                        makeTableResponsive(tableId);
                    }
                });

                // Add the instance to our array
                allDataTables.push(newTable);
            });

        } catch (err) {
            console.error('Error loading student records:', err);
            container.innerHTML = `<div class="card p-3"><p class="text-danger">Error loading students: ${err.message}</p></div>`;
        }
    }

    /**
     * --- Export to Excel Function ---
     * (Goal column removed)
     */
    function exportToExcel() {
        if (Object.keys(groupedSlotsData).length === 0) {
            return Swal.fire('No Data', 'There is no student data to export.', 'info');
        }

        const wb = XLSX.utils.book_new();
        const today = new Date().toLocaleDateString('en-GB');
        const title = `Khaima al-Riyada - ${staffBranch} - ${today}`;

        Object.keys(groupedSlotsData).sort().forEach(slotName => {
            const studentsInSlot = groupedSlotsData[slotName];

            // Map data to 4 columns
            const sheetData = studentsInSlot.map(student => ({
                'TR No': student.TR,
                'Name': student.Name,
                'Darajah': student.Darajah,
                'Slot': student.SlotName || 'Unassigned'
            }));

            const ws = XLSX.utils.json_to_sheet([]);
            XLSX.utils.sheet_add_aoa(ws, [[title]], { origin: 'A1' });
            XLSX.utils.sheet_add_aoa(ws, [[`Slot: ${slotName}`]], { origin: 'A2' });
            XLSX.utils.sheet_add_json(ws, sheetData, { origin: 'A4' });
            const footerRow = ws['!ref'] ? XLSX.utils.decode_range(ws['!ref']).e.r + 3 : 6;
            XLSX.utils.sheet_add_aoa(ws, [['Created by Fit-Tracker']], { origin: `A${footerRow}` });

            const safeSheetName = slotName.replace(/[\*\[\]\:\/\?\\]/g, '').substring(0, 31);
            XLSX.utils.book_append_sheet(wb, ws, safeSheetName);
        });

        XLSX.writeFile(wb, `FitTracker_Slots_Export_${staffBranch}_${today}.xlsx`);
    }

    /**
     * --- Export to PDF Function ---
     * Uses pdfMake for a controlled, repeatable layout on all pages.
     */
    function exportToPDF() {
        if (Object.keys(groupedSlotsData).length === 0) {
            return Swal.fire('No Data', 'There is no student data to export.', 'info');
        }

        if (typeof window.pdfMake === 'undefined') {
            return Swal.fire('PDF Engine Missing', 'Could not load PDF generator. Please refresh and try again.', 'error');
        }

        const printDate = new Date().toLocaleDateString('en-US', { dateStyle: 'long' });
        const fileDate = new Date().toISOString().split('T')[0];
        const sortedSlotNames = Object.keys(groupedSlotsData).sort();

        const content = [];

        sortedSlotNames.forEach((slotName, index) => {
            const studentsInSlot = groupedSlotsData[slotName] || [];

            content.push({
                text: `Slot: ${slotName} (${studentsInSlot.length} Members)`,
                style: 'slotHeader',
                margin: [0, 0, 0, 6],
                pageBreak: index === 0 ? undefined : 'before'
            });

            const tableBody = [
                [
                    { text: 'TR No', style: 'tableHeader', alignment: 'center' },
                    { text: 'Name', style: 'tableHeader', alignment: 'left' },
                    { text: 'Darajah', style: 'tableHeader', alignment: 'center' }
                ],
                ...studentsInSlot.map((student) => ([
                    { text: String(student.TR ?? ''), style: 'tableCell', alignment: 'center' },
                    { text: String(student.Name ?? ''), style: 'tableCell', alignment: 'left' },
                    { text: String(student.Darajah ?? ''), style: 'tableCell', alignment: 'center' }
                ]))
            ];

            content.push({
                table: {
                    headerRows: 1,
                    widths: [58, '*', 52], // Darajah is intentionally narrow; Name gets remaining width.
                    body: tableBody
                },
                layout: {
                    fillColor: function (rowIndex) {
                        return rowIndex === 0 ? '#f2f2f2' : null;
                    },
                    hLineColor: function () { return '#777'; },
                    vLineColor: function () { return '#777'; }
                }
            });
        });

        const docDefinition = {
            pageSize: 'A4',
            pageMargins: [26, 78, 26, 40],
            header: function () {
                return {
                    margin: [26, 18, 26, 0],
                    stack: [
                        { text: 'Khaima al-Riyada - GYM', style: 'docTitle', alignment: 'center' },
                        { text: 'Active Gym Members', style: 'docSubTitle', alignment: 'center' },
                        { text: `Branch: ${staffBranch}`, style: 'docSubTitle', alignment: 'center' }
                    ]
                };
            },
            footer: function (currentPage, pageCount) {
                return {
                    margin: [26, 0, 26, 12],
                    columns: [
                        { text: `Date: ${printDate}`, style: 'footerText', alignment: 'left' },
                        {
                            alignment: 'right',
                            stack: [
                                { text: 'Fit-Tracker', style: 'footerStamp' },
                                { text: `Page ${currentPage} of ${pageCount}`, style: 'footerText' }
                            ]
                        }
                    ]
                };
            },
            content,
            styles: {
                docTitle: { fontSize: 14, bold: true },
                docSubTitle: { fontSize: 10 },
                slotHeader: { fontSize: 11, bold: true },
                tableHeader: { fontSize: 9, bold: true },
                tableCell: { fontSize: 9 },
                footerText: { fontSize: 9, color: '#444' },
                footerStamp: { fontSize: 9, bold: true, color: '#666' }
            },
            defaultStyle: {
                fontSize: 9
            }
        };

        window.pdfMake.createPdf(docDefinition).download(`Active_Gym_Members_${staffBranch}_${fileDate}.pdf`);
    }

    // --- DELEGATED EVENT LISTENERS (Unchanged) ---

    $('#student-record').on('click', '.deactivate-btn', function () {
        // ... (function unchanged) [cite: 45-55]
        const deactivateBtn = $(this);
        const originalBtnText = deactivateBtn.html();
        const tr = deactivateBtn.data('tr');

        Swal.fire({
            title: 'Deactivate Student?',
            text: `Are you sure you want to deactivate student TR ${tr}? Their slot will be freed up.`,
            input: 'textarea',
            inputLabel: 'Reason for deactivation',
            inputPlaceholder: 'Enter the reason shown in the audit log...',
            icon: 'warning', showCancelButton: true, confirmButtonColor: 'var(--primary)',
            cancelButtonColor: 'var(--danger)', confirmButtonText: 'Yes, deactivate.',
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
                    deactivateBtn.html('<span class="spinner-border spinner-border-sm"></span>');

                    const res = await fetch(`/api/students/status/${tr}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ Status: 'Inactive', Reason: result.value })
                    });

                    const data = await res.json();
                    if (res.ok) {
                        Swal.fire('Deactivated!', data.message || 'The student has been deactivated.', 'success');
                        loadAndGroupStudentRecords();
                    } else {
                        throw new Error(data.error || data.message || 'Failed to update student');
                    }
                } catch (err) {
                    Swal.fire('Error', err.message || 'A network error occurred.', 'error');
                    deactivateBtn.prop('disabled', false);
                    deactivateBtn.html(originalBtnText);
                }
            }
        });
    });

    $('#student-record').on('click', '.edit-goal-btn', async function () {
        // ... (function unchanged)
        const tr = $(this).data('tr');
        const goalCell = $(this).closest('td');
        if (goalCell.find('select').length > 0) return;

        const currentGoal = goalCell.find('.goal-text').text().trim();

        const select = $('<select class="form-select form-select-sm" style="width: auto; display: inline-block; margin-right: 5px;"></select>');
        GOAL_OPTIONS.forEach(goal => {
            select.append(`<option value="${goal}" ${goal === currentGoal ? 'selected' : ''}>${goal}</option>`);
        });

        if (currentGoal === "Not Set" || !GOAL_OPTIONS.includes(currentGoal)) {
            select.prepend(`<option value="${currentGoal}" selected>${currentGoal}</option>`);
        }

        const saveBtn = $('<button class="btn btn-sm btn-success" style="margin-left: 5px;">💾</button>');
        const cancelBtn = $('<button class="btn btn-sm btn-secondary" style="margin-left: 5px;">❌</button>');

        goalCell.empty().append(select, saveBtn, cancelBtn);

        saveBtn.on('click', async () => {
            const newGoal = select.val();
            saveBtn.prop('disabled', true);
            cancelBtn.prop('disabled', true);
            select.prop('disabled', true);
            saveBtn.html('<span class="spinner-border spinner-border-sm"></span>');

            try {
                const res = await fetch('/api/change-student-goal', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ TR: parseInt(tr), Goal: newGoal })
                });
                const data = await res.json();
                if (!data.success) throw new Error(data.message);
                Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Goal updated!', showConfirmButton: false, timer: 2000 });
                loadAndGroupStudentRecords();
            } catch (err) {
                Swal.fire('Error', 'Error updating goal: ' + err.message, 'error');
                loadAndGroupStudentRecords();
            }
        });

        cancelBtn.on('click', () => {
            const table = $(this).closest('table').DataTable();
            table.row(goalCell.closest('tr')).invalidate().draw();
        });
    });

    $('#student-record').on('click', '.edit-slot-btn', async function () {
        // ... (function unchanged)
        const tr = $(this).data('tr');
        const slotCell = $(this).closest('td');
        if (slotCell.find('select').length > 0) return;

        let availableSlots = [];
        try {
            const slotRes = await fetch('/api/slots');
            const slotJson = await slotRes.json();
            if (!slotJson.success) throw new Error(slotJson.message || 'Failed to load slots');
            availableSlots = slotJson.slots || [];
        } catch (err) {
            return Swal.fire('Error', `Could not load slots: ${err.message}`, 'error');
        }

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

        if (slotCell.find('.text-muted').length > 0) {
            select.prepend(`<option value="" selected>No slot assigned</option>`);
        }

        const saveBtn = $('<button class="btn btn-sm btn-success" style="margin-left: 5px;">💾</button>');
        const cancelBtn = $('<button class="btn btn-sm btn-secondary" style="margin-left: 5px;">❌</button>');

        slotCell.empty().append(select, saveBtn, cancelBtn);

        saveBtn.on('click', async () => {
            const newSlotID = parseInt(select.val());
            if (isNaN(newSlotID) || !newSlotID) {
                return Swal.fire('Warning', 'Please select a valid slot.', 'warning');
            }

            saveBtn.prop('disabled', true);
            cancelBtn.prop('disabled', true);
            select.prop('disabled', true);
            saveBtn.html('<span class="spinner-border spinner-border-sm"></span>');

            try {
                const res = await fetch('/api/change-student-slot', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ TR: parseInt(tr), SlotID: newSlotID })
                });
                const data = await res.json();
                if (!data.success) throw new Error(data.message);

                Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Slot updated!', showConfirmButton: false, timer: 2000 });
                loadAndGroupStudentRecords();
            } catch (err) {
                Swal.fire('Error', 'Error updating slot: ' + err.message, 'error');
                loadAndGroupStudentRecords();
            }
        });

        cancelBtn.on('click', () => {
            const table = $(this).closest('table').DataTable();
            table.row(slotCell.closest('tr')).invalidate().draw();
        });
    });

    // --- Export Button Listeners ---

    $('#excel-btn').on('click', () => {
        exportToExcel();
    });

    $('#print-btn').on('click', () => {
        exportToPDF();
    });

    // --- PAGE INITIALIZATION ---
    loadAndGroupStudentRecords();
});
