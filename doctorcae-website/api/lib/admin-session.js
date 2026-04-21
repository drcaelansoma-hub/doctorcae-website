const crypto = require('crypto');

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function createToken(secret) {
  const exp = Date.now() + WEEK_MS;
  const payload = String(exp);
  const hmac = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  return `${payload}.${hmac}`;
}

function verifyToken(token, secret) {
  if (!token || !secret || typeof token !== 'string') return false;
  const i = token.lastIndexOf('.');
  if (i <= 0) return false;
  const payload = token.slice(0, i);
  const hmac = token.slice(i + 1);
  if (!/^\d+$/.test(payload) || !/^[0-9a-f]{64}$/.test(hmac)) return false;
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  try {
    const a = Buffer.from(hmac, 'hex');
    const b = Buffer.from(expected, 'hex');
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;
  } catch {
    return false;
  }
  return Date.now() <= Number(payload);
}

function parseAdminCookie(cookieHeader) {
  if (!cookieHeader || typeof cookieHeader !== 'string') return null;
  const parts = cookieHeader.split(';');
  for (const p of parts) {
    const idx = p.indexOf('=');
    if (idx === -1) continue;
    const k = p.slice(0, idx).trim();
    if (k === 'admin_session') return decodeURIComponent(p.slice(idx + 1).trim());
  }
  return null;
}

function constantTimePasswordOk(input, expectedPass) {
  if (expectedPass == null || input == null) return false;
  const a = crypto.createHash('sha256').update(String(input), 'utf8').digest();
  const b = crypto.createHash('sha256').update(String(expectedPass), 'utf8').digest();
  return crypto.timingSafeEqual(a, b);
}

module.exports = {
  createToken,
  verifyToken,
  parseAdminCookie,
  constantTimePasswordOk,
};
