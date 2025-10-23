// Import required modules

const express = require('express');
const bcrypt = require('bcrypt');
const sql = require('mssql');
const router = express.Router();
const cors = require('cors');
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');
const session = require('express-session');
const app = express();
const moment = require('moment-timezone');

// Set up the port
const port = 10000;





// Middleware
app.use(cors({
  origin: 'https://ajsm-gym.onrender.com',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'dist')));
app.use(session({
  secret: 'jamea1446@GYM!SecreT2025',  
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // true if using HTTPS
    maxAge: 1000 * 60 * 60 * 2 // 2 hours
  }
}));

const config = {
    user: 'idris5687',
    password: 'idris5253',
    server: 'fittracker.mssql.somee.com',
    database: 'fittracker',
    options: {
        encrypt: true,               // Required for some remote SQL servers
        trustServerCertificate: true // As specified in your connection string
    }
};

// (HELPER FUNCTION) to find or create a week for a given date
const getOrCreateWeekIdByDate = async (date, transactionOrPool) => {
    const request = transactionOrPool.request();

    // moment.js calculates the start and end of the week (ISO week: Monday to Sunday)
    const leaveDate = moment(date);
    const weekStart = leaveDate.clone().startOf('isoWeek').format('YYYY-MM-DD');
    const weekEnd = leaveDate.clone().endOf('isoWeek').format('YYYY-MM-DD');

    request.input('WeekStartDate', sql.Date, weekStart);
    request.input('WeekEndDate', sql.Date, weekEnd);

    // Check if the week already exists
    let weekResult = await request.query(`
        SELECT WeekID FROM AttendanceWeek WHERE WeekStartDate = @WeekStartDate
    `);

    if (weekResult.recordset.length > 0) {
        return weekResult.recordset[0].WeekID; // Return existing week ID
    } else {
        // If not, create it
        await request.query(`
            INSERT INTO AttendanceWeek (WeekStartDate, WeekEndDate) VALUES (@WeekStartDate, @WeekEndDate)
        `);
        // Fetch the newly created week ID
        weekResult = await request.query(`
            SELECT WeekID FROM AttendanceWeek WHERE WeekStartDate = @WeekStartDate
        `);
        return weekResult.recordset[0].WeekID;
    }
};

    
// ----------------------------------------------------------------
// --- ALL API ROUTES NOW USE THE SINGLE CONNECTION  ---
// ----------------------------------------------------------------


// ➕ Add Student (always goes to WaitingList)
app.post('/api/add-student', async (req, res) => {
    try {
        if (!req.session.user) {
            return res.status(401).json({ success: false, error: 'Unauthorized. Please log in.' });
        }
        
        const { TR, Name, Darajah, Goal } = req.body;
        const { Branch, Gender } = req.session.user;

        // --- ✅ START: NEW CHECK ---
        // 1. Check if the TR already exists in the Master table
        const checkRequest = pool.request();
        checkRequest.input('TR', sql.Int, TR);
        const existingMember = await checkRequest.query(`
            SELECT TR, Status FROM Master WHERE TR = @TR
        `);

        // 2. If a record is found, stop and send an error message
        if (existingMember.recordset.length > 0) {
            const status = existingMember.recordset[0].Status;
            return res.status(409).json({ // 409 Conflict is a good status code here
                success: false, 
                message: `This TR already exists as an '${status}' member. Please check the active/inactive students list or contact an admin.` 
            });
        }
        // --- ✅ END: NEW CHECK ---

        // 3. If the TR is unique, proceed to insert into the WaitingList
        await pool.request()
            .input('TR', sql.Int, TR)
            .input('Name', sql.NVarChar(100), Name)
            .input('Darajah', sql.NVarChar(50), Darajah)
            .input('Goal', sql.NVarChar(100), Goal)
            .input('Branch', sql.NVarChar(50), Branch)
            .input('Gender', sql.NVarChar(10), Gender)
            .query(`
                INSERT INTO WaitingList (TR, Name, Darajah, Goal, Branch, Gender)
                VALUES (@TR, @Name, @Darajah, @Goal, @Branch, @Gender)
            `);

        res.json({ success: true, message: 'Student added to Waiting List.' });

    } catch (err) {
        console.error('Add student error:', err);
        res.status(500).json({ success: false, message: 'Failed to add student' });
    }
});


// API:

// --- ✅ 1. NEW VALIDATION ENDPOINT ---
// Receives a list of students, checks them against the Master table,
// Server API file

// MODIFIED VALIDATION ENDPOINT
app.post('/api/bulk-validate-students', async (req, res) => {
    try {
        if (!req.session.user) {
            return res.status(401).json({ message: 'Unauthorized.' });
        }
        const { students } = req.body;
        if (!students || !Array.isArray(students) || students.length === 0) {
            return res.status(400).json({ message: 'No student data provided.' });
        }

        const invalidRows = [];
        const structurallyValidStudents = [];

        // 1. First pass: Check for missing data in each row
        students.forEach((student, index) => {
            const { TR, Name, Darajah, Goal } = student;
            if (!TR || !Name || !Darajah || !Goal) {
                let reason = "Missing required fields.";
                if (!TR) reason = "Missing TR.";
                else if (!Name) reason = "Missing Name.";
                else if (!Darajah) reason = "Missing Darajah.";
                else if (!Goal) reason = "Missing Goal.";
                
                invalidRows.push({ 
                    rowData: { TR: TR || 'N/A', Name: Name || 'N/A' }, 
                    reason: reason,
                    // Add 2 to index because spreadsheets are 1-based and we have a header row
                    fileRow: index + 2 
                });
            } else {
                structurallyValidStudents.push(student);
            }
        });

        if (structurallyValidStudents.length === 0) {
            return res.json({ validStudents: [], duplicateTRs: [], invalidRows });
        }
        
        // 2. Second pass: Check for duplicates only on structurally valid students
        const incomingTRs = structurallyValidStudents.map(s => s.TR);
        const request = pool.request();
        const params = incomingTRs.map((tr, index) => `@TR${index}`);
        incomingTRs.forEach((tr, index) => request.input(`TR${index}`, sql.Int, tr));
        
        const result = await request.query(`SELECT TR FROM Master WHERE TR IN (${params.join(',')})`);
        
        const existingTRs = new Set(result.recordset.map(r => r.TR));

        // 3. Partition the results
        const validStudents = structurallyValidStudents.filter(s => !existingTRs.has(s.TR));
        const duplicateTRs = structurallyValidStudents.filter(s => existingTRs.has(s.TR));

        res.json({ validStudents, duplicateTRs, invalidRows });

    } catch (err) {
        console.error('Bulk validation error:', err);
        res.status(500).json({ message: 'Server error during validation.' });
    }
});

// --- ✅ 2. NEW COMMIT ENDPOINT ---
// Receives a pre-validated list of students and performs a bulk insert.
app.post('/api/bulk-commit-students', async (req, res) => {
    try {
        if (!req.session.user) {
            return res.status(401).json({ message: 'Unauthorized.' });
        }
        const { students } = req.body;
        if (!students || !Array.isArray(students) || students.length === 0) {
            return res.status(400).json({ message: 'No valid students to commit.' });
        }

        const { Branch, Gender } = req.session.user;
        const transaction = new sql.Transaction(pool);
        await transaction.begin();

        try {
            // Prepare a statement for inserting multiple rows
            const request = new sql.Request(transaction);

            // Constructing a single bulk INSERT statement is most efficient
            let valuesClauses = [];
            students.forEach((student, index) => {
                const trParam = `TR${index}`, nameParam = `Name${index}`, darajahParam = `Darajah${index}`, goalParam = `Goal${index}`;
                
                request.input(trParam, sql.Int, student.TR);
                request.input(nameParam, sql.NVarChar(100), student.Name);
                request.input(darajahParam, sql.NVarChar(50), student.Darajah);
                request.input(goalParam, sql.NVarChar(100), student.Goal);

                valuesClauses.push(`(@${trParam}, @${nameParam}, @${darajahParam}, @${goalParam}, @Branch, @Gender)`);
            });
            
            // Add Branch and Gender once, as they are the same for the whole batch
            request.input('Branch', sql.NVarChar(50), Branch);
            request.input('Gender', sql.NVarChar(10), Gender);
            
            const query = `
                INSERT INTO WaitingList (TR, Name, Darajah, Goal, Branch, Gender)
                VALUES ${valuesClauses.join(', ')}
            `;

            await request.query(query);
            await transaction.commit();

            res.json({ success: true, count: students.length });

        } catch (err) {
            await transaction.rollback(); // Rollback on error
            throw err; // Re-throw to be caught by the outer catch block
        }
    } catch (err) {
        console.error('Bulk commit error:', err);
        res.status(500).json({ success: false, message: 'Failed to add students to the waiting list.' });
    }
});


app.get('/api/waiting-list', async (req, res) => {
  try {
    // Ensure user is logged in
    if (!req.session.user) {
      return res.status(401).json({ error: "Unauthorized: No session user" });
    }

    const { Branch, Gender } = req.session.user;

   
    const result = await pool.request()
      .input('Branch', sql.NVarChar(50), Branch)
      .input('Gender', sql.NVarChar(10), Gender)
      .query(`
        SELECT WL.WaitingID, WL.TR, WL.Name, WL.Darajah, WL.Goal, WL.RequestedAt
        FROM WaitingList WL
        WHERE WL.Branch = @Branch AND WL.Gender = @Gender
        ORDER BY WL.RequestedAt ASC
      `);

    res.json(result.recordset);
  } catch (err) {
    console.error("Error fetching waiting list:", err);
    res.status(500).json({ error: "Failed to load waiting list" });
  }
});



// ➕ Assign WaitingList Student to a Slot
app.post('/api/assign-student-slot', async (req, res) => {


  try {
            if (!req.session.user) {
            // If there's no session, stop right here and send an error.
            return res.status(401).json({ success: false, error: 'Unauthorized. Please log in.' });
        }

            const { WaitingID, SlotID } = req.body;
           const { Branch, Gender } = req.session.user;


    // 1️⃣ Fetch student from WaitingList
    const studentRes = await pool.request()
      .input('WaitingID', sql.Int, WaitingID)
      .query(`SELECT * FROM WaitingList WHERE WaitingID=@WaitingID`);
    
    if (!studentRes.recordset.length)
      return res.status(404).json({ success: false, message: "Student not found" });
    
    const stu = studentRes.recordset[0];

    // 2️⃣ Insert into Master
    await pool.request()
      .input('TR', sql.Int, stu.TR)
      .input('Name', sql.NVarChar(100), stu.Name)
      .input('Darajah', sql.NVarChar(50), stu.Darajah)
      .input('Goal', sql.NVarChar(100), stu.Goal)
      .input('Branch', sql.NVarChar(50), Branch)
      .input('Gender', sql.NVarChar(10), Gender)
      .input('SlotID', sql.Int, SlotID)
      .query(`
        INSERT INTO Master (TR, Name, Darajah, Goal, Branch, Gender, SlotID, Status)
        VALUES (@TR, @Name, @Darajah, @Goal, @Branch, @Gender, @SlotID, 'Active')
      `);

    // 3️⃣ Remove from WaitingList
    await pool.request()
      .input('WaitingID', sql.Int, WaitingID)
      .query(`DELETE FROM WaitingList WHERE WaitingID=@WaitingID`);

    res.json({ success: true, message: "Student assigned to slot" });

  } catch (err) {
    console.error("Assign student error:", err);
    res.status(500).json({ success: false, message: "Failed to assign student" });
  }
});



// -----------------------------------------------------------------------------------------------------------------------

app.post('/api/slots', async (req, res) => {
  const { SlotName, MaxCapacity } = req.body;
 

  try {
            if (!req.session.user) {
            // If there's no session, stop right here and send an error.
            return res.status(401).json({ success: false, error: 'Unauthorized. Please log in.' });
        }

        const { Branch, Gender } = req.session.user;
    const result = await pool.request()
      .input('SlotName', sql.NVarChar(50), SlotName)
      .input('MaxCapacity', sql.Int, MaxCapacity)
      .input('Branch', sql.NVarChar(50), Branch)
      .input('Gender', sql.NVarChar(10), Gender)
      .query(`
        INSERT INTO Slots (SlotName, MaxCapacity, Branch, Gender) 
        VALUES (@SlotName, @MaxCapacity, @Branch, @Gender)
      `);

    res.json({ success: true, message: 'Slot created successfully' });
  } catch (err) {
    console.error('Create slot error:', err);
    res.status(500).json({ success: false, message: 'Failed to create slot' });
  }
});


app.get('/api/slots', async (req, res) => {
 

  try {
            if (!req.session.user) {
            // If there's no session, stop right here and send an error.
            return res.status(401).json({ success: false, error: 'Unauthorized. Please log in.' });
        }
    const { Branch, Gender } = req.session.user;
    const result = await pool.request()
      .input('Branch', sql.NVarChar(50), Branch)
      .input('Gender', sql.NVarChar(10), Gender)
      .query(`
        SELECT s.SlotID, s.SlotName, s.MaxCapacity,
          (s.MaxCapacity - COUNT(m.TR)) AS AvailableSeats
        FROM Slots s
        LEFT JOIN Master m ON s.SlotID = m.SlotID AND m.Status = 'Active'
        WHERE s.Branch = @Branch AND s.Gender = @Gender AND s.IsActive = 1
        GROUP BY s.SlotID, s.SlotName, s.MaxCapacity
        ORDER BY s.SlotName
      `);

    res.json({ success: true, slots: result.recordset });
  } catch (err) {
    console.error('Get slots error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch slots' });
  }
});


app.put('/api/slots/:id', async (req, res) => {
  const { SlotName, MaxCapacity } = req.body;
  const SlotID = req.params.id;

  try {
    await pool.request()
      .input('SlotID', sql.Int, SlotID)
      .input('SlotName', sql.NVarChar(50), SlotName)
      .input('MaxCapacity', sql.Int, MaxCapacity)
      .query(`
        UPDATE Slots 
        SET SlotName = @SlotName, MaxCapacity = @MaxCapacity
        WHERE SlotID = @SlotID
        WHERE @MaxCapacity >= (SELECT COUNT(*) FROM Master WHERE SlotID=@SlotID AND Status='Active')

      `);

    res.json({ success: true, message: 'Slot updated successfully' });
  } catch (err) {
    console.error('Update slot error:', err);
    res.status(500).json({ success: false, message: 'Failed to update slot' });
  }
});


// CORRECTED VERSION
app.delete('/api/slots/:id', async (req, res) => {
    const SlotID = req.params.id;


    const transaction = new sql.Transaction(pool);

    try {
        await transaction.begin();

        const request = new sql.Request(transaction);
        request.input('SlotID', sql.Int, SlotID);

        // Step 1: Unassign all active students from this slot
        await request.query(`
            UPDATE Master SET SlotID = NULL WHERE SlotID = @SlotID;
        `);

        // Step 2: Deactivate the slot itself
        await request.query(`
            UPDATE Slots SET IsActive = 0 WHERE SlotID = @SlotID;
        `);

        await transaction.commit();
        res.json({ success: true, message: 'Slot deactivated and all students unassigned.' });
    } catch (err) {
        await transaction.rollback();
        console.error('Slot deletion transaction error:', err.message);
        res.status(500).json({ success: false, message: 'Failed to deactivate slot.' });
    }
});

// Update student's slot
app.put('/api/change-student-slot', async (req, res) => {
  const { TR, SlotID } = req.body;

  if (!TR || !SlotID) {
    return res.status(400).json({ success: false, message: 'TR and SlotID required' });
  }

  try {
    const request = pool.request();
    request.input('TR', sql.Int, TR);
    request.input('SlotID', sql.Int, SlotID);

    // 🔹 Check capacity first
    const capacityCheck = await request.query(`
      SELECT s.MaxCapacity, 
             (SELECT COUNT(*) FROM Master WHERE SlotID = s.SlotID AND Status = 'Active') AS Assigned
      FROM Slots s
      WHERE s.SlotID = @SlotID AND s.IsActive = 1 
    `);

    if (capacityCheck.recordset.length === 0) {
      return res.status(404).json({ success: false, message: 'Slot not found' });
    }

    const { MaxCapacity, Assigned } = capacityCheck.recordset[0];
    if (Assigned >= MaxCapacity) {
      return res.json({ success: false, message: 'Slot is full! Cannot assign more students.' });
    }

    // 🔹 Update student's slot
    await request.query(`
      UPDATE Master
      SET SlotID = @SlotID
      WHERE TR = @TR
    `);

    res.json({ success: true, message: 'Slot updated successfully!' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ADD THIS NEW ENDPOINT
// Updates a student's preferred goal
app.put('/api/change-student-goal', async (req, res) => {
    // 1. Security Check: Ensure user is logged in
    if (!req.session.user) {
        return res.status(401).json({ success: false, message: 'Unauthorized. Please log in.' });
    }

    const { TR, Goal } = req.body;

    if (!TR || !Goal) {
        return res.status(400).json({ success: false, message: 'TR and Goal are required.' });
    }

    try {
        const request = pool.request();
        request.input('TR', sql.Int, TR);
        request.input('Goal', sql.NVarChar(100), Goal); // Assuming Goal is NVarChar

        // 2. Security Check (Optional but Recommended):
        //    Ensure the staff member can only edit students in their own branch/gender
        request.input('Branch', sql.NVarChar(50), req.session.user.Branch);
        request.input('Gender', sql.NVarChar(10), req.session.user.Gender);

        const result = await request.query(`
            UPDATE Master
            SET Goal = @Goal
            WHERE TR = @TR
              AND Branch = @Branch
              AND Gender = @Gender;
        `);

        if (result.rowsAffected[0] > 0) {
            res.json({ success: true, message: 'Goal updated successfully!' });
        } else {
            res.status(404).json({ success: false, message: 'Student not found or not in your branch.' });
        }

    } catch (err) {
        console.error('Error changing student goal:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});


//--------------------------------------------------------------------------------------------------------------------------

app.get('/api/overview-stats', async (req, res) => {
    // 1. Enforce login and session branch/gender, matching your other APIs
    if (!req.session.user || !req.session.user.Branch || !req.session.user.Gender) {
        return res.status(401).json({ success: false, error: 'Unauthorized. Please log in.' });
    }

    const { Branch, Gender } = req.session.user;

    try {
            const result = await pool.request()
            .input('Branch', sql.NVarChar(50), Branch)
            .input('Gender', sql.NVarChar(10), Gender)
            .query(`
                SELECT
                    (SELECT COUNT(*) FROM Master WHERE Status = 'Active' AND Branch = @Branch AND Gender = @Gender) AS activeStudents,
                    (SELECT COUNT(*) FROM Master WHERE Status = 'Inactive' AND Branch = @Branch AND Gender = @Gender) AS inactiveStudents,
                    (SELECT COUNT(*) FROM Slots WHERE IsActive = 1 AND Branch = @Branch AND Gender = @Gender) AS slots,
                    
                    (SELECT COUNT(T.TestLog) FROM TestRecords T JOIN Master M ON T.TR = M.TR WHERE M.Branch = @Branch AND M.Gender = @Gender) AS fitnessTests,
                    
                    -- --- ✅ REFINED LOGIC ---
                    -- This line is changed to compare dates in IST (+330 minutes) instead of UTC.
                    (SELECT COUNT(*) FROM TrainingPlan WHERE CAST(DATEADD(MINUTE, 330, CreatedAt) AS DATE) = CAST(DATEADD(MINUTE, 330, GETUTCDATE()) AS DATE) AND Branch = @Branch AND Gender = @Gender) AS todaysLogs,
                    -- --- END REFINEMENT ---

                    (SELECT COUNT(*) FROM WaitingList WHERE Branch = @Branch AND Gender = @Gender) AS waitingList,
                    
                    (SELECT COUNT(*) FROM PassBank WHERE Branch = @Branch) AS users;
            `);

        res.json({
            success: true,
            data: result.recordset[0]
        });
        
    } catch (err) {
        console.error("SQL error fetching overview stats:", err.message);
        res.status(500).json({ success: false, error: "Failed to fetch overview statistics" });
    }
});

//-------------------------------------------------------------------------------------------------------------------------
// CORRECTED VERSION
app.put('/api/students/status/:TR', async (req, res) => {
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


app.delete('/api/admin/delete-student/:tr', async (req, res, next) => {
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


// REPLACE your old /api/student-attendance/:weekId/me route

app.get('/api/student-attendance/:weekId/me', async (req, res, next) => {
    if (!req.session.user || !req.session.user.TR) {
        return res.status(401).json({ success: false, message: 'Unauthorized. Please log in.' });
    }

    const { weekId } = req.params;
    const { TR } = req.session.user;

    try {
        // 1. Get both the start and end dates of the week
        const weekQuery = await pool.request()
            .input('WeekID', sql.Int, weekId)
            .query(`SELECT WeekStartDate, WeekEndDate FROM AttendanceWeek WHERE WeekID = @WeekID`);

        if (weekQuery.recordset.length === 0) {
            return res.status(404).json({ error: 'Week not found' });
        }
        const { WeekStartDate, WeekEndDate } = weekQuery.recordset[0];

        // 2. Fetch the student's attendance, but also get their JoinedAt date
        const result = await pool.request()
            .input('WeekID', sql.Int, weekId)
            .input('TR', sql.Int, TR)
            .input('WeekEndDate', sql.Date, WeekEndDate) // Use the end date for the filter
            .query(`
                SELECT 
                    M.Name, M.JoinedAt,
                    DATENAME(WEEKDAY, A.CreatedAt) AS DayName,
                    A.IsPresent, A.OnLeave
                FROM Master M
                LEFT JOIN Attendance A ON M.TR = A.TR AND A.WeekID = @WeekID
                WHERE M.TR = @TR AND M.JoinedAt <= @WeekEndDate -- <-- THE FIX IS HERE
            `);

        const studentData = result.recordset[0] || { Name: '', JoinedAt: null };

        // Create a clean record for the student
        const record = {
            TR: TR,
            Name: studentData.Name,
            JoinedAt: studentData.JoinedAt, // Pass the join date to the frontend
            Monday: '', Tuesday: '', Wednesday: '', Thursday: '', Friday: '', Saturday: ''
        };

        // Loop through the database results to set the status for each day
        for (let row of result.recordset) {
            if (row.DayName) {
                if (row.IsPresent) {
                    record[row.DayName] = 'Present';
                } else if (row.OnLeave) {
                    record[row.DayName] = 'On Leave';
                }
            }
        }
        
        // 3. Send a structured response with all necessary info
        res.json({
            success: true,
            weekStartDate: WeekStartDate,
            attendance: [record]
        });

    } catch (err) {
        next(err);
    }
});

app.get('/api/weeks', async (req, res) => {
    try {
        const result = await pool.request().query(`
            SELECT WeekID,
                   CONVERT(varchar, WeekStartDate, 23) AS WeekStartDate, 
                   CONVERT(varchar, WeekEndDate, 23) AS WeekEndDate
            FROM AttendanceWeek
            ORDER BY WeekID ASC
        `);
        
        res.json({ success: true, weeks: result.recordset });
    } catch (err) {
        console.error('Error fetching weeks:', err.message);
        res.status(500).json({ success: false, error: 'Failed to fetch weeks' });
    }
});

app.get('/api/student-info/me', async (req, res) => {
  if (!req.session.user || !req.session.user.TR) {
    return res.status(401).json({ success: false, message: 'Unauthorized. Please log in.' });
  }

  const { TR } = req.session.user;
  
  try {
    const result = await pool.request()
      .input('TR', sql.Int, TR)   // <-- FIXED here, using TR not tr
      .query(`
        SELECT 
          M.Name, 
          M.Darajah, 
          M.Goal, 
          M.SlotID, 
          S.SlotName
        FROM Master M
        LEFT JOIN Slots S ON M.SlotID = S.SlotID
        WHERE M.TR = @TR
      `);

    if (result.recordset.length > 0) {
      res.json({ success: true, student: result.recordset[0] });
    } else {
      res.json({ success: false, message: 'Student not found' });
    }
  } catch (err) {
    console.error('Error fetching student info:', err.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});



// REPLACE your old /api/student/eligible-weeks route with this corrected version

app.get('/api/student/eligible-weeks', async (req, res, next) => {
    // 1. Ensure a student is logged in by checking the session
    if (!req.session.user || !req.session.user.TR) {
        return res.status(401).json({ success: false, message: 'Unauthorized. Please log in.' });
    }

    const { TR } = req.session.user;

    try {
        // 2. Get the student's official join date from the Master table
        const studentResult = await pool.request()
            .input('TR', sql.Int, TR)
            .query(`SELECT JoinedAt FROM Master WHERE TR = @TR`);

        if (studentResult.recordset.length === 0 || !studentResult.recordset[0].JoinedAt) {
             return res.status(404).json({ success: false, error: 'Student join date not found.' });
        }
        
        const joinedDate = studentResult.recordset[0].JoinedAt;
        
        // 3. Fetch all weeks that END on or after the student joined
        const weeksResult = await pool.request()
            .input('JoinedAt', sql.Date, joinedDate)
            .query(`
                SELECT WeekID,
                       CONVERT(varchar, WeekStartDate, 23) AS WeekStartDate,
                       CONVERT(varchar, WeekEndDate, 23) AS WeekEndDate
                FROM AttendanceWeek
                -- THE FIX IS HERE: Use WeekEndDate instead of WeekStartDate
                WHERE WeekEndDate >= @JoinedAt
                ORDER BY WeekID ASC
            `);

        res.json({ success: true, weeks: weeksResult.recordset });

    } catch (err) {
        next(err); // Pass error to centralized handler
    }
});


// REPLACE your old /api/weekly-attendance/:weekId route

app.get('/api/weekly-attendance/:weekId', async (req, res, next) => {
    const { weekId } = req.params;
    
    if (!req.session.user || !req.session.user.Branch || !req.session.user.Gender) {
        return res.status(401).json({ success: false, error: 'Unauthorized. Please log in.' });
    }
    const { Branch, Gender } = req.session.user;

    try {
        // --- THE FIX IS IN THIS QUERY ---
        // We now fetch both the start and end dates of the week.
        const weekQuery = await pool.request()
            .input('WeekID', sql.Int, weekId)
            .query(`SELECT WeekStartDate, WeekEndDate FROM AttendanceWeek WHERE WeekID = @WeekID`); // <-- 1. GET WeekEndDate HERE

        if (weekQuery.recordset.length === 0) {
            return res.status(404).json({ error: 'Week not found' });
        }
        
        // --- AND THE FIX IS HERE ---
        // Destructure both dates from the query result.
        const { WeekStartDate, WeekEndDate } = weekQuery.recordset[0]; // <-- 2. DEFINE WeekEndDate HERE
        const startDate = new Date(WeekStartDate);

        const attendanceQuery = await pool.request()
            .input('WeekID', sql.Int, weekId)
            .input('Branch', sql.NVarChar(50), Branch)
            .input('Gender', sql.NVarChar(10), Gender)
            .input('WeekEndDate', sql.Date, WeekEndDate) // This line now works correctly
            .query(`
                SELECT 
                    M.TR, M.Name, M.JoinedAt, S.SlotName,
                    DATENAME(WEEKDAY, A.CreatedAt) AS DayName,
                    A.IsPresent, A.OnLeave
                FROM Master M
                LEFT JOIN Attendance A ON M.TR = A.TR AND A.WeekID = @WeekID
                LEFT JOIN Slots S ON M.SlotID = S.SlotID
                WHERE 
                    M.Branch = @Branch 
                    AND M.Gender = @Gender 
                    AND M.Status = 'Active'
                    AND M.JoinedAt <= @WeekEndDate;
            `);

        // Your existing logic to process the results is correct and does not need to be changed.
        const resultMap = new Map();
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

        attendanceQuery.recordset.forEach(row => {
            if (!resultMap.has(row.TR)) {
                const record = { 
                    TR: row.TR, 
                    Name: row.Name,
                    SlotName: row.SlotName || 'N/A',
                    JoinedAt: row.JoinedAt // Pass JoinedAt to the frontend
                };
                dayNames.forEach((day, i) => {
                    const currentDate = new Date(startDate);
                    currentDate.setDate(startDate.getDate() + i);
                    if (currentDate > today) {
                        record[day] = null;
                    } else {
                        record[day] = 'Absent';
                    }
                });
                resultMap.set(row.TR, record);
            }
        });

        attendanceQuery.recordset.forEach(row => {
            if (row.DayName) {
                const studentRecord = resultMap.get(row.TR);
                if (row.IsPresent) {
                    studentRecord[row.DayName] = 'Present';
                } else if (row.OnLeave) {
                    studentRecord[row.DayName] = 'On Leave';
                }
            }
        });

        // MODIFIED RESPONSE:
        res.json({
            success: true,
            weekStartDate: WeekStartDate, // <-- ADD THIS LINE
            attendance: [...resultMap.values()]
        });

    } catch (err) {
        next(err); // Pass error to centralized handler
    }
});
//--------------------------------------------------------------------------------------------------
//.............................LOGIN INFO...........................................................
//--------------------------------------------------------------------------------------------------

// =================================================================== //
// --- 🔐 SECURE STUDENT LOGIN & PASSWORD MANAGEMENT ---
// =================================================================== //

// 1. REPLACE your existing /api/student-login route with this
app.post('/api/student-login', async (req, res, next) => {
    const { tr, password } = req.body;
    try {
        const result = await pool.request()
            .input('TR', sql.Int, tr)
            .query('SELECT TR, Name, Branch, Gender, Status, Password FROM Master WHERE TR = @TR');

        if (result.recordset.length === 0) {
            return res.status(401).json({ success: false, message: 'Invalid TR or password' });
        }

        const student = result.recordset[0];
        if (student.Status !== 'Active') {
            return res.status(403).json({ success: false, message: 'Your account is inactive. Please contact admin.' });
        }

        let forcePasswordChange = false;
        let isLoginSuccessful = false;

        // Check for first-time login (Password field is NULL in DB)
        if (student.Password === null) {
            if (password === student.TR.toString()) {
                isLoginSuccessful = true;
                forcePasswordChange = true; // Flag to force change on the frontend
            }
        } else {
            // Regular login: Compare hashed password
            const match = await bcrypt.compare(password, student.Password);
            if (match) {
                isLoginSuccessful = true;
            }
        }

        if (isLoginSuccessful) {
            req.session.user = { TR: student.TR, Name: student.Name, Branch: student.Branch, Gender: student.Gender };
            return res.json({ success: true, forcePasswordChange });
        } else {
            return res.status(401).json({ success: false, message: 'Invalid TR or password' });
        }
    } catch (err) {
        next(err);
    }
});

// 2. ADD THIS NEW route for the initial password set
app.post('/api/student/set-initial-password', async (req, res, next) => {
    if (!req.session.user || !req.session.user.TR) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    const { TR } = req.session.user;
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
        return res.status(400).json({ success: false, message: 'Password must be at least 6 characters long.' });
    }

    try {
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await pool.request()
            .input('TR', sql.Int, TR)
            .input('HashedPassword', sql.NVarChar(100), hashedPassword)
            .query('UPDATE Master SET Password = @HashedPassword, HasLoggedInBefore = 1 WHERE TR = @TR');
        
        res.json({ success: true, message: 'Password updated successfully!' });
    } catch (err) {
        next(err);
    }
});


// Replace the old /api/staff/reset-student-password/:tr route
app.put('/api/staff/reset-student-password/:tr', async (req, res, next) => {
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


// ✅ Updated /api/student-session route
app.get('/api/student-session', async (req, res) => {
  if (req.session.user && req.session.user.TR) {
    try {
      const { TR } = req.session.user;

      // Fetch the latest Level and XP info from Master
      const result = await pool.request()
        .input('TR', sql.Int, TR)
        .query(`
          SELECT FitnessLevel, CurrentXP, HasLoggedInBefore, joinedAt
          FROM Master 
          WHERE TR = @TR
        `);

      const userProfile = {
        ...req.session.user,
        ...result.recordset[0]  // merge DB info into session user
      };

      res.json({ success: true, user: userProfile });
    } catch (err) {
      console.error("❌ Error fetching session profile:", err);
      res.status(500).json({ success: false, error: "Server error" });
    }
  } else {
    res.json({ success: false });
  }
});





app.get('/api/session-user', (req, res) => {
  if (!req.session.user || !req.session.user.Branch || !req.session.user.Gender || !req.session.user.Role) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  res.json({
    success: true,
    user: req.session.user
  });
});



// REPLACE your old /api/trainer-login route
app.post('/api/trainer-login', async (req, res, next) => {
    const { username, password } = req.body;
    try {
        const result = await pool.request().input('Username', sql.NVarChar(50), username)
            .query('SELECT * FROM PassBank WHERE Username = @Username');

        if (result.recordset.length === 0) {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }

        const user = result.recordset[0];
        const match = await bcrypt.compare(password, user.Password);

        if (match) {
            if (user.Role !== 'Trainer') {
                return res.status(403).json({ success: false, message: 'Only Trainers can login here.' });
            }
            req.session.user = { Username: user.Username, Branch: user.Branch, Gender: user.Gender, Role: user.Role };
            // Return the flag
            return res.json({ success: true, user: req.session.user, isDefaultPassword: user.IsDefaultPassword });
        } else {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }
    } catch (err) { next(err); }
});



// REPLACE your old /api/staff-login route
app.post('/api/staff-login', async (req, res, next) => {
    const { username, password } = req.body;
    try {
        const result = await pool.request().input('Username', sql.NVarChar(50), username)
            .query('SELECT * FROM PassBank WHERE Username = @Username');

        if (result.recordset.length === 0) {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }

        const user = result.recordset[0];
        const match = await bcrypt.compare(password, user.Password);

        if (match) {
            if (user.Role === 'Trainer') {
                return res.status(403).json({ success: false, message: 'Trainers not allowed here.' });
            }
            req.session.user = { Username: user.Username, Branch: user.Branch, Gender: user.Gender, Role: user.Role };
            // Return the flag
            return res.json({ success: true, user: req.session.user, isDefaultPassword: user.IsDefaultPassword });
        } else {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }
    } catch (err) { next(err); }
});




// ADD these two new routes for password changes

// For the first-time password change modal
app.put('/api/staff/set-initial-password', async (req, res, next) => {
    if (!req.session.user || !req.session.user.Username) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    const { Username } = req.session.user;
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
        return res.status(400).json({ success: false, message: 'Password must be at least 6 characters long.' });
    }

    try {
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await pool.request()
            .input('Username', sql.NVarChar, Username)
            .input('HashedPassword', sql.NVarChar, hashedPassword)
            .query('UPDATE PassBank SET Password = @HashedPassword, IsDefaultPassword = 0 WHERE Username = @Username');
        
        res.json({ success: true, message: 'Password updated successfully!' });
    } catch (err) {
        next(err);
    }
});

// For an Admin to change their own password later
app.put('/api/admin/change-my-password', async (req, res, next) => {
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
// ------------------------------------------------------------------------------------------------------


// CORRECTED ADMIN ROUTES
// REPLACE your three existing admin routes with these secure versions

// 1. SECURED: Get all users
app.get('/api/admin/users/:branch', async (req, res, next) => {
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
app.post('/api/admin/add-user', async (req, res, next) => {
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

app.delete('/api/admin/delete-user/:username', async (req, res) => {
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

//---------------------------------------------------------------------------------------------------------------





// REPLACE your old /api/test-login route with this:
app.post('/api/test-login', async (req, res) => {
    const { username, password } = req.body; // username is TR, password is ITS

    try {
        const result = await pool.request()
            // Use NVarChar to safely handle the string input from the form
            .input('TR_Input', sql.NVarChar(50), username)
            .input('ITS_Input', sql.NVarChar(50), password)
            // Query the TestMaster table
            .query('SELECT TR FROM TestMaster WHERE TR = @TR_Input AND ITS = @ITS_Input');

        if (result.recordset.length === 0) {
            // Provide a more specific error message
            return res.status(401).json({ message: 'Invalid TR or ITS number.' });
        }

        // Login successful. Store the authenticated TR in the session.
        // Using result.recordset[0].TR is more secure than using the 'username' input.
        req.session.user = { TR: result.recordset[0].TR };
        
        return res.json({ message: 'Login successful' });

    } catch (err) {
        console.error('Test Login Error:', err);
        res.status(500).json({ message: 'Server error during login.' });
    }
});





app.get('/api/daily-attendance', async (req, res) => {
    if (!req.session.user || !req.session.user.Branch || !req.session.user.Gender) {
        return res.status(401).json({ error: 'Unauthorized access. Please log in.' });
    }

    const { Branch, Gender } = req.session.user;

    try {
        // --- ✅ REFINED LOGIC ---
        // 1. Define the start and end of the current day in the IST timezone.
        const startOfTodayIST = moment.tz("Asia/Kolkata").startOf('day');
        const endOfTodayIST = moment.tz("Asia/Kolkata").endOf('day');

        // 2. Convert these IST boundaries to UTC, as the database stores time in UTC.
        const startUTC = startOfTodayIST.utc().toDate();
        const endUTC = endOfTodayIST.utc().toDate();
        // --- END REFINEMENT ---

        const result = await pool.request()
            .input('Branch', sql.NVarChar(50), Branch)
            .input('Gender', sql.NVarChar(50), Gender)
            // 3. Pass the UTC range as parameters to the query.
            .input('StartUTC', sql.DateTime, startUTC)
            .input('EndUTC', sql.DateTime, endUTC)
            .query(`
                SELECT 
                    M.TR,
                    M.Name,
                    CASE 
                        WHEN A.OnLeave = 1 THEN 'On Leave'
                        WHEN A.IsPresent = 1 THEN 'Present'
                        ELSE 'Absent'
                    END AS IsPresentToday
                FROM Master M
                LEFT JOIN Attendance A
                    ON M.TR = A.TR 
                    -- 4. Find attendance records that fall within the UTC range of the IST day.
                    AND A.CreatedAt BETWEEN @StartUTC AND @EndUTC
                WHERE M.Status = 'Active'
                AND M.Branch = @Branch
                AND M.Gender = @Gender
                ORDER BY M.Name
            `);

        res.json(result.recordset);
    } catch (err) {
        console.error('❌ Error fetching daily attendance:', err.message);
        res.status(500).json({ error: 'Failed to fetch daily attendance' });
    }
});

// ✅ Log Training Plan API with XP integration
app.post('/api/log-training-plan', async (req, res) => {
    const { TR, BodyParts } = req.body;
    const { Branch, Gender } = req.session.user;

    const transaction = new sql.Transaction(pool);
    try {
        await transaction.begin();

        // Step 1: Insert into TrainingPlan
        const planResult = await new sql.Request(transaction)
            .input('TR', sql.Int, TR)
            .input('Branch', sql.NVarChar(50), Branch)
            .input('Gender', sql.NVarChar(10), Gender)
            .query(`
                INSERT INTO TrainingPlan (TR, Branch, Gender)
                OUTPUT INSERTED.PlanID
                VALUES (@TR, @Branch, @Gender);
            `);

        const newPlanID = planResult.recordset[0].PlanID;

        // Step 2: Insert each body part into TrainingLog
        for (const partName of BodyParts) {
            await new sql.Request(transaction)
                .input('PlanID', sql.Int, newPlanID)
                .input('PartName', sql.NVarChar(50), partName)
                .query(`
                    INSERT INTO TrainingLog (PlanID, BodyPartID)
                    SELECT @PlanID, BodyPartID FROM BodyParts WHERE Name = @PartName;
                `);
        }

        // --- ✅ NEW XP integration ---
        const xpToAward = 10 + (BodyParts.length > 1 ? (BodyParts.length - 1) * 3 : 0);
        const levelUpInfo = await awardXP(TR, xpToAward, transaction);

        // Commit if all inserts + XP succeed
        await transaction.commit();

        res.json({ 
            success: true, 
            message: 'Training plan logged successfully',
            levelUpInfo // ← Extra info about XP/level up
        });

    } catch (err) {
        // Rollback if anything fails
        if (transaction._aborted === false) {
            await transaction.rollback();
        }
        console.error('❌ Error logging training plan:', err);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// NEW: POST /api/student/log-weight
// Logs a new weight entry for the current student
app.post('/api/student/log-weight', async (req, res) => {
    if (!req.session.user || !req.session.user.TR) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    const { TR } = req.session.user;
    const { weight } = req.body;

    if (!weight || isNaN(parseFloat(weight)) || weight <= 0) {
        return res.status(400).json({ success: false, message: 'Invalid weight value.' });
    }

    try {
        await pool.request()
            .input('TR', sql.Int, TR)
            .input('Weight', sql.Decimal(5, 2), parseFloat(weight))
            .query(`INSERT INTO WeightTracking (TR, Weight) VALUES (@TR, @Weight)`);
        
        res.json({ success: true, message: 'Weight logged successfully' });
    } catch (err) {
        console.error('Error logging weight:', err);
        res.status(500).json({ success: false, message: 'Database error' });
    }
});

// NEW: GET /api/student/weight-history
// Gets all ad-hoc weight logs for the current student
app.get('/api/student/weight-history', async (req, res) => {
    if (!req.session.user || !req.session.user.TR) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    const { TR } = req.session.user;

    try {
        const result = await pool.request()
            .input('TR', sql.Int, TR)
            .query(`
                SELECT LogID, Weight, 
                       FORMAT(CreatedAt, 'ddd, dd MMM yyyy') AS FormattedDate
                FROM WeightTracking 
                WHERE TR = @TR 
                ORDER BY CreatedAt DESC
            `);
        
        res.json({ success: true, data: result.recordset });
    } catch (err) {
        console.error('Error fetching weight history:', err);
        res.status(500).json({ success: false, message: 'Database error' });
    }
});

// NEW: DELETE /api/student/log-weight/:id
// Deletes a specific weight log entry, ensuring it belongs to the logged-in student
app.delete('/api/student/log-weight/:id', async (req, res) => {
    if (!req.session.user || !req.session.user.TR) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    const { TR } = req.session.user;
    const { id } = req.params;

    try {
        const result = await pool.request()
            .input('TR', sql.Int, TR)
            .input('LogID', sql.Int, id)
            .query(`
                DELETE FROM WeightTracking 
                WHERE LogID = @LogID AND TR = @TR
            `);
        
        if (result.rowsAffected[0] > 0) {
            res.json({ success: true, message: 'Log deleted' });
        } else {
            res.status(404).json({ success: false, message: 'Log not found or you do not have permission to delete it' });
        }
    } catch (err) {
        console.error('Error deleting weight log:', err);
        res.status(500).json({ success: false, message: 'Database error' });
    }
});

app.get('/api/student/training-analytics', async (req, res) => {
    if (!req.session.user || !req.session.user.TR) {
        return res.status(401).json({ success: false, message: 'Unauthorized. Please log in.' });       
    }   
    
    const { TR } = req.session.user; 

    try {
        const result = await pool.request()
            .input('TR', sql.Int, TR)
            .query(`
                SELECT B.Name as bodyPart, COUNT(L.LogID) as count
                FROM TrainingLog L
                JOIN TrainingPlan P ON L.PlanID = P.PlanID
                JOIN BodyParts B ON L.BodyPartID = B.BodyPartID
                WHERE P.TR = @TR
                GROUP BY B.Name
                ORDER BY count DESC;
            `);
        res.json({ success: true, data: result.recordset });
    } catch (err) { /* ... error handling ... */ }
});


app.get('/api/student/training-plans', async (req, res) => {
    // Session check remains the same
    if (!req.session.user || !req.session.user.TR) {
        return res.status(401).json({ success: false, message: 'Unauthorized. Please log in.' });
    }

    const { TR } = req.session.user;

    try {
        const result = await pool.request()
            .input('TR', sql.Int, TR)
            // ✅ THIS IS THE NEW, NORMALIZED QUERY
            .query(`
                SELECT 
                    CONVERT(VARCHAR(10), P.CreatedAt, 120) AS LogDate,
                    -- Use STRING_AGG to combine multiple rows of body parts into one string
                    STRING_AGG(B.Name, ', ') AS BodyParts
                FROM TrainingPlan P
                -- Join through the new tables
                JOIN TrainingLog L ON P.PlanID = L.PlanID
                JOIN BodyParts B ON L.BodyPartID = B.BodyPartID
                WHERE P.TR = @TR
                -- Group by the plan to aggregate the parts for each session
                GROUP BY P.PlanID, P.CreatedAt
                ORDER BY P.CreatedAt DESC;
            `);

        res.json({ success: true, data: result.recordset });
    } catch (err) {
        console.error('❌ Error fetching student training plans:', err);
        res.status(500).json({ success: false, message: 'Failed to fetch student training plan history' });
    }
});

// REPLACE your old /api/leaderboard route with this new, improved version

app.get('/api/leaderboard', async (req, res, next) => {
    if (!req.session.user || !req.session.user.Branch || !req.session.user.Gender) {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
    }
    const { Branch, Gender } = req.session.user;

    try {
        // --- NEW LOGIC: Define the start and end of YESTERDAY in IST, converted to UTC ---
        const yesterdayStart = moment.tz("Asia/Kolkata").subtract(1, 'day').startOf('day').utc().toDate();
        const yesterdayEnd = moment.tz("Asia/Kolkata").subtract(1, 'day').endOf('day').utc().toDate();

        const request = pool.request();
        request.input('Branch', sql.NVarChar(50), Branch);
        request.input('Gender', sql.NVarChar(10), Gender);
        request.input('YesterdayStart', sql.DateTime, yesterdayStart);
        request.input('YesterdayEnd', sql.DateTime, yesterdayEnd);

        const result = await request.query(`
            -- Common Table Expression for calculating total workout duration yesterday
            WITH DurationScores AS (
                SELECT 
                    TR, 
                    SUM(ISNULL(DurationInMinutes, 0)) AS TotalDuration
                FROM Attendance
                WHERE CreatedAt BETWEEN @YesterdayStart AND @YesterdayEnd
                GROUP BY TR
            ),
            -- Common Table Expression for calculating total body parts trained yesterday
            LogScores AS (
                SELECT 
                    P.TR, 
                    COUNT(L.LogID) as TotalBodyParts
                FROM TrainingPlan P
                JOIN TrainingLog L ON P.PlanID = L.PlanID
                WHERE P.CreatedAt BETWEEN @YesterdayStart AND @YesterdayEnd
                GROUP BY P.TR
            )
            -- Final selection and ranking
            SELECT TOP 3 
                M.Name,
                COALESCE(D.TotalDuration, 0) AS Score -- The main score is now duration
            FROM Master M
            LEFT JOIN DurationScores D ON M.TR = D.TR
            LEFT JOIN LogScores L ON M.TR = L.TR
            WHERE M.Branch = @Branch 
              AND M.Gender = @Gender 
              AND M.Status = 'Active'
              AND (D.TotalDuration > 0 OR L.TotalBodyParts > 0) -- Only include students who were active yesterday
            ORDER BY
                COALESCE(D.TotalDuration, 0) DESC, -- 1. Rank by most minutes spent
                COALESCE(L.TotalBodyParts, 0) DESC; -- 2. Then by most body parts trained
        `);
        
        res.json({ success: true, data: result.recordset });

    } catch (err) {
        next(err); // Pass error to the centralized handler
    }
});


// MODIFIED: /api/student/fitness-test-history
// Now combines data from TestRecords AND WeightTracking for a complete chart
app.get('/api/student/fitness-test-history', async (req, res) => {
    if (!req.session.user || !req.session.user.TR) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    const { TR } = req.session.user;
    try {
        const result = await pool.request()
            .input('TR', sql.Int, TR)
            .query(`
                -- Combine data from both tables into one result set
                SELECT 
                    'Test' AS Source,
                    CONVERT(VARCHAR(10), CreatedAt, 120) AS TestDate, 
                    Weight, 
                    BodyFat
                FROM TestRecords 
                WHERE TR = @TR
                
                UNION
                
                SELECT 
                    'Log' AS Source,
                    CONVERT(VARCHAR(10), CreatedAt, 120) AS TestDate, 
                    Weight, 
                    NULL AS BodyFat -- Ad-hoc logs don't have body fat
                FROM WeightTracking
                WHERE TR = @TR

                -- Order all combined results by date to make the line chart correct
                ORDER BY TestDate ASC;
            `);
        
        res.json({ success: true, data: result.recordset });
    } catch (err) { 
        console.error('Error fetching combined fitness history:', err);
        res.status(500).json({ success: false, message: 'Database error' });
    }
});

// API for the Workout Consistency Heatmap
app.get('/api/student/workout-calendar', async (req, res) => {
    if (!req.session.user || !req.session.user.TR) return res.status(401).json({ success: false });
    const { TR } = req.session.user;
    try {
        const result = await pool.request()
            .input('TR', sql.Int, TR)
            .query(`
                SELECT DISTINCT CAST(P.CreatedAt AS DATE) as workoutDate
                FROM TrainingPlan P
                WHERE P.TR = @TR AND P.CreatedAt > DATEADD(month, -6, GETDATE());
            `);
        res.json({ success: true, data: result.recordset.map(r => r.workoutDate) });
    } catch (err) { res.status(500).json({ success: false }); }
});

app.get('/api/training-plans/:tr', async (req, res) => {
    const { tr } = req.params;

    // ✅ Ensure trainer is logged in
    if (!req.session.user || !req.session.user.Branch || !req.session.user.Gender) {
        return res.status(401).json({ success: false, message: 'Unauthorized. Please log in.' });
    }

    const { Branch, Gender } = req.session.user;

    try {
        const result = await pool.request()
            .input('TR', sql.Int, tr)
            // ✅ THIS IS THE NEW, CORRECTED QUERY
            .query(`
                SELECT 
                    CONVERT(VARCHAR(10), P.CreatedAt, 120) AS LogDate,
                    STRING_AGG(B.Name, ', ') AS BodyParts
                FROM TrainingPlan P
                JOIN TrainingLog L ON P.PlanID = L.PlanID
                JOIN BodyParts B ON L.BodyPartID = B.BodyPartID
                WHERE P.TR = @TR
                GROUP BY P.PlanID, P.CreatedAt
                ORDER BY P.CreatedAt DESC;
            `);

        res.json({ success: true, data: result.recordset });
    } catch (err) {
        console.error('❌ Error fetching training plans:', err);
        res.status(500).json({ success: false, message: 'Failed to fetch training plan history' });
    }
});

// Replace the entire /api/student/session-analytics - with this new sequential version
app.get('/api/student/session-analytics', async (req, res) => {
    if (!req.session.user || !req.session.user.TR) {
        return res.status(401).json({ success: false, message: 'Unauthorized. Please log in.' });
    }
    const { TR } = req.session.user;
    const transaction = new sql.Transaction(pool);

    try {
        await transaction.begin();

        // --- ✅ NEW LOGIC: Run queries one after another (sequentially) ---

        // Query 1: Get recent session history
        const historyResult = await new sql.Request(transaction)
            .input('TR', sql.Int, TR)
            .query(`
                SELECT TOP 20 CreatedAt, OutTime, DurationInMinutes 
                FROM Attendance 
                WHERE TR = @TR AND OutTime IS NOT NULL 
                ORDER BY CreatedAt DESC;
            `);

        // Query 2: Get average workout duration
        const averageResult = await new sql.Request(transaction)
            .input('TR', sql.Int, TR)
            .query(`
                SELECT AVG(CAST(DurationInMinutes AS FLOAT)) as avgDuration 
                FROM Attendance 
                WHERE TR = @TR AND DurationInMinutes > 0;
            `);

        // Query 3: Get total hours per week
        const weeklyResult = await new sql.Request(transaction)
            .input('TR', sql.Int, TR)
            .query(`
                SELECT TOP 8
                    W.WeekStartDate,
                    ISNULL(SUM(A.DurationInMinutes) / 60.0, 0) as totalHours
                FROM AttendanceWeek W
                LEFT JOIN Attendance A ON W.WeekID = A.WeekID AND A.TR = @TR
                GROUP BY W.WeekID, W.WeekStartDate
                ORDER BY W.WeekStartDate DESC;
            `);
        
        // All queries are done, now commit the transaction
        await transaction.commit();

        res.json({
            success: true,
            data: {
                history: historyResult.recordset,
                average: averageResult.recordset[0] ? averageResult.recordset[0].avgDuration : 0,
                weekly: weeklyResult.recordset.reverse()
            }
        });

    } catch (err) {
        await transaction.rollback();
        console.error('Error fetching student session analytics:', err);
        res.status(500).json({ success: false, message: 'Failed to fetch analytics data' });
    }
});


//---------------------------------------------------------------------------------------------------------------

app.get('/api/verify-tr/:tr', async (req, res) => {
    const { tr } = req.params;

    if (!req.session.user || !req.session.user.Branch || !req.session.user.Gender) {
        return res.status(401).json({
            valid: false,
            message: 'Unauthorized access. Please log in as a trainer.'
        });
    }

    const { Branch, Gender } = req.session.user;

    try {
        const request = pool.request();
        request.input('TR', sql.Int, tr);
        request.input('Branch', sql.NVarChar(50), Branch);
        request.input('Gender', sql.NVarChar(50), Gender);

        const result = await request.query(`
            SELECT m.TR, m.Name, m.Darajah, m.Goal, s.SlotID, s.SlotName
            FROM Master m
            LEFT JOIN Slots s ON m.SlotID = s.SlotID
            WHERE m.TR = @TR AND m.Status = 'Active' AND m.Branch = @Branch AND m.Gender = @Gender
        `);

        if (result.recordset.length === 0) {
            return res.status(404).json({
                valid: false,
                message: 'Invalid TR, inactive member, or unauthorized access'
            });
        }

        const student = result.recordset[0];

        res.json({
            valid: true,
            data: {
                TR: student.TR,
                Name: student.Name,
                SlotID: student.SlotID,
                SlotName: student.SlotName,
                Darajah: student.Darajah,
                Goal: student.Goal
            }
        });
    } catch (err) {
        console.error('Error verifying TR:', err);
        res.status(500).json({
            valid: false,
            message: 'Internal server error'
        });
    }
});



app.post('/api/get-or-create-week', async (req, res) => {
    try {
        const { WeekStartDate, WeekEndDate } = req.body;

        if (!WeekStartDate || !WeekEndDate) {
            return res.status(400).json({ error: 'WeekStartDate and WeekEndDate are required' });
        }

        const request = pool.request();

        // --- ✅ REFINED LOGIC ---
        // This line is the only change. It gets the current date in the "Asia/Kolkata" (IST) timezone.
        const todayInIST = moment.tz("Asia/Kolkata").format('YYYY-MM-DD');
        request.input('Today', sql.Date, todayInIST);
        // --- END REFINEMENT ---

        // The rest of your logic is perfect and remains unchanged.
        // It now correctly uses the IST date to find the week.
        const existingWeek = await request.query(`
            SELECT TOP 1 WeekID FROM AttendanceWeek 
            WHERE @Today BETWEEN WeekStartDate AND WeekEndDate
            ORDER BY WeekID DESC
        `);

        if (existingWeek.recordset.length > 0) {
            return res.json({ WeekID: existingWeek.recordset[0].WeekID });
        }

        const insertRequest = pool.request();
        insertRequest.input('WeekStartDate', sql.Date, WeekStartDate);
        insertRequest.input('WeekEndDate', sql.Date, WeekEndDate);

        await insertRequest.query(`
            INSERT INTO AttendanceWeek (WeekStartDate, WeekEndDate)
            VALUES (@WeekStartDate, @WeekEndDate)
        `);
        
        const newWeekResult = await insertRequest.query(`
            SELECT TOP 1 WeekID FROM AttendanceWeek 
            WHERE WeekStartDate = @WeekStartDate AND WeekEndDate = @WeekEndDate
            ORDER BY WeekID DESC
        `);
        
        return res.json({ message: '✅ Week created', WeekID: newWeekResult.recordset[0].WeekID });

    } catch (err) {
        console.error('❌ Error creating/fetching week:', err);
        res.status(500).json({ error: 'Failed to fetch or create week' });
    }
});



app.get('/api/current-tr', (req, res) => {
    if (!req.session.user || !req.session.user.TR) {
        return res.status(401).json({ message: 'Not logged in' });
    }
    res.json({ tr: req.session.user.TR }); 
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      return res.status(500).json({ success: false, message: 'Failed to logout' });
    }
    res.clearCookie('connect.sid'); // Optional: clear the session cookie
    res.json({ success: true, message: 'Logged out successfully' });
  });
});



//-----------------------------------------------------------------------------------------------------------------------------



app.get('/api/all-test-records', async (req, res) => {
  const { Branch, Gender } = req.session.user || {};

  // Allow only Marol Male staff to access
  if (Branch !== 'Marol' || Gender !== 'Male') {
    return res.status(403).json({ success: false, message: 'Access denied: Not authorized' });
  }

  try {
    const result = await pool.request().query(`
      SELECT 
        TRS.CreatedAt AS CreatedAt,
        TRS.TR,
        TMS.Name,
        TRS.Age,
        TRS.Weight,
        TRS.Height,
        TRS.Waist,
        TRS.Hips,
        TRS.Neck,
        TRS.BMI,
        TRS.BMIStatus,
        TRS.BodyFat,
        TRS.BMR,
        TRS.CalorieIntake,
        TRS.VO2Max,
        TRS.Total,
        TRS.Grade,
        TRS.SubmittedBy
      FROM TestRecords TRS
      JOIN TestMaster TMS ON TRS.TR = TMS.TR
      ORDER BY TRS.CreatedAt DESC
    `);

    res.json({ success: true, data: result.recordset });
  } catch (err) {
    console.error('Error fetching all test records:', err.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});


//--------------------------------------------------------------------------------------------------------
app.post('/api/save-workout-plan', async (req, res) => {
  try {
    
    const { TR, Branch, Gender } = req.session.user;
    if (!TR || !Branch || !Gender) { 
        return res.status(401).json({ success: false, message: "Unauthorized" });   
    }

    const plan = req.body; // { Monday: '...', Tuesday: '...', ... }


    // ✅ Get today's date in 'YYYY-MM-DD' format

    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10); // YYYY-MM-DD



    // ✅ Get current week ID
       const weekResult = await pool.request()
      .input('Today', sql.Date, todayStr)
      .query(`
        SELECT TOP 1 WeekID FROM AttendanceWeek
        WHERE WeekStartDate <= @Today AND WeekEndDate >= @Today
      `);

    if (weekResult.recordset.length === 0) {
      return res.status(400).json({ success: false, message: 'Current week not found in AttendanceWeek' });
    }

    const currentWeekID = weekResult.recordset[0].WeekID;

    // ✅ Save or update each day's plan
    for (const [day, content] of Object.entries(plan)) {
      await pool.request()
        .input('TR', sql.Int, TR)
        .input('Day', sql.NVarChar(20), day)
        .input('Content', sql.NVarChar(sql.MAX), content)
        .input('Branch', sql.NVarChar(50), Branch)
        .input('Gender', sql.NVarChar(50), Gender)
        .input('WeekID', sql.Int, currentWeekID)
        .query(`
          MERGE WorkoutPlan AS target
          USING (SELECT @TR AS TR, @Day AS Day, @WeekID AS WeekID) AS source
          ON target.TR = source.TR AND target.Day = source.Day AND target.WeekID = source.WeekID
          WHEN MATCHED THEN 
              UPDATE SET Content = @Content, Branch = @Branch, Gender = @Gender
          WHEN NOT MATCHED THEN
              INSERT (TR, Day, Content, Branch, Gender, WeekID)
              VALUES (@TR, @Day, @Content, @Branch, @Gender, @WeekID);
        `);
    }

    res.json({ success: true });

  } catch (err) {
    console.error('Save error:', err);
    res.status(500).json({ success: false, message: 'Workout plan save failed' });
  }
});


app.get('/api/student/workout-plan', async (req, res) => {
  try {
    // ✅ ADD THIS CHECK FIRST
    // This ensures a user is logged in before we try to access their details.
    if (!req.session.user) {
      return res.status(401).json({ success: false, message: "Unauthorized. Please log in." });
    }

    // Now that we know req.session.user exists, it's safe to destructure it.
    const { TR, Branch, Gender } = req.session.user;

    // This check is still useful for data integrity.
    if (!TR || !Branch || !Gender) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    // 1. Get current week ID
    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10); // 'YYYY-MM-DD'

    const weekResult = await pool.request()
      .input('Today', sql.Date, todayStr)
      .query(`
        SELECT TOP 1 WeekID FROM AttendanceWeek
        WHERE WeekStartDate <= @Today AND WeekEndDate >= @Today
      `);

    if (weekResult.recordset.length === 0) {
      return res.json({ success: true, currentWeekID: null, plans: [], hasCurrentWeek: false });
    }

    const currentWeekID = weekResult.recordset[0].WeekID;

    // 2. Fetch current week plan
    const planResult = await pool.request()
      .input('TR', sql.Int, TR)
      .input('Branch', sql.NVarChar(50), Branch)
      .input('Gender', sql.NVarChar(50), Gender)
      .input('WeekID', sql.Int, currentWeekID)
      .query(`
        SELECT Day, Content FROM WorkoutPlan
        WHERE TR = @TR AND Branch = @Branch AND Gender = @Gender AND WeekID = @WeekID
      `);
      
    res.json({
      success: true,
      currentWeekID,
      data: planResult.recordset,
      hasCurrentWeek: planResult.recordset.length > 0
    });
  } catch (err) {
    console.error('Workout GET error:', err);
    res.status(500).json({ success: false, message: 'Failed to load workout plan' });
  }
});



app.post('/api/student/apply-last-week', async (req, res) => {
  try {
    const { TR, Branch, Gender } = req.session.user;

    if (!TR || !Branch || !Gender) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);

    

    // Get current week
    const weekResult = await pool.request()
      .input('Today', sql.Date, todayStr)
      .query(`
        SELECT TOP 1 WeekID FROM AttendanceWeek
        WHERE WeekStartDate <= @Today AND WeekEndDate >= @Today
      `);

    if (weekResult.recordset.length === 0) {
      return res.status(400).json({ success: false, message: "Current week not found" });
    }

    const currentWeekID = weekResult.recordset[0].WeekID;

    // Get last week's plan
    const lastWeekPlanResult = await pool.request()
      .input('TR', sql.Int, TR)
      .input('Branch', sql.NVarChar(50), Branch)
      .input('Gender', sql.NVarChar(50), Gender)
      .query(`
        SELECT TOP 1 WeekID FROM WorkoutPlan
        WHERE TR = @TR AND Branch = @Branch AND Gender = @Gender
          AND WeekID <> ${currentWeekID}
        ORDER BY WeekID DESC
      `);

    if (lastWeekPlanResult.recordset.length === 0) {
      return res.json({ success: false, message: "No previous week plan found" });
    }

    const lastWeekID = lastWeekPlanResult.recordset[0].WeekID;

    // Get actual content from that week
    const contentResult = await pool.request()
      .input('TR', sql.Int, TR)
      .input('Branch', sql.NVarChar(50), Branch)
      .input('Gender', sql.NVarChar(50), Gender)
      .input('WeekID', sql.Int, lastWeekID)
      .query(`
        SELECT Day, Content FROM WorkoutPlan
        WHERE TR = @TR AND Branch = @Branch AND Gender = @Gender AND WeekID = @WeekID
      `);

    // Insert into current week
    for (const row of contentResult.recordset) {
      await pool.request()
        .input('TR', sql.Int, TR)
        .input('Day', sql.NVarChar(20), row.Day)
        .input('Content', sql.NVarChar(sql.MAX), row.Content)
        .input('Branch', sql.NVarChar(50), Branch)
        .input('Gender', sql.NVarChar(50), Gender)
        .input('WeekID', sql.Int, currentWeekID)
        .query(`
          MERGE WorkoutPlan AS target
          USING (SELECT @TR AS TR, @Day AS Day, @WeekID AS WeekID) AS source
          ON target.TR = source.TR AND target.Day = source.Day AND target.WeekID = source.WeekID
          WHEN MATCHED THEN UPDATE SET Content = @Content
          WHEN NOT MATCHED THEN
            INSERT (TR, Day, Content, Branch, Gender, WeekID)
            VALUES (@TR, @Day, @Content, @Branch, @Gender, @WeekID);
        `);
    }

    res.json({ success: true });

  } catch (err) {
    console.error('Apply last week error:', err);
    res.status(500).json({ success: false, message: "Failed to apply last week plan" });
  }
});




//--------------------------------------------------------------------------------------------------------

app.get('/api/all-training-plans', async (req, res) => {
  if (!req.session.user || !req.session.user.Branch || !req.session.user.Gender) {
    return res.status(401).json({ success: false, message: 'Unauthorized. Please log in.' });
  }

  const { Branch, Gender } = req.session.user;

  try {
    const result = await pool.request()
      .input('Branch', sql.NVarChar(50), Branch)
      .input('Gender', sql.NVarChar(50), Gender)
      // ✅ THIS IS THE NEW, NORMALIZED QUERY
      .query(`
        SELECT 
          P.TR,
          M.Name, -- Include the student's name
          P.CreatedAt,
          -- Use STRING_AGG to combine multiple body parts back into one string for display
          STRING_AGG(B.Name, ', ') AS BodyParts
        FROM TrainingPlan P
        JOIN Master M ON P.TR = M.TR
        JOIN TrainingLog L ON P.PlanID = L.PlanID
        JOIN BodyParts B ON L.BodyPartID = B.BodyPartID
        WHERE P.Branch = @Branch AND P.Gender = @Gender
        GROUP BY P.PlanID, P.TR, M.Name, P.CreatedAt
        ORDER BY P.CreatedAt DESC;
      `);

    res.json({ success: true, data: result.recordset });
  } catch (err) {
    console.error('Error fetching all training plans:', err.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.get('/api/leaderboard', async (req, res) => {
    if (!req.session.user || !req.session.user.Branch || !req.session.user.Gender) {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
    }
    const { Branch, Gender } = req.session.user;

    try {
        const request = pool.request();
        request.input('Branch', sql.NVarChar(50), Branch);
        request.input('Gender', sql.NVarChar(10), Gender);

        const result = await request.query(`
            DECLARE @CurrentWeekID INT;
            DECLARE @CurrentWeekStart DATE;
            DECLARE @CurrentWeekEnd DATE;

            SELECT TOP 1
                @CurrentWeekID = WeekID,
                @CurrentWeekStart = WeekStartDate,
                @CurrentWeekEnd = WeekEndDate
            FROM AttendanceWeek 
            -- --- ✅ REFINED LOGIC ---
            -- This line now uses the current IST time to find the correct week.
            WHERE DATEADD(MINUTE, 330, GETUTCDATE()) BETWEEN WeekStartDate AND WeekEndDate;
            -- --- END REFINEMENT ---

            -- The rest of your query logic is perfect and remains unchanged.
            WITH AttendanceScores AS (
                SELECT TR, COUNT(*) AS AttendanceCount
                FROM Attendance
                WHERE WeekID = @CurrentWeekID AND IsPresent = 1
                GROUP BY TR
            ),
            LogScores AS (
                SELECT P.TR, COUNT(L.LogID) as TotalBodyParts, COUNT(DISTINCT CAST(P.CreatedAt AS DATE)) as WorkoutDays
                FROM TrainingPlan P
                JOIN TrainingLog L ON P.PlanID = L.PlanID
                WHERE P.CreatedAt BETWEEN @CurrentWeekStart AND DATEADD(day, 1, @CurrentWeekEnd)
                GROUP BY P.TR
            )
            SELECT TOP 3 M.Name, COALESCE(A.AttendanceCount, 0) AS AttendanceScore
            FROM Master M
            LEFT JOIN AttendanceScores A ON M.TR = A.TR
            LEFT JOIN LogScores T ON M.TR = T.TR
            WHERE M.Branch = @Branch AND M.Gender = @Gender AND M.Status = 'Active'
            ORDER BY
                COALESCE(A.AttendanceCount, 0) DESC,
                COALESCE(T.WorkoutDays, 0) DESC,
                COALESCE(T.TotalBodyParts, 0) DESC;
        `);
        res.json({ success: true, data: result.recordset });
    } catch (err) {
        console.error('Error fetching leaderboard:', err);
        res.status(500).json({ success: false, error: 'Failed to fetch leaderboard' });
    }
});

// API to get Body Part trends for the bar chart
app.get('/api/staff/body-part-trends', async (req, res) => {
    if (!req.session.user) return res.status(401).json({ success: false });
    const { Branch, Gender } = req.session.user;

    try {
        const result = await pool.request()
            .input('Branch', sql.NVarChar(50), Branch)
            .input('Gender', sql.NVarChar(50), Gender)
            .query(`
                SELECT B.Name as bodyPart, COUNT(L.LogID) as count
                FROM TrainingLog L
                JOIN TrainingPlan P ON L.PlanID = P.PlanID
                JOIN BodyParts B ON L.BodyPartID = B.BodyPartID
                WHERE P.Branch = @Branch AND P.Gender = @Gender
                GROUP BY B.Name
                ORDER BY count DESC;
            `);
        res.json({ success: true, data: result.recordset });
    } catch (err) {
        console.error('Error fetching body part trends:', err);
        res.status(500).json({ success: false });
    }
});


// API to get a ranked summary of students by a specific body part workout
app.get('/api/staff/workout-summary-by-bodypart', async (req, res) => {
    if (!req.session.user) return res.status(401).json({ success: false });

    const { Branch, Gender } = req.session.user;
    const { partName } = req.query; // e.g., ?partName=Legs

    if (!partName) {
        return res.status(400).json({ success: false, error: 'A body part name is required.' });
    }

    try {
        const result = await pool.request()
            .input('Branch', sql.NVarChar(50), Branch)
            .input('Gender', sql.NVarChar(50), Gender)
            .input('BodyPartName', sql.NVarChar(50), partName)
            .query(`
                SELECT
                    M.TR, M.Name, COUNT(L.LogID) AS WorkoutCount
                FROM Master M
                JOIN TrainingPlan P ON M.TR = P.TR
                JOIN TrainingLog L ON P.PlanID = L.PlanID
                JOIN BodyParts B ON L.BodyPartID = B.BodyPartID
                WHERE
                    B.Name = @BodyPartName
                    AND P.Branch = @Branch AND P.Gender = @Gender
                GROUP BY M.TR, M.Name
                ORDER BY WorkoutCount DESC;
            `);
        res.json({ success: true, data: result.recordset });
    } catch (err) {
        console.error('Error fetching workout summary:', err);
        res.status(500).json({ success: false });
    }
});


app.get('/api/staff/activity-summary', async (req, res) => {
    if (!req.session.user) return res.status(401).json({ success: false });
    const { Branch, Gender } = req.session.user;

    try {
        const result = await pool.request()
            .input('Branch', sql.NVarChar(50), Branch)
            .input('Gender', sql.NVarChar(50), Gender)
            .query(`
                -- --- ✅ REFINED LOGIC ---
                -- This line now defines the start of the week based on the IST calendar.
                DECLARE @WeekStart DATE = DATEADD(wk, DATEDIFF(wk, 7, DATEADD(MINUTE, 330, GETUTCDATE())), 0);
                -- --- END REFINEMENT ---

                DECLARE @PrevWeekStart DATE = DATEADD(wk, -1, @WeekStart);

                -- Most Trained Body Part This Week
                SELECT TOP 1 B.Name AS mostTrainedBodyPart FROM TrainingLog L
                JOIN TrainingPlan P ON L.PlanID = P.PlanID
                JOIN BodyParts B ON L.BodyPartID = B.BodyPartID
                WHERE P.Branch = @Branch AND P.Gender = @Gender AND P.CreatedAt >= @WeekStart
                GROUP BY B.Name ORDER BY COUNT(*) DESC;

                -- Workouts This Week vs Last Week
                SELECT
                    (SELECT COUNT(*) FROM TrainingPlan WHERE Branch = @Branch AND Gender = @Gender AND CreatedAt >= @WeekStart) as workoutsThisWeek,
                    (SELECT COUNT(*) FROM TrainingPlan WHERE Branch = @Branch AND Gender = @Gender AND CreatedAt BETWEEN @PrevWeekStart AND @WeekStart) as workoutsLastWeek;
            `);

        res.json({
            success: true,
            mostTrained: result.recordsets[0][0]?.mostTrainedBodyPart || 'N/A',
            workoutsThisWeek: result.recordsets[1][0].workoutsThisWeek,
            workoutsLastWeek: result.recordsets[1][0].workoutsLastWeek
        });
    } catch (err) {
        console.error('Error fetching activity summary:', err);
        res.status(500).json({ success: false });
    }
});

//---------------------------------------------------------------------------------------------------------------
// Place these new routes in your main server.js file

app.get('/api/staff/duration-summary', async (req, res) => {
    if (!req.session.user) return res.status(401).json({ success: false });
    const { Branch, Gender } = req.session.user;

    try {
        const result = await pool.request()
            .input('Branch', sql.NVarChar(50), Branch)
            .input('Gender', sql.NVarChar(50), Gender)
            .query(`
                -- --- ✅ REFINED LOGIC ---
                -- This line is also changed to define the week's start using the IST calendar.
                DECLARE @WeekStart DATE = DATEADD(wk, DATEDIFF(wk, 7, DATEADD(MINUTE, 330, GETUTCDATE())), 0);
                -- --- END REFINEMENT ---

                SELECT 
                    (SELECT ISNULL(AVG(CAST(DurationInMinutes AS FLOAT)), 0) FROM Attendance WHERE Branch = @Branch AND Gender = @Gender AND DurationInMinutes IS NOT NULL) as avgDuration,
                    
                    (SELECT TOP 1 S.SlotName 
                     FROM Attendance A 
                     JOIN Master M ON A.TR = M.TR
                     JOIN Slots S ON M.SlotID = S.SlotID
                     WHERE A.Branch = @Branch AND A.Gender = @Gender AND A.DurationInMinutes IS NOT NULL 
                     GROUP BY S.SlotName 
                     ORDER BY SUM(A.DurationInMinutes) DESC) as busiestSlot,
                     
                    (SELECT ISNULL(SUM(DurationInMinutes) / 60.0, 0) FROM Attendance WHERE Branch = @Branch AND Gender = @Gender AND CreatedAt >= @WeekStart) as totalHoursThisWeek
            `);
        const data = result.recordset[0];
        res.json({ 
            success: true, 
            avgDuration: data.avgDuration.toFixed(0),
            busiestSlot: data.busiestSlot || 'N/A',
            totalHoursThisWeek: data.totalHoursThisWeek.toFixed(1)
        });
    } catch (err) {
        console.error('Error fetching duration summary:', err);
        res.status(500).json({ success: false });
    }
});

// API for the Peak Gym Hours line chart (Now Monthly)
app.get('/api/staff/peak-hours', async (req, res) => {
    if (!req.session.user) return res.status(401).json({ success: false });
    const { Branch, Gender } = req.session.user;

    try {
        const result = await pool.request()
            .input('Branch', sql.NVarChar(50), Branch)
            .input('Gender', sql.NVarChar(50), Gender)
            .query(`
                SELECT 
                    DATEPART(hour, DATEADD(MINUTE, 330, CreatedAt)) AS hour, 
                    COUNT(*) AS count
                FROM Attendance
                WHERE 
                    Branch = @Branch 
                    AND Gender = @Gender 
                    AND IsPresent = 1
                    -- --- ✅ REFINED LOGIC: Filter for the current month in IST ---
                    AND MONTH(DATEADD(MINUTE, 330, CreatedAt)) = MONTH(DATEADD(MINUTE, 330, GETUTCDATE()))
                    AND YEAR(DATEADD(MINUTE, 330, CreatedAt)) = YEAR(DATEADD(MINUTE, 330, GETUTCDATE()))
                    -- --- END REFINEMENT ---
                GROUP BY DATEPART(hour, DATEADD(MINUTE, 330, CreatedAt))
                ORDER BY hour ASC;
            `);
        res.json({ success: true, data: result.recordset });
    } catch (err) {
        console.error('Error fetching peak hours:', err);
        res.status(500).json({ success: false });
    }
});

// API for the Member Engagement data table
app.get('/api/staff/engagement-report', async (req, res) => {
    if (!req.session.user) return res.status(401).json({ success: false });
    const { Branch, Gender } = req.session.user;

    try {
        const result = await pool.request()
            .input('Branch', sql.NVarChar(50), Branch)
            .input('Gender', sql.NVarChar(50), Gender)
            .query(`
                WITH LastVisit AS (
                    SELECT TR, MAX(CreatedAt) as lastVisitDate
                    FROM Attendance
                    GROUP BY TR
                )
                SELECT
                    M.Name,
                    ISNULL(SUM(A.DurationInMinutes) / 60.0, 0) as TotalHours,
                    ISNULL(AVG(CAST(A.DurationInMinutes AS FLOAT)), 0) as AvgDuration,
                    -- --- ✅ REFINED LOGIC ---
                    -- DATEDIFF now compares against the current IST time, not UTC.
                    DATEDIFF(day, LV.lastVisitDate, DATEADD(MINUTE, 330, GETUTCDATE())) as DaysSinceLastVisit
                    -- --- END REFINEMENT ---
                FROM Master M
                LEFT JOIN Attendance A ON M.TR = A.TR
                LEFT JOIN LastVisit LV ON M.TR = LV.TR
                WHERE M.Status = 'Active' AND M.Branch = @Branch AND M.Gender = @Gender
                GROUP BY M.Name, LV.lastVisitDate;
            `);
        res.json({ success: true, data: result.recordset });
    } catch (err) {
        console.error('Error fetching engagement report:', err);
        res.status(500).json({ success: false });
    }
});

// API for the Goal Alignment data table
app.get('/api/staff/goal-alignment', async (req, res) => {
    if (!req.session.user) return res.status(401).json({ success: false });
    const { Branch, Gender } = req.session.user;
    const { goal, partName } = req.query;

    if (!goal || !partName) return res.status(400).json({ success: false });

    try {
        const result = await pool.request()
            .input('Branch', sql.NVarChar(50), Branch)
            .input('Gender', sql.NVarChar(50), Gender)
            .input('Goal', sql.NVarChar(100), goal)
            .input('PartName', sql.NVarChar(50), partName)
            .query(`
                SELECT M.Name, M.Goal, COUNT(L.LogID) as TimesTrained
                FROM Master M
                LEFT JOIN TrainingPlan P ON M.TR = P.TR
                LEFT JOIN TrainingLog L ON P.PlanID = L.PlanID
                LEFT JOIN BodyParts B ON L.BodyPartID = B.BodyPartID AND B.Name = @PartName
                WHERE M.Status = 'Active' AND M.Branch = @Branch AND M.Gender = @Gender AND M.Goal = @Goal
                GROUP BY M.Name, M.Goal;
            `);
        res.json({ success: true, data: result.recordset });
    } catch (err) {
        console.error('Error fetching goal alignment:', err);
        res.status(500).json({ success: false });
    }
});


//-----------------------------------------------------------------------------------------------------------------------


app.post('/api/attendance-manual', async (req, res) => {
    const { TR, WeekID, IsPresent } = req.body;

    if (!req.session.user || !req.session.user.Branch || !req.session.user.Gender) {
        return res.status(401).json({ error: 'Unauthorized access. Please log in.' });
    }
    const { Branch, Gender } = req.session.user;

    try {
        const studentCheck = await pool.request()
            .input('TR', sql.Int, TR)
            .input('Branch', sql.NVarChar(50), Branch)
            .input('Gender', sql.NVarChar(50), Gender)
            .query(`SELECT 1 FROM Master WHERE TR = @TR AND Status = 'Active' AND Branch = @Branch AND Gender = @Gender`);

        if (studentCheck.recordset.length === 0) {
            return res.status(403).json({ error: '❌ TR not authorized or inactive.' });
        }

        // --- ✅ REFINED LOGIC ---
        // 1. Define the start and end of the current IST day and convert to UTC.
        const startOfTodayIST = moment.tz("Asia/Kolkata").startOf('day').utc().toDate();
        const endOfTodayIST = moment.tz("Asia/Kolkata").endOf('day').utc().toDate();
        // --- END REFINEMENT ---

        const attendanceCheck = await pool.request()
            .input('TR', sql.Int, TR)
            .input('StartUTC', sql.DateTime, startOfTodayIST) // Pass range to query
            .input('EndUTC', sql.DateTime, endOfTodayIST)
            .query(`
                SELECT 1 FROM Attendance
                WHERE TR = @TR AND CreatedAt BETWEEN @StartUTC AND @EndUTC
            `);
            
        if (attendanceCheck.recordset.length > 0) {
            return res.status(400).json({ error: '❌ Attendance already marked for today.' });
        }

        await pool.request()
            .input('TR', sql.Int, TR)
            .input('WeekID', sql.Int, WeekID)
            .input('IsPresent', sql.Bit, IsPresent)
            // 2. Explicitly use the current UTC time for the timestamp.
            .query(`
                INSERT INTO Attendance (TR, WeekID, IsPresent, CreatedAt, OutTime, DurationInMinutes)
                VALUES (@TR, @WeekID, @IsPresent, GETUTCDATE(), NULL, NULL)
            `);
            
        res.status(200).json({ message: '✅ Attendance marked successfully' });
    } catch (error) {
        console.error('❌ Attendance insert error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ✅ Checkout API with XP integration (existing logic preserved)
app.post('/api/checkout', async (req, res) => {
    const { TR } = req.body;

    if (!TR) {
        return res.status(400).json({ success: false, message: 'TR number is required.' });
    }

    // Transaction for safety
    const transaction = new sql.Transaction(pool);

    try {
        await transaction.begin();
        const request = new sql.Request(transaction);

        request.input('TR', sql.Int, TR);

        // --- ORIGINAL TIME LOGIC ---
        const startOfTodayIST = moment.tz("Asia/Kolkata").startOf('day');
        const endOfTodayIST = moment.tz("Asia/Kolkata").endOf('day');
        const startUTC = startOfTodayIST.utc().toDate();
        const endUTC = endOfTodayIST.utc().toDate();

        request.input('StartUTC', sql.DateTime, startUTC);
        request.input('EndUTC', sql.DateTime, endUTC);

        // Find open session
        const openSession = await request.query(`
            SELECT AttendanceID, CreatedAt FROM Attendance
            WHERE TR = @TR 
              AND OutTime IS NULL 
              AND CreatedAt BETWEEN @StartUTC AND @EndUTC;
        `);

        if (openSession.recordset.length === 0) {
            await transaction.rollback();
            return res.status(404).json({ success: false, message: 'This student is not currently checked in. Please mark their attendance first.' });
        }

        // Original duration logic
        const { AttendanceID, CreatedAt } = openSession.recordset[0];
        const inTime = moment.utc(CreatedAt);
        const outTime = moment.utc();  
        const duration = outTime.diff(inTime, 'minutes');

        // Update attendance record
        await request
            .input('OutTime', sql.DateTime, outTime.toDate())
            .input('Duration', sql.Int, duration)
            .input('AttendanceID', sql.Int, AttendanceID)
            .query(`
                UPDATE Attendance 
                SET OutTime = @OutTime, DurationInMinutes = @Duration
                WHERE AttendanceID = @AttendanceID;
            `);
        // Update total minutes in Master table
        await request.input('TR_Update', sql.Int, TR)
            .input('Duration_Update', sql.Int, duration)
            .query('UPDATE Master SET TotalMinutesLogged = TotalMinutesLogged + @Duration_Update WHERE TR = @TR_Update');


        // --- ✅ NEW XP Integration ---
        const levelUpInfo = await awardXP(TR, duration, transaction);

        // Commit transaction
        await transaction.commit();

        // Format times
        const inTimeFormatted = inTime.tz("Asia/Kolkata").format("h:mm A");
        const outTimeFormatted = outTime.tz("Asia/Kolkata").format("h:mm A");

        // Send response
        res.json({ 
            success: true, 
            duration: duration,
            inTime: inTimeFormatted,
            outTime: outTimeFormatted,
            levelUpInfo // ← Extra info about XP/level up
        });

    } catch (err) {
        if (transaction._aborted === false) {
            await transaction.rollback();
        }
        console.error('Check-out error:', err);
        res.status(500).json({ success: false, message: 'Server error during check-out.' });
    }
});


// API to get all students currently checked in (active sessions)
app.get('/api/active-sessions', async (req, res) => {
    // 1. Enforce login and get trainer's branch/gender from session
    if (!req.session.user || !req.session.user.Branch || !req.session.user.Gender) {
        return res.status(401).json({ success: false, error: 'Unauthorized. Please log in.' });
    }
    const { Branch, Gender } = req.session.user;

    try {
        // 2. Define the current IST day and convert it to a UTC range for the query
        const startOfTodayIST = moment.tz("Asia/Kolkata").startOf('day').utc().toDate();
        const endOfTodayIST = moment.tz("Asia/Kolkata").endOf('day').utc().toDate();

        const result = await pool.request()
            .input('Branch', sql.NVarChar(50), Branch)
            .input('Gender', sql.NVarChar(10), Gender)
            .input('StartUTC', sql.DateTime, startOfTodayIST)
            .input('EndUTC', sql.DateTime, endOfTodayIST)
            .query(`
                SELECT 
                    A.TR,
                    M.Name,
                    A.CreatedAt -- The check-in timestamp
                FROM Attendance A
                JOIN Master M ON A.TR = M.TR
                WHERE 
                    M.Branch = @Branch 
                    AND M.Gender = @Gender
                    AND A.Onleave = 0 -- Not on leave
                    AND A.OutTime IS NULL -- The key condition: they haven't checked out
                    AND A.CreatedAt BETWEEN @StartUTC AND @EndUTC -- They checked in today (IST)
                ORDER BY A.CreatedAt ASC; -- Show earliest check-ins first
            `);

        res.json({ success: true, data: result.recordset });

    } catch (err) {
        console.error("Error fetching active sessions:", err.message);
        res.status(500).json({ success: false, error: "Failed to fetch active sessions" });
    }
});

//-------------------------------------------------------------------------------------------------------

app.get('/api/attendance/:weekId', async (req, res) => {
    try {
        const { weekId } = req.params;

        const request = pool.request();
        request.input('WeekID', sql.Int, weekId);

        const result = await request.query(`
            SELECT A.AttendanceID, A.TR, M.Name, A.CreatedAt, A.IsPresent
            FROM Attendance A
            JOIN Master M ON A.TR = M.TR
            WHERE A.WeekID = @WeekID
            ORDER BY A.CreatedAt -- Sorting by CreatedAt
        `);

        res.json(result.recordset);
    } catch (err) {
        console.error('Error fetching attendance:', err.message);
        res.status(500).json({ error: err.message });
    }
});




// This is likely the route for your Active Students table
app.get('/api/students', async (req, res) => {
    // Enforce login and session branch/gender
    if (!req.session.user || !req.session.user.Branch || !req.session.user.Gender) {
        return res.status(401).json({ success: false, error: 'Unauthorized. Please log in.' });
    }

    const { Branch, Gender } = req.session.user;

    try {
        const result = await pool.request()
            .input('Branch', sql.NVarChar(50), Branch)
            .input('Gender', sql.NVarChar(10), Gender)
            .query(`
                SELECT
                    M.[TR],
                    M.[Name],
                    M.[Darajah],
                    M.[Goal],
                    M.[SlotID],   -- Added: The frontend needs this for logic
                    S.[SlotName],
                    S.[IsActive]
                FROM
                    [Master] AS M
                LEFT JOIN
                    [Slots] AS S ON M.[SlotID] = S.[SlotID]
                WHERE
                    M.[Status] = 'Active' 
                    AND M.[Branch] = @Branch 
                    AND M.[Gender] = @Gender;
            `);
        
        // CORRECTED RESPONSE: Wrap the data in an object
        res.json({ success: true, data: result.recordset });

    } catch (err) {
        console.error('❌ Error fetching students:', err.message);
        // Ensure the error response is also in JSON format
        res.status(500).json({ success: false, error: 'Failed to fetch students' });
    }
});


app.get('/api/students/inactive', async (req, res) => {
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



//-------------------------------------------------------------------------------------------


// REPLACE your existing /api/attendance-record/:tr/:date route

app.get('/api/attendance-record/:tr/:date', async (req, res) => {
    const { tr, date } = req.params;
    const { Branch, Gender } = req.session.user;

    if (!Branch || !Gender) {
        return res.status(401).json({ success: false, error: 'Unauthorized: Session missing branch or gender' });
    }

    try {
        const request = pool.request();
        request.input('TR', sql.Int, tr);
        request.input('Branch', sql.NVarChar(50), Branch);
        request.input('Gender', sql.NVarChar(10), Gender);
        request.input('Date', sql.Date, date);

        // First, authorize that the staff member can view this student
        const studentCheck = await request.query(`SELECT 1 FROM Master WHERE TR = @TR AND Branch = @Branch AND Gender = @Gender`);
        if (studentCheck.recordset.length === 0) {
            return res.status(403).json({ success: false, error: 'Forbidden: TR not found in your branch/gender' });
        }

        // Fetch the complete Attendance record, including OnLeave
        const result = await request.query(`
            SELECT 
                AttendanceID, TR, WeekID, IsPresent, CreatedAt, 
                OnLeave -- <-- THE FIX IS HERE
            FROM Attendance
            WHERE TR = @TR AND CAST(CreatedAt AS DATE) = @Date
        `);

        if (result.recordset.length > 0) {
            return res.json({ success: true, record: result.recordset[0] });
        } else {
            // No record found → return a default "Absent" object
            return res.json({
                success: true,
                record: { IsPresent: false, OnLeave: false }
            });
        }
    } catch (err) {
        console.error('Error fetching attendance record:', err);
        res.status(500).json({ success: false, error: 'Failed to fetch attendance' });
    }
});


// REPLACE your existing /api/attendance-record route

app.put('/api/attendance-record', async (req, res, next) => {
    // We now accept IsPresent and OnLeave flags from the frontend
    const { TR, CreatedAt, IsPresent, OnLeave } = req.body;
    const { Branch, Gender } = req.session.user;

    if (!TR || !CreatedAt) {
        return res.status(400).json({ success: false, error: 'TR and Date are required.' });
    }

    try {
        const weekResult = await pool.request()
            .input('Date', sql.Date, CreatedAt)
            .query('SELECT WeekID FROM AttendanceWeek WHERE @Date BETWEEN WeekStartDate AND WeekEndDate');

        if (weekResult.recordset.length === 0) {
            // If week doesn't exist, we should create it.
            // This reuses your helper function for robustness.
            const newWeekId = await getOrCreateWeekIdByDate(CreatedAt, pool);
            if (!newWeekId) throw new Error('Could not find or create a valid week for the selected date.');
            weekId = newWeekId;
        } else {
            weekId = weekResult.recordset[0].WeekID;
        }

        const request = pool.request();
        request.input('TR', sql.Int, TR);
        request.input('WeekID', sql.Int, weekId);
        request.input('Date', sql.Date, CreatedAt);
        request.input('Branch', sql.NVarChar(50), Branch);
        request.input('Gender', sql.NVarChar(10), Gender);
        // --- THE FIX IS HERE ---
        // We now use the values sent from the frontend script
        request.input('IsPresent', sql.Bit, IsPresent);
        request.input('OnLeave', sql.Bit, OnLeave);
        
        await request.query(`
            MERGE Attendance AS target
            USING (SELECT @TR AS TR, @Date AS CreatedAt) AS source
            ON (target.TR = source.TR AND CAST(target.CreatedAt AS DATE) = source.CreatedAt)
            WHEN MATCHED THEN
                UPDATE SET 
                    IsPresent = @IsPresent, 
                    OnLeave = @OnLeave
            WHEN NOT MATCHED THEN
                INSERT (TR, WeekID, IsPresent, OnLeave, CreatedAt, Branch, Gender)
                VALUES (@TR, @WeekID, @IsPresent, @OnLeave, @Date, @Branch, @Gender);
        `);

        res.json({ success: true, message: 'Student attendance has been updated.' });

    } catch (err) {
        next(err); // Pass error to centralized handler
    }
});

// This new route handles marking all students as "On Leave" for a specific date
app.post('/api/attendance/bulk-leave', async (req, res) => {
    const { date } = req.body;
    const { Branch, Gender } = req.session.user;

    if (!date) {
        return res.status(400).json({ success: false, error: 'A date is required.' });
    }

    const transaction = new sql.Transaction(pool);
    try {
        await transaction.begin();

        // Step 1: Find the correct WeekID for the given date.
        const weekResult = await new sql.Request(transaction)
            .input('Date', sql.Date, date)
            .query('SELECT WeekID FROM AttendanceWeek WHERE @Date BETWEEN WeekStartDate AND WeekEndDate');

        if (weekResult.recordset.length === 0) {
            throw new Error('No valid week found for the selected date.');
        }
        const weekId = weekResult.recordset[0].WeekID;

        // Step 2: Use a single, powerful MERGE statement to update or insert records
        // for ALL active students in the specified branch/gender.
        const mergeRequest = new sql.Request(transaction);
        mergeRequest.input('Date', sql.Date, date);
        mergeRequest.input('WeekID', sql.Int, weekId);
        mergeRequest.input('Branch', sql.NVarChar(50), Branch);
        mergeRequest.input('Gender', sql.NVarChar(10), Gender);
        
        await mergeRequest.query(`
            -- Use MERGE to handle both existing and non-existing attendance records
            MERGE Attendance AS target
            USING (
                -- Select all active students who had joined by the event date
                SELECT TR FROM Master 
                WHERE Status = 'Active' AND Branch = @Branch AND Gender = @Gender AND JoinedAt <= @Date
            ) AS source
            ON (target.TR = source.TR AND CAST(target.CreatedAt AS DATE) = @Date)
            
            -- If a student already has a record for this day (e.g., marked present accidentally):
            WHEN MATCHED THEN
                UPDATE SET IsPresent = 0, OnLeave = 1
            
            -- If a student does NOT have a record for this day:
            WHEN NOT MATCHED BY TARGET THEN
                INSERT (TR, WeekID, IsPresent, CreatedAt, Branch, Gender, OnLeave)
                VALUES (source.TR, @WeekID, 0, @Date, @Branch, @Gender, 1);
        `);

        await transaction.commit();
        res.json({ success: true, message: 'All active students have been marked as "On Leave".' });

    } catch (err) {
        await transaction.rollback();
        console.error('Error in bulk "On Leave" action:', err);
        res.status(500).json({ success: false, error: err.message || 'Failed to update attendance records.' });
    }
});

//-------------------------------------------------------------------------------------------
//--------------------------------- FITNESS TEST --------------------------------------------
//-------------------------------------------------------------------------------------------

// CORRECTED FITNESS TEST ROUTE
app.get('/api/testmaster/me', async (req, res) => {
    if (!req.session.user || !req.session.user.TR) {
        return res.status(401).json({ error: 'Unauthorized. Please log in.' });
    }

    const TR = req.session.user.TR; // ✅ from session

    try {
        const result = await pool.request() 
            .input('TR', sql.Int, TR)
            .query(`
                SELECT TR, ITS, Darajah, Age, Name, Hizb, Class, House, Check18, Email, DOB
                FROM TestMaster WHERE TR = @TR
            `);

        res.json(result.recordset[0] || {});
    } catch (err) {
        console.error('Error fetching TestMaster:', err);
        res.status(500).json({ error: 'Failed to fetch student data' });
    }
});

// --------------- for trainers ----------------------------

// NEW route: fetch TestMaster by TR (for trainer dashboard)
app.get('/api/testmaster/:tr', async (req, res) => {
    if (!req.session.user || !req.session.user.Role || req.session.user.Role !== 'Trainer') {
        return res.status(401).json({ error: 'Unauthorized. Please log in as a trainer.' });
    }

    const { tr } = req.params;

  try {
    const result = await pool.request()
      .input('TR', sql.Int, tr)
      .query(`
        SELECT TR, ITS, Darajah, Age, Name, Hizb, Class, House, Check18, Email, DOB
        FROM TestMaster WHERE TR = @TR
      `);

    if (result.recordset.length === 0) {
      return res.status(404).json({ error: 'Student not found' });
    }

    res.json(result.recordset[0]);
  } catch (err) {
    console.error('❌ Error fetching TestMaster by TR:', err);
    res.status(500).json({ error: 'Failed to fetch student data' });
  }
});



app.post('/api/testrecords', async (req, res) => {
    const {
        TR, DOB, Age, Weight, Height, Waist, Hips, Neck,
        BMI, BMIStatus, BodyFat, BMR, CalorieIntake, VO2Max, Total, Grade
    } = req.body;

    const transaction = new sql.Transaction(pool);

    try {
        await transaction.begin();
        const request = new sql.Request(transaction);  // Use transaction-scoped request

        request.input('TR', sql.Int, TR);
        request.input('DOB', sql.Date, DOB);
        request.input('Age', sql.Int, Age);
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

        await request.query(`
            INSERT INTO TestRecords 
            (TR, DOB, Age, Weight, Height, Waist, Hips, Neck, BMI, BMIStatus, BodyFat, BMR, CalorieIntake, VO2Max, Total, Grade) 
            VALUES (@TR, @DOB, @Age, @Weight, @Height, @Waist, @Hips, @Neck, @BMI, @BMIStatus, @BodyFat, @BMR, @CalorieIntake, @VO2Max, @Total, @Grade)
        `);

        // --- ✅ NEW: Award XP for student test ---
        const levelUpInfo = await awardXP(TR, 100, transaction);

        await transaction.commit();
        res.status(200).json({ 
            message: "Test record saved successfully",
            levelUpInfo
        });

    } catch (err) {
        if (transaction._aborted === false) {
            await transaction.rollback();
        }
        console.error("Error saving test record:", err);
        res.status(500).json({ error: "Server error saving test record" });
    }
});


app.get('/api/testrecords/me', async (req, res) => {
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



app.post('/api/trainer-test-records', async (req, res) => {
    const records = req.body;

    if (req.session.user?.Role !== 'Trainer' && req.session.user?.Role !== 'Admin') {
        return res.status(403).json({ error: 'Unauthorized' });
    }

    if (!Array.isArray(records) || records.length === 0) {
        return res.status(400).json({ error: 'Request body must be a non-empty array of test records.' });
    }

    const transaction = new sql.Transaction(pool);
    try {
        await transaction.begin();

        const insertQuery = `
            INSERT INTO TestRecords 
            (TR, DOB, Age, Weight, Height, Waist, Hips, Neck, BMI, BMIStatus, BodyFat, BMR, CalorieIntake, VO2Max, Total, Grade, SubmittedBy) 
            VALUES (@TR, @DOB, @Age, @Weight, @Height, @Waist, @Hips, @Neck, @BMI, @BMIStatus, @BodyFat, @BMR, @CalorieIntake, @VO2Max, @Total, @Grade, @SubmittedBy)
        `;

        for (const record of records) {
            const request = new sql.Request(transaction);

            request.input('TR', sql.Int, record.TR);
            request.input('DOB', sql.Date, record.DOB);
            request.input('Age', sql.Int, record.Age);
            request.input('Weight', sql.Float, record.Weight);
            request.input('Height', sql.Float, record.Height);
            request.input('Waist', sql.Float, record.Waist);
            request.input('Hips', sql.Float, record.Hips);
            request.input('Neck', sql.Float, record.Neck);
            request.input('BMI', sql.Float, record.BMI);
            request.input('BMIStatus', sql.NVarChar(50), record.BMIStatus);
            request.input('BodyFat', sql.Float, record.BodyFat);
            request.input('BMR', sql.Float, record.BMR);
            request.input('CalorieIntake', sql.Float, record.CalorieIntake);
            request.input('VO2Max', sql.Float, record.VO2Max === "N/A" ? null : record.VO2Max);
            request.input('Total', sql.Float, record.Total);
            request.input('Grade', sql.NVarChar(2), record.Grade);
            request.input('SubmittedBy', sql.NVarChar(50), 'Trainer');

            await request.query(insertQuery);

            // --- ✅ NEW: Award XP for trainer test ---
            await awardXP(record.TR, 150, transaction);
        }

        await transaction.commit();
        res.status(200).json({ message: `${records.length} test records saved successfully.` });

    } catch (err) {
        if (transaction._aborted === false) {
            await transaction.rollback();
        }
        console.error("Error saving trainer test records:", err);
        res.status(500).json({ error: "Server error during bulk insert." });
    }
});



// A new, more powerful search endpoint
app.get('/api/student-lookup/:query', async (req, res) => {
    if (!req.session.user || !req.session.user.Branch || !req.session.user.Gender) {    
        return res.status(401).json({ success: false, message: 'Unauthorized. Please log in.' });
    }

    const { query } = req.params;
    const { branch, gender } = req; // From middleware

    // Check if the query is a number (TR) or a string (Name)
    const isNumeric = /^\d+$/.test(query);

    let sqlQuery = `
        SELECT TR FROM Master 
        WHERE Status = 'Active' AND Branch = @Branch AND Gender = @Gender AND 
    `;

    const request = pool.request();
    request.input('Branch', sql.NVarChar(50), branch);
    request.input('Gender', sql.NVarChar(50), gender);

    if (isNumeric) {
        sqlQuery += `TR = @Query`;
        request.input('Query', sql.Int, query);
    } else {
        sqlQuery += `Name LIKE @Query`;
        request.input('Query', sql.NVarChar(100), `%${query}%`); // Use LIKE for partial name matches
    }

    try {
        const result = await request.query(sqlQuery);
        if (result.recordset.length === 0) {
            return res.status(404).json({ success: false, message: 'No active student found with that query.' });
        }
        if (result.recordset.length > 1) {
            return res.status(400).json({ success: false, message: 'Multiple students found. Please be more specific or use TR number.' });
        }
        // If one student is found, return their TR
        res.json({ success: true, tr: result.recordset[0].TR });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Database search error.' });
    }
});

// API to get all students formatted for a dropdown selector
app.get('/api/students-list', async (req, res) => {
    try {
        const result = await pool.request().query(`
            SELECT 
                TR AS value, 
                Name + ' (' + CAST(TR AS NVARCHAR(10)) + ')' AS label 
            FROM TestMaster
            ORDER BY Name
        `);
        res.json(result.recordset);
    } catch (err) {
        console.error('Error fetching student list:', err);
        res.status(500).json({ error: 'Failed to fetch student list' });
    }
});

// =================================================================
// --- 🍃 LEAVE MANAGEMENT API ---
// =================================================================

// --- STUDENT-FACING ROUTES ---

// ✅ GET: Fetch a student's leave history, current month status, and remaining leaves
app.get('/api/student/leaves', async (req, res) => {
    if (!req.session.user || !req.session.user.TR) {
        return res.status(401).json({ success: false, message: 'Unauthorized. Please log in.' });
    }
    const { TR } = req.session.user;

    try {
        const result = await pool.request()
            .input('TR', sql.Int, TR)
            .query('SELECT * FROM LeaveRequests WHERE TR = @TR ORDER BY RequestedAt DESC');
        
        const now = moment.tz("Asia/Kolkata");
        const startOfMonth = now.clone().startOf('month');
        const endOfMonth = now.clone().endOf('month');
        
        let approvedLeaveDaysThisMonth = 0;
        const currentMonthRequests = [];
        const historyRequests = [];

        result.recordset.forEach(request => {
            const leaveStart = moment(request.LeaveStartDate);
            // Categorize requests into current month vs history
            if (leaveStart.isBetween(startOfMonth, endOfMonth, null, '[]')) {
                currentMonthRequests.push(request);
            } else {
                historyRequests.push(request);
            }

            // Calculate approved days for the monthly limit
            if (request.Status === 'Approved') {
                let current = leaveStart.clone();
                while (current.isSameOrBefore(request.LeaveEndDate)) {
                    if (current.isBetween(startOfMonth, endOfMonth, null, '[]')) {
                        approvedLeaveDaysThisMonth++;
                    }
                    current.add(1, 'day');
                }
            }
        });

        res.json({
            success: true,
            leavesTaken: approvedLeaveDaysThisMonth,
            leavesRemaining: 4 - approvedLeaveDaysThisMonth,
            currentMonthRequests,
            historyRequests
        });

    } catch (err) {
        console.error('Error fetching student leaves:', err);
        res.status(500).json({ success: false, message: 'Failed to fetch leave data.' });
    }
});


// ✅ POST: Submit a new leave request
app.post('/api/student/leaves', async (req, res) => {
    if (!req.session.user || !req.session.user.TR) {
        return res.status(401).json({ success: false, message: 'Unauthorized. Please log in.' });
    }
    
    const { TR } = req.session.user;
    const { leaveStartDate, leaveEndDate, reason } = req.body;

    // --- 🕒 Time-based Validation Logic ---
    const now = moment.tz("Asia/Kolkata");
    const hour = now.hour();

    if (hour < 15 || hour >= 20) { // 3 PM to 8 PM (20:00)
        return res.status(403).json({ success: false, message: 'You can only apply for leave between 3 PM and 8 PM.' });
    }

    const requestedStartDate = moment.tz(leaveStartDate, "Asia/Kolkata").startOf('day');
    const tomorrow = moment.tz("Asia/Kolkata").add(1, 'day').startOf('day');
    const maxDate = moment.tz("Asia/Kolkata").add(15, 'days').endOf('day');
    
    if (requestedStartDate.isBefore(tomorrow)) {
        return res.status(400).json({ success: false, message: "Leave can only be requested for tomorrow onwards." });
    }
    if (requestedStartDate.isAfter(maxDate)) {
        return res.status(400).json({ success: false, message: 'You can only apply for leave up to 15 days in advance.' });
    }
    // --- End Validation ---

    try {
        // Additional check for monthly limit before submitting
        const newLeaveDays = moment(leaveEndDate).diff(moment(leaveStartDate), 'days') + 1;

        // Fetch existing approved leaves for the month
        const startOfMonth = requestedStartDate.clone().startOf('month').format('YYYY-MM-DD');
        const endOfMonth = requestedStartDate.clone().endOf('month').format('YYYY-MM-DD');

        const leavesResult = await pool.request()
            .input('TR', sql.Int, TR)
            .input('StartOfMonth', sql.Date, startOfMonth)
            .input('EndOfMonth', sql.Date, endOfMonth)
            .query(`
                SELECT LeaveStartDate, LeaveEndDate FROM LeaveRequests 
                WHERE TR = @TR AND Status = 'Approved' 
                AND (LeaveStartDate BETWEEN @StartOfMonth AND @EndOfMonth OR LeaveEndDate BETWEEN @StartOfMonth AND @EndOfMonth)
            `);
        
        let approvedDaysCount = 0;
        // This logic correctly handles multi-day leaves spanning across months
        leavesResult.recordset.forEach(leave => {
            let current = moment.max(moment(leave.LeaveStartDate), moment(startOfMonth));
            let end = moment.min(moment(leave.LeaveEndDate), moment(endOfMonth));
            approvedDaysCount += end.diff(current, 'days') + 1;
        });

        if (approvedDaysCount + newLeaveDays > 4) {
            return res.status(403).json({ success: false, message: `You only have ${4-approvedDaysCount} leaves remaining this month.` });
        }

        // Insert new leave request
        await pool.request()
            .input('TR', sql.Int, TR)
            .input('LeaveStartDate', sql.Date, leaveStartDate)
            .input('LeaveEndDate', sql.Date, leaveEndDate)
            .input('Reason', sql.NVarChar(500), reason)
            .query(`
                INSERT INTO LeaveRequests (TR, LeaveStartDate, LeaveEndDate, Reason)
                VALUES (@TR, @LeaveStartDate, @LeaveEndDate, @Reason)
            `);
        
        res.json({ success: true, message: 'Leave request submitted successfully.' });

    } catch (err) {
        console.error('Error submitting leave request:', err);
        res.status(500).json({ success: false, message: 'Server error during leave submission.' });
    }
});


// ✅ DELETE: Allow a student to cancel a PENDING leave request
app.delete('/api/student/leaves/:id', async (req, res) => {
    if (!req.session.user || !req.session.user.TR) {
        return res.status(401).json({ success: false, message: 'Unauthorized. Please log in.' });
    }
    const { TR } = req.session.user;
    const { id } = req.params; // This is LeaveID

    try {
        const result = await pool.request()
            .input('LeaveID', sql.Int, id)
            .input('TR', sql.Int, TR)
            .query(`
                DELETE FROM LeaveRequests 
                WHERE LeaveID = @LeaveID AND TR = @TR AND Status = 'Pending'
            `);
        
        if (result.rowsAffected[0] > 0) {
            res.json({ success: true, message: 'Leave request cancelled.' });
        } else {
            res.status(404).json({ success: false, message: 'Request not found or cannot be cancelled.' });
        }
    } catch (err) {
        console.error('Error cancelling leave:', err);
        res.status(500).json({ success: false, message: 'Failed to cancel leave request.' });
    }
});


// --- STAFF-FACING ROUTES ---



// ✅ GET: Fetch all PENDING and ON HOLD leave requests for the staff's branch/gender
app.get('/api/staff/leaves/pending', async (req, res) => {
    if (!req.session.user || !req.session.user.Branch) {
        return res.status(401).json({ success: false, message: 'Unauthorized. Please log in as staff.' });
    }
    const { Branch, Gender } = req.session.user;

    try {
        const result = await pool.request()
            .input('Branch', sql.NVarChar(50), Branch)
            .input('Gender', sql.NVarChar(50), Gender)
            .query(`
                SELECT 
                    L.LeaveID, L.TR, L.LeaveStartDate, L.LeaveEndDate, L.Reason, L.RequestedAt,
                    L.Status, -- <<-- 1. ADDED THIS LINE
                    M.Name AS StudentName
                FROM LeaveRequests L
                JOIN Master M ON L.TR = M.TR
                WHERE L.Status IN ('Pending', 'On Hold') AND M.Branch = @Branch AND M.Gender = @Gender -- <<-- 2. MODIFIED THIS LINE
                ORDER BY L.RequestedAt ASC
            `);
        
        res.json({ success: true, data: result.recordset });

    } catch (err) {
        console.error('Error fetching pending leaves:', err);
        res.status(500).json({ success: false, message: 'Failed to fetch pending leave requests.' });
    }
});


// ✅ PUT: Approve, Reject, or put On Hold a leave request
app.put('/api/staff/leaves/:id/status', async (req, res) => {
    if (!req.session.user || !req.session.user.Username) {
        return res.status(401).json({ success: false, message: 'Unauthorized. Please log in as staff.' });
    }

    const { id } = req.params; // LeaveID
    const { status, remarks } = req.body;
    const { Username, Branch, Gender } = req.session.user;

    const validStatuses = ['Approved', 'Rejected', 'On Hold'];
    if (!validStatuses.includes(status)) {
        return res.status(400).json({ success: false, message: 'Invalid status provided.' });
    }

    const transaction = new sql.Transaction(pool);
    try {
        await transaction.begin();

        // Step 1: Update the leave request status
        const updateRequest = new sql.Request(transaction);
        updateRequest.input('LeaveID', sql.Int, id);
        updateRequest.input('Status', sql.NVarChar(20), status);
        updateRequest.input('Remarks', sql.NVarChar(500), remarks || null);
        updateRequest.input('ReviewedBy', sql.NVarChar(50), Username);

        const updateResult = await updateRequest.query(`
            UPDATE LeaveRequests 
            SET Status = @Status, Remarks = @Remarks, ReviewedBy = @ReviewedBy, ReviewedAt = GETUTCDATE()
            OUTPUT INSERTED.TR, INSERTED.LeaveStartDate, INSERTED.LeaveEndDate
            WHERE LeaveID = @LeaveID;
        `);

        if (updateResult.recordset.length === 0) {
            throw new Error('Leave request not found or already processed.');
        }

        // Step 2: If approved, update the attendance table
        if (status === 'Approved') {
            const { TR, LeaveStartDate, LeaveEndDate } = updateResult.recordset[0];
            
            let currentDate = moment(LeaveStartDate);
            const lastDate = moment(LeaveEndDate);

            while (currentDate.isSameOrBefore(lastDate)) {
                const dateStr = currentDate.format('YYYY-MM-DD');
                // Use our helper to ensure the week exists
                const weekId = await getOrCreateWeekIdByDate(dateStr, transaction);
                
                // Use MERGE to insert/update attendance, just like in your other APIs
                const mergeRequest = new sql.Request(transaction);
                mergeRequest.input('TR', sql.Int, TR);
                mergeRequest.input('WeekID', sql.Int, weekId);
                mergeRequest.input('Date', sql.Date, dateStr);
                mergeRequest.input('Branch', sql.NVarChar(50), Branch);
                mergeRequest.input('Gender', sql.NVarChar(10), Gender);

                await mergeRequest.query(`
                    MERGE Attendance AS target
                    USING (SELECT @TR AS TR, @Date AS CreatedAt) AS source
                    ON (target.TR = source.TR AND CAST(target.CreatedAt AS DATE) = source.CreatedAt)
                    WHEN MATCHED THEN
                        UPDATE SET IsPresent = 0, OnLeave = 1, Branch = @Branch, Gender = @Gender, WeekID = @WeekID
                    WHEN NOT MATCHED THEN
                        INSERT (TR, WeekID, IsPresent, CreatedAt, Branch, Gender, OnLeave)
                        VALUES (@TR, @WeekID, 0, @Date, @Branch, @Gender, 1);
                `);
                
                currentDate.add(1, 'day');
            }
        }
        
        await transaction.commit();
        res.json({ success: true, message: `Leave request has been ${status.toLowerCase()}.` });

    } catch (err) {
        await transaction.rollback();
        console.error('Error updating leave status:', err);
        res.status(500).json({ success: false, message: err.message || 'Failed to update leave status.' });
    }
});


// ✅ GET: Fetch all PROCESSED leaves (Approved, Rejected, On Hold) for the staff's section
app.get('/api/staff/leaves/history', async (req, res) => {
    if (!req.session.user || !req.session.user.Branch) {
        return res.status(401).json({ success: false, message: 'Unauthorized. Please log in as staff.' });
    }
    const { Branch, Gender } = req.session.user;

    try {
        const result = await pool.request()
            .input('Branch', sql.NVarChar(50), Branch)
            .input('Gender', sql.NVarChar(50), Gender)
            .query(`
                SELECT 
                    L.LeaveID, L.TR, L.LeaveStartDate, L.LeaveEndDate, L.Reason, 
                    L.Status, L.ReviewedBy, L.ReviewedAt, L.Remarks,
                    M.Name AS StudentName
                FROM LeaveRequests L
                JOIN Master M ON L.TR = M.TR
                WHERE L.Status <> 'Pending' AND M.Branch = @Branch AND M.Gender = @Gender
                ORDER BY L.ReviewedAt DESC
            `);
        
        res.json({ success: true, data: result.recordset });

    } catch (err) {
        console.error('Error fetching leave history:', err);
        res.status(500).json({ success: false, message: 'Failed to fetch leave history.' });
    }
});
// =================================================================

// ======================================================================================= //
// --- Student Profile APIS ---
// ======================================================================================= //
// Add this new route to your server.js file

app.get('/api/staff/student-search', async (req, res) => {
    if (!req.session.user || !req.session.user.Branch) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const { q } = req.query; // The search term from the frontend
    const { Branch, Gender } = req.session.user;

    if (!q || q.length < 2) {
        return res.json({ success: true, data: [] }); // Return empty if query is too short
    }

    try {
        const result = await pool.request()
            .input('SearchTerm', sql.NVarChar, `%${q}%`) // Use wildcards for partial matching
            .input('Branch', sql.NVarChar, Branch)
            .input('Gender', sql.NVarChar, Gender)
            .query(`
                SELECT TOP 10 TR, Name 
                FROM Master
                WHERE (CAST(TR AS NVARCHAR(20)) LIKE @SearchTerm OR Name LIKE @SearchTerm)
                  AND Branch = @Branch
                  AND Gender = @Gender
                ORDER BY Name ASC;
            `);
        
        res.json({ success: true, data: result.recordset });

    } catch (err) {
        console.error("Error during student search:", err);
        res.status(500).json({ success: false, message: 'Failed to search for students.' });
    }
});

// Add this new route to your server.js file

app.get('/api/staff/student-profile/:tr', async (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    const { tr } = req.params;
    const { Branch, Gender } = req.session.user;

    try {
        // First, verify this staff member is allowed to view this student
        const authRequest = pool.request();
        const authResult = await authRequest
            .input('TR', sql.Int, tr)
            .input('Branch', sql.NVarChar, Branch)
            .input('Gender', sql.NVarChar, Gender)
            .query(`SELECT 1 FROM Master WHERE TR = @TR AND Branch = @Branch AND Gender = @Gender`);
        
        if (authResult.recordset.length === 0) {
            return res.status(403).json({ success: false, message: 'You are not authorized to view this student.' });
        }

        // Run all queries in parallel for efficiency
        const [
            progress,
            basicInfoRes,
            achievementsRes,
            workoutCalendarRes,
            workoutLogsRes,
            fitnessTestsRes,
            attendanceHistoryRes,
            leaveHistoryRes
        ] = await Promise.all([
            // 1. Get Progress Data (re-using our helper functions)
            Promise.all([
                getConsistencyProgress(tr),
                getPerfectMonthProgress(tr),
                getSocialButterflyProgress(tr),
                getMilestoneLiftProgress(tr),
                getIronDedicationProgress(tr)
            ]).then(([consistency, perfectMonth, socialButterfly, milestoneLift, ironDedication]) => ({ consistency, perfectMonth, socialButterfly, milestoneLift, ironDedication })),
            
            // 2. Get Basic Info
            pool.request().input('TR', sql.Int, tr).query(`SELECT M.TR, M.Name, M.Status, M.Goal, M.Darajah, M.JoinedAt, M.FitnessLevel, M.CurrentXP, S.SlotName FROM Master M LEFT JOIN Slots S ON M.SlotID = S.SlotID WHERE M.TR = @TR;`),
            
            // 3. Get Earned Achievements
            pool.request().input('TR', sql.Int, tr).query(`SELECT A.AchievementName, A.Description, A.BadgeImageURL, SA.DateEarned FROM StudentAchievements SA JOIN Achievements A ON SA.AchievementID = A.AchievementID WHERE SA.TR = @TR ORDER BY SA.DateEarned DESC;`),
            
            // 4. Get Workout Calendar Data (for Heatmap)
            pool.request().input('TR', sql.Int, tr).query(`SELECT DISTINCT CAST(CreatedAt AS DATE) as workoutDate FROM TrainingPlan WHERE TR = @TR AND CreatedAt > DATEADD(month, -6, GETDATE());`),
            
            // 5. Get Workout Log History
            pool.request().input('TR', sql.Int, tr).query(`SELECT P.CreatedAt AS LogDate, STRING_AGG(B.Name, ', ') AS BodyParts FROM TrainingPlan P JOIN TrainingLog L ON P.PlanID = L.PlanID JOIN BodyParts B ON L.BodyPartID = B.BodyPartID WHERE P.TR = @TR GROUP BY P.PlanID, P.CreatedAt ORDER BY P.CreatedAt DESC;`),
            
            // 6. Get Fitness Test History
            pool.request().input('TR', sql.Int, tr).query(`SELECT * FROM TestRecords WHERE TR = @TR ORDER BY CreatedAt ASC;`),
            
            // 7. Get Full Attendance History
            pool.request().input('TR', sql.Int, tr).query(`SELECT CreatedAt, IsPresent, OnLeave, DurationInMinutes FROM Attendance WHERE TR = @TR ORDER BY CreatedAt DESC;`),
            
            // 8. Get Leave Request History
            pool.request().input('TR', sql.Int, tr).query(`SELECT * FROM LeaveRequests WHERE TR = @TR ORDER BY LeaveStartDate DESC;`)
        ]);

        res.json({
            success: true,
            data: {
                progress: progress,
                basicInfo: basicInfoRes.recordset[0],
                achievements: achievementsRes.recordset,
                workoutCalendar: workoutCalendarRes.recordset.map(r => r.workoutDate),
                workoutLogs: workoutLogsRes.recordset,
                fitnessTests: fitnessTestsRes.recordset,
                attendanceHistory: attendanceHistoryRes.recordset,
                leaveHistory: leaveHistoryRes.recordset
            }
        });

    } catch (err) {
        console.error("Error fetching full student profile:", err);
        res.status(500).json({ success: false, message: 'Failed to fetch student profile.' });
    }
});

// ======================================================================================= //
// --- 🏆 ACHIEVEMENTS & GAMIFICATION API (REVISED & ENHANCED LOGIC) ---
// ======================================================================================= //

// This is the complete, long-running process with updated logic.
async function runAchievementEvaluation() {
    const transaction = new sql.Transaction(pool);

    try {
        await transaction.begin();

        // --- 1. Social Butterfly (Leaderboard) ---
        const lastWeekStart = moment.tz("Asia/Kolkata").subtract(1, 'weeks').startOf('isoWeek').toDate();
        const lastWeekEnd = moment.tz("Asia/Kolkata").subtract(1, 'weeks').endOf('isoWeek').toDate();

        const leaderboardRequest = new sql.Request(transaction);
        const leaderboardResult = await leaderboardRequest
            .input('WeekStart', sql.DateTime, lastWeekStart)
            .input('WeekEnd', sql.DateTime, lastWeekEnd)
            .query(`
                WITH Scores AS (
                    SELECT M.TR, (ISNULL(A.AttendanceCount, 0) + ISNULL(L.WorkoutDays, 0)) AS Score
                    FROM Master M
                    LEFT JOIN (SELECT TR, COUNT(*) AS AttendanceCount 
                               FROM Attendance 
                               WHERE CreatedAt BETWEEN @WeekStart AND @WeekEnd AND IsPresent = 1 
                               GROUP BY TR) A ON M.TR = A.TR
                    LEFT JOIN (SELECT TR, COUNT(*) AS WorkoutDays 
                               FROM TrainingPlan 
                               WHERE CreatedAt BETWEEN @WeekStart AND @WeekEnd 
                               GROUP BY TR) L ON M.TR = L.TR
                    WHERE M.Status = 'Active'
                ),
                Ranks AS (
                    SELECT TR, DENSE_RANK() OVER (ORDER BY Score DESC) as rank 
                    FROM Scores WHERE Score > 0
                )
                SELECT TR FROM Ranks WHERE rank <= 3;
            `);

        const socialButterflyID = 3;

        for (const winner of leaderboardResult.recordset) {
            const checkSocialRequest = new sql.Request(transaction);
            const checkRes = await checkSocialRequest
                .input('TR', winner.TR)
                .query(`SELECT 1 FROM StudentAchievements 
                        WHERE AchievementID = ${socialButterflyID} AND TR = @TR 
                          AND DateEarned > DATEADD(day, -7, GETUTCDATE())`);

            if (checkRes.recordset.length === 0) {
                const insertSocialRequest = new sql.Request(transaction);
                await insertSocialRequest.input('TR', winner.TR)
                    .query(`INSERT INTO StudentAchievements (TR, AchievementID) VALUES (@TR, ${socialButterflyID})`);

                // --- NEW: Award XP for earning Social Butterfly ---
                await awardXP(winner.TR, 50, transaction);
            }
        }

        // --- 2. Evaluate Individual Achievements ---
        const studentsResult = await new sql.Request(transaction).query(`SELECT TR, JoinedAt FROM Master WHERE Status = 'Active'`);

        for (const student of studentsResult.recordset) {
            const { TR, JoinedAt } = student;

            // --- 2a. Perfect 30 Days ---
            const perfectMonthID = 1;
            const thirtyDaysAgo = moment.tz("Asia/Kolkata").subtract(30, 'days').toDate();

            if (moment(JoinedAt).isBefore(thirtyDaysAgo)) {
                const checkPerfectRequest = new sql.Request(transaction);
                const checkPerfect = await checkPerfectRequest.input('TR', TR)
                    .query(`SELECT 1 FROM StudentAchievements 
                            WHERE AchievementID = ${perfectMonthID} AND TR = @TR 
                              AND DateEarned > DATEADD(day, -30, GETUTCDATE())`);

                if (checkPerfect.recordset.length === 0) {
                    const attendanceCountRequest = new sql.Request(transaction);
                    const attendanceCountRes = await attendanceCountRequest
                        .input('TR', TR)
                        .input('StartDate', thirtyDaysAgo)
                        .query(`
                            SELECT COUNT(DISTINCT CAST(CreatedAt AS DATE)) as AttendedDays 
                            FROM Attendance 
                            WHERE TR = @TR AND CreatedAt >= @StartDate 
                              AND (IsPresent = 1 OR OnLeave = 1)
                        `);

                    if (attendanceCountRes.recordset[0]?.AttendedDays >= 26) {
                        const insertPerfectRequest = new sql.Request(transaction);
                        await insertPerfectRequest.input('TR', TR)
                            .query(`INSERT INTO StudentAchievements (TR, AchievementID) VALUES (@TR, ${perfectMonthID})`);

                        // --- NEW: Award XP for Perfect 30 Days ---
                        await awardXP(TR, 50, transaction);
                    }
                }
            }

            // --- 2b. Consistency King ---
            const consistencyKingID = 2;
            const workoutDatesRequest = new sql.Request(transaction);
            const workoutDatesRes = await workoutDatesRequest.input('TR', TR)
                .query(`SELECT DISTINCT CAST(CreatedAt AS DATE) as workoutDate 
                        FROM TrainingPlan 
                        WHERE TR = @TR 
                        ORDER BY workoutDate ASC`);
            const workoutDates = workoutDatesRes.recordset.map(r => moment(r.workoutDate));

            if (workoutDates.length > 0) {
                let currentStreak = 1;
                let longestStreak = 1;

                // Fetch holidays
                const holidayCheckRequest = new sql.Request(transaction);
                const gymHolidaysRes = await holidayCheckRequest.query(`
                    SELECT DISTINCT CAST(A.CreatedAt AS DATE) as holidayDate 
                    FROM Attendance A 
                    JOIN (
                        SELECT CAST(CreatedAt AS DATE) as date, COUNT(TR) as leaveCount 
                        FROM Attendance 
                        WHERE OnLeave = 1 
                        GROUP BY CAST(CreatedAt AS DATE)
                    ) AS LeaveCounts 
                    ON CAST(A.CreatedAt AS DATE) = LeaveCounts.date 
                    WHERE LeaveCounts.leaveCount > (SELECT COUNT(*) FROM Master WHERE Status='Active') * 0.5
                `);
                const gymHolidays = new Set(gymHolidaysRes.recordset.map(r => moment(r.holidayDate).format('YYYY-MM-DD')));

                for (let i = 0; i < workoutDates.length - 1; i++) {
                    const diff = workoutDates[i+1].diff(workoutDates[i], 'days');
                    if (diff === 1 || (diff === 2 && workoutDates[i].day() === 6)) {
                        currentStreak++;
                    } else if (diff > 1) {
                        let isHolidayGap = true;
                        for (let d = 1; d < diff; d++) {
                            const checkDate = workoutDates[i].clone().add(d, 'day');
                            if (checkDate.day() !== 0 && !gymHolidays.has(checkDate.format('YYYY-MM-DD'))) {
                                isHolidayGap = false;
                                break;
                            }
                        }
                        if (isHolidayGap) currentStreak++;
                        else currentStreak = 1;
                    }
                    if (currentStreak > longestStreak) longestStreak = currentStreak;
                }

                const checkConsistencyRequest = new sql.Request(transaction);
                const checkConsistency = await checkConsistencyRequest.input('TR', TR)
                    .query(`SELECT 1 FROM StudentAchievements 
                            WHERE AchievementID = ${consistencyKingID} AND TR = @TR 
                              AND DateEarned > DATEADD(day, -30, GETUTCDATE())`);

                if (longestStreak >= 10 && checkConsistency.recordset.length === 0) {
                    const insertConsistencyRequest = new sql.Request(transaction);
                    await insertConsistencyRequest.input('TR', TR)
                        .query(`INSERT INTO StudentAchievements (TR, AchievementID) VALUES (@TR, ${consistencyKingID})`);

                    // --- NEW: Award XP for Consistency King ---
                    await awardXP(TR, 50, transaction);
                }

                // Update personal best
                const updateBestStreakRequest = new sql.Request(transaction);
                await updateBestStreakRequest
                    .input('TR', TR)
                    .input('LongestStreak', longestStreak)
                    .query(`UPDATE Master SET BestStreak = @LongestStreak WHERE TR = @TR AND BestStreak < @LongestStreak`);
            }

            // --- 2c. Milestone Lift ---
            const milestoneLiftID = 4;
            const testRecordsRequest = new sql.Request(transaction);
            const testRecordsRes = await testRecordsRequest.input('TR', TR)
                .query(`SELECT TOP 2 Total FROM TestRecords WHERE TR = @TR ORDER BY CreatedAt DESC`);

            if (testRecordsRes.recordset.length === 2) {
                const latestScore = testRecordsRes.recordset[0].Total;
                const previousScore = testRecordsRes.recordset[1].Total;
                const improvement = ((latestScore - previousScore) / previousScore) * 100;

                if (improvement >= 5) {
                    const checkMilestoneRequest = new sql.Request(transaction);
                    const checkMilestone = await checkMilestoneRequest.input('TR', TR)
                        .query(`SELECT 1 FROM StudentAchievements 
                                WHERE AchievementID = ${milestoneLiftID} AND TR = @TR 
                                  AND DateEarned > DATEADD(day, -90, GETUTCDATE())`);

                    if (checkMilestone.recordset.length === 0) {
                        const insertMilestoneRequest = new sql.Request(transaction);
                        await insertMilestoneRequest.input('TR', TR)
                            .query(`INSERT INTO StudentAchievements (TR, AchievementID) VALUES (@TR, ${milestoneLiftID})`);

                        // --- NEW: Award XP for Milestone Lift ---
                        await awardXP(TR, 50, transaction);
                    }
                }
            }

            // Inside the main student loop in runAchievementEvaluation

            // --- NEW: 3. Iron Dedication Check ---
            const totalHours = student.TotalMinutesLogged / 60;
            const dedicationAchievements = {
                'Gold': { id: 7, hours: 50 },   
                'Silver': { id: 6, hours: 25 }, 
                'Bronze': { id: 5, hours: 10 }  
            };

            for (const tier in dedicationAchievements) {
                const { id, hours } = dedicationAchievements[tier];
                if (totalHours >= hours) {
                    const checkDedication = await new sql.Request(transaction)
                        .input('TR', TR).query(`SELECT 1 FROM StudentAchievements WHERE AchievementID = ${id} AND TR = @TR`);
                    
                    if (checkDedication.recordset.length === 0) {
                        await new sql.Request(transaction)
                            .input('TR', TR).query(`INSERT INTO StudentAchievements (TR, AchievementID) VALUES (@TR, ${id})`);
                        await awardXP(TR, 50, transaction); // Award XP for the new badge
                    }
                }
            }
        }

        await transaction.commit();
        console.log('✅ Background achievement evaluation completed successfully.');
    } catch (err) {
        if (transaction.active) await transaction.rollback();
        console.error("❌ Background achievement evaluation failed:", err);
    }
}


// THE "FIRE-AND-FORGET" API ROUTE (No changes here, remains the same)
app.post('/api/achievements/evaluate', (req, res) => {
    if (req.headers['x-internal-secret'] !== 'AjsmGymEvaluation_2025!') { // Use your actual secret key
        return res.status(403).json({ success: false, message: 'Forbidden' });
    }
    res.status(202).json({ success: true, message: 'Achievement evaluation process has been initiated in the background.' });
    runAchievementEvaluation();
});

/**
 * STUDENT'S TROPHY CASE
 * Fetches all earned achievements for the logged-in student.
 */
app.get('/api/student/achievements', async (req, res) => {
    if (!req.session.user || !req.session.user.TR) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    const { TR } = req.session.user;
    try {
        const result = await pool.request()
            .input('TR', sql.Int, TR)
            .query(`
                SELECT A.AchievementName, A.Description, A.BadgeImageURL, SA.DateEarned, SA.Context
                FROM StudentAchievements SA
                JOIN Achievements A ON SA.AchievementID = A.AchievementID
                WHERE SA.TR = @TR
                ORDER BY SA.DateEarned DESC;
            `);
        res.json({ success: true, data: result.recordset });
    } catch (err) {
        console.error("Error fetching student achievements:", err);
        res.status(500).json({ success: false, message: 'Failed to fetch achievements.' });
    }
});


/**
 * HALL OF FAME LEADERBOARD
 * Ranks students by the number of achievements earned, filtered by branch/gender.
 */
app.get('/api/achievements/leaderboard', async (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    const { Branch, Gender } = req.session.user;

    try {
        const result = await pool.request()
            .input('Branch', sql.NVarChar(50), Branch)
            .input('Gender', sql.NVarChar(50), Gender)
            .query(`
                SELECT TOP 10
                    M.Name,
                    COUNT(SA.StudentAchievementID) AS TotalAchievements
                FROM Master M
                JOIN StudentAchievements SA ON M.TR = SA.TR
                WHERE M.Status = 'Active' AND M.Branch = @Branch AND M.Gender = @Gender
                GROUP BY M.Name
                ORDER BY TotalAchievements DESC, MIN(SA.DateEarned) ASC;
            `);
        res.json({ success: true, data: result.recordset });
    } catch (err) {
        console.error("Error fetching achievement leaderboard:", err);
        res.status(500).json({ success: false, message: 'Failed to fetch leaderboard.' });
    }
});


// =================================================================== //
// --- 🏆 ACHIEVEMENT PROGRESS API (THE "GAME MODE" ENGINE) ---
// =================================================================== //

// This single API calculates and returns the student's live progress for all achievements.
app.get('/api/student/achievements/progress', async (req, res) => {
    if (!req.session.user || !req.session.user.TR) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    const { TR } = req.session.user;

    try {
        const [consistency, perfectMonth, socialButterfly, milestoneLift, ironDedication] = await Promise.all([
            getConsistencyProgress(TR),
            getPerfectMonthProgress(TR),
            getSocialButterflyProgress(TR),
            getMilestoneLiftProgress(TR),
            getIronDedicationProgress(TR)
        ]);

        res.json({
            success: true,
            data: {
                consistency,
                perfectMonth,
                socialButterfly,
                milestoneLift,
                ironDedication

            }
        });
    } catch (err) {
        console.error("Error fetching achievement progress:", err);
        res.status(500).json({ success: false, message: 'Failed to fetch progress data.' });
    }
});


/**
 * Checks if a gap between two dates is "bridged" by Sundays or approved leave days.
 * @param {moment.Moment} newerDate - The more recent date (e.g., today).
 * @param {moment.Moment} olderDate - The less recent date (e.g., last workout).
 * @param {Set<string>} leaveDateSet - A Set of 'OnLeave' dates in 'YYYY-MM-DD' format.
 * @returns {boolean} - True if the gap is 1 day or less, or if all days in the gap are Sundays or leave days.
 */
function isGapExcused(newerDate, olderDate, leaveDateSet) {
    const gapDays = newerDate.diff(olderDate, 'days');

    // 1-day gap (e.g., Mon -> Tue) or 0-day gap (same day) is always valid.
    if (gapDays <= 1) {
        return true;
    }

    // Loop through each day *inside* the gap.
    let currentDate = olderDate.clone().add(1, 'day');
    
    for (let i = 0; i < gapDays - 1; i++) {
        const dayOfWeek = currentDate.day(); // 0 = Sunday
        const dateString = currentDate.format('YYYY-MM-DD');

        // This is an unexcused absence (streak breaks) if:
        // 1. It's NOT Sunday
        // 2. AND the date is NOT in our set of approved leave dates.
        if (dayOfWeek !== 0 && !leaveDateSet.has(dateString)) {
            // This day is a weekday and is not excused. Streak breaks.
            return false;
        }
        
        // Move to the next day in the gap
        currentDate.add(1, 'day');
    }

    // If we get here, all days within the gap were either Sundays or leave days.
    return true;
}


// --- YOUR UPDATED MAIN FUNCTION ---
async function getConsistencyProgress(tr) {
    try {
        const res = await pool.request()
            .input('TR', sql.Int, tr)
            .query(`
                -- 1. Get all "streak days" (user was present)
                SELECT DISTINCT CAST(CreatedAt AS DATE) as presentDate
                FROM Attendance
                WHERE TR = @TR AND IsPresent = 1
                ORDER BY presentDate DESC;

                -- 2. Get all "excused gap days" (user was on leave)
                SELECT DISTINCT CAST(CreatedAt AS DATE) as leaveDate
                FROM Attendance
                WHERE TR = @TR AND OnLeave = 1;

                -- 3. Get the user's personal best streak
                SELECT BestStreak FROM Master WHERE TR = @TR;
            `);

        // 1. Process "present" dates.
        //    --- FIX: Apply .startOf('day') to normalize ---
        const presentDates = res.recordsets[0].map(r => 
            moment(r.presentDate).startOf('day')
        );
        
        // 2. Process "leave" dates into a fast-lookup Set.
        //    --- FIX: Apply .startOf('day') for consistency ---
        const leaveDateSet = new Set(
            res.recordsets[1].map(r => 
                moment(r.leaveDate).startOf('day').format('YYYY-MM-DD')
            )
        );
        
        // 3. Process personal best
        const personalBest = res.recordsets[2][0]?.BestStreak || 0;

        if (presentDates.length === 0) {
            // No attendance records at all.
            return { current: 0, target: 10, personalBest };
        }

        // --- Compute current streak ---
        const today = moment.tz("Asia/Kolkata").startOf('day');
        const lastPresentDate = presentDates[0]; // Already normalized to start of day

        let currentStreak = 0;

        // 1. Check gap between today and the last attendance day
        //    This will now correctly calculate a 4-day diff
        if (isGapExcused(today, lastPresentDate, leaveDateSet)) {
            currentStreak = 1;
        } else {
            // This 'else' block will now be correctly triggered
            // because of the unexcused absence on Oct 20 (Mon).
            return { current: 0, target: 10, personalBest };
        }

        // 2. Loop through attendance history to count the full streak
        for (let i = 0; i < presentDates.length - 1; i++) {
            const newerDate = presentDates[i];     // Already normalized
            const olderDate = presentDates[i + 1]; // Already normalized

            if (isGapExcused(newerDate, olderDate, leaveDateSet)) {
                currentStreak++;
            } else {
                // This will correctly break on the gap between
                // Oct 16 (Thu) and Oct 14 (Tue) because of Oct 15 (Wed).
                break;
            }
        }

        return { current: currentStreak, target: 10, personalBest };

    } catch (err) {
        console.error(`Failed to get consistency progress for TR ${tr}:`, err);
        return { current: 0, target: 10, personalBest: 0 };
    }
}

async function getPerfectMonthProgress(tr) {
    // REVISED LOGIC: Calculate progress towards the rolling 30-day goal
    const thirtyDaysAgo = moment.tz("Asia/Kolkata").subtract(30, 'days').toDate();
    const attendanceRes = await pool.request().input('TR', sql.Int, tr)
        .input('StartDate', sql.Date, thirtyDaysAgo)
        .query(`SELECT COUNT(DISTINCT CAST(CreatedAt AS DATE)) as count FROM Attendance WHERE TR = @TR AND (IsPresent = 1 OR OnLeave = 1) AND CreatedAt >= @StartDate`);
    
    return { current: attendanceRes.recordset[0]?.count || 0, target: 26 };
}


async function getSocialButterflyProgress(tr) {
    // REVISED LOGIC: Calculate the user's personal score for the current week so far.
    const weekStart = moment.tz("Asia/Kolkata").startOf('isoWeek').toDate();
    const today = moment.tz("Asia/Kolkata").endOf('day').toDate(); // Use end of day for accuracy

    const scoreRes = await pool.request()
        .input('TR', sql.Int, tr)
        .input('WeekStart', sql.Date, weekStart)
        .input('Today', sql.Date, today)
        .query(`
            SELECT 
                (ISNULL((SELECT COUNT(*) FROM Attendance WHERE TR = @TR AND IsPresent = 1 AND CreatedAt BETWEEN @WeekStart AND @Today), 0) + 
                 ISNULL((SELECT COUNT(DISTINCT CAST(CreatedAt AS DATE)) FROM TrainingPlan WHERE TR = @TR AND CreatedAt BETWEEN @WeekStart AND @Today), 0)) AS TotalScore;
        `);
    
    // The API now returns a simple score out of a target of 8.
    return { current: scoreRes.recordset[0]?.TotalScore || 0, target: 8 };
}

async function getMilestoneLiftProgress(tr) {
    // REVISED LOGIC: Calculate % improvement instead of 90-day countdown
    const testRecordsRes = await pool.request().input('TR', sql.Int, tr)
        .query(`SELECT TOP 2 Total FROM TestRecords WHERE TR = @TR ORDER BY CreatedAt DESC`);
        
    if (testRecordsRes.recordset.length < 2) {
        return { current_improvement: 0, target_improvement: 5, previous_score: testRecordsRes.recordset[0]?.Total || 'N/A', current_score: 'N/A' };
    }

    const latestScore = testRecordsRes.recordset[0].Total;
    const previousScore = testRecordsRes.recordset[1].Total;
    const improvement = previousScore > 0 ? ((latestScore - previousScore) / previousScore) * 100 : 0;

    return { current_improvement: improvement, target_improvement: 5, previous_score: previousScore, current_score: latestScore };
}

// REPLACE the old getIronDedicationProgress helper function
async function getIronDedicationProgress(tr) {
    const studentRes = await pool.request().input('TR', sql.Int, tr)
        .query(`SELECT TotalMinutesLogged FROM Master WHERE TR = @TR`);

    const totalMinutes = studentRes.recordset[0]?.TotalMinutesLogged || 0;
    const currentHours = totalMinutes / 60;

    let targetHours, tierName, completed = false;

    // This logic now determines the next goal based on current hours
    if (currentHours < 10) {
        targetHours = 10;
        tierName = 'Bronze';
    } else if (currentHours < 25) {
        targetHours = 25;
        tierName = 'Silver';
    } else if (currentHours < 50) {
        targetHours = 50;
        tierName = 'Gold';
    } else {
        targetHours = 50;
        tierName = 'Gold';
        completed = true;
    }

    return { current: currentHours, target: targetHours, tierName, completed };
}


// =================================================================
// =================================================================== //
// --- 🏆 XP & LEVEL-UP HELPER FUNCTION ---
// =================================================================== //

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

//------------------------------------------------------------------------------------------------

// code for install anything via terminal 
// Set-ExecutionPolicy RemoteSigned -Scope CurrentUser

// --- REPLACE the old app.get('*',...) with THIS new version ---
// This catch-all route MUST be at the end, after all API routes.
app.get('*', (req, res) => {
    // Construct the potential path to a file or directory on the server
    const resourcePath = path.join(__dirname, 'dist', req.path);

    // 1. Check if the requested path is a directory
    if (fs.existsSync(resourcePath) && fs.lstatSync(resourcePath).isDirectory()) {
        // If it is a directory, send a 403 Forbidden error.
        return res.status(403).send('Forbidden: Access to this directory is not allowed.');
    }

    // 2. Check if a corresponding .html file exists for the path
    const filePath = resourcePath + '.html';
    if (fs.existsSync(filePath)) {
        // If the HTML file exists, send it.
        return res.sendFile(filePath);
    }
    
    // 3. If it's neither a directory nor a file, send a 404 Not Found error.
    res.status(404).sendFile(path.join(__dirname, 'dist/Forbidden.html')); // Or a custom 404 page
});



let pool; 

sql.connect(config)
    .then(connectionPool => {
        
        pool = connectionPool;
        
        
        app.listen(port, '0.0.0.0', () => {
            console.log('✅ Connected to SQL Server!');
            // console.log(`🚀 Server is running on http://localhost:${port}`);
        });
    })
    .catch(err => {
        console.error('❌ Database Connection Failed! Server not started.');
        console.error(err);
    });