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

// Add this new route to your server's API file.
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
                    
                    -- Fitness tests require a JOIN to filter by the student's branch/gender
                    (SELECT COUNT(T.TestLog) FROM TestRecords T JOIN Master M ON T.TR = M.TR WHERE M.Branch = @Branch AND M.Gender = @Gender) AS fitnessTests,
                    
                    (SELECT COUNT(*) FROM TrainingPlan WHERE CAST(CreatedAt AS DATE) = CAST(GETDATE() AS DATE) AND Branch = @Branch AND Gender = @Gender) AS todaysLogs,
                    (SELECT COUNT(*) FROM WaitingList WHERE Branch = @Branch AND Gender = @Gender) AS waitingList,
                    
                    -- User count is based on branch only, as an admin would want to see all staff
                    (SELECT COUNT(*) FROM PassBank WHERE Branch = @Branch) AS users;
            `);

        // Send the first (and only) row of results as a JSON object
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
        const result = await pool.request()
            .input('Branch', sql.NVarChar(50), Branch)
            .input('Gender', sql.NVarChar(50), Gender)
            .query(`
                SELECT 
                    M.TR,
                    M.Name,
                    -- ✅ THIS IS THE UPDATED LOGIC --
                    CASE 
                        WHEN A.OnLeave = 1 THEN 'On Leave' -- Check for OnLeave first
                        WHEN A.IsPresent = 1 THEN 'Present'
                        ELSE 'Absent'
                    END AS IsPresentToday
                FROM Master M
                LEFT JOIN Attendance A
                    ON M.TR = A.TR 
                    AND CONVERT(date, A.CreatedAt) = CONVERT(date, GETDATE())
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
            -- ✅ GET THE CURRENT WEEK'S DATES
            DECLARE @CurrentWeekID INT;
            DECLARE @CurrentWeekStart DATE;
            DECLARE @CurrentWeekEnd DATE;

            SELECT TOP 1
                @CurrentWeekID = WeekID,
                @CurrentWeekStart = WeekStartDate,
                @CurrentWeekEnd = WeekEndDate
            FROM AttendanceWeek 
            WHERE GETDATE() BETWEEN WeekStartDate AND WeekEndDate;

            -- Attendance scores (this part is correct)
            WITH AttendanceScores AS (
                SELECT TR, COUNT(*) AS AttendanceCount
                FROM Attendance
                WHERE WeekID = @CurrentWeekID AND IsPresent = 1
                GROUP BY TR
            ),
            -- Corrected LogScores CTE
            LogScores AS (
                SELECT
                    P.TR,
                    COUNT(L.LogID) as TotalBodyParts, 
                    COUNT(DISTINCT CAST(P.CreatedAt AS DATE)) as WorkoutDays
                FROM TrainingPlan P
                JOIN TrainingLog L ON P.PlanID = L.PlanID
                -- ✅ CORRECTED FILTER: Use the date range instead of a non-existent WeekID
                WHERE P.CreatedAt BETWEEN @CurrentWeekStart AND DATEADD(day, 1, @CurrentWeekEnd)
                GROUP BY P.TR
            )
            SELECT TOP 3
                M.Name,
                COALESCE(A.AttendanceCount, 0) AS AttendanceScore
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
        const todayStr = new Date().toISOString().split('T')[0];
        request.input('Today', sql.Date, todayStr);

        // ✅ Get the most recent week that contains today
        const existingWeek = await request.query(`
            SELECT TOP 1 WeekID FROM AttendanceWeek 
            WHERE @Today BETWEEN WeekStartDate AND WeekEndDate
            ORDER BY WeekID DESC
        `);

        if (existingWeek.recordset.length > 0) {
            return res.json({ WeekID: existingWeek.recordset[0].WeekID });
        }

        // 🚀 Week doesn't exist — insert it
        const insertRequest = pool.request();
        insertRequest.input('WeekStartDate', sql.Date, WeekStartDate);
        insertRequest.input('WeekEndDate', sql.Date, WeekEndDate);

        await insertRequest.query(`
            INSERT INTO AttendanceWeek (WeekStartDate, WeekEndDate)
            VALUES (@WeekStartDate, @WeekEndDate)
        `);

        // 🔁 Get the newly inserted week's WeekID
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
app.post('/save-workout-plan', async (req, res) => {
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
    const { TR, Branch, Gender } = req.session.user;

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




//-----------------------------------------------------------------------------------------------------------------------


app.post('/api/attendance-manual', async (req, res) => {
    const { TR, WeekID, IsPresent } = req.body;

    // ✅ Ensure trainer is logged in
    if (!req.session.user || !req.session.user.Branch || !req.session.user.Gender) {
        return res.status(401).json({ error: 'Unauthorized access. Please log in.' });
    }

    const { Branch, Gender } = req.session.user;

    try {

        // ✅ Step 1: Verify that the student exists, is Active, and matches trainer's Branch & Gender
        const studentCheck = await pool.request()
            .input('TR', sql.Int, TR)
            .input('Branch', sql.NVarChar(50), Branch)
            .input('Gender', sql.NVarChar(50), Gender)
            .query(`
                SELECT 1 FROM Master
                WHERE TR = @TR AND Status = 'Active' AND Branch = @Branch AND Gender = @Gender
            `);

        if (studentCheck.recordset.length === 0) {
            return res.status(403).json({ error: '❌ TR not authorized or inactive.' });
        }

        // ✅ Step 2: Check if attendance already exists today
        const attendanceCheck = await pool.request()
            .input('TR', sql.Int, TR)
            .input('WeekID', sql.Int, WeekID)
            .query(`
                SELECT 1 FROM Attendance
                WHERE TR = @TR AND WeekID = @WeekID
                AND CONVERT(date, CreatedAt) = CONVERT(date, GETDATE())
            `);

        if (attendanceCheck.recordset.length > 0) {
            return res.status(400).json({ error: '❌ Attendance already marked for today.' });
        }

        // ✅ Step 3: Insert attendance
        await pool.request()
            .input('TR', sql.Int, TR)
            .input('WeekID', sql.Int, WeekID)
            .input('IsPresent', sql.Bit, IsPresent)
            .query(`
                INSERT INTO Attendance (TR, WeekID, IsPresent, CreatedAt)
                VALUES (@TR, @WeekID, @IsPresent, GETDATE())
            `);

        res.status(200).json({ message: '✅ Attendance marked successfully' });
    } catch (error) {
        console.error('❌ Attendance insert error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

  


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