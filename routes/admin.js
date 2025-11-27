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


// routes/admin.js

router.delete('/api/admin/delete-user/:username', async (req, res, next) => {
    if (!req.session.user || req.session.user.Role !== 'Admin') {
        return res.status(403).json({ success: false, message: 'Forbidden: Admin access required.' });
    }

    const username = req.params.username;

    try {
        const request = pool.request();
        request.input('username', sql.NVarChar(50), username);

        // 1. Just delete the user from PassBank.
        // The "ON DELETE SET NULL" rule we added will automatically
        // set their UserID in the Evaluators table to NULL.
        const result = await request.query(`DELETE FROM PassBank WHERE Username = @username`);

        if (result.rowsAffected[0] === 0) {
             return res.status(404).json({ success: false, message: 'User not found.' });
        }

        // 2. The login is gone, but all comments remain.
        res.json({ success: true, message: 'User has been deleted.' });

    } catch (err) {
        console.error('Failed to delete user:', err);
        // This will catch any *other* constraints you might have
        if (err.number === 547) {
            return res.status(409).json({ success: false, message: 'Cannot delete this user. They are still referenced by other parts of the system.' });
        }
        next(err);
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


// ★★★ ADD THIS NEW ROUTE ★★★
// Resets a password in the TestMaster table
router.put('/api/admin/reset-testmaster-password/:tr', async (req, res, next) => {
    // 1. Check for Admin role
    if (!req.session.user || req.session.user.Role !== 'Admin') {
        return res.status(403).json({ success: false, message: 'Forbidden: Admin access required.' });
    }
    
    const { tr } = req.params;
    const { Branch: adminBranch } = req.session.user;

    try {
        const request = pool.request();
        request.input('TR', sql.Int, tr);

        // 2. Security Check: Verify student is in the admin's branch
        const studentResult = await request.query('SELECT Branch FROM TestMaster WHERE TR = @TR');

        if (studentResult.recordset.length === 0) {
            return res.status(404).json({ success: false, message: 'Student TR not found in TestMaster.' });
        }

        const studentBranch = studentResult.recordset[0].Branch;
        if (studentBranch !== adminBranch) {
            return res.status(403).json({ success: false, message: `Forbidden: You can only reset passwords for students in your own branch (${adminBranch}).` });
        }

        // 3. Run the reset query as requested
        await request.query(`
            UPDATE TestMaster 
            SET Password = NULL, IsFirstLogin = 1 
            WHERE TR = @TR
        `);
        
        res.json({ success: true, message: `Fitness Test password for TR ${tr} has been reset. The student can now log in using their ITS number.` });
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

// =================================================================== //
// --- 👑 ADMIN Batch Management API Routes ---
// =================================================================== //

/**
 * Helper middleware to check if the user is an Admin.
 */
const isAdmin = (req, res, next) => {
    if (!req.session.user || req.session.user.Role !== 'Admin') {
        return res.status(403).json({ success: false, message: 'Forbidden: Access restricted to Admins.' });
    }
    // Pass admin details to the next function
    req.Branch = req.session.user.Branch;
    req.Username = req.session.user.Username;
    next();
};

// routes/admin.js

/**
 * GET: Fetches all evaluators for the Admin's branch.
 */
router.get('/api/admin/evaluators', isAdmin, async (req, res) => {
    try {
        const result = await pool.request()
            .input('Branch', sql.NVarChar(50), req.Branch)
            .query(`
                SELECT 
                    E.Name, 
                    E.Profession, 
                    E.Contact, 
                    E.Email,
                    P.Username
                FROM Evaluators E
                JOIN PassBank P ON E.UserID = P.UserID
                WHERE P.Branch = @Branch AND P.Role = 'Evaluator'
                ORDER BY E.Name
            `);

        res.json({ success: true, data: result.recordset });
    } catch (err) {
        console.error('Error fetching admin evaluators:', err);
        res.status(500).json({ success: false, message: 'Failed to fetch evaluators.' });
    }
});

/**
 * GET: Fetches all batches for the Admin's branch.
 * This populates the new management page.
 */
router.get('/api/admin/batches', isAdmin, async (req, res) => {
    try {
        const result = await pool.request()
            .input('Branch', sql.NVarChar(50), req.Branch)
            .query(`
                SELECT * FROM EvaluationBatches
                WHERE Branch = @Branch
                ORDER BY Gender, IsActive DESC, CreatedAt DESC
            `);
        
        // Group the results by gender for the frontend
        const batches = {
            Male: result.recordset.filter(b => b.Gender === 'Male'),
            Female: result.recordset.filter(b => b.Gender === 'Female')
        };
        
        res.json({ success: true, data: batches });
    } catch (err) {
        console.error('Error fetching admin batches:', err);
        res.status(500).json({ success: false, message: 'Failed to fetch batches.' });
    }
});

/**
 * POST: Creates a new, active batch.
 * Enforces your rule: only one batch can be active at a time per section.
 */
router.post('/api/admin/batches', isAdmin, async (req, res) => {
    const { BatchName, Gender } = req.body;

    if (!BatchName || !Gender) {
        return res.status(400).json({ success: false, message: 'Batch Name and Gender are required.' });
    }

    const transaction = new sql.Transaction(pool);
    try {
        await transaction.begin();
        
        // Rule 2 Check: See if an active batch already exists
        const checkRequest = new sql.Request(transaction);
        checkRequest.input('Branch', sql.NVarChar(50), req.Branch);
        checkRequest.input('Gender', sql.NVarChar(10), Gender);
        
        const activeCheck = await checkRequest.query(`
            SELECT 1 FROM EvaluationBatches
            WHERE Branch = @Branch AND Gender = @Gender AND IsActive = 1
        `);

        if (activeCheck.recordset.length > 0) {
            await transaction.rollback();
            return res.status(400).json({ success: false, message: 'An active batch already exists for this section. You must lock it first.' });
        }

        // Create the new batch
        const createRequest = new sql.Request(transaction);
        createRequest.input('BatchName', sql.NVarChar(100), BatchName);
        createRequest.input('Branch', sql.NVarChar(50), req.Branch);
        createRequest.input('Gender', sql.NVarChar(10), Gender);
        createRequest.input('CreatedBy', sql.NVarChar(50), req.Username);

        await createRequest.query(`
            INSERT INTO EvaluationBatches (BatchName, Branch, Gender, IsActive, CreatedBy)
            VALUES (@BatchName, @Branch, @Gender, 1, @CreatedBy)
        `);

        await transaction.commit();
        res.status(201).json({ success: true, message: 'New batch created and set to active.' });

    } catch (err) {
        await transaction.rollback();
        console.error('Error creating batch:', err);
        res.status(500).json({ success: false, message: 'Failed to create batch.' });
    }
});

/**
 * PUT: Locks an active batch (sets IsActive = 0).
 */
router.put('/api/admin/batches/:id/lock', isAdmin, async (req, res) => {
    const { id } = req.params; // BatchID

    try {
        const result = await pool.request()
            .input('BatchID', sql.Int, id)
            .input('Branch', sql.NVarChar(50), req.Branch)
            .query(`
                UPDATE EvaluationBatches
                SET IsActive = 0
                WHERE BatchID = @BatchID AND Branch = @Branch
            `);
        
        if (result.rowsAffected[0] === 0) {
            return res.status(404).json({ success: false, message: 'Batch not found or not in your branch.' });
        }

        res.json({ success: true, message: 'Batch has been locked.' });
    } catch (err) {
        console.error('Error locking batch:', err);
        res.status(500).json({ success: false, message: 'Failed to lock batch.' });
    }
});

/**
 * GET: Gets counts of unbatched records, grouped by gender.
 */
router.get('/api/admin/unbatched-records', isAdmin, async (req, res) => {
    try {
        const result = await pool.request()
            .input('Branch', sql.NVarChar(50), req.Branch)
            .query(`
                SELECT Gender, COUNT(*) AS UnbatchedCount 
                FROM TestRecords
                WHERE BatchID IS NULL 
                  AND Branch = @Branch
                  AND SubmittedBy = 'Trainer'
                GROUP BY Gender
            `);

        const counts = {
            Male: 0,
            Female: 0
        };

        for (const row of result.recordset) {
            if (row.Gender === 'Male') counts.Male = row.UnbatchedCount;
            if (row.Gender === 'Female') counts.Female = row.UnbatchedCount;
        }

        res.json({ success: true, data: counts });
    } catch (err) {
        console.error('Error fetching unbatched records:', err);
        res.status(500).json({ success: false, message: 'Failed to fetch unbatched records.' });
    }
});

/**
 * POST: Assigns unbatched records to a *locked* batch.
 */
router.post('/api/admin/assign-unbatched', isAdmin, async (req, res) => {
    const { Gender, TargetBatchID } = req.body;

    if (!Gender || !TargetBatchID) {
        return res.status(400).json({ success: false, message: 'Gender and TargetBatchID are required.' });
    }

    const transaction = new sql.Transaction(pool);
    try {
        await transaction.begin();

        // 1. Verify the target batch is valid (must be locked)
        const checkRequest = new sql.Request(transaction);
        checkRequest.input('TargetBatchID', sql.Int, TargetBatchID);
        checkRequest.input('Branch', sql.NVarChar(50), req.Branch);

        const batchCheck = await checkRequest.query(`
            SELECT 1 FROM EvaluationBatches
            WHERE BatchID = @TargetBatchID 
              AND Branch = @Branch 
              AND IsActive = 0
        `);

        if (batchCheck.recordset.length === 0) {
            await transaction.rollback();
            return res.status(400).json({ success: false, message: 'Invalid target: Batch is active, not found, or not in your branch.' });
        }

        // 2. Update the records
        const updateRequest = new sql.Request(transaction);
        updateRequest.input('TargetBatchID', sql.Int, TargetBatchID);
        updateRequest.input('Branch', sql.NVarChar(50), req.Branch);
        updateRequest.input('Gender', sql.NVarChar(10), Gender);

        const updateResult = await updateRequest.query(`
            UPDATE TestRecords
            SET BatchID = @TargetBatchID
            WHERE BatchID IS NULL
              AND Branch = @Branch
              AND Gender = @Gender
              AND SubmittedBy = 'Trainer'
        `);

        await transaction.commit();
        res.json({ success: true, message: `${updateResult.rowsAffected[0]} records have been assigned.` });

    } catch (err) {
        await transaction.rollback();
        console.error('Error assigning unbatched records:', err);
        res.status(500).json({ success: false, message: 'Failed to assign records.' });
    }
});

// =================================================================== //
// --- 👑 ADMIN Comment Category Management API Routes (NEW) ---
// =================================================================== //

/**
 * GET: Fetches all comment categories
 */
router.get('/api/admin/comment-categories', isAdmin, async (req, res) => {
    try {
        const result = await pool.request()
            .query('SELECT * FROM CommentCategories ORDER BY CategoryName');
        res.json({ success: true, data: result.recordset });
    } catch (err) {
        console.error('Error fetching categories:', err);
        res.status(500).json({ success: false, message: 'Failed to fetch categories.' });
    }
});

/**
 * POST: Creates a new comment category
 */
router.post('/api/admin/comment-categories', isAdmin, async (req, res) => {
    const { CategoryName, Description } = req.body;
    if (!CategoryName) {
        return res.status(400).json({ success: false, message: 'Category Name is required.' });
    }

    try {
        await pool.request()
            .input('CategoryName', sql.NVarChar(100), CategoryName)
            .input('Description', sql.NVarChar(255), Description || null)
            .query('INSERT INTO CommentCategories (CategoryName, Description) VALUES (@CategoryName, @Description)');
        
        res.status(201).json({ success: true, message: 'Category created successfully.' });
    } catch (err) {
        console.error('Error creating category:', err);
        res.status(500).json({ success: false, message: 'Failed to create category.' });
    }
});

/**
 * PUT: Updates an existing comment category
 */
router.put('/api/admin/comment-categories/:id', isAdmin, async (req, res) => {
    const { id } = req.params;
    const { CategoryName, Description } = req.body;
    if (!CategoryName) {
        return res.status(400).json({ success: false, message: 'Category Name is required.' });
    }

    try {
        await pool.request()
            .input('CategoryID', sql.Int, id)
            .input('CategoryName', sql.NVarChar(100), CategoryName)
            .input('Description', sql.NVarChar(255), Description || null)
            .query('UPDATE CommentCategories SET CategoryName = @CategoryName, Description = @Description WHERE CategoryID = @CategoryID');
        
        res.json({ success: true, message: 'Category updated successfully.' });
    } catch (err) {
        console.error('Error updating category:', err);
        res.status(500).json({ success: false, message: 'Failed to update category.' });
    }
});

/**
 * DELETE: Deletes a comment category
 */
router.delete('/api/admin/comment-categories/:id', isAdmin, async (req, res) => {
    const { id } = req.params;

    try {
        const request = pool.request();
        request.input('CategoryID', sql.Int, id);

        // First, check if this category is being used
        const checkResult = await request.query('SELECT 1 FROM Evaluations WHERE CategoryID = @CategoryID');
        
        if (checkResult.recordset.length > 0) {
            return res.status(409).json({ success: false, message: 'Cannot delete: This category is already being used in evaluations.' });
        }

        // If not used, delete it
        await request.query('DELETE FROM CommentCategories WHERE CategoryID = @CategoryID');
        
        res.json({ success: true, message: 'Category deleted successfully.' });
    } catch (err) {
        console.error('Error deleting category:', err);
        res.status(500).json({ success: false, message: 'Failed to delete category.' });
    }
});

/**
 * GET: Fetches a complete audit log of all evaluation comments
 * for the admin's branch, filterable by gender.
 */
router.get('/api/admin/evaluation-logs', isAdmin, async (req, res) => {
    const { gender } = req.query; // Expecting ?gender=Male or ?gender=Female

    if (!gender) {
        return res.status(400).json({ success: false, message: 'Gender query parameter is required.' });
    }

    try {
        const request = pool.request();
        // Use the Admin's branch from their session (via isAdmin middleware)
        request.input('Branch', sql.NVarChar(50), req.Branch);
        request.input('Gender', sql.NVarChar(10), gender);

        // This query joins all 6 tables you need
        const result = await request.query(`
            SELECT 
                E.EvaluationID,
                EV.Name AS EvaluatorName,
                CC.CategoryName,
                TR.TR,
                TM.Name AS StudentName,
                E.CommentText AS Remark,
                ISNULL(EB.BatchName, 'Unbatched') AS BatchName
            FROM 
                Evaluations E
            JOIN 
                Evaluators EV ON E.EvaluatorID = EV.EvaluatorID
            JOIN 
                CommentCategories CC ON E.CategoryID = CC.CategoryID
            JOIN 
                TestRecords TR ON E.LogID = TR.TestLog
            JOIN 
                TestMaster TM ON TR.TR = TM.TR
            LEFT JOIN 
                EvaluationBatches EB ON TR.BatchID = EB.BatchID
            WHERE
                TR.Branch = @Branch
                AND TR.Gender = @Gender
            ORDER BY
                E.DateEvaluated DESC;
        `);

        res.json({ success: true, data: result.recordset });

    } catch (err) {
        console.error('Error fetching evaluation audit log:', err);
        res.status(500).json({ success: false, message: 'Failed to fetch evaluation log.' });
    }
});



/**
 * GET: Fetches evaluation batch overview stats for the Admin's entire branch (both genders).
 * This is for the admin-level "evaluation-log" page.
 */
router.get('/api/admin/evaluation-batches-overview', isAdmin, async (req, res) => {
    try {
        const request = pool.request();
        // Get Branch from the isAdmin middleware
        request.input('Branch', sql.NVarChar(50), req.Branch);

        // This query is based on the evaluator's /api/evaluation/batches route,
        // but modified to remove the gender filter and group by gender.
        const result = await request.query(`
            -- 1. Get all Trainer-submitted records for the ADMIN'S BRANCH
            WITH TrainerRecords AS (
                SELECT TestLog, BatchID, Gender
                FROM TestRecords
                WHERE SubmittedBy = 'Trainer'
                  AND Branch = @Branch
                  -- No Gender filter here --
            ),
            -- 2. Check their evaluation status
            RecordStatus AS (
                SELECT 
                    tr.BatchID,
                    tr.Gender,
                    CASE
                        WHEN EXISTS (SELECT 1 FROM Evaluations e WHERE e.LogID = tr.TestLog) THEN 'In Progress'
                        ELSE 'Pending'
                    END AS Status
                FROM TrainerRecords tr
            )
            -- 3. Group by BatchID AND Gender, and count
            SELECT 
                rs.BatchID,
                rs.Gender,
                ISNULL(eb.BatchName, 'Unbatched Records') AS BatchName,
                eb.IsActive,
                COUNT(*) AS TotalCount,
                COUNT(CASE WHEN Status = 'In Progress' THEN 1 END) AS PartialCount,
                COUNT(CASE WHEN Status = 'Pending' THEN 1 END) AS PendingCount
            FROM RecordStatus rs
            LEFT JOIN EvaluationBatches eb ON rs.BatchID = eb.BatchID
            GROUP BY rs.BatchID, rs.Gender, eb.BatchName, eb.IsActive
            ORDER BY rs.Gender, eb.IsActive DESC, rs.BatchID DESC;;
        `);

        res.json({ success: true, data: result.recordset });

    } catch (err) {
        console.error('Error fetching admin evaluation batches overview:', err);
        res.status(500).json({ success: false, message: 'Failed to fetch evaluation batch overview.' });
    }
});



// =================================================================== //
// --- 🏋️ TRAINER MANAGEMENT API Routes (NEW) ---
// =================================================================== //

/**
 * GET: Fetch all Trainers for Admin branch (like Evaluators page)
 */
router.get("/api/admin/trainers", isAdmin, async (req, res) => {
    try {
        const result = await pool.request()
            .input("Branch", sql.NVarChar(50), req.Branch)
            .query(`
                SELECT 
                    T.TrainerID,
                    T.Name,
                    T.Profession,
                    T.Contact,
                    T.Email,
                    P.Username,
                    P.Gender,
                    P.Branch
                FROM Trainers T
                JOIN PassBank P ON T.UserID = P.UserID
                WHERE P.Branch = @Branch AND P.Role = 'Trainer'
                ORDER BY T.Name ASC
            `);

        res.json({ success: true, data: result.recordset });
    } catch (err) {
        console.error("Error fetching trainers:", err);
        res.status(500).json({ success: false, message: "Failed to fetch trainers." });
    }
});


router.delete("/api/admin/delete-test-record/:testLog", isAdmin, async (req, res) => {
    const { testLog } = req.params;
    let transaction;

    try {
        // Branch Safety Check
        const verify = await pool.request()
            .input("TestLog", sql.Int, testLog)
            .input("Branch", sql.NVarChar(50), req.Branch)
            .query(`
                SELECT * 
                FROM TestRecords
                WHERE TestLog = @TestLog AND Branch = @Branch
            `);

        if (verify.recordset.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Test record not found or does not belong to your branch."
            });
        }

        transaction = new sql.Transaction(pool);
        await transaction.begin();

        const request = new sql.Request(transaction);
        request.input("TestLog", sql.Int, testLog);

        await request.query(`DELETE FROM TestActivityLog WHERE TestLog = @TestLog`);
        await request.query(`DELETE FROM Evaluations WHERE LogID = @TestLog`);
        
        const result = await request.query(`DELETE FROM TestRecords WHERE TestLog = @TestLog`);

        if (result.rowsAffected[0] === 0) {
            await transaction.rollback();
            return res.status(404).json({ success: false, message: "Test record not found." });
        }

        await transaction.commit();
        res.json({ success: true, message: "Test record deleted successfully." });

    } catch (err) {
        if (transaction) await transaction.rollback();
        console.error("Error deleting test record:", err);
        res.status(500).json({ success: false, message: "Failed to delete test record." });
    }
});



// Get all test logs for a trainer (Admin view, grouped client-side)
router.get("/api/admin/trainer/:trainerId/logs", isAdmin, async (req, res) => {
    const { trainerId } = req.params;

    try {
        const result = await pool.request()
            .input("TrainerID", sql.Int, trainerId)
            .input("Branch", sql.NVarChar(50), req.Branch)
            .query(`
                SELECT 
                    TR.TestLog,
                    TR.CreatedAt,
                    TR.TR,
                    TM.Name AS StudentName,
                    TR.Total,
                    TR.Grade,
                    TR.BatchID,
                    EB.BatchName
                FROM TestRecords TR
                JOIN Trainers T ON TR.TrainerID = T.TrainerID
                JOIN TestMaster TM ON TM.TR = TR.TR
                LEFT JOIN EvaluationBatches EB ON TR.BatchID = EB.BatchID
                WHERE TR.TrainerID = @TrainerID
                  AND TR.Branch = @Branch   -- branch safety
                ORDER BY 
                    EB.BatchID DESC,
                    TR.CreatedAt DESC
            `);

        res.json({ success: true, data: result.recordset });

    } catch (err) {
        console.error("Error fetching trainer logs (admin):", err);
        res.status(500).json({ success: false, message: "Failed to load trainer logs." });
    }
});


// Fetch detailed test log for admin (full modal)
router.get("/api/admin/log-details/:testLog", isAdmin, async (req, res) => {
    try {
        const { testLog } = req.params;

        const result = await pool.request()
            .input("TestLog", sql.Int, testLog)
            .query(`
                SELECT
                    TR.TestLog,
                    TR.TR,
                    TM.Name,
                    TR.CreatedAt,
                    TR.Weight,
                    TR.Height,
                    TR.Waist,
                    TR.Hips,
                    TR.Neck,
                    TR.BMI,
                    TR.BMIStatus,
                    TR.BodyFat,
                    TR.BMR,
                    TR.CalorieIntake,
                    TR.VO2Max,
                    TR.Total,
                    TR.Grade,
                    EB.BatchName,
                    TAL.PushUps,
                    TAL.SitUps,
                    TAL.Squats,
                    TAL.SitAndReach,
                    TAL.StepUpPulseRate
                FROM TestRecords TR
                JOIN TestMaster TM ON TR.TR = TM.TR
                LEFT JOIN EvaluationBatches EB ON EB.BatchID = TR.BatchID
                LEFT JOIN TestActivityLog TAL ON TAL.TestLog = TR.TestLog
                WHERE TR.TestLog = @TestLog
            `);

        if (result.recordset.length === 0) {
            return res.status(404).json({ success: false, message: "Log not found" });
        }

        res.json({ success: true, data: result.recordset[0] });

    } catch (err) {
        console.error("Error fetching admin log details:", err);
        res.status(500).json({ success: false, message: "Failed to load details" });
    }
});

// --- End of routes ---

module.exports = router; // Export the router