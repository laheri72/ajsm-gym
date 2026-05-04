document.addEventListener("DOMContentLoaded", () => {
    // Declare inactiveStudentDataTable at the top to avoid reference errors
    let inactiveStudentDataTable = null;
    let adminUserDataTable = null;


    const user = JSON.parse(localStorage.getItem('staffUser'));
    if (!user || user.Role !== 'Admin') {
        // If the user is not an admin, redirect them immediately.
        window.location.href = 'overview.html'; 
        return; // Stop executing any further code on this page.
    }

    // --- PAGE INITIALIZATION ---

    // Get user info stored by auth.js to display branch name
    if (user && user.Branch) {
        const branchNameEl = document.getElementById('branch-name');
        if (branchNameEl) {
            branchNameEl.innerText = user.Branch;
        }
    }

    // Load initial data for both tables
   
    loadInactiveStudents();


        // Set branch name inline (for the “Users in <BRANCH>” text)
    const branchInline = document.getElementById('branch-name-inline');
    if (branchInline) {
        branchInline.innerText = user.Branch;
    }

    // Initialize admin user DataTable
    initAdminUserTable(user);


    // ★★★ ADDING STYLES DYNAMICALLY (since they are in dashboard.css) ★★★
    // This ensures the new status badges will look correct.
    const style = document.createElement('style');
    style.innerHTML = `
        .status-badge {
            display: inline-block; padding: 0.25em 0.6em; font-size: 0.8rem;
            font-weight: 600; line-height: 1; border-radius: 0.375rem;
            color: #fff; text-transform: uppercase; text-align: center;
        }
        .status-active { background-color: var(--primary); color: white; }
        .status-inactive { background-color: var(--gray); color: var(--dark); }
        #maleUnbatchedCount, #femaleUnbatchedCount { color: var(--danger); font-weight: 700; margin-bottom: 1rem; }
    `;
    document.head.appendChild(style);


 // --- ADMIN USER MANAGEMENT LOGIC ---

    // admin users table 

    function initAdminUserTable(user) {
    // If already initialized, just reload
    if (adminUserDataTable) {
        adminUserDataTable.ajax.reload(null, false);
        return;
    }

    const branch = user.Branch;
    const currentUsername = user.Username;

    adminUserDataTable = $('#adminUserTable').DataTable({
        ajax: {
            url: `/api/admin/users/${branch}`,
            dataSrc: function (json) {
                // Support both:
                // 1) [ { Username, Gender, Role, ... }, ... ]
                // 2) { data: [ ... ] }
                const rows = Array.isArray(json) ? json : (json.data || []);

                // Don’t show the current admin themself
                return rows
                .filter(row => row.Username !== currentUsername)
                .map(row => ({
                    ...row,
                    Gender: row.Gender ? row.Gender.trim().charAt(0).toUpperCase() + row.Gender.trim().slice(1).toLowerCase() : '-'
                }));
            }
        },
        columns: [
            { data: 'Username' },
            {
                data: 'Gender',
                render: function (data) {
                    return data || '-';
                }
            },
            { data: 'Role' },
            {
                data: 'Username',
                orderable: false,
                className: 'text-end',
                render: function (username) {
                    return `
                        <button 
                            type="button"
                            class="btn btn-sm btn-outline-danger admin-delete-user-btn"
                            data-username="${username}"
                            title="Delete user"
                        >
                            <i class="fas fa-trash-alt"></i>
                        </button>
                    `;
                }
            }
        ],
        pageLength: 10,
        lengthMenu: [10, 25, 50, 100],
        order: [[0, 'asc']],
        responsive: true,
        dom:
            "<'row mb-2'<'col-sm-6'l><'col-sm-6'f>>" +
            "<'row'<'col-sm-12'tr>>" +
            "<'row mt-2'<'col-sm-5'i><'col-sm-7'p>>"
    });

    // Role filter (column index 2)
    const roleFilter = document.getElementById('userRoleFilter');
    if (roleFilter) {
        roleFilter.addEventListener('change', function () {
            const value = this.value || '';
            adminUserDataTable
                .column(2)
                .search(value, false, false)
                .draw();
        });
    }


    // Gender filter (column index 1)
    const genderFilter = document.getElementById('userGenderFilter');
    if (genderFilter) {
        genderFilter.addEventListener('change', function () {
            const value = this.value;
            if (!value) {
                adminUserDataTable.column(1).search('', true, false).draw(); // reset
            } else {
                adminUserDataTable.column(1).search(`^${value}$`, true, false).draw(); // exact match
            }
        });
    }

}


    // Event listener for adding a new user
    document.getElementById('adminAddForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();

        // 1. Get references to the button and its parts
        const submitBtn = document.getElementById('addUserBtn'); // Use the ID we added
        const buttonText = submitBtn.querySelector('.button-text');
        const spinner = submitBtn.querySelector('.spinner-border');

        // 2. Start Loader: Disable button, show spinner
        submitBtn.disabled = true;
        buttonText.classList.add('d-none');
        spinner.classList.remove('d-none');

        // 3. Prepare payload (same as before)
        const newUser = {
            username: document.getElementById('newUsername').value.trim(),
            gender: document.getElementById('newGender').value,
            role: document.getElementById('newRole').value,
            branch: user.Branch // Assuming 'user' is accessible here from page load
        };

        try {
            // 4. Make the API call (same as before)
            const res = await fetch('/api/admin/add-user', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newUser)
            });
            const data = await res.json(); //

            // 5. Handle response (same as before)
            if (data.success) { 
                Swal.fire({ 
                    toast: true, position: 'top-end', icon: 'success',
                    title: 'User Added Successfully!', showConfirmButton: false, timer: 3000
                });
        if (adminUserDataTable) {
            adminUserDataTable.ajax.reload(null, false); // stay on same page
        }
                e.target.reset(); // Clear the form
            } else {
                Swal.fire('Error', 'Failed to add user: ' + data.message, 'error'); 
            }
        } catch (err) {
            // Handle potential network errors
            console.error("Add user error:", err);
            Swal.fire({
                icon: 'error',
                title: 'Server Error',
                text: 'Could not add user. Please try again later.'
            });
        } finally {
            // 6. Stop Loader: Re-enable button, hide spinner (ALWAYS runs)
            submitBtn.disabled = false;
            buttonText.classList.remove('d-none');
            spinner.classList.add('d-none');
        }
    });

    // Delegated event listener for deleting a user
    $('#adminUserTable').on('click', '.admin-delete-user-btn', function() {
        const username = $(this).data('username');
        Swal.fire({
            title: `Delete ${username}?`,
            text: "This action is permanent and cannot be undone.",
            icon: 'warning', showCancelButton: true, confirmButtonColor: 'var(--primary)',
            cancelButtonColor: 'var(--danger)', confirmButtonText: 'Yes, delete user!'
        }).then(async (result) => {
            if (result.isConfirmed) {
                const res = await fetch(`/api/admin/delete-user/${username}`, { method: 'DELETE' });
                const data = await res.json();
                if (data.success) {
                    Swal.fire('Deleted!', `${username} has been removed.`, 'success');
        if (adminUserDataTable) {
            adminUserDataTable.ajax.reload(null, false); // stay on same page
        }
                } else {
                    Swal.fire('Error', 'Deletion failed: ' + data.message, 'error');
                }
            }
        });
    });

    // Reset Password Form
    document.getElementById('resetPasswordForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const trInput = document.getElementById('studentTrReset');
        const tr = trInput.value;

        if (!tr) {
            return Swal.fire('Error', 'Please enter a student TR number.', 'error');
        }

        Swal.fire({
            title: 'Are you sure?',
            text: `This will reset the password for student TR ${tr}. They will need to use their TR number to log in again.`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ffc107',
            confirmButtonText: 'Yes, Reset It!',
            cancelButtonColor: '#6c757d',
        }).then(async (result) => {
            if (result.isConfirmed) {
                try {
                    const res = await fetch(`/api/staff/reset-student-password/${tr}`, {
                        method: 'PUT'
                    });
                    const data = await res.json();

                    if (res.ok) {
                        Swal.fire('Success!', data.message, 'success');
                        trInput.value = ''; // Clear the input field
                    } else {
                        throw new Error(data.message);
                    }
                } catch (err) {
                    Swal.fire('Operation Failed', err.message, 'error');
                }
            }
        });
    });

    // --- TRAINER LOGS DRAWER LOGIC ---

    function openTrainerLogsDrawer(trainerId, trainerName) {
    const overlay = document.getElementById('trainerLogsOverlay');
    const drawer = document.getElementById('trainerLogsDrawer');
    const title = document.getElementById('trainerLogsTitle');
    const sub = document.getElementById('trainerLogsSub');
    const body = document.getElementById('trainerLogsBody');

    title.textContent = trainerName || 'Trainer Logs';
    sub.textContent = `Trainer ID: ${trainerId}`;

    body.innerHTML = `
        <div style="text-align:center; padding:20px;">
            <div class="spinner-border text-light" role="status">
                <span class="visually-hidden">Loading...</span>
            </div>
        </div>
    `;

    overlay.classList.add('visible');
    drawer.classList.add('open');

    loadTrainerLogsForAdmin(trainerId);
}

function closeTrainerLogsDrawer() {
    document.getElementById('trainerLogsOverlay').classList.remove('visible');
    document.getElementById('trainerLogsDrawer').classList.remove('open');
}

// Fetch and render trainer logs for admin

async function loadTrainerLogsForAdmin(trainerId) {
    try {
        const res = await fetch(`/api/admin/trainer/${trainerId}/logs`);
        const data = await res.json();

        const body = document.getElementById('trainerLogsBody');

        if (!data.success) {
            body.innerHTML = `<p class="text-danger">Failed to load logs.</p>`;
            return;
        }

        if (!data.data || data.data.length === 0) {
            body.innerHTML = `<p class="text-muted">No logs found for this trainer.</p>`;
            return;
        }

        const logs = data.data;

        // Group by BatchName
        const grouped = logs.reduce((acc, log) => {
            const batch = log.BatchName || 'No Batch / Unassigned';
            if (!acc[batch]) acc[batch] = [];
            acc[batch].push(log);
            return acc;
        }, {});

        body.innerHTML = '';

        Object.keys(grouped).forEach(batchName => {
            const records = grouped[batchName];

            const card = document.createElement('div');
            card.className = 'trainer-batch-card';

            card.innerHTML = `
                <div class="trainer-batch-header">
                    <div>
                        <h6>${batchName}</h6>
                    </div>
                    <div style="display:flex; align-items:center; gap:6px;">
                        <span class="trainer-batch-count">${records.length}</span>
                        <i class="fas fa-chevron-down"></i>
                    </div>
                </div>
                <div class="trainer-batch-body">
                    <div class="trainer-logs-table-wrapper">
                        <table class="table table-sm trainer-logs-table">
                            <thead>
                                <tr>
                                    <th>TR</th>
                                    <th>Name</th>
                                    <th>Total</th>
                                    <th>Grade</th>
                                    <th>Log ID</th>
                                    <th>Action</th>
                                </tr>
                            </thead>
                            <tbody></tbody>
                        </table>
                    </div>
                </div>
            `;

            const tbody = card.querySelector('tbody');

            records.forEach(r => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${r.TR}</td>
                    <td>${r.StudentName || '-'}</td>
                    <td>${r.Total}</td>
                    <td>${r.Grade}</td>
                    <td>${r.TestLog}</td>
                    <td>
                    <div class="trainer-logs-actions">
                        <button class="btn btn-sm btn-info admin-view-log-btn" data-log="${r.TestLog}">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="btn btn-sm btn-danger admin-delete-log-btn" data-log="${r.TestLog}">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                    </td>

                `;
                tbody.appendChild(tr);
            });

            body.appendChild(card);
        });

        // Expand/collapse
        body.querySelectorAll('.trainer-batch-header').forEach(header => {
            header.addEventListener('click', () => {
                const bodyEl = header.parentElement.querySelector('.trainer-batch-body');
                const icon = header.querySelector('i.fas');

                const isOpen = bodyEl.classList.contains('open');
                if (isOpen) {
                    bodyEl.classList.remove('open');
                    icon.classList.remove('fa-chevron-up');
                    icon.classList.add('fa-chevron-down');
                } else {
                    bodyEl.classList.add('open');
                    icon.classList.remove('fa-chevron-down');
                    icon.classList.add('fa-chevron-up');
                }
            });
        });

        // View Details (Admin)
        body.querySelectorAll('.admin-view-log-btn').forEach(btn => {
            btn.addEventListener('click', async e => {
                e.stopPropagation();
                const logId = btn.dataset.log;
                showAdminLogDetails(logId);
            });
        });


        // Delete buttons
        body.querySelectorAll('.admin-delete-log-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const logId = btn.dataset.log;

                const confirm = await Swal.fire({
                    title: `Delete TestLog #${logId}?`,
                    text: "This action is permanent.",
                    icon: "warning",
                    showCancelButton: true
                });

                if (!confirm.isConfirmed) return;

                const resp = await fetch(`/api/admin/delete-test-record/${logId}`, {
                    method: 'DELETE'
                });
                const json = await resp.json();

                if (json.success) {
                    Swal.fire('Deleted', 'Test record was deleted.', 'success');
                    loadTrainerLogsForAdmin(trainerId); // reload drawer
                } else {
                    Swal.fire('Error', json.message || 'Failed to delete record.', 'error');
                }
            });
        });

    } catch (err) {
        console.error('Error loading trainer logs for admin:', err);
        document.getElementById('trainerLogsBody').innerHTML =
            `<p class="text-danger">Unexpected error while loading logs.</p>`;
    }
}



    // --- Event Listeners for Trainer Logs Drawer ---

    const overlay = document.getElementById('trainerLogsOverlay');
    const closeBtn = document.getElementById('closeTrainerLogsBtn');

    if (overlay) {
        overlay.addEventListener('click', closeTrainerLogsDrawer);
    }
    if (closeBtn) {
        closeBtn.addEventListener('click', closeTrainerLogsDrawer);
    }


    document.getElementById('trainerTable')?.addEventListener('click', (e) => {
    const btn = e.target.closest('.view-trainer-logs-btn');
    if (!btn) return;

    const trainerId = btn.dataset.id;
    const trainerName = btn.dataset.name;
    openTrainerLogsDrawer(trainerId, trainerName);
});



async function showAdminLogDetails(testLog) {
    try {
        const res = await fetch(`/api/admin/log-details/${testLog}`);
        const json = await res.json();

        if (!json.success) {
            Swal.fire("Error", json.message || "Could not load details", "error");
            return;
        }

        const r = json.data;

        Swal.fire({
            width: "600px",
            background: "rgba(15, 23, 42, 0.95)",
            color: "#fff",
            showConfirmButton: false,
            html: buildLogDetailsHTML(r),
        });

    } catch (err) {
        console.error(err);
        Swal.fire("Error", "Unexpected error loading details", "error");
    }
}


function buildLogDetailsHTML(r) {
    return `
    <style>
    ${/* same compact CSS used earlier for trainer modal */""}
    .log-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(110px,1fr)); gap:6px; }
    .log-item { background:rgba(255,255,255,0.10); padding:6px; border-radius:10px; text-align:center; }
    .log-label { font-size:10px; opacity:.7; }
    .log-value { font-size:13px; font-weight:600; }
    .modal-title {text-align:center;font-size:16px;margin-bottom:5px;}
    </style>

    <div class="modal-body-scroll">
        <h3 class="modal-title">${r.BatchName || "Test Log"}</h3>
        <p style="text-align:center;opacity:.7;font-size:12px;">${r.Name} • TR ${r.TR}</p>

        <div class="section-title">Body Metrics</div>
        <div class="log-grid">
            <div class="log-item"><div class="log-label">Weight</div><div class="log-value">${r.Weight}</div></div>
            <div class="log-item"><div class="log-label">Height</div><div class="log-value">${r.Height}</div></div>
            <div class="log-item"><div class="log-label">Waist</div><div class="log-value">${r.Waist}</div></div>
            <div class="log-item"><div class="log-label">Hips</div><div class="log-value">${r.Hips}</div></div>
            <div class="log-item"><div class="log-label">Neck</div><div class="log-value">${r.Neck}</div></div>
            <div class="log-item"><div class="log-label">BMI</div><div class="log-value">${r.BMI} (${r.BMIStatus})</div></div>
            <div class="log-item"><div class="log-label">Fat</div><div class="log-value">${r.BodyFat}</div></div>
            <div class="log-item"><div class="log-label">BMR</div><div class="log-value">${r.BMR}</div></div>
            <div class="log-item"><div class="log-label">Calories</div><div class="log-value">${r.CalorieIntake}</div></div>
            <div class="log-item"><div class="log-label">VO2Max</div><div class="log-value">${r.VO2Max}</div></div>
        </div>

        <div class="section-title">Performance</div>
        <div class="log-grid">
            <div class="log-item"><div class="log-label">PushUps</div><div class="log-value">${r.PushUps}</div></div>
            <div class="log-item"><div class="log-label">SitUps</div><div class="log-value">${r.SitUps}</div></div>
            <div class="log-item"><div class="log-label">Squats</div><div class="log-value">${r.Squats}</div></div>
            <div class="log-item"><div class="log-label">Sit & Reach</div><div class="log-value">${r.SitAndReach}</div></div>
            <div class="log-item"><div class="log-label">Pulse</div><div class="log-value">${r.StepUpPulseRate}</div></div>
            <div class="log-item"><div class="log-label">Total</div><div class="log-value">${r.Total}</div></div>
            <div class="log-item"><div class="log-label">Grade</div><div class="log-value">${r.Grade}</div></div>
        </div>

        <p style="text-align:center;margin-top:6px;opacity:.6;font-size:11px;">
            ${moment(r.CreatedAt).format("DD MMM YYYY • hh:mm A")}
        </p>
    </div>
    `;
}


    //---------------------------------------------------
    // --- PASSWORD MANAGEMENT LOGIC -------------------

    // ★★★ ADD THIS NEW EVENT LISTENER ★★★
    // Reset TestMaster Password Form
    document.getElementById('resetTestPasswordForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const trInput = document.getElementById('studentTrTestReset'); // Get new input ID
        const tr = trInput.value;

        if (!tr) {
            return Swal.fire('Error', 'Please enter a student TR number.', 'error');
        }

        Swal.fire({
            title: 'Are you sure?',
            text: `This will reset the FITNESS TEST password for student TR ${tr}. They will be forced to use their ITS number to log in again.`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ffc107',
            confirmButtonText: 'Yes, Reset It!',
            cancelButtonColor: '#6c757d',
        }).then(async (result) => {
            if (result.isConfirmed) {
                try {
                    // Call the new API route
                    const res = await fetch(`/api/admin/reset-testmaster-password/${tr}`, {
                        method: 'PUT',
                        credentials: 'include' // Include session cookie
                    });
                    const data = await res.json();

                    if (res.ok) {
                        Swal.fire('Success!', data.message, 'success');
                        trInput.value = ''; // Clear the input field
                    } else {
                        throw new Error(data.message);
                    }
                } catch (err) {
                    Swal.fire('Operation Failed', err.message, 'error');
                }
            }
        });
    });

    // Change Admin Password Form
    document.getElementById('changeMyPasswordForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const currentPassword = document.getElementById('currentPassword').value;
        const newPassword = document.getElementById('newAdminPassword').value;
        const confirmPassword = document.getElementById('confirmAdminPassword').value;

        if (newPassword !== confirmPassword) {
            return Swal.fire('Error', 'New passwords do not match.', 'error');
        }

        try {
            const res = await fetch('/api/admin/change-my-password', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ currentPassword, newPassword })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message);

            Swal.fire('Success!', data.message, 'success');
            e.target.reset(); // Clear the form
        } catch (err) {
            Swal.fire('Update Failed', err.message, 'error');
        }
    });

    // --- ★★★ NEW: EVALUATION BATCH MANAGEMENT LOGIC ★★★ ---

    // Get DOM elements for batch management
    const maleBatchTableBody = document.getElementById('maleBatchTableBody');
    const femaleBatchTableBody = document.getElementById('femaleBatchTableBody');
    const createMaleBatchBtn = document.getElementById('createMaleBatchBtn');
    const createFemaleBatchBtn = document.getElementById('createFemaleBatchBtn');
    const newMaleBatchNameInput = document.getElementById('newMaleBatchName');
    const newFemaleBatchNameInput = document.getElementById('newFemaleBatchName');
    
    const maleUnbatchedCountEl = document.getElementById('maleUnbatchedCount');
    const femaleUnbatchedCountEl = document.getElementById('femaleUnbatchedCount');
    const assignMaleBatchSelect = document.getElementById('assignMaleBatchSelect');
    const assignFemaleBatchSelect = document.getElementById('assignFemaleBatchSelect');
    const assignMaleBtn = document.getElementById('assignMaleBtn');
    const assignFemaleBtn = document.getElementById('assignFemaleBtn');

    // Store batch data globally on this page
    let allBatches = { Male: [], Female: [] };

    /**
     * Main function to load all batch data and unbatched counts
     */
    async function loadBatchManagementData() {
        try {
            // Fetch batches and unbatched counts in parallel
            const [batchRes, unbatchedRes] = await Promise.all([
                fetch('/api/admin/batches', { credentials: 'include' }),
                fetch('/api/admin/unbatched-records', { credentials: 'include' })
            ]);

            if (!batchRes.ok) throw new Error('Failed to load batches');
            if (!unbatchedRes.ok) throw new Error('Failed to load unbatched records');

            const batchData = await batchRes.json();
            const unbatchedData = await unbatchedRes.json();

            allBatches = batchData.data;

            // Render all components
            renderBatchTable(allBatches.Male, maleBatchTableBody, createMaleBatchBtn, newMaleBatchNameInput);
            renderBatchTable(allBatches.Female, femaleBatchTableBody, createFemaleBatchBtn, newFemaleBatchNameInput);
            
            renderUnbatchedCard(unbatchedData.data.Male, allBatches.Male, maleUnbatchedCountEl, assignMaleBatchSelect, assignMaleBtn);
            renderUnbatchedCard(unbatchedData.data.Female, allBatches.Female, femaleUnbatchedCountEl, assignFemaleBatchSelect, assignFemaleBtn);

        } catch (err) {
            console.error(err);
            Swal.fire('Error', 'Could not load batch management data. ' + err.message, 'error');
        }
    }

    /**
     * Renders the batch table for a specific gender
     */
    function renderBatchTable(batches, tableBody, createBtn, createInput) {
        tableBody.innerHTML = ''; // Clear old data
        let hasActiveBatch = false;

        if (batches.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="3">No batches found.</td></tr>';
        }

        batches.forEach(batch => {
            if (batch.IsActive) {
                hasActiveBatch = true;
            }
            
            const row = tableBody.insertRow();
            row.innerHTML = `
                <td>${batch.BatchName}</td>
                <td>
                    ${batch.IsActive
                        ? '<span class="status-badge status-active">Active</span>'
                        : '<span class="status-badge status-inactive">Locked</span>'
                    }
                </td>
                <td>
                    ${batch.IsActive
                        ? `<button class="btn btn-sm btn-warning lock-batch-btn" data-batch-id="${batch.BatchID}" data-batch-name="${batch.BatchName}">
                                🔒 Lock
                           </button>`
                        : '-'
                    }
                </td>
            `;
        });

        // Enforce Rule 2: Disable "Create" button/input if a batch is active
        createBtn.disabled = hasActiveBatch;
        createInput.disabled = hasActiveBatch;
    }

    /**
     * Renders the unbatched records card for a specific gender
     */
    function renderUnbatchedCard(count, batches, countEl, selectEl, assignBtn) {
        countEl.textContent = count || 0;
        
        // Populate the dropdown with locked batches
        selectEl.innerHTML = '<option value="">Select a locked batch...</option>';
        const lockedBatches = batches.filter(b => !b.IsActive);
        
        if (lockedBatches.length > 0) {
            lockedBatches.forEach(b => {
                selectEl.innerHTML += `<option value="${b.BatchID}">${b.BatchName}</option>`;
            });
        }

        // Disable the form if there are no records to assign or no batches to assign to
        if (count === 0 || lockedBatches.length === 0) {
            selectEl.disabled = true;
            assignBtn.disabled = true;
            if (count > 0 && lockedBatches.length === 0) {
                selectEl.innerHTML = '<option value="">No locked batches available.</option>';
            }
        } else {
            selectEl.disabled = false;
            assignBtn.disabled = false;
        }
    }

    // --- Event Listeners for Batch Management ---

    // Create Male Batch
    document.getElementById('createMaleBatchForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const batchName = document.getElementById('newMaleBatchName').value;
        await createBatch(batchName, 'Male', document.getElementById('newMaleBatchName'));
    });

    // Create Female Batch
    document.getElementById('createFemaleBatchForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const batchName = document.getElementById('newFemaleBatchName').value;
        await createBatch(batchName, 'Female', document.getElementById('newFemaleBatchName'));
    });

    // Re-usable createBatch function
    async function createBatch(BatchName, Gender, inputElement) {
        try {
            const res = await fetch('/api/admin/batches', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Credentials': 'include' },
                body: JSON.stringify({ BatchName, Gender })
            });
            const data = await res.json();

            if (!res.ok) throw new Error(data.message);

            Swal.fire('Success!', 'New active batch created.', 'success');
            if(inputElement) inputElement.value = '';
            loadBatchManagementData(); // Refresh everything
        } catch (err) {
            Swal.fire('Error Creating Batch', err.message, 'error');
        }
    }

    // Event Delegation for "Lock" buttons
    $('#maleBatchTable, #femaleBatchTable').on('click', '.lock-batch-btn', function() {
        const batchId = $(this).data('batch-id');
        const batchName = $(this).data('batch-name');
        
        Swal.fire({
            title: `Lock "${batchName}"?`,
            text: "This will lock the batch. New tests will go to 'Unbatched' until a new batch is created.",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ffc107',
            confirmButtonText: 'Yes, Lock It'
        }).then(async (result) => {
            if (result.isConfirmed) {
                try {
                    const res = await fetch(`/api/admin/batches/${batchId}/lock`, {
                        method: 'PUT',
                        credentials: 'include'
                    });
                    const data = await res.json();
                    if (!res.ok) throw new Error(data.message);

                    Swal.fire('Locked!', 'The batch has been locked.', 'success');
                    loadBatchManagementData(); // Refresh
                } catch (err) {
                    Swal.fire('Error', err.message, 'error');
                }
            }
        });
    });

    // Assign Male Unbatched
    document.getElementById('assignMaleUnbatchedForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const batchId = document.getElementById('assignMaleBatchSelect').value;
        await assignUnbatched('Male', batchId);
    });

    // Assign Female Unbatched
    document.getElementById('assignFemaleUnbatchedForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const batchId = document.getElementById('assignFemaleBatchSelect').value;
        await assignUnbatched('Female', batchId);
    });

    // Re-usable assignUnbatched function
    async function assignUnbatched(Gender, TargetBatchID) {
        if (!TargetBatchID) {
            return Swal.fire('Error', 'Please select a locked batch to assign.', 'warning');
        }

        try {
            const res = await fetch('/api/admin/assign-unbatched', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Credentials': 'include' },
                body: JSON.stringify({ Gender, TargetBatchID })
            });
            const data = await res.json();

            if (!res.ok) throw new Error(data.message);

            Swal.fire('Success!', `${data.message || 'Records'} assigned.`, 'success');
            loadBatchManagementData(); // Refresh everything
        } catch (err) {
            Swal.fire('Assignment Failed', err.message, 'error');
        }
    }
    
    // --- Initial Load for Batch Management ---
    // We add this call to the end of the existing DOMContentLoaded listener
    loadBatchManagementData();


    const categoryTableBody = document.getElementById('categoryTableBody');
    const addCategoryForm = document.getElementById('addCategoryForm');

    /**
     * Fetches and renders the comment categories table
     */
    async function loadCategories() {
        try {
            const res = await fetch('/api/admin/comment-categories', { credentials: 'include' });
            if (!res.ok) throw new Error('Failed to fetch categories');
            const { data } = await res.json();
            
            categoryTableBody.innerHTML = '';
            if (data.length === 0) {
                categoryTableBody.innerHTML = '<tr><td colspan="3">No categories created yet.</td></tr>';
                return;
            }

            data.forEach(cat => {
                const row = categoryTableBody.insertRow();
                row.innerHTML = `
                    <td>${cat.CategoryName}</td>
                    <td>${cat.Description || ''}</td>
                    <td>
                        <button class="btn btn-sm btn-outline-primary edit-category-btn" 
                                data-id="${cat.CategoryID}" 
                                data-name="${cat.CategoryName}" 
                                data-desc="${cat.Description || ''}">
                            Edit
                        </button>
                        <button class="btn btn-sm btn-outline-danger delete-category-btn" 
                                data-id="${cat.CategoryID}" 
                                data-name="${cat.CategoryName}">
                            Delete
                        </button>
                    </td>
                `;
            });
        } catch (err) {
            console.error('Error loading categories:', err);
            categoryTableBody.innerHTML = '<tr><td colspan="3" class="text-danger">Failed to load categories.</td></tr>';
        }
    }

    // admin.js

// admin.js

/**
 * Fetches and renders the evaluators table (as a simple HTML table)
 */
async function loadEvaluators() {
    const tableBody = document.getElementById('evaluatorsTableBody');
    tableBody.innerHTML = `<tr><td colspan="5" class="loader-cell"><div class="loader"></div></td></tr>`;

    try {
        const res = await fetch('/api/admin/evaluators', { credentials: 'include' });
        if (!res.ok) throw new Error('Failed to fetch evaluators');

        const { data } = await res.json();
        
        tableBody.innerHTML = ''; // Clear loader
        if (data.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="5">No evaluators found for this branch.</td></tr>';
            return;
        }
        
        data.forEach(evaluator => {
            const row = tableBody.insertRow();
            row.innerHTML = `
                <td>${evaluator.Name}</td>
                <td>${evaluator.Profession}</td>
                <td>${evaluator.Username}</td>
                <td>${evaluator.Contact || '-'}</td>
                <td>${evaluator.Email || '-'}</td>
                <td>
                    <button class="btn btn-sm btn-outline-primary edit-evaluator-btn" 
                            data-id="${evaluator.UserID}" 
                            data-name="${evaluator.Name}"
                            data-profession="${evaluator.Profession}"
                            data-username="${evaluator.Username}"
                            data-contact="${evaluator.Contact || ''}"
                            data-email="${evaluator.Email || ''}">
                        Edit
                    </button>
                </t d>
            `;
        });

    } catch (err) {
        console.error('Error loading evaluators:', err);
        tableBody.innerHTML = '<tr><td colspan="5" class="text-danger">Failed to load evaluators.</td></tr>';
    }
}


// Handle evaluator edit (Admin only)
document.getElementById('evaluatorsTableBody')?.addEventListener('click', async function (e) {

        const btn = e.target.closest('.edit-evaluator-btn');
        if (!btn) return;

        const userID = btn.dataset.id;

        const current = {
            name: btn.dataset.name,
            profession: btn.dataset.profession,
            contact: btn.dataset.contact,
            email: btn.dataset.email
        };

const { value: formData } = await Swal.fire({
    title: 'Adjust Evaluator Details',
    width: 520,
    confirmButtonText: 'Save Changes',
    cancelButtonText: 'Cancel',
    showCancelButton: true,
    focusConfirm: false,
    customClass: {
        popup: 'admin-edit-popup',
        confirmButton: 'btn btn-primary',
        cancelButton: 'btn btn-secondary'
    },
    html: `
        <style>
            .admin-edit-form {
                display: grid;
                grid-template-columns: 1fr;
                gap: 14px;
                margin-top: 10px;
            }
            .admin-edit-group label {
                font-size: 12px;
                font-weight: 600;
                color: #475569;
                margin-bottom: 4px;
                display: block;
                text-align: left;
            }
            .admin-edit-group input {
                width: 100%;
                padding: 10px 12px;
                border-radius: 8px;
                border: 1px solid #cbd5e1;
                font-size: 14px;
            }
            .admin-edit-note {
                margin-top: 12px;
                font-size: 12px;
                color: #64748b;
                text-align: center;
            }
        </style>

        <div class="admin-edit-form">
            <div class="admin-edit-group">
                <label>Name</label>
                <input id="ev-name" value="${current.name}">
            </div>

            <div class="admin-edit-group">
                <label>Profession</label>
                <input id="ev-profession" value="${current.profession}">
            </div>

            <div class="admin-edit-group">
                <label>Contact Number</label>
                <input id="ev-contact" value="${current.contact}">
            </div>

            <div class="admin-edit-group">
                <label>Email Address</label>
                <input id="ev-email" value="${current.email}">
            </div>
        </div>

        <div class="admin-edit-note">
            Changes here will <strong>not</strong> affect login access or past evaluations.
        </div>
    `,
    preConfirm: () => ({
        Name: document.getElementById('ev-name').value.trim(),
        Profession: document.getElementById('ev-profession').value.trim(),
        Contact: document.getElementById('ev-contact').value.trim(),
        Email: document.getElementById('ev-email').value.trim()
    })
});


        if (!formData) return;

        try {
            const res = await fetch(`/api/admin/evaluators/${userID}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(formData)
            });

                // Try to parse JSON response; if it fails, fall back to text.
                let result = null;
                try {
                    result = await res.json();
                } catch (parseErr) {
                    // ignore parse error - response may be plain text
                }

                if (!res.ok || !result || !result.success) {
                    // Build an informative error message using JSON message or plain text
                    let serverMsg = result && result.message ? result.message : null;
                    if (!serverMsg) {
                        try {
                            serverMsg = await (res.clone().text());
                        } catch (tErr) {
                            serverMsg = `HTTP ${res.status} ${res.statusText}`;
                        }
                    }
                    throw new Error(serverMsg || 'Update failed');
                }

            Swal.fire('Updated', 'Evaluator details updated successfully.', 'success');
            loadEvaluators(); // refresh table

        } catch (err) {
            console.error('Error updating evaluator:', err);
            Swal.fire('Error', err.message, 'error');
        }
    });

    // --- Event Listeners for Category Management ---

    // Add new category
    addCategoryForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('newCategoryName').value;
        const desc = document.getElementById('newCategoryDesc').value;

        try {
            const res = await fetch('/api/admin/comment-categories', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Credentials': 'include' },
                body: JSON.stringify({ CategoryName: name, Description: desc })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message);

            Swal.fire('Success!', 'Category added.', 'success');
            addCategoryForm.reset();
            loadCategories(); // Refresh table
        } catch (err) {
            Swal.fire('Error', err.message, 'error');
        }
    });

    // Delegated listener for Edit and Delete buttons
    $('#categoryTableBody').on('click', '.edit-category-btn', async function() {
        const id = $(this).data('id');
        const oldName = $(this).data('name');
        const oldDesc = $(this).data('desc');

        const { value: formValues } = await Swal.fire({
            title: 'Edit Category',
            html:
                `<input id="swal-name" class="swal2-input" value="${oldName}">` +
                `<textarea id="swal-desc" class="swal2-textarea" placeholder="Description">${oldDesc}</textarea>`,
            focusConfirm: false,
            showCancelButton: true,
            confirmButtonText: 'Save Changes',
            preConfirm: () => {
                return {
                    CategoryName: document.getElementById('swal-name').value,
                    Description: document.getElementById('swal-desc').value
                };
            }
        });

        if (formValues) {
            try {
                const res = await fetch(`/api/admin/comment-categories/${id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json', 'Credentials': 'include' },
                    body: JSON.stringify(formValues)
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.message);

                Swal.fire('Success!', 'Category updated.', 'success');
                loadCategories(); // Refresh table
            } catch (err) {
                Swal.fire('Error', err.message, 'error');
            }
        }
    });
    
    $('#categoryTableBody').on('click', '.delete-category-btn', function() {
        const id = $(this).data('id');
        const name = $(this).data('name');

        Swal.fire({
            title: `Delete "${name}"?`,
            text: "This action cannot be undone.",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: 'var(--danger)',
            confirmButtonText: 'Yes, delete it!'
        }).then(async (result) => {
            if (result.isConfirmed) {
                try {
                    const res = await fetch(`/api/admin/comment-categories/${id}`, {
                        method: 'DELETE',
                        credentials: 'include'
                    });
                    const data = await res.json();
                    if (!res.ok) throw new Error(data.message);
                    
                    Swal.fire('Deleted!', 'Category has been deleted.', 'success');
                    loadCategories(); // Refresh table
                } catch (err) {
                    Swal.fire('Error', err.message, 'error');
                }
            }
        });
    });


    loadCategories();
    loadEvaluators();

    // --- INACTIVE STUDENT MANAGEMENT LOGIC ---

    const usersTab = document.querySelector('#users-tab');
    
    if (usersTab) {
        usersTab.addEventListener('shown.bs.tab', function () {
            // Check if the inactiveStudentDataTable has been initialized
            if (inactiveStudentDataTable) {
                // Adjust columns to fix width
                inactiveStudentDataTable.columns.adjust().draw();
            }
        });
    }

    async function loadInactiveStudents() {
        // Check if DataTable is already initialized
        if (inactiveStudentDataTable) {
            inactiveStudentDataTable.ajax.reload();
            return;
        }

        const formatAuditDate = (value) => {
            if (!value) return 'No logs yet';
            const parsed = new Date(value);
            if (Number.isNaN(parsed.getTime())) return 'No logs yet';
            return parsed.toLocaleString('en-IN', {
                timeZone: 'Asia/Kolkata',
                year: 'numeric',
                month: 'short',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
            });
        };

        const escapeHtml = (value) => $('<div>').text(value ?? '').html();

        // Initialize DataTable
        inactiveStudentDataTable = $('#inactiveStudentTable').DataTable({
            ajax: {
                url: '/api/students/inactive',
                dataSrc: 'data' // Adjust based on your API response structure
            },
            order: [[5, 'desc']],
            columns: [
                { data: 'TR' },
                { data: 'Name' },
                { data: 'Darajah' },
                { data: 'Goal' },
                { 
                    data: 'SlotName', 
                    render: (data) => data || '-' 
                },
                {
                    data: 'LatestDeactivatedAt',
                    render: function(data, type) {
                        if (type === 'display' || type === 'filter') {
                            return formatAuditDate(data);
                        }
                        return data || ''; // Raw date string for proper sorting
                    }
                },
                {
                    data: null,
                    orderable: false,
                    render: function(data, type, row) {
                        const latestBy = row.LatestDeactivatedBy ? `<div><strong>By:</strong> ${escapeHtml(row.LatestDeactivatedBy)}</div>` : '';
                        const latestReason = row.LatestDeactivationReason
                            ? `<div><strong>Reason:</strong> ${escapeHtml(row.LatestDeactivationReason)}</div>`
                            : '<div class="text-muted">No deactivation log recorded yet.</div>';
                        const logCount = Number(row.LogCount || 0);

                        return `
                            <div class="small">
                                ${latestBy}
                                ${latestReason}
                                <a class="btn btn-link btn-sm p-0 mt-1" href="profile.html?tr=${row.TR}&tab=admin-pane">
                                    ${logCount} log${logCount === 1 ? '' : 's'}
                                </a>
                            </div>
                        `;
                    }
                },
                { 
                    data: 'TR', 
                    orderable: false,
                    render: function(data) {
                        return `<button class="btn btn-sm btn-success activate-btn" data-tr="${data}">✅ Activate</button>`;
                    }
                },
                {
                    data: 'TR',
                    orderable: false,
                    render: function(data, type, row) { 
                        // 'row.Name' is available to make the warning more specific
                        return `<button class="btn btn-sm btn-danger delete-student-btn" data-tr="${data}" data-name="${row.Name}">
                                    ❌ Revoke
                                </button>`;
                    }
                }
            ],
            responsive: true,
            destroy: true,
            language: {
                emptyTable: "No inactive students found."
            },
            initComplete: function () {
                // Optional: Add any custom initialization logic here
            }
        });
    }

    // Delegated event listener for activating a student
    $('#inactiveStudentTable').on('click', '.activate-btn', function() {
        const tr = $(this).data('tr');
        Swal.fire({
            title: 'Activate Student?', 
            text: `Are you sure you want to activate student TR ${tr}?`,
            icon: 'question', 
            showCancelButton: true, 
            confirmButtonColor: 'var(--primary)',
            cancelButtonColor: 'var(--danger)', 
            confirmButtonText: 'Yes, activate.'
        }).then(async (result) => {
            if (result.isConfirmed) {
                const res = await fetch(`/api/students/status/${tr}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ Status: 'Active' })
                });
                const data = await res.json();
                if (res.ok) {
                    Swal.fire('Activated!', data.message || 'Student status updated.', 'success');
                    inactiveStudentDataTable.ajax.reload(); // Refresh the DataTable
                } else {
                    Swal.fire('Error', 'Failed to update student: ' + (data.error || data.message), 'error');
                }
            }
        });
    });

    // Delegated event listener for REVOKING a student
    $('#inactiveStudentTable').on('click', '.delete-student-btn', function() {
        const tr = $(this).data('tr');
        const name = $(this).data('name') || `TR ${tr}`;
        const $button = $(this); // Get a reference to the button

        Swal.fire({
            title: `Revoke ${name}?`,
            html: "The student will be marked as <strong>Revoked</strong> and removed from their slot. Their data will be preserved but they will not appear in active lists.",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: 'var(--danger)',
            cancelButtonColor: 'var(--gray)',
            confirmButtonText: 'Yes, Revoke Student'
        }).then(async (result) => {
            if (result.isConfirmed) {

                // --- Show loading state on the button ---
                $button.prop('disabled', true);
                $button.html('<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Revoking...');

                try {
                    const res = await fetch(`/api/admin/revoke-student/${tr}`, {
                        method: 'PUT'
                    });

                    const data = await res.json();

                    if (res.ok && data.success) {
                        Swal.fire(
                            'Revoked!',
                            data.message,
                            'success'
                        );
                        // Refresh the table to remove the row
                        inactiveStudentDataTable.ajax.reload();
                    } else {
                        throw new Error(data.message || 'An unknown error occurred.');
                    }
                } catch (err) {
                    Swal.fire(
                        'Revoke Failed',
                        `Error: ${err.message}`,
                        'error'
                    );
                    $button.prop('disabled', false);
                    $button.html('❌ Revoke');
                }
            }
        });
    });


    // ===============================
// TRAINER MANAGEMENT
// ===============================
async function loadTrainers() {
    const tbody = document.querySelector('#trainerTable tbody');
    tbody.innerHTML = `<tr><td colspan="6" class="loader-cell"><div class="loader"></div></td></tr>`;

    try {
        const res = await fetch('/api/admin/trainers');
        const result = await res.json();
        
        if (!result.success || result.data.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6">No trainers found.</td></tr>`;
            return;
        }

        tbody.innerHTML = '';
        result.data.forEach(t => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${t.Name || 'N/A'}</td>
                <td>${t.Username}</td>
                <td>${t.Profession || '-'}</td>
                <td>${t.Contact || '-'}</td>
                <td>${t.Email || '-'}</td>
                <td>
                    <button 
                        class="btn btn-sm btn-primary view-trainer-logs-btn" 
                        data-id="${t.TrainerID}"
                        data-name="${t.Name || t.Username}"
                    >
                        <i class="fas fa-list"></i> Logs
                    </button>
                </td>
            `;

            tbody.appendChild(row);
        });

    } catch (err) {
        console.error('Error loading trainers:', err);
        tbody.innerHTML = `<tr><td colspan="6" class="text-danger">Error loading trainers.</td></tr>`;
    }
}

// delete test record
document.getElementById('deleteTestRecordBtn')?.addEventListener('click', async () => {
    const id = document.getElementById('deleteTestLogInput').value.trim();
    if (!id) return Swal.fire("Error", "Enter a TestLog ID first!", "error");

    const confirm = await Swal.fire({
        title: `Delete Log #${id}?`,
        text: "This action is permanent.",
        icon: "warning",
        showCancelButton: true
    });

    if (!confirm.isConfirmed) return;

    const res = await fetch(`/api/admin/delete-test-record/${id}`, { method: 'DELETE' });
    const data = await res.json();

    if (data.success) Swal.fire("Done!", "Test record removed.", "success");
    else Swal.fire("Failed", data.message, "error");
});

// Load when tab is clicked
document.getElementById('trainer-tab')?.addEventListener('click', loadTrainers);

});
