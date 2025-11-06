document.addEventListener('DOMContentLoaded', () => {

    // --- Chart variables ---
    let bmiOverTimeChart = null, bmiStatusChart = null;
    const primaryColor = getComputedStyle(document.documentElement).getPropertyValue('--primary').trim() || '#4CAF50';
    const dangerColor = getComputedStyle(document.documentElement).getPropertyValue('--danger').trim() || '#f44336';
    const warningColor = getComputedStyle(document.documentElement).getPropertyValue('--warning').trim() || '#f39c12';
    const blueColor = '#0d6efd';

    // --- Modal & Table variables ---
    let batchDetailsModal = null, studentHistoryModal = null;
    let exportBatchModal = null; 
    let myCommentsDataTable = null;
    let batchDetailsDataTable = null;
    let currentBatchID = null, currentBatchName = null; 
    let allBatchesData = []; 

    // --- Search variables ---
    const searchInput = document.getElementById('studentSearchInput');
    const searchResultsContainer = document.getElementById('studentSearchResults');
    let searchTimeout = null;
    
// --- Helper function ---
function formatMetaData(evaluator, profession, timestamp) {
    if (!evaluator) return '';
    const date = new Date(timestamp).toLocaleDateString();
    return `by <strong>${evaluator}</strong> (${profession || 'Evaluator'}) on ${date}`;
}

    // --- Statistics Function ---
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
    
    /**
     * Load Batch Cards
     * (★★★ UPDATED for new 'In Progress' status ★★★)
     */
    async function loadBatchCards() {
        const container = document.getElementById('batch-cards-container');
        try {
            const res = await fetch('/api/evaluation/batches', { credentials: 'include' });
            if (!res.ok) { if (res.status === 403) throw new Error('Access Denied.'); throw new Error('Failed to fetch evaluation batches.'); }
            
            const { data } = await res.json();
            allBatchesData = data; 
            
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
                
                // ★★★ Use 'PartialCount' for 'In Progress' ★★★
                card.innerHTML = `
                    <div class="batch-card-number">${batch.BatchName}</div>
                    <div class="batch-card-count">${batch.TotalCount}</div>
                    <div class="batch-card-label">Total Records</div>
                    <div class="batch-card-status">${statusText}</div>
                    <div class="batch-card-stats">
                        <span class="stat-pending">Pending: ${batch.PendingCount}</span>
                        <span class="stat-partial">In Progress: ${batch.PartialCount}</span>
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

    /**
     * Initialize Batch Details DataTable
     * (★★★ UPDATED for new 'In Progress' status ★★★)
     */
    function initializeBatchDetailsTable() {
        if (batchDetailsDataTable) return;
        batchDetailsDataTable = $('#batch-details-table').DataTable({
            processing: true, 
            ajax: { url: '/api/evaluation/batch-details/0', credentials: 'include', dataSrc: 'data' },
            language: { processing: '<div class="loader-cell"><div class="loader"></div></div>', emptyTable: "No records found for this batch." },
            columns: [
                { data: 'CommentStatus', render: (data) => {
                    let statusClass = 'status-pending';
                    // ★★★ Use 'In Progress' ★★★
                    if (data === 'In Progress') { statusClass = 'status-partial'; }
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
                else if (data.CommentStatus === 'In Progress') { $(row).addClass('row-partial'); }
            }
        });
        
        // Click Handler
        $('#batch-details-table tbody').on('click', 'tr', function () {
            const rowData = batchDetailsDataTable.row(this).data();
            if (rowData) {
                const testLog = rowData.TestLog;
                if (currentBatchID !== null) {
                    window.location.href = `comment-entry.html?testlog=${testLog}&batch=${currentBatchID}`;
                } else { Swal.fire('Error', 'Could not determine batch ID.', 'error'); }
            }
        });
    }

    // ★★★ ADD THIS ENTIRE NEW FUNCTION ★★★
    /**
     * Initializes the "My Comments" log table
     */
    function loadMyCommentsLog() {
        if (myCommentsDataTable) {
            myCommentsDataTable.ajax.reload();
            return;
        }

        myCommentsDataTable = $('#my-comments-table').DataTable({
            processing: true,
            ajax: { 
                url: '/api/evaluation/my-comments', 
                credentials: 'include', 
                dataSrc: 'data' 
            },
            language: { 
                processing: '<div class="loader-cell"><div class="loader"></div></div>',
                emptyTable: "You have not submitted any comments yet."
            },
            columns: [
                { data: 'DateEvaluated', render: (data) => new Date(data).toLocaleDateString() },
                { data: 'StudentName' },
                { data: 'TR' },
                { data: 'BatchName' },
                { data: 'CategoryName' },
                { 
                    data: 'CommentText',
                    render: (data) => {
                        if (data.length > 50) {
                            return `<span class="comment-truncate" title="${data}">${data.substring(0, 50)}...</span>`;
                        }
                        return data;
                    }
                },
                { 
                    data: null, // Actions column
                    orderable: false,
                    className: 'actions-cell',
                    render: (data, type, row) => {
                        const batchId = row.BatchID === null ? 'null' : row.BatchID;
                        return `
                            <a href="comment-entry.html?testlog=${row.LogID}&batch=${batchId}" class="btn btn-sm btn-outline-primary">
                                Go to
                            </a>
                            <button class="delete-my-comment-btn" data-id="${row.EvaluationID}">
                                Delete
                            </button>
                        `;
                    }
                }
            ],
            order: [[0, 'desc']], // Show newest first
            responsive: true, 
            pageLength: 10
        });
    }
    
    // (openBatchDetailsModal is unchanged)
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
    
    // (Chart functions are unchanged)
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
        const colorMap = { 'Normal': primaryColor, 'Normal weight': primaryColor, 'Overweight': warningColor, 'Obese': dangerColor, 'Obese II': '#a93226', 'Underweight': blueColor, 'Severely Underweight': '#2471a3', };
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
            openStudentHistoryModal(tr); 
        }
    });
    document.addEventListener('click', (e) => {
        if (!searchInput.contains(e.target) && !searchResultsContainer.contains(e.target)) {
            searchResultsContainer.style.display = 'none';
        }
    });
    

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
        const c = (val) => val ? val.replace(/\n/g, '<br>') : '<i class="text-muted">No comment.</i>';

        data.forEach((item, index) => { // 'item' is a TestLog
            let statusClass = 'status-pending';
            if (item.CommentStatus === 'In Progress') { statusClass = 'status-partial'; } 
            else if (item.CommentStatus === 'Completed') { statusClass = 'status-completed'; }

            // Build the inner list of comments for this log
            let commentsHtml = item.comments.length > 0
                ? item.comments.map(comment => `
                    <h5>${comment.CategoryName}</h5>
                    <span class="comment-meta-data">${formatMetaData(comment.EvaluatorName, comment.Profession, comment.DateEvaluated)}</span>
                    <p class="history-comment">${c(comment.CommentText)}</p>
                `).join('')
                : '<p class="text-muted">No comments submitted for this test.</p>';

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
                                <a href="comment-entry.html?testlog=${item.TestLog}&batch=${item.BatchID || 'null'}" class="btn btn-sm btn-primary edit-history-btn">
                                    Go to this Record &rarr;
                                </a>
                            </div>
                            ${commentsHtml}
                        </div>
                    </div>
                </div>
            `;
        });

        html += '</div>';
        accordionContainer.innerHTML = html;

    } catch (err) {
        console.error('Error in openStudentHistoryModal:', err);
        modalTitle.textContent = `History for ${tr}`;
        accordionContainer.innerHTML = '<p class="text-center text-danger">Error loading history.</p>';
    }
}

    // ★★★ ADD THIS NEW DELETE LISTENER ★★★
    $('#my-comments-table tbody').on('click', '.delete-my-comment-btn', function() {
        const button = $(this);
        const evaluationID = button.data('id');

        Swal.fire({
            title: 'Delete this comment?',
            text: "This action is permanent and cannot be undone.",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: 'var(--danger)',
            confirmButtonText: 'Yes, delete it'
        }).then(async (result) => {
            if (result.isConfirmed) {
                try {
                    // We re-use the same secure delete API
                    const res = await fetch(`/api/evaluation/delete-comment/${evaluationID}`, {
                        method: 'DELETE',
                        credentials: 'include'
                    });
                    const data = await res.json();
                    if (!res.ok) throw new Error(data.message);

                    Swal.fire('Deleted!', 'Your comment has been deleted.', 'success');
                    // Refresh the table
                    if (myCommentsDataTable) {
                        myCommentsDataTable.ajax.reload();
                    }
                } catch (err) {
                    Swal.fire('Error', err.message, 'error');
                }
            }
        });
    });

    // --- EXPORT LOGIC (Unchanged) ---
    document.getElementById('openExportModalBtn').addEventListener('click', () => {
        if (!exportBatchModal) {
            exportBatchModal = new bootstrap.Modal(document.getElementById('exportBatchModal'));
        }
        const select = document.getElementById('exportBatchSelect');
        select.innerHTML = '<option value="">Select a batch...</option>'; 
        if (allBatchesData.length > 0) {
            allBatchesData.forEach(batch => {
                const batchId = batch.BatchID === null ? 'null' : batch.BatchID;
                select.innerHTML += `<option value="${batchId}" data-name="${batch.BatchName}">${batch.BatchName}</option>`;
            });
        } else {
            select.innerHTML = '<option value="">No batches found.</option>';
        }
        exportBatchModal.show();
    });
    document.getElementById('downloadExportBtn').addEventListener('click', async () => {
        const select = document.getElementById('exportBatchSelect');
        const selectedOption = select.options[select.selectedIndex];
        const batchId = selectedOption.value;
        const batchName = selectedOption.dataset.name;
        if (!batchId) {
            return Swal.fire('Error', 'Please select a batch to export.', 'warning');
        }
        const button = document.getElementById('downloadExportBtn');
        const spinner = button.querySelector('.spinner-border');
        const buttonText = button.querySelector('.button-text');
        button.disabled = true;
        spinner.classList.remove('d-none');
        buttonText.textContent = 'Generating...';
        try {
            const res = await fetch(`/api/evaluation/export/${batchId}`, { credentials: 'include' });
            if (!res.ok) throw new Error('Failed to fetch export data from server.');
            const data = await res.json();
            if (!data.success || data.records.length === 0) {
                throw new Error('No records found in this batch to export.');
            }
            const worksheet = XLSX.utils.json_to_sheet(data.records);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, "Evaluation Data");
            const filename = `${data.batchName}.xlsx`;
            XLSX.writeFile(workbook, filename);
            Swal.fire('Success!', `Export for "${data.batchName}" has been downloaded.`, 'success');
            exportBatchModal.hide();
        } catch (err) {
            console.error('Export error:', err);
            Swal.fire('Export Failed', err.message, 'error');
        } finally {
            button.disabled = false;
            spinner.classList.add('d-none');
            buttonText.textContent = 'Download';
        }
    });

    let completeProfileModal = null; 

    document.getElementById('editProfileBtn').addEventListener('click', async (e) => {
        e.preventDefault();
        
        // Initialize the modal instance on first click
        if (!completeProfileModal) {
            completeProfileModal = new bootstrap.Modal(document.getElementById('completeProfileModal'));
        }

        const modal = document.getElementById('completeProfileModal');
        const form = document.getElementById('profileForm');
        
        try {
            // 1. Fetch the evaluator's current profile data
            const res = await fetch('/api/evaluator/profile', { credentials: 'include' });
            if (!res.ok) throw new Error('Could not fetch profile.');
            
            const { data } = await res.json(); //
            
            // 2. Populate the modal form with the data
            if (data) {
                modal.querySelector('#evaluatorName').value = data.Name || '';
                modal.querySelector('#evaluatorProfession').value = data.Profession || '';
                modal.querySelector('#evaluatorEmail').value = data.Email || '';
                modal.querySelector('#evaluatorContact').value = data.Contact || '';
            }
            
            // 3. Show the modal
            completeProfileModal.show();

        } catch (err) {
            console.error('Error opening profile editor:', err);
            Swal.fire('Error', 'Could not load your profile to edit.', 'error');
        }
    });

    // --- INITIALIZATION ---
    loadStatistics(); 
    loadBatchCards();
    initializeBatchDetailsTable();
    loadMyCommentsLog();
});