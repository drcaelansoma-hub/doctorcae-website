/**
 * POST JSON { "password": "..." }
 * Sets HttpOnly cookie Path=/ (7 days) so /api/admin-session receives it; requires ADMIN_PASSWORD + ADMIN_SESSION_SECRET.
 */
const {
  createToken,
  constantTimePasswordOk,
} = require('../admin-session');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const adminPassword = (process.env.ADMIN_PASSWORD || '').trim();
  const sessionSecret = (process.env.ADMIN_SESSION_SECRET || '').trim();

  if (!adminPassword || !sessionSecret) {
    return res.status(503).json({
      error:
        'Admin is not configured. In Vercel → Settings → Environment Variables, set ADMIN_PASSWORD and ADMIN_SESSION_SECRET (long random string), then redeploy.',
    });
  }

  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const password =
    body.password !== undefined && body.password !== null
      ? String(body.password).trim()
      : '';

  if (!constantTimePasswordOk(password, adminPassword)) {
    return res.status(401).json({ error: 'Invalid password' });
  }

  const token = createToken(sessionSecret);
  const maxAge = 7 * 24 * 60 * 60;
  const isProd = process.env.VERCEL_ENV === 'production';
  const secureFlag = isProd ? '; Secure' : '';

  // Path must be / so the cookie is sent to /api/admin-session (not only /admin/*).
  res.setHeader(
    'Set-Cookie',
    `admin_session=${encodeURIComponent(token)}; HttpOnly; Path=/; Max-Age=${maxAge}; SameSite=Lax${secureFlag}`,
  );

  return res.status(200).json({ ok: true });
};
