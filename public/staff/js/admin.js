document.addEventListener("DOMContentLoaded", () => {
    // Declare inactiveStudentDataTable at the top to avoid reference errors
    let inactiveStudentDataTable = null;

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
    loadAdminUsers();
    loadInactiveStudents();

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


    // --- USER (ROLE) MANAGEMENT LOGIC ---

    async function loadAdminUsers() {
        const tableBody = document.querySelector('#adminUserTable tbody');
        tableBody.innerHTML = `<tr><td colspan="4" class="loader-cell"><div class="loader"></div></td></tr>`;
        try {
            const branch = user.Branch;
            const currentUser = user.Username;

            const res = await fetch(`/api/admin/users/${branch}`);
            const users = await res.json();
            
            const filteredUsers = users.filter(user => user.Username !== currentUser);
            
            tableBody.innerHTML = '';
            if (!filteredUsers || filteredUsers.length === 0) {
                tableBody.innerHTML = `<tr><td colspan="4">No other users found for this branch.</td></tr>`;
                return;
            }

            filteredUsers.forEach(user => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${user.Username}</td>
                    <td>${user.Gender}</td>
                    <td>${user.Role}</td>
                    <td>
                        <button class="btn btn-sm btn-danger delete-user-btn" data-username="${user.Username}">
                            Delete
                        </button>
                    </td>
                `;
                tableBody.appendChild(row);
            });
        } catch (err) {
            console.error('Failed to load users:', err);
            tableBody.innerHTML = `<tr><td colspan="4" style="color: var(--danger);">Error loading users.</td></tr>`;
        }
    }

    // Event listener for adding a new user
    document.getElementById('adminAddForm').addEventListener('submit', async (e) => {
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
                loadAdminUsers(); // Refresh the user list
                e.target.reset(); 
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
    $('#adminUserTable').on('click', '.delete-user-btn', function() {
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
                    loadAdminUsers(); // Refresh the user list
                } else {
                    Swal.fire('Error', 'Deletion failed: ' + data.message, 'error');
                }
            }
        });
    });

    // Reset Password Form
    document.getElementById('resetPasswordForm').addEventListener('submit', async (e) => {
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


    // ★★★ ADD THIS NEW EVENT LISTENER ★★★
    // Reset TestMaster Password Form
    document.getElementById('resetTestPasswordForm').addEventListener('submit', async (e) => {
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
    document.getElementById('changeMyPasswordForm').addEventListener('submit', async (e) => {
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
    document.getElementById('createMaleBatchForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const batchName = document.getElementById('newMaleBatchName').value;
        await createBatch(batchName, 'Male', document.getElementById('newMaleBatchName'));
    });

    // Create Female Batch
    document.getElementById('createFemaleBatchForm').addEventListener('submit', async (e) => {
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
    document.getElementById('assignMaleUnbatchedForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const batchId = document.getElementById('assignMaleBatchSelect').value;
        await assignUnbatched('Male', batchId);
    });

    // Assign Female Unbatched
    document.getElementById('assignFemaleUnbatchedForm').addEventListener('submit', async (e) => {
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
            `;
        });

    } catch (err) {
        console.error('Error loading evaluators:', err);
        tableBody.innerHTML = '<tr><td colspan="5" class="text-danger">Failed to load evaluators.</td></tr>';
    }
}

    // --- Event Listeners for Category Management ---

    // Add new category
    addCategoryForm.addEventListener('submit', async (e) => {
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

        // Initialize DataTable
        inactiveStudentDataTable = $('#inactiveStudentTable').DataTable({
            ajax: {
                url: '/api/students/inactive',
                dataSrc: 'data' // Adjust based on your API response structure
            },
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
                                    ❌ Delete
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
                    Swal.fire('Error', 'Failed to update student: ' + data.message, 'error');
                }
            }
        });
    });

    // Delegated event listener for PERMANENTLY DELETING a student
    $('#inactiveStudentTable').on('click', '.delete-student-btn', function() {
        const tr = $(this).data('tr');
        const name = $(this).data('name') || `TR ${tr}`;
        const $button = $(this); // Get a reference to the button

        Swal.fire({
            title: `<span style="color: var(--danger);">PERMANENTLY DELETE</span> ${name}?`,
            html: "This action is <strong>irreversible</strong>. All data (attendance, workout plans, achievements, test records, etc.) for this student will be <strong>permanently erased</strong>.",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: 'var(--danger)', 
            cancelButtonColor: 'var(--gray)',
            confirmButtonText: 'Yes, I understand. Delete permanently.'
        }).then(async (result) => {
            if (result.isConfirmed) {
                
                // --- Show loading state on the button ---
                $button.prop('disabled', true);
                // Use Bootstrap's built-in spinner
                $button.html('<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Deleting...');

                try {
                    const res = await fetch(`/api/admin/delete-student/${tr}`, {
                        method: 'DELETE'
                    });

                    const data = await res.json();

                    if (res.ok && data.success) {
                        Swal.fire(
                            'Deleted!',
                            data.message,
                            'success'
                        );
                        // Refresh the table to remove the row
                        inactiveStudentDataTable.ajax.reload();
                    } else {
                        // API returned an error (e.g., 403, 404, 500)
                        throw new Error(data.message || 'An unknown error occurred.');
                    }
                } catch (err) {
                    Swal.fire(
                        'Deletion Failed',
                        `Error: ${err.message}. The student was not deleted.`,
                        'error'
                    );
                    // Restore the button to its original state on failure
                    $button.prop('disabled', false);
                    $button.html('❌ Delete');
                }
            }
        });
    });
});