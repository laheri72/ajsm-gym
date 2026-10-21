const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const sql = require('mssql');
const { pool } = require('../utils/db');
const routes = require('../routes/admin');

test('admin batch drafts, rename, lock, and activation preserve section rules', async () => {
  const original = { Transaction:sql.Transaction, Request:sql.Request, request:pool.request };
  const batches = [
    { BatchID:7, BatchName:'Current', Branch:'Marol', Gender:'Female', IsActive:true, TestCount:5 },
    { BatchID:8, BatchName:'Completed', Branch:'Marol', Gender:'Female', IsActive:false, TestCount:3 }
  ];
  let nextId = 9;
  class Transaction {
    async begin(level) { assert.equal(level, sql.ISOLATION_LEVEL.SERIALIZABLE); }
    async commit() {}
    async rollback() {}
  }
  class Request {
    constructor() { this.values = {}; }
    input(name, _type, value) { this.values[name] = value; return this; }
    async query(query) {
      const v = this.values;
      if (query.includes('LEFT JOIN TestRecords R ON R.BatchID')) return { recordset:batches.filter(b => b.Branch === v.Branch) };
      if (query.includes('SELECT 1 FROM EvaluationBatches WITH'))
        return { recordset:batches.filter(b => b.BatchID === Number(v.TargetBatchID) && b.Branch === v.Branch && b.Gender === v.Gender && !b.IsActive).map(() => ({ valid:1 })) };
      if (query.includes('WITH (UPDLOCK, HOLDLOCK)') && query.includes('FROM EvaluationBatches'))
        return { recordset:batches.filter(b => b.Branch === v.Branch && b.Gender === v.Gender).map(b => ({ ...b })) };
      if (query.includes('SELECT Gender FROM EvaluationBatches'))
        return { recordset:batches.filter(b => b.BatchID === v.BatchID && b.Branch === v.Branch).map(b => ({ Gender:b.Gender })) };
      if (query.includes('INSERT INTO EvaluationBatches')) {
        batches.push({ BatchID:nextId++, BatchName:v.BatchName, Branch:v.Branch, Gender:v.Gender, IsActive:Boolean(v.Activate), TestCount:0 });
        return { rowsAffected:[1] };
      }
      if (query.includes('SET BatchName = @BatchName')) {
        const batch = batches.find(b => b.BatchID === v.BatchID && b.Branch === v.Branch);
        batch.BatchName = v.BatchName;
        return { rowsAffected:[1] };
      }
      if (query.includes('SELECT TOP 1 TestLog FROM TestRecords'))
        return { recordset:batches.find(b => b.BatchID === v.BatchID)?.TestCount ? [{ TestLog:1 }] : [] };
      if (query.includes('SET IsActive = 1')) {
        const batch = batches.find(b => b.BatchID === v.BatchID && b.Branch === v.Branch && !b.IsActive);
        if (batch) batch.IsActive = true;
        return { rowsAffected:[batch ? 1 : 0] };
      }
      if (query.includes('SET IsActive = 0')) {
        const batch = batches.find(b => b.BatchID === Number(v.BatchID) && b.Branch === v.Branch && b.IsActive);
        if (batch) batch.IsActive = false;
        return { rowsAffected:[batch ? 1 : 0] };
      }
      if (query.includes('UPDATE TestRecords') && query.includes('SET BatchID')) return { rowsAffected:[2] };
      throw new Error(`Unexpected query: ${query.slice(0, 70)}`);
    }
  }
  sql.Transaction = Transaction;
  sql.Request = Request;
  pool.request = () => new Request();
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => { req.session = { user:JSON.parse(req.headers['x-test-user']) }; next(); });
  app.use(routes);
  const server = app.listen(0, '127.0.0.1');
  try {
    await new Promise(resolve => server.once('listening', resolve));
    const base = `http://127.0.0.1:${server.address().port}/api/admin/batches`;
    const admin = { Role:'Admin', Branch:'Marol', Username:'manager' };
    const send = (path = '', method = 'GET', body, user = admin) => fetch(base + path, {
      method, headers:{ 'x-test-user':JSON.stringify(user), 'Content-Type':'application/json' },
      ...(body === undefined ? {} : { body:JSON.stringify(body) })
    });
    assert.equal((await send('', 'POST', { BatchName:'Draft', Gender:'Female', activate:false }, { Role:'Staff', Branch:'Marol' })).status, 403);
    assert.equal((await send('', 'POST', { BatchName:' Draft ', Gender:'Female', activate:false })).status, 201);
    assert.equal(batches[2].BatchName, 'Draft');
    assert.equal((await send('', 'POST', { BatchName:'Another', Gender:'Female', activate:true })).status, 409);
    assert.equal((await send('/9', 'PATCH', { BatchName:'Next batch' })).status, 200);
    assert.equal((await send('/9', 'PATCH', { BatchName:'Completed' })).status, 409);
    assert.equal((await send('/9/activate', 'PUT')).status, 409);
    const assignUrl = `http://127.0.0.1:${server.address().port}/api/admin/assign-unbatched`;
    const assign = gender => fetch(assignUrl, { method:'POST', headers:{ 'x-test-user':JSON.stringify(admin), 'Content-Type':'application/json' }, body:JSON.stringify({ Gender:gender, TargetBatchID:8 }) });
    assert.equal((await assign('Male')).status, 400);
    assert.equal((await assign('Female')).status, 200);
    assert.equal((await send('/7/lock', 'PUT')).status, 200);
    assert.equal((await send('/8/activate', 'PUT')).status, 409);
    assert.equal((await send('/9/activate', 'PUT')).status, 200);
    assert.equal((await send('/9/activate', 'PUT')).status, 409);
    assert.equal((await send('/9', 'PATCH', { BatchName:'Other branch' }, { ...admin, Branch:'Karachi' })).status, 404);
    assert.equal((await send('', 'POST', { BatchName:'Invalid', Gender:'Unknown', activate:false })).status, 400);
    const listed = await send();
    assert.equal(listed.status, 200);
    assert.equal((await listed.json()).data.Female.find(b => b.BatchID === 9).BatchName, 'Next batch');
  } finally {
    sql.Transaction = original.Transaction;
    sql.Request = original.Request;
    pool.request = original.request;
    await new Promise(resolve => server.close(resolve));
  }
});
