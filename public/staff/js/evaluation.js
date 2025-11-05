document.addEventListener('DOMContentLoaded', () => {

    // --- Chart variables ---
    let bmiOverTimeChart = null, bmiStatusChart = null;
    const primaryColor = getComputedStyle(document.documentElement).getPropertyValue('--primary').trim() || '#4CAF50';
    const dangerColor = getComputedStyle(document.documentElement).getPropertyValue('--danger').trim() || '#f44336';
    const warningColor = getComputedStyle(document.documentElement).getPropertyValue('--warning').trim() || '#f39c12';
    const blueColor = '#0d6efd';

    // --- Modal & Table variables ---
    let batchDetailsModal = null, studentHistoryModal = null;
    let batchDetailsDataTable = null;
    let currentBatchID = null, currentBatchName = null; 

    // --- Search variables ---
    const searchInput = document.getElementById('studentSearchInput');
    const searchResultsContainer = document.getElementById('studentSearchResults');
    let searchTimeout = null;
    
    // Populate Username
    try {
        const user = JSON.parse(localStorage.getItem('staffUser'));
        if (user && user.Username) {
            document.getElementById('evaluator-username-display').textContent = `👤 ${user.Username}`;
        }
    } catch (e) { /* ignore */ }

    // --- ★★★ NEW HELPER FUNCTION (from comment-entry.js) ★★★ ---
    function formatMetaData(evaluator, timestamp) {
        if (!evaluator) return '';
        const date = new Date(timestamp).toLocaleDateString();
        return `Last updated by <strong>${evaluator}</strong> on ${date}`;
    }

    // (Unchanged functions: loadStatistics, loadBatchCards, initializeBatchDetailsTable, openBatchDetailsModal, chart functions)
    async function loadStatistics() { /* ... (this function is unchanged) ... */ }
    async function loadBatchCards() { /* ... (this function is unchanged) ... */ }
    function initializeBatchDetailsTable() { /* ... (this function is unchanged) ... */ }
    function openBatchDetailsModal(batchId, batchName) { /* ... (this function is unchanged) ... */ }
    function drawBmiOverTimeChart(lineChartData) { /* ... (unchanged) ... */ }
    function drawBmiStatusChart(BmiStatusDistribution) { /* ... (unchanged) ... */ }
    
    // (Pasting the unchanged functions for completeness)
    async function loadStatistics() {
        try {
            const res = await fetch('/api/evaluation/statistics', { credentials: 'include' });
            if (!res.ok) throw new Error('Failed to load statistics');
            const { data } = await res.json();
            const { latestBatchStats, lineChartData } = data;
            document.getElementById('stat-avg-bmi').textContent = latestBatchStats.AvgBMI ? latestBatchStats.AvgBMI.toFixed(1) : 'N/A';
            document.getElementById('stat-avg-bodyfat').textContent = latestBatchStats.AvgBodyFat ? `${latestBatchStats.AvgBodyFat.toFixed(1)}%` : 'N/A';
            document.getElementById('stat-common-grade').textContent = latestBatchStats.MostCommonGrade || 'N/A';
            drawBmiOverTimeChart(lineChartData);
            drawBmiStatusChart(latestBatchStats.BmiStatusDistribution);
        } catch (err) {
            console.error('Error loading statistics:', err);
            document.getElementById('statistics-overview').innerHTML = `<p class="text-danger">Could not load statistics.</p>`;
        }
    }
    async function loadBatchCards() {
        const container = document.getElementById('batch-cards-container');
        try {
            const res = await fetch('/api/evaluation/batches', { credentials: 'include' });
            if (!res.ok) { if (res.status === 403) throw new Error('Access Denied.'); throw new Error('Failed to fetch evaluation batches.'); }
            const { data } = await res.json();
            if (data.length === 0) { container.innerHTML = '<p>No test records found to evaluate.</p>'; return; }
            container.innerHTML = ''; 
            data.forEach(batch => {
                const card = document.createElement('div');
                card.className = 'batch-card';
                const batchId = batch.BatchID === null ? 'null' : batch.BatchID;
                card.dataset.batchId = batchId; 
                card.dataset.batchName = batch.BatchName;
                let statusText = '';
                if (batch.BatchID === null) { statusText = 'Unassigned'; }
                else if (batch.IsActive) { statusText = '<span class="status-badge status-active">Active</span>'; }
                else { statusText = '<span class="status-badge status-inactive">Locked</span>'; }
                card.innerHTML = `
                    <div class="batch-card-number">${batch.BatchName}</div>
                    <div class="batch-card-count">${batch.TotalCount}</div>
                    <div class="batch-card-label">Total Records</div>
                    <div class="batch-card-status">${statusText}</div>
                    <div class="batch-card-stats">
                        <span class="stat-pending">Pending: ${batch.PendingCount}</span>
                        <span class="stat-partial">Partial: ${batch.PartialCount}</span>
                        <span class="stat-completed">Completed: ${batch.CompletedCount}</span>
                    </div>
                `;
                if (batch.TotalCount > 0) {
                    card.addEventListener('click', () => { openBatchDetailsModal(batchId, batch.BatchName); });
                } else { card.classList.add('disabled'); }
                container.appendChild(card);
            });
        } catch (err) {
            console.error('Error loading batch cards:', err);
            container.innerHTML = `<p class="text-danger">${err.message}</p>`;
        }
    }
    function initializeBatchDetailsTable() {
        if (batchDetailsDataTable) return;
        batchDetailsDataTable = $('#batch-details-table').DataTable({
            processing: true, 
            ajax: { url: '/api/evaluation/batch-details/0', credentials: 'include', dataSrc: 'data' },
            language: { processing: '<div class="loader-cell"><div class="loader"></div></div>', emptyTable: "No records found for this batch." },
            columns: [
                { data: 'CommentStatus', render: (data) => {
                    let statusClass = 'status-pending';
                    if (data === 'Completed') { statusClass = 'status-completed'; } 
                    else if (data === 'Partial Pending') { statusClass = 'status-partial'; }
                    return `<span class="status-badge ${statusClass}">${data}</span>`;
                }},
                { data: 'TR' }, { data: 'Name' }, { data: 'Grade' },
                { data: 'CreatedAt', render: (data) => new Date(data).toLocaleDateString() },
                { data: 'TestLog', className: 'd-none' } 
            ],
            order: [[0, 'asc'], [4, 'desc']], 
            responsive: true, pageLength: 25,
            createdRow: (row, data) => {
                if (data.CommentStatus === 'Pending') { $(row).addClass('row-pending'); } 
                else if (data.CommentStatus === 'Partial Pending') { $(row).addClass('row-partial'); } 
                else { $(row).addClass('row-completed'); }
            }
        });
        $('#batch-details-table tbody').on('click', 'tr', function () {
            const rowData = batchDetailsDataTable.row(this).data();
            if (rowData) {
                const testLog = rowData.TestLog;
                if (currentBatchID !== null) {
                    window.location.href = `comment-entry.html?testlog=${testLog}&batch=${currentBatchID}`;
                } else { Swal.fire('Error', 'Could not determine batch ID. Please close this modal and try again.', 'error'); }
            }
        });
    }
    function openBatchDetailsModal(batchId, batchName) {
        if (!batchDetailsModal) { batchDetailsModal = new bootstrap.Modal(document.getElementById('batchDetailsModal')); }
        currentBatchID = batchId; 
        currentBatchName = batchName;
        document.getElementById('batchDetailsModalLabel').textContent = `Review: ${batchName}`;
        if (batchDetailsDataTable) {
            const newUrl = `/api/evaluation/batch-details/${batchId}`;
            batchDetailsDataTable.ajax.url(newUrl).load(); 
        }
        batchDetailsModal.show();
    }
    function drawBmiOverTimeChart(lineChartData) {
        const ctx = document.getElementById('bmiOverTimeChart'); if (!ctx) return;
        if (bmiOverTimeChart) { bmiOverTimeChart.destroy(); }
        const labels = lineChartData.map(d => d.BatchName);
        const bmiData = lineChartData.map(d => d.AvgBMI ? d.AvgBMI.toFixed(1) : null);
        bmiOverTimeChart = new Chart(ctx, {
            type: 'line', data: { labels: labels, datasets: [{ label: 'Average BMI', data: bmiData, backgroundColor: 'rgba(76, 175, 80, 0.1)', borderColor: primaryColor, borderWidth: 3, fill: true, tension: 0.1 }] },
            options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: false } }, plugins: { legend: { display: false } } }
        });
    }
    function drawBmiStatusChart(BmiStatusDistribution) {
        const ctx = document.getElementById('bmiStatusChart'); if (!ctx) return;
        if (bmiStatusChart) { bmiStatusChart.destroy(); }
        const labels = BmiStatusDistribution.map(d => d.BMIStatus);
        const data = BmiStatusDistribution.map(d => d.StatusCount);
        const colorMap = { 'Normal': primaryColor, 'Overweight': warningColor, 'Obese': dangerColor, 'Obese II': '#a93226', 'Underweight': blueColor, 'Severely Underweight': '#2471a3', };
        const backgroundColors = labels.map(label => colorMap[label] || '#ccc');
        bmiStatusChart = new Chart(ctx, {
            type: 'doughnut', data: { labels: labels, datasets: [{ label: 'BMI Status', data: data, backgroundColor: backgroundColors, }] },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', } } }
        });
    }

    // --- STUDENT SEARCH LOGIC (Unchanged) ---
    searchInput.addEventListener('input', () => {
        clearTimeout(searchTimeout); 
        const query = searchInput.value;
        if (query.length < 2) { searchResultsContainer.style.display = 'none'; return; }
        searchTimeout = setTimeout(async () => {
            try {
                const res = await fetch(`/api/evaluation/search-student?q=${encodeURIComponent(query)}`, { credentials: 'include' });
                if (!res.ok) throw new Error('Search failed');
                const { data } = await res.json();
                renderSearchResults(data);
            } catch (err) {
                console.error(err);
                searchResultsContainer.innerHTML = '<div class="search-result-item">Error searching.</div>';
                searchResultsContainer.style.display = 'block';
            }
        }, 300);
    });
    function renderSearchResults(results) {
        if (results.length === 0) {
            searchResultsContainer.innerHTML = '<div class="search-result-item">No students found.</div>';
        } else {
            searchResultsContainer.innerHTML = results.map(student => `
                <div class="search-result-item" data-tr="${student.TR}" data-name="${student.Name}">
                    <strong>${student.Name}</strong> (TR: ${student.TR})
                </div>
            `).join('');
        }
        searchResultsContainer.style.display = 'block';
    }
    searchResultsContainer.addEventListener('click', (e) => {
        const item = e.target.closest('.search-result-item');
        if (item && item.dataset.tr) {
            const tr = item.dataset.tr;
            searchResultsContainer.style.display = 'none';
            searchInput.value = '';
            openStudentHistoryModal(tr); // ★★★ Name is no longer needed
        }
    });
    document.addEventListener('click', (e) => {
        if (!searchInput.contains(e.target) && !searchResultsContainer.contains(e.target)) {
            searchResultsContainer.style.display = 'none';
        }
    });
    // --- ★★★ END UNCHANGED SEARCH LOGIC ★★★ ---


    /**
     * ★★★ (REWRITTEN) Open and populate the Student History Modal ★★★
     */
    async function openStudentHistoryModal(tr) {
        if (!studentHistoryModal) {
            studentHistoryModal = new bootstrap.Modal(document.getElementById('studentHistoryModal'));
        }

        const modalTitle = document.getElementById('studentHistoryModalLabel');
        const accordionContainer = document.getElementById('student-history-accordion-container');
        
        modalTitle.textContent = `Loading history for TR: ${tr}...`;
        accordionContainer.innerHTML = '<div class="loader-cell"><div class="loader"></div></div>';
        studentHistoryModal.show();

        try {
            const res = await fetch(`/api/evaluation/student-history/${tr}`, { credentials: 'include' });
            if (!res.ok) throw new Error('Could not load history');
            
            const { data, studentName } = await res.json();
            modalTitle.textContent = `History for ${studentName} (TR: ${tr})`;

            if (data.length === 0) {
                accordionContainer.innerHTML = '<p class="text-center">No evaluation history found for this student.</p>';
                return;
            }

            // Build the accordion
            let html = `<div class="accordion" id="studentHistoryAccordion">`;
            const c = (val) => val || '<i class="text-muted">No comment.</i>';

            data.forEach((item, index) => {
                let statusClass = 'status-pending';
                if (item.CommentStatus === 'Completed') { statusClass = 'status-completed'; } 
                else if (item.CommentStatus === 'Partial Pending') { statusClass = 'status-partial'; }

                html += `
                    <div class="accordion-item">
                        <h2 class="accordion-header" id="hist-heading-${index}">
                            <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#hist-collapse-${index}">
                                <strong>${item.BatchName}</strong> 
                                <span class="text-muted mx-2">(${new Date(item.CreatedAt).toLocaleDateString()})</span>
                                <span class="status-badge ${statusClass}">${item.CommentStatus}</span>
                            </button>
                        </h2>
                        <div id="hist-collapse-${index}" class="accordion-collapse collapse" data-bs-parent="#studentHistoryAccordion">
                            <div class="accordion-body">
                                <div class="mb-3">
                                    <button class="btn btn-sm btn-primary edit-history-btn" data-testlog="${item.TestLog}" data-batchid="${item.BatchID || 'null'}">
                                        Edit This Record &rarr;
                                    </button>
                                </div>
                                
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
                    </div>
                `;
            });

            html += '</div>';
            accordionContainer.innerHTML = html;

        } catch (err) {
            console.error(err);
            modalTitle.textContent = `History for ${name} (TR: ${tr})`;
            accordionContainer.innerHTML = '<p class="text-center text-danger">Error loading history.</p>';
        }
    }

    /**
     * ★★★ (REWRITTEN) Handle click on an "Edit" button in the history modal ★★★
     */
    $('#studentHistoryModal').on('click', '.edit-history-btn', function() {
        const testLog = $(this).data('testlog');
        const batchId = $(this).data('batchid');
        
        if (testLog && batchId) {
            studentHistoryModal.hide();
            window.location.href = `comment-entry.html?testlog=${testLog}&batch=${batchId}`;
        }
    });


    // --- INITIALIZATION ---
    loadStatistics(); 
    loadBatchCards();
    initializeBatchDetailsTable();
});