// js/evaluation-log.js

document.addEventListener('DOMContentLoaded', () => {
    // Initialize both tables
    // We pass the gender to a reusable function
    initializeLogTable('Male');
    initializeLogTable('Female');
});

/**
 * Creates a filterable DataTable for the specified gender.
 * @param {string} gender - 'Male' or 'Female'
 */
async function initializeLogTable(gender) {
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