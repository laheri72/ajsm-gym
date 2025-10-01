// Import required modules

const express = require('express');
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


app.get('/api/student-attendance/:weekId/:tr', async (req, res) => {
    const { weekId, tr } = req.params;

    try {
        // Get week start date
        const weekQuery = await pool.request()
            .input('WeekID', sql.Int, weekId)
            .query(`SELECT WeekStartDate FROM AttendanceWeek WHERE WeekID = @WeekID`);

        if (weekQuery.recordset.length === 0) {
            return res.status(404).json({ error: 'Week not found' });
        }

        const startDate = new Date(weekQuery.recordset[0].WeekStartDate);

        // --- CORRECTED LOGIC STARTS HERE ---
        // Fetch IsPresent and OnLeave flags for each day in the week
        const result = await pool.request()
            .input('WeekID', sql.Int, weekId)
            .input('TR', sql.Int, tr)
            .query(`
                SELECT 
                    M.Name,
                    DATENAME(WEEKDAY, A.CreatedAt) AS DayName,
                    A.IsPresent,
                    A.OnLeave  -- <-- Select the new column
                FROM Master M
                LEFT JOIN Attendance A 
                    ON M.TR = A.TR AND A.WeekID = @WeekID
                WHERE M.TR = @TR
            `);

        const studentName = result.recordset.length > 0 ? result.recordset[0].Name : '';
        
        // Create a clean record for the student
        const record = {
            TR: tr,
            Name: studentName,
            WeekStartDate: startDate,
            Monday: '', Tuesday: '', Wednesday: '', Thursday: '', Friday: '', Saturday: ''
        };

        // Loop through the database results to set the status for each day
        for (let row of result.recordset) {
            if (row.DayName) {
                if (row.IsPresent) {
                    record[row.DayName] = 'Present';
                } else if (row.OnLeave) {
                    record[row.DayName] = 'On Leave'; // <-- Set the new status
                }
            }
        }
        
        res.json([record]);
    } catch (err) {
        console.error('Error fetching student attendance:', err.message);
        res.status(500).json({ error: 'Failed to fetch student attendance' });
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

app.get('/api/student-info/:tr', async (req, res) => {
  const { tr } = req.params;

  try {
    const result = await pool.request()
      .input('TR', sql.Int, tr)
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


app.get('/api/student/eligible-weeks', async (req, res) => {
    // 1. Ensure a student is logged in by checking the session
    if (!req.session.user || !req.session.user.TR) {
        return res.status(401).json({ success: false, message: 'Unauthorized. Please log in.' });
    }

    const { TR } = req.session.user;

    try {
        const request = pool.request();
        request.input('TR', sql.Int, TR);

        // 2. Get the student's official join date from the Master table
        const studentResult = await request.query(`
            SELECT JoinedAt FROM Master WHERE TR = @TR
        `);

        if (studentResult.recordset.length === 0 || !studentResult.recordset[0].JoinedAt) {
             return res.status(404).json({ success: false, error: 'Student join date not found.' });
        }
        
        const joinedDate = studentResult.recordset[0].JoinedAt;
        
        // 3. Fetch only the weeks that started on or after the student joined
        const weeksResult = await pool.request()
            .input('JoinedAt', sql.Date, joinedDate)
            .query(`
                SELECT WeekID,
                       CONVERT(varchar, WeekStartDate, 23) AS WeekStartDate,
                       CONVERT(varchar, WeekEndDate, 23) AS WeekEndDate
                FROM AttendanceWeek
                WHERE WeekStartDate >= @JoinedAt
                ORDER BY WeekID ASC
            `);

        res.json({ success: true, weeks: weeksResult.recordset });

    } catch (err) {
        console.error('Error fetching eligible weeks:', err.message);
        res.status(500).json({ success: false, error: 'Failed to fetch eligible weeks' });
    }
});


app.get('/api/weekly-attendance/:weekId', async (req, res) => {
    const { weekId } = req.params;
    
    // Session check remains the same
    if (!req.session.user || !req.session.user.Branch || !req.session.user.Gender) {
        return res.status(401).json({ success: false, error: 'Unauthorized. Please log in.' });
    }
    const { Branch, Gender } = req.session.user;

    try {
        // This part remains the same: get the start date of the selected week
        const weekQuery = await pool.request()
            .input('WeekID', sql.Int, weekId)
            .query(`SELECT WeekStartDate FROM AttendanceWeek WHERE WeekID = @WeekID`);

        if (weekQuery.recordset.length === 0) {
            return res.status(404).json({ error: 'Week not found' });
        }
        const startDate = new Date(weekQuery.recordset[0].WeekStartDate);

        // --- THE MAIN QUERY IS UPDATED HERE ---
        const attendanceQuery = await pool.request()
            .input('WeekID', sql.Int, weekId)
            .input('Branch', sql.NVarChar(50), Branch)
            .input('Gender', sql.NVarChar(10), Gender)
            // ✅ Pass the week's start date as a parameter to the query
            .input('WeekStartDate', sql.Date, startDate) 
            .query(`
                SELECT 
                    M.TR, M.Name, M.JoinedAt, S.SlotName,
                    DATENAME(WEEKDAY, A.CreatedAt) AS DayName,
                    A.IsPresent,
                    A.OnLeave  -- Corrected: Added OnLeave to be fetched
                FROM Master M
                LEFT JOIN Attendance A ON M.TR = A.TR AND A.WeekID = @WeekID
                LEFT JOIN Slots S ON M.SlotID = S.SlotID
                WHERE 
                    M.Branch = @Branch 
                    AND M.Gender = @Gender 
                    AND M.Status = 'Active'
                    -- ✅ THIS IS THE KEY: Only include members who had joined by the start of this week
                    AND M.JoinedAt <= @WeekStartDate;
            `);

        // The rest of your JavaScript logic for processing the results is perfect and does not need to change.
        // It will now only receive the correctly filtered list of members.
        
        const resultMap = new Map();
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

        attendanceQuery.recordset.forEach(row => {
            if (!resultMap.has(row.TR)) {
                const record = { 
                    TR: row.TR, 
                    Name: row.Name,
                    SlotName: row.SlotName || 'N/A'
                };
                
                dayNames.forEach((day, i) => {
                    const currentDate = new Date(startDate);
                    currentDate.setDate(startDate.getDate() + i);
                    if (currentDate > today) {
                        record[day] = null; // Future dates are blank
                    } else {
                        record[day] = 'Absent'; // Default to Absent
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

        res.json([...resultMap.values()]);

    } catch (err) {
        console.error('Error fetching weekly attendance:', err.message);
        res.status(500).json({ error: 'Failed to fetch weekly attendance' });
    }
});
//--------------------------------------------------------------------------------------------------
//.............................LOGIN INFO...........................................................
//--------------------------------------------------------------------------------------------------

app.post('/api/student-login', async (req, res) => {
  const { tr } = req.body;

  try {
    const result = await pool.request()
      .input('TR', sql.Int, tr)
      .query(`
        SELECT Name, Branch, Gender, Status 
        FROM Master 
        WHERE TR = @TR
      `);

    if (result.recordset.length > 0) {
      const student = result.recordset[0];

      if (student.Status !== 'Active') {
        return res.json({ success: false, message: 'Your account is inactive. Please contact admin.' });
      }

      // ✅ Set session
      req.session.user = {
        TR: tr,
        Name: student.Name,
        Branch: student.Branch,
        Gender: student.Gender
      };

      res.json({
        success: true,
        name: student.Name,
        branch: student.Branch,
        gender: student.Gender
      });
    } else {
      res.json({ success: false, message: 'TR not found' });
    }
  } catch (err) {
    console.error('Student login error:', err.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});


app.get('/api/student-session', (req, res) => {
  if (req.session.user) {
    res.json({ success: true, user: req.session.user });
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



app.post('/api/trainer-login', async (req, res) => {
  const { username, password } = req.body;

  try {
    const request = pool.request();
    request.input('Username', sql.NVarChar(50), username);
    request.input('Password', sql.NVarChar(50), password);

    const result = await request.query(`
      SELECT Username, Branch, Gender, Role FROM PassBank
      WHERE Username = @Username AND Password = @Password
    `);

    if (result.recordset.length === 1) {
      const { Username, Branch, Gender, Role } = result.recordset[0];

      if (Role !== 'Trainer') {
        return res.status(403).json({ success: false, message: 'Only Trainers can login here.' });
      }

      req.session.user = { Username, Branch, Gender, Role };

      return res.json({ success: true, role: Role });

    } else {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
  } catch (err) {
    console.error('Trainer login error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});






app.post('/api/staff-login', async (req, res) => {
  const { username, password } = req.body;

  try {
    const request = pool.request();
    request.input('Username', sql.NVarChar(50), username);
    request.input('Password', sql.NVarChar(50), password);

    const result = await request.query(`
      SELECT Username, Branch, Gender, Role FROM PassBank
      WHERE Username = @Username AND Password = @Password
    `);

    if (result.recordset.length === 1) {
      const { Username, Branch, Gender, Role } = result.recordset[0];

      if (Role === 'Trainer') {
        return res.status(403).json({ success: false, message: 'Trainers not allowed here.' });
      }

      req.session.user = { Username, Branch, Gender, Role };

      return res.json({ success: true, user: { Username, Branch, Gender, Role } });

    } else {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
  } catch (err) {
    console.error('Staff login error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});


// ------------------------------------------------------------------------------------------------------


// CORRECTED ADMIN ROUTES
app.get('/api/admin/users/:branch', async (req, res) => {
    const branch = req.params.branch;
    try {
        const result = await pool.request() 
            .input('branch', sql.NVarChar(50), branch)
            .query(`SELECT Username, Gender, Role FROM PassBank WHERE Branch = @branch`);
        res.json(result.recordset);
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

app.post('/api/admin/add-user', async (req, res) => {
    const { username, password, gender, role, branch } = req.body;
    try {
        await pool.request() 
            .input('username', sql.NVarChar(50), username)
            .input('password', sql.NVarChar(50), password)
            .input('gender', sql.NVarChar(10), gender)
            .input('role', sql.NVarChar(20), role)
            .input('branch', sql.NVarChar(50), branch)
            .query(`
                INSERT INTO PassBank (Username, Password, Gender, Role, Branch)
                VALUES (@username, @password, @gender, @role, @branch)
            `);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Add user failed' });
    }
});

app.delete('/api/admin/delete-user/:username', async (req, res) => {
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





app.post('/api/test-login', async (req, res) => {
    const { username, password } = req.body;

    try {
        const result = await pool.request()
            .input('Username', sql.Int, username)
            .input('Password', sql.Int, password)
            .query('SELECT * FROM PassTest WHERE Username = @Username AND Password = @Password');

        if (result.recordset.length === 0) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        req.session.currentTR = username; // Save TR as session
        return res.json({ message: 'Login successful' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
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

app.post('/api/log-training-plan', async (req, res) => {
    const { TR, BodyParts } = req.body;
    const { Branch, Gender } = req.session.user;

    // A transaction is crucial for multi-step database operations
    const transaction = new sql.Transaction(pool);
    try {
        await transaction.begin();

        // Step 1: Insert a single record into the main TrainingPlan table to create a "session"
        // We get back the new PlanID that was just created.
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

        // Step 2: Loop through the array of body parts sent from the frontend
        for (const partName of BodyParts) {
            // For each body part, insert a new row into our junction table (TrainingLog)
            await new sql.Request(transaction)
                .input('PlanID', sql.Int, newPlanID)
                .input('PartName', sql.NVarChar(50), partName)
                .query(`
                    INSERT INTO TrainingLog (PlanID, BodyPartID)
                    SELECT @PlanID, BodyPartID FROM BodyParts WHERE Name = @PartName;
                `);
        }
        
        // If all inserts were successful, commit the transaction
        await transaction.commit();
        res.json({ success: true, message: 'Training plan logged successfully' });

    } catch (err) {
        // If any step failed, roll back the entire transaction
        await transaction.rollback();
        console.error('❌ Error logging training plan:', err);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});


app.get('/api/student/training-analytics', async (req, res) => {
    const { TR } = req.session.user; // Get TR from the logged-in student's session
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



// API for the Fitness Progression Line Chart
app.get('/api/student/fitness-test-history', async (req, res) => {
    if (!req.session.user || !req.session.user.TR) return res.status(401).json({ success: false });
    const { TR } = req.session.user;
    try {
        const result = await pool.request()
            .input('TR', sql.Int, TR)
            .query(`
                SELECT CONVERT(VARCHAR(10), CreatedAt, 120) AS TestDate, Weight, BodyFat, Grade
                FROM TestRecords 
                WHERE TR = @TR 
                ORDER BY CreatedAt ASC;
            `);
        res.json({ success: true, data: result.recordset });
    } catch (err) { res.status(500).json({ success: false }); }
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

// Replace the entire /api/student/session-analytics function with this new sequential version
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
    if (!req.session.currentTR) {
        return res.status(401).json({ message: 'Not logged in' });
    }
    res.json({ tr: req.session.currentTR });
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
    const plan = req.body; // { Monday: '...', Tuesday: '...', ... }
    const { TR, Branch, Gender } = req.session.user;

    if (!TR || !Branch || !Gender) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

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

app.post('/api/checkout', async (req, res) => {
    const { TR } = req.body;
    // 'moment-timezone' should be required at the top of your server.js file.

    if (!TR) {
        return res.status(400).json({ success: false, message: 'TR number is required.' });
    }

    try {
        const request = pool.request();
        request.input('TR', sql.Int, TR);

        // --- ✅ REFINED LOGIC ---
        // 1. Define the start and end of the current day in the IST timezone.
        const startOfTodayIST = moment.tz("Asia/Kolkata").startOf('day');
        const endOfTodayIST = moment.tz("Asia/Kolkata").endOf('day');

        // 2. Convert these IST boundaries to UTC for the database query.
        const startUTC = startOfTodayIST.utc().toDate();
        const endUTC = endOfTodayIST.utc().toDate();
        
        // 3. Pass the UTC range as parameters.
        request.input('StartUTC', sql.DateTime, startUTC);
        request.input('EndUTC', sql.DateTime, endUTC);
        // --- END REFINEMENT ---

        // Find the open session (where OutTime is NULL) for this student on the current IST day
        const openSession = await request.query(`
            SELECT AttendanceID, CreatedAt FROM Attendance
            WHERE TR = @TR 
              AND OutTime IS NULL 
              -- 4. The query now uses the correct time range instead of just the date.
              AND CreatedAt BETWEEN @StartUTC AND @EndUTC;
        `);

        if (openSession.recordset.length === 0) {
            return res.status(404).json({ success: false, message: 'This student is not currently checked in. Please mark their attendance first.' });
        }

        // The rest of your logic for calculating duration and formatting the response is perfect.
        const { AttendanceID, CreatedAt } = openSession.recordset[0];

        const inTime = moment.utc(CreatedAt);
        const outTime = moment.utc();  

        const duration = outTime.diff(inTime, 'minutes');

        await request
            .input('OutTime', sql.DateTime, outTime.toDate())
            .input('Duration', sql.Int, duration)
            .input('AttendanceID', sql.Int, AttendanceID)
            .query(`
                UPDATE Attendance 
                SET OutTime = @OutTime, DurationInMinutes = @Duration
                WHERE AttendanceID = @AttendanceID;
            `);

        const inTimeFormatted = inTime.tz("Asia/Kolkata").format("h:mm A");
        const outTimeFormatted = outTime.tz("Asia/Kolkata").format("h:mm A");

          res.json({ 
              success: true, 
              duration: duration,
              inTime: inTimeFormatted,
              outTime: outTimeFormatted
          });

    } catch (err) {
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
                    A.Branch = @Branch 
                    AND A.Gender = @Gender
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

    // Check if student exists
    const studentCheck = await request.query(`
      SELECT 
        m.TR,
        m.Name,
        m.Branch,
        m.Gender,
        m.SlotID,
        s.SlotName
      FROM Master m
      LEFT JOIN Slots s ON m.SlotID = s.SlotID
      WHERE m.TR = @TR 
        AND m.Branch = @Branch 
        AND m.Gender = @Gender
    `);

    if (studentCheck.recordset.length === 0) {
      return res.status(401).json({ success: false, error: 'Unauthorized: TR not found in your branch/gender' });
    }

    // Fetch Attendance record
    const result = await request.query(`
      SELECT 
        a.AttendanceID, 
        a.TR, 
        a.WeekID, 
        a.IsPresent, 
        a.CreatedAt, 
        a.Branch, 
        a.Gender
      FROM Attendance a
      WHERE a.TR = @TR 
        AND a.Branch = @Branch 
        AND a.Gender = @Gender
        AND CAST(a.CreatedAt AS DATE) = @Date
    `);

    if (result.recordset.length > 0) {
      return res.json({ success: true, record: result.recordset[0] });
    } else {
      // No record found → Absent
      return res.json({
        success: true,
        record: {
          AttendanceID: null,
          TR: parseInt(tr),
          WeekID: null,
          IsPresent: false,
          CreatedAt: date,
          Branch,
          Gender
        }
      });
    }
  } catch (err) {
    console.error('Error fetching attendance record:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch attendance' });
  }
});




// This route now exclusively handles marking a student as "On Leave" for a specific date.
app.put('/api/attendance-record', async (req, res) => {
    // We only need TR and the specific date from the frontend.
    const { TR, CreatedAt } = req.body;
    const { Branch, Gender } = req.session.user;

    if (!TR || !CreatedAt) {
        return res.status(400).json({ success: false, error: 'TR and Date are required.' });
    }

    try {
        // First, find the correct WeekID for the given date.
        const weekResult = await pool.request()
            .input('Date', sql.Date, CreatedAt)
            .query('SELECT WeekID FROM AttendanceWeek WHERE @Date BETWEEN WeekStartDate AND WeekEndDate');

        if (weekResult.recordset.length === 0) {
            return res.status(400).json({ success: false, error: 'No valid week found for the selected date.' });
        }
        const weekId = weekResult.recordset[0].WeekID;

        // Use a MERGE statement to either UPDATE an existing record or INSERT a new one.
        const request = pool.request();
        request.input('TR', sql.Int, TR);
        request.input('WeekID', sql.Int, weekId);
        request.input('Date', sql.Date, CreatedAt);
        request.input('Branch', sql.NVarChar(50), Branch);
        request.input('Gender', sql.NVarChar(10), Gender);
        
        await request.query(`
            MERGE Attendance AS target
            USING (SELECT @TR AS TR, @Date AS CreatedAt) AS source
            ON (target.TR = source.TR AND CAST(target.CreatedAt AS DATE) = source.CreatedAt)
            -- If a record for this TR on this day already exists (e.g., they were marked present):
            WHEN MATCHED THEN
                UPDATE SET IsPresent = 0, OnLeave = 1
            -- If no record exists for this TR on this day:
            WHEN NOT MATCHED THEN
                INSERT (TR, WeekID, IsPresent, CreatedAt, Branch, Gender, OnLeave)
                VALUES (@TR, @WeekID, 0, @Date, @Branch, @Gender, 1);
        `);

        res.json({ success: true, message: 'Student successfully marked as "On Leave".' });

    } catch (err) {
        console.error('Error setting "On Leave" status:', err);
        res.status(500).json({ success: false, error: 'Failed to update attendance.' });
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
app.get('/api/testmaster/:tr', async (req, res) => {
    const tr = req.params.tr;
    try {
        const result = await pool.request() 
            .input('tr', sql.Int, tr)
            .query(`
                SELECT TR, ITS, Darajah, Age, Name, Hizb, Class, House, Check18, Email, DOB
                FROM TestMaster WHERE TR = @tr
            `);
        res.json(result.recordset[0] || {});
    } catch (err) {
        console.error('Error fetching TestMaster:', err);
        res.status(500).json({ error: 'Failed to fetch student data' });
    }
});


app.post('/api/testrecords', async (req, res) => {
    const {
        TR, DOB, Age, Weight, Height, Waist, Hips, Neck,
        BMI, BMIStatus, BodyFat, BMR, CalorieIntake, VO2Max, Total, Grade
    } = req.body;

    try {
        const request = pool.request();         // ✅ define request BEFORE using it
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
            
            

        res.status(200).json({ message: "Test record saved successfully" });
    } catch (err) {
        console.error("Error saving test record:", err);
        res.status(500).json({ error: "Server error saving test record" });
    }
});


app.get('/api/testrecords/:tr', async (req, res) => {
    const tr = req.params.tr;
    try {
        const result = await pool.request()
            .input('TR', sql.Int, tr)
            .query('SELECT * FROM TestRecords WHERE TR = @TR ORDER BY TestLog DESC');

        res.status(200).json(result.recordset);
    } catch (err) {
        console.error("Error fetching test records:", err);
        res.status(500).json({ error: "Failed to fetch test records" });
    }
});


// Add this new route to your API file
app.post('/api/trainer-test-records', async (req, res) => {
    // Expect an array of records in the request body
    const records = req.body;
    
    // Check for authorization (ensure user is a trainer)
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
            
            // Validate required fields for each record here if necessary

            // Set inputs from the record object
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
            request.input('SubmittedBy', sql.NVarChar(50), 'Trainer'); // Hardcoded value

            await request.query(insertQuery);
        }

        await transaction.commit();
        res.status(200).json({ message: `${records.length} test records saved successfully.` });

    } catch (err) {
        await transaction.rollback();
        console.error("Error saving trainer test records:", err);
        res.status(500).json({ error: "Server error during bulk insert." });
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