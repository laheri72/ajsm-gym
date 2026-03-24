// routes/staff.js
const express = require('express');
const router = express.Router();
const { pool } = require('../utils/db.js');
const sql = require('mssql');
const moment = require('moment-timezone');

function decodeHtmlEntities(input = '') {
    return String(input)
        .replace(/&nbsp;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/&#39;/gi, "'")
        .replace(/&quot;/gi, '"');
}

function stripHtmlToText(input = '') {
    const withBreaks = String(input)
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p>/gi, '\n')
        .replace(/<\/li>/gi, '\n')
        .replace(/<li[^>]*>/gi, '- ');
    return decodeHtmlEntities(withBreaks.replace(/<[^>]+>/g, ''));
}

function parsePlannerContentForTrainer(content = '') {
    const raw = String(content || '').trim();
    if (!raw) {
        return { items: [], notes: '', displayText: '' };
    }

    try {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object' && Array.isArray(parsed.items)) {
            const items = parsed.items
                .map((item) => ({
                    exercise: String(item.exercise || '').trim(),
                    bodyPart: String(item.bodyPart || '').trim(),
                    sets: item.sets ?? null,
                    reps: String(item.reps || '').trim()
                }))
                .filter((item) => item.exercise || item.bodyPart);

            const lines = items.map((item) => {
                const primary = item.exercise || `${item.bodyPart} Focus`;
                const meta = [item.sets ? `${item.sets} sets` : '', item.reps ? `${item.reps} reps` : '']
                    .filter(Boolean)
                    .join(' • ');
                return meta ? `${primary} (${meta})` : primary;
            });

            return {
                items,
                notes: String(parsed.notes || '').trim(),
                displayText: lines.join('\n')
            };
        }
    } catch (_) {
        // legacy content
    }

    const displayText = stripHtmlToText(raw)
        .split(/\r?\n/)
        .map((s) => s.trim())
        .filter(Boolean)
        .join('\n');

    return { items: [], notes: '', displayText };
}

// Helper functions will go here
const isStaffOrAdmin = (req, res, next) => {
    if (!req.session.user) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    if (req.session.user.Role !== 'Staff' && req.session.user.Role !== 'Admin') {
        return res.status(403).json({ success: false, message: 'Forbidden: Staff/Admin access required.' });
    }

    next();
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
                SELECT BestStreak FROM TestMaster WHERE TR = @TR;
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
        .query(`SELECT TotalMinutesLogged FROM TestMaster WHERE TR = @TR`);

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


//---👟 Trainer Dashboard Routes


router.get('/api/daily-attendance', async (req, res) => {
    if (!req.session.user || !req.session.user.Branch || !req.session.user.Gender) {
        return res.status(401).json({ error: 'Unauthorized access. Please log in.' });
    }

    const { Branch, Gender } = req.session.user;
    const { SlotID } = req.query; // Get SlotID from query parameters

    try {
        // --- ✅ REFINED LOGIC ---
        // 1. Define the start and end of the current day in the IST timezone.
        const startOfTodayIST = moment.tz("Asia/Kolkata").startOf('day');
        const endOfTodayIST = moment.tz("Asia/Kolkata").endOf('day');

        // 2. Convert these IST boundaries to UTC, as the database stores time in UTC.
        const startUTC = startOfTodayIST.utc().toDate();
        const endUTC = endOfTodayIST.utc().toDate();
        // --- END REFINEMENT ---

        let query = `
                SELECT 
                    M.TR,
                    M.Name,
                    CASE 
                        WHEN A.OnLeave = 1 THEN 'On Leave'
                        WHEN A.IsPresent = 1 THEN 'Present'
                        ELSE 'Absent'
                    END AS IsPresentToday
                FROM TestMaster M
                LEFT JOIN Attendance A
                    ON M.TR = A.TR 
                    -- 4. Find attendance records that fall within the UTC range of the IST day.
                    AND A.CreatedAt BETWEEN @StartUTC AND @EndUTC
                WHERE M.Status = 'Active'
                AND M.Branch = @Branch
                AND M.Gender = @Gender
        `;

        const request = pool.request()
            .input('Branch', sql.NVarChar(50), Branch)
            .input('Gender', sql.NVarChar(50), Gender)
            .input('StartUTC', sql.DateTime, startUTC)
            .input('EndUTC', sql.DateTime, endUTC);

        if (SlotID) {
            query += ` AND M.SlotID = @SlotID`;
            request.input('SlotID', sql.Int, SlotID);
        }

        query += ` ORDER BY M.Name`;

        const result = await request.query(query);

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
                JOIN TestMaster M ON A.TR = M.TR
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
            FROM TestMaster m
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
        // Update total minutes in TestMaster table
        await request.input('TR_Update', sql.Int, TR)
            .input('Duration_Update', sql.Int, duration)
            .query('UPDATE TestMaster SET TotalMinutesLogged = TotalMinutesLogged + @Duration_Update WHERE TR = @TR_Update');


        // --- ✅ NEW XP Integration (10 XP per minute) ---
        const xpToAward = duration * 10; // ← Each minute gives 10 XP
        const levelUpInfo = await awardXP(TR, xpToAward, transaction);

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
            awardedXP: xpToAward, // ← Added for clarity
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


// =================================================================== //
// === UPDATE EXISTING: /api/trainer-test-records WITH TRAINERID ===== //
// =================================================================== //

router.post('/api/trainer-test-records', async (req, res) => {
    // Check role and session
    if (req.session.user?.Role !== 'Trainer') {
        return res.status(403).json({ error: 'Forbidden. Trainers only.' });
    }

    const { UserID, Branch: trainerBranch, Gender: trainerGender } = req.session.user;

    if (!trainerBranch || !trainerGender || !UserID) {
        return res.status(401).json({ error: 'Unauthorized. Session missing data.' });
    }

    const records = req.body; // Array of test records
    if (!Array.isArray(records) || records.length === 0) {
        return res.status(400).json({ error: 'Request body must be a non-empty array.' });
    }

    const transaction = new sql.Transaction(pool);

    try {
        await transaction.begin();

        // ===== 0. GET TrainerID from Trainers table =====
        const trainerQuery = new sql.Request(transaction);
        trainerQuery.input('UserID', sql.Int, UserID);
        const trainerResult = await trainerQuery.query(`
            SELECT TrainerID FROM Trainers WHERE UserID = @UserID
        `);

        if (trainerResult.recordset.length === 0) {
            await transaction.rollback();
            return res.status(400).json({ error: "Trainer profile not found in Trainers table." });
        }

        const TrainerID = trainerResult.recordset[0].TrainerID;


        // ===== 1. FIND ACTIVE BATCH =====
        const batchRequest = new sql.Request(transaction);
        batchRequest.input('Branch', sql.NVarChar(50), trainerBranch);
        batchRequest.input('Gender', sql.NVarChar(10), trainerGender);

        const batchResult = await batchRequest.query(`
            SELECT BatchID FROM EvaluationBatches 
            WHERE Branch = @Branch AND Gender = @Gender AND IsActive = 1
        `);

        let activeBatchID = null;
        if (batchResult.recordset.length > 0) {
            activeBatchID = batchResult.recordset[0].BatchID;
        }

        // ===== 2. VALIDATE EACH TR STUDENT BELONGS TO TRAINER SECTION =====
        const studentTRs = records.map(r => r.TR);
        const validationRequest = new sql.Request(transaction);
        studentTRs.forEach((tr, i) => validationRequest.input(`TR${i}`, sql.Int, tr));
        validationRequest.input('TrainerBranch', sql.NVarChar(50), trainerBranch);
        validationRequest.input('TrainerGender', sql.NVarChar(10), trainerGender);

        const trParams = studentTRs.map((tr, i) => `@TR${i}`).join(',');

        const validationResult = await validationRequest.query(`
            SELECT TR, Branch, Gender FROM TestMaster 
            WHERE TR IN (${trParams})
        `);

        const map = new Map();
        validationResult.recordset.forEach(s => {
            map.set(s.TR, { Branch: s.Branch, Gender: s.Gender });
        });

        for (const r of records) {
            const d = map.get(parseInt(r.TR));
            if (!d || d.Branch !== trainerBranch || d.Gender !== trainerGender) {
                await transaction.rollback();
                return res.status(403).json({ error: `Student TR ${r.TR} does not belong to your section.` });
            }
            r.Branch = d.Branch;
            r.Gender = d.Gender;
        }


        // ========== 3. INSERT RECORDS (WITH TRAINERID NOW) ========== //
        const insertQuery = `
            INSERT INTO TestRecords 
            (TR, Weight, Height, Waist, Hips, Neck, BMI, BMIStatus, BodyFat, BMR, CalorieIntake,
             VO2Max, Total, Grade, Branch, Gender, SubmittedBy, BatchID, TrainerID)
            OUTPUT INSERTED.TestLog
            VALUES 
            (@TR, @Weight, @Height, @Waist, @Hips, @Neck, @BMI, @BMIStatus, @BodyFat, @BMR, @CalorieIntake,
             @VO2Max, @Total, @Grade, @Branch, @Gender, 'Trainer', @BatchID, @TrainerID)
        `;

        for (const record of records) {
            const request = new sql.Request(transaction);

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
            request.input('BatchID', sql.Int, activeBatchID ?? null);
            request.input('Branch', sql.NVarChar(50), record.Branch);
            request.input('Gender', sql.NVarChar(10), record.Gender);
            request.input('TrainerID', sql.Int, TrainerID);

            const insertResult = await request.query(insertQuery);
            const TestLog = insertResult.recordset[0].TestLog;

            const activityRequest = new sql.Request(transaction);
            activityRequest.input('TestLog', sql.Int, TestLog);
            activityRequest.input('PushUps', sql.SmallInt, record.PushUps);
            activityRequest.input('SitUps', sql.SmallInt, record.SitUps);
            activityRequest.input('Squats', sql.SmallInt, record.Squats);
            activityRequest.input('SitAndReach', sql.SmallInt, record.SitReach);
            activityRequest.input('StepUpPulseRate', sql.SmallInt, record.PulseRate);

            await activityRequest.query(`
                INSERT INTO TestActivityLog 
                (TestLog, PushUps, SitUps, Squats, SitAndReach, StepUpPulseRate)
                VALUES (@TestLog, @PushUps, @SitUps, @Squats, @SitAndReach, @StepUpPulseRate)
            `);

            await awardXP(record.TR, 750, transaction);
        }

        await transaction.commit();
        res.status(200).json({ message: `${records.length} test records saved successfully.` });

    } catch (err) {
        console.error("Error saving trainer test records:", err);
        try { await transaction.rollback(); } catch {}
        res.status(500).json({ error: "Server error during bulk insert." });
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
            .query(`SELECT 1 FROM TestMaster WHERE TR = @TR AND Status = 'Active' AND Branch = @Branch AND Gender = @Gender`);

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
    const { TR, BodyParts, Exercises } = req.body || {};
    const { Branch, Gender } = req.session.user || {};

    if (!TR || !Array.isArray(BodyParts) || BodyParts.length === 0) {
        return res.status(400).json({ success: false, message: 'TR and BodyParts[] are required.' });
    }

    const safeBodyParts = [...new Set(
        BodyParts
            .map((name) => String(name || '').trim())
            .filter(Boolean)
    )];

    if (!safeBodyParts.length) {
        return res.status(400).json({ success: false, message: 'BodyParts[] must include at least one valid value.' });
    }

    const safeExercises = Array.isArray(Exercises) ? Exercises.slice(0, 50) : [];
    const toInt = (value) => (Number.isFinite(Number(value)) ? Number(value) : null);

    const transaction = new sql.Transaction(pool);
    try {
        await transaction.begin();

        // Step 1: Insert session header into TrainingPlan
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

        // Step 2: Keep legacy body-part logging for existing analytics and dashboards.
        for (const partName of safeBodyParts) {
            const insertResult = await new sql.Request(transaction)
                .input('PlanID', sql.Int, newPlanID)
                .input('PartName', sql.NVarChar(50), partName)
                .query(`
                    INSERT INTO TrainingLog (PlanID, BodyPartID)
                    SELECT @PlanID, BodyPartID FROM BodyParts WHERE Name = @PartName;
                `);

            if (!insertResult.rowsAffected[0]) {
                throw new Error(`Unknown body part: ${partName}`);
            }
        }

        // Step 3: Optional V2 exercise-level execution logging (only if V2 tables exist).
        let loggedExerciseCount = 0;
        if (safeExercises.length > 0) {
            const v2SupportResult = await new sql.Request(transaction).query(`
                SELECT
                    CASE
                        WHEN OBJECT_ID('dbo.PerformanceLogs', 'U') IS NOT NULL
                         AND OBJECT_ID('dbo.Exercises', 'U') IS NOT NULL
                        THEN 1 ELSE 0
                    END AS IsSupported;
            `);
            const isV2Supported = Boolean(v2SupportResult.recordset[0]?.IsSupported);

            if (isV2Supported) {
                for (const exercise of safeExercises) {
                    if (!exercise || typeof exercise !== 'object') continue;

                    const exerciseID = toInt(exercise.exerciseID ?? exercise.ExerciseID ?? exercise.exerciseId);
                    const plannedID = toInt(exercise.plannedID ?? exercise.PlannedID ?? exercise.plannedId);
                    const setNumber = toInt(exercise.setNumber ?? exercise.SetNumber);
                    const repsPerformed = toInt(exercise.repsPerformed ?? exercise.RepsPerformed ?? exercise.reps);
                    const durationMinutes = toInt(exercise.durationMinutes ?? exercise.DurationMinutes);
                    const rpe = toInt(exercise.rpe ?? exercise.RPE);
                    const weightUsed = Number.isFinite(Number(exercise.weightUsed ?? exercise.WeightUsed))
                        ? Number(exercise.weightUsed ?? exercise.WeightUsed)
                        : null;
                    const isPR = Boolean(exercise.isPR ?? exercise.IsPR);
                    const completedAt = exercise.completedAt ?? exercise.CompletedAt ?? null;
                    const exerciseName = String(
                        exercise.exerciseName ??
                        exercise.ExerciseName ??
                        exercise.name ??
                        ''
                    ).trim();
                    const bodyPartName = String(
                        exercise.bodyPart ??
                        exercise.BodyPart ??
                        ''
                    ).trim();

                    const insertPerformanceResult = await new sql.Request(transaction)
                        .input('PlanID', sql.Int, newPlanID)
                        .input('TR', sql.Int, TR)
                        .input('Branch', sql.NVarChar(50), Branch)
                        .input('Gender', sql.NVarChar(10), Gender)
                        .input('PlannedID', sql.Int, plannedID)
                        .input('ExerciseID', sql.Int, exerciseID)
                        .input('ExerciseName', sql.NVarChar(100), exerciseName)
                        .input('BodyPartName', sql.NVarChar(50), bodyPartName)
                        .input('SetNumber', sql.Int, setNumber)
                        .input('RepsPerformed', sql.Int, repsPerformed)
                        .input('WeightUsed', sql.Decimal(10, 2), weightUsed)
                        .input('DurationMinutes', sql.Int, durationMinutes)
                        .input('RPE', sql.Int, rpe)
                        .input('IsPR', sql.Bit, isPR)
                        .input('CompletedAt', sql.DateTime, completedAt)
                        .query(`
                            DECLARE @ResolvedExerciseID INT = @ExerciseID;
                            DECLARE @InsertedPerformance INT = 0;

                            IF @ResolvedExerciseID IS NULL AND LEN(LTRIM(RTRIM(ISNULL(@ExerciseName, '')))) > 0
                            BEGIN
                                SELECT TOP 1 @ResolvedExerciseID = E.ExerciseID
                                FROM dbo.Exercises E
                                WHERE E.Name = @ExerciseName
                                ORDER BY E.ExerciseID DESC;

                                IF @ResolvedExerciseID IS NULL AND LEN(LTRIM(RTRIM(ISNULL(@BodyPartName, '')))) > 0
                                BEGIN
                                    DECLARE @ResolvedBodyPartID INT;
                                    SELECT TOP 1 @ResolvedBodyPartID = B.BodyPartID
                                    FROM dbo.BodyParts B
                                    WHERE B.Name = @BodyPartName;

                                    IF @ResolvedBodyPartID IS NOT NULL
                                    BEGIN
                                        INSERT INTO dbo.Exercises (Name, BodyPartID, Difficulty, IsActive, CreatedAt)
                                        VALUES (@ExerciseName, @ResolvedBodyPartID, 'Beginner', 1, GETDATE());
                                        SET @ResolvedExerciseID = SCOPE_IDENTITY();
                                    END
                                END
                            END

                            IF @ResolvedExerciseID IS NOT NULL
                            BEGIN
                                INSERT INTO dbo.PerformanceLogs (
                                    PlanID, PlannedID, ExerciseID, SetNumber, RepsPerformed, WeightUsed,
                                    DurationMinutes, RPE, IsPR, CompletedAt, Branch, Gender, TR
                                )
                                VALUES (
                                    @PlanID,
                                    @PlannedID,
                                    @ResolvedExerciseID,
                                    @SetNumber,
                                    @RepsPerformed,
                                    @WeightUsed,
                                    @DurationMinutes,
                                    @RPE,
                                    @IsPR,
                                    COALESCE(@CompletedAt, GETDATE()),
                                    @Branch,
                                    @Gender,
                                    @TR
                                );
                                SET @InsertedPerformance = 1;
                            END

                            SELECT @InsertedPerformance AS InsertedPerformance;
                        `);

                    loggedExerciseCount += Number(insertPerformanceResult.recordset[0]?.InsertedPerformance || 0);
                }
            }
        }

        // Step 4: XP integration
        const xpToAward = 10 + (safeBodyParts.length > 1 ? (safeBodyParts.length - 1) * 3 : 0);
        const levelUpInfo = await awardXP(TR, xpToAward, transaction);

        await transaction.commit();

        res.json({
            success: true,
            message: 'Training plan logged successfully',
            planID: newPlanID,
            loggedBodyParts: safeBodyParts.length,
            loggedExercises: loggedExerciseCount,
            levelUpInfo
        });

    } catch (err) {
        if (transaction._aborted === false) {
            await transaction.rollback();
        }
        console.error('Error logging training plan:', err);
        res.status(500).json({ success: false, message: err.message || 'Internal server error' });
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
        SELECT TR FROM TestMaster 
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
    TRS.SubmittedBy,

    -- 🆕 New fields from TestActivityLog
    TAL.PushUps,
    TAL.SitUps,
    TAL.Squats,
    TAL.SitAndReach,
    TAL.StepUpPulseRate

  FROM TestRecords TRS
  JOIN TestMaster TMS ON TRS.TR = TMS.TR
  LEFT JOIN TestActivityLog TAL ON TRS.TestLog = TAL.TestLog

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

//======================================================
// ----------- ➕ Student Entry & Waiting List Routes
//======================================================

router.get('/api/recent-activations', async (req, res) => {
  try {
    if (!req.session.user) {
      return res.status(401).json({ error: "Unauthorized: No session user" });
    }

    const { Branch, Gender } = req.session.user;
    
    // Define the boundaries for "Today" in IST
    const startOfTodayIST = moment.tz("Asia/Kolkata").startOf('day').utc().toDate();

    const result = await pool.request()
      .input('Branch', sql.NVarChar(50), Branch)
      .input('Gender', sql.NVarChar(10), Gender)
      .input('TodayStart', sql.DateTime, startOfTodayIST)
      .query(`
        SELECT M.TR, M.Name, M.Darajah, M.JoinedAt, M.Goal, S.SlotName
        FROM TestMaster M
        LEFT JOIN Slots S ON M.SlotID = S.SlotID
        WHERE M.Branch = @Branch 
          AND M.Gender = @Gender 
          AND M.Status = 'Active'
          AND M.JoinedAt >= @TodayStart
        ORDER BY M.JoinedAt DESC
      `);

    res.json(result.recordset);
  } catch (err) {
    console.error("Error fetching recent activations:", err);
    res.status(500).json({ error: "Failed to load recent activations" });
  }
});

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
        SELECT WL.WaitingID, WL.TR, WL.Name, WL.Darajah, WL.RequestedAt, WL.Goal, WL.PreferredSlotID AS SlotID
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

// ➕ Add Student (Direct Entry / Activation)
router.post('/api/add-student', async (req, res) => {
    try {
        if (!req.session.user) {
            return res.status(401).json({ success: false, error: 'Unauthorized. Please log in.' });
        }

        const { TR, preview, Goal, SlotID, ITS, Name, Darajah } = req.body;
        const { Branch, Gender } = req.session.user;

        if (!Branch || !Gender) {
            return res.status(401).json({ success: false, message: 'Unauthorized. Session missing branch or gender.' });
        }

        const trInt = parseInt(TR, 10);
        if (!TR || Number.isNaN(trInt)) {
            return res.status(400).json({ success: false, message: 'TR is required' });
        }

        // 1️⃣ Check if student exists in TestMaster
        let studentResult = await pool.request()
            .input('TR', sql.Int, trInt)
            .query(`SELECT Name, Darajah, Status, Branch, Gender FROM TestMaster WHERE TR = @TR`);

        let student = studentResult.recordset[0];

        // Ensure branch/gender match if they exist
        if (student && (student.Branch !== Branch || student.Gender !== Gender)) {
             return res.status(400).json({ success: false, message: `Student belongs to ${student.Branch} - ${student.Gender}` });
        }

        // Optional "preview" mode for UI auto-fill
        if (preview) {
            if (student) {
                if (student.Status === 'Active') {
                     return res.status(400).json({ success: false, message: 'Student is already Active' });
                }
                return res.json({
                    success: true,
                    canAdd: true,
                    student: { Name: student.Name, Darajah: student.Darajah, Status: student.Status }
                });
            } else {
                 return res.status(404).json({ success: false, message: 'Student not found in TestMaster, need input' });
            }
        }

        const slotIdInt = SlotID ? parseInt(SlotID, 10) : null;

        // 2️⃣ If student does not exist, insert them as new
        if (!student) {
            if (!ITS || !Name || !Darajah) {
                 return res.status(400).json({ success: false, message: 'Student is new. ITS, Name, and Darajah are required.' });
            }
            
            await pool.request()
                .input('TR', sql.Int, trInt)
                .input('ITS', sql.BigInt, parseInt(ITS, 10))
                .input('Name', sql.NVarChar(100), Name)
                .input('Darajah', sql.NVarChar(50), Darajah)
                .input('Branch', sql.VarChar(7), Branch)
                .input('Gender', sql.VarChar(6), Gender)
                .input('Status', sql.VarChar(8), slotIdInt ? 'Active' : 'Inactive')
                .input('SlotID', sql.Int, slotIdInt)
                .input('Goal', sql.VarChar(50), Goal || null)
                .query(`
                    INSERT INTO TestMaster (TR, ITS, Name, Darajah, Branch, Gender, Status, SlotID, JoinedAt, Goal)
                    VALUES (@TR, @ITS, @Name, @Darajah, @Branch, @Gender, @Status, @SlotID, 
                            CASE WHEN @Status = 'Active' THEN GETDATE() ELSE NULL END, @Goal)
                `);
        } else {
            // Update existing student
            await pool.request()
                .input('TR', sql.Int, trInt)
                .input('Status', sql.VarChar(8), slotIdInt ? 'Active' : student.Status)
                .input('SlotID', sql.Int, slotIdInt || null)
                .input('Goal', sql.VarChar(50), Goal || null)
                .input('Name', sql.NVarChar(100), Name || student.Name)
                .input('Darajah', sql.NVarChar(50), Darajah || student.Darajah)
                .query(`
                    UPDATE TestMaster 
                    SET Status = @Status, 
                        SlotID = @SlotID, 
                        JoinedAt = CASE WHEN @Status = 'Active' AND JoinedAt IS NULL THEN GETDATE() ELSE JoinedAt END,
                        Goal = @Goal,
                        Name = @Name,
                        Darajah = @Darajah
                    WHERE TR = @TR
                `);
        }

        res.json({ success: true, message: slotIdInt ? 'Student activated successfully.' : 'Student record updated.' });

    } catch (err) {
        if (err.message && err.message.includes('Violation of UNIQUE KEY constraint')) {
            return res.status(400).json({ success: false, message: 'ITS number already exists for another student.' });
        }
        console.error('Add student error:', err);
        res.status(500).json({ success: false, message: 'Failed to add student. ' + (err.message || '') });
    }
});



// ➕ Assign WaitingList Student to a Slot
router.post('/api/assign-student-slot', async (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ success: false, error: 'Unauthorized. Please log in.' });
    }

    const { WaitingID, SlotID } = req.body;
    const waitingIdInt = parseInt(WaitingID, 10);
    const slotIdInt = parseInt(SlotID, 10);

    if (!waitingIdInt || !slotIdInt) {
        return res.status(400).json({ success: false, message: 'Missing data' });
    }

    const { Branch, Gender } = req.session.user;
    if (!Branch || !Gender) {
        return res.status(401).json({ success: false, message: 'Unauthorized. Session missing branch or gender.' });
    }

    const transaction = new sql.Transaction(pool);
    try {
        await transaction.begin();
        const request = new sql.Request(transaction);

        // 1️⃣ Get TR from WaitingList (scoped)
        const waiting = await request
            .input('WaitingID', sql.Int, waitingIdInt)
            .input('Branch', sql.NVarChar(50), Branch)
            .input('Gender', sql.NVarChar(10), Gender)
            .query(`
                SELECT TR
                FROM WaitingList
                WHERE WaitingID = @WaitingID AND Branch = @Branch AND Gender = @Gender
            `);

        if (waiting.recordset.length === 0) {
            await transaction.rollback();
            return res.status(404).json({ success: false, message: 'Waiting entry not found' });
        }

        const TR = waiting.recordset[0].TR;

        // 2️⃣ Verify student exists + not active
        const studentRes = await request
            .input('TR', sql.Int, TR)
            .query(`
                SELECT Status
                FROM TestMaster
                WHERE TR = @TR AND Branch = @Branch AND Gender = @Gender
            `);

        if (studentRes.recordset.length === 0) {
            await transaction.rollback();
            return res.status(404).json({ success: false, message: 'Student not found in TestMaster' });
        }

        if (studentRes.recordset[0].Status === 'Active') {
            await transaction.rollback();
            return res.status(400).json({ success: false, message: 'Student already assigned to gym' });
        }

        // 3️⃣ Activate in TestMaster
        await request
            .input('SlotID', sql.Int, slotIdInt)
            .query(`
                UPDATE TestMaster
                SET
                    Status = 'Active',
                    SlotID = @SlotID,
                    JoinedAt = GETDATE()
                WHERE TR = @TR AND Branch = @Branch AND Gender = @Gender
            `);

        // 4️⃣ Remove from WaitingList
        await request.query(`
            DELETE FROM WaitingList
            WHERE WaitingID = @WaitingID AND Branch = @Branch AND Gender = @Gender
        `);

        await transaction.commit();
        res.json({ success: true, message: "Student assigned to slot" });

    } catch (err) {
        if (transaction._aborted === false) {
            await transaction.rollback();
        }
        console.error("Assign student error:", err);
        res.status(500).json({ success: false, message: "Failed to assign student" });
    }
});

// routes/staff.js

// ... (after your /api/assign-student-slot route) ...

// ❌ NEW: Delete a student from the Waiting List
router.delete('/api/waiting-list/:id', async (req, res) => {
    // 1. Check for user session
    if (!req.session.user) {
        return res.status(401).json({ success: false, message: 'Unauthorized.' });
    }
    
    const { id } = req.params; // This is the WaitingID
    const { Branch, Gender } = req.session.user; // Get staff's scope

    try {
        const request = pool.request();
        request.input('WaitingID', sql.Int, id);
        request.input('Branch', sql.NVarChar(50), Branch);
        request.input('Gender', sql.NVarChar(10), Gender);
        
        // 2. Execute delete, scoped to the staff's branch/gender
        const result = await request.query(`
            DELETE FROM WaitingList 
            WHERE WaitingID = @WaitingID 
            AND Branch = @Branch 
            AND Gender = @Gender
        `);

        // 3. Check if a row was actually deleted
        if (result.rowsAffected[0] > 0) {
            res.json({ success: true, message: 'Student removed from waiting list.' });
        } else {
            // This means no row was found (already deleted, or wrong branch)
            res.status(404).json({ success: false, message: 'Student not found or not in your assigned branch.' });
        }
    } catch (err) {
        console.error('Delete waiting list error:', err);
        res.status(500).json({ success: false, message: 'Server error while deleting student.' });
    }
});

// ... (rest of your staff.js file) ...
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
            const { TR, Name, Darajah } = student;
            if (!TR || !Name || !Darajah) {
                let reason = "Missing required fields.";
                if (!TR) reason = "Missing TR.";
                else if (!Name) reason = "Missing Name.";
                else if (!Darajah) reason = "Missing Darajah.";
                
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
        
        const result = await request.query(`SELECT TR FROM TestMaster WHERE TR IN (${params.join(',')})`);
        
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
                const trParam = `TR${index}`, nameParam = `Name${index}`, darajahParam = `Darajah${index}`;
                
                request.input(trParam, sql.Int, student.TR);
                request.input(nameParam, sql.NVarChar(100), student.Name);
                request.input(darajahParam, sql.NVarChar(50), student.Darajah);

                valuesClauses.push(`(@${trParam}, @${nameParam}, @${darajahParam}, @Branch, @Gender)`);
            });
            
            // Add Branch and Gender once, as they are the same for the whole batch
            request.input('Branch', sql.NVarChar(50), Branch);
            request.input('Gender', sql.NVarChar(10), Gender);
            
            const query = `
                INSERT INTO WaitingList (TR, Name, Darajah, Branch, Gender)
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
        LEFT JOIN TestMaster m ON s.SlotID = m.SlotID AND m.Status = 'Active'
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
            UPDATE TestMaster SET SlotID = NULL WHERE SlotID = @SlotID;
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
        const studentCheck = await request.query(`SELECT 1 FROM TestMaster WHERE TR = @TR AND Branch = @Branch AND Gender = @Gender`);
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
                SELECT TR FROM TestMaster 
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
                FROM TestMaster M
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
            UPDATE TestMaster
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
                JOIN TestMaster M ON L.TR = M.TR
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
                JOIN TestMaster M ON L.TR = M.TR
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
                    (SELECT COUNT(*) FROM TestMaster WHERE Status = 'Active' AND Branch = @Branch AND Gender = @Gender) AS activeStudents,
                    (SELECT COUNT(*) FROM TestMaster WHERE Status = 'Inactive' AND Branch = @Branch AND Gender = @Gender) AS inactiveStudents,
                    (SELECT COUNT(*) FROM Slots WHERE IsActive = 1 AND Branch = @Branch AND Gender = @Gender) AS slots,
                    
                    (SELECT COUNT(T.TestLog) FROM TestRecords T JOIN TestMaster M ON T.TR = M.TR WHERE M.Branch = @Branch AND M.Gender = @Gender) AS fitnessTests,
                    
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
                FROM TestMaster
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
            .query(`SELECT 1 FROM TestMaster WHERE TR = @TR AND Branch = @Branch AND Gender = @Gender`);
        
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
            pool.request().input('TR', sql.Int, tr).query(`SELECT M.TR, M.Name, M.Status, M.Goal, M.Darajah, M.JoinedAt, M.FitnessLevel, M.CurrentXP, S.SlotName FROM TestMaster M LEFT JOIN Slots S ON M.SlotID = S.SlotID WHERE M.TR = @TR;`),
            
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
                (SELECT TOP 1 S.SlotName FROM Attendance A JOIN TestMaster M ON A.TR = M.TR JOIN Slots S ON M.SlotID = S.SlotID WHERE A.Branch = @Branch AND A.Gender = @Gender AND A.DurationInMinutes IS NOT NULL GROUP BY S.SlotName ORDER BY SUM(A.DurationInMinutes) DESC) as busiestSlot,
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
            JOIN TestMaster M ON P.TR = M.TR
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
            FROM TestMaster M
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
                FROM TestMaster M
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
                FROM TestMaster M
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
                    M.[SlotID],
                    S.[SlotName],
                    S.[IsActive]
                FROM
                    [TestMaster] AS M
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
             (SELECT COUNT(*) FROM TestMaster WHERE SlotID = s.SlotID AND Status = 'Active') AS Assigned
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
      UPDATE TestMaster
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
            UPDATE TestMaster
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
        WHERE @MaxCapacity >= (SELECT COUNT(*) FROM TestMaster WHERE SlotID=@SlotID AND Status='Active')

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

// =================================================================== //
// --- 🩺 EVALUATOR (Doctor/Nutritionist) API Routes (FINAL) ---
// =================================================================== //

/**
 * Helper middleware to check if the user is an Evaluator.
 * (This is a NEW, simpler middleware)
 */
const isEvaluator = async (req, res, next) => {
    // 1. Check session
    if (!req.session.user || req.session.user.Role !== 'Evaluator') {
        return res.status(403).json({ success: false, message: 'Forbidden: Access restricted to evaluators.' });
    }
    
    // 2. ★★★ NEW: Get the EvaluatorID from their UserID ★★★
    try {
        const result = await pool.request()
            .input('UserID', sql.Int, req.session.user.UserID)
            .query('SELECT EvaluatorID FROM Evaluators WHERE UserID = @UserID');

        if (result.recordset.length === 0) {
            // This should not happen because login creates a profile, but it's a good safety check.
            return res.status(403).json({ success: false, message: 'Evaluator profile not found.' });
        }
        
        // 3. Attach all info to the request object for other routes to use
        req.EvaluatorID = result.recordset[0].EvaluatorID; // The critical new ID
        req.Branch = req.session.user.Branch;
        req.Gender = req.session.user.Gender;
        req.Username = req.session.user.Username;
        next();

    } catch (err) {
        console.error('Error in isEvaluator middleware:', err);
        return res.status(500).json({ success: false, message: 'Server error authorizing evaluator.' });
    }
};

/**
 * 1. GET: Fetches the evaluator's own profile
 */
router.get('/api/evaluator/profile', isEvaluator, async (req, res) => {
    try {
        const result = await pool.request()
            .input('EvaluatorID', sql.Int, req.EvaluatorID)
            .query('SELECT Name, Profession, Contact, Email FROM Evaluators WHERE EvaluatorID = @EvaluatorID');
        
        res.json({ success: true, data: result.recordset[0] });
    } catch (err) {
        console.error('Error fetching evaluator profile:', err);
        res.status(500).json({ success: false, message: 'Failed to fetch profile.' });
    }
});

/**
 * 2. POST: Updates the evaluator's own profile
 */
router.post('/api/evaluator/profile', isEvaluator, async (req, res) => {
    const { Name, Profession, Contact, Email } = req.body;

    if (!Name || !Profession) {
        return res.status(400).json({ success: false, message: 'Name and Profession are required.' });
    }
    
    try {
        await pool.request()
            .input('EvaluatorID', sql.Int, req.EvaluatorID)
            .input('Name', sql.NVarChar(100), Name)
            .input('Profession', sql.NVarChar(100), Profession)
            .input('Contact', sql.NVarChar(100), Contact || null)
            .input('Email', sql.NVarChar(100), Email || null)
            .query(`
                UPDATE Evaluators 
                SET Name = @Name, Profession = @Profession, Contact = @Contact, Email = @Email
                WHERE EvaluatorID = @EvaluatorID
            `);
        
        res.json({ success: true, message: 'Profile updated!' });
    } catch (err) {
        console.error('Error updating evaluator profile:', err);
        res.status(500).json({ success: false, message: 'Failed to update profile.' });
    }
});

/**
 * 3. GET: Fetch Batch Counts
 * (Updated to use the new "Evaluations" table for status)
 */
router.get('/api/evaluation/batches', isEvaluator, async (req, res) => {
    try {
        const request = pool.request();
        request.input('Branch', sql.NVarChar(50), req.Branch);
        request.input('Gender', sql.NVarChar(10), req.Gender);

        const result = await request.query(`
            -- 1. Get all Trainer-submitted records
            WITH TrainerRecords AS (
                SELECT TestLog, BatchID
                FROM TestRecords
                WHERE SubmittedBy = 'Trainer'
                  AND Branch = @Branch
                  AND Gender = @Gender
            ),
            -- 2. Check their evaluation status
            RecordStatus AS (
                SELECT 
                    tr.BatchID,
                    -- Status Logic:
                    -- 'In Progress' if ANY comment exists, 'Pending' if not
                    CASE
                        WHEN EXISTS (SELECT 1 FROM Evaluations e WHERE e.LogID = tr.TestLog) THEN 'In Progress'
                        ELSE 'Pending'
                    END AS Status
                FROM TrainerRecords tr
            )
            -- 3. Group by BatchID and count
            SELECT 
                rs.BatchID,
                ISNULL(eb.BatchName, 'Unbatched Records') AS BatchName,
                eb.IsActive,
                COUNT(*) AS TotalCount,
                COUNT(CASE WHEN Status = 'In Progress' THEN 1 END) AS PartialCount, -- Using this field for "In Progress"
                COUNT(CASE WHEN Status = 'Pending' THEN 1 END) AS PendingCount,
                0 AS CompletedCount -- We removed this for now
            FROM RecordStatus rs
            LEFT JOIN EvaluationBatches eb ON rs.BatchID = eb.BatchID
            GROUP BY rs.BatchID, eb.BatchName, eb.IsActive
            ORDER BY eb.IsActive DESC, eb.BatchName ASC;
        `);
        res.json({ success: true, data: result.recordset });
    } catch (err) {
        console.error('Error fetching evaluation batches:', err);
        res.status(500).json({ success: false, message: 'Failed to fetch evaluation batches.' });
    }
});

/**
 * 4. GET: Fetch Batch Details
 * (Updated to use the new "Evaluations" table for status)
 */
router.get('/api/evaluation/batch-details/:batchID', isEvaluator, async (req, res) => {
    const { batchID } = req.params; 
    try {
        const request = pool.request();
        request.input('Branch', sql.NVarChar(50), req.Branch);
        request.input('Gender', sql.NVarChar(10), req.Gender);

        let query = `
            SELECT 
                tr.TestLog, tr.TR, tm.Darajah, tm.Name, tr.Grade, tr.CreatedAt,
                -- New 2-Stage Status Logic
                CASE
                    WHEN EXISTS (SELECT 1 FROM Evaluations e WHERE e.LogID = tr.TestLog) THEN 'In Progress'
                    ELSE 'Pending'
                END AS CommentStatus
            FROM TestRecords tr
            JOIN TestMaster tm ON tr.TR = tm.TR
            WHERE tr.Branch = @Branch
              AND tr.Gender = @Gender
              AND tr.SubmittedBy = 'Trainer'
        `;
        if (batchID === 'null') {
            query += ' AND tr.BatchID IS NULL';
        } else {
            request.input('BatchID', sql.Int, batchID);
            query += ' AND tr.BatchID = @BatchID';
        }
        query += ' ORDER BY CommentStatus ASC, tr.CreatedAt DESC;';
        
        const result = await request.query(query);
        res.json({ success: true, data: result.recordset });
    } catch (err) {
        console.error('Error fetching batch details:', err);
        res.status(500).json({ success: false, message: 'Failed to fetch batch details.' });
    }
});

/**
 * 5. GET: Get ALL Data for the Comment Entry Page
 * (★★★ UPDATED: Fixed subquery/race-condition bug ★★★)
 */
router.get('/api/evaluation/comment-details/:testLog', isEvaluator, async (req, res) => {
    const { testLog } = req.params;
    try {
        const request = new sql.Request(pool);
        request.input('TestLog', sql.Int, testLog);

        // --- 1. Run the FIRST query to get the current record and TR ---
        const currentRecordResult = await request.query(`
            SELECT 
                tr.TestLog, tr.TR, tm.Name, tm.Darajah,
                tr.Weight, tr.Height, tr.Waist, tr.Hips, tr.Neck,
                tr.BMI, tr.BMIStatus, tr.BodyFat, tr.BMR,
                tr.CalorieIntake, tr.VO2Max, tr.Total, tr.Grade,
                tr.CreatedAt, tr.BatchID,
                ISNULL(eb.BatchName, 'Unbatched') AS BatchName,

                -- 🆕 Activity fields
                tal.PushUps,
                tal.SitUps,
                tal.Squats,
                tal.SitAndReach,
                tal.StepUpPulseRate

            FROM TestRecords tr
            JOIN TestMaster tm ON tr.TR = tm.TR
            LEFT JOIN EvaluationBatches eb ON tr.BatchID = eb.BatchID
            LEFT JOIN TestActivityLog tal ON tr.TestLog = tal.TestLog
            WHERE tr.TestLog = @TestLog;
        `);


        if (currentRecordResult.recordset.length === 0) {
            return res.status(404).json({ success: false, message: 'Test Record not found.' });
        }
        
        const currentRecord = currentRecordResult.recordset[0];
        const studentTR = currentRecord.TR;

        // --- 2. Now that we have the TR, create new requests for the other 3 queries ---
        const medicalRequest = new sql.Request(pool);
        medicalRequest.input('TR', sql.Int, studentTR);
        const medicalHistoryQuery = medicalRequest.query(`
            SELECT * FROM MedicalHistory WHERE TR = @TR;
        `);

        const categoriesRequest = new sql.Request(pool);
        const categoriesQuery = categoriesRequest.query(`
            SELECT CategoryID, CategoryName FROM CommentCategories ORDER BY CategoryName;
        `);

        const commentsRequest = new sql.Request(pool);
        commentsRequest.input('TR', sql.Int, studentTR);
        const existingCommentsQuery = commentsRequest.query(`
            SELECT 
                E.EvaluationID, E.CommentText, E.DateEvaluated,
                C.CategoryName,
                EV.Name AS EvaluatorName,
                EV.Profession,
                ISNULL(EB.BatchName, 'Unbatched') AS BatchName
            FROM Evaluations E
            JOIN Evaluators EV ON E.EvaluatorID = EV.EvaluatorID
            JOIN CommentCategories C ON E.CategoryID = C.CategoryID
            JOIN TestRecords TR ON E.LogID = TR.TestLog
            LEFT JOIN EvaluationBatches EB ON TR.BatchID = EB.BatchID
            WHERE TR.TR = @TR
            ORDER BY C.CategoryName, E.DateEvaluated DESC;
        `);

        // --- 3. Run the remaining queries in parallel ---
        const [
            medicalHistoryResult,
            categoriesResult,
            existingCommentsResult
        ] = await Promise.all([
            medicalHistoryQuery,
            categoriesQuery,
            existingCommentsQuery
        ]);

        // --- 4. Send the combined response ---
        res.json({
            success: true,
            currentRecord: currentRecord,
            medicalHistory: medicalHistoryResult.recordset[0] || null,
            commentCategories: categoriesResult.recordset,
            existingComments: existingCommentsResult.recordset
        });

    } catch (err) {
        console.error('Error fetching comment details:', err);
        res.status(500).json({ success: false, message: 'Failed to fetch record details.' });
    }
});

/**
 * 6. POST: Saves a *single* new comment
 * (This is the new, simple save route)
 */
router.post('/api/evaluation/save-comment', isEvaluator, async (req, res) => {
    const { LogID, CategoryID, CommentText, Rating } = req.body;
    
    if (!LogID || !CategoryID || !CommentText) {
        return res.status(400).json({ success: false, message: 'LogID, CategoryID, and Comment are required.' });
    }

    try {
        await pool.request()
            .input('LogID', sql.Int, LogID)
            .input('EvaluatorID', sql.Int, req.EvaluatorID) // From middleware
            .input('CategoryID', sql.Int, CategoryID)
            .input('CommentText', sql.NVarChar(sql.MAX), CommentText)
            .query(`
                INSERT INTO Evaluations (LogID, EvaluatorID, CategoryID, CommentText)
                VALUES (@LogID, @EvaluatorID, @CategoryID, @CommentText)
            `);
        
        // Return a fresh list of comments for the UI to re-render
        const freshComments = await pool.request()
            .input('LogID', sql.Int, LogID)
            .query(`
                SELECT E.EvaluationID, E.CommentText, E.DateEvaluated, C.CategoryName, EV.Name AS EvaluatorName, EV.Profession
                FROM Evaluations E
                JOIN Evaluators EV ON E.EvaluatorID = EV.EvaluatorID
                JOIN CommentCategories C ON E.CategoryID = C.CategoryID
                WHERE E.LogID = @LogID ORDER BY E.DateEvaluated DESC;
            `);

        res.status(201).json({ success: true, newComments: freshComments.recordset });

    } catch (err) {
        console.error('Error saving new comment:', err);
        res.status(500).json({ success: false, message: 'Failed to save comment.' });
    }
});

/**
 * 7. DELETE: Deletes a *single* comment
 * (Only the evaluator who wrote it can delete it)
 */
router.delete('/api/evaluation/delete-comment/:id', isEvaluator, async (req, res) => {
    const { id } = req.params; // EvaluationID
    
    try {
        const result = await pool.request()
            .input('EvaluationID', sql.Int, id)
            .input('EvaluatorID', sql.Int, req.EvaluatorID) // From middleware
            .query(`
                DELETE FROM Evaluations 
                WHERE EvaluationID = @EvaluationID 
                  AND EvaluatorID = @EvaluatorID
            `); // Ensures you can only delete your own comments

        if (result.rowsAffected[0] === 0) {
            return res.status(403).json({ success: false, message: "Failed to delete: Comment not found or you are not the author." });
        }
        
        res.json({ success: true, message: 'Comment deleted.' });

    } catch (err) {
        console.error('Error deleting comment:', err);
        res.status(500).json({ success: false, message: 'Failed to delete comment.' });
    }
});

/**
 * 8. GET: Get Evaluation Statistics
 * (This route is unchanged, as it uses TestRecords, not EvaluatorComments)
 */
router.get('/api/evaluation/statistics', isEvaluator, async (req, res) => {
    // ... (This entire route is unchanged and correct)
    try {
        const request = new sql.Request(pool);
        request.input('Branch', sql.NVarChar(50), req.Branch);
        request.input('Gender', sql.NVarChar(10), req.Gender);
        const lineChartQuery = `
            SELECT 
                eb.BatchName,
                AVG(tr.BMI) AS AvgBMI,
                AVG(tr.BodyFat) AS AvgBodyFat
            FROM TestRecords tr
            JOIN EvaluationBatches eb ON tr.BatchID = eb.BatchID
            WHERE 
                tr.SubmittedBy = 'Trainer'
                AND tr.Branch = @Branch
                AND tr.Gender = @Gender
            GROUP BY 
                eb.BatchName, eb.BatchID
            ORDER BY 
                eb.BatchID ASC;
        `;
        const latestBatchQuery = `
            SELECT TOP 1 BatchID 
            FROM EvaluationBatches
            WHERE 
                Branch = @Branch 
                AND Gender = @Gender 
                AND IsActive = 0
            ORDER BY 
                CreatedAt DESC;
        `;
        const [lineChartResult, latestBatchResult] = await Promise.all([
            request.query(lineChartQuery),
            request.query(latestBatchQuery)
        ]);
        let latestBatchStats = {
            AvgBMI: null,
            AvgBodyFat: null,
            BmiStatusDistribution: [],
            MostCommonGrade: null
        };
        if (latestBatchResult.recordset.length > 0) {
            const latestBatchID = latestBatchResult.recordset[0].BatchID;
            const statsRequest = new sql.Request(pool);
            statsRequest.input('LatestBatchID', sql.Int, latestBatchID);
            const snapshotQuery = `
                SELECT AVG(BMI) AS LatestAvgBMI, AVG(BodyFat) AS LatestAvgBodyFat
                FROM TestRecords WHERE BatchID = @LatestBatchID;
                SELECT BMIStatus, COUNT(*) AS StatusCount
                FROM TestRecords WHERE BatchID = @LatestBatchID
                GROUP BY BMIStatus;
                SELECT TOP 1 Grade FROM TestRecords
                WHERE BatchID = @LatestBatchID AND Grade IS NOT NULL
                GROUP BY Grade ORDER BY COUNT(*) DESC;
            `;
            const snapshotResult = await statsRequest.query(snapshotQuery);
            latestBatchStats = {
                AvgBMI: snapshotResult.recordsets[0][0]?.LatestAvgBMI,
                AvgBodyFat: snapshotResult.recordsets[0][0]?.LatestAvgBodyFat,
                BmiStatusDistribution: snapshotResult.recordsets[1],
                MostCommonGrade: snapshotResult.recordsets[2][0]?.Grade
            };
        }
        res.json({
            success: true,
            data: {
                lineChartData: lineChartResult.recordset,
                latestBatchStats: latestBatchStats
            }
        });
    } catch (err) {
        console.error('Error fetching evaluation statistics:', err);
        res.status(500).json({ success: false, message: 'Failed to fetch statistics.' });
    }
});


/**
 * 9. GET: Search for a Student
 * (This route is unchanged)
 */
router.get('/api/evaluation/search-student', isEvaluator, async (req, res) => {
    // ... (This entire route is unchanged and correct)
    const { q } = req.query;
    if (!q || q.length < 2) {
        return res.json({ success: true, data: [] });
    }
    try {
        const request = new sql.Request(pool);
        request.input('Branch', sql.NVarChar(50), req.Branch);
        request.input('Gender', sql.NVarChar(10), req.Gender);
        request.input('Query', sql.NVarChar(100), `%${q}%`);
        request.input('TRQuery', sql.NVarChar(100), `${q}%`);
        const result = await request.query(`
            SELECT TOP 10 TR, Name 
            FROM TestMaster
            WHERE 
                Branch = @Branch 
                AND Gender = @Gender
                AND (Name LIKE @Query OR CAST(TR AS VARCHAR(20)) LIKE @TRQuery)
            ORDER BY Name ASC;
        `);
        res.json({ success: true, data: result.recordset });
    } catch (err) {
        console.error('Error in student search:', err);
        res.status(500).json({ success: false, message: 'Search failed.' });
    }
});

/**
 * 10. GET: Get a Single Student's Full History (Accordion View)
 * (This version fetches all data for the accordion)
 */
router.get('/api/evaluation/student-history/:tr', isEvaluator, async (req, res) => {
    const { tr } = req.params;
    try {
        const request = new sql.Request(pool);
        request.input('TR', sql.Int, tr);
        request.input('Branch', sql.NVarChar(50), req.Branch);
        request.input('Gender', sql.NVarChar(10), req.Gender);

        // 1. Authorize and get name
        const authCheck = await request.query(`
            SELECT Name FROM TestMaster 
            WHERE TR = @TR AND Branch = @Branch AND Gender = @Gender
        `);
        if (authCheck.recordset.length === 0) {
            return res.status(403).json({ success: false, message: 'Unauthorized to view this student.' });
        }
        const studentName = authCheck.recordset[0].Name;

        // 2. Get all TestLogIDs for this student
        const historyLogs = await request.query(`
            SELECT 
                tr.TestLog, tr.BatchID,
                ISNULL(eb.BatchName, 'Unbatched') AS BatchName,
                tr.CreatedAt, tr.Grade
            FROM TestRecords tr
            LEFT JOIN EvaluationBatches eb ON tr.BatchID = eb.BatchID
            WHERE tr.TR = @TR AND tr.SubmittedBy = 'Trainer'
            ORDER BY tr.CreatedAt DESC;
        `);

        if (historyLogs.recordset.length === 0) {
            return res.json({ success: true, studentName: studentName, data: [] });
        }

        // 3. Get all comments for all those logs in one query
        const logIDs = historyLogs.recordset.map(r => r.TestLog);
        const logParams = logIDs.map((id, i) => `@LogID${i}`);
        logIDs.forEach((id, i) => request.input(`LogID${i}`, sql.Int, id));

        const commentsResult = await request.query(`
            SELECT E.LogID, E.CommentText, E.DateEvaluated, C.CategoryName,
                   EV.Name AS EvaluatorName, EV.Profession
            FROM Evaluations E
            JOIN Evaluators EV ON E.EvaluatorID = EV.EvaluatorID
            JOIN CommentCategories C ON E.CategoryID = C.CategoryID
            WHERE E.LogID IN (${logParams.join(',')})
            ORDER BY E.LogID, E.DateEvaluated DESC;
        `);

        // 4. Group the comments by LogID
        const commentsMap = new Map();
        for (const comment of commentsResult.recordset) {
            if (!commentsMap.has(comment.LogID)) {
                commentsMap.set(comment.LogID, []);
            }
            commentsMap.get(comment.LogID).push(comment);
        }

        // 5. Combine the data
        const finalData = historyLogs.recordset.map(log => {
            const comments = commentsMap.get(log.TestLog) || [];
            let status = 'Pending';
            if (comments.length > 0) status = 'In Progress'; 
            // You could add a 'Completed' status here if, e.g., comments.length > 3

            return { ...log, CommentStatus: status, comments: comments };
        });

        res.json({ success: true, studentName: studentName, data: finalData });

    } catch (err) {
        console.error('Error fetching student history:', err);
        res.status(500).json({ success: false, message: 'Failed to fetch student history.' });
    }
});
/**
 * 11. GET: Export Batch Data (NORMALIZED, FUTURE-PROOF)
 */
router.get('/api/evaluation/export/:batchID', isEvaluator, async (req, res) => {
    const { batchID } = req.params;

    try {
        const request = new sql.Request(pool);
        request.input('Branch', sql.NVarChar(50), req.Branch);
        request.input('Gender', sql.NVarChar(10), req.Gender);

        let batchName = 'Unbatched Records';
        let whereClause = '';

        if (batchID === 'null') {
            whereClause = `
                WHERE tr.Branch = @Branch
                  AND tr.Gender = @Gender
                  AND tr.SubmittedBy = 'Trainer'
                  AND tr.BatchID IS NULL
            `;
        } else {
            request.input('BatchID', sql.Int, batchID);

            const batchNameResult = await request.query(`
                SELECT BatchName
                FROM EvaluationBatches
                WHERE BatchID = @BatchID
            `);

            if (batchNameResult.recordset.length > 0) {
                batchName = batchNameResult.recordset[0].BatchName;
            }

            whereClause = `
                WHERE tr.Branch = @Branch
                  AND tr.Gender = @Gender
                  AND tr.SubmittedBy = 'Trainer'
                  AND tr.BatchID = @BatchID
            `;
        }

        const dataResult = await request.query(`
            SELECT
                tr.TR,
                tm.Name,

                -- Test metrics
                tr.Weight,
                tr.Height,
                tr.Waist,
                tr.Hips,
                tr.Neck,
                tr.BMI,
                tr.BMIStatus,
                tr.BodyFat,
                tr.BMR,
                tr.CalorieIntake,
                tr.VO2Max,
                tr.Total,
                tr.Grade,

                -- Comment info (NORMALIZED)
                cc.CategoryID,
                cc.CategoryName,
                e.CommentText

            FROM TestRecords tr
            JOIN TestMaster tm ON tr.TR = tm.TR
            LEFT JOIN Evaluations e ON tr.TestLog = e.LogID
            LEFT JOIN CommentCategories cc ON e.CategoryID = cc.CategoryID

            ${whereClause}

            ORDER BY tm.Name ASC, cc.CategoryID ASC;
        `);

        res.json({
            success: true,
            batchName,
            records: dataResult.recordset
        });

    } catch (err) {
        console.error('Error exporting batch data:', err);
        res.status(500).json({
            success: false,
            message: 'Failed to export data.'
        });
    }
});


/**
 * 12. GET: Get "My Comments"
 * (★★★ NEW FEATURE: My Comments Log ★★★)
 * Fetches a list of all comments written by the logged-in evaluator.
 */
router.get('/api/evaluation/my-comments', isEvaluator, async (req, res) => {
    try {
        const request = new sql.Request(pool);
        
        // req.EvaluatorID comes from our isEvaluator middleware
        request.input('EvaluatorID', sql.Int, req.EvaluatorID);

        const result = await request.query(`
            SELECT 
                E.EvaluationID,
                E.LogID,
                E.CommentText,
                E.DateEvaluated,
                C.CategoryName,
                TR.TR,
                TR.BatchID,
                TM.Name AS StudentName,
                ISNULL(EB.BatchName, 'Unbatched') AS BatchName
            FROM Evaluations E
            JOIN Evaluators EV ON E.EvaluatorID = EV.EvaluatorID
            JOIN CommentCategories C ON E.CategoryID = C.CategoryID
            JOIN TestRecords TR ON E.LogID = TR.TestLog
            JOIN TestMaster TM ON TR.TR = TM.TR
            LEFT JOIN EvaluationBatches EB ON TR.BatchID = EB.BatchID
            WHERE E.EvaluatorID = @EvaluatorID
            ORDER BY E.DateEvaluated DESC;
        `);

        res.json({ success: true, data: result.recordset });

    } catch (err) {
        console.error('Error fetching "My Comments":', err);
        res.status(500).json({ success: false, message: 'Failed to fetch your comments.' });
    }
});


// -----------------------------------------------
// STAFF: Get Evaluation Logs (Branch + Gender Only)
// -----------------------------------------------
router.get('/api/staff/evaluation-logs', async (req, res) => {
    if (!req.session.user || req.session.user.Role !== 'Staff') {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const sessionGender = req.session.user.Gender;
    const gender = req.query.gender;

    // ❗ HARD SECURITY → Prevent misuse
    if (!gender || gender !== sessionGender) {
        return res.status(403).json({ success: false, message: 'Forbidden gender access' });
    }

    try {
        const request = pool.request();
        request.input('Branch', sql.NVarChar(50), req.session.user.Branch);
        request.input('Gender', sql.NVarChar(10), sessionGender);

        const result = await request.query(`
                SELECT 
                E.EvaluationID,
                EV.Name AS EvaluatorName,
                CC.CategoryName,
                TR.TR,
                TM.Name AS StudentName,
                E.CommentText AS Remark,
                ISNULL(EB.BatchName, 'Unbatched') AS BatchName,
                TR.Gender,
                TR.CreatedAt,
                E.DateEvaluated
            FROM Evaluations E
            JOIN Evaluators EV ON E.EvaluatorID = EV.EvaluatorID
            JOIN CommentCategories CC ON E.CategoryID = CC.CategoryID
            JOIN TestRecords TR ON E.LogID = TR.TestLog
            JOIN TestMaster TM ON TR.TR = TM.TR
            LEFT JOIN EvaluationBatches EB ON TR.BatchID = EB.BatchID
            WHERE TR.Branch = @Branch AND TR.Gender = @Gender
            ORDER BY E.DateEvaluated DESC;
        `);

        res.json({ success: true, data: result.recordset });

    } catch (err) {
        console.error('❌ Staff Evaluation Logs Error:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});


// ----------------------------------------------------------
// STAFF: Get Batch Overview (Only Their Branch + Gender)
// ----------------------------------------------------------
router.get('/api/staff/evaluation-batches-overview', async (req, res) => {
    if (!req.session.user || req.session.user.Role !== 'Staff') {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const sessionGender = req.session.user.Gender;

    try {
        const request = pool.request();
        request.input('Branch', sql.NVarChar(50), req.session.user.Branch);
        request.input('Gender', sql.NVarChar(10), sessionGender);

        const result = await request.query(`
            WITH TrainerRecords AS (
                SELECT TestLog, BatchID
                FROM TestRecords
                WHERE SubmittedBy = 'Trainer'
                  AND Branch = @Branch
                  AND Gender = @Gender
            ),
            RecordStatus AS (
                SELECT 
                    tr.BatchID,
                    CASE 
                        WHEN EXISTS (
                            SELECT 1 FROM Evaluations e WHERE e.LogID = tr.TestLog
                        ) THEN 'In Progress'
                        ELSE 'Pending'
                    END AS Status
                FROM TrainerRecords tr
            )
            SELECT
            rs.BatchID,
            @Gender AS Gender,
            ISNULL(eb.BatchName, 'Unbatched Records') AS BatchName,
            eb.IsActive,
            COUNT(*) AS TotalCount,
            COUNT(CASE WHEN Status = 'In Progress' THEN 1 END) AS PartialCount,
            COUNT(CASE WHEN Status = 'Pending' THEN 1 END) AS PendingCount
            FROM RecordStatus rs
            LEFT JOIN EvaluationBatches eb ON rs.BatchID = eb.BatchID
            GROUP BY rs.BatchID, eb.BatchName, eb.IsActive
            ORDER BY eb.IsActive DESC, rs.BatchID DESC;
        `);

        res.json({ success: true, data: result.recordset });

    } catch (err) {
        console.error('❌ Staff Batch Overview Error:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});


// ----------------------------------------------------------
// STAFF/ADMIN: Fitness test attendance checklist (session scoped)
// ----------------------------------------------------------
router.get('/api/staff/fitness-test-attendance', isStaffOrAdmin, async (req, res) => {
    const { Branch, Gender } = req.session.user;

    if (!Branch || !Gender) {
        return res.status(401).json({ success: false, message: 'Unauthorized. Session missing branch or gender.' });
    }

    try {
        const activeBatchRequest = pool.request();
        activeBatchRequest.input('Branch', sql.NVarChar(50), Branch);
        activeBatchRequest.input('Gender', sql.NVarChar(10), Gender);

        const activeBatchResult = await activeBatchRequest.query(`
            SELECT TOP 1
                BatchID,
                BatchName,
                IsActive,
                CreatedAt,
                CreatedBy
            FROM EvaluationBatches
            WHERE Branch = @Branch
              AND Gender = @Gender
              AND IsActive = 1
            ORDER BY CreatedAt DESC, BatchID DESC;
        `);

        const activeBatchCountRequest = pool.request();
        activeBatchCountRequest.input('Branch', sql.NVarChar(50), Branch);
        activeBatchCountRequest.input('Gender', sql.NVarChar(10), Gender);

        const activeBatchCountResult = await activeBatchCountRequest.query(`
            SELECT COUNT(*) AS ActiveBatchConflictCount
            FROM EvaluationBatches
            WHERE Branch = @Branch
              AND Gender = @Gender
              AND IsActive = 1;
        `);

        const activeBatch = activeBatchResult.recordset[0] || null;
        const activeBatchConflictCount = activeBatchCountResult.recordset[0]?.ActiveBatchConflictCount || 0;

        const rosterRequest = pool.request();
        rosterRequest.input('Branch', sql.NVarChar(50), Branch);
        rosterRequest.input('Gender', sql.NVarChar(10), Gender);

        const rosterResult = await rosterRequest.query(`
            SELECT
                TM.TR,
                TM.Name,
                TM.Darajah,
                TM.JoinedAt,
                S.SlotName
            FROM TestMaster TM
            LEFT JOIN Slots S ON TM.SlotID = S.SlotID
            WHERE TM.Status = 'Active'
              AND TM.Branch = @Branch
              AND TM.Gender = @Gender
            ORDER BY TM.TR ASC;
        `);

        const roster = rosterResult.recordset || [];
        const totalActiveStudents = roster.length;

        let pending = [];
        let completed = [];

        if (activeBatch) {
            const completionRequest = pool.request();
            completionRequest.input('BatchID', sql.Int, activeBatch.BatchID);
            completionRequest.input('Branch', sql.NVarChar(50), Branch);
            completionRequest.input('Gender', sql.NVarChar(10), Gender);

            const completionResult = await completionRequest.query(`
                SELECT
                    TR,
                    MAX(CreatedAt) AS CompletedAt,
                    COUNT(*) AS RecordCountInBatch
                FROM TestRecords
                WHERE BatchID = @BatchID
                  AND Branch = @Branch
                  AND Gender = @Gender
                  AND SubmittedBy = 'Trainer'
                GROUP BY TR;
            `);

            const completionMap = new Map();
            for (const row of completionResult.recordset) {
                completionMap.set(row.TR, {
                    CompletedAt: row.CompletedAt,
                    RecordCountInBatch: row.RecordCountInBatch
                });
            }

            for (const student of roster) {
                const completion = completionMap.get(student.TR);
                const email = `${student.TR}@jameasaifiyah.edu`;

                if (completion) {
                    completed.push({
                        TR: student.TR,
                        Name: student.Name,
                        Darajah: student.Darajah,
                        SlotName: student.SlotName,
                        JoinedAt: student.JoinedAt,
                        Email: email,
                        CompletionStatus: 'Completed',
                        CompletedAt: completion.CompletedAt,
                        RecordCountInBatch: completion.RecordCountInBatch
                    });
                } else {
                    pending.push({
                        TR: student.TR,
                        Name: student.Name,
                        Darajah: student.Darajah,
                        SlotName: student.SlotName,
                        JoinedAt: student.JoinedAt,
                        Email: email,
                        CompletionStatus: 'Pending'
                    });
                }
            }

            completed.sort((a, b) => {
                const aTime = a.CompletedAt ? new Date(a.CompletedAt).getTime() : 0;
                const bTime = b.CompletedAt ? new Date(b.CompletedAt).getTime() : 0;
                return bTime - aTime;
            });

            pending.sort((a, b) => a.TR - b.TR);
        }

        const completedCount = completed.length;
        const pendingCount = pending.length;
        const completionPercent = totalActiveStudents > 0
            ? Math.round((completedCount / totalActiveStudents) * 10000) / 100
            : 0;

        const pendingEmails = pending.map(student => student.Email);

        res.json({
            success: true,
            context: {
                branch: Branch,
                gender: Gender,
                activeBatch,
                activeBatchConflictCount,
                generatedAt: new Date().toISOString()
            },
            summary: {
                totalActiveStudents,
                completedCount,
                pendingCount,
                completionPercent
            },
            pending,
            completed,
            emailExports: {
                newlineList: pendingEmails.join('\n'),
                semicolonList: pendingEmails.join(';')
            }
        });
    } catch (err) {
        console.error('Error fetching staff fitness test attendance checklist:', err);
        res.status(500).json({ success: false, message: 'Failed to fetch fitness test attendance checklist.' });
    }
});



const isTrainer = (req, res, next) => {
    if (!req.session.user || req.session.user.Role !== 'Trainer') {
        return res.status(403).json({ success: false, message: 'Forbidden: Access restricted to Trainers.' });
    }
    req.UserID = req.session.user.UserID;  // For DB operations
    req.Branch = req.session.user.Branch;
    next();
};




router.get('/api/trainer/my-test-records', isTrainer, async (req, res) => {
    try {
        const result = await pool.request()
            .input("UserID", sql.Int, req.UserID)
            .query(`
                SELECT 
                    TR.TestLog,
                    TR.CreatedAt,
                    TR.TR,
                    TM.Name,                
                    TR.Total,
                    TR.Grade,
                    TR.Branch,
                    TR.Gender,
                    TR.BatchID,             
                    EB.BatchName            
                FROM TestRecords TR
                JOIN Trainers T ON TR.TrainerID = T.TrainerID
                JOIN TestMaster TM ON TM.TR = TR.TR
                LEFT JOIN EvaluationBatches EB ON TR.BatchID = EB.BatchID
                WHERE T.UserID = @UserID
                ORDER BY TR.CreatedAt DESC
            `);

        res.json({ success: true, data: result.recordset });

    } catch (err) {
        console.error("Error fetching trainer test logs:", err);
        res.status(500).json({ success: false, message: "Failed to load records." });
    }
});


router.delete('/api/trainer/delete-test-record/:logId', isTrainer, async (req, res) => {
    const { logId } = req.params;

    try {
        const verify = await pool.request()
            .input("LogID", sql.Int, logId)
            .input("UserID", sql.Int, req.UserID)
            .query(`
                SELECT TR.TestLog
                FROM TestRecords TR
                JOIN Trainers T ON TR.TrainerID = T.TrainerID
                WHERE TR.TestLog = @LogID AND T.UserID = @UserID
            `);

        if (verify.recordset.length === 0) {
            return res.status(403).json({ success: false, message: "Unauthorized delete request." });
        }

        await pool.request().input("LogID", sql.Int, logId)
            .query(`DELETE FROM TestRecords WHERE TestLog = @LogID`);

        res.json({ success: true, message: "Record deleted successfully." });

    } catch (err) {
        console.error("Error deleting trainer test:", err);
        res.status(500).json({ success: false, message: "Failed to delete record." });
    }
});


router.get('/api/trainer/profile', isTrainer, async (req, res) => {
    try {
        const result = await pool.request()
            .input("UserID", sql.Int, req.UserID)
            .query(`
                SELECT P.Username, P.Role, P.Branch, P.Gender, T.Name, T.Profession, T.Contact, T.Email
                FROM PassBank P
                LEFT JOIN Trainers T ON P.UserID = T.UserID
                WHERE P.UserID = @UserID
            `);

        if (result.recordset.length === 0) {
            return res.status(404).json({ success: false, message: "Trainer not found." });
        }

        const trainer = result.recordset[0];
        const isProfileComplete = !!(trainer.Name && trainer.Contact);

        res.json({ 
            success: true, 
            user: {
                ...trainer,
                isProfileComplete
            }
        });

    } catch (err) {
        console.error("Error fetching trainer profile:", err);
        res.status(500).json({ success: false, message: "Failed to fetch profile." });
    }
});


router.put('/api/trainer/profile', isTrainer, async (req, res) => {
    const { Name, Profession, Contact, Email } = req.body;

    try {
        await pool.request()
            .input("UserID", sql.Int, req.UserID)
            .input("Name", sql.NVarChar, Name)
            .input("Profession", sql.NVarChar, Profession)
            .input("Contact", sql.NVarChar, Contact)
            .input("Email", sql.NVarChar, Email)
            .query(`
                UPDATE Trainers 
                SET Name = @Name, Profession = @Profession, Contact = @Contact, Email = @Email
                WHERE UserID = @UserID
            `);

        res.json({ success: true, message: "Profile updated successfully." });

    } catch (err) {
        console.error("Error updating trainer profile:", err);
        res.status(500).json({ success: false, message: "Failed to update profile." });
    }
});

// NEW: Endpoint for trainers to see a student's plan for today
router.get('/api/trainer/student-plan/:tr', isTrainer, async (req, res) => {
    try {
        const { tr } = req.params;
        const todayStr = moment.tz("Asia/Kolkata").format('YYYY-MM-DD');

        // 1. Get current week ID
        const weekResult = await pool.request()
            .input('Today', sql.Date, todayStr)
            .query(`
                SELECT TOP 1 WeekID FROM AttendanceWeek
                WHERE WeekStartDate <= @Today AND WeekEndDate >= @Today
            `);

        if (weekResult.recordset.length === 0) {
            return res.json({ success: true, data: [] });
        }

        const currentWeekID = weekResult.recordset[0].WeekID;

        // 2. Fetch student's V2 plan for the current week
        const planResult = await pool.request()
            .input('TR', sql.Int, tr)
            .input('WeekNumber', sql.Int, currentWeekID)
            .query(`
                SELECT
                    wd.DayName AS Day,
                    wd.Notes AS DayNotes,
                    pe.OrderIndex,
                    pe.TargetSets,
                    pe.TargetReps,
                    pe.TargetDurationMinutes,
                    pe.Notes AS ItemNote,
                    pe.Source,
                    e.Name AS ExerciseName,
                    bp.Name AS BodyPartName
                FROM WorkoutPrograms wp
                JOIN WorkoutWeeks ww ON ww.ProgramID = wp.ProgramID
                    AND ww.WeekNumber = @WeekNumber
                JOIN WorkoutDays wd ON wd.WeekID = ww.WeekID
                LEFT JOIN PlannedExercises pe ON pe.DayID = wd.DayID
                LEFT JOIN Exercises e ON e.ExerciseID = pe.ExerciseID
                LEFT JOIN BodyParts bp ON bp.BodyPartID = e.BodyPartID
                WHERE wp.TR = @TR AND wp.IsActive = 1
                ORDER BY wd.OrderIndex, pe.OrderIndex;
            `);

        // Group by day
        const dayMap = {};
        for (const row of planResult.recordset) {
            if (!dayMap[row.Day]) {
                dayMap[row.Day] = { Day: row.Day, items: [], notes: row.DayNotes || '', displayText: '' };
            }
            if (row.ExerciseName) {
                const label = [
                    row.ExerciseName,
                    row.TargetSets ? `${row.TargetSets} sets` : null,
                    row.TargetReps ? row.TargetReps : null
                ].filter(Boolean).join(' – ');
                dayMap[row.Day].items.push({
                    exercise: row.ExerciseName,
                    bodyPart: row.BodyPartName || '',
                    sets: row.TargetSets,
                    reps: row.TargetReps,
                    note: row.ItemNote || '',
                    source: row.Source || 'manual'
                });
                dayMap[row.Day].displayText += (dayMap[row.Day].displayText ? '\n' : '') + label;
            }
        }

        const structured = Object.values(dayMap);
        res.json({ success: true, data: structured });

    } catch (err) {
        console.error('Error fetching student plan for trainer:', err);
        res.status(500).json({ success: false, message: 'Failed to load student plan' });
    }
});


router.get("/api/trainer/log-details/:logId", isTrainer, async (req, res) => {
    const { logId } = req.params;

    try {
        const result = await pool.request()
            .input("LogID", sql.Int, logId)
            .input("UserID", sql.Int, req.UserID)
            .query(`
                SELECT 
                    TRS.TestLog,
                    TRS.TR,
                    TMS.Name,
                    EB.BatchName,               
                    TRS.BatchID,                

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
                    TRS.CreatedAt,

                    TAL.PushUps,
                    TAL.SitUps,
                    TAL.Squats,
                    TAL.SitAndReach,
                    TAL.StepUpPulseRate

                FROM TestRecords TRS
                JOIN Trainers T ON TRS.TrainerID = T.TrainerID
                JOIN TestMaster TMS ON TMS.TR = TRS.TR
                LEFT JOIN TestActivityLog TAL ON TRS.TestLog = TAL.TestLog
                LEFT JOIN EvaluationBatches EB ON TRS.BatchID = EB.BatchID

                WHERE TRS.TestLog = @LogID
                AND T.UserID = @UserID
            `);

        if (result.recordset.length === 0) {
            return res.json({ success: false, message: "Log not found or unauthorized." });
        }

        res.json({ success: true, data: result.recordset[0] });

    } catch (err) {
        console.error("View log details error:", err);
        res.status(500).json({ success: false, message: "Error fetching details." });
    }
});



module.exports = router; // Export the router

