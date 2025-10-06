document.addEventListener("DOMContentLoaded", () => {

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
                // Note: I've replaced the onclick="" with a class and data-attribute for a better event listener
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
            // Replace the existing event listener in admin.js
            document.getElementById('adminAddForm').addEventListener('submit', async (e) => {
                e.preventDefault();
                const newUser = {
                    username: document.getElementById('newUsername').value.trim(),
                    // The password line is now removed, as the backend handles it
                    gender: document.getElementById('newGender').value,
                    role: document.getElementById('newRole').value,
                    branch: user.Branch // 'user' is defined at the top of your admin.js
                };
                
                // The rest of the fetch call and Swal logic remains exactly the same
                const res = await fetch('/api/admin/add-user', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(newUser)
                });
                const data = await res.json();
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
            });

    // Delegated event listener for deleting a user
    $('#adminUserTable').on('click', '.delete-user-btn', function() {
        const username = $(this).data('username'); // Get username from data-attribute
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


    // Add this new code block to admin.js

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

        // Add this to admin.js
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

    // --- INACTIVE STUDENT MANAGEMENT LOGIC ---

    async function loadInactiveStudents() {
        const tableBody = document.querySelector('#inactiveStudentTable tbody');
        tableBody.innerHTML = `<tr><td colspan="6" class="loader-cell"><div class="loader"></div></td></tr>`;
        try {
            const res = await fetch('/api/students/inactive');
            const response = await res.json();
            if (!response.success || !Array.isArray(response.data)) {
                throw new Error('Failed to fetch inactive students.');
            }
            const students = response.data;
            tableBody.innerHTML = '';
            if (students.length === 0) {
                 tableBody.innerHTML = `<tr><td colspan="6">No inactive students found.</td></tr>`;
                 return;
            }
            students.forEach(s => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${s.TR}</td>
                    <td>${s.Name}</td>
                    <td>${s.Darajah}</td>
                    <td>${s.Goal}</td>
                    <td>${s.SlotName || '-'}</td>
                    <td><button class="btn btn-sm btn-success activate-btn" data-tr="${s.TR}">✅ Activate</button></td>
                `;
                tableBody.appendChild(row);
            });
        } catch (err) {
            console.error('loadInactiveStudents error:', err);
            tableBody.innerHTML = `<tr><td colspan="6" style="color: var(--danger);">Error loading inactive students.</td></tr>`;
        }
    }

    // Delegated event listener for activating a student
    $('#inactiveStudentTable').on('click', '.activate-btn', function() {
        const tr = $(this).data('tr');
        Swal.fire({
            title: 'Activate Student?', text: `Are you sure you want to activate student TR ${tr}?`,
            icon: 'question', showCancelButton: true, confirmButtonColor: 'var(--primary)',
            cancelButtonColor: 'var(--danger)', confirmButtonText: 'Yes, activate.'
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
                    loadInactiveStudents(); // Refresh the list of inactive students
                } else {
                    Swal.fire('Error', 'Failed to update student: ' + data.message, 'error');
                }
            }
        });
    });
});