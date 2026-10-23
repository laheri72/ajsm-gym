const allowedWhileChangingPassword = new Set([
  '/session-user',
  '/staff/set-initial-password',
  '/logout',
  '/staff-login',
  '/trainer-login'
]);

function requireStaffPasswordChange(req, res, next) {
  if (!req.session?.user?.Username || !req.session.user.mustChangePassword || allowedWhileChangingPassword.has(req.path)) {
    return next();
  }

  return res.status(403).json({
    success: false,
    code: 'PASSWORD_CHANGE_REQUIRED',
    message: 'Change your temporary password before continuing.'
  });
}

module.exports = { requireStaffPasswordChange };
