// routes/gamification.js
const express = require('express');
const router = express.Router();
const { pool } = require('../utils/db.js');
const sql = require('mssql');
const moment = require('moment-timezone'); // Needed by runAchievementEvaluation

// --- HELPER FUNCTIONS ---
// (awardXP, isGapExcused, etc. will go here)

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

// --- MAIN ACHIEVEMENT EVALUATION LOGIC ---
// (The big runAchievementEvaluation function will go here)

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
                    FROM TestMaster M
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
                await awardXP(winner.TR, 250, transaction);
            }
        }

        // --- 2. Evaluate Individual Achievements ---
        const studentsResult = await new sql.Request(transaction).query(`SELECT TR, JoinedAt FROM TestMaster WHERE Status = 'Active'`);

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
                            SELECT COUNT(DISTINCT CAST(DATEADD(MINUTE, 330, CreatedAt) AS DATE)) as AttendedDays 
                            FROM Attendance 
                            WHERE TR = @TR AND CreatedAt >= @StartDate 
                              AND (IsPresent = 1 OR OnLeave = 1)
                        `);

                    if (attendanceCountRes.recordset[0]?.AttendedDays >= 26) {
                        const insertPerfectRequest = new sql.Request(transaction);
                        await insertPerfectRequest.input('TR', TR)
                            .query(`INSERT INTO StudentAchievements (TR, AchievementID) VALUES (@TR, ${perfectMonthID})`);

                        // --- NEW: Award XP for Perfect 30 Days ---
                        await awardXP(TR, 250, transaction);
                    }
                }
            }

            // --- 2b. Consistency King ---
            const consistencyKingID = 2;
            const workoutDatesRequest = new sql.Request(transaction);
            const workoutDatesRes = await workoutDatesRequest.input('TR', TR)
                .query(`SELECT DISTINCT CAST(DATEADD(MINUTE, 330, CreatedAt) AS DATE) as workoutDate 
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
                    WHERE LeaveCounts.leaveCount > (SELECT COUNT(*) FROM TestMaster WHERE Status='Active') * 0.5
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
                    await awardXP(TR, 250, transaction);
                }

                // Update personal best
                const updateBestStreakRequest = new sql.Request(transaction);
                await updateBestStreakRequest
                    .input('TR', TR)
                    .input('LongestStreak', longestStreak)
                    .query(`UPDATE TestMaster SET BestStreak = @LongestStreak WHERE TR = @TR AND BestStreak < @LongestStreak`);
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
                        await awardXP(TR, 250, transaction);
                    }
                }
            }

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
                        await awardXP(TR, 250, transaction); // Award XP for the new badge
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




// --- API ROUTES ---
// (POST /api/achievements/evaluate will go here)
// THE "FIRE-AND-FORGET" API ROUTE (No changes here, remains the same)
router.post('/api/achievements/evaluate', (req, res) => {
    const expectedSecret = process.env.CRON_SECRET_ACHIEVEMENTS;
    if (!expectedSecret) {
        console.error('CRON_SECRET_ACHIEVEMENTS is not configured.');
        return res.status(503).json({ success: false, message: 'Scheduled task is not configured.' });
    }

    if (req.headers['x-internal-secret'] !== expectedSecret) {
        return res.status(403).json({ success: false, message: 'Forbidden' });
    }
    res.status(202).json({ success: true, message: 'Achievement evaluation process has been initiated in the background.' });
    runAchievementEvaluation();
});

module.exports = router;
