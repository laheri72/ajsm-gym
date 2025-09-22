document.addEventListener('DOMContentLoaded', () => {
    // Initialize the DataTable for the training plans table
    const trainingPlansTable = $('#training-plans-table').DataTable({
        // Use DataTables' AJAX feature to fetch data directly from the API
        ajax: {
            url: '/api/all-training-plans',
            credentials: 'include', // Important for sending session cookies
            dataSrc: 'data' // The API response has the data array in a 'data' property
        },
        columns: [
            // Format the 'CreatedAt' date for better readability
            { data: 'CreatedAt', render: d => new Date(d).toLocaleDateString() },
            { data: 'TR' },
            { data: 'BodyParts' }
        ],
        // Default sort order (newest first)
        order: [[0, 'desc']],
        pageLength: 25, // Show 25 entries per page
        responsive: true,
        language: {
            emptyTable: "No training plans have been logged yet."
        }
    });

    // Add a click event listener to the export button
    document.getElementById('exportTrainingPlansBtn').addEventListener('click', () => {
        // Get all data from the table (respecting any filters the user has applied)
        const data = trainingPlansTable.rows({ search: 'applied' }).data().toArray();
        
        if (data.length === 0) {
            Swal.fire('No Data', 'There is no data to export.', 'info');
            return;
        }

        // Use the XLSX library to create and download the Excel file
        const worksheet = XLSX.utils.json_to_sheet(data);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'TrainingPlans');
        XLSX.writeFile(workbook, 'Training_Plans.xlsx');
    });
});