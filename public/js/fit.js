
        // All original functions remain intact
        let studentData = null;
        let calculated = null;
        let historyDataTable = null;
        let historyData = [];

async function validateStudentSession() {
    try {
        const res = await fetch('/api/current-tr', {
            method: 'GET',
            credentials: 'include'
        });

        const data = await res.json();

        if (!data.tr) {
            window.location.href = '../Forbidden.html';
            return;
        }

        const tr = data.tr;
        localStorage.setItem('currentTR', tr);

        // Reset all UI with null checks
        clearFitnessResults();

        const saveWarning = document.getElementById("saveWarning");
        const saveBtn = document.getElementById("saveBtn");
        const studentInfo = document.getElementById("studentInfo");
        const testForm = document.getElementById("testForm");
        const reportSection = document.getElementById("reportSection");
        const dobDisplay = document.getElementById('studentDOBDisplay');
        const dobInputGroup = document.getElementById('dobInputGroup');
        const dobHelp = document.getElementById('dobHelp');
        const ageDisplay = document.getElementById('studentAge');

        if (saveWarning) {
            saveWarning.textContent = 'ℹ️ Please submit accurate details. One record allowed per week.';
            saveWarning.style.color = 'blue';
        }
        if (saveBtn) {
            saveBtn.style.display = 'inline-block';
            saveBtn.disabled = false;
        }
        if (studentInfo) studentInfo.classList.add("hidden");
        if (testForm) testForm.classList.add("hidden");
        if (reportSection) reportSection.classList.add("hidden");
        if (dobDisplay) dobDisplay.textContent = 'Loading...';
        if (dobInputGroup) dobInputGroup.style.display = 'none';
        if (dobHelp) dobHelp.style.display = 'none';
        if (ageDisplay) ageDisplay.textContent = 'Loading...';


        const reportTableBody = document.getElementById("reportTableBody");
        if (testForm) testForm.reset();
        if (reportTableBody) reportTableBody.innerHTML = "";

        // Fetch student info from TestMaster
        try {
            const res = await fetch(`/api/testmaster/me`, {
                method: 'GET',
                credentials: 'include'
            });
            const student = await res.json();

            if (!student || !student.Name) throw new Error("Student not found in TestMaster");

            studentData = student;

            // Populate static fields
            document.getElementById("studentName").innerText = student.Name || 'N/A';
            document.getElementById("studentITS").innerText = student.ITS || 'N/A';
            document.getElementById("studentDarajah").innerText = student.Darajah || 'N/A';

            // --- Handle DOB and Age ---
            if (student.DOB) {
                const birthDate = new Date(student.DOB);
                const today = new Date();
                let age = today.getFullYear() - birthDate.getFullYear();
                const m = today.getMonth() - birthDate.getMonth();
                if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
                    age--;
                }
                studentData.calculatedAge = age; // Store calculated age
                
                if (ageDisplay) ageDisplay.innerText = age;
                // ★★★ PRE-FILL GENDER ★★★
                const genderSelect = document.querySelector('#testForm [name="Gender"]');
                if (genderSelect && student.Gender) {
                    genderSelect.value = student.Gender.toLowerCase();
                }
                // ★★★ END PRE-FILL ★★★
                if (dobDisplay) dobDisplay.innerText = birthDate.toLocaleDateString(); // Show formatted DOB
                if (dobInputGroup) dobInputGroup.style.display = 'none'; // Hide input
                if (dobHelp) dobHelp.style.display = 'none';

            } else {
                studentData.calculatedAge = 18; // Use default age
                if (ageDisplay) ageDisplay.innerText = 'N/A (Enter DOB)';
                if (dobDisplay) dobDisplay.innerText = ''; // Clear display span
                if (dobInputGroup) dobInputGroup.style.display = 'flex'; // Show input group
                if (dobHelp) dobHelp.style.display = 'block'; // Show help text
            }

            if (studentInfo) studentInfo.classList.remove("hidden");
            if (testForm) testForm.classList.remove("hidden");
            const historyCard = document.getElementById("historycard");
            if (historyCard) historyCard.style.display = "block";

            // Apply house theme
            if (studentInfo && student.House) {
                const house = student.House.toLowerCase();
                studentInfo.classList.remove("red-theme", "blue-theme", "green-theme", "yellow-theme");
                if (["red", "blue", "green", "yellow"].includes(house)) {
                    studentInfo.classList.add(`${house}-theme`);
                }
            }

            await loadTestHistory(tr);
            await loadMedicalHistory();
            await loadMyEvaluations();

        } catch (err) {
            console.warn("TestMaster missing, trying TestRecords…");

            try {
                const res2 = await fetch(`/api/testrecords/${tr}`);
                const records = await res2.json();

                if (records.length === 0) throw new Error("No records");

                if (studentInfo) studentInfo.classList.remove("hidden");
                if (historyCard) historyCard.style.display = "block";
                if (saveBtn) saveBtn.style.display = 'inline-block';
                if (saveBtn) saveBtn.disabled = false;
                if (saveWarning) {
                    saveWarning.textContent = 'ℹ️ Records found. You may add a new one if 7 days have passed.';
                    saveWarning.style.color = 'blue';
                }

                await loadTestHistory(tr);



                Swal.fire({
                    icon: 'info',
                    title: `TR ${tr} found in history`,
                    text: `Student not in active list but has a saved record.`,
                    timer: 2500,
                    showConfirmButton: false,
                });

            } catch (finalErr) {
                console.error("No record found", finalErr);
                Swal.fire({
                    icon: 'error',
                    title: 'No Record Found',
                    text: `No active or saved record found for TR ${tr}.`,
                });
            }
        }
    } catch (err) {
        console.error('Session validation failed:', err);
        window.location.href = '../Forbidden.html';
    }
}


// --- NEW FUNCTION: Save Date of Birth ---
async function saveDOB() {
    const dobInput = document.getElementById('dobInput');
    const dobValue = dobInput.value; // Format should be 'YYYY-MM-DD'

    if (!dobValue) {
        Swal.fire('Missing Date', 'Please select your Date of Birth.', 'warning');
        return;
    }

    // Optional: Add more robust date validation if needed
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dobValue)) {
         Swal.fire('Invalid Format', 'Please use the YYYY-MM-DD format for Date of Birth.', 'error');
         return;
    }


    try {
        const res = await fetch('/api/testmaster/me/dob', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ DOB: dobValue })
        });

        const data = await res.json();

        if (!res.ok) {
            throw new Error(data.error || 'Failed to save DOB.');
        }

        Swal.fire('Success!', 'Date of Birth saved successfully.', 'success');

        // --- Update UI immediately ---
        const dobDisplay = document.getElementById('studentDOBDisplay');
        const dobInputGroup = document.getElementById('dobInputGroup');
        const dobHelp = document.getElementById('dobHelp');
        const ageDisplay = document.getElementById('studentAge');

        const birthDate = new Date(dobValue);
        const today = new Date();
        let age = today.getFullYear() - birthDate.getFullYear();
        const m = today.getMonth() - birthDate.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
            age--;
        }
        
        // Update global studentData as well
        if (studentData) {
             studentData.DOB = dobValue; 
             studentData.calculatedAge = age;
        }

        if (ageDisplay) ageDisplay.innerText = age;
        if (dobDisplay) dobDisplay.innerText = birthDate.toLocaleDateString();
        if (dobInputGroup) dobInputGroup.style.display = 'none';
        if (dobHelp) dobHelp.style.display = 'none';
        // --- End UI Update ---

    } catch (err) {
        console.error("Save DOB failed", err);
        Swal.fire('Save Failed', `There was an error saving your Date of Birth: ${err.message}`, 'error');
    }
}


// ★★★ ADD THIS NEW FUNCTION ★★★
async function handleSetNewPassword(e) {
    e.preventDefault();
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;

    if (newPassword !== confirmPassword) {
        return Swal.fire('Error', 'Passwords do not match.', 'error');
    }

    try {
        const res = await fetch('/api/test/set-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include', // Ensures session cookie is sent
            body: JSON.stringify({ newPassword })
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.message);

        // Success!
        sessionStorage.removeItem('forcePasswordChange');
        await Swal.fire('Success!', 'Your new password has been set.', 'success');
        
        // Hide the modal
        const modalEl = document.getElementById('forcePasswordChangeModal');
        const modal = bootstrap.Modal.getInstance(modalEl);
        modal.hide();

    } catch (err) {
        Swal.fire('Error', err.message, 'error');
    }
}


// ★★★ ADD THESE NEW FUNCTIONS (MEDICAL HISTORY) ★★★

async function loadMedicalHistory() {
    const viewDiv = document.getElementById('medical-view');
    try {
        viewDiv.innerHTML = '<div class="loader-cell"><div class="loader"></div></div>';

        const res = await fetch('/api/medical-history/me', { credentials: 'include' });
        if (!res.ok) throw new Error('Could not fetch history');

        const { data } = await res.json();

        // Populate the form fields (even if hidden)
        document.getElementById('medAllergies').value = data?.Allergies || '';
        document.getElementById('medMedications').value = data?.Medications || '';
        document.getElementById('medFamilyHistory').value = data?.FamilyHistory || '';
        document.getElementById('medPreviousInjuries').value = data?.PreviousInjuries || '';

        // Populate the read-only view
        if (!data || (!data.Allergies && !data.Medications && !data.FamilyHistory && !data.PreviousInjuries)) {
            viewDiv.innerHTML = '<p class="text-muted">You have not added any medical history. Click "Edit" to add information.</p>';
        } else {
            const c = (val) => val || '<i class="text-muted">N/A</i>';
            viewDiv.innerHTML = `
                <ul class="list-group list-group-flush">
                    <li class="list-group-item">
                        <strong>Known Allergies</strong>
                        <p>${c(data.Allergies)}</p>
                    </li>
                    <li class="list-group-item">
                        <strong>Current Medications</strong>
                        <p>${c(data.Medications)}</p>
                    </li>
                    <li class="list-group-item">
                        <strong>Family History of Illness</strong>
                        <p>${c(data.FamilyHistory)}</p>
                    </li>
                    <li class="list-group-item">
                        <strong>Previous Injuries & Surgeries</strong>
                        <p>${c(data.PreviousInjuries)}</p>
                    </li>
                </ul>
            `;
        }
    } catch (err) {
        console.error('Error loading medical history:', err);
        viewDiv.innerHTML = '<p class="text-danger">Failed to load medical history.</p>';
    }
}
// ... (after loadMedicalHistory() function)

/**
 * ★★★ NEW: Helper to format evaluator metadata
 */
function formatMetaData(evaluator, profession, timestamp) {
    if (!evaluator) return '';
    const date = new Date(timestamp).toLocaleDateString();
    // e.g., "by Dr. John (Doctor) on 11/6/2025"
    return `by <strong>${evaluator}</strong> (${profession || 'Evaluator'}) on ${date}`;
}

/**
 * ★★★ NEW: Fetches and renders all evaluations
 */
async function loadMyEvaluations() {
    const container = document.getElementById('evaluation-accordion-container');
    try {
        const res = await fetch('/api/evaluations/me', { credentials: 'include' });
        if (!res.ok) throw new Error('Could not load evaluations');

        const result = await res.json();
        // ▼▼▼ THIS IS THE CORRECTED LINE ▼▼▼
        renderMyEvaluations(result.data, result.evaluators); // Call the render function

    } catch (err) {
        console.error('Error loading evaluations:', err);
        container.innerHTML = '<p class="text-danger">Failed to load evaluations.</p>';
    }
}

/**
 * ★★★ NEW: Renders the evaluation data into an accordion
 */
function renderMyEvaluations(data, evaluators) {
    const container = document.getElementById('evaluation-accordion-container');
    if (!data || data.length === 0) {
        container.innerHTML = '<p class="text-muted">You do not have any evaluations from trainers or doctors yet.</p>';
        return;
    }

    let accordionHtml = `<div class="accordion" id="studentEvaluationAccordion">`;
    const c = (val) => val ? val.replace(/\n/g, '<br>') : '<i class="text-muted">No comment.</i>';

    // data is an array of TestLogs, each with a .comments array
    data.forEach((log, index) => {
        const testDate = new Date(log.CreatedAt).toLocaleDateString();
        const hasComments = log.comments.length > 0;

        // Group comments by Category
        const commentsByCategory = log.comments.reduce((acc, comment) => {
            const category = comment.CategoryName;
            if (!acc[category]) acc[category] = [];
            acc[category].push(comment);
            return acc;
        }, {});

        accordionHtml += `
        <div class="accordion-item">
            <h2 class="accordion-header" id="heading-${index}">
                <button class="accordion-button ${index > 0 ? 'collapsed' : ''}" type="button" data-bs-toggle="collapse" data-bs-target="#collapse-${index}">
                    <strong>${log.BatchName}</strong>
                    <span class="ms-2 me-auto text-muted">(Test Date: ${testDate} | Grade: ${log.Grade})</span>
                    ${hasComments 
                        ? `<span class="badge bg-primary me-2">${log.comments.length} Comment(s)</span>` 
                        : `<span class="badge bg-secondary me-2">Pending</span>`
                    }
                </button>
            </h2>
            <div id="collapse-${index}" class="accordion-collapse collapse ${index === 0 ? 'show' : ''}" data-bs-parent="#studentEvaluationAccordion">
                <div class="accordion-body">
        `;

        if (!hasComments) {
            accordionHtml += '<p class="text-muted">This test has not been evaluated yet.</p>';
        } else {
            // Loop through each category (e.g., "Strengths", "Nutritional Guidelines")
            for (const categoryName in commentsByCategory) {
                accordionHtml += `<h5 class="comment-category">${categoryName}</h5>`;

                // Loop through comments within that category
                commentsByCategory[categoryName].forEach(comment => {
                    accordionHtml += `
                    <div class="comment-card-history">
                        <div class="comment-header">
                            <span class="comment-meta-data">
                                ${formatMetaData(comment.EvaluatorName, comment.Profession, comment.DateEvaluated)}
                            </span>
                        </div>
                        <p class="comment-body">${c(comment.CommentText)}</p>
                    </div>
                    `;
                });
            }
        }

        accordionHtml += `
                </div>
            </div>
        </div>
        `;
    });

    accordionHtml += `</div>`; // Close accordion
    container.innerHTML = accordionHtml;

    buildEvaluatorTable(evaluators);
}

// ★★★ ADD THIS NEW FUNCTION (around line 845) ★★★
// This function builds the "Know Your Evaluators" table
function buildEvaluatorTable(evaluators) {
    const tableBody = document.getElementById('evaluatorTableBody');
    tableBody.innerHTML = ''; // Clear loading/empty state

    if (!evaluators || evaluators.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="3" class="text-center py-4">No evaluator information found.</td></tr>';
        return;
    }

    evaluators.forEach(evaluator => {
        const row = document.createElement('tr');

        // 1. Name
        const nameCell = document.createElement('td');
        nameCell.className = 'py-3 px-4';
        nameCell.innerHTML = `<i class="fas fa-user-circle me-2 text-primary"></i> ${evaluator.Name || 'N/A'}`;
        row.appendChild(nameCell);

        // 2. Profession
        const profCell = document.createElement('td');
        profCell.className = 'py-3 px-4';
        profCell.textContent = evaluator.Profession || 'N/A';
        row.appendChild(profCell);

        // 3. Contact Info (Combine Email and Phone)
        const contactCell = document.createElement('td');
        contactCell.className = 'py-3 px-4';
        let contactHtml = '';
        if (evaluator.Email) {
            contactHtml += `<div><i class="fas fa-envelope me-2"></i> <a href="mailto:${evaluator.Email}">${evaluator.Email}</a></div>`;
        }
        if (evaluator.Contact) {
            contactHtml += `<div class="mt-1"><i class="fas fa-phone me-2"></i> ${evaluator.Contact}</div>`;
        }
        if (!contactHtml) {
            contactHtml = '<span>No contact info provided</span>';
        }
        contactCell.innerHTML = contactHtml;
        row.appendChild(contactCell);

        tableBody.appendChild(row);
    });
}

/**
 * ★★★ NEW: Populates the "Latest Fitness Snapshot" card
 */
function populateLatestTestCard(latestRecord) {
    const card = document.getElementById('latest-test-card');
    const grid = document.getElementById('latest-test-grid');
    const dateEl = document.getElementById('latest-test-date');

    if (!card) return;
    card.style.display = 'block'; // Show the card

    if (!latestRecord) {
        dateEl.textContent = 'No test data found. Please complete your first fitness test.';
        grid.innerHTML = '<p class="text-muted">Your results will appear here.</p>';
        return;
    }

    const testDate = new Date(latestRecord.CreatedAt).toLocaleDateString();
    dateEl.textContent = `From your test on ${testDate}`;

    // Helper to create a stat card
    const createStat = (label, value, grade) => `
        <div class="col-md-3 col-6">
            <div class="card h-100 text-center py-3">
                <h6 class="text-muted small text-uppercase mb-0">${label}</h6>
                <div class="fs-3 fw-bold ${grade || ''}">${value}</div>
            </div>
        </div>
    `;

    // Map grades to CSS classes
    const gradeClassMap = {
        'A+': 'text-success', 'A': 'text-success',
        'B': 'text-primary', 'C': 'text-warning',
        'D': 'text-danger'
    };
    
    const gradeClass = gradeClassMap[latestRecord.Grade] || 'text-dark';

    grid.innerHTML = `
        ${createStat('Grade', latestRecord.Grade, gradeClass)}
        ${createStat('Score', latestRecord.Total.toFixed(1) + '%', gradeClass)}
        ${createStat('BMI', latestRecord.BMI.toFixed(1))}
        ${createStat('Body Fat', latestRecord.BodyFat.toFixed(1) + '%')}
    `;
}

// --- Add Event Listeners for the new buttons ---

// Toggle between view and edit modes
document.getElementById('editMedicalBtn').addEventListener('click', () => {
    document.getElementById('medical-view').style.display = 'none';
    document.getElementById('medical-form').style.display = 'block';
    document.getElementById('editMedicalBtn').style.display = 'none';
});

document.getElementById('cancelMedicalBtn').addEventListener('click', () => {
    document.getElementById('medical-view').style.display = 'block';
    document.getElementById('medical-form').style.display = 'none';
    document.getElementById('editMedicalBtn').style.display = 'block';
    // Optional: Reload to discard any changes in the textareas
    loadMedicalHistory(); 
});

// Handle the save action
document.getElementById('saveMedicalBtn').addEventListener('click', async () => {
    const button = document.getElementById('saveMedicalBtn');
    const spinner = button.querySelector('.spinner-border');
    button.disabled = true;
    spinner.classList.remove('d-none');

    const payload = {
        Allergies: document.getElementById('medAllergies').value,
        Medications: document.getElementById('medMedications').value,
        FamilyHistory: document.getElementById('medFamilyHistory').value,
        PreviousInjuries: document.getElementById('medPreviousInjuries').value
    };

    try {
        const res = await fetch('/api/medical-history/me', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Failed to save');

        Swal.fire({
            toast: true, position: 'top-end', icon: 'success',
            title: 'Medical history saved!', showConfirmButton: false, timer: 2000
        });

        // Refresh the read-only view and toggle back
        await loadMedicalHistory(); // Reload data
        document.getElementById('medical-view').style.display = 'block';
        document.getElementById('medical-form').style.display = 'none';
        document.getElementById('editMedicalBtn').style.display = 'block';

    } catch (err) {
        Swal.fire('Error', err.message, 'error');
    } finally {
        button.disabled = false;
        spinner.classList.add('d-none');
    }
});

        function showTestInfo() {
            Swal.fire({
                title: "Fitness Test Overview",
                html: `
                    <h6>🧪 What This Test Measures:</h6>
                    <ul style="text-align: left;">
                        <li>🧍‍♂️ <b>BMI</b>: Body Mass Index - weight-to-height ratio</li>
                        <li>💪 <b>Body Fat %</b>: Estimated fat levels using body measurements</li>
                        <li>🔥 <b>BMR</b>: Basal Metabolic Rate - daily calorie burn</li>
                        <li>🫁 <b>VO2 Max</b>: Cardiovascular endurance from pulse rate</li>
                        <li>🏋️ <b>Strength & Flexibility</b>: Push-ups, Sit-ups, Squats, and Sit & Reach</li>
                    </ul>
                    <h6>🎯 Performance Scale:</h6>
                    <ul style="text-align: left;">
                        <li><b>Excellent</b>: Well above average fitness</li>
                        <li><b>Good</b>: Above average, keep going!</li>
                        <li><b>Average</b>: You're on track</li>
                        <li><b>Below Average</b>: Needs more training</li>
                        <li><b>Poor</b>: Improvement required urgently</li>
                    </ul>
                    <hr>
                    <p>📌  This gives you a holistic view of your current health and fitness condition.</p>
                `,
                icon: "info",
                confirmButtonText: "Got It!",
                confirmButtonColor: "#3498db",
                width: 600
            });
        }




          //--------------------------------------------------------------------------------------------------------
        function generateReport() {
            const form = document.getElementById('testForm');
                if (!form.checkValidity()) {
                form.reportValidity(); // Shows native error messages (like tooltip)
                return;
            }

            let Weight = parseFloat(form.querySelector('[name="Weight"]').value);
            let Height = parseFloat(form.querySelector('[name="Height"]').value);
            let Waist = parseFloat(form.querySelector('[name="Waist"]').value);
            let Hips = parseFloat(form.querySelector('[name="Hips"]').value);
            let Neck = parseFloat(form.querySelector('[name="Neck"]').value);
            let PulseRate = parseFloat(form.querySelector('[name="PulseRate"]').value);
            const Gender = form.querySelector('[name="Gender"]').value;

            const Age = studentData?.calculatedAge || 18; // Use fetched/calculated age or default to 18

            const PushUps = parseInt(form.querySelector('[name="PushUps"]').value) || 0;
            const SitUps = parseInt(form.querySelector('[name="SitUps"]').value) || 0;
            const Squats = parseInt(form.querySelector('[name="Squats"]').value) || 0;
            const SitReach = parseFloat(form.querySelector('[name="SitReach"]').value) || 0;

            // --- 🧠 Input Validation & Unit Auto-Detection for Anthropometric Data ---
            function validateAndConvertUnits() {
              let warnings = [];
              let converted = [];
              
              let inputs = {
                waist: Waist,
                neck: Neck,
                hips: Hips,
                height: Height
              };

              // Quick sanity checks
              const plausibleRange = (val, min, max) => val && !isNaN(val) && val >= min && val <= max;

              // If waist or neck look too small for cm (e.g. < 50cm), assume inches and auto-convert
              if (plausibleRange(Waist, 10, 50)) {
                Waist = Waist * 2.54;
                converted.push("Waist");
              } else if (!plausibleRange(Waist, 50, 150)) {
                warnings.push("Waist value seems unrealistic.");
              }

              if (plausibleRange(Neck, 5, 25)) {
                Neck = Neck * 2.54;
                converted.push("Neck");
              } else if (!plausibleRange(Neck, 25, 60)) {
                warnings.push("Neck value seems unrealistic.");
              }

              // Hips only for females
              if (Gender === "female" && Hips) {
                if (plausibleRange(Hips, 10, 50)) {
                  Hips = Hips * 2.54;
                  converted.push("Hips");
                } else if (!plausibleRange(Hips, 50, 160)) {
                  warnings.push("Hips value seems unrealistic.");
                }
              }

              // Height sanity check (too small/large)
              if (!plausibleRange(Height, 120, 220)) {
                warnings.push("Height value seems unrealistic.");
              }

              // If any unrealistic inputs — stop report
              if (warnings.length > 0) {
                Swal.fire({
                  icon: "warning",
                  title: "Invalid Inputs Detected",
                  html: warnings.join("<br>") + "<br><br>Please recheck your entries.",
                  confirmButtonColor: "#3085d6"
                });
                return false;
              }

              // Notify user if conversion applied
              if (converted.length > 0) {
                Swal.fire({
                  icon: "info",
                  title: "Units Auto-Converted",
                  html: `Detected values in inches for: <b>${converted.join(", ")}</b><br>
                  Converted automatically to centimeters.`,
                  timer: 3000,
                  showConfirmButton: false,
                  toast: true,
                  position: "top-end"
                });
              }

              return true;
            }

            // ✅ Run validation before proceeding
            if (!validateAndConvertUnits()) {
              return; // Stop report generation
            }

                 calculated = {
                Weight,
                Height,
                Waist,
                Hips,
                Neck,
                PulseRate,
                Gender,
                Age
            };

            // BMI + Status
            if (Weight && Height) {
                const heightInM = Height / 100;
                const bmi = (Weight / (heightInM * heightInM)).toFixed(1);
                calculated.BMI = bmi;

                if (bmi < 18.5) calculated.BMIStatus = "Underweight";
                else if (bmi < 24.9) calculated.BMIStatus = "Normal weight";
                else if (bmi < 29.9) calculated.BMIStatus = "Overweight";
                else calculated.BMIStatus = "Obese";
            }

            // --- 💪 Body Fat % Calculation (Robust Navy Method with Validation) ---
            function navyBodyFatMale(waist_cm, neck_cm, height_cm) {
              const denom = 1.0324 - 0.19077 * Math.log10(waist_cm - neck_cm) + 0.15456 * Math.log10(height_cm);
              if (!isFinite(denom) || denom === 0) return null;
              return 495 / denom - 450;
            }

            function navyBodyFatFemale(waist_cm, hips_cm, neck_cm, height_cm) {
              const denom = 1.29579 - 0.35004 * Math.log10(waist_cm + hips_cm - neck_cm) + 0.22100 * Math.log10(height_cm);
              if (!isFinite(denom) || denom === 0) return null;
              return 495 / denom - 450;
            }

            let bodyFat = null;

            try {
              if (Gender === "male") {
                if ((Waist - Neck) > 0) bodyFat = navyBodyFatMale(Waist, Neck, Height);
              } else if (Gender === "female" && Hips) {
                if ((Waist + Hips - Neck) > 0) bodyFat = navyBodyFatFemale(Waist, Hips, Neck, Height);
              }

              // sanity clamp
              if (bodyFat === null || !isFinite(bodyFat) || bodyFat < 2 || bodyFat > 60) {
                bodyFat = null;
                Swal.fire({
                  icon: "error",
                  title: "Body Fat Error",
                  html: "Unable to compute a valid Body Fat %. Please verify waist, neck, and height inputs.",
                  confirmButtonColor: "#d33"
                });
              }

            } catch (e) {
              bodyFat = null;
              Swal.fire({
                icon: "error",
                title: "Body Fat Calculation Failed",
                text: e.message || "Unexpected error in formula.",
              });
            }

            calculated.BodyFat = bodyFat ? parseFloat(bodyFat.toFixed(1)) : "N/A";

            // BMR (Mifflin-St Jeor)
            if (Weight && Height) {
                if (Gender === "male") {
                    calculated.BMR = Math.round(10 * Weight + 6.25 * Height - 5 * Age + 5);
                } else {
                    calculated.BMR = Math.round(10 * Weight + 6.25 * Height - 5 * Age - 161);
                }
                calculated.CalorieIntake = Math.round(calculated.BMR * 1.55);
            }
            // VO2 Max (use actual Age instead of hardcoded 18)
            if (PulseRate) {
                calculated.VO2Max = Math.round(15 * (220 - Age) / PulseRate);
            } else {
                calculated.VO2Max = "N/A";
            }

            // Fitness Score
            const pushupScore = PushUps / 2;
            const situpScore = SitUps / 2;
            const squatScore = Squats / 2;
            const sitReachScore = SitReach;

            const totalScore = Math.round(
                pushupScore + situpScore + squatScore + sitReachScore + (calculated.VO2Max !== "N/A" ? calculated.VO2Max / 2 : 0)
            );
            calculated.Total = totalScore;

            // Grade
            if (totalScore >= 80) calculated.Grade = "A+";
            else if (totalScore >= 70) calculated.Grade = "A";
            else if (totalScore >= 60) calculated.Grade = "B";
            else if (totalScore >= 50) calculated.Grade = "C";
            else calculated.Grade = "D";

            // Store globally for saveRecord()
            const saveBtn = document.getElementById("saveBtn");
            saveBtn.dataset.reportData = JSON.stringify(calculated);

            // Evaluation rules
            const avgMetrics = {
                BMI: 22.5,
                VO2Max: 45,
                BodyFat: 20,
                BMR: 1500,
                CalorieIntake: 2100,
                Total: 60,
            };

            function getEvaluation(metric, value) {
                if (value === "N/A" || value === undefined) return "N/A";
                value = parseFloat(value);
                const avg = avgMetrics[metric];
                const diff = value - avg;

                if (metric === "BodyFat" || metric === "BMI") {
                    if (value < 16) return "Underweight - Needs Improvement";
                    if (value > 30) return "High - At Risk";
                    if (Math.abs(diff) <= 2) return "Healthy Range";
                    return diff < 0 ? "Low - Acceptable" : "High - Needs Work";
                }

                if (Math.abs(diff) < 5) return "Average - Needs Practice";
                if (diff > 10) return "Excellent";
                if (diff > 5) return "Good";
                if (diff < -10) return "Poor";
                return "Below Average";
            }

            // Report rendering
            const reportHTML = `
                <tr><th>BMI</th><td>${calculated.BMI ?? 'N/A'}</td><td>${getEvaluation('BMI', calculated.BMI)}</td></tr>
                <tr><th>BMI Status</th><td>${calculated.BMIStatus ?? 'N/A'}</td><td>-</td></tr>
                <tr>
                  <th>Body Fat %</th>
                  <td>${calculated.BodyFat}</td>
                  <td>${calculated.BodyFat === "N/A" ? "Invalid / Check Inputs" : getEvaluation('BodyFat', calculated.BodyFat)}</td>
                </tr>
                <tr><th>BMR</th><td>${calculated.BMR ?? 'N/A'}</td><td>${getEvaluation('BMR', calculated.BMR)}</td></tr>
                <tr><th>Calorie Intake</th><td>${calculated.CalorieIntake ?? 'N/A'}</td><td>${getEvaluation('CalorieIntake', calculated.CalorieIntake)}</td></tr>
                <tr><th>VO2 Max</th><td>${calculated.VO2Max}</td><td>${getEvaluation('VO2Max', calculated.VO2Max)}</td></tr>
                <tr><th>Total Score</th><td>${calculated.Total}</td><td>${getEvaluation('Total', calculated.Total)}</td></tr>
                <tr><th>Grade</th><td>${calculated.Grade}</td><td>-</td></tr>
            `;

            document.getElementById("reportTableBody").innerHTML = reportHTML;
            document.getElementById("reportSection").classList.remove("hidden");
        }


        //----------------------------------------------------------------------------------------------------


                async function saveRecord() {
                    const currentTR = localStorage.getItem('currentTR');
                    if (!currentTR) {
                        Swal.fire('Session Expired', 'Please log in again to save your record.', 'error');
                        window.location.href = '../Forbidden.html';
                        return;
                    }

                    const saveBtn = document.getElementById("saveBtn");
                    if (!saveBtn) {
                        Swal.fire('Error', 'Save button not found in DOM.', 'error');
                        return;
                    }

                    // read report data from dataset
                    let reportDataString = saveBtn.dataset.reportData;
                    if (!reportDataString) {
                        Swal.fire('Missing data', 'Please generate the report before saving.', 'error');
                        return;
                    }

                    let reportObj;
                    try {
                        reportObj = JSON.parse(reportDataString);
                    } catch (err) {
                        console.error('Invalid saved report data:', err);
                        Swal.fire('Error', 'Saved report data corrupted. Please re-generate the report.', 'error');
                        return;
                    }

                    // now use reportObj (local name) rather than relying on a global that might be stale
                    const calculatedLocal = reportObj;

                    // perform required checks on calculatedLocal (same checks as before)
                    const requiredChecks = [
                        { name: 'Weight', value: calculatedLocal.Weight },
                        { name: 'Height', value: calculatedLocal.Height },
                        { name: 'Waist', value: calculatedLocal.Waist },
                        { name: 'Hips', value: calculatedLocal.Hips },
                        { name: 'Neck', value: calculatedLocal.Neck },
                        { name: 'BMI', value: calculatedLocal.BMI },
                        { name: 'BMIStatus', value: calculatedLocal.BMIStatus },
                        { name: 'BodyFat', value: calculatedLocal.BodyFat },
                        { name: 'BMR', value: calculatedLocal.BMR },
                        { name: 'CalorieIntake', value: calculatedLocal.CalorieIntake },
                        { name: 'VO2Max', value: calculatedLocal.VO2Max },
                        { name: 'Total', value: calculatedLocal.Total },
                        { name: 'Grade', value: calculatedLocal.Grade },
                    ];

                    for (const field of requiredChecks) {
                        if (field.name === 'VO2Max' && (field.value === "N/A" || field.value === null || field.value === undefined || field.value === '')) {
                            Swal.fire('Invalid VO2Max', 'Please provide a valid pulse rate to calculate VO2 Max.', 'error');
                            return;
                        }
                        if (field.value === null || field.value === undefined) {
                            Swal.fire('Missing Field', `Please fill the field: ${field.name}`, 'error');
                            return;
                        }
                    }

                    // build request body from calculatedLocal
                    const body = {
                        Weight: calculatedLocal.Weight,
                        Height: calculatedLocal.Height,
                        Waist: calculatedLocal.Waist,
                        Hips: calculatedLocal.Hips,
                        Neck: calculatedLocal.Neck,
                        BMI: parseFloat(calculatedLocal.BMI),
                        BMIStatus: calculatedLocal.BMIStatus,
                        BodyFat: parseFloat(calculatedLocal.BodyFat),
                        BMR: parseFloat(calculatedLocal.BMR),
                        CalorieIntake: parseFloat(calculatedLocal.CalorieIntake),
                        VO2Max: calculatedLocal.VO2Max === "N/A" ? null : parseFloat(calculatedLocal.VO2Max),
                        Total: parseFloat(calculatedLocal.Total),
                        Grade: calculatedLocal.Grade
                    };


            // 🔹 Confirmation SweetAlert before actual save
        Swal.fire({
            title: 'Confirm Submission',
            html: `
                <p>Please confirm your details before submitting:</p>
                <ul style="text-align:left">
                    <li><b>Age Used:</b> ${calculated.Age} years</li>
                    <li><b>Gender:</b> ${calculated.Gender || 'Not specified'}</li>
                    <li><b>Weight:</b> ${body.Weight} kg</li>
                    <li><b>Height:</b> ${body.Height} cm</li>
                    <li><b>BMI:</b> ${body.BMI.toFixed(2)} (${body.BMIStatus})</li>
                    <li><b>Body Fat %:</b> ${body.BodyFat.toFixed(2)}</li>
                    <li><b>BMR:</b> ${body.BMR.toFixed(1)}</li>
                    <li><b>VO₂ Max:</b> ${isNaN(body.VO2Max) ? 'N/A' : body.VO2Max.toFixed(1)}</li>
                    <li><b>Total Score:</b> ${body.Total.toFixed(1)}</li>
                    <li><b>Grade:</b> ${body.Grade}</li>
                </ul>
                <p style="color:red;font-size:0.9em">⚠️ You can only submit once per week.</p>
            `,

                icon: 'warning',
                showCancelButton: true,
                confirmButtonText: 'Yes, Submit',
                cancelButtonText: 'Review Again',
                reverseButtons: true
            }).then((result) => {
                if (result.isConfirmed) {
                    fetch('/api/testrecords', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(body)
                    })
                    .then(res => res.json())
                    .then(data => {
                        if (data.error) {
                            Swal.fire('Save Failed', data.error, 'error');
                        } else {
                            // 🔹 Calculate next allowed submission date
                            const nextDate = new Date();
                            nextDate.setDate(nextDate.getDate() + 7);

                            Swal.fire({
                                title: '🎉 Fitness Test Saved!',
                                html: `Your result has been saved successfully.<br>
                                       <b>Next submission allowed on:</b> ${nextDate.toLocaleDateString()}`,
                                icon: 'success',
                                confirmButtonText: 'OK'
                            }).then(() => {
                                location.reload(); // Reload to reflect changes
                            });
                        }
                    })
                    .catch(err => {
                        console.error("Save failed", err);
                        Swal.fire('Save Failed', 'There was an error saving your test record.', 'error');
                    });
                } else {
                    saveBtn.disabled = false; // re-enable if cancelled
                }
            });
        }



        //---------------------------------------------------------------------------------------------------------------


function renderProgressBar(records) {
    const goal = parseFloat(localStorage.getItem("fitnessGoal"));
    const progressSection = document.getElementById("progressSection");
    const progressWrapper = document.getElementById("progressWrapper");

    if (!progressSection || !progressWrapper) return;

    if (!goal || !records || records.length === 0) {
        progressSection.classList.remove("hidden");
        progressWrapper.classList.add("hidden");
        return;
    }

    const firstTotal = parseFloat(records[records.length - 1].Total); // oldest
    const latestTotal = parseFloat(records[0].Total); // newest

    // --- Primary Progress (Total score, higher = better) ---
    let progress = ((latestTotal - firstTotal) / (goal - firstTotal)) * 100;
    let regression = false;
    if (progress < 0) {
        regression = true;
        progress = Math.abs(progress);
    }
    progress = Math.min(progress, 100);

    progressSection.classList.remove("hidden");
    progressWrapper.classList.remove("hidden");

    const bar = document.getElementById("progressBar");
    if (bar) {
        bar.className = "progress-bar";
        bar.style.width = progress + "%";
        bar.textContent = regression ? `-${progress.toFixed(1)}%` : `${progress.toFixed(1)}%`;

        if (regression) {
            bar.classList.add("bg-danger");
        } else if (progress < 30) {
            bar.classList.add("bg-danger");
        } else if (progress < 70) {
            bar.classList.add("bg-warning");
        } else {
            bar.classList.add("bg-success");
        }
    }

    const text = `Start: ${firstTotal} → Current: ${latestTotal} → Goal: ${goal}`;
    const progressText = document.getElementById("progressText");
    if (progressText) {
        progressText.textContent = regression ? text + " | ⚠️ Regression observed" : text;
    }

    // --- Secondary Progress (BMI toward WHO range) ---
    if (records[0].BMI) {
        const latestBMI = parseFloat(records[0].BMI);
        const minHealthy = 18.5, maxHealthy = 24.9;

        let bmiProgress = 0, bmiDirection = "";
        if (latestBMI < minHealthy) {
            bmiProgress = ((latestBMI - 15) / (18.5 - 15)) * 100;
            bmiDirection = "Underweight → gain needed";
        } else if (latestBMI > maxHealthy) {
            bmiProgress = ((30 - latestBMI) / (30 - 24.9)) * 100;
            bmiDirection = "Overweight → loss needed";
        } else {
            bmiProgress = 100;
            bmiDirection = "Within healthy BMI ✅";
        }

        bmiProgress = Math.max(0, Math.min(bmiProgress, 100));

        const bmiWrapper = document.getElementById("bmiProgressWrapper");
        if (bmiWrapper) {
            bmiWrapper.classList.remove("hidden");
            const bmiBar = document.getElementById("bmiProgressBar");
            if (bmiBar) {
                bmiBar.className = "progress-bar";
                bmiBar.style.width = bmiProgress + "%";
                bmiBar.textContent = bmiProgress.toFixed(1) + "%";

                if (bmiProgress < 30) bmiBar.classList.add("bg-danger");
                else if (bmiProgress < 70) bmiBar.classList.add("bg-warning");
                else bmiBar.classList.add("bg-success");
            }

            const bmiProgressText = document.getElementById("bmiProgressText");
            if (bmiProgressText) {
                bmiProgressText.textContent = `BMI: ${latestBMI.toFixed(1)} (${bmiDirection})`;
            }
        }
    }

    // ---- Chart.js Trend Line ----
    const ctx = document.getElementById('progressChart')?.getContext('2d');
    if (ctx) {
        if (window.progressChart && typeof window.progressChart.destroy === "function") {
            window.progressChart.destroy();
        }

        const labels = records.map(r => new Date(r.CreatedAt).toLocaleDateString()).reverse();
        const dataPoints = records.map(r => parseFloat(r.Total)).reverse();

        window.progressChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels,
                datasets: [
                    {
                        label: 'Fitness Score',
                        data: dataPoints,
                        borderColor: '#4facfe',
                        backgroundColor: 'rgba(79,172,254,0.2)',
                        borderWidth: 3,
                        pointRadius: 5,
                        pointBackgroundColor: '#00f2fe',
                        tension: 0.3
                    },
                    {
                        label: 'Goal',
                        data: Array(dataPoints.length).fill(goal),
                        borderColor: '#ff6a00',
                        borderDash: [5, 5],
                        borderWidth: 2,
                        pointRadius: 0
                    }
                ]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: { position: 'top' },
                    tooltip: { mode: 'index', intersect: false }
                },
                scales: { y: { beginAtZero: false } }
            }
        });
    }
}

        async function loadTestHistory() {
            try {
                const response = await fetch(`/api/testrecords/me`, {
                    method: 'GET',
                    credentials: 'include'
                });
                
                historyData = await response.json(); // STORE DATA GLOBALLY
                const records = historyData; // Use the global data for the functions below

                const saveBtn = document.getElementById('saveBtn');
                const saveWarning = document.getElementById('saveWarning');
                const tbody = document.getElementById('historyBody');
                
                if(tbody) tbody.innerHTML = ''; 

                // Handle save button visibility based on submission timing
                if (records.length > 0) {
                    const latest = new Date(records[0].CreatedAt);
                    const now = new Date();
                    const diffDays = Math.floor((now - latest) / (1000 * 60 * 60 * 24));

                    if (diffDays < 7) {
                        saveBtn.style.display = "none";
                        saveWarning.textContent = `⚠️ You already submitted ${diffDays} days ago. Next available after ${7 - diffDays} days.`;
                        saveWarning.style.color = 'orange';
                    } else {
                        saveBtn.style.display = "inline-block";
                        saveWarning.textContent = '✅ You can save a new record now.';
                        saveWarning.style.color = 'green';
                    }
                } else {
                    saveBtn.style.display = "inline-block";
                    saveWarning.textContent = '⚠️ First attempt. Please submit carefully.';
                    saveWarning.style.color = 'red';
                }

                renderProgressBar(records);
                populateLatestTestCard(records[0]); // This is your new card from before

                // currentScore update which is 'Total' in latest record
                if (records.length > 0) {
                    const currentScoreEl = document.getElementById('currentScore');
                    currentScoreEl.textContent = `${parseFloat(records[0].Total).toFixed(1)}%`;
                }   

                // ★★★ THIS IS THE FIX ★★★
                // After all data is loaded and processed, check if the table
                // was already initialized (by a "fast click")
                if (historyDataTable) {
                    // The table exists, but it was built with empty data.
                    // Now, we clear it, add the real data, and redraw.
                    historyDataTable.clear().rows.add(historyData).draw();
                }
                // ★★★ END OF FIX ★★★

            } catch (err) {
                console.error("Error loading test history", err);
                Swal.fire({
                    icon: 'error',
                    title: 'Error Loading History',
                    text: 'Failed to load test history. Please try again later.'
                });
            }
        }

        /**
         * ★★★ NEW FUNCTION ★★★
         * Initializes the history DataTable *after* its container is visible.
         */
        function initializeHistoryTable() {
            // Check if table is already built
            if (historyDataTable) {
                return; 
            }

            // Initialize DataTables
            historyDataTable = $('#historyTable').DataTable({
                paging: true,
                searching: true,
                ordering: true,
                order: [], // This respects the API's TestLog order
                responsive: true, 
                data: historyData, // Use the globally fetched data
                columns: [
                    { data: 'CreatedAt', render: (data) => new Date(data).toLocaleDateString() },
                    { data: 'BMI', render: (data) => parseFloat(data).toFixed(2) },
                    { data: 'BodyFat', render: (data) => parseFloat(data).toFixed(2) },
                    { data: 'BMR', render: (data) => parseFloat(data).toFixed(1) },
                    { data: 'VO2Max', render: (data) => (data ? parseFloat(data).toFixed(1) : 'N/A') },
                    { data: 'Total', render: (data) => parseFloat(data).toFixed(1) },
                    { data: 'Grade', render: (data) => `<strong>${data}</strong>` }
                ],
                language: {
                    emptyTable: "No test records available. Please submit a fitness test."
                }
            });
            
            // Force the table to recalculate its layout now that it's visible
            // We use a tiny delay to ensure the browser has rendered the container
            setTimeout(() => {
                if (historyDataTable) {
                    historyDataTable.columns.adjust();
                }
            }, 10);
        }


        function toggleDarkMode() {
    document.body.classList.toggle('dark-mode');

    // update button icon & label dynamically
    const dmBtn = document.getElementById('darkModeBtn');

    if (dmBtn) {
        const icon = dmBtn.querySelector('i');
        const label = dmBtn.querySelector('span');
        const isDark = document.body.classList.contains('dark-mode');
        if (icon) icon.className = isDark ? 'fas fa-sun' : 'fas fa-moon';
        if (label) label.textContent = isDark ? 'Light Mode' : 'Dark Mode';
    }

    // remember preference
    localStorage.setItem('darkMode', document.body.classList.contains('dark-mode'));
}






        // Save goal
        document.getElementById("saveGoalBtn").addEventListener("click", async (e) => {
            e.preventDefault();

            const goal = parseFloat(document.getElementById("goalInput").value);
            if (!goal || goal <= 0) {
                Swal.fire('Invalid Goal', 'Please enter a valid number greater than 0.', 'error');
                return;
            }

            localStorage.setItem("fitnessGoal", goal);
            Swal.fire('Goal Saved ✅', `Your goal is set to ${goal}`, 'success');

            // Update progress bar and chart without reloading
            try {
                const response = await fetch(`/api/testrecords/me`, {
                    method: 'GET',
                    credentials: 'include'
                });
                const records = await response.json();
                renderProgressBar(records); // Update UI dynamically
            } catch (err) {
                console.error("Error updating progress after goal save", err);
                Swal.fire('Error', 'Failed to update progress. Please refresh.', 'error');
            }
        });



          //----------------------------------------------------------------------------------------------------------------
                
// Get all the navigation links
const navLinks = document.querySelectorAll('.sidebar a');
const sections = {
    'tab-profile': 'profile-overview',
    'tab-fit': 'student-fit',
    'tab-evaluations': 'student-evaluations',
    'tab-goals': 'goals-progress',
    'tab-history': 'test-history',
    'tab-achievements': 'achievements'
};

// Function to show a specific tab
// Function to show a specific tab
function showTab(tabId) {
    // Remove 'active' class from all nav links
    navLinks.forEach(nav => nav.classList.remove('active'));
    
    // Hide all sections
    Object.values(sections).forEach(id => {
        const section = document.getElementById(id);
        if (section) section.style.display = 'none';
    });

    // Activate the selected tab and section
    const link = document.getElementById(tabId);
    const sectionId = sections[tabId];
    if (link && sectionId) {
        link.classList.add('active');
        const section = document.getElementById(sectionId);
        if (section) section.style.display = 'block';

        // ★★★ THIS IS THE NEW FIX ★★★
        // If we just revealed the history tab, initialize the table (if not already done).
        if (tabId === 'tab-history') {
            initializeHistoryTable();
        }
        // ★★★ END OF FIX ★★★
    }
}

// Add click listener to each link
navLinks.forEach(link => {
    link.addEventListener('click', function(event) {
        event.preventDefault();
        const tabId = this.id;
        showTab(tabId);
        localStorage.setItem('activeTab', tabId); // Save active tab
    });
});


        //-------------------------------------------------------------------------------------------------
function clearFitnessResults() {
    // prefer targeting the test form so we don't rely on ids
    const form = document.getElementById('testForm');
    if (!form) return;

    // clear all inputs inside the form
    form.querySelectorAll('input, select, textarea').forEach(el => {
        if (el.type === 'checkbox' || el.type === 'radio') el.checked = false;
        else el.value = '';
    });

    // clear generated report and hide it
    const report = document.getElementById("reportTableBody");
    if (report) report.innerHTML = "";
    const reportSection = document.getElementById("reportSection");
    if (reportSection) reportSection.classList.add("hidden");

    // reset any stored calculated data
    calculated = null;
    const saveBtn = document.getElementById("saveBtn");
    if (saveBtn) delete saveBtn.dataset.reportData;
}



          function showConverter() {
            Swal.fire({
              title: '📏 Inches to Centimeters',
              html: `
                <input id="inchesInput" type="number" step="any" placeholder="Enter inches" class="swal2-input" />
                <div id="result" style="margin-top: 10px; font-weight: bold;"></div>
              `,
              showCancelButton: true,
              confirmButtonText: 'Convert',
              cancelButtonText: 'Close',
              preConfirm: () => {
                const inches = parseFloat(document.getElementById('inchesInput').value);
                if (isNaN(inches)) {
                  Swal.showValidationMessage('Please enter a valid number!');
                } else {
                  const cm = (inches * 2.54).toFixed(2);
                  document.getElementById('result').innerText = `${inches} inches = ${cm} cm`;
                  return false; // Prevents closing
                }
              }
            });
          }

        document.getElementById('logoutLink').addEventListener('click', function (e) {
            e.preventDefault();

            fetch('/api/logout', {
                method: 'POST',
                credentials: 'include'
            })
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    localStorage.clear(); // Clear any client-side data
                    window.location.href = '../homepage.html'; // Redirect to login/home
                } else {
                    alert('Logout failed.');
                }
            })
            .catch(err => {
                console.error('Logout error:', err);
            });
        });

        // New Functions for Modern UI
function toggleSidebar() {
    const sidebar = document.querySelector('.sidebar');
    const main = document.querySelector('.main-content');
    if (!sidebar || !main) return;

    sidebar.classList.toggle('collapsed');
    main.classList.toggle('expanded');

    // Optionally remember user preference
    localStorage.setItem('sidebarCollapsed', sidebar.classList.contains('collapsed'));
}

// ✅ Unified DOMContentLoaded Loader — combines all initialization steps
window.addEventListener('DOMContentLoaded', () => {
    // ----------------------------
    // 1️⃣ Restore Dark Mode
    // ----------------------------
    if (localStorage.getItem('darkMode') === 'true') {
        document.body.classList.add('dark-mode');
    }

    // ----------------------------
    // 2️⃣ Restore Sidebar State
    // ----------------------------
    const sidebar = document.querySelector('.sidebar');
    const main = document.querySelector('.main-content');
    if (sidebar && main) {
        const wasCollapsed = localStorage.getItem('sidebarCollapsed') === 'true';
        sidebar.classList.toggle('collapsed', wasCollapsed);
        main.classList.toggle('expanded', !wasCollapsed);
    }

    // ----------------------------
    // 3️⃣ Restore Last Active Tab
    // ----------------------------
    const savedTab = localStorage.getItem('activeTab') || 'tab-profile';
    showTab(savedTab);

    // ----------------------------
    // 4️⃣ Validate Student Session
    // ----------------------------
    validateStudentSession();

    // ----------------------------
    // 5️⃣ Initialize Popovers (Bootstrap)
    // ----------------------------
    const popoverTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="popover"]'));
    popoverTriggerList.map(el => new bootstrap.Popover(el));

    // ----------------------------
    // 6️⃣ Force Password Change Modal (if required)
    // ----------------------------
    if (sessionStorage.getItem('forcePasswordChange') === 'true') {
        const passwordModalEl = document.getElementById('forcePasswordChangeModal');
        const setPasswordForm = document.getElementById('setPasswordForm');

        if (passwordModalEl && setPasswordForm) {
            const passwordModal = new bootstrap.Modal(passwordModalEl, {
                backdrop: 'static',
                keyboard: false
            });
            passwordModal.show();

            if (!setPasswordForm.dataset.listenerAttached) {
                setPasswordForm.addEventListener('submit', handleSetNewPassword);
                setPasswordForm.dataset.listenerAttached = 'true';
            }
        }
    }

    // ----------------------------
    // 7️⃣ Restore Saved Fitness Goal
    // ----------------------------
    const savedGoal = localStorage.getItem('fitnessGoal');
    if (savedGoal) {
        const goalInput = document.getElementById('goalInput');
        if (goalInput) goalInput.value = savedGoal;
    }
});




// Re-attach UI toggle functions to window so inline HTML can access them
window.toggleDarkMode = toggleDarkMode;
window.toggleSidebar = toggleSidebar;
window.showTestInfo = showTestInfo;
window.generateReport = generateReport;
window.saveRecord = saveRecord;
window.showConverter = showConverter;
window.saveDOB = saveDOB;
