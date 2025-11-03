document.addEventListener('DOMContentLoaded', () => {

    // --- 1. GET DATA FROM URL & API ---

    // Global state for this page
    let currentTestLog = null;
    let currentBatchNum = null;
    let batchRecordList = []; // This will hold the list of all TestLogs in the batch
    let currentRecordIndex = -1;

    // Get DOM elements
    const pageTitle = document.getElementById('page-title');
    const anchorContainer = document.getElementById('student-info-anchor');
    const form = document.getElementById('commentEntryForm');
    const formCard = document.getElementById('comment-form-card');
    const saveBtn = document.getElementById('saveBtn');
    const saveAndNextBtn = document.getElementById('saveAndNextBtn');

    // Helper to parse URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    currentTestLog = urlParams.get('testlog');
    currentBatchNum = urlParams.get('batch');

    if (!currentTestLog || !currentBatchNum) {
        document.body.innerHTML = '<h1>Error: Missing TestLog or Batch information.</h1><a href="evaluation.html">Back to Dashboard</a>';
        return;
    }

    /**
     * This function runs on page load.
     * It fetches BOTH the full batch list (for navigation)
     * AND the specific record to be edited.
     */
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
            
            // Update "Save & Next" button text
            if (currentRecordIndex === batchRecordList.length - 1) {
                saveAndNextBtn.textContent = 'Save & Finish Batch';
            }

            // --- B. Process Specific Record (to fill the page) ---
            populateAnchor(recordData.record);
            populateForm(recordData.comments);

            // Set hidden TestLog value in the form
            document.getElementById('commentTestLog').value = currentTestLog;

        } catch (err) {
            console.error(err);
            anchorContainer.innerHTML = `<p class="text-danger">Error loading record: ${err.message}</p>`;
            formCard.classList.add('d-none'); // Hide form on error
        }
    }

    // API Helper 1: Get the list of all TestLogs in this batch
    async function fetchBatchList(batchNum) {
        const res = await fetch(`/api/evaluation/batch-details/${batchNum}`, { credentials: 'include' });
        if (!res.ok) throw new Error('Could not fetch batch list.');
        const { data } = await res.json();
        return data; // Returns the array of records
    }

    // API Helper 2: Get the full details for the current TestLog
    async function fetchRecordDetails(testLog) {
        const res = await fetch(`/api/evaluation/comment-details/${testLog}`, { credentials: 'include' });
        if (!res.ok) throw new Error('Could not fetch record details.');
        const data = await res.json();
        return data; // Returns { record: {...}, comments: {...} }
    }

    // --- 2. POPULATE THE PAGE ---

/**
     * (★★★ UPDATED FOR TWEAK 3 ★★★)
     * Fills the anchor card with all 13 test record fields.
     */
    function populateAnchor(record) {
        pageTitle.textContent = `Evaluating: ${record.Name} (TR: ${record.TR})`;
        
        // Helper to format values
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
                
                <div class="test-result-item"><div class="test-result-item-label">BMI</div><div class="test-result-item-value ${'status-' + record.BMIStatus.split(' ')[0].toLowerCase()}">${f(record.BMI, 1)}</div></div>
                <div class="test-result-item"><div class="test-result-item-label">BMI Status</div><div class="test-result-item-value ${'status-' + record.BMIStatus.split(' ')[0].toLowerCase()}">${record.BMIStatus}</div></div>
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

    // --- 3. HANDLE FORM ACTIONS ---

// --- 3. HANDLE FORM ACTIONS ---

    /**
     * Re-usable save function
     * (★★★ UPDATED FOR TWEAK 1: Added validation ★★★)
     */
    async function saveComment() {
        // 1. Check for empty fields
        const nutritionNotes = form.elements.NutritionNotes.value.trim();
        const healthNotes = form.elements.HealthNotes.value.trim();
        const recommendations = form.elements.Recommendations.value.trim();

        if (!nutritionNotes || !healthNotes || !recommendations) {
            Swal.fire('Incomplete Form', 'Please fill out all three comment sections before saving.', 'warning');
            return false; // Indicate save failure
        }

        // 2. If valid, proceed with saving
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
            return true; // Indicate save success

        } catch (err) {
            Swal.fire('Save Failed', err.message, 'error');
            return false; // Indicate save failure
        }
    }

    // "Save and Stay" button click
    saveBtn.addEventListener('click', async () => {
        toggleButtonLoading(saveBtn, true);
        
        // Check if save was successful
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

    // "Save & Continue" button click
    saveAndNextBtn.addEventListener('click', async () => {
        toggleButtonLoading(saveAndNextBtn, true);
        
        // Check if save was successful
        if (await saveComment()) {
            // Save was successful, find the next record
            const nextIndex = currentRecordIndex + 1;
            if (nextIndex < batchRecordList.length) {
                // There is a next record, redirect to it
                const nextTestLog = batchRecordList[nextIndex];
                window.location.href = `comment-entry.html?testlog=${nextTestLog}&batch=${currentBatchNum}`;
            } else {
                // This was the last record
                Swal.fire(
                    'Batch Complete!',
                    'You have finished evaluating all records in this batch.',
                    'success'
                ).then(() => {
                    window.location.href = 'evaluation.html'; // Go back to dashboard
                });
            }
        } else {
            // Save failed (due to validation or error), stop loading spinner
            toggleButtonLoading(saveAndNextBtn, false);
        }
    });
    
    // Helper to show/hide spinner in buttons
    function toggleButtonLoading(button, isLoading) {
        button.disabled = isLoading;
        const spinner = button.querySelector('.spinner-border');
        if (isLoading) {
            spinner.classList.remove('d-none');
            button.style.width = '180px'; // Prevent layout shift
        } else {
            spinner.classList.add('d-none');
            button.style.width = 'auto';
        }
    }
    // --- 4. START THE PAGE ---
    initializePage();
});