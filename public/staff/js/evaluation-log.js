// js/evaluation-log.js
// =======================================================
// ROLE + SESSION DETECTION
// =======================================================
const user = JSON.parse(localStorage.getItem("staffUser") || "{}");
const role = user.Role;
const myGender = user.Gender;
const isAdmin = (role === "Admin");

// Base endpoint switching
const endpointBase = isAdmin ? "/api/admin" : "/api/staff";

// =======================================================
// UI RESTRICTIONS FOR STAFF (NO HTML CHANGES REQUIRED)
// =======================================================
// =======================================================
// STAFF TAB AUTO-ACTIVATION FIX (Bootstrap-compatible)
// =======================================================

// =======================================================
// PAGE INIT
// =======================================================
document.addEventListener('DOMContentLoaded', () => {
    // Load BOTH tables (only one visible in staff mode)
if (isAdmin) {
    initializeLogTable('Male');
    initializeLogTable('Female');
} else {
    initializeLogTable(myGender);
}


    // Load batch overviews
    loadAdminBatchOverview();


    if (!isAdmin) {
    const onlyTab = myGender === "Male" ? "male" : "female";

    // button element (Bootstrap)
    const tabBtn = document.getElementById(`${onlyTab}-tab`);
    // tab content pane
    const tabPane = document.getElementById(`${onlyTab}-log`);

    if (tabBtn && tabPane) {

        // ADD Bootstrap classes
        tabBtn.classList.add("active");

        tabPane.classList.add("active", "show");
        tabPane.style.display = "block";

        // Remove active from other tab
        const otherTab = onlyTab === "male" ? "female" : "male";
        document.getElementById(`${otherTab}-tab`)?.classList.remove("active");
        const otherPane = document.getElementById(`${otherTab}-log`);
        if (otherPane) {
            otherPane.classList.remove("active", "show");
            otherPane.style.display = "none";
        }
    }
}

});


// =======================================================
// BATCH OVERVIEW (Admin + Staff Mode)
// =======================================================
async function loadAdminBatchOverview() {
    try {
        const res = await fetch(`${endpointBase}/evaluation-batches-overview`, { credentials: 'include' });
        if (!res.ok) {
            const errData = await res.json();
            throw new Error(errData.message || 'Failed to load batch overview.');
        }

        const { data } = await res.json();

        // ADMIN returns both genders.
        // STAFF endpoint returns ONLY their gender.
        const maleBatches = data.filter(b => b.Gender === 'Male');
        const femaleBatches = data.filter(b => b.Gender === 'Female');

        renderBatchCards(maleBatches, 'male');
        renderBatchCards(femaleBatches, 'female');

    } catch (err) {
        console.error(err);
        document.getElementById('male-batch-cards-container').innerHTML = `<p class="text-danger">${err.message}</p>`;
        document.getElementById('female-batch-cards-container').innerHTML = `<p class="text-danger">${err.message}</p>`;
    }
}


// =======================================================
// RENDER BATCH CARDS
// =======================================================
function renderBatchCards(batches, prefix) {
    const recentContainer = document.getElementById(`${prefix}-batch-cards-container`);
    const olderContainer = document.getElementById(`${prefix}-older-batch-cards-container`);
    const accordionWrapper = document.getElementById(`${prefix}-older-batches-accordion`);
    const olderCountSpan = document.getElementById(`${prefix}-older-batch-count`);

    if (!recentContainer || !olderContainer || !accordionWrapper || !olderCountSpan) {
        return;
    }

    recentContainer.innerHTML = '';
    olderContainer.innerHTML = '';

    if (batches.length === 0) {
        recentContainer.innerHTML = '<p>No test records found to evaluate for this section.</p>';
        accordionWrapper.style.display = 'none';
        return;
    }

    // API already ordered them newest → oldest
    const recentBatches = batches.slice(0, 2);
    const olderBatches = batches.slice(2);

    recentBatches.forEach(batch => {
        recentContainer.appendChild(createBatchCardElement(batch));
    });

    if (olderBatches.length > 0) {
        accordionWrapper.style.display = 'block';
        olderCountSpan.textContent = olderBatches.length;

        olderBatches.forEach(batch => {
            olderContainer.appendChild(createBatchCardElement(batch));
        });
    } else {
        accordionWrapper.style.display = 'none';
    }
}


// =======================================================
// CARD CREATOR
// =======================================================
function createBatchCardElement(batch) {
    const card = document.createElement('div');
    card.className = 'batch-card non-clickable';

    let statusText = '';
    if (batch.BatchID === null) {
        statusText = 'Unassigned';
    } else if (batch.IsActive) {
        statusText = '<span class="status-badge status-active">Active</span>';
    } else {
        statusText = '<span class="status-badge status-inactive">Locked</span>';
    }

    card.innerHTML = `
        <div class="batch-card-number">${batch.BatchName}</div>
        <div class="batch-card-count">${batch.TotalCount}</div>
        <div class="batch-card-label">Total Records</div>
        <div class="batch-card-status">${statusText}</div>
        <div class="batch-card-stats">
            <span class="stat-pending">Pending: ${batch.PendingCount}</span>
            <span class="stat-partial">In Progress: ${batch.PartialCount}</span>
        </div>
    `;

    return card;
}


// =======================================================
// DATATABLE — Evaluation Logs Table
// =======================================================
async function initializeLogTable(gender) {
    const tableId = (gender === 'Male') ? '#maleLogTable' : '#femaleLogTable';

    // Loader table
    const table = $(tableId).DataTable({
        "language": {
            "processing": `
                <div class="loader-cell">
                    <div class="loader"></div>
                    <div>Loading ${gender} Logs...</div>
                </div>
            `
        },
        "processing": true
    });

    try {
        // ------- SECURE GENDER FOR STAFF -------
        if (!isAdmin && gender !== myGender) {
            return; // Staff will not load opposite gender
        }

        const res = await fetch(`${endpointBase}/evaluation-logs?gender=${gender}`, { credentials: 'include' });

        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.message || 'Failed to load logs.');
        }

        const { data } = await res.json();

        table.destroy();

        $(tableId).DataTable({
            data: data,
            columns: [
                { data: 'EvaluatorName' },
                { data: 'CategoryName' },
                { data: 'TR' },
                { data: 'StudentName' },
                { data: 'BatchName' },
                { data: 'Remark' }
            ],
            responsive: true,
            pageLength: 25,
            lengthMenu: [10, 25, 50, 100],
            dom: 'lBfrtip',
            buttons: ['copy', 'csv', 'excel', 'pdf', 'print'],

            initComplete: function () {
                const filterRowId = (gender === 'Male') ? '#male-filters' : '#female-filters';

                this.api().columns([0, 1, 4]).every(function () {
                    var column = this;
                    var title = $(column.header()).text();

                    var wrapper = $('<div class="col-md-4 col-sm-6 col-12 form-select-wrapper"></div>')
                        .appendTo($(filterRowId));

                    var select = $(`<select class="form-select"><option value="">Filter by ${title}</option></select>`)
                        .appendTo(wrapper)
                        .on('change', function () {
                            var val = $.fn.dataTable.util.escapeRegex($(this).val());
                            column.search(val ? '^' + val + '$' : '', true, false).draw();
                        });

                    column.data().unique().sort().each(function (d) {
                        select.append(`<option value="${d}">${d}</option>`);
                    });
                });
            }
        });

    } catch (err) {
        console.error(err);
        table.clear().draw();
        table.processing(false);

        $(tableId).find('tbody').html(`
            <tr>
                <td colspan="6" class="text-danger text-center">
                    <strong>Error:</strong> ${err.message}
                </td>
            </tr>
        `);
    }
}
