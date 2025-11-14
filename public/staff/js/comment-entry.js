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
    
    // Comment Form & List
    const commentForm = document.getElementById('commentEntryForm');
    const saveCommentBtn = document.getElementById('saveCommentBtn');
    const commentCategorySelect = document.getElementById('commentCategory');
    const commentText = document.getElementById('commentText');
    // ★★★ This is our new history section ★★★
    const historyContainer = document.getElementById('student-comment-history'); 
    
    // Navigation
    const continueNextBtn = document.getElementById('continueNextBtn');
    
    // Get username
    try {
        const user = JSON.parse(localStorage.getItem('staffUser'));
        if (user && user.Username) {
            document.getElementById('evaluator-username-display').textContent = `👤 ${user.Username}`;
        }
    } catch (e) { /* ignore */ }

    document.body.style.visibility = 'visible';

    const urlParams = new URLSearchParams(window.location.search);
    currentTestLog = urlParams.get('testlog');
    currentBatchID = urlParams.get('batch');

    if (!currentTestLog || !currentBatchID) {
        document.body.innerHTML = '<h1>Error: Missing TestLog or Batch information.</h1><a href="evaluation.html">Back to Dashboard</a>';
        return;
    }

    // --- Helper function ---
    function formatMetaData(evaluator, profession, timestamp) {
        if (!evaluator) return '';
        const date = new Date(timestamp).toLocaleDateString();
        return `by <strong>${evaluator}</strong> (${profession || 'Evaluator'}) on ${date}`;
    }

    // --- Main Initialization ---
    async function initializePage() {
        try {
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
            const { currentRecord, medicalHistory, commentCategories, existingComments } = recordData;
            
            pageBatchName.textContent = currentRecord.BatchName;
            populateAnchor(currentRecord);
            populateMedicalHistory(medicalHistory);
            populateCategoryDropdown(commentCategories);

            // ★★★ Call the new, powerful render function ★★★
            renderStudentCommentHistory(existingComments); 
            
            document.getElementById('commentTestLog').value = currentTestLog;

        } catch (err) {
            console.error(err);
            document.body.innerHTML = `<h1>Error loading page data.</h1><p>${err.message}</p><a href="evaluation.html">Back to Dashboard</a>`;
        }
    }

    // --- API Fetchers (Unchanged) ---
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

    
    // (Pasting the unchanged functions for completeness)
    function populateAnchor(record) {
        pageTitle.textContent = `${record.Name}`;
        document.getElementById('anchor-student-details').textContent = `TR: ${record.TR} | Test Date: ${new Date(record.CreatedAt).toLocaleDateString()}`;
        document.getElementById('anchor-student-name').textContent = record.Name;
        const f = (val, dec = 1) => (val != null ? parseFloat(val).toFixed(dec) : 'N/A');
        const setStat = (id, value, unit = '', cssClass = '') => {
            const el = document.getElementById(id);
            if (el) {
                const valueEl = el.querySelector('.test-result-item-value');
                valueEl.textContent = value;
                if (unit) { valueEl.innerHTML += ` <span class="unit">${unit}</span>`; }
                if (cssClass) { valueEl.className = `test-result-item-value ${cssClass}`; }
            }
        };
        const gradeClass = (record.Grade || '').replace('+', '-plus').toLowerCase();
        document.getElementById('anchor-grade-value').textContent = record.Grade || 'N/A';
        document.getElementById('anchor-grade-box').className = `anchor-grade grade-${gradeClass}`;
        document.getElementById('anchor-score-value').textContent = f(record.Total, 1) + '%';
        setStat('stat-Weight', f(record.Weight), 'kg');
        setStat('stat-Height', f(record.Height), 'cm');
        setStat('stat-Waist', f(record.Waist), 'cm');
        setStat('stat-Hips', f(record.Hips), 'cm');
        setStat('stat-Neck', f(record.Neck), 'cm');
        const statusClass = (record.BMIStatus || '').split(' ')[0].toLowerCase();
        setStat('stat-BMI', f(record.BMI), '', `status-${statusClass}`);
        const bmiStatusEl = document.getElementById('stat-BMIStatus');
        if (bmiStatusEl) {
            const valueEl = bmiStatusEl.querySelector('.test-result-item-value');
            valueEl.textContent = record.BMIStatus;
            valueEl.className = `test-result-item-value status-${statusClass}`;
        }
        setStat('stat-BodyFat', f(record.BodyFat), '%');
        setStat('stat-BMR', f(record.BMR, 0), 'kcal');
        setStat('stat-VO2Max', f(record.VO2Max, 0), 'ml/kg');
        // --- New Activity Metrics ---
        setStat('stat-PushUps', f(record.PushUps, 0));
        setStat('stat-SitUps', f(record.SitUps, 0));
        setStat('stat-Squats', f(record.Squats, 0));
        setStat('stat-SitAndReach', f(record.SitAndReach, 0), 'cm');
        setStat('stat-StepUpPulseRate', f(record.StepUpPulseRate, 0), 'bpm');

    }
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
    function populateCategoryDropdown(categories) {
        commentCategorySelect.innerHTML = '<option value="">Select a category...</option>';
        if (categories && categories.length > 0) {
            categories.forEach(cat => {
                commentCategorySelect.innerHTML += `<option value="${cat.CategoryID}">${cat.CategoryName}</option>`;
            });
        }
    }

    /**
     * ★★★ NEW: Renders the student's *entire* comment history, grouped by category ★★★
     */
    function renderStudentCommentHistory(comments) {
        // Find the correct container (we renamed it in the HTML)
        const container = document.getElementById('student-comment-history');
        if (!container) return;

        // 1. Check if there are any comments
        if (!comments || comments.length === 0) {
            container.innerHTML = '<h5 class="mb-3">Student Evaluation History</h5><p class="text-muted">No comments have been submitted for this student yet.</p>';
            return;
        }

        // 2. Group all comments by CategoryName
        const commentsByCategory = comments.reduce((acc, comment) => {
            const category = comment.CategoryName;
            if (!acc[category]) {
                acc[category] = [];
            }
            acc[category].push(comment);
            return acc;
        }, {});

        // 3. Build the Accordion
        let html = `
            <h5 class="mb-3">Student Comment History</h5>
            <div class="accordion" id="studentHistoryAccordion">
        `;

        // 4. Loop through the grouped categories (e.g., "Strengths", "Nutritional Guidelines")
        let index = 0;
        for (const categoryName in commentsByCategory) {
            const commentsInThisCategory = commentsByCategory[categoryName];
            
            html += `
                <div class="accordion-item">
                    <h2 class="accordion-header" id="heading-${index}">
                        <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#collapse-${index}">
                            ${categoryName} 
                            <span class="badge bg-secondary ms-2">${commentsInThisCategory.length}</span>
                        </button>
                    </h2>
                    <div id="collapse-${index}" class="accordion-collapse collapse" data-bs-parent="#studentHistoryAccordion">
                        <div class="accordion-body">
                            `;

            // 5. Loop through the individual comments
            commentsInThisCategory.forEach(comment => {
                const c = (val) => val ? val.replace(/\n/g, '<br>') : '<i class="text-muted">No comment.</i>';
                html += `
                    <div class="comment-card-history">
                        <div class="comment-header">
                            <span class="comment-category">${comment.BatchName}</span>
                            <span class="comment-meta-data">
                                ${formatMetaData(comment.EvaluatorName, comment.Profession, comment.DateEvaluated)}
                            </span>
                        </div>
                        <p class="comment-body">${c(comment.CommentText)}</p>
                    </div>
                `;
            });

            html += `
                        </div>
                    </div>
                </div>
            `;
            index++;
        }

        html += '</div>'; // Close accordion
        container.innerHTML = html;
    }

    // --- 3. HANDLE FORM ACTIONS ---

    /**
     * ★★★ UPDATED: Save Comment Logic ★★★
     * (Now refreshes the new history list on success)
     */
    saveCommentBtn.addEventListener('click', async () => {
        const payload = {
            LogID: currentTestLog,
            CategoryID: commentCategorySelect.value,
            CommentText: commentText.value.trim(),
        };

        if (!payload.CategoryID || !payload.CommentText) {
            return Swal.fire('Missing Fields', 'Please select a category and write a comment.', 'warning');
        }

        const button = saveCommentBtn;
        const spinner = button.querySelector('.spinner-border');
        const buttonText = button.querySelector('.button-text');
        button.disabled = true;
        spinner.classList.remove('d-none');
        buttonText.textContent = 'Submitting...';

        try {
            const res = await fetch('/api/evaluation/save-comment', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Credentials': 'include' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message);

            Swal.fire({
                toast: true, position: 'top-end', icon: 'success',
                title: 'Comment Submitted!', showConfirmButton: false, timer: 2000
            });
            
            commentForm.reset();
            
            // ★★★ Refresh the new history list ★★★
            // The API returns the fresh, full list of all comments for the TR
            renderStudentCommentHistory(data.newComments);

        } catch (err) {
            Swal.fire('Save Failed', err.message, 'error');
        } finally {
            button.disabled = false;
            spinner.classList.add('d-none');
            buttonText.textContent = 'Submit Comment';
        }
    });

    /**
     * ★★★ DELETED ★★★
     * All atomic save listeners and goal save listeners are GONE.
     * The delete listener is also GONE (as requested).
     */

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