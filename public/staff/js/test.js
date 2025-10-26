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

    const bulkImportBtn = document.getElementById('bulkImportBtn');
    const fileInput = document.getElementById('fileInput');

    // 1. Trigger hidden file input
bulkImportBtn.addEventListener('click', () => {
        fileInput.click();
    });

    // 2. Download template (Unchanged from last time)
document.getElementById('downloadTemplateBtn').addEventListener('click', () => {
        const headers = [ ["TR", "ITS", "Name", "Darajah"] ];
        const ws = XLSX.utils.aoa_to_sheet(headers);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Fitness_Student_Template");
        XLSX.writeFile(wb, "Fitness_Student_Template.xlsx");
    });

    // 3. Process selected file (Unchanged from last time)
fileInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
reader.onload = async (e) => {
            try {
                const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
                const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                const students = XLSX.utils.sheet_to_json(firstSheet);
                
                if (students.length === 0) {
                    Swal.fire('Empty File', 'The selected file has no student data.', 'warning');
                    return;
                }

                // Stricter client-side validation
                const validStudents = [];
                const invalidRows = [];
                const itsRegex = /^\d{8}$/; // Must be exactly 8 digits
                const trRegex = /^\d{5}$/;  // Must be exactly 5 digits

        students.forEach((student, index) => {
                    const fileRow = index + 2;
                    const { TR, ITS, Name, Darajah } = student;

                    if (!ITS || !itsRegex.test(ITS.toString())) {
                        invalidRows.push(`Row ${fileRow}: ITS must be exactly 8 digits.`);
                    } else if (!TR || !trRegex.test(TR.toString())) {
                        invalidRows.push(`Row ${fileRow}: TR must be exactly 5 digits.`);
                    } else if (!Name || Name.toString().trim() === "") {
                        invalidRows.push(`Row ${fileRow}: Name is missing.`);
                    } else if (!Darajah || Darajah.toString().trim() === "") {
                        invalidRows.push(`Row ${fileRow}: Darajah is missing.`);
                    } else {
                        validStudents.push(student);
                    }
                });

        if (invalidRows.length > 0) {
                    Swal.fire({
                        icon: 'error',
                        title: 'Invalid Data Format',
            html: `Please fix these errors in your file and re-upload:<br><br><div class="swal-list">${invalidRows.join('<br>')}</div>`,
                    });
            return;
                }

        await validateAndPreview(validStudents);
    } catch (err) {
                console.error('File parsing error:', err);
                Swal.fire('Error', 'Could not read or parse the file.', 'error');
    } finally {
        fileInput.value = '';
            }
        };
        reader.readAsArrayBuffer(file);
    });

    // 4. Validate against database (UPDATED for new API response)
async function validateAndPreview(students) {
        Swal.fire({
            title: 'Validating Students...',
            text: 'Checking for global duplicates...',
            didOpen: () => { Swal.showLoading() }
        });

        const res = await fetch('/api/fitness-test/bulk-validate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ students })
        });
const result = await res.json();

    if (!res.ok) {
            Swal.fire('Validation Error', result.message || 'An unknown error occurred.', 'error');
            return;
        }

        // *** UPDATED to handle 'skippedStudents' ***
    const { newStudents, skippedStudents, invalidRows } = result;
        
        let summaryHtml = `<div style="text-align: left; margin-top: 1rem;">`;
    if (newStudents.length > 0) {
            summaryHtml += `<p class="text-success"><strong>✅ New students to be ENROLLED: ${newStudents.length}</strong></p>`;
        }
    if (skippedStudents.length > 0) {
            summaryHtml += `
                <hr>
                <p class="text-warning"><strong>⚠️ Skipping ${skippedStudents.length} duplicate(s) (TR or ITS already exists):</strong></p>
                <ul class="swal-list">
                    ${skippedStudents.map(s => `<li>ITS ${s.ITS}, TR ${s.TR} - <strong>${s.reason}</strong></li>`).join('')}
                </ul>`;
        }
    if (invalidRows.length > 0) {
            summaryHtml += `
                <hr>
                <p class="text-danger"><strong>❌ Skipping ${invalidRows.length} invalid row(s):</strong></p>
                <ul class="swal-list">
                    ${invalidRows.map(row => `<li>Row ${row.fileRow}: <strong>${row.reason}</strong></li>`).join('')}
                </ul>`;
        }
        summaryHtml += `</div>`;

    Swal.fire({
            title: 'Import Summary',
            html: summaryHtml,
            icon: 'info',
            showCancelButton: true,
            confirmButtonColor: '#4CAF50',
            cancelButtonColor: '#d33',
            confirmButtonText: `Yes, add ${newStudents.length} new students!`,
        preConfirm: () => {
                if (newStudents.length === 0) {
                    Swal.showValidationMessage('There are no new students to import.');
                    return false;
                }
                return true;
            }
    }).then((action) => {
            if (action.isConfirmed) {
                commitBulkAdd(newStudents);
            }
        });
    }
    
    // 5. Commit to database (Unchanged, still just sends newStudents)
async function commitBulkAdd(newStudents) {
        const res = await fetch('/api/fitness-test/bulk-commit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ students: newStudents }) 
        });
const data = await res.json();

        if (res.ok) {
    Swal.fire('Success!', `${data.count} new students have been enrolled.`, 'success');
        } else {
    Swal.fire('Error!', 'Could not add students: ' + data.message, 'error');
        }
    }

// --- === NEW: Load All Students Card & Modal === ---
    async function loadStudentListCard() {
        const card = document.getElementById('student-list-card');
        const countEl = document.getElementById('stat-total-students');
        const tableBody = document.getElementById('all-students-table-body');
        let studentListModal = null; // To hold the modal instance
        let studentsDataCache = null; // Cache for the full list


        countEl.textContent = '...'; // Show loading state for count
        try {
            const countRes = await fetch('/api/fitness-test/students/count', { credentials: 'include' });
            const countData = await countRes.json();
            if (!countData.success) throw new Error(countData.message || 'Failed to fetch count');
            countEl.textContent = countData.count; // Update the stat card with the count
        } catch (err) {
            console.error('Error loading student list:', err);
            countEl.textContent = 'Error';
            // Optionally disable the card click if count fails
            card.style.cursor = 'not-allowed';
            card.title = 'Could not load student count';
        return; // Stop if count fails
        }
        // 4. Add click listener to the card to show the modal (fetches full list on demand)
    card.addEventListener('click', async () => {
        if (!studentListModal) { // Initialize modal only once
            studentListModal = new bootstrap.Modal(document.getElementById('studentListModal'));
        }

        // Show loading state in modal table
        tableBody.innerHTML = '<tr><td colspan="5" class="text-center">Loading student list...</td></tr>';
        studentListModal.show(); // Show modal immediately

        try {
            // Fetch the full list ONLY when the card is clicked
            // (Optionally check cache first if needed, but fetching on click is fine)
            const listRes = await fetch('/api/fitness-test/all-students', { credentials: 'include' });
            const listData = await listRes.json();

            if (!listData.success) throw new Error(listData.message);

            studentsDataCache = listData.students; // Cache the data

            // Populate the modal table (same logic as before)
            if (studentsDataCache.length > 0) {
                tableBody.innerHTML = '';
                studentsDataCache.forEach(student => {
                    const row = tableBody.insertRow();
                    row.innerHTML = `
                        <td>${student.TR}</td>
                        <td>${student.ITS}</td>
                        <td>${student.Name}</td>
                        <td>${student.Darajah}</td>
                        <td>${student.DOB || 'N/A'}</td>
                    `;
                });
            } else {
                tableBody.innerHTML = '<tr><td colspan="5" class="text-center">No students found.</td></tr>';
            }

        } catch (err) {
            console.error('Error loading full student list for modal:', err);
            tableBody.innerHTML = `<tr><td colspan="5" class="text-center text-danger">Error loading list.</td></tr>`;
            // Optionally show a Swal error as well
            Swal.fire('Error', 'Could not load the full student list.', 'error');
        }
    });
    
    }

    // Call the new function on page load
    loadStudentListCard();

    // --- === NEW: Admin Warning Logic === ---
    function populateAdminWarning() {
        // Find the spans inside the alert
        const genderSpan = document.getElementById('admin-gender-warning');
        const branchSpan = document.getElementById('admin-branch-warning');
        
        // This check ensures we're on the right page
        if (genderSpan && branchSpan) {
            try {
                const userString = localStorage.getItem('staffUser');
                if (userString) {
                    const user = JSON.parse(userString);
                    // Only populate text if the user is an Admin
                    // The CSS already handles visibility
                    if (user.Role === 'Admin') {
                        genderSpan.textContent = user.Gender || '[Unknown Gender]';
                        branchSpan.textContent = user.Branch || '[Unknown Branch]';
                    }
                }
            } catch (e) {
                console.error('Failed to populate admin warning:', e);
                genderSpan.textContent = '[Error]';
                branchSpan.textContent = '[Error]';
            }
        }
    }

    // Call the new function on page load
    populateAdminWarning();

}); 

