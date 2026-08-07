document.addEventListener("DOMContentLoaded", () => {
    let blacklistTable = null;
    let staffBranch = 'Unknown';
    let currentFetchedTR = null;

    // Fetch staff branch display
    try {
        const userString = localStorage.getItem('staffUser');
        if (userString) {
            staffBranch = JSON.parse(userString).Branch || 'Unknown';
            const branchDisplay = document.getElementById('display-staff-branch');
            if (branchDisplay) branchDisplay.textContent = staffBranch;
        }
    } catch (e) { /* Fails silently */ }

    const trInput = document.getElementById('blacklist-tr-input');
    const fetchBtn = document.getElementById('fetch-student-btn');
    const previewCard = document.getElementById('student-preview-card');
    const blacklistForm = document.getElementById('blacklistForm');
    const workflowStepBadge = document.getElementById('workflow-step-badge');

    /**
     * Loads blacklisted student records and updates stat counters
     */
    async function loadBlacklistData() {
        if (blacklistTable) {
            blacklistTable.destroy();
            blacklistTable = null;
        }

        const tbody = document.querySelector('#blacklist-table tbody');
        if (tbody) tbody.innerHTML = '';

        try {
            const res = await fetch('/api/blacklist');
            const json = await res.json();

            if (!json.success) {
                throw new Error(json.error || 'Failed to load blacklisted records');
            }

            const records = json.data || [];

            // Update Summary Stats
            const countEl = document.getElementById('stat-blacklisted-count');
            const batchesEl = document.getElementById('stat-batches-affected');
            const recentEl = document.getElementById('stat-recent-added');

            if (countEl) countEl.textContent = records.length;

            const uniqueBatches = new Set(records.map(r => r.SlotName || 'Unassigned'));
            if (batchesEl) batchesEl.textContent = uniqueBatches.size;

            const now = new Date();
            const thisMonthCount = records.filter(r => {
                const created = new Date(r.CreatedAt);
                return created.getMonth() === now.getMonth() && created.getFullYear() === now.getFullYear();
            }).length;
            if (recentEl) recentEl.textContent = thisMonthCount;

            // Initialize DataTable
            blacklistTable = $('#blacklist-table').DataTable({
                data: records,
                columns: [
                    { data: 'TR', className: 'fw-semibold text-danger' },
                    { 
                        data: 'Name',
                        className: 'fw-medium',
                        render: function(data) {
                            return `<span class="badge bg-danger-subtle text-danger border border-danger-subtle me-1">🚫 Flagged</span> ${data}`;
                        }
                    },
                    { 
                        data: 'Darajah',
                        render: function(data) {
                            return `<span class="badge bg-light text-dark border">${data || '-'}</span>`;
                        }
                    },
                    { 
                        data: 'SlotName',
                        render: function(data) {
                            return `<span class="badge bg-light text-dark border">${data || 'Unassigned'}</span>`;
                        }
                    },
                    { 
                        data: 'Reason',
                        className: 'text-dark',
                        render: function(data) {
                            return `<span class="fw-medium text-danger">${data || 'No reason provided'}</span>`;
                        }
                    },
                    { 
                        data: 'CreatedAt',
                        render: function(data) {
                            if (!data) return '-';
                            const d = new Date(data);
                            return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
                        }
                    },
                    { data: 'AddedByUsername', className: 'text-muted small' },
                    {
                        data: 'TR',
                        className: 'text-center',
                        orderable: false,
                        render: function(data) {
                            return `<button class="btn btn-sm btn-outline-success unflag-btn py-1 px-2" style="font-size: 0.78rem;" data-tr="${data}">
                                        ✓ Unflag Student
                                    </button>`;
                        }
                    }
                ],
                responsive: true,
                destroy: true,
                pageLength: 10,
                lengthMenu: [[10, 25, 50, -1], [10, 25, 50, "All"]]
            });

        } catch (err) {
            console.error('Error loading blacklist:', err);
            Swal.fire('Notice', err.message, 'warning');
        }
    }

    /**
     * Resets the 2-step workflow form & preview panel
     */
    function resetWorkflow() {
        currentFetchedTR = null;
        if (previewCard) previewCard.classList.add('d-none');
        if (blacklistForm) blacklistForm.classList.add('d-none');
        if (workflowStepBadge) {
            workflowStepBadge.textContent = 'Step 1 of 2: Fetch Student Record';
            workflowStepBadge.className = 'badge bg-light text-muted border px-2 py-1 small';
        }
    }

    // Reset workflow when TR input changes
    if (trInput) {
        trInput.addEventListener('input', () => {
            if (currentFetchedTR && parseInt(trInput.value) !== currentFetchedTR) {
                resetWorkflow();
            }
        });
    }

    /**
     * STEP 1: Fetch Student Details & Attendance Rate
     */
    if (fetchBtn) {
        fetchBtn.addEventListener('click', async () => {
            const trValue = trInput?.value?.trim();
            const tr = parseInt(trValue, 10);

            if (isNaN(tr) || tr <= 0) {
                return Swal.fire('Invalid TR Number', 'Please enter a valid numeric Student TR number.', 'warning');
            }

            const originalBtnHtml = fetchBtn.innerHTML;
            try {
                fetchBtn.disabled = true;
                fetchBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status"></span> Fetching...';

                const res = await fetch(`/api/blacklist/student-preview/${tr}`);
                const json = await res.json();

                if (!res.ok || !json.success || !json.student) {
                    resetWorkflow();
                    throw new Error(json.error || 'Student record not found.');
                }

                const student = json.student;
                currentFetchedTR = student.TR;

                // Populate Preview Card
                document.getElementById('preview-student-name').textContent = student.Name;
                document.getElementById('preview-student-tr').textContent = `TR #${student.TR}`;
                document.getElementById('preview-student-status').textContent = student.Status;
                document.getElementById('preview-darajah').textContent = student.Darajah;
                document.getElementById('preview-slot').textContent = student.SlotName;
                
                // Attendance Rate % formatting
                const attPct = Number(student.AttendanceRate) || 0;
                document.getElementById('preview-attendance-pct').textContent = `${attPct.toFixed(1)}%`;
                
                const progressBar = document.getElementById('preview-attendance-bar');
                if (progressBar) {
                    progressBar.style.width = `${Math.min(100, Math.max(0, attPct))}%`;
                    progressBar.className = 'progress-bar ' + (attPct >= 80 ? 'bg-success' : attPct >= 60 ? 'bg-warning' : 'bg-danger');
                }

                let breakdownText = `${student.TotalPresent || 0} Present / ${student.TotalAbsences || 0} Absent`;
                if (student.TotalOnLeave > 0) {
                    breakdownText += ` (${student.TotalOnLeave} Leave)`;
                }
                document.getElementById('preview-sessions-summary').textContent = breakdownText;

                // Unhide Preview Card
                previewCard.classList.remove('d-none');

                const alreadyAlert = document.getElementById('preview-already-blacklisted-alert');
                const reasonSpan = document.getElementById('preview-blacklisted-reason');

                if (student.IsBlacklisted) {
                    if (alreadyAlert) {
                        alreadyAlert.classList.remove('d-none');
                        if (reasonSpan) reasonSpan.textContent = student.BlacklistReason || 'Flagged by Admin';
                    }
                    if (blacklistForm) blacklistForm.classList.add('d-none');
                    if (workflowStepBadge) {
                        workflowStepBadge.textContent = 'Already Blacklisted';
                        workflowStepBadge.className = 'badge bg-danger text-white border border-danger px-2 py-1 small';
                    }
                } else {
                    if (alreadyAlert) alreadyAlert.classList.add('d-none');
                    if (blacklistForm) blacklistForm.classList.remove('d-none');
                    if (workflowStepBadge) {
                        workflowStepBadge.textContent = 'Step 2 of 2: Provide Reason & Confirm';
                        workflowStepBadge.className = 'badge bg-primary-subtle text-primary border border-primary-subtle px-2 py-1 small';
                    }
                }

            } catch (err) {
                Swal.fire('Fetch Error', err.message, 'warning');
            } finally {
                fetchBtn.disabled = false;
                fetchBtn.innerHTML = originalBtnHtml;
            }
        });
    }

    /**
     * STEP 2: Submit Blacklist Form
     */
    if (blacklistForm) {
        blacklistForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const reasonInput = document.getElementById('blacklist-reason-input');
            const submitBtn = document.getElementById('blacklist-submit-btn');

            const tr = currentFetchedTR || parseInt(trInput?.value);
            const reason = reasonInput?.value?.trim();

            if (isNaN(tr) || !reason) {
                return Swal.fire('Warning', 'Please enter a valid student TR and mandatory reason.', 'warning');
            }

            try {
                submitBtn.disabled = true;
                const originalText = submitBtn.innerHTML;
                submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status"></span> Flagging...';

                const res = await fetch('/api/blacklist', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ TR: tr, Reason: reason })
                });

                const json = await res.json();

                if (!res.ok || !json.success) {
                    throw new Error(json.error || json.message || 'Failed to blacklist student');
                }

                Swal.fire({
                    icon: 'success',
                    title: 'Student Blacklisted!',
                    text: json.message,
                    timer: 2500,
                    showConfirmButton: false
                });

                trInput.value = '';
                reasonInput.value = '';
                resetWorkflow();
                loadBlacklistData();

            } catch (err) {
                Swal.fire('Error', err.message, 'error');
            } finally {
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = '<span>🚫</span> Confirm & Flag Student';
                }
            }
        });
    }

    // Event Delegation: Unflag Student
    $('#blacklist-table').on('click', '.unflag-btn', function() {
        const tr = $(this).data('tr');

        Swal.fire({
            title: `Unflag Student TR ${tr}?`,
            text: 'This will remove the student from the active blacklist.',
            input: 'textarea',
            inputLabel: 'Reason for unflagging',
            inputPlaceholder: 'Enter reason for removing from blacklist...',
            icon: 'question',
            showCancelButton: true,
            confirmButtonColor: '#28a745',
            cancelButtonColor: '#6c757d',
            confirmButtonText: 'Yes, Unflag Student'
        }).then(async (result) => {
            if (result.isConfirmed) {
                try {
                    const res = await fetch('/api/blacklist/remove', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ TR: parseInt(tr), RemovalReason: result.value || 'Unflagged by staff' })
                    });

                    const json = await res.json();
                    if (!res.ok || !json.success) {
                        throw new Error(json.error || 'Failed to unflag student');
                    }

                    Swal.fire('Unflagged!', json.message, 'success');
                    loadBlacklistData();
                } catch (err) {
                    Swal.fire('Error', err.message, 'error');
                }
            }
        });
    });

    // Refresh Button Listener
    const refreshBtn = document.getElementById('refresh-blacklist-btn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            loadBlacklistData();
        });
    }

    // Initialize Page
    loadBlacklistData();
});
