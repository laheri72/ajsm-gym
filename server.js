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
  origin: 'https://webdev-raudat-al-ikhwan.onrender.com',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: 'jamea1446@GYM!SecreT2025',  // ✅ now pulled from Render env
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





let pool;  
sql.connect(config)
    .then(pool => {
        console.log('✅ Connected to SQL Server!');
        return pool;
    })
    .catch(err => {
        console.error('❌ Connection failed:', err);
    });







// // ➕ Add Student
// app.post('/api/add-student', async (req, res) => {
//   const { TR, Name, Darajah, Goal, Slot } = req.body;

//   // ✅ Step 1: Ensure staff is logged in
//   if (!req.session.user) {
//     return res.status(403).json({ error: 'Unauthorized' });
//   }

//   // ✅ Step 2: Extract Branch and Gender (case-sensitive!)
//   const { Branch, Gender } = req.session.user;

//   try {
//     await sql.connect(config);
//     const request = new sql.Request();

//     request.input('TR', sql.NVarChar(50), TR);
//     request.input('Name', sql.NVarChar(100), Name);
//     request.input('Darajah', sql.NVarChar(50), Darajah);
//     request.input('Goal', sql.NVarChar(100), Goal);
//     request.input('Slot', sql.NVarChar(50), Slot);
//     request.input('Branch', sql.NVarChar(50), Branch); // 👈 fixed casing
//     request.input('Gender', sql.NVarChar(10), Gender); // 👈 fixed casing

//     await request.query(`
//       INSERT INTO Master (TR, Name, Darajah, Goal, Slot, Branch, Gender)
//       VALUES (@TR, @Name, @Darajah, @Goal, @Slot, @Branch, @Gender)
//     `);

//     res.json({ success: true, message: 'Student added successfully' });

//   } catch (err) {
//     console.error('Add student error:', err);
//     res.status(500).json({ error: 'Failed to add student' });
//   }
// });


// ➕ Add Student (always goes to WaitingList)
app.post('/api/add-student', async (req, res) => {
  const { TR, Name, Darajah, Goal } = req.body;
  const { Branch, Gender } = req.session.user; // staff session

  try {
    await sql.connect(config);

    await new sql.Request()
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

    await sql.connect(config);
    const result = await new sql.Request()
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
  const { WaitingID, SlotID } = req.body;
  const { Branch, Gender } = req.session.user;

  try {
    await sql.connect(config);

    // 1️⃣ Fetch student from WaitingList
    const studentRes = await new sql.Request()
      .input('WaitingID', sql.Int, WaitingID)
      .query(`SELECT * FROM WaitingList WHERE WaitingID=@WaitingID`);
    
    if (!studentRes.recordset.length)
      return res.status(404).json({ success: false, message: "Student not found" });
    
    const stu = studentRes.recordset[0];

    // 2️⃣ Insert into Master
    await new sql.Request()
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
    await new sql.Request()
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
  const { Branch, Gender } = req.session.user; // from staff session

  try {
    await sql.connect(config);
    const result = await new sql.Request()
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
  const { Branch, Gender } = req.session.user;

  try {
    await sql.connect(config);
    const result = await new sql.Request()
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
    await sql.connect(config);
    await new sql.Request()
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


app.delete('/api/slots/:id', async (req, res) => {
  const SlotID = req.params.id;

  try {
    await sql.connect(config);
    await new sql.Request()
      .input('SlotID', sql.Int, SlotID)
      .query(`UPDATE Slots SET IsActive = 0 WHERE SlotID = @SlotID`);

    res.json({ success: true, message: 'Slot deactivated successfully' });
  } catch (err) {
    console.error('Delete slot error:', err);
    res.status(500).json({ success: false, message: 'Failed to delete slot' });
  }
});





//--------------------------------------------------------------------------------------------------------------------------


// app.delete('/api/delete-student/:TR', async (req, res) => {
//     const { TR } = req.params;

//     if (!TR) {
//         return res.status(400).json({ error: 'TR is required' });
//     }

//     try {
//         await sql.connect(config);
//         const request = new sql.Request();
//         request.input('TR', sql.Int, TR);
//         await request.query('DELETE FROM Master WHERE TR = @TR');
//         res.json({ message: 'Student deleted successfully' });
//     } catch (err) {
//         console.error('Error deleting student:', err.message);
//         res.status(500).json({ error: 'Failed to delete student' });
//     }
// });


app.put('/api/students/status/:TR', async (req, res) => {
  const { TR } = req.params;
  const { Status } = req.body; // 'Active' or 'Inactive'

  if (!TR || !Status) {
    return res.status(400).json({ error: 'TR and Status are required' });
  }

  try {
    await sql.connect(config);
    const request = new sql.Request();
    request.input('TR', sql.Int, TR);
    request.input('Status', sql.NVarChar(20), Status);

    await request.query(`
      UPDATE Master
      SET Status = @Status
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
        await sql.connect(config);

        // Get week start date
        const weekQuery = await new sql.Request()
            .input('WeekID', sql.Int, weekId)
            .query(`SELECT WeekStartDate FROM AttendanceWeek WHERE WeekID = @WeekID`);

        if (weekQuery.recordset.length === 0) {
            return res.status(404).json({ error: 'Week not found' });
        }

        const startDate = new Date(weekQuery.recordset[0].WeekStartDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Get attendance for the student
        const result = await new sql.Request()
            .input('WeekID', sql.Int, weekId)
            .input('TR', sql.Int, tr)
            .query(`
                SELECT 
                    M.TR,
                    M.Name,
                    DATENAME(WEEKDAY, A.CreatedAt) AS DayName
                FROM Master M
                LEFT JOIN Attendance A 
                    ON M.TR = A.TR AND A.WeekID = @WeekID AND A.IsPresent = 1
                WHERE M.TR = @TR
            `);

        const record = {
            TR: tr,
            Name: '',
            WeekStartDate: startDate,
            Monday: '',
            Tuesday: '',
            Wednesday: '',
            Thursday: '',
            Friday: '',
            Saturday: '',
            Sunday: ''
        };

        for (let row of result.recordset) {
            record.Name = row.Name;
            if (row.DayName) {
                record[row.DayName] = '✅';
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
        await sql.connect(config);
        const result = await new sql.Request().query(`
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
    await sql.connect(config);
    const result = await new sql.Request()
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


app.get('/api/weekly-attendance/:weekId', async (req, res) => {
    const { weekId } = req.params;
    const { Branch, Gender } = req.session.user;

    try {
        await sql.connect(config);

        // Fetch start date of the week
        const weekQuery = await new sql.Request()
            .input('WeekID', sql.Int, weekId)
            .query(`SELECT WeekStartDate FROM AttendanceWeek WHERE WeekID = @WeekID`);

        if (weekQuery.recordset.length === 0) {
            return res.status(404).json({ error: 'Week not found' });
        }

        const startDate = new Date(weekQuery.recordset[0].WeekStartDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Fetch all TRs + attendance for this week
        const attendanceQuery = await new sql.Request()
            .input('WeekID', sql.Int, weekId)
            .input('Branch', sql.NVarChar(50), Branch)
            .input('Gender', sql.NVarChar(10), Gender)
            .query(`
                SELECT 
                    M.TR,
                    M.Name,
                    DATENAME(WEEKDAY, A.CreatedAt) AS DayName,
                    A.CreatedAt
                FROM Master M
                LEFT JOIN Attendance A 
                    ON M.TR = A.TR AND A.WeekID = @WeekID AND A.IsPresent = 1
                WHERE M.Branch = @Branch AND M.Gender = @Gender AND M.Status = 'Active' 

            `);

        const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const resultMap = new Map();

        // Initialize map with all students
        for (let row of attendanceQuery.recordset) {
            const { TR, Name } = row;

            if (!resultMap.has(TR)) {
                const record = {
                    TR,
                    Name
                };

                for (let i = 0; i < 7; i++) {
                    const currentDate = new Date(startDate);
                    currentDate.setDate(startDate.getDate() + i);

                    const dayName = days[i];

                    if (currentDate > today) {
                        record[dayName] = '';
                    } else {
                        record[dayName] = 'Absent'; // Default to Absent
                    }
                }

                resultMap.set(TR, record);
            }
        }

        // Override ✅ present where applicable
        for (let row of attendanceQuery.recordset) {
            const { TR, DayName } = row;
            if (DayName && resultMap.has(TR)) {
                resultMap.get(TR)[DayName] = 'Present';
            }
        }

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
    await sql.connect(config);
    const result = await new sql.Request()
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
    await sql.connect(config);
    const request = new sql.Request();
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
    await sql.connect(config);
    const request = new sql.Request();
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

      return res.json({ success: true, role: Role });

    } else {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
  } catch (err) {
    console.error('Staff login error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});


// ------------------------------------------------------------------------------------------------------



// GET all users of admin's branch
app.get('/api/admin/users/:branch', async (req, res) => {
  const branch = req.params.branch;
  try {
    await sql.connect(config);
    const result = await sql.query`SELECT Username, Gender, Role FROM PassBank WHERE Branch = ${branch}`;
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ADD a new user
app.post('/api/admin/add-user', async (req, res) => {
  const { username, password, gender, role, branch } = req.body;
  try {
    await sql.connect(config);
    await sql.query`
      INSERT INTO PassBank (Username, Password, Gender, Role, Branch)
      VALUES (${username}, ${password}, ${gender}, ${role}, ${branch})
    `;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Add user failed' });
  }
});



// DELETE a user
app.delete('/api/admin/delete-user/:username', async (req, res) => {
  const username = req.params.username;
  try {
    await sql.connect(config);
    await sql.query`DELETE FROM PassBank WHERE Username = ${username}`;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Delete failed' });
  }
});


//---------------------------------------------------------------------------------------------------------------





app.post('/api/test-login', async (req, res) => {
    const { username, password } = req.body;

    try {
        const pool = await sql.connect();
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
    // ✅ Enforce login and session branch/gender
    if (!req.session.user || !req.session.user.Branch || !req.session.user.Gender) {
        return res.status(401).json({ error: 'Unauthorized access. Please log in.' });
    }

    const { Branch, Gender } = req.session.user;

    try {
        const pool = await sql.connect(config);

        const result = await pool.request()
            .input('Branch', sql.NVarChar(50), Branch)
            .input('Gender', sql.NVarChar(50), Gender)
            .query(`
                SELECT 
                    M.TR,
                    M.Name,
                    CASE 
                        WHEN A.IsPresent = 1 THEN 'Present'
                        WHEN A.IsPresent = 0 THEN 'Absent'
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

    // ✅ 1. Check session
    if (!req.session.user || !req.session.user.Branch || !req.session.user.Gender) {
        return res.status(401).json({ success: false, message: 'Unauthorized. Please log in.' });
    }

    const { Branch, Gender } = req.session.user;

    try {
        const pool = await sql.connect(config);

        // ✅ 2. Verify student is active and matches trainer's branch/gender
        const check = await pool.request()
            .input('TR', sql.Int, TR)
            .input('Branch', sql.NVarChar(50), Branch)
            .input('Gender', sql.NVarChar(50), Gender)
            .query(`
                SELECT 1 FROM Master
                WHERE TR = @TR AND Status = 'Active' AND Branch = @Branch AND Gender = @Gender
            `);

        if (check.recordset.length === 0) {
            return res.status(403).json({ success: false, message: 'TR not authorized or not active' });
        }

        // ✅ 3. Optional: Delete today's plan if already exists (overwrite behavior)
        await pool.request()
            .input('TR', sql.Int, TR)
            .query(`
                DELETE FROM TrainingPlan
                WHERE TR = @TR AND CONVERT(date, CreatedAt) = CONVERT(date, GETDATE())
            `);

        // ✅ 4. Insert new plan
        await pool.request()
            .input('TR', sql.Int, TR)
            .input('BodyParts', sql.NVarChar(200), BodyParts.join(', '))
            .input('Branch', sql.NVarChar(50), Branch)
            .input('Gender', sql.NVarChar(10), Gender)
            .query(`
                INSERT INTO TrainingPlan (TR, BodyParts, Branch, Gender)
                VALUES (@TR, @BodyParts, @Branch, @Gender)
            `);

        res.json({ success: true, message: 'Training plan logged successfully' });

    } catch (err) {
        console.error('❌ Error logging training plan:', err);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});


app.get('/api/student/training-plans', async (req, res) => {
    // ✅ Ensure student is logged in
    if (!req.session.user || !req.session.user.TR || !req.session.user.Branch || !req.session.user.Gender) {
        return res.status(401).json({ success: false, message: 'Unauthorized. Please log in.' });
    }

    const { TR, Branch, Gender } = req.session.user;

    try {
        const pool = await sql.connect(config);

        const result = await pool.request()
            .input('TR', sql.Int, TR)
            .input('Branch', sql.NVarChar(50), Branch)
            .input('Gender', sql.NVarChar(50), Gender)
            .query(`
                SELECT 
                    CONVERT(VARCHAR(10), CreatedAt, 120) AS LogDate,
                    BodyParts
                FROM TrainingPlan
                WHERE TR = @TR AND Branch = @Branch AND Gender = @Gender
                ORDER BY CreatedAt DESC
            `);

        res.json({ success: true, data: result.recordset });
    } catch (err) {
        console.error('❌ Error fetching student training plans:', err);
        res.status(500).json({ success: false, message: 'Failed to fetch student training plan history' });
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
        const pool = await sql.connect(config);

        // ✅ Only allow plans from same branch + gender
        const result = await pool.request()
            .input('TR', sql.Int, tr)
            .input('Branch', sql.NVarChar(50), Branch)
            .input('Gender', sql.NVarChar(50), Gender)
            .query(`
                SELECT 
                    CONVERT(VARCHAR(10), CreatedAt, 120) AS LogDate,
                    BodyParts
                FROM TrainingPlan
                WHERE TR = @TR AND Branch = @Branch AND Gender = @Gender
                ORDER BY CreatedAt DESC
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
        await sql.connect(config);
        const request = new sql.Request();
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

        const request = new sql.Request();
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
        const insertRequest = new sql.Request();
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



// app.post('/api/get-or-create-week', async (req, res) => {
//     try {
//         const today = new Date();
//         today.setHours(0, 0, 0, 0); // Normalize time

//         const request = new sql.Request();
//         request.input('Today', sql.Date, today);

//         // STEP 1: Check if today falls inside any existing week
//         const result = await request.query(`
//             SELECT * FROM AttendanceWeek 
//             WHERE @Today BETWEEN WeekStartDate AND WeekEndDate
//         `);

//         if (result.recordset.length > 0) {
//             // Week already exists for today
//             return res.json({ WeekID: result.recordset[0].WeekID });
//         }

//         // STEP 2: Today is not in any week — calculate next Monday
//         let monday = new Date(today);
//         const day = monday.getDay(); // 0 (Sun) to 6 (Sat)

//         if (day === 0) {
//             // If Sunday, move to next day (Monday)
//             monday.setDate(monday.getDate() + 1);
//         } else {
//             // Else go to next Monday
//             monday.setDate(monday.getDate() + (8 - day));
//         }

//         const sunday = new Date(monday);
//         sunday.setDate(monday.getDate() + 6); // End of week

//         // STEP 3: Insert new week
//         const insertRequest = new sql.Request();
//         insertRequest.input('WeekStartDate', sql.Date, monday);
//         insertRequest.input('WeekEndDate', sql.Date, sunday);

//         await insertRequest.query(`
//             INSERT INTO AttendanceWeek (WeekStartDate, WeekEndDate)
//             VALUES (@WeekStartDate, @WeekEndDate)
//         `);

//         const newWeekResult = await insertRequest.query(`
//             SELECT TOP 1 WeekID FROM AttendanceWeek 
//             WHERE WeekStartDate = @WeekStartDate AND WeekEndDate = @WeekEndDate
//             ORDER BY WeekID DESC
//         `);

//         return res.json({ message: 'New week created', WeekID: newWeekResult.recordset[0].WeekID });

//     } catch (err) {
//         console.error('Error creating/fetching week:', err);
//         res.status(500).json({ error: 'Failed to fetch or create week' });
//     }
// });





app.get('/api/current-tr', (req, res) => {
    if (!req.session.currentTR) {
        return res.status(401).json({ message: 'Not logged in' });
    }
    res.json({ tr: req.session.currentTR });
});

app.get('/api/logout', (req, res) => {
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
    await sql.connect(config);

    const result = await new sql.Request().query(`
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
        TRS.Grade
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

    const pool = await sql.connect(config);

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

    const pool = await sql.connect(config);

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

    const pool = await sql.connect(config);

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
    await sql.connect(config);
    const result = await new sql.Request()
      .input('Branch', sql.NVarChar(50), Branch)
      .input('Gender', sql.NVarChar(50), Gender)
      .query(`
        SELECT 
          TR,
          BodyParts,
          CreatedAt
        FROM TrainingPlan
        WHERE Branch = @Branch AND Gender = @Gender
        ORDER BY CreatedAt DESC
      `);

    res.json({ success: true, data: result.recordset });
  } catch (err) {
    console.error('Error fetching training plans:', err.message);
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
        const pool = await sql.connect(config);

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

        await sql.connect(config);
        const request = new sql.Request();
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



// 📥 Import CSV
const upload = multer({ dest: 'uploads/' });

app.post('/api/import-csv', upload.single('csv'), async (req, res) => {
    const results = [];
    const { Branch, Gender } = req.session.user;

    fs.createReadStream(req.file.path)
        .pipe(csv())    
        .on('data', data => results.push(data))
        .on('end', async () => {
            try {
                await sql.connect(config);
                for (const row of results) {
                    const request = new sql.Request();
                    await request
                        .input('TR', sql.VarChar, row.TR)
                        .input('Name', sql.VarChar, row.Name)
                        .input('Darajah', sql.VarChar, row.Darajah)
                        .input('Goal', sql.VarChar, row.Goal)
                        .input('Slot', sql.VarChar, row.Slot)
                        .input('Branch', sql.NVarChar(50), Branch)
                        .input('Gender', sql.NVarChar(10), Gender)
                        .query(`
                            INSERT INTO Master (TR, Name, Darajah, Goal, Slot, Branch, Gender)
                            VALUES (@TR, @Name, @Darajah, @Goal, @Slot, @Branch, @Gender)
                        `);
                }
                res.json({ message: 'CSV import successful' });
            } catch (err) {
                console.error(err);
                res.status(500).json({ error: 'Failed to import CSV' });
            } finally {
                fs.unlinkSync(req.file.path);
            }
        });
});

app.get('/api/students', async (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ error: 'User session missing' });
  }

  const { Branch, Gender } = req.session.user;

  if (!Branch || !Gender) {
    return res.status(400).json({ error: 'Branch or Gender missing in session user' });
  }

  try {
    await sql.connect(config);
    const request = new sql.Request();
    request.input('Branch', sql.NVarChar(50), Branch);
    request.input('Gender', sql.NVarChar(10), Gender);

    const result = await request.query(`
      SELECT 
        m.TR,
        m.Name,
        m.Darajah,
        m.Goal,
        m.Status,
        m.Gender,
        m.Branch,
        m.SlotID,
        s.SlotName
      FROM Master m
      LEFT JOIN Slots s ON m.SlotID = s.SlotID
      WHERE m.Branch = @Branch
        AND m.Gender = @Gender
        AND m.Status = 'Active'
    `);

    res.json({ success: true, data: result.recordset });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch students' });
  }
});



app.get('/api/students/inactive', async (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ error: 'User session missing' });
  }

  const { Branch: branch, Role } = req.session.user;

  try {
    await sql.connect(config);
    const request = new sql.Request();
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
    await sql.connect(config);
    const request = new sql.Request();

    request.input('TR', sql.Int, tr);
    request.input('Branch', sql.NVarChar(50), Branch);
    request.input('Gender', sql.NVarChar(10), Gender);
    request.input('Date', sql.Date, date);

    // Check if student exists in Master table under same Branch + Gender
    const studentCheck = await request.query(`
      SELECT * FROM Master  LEFT JOIN Slots s ON m.SlotID = s.SlotID WHERE TR = @TR AND Branch = @Branch AND Gender = @Gender
    `);

    if (studentCheck.recordset.length === 0) {
      return res.status(401).json({ success: false, error: 'Unauthorized: TR not found in your branch/gender' });
    }

    // Now fetch Attendance record (if any) for that date
    const result = await request.query(`
      SELECT AttendanceID, TR, WeekID, IsPresent, CreatedAt, Branch, Gender
      FROM Attendance
      WHERE TR = @TR 
        AND Branch = @Branch 
        AND Gender = @Gender
        AND CAST(CreatedAt AS DATE) = @Date
    `);

    if (result.recordset.length > 0) {
      return res.json({ success: true, record: result.recordset[0] });
    } else {
      // No record found (treat as Absent, but valid student)
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




app.put('/api/attendance-record', async (req, res) => {
  const { AttendanceID, TR, WeekID, IsPresent, CreatedAt } = req.body;
  const { Branch, Gender } = req.session.user;

  if (!Branch || !Gender) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }

  if (!TR || !CreatedAt || typeof IsPresent !== 'boolean') {
    return res.status(400).json({ success: false, error: 'Missing or invalid parameters' });
  }

  // // Validate CreatedAt date is within 7 days (attendance editable window)
  // const createdDate = new Date(CreatedAt);
  // const now = new Date();
  // const diffTime = now - createdDate;
  // const diffDays = diffTime / (1000 * 60 * 60 * 24);

  // if (diffDays > 7) {
  //   return res.status(403).json({ success: false, error: 'Attendance can only be edited within 7 days' });
  // }

  try {
    await sql.connect(config);
    const request = new sql.Request();

    if (AttendanceID) {
      // UPDATE existing attendance
      request.input('AttendanceID', sql.Int, AttendanceID);
      request.input('IsPresent', sql.Bit, IsPresent);

      const updateResult = await request.query(`
        UPDATE Attendance
        SET IsPresent = @IsPresent
        WHERE AttendanceID = @AttendanceID
      `);

      return res.json({ success: true, message: 'Attendance updated successfully' });
    } else {
      // INSERT new attendance record
      // We need WeekID - if not provided, try to calculate from CreatedAt date
      let weekId = WeekID;
      if (!weekId) {
        // Optional: fetch WeekID from AttendanceWeek based on CreatedAt
        const weekResult = await new sql.Request()
          .input('Date', sql.Date, CreatedAt)
          .query(`
            SELECT TOP 1 WeekID FROM AttendanceWeek
            WHERE @Date BETWEEN WeekStartDate AND WeekEndDate
          `);

        if (weekResult.recordset.length === 0) {
          return res.status(400).json({ success: false, error: 'Week not found for given date' });
        }
        weekId = weekResult.recordset[0].WeekID;
      }

      const insertRequest = new sql.Request();
      insertRequest.input('TR', sql.Int, TR);
      insertRequest.input('WeekID', sql.Int, weekId);
      insertRequest.input('IsPresent', sql.Bit, IsPresent);
      insertRequest.input('CreatedAt', sql.DateTime, CreatedAt);
      insertRequest.input('Branch', sql.NVarChar(50), Branch);
      insertRequest.input('Gender', sql.NVarChar(10), Gender);

      const insertResult = await insertRequest.query(`
        INSERT INTO Attendance (TR, WeekID, IsPresent, CreatedAt, Branch, Gender)
        VALUES (@TR, @WeekID, @IsPresent, @CreatedAt, @Branch, @Gender)
      `);

      return res.json({ success: true, message: 'Attendance inserted successfully' });
    }
  } catch (err) {
    console.error('Error updating attendance:', err);
    return res.status(500).json({ success: false, error: 'Failed to update attendance' });
  }
});





//-------------------------------------------------------------------------------------------
//--------------------------------- FITNESS TEST --------------------------------------------
//-------------------------------------------------------------------------------------------

// GET student info by TR
app.get('/api/testmaster/:tr', async (req, res) => {
    const tr = req.params.tr;
    try {
        await sql.connect(config);
        const result = await sql.query(`
            SELECT TR, ITS, Darajah, Age, Name, Hizb, Class, House, Check18, Email, DOB
            FROM TestMaster WHERE TR = ${tr}
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
        
        const pool = await sql.connect(config); // ✅ assign pool
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
        const pool = await sql.connect(config);
        const result = await pool.request()
            .input('TR', sql.Int, tr)
            .query('SELECT * FROM TestRecords WHERE TR = @TR ORDER BY TestLog DESC');

        res.status(200).json(result.recordset);
    } catch (err) {
        console.error("Error fetching test records:", err);
        res.status(500).json({ error: "Failed to fetch test records" });
    }
});


// code for install anything via terminal 
// Set-ExecutionPolicy RemoteSigned -Scope CurrentUser



// Start server
app.listen(port, '0.0.0.0', () => {
    console.log(`Server is running on http://localhost:${port}`);
});
