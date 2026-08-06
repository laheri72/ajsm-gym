document.addEventListener("DOMContentLoaded", () => {

    // --- GLOBAL VARIABLES & STATE ---
    let allStudentsData = [];
    let groupedSlotsData = {};
    let staffBranch = 'Unknown';
    let allDataTables = []; // Stores all table instances
    let currentViewMode = localStorage.getItem('recordsViewMode') || 'grouped'; // 'grouped' or 'compact'
    let compactDataTable = null;

    const GOAL_OPTIONS = [
        "General Fitness", "Weight Loss", "Muscle Gain", "Strength", "Endurance", "Flexibility", "Energy Boost", "Stress Relief", "Overall Health"
    ];

    /**
     * Applies data-label attributes for mobile-stacking responsive view
     */
    function makeTableResponsive(tableId) {
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
     * Destroys all active DataTable instances safely to prevent memory leaks or reinitialization errors
     */
    function destroyAllDataTables() {
        if (compactDataTable) {
            compactDataTable.destroy();
            compactDataTable = null;
        }

        allDataTables.forEach(table => {
            if (table && $.fn.DataTable.isDataTable(table.table().node())) {
                table.destroy();
            }
        });
        allDataTables = [];
    }

    /**
     * --- MAIN DATA LOADING FUNCTION ---
     */
    async function loadAndGroupStudentRecords() {
        const groupedContainer = document.getElementById('slot-cards-container');
        const compactContainer = document.getElementById('compact-view-container');
        
        if (!groupedContainer || !compactContainer) return;

        destroyAllDataTables();

        try {
            // 1. Fetch staff user branch
            try {
                const userString = localStorage.getItem('staffUser');
                if (userString) {
                    staffBranch = JSON.parse(userString).Branch || 'Unknown';
                }
            } catch (e) { /* Fails silently */ }

            // 2. Fetch all student records
            const res = await fetch('/api/students');
            const json = await res.json();
            if (!json.success || !json.data) {
                throw new Error(json.error || 'Failed to load student data');
            }

            allStudentsData = json.data;

            // 3. Group students by SlotName
            const slots = {};
            let unassignedCount = 0;

            allStudentsData.forEach(student => {
                const slotName = student.SlotName || 'Unassigned';
                if (!slots[slotName]) {
                    slots[slotName] = [];
                }
                slots[slotName].push(student);

                if (!student.SlotName || slotName === 'Unassigned') {
                    unassignedCount++;
                }
            });

            groupedSlotsData = slots;

            // 4. Update Summary Stat Cards
            const totalStudentsEl = document.getElementById('stat-total-students');
            const totalSlotsEl = document.getElementById('stat-total-slots');
            const unassignedEl = document.getElementById('stat-unassigned-students');

            if (totalStudentsEl) totalStudentsEl.textContent = allStudentsData.length;
            if (totalSlotsEl) totalSlotsEl.textContent = Object.keys(slots).filter(s => s !== 'Unassigned').length;
            if (unassignedEl) unassignedEl.textContent = unassignedCount;

            // 5. Populate Slot Filter Dropdown
            populateSlotFilterDropdown(Object.keys(slots).sort());

            // 6. Render depending on active view mode
            renderActiveView();

        } catch (err) {
            console.error('Error loading student records:', err);
            groupedContainer.innerHTML = `<div class="card p-3"><p class="text-danger mb-0">Error loading students: ${err.message}</p></div>`;
        }
    }

    /**
     * Populates the slot filter dropdown options
     */
    function populateSlotFilterDropdown(slotNames) {
        const filterSelect = document.getElementById('slot-filter-select');
        if (!filterSelect) return;

        const currentValue = filterSelect.value;
        filterSelect.innerHTML = '<option value="">All Slots & Batches</option>';

        slotNames.forEach(slot => {
            const count = (groupedSlotsData[slot] || []).length;
            const option = document.createElement('option');
            option.value = slot;
            option.textContent = `${slot} (${count})`;
            if (slot === currentValue) option.selected = true;
            filterSelect.appendChild(option);
        });
    }

    /**
     * Renders the view based on currentViewMode ('grouped' vs 'compact')
     */
    function renderActiveView() {
        destroyAllDataTables();

        const groupedContainer = document.getElementById('slot-cards-container');
        const compactContainer = document.getElementById('compact-view-container');
        const btnGrouped = document.getElementById('view-mode-grouped');
        const btnCompact = document.getElementById('view-mode-compact');

        if (currentViewMode === 'compact') {
            groupedContainer.style.display = 'none';
            compactContainer.style.display = 'block';

            if (btnGrouped) btnGrouped.classList.remove('active');
            if (btnCompact) btnCompact.classList.add('active');

            renderCompactListView();
        } else {
            compactContainer.style.display = 'none';
            groupedContainer.style.display = 'block';

            if (btnCompact) btnCompact.classList.remove('active');
            if (btnGrouped) btnGrouped.classList.add('active');

            renderGroupedSlotsView();
        }

        applySearchAndSlotFilters();
    }

    /**
     * --- RENDER GROUPED SLOTS VIEW (CARDS PER SLOT) ---
     */
    function renderGroupedSlotsView() {
        const container = document.getElementById('slot-cards-container');
        container.innerHTML = '';

        const sortedSlotNames = Object.keys(groupedSlotsData).sort();
        const selectedSlotFilter = document.getElementById('slot-filter-select')?.value || '';

        const slotsToDisplay = selectedSlotFilter 
            ? sortedSlotNames.filter(name => name === selectedSlotFilter)
            : sortedSlotNames;

        if (slotsToDisplay.length === 0) {
            container.innerHTML = '<div class="card p-4 text-center border-0 shadow-sm"><p class="text-muted mb-0">No student records found matching the current filters.</p></div>';
            return;
        }

        slotsToDisplay.forEach((slotName, index) => {
            const studentsInSlot = groupedSlotsData[slotName] || [];
            const tableId = `slot-table-${index}`;

            const card = document.createElement('div');
            card.className = 'card slot-card p-3 p-md-4 mb-4 border-0 shadow-sm';
            card.setAttribute('data-slot-name', slotName);

            card.innerHTML = `
                <div class="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
                    <h4 class="slot-card-header mb-0 text-dark fw-bold">
                        Slot: ${slotName} 
                        <span class="badge bg-light text-success border ms-2">${studentsInSlot.length} Members</span>
                    </h4>
                </div>
                <div style="overflow-x: auto;">
                    <table id="${tableId}" class="table table-hover table-striped table-bordered align-middle stacking-card-table" style="width:100%">
                        <thead class="table-light">
                            <tr>
                                <th class="col-tr">TR No</th>
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

            // Initialize DataTable for each slot
            const newTable = $(`#${tableId}`).DataTable({
                data: studentsInSlot,
                columns: [
                    { data: 'TR', className: 'col-tr fw-semibold' },
                    { data: 'Name', className: 'col-name fw-medium' },
                    { 
                        data: 'Darajah', 
                        className: 'col-darajah',
                        render: function (data) {
                            return `<span class="badge bg-light text-dark border">${data || '-'}</span>`;
                        }
                    },
                    {
                        data: 'Goal',
                        className: 'col-goal',
                        render: function (data, type, row) {
                            let goalText = data ? data : 'Not Set';
                            return `<div class="editable-cell-wrapper d-flex align-items-center justify-content-between gap-2">
                                        <span class="goal-text fw-medium text-dark text-truncate">${goalText}</span>
                                        <button class="btn btn-sm edit-goal-btn edit-ghost-btn" title="Edit Goal" data-tr="${row.TR}">✏️ Edit</button>
                                    </div>`;
                        }
                    },
                    {
                        data: 'SlotName',
                        className: 'col-slot',
                        render: function (data, type, row) {
                            let displayText = !row.SlotID
                                ? `<span class="badge bg-warning text-dark">No slot assigned</span>`
                                : `<span class="slot-text badge bg-light text-dark border">${data}</span>`;
                            return `<div class="editable-cell-wrapper d-flex align-items-center justify-content-between gap-2">
                                        ${displayText}
                                        <button class="btn btn-sm edit-slot-btn edit-ghost-btn" title="Change Slot" data-tr="${row.TR}">✏️ Edit</button>
                                    </div>`;
                        }
                    },
                    {
                        data: 'TR',
                        className: 'col-actions text-center',
                        orderable: false,
                        render: function (data) {
                            return `<button class="btn btn-sm btn-outline-danger deactivate-btn py-1 px-2" style="font-size: 0.78rem;" data-tr="${data}">🚫 Deactivate</button>`;
                        }
                    }
                ],
                responsive: true,
                destroy: true,
                pageLength: 5,
                lengthMenu: [[5, 10, 25, -1], [5, 10, 25, "All"]],
                drawCallback: function () {
                    makeTableResponsive(tableId);
                }
            });

            allDataTables.push(newTable);
        });
    }

    /**
     * --- RENDER COMPACT LIST VIEW (SINGLE UNIFIED TABLE) ---
     */
    function renderCompactListView() {
        const selectedSlotFilter = document.getElementById('slot-filter-select')?.value || '';
        
        let filteredStudents = [...allStudentsData];
        if (selectedSlotFilter) {
            filteredStudents = filteredStudents.filter(s => (s.SlotName || 'Unassigned') === selectedSlotFilter);
        }

        compactDataTable = $('#compact-students-table').DataTable({
            data: filteredStudents,
            columns: [
                { data: 'TR', className: 'col-tr fw-semibold' },
                { data: 'Name', className: 'col-name fw-medium' },
                { 
                    data: 'Darajah', 
                    className: 'col-darajah',
                    render: function (data) {
                        return `<span class="badge bg-light text-dark border">${data || '-'}</span>`;
                    }
                },
                {
                    data: 'Goal',
                    className: 'col-goal',
                    render: function (data, type, row) {
                        let goalText = data ? data : 'Not Set';
                        return `<div class="editable-cell-wrapper d-flex align-items-center justify-content-between gap-2">
                                    <span class="goal-text fw-medium text-dark text-truncate">${goalText}</span>
                                    <button class="btn btn-sm edit-goal-btn edit-ghost-btn" title="Edit Goal" data-tr="${row.TR}">✏️ Edit</button>
                                </div>`;
                    }
                },
                {
                    data: 'SlotName',
                    className: 'col-slot',
                    render: function (data, type, row) {
                        let displayText = !row.SlotID
                            ? `<span class="badge bg-warning text-dark">Unassigned</span>`
                            : `<span class="slot-text badge bg-success-subtle text-success border border-success-subtle fw-semibold">${data}</span>`;
                        return `<div class="editable-cell-wrapper d-flex align-items-center justify-content-between gap-2">
                                    ${displayText}
                                    <button class="btn btn-sm edit-slot-btn edit-ghost-btn" title="Change Slot" data-tr="${row.TR}">✏️ Edit</button>
                                </div>`;
                    }
                },
                {
                    data: 'TR',
                    className: 'col-actions text-center',
                    orderable: false,
                    render: function (data) {
                        return `<button class="btn btn-sm btn-outline-danger deactivate-btn py-1 px-2" style="font-size: 0.78rem;" data-tr="${data}">🚫 Deactivate</button>`;
                    }
                }
            ],
            responsive: true,
            destroy: true,
            pageLength: 10,
            lengthMenu: [[10, 25, 50, -1], [10, 25, 50, "All"]],
            drawCallback: function () {
                makeTableResponsive('compact-students-table');
            }
        });
    }

    /**
     * Applies search and slot filters to active data tables
     */
    function applySearchAndSlotFilters() {
        const searchTerm = document.getElementById('records-search-input')?.value || '';
        
        if (currentViewMode === 'compact' && compactDataTable) {
            compactDataTable.search(searchTerm).draw();
        } else if (currentViewMode === 'grouped') {
            allDataTables.forEach(table => {
                table.search(searchTerm).draw();
            });
        }
    }

    /**
     * --- EXPORT TO EXCEL FUNCTION ---
     * Enterprise Level Formatting:
     * - Single sheet containing all active students
     * - Auto-calculated column widths (no text truncation or ### errors)
     * - Title banner & metadata cell merges
     * - Professional row heights & index column (S.No)
     * - Summary stats block & timestamped footer
     */
    function exportToExcel() {
        if (!allStudentsData || allStudentsData.length === 0) {
            return Swal.fire('No Data', 'There is no student data to export.', 'info');
        }

        const wb = XLSX.utils.book_new();
        const todayStr = new Date().toLocaleDateString('en-GB', {
            day: '2-digit', month: 'short', year: 'numeric'
        });
        const timeStr = new Date().toLocaleTimeString('en-US', {
            hour: '2-digit', minute: '2-digit', hour12: true
        });

        // 1. Sort students cleanly by Slot / Batch and then TR No
        const sortedStudents = [...allStudentsData].sort((a, b) => {
            const slotA = a.SlotName || 'Unassigned';
            const slotB = b.SlotName || 'Unassigned';
            if (slotA !== slotB) return slotA.localeCompare(slotB);
            return (a.TR || 0) - (b.TR || 0);
        });

        // Calculate slot breakdown stats
        const slotCounts = {};
        sortedStudents.forEach(s => {
            const name = s.SlotName || 'Unassigned';
            slotCounts[name] = (slotCounts[name] || 0) + 1;
        });
        const totalBatches = Object.keys(slotCounts).filter(k => k !== 'Unassigned').length;

        // 2. Build Header & Data Array of Arrays (AOA)
        const aoa = [
            ['KHAIMA AL-RIYADA - GYM MEMBERSHIP DIRECTORY'], // Row 1 (Title)
            [`Branch: ${staffBranch}   |   Export Date: ${todayStr} (${timeStr})   |   Total Active Members: ${sortedStudents.length}`], // Row 2 (Metadata)
            [`Active Slots / Batches: ${totalBatches}   |   Unassigned Members: ${slotCounts['Unassigned'] || 0}`], // Row 3 (Summary)
            [], // Row 4 (Blank separator)
            ['S.No', 'TR No', 'Student Name', 'Darajah', 'Fitness Goal', 'Slot / Batch'] // Row 5 (Table Headers)
        ];

        // 3. Populate Data Rows
        sortedStudents.forEach((student, index) => {
            aoa.push([
                index + 1,
                student.TR || '-',
                student.Name || 'Unknown',
                student.Darajah || '-',
                student.Goal || 'Not Set',
                student.SlotName || 'Unassigned'
            ]);
        });

        // 4. Add Summary Footer Rows
        const dataEndRow = aoa.length;
        aoa.push([]); // Blank separator
        aoa.push(['--- End of Student Directory ---']);
        aoa.push([`Confidential - FitTracker System Export - Generated for Staff & Admin Use`]);

        // 5. Convert AOA to Worksheet
        const ws = XLSX.utils.aoa_to_sheet(aoa);

        // 6. Define Cell Merges for Banner & Footer
        ws['!merges'] = [
            { s: { r: 0, c: 0 }, e: { r: 0, c: 5 } }, // Title A1:F1
            { s: { r: 1, c: 0 }, e: { r: 1, c: 5 } }, // Metadata A2:F2
            { s: { r: 2, c: 0 }, e: { r: 2, c: 5 } }, // Summary A3:F3
            { s: { r: dataEndRow + 1, c: 0 }, e: { r: dataEndRow + 1, c: 5 } }, // End notice
            { s: { r: dataEndRow + 2, c: 0 }, e: { r: dataEndRow + 2, c: 5 } }  // Footer notice
        ];

        // 7. Calculate & Set Auto Column Widths (wch)
        const colWidths = [
            { wch: 8 },  // S.No
            { wch: 14 }, // TR No
            { wch: 32 }, // Student Name
            { wch: 16 }, // Darajah
            { wch: 22 }, // Fitness Goal
            { wch: 26 }  // Slot / Batch
        ];

        // Dynamically measure data content lengths
        sortedStudents.forEach(s => {
            if (s.Name && s.Name.length + 4 > colWidths[2].wch) {
                colWidths[2].wch = Math.min(s.Name.length + 4, 45);
            }
            if (s.Goal && s.Goal.length + 4 > colWidths[4].wch) {
                colWidths[4].wch = Math.min(s.Goal.length + 4, 35);
            }
            if (s.SlotName && s.SlotName.length + 4 > colWidths[5].wch) {
                colWidths[5].wch = Math.min(s.SlotName.length + 4, 35);
            }
        });

        ws['!cols'] = colWidths;

        // 8. Set Custom Row Heights (hpt)
        const rowHeights = [
            { hpt: 26 }, // Row 1 Title
            { hpt: 20 }, // Row 2 Subtitle
            { hpt: 18 }, // Row 3 Summary
            { hpt: 10 }, // Row 4 Blank
            { hpt: 24 }  // Row 5 Table Headers
        ];

        for (let r = 5; r < dataEndRow; r++) {
            rowHeights.push({ hpt: 20 });
        }
        ws['!rows'] = rowHeights;

        // 9. Append Sheet & Trigger Download
        const sheetName = 'Active Students';
        XLSX.utils.book_append_sheet(wb, ws, sheetName);
        
        const fileNameDate = todayStr.replace(/ /g, '_');
        XLSX.writeFile(wb, `FitTracker_Active_Students_${staffBranch}_${fileNameDate}.xlsx`);
    }

    /**
     * --- EXPORT TO PDF FUNCTION ---
     * Uses pdfMake for a controlled, repeatable layout per slot page.
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
                    widths: [58, '*', 52],
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

    // --- DELEGATED INTERACTION HANDLERS ---

    // Deactivate Student
    $('#student-record').on('click', '.deactivate-btn', function () {
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
            confirmButtonColor: 'var(--danger)',
            cancelButtonColor: '#6c757d',
            confirmButtonText: 'Yes, deactivate',
            inputValidator: (value) => {
                if (!String(value || '').trim()) {
                    return 'Reason is required for deactivation.';
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
                        throw new Error(data.error || data.message || 'Failed to update student status');
                    }
                } catch (err) {
                    Swal.fire('Error', err.message || 'A network error occurred.', 'error');
                    deactivateBtn.prop('disabled', false);
                    deactivateBtn.html(originalBtnText);
                }
            }
        });
    });

    // Edit Goal Inline
    $('#student-record').on('click', '.edit-goal-btn', async function () {
        const tr = $(this).data('tr');
        const goalCell = $(this).closest('td');
        if (goalCell.find('select').length > 0) return;

        const currentGoal = goalCell.find('.goal-text').text().trim();

        const select = $('<select class="form-select form-select-sm py-0 px-2" style="width: auto; max-width: 150px; font-size: 0.8rem; height: 28px; display: inline-block;"></select>');
        GOAL_OPTIONS.forEach(goal => {
            select.append(`<option value="${goal}" ${goal === currentGoal ? 'selected' : ''}>${goal}</option>`);
        });

        if (currentGoal === "Not Set" || !GOAL_OPTIONS.includes(currentGoal)) {
            select.prepend(`<option value="${currentGoal}" selected>${currentGoal}</option>`);
        }

        const saveBtn = $('<button class="btn btn-sm btn-success px-2 py-0" style="font-size: 0.75rem; height: 28px; line-height: 1;" title="Save">✓ Save</button>');
        const cancelBtn = $('<button class="btn btn-sm btn-outline-secondary px-2 py-0" style="font-size: 0.75rem; height: 28px; line-height: 1;" title="Cancel">✕</button>');

        const actionWrapper = $('<div class="d-inline-flex align-items-center gap-1 ms-1"></div>').append(select, saveBtn, cancelBtn);
        goalCell.empty().append(actionWrapper);

        saveBtn.on('click', async () => {
            const newGoal = select.val();
            saveBtn.prop('disabled', true);
            cancelBtn.prop('disabled', true);
            select.prop('disabled', true);
            saveBtn.html('<span class="spinner-border spinner-border-sm" style="width:12px; height:12px;"></span>');

            try {
                const res = await fetch('/api/change-student-goal', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ TR: parseInt(tr), Goal: newGoal })
                });
                const data = await res.json();
                if (!data.success) throw new Error(data.message);

                Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Goal updated successfully!', showConfirmButton: false, timer: 2000 });
                loadAndGroupStudentRecords();
            } catch (err) {
                Swal.fire('Error', 'Error updating goal: ' + err.message, 'error');
                loadAndGroupStudentRecords();
            }
        });

        cancelBtn.on('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            try {
                const tableObj = goalCell.closest('table').DataTable();
                tableObj.row(goalCell.closest('tr')).invalidate().draw(false);
            } catch (err) {
                renderActiveView();
            }
        });
    });

    // Edit Slot Inline
    $('#student-record').on('click', '.edit-slot-btn', async function () {
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

        const currentText = slotCell.find('.slot-text').text().trim();

        const select = $('<select class="form-select form-select-sm py-0 px-2" style="width: auto; max-width: 170px; font-size: 0.8rem; height: 28px; display: inline-block;"></select>').append(
            availableSlots.map(slot =>
                `<option value="${slot.SlotID}"
                    ${slot.SlotName === currentText ? 'selected' : ''}
                    ${slot.AvailableSeats <= 0 && slot.SlotName !== currentText ? 'disabled' : ''}>
                    ${slot.SlotName} (${slot.AvailableSeats || 0} left)
                </option>`
            ).join('')
        );

        if (slotCell.find('.badge.bg-warning').length > 0 || currentText === 'Unassigned') {
            select.prepend(`<option value="" selected>No slot assigned</option>`);
        }

        const saveBtn = $('<button class="btn btn-sm btn-success px-2 py-0" style="font-size: 0.75rem; height: 28px; line-height: 1;" title="Save">✓ Save</button>');
        const cancelBtn = $('<button class="btn btn-sm btn-outline-secondary px-2 py-0" style="font-size: 0.75rem; height: 28px; line-height: 1;" title="Cancel">✕</button>');

        const actionWrapper = $('<div class="d-inline-flex align-items-center gap-1 ms-1"></div>').append(select, saveBtn, cancelBtn);
        slotCell.empty().append(actionWrapper);

        saveBtn.on('click', async () => {
            const newSlotID = parseInt(select.val());
            if (isNaN(newSlotID) || !newSlotID) {
                return Swal.fire('Warning', 'Please select a valid slot.', 'warning');
            }

            saveBtn.prop('disabled', true);
            cancelBtn.prop('disabled', true);
            select.prop('disabled', true);
            saveBtn.html('<span class="spinner-border spinner-border-sm" style="width:12px; height:12px;"></span>');

            try {
                const res = await fetch('/api/change-student-slot', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ TR: parseInt(tr), SlotID: newSlotID })
                });
                const data = await res.json();
                if (!data.success) throw new Error(data.message);

                Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Slot updated successfully!', showConfirmButton: false, timer: 2000 });
                loadAndGroupStudentRecords();
            } catch (err) {
                Swal.fire('Error', 'Error updating slot: ' + err.message, 'error');
                loadAndGroupStudentRecords();
            }
        });

        cancelBtn.on('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            try {
                const tableObj = slotCell.closest('table').DataTable();
                tableObj.row(slotCell.closest('tr')).invalidate().draw(false);
            } catch (err) {
                renderActiveView();
            }
        });
    });

    // View Mode Toggle Listeners
    $('#view-mode-grouped').on('click', () => {
        if (currentViewMode !== 'grouped') {
            currentViewMode = 'grouped';
            localStorage.setItem('recordsViewMode', 'grouped');
            renderActiveView();
        }
    });

    $('#view-mode-compact').on('click', () => {
        if (currentViewMode !== 'compact') {
            currentViewMode = 'compact';
            localStorage.setItem('recordsViewMode', 'compact');
            renderActiveView();
        }
    });

    // Search and Slot Filter Listeners
    $('#records-search-input').on('keyup input', () => {
        applySearchAndSlotFilters();
    });

    $('#slot-filter-select').on('change', () => {
        renderActiveView();
    });

    $('#refresh-data-btn').on('click', () => {
        loadAndGroupStudentRecords();
    });

    // Export Button Listeners
    $('#excel-btn').on('click', () => {
        exportToExcel();
    });

    $('#print-btn').on('click', () => {
        exportToPDF();
    });

    // --- PAGE INITIALIZATION ---
    loadAndGroupStudentRecords();
});
