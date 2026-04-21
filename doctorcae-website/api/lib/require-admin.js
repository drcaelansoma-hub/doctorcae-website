const { verifyToken, parseAdminCookie } = require('./admin-session');

/**
 * @returns {boolean} true if authorized
 */
function requireAdmin(req, res) {
  const secret = process.env.ADMIN_SESSION_SECRET;
  const token = parseAdminCookie(req.headers.cookie || '');
  if (!secret || !verifyToken(token, secret)) {
    res.status(401).json({ error: 'Unauthorized' });
    return false;
  }
  return true;
}

module.exports = { requireAdmin };
