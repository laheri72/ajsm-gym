const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { pool } = require('../utils/db');
const staffRoutes = require('../routes/staff');
const fitnessTestRoutes = require('../routes/fitnessTest');

test('staff fitness records and roster stay gender scoped while admin sees the branch', async () => {
  const original = pool.request;
  const queries = [];
  pool.request = () => ({
    input() { return this; },
    async query(sqlText) {
      queries.push(sqlText);
      if (sqlText.includes('COUNT(*) AS totalStudents')) return { recordset:[{ totalStudents:2 }] };
      if (sqlText.includes('FROM TestMaster') && !sqlText.includes('TestRecords')) return { recordset:[{ TR:12345, Name:'Student' }] };
      if (sqlText.includes('FROM TestRecords TRS')) return { recordset:[] };
      throw new Error(`Unexpected query: ${sqlText.slice(0,60)}`);
    }
  });
  const app = express();
  app.use((req,_res,next) => { req.session = { user:JSON.parse(req.headers['x-test-user']) }; next(); });
  app.use(staffRoutes,fitnessTestRoutes);
  const server = app.listen(0,'127.0.0.1');
  try {
    await new Promise(resolve => server.once('listening',resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    for (const role of ['Staff','Admin']) {
      const user = { Role:role, Branch:'Marol', Gender:'Male' };
      const request = url => fetch(base+url,{ headers:{ 'x-test-user':JSON.stringify(user) } });
      for (const url of ['/api/all-test-records','/api/fitness-test/all-students','/api/fitness-test/students/count']) {
        queries.length = 0;
        assert.equal((await request(url)).status,200);
        assert.equal(queries.length,1);
        assert.equal(/Gender = @Gender/.test(queries[0]),role === 'Staff');
      }
    }
  } finally {
    pool.request = original;
    await new Promise(resolve => server.close(resolve));
  }
});
