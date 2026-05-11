// POST JSON { first_name, email } → Resend contact (tag CARDS) + sample cards email with PDF link.
// Env: RESEND_API_KEY, RESEND_FROM or RESEND_FROM_EMAIL
// Optional: RESEND_AUDIENCE_ID_CARDS, RESEND_AUDIENCE_ID, RESEND_AUDIENCE_ID_FREE_GUIDE
// Optional: SITE_URL (absolute base for email PDF link; else inferred from request / Vercel)
// Optional: BEHIND_THE_BEHAVIOR_SAMPLE_PATH (default matches public/downloads/FREE Behind the Behavior Sample.pdf)

function bodyFromUrlEncoded(raw) {
  const out = {};
  new URLSearchParams(raw).forEach(function (value, key) {
    out[key] = value;
  });
  return out;
}

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

async function readParsedBody(req) {
  var existing = req.body;
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
      return bodyFromUrlEncoded(existing);
    }
  }
  if (existing != null && typeof existing === 'object' && !Buffer.isBuffer(existing)) {
    var keys = Object.keys(existing);
    if (keys.length > 0) return existing;
  }
  var raw = '';
  try {
    raw = await readRawBody(req);
  } catch {
    return {};
  }
  if (!raw) return {};
  var ct = String(req.headers['content-type'] || '').toLowerCase();
  if (ct.includes('application/json')) {
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }
  if (ct.includes('application/x-www-form-urlencoded')) return bodyFromUrlEncoded(raw);
  try {
    return JSON.parse(raw);
  } catch {
    return bodyFromUrlEncoded(raw);
  }
}

function absoluteSiteBase(req) {
  var explicit = String(process.env.SITE_URL || process.env.PUBLIC_SITE_URL || '').trim();
  if (explicit) return explicit.replace(/\/$/, '');
  var vercel = String(process.env.VERCEL_URL || '').trim();
  if (vercel) {
    return (vercel.indexOf('http') === 0 ? vercel : 'https://' + vercel).replace(/\/$/, '');
  }
  var proto = String(req.headers['x-forwarded-proto'] || 'https').split(',')[0].trim() || 'https';
  var host = String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim();
  if (host) return proto + '://' + host.replace(/\/$/, '');
  return 'https://www.doctorcae.com';
}

/** Encode each path segment so filenames with spaces (e.g. FREE Behind…) work in email links. */
function encodePathSegments(path) {
  var parts = String(path || '')
    .split('/')
    .filter(function (p) {
      return p.length > 0;
    });
  return '/' + parts.map(function (seg) { return encodeURIComponent(seg); }).join('/');
}

function samplePdfAbsoluteUrl(req) {
  var path = String(
    process.env.BEHIND_THE_BEHAVIOR_SAMPLE_PATH ||
      '/downloads/FREE Behind the Behavior Sample.pdf',
  ).trim();
  if (!path.startsWith('/')) path = '/' + path;
  return absoluteSiteBase(req) + encodePathSegments(path);
}

function toErrorString(x, fallback) {
  var fb = fallback || 'Resend send returned not ok';
  if (x == null) return fb;
  if (typeof x === 'string') return x;
  if (typeof x === 'object' && typeof x.message === 'string' && x.message) return x.message;
  try {
    return JSON.stringify(x);
  } catch (e) {
    return fb;
  }
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  const body = await readParsedBody(req);
  const firstName = String(body.first_name || body.firstName || '').trim();
  const emailRaw = String(body.email || '').trim();
  if (!emailRaw) return res.status(400).json({ ok: false, error: 'Email is required.' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailRaw)) {
    return res.status(400).json({ ok: false, error: 'Please enter a valid email address.' });
  }
  const email = emailRaw.toLowerCase();

  const resendKey = String(process.env.RESEND_API_KEY || '').trim();
  const resendFrom = String(process.env.RESEND_FROM_EMAIL || process.env.RESEND_FROM || '').trim();
  if (!resendKey || !resendFrom) {
    return res.status(503).json({
      ok: false,
      error: 'Email delivery is not configured on the server (RESEND_API_KEY / RESEND_FROM).',
    });
  }

  const downloadUrl = samplePdfAbsoluteUrl(req);

  var sendCardsSampleEmail = null;
  var addResendContactToAudience = null;
  try {
    var nurture = require('../lib/nurture-emails');
    sendCardsSampleEmail = nurture.sendCardsSampleEmail;
    addResendContactToAudience = nurture.addResendContactToAudience;
    if (typeof sendCardsSampleEmail !== 'function') {
      throw new Error('sendCardsSampleEmail export is missing');
    }
  } catch (err) {
    console.error(
      '[submit-cards-sample] failed to load nurture email module',
      err && err.stack ? err.stack : err,
    );
    return res.status(500).json({
      ok: false,
      error: 'Email module unavailable. Please try again later.',
    });
  }

  const resendAudienceId = String(
    process.env.RESEND_AUDIENCE_ID_CARDS ||
      process.env.RESEND_AUDIENCE_ID ||
      process.env.RESEND_AUDIENCE_ID_FREE_GUIDE ||
      '',
  ).trim();

  if (resendAudienceId && typeof addResendContactToAudience === 'function') {
    try {
      var sync = await addResendContactToAudience(email, firstName || 'there', resendAudienceId, 'CARDS');
      if (!sync.ok && !sync.skipped) {
        console.warn('[submit-cards-sample] resend contact sync failed', sync.error);
      } else {
        console.log('[submit-cards-sample] resend contact sync ok duplicate=', Boolean(sync.duplicate));
      }
    } catch (syncErr) {
      console.warn(
        '[submit-cards-sample] resend contact sync exception',
        syncErr && syncErr.message ? syncErr.message : syncErr,
      );
    }
  } else {
    console.warn(
      '[submit-cards-sample] RESEND_AUDIENCE_ID / RESEND_AUDIENCE_ID_CARDS not set — contact not added to audience',
    );
  }

  var emailSent = false;
  var resendMessageId = null;
  var resendErrorMessage = null;
  try {
    var sent = await sendCardsSampleEmail(firstName, email, downloadUrl);
    emailSent = !!(sent && sent.ok);
    resendMessageId = sent && sent.resendMessageId ? String(sent.resendMessageId) : null;
    if (!emailSent) {
      resendErrorMessage = toErrorString(sent && sent.error, 'Resend send returned not ok');
    }
  } catch (err) {
    emailSent = false;
    resendErrorMessage = err && err.message ? String(err.message) : 'Resend send exception';
  }

  if (!emailSent) {
    console.error('[submit-cards-sample] resend failed email=', email, 'error=', resendErrorMessage);
    return res.status(200).json({
      ok: false,
      error:
        resendErrorMessage ||
        'We could not send the email right now. Please try again in a few minutes.',
      hint: resendErrorMessage,
    });
  }

  console.log('[submit-cards-sample] success email=', email, 'message_id=', resendMessageId);

  return res.status(200).json({
    ok: true,
    emailSent: true,
    redirect: '/cards-sample-thank-you',
    resendMessageId: resendMessageId,
  });
};
