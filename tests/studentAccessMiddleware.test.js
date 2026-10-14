const test = require('node:test');
const assert = require('node:assert/strict');
const { requireStudentPasswordChange, requireGymMembership } = require('../middleware/studentAccess');

function response() {
  return {
    statusCode:200, body:null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  };
}

test('an existing student session cannot block staff, trainer, or student login', async () => {
  let queries = 0;
  const pool = { request() { queries++; throw new Error('Login should not query gym membership'); } };
  const gymGate = requireGymMembership(pool, { Int:'Int' });
  for (const path of ['/staff-login', '/trainer-login', '/student-login']) {
    const req = { method:'POST', path, session:{ user:{ TR:26731, mustChangePassword:true } } };
    const res = response();
    let passed = 0;
    requireStudentPasswordChange(req, res, () => passed++);
    await gymGate(req, res, () => passed++);
    assert.equal(passed,2,path);
    assert.equal(res.statusCode,200,path);
  }
  assert.equal(queries,0);
});

test('gym APIs still reject an ineligible student session', async () => {
  const pool = { request() { return { input() { return this; }, async query() {
    return { recordset:[{ Status:'Inactive', JoinedAt:null }] };
  } }; } };
  const req = { method:'GET', path:'/weekly-plan', session:{ user:{ TR:26731 } } };
  const res = response();
  let passed = false;
  await requireGymMembership(pool, { Int:'Int' })(req,res,() => { passed = true; });
  assert.equal(passed,false);
  assert.equal(res.statusCode,403);
  assert.equal(res.body.message,'Gym membership required.');
});

test('first-login password gate remains in force for other student APIs', () => {
  const req = { method:'GET', path:'/weekly-plan', session:{ user:{ TR:26731, mustChangePassword:true } } };
  const res = response();
  let passed = false;
  requireStudentPasswordChange(req,res,() => { passed = true; });
  assert.equal(passed,false);
  assert.equal(res.statusCode,403);
  assert.equal(res.body.message,'Set your password before continuing.');
});
