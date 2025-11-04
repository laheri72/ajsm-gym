document.addEventListener('DOMContentLoaded', () => {

    // --- 1. GET DATA FROM URL & API ---
    let currentTestLog = null;
    let currentBatchNum = null;
    let batchRecordList = []; 
    let currentRecordIndex = -1;

    const pageTitle = document.getElementById('page-title');
    const anchorContainer = document.getElementById('student-info-anchor');
    const historyContainer = document.getElementById('historical-data-container'); // ★★★ New
    const form = document.getElementById('commentEntryForm');
    const formCard = document.getElementById('comment-form-card');
    const saveBtn = document.getElementById('saveBtn');
    const saveAndNextBtn = document.getElementById('saveAndNextBtn');

    const urlParams = new URLSearchParams(window.location.search);
    currentTestLog = urlParams.get('testlog');
    currentBatchNum = urlParams.get('batch');

    if (!currentTestLog || !currentBatchNum) {
        document.body.innerHTML = '<h1>Error: Missing TestLog or Batch information.</h1><a href="evaluation.html">Back to Dashboard</a>';
        return;
    }

    async function initializePage() {
        try {
            // Fetch in parallel
            const [batchListData, recordData] = await Promise.all([
                fetchBatchList(currentBatchNum),
                fetchRecordDetails(currentTestLog)
            ]);

            // --- A. Process Batch List (for "Save & Next") ---
            batchRecordList = batchListData.map(record => record.TestLog);
            currentRecordIndex = batchRecordList.indexOf(parseInt(currentTestLog));
            
            if (currentRecordIndex === batchRecordList.length - 1) {
                saveAndNextBtn.innerHTML = 'Save & Finish Batch'; // (No spinner)
            }

            // --- B. Process API Response (★★★ NEW STRUCTURE ★★★) ---
            populateAnchor(recordData.currentRecord);
            populateForm(recordData.currentComments);
            populateHistory(recordData.historicalRecords); // ★★★ New function call

            document.getElementById('commentTestLog').value = currentTestLog;

        } catch (err) {
            console.error(err);
            anchorContainer.innerHTML = `<p class="text-danger">Error loading record: ${err.message}</p>`;
            historyContainer.innerHTML = '';
            formCard.classList.add('d-none');
        }
    }

    async function fetchBatchList(batchNum) {
        const res = await fetch(`/api/evaluation/batch-details/${batchNum}`, { credentials: 'include' });
        if (!res.ok) throw new Error('Could not fetch batch list.');
        const { data } = await res.json();
        return data; 
    }

    async function fetchRecordDetails(testLog) {
        const res = await fetch(`/api/evaluation/comment-details/${testLog}`, { credentials: 'include' });
        if (!res.ok) throw new Error('Could not fetch record details.');
        const data = await res.json();
        return data; // Returns { currentRecord, currentComments, historicalRecords }
    }

    // --- 2. POPULATE THE PAGE ---

    function populateAnchor(record) {
        pageTitle.textContent = `Evaluating: ${record.Name} (TR: ${record.TR})`;
        const f = (val, dec = 1, unit = '') => (val != null ? `${parseFloat(val).toFixed(dec)}${unit}` : 'N/A');

        anchorContainer.innerHTML = `
            <div class="anchor-header">
                <div class="anchor-title">
                    <h4>${record.Name}</h4>
                    <p class="text-muted">TR: ${record.TR} | Test Date: ${new Date(record.CreatedAt).toLocaleDateString()}</p>
                </div>
                <div class="anchor-grade ${'grade-' + (record.Grade ? record.Grade.replace('+', '-plus') : '')}">
                    <span>Grade</span>
                    <strong>${record.Grade || 'N/A'}</strong>
                </div>
            </div>
            <div class="test-results-grid full-grid">
                <div class="test-result-item"><div class="test-result-item-label">Weight</div><div class="test-result-item-value">${f(record.Weight, 1, ' kg')}</div></div>
                <div class="test-result-item"><div class="test-result-item-label">Height</div><div class="test-result-item-value">${f(record.Height, 1, ' cm')}</div></div>
                <div class="test-result-item"><div class="test-result-item-label">Waist</div><div class="test-result-item-value">${f(record.Waist, 1, ' cm')}</div></div>
                <div class="test-result-item"><div class="test-result-item-label">Hips</div><div class="test-result-item-value">${f(record.Hips, 1, ' cm')}</div></div>
                <div class="test-result-item"><div class="test-result-item-label">Neck</div><div class="test-result-item-value">${f(record.Neck, 1, ' cm')}</div></div>
                <div class="test-result-item"><div class="test-result-item-label">BMI</div><div class="test-result-item-value">${f(record.BMI, 1)}</div></div>
                <div class="test-result-item"><div class="test-result-item-label">BMI Status</div><div class="test-result-item-value">${record.BMIStatus}</div></div>
                <div class="test-result-item"><div class="test-result-item-label">Body Fat</div><div class="test-result-item-value">${f(record.BodyFat, 1, '%')}</div></div>
                <div class="test-result-item"><div class="test-result-item-label">BMR</div><div class="test-result-item-value">${f(record.BMR, 0, ' kcal')}</div></div>
                <div class="test-result-item"><div class="test-result-item-label">Calorie Intake</div><div class="test-result-item-value">${f(record.CalorieIntake, 0, ' kcal')}</div></div>
                <div class="test-result-item"><div class="test-result-item-label">VO₂ Max</div><div class="test-result-item-value">${f(record.VO2Max, 0)}</div></div>
                <div class="test-result-item"><div class="test-result-item-label">Total Score</div><div class="test-result-item-value">${f(record.Total, 0)}</div></div>
            </div>
        `;
    }

    function populateForm(comments) {
        if (comments) {
            form.elements.NutritionNotes.value = comments.NutritionNotes || '';
            form.elements.HealthNotes.value = comments.HealthNotes || '';
            form.elements.Recommendations.value = comments.Recommendations || '';
        }
    }

    // ★★★ NEW: Function to build the history accordion ★★★
    function populateHistory(historicalRecords) {
        if (!historicalRecords || historicalRecords.length === 0) {
            historyContainer.innerHTML = '<h4 class="text-muted">No previous test history found for this student.</h4>';
            return;
        }

        // Build the accordion HTML
        let html = `
            <h3 class="mb-3">Previous Evaluations (${historicalRecords.length})</h3>
            <div class="accordion" id="historyAccordion">
        `;

        historicalRecords.forEach((item, index) => {
            const f = (val, dec = 1, unit = '') => (val != null ? `${parseFloat(val).toFixed(dec)}${unit}` : 'N/A');
            const c = (val) => val || '<i class="text-muted">No comment.</i>';
            const isCompleted = item.NutritionNotes || item.HealthNotes || item.Recommendations;

            html += `
                <div class="accordion-item">
                    <h2 class="accordion-header" id="heading-${index}">
                        <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#collapse-${index}">
                            <strong>Batch ${item.BatchNumber}</strong> 
                            <span class="text-muted mx-2">(${new Date(item.CreatedAt).toLocaleDateString()})</span>
                            <span class="status-badge ${isCompleted ? 'status-completed' : 'status-pending'}">
                                ${isCompleted ? 'Completed' : 'Pending'}
                            </span>
                        </button>
                    </h2>
                    <div id="collapse-${index}" class="accordion-collapse collapse" data-bs-parent="#historyAccordion">
                        <div class="accordion-body">
                            <div class="history-key-stats">
                                <div class="test-result-item"><div class="test-result-item-label">Weight</div><div class="test-result-item-value">${f(item.Weight, 1, ' kg')}</div></div>
                                <div class="test-result-item"><div class="test-result-item-label">BMI</div><div class="test-result-item-value">${f(item.BMI, 1)}</div></div>
                                <div class="test-result-item"><div class="test-result-item-label">Grade</div><div class="test-result-item-value">${item.Grade || 'N/A'}</div></div>
                            </div>
                            <hr>
                            <h5>Nutrition Notes</h5>
                            <p class="history-comment">${c(item.NutritionNotes)}</p>
                            
                            <h5>Health / Issues Notes</h5>
                            <p class="history-comment">${c(item.HealthNotes)}</p>
                            
                            <h5>Recommendations</h5>
                            <p class="history-comment">${c(item.Recommendations)}</p>
                        </div>
                    </div>
                </div>
            `;
        });

        html += '</div>';
        historyContainer.innerHTML = html;
    }


    // --- 3. HANDLE FORM ACTIONS ---

    async function saveComment() {
        const nutritionNotes = form.elements.NutritionNotes.value.trim();
        const healthNotes = form.elements.HealthNotes.value.trim();
        const recommendations = form.elements.Recommendations.value.trim();

        if (!nutritionNotes || !healthNotes || !recommendations) {
            Swal.fire('Incomplete Form', 'Please fill out all three comment sections before saving.', 'warning');
            return false; 
        }

        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());

        try {
            const res = await fetch('/api/evaluation/save-comment', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Credentials': 'include' },
                body: JSON.stringify(data)
            });
            const result = await res.json();
            if (!res.ok) throw new Error(result.message);
            return true; 
        } catch (err) {
            Swal.fire('Save Failed', err.message, 'error');
            return false; 
        }
    }

    saveBtn.addEventListener('click', async () => {
        toggleButtonLoading(saveBtn, true);
        if (await saveComment()) {
            Swal.fire({
                toast: true,
                position: 'top-end',
                icon: 'success',
                title: 'Comment saved!',
                showConfirmButton: false,
                timer: 2000
            });
        }
        toggleButtonLoading(saveBtn, false);
    });

    saveAndNextBtn.addEventListener('click', async () => {
        toggleButtonLoading(saveAndNextBtn, true);
        if (await saveComment()) {
            const nextIndex = currentRecordIndex + 1;
            if (nextIndex < batchRecordList.length) {
                const nextTestLog = batchRecordList[nextIndex];
                window.location.href = `comment-entry.html?testlog=${nextTestLog}&batch=${currentBatchNum}`;
            } else {
                Swal.fire(
                    'Batch Complete!',
                    'You have finished evaluating all records in this batch.',
                    'success'
                ).then(() => {
                    window.location.href = 'evaluation.html';
                });
            }
        } else {
            toggleButtonLoading(saveAndNextBtn, false);
        }
    });
    
    function toggleButtonLoading(button, isLoading) {
        button.disabled = isLoading;
        const spinner = button.querySelector('.spinner-border');
        if (isLoading) {
            spinner.classList.remove('d-none');
            button.style.width = '180px'; 
        } else {
            spinner.classList.add('d-none');
            button.style.width = 'auto';
        }
    }

    // --- 4. START THE PAGE ---
    initializePage();
});