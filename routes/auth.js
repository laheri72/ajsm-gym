// routes/auth.js
const express = require('express');
const router = express.Router();
const { pool } = require('../utils/db.js');
const sql = require('mssql');
const bcrypt = require('bcrypt'); // All login routes need this

// --- Paste all the routes from the list below here ---

// 🧑‍🎓 Student Login Routes
router.post('/api/student-login', async (req, res, next) => {
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


router.post('/api/student/set-initial-password', async (req, res, next) => {
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

// ✅ REPLACED /api/student-session route (now merged)
router.get('/api/student-session', async (req, res) => {
  if (req.session.user && req.session.user.TR) {
    try {
      const { TR } = req.session.user;

      // New query that joins Master and Slots to get ALL data
      const result = await pool.request()
        .input('TR', sql.Int, TR)
        .query(`
          SELECT 
            M.FitnessLevel, 
            M.CurrentXP, 
            M.HasLoggedInBefore, 
            M.joinedAt,
            M.Darajah, 
            M.Goal, 
            M.Height,
            S.SlotName
          FROM Master M
          LEFT JOIN Slots S ON M.SlotID = S.SlotID
          WHERE M.TR = @TR
        `);

      if (result.recordset.length === 0) {
        return res.json({ success: false, error: "User profile not found in DB." });
      }

      // Merge the base session user (TR, Name, Branch, Gender)
      // with ALL the new data we just fetched from the database.
      const userProfile = {
        ...req.session.user,
        ...result.recordset[0] 
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


//---------👨‍💼 Staff & Trainer Login Routes


// REPLACE your old /api/trainer-login route
router.post('/api/trainer-login', async (req, res, next) => {
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
router.post('/api/staff-login', async (req, res, next) => {
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

// For the first-time password change modal
router.put('/api/staff/set-initial-password', async (req, res, next) => {
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


router.get('/api/session-user', (req, res) => {
  if (!req.session.user || !req.session.user.Branch || !req.session.user.Gender || !req.session.user.Role) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  res.json({
    success: true,
    user: req.session.user
  });
});


//---------🏋️ Fitness Test Login Route


// REPLACE your old /api/test-login route with this:
router.post('/api/test-login', async (req, res) => {
    const { username, password } = req.body; // username is TR, password is ITS or new pass

    try {
        const request = pool.request();
        // Use NVarChar for TR as it comes from a text box
        request.input('TR_Input', sql.NVarChar(50), username);
        
        // Fetch the student from TestMaster
        const result = await request.query(`
            SELECT TR, ITS, Password, IsFirstLogin 
            FROM TestMaster 
            WHERE TR = @TR_Input
        `);

        if (result.recordset.length === 0) {
            return res.status(401).json({ success: false, message: 'Invalid TR or password.' });
        }

        const student = result.recordset[0];
        let isLoginSuccessful = false;
        let forcePasswordChange = false;

        // Check if the student has a new password set
        if (student.Password) {
            // --- SCENARIO 1: Standard Login ---
            // User has a password, compare it
            const match = await bcrypt.compare(password, student.Password);
            if (match) {
                isLoginSuccessful = true;
                // Check if they are *still* flagged for a first login (shouldn't happen, but good check)
                forcePasswordChange = student.IsFirstLogin; 
            }
        } else {
            // --- SCENARIO 2: First-Time Login (Legacy) ---
            // No password set, check if `password` matches their `ITS` number
            if (password === student.ITS.toString()) {
                isLoginSuccessful = true;
                forcePasswordChange = true; // This is the key flag to force a change
            }
        }

        // --- Handle Login Result ---
        if (isLoginSuccessful) {
            // Login successful. Store the authenticated TR in the session.
            req.session.user = { TR: student.TR };
            
            // Send back the forcePasswordChange flag
            return res.json({ success: true, forcePasswordChange });
        } else {
            // Login failed
            return res.status(401).json({ success: false, message: 'Invalid TR or password.' });
        }

    } catch (err) {
        console.error('Test Login Error:', err);
        res.status(500).json({ success: false, message: 'Server error during login.' });
    }
});


// ------------- 🚪 General Logout Route

router.post('/api/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      return res.status(500).json({ success: false, message: 'Failed to logout' });
    }
    res.clearCookie('connect.sid'); // Optional: clear the session cookie
    res.json({ success: true, message: 'Logged out successfully' });
  });
});


// --- End of routes ---

module.exports = router; // Export the router