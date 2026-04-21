/**
 * POST JSON { "password": "..." }
 * Sets HttpOnly cookie Path=/ (7 days) so /api/admin-session receives it; requires ADMIN_PASSWORD + ADMIN_SESSION_SECRET.
 */
const {
  createToken,
  constantTimePasswordOk,
} = require('./admin-session');

function readRawBody(req) {
  return new Promise(function (resolve, reject) {
    var chunks = [];
    req.on('data', function (chunk) {
      chunks.push(chunk);
    });
    req.on('end', function () {
      resolve(Buffer.concat(chunks).toString('utf8'));
    });
    req.on('error', reject);
  });
}

async function readParsedJsonBody(req) {
  var existing = req.body;
  // Vercel often gives JSON as a Buffer; never fall through to readRawBody for that.
  if (Buffer.isBuffer(existing)) {
    try {
      return JSON.parse(existing.toString('utf8'));
    } catch {
      return {};
    }
  }
  if (typeof existing === 'string' && existing.length > 0) {
    try {
      return JSON.parse(existing);
    } catch {
      return {};
    }
  }
  if (existing != null && typeof existing === 'object') {
    var keys = Object.keys(existing);
    if (keys.length > 0) {
      return existing;
    }
    // Empty object: treat as "no parsed fields" — do not re-read stream (can hang or 500 on Vercel).
    return {};
  }
  // Body not parsed yet — read raw stream once (only when undefined/null).
  if (existing === undefined || existing === null) {
    var raw;
    try {
      raw = await readRawBody(req);
    } catch {
      return {};
    }
    if (!raw) {
      return {};
    }
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }
  return {};
}

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

  try {
    const adminPassword = (process.env.ADMIN_PASSWORD || '').trim();
    const sessionSecret = (process.env.ADMIN_SESSION_SECRET || '').trim();

    if (!adminPassword || !sessionSecret) {
      return res.status(503).json({
        error:
          'Admin is not configured. In Vercel → Settings → Environment Variables, set ADMIN_PASSWORD and ADMIN_SESSION_SECRET (long random string), then redeploy.',
      });
    }

    const body = await readParsedJsonBody(req);
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

    res.setHeader(
      'Set-Cookie',
      `admin_session=${encodeURIComponent(token)}; HttpOnly; Path=/; Max-Age=${maxAge}; SameSite=Lax${secureFlag}`,
    );

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[admin-login]', err);
    return res.status(500).json({
      error: 'Server error while signing in. Check Vercel → project → Logs for details.',
    });
  }
};
