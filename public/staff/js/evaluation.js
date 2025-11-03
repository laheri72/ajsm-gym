document.addEventListener('DOMContentLoaded', () => {

    // Global variables
    let batchDetailsModal = null;
    let batchDetailsDataTable = null;
    let currentBatchNumber = null; // ★★★ Store the currently viewed batch number

    /**
     * 1. Load Batch Cards
     * (This function is unchanged)
     */
/**
     * 1. Load Batch Cards (★★★ UPDATED FOR TWEAK 2 ★★★)
     * Fetches the batch counts from the API and renders the new card design.
     */
    async function loadBatchCards() {
        const container = document.getElementById('batch-cards-container');
        try {
            const res = await fetch('/api/evaluation/batches', { credentials: 'include' });
            if (!res.ok) {
                if (res.status === 403) {
                    throw new Error('Access Denied. You must be logged in as an Evaluator.');
                }
                throw new Error('Failed to fetch evaluation batches.');
            }
            const { data } = await res.json();

            if (data.length === 0) {
                container.innerHTML = '<p>No trainer-submitted test records found to evaluate.</p>';
                return;
            }

            container.innerHTML = ''; 
            
            data.forEach(batch => {
                const card = document.createElement('div');
                card.className = 'batch-card';
                card.dataset.batchNumber = batch.BatchNumber;
                
                // New card layout with pending/completed
                card.innerHTML = `
                    <div class="batch-card-number">Batch ${batch.BatchNumber}</div>
                    <div class="batch-card-count">${batch.TotalCount}</div>
                    <div class="batch-card-label">Total Records</div>
                    <div class="batch-card-stats">
                        <span class="stat-pending">Pending: ${batch.PendingCount}</span>
                        <span class="stat-completed">Completed: ${batch.CompletedCount}</span>
                    </div>
                `;
                
                card.addEventListener('click', () => {
                    openBatchDetailsModal(batch.BatchNumber);
                });
                container.appendChild(card);
            });

        } catch (err) {
            console.error('Error loading batch cards:', err);
            container.innerHTML = `<p class="text-danger">${err.message}</p>`;
        }
    }

    /**
     * 2. Initialize the Batch Details DataTable
     * (Unchanged, but its click handler logic is new)
     */
    function initializeBatchDetailsTable() {
        if (batchDetailsDataTable) return;

        batchDetailsDataTable = $('#batch-details-table').DataTable({
            data: [], 
            columns: [
                { 
                    data: 'CommentStatus',
                    render: (data) => {
                        const statusClass = data === 'Completed' ? 'status-completed' : 'status-pending';
                        return `<span class="status-badge ${statusClass}">${data}</span>`;
                    }
                },
                { data: 'TR' },
                { data: 'Name' },
                { data: 'Grade' },
                { 
                    data: 'CreatedAt',
                    render: (data) => new Date(data).toLocaleDateString()
                },
                { data: 'TestLog', className: 'd-none' } 
            ],
            order: [[0, 'asc'], [4, 'desc']], 
            responsive: true,
            pageLength: 25,
            language: {
                emptyTable: "No records found for this batch."
            },
            createdRow: (row, data) => {
                if (data.CommentStatus === 'Pending') {
                    $(row).addClass('row-pending');
                } else {
                    $(row).addClass('row-completed');
                }
            }
        });

        // ★★★ UPDATED CLICK HANDLER ★★★
        // This is the main change in this file
        $('#batch-details-table tbody').on('click', 'tr', function () {
            const rowData = batchDetailsDataTable.row(this).data();
            if (rowData) {
                // Instead of opening a modal, redirect to the new page
                const testLog = rowData.TestLog;
                
                // We use the stored currentBatchNumber
                if (currentBatchNumber) {
                    window.location.href = `comment-entry.html?testlog=${testLog}&batch=${currentBatchNumber}`;
                } else {
                    console.error('Current batch number is not set.');
                    Swal.fire('Error', 'Could not determine batch number. Please close this modal and try again.', 'error');
                }
            }
        });
    }

    /**
     * 3. Open the Batch Details Modal and load its data
     * (Slightly modified to store the batch number)
     */
    function openBatchDetailsModal(batchNumber) {
        if (!batchDetailsModal) {
            batchDetailsModal = new bootstrap.Modal(document.getElementById('batchDetailsModal'));
        }
        
        // ★★★ STORE THE BATCH NUMBER ★★★
        currentBatchNumber = batchNumber; 
        
        document.getElementById('batchDetailsModalLabel').textContent = `Review Batch ${batchNumber}`;

        const newUrl = `/api/evaluation/batch-details/${batchNumber}`;
        batchDetailsDataTable.ajax.url(newUrl).load();
        
        batchDetailsModal.show();
    }

    // --- INITIALIZATION ---
    loadBatchCards();
    initializeBatchDetailsTable();
    
    // We removed the comment modal logic, as it's moving to a new page
});