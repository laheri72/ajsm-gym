// One-time correction for trainer tests entered into the prior Talebaat batch.
// Usage: node scripts/migrate-marol-talebaat-2026-batch.js --preview|--apply|--verify <audit-file>
const fs = require('fs');
const path = require('path');
const { pool } = require('../utils/db');
const sql = require('mssql');

const SOURCE = 7;
const TARGET = 10;
const EXPECTED = 285;
const EXPECTED_2025 = 151;
const auditDirectory = path.join(__dirname, '..', 'migration-audit');
const predicate = `BatchID = ${SOURCE} AND Branch = 'Marol' AND Gender = 'Female'
  AND SubmittedBy = 'Trainer' AND CreatedAt >= '2026-01-01' AND CreatedAt < '2027-01-01'`;

async function inspect(request) {
  const [batches, candidates, prior, target] = await Promise.all([
    request().query(`SELECT BatchID, BatchName, Branch, Gender, IsActive FROM EvaluationBatches WHERE BatchID IN (${SOURCE}, ${TARGET})`),
    request().query(`SELECT TestLog FROM TestRecords WHERE ${predicate} ORDER BY TestLog`),
    request().query(`SELECT COUNT(*) AS Records FROM TestRecords WHERE BatchID = ${SOURCE} AND Branch = 'Marol' AND Gender = 'Female' AND SubmittedBy = 'Trainer' AND CreatedAt >= '2025-01-01' AND CreatedAt < '2026-01-01'`),
    request().query(`SELECT COUNT(*) AS Records FROM TestRecords WHERE BatchID = ${TARGET}`)
  ]);
  return { batches:batches.recordset, ids:candidates.recordset.map(row => row.TestLog), prior2025:prior.recordset[0].Records, targetBefore:target.recordset[0].Records };
}

function validate(state) {
  const source = state.batches.find(batch => batch.BatchID === SOURCE);
  const target = state.batches.find(batch => batch.BatchID === TARGET);
  if (!source || source.BatchName !== 'Batch 1447_Test #2' || source.Branch !== 'Marol' || source.Gender !== 'Female' || source.IsActive)
    throw new Error('Source batch metadata changed. No records moved.');
  if (!target || target.BatchName !== 'Batch 1448_Test #1' || target.Branch !== 'Marol' || target.Gender !== 'Female' || !target.IsActive)
    throw new Error('Target batch metadata changed. No records moved.');
  if (state.ids.length !== EXPECTED || new Set(state.ids).size !== EXPECTED || state.prior2025 !== EXPECTED_2025)
    throw new Error(`Preflight count mismatch: ${state.ids.length} candidates and ${state.prior2025} records from 2025. No records moved.`);
}

async function apply() {
  const transaction = new sql.Transaction(pool);
  await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
  let committed = false;
  let auditPath;
  try {
    const request = () => new sql.Request(transaction);
    const locked = await request().query(`SELECT BatchID, BatchName, Branch, Gender, IsActive FROM EvaluationBatches WITH (UPDLOCK, HOLDLOCK) WHERE BatchID IN (${SOURCE}, ${TARGET})`);
    const candidates = await request().query(`SELECT TestLog FROM TestRecords WITH (UPDLOCK, HOLDLOCK) WHERE ${predicate} ORDER BY TestLog`);
    const prior = await request().query(`SELECT COUNT(*) AS Records FROM TestRecords WHERE BatchID = ${SOURCE} AND Branch = 'Marol' AND Gender = 'Female' AND SubmittedBy = 'Trainer' AND CreatedAt >= '2025-01-01' AND CreatedAt < '2026-01-01'`);
    const target = await request().query(`SELECT COUNT(*) AS Records FROM TestRecords WHERE BatchID = ${TARGET}`);
    const state = { batches:locked.recordset, ids:candidates.recordset.map(row => row.TestLog), prior2025:prior.recordset[0].Records, targetBefore:target.recordset[0].Records };
    validate(state);

    fs.mkdirSync(auditDirectory, { recursive:true });
    auditPath = path.join(auditDirectory, `marol-talebaat-batch-7-to-10-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
    const audit = { state:'prepared', createdAt:new Date().toISOString(), source:SOURCE, target:TARGET, expected:EXPECTED, targetBefore:state.targetBefore, testLogs:state.ids };
    fs.writeFileSync(auditPath, JSON.stringify(audit, null, 2), { flag:'wx' });

    const moved = await request().query(`DECLARE @Moved TABLE (TestLog INT PRIMARY KEY);
      UPDATE TestRecords SET BatchID = ${TARGET} OUTPUT inserted.TestLog INTO @Moved WHERE ${predicate};
      SELECT TestLog FROM @Moved ORDER BY TestLog;`);
    const movedIds = moved.recordset.map(row => row.TestLog);
    if (movedIds.length !== EXPECTED || movedIds.some((id, index) => id !== state.ids[index]))
      throw new Error('Updated TestLog set differs from preflight. Transaction rolled back.');
    const remaining = await request().query(`SELECT COUNT(*) AS Remaining FROM TestRecords WHERE ${predicate}`);
    const oldYear = await request().query(`SELECT COUNT(*) AS Records FROM TestRecords WHERE BatchID = ${SOURCE} AND Branch = 'Marol' AND Gender = 'Female' AND SubmittedBy = 'Trainer' AND CreatedAt >= '2025-01-01' AND CreatedAt < '2026-01-01'`);
    const targetAfter = await request().query(`SELECT COUNT(*) AS Records FROM TestRecords WHERE BatchID = ${TARGET}`);
    if (remaining.recordset[0].Remaining !== 0 || oldYear.recordset[0].Records !== EXPECTED_2025 || targetAfter.recordset[0].Records !== state.targetBefore + EXPECTED)
      throw new Error('Post-update counts do not reconcile. Transaction rolled back.');
    await transaction.commit();
    committed = true;
    audit.state = 'committed';
    audit.committedAt = new Date().toISOString();
    fs.writeFileSync(auditPath, JSON.stringify(audit, null, 2));
    process.stdout.write(JSON.stringify({ moved:EXPECTED, source2025:EXPECTED_2025, targetBefore:state.targetBefore, targetAfter:state.targetBefore + EXPECTED, auditPath }));
  } finally {
    if (!committed) {
      await transaction.rollback().catch(() => {});
      if (auditPath) process.stderr.write(`Prepared audit retained at ${auditPath}; transaction was not committed.\n`);
    }
  }
}

async function verify(auditPath) {
  if (!auditPath) throw new Error('Supply the committed audit file to --verify.');
  const audit = JSON.parse(fs.readFileSync(auditPath, 'utf8'));
  if (audit.state !== 'committed' || audit.source !== SOURCE || audit.target !== TARGET || audit.testLogs?.length !== EXPECTED)
    throw new Error('Audit file does not describe the committed migration.');
  const ids = audit.testLogs.map(Number);
  if (ids.some(id => !Number.isSafeInteger(id) || id < 1)) throw new Error('Invalid TestLog in audit file.');
  const moved = await pool.request().query(`SELECT COUNT(*) AS Records FROM TestRecords WHERE BatchID = ${TARGET} AND TestLog IN (${ids.join(',')})`);
  const remaining = await pool.request().query(`SELECT COUNT(*) AS Records FROM TestRecords WHERE ${predicate}`);
  const prior = await pool.request().query(`SELECT COUNT(*) AS Records FROM TestRecords WHERE BatchID = ${SOURCE} AND Branch = 'Marol' AND Gender = 'Female' AND SubmittedBy = 'Trainer' AND CreatedAt >= '2025-01-01' AND CreatedAt < '2026-01-01'`);
  if (moved.recordset[0].Records !== EXPECTED || remaining.recordset[0].Records !== 0 || prior.recordset[0].Records !== EXPECTED_2025)
    throw new Error('Post-commit verification failed. Review the database and audit file.');
  process.stdout.write(JSON.stringify({ verified:EXPECTED, remaining2026:0, source2025:EXPECTED_2025 }));
}

(async () => {
  try {
    await pool.connect();
    const mode = process.argv[2];
    if (mode === '--preview') {
      const state = await inspect(() => pool.request());
      validate(state);
      process.stdout.write(JSON.stringify({ source:SOURCE, target:TARGET, candidates:state.ids.length, source2025:state.prior2025, targetBefore:state.targetBefore, batches:state.batches }));
    } else if (mode === '--apply') await apply();
    else if (mode === '--verify') await verify(process.argv[3]);
    else throw new Error('Use --preview, --apply, or --verify <audit-file>.');
  } catch (error) { process.stderr.write(error.message + '\n'); process.exitCode = 1; }
  finally { await pool.close().catch(() => {}); }
})();
