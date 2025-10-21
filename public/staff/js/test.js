// === NEW CHART HELPERS ===
// We define these outside the DOMContentLoaded to keep them clean
let bmiChart = null;
let gradeChart = null;
const primaryColor = getComputedStyle(document.documentElement).getPropertyValue('--primary').trim() || '#4CAF50';
const dangerColor = getComputedStyle(document.documentElement).getPropertyValue('--danger').trim() || '#f44336';

// Function to draw the BMI Pie Chart
function drawBmiChart(counts) {
    const ctx = document.getElementById('bmiStatusChart');
    if (!ctx) return;

    if (bmiChart) {
        bmiChart.destroy(); // Destroy old chart instance
    }
    
    const labels = Object.keys(counts);
    const data = Object.values(counts);

    bmiChart = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: labels,
            datasets: [{
                label: 'BMI Status',
                data: data,
                backgroundColor: [
                    '#3498db', // Underweight (Blue)
                    primaryColor, // Normal (Green)
                    '#f39c12', // Overweight (Orange)
                    dangerColor  // Obese (Red)
                ],
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                }
            }
        }
    });
}

// Function to draw the Grade Bar Chart
function drawGradeChart(counts) {
    const ctx = document.getElementById('gradeChart');
    if (!ctx) return;

    if (gradeChart) {
        gradeChart.destroy(); // Destroy old chart instance
    }

    // Sort grades logically (A, B, C, D, F)
    const sortedGrades = Object.entries(counts).sort((a, b) => {
        if (a[0] < b[0]) return -1;
        if (a[0] > b[0]) return 1;
        return 0;
    });

    const labels = sortedGrades.map(entry => entry[0]);
    const data = sortedGrades.map(entry => entry[1]);

    gradeChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Number of Students',
                data: data,
                backgroundColor: primaryColor,
                borderColor: primaryColor,
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1 // Show only whole numbers for student counts
                    }
                }
            },
            plugins: {
                legend: {
                    display: false // Not needed for a single-dataset bar chart
                }
            }
        }
    });
}


document.addEventListener('DOMContentLoaded', () => {
    // Helper function to format numbers or show 'N/A' if null/undefined
const formatNumber = (num, decimals) => (num != null ? num.toFixed(decimals) : 'N/A');

    // Helper function to update stat card text
    const updateStat = (id, value) => {
        const el = document.getElementById(id);
        if (el) {
            el.textContent = value;
        }
    };

    // Initialize the DataTable for the fitness test records
    const testRecordsTable = $('#test-records-table').DataTable({
        ajax: {
            url: '/api/all-test-records',
            credentials: 'include', // Send session cookies
            /**
             * ENHANCED dataSrc callback
             * Now calculates stats AND chart data
             */
            dataSrc: (json) => {
                const data = json.data || [];

                // 1. Initialize counters
                let totalTests = 0;
                let trainerSubmitted = 0;
                let studentSubmitted = 0;
                let totalBmi = 0;
                let bmiCount = 0;
                let totalBodyFat = 0;
                let bodyFatCount = 0;
                const gradeCounts = {};
                const bmiStatusCounts = {}; // NEW: For BMI Chart

                // 2. Loop through all records to calculate stats
                data.forEach(record => {
                    totalTests++;

                    // Count submissions by type
                    if (record.SubmittedBy === 'Trainer') {
                        trainerSubmitted++;
                    } else if (record.SubmittedBy === 'Student') {
                        studentSubmitted++;
                    }

                    // Sum BMI and BodyFat (only if they are valid numbers)
                    if (record.BMI != null) {
                        totalBmi += record.BMI;
                        bmiCount++;
                    }
                    if (record.BodyFat != null) {
                        totalBodyFat += record.BodyFat;
                        bodyFatCount++;
                    }

                    // Count grades (NEW: handle null/empty grades)
                    const grade = record.Grade || 'N/A';
                    gradeCounts[grade] = (gradeCounts[grade] || 0) + 1;
                    
                    // Count BMI Status (NEW: handle null/empty status)
                    const status = record.BMIStatus || 'N/A';
                    bmiStatusCounts[status] = (bmiStatusCounts[status] || 0) + 1;
                });

                // 3. Calculate averages and find most common grade
                const avgBmi = bmiCount > 0 ? (totalBmi / bmiCount).toFixed(1) : 'N/A';
                const avgBodyFat = bodyFatCount > 0 ? (totalBodyFat / bodyFatCount).toFixed(1) : 'N/A';

                let mostCommonGrade = 'N/A';
                let maxGradeCount = 0;
                for (const [grade, count] of Object.entries(gradeCounts)) {
                    if (grade !== 'N/A' && count > maxGradeCount) {
                        mostCommonGrade = grade;
                        maxGradeCount = count;
                    }
                }

                // 4. Update the stat cards in the HTML
                updateStat('stat-total-tests', totalTests);
                updateStat('stat-trainer-submitted', trainerSubmitted);
                updateStat('stat-student-submitted', studentSubmitted);
                updateStat('stat-avg-bmi', avgBmi);
                updateStat('stat-avg-body-fat', avgBodyFat !== 'N/A' ? `${avgBodyFat}%` : 'N/A');
                updateStat('stat-common-grade', mostCommonGrade);

                // 5. NEW: Draw the charts
                drawBmiChart(bmiStatusCounts);
                drawGradeChart(gradeCounts);

                // 6. IMPORTANT: Return the original data for the table
                return data;
            }
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
            { data: 'BMIStatus' }, // Column index 10
            { data: 'BodyFat', render: d => formatNumber(d, 2) },
            { data: 'BMR', render: d => formatNumber(d, 1) },
            { data: 'CalorieIntake', render: d => formatNumber(d, 1) },
            { data: 'VO2Max', render: d => formatNumber(d, 1) },
            { data: 'Total', render: d => formatNumber(d, 1) },
            { data: 'Grade' }, // Column index 16
            { data: 'SubmittedBy' }
        ],
        order: [[0, 'desc']], // Show newest records first
        pageLength: 25,
        responsive: true,
        language: {
            emptyTable: "No fitness test records have been submitted yet."
        },
        
        /**
         * NEW: initComplete (for Column Filters)
         * This runs once after the table is initialized.
         */
        initComplete: function () {
            const api = this.api();

            // Target specific columns for filtering (10: BMIStatus, 16: Grade)
            api.columns([10, 16]).every(function () {
                const col = this;
                const colIdx = col.index();
                
                // Find the <th> in the filter row
                const cell = $(`#filter-row th`).eq(colIdx);
                
                // Create the select element
                const select = $('<select class="form-select"><option value="">All</option></select>')
                    .appendTo(cell)
                    .on('change', function () {
                        // On change, filter the table
                        const val = $.fn.dataTable.util.escapeRegex($(this).val());
                        col.search(val ? '^' + val + '$' : '', true, false).draw();
                    });

                // Add an option for each unique value in the column
                col.data().unique().sort().each(function (d, j) {
                    if(d) { // Only add if data is not null/empty
                        select.append('<option value="' + d + '">' + d + '</option>');
                    }
                });
            });
        },

        /**
         * NEW: createdRow (for Row Highlighting)
         * This runs for every row that is drawn.
         */
        createdRow: function (row, data, dataIndex) {
            // Highlight based on BMI Status
            if (data.BMIStatus === 'Obese' || data.BMIStatus === 'Underweight') {
                $(row).addClass('bmi-danger');
            }

            // Highlight based on Grade
            if (data.Grade === 'A') {
                $(row).addClass('grade-success');
            } else if (data.Grade === 'F') {
                $(row).addClass('grade-fail');
            }
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