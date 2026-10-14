const express = require('express');
const router = express.Router();
const sql = require('mssql');
const { pool } = require('../utils/db');
const { METRICS, summarizeMetric, percentile } = require('../utils/fitnessAnalytics');
const { assessTests, assessTest, SOURCES } = require('../utils/fitnessAssessment');
const { createReportDocument, renderFitnessReportPage } = require('../utils/fitnessReportPdf');

const STAFF_ROLES = new Set(['Staff', 'Admin', 'Trainer', 'Evaluator']);
const int = value => /^\d+$/.test(String(value || '')) ? Number(value) : null;
const clean = value => String(value ?? '').trim().slice(0, 100);

function requireFitnessUser(req, res, next) {
  if (req.session.user?.TR || STAFF_ROLES.has(req.session.user?.Role)) return next();
  return res.status(401).json({ success: false, message: 'Sign in to view fitness profiles.' });
}
function requireStaffRole(req, res, next) {
  if (STAFF_ROLES.has(req.session.user?.Role)) return next();
  return res.status(403).json({ success: false, message: 'Staff access required.' });
}
function scope(req, request) {
  const user = req.session.user;
  request.input('Branch', sql.NVarChar(50), user.Branch);
  if (user.Role !== 'Admin') request.input('Gender', sql.NVarChar(10), user.Gender);
  return user.Role === 'Admin' ? 'TM.Branch = @Branch' : 'TM.Branch = @Branch AND TM.Gender = @Gender';
}
async function allowedStudent(req, tr) {
  if (!int(tr)) return null;
  if (req.session.user.TR && Number(req.session.user.TR) !== Number(tr)) return null;
  const request = pool.request().input('TR', sql.Int, tr);
  const where = req.session.user.TR ? 'TM.TR = @TR' : `TM.TR = @TR AND ${scope(req, request)}`;
  const result = await request.query(`SELECT TM.TR, TM.ITS, TM.Name, TM.Darajah, TM.DOB, TM.Branch, TM.Gender, TM.Status FROM TestMaster TM WHERE ${where}`);
  return result.recordset[0] || null;
}
async function profile(req, tr) {
  const student = await allowedStudent(req, tr);
  if (!student) return null;
  const [testsResult, commentsResult] = await Promise.all([
    pool.request().input('TR', sql.Int, tr).query(`
      SELECT R.TestLog, R.CreatedAt, R.BatchID, B.BatchName, R.SubmittedBy, R.Weight, R.Height,
        R.Waist, R.Hips, R.Neck, R.BMI, R.BodyFat, R.BMR, R.VO2Max, R.Total, R.Grade,
        A.PushUps, A.SitUps, A.Squats, A.SitAndReach, A.StepUpPulseRate
      FROM TestRecords R LEFT JOIN EvaluationBatches B ON B.BatchID = R.BatchID
      LEFT JOIN TestActivityLog A ON A.TestLog = R.TestLog
      WHERE R.TR = @TR ORDER BY R.CreatedAt DESC, R.TestLog DESC`),
    pool.request().input('TR', sql.Int, tr).query(`
      SELECT E.LogID, E.CommentText, E.DateEvaluated, C.CategoryName,
        V.Name AS EvaluatorName, V.Profession
      FROM Evaluations E JOIN TestRecords R ON R.TestLog = E.LogID
      JOIN Evaluators V ON V.EvaluatorID = E.EvaluatorID
      JOIN CommentCategories C ON C.CategoryID = E.CategoryID
      WHERE R.TR = @TR ORDER BY E.DateEvaluated DESC, E.EvaluationID DESC`)
  ]);
  const comments = new Map();
  for (const row of commentsResult.recordset) {
    if (!comments.has(row.LogID)) comments.set(row.LogID, []);
    comments.get(row.LogID).push(row);
  }
  const tests = assessTests(student, testsResult.recordset.map(row => ({ ...row, comments: comments.get(row.TestLog) || [] })));
  let medicalHistory;
  if (req.session.user.TR || req.session.user.Role === 'Evaluator') {
    const result = await pool.request().input('TR', sql.Int, tr).query('SELECT Allergies, Medications, FamilyHistory, PreviousInjuries FROM MedicalHistory WHERE TR = @TR');
    medicalHistory = result.recordset[0] || null;
  }
  const latestSelf = tests.find(test => test.SubmittedBy === 'Student');
  const nextSelfTestAt = latestSelf ? new Date(new Date(latestSelf.CreatedAt).getTime() + 7 * 86400000).toISOString() : null;
  return { student, tests, medicalHistory, nextSelfTestAt, referenceSources:SOURCES };
}

router.get('/api/fitness-profiles/me', requireFitnessUser, async (req, res, next) => {
  if (!req.session.user.TR) return res.status(403).json({ success: false });
  try {
    const data = await profile(req, req.session.user.TR);
    if (!data) return res.status(404).json({ success: false, message: 'Student master record not found.' });
    return res.json({ success: true, data });
  }
  catch (error) { return next(error); }
});
router.get('/api/fitness-profiles/search', requireFitnessUser, requireStaffRole, async (req, res, next) => {
  const q = clean(req.query.q);
  if (q.length < 2) return res.json({ success: true, data: [] });
  try {
    const request = pool.request().input('NameQuery', sql.NVarChar(110), `%${q}%`)
      .input('TRQuery', sql.NVarChar(110), `${q}%`);
    const where = scope(req, request);
    const result = await request.query(`SELECT TOP 20 TM.TR, TM.Name, TM.Darajah, TM.Gender FROM TestMaster TM
      WHERE ${where} AND (TM.Name LIKE @NameQuery OR CAST(TM.TR AS VARCHAR(20)) LIKE @TRQuery) ORDER BY TM.Name, TM.TR`);
    return res.json({ success: true, data: result.recordset });
  } catch (error) { return next(error); }
});
router.get('/api/fitness-profiles/:tr', requireFitnessUser, async (req, res, next) => {
  try {
    const data = await profile(req, req.params.tr);
    if (!data) return res.status(403).json({ success: false, message: 'Profile is outside your access.' });
    return res.json({ success: true, data });
  } catch (error) { return next(error); }
});
router.get('/api/fitness-cohorts/batches', requireFitnessUser, requireStaffRole, async (req, res, next) => {
  try {
    const request = pool.request();
    const where = scope(req, request).replaceAll('TM.', 'B.');
    const result = await request.query(`SELECT B.BatchID, B.BatchName, B.Gender, B.IsActive, B.CreatedAt
      FROM EvaluationBatches B WHERE ${where} ORDER BY B.CreatedAt DESC, B.BatchID DESC`);
    return res.json({ success: true, data: result.recordset });
  } catch (error) { return next(error); }
});
router.get('/api/fitness-cohorts/darajahs', requireFitnessUser, requireStaffRole, async (req, res, next) => {
  try {
    const request = pool.request();
    const where = scope(req, request);
    const gender = req.session.user.Role === 'Admin' && ['Male','Female'].includes(req.query.gender) ? req.query.gender : null;
    if (gender) request.input('SelectedGender', sql.NVarChar(10), gender);
    const result = await request.query(`SELECT DISTINCT LTRIM(RTRIM(TM.Darajah)) AS Darajah FROM TestMaster TM
      WHERE ${where} ${gender ? 'AND TM.Gender = @SelectedGender' : ''}
      AND TM.Darajah IS NOT NULL AND LTRIM(RTRIM(TM.Darajah)) <> '' ORDER BY Darajah`);
    return res.json({ success:true, data:result.recordset.map(row => row.Darajah) });
  } catch (error) { return next(error); }
});
router.get('/api/fitness-cohorts', requireFitnessUser, requireStaffRole, async (req, res, next) => {
  try {
    const batch = req.query.batchId === 'unbatched' ? null : int(req.query.batchId);
    if (req.query.batchId !== 'unbatched' && !batch) return res.status(400).json({ success: false, message: 'Choose a batch.' });
    const request = pool.request();
    const where = scope(req, request);
    if (batch) request.input('BatchID', sql.Int, batch);
    const result = await request.query(`WITH Latest AS (
      SELECT R.TestLog, R.TR, TM.Name, TM.Darajah, TM.Gender, R.BatchID, R.CreatedAt,
        R.Grade, R.Total, R.VO2Max, R.BMI, R.BodyFat, R.BMR,
        CASE WHEN EXISTS (SELECT 1 FROM Evaluations E WHERE E.LogID = R.TestLog) THEN 'Commented' ELSE 'Pending' END AS CommentStatus,
        ROW_NUMBER() OVER (PARTITION BY R.TR ORDER BY R.CreatedAt DESC, R.TestLog DESC) AS rn
      FROM TestRecords R JOIN TestMaster TM ON TM.TR = R.TR
      WHERE ${where} AND R.SubmittedBy = 'Trainer' AND ${batch ? 'R.BatchID = @BatchID' : 'R.BatchID IS NULL'}
    ) SELECT * FROM Latest WHERE rn = 1`);
    const filters = req.query;
    const selectedMetric = METRICS.includes(filters.metric) ? filters.metric : 'VO2Max';
    const min = filters.min === '' || filters.min === undefined ? null : Number(filters.min);
    const max = filters.max === '' || filters.max === undefined ? null : Number(filters.max);
    if ((min !== null && !Number.isFinite(min)) || (max !== null && !Number.isFinite(max)) ||
      (min !== null && max !== null && min > max)) return res.status(400).json({ success: false, message: 'Invalid metric range.' });
    const q = clean(filters.q).toLowerCase();
    const filtered = result.recordset.filter(row =>
      (!q || String(row.TR).startsWith(q) || row.Name.toLowerCase().includes(q)) &&
      (!filters.gender || req.session.user.Role !== 'Admin' || row.Gender === filters.gender) &&
      (!filters.darajah || row.Darajah === filters.darajah) &&
      (!filters.grade || row.Grade === filters.grade));
    const metrics = Object.fromEntries(METRICS.map(key => [key, summarizeMetric(filtered, key,
      key === selectedMetric ? min : null, key === selectedMetric ? max : null)]));
    const sorted = filtered.filter(row => {
      const value = row[selectedMetric] == null ? NaN : Number(row[selectedMetric]);
      return (min === null && max === null) || (Number.isFinite(value) && value > 0 &&
        (min === null || value >= min) && (max === null || value <= max));
    }).sort((a, b) => {
      const field = METRICS.includes(filters.sort) ? filters.sort : 'CreatedAt';
      const direction = filters.direction === 'asc' ? 1 : -1;
      if (field === 'CreatedAt') return direction * (new Date(a.CreatedAt) - new Date(b.CreatedAt));
      if (a[field] == null) return b[field] == null ? Number(a.TR) - Number(b.TR) : 1;
      if (b[field] == null) return -1;
      return direction * ((Number(a[field]) || 0) - (Number(b[field]) || 0));
    });
    const page = Math.max(1, int(filters.page) || 1), pageSize = 25;
    return res.json({ success: true, data: {
      batchId: batch, batchSize:result.recordset.length, total: sorted.length, cohortCount: filtered.length, page, pageSize,
      metrics, rows: sorted.slice((page - 1) * pageSize, page * pageSize).map(row => ({ ...row,
        percentiles: Object.fromEntries(METRICS.map(key => [key, percentile(filtered, key, row[key])])) }))
    } });
  } catch (error) { return next(error); }
});
router.get('/api/fitness-reports/:testLog.pdf', requireFitnessUser, async (req, res, next) => {
  try {
    const testLog = int(req.params.testLog);
    if (!testLog) return res.status(400).end();
    const owner = await pool.request().input('TestLog', sql.Int, testLog)
      .query('SELECT TR FROM TestRecords WHERE TestLog = @TestLog');
    const tr = owner.recordset[0]?.TR;
    const data = tr && await profile(req, tr);
    if (!data) return res.status(403).end();
    const test = data.tests.find(item => item.TestLog === testLog);
    if (!test) return res.status(404).end();
    const template = req.query.template === 'light' && req.session.user.Role === 'Admin' ? 'light' : 'dark';
    if (req.query.template === 'light' && req.session.user.Role !== 'Admin') return res.status(403).end();
    const doc = createReportDocument();
    res.set('Content-Type', 'application/pdf');
    res.set('Content-Disposition', `${req.query.preview === '1' ? 'inline' : 'attachment'}; filename="fitness-report-${tr}-${testLog}.pdf"`);
    res.set('Cache-Control', 'private, no-store');
    doc.pipe(res);
    renderFitnessReportPage(doc, { student:data.student, test, previous:data.tests[data.tests.indexOf(test) + 1], assessment:test.assessment, template });
    doc.end();
  } catch (error) { return next(error); }
});

router.get('/api/fitness-cohorts/:batchId/reports.pdf', requireFitnessUser, (req, res, next) => {
  if (!['Staff','Admin'].includes(req.session.user.Role)) return res.status(403).end();
  next();
}, async (req, res, next) => {
  try {
    const batchId = int(req.params.batchId);
    if (!batchId) return res.status(400).end();
    const template = req.query.template === 'light' && req.session.user.Role === 'Admin' ? 'light' : 'dark';
    if (req.query.template === 'light' && req.session.user.Role !== 'Admin') return res.status(403).end();
    const request = pool.request().input('BatchID', sql.Int, batchId);
    const where = scope(req, request);
    const batch = await request.query(`SELECT B.BatchID, B.BatchName FROM EvaluationBatches B
      WHERE B.BatchID = @BatchID AND ${where.replaceAll('TM.', 'B.')}`);
    if (!batch.recordset.length) return res.status(403).end();
    const scoped = () => pool.request().input('BatchID', sql.Int, batchId)
      .input('Branch', sql.NVarChar(50), req.session.user.Branch)
      .input('Gender', sql.NVarChar(10), req.session.user.Gender || '')
      .input('IsAdmin', sql.Bit, req.session.user.Role === 'Admin');
    const rows = await scoped().query(`WITH Latest AS (
      SELECT R.*, ROW_NUMBER() OVER (PARTITION BY R.TR ORDER BY R.CreatedAt DESC, R.TestLog DESC) AS rn
      FROM TestRecords R JOIN TestMaster TM ON TM.TR = R.TR
      WHERE R.BatchID = @BatchID AND R.SubmittedBy = 'Trainer' AND TM.Branch = @Branch
        AND (@IsAdmin = 1 OR TM.Gender = @Gender)
    )
    SELECT R.TestLog, R.TR, R.CreatedAt, R.BatchID, B.BatchName, R.SubmittedBy,
      R.Weight, R.Height, R.Waist, R.Hips, R.Neck, R.BMI, R.BodyFat, R.BMR, R.VO2Max, R.Total, R.Grade,
      A.PushUps, A.SitUps, A.Squats, A.SitAndReach, A.StepUpPulseRate,
      TM.Name, TM.DOB, TM.Gender AS StudentGender, TM.Darajah,
      P.VO2Max AS PriorVO2Max, P.BMI AS PriorBMI, P.BodyFat AS PriorBodyFat, P.BMR AS PriorBMR
    FROM Latest R JOIN TestMaster TM ON TM.TR = R.TR
    LEFT JOIN EvaluationBatches B ON B.BatchID = R.BatchID
    LEFT JOIN TestActivityLog A ON A.TestLog = R.TestLog
    OUTER APPLY (SELECT TOP 1 VO2Max, BMI, BodyFat, BMR FROM TestRecords P
      WHERE P.TR = R.TR AND (P.CreatedAt < R.CreatedAt OR (P.CreatedAt = R.CreatedAt AND P.TestLog < R.TestLog))
      ORDER BY P.CreatedAt DESC, P.TestLog DESC) P
    WHERE R.rn = 1 ORDER BY R.TR`);
    if (!rows.recordset.length) return res.status(404).json({ success:false, message:'No trainer tests in this batch.' });
    const comments = await scoped().query(`SELECT E.LogID, E.CommentText, E.DateEvaluated, C.CategoryName,
      V.Name AS EvaluatorName, V.Profession
      FROM Evaluations E JOIN TestRecords R ON R.TestLog = E.LogID
      JOIN TestMaster TM ON TM.TR = R.TR
      JOIN Evaluators V ON V.EvaluatorID = E.EvaluatorID
      JOIN CommentCategories C ON C.CategoryID = E.CategoryID
      WHERE R.BatchID = @BatchID AND R.SubmittedBy = 'Trainer' AND TM.Branch = @Branch
        AND (@IsAdmin = 1 OR TM.Gender = @Gender)
      ORDER BY E.DateEvaluated DESC, E.EvaluationID DESC`);
    const commentsByLog = new Map();
    for (const comment of comments.recordset) {
      if (!commentsByLog.has(comment.LogID)) commentsByLog.set(comment.LogID, []);
      commentsByLog.get(comment.LogID).push(comment);
    }
    const reports = rows.recordset.map(row => {
      const student = { TR:row.TR, Name:row.Name, DOB:row.DOB, Gender:row.StudentGender, Darajah:row.Darajah };
      const test = { ...row, comments:commentsByLog.get(row.TestLog) || [] };
      const previous = { VO2Max:row.PriorVO2Max, BMI:row.PriorBMI, BodyFat:row.PriorBodyFat, BMR:row.PriorBMR };
      return { student, test, previous, assessment:assessTest(student, test, previous) };
    });
    const doc = createReportDocument();
    res.set('Content-Type', 'application/pdf');
    res.set('Content-Disposition', `attachment; filename="fitness-batch-${batchId}-${template}.pdf"`);
    res.set('Cache-Control', 'private, no-store');
    doc.pipe(res);
    for (const report of reports) renderFitnessReportPage(doc, { ...report, template });
    doc.end();
  } catch (error) { return next(error); }
});

module.exports = router;
