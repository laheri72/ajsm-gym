document.addEventListener('DOMContentLoaded', () => {
    // Helper function to format numbers or show 'N/A' if null/undefined
    const formatNumber = (num, decimals) => (num != null ? num.toFixed(decimals) : 'N/A');

    // Initialize the DataTable for the fitness test records
    const testRecordsTable = $('#test-records-table').DataTable({
        ajax: {
            url: '/api/all-test-records',
            credentials: 'include', // Send session cookies
            dataSrc: 'data' // Data is in the 'data' property of the response
        },
        columns: [
            { data: 'CreatedAt', render: d => new Date(d).toLocaleDateString() },
            { data: 'TR' },
            { data: 'Name' },
            { data: 'Age', render: d => formatNumber(d, 2) },
            { data: 'Weight', render: d => formatNumber(d, 2) },
            { data: 'Height', render: d => formatNumber(d, 1) },
            { data: 'Waist', render: d => formatNumber(d, 1) },
            { data: 'Hips', render: d => formatNumber(d, 1) },
            { data: 'Neck', render: d => formatNumber(d, 1) },
            { data: 'BMI', render: d => formatNumber(d, 2) },
            { data: 'BMIStatus' },
            { data: 'BodyFat', render: d => formatNumber(d, 2) },
            { data: 'BMR', render: d => formatNumber(d, 1) },
            { data: 'CalorieIntake', render: d => formatNumber(d, 1) },
            { data: 'VO2Max', render: d => formatNumber(d, 1) },
            { data: 'Total', render: d => formatNumber(d, 1) },
            { data: 'Grade' },
            { data: 'SubmittedBy' }
        ],
        order: [[0, 'desc']], // Show newest records first
        pageLength: 25,
        responsive: true,
        language: {
            emptyTable: "No fitness test records have been submitted yet."
        }
    });

    // Add click event listener to the export button
    document.getElementById('exportTestRecordsBtn').addEventListener('click', () => {
        const data = testRecordsTable.rows({ search: 'applied' }).data().toArray();
        if (data.length === 0) {
            Swal.fire('No Data', 'There is no data to export.', 'info');
            return;
        }

        const worksheet = XLSX.utils.json_to_sheet(data);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "TestRecords");
        XLSX.writeFile(workbook, "Fitness_Test_Records.xlsx");
    });
});