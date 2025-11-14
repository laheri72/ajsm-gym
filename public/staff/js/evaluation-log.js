// js/evaluation-log.js

document.addEventListener('DOMContentLoaded', () => {
    // Initialize both tables
    initializeLogTable('Male');
    initializeLogTable('Female');

    // Load the new batch overview
    loadAdminBatchOverview();
});


/**
 * Fetches batch overview data for the admin and sorts it into
 * the Male and Female card containers.
 */
async function loadAdminBatchOverview() {
    try {
        const res = await fetch('/api/admin/evaluation-batches-overview', { credentials: 'include' });
        if (!res.ok) {
            const errData = await res.json();
            throw new Error(errData.message || 'Failed to load batch overview.');
        }
        
        const { data } = await res.json();
        
        // Filter the data by gender
        const maleBatches = data.filter(b => b.Gender === 'Male');
        const femaleBatches = data.filter(b => b.Gender === 'Female');

        // ★★★ CALL THE NEW, SMARTER RENDER FUNCTION ★★★
        renderBatchCards(maleBatches, 'male');
        renderBatchCards(femaleBatches, 'female');

    } catch (err) {
        console.error(err);
        document.getElementById('male-batch-cards-container').innerHTML = `<p class="text-danger">${err.message}</p>`;
        document.getElementById('female-batch-cards-container').innerHTML = `<p class="text-danger">${err.message}</p>`;
    }
}

/**
 * ★★★ REBUILT FUNCTION ★★★
 * Renders batch cards, splitting them into "Recent" and "Older" groups.
 * @param {Array} batches - The array of batch data (pre-sorted by API).
 * @param {string} prefix - The gender prefix ('male' or 'female').
 */
function renderBatchCards(batches, prefix) {
    const recentContainer = document.getElementById(`${prefix}-batch-cards-container`);
    const olderContainer = document.getElementById(`${prefix}-older-batch-cards-container`);
    const accordionWrapper = document.getElementById(`${prefix}-older-batches-accordion`);
    const olderCountSpan = document.getElementById(`${prefix}-older-batch-count`);

    if (!recentContainer || !olderContainer || !accordionWrapper || !olderCountSpan) {
        console.error(`Could not find all containers for prefix: ${prefix}`);
        return;
    }

    // Clear loaders
    recentContainer.innerHTML = '';
    olderContainer.innerHTML = '';

    // Handle empty state
    if (batches.length === 0) {
        recentContainer.innerHTML = '<p>No test records found to evaluate for this section.</p>';
        accordionWrapper.style.display = 'none'; // Hide accordion
        return;
    }

    // 1. Split the batches (API already sorted them)
    const recentBatches = batches.slice(0, 2);
    const olderBatches = batches.slice(2);

    // 2. Render the recent batches
    recentBatches.forEach(batch => {
        recentContainer.appendChild(createBatchCardElement(batch));
    });

    // 3. Handle the older batches
    if (olderBatches.length > 0) {
        // Show the accordion
        accordionWrapper.style.display = 'block';
        olderCountSpan.textContent = olderBatches.length;

        // Render the older batches into the accordion's grid
        olderBatches.forEach(batch => {
            olderContainer.appendChild(createBatchCardElement(batch));
        });
    } else {
        // No older batches, so hide the accordion
        accordionWrapper.style.display = 'none';
    }
}

/**
 * ★★★ NEW HELPER FUNCTION ★★★
 * Creates a single batch card DOM element.
 * @param {object} batch - The batch data object.
 * @returns {HTMLElement} A DOM element representing the card.
 */
function createBatchCardElement(batch) {
    const card = document.createElement('div');
    // Add "non-clickable" class to disable hover effects
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


/**
 * Creates a filterable DataTable for the specified gender.
 * @param {string} gender - 'Male' or 'Female'
 */
async function initializeLogTable(gender) {
    // ... (rest of your existing function, no changes needed here) ...
    const tableId = (gender === 'Male') ? '#maleLogTable' : '#femaleLogTable';
    
    // Show a loader
    const table = $(tableId).DataTable({
        "language": {
            // Using "processing" to show a "Loading..." message
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
        // 1. Fetch the data from our new API
        const res = await fetch(`/api/admin/evaluation-logs?gender=${gender}`, { credentials: 'include' });
        if (!res.ok) {
            const errData = await res.json();
            throw new Error(errData.message || 'Failed to load data.');
        }
        
        const { data } = await res.json();

        // 2. Destroy the loader-table and re-create it with data
        table.destroy();

        const dataTable = $(tableId).DataTable({
            data: data,
            columns: [
                // 'data' property must match the keys from our SQL query
                { data: 'EvaluatorName' },
                { data: 'CategoryName' },
                { data: 'TR' },
                { data: 'StudentName' },
                { data: 'BatchName' },
                { data: 'Remark' }
            ],
            responsive: true,
            pageLength: 25, // Show 25 entries per page
            lengthMenu: [10, 25, 50, 100], // Page length options
            dom: 'lBfrtip', // Adds Length, Buttons, Filter, info, pagination
            buttons: [
                'copy', 'csv', 'excel', 'pdf', 'print' // Adds export buttons
            ],
            // This 'initComplete' function adds the dropdown filters
            initComplete: function () {
                // Select columns 0 (Evaluator), 1 (Category), and 4 (Batch)
                this.api().columns([0, 1, 4]).every(function () {
                    var column = this;
                    var filterRowId = (gender === 'Male') ? '#male-filters' : '#female-filters';
                    var title = $(column.header()).text();
                    
                    // Create a wrapper div for Bootstrap grid
                    var wrapper = $('<div class="col-md-4 col-sm-6 col-12 form-select-wrapper"></div>')
                        .appendTo( $(filterRowId) );
                    
                    // Create the Select input
                    var select = $('<select class="form-select"><option value="">Filter by ' + title + '</option></select>')
                        .appendTo( wrapper ) // Append to the wrapper, not the row
                        .on('change', function () {
                            var val = $.fn.dataTable.util.escapeRegex(
                                $(this).val()
                            );
                            // Apply the filter
                            column
                                .search(val ? '^' + val + '$' : '', true, false)
                                .draw();
                        });

                    // Add options to the select list
                    column.data().unique().sort().each(function (d, j) {
                        select.append('<option value="' + d + '">' + d + '</option>')
                    });
                });
            }
        });

    } catch (err) {
        console.error(err);
        table.clear().draw();
        table.processing(false); // Hide the loader
        $(tableId).find('tbody').html(`
            <tr>
                <td colspan="6" class="text-danger text-center">
                    <strong>Error:</strong> ${err.message}
                </td>
            </tr>
        `);
    }
}