// routes/fitnessTest.js
const express = require('express');
const router = express.Router();
const { pool } = require('../utils/db.js');
const sql = require('mssql');

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
    const result = await request.query('SELECT FitnessLevel, CurrentXP FROM Master WHERE TR = @TR');
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
    await updateRequest.query('UPDATE Master SET FitnessLevel = @NewLevel, CurrentXP = @NewXP WHERE TR = @TR');

    return { levelledUp, newLevel: FitnessLevel, newXP: CurrentXP };
}

// --- Paste all the routes from the list below here ---


router.get('/api/current-tr', (req, res) => {
    if (!req.session.user || !req.session.user.TR) {
        return res.status(401).json({ message: 'Not logged in' });
    }
    res.json({ tr: req.session.user.TR }); 
});

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
            throw new Error('Student master record not found.');
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
    incomingITS.forEach((its, i) => request.input(`ITS${i}`, sql.BigInt, its));

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
      // 1. Define the query string *once* outside the loop
      const query = `
        INSERT INTO TestMaster 
          (TR, ITS, Name, Darajah, Branch, Gender)
        VALUES 
          (@TR, @ITS, @Name, @Darajah, @Branch, @Gender);
      `;

      // 2. Loop through each student
      for (const student of students) {
        
        // *** THE FIX IS HERE ***
        // Create a *new* request object for *each* loop.
        // This request is part of the same transaction.
        const request = new sql.Request(transaction);

        // 3. Add all parameters for this *one* student
        request.input('TR', sql.Int, student.TR);
        request.input('ITS', sql.BigInt, student.ITS);
        request.input('Name', sql.NVarChar(100), student.Name);
        request.input('Darajah', sql.NVarChar(50), student.Darajah);
        request.input('Branch', sql.NVarChar(50), Branch);
        request.input('Gender', sql.NVarChar(10), Gender);
        
        // 4. Execute the query just for this student
        await request.query(query);
      }

      // 5. If all loops succeeded, commit the transaction
      await transaction.commit();

      res.json({ success: true, count: students.length });

    } catch (err) {
      // If any single insert fails, roll back the *entire* batch
      await transaction.rollback();
      throw err; // Re-throw to be caught by the outer catch
    }
  } catch (err) {
    console.error('Bulk commit error:', err);
    
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