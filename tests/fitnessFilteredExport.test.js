const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { pool } = require('../utils/db');
const routes = require('../routes/fitnessProfiles');

test('cohort PDF uses the same filters across all pages', async () => {
  const original = pool.request;
  const rows = [
    { TestLog:101, TR:10001, Name:'Amina', Gender:'Female', StudentGender:'Female', Darajah:'7A', Grade:'A', BMI:22, VO2Max:40, BodyFat:25, BMR:1300, CreatedAt:'2026-08-01', BatchID:7, BatchName:'Summer', SubmittedBy:'Trainer' },
    { TestLog:102, TR:10002, Name:'Bina', Gender:'Female', StudentGender:'Female', Darajah:'7A', Grade:'A', BMI:27, VO2Max:38, BodyFat:29, BMR:1250, CreatedAt:'2026-08-02', BatchID:7, BatchName:'Summer', SubmittedBy:'Trainer' },
    { TestLog:103, TR:10003, Name:'Cina', Gender:'Female', StudentGender:'Female', Darajah:'7B', Grade:'B', BMI:23, VO2Max:42, BodyFat:24, BMR:1400, CreatedAt:'2026-08-03', BatchID:7, BatchName:'Summer', SubmittedBy:'Trainer' }
  ];
  pool.request = () => {
    const inputs = {};
    return {
      input(name, _type, value) { inputs[name] = value; return this; },
      async query(query) {
        if (query.includes('FROM EvaluationBatches B') && query.includes('B.BatchID = @BatchID'))
          return { recordset:inputs.Branch === 'Marol' ? [{ BatchID:7, BatchName:'Summer' }] : [] };
        if (query.includes('WITH Latest AS')) return { recordset:rows };
        if (query.includes('FROM Evaluations E JOIN TestRecords R')) return { recordset:[] };
        throw new Error(`Unexpected query: ${query.slice(0, 75)}`);
      }
    };
  };
  const app = express();
  app.use((req, _res, next) => { req.session = { user:{ Role:'Admin', Branch:'Marol', Gender:'Male' } }; next(); });
  app.use(routes);
  const server = app.listen(0, '127.0.0.1');
  try {
    await new Promise(resolve => server.once('listening', resolve));
    const base = `http://127.0.0.1:${server.address().port}/api/fitness-cohorts`;
    const filters = 'darajah=7A&grade=A&gender=Female&metric=BMI&min=20&max=28&sort=BMI&direction=desc&page=99';
    const list = await fetch(`${base}?batchId=7&${filters}`);
    assert.equal(list.status, 200);
    const data = (await list.json()).data;
    assert.equal(data.total, 2);
    assert.equal(data.rows.length, 0);
    const pdf = await fetch(`${base}/7/reports.pdf?${filters}`);
    assert.equal(pdf.status, 200);
    assert.equal(pdf.headers.get('x-report-count'), '2');
    assert.equal((Buffer.from(await pdf.arrayBuffer()).toString('latin1').match(/\/Type\s*\/Page\b/g) || []).length, 2);
    assert.equal((await fetch(`${base}/7/reports.pdf?darajah=NoSuchDarajah`)).status, 404);
    assert.equal((await fetch(`${base}/7/reports.pdf?min=29&max=20`)).status, 400);
  } finally {
    pool.request = original;
    await new Promise(resolve => server.close(resolve));
  }
});
