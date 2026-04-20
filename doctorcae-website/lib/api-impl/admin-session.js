/**
 * GET — returns { ok: true } if valid admin_session cookie; else 401.
 */
const { verifyToken, parseAdminCookie } = require('../admin-session');

module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const sessionSecret = (process.env.ADMIN_SESSION_SECRET || '').trim();
  if (!sessionSecret) {
    return res.status(503).json({ ok: false, error: 'Not configured' });
  }

  const token = parseAdminCookie(req.headers.cookie || '');
  if (!verifyToken(token, sessionSecret)) {
    return res.status(401).json({ ok: false });
  }

  return res.status(200).json({ ok: true });
};
