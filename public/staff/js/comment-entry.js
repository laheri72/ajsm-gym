document.addEventListener('DOMContentLoaded', () => {

    // --- 1. GET DATA FROM URL & API ---
    let currentTestLog = null;
    let currentBatchID = null;
    let batchRecordList = []; 
    let currentRecordIndex = -1;

    const pageTitle = document.getElementById('page-title');
    const anchorContainer = document.getElementById('student-info-anchor');
    const historyContainer = document.getElementById('historical-data-container'); 
    const form = document.getElementById('commentEntryForm');
    const formCard = document.getElementById('comment-form-card');
    
    // ★★★ NEW: Button references ★★★
    const saveNutritionBtn = document.getElementById('saveNutritionBtn');
    const saveHealthBtn = document.getElementById('saveHealthBtn');
    const saveRecsBtn = document.getElementById('saveRecsBtn');
    const continueNextBtn = document.getElementById('continueNextBtn');

    // Get username from header
    try {
        const user = JSON.parse(localStorage.getItem('staffUser'));
        if (user && user.Username) {
            document.getElementById('evaluator-username-display').textContent = `👤 ${user.Username}`;
        }
    } catch (e) { /* ignore */ }

    const urlParams = new URLSearchParams(window.location.search);
    currentTestLog = urlParams.get('testlog');
    currentBatchID = urlParams.get('batch');

    if (!currentTestLog || !currentBatchID) {
        document.body.innerHTML = '<h1>Error: Missing TestLog or Batch information.</h1><a href="evaluation.html">Back to Dashboard</a>';
        return;
    }

    // --- Helper function to format author/timestamp ---
    function formatMetaData(evaluator, timestamp) {
        if (!evaluator) return '';
        const date = new Date(timestamp).toLocaleDateString();
        return `Last updated by <strong>${evaluator}</strong> on ${date}`;
    }

    async function initializePage() {
        try {
            const [batchListData, recordData] = await Promise.all([
                fetchBatchList(currentBatchID),
                fetchRecordDetails(currentTestLog)
            ]);

            batchRecordList = batchListData.map(record => record.TestLog);
            currentRecordIndex = batchRecordList.indexOf(parseInt(currentTestLog));
            
            if (currentRecordIndex === batchRecordList.length - 1) {
                continueNextBtn.innerHTML = 'Finish Batch & Return';
            }

            populateAnchor(recordData.currentRecord);
            populateForm(recordData.currentComments);
            populateHistory(recordData.historicalRecords); 

            document.getElementById('commentTestLog').value = currentTestLog;

        } catch (err) {
            console.error(err);
            anchorContainer.innerHTML = `<p class="text-danger">Error loading record: ${err.message}</p>`;
            historyContainer.innerHTML = '';
            formCard.classList.add('d-none');
        }
    }

    async function fetchBatchList(batchId) {
        const res = await fetch(`/api/evaluation/batch-details/${batchId}`, { credentials: 'include' });
        if (!res.ok) throw new Error('Could not fetch batch list.');
        const { data } = await res.json();
        return data; 
    }

    async function fetchRecordDetails(testLog) {
        const res = await fetch(`/api/evaluation/comment-details/${testLog}`, { credentials: 'include' });
        if (!res.ok) throw new Error('Could not fetch record details.');
        const data = await res.json();
        return data;
    }

    // --- 2. POPULATE THE PAGE --- (Unchanged)
    function populateAnchor(record) { /* ... (this function is unchanged) ... */ }
    function populateForm(comments) { /* ... (this function is unchanged) ... */ }
    function populateHistory(historicalRecords) { /* ... (this function is unchanged) ... */ }
    
    // (Pasting the unchanged functions here for completeness)
    function populateAnchor(record) {
        pageTitle.textContent = `Evaluating: ${record.Name} (TR: ${record.TR})`;
        const f = (val, dec = 1, unit = '') => (val != null ? `${parseFloat(val).toFixed(dec)}${unit}` : 'N/A');
        const statusClass = (record.BMIStatus || '').split(' ')[0].toLowerCase();
        const gradeClass = (record.Grade || '').replace('+', '-plus').toLowerCase();
        anchorContainer.innerHTML = `
            <div class="anchor-header">
                <div class="anchor-title"><h4>${record.Name}</h4><p class="text-muted">TR: ${record.TR} | Test Date: ${new Date(record.CreatedAt).toLocaleDateString()}</p></div>
                <div class="anchor-grade ${'grade-' + gradeClass}"><span>Grade</span><strong>${record.Grade || 'N/A'}</strong></div>
            </div>
            <div class="test-results-grid full-grid">
                <div class="test-result-item"><div class="test-result-item-label">Weight</div><div class="test-result-item-value">${f(record.Weight, 1, ' kg')}</div></div>
                <div class="test-result-item"><div class="test-result-item-label">Height</div><div class="test-result-item-value">${f(record.Height, 1, ' cm')}</div></div>
                <div class="test-result-item"><div class="test-result-item-label">Waist</div><div class="test-result-item-value">${f(record.Waist, 1, ' cm')}</div></div>
                <div class="test-result-item"><div class="test-result-item-label">Hips</div><div class="test-result-item-value">${f(record.Hips, 1, ' cm')}</div></div>
                <div class="test-result-item"><div class="test-result-item-label">Neck</div><div class="test-result-item-value">${f(record.Neck, 1, ' cm')}</div></div>
                <div class="test-result-item"><div class="test-result-item-label">BMI</div><div class="test-result-item-value ${'status-' + statusClass}">${f(record.BMI, 1)}</div></div>
                <div class="test-result-item"><div class="test-result-item-label">BMI Status</div><div class="test-result-item-value ${'status-' + statusClass}">${record.BMIStatus}</div></div>
                <div class="test-result-item"><div class="test-result-item-label">Body Fat</div><div class="test-result-item-value">${f(record.BodyFat, 1, '%')}</div></div>
                <div class="test-result-item"><div class="test-result-item-label">BMR</div><div class="test-result-item-value">${f(record.BMR, 0, ' kcal')}</div></div>
                <div class="test-result-item"><div class="test-result-item-label">Calorie Intake</div><div class="test-result-item-value">${f(record.CalorieIntake, 0, ' kcal')}</div></div>
                <div class="test-result-item"><div class="test-result-item-label">VO₂ Max</div><div class="test-result-item-value">${f(record.VO2Max, 0)}</div></div>
                <div class="test-result-item"><div class="test-result-item-label">Total Score</div><div class="test-result-item-value">${f(record.Total, 0)}</div></div>
            </div>`;
    }
    function populateForm(comments) {
        document.getElementById('metaNutrition').innerHTML = '';
        document.getElementById('metaHealth').innerHTML = '';
        document.getElementById('metaRecommendations').innerHTML = '';
        if (comments) {
            form.elements.NutritionNotes.value = comments.NutritionNotes || '';
            document.getElementById('metaNutrition').innerHTML = formatMetaData(comments.NutritionEvaluator, comments.NutritionUpdatedAt);
            form.elements.HealthNotes.value = comments.HealthNotes || '';
            document.getElementById('metaHealth').innerHTML = formatMetaData(comments.HealthEvaluator, comments.HealthUpdatedAt);
            form.elements.Recommendations.value = comments.Recommendations || '';
            document.getElementById('metaRecommendations').innerHTML = formatMetaData(comments.RecommendationEvaluator, comments.RecommendationUpdatedAt);
        }
    }
    function populateHistory(historicalRecords) {
        if (!historicalRecords || historicalRecords.length === 0) {
            historyContainer.innerHTML = '<h4 class="text-muted">No previous test history found for this student.</h4>';
            return;
        }
        let html = `<h3 class="mb-3">Previous Evaluations (${historicalRecords.length})</h3><div class="accordion" id="historyAccordion">`;
        historicalRecords.forEach((item, index) => {
            const c = (val) => val || '<i class="text-muted">No comment.</i>';
            const isCompleted = item.NutritionNotes && item.HealthNotes && item.Recommendations;
            const isPartial = item.NutritionNotes || item.HealthNotes || item.Recommendations;
            let status = 'Pending';
            let statusClass = 'status-pending';
            if (isCompleted) { status = 'Completed'; statusClass = 'status-completed'; } 
            else if (isPartial) { status = 'Partial'; statusClass = 'status-partial'; }
            const gradeClass = (item.Grade || '').replace('+', '-plus').toLowerCase();
            html += `
                <div class="accordion-item">
                    <h2 class="accordion-header" id="heading-${index}">
                        <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#collapse-${index}">
                            <strong>${item.BatchName}</strong> 
                            <span class="text-muted mx-2">(${new Date(item.CreatedAt).toLocaleDateString()})</span>
                            <span class="status-badge ${statusClass}">${status}</span>
                        </button>
                    </h2>
                    <div id="collapse-${index}" class="accordion-collapse collapse" data-bs-parent="#historyAccordion">
                        <div class="accordion-body">
                            <div class="history-key-stats">
                                <div class="test-result-item"><div class="test-result-item-label">Weight</div><div class="test-result-item-value">${(item.Weight || 0).toFixed(1)} kg</div></div>
                                <div class="test-result-item"><div class="test-result-item-label">BMI</div><div class="test-result-item-value">${(item.BMI || 0).toFixed(1)}</div></div>
                                <div class="test-result-item"><div class="test-result-item-label">Grade</div><div class="test-result-item-value ${'grade-' + gradeClass}">${item.Grade || 'N/A'}</div></div>
                            </div>
                            <hr>
                            <h5>Nutrition Notes</h5>
                            <span class="comment-meta-data">${formatMetaData(item.NutritionEvaluator, item.NutritionUpdatedAt)}</span>
                            <p class="history-comment">${c(item.NutritionNotes)}</p>
                            <h5>Health / Issues Notes</h5>
                            <span class="comment-meta-data">${formatMetaData(item.HealthEvaluator, item.HealthUpdatedAt)}</span>
                            <p class="history-comment">${c(item.HealthNotes)}</p>
                            <h5>Recommendations</h5>
                            <span class="comment-meta-data">${formatMetaData(item.RecommendationEvaluator, item.RecommendationUpdatedAt)}</span>
                            <p class="history-comment">${c(item.Recommendations)}</p>
                        </div>
                    </div>
                </div>`;
        });
        html += '</div>';
        historyContainer.innerHTML = html;
    }

    // --- 3. ★★★ NEW: HANDLE FORM ACTIONS ★★★ ---

    /**
     * Re-usable save function for the new atomic buttons
     */
    async function handleAtomicSave(button, apiEndpoint, payload, metaElementId) {
        // 1. Show loader
        const spinner = button.querySelector('.spinner-border');
        const buttonText = button.querySelector('.button-text');
        button.disabled = true;
        spinner.classList.remove('d-none');
        buttonText.textContent = 'Saving...';

        try {
            const res = await fetch(apiEndpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Credentials': 'include' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message);

            // 2. Show success toast
            Swal.fire({
                toast: true,
                position: 'top-end',
                icon: 'success',
                title: 'Saved!',
                showConfirmButton: false,
                timer: 2000
            });

            // 3. Update the metadata in real-time
            document.getElementById(metaElementId).innerHTML = 
                formatMetaData(data.evaluator, data.updatedAt);

        } catch (err) {
            Swal.fire('Save Failed', err.message, 'error');
        } finally {
            // 4. Hide loader
            button.disabled = false;
            spinner.classList.add('d-none');
            buttonText.textContent = 'Save';
        }
    }

    // --- Add listeners for the 3 new save buttons ---
    
    saveNutritionBtn.addEventListener('click', () => {
        handleAtomicSave(
            saveNutritionBtn,
            '/api/evaluation/save-nutrition',
            {
                TestLog: currentTestLog,
                NutritionNotes: form.elements.NutritionNotes.value
            },
            'metaNutrition'
        );
    });

    saveHealthBtn.addEventListener('click', () => {
        handleAtomicSave(
            saveHealthBtn,
            '/api/evaluation/save-health',
            {
                TestLog: currentTestLog,
                HealthNotes: form.elements.HealthNotes.value
            },
            'metaHealth'
        );
    });

    saveRecsBtn.addEventListener('click', () => {
        handleAtomicSave(
            saveRecsBtn,
            '/api/evaluation/save-recommendation',
            {
                TestLog: currentTestLog,
                Recommendations: form.elements.Recommendations.value
            },
            'metaRecommendations'
        );
    });

    // --- Add listener for the new "Continue" button ---
    
    continueNextBtn.addEventListener('click', () => {
        const nextIndex = currentRecordIndex + 1;
        if (nextIndex < batchRecordList.length) {
            // Go to the next record
            const nextTestLog = batchRecordList[nextIndex];
            window.location.href = `comment-entry.html?testlog=${nextTestLog}&batch=${currentBatchID}`;
        } else {
            // This was the last record, go back to dashboard
            window.location.href = 'evaluation.html';
        }
    });

    // --- 4. START THE PAGE ---
    initializePage();
});