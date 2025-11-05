document.addEventListener('DOMContentLoaded', () => {

    // --- 1. GET DATA FROM URL & API ---
    let currentTestLog = null;
    let currentBatchID = null;
    let batchRecordList = []; 
    let currentRecordIndex = -1;

    // --- Get all DOM elements ---
    const pageTitle = document.getElementById('page-title');
    const pageBatchName = document.getElementById('page-batch-name');
    const anchorContainer = document.getElementById('student-info-anchor');
    const medicalContainer = document.getElementById('medical-history-content');
    const historyContainer = document.getElementById('historical-data-container'); 
    
    // Comment Form
    const commentForm = document.getElementById('commentEntryForm');
    const saveStrengthsBtn = document.getElementById('saveStrengthsBtn');
    const saveImprovementBtn = document.getElementById('saveImprovementBtn');
    const saveGuidelinesBtn = document.getElementById('saveGuidelinesBtn');
    
    // Goals Form
    const goalsForm = document.getElementById('goalsForm');
    const saveGoalsBtn = document.getElementById('saveGoalsBtn');
    
    // Navigation
    const continueNextBtn = document.getElementById('continueNextBtn');

    // Get username from header
    try {
        const user = JSON.parse(localStorage.getItem('staffUser'));
        if (user && user.Username) {
            document.getElementById('evaluator-username-display').textContent = `👤 ${user.Username}`;
        }
    } catch (e) { /* ignore */ }

    // Anti-flicker: Show body now that JS is running
    document.body.style.visibility = 'visible';

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

    // --- Main Initialization ---
    async function initializePage() {
        try {
            // Fetch batch list (for nav) and main data (for page)
            const [batchListData, recordData] = await Promise.all([
                fetchBatchList(currentBatchID),
                fetchRecordDetails(currentTestLog)
            ]);

            // 1. Set up Navigation
            batchRecordList = batchListData.map(record => record.TestLog);
            currentRecordIndex = batchRecordList.indexOf(parseInt(currentTestLog));
            if (currentRecordIndex === batchRecordList.length - 1) {
                continueNextBtn.innerHTML = 'Finish Batch & Return';
            }

            // 2. Populate all page sections
            const { currentRecord, currentComments, historicalRecords, medicalHistory } = recordData;
            
            // ★★★ REQ 5: Set Batch Name
            pageBatchName.textContent = currentRecord.BatchName;
            
            // ★★★ REQ 4: Set new Anchor Card
            populateAnchor(currentRecord);
            
            // ★★★ REQ 3: Set Medical History
            populateMedicalHistory(medicalHistory);

            // ★★★ REQ 1 & 2: Set Comments and Goals
            populateForm(currentComments); 
            
            // Set History Accordion
            populateHistory(historicalRecords); 

            document.getElementById('commentTestLog').value = currentTestLog;

        } catch (err) {
            console.error(err);
            document.body.innerHTML = `<h1>Error loading page data.</h1><p>${err.message}</p><a href="evaluation.html">Back to Dashboard</a>`;
        }
    }

    // --- API Fetchers ---
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

    // --- 2. POPULATE THE PAGE ---

    /**
     * ★★★ REQ 4: Populates the new grouped anchor card ★★★
     */
    function populateAnchor(record) {
        // Set top-level titles
        pageTitle.textContent = `${record.Name}`;
        document.getElementById('anchor-student-details').textContent = `TR: ${record.TR} | Test Date: ${new Date(record.CreatedAt).toLocaleDateString()}`;
        document.getElementById('anchor-student-name').textContent = record.Name;

        // Helper to format numbers
        const f = (val, dec = 1) => (val != null ? parseFloat(val).toFixed(dec) : 'N/A');
        
        // Helper to populate a stat item
        const setStat = (id, value, unit = '', cssClass = '') => {
            const el = document.getElementById(id);
            if (el) {
                const valueEl = el.querySelector('.test-result-item-value');
                valueEl.textContent = value;
                if (unit) {
                    valueEl.innerHTML += ` <span class="unit">${unit}</span>`;
                }
                if (cssClass) {
                    valueEl.className = `test-result-item-value ${cssClass}`;
                }
            }
        };

        // --- Populate Stats ---

        // Grade and Total Score
        const gradeClass = (record.Grade || '').replace('+', '-plus').toLowerCase();
        document.getElementById('anchor-grade-value').textContent = record.Grade || 'N/A';
        document.getElementById('anchor-grade-box').className = `anchor-grade grade-${gradeClass}`;
        
        document.getElementById('anchor-score-value').textContent = f(record.Total, 1) + '%';

        // Body Comp
        setStat('stat-Weight', f(record.Weight), 'kg');
        setStat('stat-Height', f(record.Height), 'cm');
        setStat('stat-Waist', f(record.Waist), 'cm');
        setStat('stat-Hips', f(record.Hips), 'cm');
        setStat('stat-Neck', f(record.Neck), 'cm');

        // BMI Metrics
        const statusClass = (record.BMIStatus || '').split(' ')[0].toLowerCase();
        setStat('stat-BMI', f(record.BMI), '', `status-${statusClass}`);
        
        // ★★★ FIX for NaN: Set BMIStatus as a direct string, not a number ★★★
        const bmiStatusEl = document.getElementById('stat-BMIStatus');
        if (bmiStatusEl) {
            const valueEl = bmiStatusEl.querySelector('.test-result-item-value');
            valueEl.textContent = record.BMIStatus; // Set as text
            valueEl.className = `test-result-item-value status-${statusClass}`;
        }

        // Metabolism & Fitness
        setStat('stat-BodyFat', f(record.BodyFat), '%');
        setStat('stat-BMR', f(record.BMR, 0), 'kcal');
        setStat('stat-VO2Max', f(record.VO2Max, 0), 'ml/kg');
    }
    
    /**
     * ★★★ REQ 3: Populates the new medical history card ★★★
     */
    function populateMedicalHistory(history) {
        if (!history) {
            medicalContainer.innerHTML = '<p class="text-muted">No medical history provided by the student.</p>';
            return;
        }
        
        const c = (val) => val || '<i class="text-muted">N/A</i>';
        
        medicalContainer.innerHTML = `
            <ul class="medical-history-list">
                <li><strong>Known Allergies:</strong> ${c(history.Allergies)}</li>
                <li><strong>Current Medications:</strong> ${c(history.Medications)}</li>
                <li><strong>Family History of Illness:</strong> ${c(history.FamilyHistory)}</li>
                <li><strong>Previous Injuries/Surgeries:</strong> ${c(history.PreviousInjuries)}</li>
            </ul>
        `;
    }

    /**
     * ★★★ REQ 1 & 2: Populates the renamed forms ★★★
     */
    function populateForm(comments) {
        // Clear old metadata
        document.getElementById('metaStrengths').innerHTML = '';
        document.getElementById('metaImprovement').innerHTML = '';
        document.getElementById('metaGuidelines').innerHTML = '';

        if (comments) {
            // Renamed Comment Fields
            commentForm.elements.Strengths.value = comments.Strengths || '';
            document.getElementById('metaStrengths').innerHTML = 
                formatMetaData(comments.StrengthsEvaluator, comments.StrengthsUpdatedAt);
            
            commentForm.elements.AreasOfImprovement.value = comments.AreasOfImprovement || '';
            document.getElementById('metaImprovement').innerHTML = 
                formatMetaData(comments.AreasOfImprovementEvaluator, comments.AreasOfImprovementUpdatedAt);

            commentForm.elements.NutritionalGuidelines.value = comments.NutritionalGuidelines || '';
            document.getElementById('metaGuidelines').innerHTML = 
                formatMetaData(comments.NutritionalGuidelinesEvaluator, comments.NutritionalGuidelinesUpdatedAt);
            
            // New Goal Fields
            goalsForm.elements.GoalShortTerm.value = comments.GoalShortTerm || '';
            goalsForm.elements.GoalLongTerm.value = comments.GoalLongTerm || '';
            goalsForm.elements.GoalTimeFrame.value = comments.GoalTimeFrame || '';
        }
    }

    /**
     * ★★★ REQ 1: Populates history with renamed columns ★★★
     */
    function populateHistory(historicalRecords) {
        if (!historicalRecords || historicalRecords.length === 0) {
            historyContainer.innerHTML = '<h4>No previous test history found.</h4>';
            return;
        }
        let html = `<h3 class="mb-3">Previous Evaluations (${historicalRecords.length})</h3><div class="accordion" id="historyAccordion">`;
        historicalRecords.forEach((item, index) => {
            const c = (val) => val || '<i class="text-muted">No comment.</i>';
            const isCompleted = item.Strengths && item.AreasOfImprovement && item.NutritionalGuidelines;
            const isPartial = item.Strengths || item.AreasOfImprovement || item.NutritionalGuidelines;
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
                            <h5>Strengths</h5>
                            <span class="comment-meta-data">${formatMetaData(item.StrengthsEvaluator, item.StrengthsUpdatedAt)}</span>
                            <p class="history-comment">${c(item.Strengths)}</p>
                            
                            <h5>Areas of Improvement</h5>
                            <span class="comment-meta-data">${formatMetaData(item.AreasOfImprovementEvaluator, item.AreasOfImprovementUpdatedAt)}</span>
                            <p class="history-comment">${c(item.AreasOfImprovement)}</p>
                            
                            <h5>Nutritional Guidelines</h5>
                            <span class="comment-meta-data">${formatMetaData(item.NutritionalGuidelinesEvaluator, item.NutritionalGuidelinesUpdatedAt)}</span>
                            <p class="history-comment">${c(item.NutritionalGuidelines)}</p>
                        </div>
                    </div>
                </div>`;
        });
        html += '</div>';
        historyContainer.innerHTML = html;
    }

    // --- 3. HANDLE FORM ACTIONS ---

    // Re-usable save function for atomic buttons
    async function handleAtomicSave(button, apiEndpoint, payload, metaElementId) {
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

            Swal.fire({
                toast: true, position: 'top-end', icon: 'success',
                title: 'Saved!', showConfirmButton: false, timer: 2000
            });
            
            document.getElementById(metaElementId).innerHTML = 
                formatMetaData(data.evaluator, data.updatedAt);

        } catch (err) {
            Swal.fire('Save Failed', err.message, 'error');
        } finally {
            button.disabled = false;
            spinner.classList.add('d-none');
            buttonText.textContent = 'Save';
        }
    }

    // ★★★ REQ 1: Listeners for renamed save buttons ★★★
    saveStrengthsBtn.addEventListener('click', () => {
        handleAtomicSave(
            saveStrengthsBtn,
            '/api/evaluation/save-strengths',
            { TestLog: currentTestLog, Strengths: commentForm.elements.Strengths.value },
            'metaStrengths'
        );
    });
    saveImprovementBtn.addEventListener('click', () => {
        handleAtomicSave(
            saveImprovementBtn,
            '/api/evaluation/save-improvement',
            { TestLog: currentTestLog, AreasOfImprovement: commentForm.elements.AreasOfImprovement.value },
            'metaImprovement'
        );
    });
    saveGuidelinesBtn.addEventListener('click', () => {
        handleAtomicSave(
            saveGuidelinesBtn,
            '/api/evaluation/save-guidelines',
            { TestLog: currentTestLog, NutritionalGuidelines: commentForm.elements.NutritionalGuidelines.value },
            'metaGuidelines'
        );
    });

    // ★★★ REQ 2: Listener for new Goals save button ★★★
    saveGoalsBtn.addEventListener('click', async () => {
        const button = saveGoalsBtn;
        const spinner = button.querySelector('.spinner-border');
        const buttonText = button.querySelector('.button-text');
        button.disabled = true;
        spinner.classList.remove('d-none');
        buttonText.textContent = 'Saving...';

        try {
            const payload = {
                TestLog: currentTestLog,
                GoalShortTerm: goalsForm.elements.GoalShortTerm.value,
                GoalLongTerm: goalsForm.elements.GoalLongTerm.value,
                GoalTimeFrame: goalsForm.elements.GoalTimeFrame.value
            };
            
            const res = await fetch('/api/evaluation/save-goals', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Credentials': 'include' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message);

            Swal.fire({
                toast: true, position: 'top-end', icon: 'success',
                title: 'Goals Saved!', showConfirmButton: false, timer: 2000
            });
        } catch (err) {
            Swal.fire('Save Failed', err.message, 'error');
        } finally {
            button.disabled = false;
            spinner.classList.add('d-none');
            buttonText.textContent = 'Save Goals';
        }
    });

    // --- Navigation (Unchanged) ---
    continueNextBtn.addEventListener('click', () => {
        const nextIndex = currentRecordIndex + 1;
        if (nextIndex < batchRecordList.length) {
            const nextTestLog = batchRecordList[nextIndex];
            window.location.href = `comment-entry.html?testlog=${nextTestLog}&batch=${currentBatchID}`;
        } else {
            window.location.href = 'evaluation.html';
        }
    });

    // --- 4. START THE PAGE ---
    initializePage();
});