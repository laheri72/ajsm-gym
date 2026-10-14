const LOGIN_PATHS = new Set(['/student-login', '/staff-login', '/trainer-login']);
const FITNESS_PATHS = new Set([
  '/student-session', '/student/set-initial-password', '/logout',
  '/testmaster/me', '/testmaster/me/dob', '/medical-history/me',
  '/testrecords', '/testrecords/me', '/testactivity/me', '/evaluations/me',
  '/fitness-profiles/me'
]);

const isLoginRequest = req => req.method === 'POST' && LOGIN_PATHS.has(req.path);

function requireStudentPasswordChange(req, res, next) {
  if (isLoginRequest(req)) return next();
  if (req.session?.user?.TR && req.session.user.mustChangePassword &&
      !['/student-session', '/student/set-initial-password', '/logout'].includes(req.path)) {
    return res.status(403).json({ success:false, message:'Set your password before continuing.' });
  }
  next();
}

function requireGymMembership(pool, sql) {
  return async (req, res, next) => {
    if (isLoginRequest(req) || !req.session?.user?.TR || FITNESS_PATHS.has(req.path) ||
        /^\/fitness-profiles\/\d+$/.test(req.path) || /^\/fitness-reports\/\d+\.pdf$/.test(req.path)) return next();
    try {
      const result = await pool.request().input('TR', sql.Int, req.session.user.TR)
        .query('SELECT Status, JoinedAt FROM TestMaster WHERE TR = @TR');
      if (result.recordset[0]?.Status === 'Active' && result.recordset[0]?.JoinedAt) return next();
      return res.status(403).json({ success:false, message:'Gym membership required.' });
    } catch (error) { return next(error); }
  };
}

module.exports = { requireStudentPasswordChange, requireGymMembership };
