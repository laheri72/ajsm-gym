document.addEventListener('DOMContentLoaded', () => {
  const trainingPlansTable = $('#training-plans-table').DataTable({
    ajax: {
      url: '/api/all-training-plans',
      credentials: 'include',
      dataSrc: 'data'
    },
    // ✅ UPDATED COLUMN DEFINITIONS
    columns: [
      { data: 'CreatedAt', render: d => new Date(d).toLocaleDateString() },
      { data: 'TR' },
      { data: 'Name' }, // Display the new Name field
      { 
        data: 'BodyParts',
        // Use a render function to create the styled pills
        render: function(data) {
          if (!data) return '';
          const partsArray = data.split(', ');
          return partsArray.map(part => 
              `<span class="body-part-pill">${part}</span>`
          ).join(' ');
        }
      }
    ],
    order: [[0, 'desc']],
    pageLength: 25,
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