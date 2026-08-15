// routes/fitnessTest.js
const express = require('express');
const router = express.Router();
const { pool } = require('../utils/db.js');
const sql = require('mssql');
const bcrypt = require('bcrypt'); 
const { schemas, validateBody } = require('../middleware/validation');

// Helper functions for this router

/**
 * Awards XP to a student and handles leveling up.
 * @param {number} tr - The student's TR number.
 * @param {number} xpAmount - The amount of XP to award.
 * @param {sql.Transaction} transaction - The active SQL transaction.
 * @returns {Promise<{levelledUp: boolean, newLevel: number, newXP: number}>} - Info on level-up status.
 */

async function awardXP(tr, xpAmount, transaction) {
    const request = new sql.Request(transaction);
    request.input('TR', sql.Int, tr);

    // 1. Get current level and XP
    const result = await request.query('SELECT FitnessLevel, CurrentXP FROM TestMaster WHERE TR = @TR');
    if (result.recordset.length === 0) return { levelledUp: false };

    let { FitnessLevel, CurrentXP } = result.recordset[0];
    CurrentXP += xpAmount;

    // 2. Calculate XP needed for the next level
    let xpForNextLevel = FitnessLevel * 100;
    let levelledUp = false;

    // 3. Loop to handle multiple level-ups from a single XP gain
    while (CurrentXP >= xpForNextLevel) {
        levelledUp = true;
        FitnessLevel++;
        CurrentXP -= xpForNextLevel;
        xpForNextLevel = FitnessLevel * 100;
    }

    // 4. Update the database with the new level and XP
    const updateRequest = new sql.Request(transaction);
    updateRequest.input('TR', sql.Int, tr);
    updateRequest.input('NewLevel', sql.Int, FitnessLevel);
    updateRequest.input('NewXP', sql.Int, CurrentXP);
    await updateRequest.query('UPDATE TestMaster SET FitnessLevel = @NewLevel, CurrentXP = @NewXP WHERE TR = @TR');

    return { levelledUp, newLevel: FitnessLevel, newXP: CurrentXP };
}

// --- Paste all the routes from the list below here ---


// CORRECTED: Fetches current student data from TestMaster
router.get('/api/testmaster/me', async (req, res) => {
    if (!req.session.user || !req.session.user.TR) {
        return res.status(401).json({ error: 'Unauthorized. Please log in.' });
    }

    const TR = req.session.user.TR; // ✅ from session

    try {
        const result = await pool.request() 
            .input('TR', sql.Int, TR)
            .query(`
                SELECT 
                    TR, 
                    ITS, 
                    Name, 
                    Darajah, 
                    -- DOB is now nullable
                    CONVERT(varchar, DOB, 23) AS DOB, 
                    Branch, 
                    Gender
                FROM TestMaster 
                WHERE TR = @TR
            `);

        if (result.recordset.length === 0) {
             return res.status(404).json({ error: 'Student profile not found in TestMaster.' });
        }
        
        res.json(result.recordset[0]); // Return the single student record or empty if not found

    } catch (err) {
        console.error('Error fetching TestMaster for student:', err);
        res.status(500).json({ error: 'Failed to fetch student profile data' });
    }
});


// NEW: Updates the logged-in student's Date of Birth
router.put('/api/testmaster/me/dob', async (req, res) => {
    if (!req.session.user || !req.session.user.TR) {
        return res.status(401).json({ error: 'Unauthorized. Please log in.' });
    }
    
    const TR = req.session.user.TR;
    const { DOB } = req.body; // Expecting DOB in 'YYYY-MM-DD' format

    // Basic validation for the date format
    if (!DOB || !/^\d{4}-\d{2}-\d{2}$/.test(DOB)) {
        return res.status(400).json({ error: 'Invalid date format. Please use YYYY-MM-DD.' });
    }

    try {
        const request = pool.request();
        request.input('TR', sql.Int, TR);
        request.input('DOB', sql.Date, DOB);

        const result = await request.query(`
            UPDATE TestMaster 
            SET DOB = @DOB 
            WHERE TR = @TR
        `);

        if (result.rowsAffected[0] === 0) {
             return res.status(404).json({ error: 'Student profile not found.' });
        }

        res.json({ success: true, message: 'Date of Birth updated successfully.' });

    } catch (err) {
        console.error('Error updating DOB:', err);
        res.status(500).json({ error: 'Failed to update Date of Birth.' });
    }
});


// NEW: Sets the student's new password (for first-time login)
router.post('/api/test/set-password', validateBody(schemas.setPassword), async (req, res) => {
    // 1. Get TR from the session (secure)
    if (!req.session.user || !req.session.user.TR) {
        return res.status(401).json({ success: false, message: 'Unauthorized. Please log in again.' });
    }
    const TR = req.session.user.TR;
    
    // 2. Get the new password from the request body
    const { newPassword } = req.body;
    try {
        // 3. Hash the new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        
        // 4. Update the TestMaster table
        const request = pool.request();
        request.input('TR', sql.Int, TR);
        request.input('HashedPassword', sql.NVarChar(100), hashedPassword);

        await request.query(`
            UPDATE TestMaster 
            SET 
                Password = @HashedPassword,
                HasLoggedInBefore = 1
            WHERE TR = @TR
        `);
        
        res.json({ success: true, message: 'Password updated successfully!' });
    
    } catch (err) {
        console.error('Error setting new test password:', err);
        res.status(500).json({ success: false, message: 'Failed to update password.' });
    }
});


// --- 🩺 Medical History Routes ---

/**
 * GET: Fetches the student's medical history
 */
router.get('/api/medical-history/me', async (req, res) => {
    // 1. Get TR from session
    if (!req.session.user || !req.session.user.TR) {
        return res.status(401).json({ success: false, message: 'Unauthorized.' });
    }
    const TR = req.session.user.TR;

    try {
        const result = await pool.request()
            .input('TR', sql.Int, TR)
            .query('SELECT * FROM MedicalHistory WHERE TR = @TR');

        // Return the record, or null if one doesn't exist (which is not an error)
        res.json({ success: true, data: result.recordset[0] || null });

    } catch (err) {
        console.error('Error fetching medical history:', err);
        res.status(500).json({ success: false, message: 'Failed to fetch medical history.' });
    }
});

/**
 * POST: Creates or Updates the student's medical history (Upsert)
 */
router.post('/api/medical-history/me', async (req, res) => {
    // 1. Get TR from session
    if (!req.session.user || !req.session.user.TR) {
        return res.status(401).json({ success: false, message: 'Unauthorized.' });
    }
    const TR = req.session.user.TR;
    
    // 2. Get the 4 fields from the body
    const { Allergies, Medications, FamilyHistory, PreviousInjuries } = req.body;

    try {
        const request = pool.request();
        request.input('TR', sql.Int, TR);
        request.input('Allergies', sql.NVarChar(sql.MAX), Allergies || null);
        request.input('Medications', sql.NVarChar(sql.MAX), Medications || null);
        request.input('FamilyHistory', sql.NVarChar(sql.MAX), FamilyHistory || null);
        request.input('PreviousInjuries', sql.NVarChar(sql.MAX), PreviousInjuries || null);

        // 3. Use MERGE to perform an "upsert"
        await request.query(`
            MERGE INTO MedicalHistory AS target
            USING (SELECT @TR AS TR) AS source
            ON (target.TR = source.TR)
            
            -- If a row for this TR already exists
            WHEN MATCHED THEN
                UPDATE SET
                    Allergies = @Allergies,
                    Medications = @Medications,
                    FamilyHistory = @FamilyHistory,
                    PreviousInjuries = @PreviousInjuries
            
            -- If no row exists for this TR
            WHEN NOT MATCHED THEN
                INSERT (TR, Allergies, Medications, FamilyHistory, PreviousInjuries)
                VALUES (@TR, @Allergies, @Medications, @FamilyHistory, @PreviousInjuries);
        `);

        res.json({ success: true, message: 'Medical history updated successfully.' });

    } catch (err) {
        console.error('Error saving medical history:', err);
        res.status(500).json({ success: false, message: 'Failed to save medical history.' });
    }
});

// CORRECTED: Saves a new fitness test record
router.post('/api/testrecords', async (req, res) => {
    // Student TR comes from session for security
    if (!req.session.user || !req.session.user.TR) {
        return res.status(401).json({ error: 'Unauthorized. Please log in.' });
    }
    const TR = req.session.user.TR;

    // Data from the form (Age and DOB are removed)
    const {
        Weight, Height, Waist, Hips, Neck,
        BMI, BMIStatus, BodyFat, BMR, CalorieIntake, VO2Max, Total, Grade
    } = req.body;

    const transaction = new sql.Transaction(pool);

    try {
        await transaction.begin();
        const request = new sql.Request(transaction); // Use transaction-scoped request

        // --- 1. Get Branch and Gender from TestMaster ---
        const studentInfo = await request // Reuse the request object
            .input('TR_Lookup', sql.Int, TR) // Use a different parameter name to avoid conflict
            .query('SELECT Branch, Gender FROM TestMaster WHERE TR = @TR_Lookup');

        if (studentInfo.recordset.length === 0) {
            throw new Error('Student TestMaster record not found.');
        }
        const { Branch, Gender } = studentInfo.recordset[0];
        // --- End Get Branch/Gender ---

        // Clear existing inputs before adding new ones
        request.parameters = {}; 

        // --- 2. Input Parameters for TestRecords ---
        request.input('TR', sql.Int, TR);
        request.input('Weight', sql.Float, Weight);
        request.input('Height', sql.Float, Height);
        request.input('Waist', sql.Float, Waist);
        request.input('Hips', sql.Float, Hips);
        request.input('Neck', sql.Float, Neck);
        request.input('BMI', sql.Float, BMI);
        request.input('BMIStatus', sql.NVarChar(50), BMIStatus);
        request.input('BodyFat', sql.Float, BodyFat);
        request.input('BMR', sql.Float, BMR);
        request.input('CalorieIntake', sql.Float, CalorieIntake);
        request.input('VO2Max', sql.Float, VO2Max === "N/A" ? null : VO2Max);
        request.input('Total', sql.Float, Total);
        request.input('Grade', sql.NVarChar(2), Grade);
        request.input('Branch', sql.NVarChar(50), Branch); // Add Branch
        request.input('Gender', sql.NVarChar(10), Gender); // Add Gender
        // --- End Input Parameters ---


        // --- 3. Execute INSERT ---
        await request.query(`
            INSERT INTO TestRecords 
            (TR, Weight, Height, Waist, Hips, Neck, BMI, BMIStatus, 
             BodyFat, BMR, CalorieIntake, VO2Max, Total, Grade, 
             Branch, Gender) -- Added Branch, Gender; Removed DOB, Age
            VALUES 
            (@TR, @Weight, @Height, @Waist, @Hips, @Neck, @BMI, @BMIStatus, 
             @BodyFat, @BMR, @CalorieIntake, @VO2Max, @Total, @Grade,
             @Branch, @Gender) -- Added Branch, Gender
        `);
        // --- End INSERT ---
          // --- 3b. Get the newly created TestLog ID ---
            const testLogResult = await request.query(`
                SELECT TOP 1 TestLog FROM TestRecords WHERE TR = @TR ORDER BY TestLog DESC
            `);
            const newTestLogID = testLogResult.recordset[0]?.TestLog;

            // --- 3c. Insert into TestActivityLog ---
            const {
                PushUps, SitUps, Squats, SitReach, PulseRate
            } = req.body;

            const activityRequest = new sql.Request(transaction);
            activityRequest.input('TestLog', sql.Int, newTestLogID);
            activityRequest.input('PushUps', sql.SmallInt, PushUps || null);
            activityRequest.input('SitUps', sql.SmallInt, SitUps || null);
            activityRequest.input('Squats', sql.SmallInt, Squats || null);
            activityRequest.input('SitAndReach', sql.SmallInt, SitReach || null);
            activityRequest.input('StepUpPulseRate', sql.SmallInt, PulseRate || null);

            await activityRequest.query(`
                INSERT INTO TestActivityLog 
                (TestLog, PushUps, SitUps, Squats, SitAndReach, StepUpPulseRate)
                VALUES (@TestLog, @PushUps, @SitUps, @Squats, @SitAndReach, @StepUpPulseRate);
            `);

        // --- 4. Award XP (remains the same) ---
        const levelUpInfo = await awardXP(TR, 500, transaction ); // Pass the new request
        // --- End Award XP ---

        await transaction.commit();
        res.status(200).json({ 
            message: "Test record saved successfully",
            levelUpInfo
        });
    } catch (err) {
        console.error("Error saving test record:", err); // Log the specific error
        if (transaction && transaction._aborted === false && transaction._rolledBack === false) {
             try { await transaction.rollback(); } catch (rbErr) { console.error("Rollback failed:", rbErr); }
        }
        // Provide more specific error if possible
        if (err.message.includes('7 days')) { // Check if it's the 7-day restriction error
             res.status(409).json({ error: err.message });
        } else {
             res.status(500).json({ error: "Server error saving test record. " + err.message });
        }
    }
});

// --- NEW: Fetches the student’s TestActivityLog joined with TestRecords ---
router.get('/api/testactivity/me', async (req, res) => {
    if (!req.session.user || !req.session.user.TR) {
        return res.status(401).json({ error: 'Unauthorized. Please log in.' });
    }

    const TR = req.session.user.TR;

    try {
        const result = await pool.request()
            .input('TR', sql.Int, TR)
            .query(`
                SELECT 
                    r.TestLog, 
                    r.CreatedAt,
                    a.PushUps, 
                    a.SitUps, 
                    a.Squats, 
                    a.SitAndReach, 
                    a.StepUpPulseRate
                FROM TestRecords r
                LEFT JOIN TestActivityLog a ON r.TestLog = a.TestLog
                WHERE r.TR = @TR
                ORDER BY r.TestLog DESC;
            `);
        res.json({ success: true, data: result.recordset });
    } catch (err) {
        console.error('Error fetching activity logs:', err);
        res.status(500).json({ error: 'Failed to load activity data.' });
    }
});


router.get('/api/testrecords/me', async (req, res) => {
    if (!req.session.user || !req.session.user.TR) {
        return res.status(401).json({ error: 'Unauthorized. Please log in.' });
    }

    const TR = req.session.user.TR; // ✅ from session

    try {
        const result = await pool.request()
            .input('TR', sql.Int, TR)
            .query('SELECT * FROM TestRecords WHERE TR = @TR ORDER BY TestLog DESC');

        res.status(200).json(result.recordset);
    } catch (err) {
        console.error("Error fetching test records:", err);
        res.status(500).json({ error: "Failed to fetch test records" });
    }
});

/**
 * ★★★ UPDATED: GETS ALL EVALUATIONS AND A LIST OF EVALUATORS ★★★
 */
router.get('/api/evaluations/me', async (req, res) => {
    // 1. Get TR from session
    if (!req.session.user || !req.session.user.TR) {
        return res.status(401).json({ success: false, message: 'Unauthorized.' });
    }
    const TR = req.session.user.TR;

    try {
        const request = new sql.Request(pool);
        request.input('TR', sql.Int, TR);

        // 2. Get all Trainer-submitted Test Logs for this student
        const historyLogs = await request.query(`
            SELECT 
                tr.TestLog, 
                tr.BatchID,
                ISNULL(eb.BatchName, 'Unbatched') AS BatchName,
                tr.CreatedAt, 
                tr.Grade,
                tr.Total
            FROM TestRecords tr
            LEFT JOIN EvaluationBatches eb ON tr.BatchID = eb.BatchID
            WHERE tr.TR = @TR AND tr.SubmittedBy = 'Trainer'
            ORDER BY tr.CreatedAt DESC;
        `);

        if (historyLogs.recordset.length === 0) {
            // No evaluations yet. Send back empty arrays.
            return res.json({ success: true, data: [], evaluators: [] });
        }

        // 3. Get all comments for all those logs in one query
        const logIDs = historyLogs.recordset.map(r => r.TestLog);
        
        const commentRequest = new sql.Request(pool);
        const logParams = logIDs.map((id, i) => `@LogID${i}`);
        logIDs.forEach((id, i) => commentRequest.input(`LogID${i}`, sql.Int, id));

        const commentsResult = await commentRequest.query(`
            SELECT 
                E.LogID, 
                E.CommentText, 
                E.DateEvaluated, 
                C.CategoryName,
                EV.Name AS EvaluatorName, 
                EV.Profession
            FROM Evaluations E
            JOIN Evaluators EV ON E.EvaluatorID = EV.EvaluatorID
            JOIN CommentCategories C ON E.CategoryID = C.CategoryID
            WHERE E.LogID IN (${logParams.join(',')})
            ORDER BY C.CategoryName, E.DateEvaluated DESC;
        `);

        // 4. Group the comments by LogID for easy mapping
        const commentsMap = new Map();
        for (const comment of commentsResult.recordset) {
            if (!commentsMap.has(comment.LogID)) {
                commentsMap.set(comment.LogID, []);
            }
            commentsMap.get(comment.LogID).push(comment);
        }

        // 5. Combine the data: Attach comments to their matching TestLog
        const finalData = historyLogs.recordset.map(log => {
            const comments = commentsMap.get(log.TestLog) || [];
            return { ...log, comments: comments };
        });

        // --- ★★★ NEW SECTION ★★★ ---
        // 6. Get a UNIQUE list of all evaluators who commented on these logs
        //    (We can reuse the commentRequest and its logParams)
        const uniqueEvaluatorsResult = await commentRequest.query(`
            SELECT DISTINCT
                EV.EvaluatorID,
                EV.Name,
                EV.Profession,
                EV.Contact,
                EV.Email
            FROM Evaluations E
            JOIN Evaluators EV ON E.EvaluatorID = EV.EvaluatorID
            WHERE E.LogID IN (${logParams.join(',')});
        `);
        // --- ★★★ END NEW SECTION ★★★ ---

        // 7. Send the combined response
        res.json({ 
            success: true, 
            data: finalData, 
            evaluators: uniqueEvaluatorsResult.recordset // <-- ADDED NEW KEY
        });

    } catch (err) {
        console.error('Error fetching student evaluations:', err);
        res.status(500).json({ success: false, message: 'Failed to fetch evaluations.' });
    }
});

//===================================================================
//================= 🧪 Staff Fitness Test Routes ==============
//===================================================================


router.post('/api/fitness-test/bulk-validate', async (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ message: 'Unauthorized.' });
  }
  
  try {
    const { students } = req.body;
    if (!students || !Array.isArray(students) || students.length === 0) {
      return res.status(400).json({ message: 'No student data provided.' });
    }

    const invalidRows = [];
    const structurallyValidStudents = [];
    const itsInFile = new Set();
    const trInFile = new Set(); // Check for TR duplicates in the file too

    const itsRegex = /^\d{8}$/;
    const trRegex = /^\d{5}$/;

    // 1. First pass: Check format and in-file duplicates
    for (let i = 0; i < students.length; i++) {
      const student = students[i];
      const fileRow = i + 2;
      const { TR, ITS, Name, Darajah } = student;
      let reason = null;

      const itsStr = ITS ? ITS.toString() : "";
      const trStr = TR ? TR.toString() : "";

      if (!itsStr || !itsRegex.test(itsStr)) {
        reason = "ITS must be exactly 8 digits.";
      } else if (!trStr || !trRegex.test(trStr)) {
        reason = "TR must be exactly 5 digits.";
      } else if (!Name || Name.toString().trim() === "") {
        reason = "Name is missing.";
      } else if (!Darajah || Darajah.toString().trim() === "") {
        reason = "Darajah is missing.";
      } else if (itsInFile.has(itsStr)) {
        reason = `Duplicate ITS in file: ${itsStr}.`;
      } else if (trInFile.has(trStr)) {
        reason = `Duplicate TR in file: ${trStr}.`;
      }

      if (reason) {
        invalidRows.push({ fileRow, rowData: student, reason });
      } else {
        itsInFile.add(itsStr);
        trInFile.add(trStr);
        structurallyValidStudents.push({
          TR: parseInt(trStr),
          ITS: parseInt(itsStr),
          Name: Name.toString(),
          Darajah: Darajah.toString()
        });
      }
    }

    if (structurallyValidStudents.length === 0) {
      // Return lists of new, skipped, and invalid
      return res.json({ newStudents: [], skippedStudents: [], invalidRows });
    }
    
    // 2. Second pass: Check for DB duplicates (TR and ITS)
    const incomingTRs = structurallyValidStudents.map(s => s.TR);
    const incomingITS = structurallyValidStudents.map(s => s.ITS);

    const request = pool.request();

    // Create parameters for TRs
    const trParams = incomingTRs.map((tr, i) => `@TR${i}`);
    incomingTRs.forEach((tr, i) => request.input(`TR${i}`, sql.Int, tr));
    
    // Create parameters for ITS
    const itsParams = incomingITS.map((its, i) => `@ITS${i}`);
    incomingITS.forEach((its, i) => request.input(`ITS${i}`, sql.Int, its));

    // Query for existing TRs OR ITS numbers in ONE query
    const dbCheckResult = await request.query(`
        SELECT TR, ITS 
        FROM TestMaster 
        WHERE TR IN (${trParams.join(',')}) OR ITS IN (${itsParams.join(',')})
    `);

    const existingTRs = new Set(dbCheckResult.recordset.map(r => r.TR));
    const existingITS = new Set(dbCheckResult.recordset.map(r => r.ITS));

    // 3. Partition the results
    const newStudents = [];
    const skippedStudents = []; // Renamed for clarity

    for (const s of structurallyValidStudents) {
      let skipReason = null;
      if (existingTRs.has(s.TR)) {
        skipReason = `TR ${s.TR} already exists in database.`;
      } else if (existingITS.has(s.ITS)) {
        skipReason = `ITS ${s.ITS} already exists in database.`;
      }

      if (skipReason) {
        skippedStudents.push({ ...s, reason: skipReason });
      } else {
        newStudents.push(s);
      }
    }

    res.json({ newStudents, skippedStudents, invalidRows });

  } catch (err) {
    console.error('Bulk validation error:', err);
    res.status(500).json({ message: 'Server error during validation.' });
  }
});


// REPLACE your old /api/fitness-test/bulk-commit route with this one
router.post('/api/fitness-test/bulk-commit', async (req, res) => {
  const { Branch, Gender } = req.session.user || {};
  if (!Branch || !Gender) {
    return res.status(401).json({ message: 'Unauthorized.' });
  }
  
  try {
    const { students } = req.body; 
    if (!students || !Array.isArray(students) || students.length === 0) {
      return res.status(400).json({ message: 'No new students to commit.' });
    }

    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      // 1. Create ONE request object for the entire transaction
      const request = new sql.Request(transaction);
      const valuesClauses = [];

      // 2. Loop through students to build parameters and value strings
      //    (This loop does not hit the database)
      students.forEach((student, index) => {
        // Create unique parameter names for each student's data
        const trParam = `TR${index}`;
        const itsParam = `ITS${index}`;
        const nameParam = `Name${index}`;
        const darajahParam = `Darajah${index}`;

        // Add all parameters to the *single* request object
        request.input(trParam, sql.Int, student.TR);
        request.input(itsParam, sql.Int, student.ITS);
        request.input(nameParam, sql.NVarChar(100), student.Name);
        request.input(darajahParam, sql.NVarChar(50), student.Darajah);

        // Add a new VALUES clause to our array
        valuesClauses.push(
          `(@${trParam}, @${itsParam}, @${nameParam}, @${darajahParam}, @Branch, @Gender)`
        );
      });
      
      // 3. Add the session Branch and Gender parameters *once*
      //    (Using NVarChar is still fine, SQL server will convert the value)
      request.input('Branch', sql.NVarChar(50), Branch);
      request.input('Gender', sql.NVarChar(10), Gender);
      
      // 4. Construct the single, massive INSERT query
      const query = `
        INSERT INTO TestMaster 
          (TR, ITS, Name, Darajah, Branch, Gender)
        VALUES 
          ${valuesClauses.join(', ')};
      `;

      // 5. Execute the query *once*
      await request.query(query);
      
      // 6. If all loops succeeded, commit the transaction
      await transaction.commit();

      res.json({ success: true, count: students.length });

    } catch (err) {
      // If the single insert fails, roll back the *entire* batch
      await transaction.rollback();
      throw err; // Re-throw to be caught by the outer catch
    }
  } catch (err) {
    console.error('Bulk commit error:', err);
    
    // The existing error handling is perfect
    if (err.number === 2627 || err.number === 2601) { 
      res.status(409).json({ success: false, message: 'Conflict: A student with one of these TR or ITS numbers already exists.' });
    } else {
      res.status(500).json({ success: false, message: 'Failed to enroll students. ' + err.message });
    }
  }
});

router.get('/api/fitness-test/all-students', async (req, res) => {
  const { Branch, Gender } = req.session.user || {};
  if (!Branch || !Gender) {
    return res.status(401).json({ 
      success: false, 
      message: 'Unauthorized. Session is missing branch or gender.' 
    });
  }

  try {
    const request = pool.request();
    request.input('Branch', sql.NVarChar(50), Branch);
    request.input('Gender', sql.NVarChar(10), Gender);

    // Query TestMaster for all students in this section
    const result = await request.query(`
      SELECT 
        TR, 
        ITS, 
        Name, 
        Darajah,
        CONVERT(varchar, DOB, 23) AS DOB -- Format DOB for readability
      FROM TestMaster
      WHERE Branch = @Branch AND Gender = @Gender
      ORDER BY Name ASC
    `);

    res.json({ 
      success: true, 
      count: result.recordset.length,
      students: result.recordset 
    });

  } catch (err) {
    console.error('Error fetching all students:', err.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});



router.get('/api/fitness-test/students/count', async (req, res) => {
    // Reuse the same session/auth check as your other staff endpoints
    const { Branch, Gender } = req.session.user || {};
    if (!Branch || !Gender) {
        return res.status(401).json({
            success: false,
            message: 'Unauthorized. Session is missing branch or gender.'
        });
    }

    try {
        const request = pool.request();
        request.input('Branch', sql.NVarChar(50), Branch);
        request.input('Gender', sql.NVarChar(10), Gender);

        // Efficiently get only the count from the database
        const result = await request.query(`
            SELECT COUNT(*) AS totalStudents
            FROM TestMaster
            WHERE Branch = @Branch AND Gender = @Gender
        `);

        res.json({
            success: true,
            // Send back just the count number
            count: result.recordset[0].totalStudents
        });

    } catch (err) {
        console.error('Error fetching student count:', err.message);
        res.status(500).json({ success: false, message: 'Server error fetching count' });
    }
});

// --- End of routes ---

module.exports = router; // Export the router
