const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { pool } = require('../utils/db');
const authRoutes = require('../routes/auth');

test('master students in every status can use first login while missing records cannot', async () => {
  const originalRequest = pool.request;
  const students = new Map([
    [12345, 'Active'], [23456, 'Inactive'], [34567, 'Revoked'], [45678, null]
  ]);
  pool.request = () => {
    let tr;
    return {
      input(name, _type, value) { if (name === 'TR') tr = Number(value); return this; },
      async query() {
        const status = students.get(tr);
        return { recordset: students.has(tr) ? [{ TR: tr, ITS: 12345678, Name: 'Student', Branch: 'Marol', Gender: 'Male', Status: status, Password: null }] : [] };
      }
    };
  };
  const app = express();
  let session;
  app.use(express.json());
  app.use((req, _res, next) => {
    session = { regenerate(callback) { callback(); } };
    req.session = session;
    next();
  });
  app.use(authRoutes);
  const server = app.listen(0, '127.0.0.1');
  try {
    await new Promise(resolve => server.once('listening', resolve));
    const url = `http://127.0.0.1:${server.address().port}/api/student-login`;
    for (const tr of students.keys()) {
      const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tr, password: String(tr) }) });
      const body = await response.json();
      assert.equal(response.status, 200);
      assert.equal(body.forcePasswordChange, true);
      assert.equal(session.user.TR, tr);
      assert.equal(session.user.mustChangePassword, true);
    }
    const absent = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tr: 56789, password: '56789' }) });
    assert.equal(absent.status, 401);
  } finally {
    pool.request = originalRequest;
    await new Promise(resolve => server.close(resolve));
  }
});
