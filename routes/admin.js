// routes/admin.js
const express = require('express');
const router = express.Router();
const { pool } = require('../utils/db.js'); // Get the DB pool
const sql = require('mssql');
const bcrypt = require('bcrypt'); // This file needs bcrypt

// --- All your admin routes will go here ---

router.delete('/api/admin/delete-student/:tr', async (req, res, next) => {
  if (!req.session.user || req.session.user.Role !== 'Admin') {
    return res.status(403).json({ success: false, message: 'Forbidden: Admin access required.' });
  }

  const { tr } = req.params;
  const transaction = new sql.Transaction(pool);

  try {
    await transaction.begin();
    const request = new sql.Request(transaction);
    request.input('TR', sql.Int, tr);

    const result = await request.query('DELETE FROM Master WHERE TR = @TR');
    await transaction.commit();

    if (result.rowsAffected[0] > 0)
      res.json({ success: true, message: `Student TR ${tr} and all associated data have been permanently deleted.` });
    else
      res.status(404).json({ success: false, message: 'Student TR not found.' });

  } catch (err) {
    await transaction.rollback();
    console.error('Error during cascade delete:', err);
    next(err);
  }
});

// For an Admin to change their own password later
router.put('/api/admin/change-my-password', async (req, res, next) => {
    if (!req.session.user || req.session.user.Role !== 'Admin') {
        return res.status(403).json({ success: false, message: 'Admin access required.' });
    }
    const { Username } = req.session.user;
    const { currentPassword, newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
        return res.status(400).json({ success: false, message: 'New password must be at least 6 characters long.' });
    }

    try {
        const result = await pool.request().input('Username', sql.NVarChar, Username).query('SELECT Password FROM PassBank WHERE Username = @Username');
        if (result.recordset.length === 0) {
            return res.status(404).json({ success: false, message: 'User not found.' });
        }

        const match = await bcrypt.compare(currentPassword, result.recordset[0].Password);
        if (!match) {
            return res.status(401).json({ success: false, message: 'Incorrect current password.' });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await pool.request()
            .input('Username', sql.NVarChar, Username)
            .input('HashedPassword', sql.NVarChar, hashedPassword)
            .query('UPDATE PassBank SET Password = @HashedPassword WHERE Username = @Username');
        
        res.json({ success: true, message: 'Your password has been changed successfully.' });

    } catch (err) {
        next(err);
    }
});

// 1. SECURED: Get all users
router.get('/api/admin/users/:branch', async (req, res, next) => {
    // --- NEW: Security Check ---
    if (!req.session.user || req.session.user.Role !== 'Admin') {
        return res.status(403).json({ error: 'Forbidden: Admin access required.' });
    }
    // --- End Security Check ---

    const branch = req.params.branch;
    try {
        const result = await pool.request() 
            .input('branch', sql.NVarChar(50), branch)
            .query(`SELECT Username, Gender, Role FROM PassBank WHERE Branch = @branch`);
        res.json(result.recordset);
    } catch (err) {
        next(err);
    }
});


// REPLACE your old /api/admin/add-user route
router.post('/api/admin/add-user', async (req, res, next) => {
        if (!req.session.user || req.session.user.Role !== 'Admin') {
        return res.status(403).json({ success: false, message: 'Forbidden: Admin access required.' });
    }
    const { username, gender, role, branch } = req.body;
    try {
        const checkRequest = pool.request();
        checkRequest.input('username', sql.NVarChar(50), username);
        const existingUser = await checkRequest.query('SELECT 1 FROM PassBank WHERE Username = @username');

        if (existingUser.recordset.length > 0) {
            return res.status(409).json({ success: false, message: 'This username is already taken.' });
        }

        // Hash the default password
        const defaultPassword = "jamea1446";
        const hashedPassword = await bcrypt.hash(defaultPassword, 10);

        await pool.request()
            .input('username', sql.NVarChar(50), username)
            .input('password', sql.NVarChar(100), hashedPassword) // Use the hashed default password
            .input('gender', sql.NVarChar(10), gender)
            .input('role', sql.NVarChar(20), role)
            .input('branch', sql.NVarChar(50), branch)
            .query(`
                INSERT INTO PassBank (Username, Password, Gender, Role, Branch, IsDefaultPassword)
                VALUES (@username, @password, @gender, @role, @branch, 1) -- Set the flag to 1
            `);
        res.json({ success: true });
    } catch (err) {
        next(err);
    }
});


router.delete('/api/admin/delete-user/:username', async (req, res) => {
        // --- NEW: Security Check ---
    if (!req.session.user || req.session.user.Role !== 'Admin') {
        return res.status(403).json({ error: 'Forbidden: Admin access required.' });
    }
    // --- End Security Check ---

    const username = req.params.username;
    try {
        await pool.request()
            .input('username', sql.NVarChar(50), username)
            .query(`DELETE FROM PassBank WHERE Username = @username`);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Delete failed' });
    }
});

// Replace the old /api/staff/reset-student-password/:tr route
router.put('/api/staff/reset-student-password/:tr', async (req, res, next) => {
    // Only allow Admins to perform this action
    if (!req.session.user || req.session.user.Role !== 'Admin') {
        return res.status(403).json({ success: false, message: 'Forbidden: Admin access required.' });
    }
    
    const { tr } = req.params;
    const { Branch: adminBranch } = req.session.user;

    try {
        const request = pool.request();
        request.input('TR', sql.Int, tr);

        // --- NEW: Verify the student belongs to the admin's branch before resetting ---
        const studentResult = await request.query('SELECT Branch FROM Master WHERE TR = @TR');

        if (studentResult.recordset.length === 0) {
            return res.status(404).json({ success: false, message: 'Student TR not found.' });
        }

        const studentBranch = studentResult.recordset[0].Branch;
        if (studentBranch !== adminBranch) {
            return res.status(403).json({ success: false, message: `Forbidden: You can only reset passwords for students in your own branch (${adminBranch}).` });
        }
        // --- End of new security check ---

        // If authorized, proceed with the reset
        await request.query('UPDATE Master SET Password = NULL, HasLoggedInBefore = 0 WHERE TR = @TR');
        
        res.json({ success: true, message: `Password for TR ${tr} has been reset. The student can now log in using their TR as the password.` });
    } catch (err) {
        next(err);
    }
});


router.get('/api/students/inactive', async (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ error: 'User session missing' });
  }

  const { Branch: branch, Role } = req.session.user;

  try {
    const request = pool.request();
    request.input('Branch', sql.NVarChar(50), branch);

    let query = `
      SELECT m.*, s.SlotName 
      FROM Master m
      LEFT JOIN Slots s ON m.SlotID = s.SlotID
      WHERE m.Branch = @Branch AND m.Status = 'Inactive'
    `;

    // For staff → still restrict by gender
    if (Role === 'Staff') {
      request.input('Gender', sql.NVarChar(10), req.session.user.Gender);
      query = `
        SELECT m.*, s.SlotName 
        FROM Master m
        LEFT JOIN Slots s ON m.SlotID = s.SlotID
        WHERE m.Branch = @Branch 
          AND m.Gender = @Gender
          AND m.Status = 'Inactive'
      `;
    }

    const result = await request.query(query);
    res.json({ success: true, data: result.recordset });

  } catch (err) {
    console.error('Error fetching inactive students:', err);
    res.status(500).json({ error: 'Failed to fetch inactive students' });
  }
});

// CORRECTED VERSION
router.put('/api/students/status/:TR', async (req, res) => {
    const { TR } = req.params;
    const { Status } = req.body;

    if (!TR || !Status) {
        return res.status(400).json({ error: 'TR and Status are required' });
    }

    try {


        // --- CHANGE THIS LINE ---
        const request = pool.request(); // Use the global sql object

        request.input('TR', sql.Int, TR);
        request.input('Status', sql.NVarChar(20), Status);

        await request.query(`
            UPDATE Master
            SET
                Status = @Status,
                SlotID = CASE WHEN @Status = 'Inactive' THEN NULL ELSE SlotID END
            WHERE TR = @TR
        `);

        res.json({ success: true, message: `Student marked as ${Status}` });
    } catch (err) {
        console.error('Error updating student status:', err.message);
        res.status(500).json({ error: 'Failed to update student status' });
    }
});


// --- End of routes ---

module.exports = router; // Export the router