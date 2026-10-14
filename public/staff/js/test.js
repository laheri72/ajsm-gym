const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const formatNumber = (value, digits = 1) => value == null || !Number.isFinite(Number(value)) ? '-' : Number(value).toFixed(digits);
document.addEventListener('DOMContentLoaded', () => {
  const updateStat = (id, value) => { const el = document.getElementById(id); if (el) el.textContent = value; };
  const testRecordsTable = $('#test-records-table').DataTable({
    ajax: {
      url:'/api/all-test-records',
      dataSrc:json => {
        const data = json.data || [];
        const trainer = data.filter(row => row.SubmittedBy === 'Trainer').length;
        const student = data.filter(row => row.SubmittedBy === 'Student').length;
        const legacy = data.length - trainer - student;
        updateStat('stat-total-tests', data.length);
        updateStat('stat-trainer-submitted', trainer);
        updateStat('stat-student-submitted', student);
        updateStat('source-mix-caption', data.length ? trainer+' trainer / '+student+' student / '+legacy+' legacy tests' : 'No tests recorded yet');
        for (const [id,count] of [['source-trainer-bar',trainer],['source-student-bar',student],['source-legacy-bar',legacy]]) {
          document.getElementById(id).style.width = data.length ? (count/data.length*100)+'%' : '0%';
        }
        document.querySelector('.fitness-source-track').setAttribute('aria-label', trainer+' trainer, '+student+' student, and '+legacy+' legacy tests');
        return data;
      }
    },
    columns:[
      {data:'CreatedAt',render:(value,type) => type === 'display' ? new Date(value).toLocaleDateString('en-IN') : value},
      {data:'Name',render:(value,type,row) => type === 'display' ? '<strong>'+escapeHtml(value)+'</strong><br><small>TR '+escapeHtml(row.TR)+'</small>' : type === 'filter' ? value+' '+row.TR : value},
      {data:'SubmittedBy',render:value => escapeHtml(value === 'Trainer' ? 'Trainer' : value === 'Student' ? 'Student' : 'Legacy / unknown')},
      {data:'VO2Max',render:value => formatNumber(value)},
      {data:'BMI',render:value => formatNumber(value)},
      {data:'BodyFat',render:value => value == null ? '-' : formatNumber(value)+'%'},
      {data:'BMR',render:value => formatNumber(value,0)},
      {data:'Grade',render:value => escapeHtml(value || '-')},
      {data:'TR',orderable:false,searchable:false,render:value => '<a class="btn btn-sm btn-outline-primary" href="/fitness/profile.html?tr='+encodeURIComponent(value)+'">Open profile</a>'}
    ],
    order:[[0,'desc']],
    pageLength:15,
    responsive:true,
    language:{emptyTable:'No fitness test records have been submitted yet.'}
  });

    // Add click event listener to the export button
document.getElementById('exportTestRecordsBtn').addEventListener('click', () => {
        const data = testRecordsTable.rows({ search: 'applied' }).data().toArray();
        if (data.length === 0) {
            Swal.fire('No Data', 'There is no data to export.', 'info');
            return;
        }

        const worksheet = XLSX.utils.json_to_sheet(data.map(({ BMIStatus, ...record }) => record));
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

        // 4. Validate against database with Gender Auto-Detection & Section Inspection
    async function validateAndPreview(students) {
        Swal.fire({
            title: 'Validating Students...',
            text: 'Analyzing student sections and checking duplicates...',
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

        const { 
            newStudents = [], 
            skippedStudents = [], 
            invalidRows = [], 
            genderMismatchedRows = [],
            maleCount = 0,
            femaleCount = 0,
            hasMultiGender = false,
            userRole = 'Staff',
            sessionGender = 'Male'
        } = result;

        let summaryHtml = `<div style="text-align: left; margin-top: 0.5rem; font-size: 0.92rem;">`;

        // A. Multi-Gender Auto-Detection UI Badge
        if (hasMultiGender) {
            summaryHtml += `
                <div style="background: #f0f4ff; border-left: 4px solid #3b82f6; border-radius: 6px; padding: 12px; margin-bottom: 15px;">
                    <h6 style="font-weight: 700; color: #1e3a8a; margin: 0 0 6px 0; font-size: 0.95rem;">⚖️ Multi-Gender Batch Auto-Detected</h6>
                    <p style="margin-bottom: 10px; font-size: 0.82rem; color: #475569;">
                        ${userRole === 'Admin' 
                            ? 'As an Admin, students will be automatically routed to their respective sections:' 
                            : 'This file contains students for both Male and Female sections:'}
                    </p>
                    <div style="display: flex; justify-content: space-around; align-items: center; background: white; border-radius: 6px; padding: 10px; border: 1px solid #cbd5e1;">
                        <div style="text-align: center;">
                            <span style="font-size: 1.4rem; font-weight: 700; color: #2563eb;">${maleCount}</span>
                            <div style="font-size: 0.75rem; font-weight: 600; color: #64748b;">Male (Talabat)</div>
                        </div>
                        <div style="height: 30px; border-right: 1px solid #e2e8f0;"></div>
                        <div style="text-align: center;">
                            <span style="font-size: 1.4rem; font-weight: 700; color: #dc2626;">${femaleCount}</span>
                            <div style="font-size: 0.75rem; font-weight: 600; color: #64748b;">Female (Talebaat)</div>
                        </div>
                    </div>
                </div>`;
        } else if (newStudents.length > 0) {
            const sectionLabel = maleCount > 0 ? 'Male (Talabat)' : 'Female (Talebaat)';
            summaryHtml += `<p class="text-success" style="font-size: 0.95rem;"><strong>✅ New students to be ENROLLED: ${newStudents.length} (${sectionLabel})</strong></p>`;
        }

        // B. Staff Section Mismatch Protection
        const isStaffBlocked = (userRole === 'Staff' && genderMismatchedRows.length > 0);
        if (isStaffBlocked) {
            summaryHtml += `
                <div style="background: #fef2f2; border-left: 4px solid #ef4444; border-radius: 6px; padding: 10px; margin-bottom: 15px; color: #991b1b;">
                    <strong>⛔ Staff Section Restriction:</strong> You are logged in as <strong>${sessionGender} Staff</strong>. 
                    ${genderMismatchedRows.length} student(s) in this file belong to the opposite section (${sessionGender === 'Male' ? 'Female' : 'Male'}).
                    <br><small style="font-size: 0.8rem;">Opposite section rows will be excluded automatically from this import.</small>
                </div>`;
        }

        // C. Skipped Duplicates
        if (skippedStudents.length > 0) {
            summaryHtml += `
                <hr style="margin: 10px 0;">
                <p class="text-warning mb-1"><strong>⚠️ Skipping ${skippedStudents.length} duplicate(s) (TR or ITS already exists):</strong></p>
                <ul class="swal-list" style="max-height: 90px; overflow-y: auto; padding-left: 20px; font-size: 0.82rem;">
                    ${skippedStudents.slice(0, 5).map(s => `<li>ITS ${s.ITS}, TR ${s.TR} - <strong>${s.reason}</strong></li>`).join('')}
                    ${skippedStudents.length > 5 ? `<li class="text-muted">...and ${skippedStudents.length - 5} more</li>` : ''}
                </ul>`;
        }

        // D. Invalid Formatting Rows
        if (invalidRows.length > 0) {
            summaryHtml += `
                <hr style="margin: 10px 0;">
                <p class="text-danger mb-1"><strong>❌ Skipping ${invalidRows.length} invalid row(s):</strong></p>
                <ul class="swal-list" style="max-height: 90px; overflow-y: auto; padding-left: 20px; font-size: 0.82rem;">
                    ${invalidRows.slice(0, 5).map(row => `<li>Row ${row.fileRow}: <strong>${row.reason}</strong></li>`).join('')}
                    ${invalidRows.length > 5 ? `<li class="text-muted">...and ${invalidRows.length - 5} more</li>` : ''}
                </ul>`;
        }

        summaryHtml += `</div>`;

        // Calculate students that will actually be imported
        const validImportStudents = isStaffBlocked 
            ? newStudents.filter(s => s.Gender === sessionGender)
            : newStudents;

        Swal.fire({
            title: 'Import Preview & Section Check',
            html: summaryHtml,
            icon: isStaffBlocked ? 'warning' : 'info',
            showCancelButton: true,
            confirmButtonColor: '#4CAF50',
            cancelButtonColor: '#d33',
            confirmButtonText: validImportStudents.length > 0 
                ? `Yes, enroll ${validImportStudents.length} students!` 
                : 'No valid students to add',
            preConfirm: () => {
                if (validImportStudents.length === 0) {
                    Swal.showValidationMessage('There are no valid students to import for your section.');
                    return false;
                }
                return validImportStudents;
            }
        }).then((action) => {
            if (action.isConfirmed && action.value) {
                commitBulkAdd(action.value);
            }
        });
    }
    
    // 5. Commit to database with auto-detected section routing
    async function commitBulkAdd(newStudents) {
        Swal.fire({
            title: 'Enrolling Students...',
            text: 'Saving records to database...',
            didOpen: () => { Swal.showLoading() }
        });

        const res = await fetch('/api/fitness-test/bulk-commit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ students: newStudents }) 
        });
        const data = await res.json();

        if (res.ok) {
            let msg = `${data.count} new students enrolled successfully.`;
            if (data.maleCount > 0 && data.femaleCount > 0) {
                msg = `Enrolled ${data.count} students (${data.maleCount} Male, ${data.femaleCount} Female) into their respective sections!`;
            } else if (data.maleCount > 0) {
                msg = `Enrolled ${data.count} Male (Talabat) students successfully!`;
            } else if (data.femaleCount > 0) {
                msg = `Enrolled ${data.count} Female (Talebaat) students successfully!`;
            }
            Swal.fire('Import Successful!', msg, 'success').then(() => {
                location.reload();
            });
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

