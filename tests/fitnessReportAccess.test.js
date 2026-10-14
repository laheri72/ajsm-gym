const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { pool } = require('../utils/db');
const routes = require('../routes/fitnessProfiles');

test('batch PDF is limited to scoped staff/admin and serves one authorized report', async () => {
  const original = pool.request;
  pool.request = () => {
    const inputs = {};
    return {
      input(name, _type, value) { inputs[name] = value; return this; },
      async query(sqlText) {
        if (sqlText.includes('FROM EvaluationBatches B') && sqlText.includes('B.BatchID = @BatchID')) {
          return { recordset:inputs.Branch === 'Marol' && (inputs.Gender === 'Male' || !sqlText.includes('B.Gender = @Gender')) ? [{ BatchID:7, BatchName:'Spring' }] : [] };
        }
        if (sqlText.includes('WITH Latest AS')) return { recordset:[{ TestLog:101, TR:12345, Name:'Student', StudentGender:'Male', DOB:'2012-01-01', Darajah:'1', CreatedAt:'2025-01-01', BatchID:7, BatchName:'Spring', SubmittedBy:'Trainer', BMI:20, VO2Max:42, BodyFat:22, BMR:1300, Total:70, Grade:'A' }] };
        if (sqlText.includes('SELECT TR FROM TestRecords WHERE TestLog')) return { recordset:[{ TR:12345 }] };
        if (sqlText.includes('FROM TestMaster TM WHERE')) return { recordset:inputs.TR === 12345 && (!inputs.Branch || inputs.Branch === 'Marol') && (!inputs.Gender || inputs.Gender === 'Male') ? [{ TR:12345, Name:'Student', Branch:'Marol', Gender:'Male', Darajah:'1', DOB:'2012-01-01' }] : [] };
        if (sqlText.includes('FROM TestRecords R LEFT JOIN')) return { recordset:[{ TestLog:101, TR:12345, CreatedAt:'2025-01-01', BatchID:7, BatchName:'Spring', SubmittedBy:'Trainer', BMI:20, VO2Max:42, BodyFat:22, BMR:1300, Total:70, Grade:'A' }] };
        if (sqlText.includes('FROM Evaluations E JOIN')) return { recordset:[] };
        if (sqlText.includes('FROM MedicalHistory WHERE')) return { recordset:[] };
        throw new Error(`Unexpected query: ${sqlText.slice(0, 60)}`);
      }
    };
  };
  const app = express();
  app.use((req, _res, next) => { req.session = { user:JSON.parse(req.headers['x-test-user']) }; next(); });
  app.use(routes);
  const server = app.listen(0, '127.0.0.1');
  try {
    await new Promise(resolve => server.once('listening', resolve));
    const url = `http://127.0.0.1:${server.address().port}/api/fitness-cohorts/7/reports.pdf`;
    const get = (user, suffix = '') => fetch(url + suffix, { headers:{ 'x-test-user':JSON.stringify(user) } });
    assert.equal((await get({ TR:12345 })).status, 403);
    assert.equal((await get({ Role:'Trainer', Branch:'Marol', Gender:'Male' })).status, 403);
    assert.equal((await get({ Role:'Staff', Branch:'Other', Gender:'Male' })).status, 403);
    assert.equal((await get({ Role:'Staff', Branch:'Marol', Gender:'Female' })).status, 403);
    assert.equal((await get({ Role:'Staff', Branch:'Marol', Gender:'Male' }, '?template=light')).status, 403);
    const report = await get({ Role:'Admin', Branch:'Marol', Gender:'Female' }, '?template=dark');
    assert.equal(report.status, 200);
    assert.match(report.headers.get('content-type'), /application\/pdf/);
    assert.equal((Buffer.from(await report.arrayBuffer()).toString('latin1').match(/\/Type\s*\/Page\b/g) || []).length, 1);
    const singleUrl = `http://127.0.0.1:${server.address().port}/api/fitness-reports/101.pdf`;
    const selected = (user, suffix = '') => fetch(singleUrl + suffix, { headers:{ 'x-test-user':JSON.stringify(user) } });
    assert.equal((await selected({ TR:99999 })).status, 403);
    assert.equal((await selected({ Role:'Staff', Branch:'Other', Gender:'Male' })).status, 403);
    assert.equal((await selected({ Role:'Trainer', Branch:'Marol', Gender:'Male' }, '?template=light')).status, 403);
    const preview = await selected({ Role:'Evaluator', Branch:'Marol', Gender:'Male' }, '?preview=1');
    assert.equal(preview.status, 200);
    assert.match(preview.headers.get('content-disposition'), /^inline;/);
    assert.equal((Buffer.from(await preview.arrayBuffer()).toString('latin1').match(/\/Type\s*\/Page\b/g) || []).length, 1);
  } finally {
    pool.request = original;
    await new Promise(resolve => server.close(resolve));
  }
});
