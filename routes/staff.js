// routes/staff.js
const express = require('express');
const router = express.Router();
const { pool } = require('../utils/db.js');
const sql = require('mssql');
const moment = require('moment-timezone');

// Helper functions will go here


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


// --- Paste all the routes from the list below here ---


//---👟 Trainer Dashboard Routes


router.get('/api/daily-attendance', async (req, res) => {
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

// API to get all students currently checked in (active sessions)
router.get('/api/active-sessions', async (req, res) => {
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


router.get('/api/verify-tr/:tr', async (req, res) => {
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


router.get('/api/training-plans/:tr', async (req, res) => {
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


// ✅ Checkout API with XP integration (existing logic preserved)
router.post('/api/checkout', async (req, res) => {
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


// UPDATED: Fetches students ONLY for the trainer's branch/gender
router.get('/api/students-list', async (req, res) => {
    // Get trainer's info from session
    const { Branch, Gender } = req.session.user || {};
    if (!Branch || !Gender) {
        return res.status(401).json({ error: 'Unauthorized. Session missing branch or gender.' });
    }

    try {
        const request = pool.request();
        request.input('Branch', sql.NVarChar(50), Branch);
        request.input('Gender', sql.NVarChar(10), Gender);

        const result = await request.query(`
            SELECT 
                TR AS value, 
                Name + ' (' + CAST(TR AS NVARCHAR(10)) + ')' AS label 
            FROM TestMaster
            -- Filter by trainer's section
            WHERE Branch = @Branch AND Gender = @Gender
            ORDER BY Name
        `);
        res.json(result.recordset);
    } catch (err) {
        console.error('Error fetching student list:', err);
        res.status(500).json({ error: 'Failed to fetch student list' });
    }
});

// --- End of routes ---

// UPDATED: Fetches student details, verifies branch/gender, uses current schema
router.get('/api/testmaster/:tr', async (req, res) => {
    // Check if logged-in user is a Trainer
    if (req.session.user?.Role !== 'Trainer') {
        return res.status(403).json({ error: 'Forbidden. Trainers only.' });
    }

    // Get trainer's info
    const { Branch: trainerBranch, Gender: trainerGender } = req.session.user;
    if (!trainerBranch || !trainerGender) {
        return res.status(401).json({ error: 'Unauthorized. Session missing branch or gender.' });
    }

    const { tr } = req.params;

    try {
        const request = pool.request();
        request.input('TR', sql.Int, tr);
        request.input('TrainerBranch', sql.NVarChar(50), trainerBranch);
        request.input('TrainerGender', sql.NVarChar(10), trainerGender);

        const result = await request.query(`
            SELECT 
                TR, 
                ITS, 
                Name, 
                Darajah, 
                CONVERT(varchar, DOB, 23) AS DOB, -- DOB is needed for Age calculation
                Branch, 
                Gender
            FROM TestMaster 
            WHERE TR = @TR 
              AND Branch = @TrainerBranch -- Verify student belongs to trainer
              AND Gender = @TrainerGender
        `);

        if (result.recordset.length === 0) {
            // Student not found OR doesn't belong to this trainer's section
            return res.status(404).json({ error: 'Student not found in your section.' });
        }

        res.json(result.recordset[0]); // Return the student data

    } catch (err) {
        console.error('❌ Error fetching TestMaster by TR for trainer:', err);
        res.status(500).json({ error: 'Failed to fetch student data' });
    }
});


// UPDATED: Saves multiple test records submitted by a trainer
router.post('/api/trainer-test-records', async (req, res) => {
    // Check role and session
    if (req.session.user?.Role !== 'Trainer') {
        return res.status(403).json({ error: 'Forbidden. Trainers only.' });
    }
    const { Branch: trainerBranch, Gender: trainerGender } = req.session.user;
    if (!trainerBranch || !trainerGender) {
        return res.status(401).json({ error: 'Unauthorized. Session missing branch or gender.' });
    }

    const records = req.body; // Array of test records from frontend
    if (!Array.isArray(records) || records.length === 0) {
        return res.status(400).json({ error: 'Request body must be a non-empty array.' });
    }

    const transaction = new sql.Transaction(pool);
    try {
        await transaction.begin();

        // --- Validation Step ---
        const studentTRs = records.map(r => r.TR);
        const validationRequest = new sql.Request(transaction);
        validationRequest.input('TrainerBranch', sql.NVarChar(50), trainerBranch);
        validationRequest.input('TrainerGender', sql.NVarChar(10), trainerGender);
        
        // Prepare parameters for IN clause
        const trParams = studentTRs.map((tr, i) => `@TR${i}`);
        studentTRs.forEach((tr, i) => validationRequest.input(`TR${i}`, sql.Int, tr));

        const validationResult = await validationRequest.query(`
            SELECT TR, Branch, Gender 
            FROM TestMaster 
            WHERE TR IN (${trParams.join(',')})
        `);
        
        // Create a map for easy lookup
        const studentDetailsMap = new Map();
        validationResult.recordset.forEach(s => studentDetailsMap.set(s.TR, { Branch: s.Branch, Gender: s.Gender }));

        // Check if all students belong to the trainer's section
        for (const record of records) {
            const details = studentDetailsMap.get(parseInt(record.TR));
            if (!details || details.Branch !== trainerBranch || details.Gender !== trainerGender) {
                 await transaction.rollback(); // Abort early
                 return res.status(403).json({ error: `Student TR ${record.TR} does not belong to your section or was not found.` });
            }
            // Store fetched Branch/Gender in the record for insertion
            record.Branch = details.Branch;
            record.Gender = details.Gender;
        }
        // --- End Validation ---


        // --- Insertion Step ---
        const insertQuery = `
            INSERT INTO TestRecords 
            (TR, Weight, Height, Waist, Hips, Neck, BMI, BMIStatus, 
             BodyFat, BMR, CalorieIntake, VO2Max, Total, Grade, 
             Branch, Gender, SubmittedBy) -- Added Branch, Gender; Removed DOB, Age
            VALUES 
            (@TR, @Weight, @Height, @Waist, @Hips, @Neck, @BMI, @BMIStatus, 
             @BodyFat, @BMR, @CalorieIntake, @VO2Max, @Total, @Grade,
             @Branch, @Gender, @SubmittedBy) -- Added Branch, Gender
        `;

        for (const record of records) {
            // Create a new request for each insert within the transaction
            const request = new sql.Request(transaction); 
            
            // Input parameters (no Age/DOB, yes Branch/Gender)
            request.input('TR', sql.Int, record.TR);
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
            request.input('Branch', sql.NVarChar(50), record.Branch); // Use fetched Branch
            request.input('Gender', sql.NVarChar(10), record.Gender); // Use fetched Gender
            request.input('SubmittedBy', sql.NVarChar(50), 'Trainer'); // Explicitly set

            await request.query(insertQuery);

            // Award XP for each student
             await awardXP(record.TR, 150, transaction); 
        }

        await transaction.commit();
        res.status(200).json({ message: `${records.length} test records saved successfully.` });

    } catch (err) {
        console.error("Error saving trainer test records:", err);
        if (transaction && transaction._aborted === false && transaction._rolledBack === false) {
             try { await transaction.rollback(); } catch (rbErr) { console.error("Rollback failed:", rbErr); }
        }
        res.status(500).json({ error: "Server error during bulk insert. " + err.message });
    }
});



router.post('/api/get-or-create-week', async (req, res) => {
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



router.post('/api/attendance-manual', async (req, res) => {
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


// ✅ Log Training Plan API with XP integration
router.post('/api/log-training-plan', async (req, res) => {
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

// A new, more powerful search endpoint
router.get('/api/student-lookup/:query', async (req, res) => {
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


router.get('/api/all-test-records', async (req, res) => {
  // 1. Get Branch and Gender from the logged-in staff's session
  const { Branch, Gender } = req.session.user || {};

  // 2. Validate session
  if (!Branch || !Gender) {
    return res.status(401).json({ 
      success: false, 
      message: 'Unauthorized. Session is missing branch or gender.' 
    });
  }

  try {
    // 3. Create a parameterized request
    const request = pool.request();
    request.input('Branch', sql.NVarChar(50), Branch);
    request.input('Gender', sql.NVarChar(10), Gender);

    // 4. Update the SQL query to filter and calculate Age
    const result = await request.query(`
      SELECT 
        TRS.CreatedAt AS CreatedAt,
        TRS.TR,
        TMS.Name,
        
        /* Age is calculated dynamically based on test date and DOB */
        DATEDIFF(year, TMS.DOB, TRS.CreatedAt) AS Age, 
        
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
      
      /* Securely filters by the staff's Branch and Gender */
      WHERE TRS.Branch = @Branch AND TRS.Gender = @Gender
      ORDER BY TRS.CreatedAt DESC
    `);

    res.json({ success: true, data: result.recordset });
  } catch (err) {
    console.error('Error fetching all test records:', err.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});


//======================================================
// ----------- ➕ Student Entry & Waiting List Routes
//======================================================

router.get('/api/waiting-list', async (req, res) => {
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

// ➕ Add Student (always goes to WaitingList)
router.post('/api/add-student', async (req, res) => {
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



// ➕ Assign WaitingList Student to a Slot
router.post('/api/assign-student-slot', async (req, res) => {


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

// MODIFIED VALIDATION ENDPOINT
router.post('/api/bulk-validate-students', async (req, res) => {
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

// Receives a pre-validated list of students and performs a bulk insert.
router.post('/api/bulk-commit-students', async (req, res) => {
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



//=============================================================
//==============🕒 Slot Management Routes ====================
//=============================================================



router.post('/api/slots', async (req, res) => {
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


router.get('/api/slots', async (req, res) => {
 

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


// CORRECTED VERSION
router.delete('/api/slots/:id', async (req, res) => {
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

        // Step 2: permanently delete the slot itself
        await request.query(`
            DELETE FROM Slots WHERE SlotID = @SlotID;
        `);

        await transaction.commit();
        res.json({ success: true, message: 'Slot deactivated and all students unassigned.' });
    } catch (err) {
        await transaction.rollback();
        console.error('Slot deletion transaction error:', err.message);
        res.status(500).json({ success: false, message: 'Failed to deactivate slot.' });
    }
});

//===========================================================================
//====================📋 Staff Attendance Routes (from attendance.js)=======
//=========================================================================

router.get('/api/attendance-record/:tr/:date', async (req, res) => {
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



router.put('/api/attendance-record', async (req, res, next) => {
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
router.post('/api/attendance/bulk-leave', async (req, res) => {
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



router.get('/api/weeks', async (req, res) => {
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



router.get('/api/weekly-attendance/:weekId', async (req, res, next) => {
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


//======================================================
// ----------- 🍃 Staff Leave Management Routes
//======================================================

// ✅ GET: Fetch all PENDING and ON HOLD leave requests for the staff's branch/gender
router.get('/api/staff/leaves/pending', async (req, res) => {
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
router.put('/api/staff/leaves/:id/status', async (req, res) => {
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
router.get('/api/staff/leaves/history', async (req, res) => {
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

// ---------------overview-----------------------------------------------------------------------

router.get('/api/overview-stats', async (req, res) => {
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


// ======================================================================================= //
// --- Student Profile APIS ---
// ======================================================================================= //
// Add this new route to your server.js file

router.get('/api/staff/student-search', async (req, res) => {
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

router.get('/api/staff/student-profile/:tr', async (req, res) => {
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


//===================================================================
//================= 📊 Staff Progress/Analytics Routes ==============
//===================================================================


router.get('/api/staff/progress-page-data', async (req, res) => {
    // Session check (same as your other staff routes)
    if (!req.session.user || !req.session.user.Branch || !req.session.user.Gender) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    const { Branch, Gender } = req.session.user;

    // Use a transaction for consistency, although reads don't strictly need it
    const transaction = new sql.Transaction(pool);
    try {
        await transaction.begin();
        const request = new sql.Request(transaction); // Use one request object within the transaction
        request.input('Branch', sql.NVarChar(50), Branch);
        request.input('Gender', sql.NVarChar(50), Gender);

        // --- Execute all 6 queries ---

        // Query 1: Activity Summary (Modified slightly for transaction)
        const activitySummaryQuery = `
            DECLARE @WeekStart DATE = DATEADD(wk, DATEDIFF(wk, 7, DATEADD(MINUTE, 330, GETUTCDATE())), 0);
            DECLARE @PrevWeekStart DATE = DATEADD(wk, -1, @WeekStart);
            SELECT TOP 1 B.Name AS mostTrainedBodyPart FROM TrainingLog L
            JOIN TrainingPlan P ON L.PlanID = P.PlanID
            JOIN BodyParts B ON L.BodyPartID = B.BodyPartID
            WHERE P.Branch = @Branch AND P.Gender = @Gender AND P.CreatedAt >= @WeekStart
            GROUP BY B.Name ORDER BY COUNT(*) DESC;
            SELECT
                (SELECT COUNT(*) FROM TrainingPlan WHERE Branch = @Branch AND Gender = @Gender AND CreatedAt >= @WeekStart) as workoutsThisWeek,
                (SELECT COUNT(*) FROM TrainingPlan WHERE Branch = @Branch AND Gender = @Gender AND CreatedAt BETWEEN @PrevWeekStart AND @WeekStart) as workoutsLastWeek;
        `;
        const activitySummaryResult = await request.query(activitySummaryQuery);

        // Query 2: Body Part Trends
        const bodyPartTrendsQuery = `
            SELECT B.Name as bodyPart, COUNT(L.LogID) as count
            FROM TrainingLog L
            JOIN TrainingPlan P ON L.PlanID = P.PlanID
            JOIN BodyParts B ON L.BodyPartID = B.BodyPartID
            WHERE P.Branch = @Branch AND P.Gender = @Gender
            GROUP BY B.Name ORDER BY count DESC;
        `;
        const bodyPartTrendsResult = await request.query(bodyPartTrendsQuery);

        // Query 3: Duration Summary
        const durationSummaryQuery = `
            DECLARE @WeekStart DATE = DATEADD(wk, DATEDIFF(wk, 7, DATEADD(MINUTE, 330, GETUTCDATE())), 0);
            SELECT
                (SELECT ISNULL(AVG(CAST(DurationInMinutes AS FLOAT)), 0) FROM Attendance WHERE Branch = @Branch AND Gender = @Gender AND DurationInMinutes IS NOT NULL) as avgDuration,
                (SELECT TOP 1 S.SlotName FROM Attendance A JOIN Master M ON A.TR = M.TR JOIN Slots S ON M.SlotID = S.SlotID WHERE A.Branch = @Branch AND A.Gender = @Gender AND A.DurationInMinutes IS NOT NULL GROUP BY S.SlotName ORDER BY SUM(A.DurationInMinutes) DESC) as busiestSlot,
                (SELECT ISNULL(SUM(DurationInMinutes) / 60.0, 0) FROM Attendance WHERE Branch = @Branch AND Gender = @Gender AND CreatedAt >= @WeekStart) as totalHoursThisWeek;
        `;
        const durationSummaryResult = await request.query(durationSummaryQuery);

        // Query 4: Peak Hours
        const peakHoursQuery = `
            SELECT DATEPART(hour, DATEADD(MINUTE, 330, CreatedAt)) AS hour, COUNT(*) AS count
            FROM Attendance
            WHERE Branch = @Branch AND Gender = @Gender AND IsPresent = 1
              AND MONTH(DATEADD(MINUTE, 330, CreatedAt)) = MONTH(DATEADD(MINUTE, 330, GETUTCDATE()))
              AND YEAR(DATEADD(MINUTE, 330, CreatedAt)) = YEAR(DATEADD(MINUTE, 330, GETUTCDATE()))
            GROUP BY DATEPART(hour, DATEADD(MINUTE, 330, CreatedAt)) ORDER BY hour ASC;
        `;
        const peakHoursResult = await request.query(peakHoursQuery);

        // Query 5: All Training Plans
        const allTrainingPlansQuery = `
            SELECT P.TR, M.Name, P.CreatedAt, STRING_AGG(B.Name, ', ') AS BodyParts
            FROM TrainingPlan P
            JOIN Master M ON P.TR = M.TR
            JOIN TrainingLog L ON P.PlanID = L.PlanID
            JOIN BodyParts B ON L.BodyPartID = B.BodyPartID
            WHERE P.Branch = @Branch AND P.Gender = @Gender
            GROUP BY P.PlanID, P.TR, M.Name, P.CreatedAt ORDER BY P.CreatedAt DESC;
        `;
        const allTrainingPlansResult = await request.query(allTrainingPlansQuery);

        // Query 6: Engagement Report
        const engagementReportQuery = `
            WITH LastVisit AS (SELECT TR, MAX(CreatedAt) as lastVisitDate FROM Attendance GROUP BY TR)
            SELECT M.Name, ISNULL(SUM(A.DurationInMinutes) / 60.0, 0) as TotalHours, ISNULL(AVG(CAST(A.DurationInMinutes AS FLOAT)), 0) as AvgDuration, DATEDIFF(day, LV.lastVisitDate, DATEADD(MINUTE, 330, GETUTCDATE())) as DaysSinceLastVisit
            FROM Master M
            LEFT JOIN Attendance A ON M.TR = A.TR
            LEFT JOIN LastVisit LV ON M.TR = LV.TR
            WHERE M.Status = 'Active' AND M.Branch = @Branch AND M.Gender = @Gender
            GROUP BY M.Name, LV.lastVisitDate;
        `;
        const engagementReportResult = await request.query(engagementReportQuery);

        await transaction.commit(); // Commit after all reads are successful

        // --- Structure the combined response ---
        res.json({
            success: true,
            data: {
                activitySummary: {
                    mostTrained: activitySummaryResult.recordsets[0][0]?.mostTrainedBodyPart || 'N/A',
                    workoutsThisWeek: activitySummaryResult.recordsets[1][0].workoutsThisWeek,
                    workoutsLastWeek: activitySummaryResult.recordsets[1][0].workoutsLastWeek
                },
                bodyPartTrends: bodyPartTrendsResult.recordset,
                durationSummary: {
                    avgDuration: durationSummaryResult.recordset[0].avgDuration,
                    busiestSlot: durationSummaryResult.recordset[0].busiestSlot || 'N/A',
                    totalHoursThisWeek: durationSummaryResult.recordset[0].totalHoursThisWeek
                },
                peakHours: peakHoursResult.recordset,
                allTrainingPlans: allTrainingPlansResult.recordset,
                engagementReport: engagementReportResult.recordset
            }
        });

    } catch (err) {
        if (transaction.active) await transaction.rollback(); // Rollback on error
        console.error('Error fetching combined progress page data:', err);
        res.status(500).json({ success: false, message: 'Failed to load progress data.' });
    }
});


// API to get a ranked summary of students by a specific body part workout
router.get('/api/staff/workout-summary-by-bodypart', async (req, res) => {
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



// API for the Goal Alignment data table
router.get('/api/staff/goal-alignment', async (req, res) => {
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



//===================================================================
//================= 🧑‍🎓 Active Student Record Routes  ==============
//===================================================================



// This is likely the route for your Active Students table
router.get('/api/students', async (req, res) => {
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


// Update student's slot
router.put('/api/change-student-slot', async (req, res) => {
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
router.put('/api/change-student-goal', async (req, res) => {
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


router.put('/api/slots/:id', async (req, res) => {
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



// Secret key for cron job authentication (use the same strong key as before)
const CRON_SECRET_KEY_WEEK = process.env.CRON_SECRET_WEEK || 'AjsmGetWeek'; // Or your preferred key

router.post('/api/cron/create-next-week', async (req, res) => { // Renamed for clarity
    // --- Corrected Security Check ---
    const providedKey = req.headers['x-internal-secret'] || req.query.secret;
    if (providedKey !== CRON_SECRET_KEY_WEEK) {
        console.warn('⚠️ Unauthorized attempt to run create-next-week task.');
        return res.status(403).json({ success: false, message: 'Forbidden: Invalid secret key.' });
    }
    // --- End Security Check ---

    console.log('Received scheduled request to check/create upcoming week...');
    const transaction = new sql.Transaction(pool);
    try {
        await transaction.begin();
        const request = transaction.request();

// REPLACE this section in your /api/cron/create-next-week endpoint

        // --- Calculate THIS week's dates ---
        // 'startOf('isoWeek')' when run on Monday gives THIS Monday's date.
        const thisMonday = moment.tz("Asia/Kolkata").startOf('isoWeek');
        const thisSunday = thisMonday.clone().endOf('isoWeek'); // Gets Sunday of the same week
        const weekStartStr = thisMonday.format('YYYY-MM-DD');
        const weekEndStr = thisSunday.format('YYYY-MM-DD');
        // --- End Calculation ---


        // Input the calculated dates for checking and potential insertion
        request.input('WeekStartDate', sql.Date, weekStartStr);
        request.input('WeekEndDate', sql.Date, weekEndStr);

        // --- Check specifically for the calculated NEXT week ---
        const checkResult = await request.query(`
            SELECT 1 FROM AttendanceWeek WHERE WeekStartDate = @WeekStartDate
        `);

        if (checkResult.recordset.length === 0) {
            // Week doesn't exist, create it using the calculated dates
            await request.query(`
                INSERT INTO AttendanceWeek (WeekStartDate, WeekEndDate)
                VALUES (@WeekStartDate, @WeekEndDate)
            `);
            await transaction.commit();
            console.log(`✅ Cron Job: Created AttendanceWeek record for ${weekStartStr} to ${weekEndStr}`);
            // Use 201 Created status code
            res.status(201).json({ success: true, message: `Created week: ${weekStartStr}` });
        } else {
            // Week already exists, do nothing
            await transaction.rollback(); // Rollback empty transaction
            console.log(`❕ Cron Job: AttendanceWeek record for ${weekStartStr} already exists.`);
            // Use 200 OK status code
            res.status(200).json({ success: true, message: `Week ${weekStartStr} already exists.` });
        }
    } catch (err) {
        if (transaction.active) await transaction.rollback(); // Rollback on error
        console.error('❌ Error in scheduled create-next-week API:', err);
        res.status(500).json({ success: false, message: 'Internal server error during week creation.' });
    }
});





module.exports = router; // Export the router