// routes/student.js
const express = require('express');
const router = express.Router();
const { pool } = require('../utils/db.js');
const sql = require('mssql');
const moment = require('moment-timezone'); // This file needs moment

// Helper functions from server.js will go here
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



// =================================================================== //
// --- 🏆 ACHIEVEMENT PROGRESS API (THE "GAME MODE" ENGINE) ---
// =================================================================== //

// This single API calculates and returns the student's live progress for all achievements.


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


// --- Paste all the routes from the list below here ---

// ---- 📈 Main Dashboard & Stats (XP, Level, Tips)


router.get('/api/student/achievements/progress', async (req, res) => {
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

// ---leaderboards 

router.get('/api/leaderboard', async (req, res, next) => {
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



//---🏋️ Weight & Height Logging (Progression Tab)

// Logs a new weight entry for the current student
router.post('/api/student/log-weight', async (req, res) => {
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


// Gets all ad-hoc weight logs for the current student
router.get('/api/student/weight-history', async (req, res) => {
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


// Deletes a specific weight log entry, ensuring it belongs to the logged-in student
router.delete('/api/student/log-weight/:id', async (req, res) => {
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

// Saves/updates the student's height
router.post('/api/student/set-height', async (req, res) => {
    if (!req.session.user || !req.session.user.TR) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    const { TR } = req.session.user;
    const { heightInCm } = req.body;

    const heightInM = parseFloat(heightInCm) / 100;

    if (!heightInM || heightInM <= 0 || heightInM > 3) { // Basic validation (3m = 9'10")
        return res.status(400).json({ success: false, message: 'Invalid height. Please enter a valid height in cm.' });
    }

    try {
        await pool.request()
            .input('TR', sql.Int, TR)
            .input('Height', sql.Decimal(4, 2), heightInM)
            .query(`UPDATE Master SET Height = @Height WHERE TR = @TR`);

        res.json({ success: true, message: 'Height updated!', newHeight: heightInM });
    } catch (err) {
        console.error('Error setting height:', err);
        res.status(500).json({ success: false, message: 'Database error' });
    }
});

// Now combines data from TestRecords AND WeightTracking for a complete chart
router.get('/api/student/fitness-test-history', async (req, res) => {
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


// ---------- 📅 Workout Planner (Planner Tab)


router.post('/api/save-workout-plan', async (req, res) => {
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


router.get('/api/student/workout-plan', async (req, res) => {
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



router.post('/api/student/apply-last-week', async (req, res) => {
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


// --------- 📊 Workout Logs (Logs Tab)

router.get('/api/student/training-plans', async (req, res) => {
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

router.get('/api/student/training-analytics', async (req, res) => {
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


// API for the Workout Consistency Heatmap
router.get('/api/student/workout-calendar', async (req, res) => {
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


// Replace the entire /api/student/session-analytics - with this new sequential version
router.get('/api/student/session-analytics', async (req, res) => {
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


// --- 📋 Attendance (Attendance Tab)


// REPLACE your old /api/student-attendance/:weekId/me route

router.get('/api/student-attendance/:weekId/me', async (req, res, next) => {
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


router.get('/api/student/eligible-weeks', async (req, res, next) => {
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


//--- 🍃 Leave Management (Leaves Tab)

// ✅ GET: Fetch a student's leave history, current month status, and remaining leaves
router.get('/api/student/leaves', async (req, res) => {
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
router.post('/api/student/leaves', async (req, res) => {
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
router.delete('/api/student/leaves/:id', async (req, res) => {
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


//--- 🏆 Hall of Fame (Fame Tab)

/**
 * HALL OF FAME LEADERBOARD
 * Ranks students by the number of achievements earned, filtered by branch/gender.
 */
router.get('/api/achievements/leaderboard', async (req, res) => {
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

router.get('/api/student/achievements', async (req, res) => {
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

// --- End of routes ---

module.exports = router; // Export the router