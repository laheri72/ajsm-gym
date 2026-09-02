// routes/student.js
const express = require('express');
const router = express.Router();
const { pool } = require('../utils/db.js');
const sql = require('mssql');
const moment = require('moment-timezone'); // This file needs moment
const { cacheMiddleware, cache } = require('../utils/cache.js');
const { getStudentStatusHistory } = require('../utils/studentStatusAudit.js');

const VALID_PLANNER_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const PLANNER_SCHEMA_VERSION = 1;
const MAX_PLANNER_ITEMS_PER_DAY = 16;

const { formatHijriDate } = require('../utils/mumineenCalendar.js');

function isValidPlannerDay(day) {
    return VALID_PLANNER_DAYS.includes(day);
}

function getCurrentDateInIST() {
    return moment.tz("Asia/Kolkata").format('YYYY-MM-DD');
}

function isPendingOrUnassignedSlot(slotName) {
    const normalized = String(slotName || '').trim().toLowerCase();
    return !normalized || normalized.includes('pending') || normalized === 'n/a' || normalized === 'unassigned';
}

function isExpectedAttendanceDay({ dateEnd, history, fallbackStatus, fallbackSlotName, tr, joinedAt, warnedRef = {} }) {
    if (joinedAt) {
        const joinedDate = new Date(joinedAt);
        joinedDate.setHours(0, 0, 0, 0);
        const checkDate = new Date(dateEnd);
        checkDate.setHours(0, 0, 0, 0);
        if (checkDate < joinedDate) {
            return false;
        }
    }
    let latestRecord = null;
    const oldestRecord = history.length > 0 ? history[0] : null;

    for (const h of history) {
        if (new Date(h.ChangedAt) <= dateEnd) {
            latestRecord = h;
        }
    }

    if (latestRecord) {
        const status = String(latestRecord.NewStatus || '').trim().toLowerCase();
        if (status && status !== 'active') return false;
        let slotToCheck = latestRecord.NewSlotName;
        if (!slotToCheck && status === 'active') {
            slotToCheck = fallbackSlotName;
            if (!warnedRef.latestRecord) {
                console.warn(`[Attendance Fallback] Legacy NULL slot history (latestRecord) detected for TR ${tr || 'unknown'}. Falling back to current slot: ${fallbackSlotName}`);
                warnedRef.latestRecord = true;
            }
        }
        return !isPendingOrUnassignedSlot(slotToCheck);
    }

    if (oldestRecord) {
        const status = String(oldestRecord.PreviousStatus || '').trim().toLowerCase();
        if (status && status !== 'active') return false;
        let slotToCheck = oldestRecord.PreviousSlotName;
        if (!slotToCheck && status === 'active') {
            slotToCheck = fallbackSlotName;
            if (!warnedRef.oldestRecord) {
                console.warn(`[Attendance Fallback] Legacy NULL slot history (oldestRecord) detected for TR ${tr || 'unknown'}. Falling back to current slot: ${fallbackSlotName}`);
                warnedRef.oldestRecord = true;
            }
        }
        return !isPendingOrUnassignedSlot(slotToCheck);
    }

    const status = String(fallbackStatus || '').trim().toLowerCase();
    if (status && status !== 'active') return false;
    return !isPendingOrUnassignedSlot(fallbackSlotName);
}

function decodeHtmlEntities(input = '') {
    return String(input)
        .replace(/&nbsp;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/&#39;/gi, "'")
        .replace(/&quot;/gi, '"');
}

function stripHtmlToLines(html = '') {
    const lineBroken = String(html)
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p>/gi, '\n')
        .replace(/<\/li>/gi, '\n')
        .replace(/<li[^>]*>/gi, '- ');

    const plain = lineBroken.replace(/<[^>]+>/g, '');
    const decoded = decodeHtmlEntities(plain);
    return decoded
        .split(/\r?\n/)
        .map((s) => s.trim())
        .filter(Boolean);
}

function normalizePlannerItem(rawItem, idx = 0) {
    if (!rawItem || typeof rawItem !== 'object') return null;

    const exercise = String(rawItem.exercise || rawItem.name || '').trim();
    const bodyPart = String(rawItem.bodyPart || '').trim();
    const note = String(rawItem.note || '').trim();
    const reps = String(rawItem.reps || '').trim();
    const source = String(rawItem.source || 'manual').trim();
    const sets = Number.isFinite(Number(rawItem.sets)) ? Number(rawItem.sets) : null;
    const durationMinutes = Number.isFinite(Number(rawItem.durationMinutes)) ? Number(rawItem.durationMinutes) : null;

    if (!exercise && !bodyPart && !note) return null;

    return {
        id: String(rawItem.id || `item-${idx + 1}`),
        type: String(rawItem.type || (bodyPart ? 'bodypart' : 'exercise')),
        exercise: exercise.slice(0, 120),
        bodyPart: bodyPart.slice(0, 40),
        sets: sets && sets > 0 ? Math.min(sets, 99) : null,
        reps: reps.slice(0, 40),
        durationMinutes: durationMinutes && durationMinutes > 0 ? Math.min(durationMinutes, 240) : null,
        note: note.slice(0, 255),
        source: source.slice(0, 30)
    };
}

function normalizeDayPlan(rawPlan = {}) {
    const input = rawPlan && typeof rawPlan === 'object' ? rawPlan : {};
    const items = Array.isArray(input.items) ? input.items : [];
    const normalizedItems = items
        .map((item, idx) => normalizePlannerItem(item, idx))
        .filter(Boolean)
        .slice(0, MAX_PLANNER_ITEMS_PER_DAY);

    return {
        schemaVersion: PLANNER_SCHEMA_VERSION,
        items: normalizedItems,
        notes: String(input.notes || '').trim().slice(0, 800)
    };
}

function legacyContentToDayPlan(legacyContent = '') {
    const lines = stripHtmlToLines(legacyContent);
    return {
        schemaVersion: PLANNER_SCHEMA_VERSION,
        items: lines.slice(0, MAX_PLANNER_ITEMS_PER_DAY).map((line, idx) => ({
            id: `legacy-${idx + 1}`,
            type: 'exercise',
            exercise: line.slice(0, 120),
            bodyPart: '',
            sets: null,
            reps: '',
            durationMinutes: null,
            note: '',
            source: 'legacy'
        })),
        notes: ''
    };
}

function parseWorkoutContent(content) {
    const raw = String(content || '').trim();
    if (!raw) return normalizeDayPlan({});

    try {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object' && Array.isArray(parsed.items)) {
            return normalizeDayPlan(parsed);
        }
    } catch (_) {
        // Content is legacy plain/html.
    }

    return legacyContentToDayPlan(raw);
}

function dayPlanHasContent(dayPlan) {
    if (!dayPlan || typeof dayPlan !== 'object') return false;
    const notes = String(dayPlan.notes || '').trim();
    return (Array.isArray(dayPlan.items) && dayPlan.items.length > 0) || notes.length > 0;
}

function validateIncomingPlanPayload(payload) {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new Error('Malformed planner payload.');
    }

    const source = payload.days && typeof payload.days === 'object' && !Array.isArray(payload.days)
        ? payload.days
        : payload;

    const keys = Object.keys(source);
    if (keys.length === 0) throw new Error('Planner payload is empty.');

    const unknownDays = keys.filter((day) => !isValidPlannerDay(day));
    if (unknownDays.length > 0) {
        throw new Error(`Invalid planner day(s): ${unknownDays.join(', ')}`);
    }

    const normalizedByDay = {};
    for (const day of keys) {
        const rawValue = source[day];
        if (typeof rawValue === 'string') {
            normalizedByDay[day] = legacyContentToDayPlan(rawValue);
            continue;
        }
        normalizedByDay[day] = normalizeDayPlan(rawValue);
    }

    const hasContent = Object.values(normalizedByDay).some(dayPlanHasContent);
    if (!hasContent) throw new Error('Planner payload has no exercises or notes.');

    return normalizedByDay;
}

function getMedian(values = []) {
    if (!values.length) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0
        ? (sorted[mid - 1] + sorted[mid]) / 2
        : sorted[mid];
}

async function getCurrentWeekIdForToday() {
    const todayStr = getCurrentDateInIST();
    const weekResult = await pool.request()
        .input('Today', sql.Date, todayStr)
        .query(`
            SELECT TOP 1 WeekID
            FROM AttendanceWeek
            WHERE WeekStartDate <= @Today AND WeekEndDate >= @Today
            ORDER BY WeekID DESC
        `);

    if (weekResult.recordset.length > 0) {
        return weekResult.recordset[0].WeekID;
    }

    return getOrCreateWeekIdByDate(todayStr, pool);
}

function buildEmptyWeekdayMap() {
    return VALID_PLANNER_DAYS.reduce((acc, day) => {
        acc[day] = [];
        return acc;
    }, {});
}

function deriveIntensity(goal = '', medianDuration = 0, daysSinceLastWorkout = 0) {
    const normalizedGoal = String(goal || '').toLowerCase();
    let intensity = 'moderate';

    if (normalizedGoal.includes('strength') || normalizedGoal.includes('muscle')) intensity = 'high';
    if (normalizedGoal.includes('endurance') || normalizedGoal.includes('weight loss')) intensity = 'moderate-high';
    if (medianDuration > 75) intensity = 'high';
    if (daysSinceLastWorkout >= 5) intensity = 'light';

    return intensity;
}

function buildAutoFilledWeek(insights, mode = 'week') {
    const week = {};
    const weekdayHistory = insights?.weekdayHistory || buildEmptyWeekdayMap();
    const durationBaseline = insights?.durationBaseline || {};
    const goal = insights?.fitnessContext?.goal || '';
    const daysSinceLastWorkout = Number(insights?.consistency?.daysSinceLastWorkout || 0);
    const globalTopBodyParts = Object.entries(insights?.recommendations?.bodyPartBalance || {})
        .sort((a, b) => b[1] - a[1])
        .map(([name]) => name);

    const dayList = mode === 'monday_only' ? ['Monday'] : VALID_PLANNER_DAYS;
    for (const day of dayList) {
        const historicalForDay = Array.isArray(weekdayHistory[day]) ? weekdayHistory[day] : [];
        const dayTop = historicalForDay
            .slice(0, 2)
            .map((entry) => entry.bodyPart)
            .filter(Boolean);

        const candidates = [...dayTop, ...globalTopBodyParts].filter(Boolean);
        const uniqueCandidates = [...new Set(candidates)].slice(0, 2);

        const baseline = durationBaseline[day] || {};
        const medianDuration = Number(baseline.median || 45);
        const intensity = deriveIntensity(goal, medianDuration, daysSinceLastWorkout);

        const items = uniqueCandidates.map((bodyPart, idx) => ({
            id: `auto-${day}-${idx + 1}`,
            type: 'bodypart',
            exercise: `${bodyPart} Focus`,
            bodyPart,
            sets: intensity === 'high' ? 4 : 3,
            reps: intensity === 'high' ? '6-10' : '10-12',
            durationMinutes: Math.max(20, Math.round(medianDuration)),
            note: `Auto-suggested from your ${day} history`,
            source: 'autofill'
        }));

        week[day] = normalizeDayPlan({
            schemaVersion: PLANNER_SCHEMA_VERSION,
            items,
            notes: items.length ? '' : 'Recovery / mobility day'
        });
    }

    return week;
}

// ─── V2 Planner Helpers ─────────────────────────────────────────────────────

/**
 * Resolves an exercise by name (case-insensitive). Falls back to inserting
 * a new row under 'General' body part for free-text/custom exercises.
 */
async function resolveExerciseId(name, bodyPart) {
    const cleanName = String(name || '').trim().slice(0, 100);
    if (!cleanName) return null;

    // 1. Try exact match first
    const exactRes = await pool.request()
        .input('Name', sql.NVarChar(100), cleanName)
        .query(`SELECT TOP 1 ExerciseID FROM Exercises WHERE Name = @Name`);
    if (exactRes.recordset.length > 0) return exactRes.recordset[0].ExerciseID;

    // 2. Try case-insensitive match
    const ciRes = await pool.request()
        .input('Name', sql.NVarChar(100), cleanName)
        .query(`SELECT TOP 1 ExerciseID FROM Exercises WHERE LOWER(Name) = LOWER(@Name)`);
    if (ciRes.recordset.length > 0) return ciRes.recordset[0].ExerciseID;

    // 3. Auto-insert under matched body part or 'General'
    const bpName = String(bodyPart || 'General').trim().slice(0, 25);
    const bpRes = await pool.request()
        .input('BPName', sql.NVarChar(25), bpName)
        .query(`SELECT TOP 1 BodyPartID FROM BodyParts WHERE Name = @BPName`);

    let bodyPartID;
    if (bpRes.recordset.length > 0) {
        bodyPartID = bpRes.recordset[0].BodyPartID;
    } else {
        // Ensure 'General' exists
        const genRes = await pool.request()
            .query(`
                MERGE BodyParts AS t USING (SELECT 'General' AS Name) AS s ON t.Name = s.Name
                WHEN NOT MATCHED THEN INSERT (Name) VALUES ('General');
                SELECT BodyPartID FROM BodyParts WHERE Name = 'General';
            `);
        bodyPartID = genRes.recordset[0].BodyPartID;
    }

    const insertRes = await pool.request()
        .input('Name', sql.NVarChar(100), cleanName)
        .input('BodyPartID', sql.Int, bodyPartID)
        .query(`
            INSERT INTO Exercises (Name, BodyPartID, Difficulty, IsActive, CreatedAt)
            OUTPUT INSERTED.ExerciseID
            VALUES (@Name, @BodyPartID, 'Beginner', 1, GETDATE());
        `);
    return insertRes.recordset[0].ExerciseID;
}

/**
 * Gets or creates the student's single active WorkoutProgram.
 */
async function getOrCreateActiveProgram(TR, Branch, Gender) {
    const res = await pool.request()
        .input('TR', sql.Int, TR)
        .input('Branch', sql.NVarChar(50), Branch)
        .input('Gender', sql.NVarChar(50), Gender)
        .query(`
            MERGE WorkoutPrograms AS target
            USING (
                SELECT @TR AS TR, @Branch AS Branch, @Gender AS Gender
            ) AS source
            ON target.TR = source.TR
               AND target.Branch = source.Branch
               AND target.Gender = source.Gender
               AND target.IsActive = 1
            WHEN NOT MATCHED THEN
                INSERT (TR, ProgramName, Description, IsActive, CreatedAt, Branch, Gender)
                VALUES (@TR, 'My Weekly Plan', 'Auto-generated personal plan', 1, GETDATE(), @Branch, @Gender);

            SELECT ProgramID FROM WorkoutPrograms
            WHERE TR = @TR AND Branch = @Branch AND Gender = @Gender AND IsActive = 1;
        `);
    return res.recordset[0].ProgramID;
}

/**
 * Gets or creates a WorkoutWeeks row. WeekNumber = AttendanceWeek.WeekID.
 */
async function upsertV2Week(programID, weekNumber) {
    const res = await pool.request()
        .input('ProgramID', sql.Int, programID)
        .input('WeekNumber', sql.Int, weekNumber)
        .query(`
            MERGE WorkoutWeeks AS target
            USING (
                SELECT @ProgramID AS ProgramID, @WeekNumber AS WeekNumber
            ) AS source
            ON target.ProgramID = source.ProgramID AND target.WeekNumber = source.WeekNumber
            WHEN NOT MATCHED THEN
                INSERT (ProgramID, WeekNumber, Theme)
                VALUES (@ProgramID, @WeekNumber, NULL);

            SELECT WeekID FROM WorkoutWeeks
            WHERE ProgramID = @ProgramID AND WeekNumber = @WeekNumber;
        `);
    return res.recordset[0].WeekID;
}

/**
 * Upserts WorkoutDays + PlannedExercises for a full week plan.
 */
async function upsertV2Days(weekIDV2, planByDay) {
    for (const [day, dayPlan] of Object.entries(planByDay)) {
        if (!isValidPlannerDay(day)) continue;
        const normalized = normalizeDayPlan(dayPlan);
        const hasContent = dayPlanHasContent(normalized);

        // Upsert the day row
        const dayRes = await pool.request()
            .input('WeekID', sql.Int, weekIDV2)
            .input('DayName', sql.NVarChar(20), day)
            .input('OrderIndex', sql.Int, VALID_PLANNER_DAYS.indexOf(day))
            .input('Notes', sql.NVarChar(500), normalized.notes.slice(0, 500))
            .query(`
                MERGE WorkoutDays AS target
                USING (SELECT @WeekID AS WeekID, @DayName AS DayName) AS source
                ON target.WeekID = source.WeekID AND target.DayName = source.DayName
                WHEN MATCHED THEN
                    UPDATE SET Notes = @Notes, OrderIndex = @OrderIndex
                WHEN NOT MATCHED THEN
                    INSERT (WeekID, DayName, OrderIndex, Notes)
                    VALUES (@WeekID, @DayName, @OrderIndex, @Notes);

                SELECT DayID FROM WorkoutDays
                WHERE WeekID = @WeekID AND DayName = @DayName;
            `);

        const dayID = dayRes.recordset[0].DayID;

        // Clear old exercises for this day then re-insert current ones
        await pool.request()
            .input('DayID', sql.Int, dayID)
            .query(`DELETE FROM PlannedExercises WHERE DayID = @DayID`);

        if (!hasContent || !normalized.items.length) continue;

        for (let idx = 0; idx < normalized.items.length; idx++) {
            const item = normalized.items[idx];
            const exerciseID = await resolveExerciseId(
                item.exercise || item.bodyPart,
                item.bodyPart
            );
            if (!exerciseID) continue;

            await pool.request()
                .input('DayID', sql.Int, dayID)
                .input('ExerciseID', sql.Int, exerciseID)
                .input('TargetSets', sql.Int, item.sets || null)
                .input('TargetReps', sql.NVarChar(20), item.reps || null)
                .input('TargetDurationMinutes', sql.Int, item.durationMinutes || null)
                .input('OrderIndex', sql.Int, idx + 1)
                .input('Notes', sql.NVarChar(255), item.note || null)
                .input('Source', sql.NVarChar(30), item.source || 'manual')
                .query(`
                    INSERT INTO PlannedExercises
                        (DayID, ExerciseID, TargetSets, TargetReps, TargetDurationMinutes, OrderIndex, Notes, Source)
                    VALUES
                        (@DayID, @ExerciseID, @TargetSets, @TargetReps, @TargetDurationMinutes, @OrderIndex, @Notes, @Source);
                `);
        }
    }
}

/**
 * Main orchestrator: save a week's plan to V2 tables.
 */
async function upsertPlannerV2({ TR, Branch, Gender, WeekID, planByDay }) {
    const programID = await getOrCreateActiveProgram(TR, Branch, Gender);
    const weekIDV2 = await upsertV2Week(programID, WeekID);
    await upsertV2Days(weekIDV2, planByDay);
}

/**
 * Read back a week's plan from V2 tables.
 * Returns the same [{Day, Plan: {items, notes}}] shape the frontend expects.
 */
async function readPlannerV2({ TR, Branch, Gender, WeekID }) {
    const res = await pool.request()
        .input('TR', sql.Int, TR)
        .input('Branch', sql.NVarChar(50), Branch)
        .input('Gender', sql.NVarChar(50), Gender)
        .input('WeekNumber', sql.Int, WeekID)
        .query(`
            SELECT
                wd.DayName AS Day,
                wd.Notes   AS DayNotes,
                wd.DayID,
                pe.PlannedID,
                pe.OrderIndex,
                pe.TargetSets,
                pe.TargetReps,
                pe.TargetDurationMinutes,
                pe.Notes  AS ItemNote,
                pe.Source,
                e.Name    AS ExerciseName,
                bp.Name   AS BodyPartName
            FROM WorkoutPrograms wp
            JOIN WorkoutWeeks ww ON ww.ProgramID = wp.ProgramID
                AND ww.WeekNumber = @WeekNumber
            JOIN WorkoutDays wd ON wd.WeekID = ww.WeekID
            LEFT JOIN PlannedExercises pe ON pe.DayID = wd.DayID
            LEFT JOIN Exercises e ON e.ExerciseID = pe.ExerciseID
            LEFT JOIN BodyParts bp ON bp.BodyPartID = e.BodyPartID
            WHERE wp.TR = @TR
              AND wp.Branch = @Branch
              AND wp.Gender = @Gender
              AND wp.IsActive = 1
            ORDER BY wd.OrderIndex, pe.OrderIndex;
        `);

    // Group rows by day
    const dayMap = {};
    for (const row of res.recordset) {
        if (!dayMap[row.Day]) {
            dayMap[row.Day] = {
                Day: row.Day,
                Plan: { schemaVersion: PLANNER_SCHEMA_VERSION, items: [], notes: row.DayNotes || '' }
            };
        }
        if (row.PlannedID) {
            dayMap[row.Day].Plan.items.push({
                id: `pe-${row.PlannedID}`,
                type: row.BodyPartName ? 'bodypart' : 'exercise',
                exercise: row.ExerciseName || '',
                bodyPart: row.BodyPartName || '',
                sets: row.TargetSets || null,
                reps: row.TargetReps || '',
                durationMinutes: row.TargetDurationMinutes || null,
                note: row.ItemNote || '',
                source: row.Source || 'manual'
            });
        }
    }

    // Return all days in order, falling back to empty plan for days with no saved data
    return VALID_PLANNER_DAYS.map((day) => dayMap[day] || {
        Day: day,
        Plan: normalizeDayPlan({})
    });
}
// ─────────────────────────────────────────────────────────────────────────────

async function getPlannerInsights(TR) {
    const [weekdayHistoryRes, durationsRes, adherenceRes, profileRes, weightRes, testsRes, achievementRes, lastWorkoutRes] = await Promise.all([
        pool.request()
            .input('TR', sql.Int, TR)
            .query(`
                SELECT
                    B.Name AS BodyPart,
                    P.CreatedAt
                FROM TrainingPlan P
                JOIN TrainingLog L ON P.PlanID = L.PlanID
                JOIN BodyParts B ON L.BodyPartID = B.BodyPartID
                WHERE P.TR = @TR
                  AND P.CreatedAt >= DATEADD(WEEK, -8, SYSUTCDATETIME());
            `),
        pool.request()
            .input('TR', sql.Int, TR)
            .query(`
                SELECT CreatedAt, DurationInMinutes
                FROM Attendance
                WHERE TR = @TR
                  AND DurationInMinutes IS NOT NULL
                  AND DurationInMinutes > 0
                  AND CreatedAt >= DATEADD(WEEK, -8, SYSUTCDATETIME());
            `),
        pool.request()
            .input('TR', sql.Int, TR)
            .query(`
                SELECT TOP 8
                    W.WeekID,
                    W.WeekStartDate,
                    W.WeekEndDate,
                    ISNULL(P.PlannedDays, 0) AS PlannedDays,
                    ISNULL(C.CompletedDays, 0) AS CompletedDays
                FROM AttendanceWeek W
                OUTER APPLY (
                    -- V2: count days via WorkoutPrograms -> WorkoutWeeks -> WorkoutDays
                    SELECT COUNT(DISTINCT wd.DayName) AS PlannedDays
                    FROM WorkoutPrograms wp
                    JOIN WorkoutWeeks ww ON ww.ProgramID = wp.ProgramID
                        AND ww.WeekNumber = W.WeekID
                    JOIN WorkoutDays wd ON wd.WeekID = ww.WeekID
                    JOIN PlannedExercises pe ON pe.DayID = wd.DayID
                    WHERE wp.TR = @TR AND wp.IsActive = 1
                ) P
                OUTER APPLY (
                    SELECT COUNT(DISTINCT CAST(DATEADD(MINUTE, 330, TP.CreatedAt) AS DATE)) AS CompletedDays
                    FROM TrainingPlan TP
                    WHERE TP.TR = @TR
                      AND CAST(DATEADD(MINUTE, 330, TP.CreatedAt) AS DATE) BETWEEN W.WeekStartDate AND W.WeekEndDate
                ) C
                WHERE W.WeekEndDate <= CAST(DATEADD(MINUTE, 330, SYSUTCDATETIME()) AS DATE)
                ORDER BY W.WeekStartDate DESC;
            `),
        pool.request()
            .input('TR', sql.Int, TR)
            .query(`
                SELECT Goal, FitnessLevel, CurrentXP
                FROM TestMaster
                WHERE TR = @TR;
            `),
        pool.request()
            .input('TR', sql.Int, TR)
            .query(`
                SELECT TOP 6 Weight, CreatedAt
                FROM WeightTracking
                WHERE TR = @TR
                ORDER BY CreatedAt DESC;
            `),
        pool.request()
            .input('TR', sql.Int, TR)
            .query(`
                SELECT TOP 6 BMI, BodyFat, Weight, CreatedAt
                FROM TestRecords
                WHERE TR = @TR
                ORDER BY CreatedAt DESC;
            `),
        pool.request()
            .input('TR', sql.Int, TR)
            .query(`
                SELECT TOP 5 A.AchievementName, SA.DateEarned
                FROM StudentAchievements SA
                JOIN Achievements A ON A.AchievementID = SA.AchievementID
                WHERE SA.TR = @TR
                ORDER BY SA.DateEarned DESC;
            `),
        pool.request()
            .input('TR', sql.Int, TR)
            .query(`
                SELECT TOP 1 CreatedAt
                FROM TrainingPlan
                WHERE TR = @TR
                ORDER BY CreatedAt DESC;
            `)
    ]);

    const weekdayHistory = buildEmptyWeekdayMap();
    const weekdayBodyPartAccumulator = buildEmptyWeekdayMap();
    for (const row of weekdayHistoryRes.recordset) {
        if (!row.CreatedAt) continue;
        const day = moment.tz(row.CreatedAt, "Asia/Kolkata").format('dddd');
        if (!isValidPlannerDay(day)) continue;
        const bodyPart = String(row.BodyPart || '').trim();
        if (!bodyPart) continue;

        const map = weekdayBodyPartAccumulator[day];
        const existing = map.find((entry) => entry.bodyPart === bodyPart);
        if (existing) {
            existing.count += 1;
            if (!existing.lastTrainedAt || row.CreatedAt > existing.lastTrainedAt) {
                existing.lastTrainedAt = row.CreatedAt;
            }
        } else {
            map.push({
                bodyPart,
                count: 1,
                lastTrainedAt: row.CreatedAt
            });
        }
    }
    for (const day of VALID_PLANNER_DAYS) {
        weekdayHistory[day] = weekdayBodyPartAccumulator[day].sort((a, b) => b.count - a.count);
    }

    const weekdayDurations = buildEmptyWeekdayMap();
    for (const row of durationsRes.recordset) {
        if (!row.CreatedAt) continue;
        const day = moment.tz(row.CreatedAt, "Asia/Kolkata").format('dddd');
        if (!isValidPlannerDay(day)) continue;
        weekdayDurations[day].push(Number(row.DurationInMinutes || 0));
    }

    const durationBaseline = {};
    for (const day of VALID_PLANNER_DAYS) {
        const values = weekdayDurations[day].filter((v) => v > 0);
        if (!values.length) {
            durationBaseline[day] = { min: 0, max: 0, avg: 0, median: 0 };
            continue;
        }
        const sum = values.reduce((a, b) => a + b, 0);
        durationBaseline[day] = {
            min: Math.min(...values),
            max: Math.max(...values),
            avg: Number((sum / values.length).toFixed(1)),
            median: Number(getMedian(values).toFixed(1))
        };
    }

    const weeklyAdherence = adherenceRes.recordset
        .map((row) => {
            const planned = Number(row.PlannedDays || 0);
            const completed = Number(row.CompletedDays || 0);
            return {
                weekID: row.WeekID,
                weekStartDate: row.WeekStartDate,
                weekEndDate: row.WeekEndDate,
                plannedDays: planned,
                completedDays: completed,
                adherencePct: planned > 0 ? Number(((completed / planned) * 100).toFixed(1)) : 0
            };
        })
        .reverse();

    const profile = profileRes.recordset[0] || {};
    const latestWeight = weightRes.recordset[0] || null;
    const oldestWeight = weightRes.recordset[weightRes.recordset.length - 1] || null;
    const weightDelta = latestWeight && oldestWeight
        ? Number((Number(latestWeight.Weight) - Number(oldestWeight.Weight)).toFixed(2))
        : 0;

    const latestTest = testsRes.recordset[0] || null;
    const oldestTest = testsRes.recordset[testsRes.recordset.length - 1] || null;
    const bmiDelta = latestTest && oldestTest
        ? Number((Number(latestTest.BMI) - Number(oldestTest.BMI)).toFixed(2))
        : 0;
    const bodyFatDelta = latestTest && oldestTest
        ? Number((Number(latestTest.BodyFat) - Number(oldestTest.BodyFat)).toFixed(2))
        : 0;

    const lastWorkoutAt = lastWorkoutRes.recordset[0]?.CreatedAt || null;
    const daysSinceLastWorkout = lastWorkoutAt
        ? moment.tz("Asia/Kolkata").startOf('day').diff(moment.tz(lastWorkoutAt, "Asia/Kolkata").startOf('day'), 'days')
        : null;

    const bodyPartBalance = {};
    for (const day of VALID_PLANNER_DAYS) {
        for (const row of weekdayHistory[day]) {
            bodyPartBalance[row.bodyPart] = (bodyPartBalance[row.bodyPart] || 0) + Number(row.count || 0);
        }
    }

    return {
        generatedAt: new Date().toISOString(),
        weekdayHistory,
        durationBaseline,
        consistency: {
            weeklyAdherence,
            daysSinceLastWorkout
        },
        fitnessContext: {
            goal: profile.Goal || null,
            fitnessLevel: profile.FitnessLevel || 1,
            currentXP: profile.CurrentXP || 0,
            latestWeight: latestWeight ? Number(latestWeight.Weight) : null,
            weightDelta,
            bmiDelta,
            bodyFatDelta,
            recentAchievements: achievementRes.recordset.map((row) => ({
                name: row.AchievementName,
                dateEarned: row.DateEarned
            }))
        },
        recommendations: {
            bodyPartBalance
        }
    };
}

async function savePlannerPayloadForCurrentWeek({ TR, Branch, Gender, payload }) {
    const planByDay = validateIncomingPlanPayload(payload);
    const currentWeekID = await getCurrentWeekIdForToday();

    await upsertPlannerV2({
        TR,
        Branch,
        Gender,
        WeekID: currentWeekID,
        planByDay
    });

    return { currentWeekID, planByDay };
}

// readStructuredPlannerForWeek replaced by readPlannerV2() above


// Helper functions from server.js will go here
// (HELPER FUNCTION) to find or create a week for a given date
const getOrCreateWeekIdByDate = async (date, transactionOrPool) => {
    const request = transactionOrPool.request();

    // moment.js calculates the start and end of the week (ISO week: Monday to Sunday)
    const leaveDate = moment(date).startOf('day');
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


async function computeStudentLeaveSummary(TR) {
    const now = moment.tz("Asia/Kolkata");
    const startOfMonth = now.clone().startOf('month');
    const endOfMonth = now.clone().endOf('month');

    const result = await pool.request()
        .input('TR', sql.Int, TR)
        .query(`
            SELECT LeaveID, Reason,
                   LeaveStartDate, LeaveEndDate,
                   Status, Remarks,
                   RequestedAt
            FROM LeaveRequests
            WHERE TR = @TR
            ORDER BY RequestedAt DESC
        `);

    let approvedLeaveDaysThisMonth = 0;
    const currentMonthRequests = [];
    const historyRequests = [];

    result.recordset.forEach(request => {
        const leaveStart = moment.tz(request.LeaveStartDate, "Asia/Kolkata").startOf('day');
        const leaveEnd = moment.tz(request.LeaveEndDate, "Asia/Kolkata").startOf('day');

        // Split into current month + history
        if (leaveStart.isBetween(startOfMonth, endOfMonth, null, '[]')) {
            currentMonthRequests.push(request);
        } else {
            historyRequests.push(request);
        }

        // Count approved days -- skip system-generated bulk leaves
        if (request.Status === 'Approved') {
            const isBulk = request.Remarks && request.Remarks.includes('Bulk Leaves');
            if (!isBulk) {
                let current = leaveStart.clone();
                while (current.isSameOrBefore(leaveEnd, 'day')) {
                    if (current.isBetween(startOfMonth, endOfMonth, null, '[]')) {
                        approvedLeaveDaysThisMonth++;
                    }
                    current.add(1, 'day');
                }
            }
        }
    });

    return {
        success: true,
        leavesTaken: approvedLeaveDaysThisMonth,
        leavesRemaining: 4 - approvedLeaveDaysThisMonth,
        currentMonthRequests,
        historyRequests
    };
}


async function computeWeightHistory(TR) {
    const result = await pool.request()
        .input('TR', sql.Int, TR)
        .query(`
            SELECT 
                LogID,
                Weight,
                FORMAT(CreatedAt, 'ddd, dd MMM yyyy') AS FormattedDate,
                CreatedAt
            FROM WeightTracking
            WHERE TR = @TR
            ORDER BY CreatedAt DESC
        `);

    return {
        success: true,
        data: result.recordset
    };
}


// =================================================================== //
// --- 🏆 ACHIEVEMENT PROGRESS (THE "GAME MODE" ENGINE) ---
// =================================================================== //

// This single  calculates and returns the student's live progress for all achievements.


/**
 * Checks if a gap between two dates is "bridged" by Sundays or approved leave days.
 * @param {moment.Moment} newerDate - The more recent date (e.g., today).
 * @param {moment.Moment} olderDate - The less recent date (e.g., last workout).
 * @param {Set<string>} leaveDateSet - A Set of 'OnLeave' dates in 'YYYY-MM-DD' format.
 * @returns {boolean} - True if the gap is 1 day or less, or if all days in the gap are Sundays or leave days.
 */
function isGapExcused(newerDate, olderDate, leaveDateSet) {
    const gapDays = newerDate.clone().startOf('day').diff(olderDate.clone().startOf('day'), 'days');

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
    
    // now returns a simple score out of a target of 8.
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


// --- Paste all the routes from the list below here ---

// ---- 📈 Main Dashboard & Stats (XP, Level, Tips)


router.get('/api/student/achievements/progress', cacheMiddleware(req => `ach_${req.session.user?.TR}`, 60), async (req, res) => {
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

router.get(
  '/api/leaderboard',
  cacheMiddleware(req =>
    `leaderboard_${req.session.user?.Branch}_${req.session.user?.Gender}`,
    300
  ),
  async (req, res, next) => {
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
            FROM TestMaster M
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

router.post('/api/student/set-goal', async (req, res) => {
    if (!req.session.user || !req.session.user.TR) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    const { TR } = req.session.user;
    const { goal } = req.body;

    if (!goal) {
        return res.status(400).json({ success: false, message: 'Goal is required' });
    }

    try {
        await pool.request()
            .input('TR', sql.Int, TR)
            .input('Goal', sql.NVarChar(50), goal)
            .query('UPDATE TestMaster SET Goal = @Goal WHERE TR = @TR');
        
        // Update session user object as well
        req.session.user.Goal = goal;
        
        res.json({ success: true, message: 'Goal updated successfully' });
    } catch (err) {
        console.error("Error updating goal:", err);
        res.status(500).json({ success: false, message: 'Failed to update goal' });
    }
});

router.post('/api/student/log-weight', async (req, res) => {
    if (!req.session.user?.TR)
        return res.status(401).json({ success: false, message: 'Unauthorized' });

    const { TR } = req.session.user;
    const { weight } = req.body;

    if (!weight || isNaN(weight) || weight <= 0) {
        return res.status(400).json({ success: false, message: 'Invalid weight value.' });
    }

    try {
        await pool.request()
            .input('TR', sql.Int, TR)
            .input('Weight', sql.Decimal(5, 2), parseFloat(weight))
            .query(`INSERT INTO WeightTracking (TR, Weight) VALUES (@TR, @Weight)`);

        // Invalidate old cache
        cache.del(`wh_${TR}`);
        cache.del(`fit_history_${TR}`);

        // Recompute summary and set new cache
        const summary = await computeWeightHistory(TR);
        cache.set(`wh_${TR}`, summary, 120);

        res.json({ success: true });
    } catch (err) {
        console.error('Error logging weight:', err);
        res.status(500).json({ success: false, message: 'Database error' });
    }
});



// Gets all ad-hoc weight logs for the current student
router.get(
  '/api/student/weight-history',
  (req, res, next) => {
    res.set('Cache-Control', 'no-store'); 
    next();
  },
  cacheMiddleware(req => `wh_${req.session.user?.TR}`, 120),
  async (req, res) => {

    if (!req.session.user?.TR)
        return res.status(401).json({ success: false, message: 'Unauthorized' });

    try {
        const summary = await computeWeightHistory(req.session.user.TR);
        res.json(summary);
    } catch (err) {
        console.error('Error fetching weight history:', err);
        res.status(500).json({ success: false, message: 'Database error' });
    }
});



router.delete('/api/student/log-weight/:id', async (req, res) => {
    if (!req.session.user?.TR)
        return res.status(401).json({ success: false, message: 'Unauthorized' });

    const { TR } = req.session.user;
    const { id } = req.params;

    try {
        const result = await pool.request()
            .input('LogID', sql.Int, id)
            .input('TR', sql.Int, TR)
            .query(`
                DELETE FROM WeightTracking 
                WHERE LogID = @LogID AND TR = @TR
            `);

        if (result.rowsAffected[0] === 0) {
            return res.status(404).json({ success: false, message: 'Log not found or unauthorized.' });
        }

        // Invalidate cache
        cache.del(`wh_${TR}`);
        cache.del(`fit_history_${TR}`);

        // Recompute and update cache
        const summary = await computeWeightHistory(TR);
        cache.set(`wh_${TR}`, summary, 120);

        res.json({ success: true });

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
            .query(`UPDATE TestMaster SET Height = @Height WHERE TR = @TR`);

        res.json({ success: true, message: 'Height updated!', newHeight: heightInM });
    } catch (err) {
        console.error('Error setting height:', err);
        res.status(500).json({ success: false, message: 'Database error' });
    }
});

// Now combines data from TestRecords AND WeightTracking for a complete chart
router.get(
  '/api/student/fitness-test-history',
  cacheMiddleware(req => `fit_history_${req.session.user?.TR}`, 300),
  async (req, res) => {
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


router.get(
  '/api/student/planner/insights',
  cacheMiddleware(req => `planner_insights_${req.session.user?.TR}`, 120),
  async (req, res) => {
    try {
      if (!req.session.user?.TR) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
      }

      const insights = await getPlannerInsights(req.session.user.TR);
      res.json({ success: true, data: insights });
    } catch (err) {
      console.error('Planner insights error:', err);
      res.status(500).json({ success: false, message: 'Failed to build planner insights' });
    }
  }
);

router.post('/api/save-workout-plan', async (req, res) => {
  try {
    const { TR, Branch, Gender } = req.session.user || {};
    if (!TR || !Branch || !Gender) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const { currentWeekID } = await savePlannerPayloadForCurrentWeek({
      TR,
      Branch,
      Gender,
      payload: req.body
    });

    cache.del(`workout_${TR}`);
    cache.del(`planner_insights_${TR}`);

    res.json({
      success: true,
      currentWeekID,
      schemaVersion: PLANNER_SCHEMA_VERSION
    });
  } catch (err) {
    const message = err?.message || 'Workout plan save failed';
    const status = message.toLowerCase().includes('invalid') || message.toLowerCase().includes('payload')
      ? 400
      : 500;
    console.error('Save error:', err);
    res.status(status).json({ success: false, message });
  }
});

router.get(
  '/api/student/workout-plan',
  cacheMiddleware(req => `workout_${req.session.user?.TR}`, 60),
  async (req, res) => {
    try {
      if (!req.session.user) {
        return res.status(401).json({ success: false, message: "Unauthorized. Please log in." });
      }

      const { TR, Branch, Gender } = req.session.user;
      if (!TR || !Branch || !Gender) {
        return res.status(401).json({ success: false, message: "Unauthorized" });
      }

      const currentWeekID = await getCurrentWeekIdForToday();
      const data = await readPlannerV2({ TR, Branch, Gender, WeekID: currentWeekID });
      const insights = await getPlannerInsights(TR);

      res.json({
        success: true,
        currentWeekID,
        schemaVersion: PLANNER_SCHEMA_VERSION,
        data,
        hasCurrentWeek: data.some((day) => dayPlanHasContent(day.Plan)),
        insightsSummary: {
          generatedAt: insights.generatedAt,
          consistency: insights.consistency,
          fitnessContext: insights.fitnessContext
        }
      });
    } catch (err) {
      console.error('Workout GET error:', err);
      res.status(500).json({ success: false, message: 'Failed to load workout plan' });
    }
  }
);

router.post('/api/student/apply-last-week', async (req, res) => {
  try {
    const { TR, Branch, Gender } = req.session.user || {};
    if (!TR || !Branch || !Gender) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const currentWeekID = await getCurrentWeekIdForToday();

    // Read last week's plan from V2 tables
    let planByDay = null;
    try {
        const programRes = await pool.request()
            .input('TR', sql.Int, TR)
            .input('Branch', sql.NVarChar(50), Branch)
            .input('Gender', sql.NVarChar(50), Gender)
            .query(`
                SELECT TOP 1 wp.ProgramID
                FROM WorkoutPrograms wp
                WHERE wp.TR = @TR AND wp.Branch = @Branch AND wp.Gender = @Gender AND wp.IsActive = 1;
            `);

        if (programRes.recordset.length > 0) {
            const programID = programRes.recordset[0].ProgramID;
            // Find the most recent week that is NOT the current one
            const prevWeekRes = await pool.request()
                .input('ProgramID', sql.Int, programID)
                .input('CurrentWeekID', sql.Int, currentWeekID)
                .query(`
                    SELECT TOP 1 ww.WeekID AS V2WeekID, ww.WeekNumber
                    FROM WorkoutWeeks ww
                    JOIN WorkoutDays wd ON wd.WeekID = ww.WeekID
                    JOIN PlannedExercises pe ON pe.DayID = wd.DayID
                    WHERE ww.ProgramID = @ProgramID
                      AND ww.WeekNumber <> @CurrentWeekID
                    GROUP BY ww.WeekID, ww.WeekNumber
                    HAVING COUNT(pe.PlannedID) > 0
                    ORDER BY ww.WeekNumber DESC;
                `);

            if (prevWeekRes.recordset.length > 0) {
                const prevV2WeekID = prevWeekRes.recordset[0].V2WeekID;
                const prevWeekData = await pool.request()
                    .input('WeekID', sql.Int, prevV2WeekID)
                    .query(`
                        SELECT wd.DayName,
                               pe.TargetSets, pe.TargetReps, pe.TargetDurationMinutes,
                               pe.Notes, pe.Source, pe.OrderIndex,
                               e.Name AS ExerciseName,
                               bp.Name AS BodyPartName
                        FROM WorkoutDays wd
                        JOIN PlannedExercises pe ON pe.DayID = wd.DayID
                        JOIN Exercises e ON e.ExerciseID = pe.ExerciseID
                        JOIN BodyParts bp ON bp.BodyPartID = e.BodyPartID
                        WHERE wd.WeekID = @WeekID
                        ORDER BY wd.OrderIndex, pe.OrderIndex;
                    `);

                planByDay = {};
                for (const row of prevWeekData.recordset) {
                    if (!planByDay[row.DayName]) planByDay[row.DayName] = { items: [], notes: '' };
                    planByDay[row.DayName].items.push({
                        id: `copy-${row.DayName}-${row.OrderIndex}`,
                        type: 'exercise',
                        exercise: row.ExerciseName,
                        bodyPart: row.BodyPartName,
                        sets: row.TargetSets,
                        reps: row.TargetReps || '',
                        durationMinutes: row.TargetDurationMinutes,
                        note: row.Notes || '',
                        source: 'copied'
                    });
                }
            }
        }
    } catch (readErr) {
        console.warn('apply-last-week: could not read previous V2 plan, falling back to autofill.', readErr.message);
    }

    if (!planByDay || Object.keys(planByDay).length === 0) {
        const insights = await getPlannerInsights(TR);
        planByDay = buildAutoFilledWeek(insights, 'week');
    }

    await upsertPlannerV2({
        TR,
        Branch,
        Gender,
        WeekID: currentWeekID,
        planByDay
    });

    cache.del(`workout_${TR}`);
    cache.del(`planner_insights_${TR}`);

    res.json({ success: true, currentWeekID, data: planByDay });
  } catch (err) {
    console.error('Apply last week error:', err);
    res.status(500).json({ success: false, message: "Failed to apply last week plan" });
  }
});

// --------- Planner V2 Bridge Endpoints

router.get('/api/student/planner/v2', async (req, res) => {
  if (!req.session.user?.TR) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }
  return res.redirect(307, '/api/student/workout-plan');
});

router.post('/api/student/planner/v2', async (req, res) => {
  if (!req.session.user?.TR) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }
  return res.redirect(307, '/api/save-workout-plan');
});

router.post('/api/student/planner/v2/autofill', async (req, res) => {
  try {
    const { TR, Branch, Gender } = req.session.user || {};
    if (!TR || !Branch || !Gender) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const mode = String(req.body?.mode || 'week').toLowerCase();
    const insights = await getPlannerInsights(TR);
    const currentWeekID = await getCurrentWeekIdForToday();
    const planByDay = buildAutoFilledWeek(insights, mode === 'monday' ? 'monday_only' : 'week');

    await upsertPlannerV2({
      TR,
      Branch,
      Gender,
      WeekID: currentWeekID,
      planByDay
    });

    cache.del(`workout_${TR}`);
    cache.del(`planner_insights_${TR}`);

    res.json({ success: true, currentWeekID, data: planByDay });
  } catch (err) {
    console.error('Planner auto-fill error:', err);
    res.status(500).json({ success: false, message: 'Failed to auto-fill planner' });
  }
});

router.post('/api/student/planner/v2/complete-item', async (req, res) => {
  const { TR, Branch, Gender } = req.session.user || {};
  if (!TR || !Branch || !Gender) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  const bodyPart = String(req.body?.bodyPart || '').trim();
  if (!bodyPart) {
    return res.status(400).json({ success: false, message: 'bodyPart is required.' });
  }

  const transaction = new sql.Transaction(pool);
  try {
    await transaction.begin();

    const planInsert = await new sql.Request(transaction)
      .input('TR', sql.Int, TR)
      .input('Branch', sql.NVarChar(50), Branch)
      .input('Gender', sql.NVarChar(50), Gender)
      .query(`
        INSERT INTO TrainingPlan (TR, Branch, Gender, CreatedAt)
        OUTPUT INSERTED.PlanID
        VALUES (@TR, @Branch, @Gender, GETUTCDATE());
      `);

    const planID = planInsert.recordset[0].PlanID;

    const logInsert = await new sql.Request(transaction)
      .input('PlanID', sql.Int, planID)
      .input('BodyPartName', sql.NVarChar(50), bodyPart)
      .query(`
        INSERT INTO TrainingLog (PlanID, BodyPartID)
        SELECT @PlanID, BodyPartID
        FROM BodyParts
        WHERE Name = @BodyPartName;
      `);

    if (!logInsert.rowsAffected[0]) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: 'Unknown body part.' });
    }

    await transaction.commit();
    cache.del(`planner_insights_${TR}`);

    res.json({ success: true, planID, bodyPart });
  } catch (err) {
    if (transaction._aborted === false) await transaction.rollback();
    console.error('Complete planner item error:', err);
    res.status(500).json({ success: false, message: 'Failed to complete planner item.' });
  }
});

router.get(
  '/api/student/training-plans',
  cacheMiddleware(req => `train_plans_${req.session.user?.TR}`, 120),
  async (req, res) => {
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

router.get(
  '/api/student/training-analytics',
  cacheMiddleware(req => `train_analytics_${req.session.user?.TR}`, 300),
  async (req, res, next) => {
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
    } catch (err) {
        console.error('❌ Error fetching workout body part trends:', err);
        next(err);
    }
});


// for the Workout Consistency Heatmap
router.get(
  '/api/student/workout-calendar',
  cacheMiddleware(req => `workout_calendar_${req.session.user?.TR}`, 21600),
  async (req, res) => {
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


// NEW: Fetches ONLY data for the "Overview" tab
router.get(
  '/api/student/analytics/overview',
  cacheMiddleware(req => `analytics_overview_${req.session.user?.TR}`, 300),
  async (req, res) => {
    if (!req.session.user || !req.session.user.TR) {
        return res.status(401).json({ success: false, message: 'Unauthorized.' });
    }
    const { TR } = req.session.user;
    const transaction = new sql.Transaction(pool);

    try {
        await transaction.begin();

        // Query 1: Get average workout duration
        const averageResult = await new sql.Request(transaction)
            .input('TR', sql.Int, TR)
            .query(`
                SELECT AVG(CAST(DurationInMinutes AS FLOAT)) as avgDuration 
                FROM Attendance 
                WHERE TR = @TR AND DurationInMinutes > 0;
            `);

        // Query 2: Get total hours per week
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
        
        await transaction.commit();

        res.json({
            success: true,
            data: {
                average: averageResult.recordset[0] ? averageResult.recordset[0].avgDuration : 0,
                weekly: weeklyResult.recordset.reverse()
            }
        });

    } catch (err) {
        await transaction.rollback();
        console.error('Error fetching student overview analytics:', err);
        res.status(500).json({ success: false, message: 'Failed to fetch analytics data' });
    }
});

// NEW: Fetches ONLY data for the "Session History" tab
router.get(
  '/api/student/analytics/history',
  cacheMiddleware(req => `analytics_history_${req.session.user?.TR}`, 180),
  async (req, res) => {
    if (!req.session.user || !req.session.user.TR) {
        return res.status(401).json({ success: false, message: 'Unauthorized.' });
    }
    const { TR } = req.session.user;

    try {
        const [historyResult, statusHistory] = await Promise.all([
            pool.request()
                .input('TR', sql.Int, TR)
                .query(`
                    SELECT TOP 100 CreatedAt, OutTime, DurationInMinutes, AttendanceID
                    FROM Attendance 
                    WHERE TR = @TR AND OutTime IS NOT NULL 
                    ORDER BY AttendanceID DESC;
                `),
            getStudentStatusHistory(pool, TR)
        ]);
        
        res.json({
            success: true,
            data: {
                history: historyResult.recordset,
                statusHistory
            }
        });

    } catch (err) {
        console.error('Error fetching student history analytics:', err);
        res.status(500).json({ success: false, message: 'Failed to fetch analytics data' });
    }
});


// --- 📋 Attendance (Attendance Tab)




router.get(
  '/api/student-attendance/:weekId/me',
  cacheMiddleware(req => `attendance_${req.session.user?.TR}_${req.params.weekId}`, 120),
  async (req, res) => {
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
                    M.Name, M.JoinedAt, S.SlotName,
                    DATENAME(WEEKDAY, DATEADD(MINUTE, 330, A.CreatedAt)) AS DayName,
                    A.IsPresent, A.OnLeave
                FROM TestMaster M
                LEFT JOIN Attendance A ON M.TR = A.TR AND A.WeekID = @WeekID
                LEFT JOIN Slots S ON M.SlotID = S.SlotID
                WHERE M.TR = @TR AND M.JoinedAt <= @WeekEndDate -- <-- THE FIX IS HERE
            `);

        const studentData = result.recordset[0] || { Name: '', JoinedAt: null, SlotName: null };

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
        
        // --- NEW: Mask absences for pending/deactivated days ---
        const historyQuery = await pool.request()
            .input('TR', sql.Int, TR)
            .query(`
                SELECT ChangedAt, PreviousStatus, NewStatus, PreviousSlotName, NewSlotName 
                FROM StudentStatusHistory 
                WHERE TR = @TR 
                ORDER BY ChangedAt ASC
            `);
        
        const history = historyQuery.recordset || [];
        const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const startDate = new Date(WeekStartDate);
        const warnedRef = {}; // Dedup: warn at most once per request for this TR
        
        dayNames.forEach((day, i) => {
            if (record[day] === '') { // Means it wasn't Present or On Leave
                const currentDate = new Date(startDate);
                currentDate.setDate(startDate.getDate() + i);
                currentDate.setHours(23, 59, 59, 999);

                const isExpected = isExpectedAttendanceDay({
                    dateEnd: currentDate,
                    history,
                    fallbackStatus: 'Active',
                    fallbackSlotName: studentData.SlotName,
                    tr: TR,
                    joinedAt: studentData.JoinedAt,
                    warnedRef
                });

                if (!isExpected) {
                    record[day] = 'Not Expected';
                }
            }
        });
        // --- END NEW ---
        
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

router.get(
  '/api/student/attendance-summary/me',
  cacheMiddleware(req => `attendance_summary_${req.session.user?.TR}`, 120),
  async (req, res, next) => {
    if (!req.session.user || !req.session.user.TR) {
        return res.status(401).json({ success: false, message: 'Unauthorized. Please log in.' });
    }

    const { TR } = req.session.user;

    try {
        const studentResult = await pool.request()
            .input('TR', sql.Int, TR)
            .query(`
                SELECT M.JoinedAt, M.Status, S.SlotName
                FROM TestMaster M
                LEFT JOIN Slots S ON M.SlotID = S.SlotID
                WHERE M.TR = @TR
            `);

        if (studentResult.recordset.length === 0) {
            return res.status(401).json({ success: false, message: 'Student record not found.' });
        }

        const student = studentResult.recordset[0];
        const today = moment.tz("Asia/Kolkata").startOf('day');

        if (!student.JoinedAt) {
            return res.json({
                success: true,
                data: {
                    scope: 'sinceJoining',
                    joinedAt: null,
                    throughDate: today.format('YYYY-MM-DD'),
                    present: 0,
                    absent: 0,
                    onLeave: 0,
                    expectedDays: 0,
                    attendanceRate: null,
                    isGymMember: false
                }
            });
        }

        const joinedAt = moment.tz(student.JoinedAt, "Asia/Kolkata").startOf('day');
        const [attendanceResult, historyResult] = await Promise.all([
            pool.request()
                .input('TR', sql.Int, TR)
                .input('JoinedAt', sql.Date, joinedAt.format('YYYY-MM-DD'))
                .input('Tomorrow', sql.Date, today.clone().add(1, 'day').format('YYYY-MM-DD'))
                .query(`
                    SELECT
                        CONVERT(varchar, CAST(DATEADD(MINUTE, 330, CreatedAt) AS date), 23) AS AttendanceDate,
                        MAX(CASE WHEN IsPresent = 1 THEN 1 ELSE 0 END) AS IsPresent,
                        MAX(CASE WHEN OnLeave = 1 THEN 1 ELSE 0 END) AS OnLeave
                    FROM Attendance
                    WHERE TR = @TR
                      AND CAST(DATEADD(MINUTE, 330, CreatedAt) AS date) >= @JoinedAt
                      AND CAST(DATEADD(MINUTE, 330, CreatedAt) AS date) < @Tomorrow
                    GROUP BY CAST(DATEADD(MINUTE, 330, CreatedAt) AS date)
                `),
            pool.request()
                .input('TR', sql.Int, TR)
                .query(`
                    SELECT ChangedAt, PreviousStatus, NewStatus, PreviousSlotName, NewSlotName
                    FROM StudentStatusHistory
                    WHERE TR = @TR
                    ORDER BY ChangedAt ASC
                `)
        ]);

        const attendanceByDate = new Map(
            attendanceResult.recordset.map(row => [
                row.AttendanceDate,
                {
                    isPresent: Boolean(row.IsPresent),
                    onLeave: Boolean(row.OnLeave)
                }
            ])
        );
        const history = historyResult.recordset || [];

        let present = 0;
        let absent = 0;
        let onLeave = 0;
        const cursor = joinedAt.clone();
        const warnedRef = {}; // Dedup: warn at most once per request for this TR

        while (cursor.isSameOrBefore(today, 'day')) {
            const dayOfWeek = cursor.isoWeekday();

            if (dayOfWeek <= 6) {
                const dateEnd = cursor.clone().endOf('day').toDate();
                const isExpected = isExpectedAttendanceDay({
                    dateEnd,
                    history,
                    fallbackStatus: student.Status,
                    fallbackSlotName: student.SlotName,
                    tr: TR,
                    joinedAt: student.JoinedAt,
                    warnedRef
                });

                if (isExpected) {
                    const dateKey = cursor.format('YYYY-MM-DD');
                    const attendance = attendanceByDate.get(dateKey);

                    if (attendance?.isPresent) {
                        present++;
                    } else if (attendance?.onLeave) {
                        onLeave++;
                    } else if (cursor.isBefore(today, 'day')) {
                        absent++;
                    }
                }
            }

            cursor.add(1, 'day');
        }

        const rateDenominator = present + absent;
        const attendanceRate = rateDenominator > 0
            ? Number(((present / rateDenominator) * 100).toFixed(1))
            : null;

        res.json({
            success: true,
            data: {
                scope: 'sinceJoining',
                joinedAt: joinedAt.format('YYYY-MM-DD'),
                throughDate: today.format('YYYY-MM-DD'),
                present,
                absent,
                onLeave,
                expectedDays: present + absent + onLeave,
                attendanceRate,
                isGymMember: true
            }
        });
    } catch (err) {
        next(err);
    }
  }
);

router.get(
  '/api/student/attendance-details/:type',
  cacheMiddleware(req => `attendance_details_${req.session.user?.TR}_${req.params.type}`, 120),
  async (req, res, next) => {
    if (!req.session.user || !req.session.user.TR) {
        return res.status(401).json({ success: false, message: 'Unauthorized. Please log in.' });
    }

    const { TR } = req.session.user;
    const { type } = req.params;

    if (!['present', 'onLeave', 'absent'].includes(type)) {
        return res.status(400).json({ success: false, message: 'Unsupported attendance detail type.' });
    }

    try {
        if (type === 'absent') {
            const studentResult = await pool.request()
                .input('TR', sql.Int, TR)
                .query(`
                    SELECT M.JoinedAt, M.Status, S.SlotName
                    FROM TestMaster M
                    LEFT JOIN Slots S ON M.SlotID = S.SlotID
                    WHERE M.TR = @TR
                `);

            if (studentResult.recordset.length === 0 || !studentResult.recordset[0].JoinedAt) {
                return res.json({ success: true, type, rows: [] });
            }

            const student = studentResult.recordset[0];
            const today = moment.tz("Asia/Kolkata").startOf('day');
            const joinedAt = moment.tz(student.JoinedAt, "Asia/Kolkata").startOf('day');

            const [attendanceResult, historyResult] = await Promise.all([
                pool.request()
                    .input('TR', sql.Int, TR)
                    .input('JoinedAt', sql.Date, joinedAt.format('YYYY-MM-DD'))
                    .input('Tomorrow', sql.Date, today.clone().add(1, 'day').format('YYYY-MM-DD'))
                    .query(`
                        SELECT
                            CONVERT(varchar, CAST(DATEADD(MINUTE, 330, CreatedAt) AS date), 23) AS AttendanceDate,
                            MAX(CASE WHEN IsPresent = 1 THEN 1 ELSE 0 END) AS IsPresent,
                            MAX(CASE WHEN OnLeave = 1 THEN 1 ELSE 0 END) AS OnLeave
                        FROM Attendance
                        WHERE TR = @TR
                          AND CAST(DATEADD(MINUTE, 330, CreatedAt) AS date) >= @JoinedAt
                          AND CAST(DATEADD(MINUTE, 330, CreatedAt) AS date) < @Tomorrow
                        GROUP BY CAST(DATEADD(MINUTE, 330, CreatedAt) AS date)
                    `),
                pool.request()
                    .input('TR', sql.Int, TR)
                    .query(`
                        SELECT ChangedAt, PreviousStatus, NewStatus, PreviousSlotName, NewSlotName
                        FROM StudentStatusHistory
                        WHERE TR = @TR
                        ORDER BY ChangedAt ASC
                    `)
            ]);

            const attendanceByDate = new Map(
                attendanceResult.recordset.map(row => [
                    row.AttendanceDate,
                    {
                        isPresent: Boolean(row.IsPresent),
                        onLeave: Boolean(row.OnLeave)
                    }
                ])
            );
            const history = historyResult.recordset || [];

            let absentDays = [];
            const cursor = joinedAt.clone();
            const warnedRef = {}; // Dedup: warn at most once per request for this TR

            while (cursor.isSameOrBefore(today, 'day')) {
                const dayOfWeek = cursor.isoWeekday();

                if (dayOfWeek <= 6) { // Mon-Sat
                    const dateEnd = cursor.clone().endOf('day').toDate();
                    const isExpected = isExpectedAttendanceDay({
                        dateEnd,
                        history,
                        fallbackStatus: student.Status,
                        fallbackSlotName: student.SlotName,
                        tr: TR,
                        joinedAt: student.JoinedAt,
                        warnedRef
                    });

                    if (isExpected) {
                        const dateKey = cursor.format('YYYY-MM-DD');
                        const attendance = attendanceByDate.get(dateKey);

                        if (!attendance?.isPresent && !attendance?.onLeave && cursor.isBefore(today, 'day')) {
                            absentDays.push(cursor.clone());
                        }
                    }
                }
                cursor.add(1, 'day');
            }

            const rows = absentDays.sort((a, b) => b.valueOf() - a.valueOf()).map(dateMoment => {
                return {
                    hijriDate: formatHijriDate(dateMoment.toDate()),
                    date: dateMoment.format('DD/MM/YYYY'),
                    isoDate: dateMoment.format('YYYY-MM-DD'),
                    day: dateMoment.format('dddd'),
                    time: '-'
                };
            });

            return res.json({ success: true, type, rows });
        }

        if (type === 'present') {
            const result = await pool.request()
                .input('TR', sql.Int, TR)
                .query(`
                    SELECT
                        CONVERT(varchar, CAST(DATEADD(MINUTE, 330, CreatedAt) AS date), 23) AS AttendanceDate,
                        DATENAME(WEEKDAY, DATEADD(MINUTE, 330, CreatedAt)) AS DayName,
                        FORMAT(DATEADD(MINUTE, 330, CreatedAt), 'hh:mm tt') AS PresentTime,
                        DATEADD(MINUTE, 330, CreatedAt) AS CreatedAtIST
                    FROM Attendance
                    WHERE TR = @TR AND IsPresent = 1
                    ORDER BY CreatedAt DESC
                `);

            const rows = result.recordset.map(row => {
                const dateMoment = moment.tz(row.AttendanceDate, "Asia/Kolkata");
                return {
                    hijriDate: formatHijriDate(dateMoment.toDate()),
                    date: dateMoment.format('DD/MM/YYYY'),
                    isoDate: row.AttendanceDate,
                    day: row.DayName,
                    time: row.PresentTime || ''
                };
            });

            return res.json({ success: true, type, rows });
        }

        const leaveResult = await pool.request()
            .input('TR', sql.Int, TR)
            .query(`
                SELECT
                    LeaveID,
                    CONVERT(varchar, LeaveStartDate, 23) AS LeaveStartDate,
                    CONVERT(varchar, LeaveEndDate, 23) AS LeaveEndDate,
                    Reason,
                    Remarks
                FROM LeaveRequests
                WHERE TR = @TR AND Status = 'Approved'
                ORDER BY LeaveStartDate DESC, LeaveID DESC
            `);

            const rows = leaveResult.recordset.map(row => {
            const start = moment.tz(row.LeaveStartDate, "Asia/Kolkata");
            const end = moment.tz(row.LeaveEndDate, "Asia/Kolkata");
            const dayLabel = start.isSame(end, 'day')
                ? start.format('dddd')
                : `${start.format('dddd')} - ${end.format('dddd')}`;
            
            return {
                leaveID: row.LeaveID,
                hijriStartDate: formatHijriDate(start.toDate()),
                hijriEndDate: formatHijriDate(end.toDate()),
                startDate: start.format('DD/MM/YYYY'),
                endDate: end.format('DD/MM/YYYY'),
                isoStartDate: row.LeaveStartDate,
                isoEndDate: row.LeaveEndDate,
                day: dayLabel,
                // Use the same Reason value as shown in the Leaves tab (LeaveRequests.Reason).
                reason: row.Reason || 'N/A'
            };
        });

        return res.json({ success: true, type, rows });
    } catch (err) {
        next(err);
    }
  }
);


router.get(
    '/api/student/eligible-weeks',
    cacheMiddleware(req => `eligible_weeks_${req.session.user?.TR}`, 43200),
    async (req, res) => {
        // 1. Ensure a student is logged in by checking the session
        if (!req.session.user || !req.session.user.TR) {
            return res.status(401).json({ success: false, message: 'Unauthorized. Please log in.' });
        }

        const { TR } = req.session.user;

        try {
            // 2. Get the student's official join date from the TestMaster table
            const studentResult = await pool.request()
                .input('TR', sql.Int, TR)
                .query(`SELECT JoinedAt FROM TestMaster WHERE TR = @TR`);

            if (studentResult.recordset.length === 0) {
                return res.status(401).json({ success: false, message: 'Student record not found.' });
            }

            const joinedDate = studentResult.recordset[0].JoinedAt;

            // 3. Check if student is a gym member (JoinedAt must exist)
            if (!joinedDate) {
                return res.json({
                    success: true,
                    isGymMember: false,
                    weeks: []
                });
            }

            // 4. Fetch all weeks that END on or after the student joined
            const weeksResult = await pool.request()
                .input('JoinedAt', sql.Date, joinedDate)
                .query(`
                    SELECT WeekID,
                                 CONVERT(varchar, WeekStartDate, 23) AS WeekStartDate,
                                 CONVERT(varchar, WeekEndDate, 23) AS WeekEndDate
                    FROM AttendanceWeek
                    WHERE WeekEndDate >= @JoinedAt
                    ORDER BY WeekID ASC
                `);

            res.json({
                success: true,
                isGymMember: true,
                weeks: weeksResult.recordset
            });

        } catch (err) {
            next(err);
        }
    }
);


//--- 🍃 Leave Management (Leaves Tab)

router.get(
  '/api/student/leaves',
  cacheMiddleware(req => `leaves_${req.session.user?.TR}`, 60),
  async (req, res) => {

    if (!req.session.user?.TR)
        return res.status(401).json({ success: false, message: 'Unauthorized' });

    try {
        const summary = await computeStudentLeaveSummary(req.session.user.TR);
        res.json(summary);
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
    
    const { TR, Status } = req.session.user;

    if (Status !== 'Active') {
        return res.status(403).json({ 
            success: false, 
            message: 'Only active members can request leaves. Please contact admin if you believe this is a mistake.' 
        });
    }
    
    const { leaveStartDate, leaveEndDate, reason } = req.body;

    // --- 🕒 Time-based Validation Logic ---
    const now = moment.tz("Asia/Kolkata");
    const hour = now.hour();

    const minute = now.minute();

    // Allow 3:00 PM (15:00) up to and including 10:30 PM (22:30)
    const isBeforeOpen = hour < 15;
    const isAfterClose = hour > 22 || (hour === 22 && minute > 30);
    if (isBeforeOpen || isAfterClose) {
        return res.status(403).json({ success: false, message: 'You can only apply for leave between 3 PM and 10:30 PM.' });
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
                SELECT LeaveStartDate, LeaveEndDate, Remarks FROM LeaveRequests 
                WHERE TR = @TR AND Status = 'Approved' 
                AND (LeaveStartDate BETWEEN @StartOfMonth AND @EndOfMonth OR LeaveEndDate BETWEEN @StartOfMonth AND @EndOfMonth)
            `);
        
        let approvedDaysCount = 0;
        // Exclude bulk/system-generated leaves from the student's personal 4/month quota
        leavesResult.recordset.forEach(leave => {
            const isBulk = leave.Remarks && leave.Remarks.includes('Bulk Leaves');
            if (!isBulk) {
                let current = moment.max(moment(leave.LeaveStartDate), moment(startOfMonth));
                let end = moment.min(moment(leave.LeaveEndDate), moment(endOfMonth));
                approvedDaysCount += end.diff(current, 'days') + 1;
            }
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
            // After inserting:
        cache.del(`leaves_${TR}`);

        // Compute fresh structure using SAME logic as GET
        const summary = await computeStudentLeaveSummary(TR);

        // Save fresh to cache
        cache.set(`leaves_${TR}`, summary, 60);

        return res.json({ success: true, message: 'Leave request submitted successfully.' });


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
            // invalidate old cache
        cache.del(`leaves_${TR}`);

        const summary = await computeStudentLeaveSummary(TR);

        cache.set(`leaves_${TR}`, summary, 60);

        return res.json({ success: true, message: 'Leave request cancelled.' });

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
 * Ranks students by earned badges, then by cumulative XP/level, filtered by branch/gender.
 */
router.get(
  '/api/achievements/leaderboard',
  cacheMiddleware(req =>
    `achieve_leaderboard_v3_${req.session.user?.Branch}_${req.session.user?.Gender}_${req.session.user?.TR}`,
    300
  ),
  async (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    const { Branch, Gender, TR } = req.session.user;

    try {
        const result = await pool.request()
            .input('Branch', sql.NVarChar(50), Branch)
            .input('Gender', sql.NVarChar(50), Gender)
            .input('TR', sql.Int, TR)
            .query(`
                WITH RankedStudents AS (
                    SELECT
                        M.TR,
                        M.Name,
                        COUNT(SA.StudentAchievementID) AS TotalAchievements,
                        G.SafeLevel AS FitnessLevel,
                        G.SafeCurrentXP AS CurrentXP,
                        G.SafeLevel * 100 AS NextLevelXP,
                        (((G.SafeLevel - 1) * G.SafeLevel) / 2) * 100 + G.SafeCurrentXP AS TotalXP,
                        ROW_NUMBER() OVER (
                            ORDER BY
                                COUNT(SA.StudentAchievementID) DESC,
                                (((G.SafeLevel - 1) * G.SafeLevel) / 2) * 100 + G.SafeCurrentXP DESC,
                                G.SafeLevel DESC,
                                G.SafeCurrentXP DESC,
                                MIN(SA.DateEarned) ASC,
                                M.Name ASC
                        ) AS Rank
                    FROM TestMaster M
                    LEFT JOIN StudentAchievements SA ON M.TR = SA.TR
                    CROSS APPLY (
                        SELECT
                            CASE
                                WHEN ISNULL(M.FitnessLevel, 1) < 1 THEN 1
                                ELSE ISNULL(M.FitnessLevel, 1)
                            END AS SafeLevel,
                            ISNULL(M.CurrentXP, 0) AS SafeCurrentXP
                    ) G
                    WHERE M.Status = 'Active' AND M.Branch = @Branch AND M.Gender = @Gender
                    GROUP BY M.TR, M.Name, G.SafeLevel, G.SafeCurrentXP
                )
                SELECT
                    TR,
                    Name,
                    TotalAchievements,
                    FitnessLevel,
                    CurrentXP,
                    NextLevelXP,
                    TotalXP,
                    Rank,
                    CASE WHEN TR = @TR THEN 1 ELSE 0 END AS IsCurrentUser
                FROM RankedStudents
                WHERE Rank <= 10 OR TR = @TR
                ORDER BY Rank ASC;
            `);
        res.json({ success: true, data: result.recordset });
    } catch (err) {
        console.error("Error fetching achievement leaderboard:", err);
        res.status(500).json({ success: false, message: 'Failed to fetch leaderboard.' });
    }
});

router.get(
  '/api/student/achievements',
  cacheMiddleware(req => `student_achievements_${req.session.user?.TR}`, 120),
  async (req, res) => {
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

// ============================================================
// Phase 3B: GET /api/exercises
// Returns all active exercises grouped by body part.
// Cached for 10 minutes — exercise list rarely changes.
// ============================================================
router.get(
  '/api/exercises',
  cacheMiddleware(() => 'exercises_all', 600, { cacheControl: 'public, max-age=600' }),
  async (req, res) => {
    try {
        const result = await pool.request().query(`
            SELECT
                e.ExerciseID,
                e.Name,
                e.Difficulty,
                e.Equipment,
                e.VideoURL,
                bp.Name AS BodyPart,
                bp.BodyPartID
            FROM Exercises e
            JOIN BodyParts bp ON bp.BodyPartID = e.BodyPartID
            WHERE e.IsActive = 1
            ORDER BY bp.Name ASC, e.Name ASC;
        `);

        // Group by body part for easy frontend rendering
        const grouped = {};
        for (const row of result.recordset) {
            if (!grouped[row.BodyPart]) {
                grouped[row.BodyPart] = { bodyPartID: row.BodyPartID, exercises: [] };
            }
            grouped[row.BodyPart].exercises.push({
                id: row.ExerciseID,
                name: row.Name,
                difficulty: row.Difficulty,
                equipment: row.Equipment || null,
                videoURL: row.VideoURL || null
            });
        }

        res.json({ success: true, data: grouped });
    } catch (err) {
        console.error('GET /api/exercises error:', err);
        res.status(500).json({ success: false, message: 'Failed to load exercises' });
    }
  }
);

// ============================================================
// Phase 3F: GET /api/student/performance/history/:exerciseID
// Returns week-by-week progressive overload data for one exercise.
// Shows max weight, total volume, and avg RPE per calendar week.
// ============================================================
router.get('/api/student/performance/history/:exerciseID', async (req, res) => {
    const { TR } = req.session.user || {};
    if (!TR) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const exerciseID = parseInt(req.params.exerciseID, 10);
    if (isNaN(exerciseID)) return res.status(400).json({ success: false, message: 'Invalid exerciseID' });

    try {
        const request = pool.request();
        request.input('TR', sql.Int, TR);
        request.input('ExerciseID', sql.Int, exerciseID);

        const result = await request.query(`
            SELECT
                YEAR(CompletedAt)                       AS Year,
                DATEPART(ISO_WEEK, CompletedAt)         AS WeekNum,
                MIN(CompletedAt)                        AS WeekStart,
                MAX(WeightUsed)                         AS MaxWeight,
                SUM(ISNULL(WeightUsed,0) * ISNULL(RepsPerformed,0)) AS TotalVolume,
                SUM(RepsPerformed)                      AS TotalReps,
                AVG(CAST(RPE AS FLOAT))                 AS AvgRPE,
                COUNT(CASE WHEN IsPR = 1 THEN 1 END)    AS PRsThisWeek
            FROM PerformanceLogs
            WHERE TR = @TR
              AND ExerciseID = @ExerciseID
            GROUP BY YEAR(CompletedAt), DATEPART(ISO_WEEK, CompletedAt)
            ORDER BY Year ASC, WeekNum ASC;
        `);

        // Also fetch exercise name
        const exResult = await pool.request()
            .input('ExerciseID', sql.Int, exerciseID)
            .query(`
                SELECT e.Name, bp.Name AS BodyPart
                FROM Exercises e
                JOIN BodyParts bp ON bp.BodyPartID = e.BodyPartID
                WHERE e.ExerciseID = @ExerciseID
            `);

        const exercise = exResult.recordset[0] || { Name: 'Unknown', BodyPart: '' };

        res.json({
            success: true,
            exercise: { id: exerciseID, name: exercise.Name, bodyPart: exercise.BodyPart },
            history: result.recordset
        });
    } catch (err) {
        console.error('Performance history error:', err);
        res.status(500).json({ success: false, message: 'Failed to load performance history' });
    }
});

// ============================================================
// Phase 3C: POST /api/student/log-performance
// Logs actual sets performed during a session → PerformanceLogs.
// Requires student to be checked-in (TrainingPlan row must exist today).
// Auto-detects Personal Records (IsPR flag).
// ============================================================
router.post('/api/student/log-performance', async (req, res) => {
    const { TR, Branch, Gender } = req.session.user || {};
    if (!TR || !Branch || !Gender) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const { plannedID, exerciseID, sets, rpe } = req.body;

    if (!exerciseID || !Array.isArray(sets) || sets.length === 0) {
        return res.status(400).json({ success: false, message: 'exerciseID and sets[] are required' });
    }

    try {
        // 1. Find today's TrainingPlan (check-in header)
        const todayStr = moment.tz('Asia/Kolkata').format('YYYY-MM-DD');
        const planResult = await pool.request()
            .input('TR', sql.Int, TR)
            .input('Today', sql.Date, todayStr)
            .query(`
                SELECT TOP 1 PlanID FROM TrainingPlan
                WHERE TR = @TR
                  AND CAST(CreatedAt AS DATE) = @Today
                ORDER BY CreatedAt DESC
            `);

        if (planResult.recordset.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No active check-in found for today. Please check in first.'
            });
        }

        const planID = planResult.recordset[0].PlanID;

        // 2. Get current PR for this exercise (max weight ever logged)
        const prResult = await pool.request()
            .input('TR', sql.Int, TR)
            .input('ExerciseID', sql.Int, exerciseID)
            .query(`
                SELECT ISNULL(MAX(WeightUsed), 0) AS CurrentPR
                FROM PerformanceLogs
                WHERE TR = @TR AND ExerciseID = @ExerciseID
            `);

        let currentPR = parseFloat(prResult.recordset[0]?.CurrentPR || 0);
        let newPRDetected = false;

        // 3. Insert each set
        for (const set of sets) {
            const { setNumber, repsPerformed, weightUsed, durationMinutes } = set;
            const weight = parseFloat(weightUsed || 0);
            const isPR = weight > 0 && weight > currentPR ? 1 : 0;

            if (isPR) {
                currentPR = weight; // update PR baseline for subsequent sets in this session
                newPRDetected = true;
            }

            const request = pool.request();
            request.input('PlanID',           sql.Int,           planID);
            request.input('PlannedID',        sql.Int,           plannedID || null);
            request.input('ExerciseID',       sql.Int,           exerciseID);
            request.input('SetNumber',        sql.Int,           setNumber || 1);
            request.input('RepsPerformed',    sql.Int,           repsPerformed || null);
            request.input('WeightUsed',       sql.Decimal(10,2), weight || null);
            request.input('DurationMinutes',  sql.Int,           durationMinutes || null);
            request.input('RPE',              sql.Int,           rpe || null);
            request.input('IsPR',             sql.Bit,           isPR);
            request.input('Branch',           sql.VarChar(7),    Branch);
            request.input('Gender',           sql.VarChar(6),    Gender);
            request.input('TR',               sql.Int,           TR);

            await request.query(`
                INSERT INTO PerformanceLogs
                    (PlanID, PlannedID, ExerciseID, SetNumber, RepsPerformed,
                     WeightUsed, DurationMinutes, RPE, IsPR, Branch, Gender, TR)
                VALUES
                    (@PlanID, @PlannedID, @ExerciseID, @SetNumber, @RepsPerformed,
                     @WeightUsed, @DurationMinutes, @RPE, @IsPR, @Branch, @Gender, @TR)
            `);
        }

        // 4. Bust caches
        cache.del(`workout_${TR}`);
        cache.del(`planner_insights_${TR}`);

        res.json({
            success: true,
            message: sets.length + ' set(s) logged successfully.',
            newPR: newPRDetected,
            planID
        });

    } catch (err) {
        console.error('log-performance error:', err);
        res.status(500).json({ success: false, message: 'Failed to log performance' });
    }
});



// ============================================================
// Slot Request Routes (Student)
// ============================================================

router.get('/api/student/slot-request/status', async (req, res) => {
    const { TR } = req.session.user || {};
    if (!TR) return res.status(401).json({ success: false, message: 'Unauthorized' });

    try {
        const result = await pool.request()
            .input('TR', sql.Int, TR)
            .query(`
                SELECT TOP 1 sr.RequestID, sr.RequestedSlotID, sr.Status, sr.ReviewedAt, sr.Remarks, s.SlotName
                FROM SlotRequests sr
                JOIN Slots s ON sr.RequestedSlotID = s.SlotID
                WHERE sr.TR = @TR
                ORDER BY sr.RequestedAt DESC
            `);

        if (result.recordset.length > 0) {
            const reqData = result.recordset[0];
            
            if (reqData.Status === 'Pending') {
                return res.json({
                    success: true,
                    hasPending: true,
                    requestedSlotName: reqData.SlotName,
                    requestedSlotID: reqData.RequestedSlotID
                });
            } else {
                // Check if processed within last 7 days
                const reviewDate = new Date(reqData.ReviewedAt);
                const now = new Date();
                const diffTime = Math.abs(now - reviewDate);
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                if (diffDays <= 7) {
                    return res.json({
                        success: true,
                        hasPending: false,
                        hasProcessed: true,
                        status: reqData.Status,
                        remarks: reqData.Remarks,
                        requestedSlotName: reqData.SlotName
                    });
                }
            }
        }
        res.json({ success: true, hasPending: false, hasProcessed: false });
    } catch (err) {
        console.error('Error fetching slot request status:', err);
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
});

router.post('/api/student/slot-request', async (req, res) => {
    const { TR } = req.session.user || {};
    if (!TR) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const { requestedSlotID, reason } = req.body;
    if (!requestedSlotID) {
        return res.status(400).json({ success: false, message: 'Requested slot is required.' });
    }
    if (!reason || reason.trim() === '') {
        return res.status(400).json({ success: false, message: 'Reason for slot change is required.' });
    }
    if (reason.length > 255) {
        return res.status(400).json({ success: false, message: 'Reason must be 255 characters or less.' });
    }

    try {
        // Check if a pending request already exists
        const pendingCheck = await pool.request()
            .input('TR', sql.Int, TR)
            .query(`SELECT COUNT(*) as count FROM SlotRequests WHERE TR = @TR AND Status = 'Pending'`);
            
        if (pendingCheck.recordset[0].count > 0) {
            return res.status(400).json({ success: false, message: 'You already have a pending slot change request.' });
        }

        // Validate slot exists and check capacity
        const slotCheck = await pool.request()
            .input('SlotID', sql.Int, requestedSlotID)
            .query(`
                SELECT s.SlotID, s.SlotName, s.MaxCapacity,
                  (s.MaxCapacity - (SELECT COUNT(*) FROM TestMaster m WHERE m.SlotID = s.SlotID AND m.Status = 'Active')) AS AvailableSeats
                FROM Slots s
                WHERE s.SlotID = @SlotID AND s.IsActive = 1
            `);

        if (slotCheck.recordset.length === 0) {
            return res.status(400).json({ success: false, message: 'Invalid or inactive slot selected.' });
        }

        if (slotCheck.recordset[0].AvailableSeats <= 0) {
            return res.status(400).json({ success: false, message: 'The selected slot is currently full.' });
        }

        // Insert new request with Reason
        await pool.request()
            .input('TR', sql.Int, TR)
            .input('SlotID', sql.Int, requestedSlotID)
            .input('Reason', sql.VarChar(255), reason.trim())
            .query(`
                INSERT INTO SlotRequests (TR, RequestedSlotID, Status, Reason)
                VALUES (@TR, @SlotID, 'Pending', @Reason)
            `);

        res.json({ success: true, message: 'Slot change request submitted successfully.' });

    } catch (err) {
        console.error('Error creating slot request:', err);
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
});


module.exports = router; // Export the router

