// POST JSON { first_name, email } → Supabase public.guide_leads + Resend toolkit sample email.
// Optional Formspree forward: set FORMSPREE_TOOLKIT_ENDPOINT to your Formspree endpoint URL.
const { createClient } = require('@supabase/supabase-js');
const { sendToolkitSampleEmail } = require('../lib/nurture-emails');

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

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  const body = await readParsedBody(req);
  const first_name = String(body.first_name || '').trim();
  const emailRaw = String(body.email || '').trim();
  const source = 'toolkit_sample_page';
  const tag = 'body_first_toolkit_sample';
  if (!first_name) return res.status(400).json({ ok: false, error: 'Please enter your first name.' });
  if (!emailRaw || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailRaw)) {
    return res.status(400).json({ ok: false, error: 'Please enter a valid email address.' });
  }
  const email = emailRaw.toLowerCase();

  const supabaseUrl = String(process.env.SUPABASE_URL || '').trim();
  const serviceRole = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  if (!supabaseUrl || !serviceRole) {
    return res.status(503).json({
      ok: false,
      error: 'Signup is not fully connected yet (database keys missing).',
      showThankYouAnyway: true,
    });
  }

  const supabase = createClient(supabaseUrl, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const ins = await supabase
      .from('guide_leads')
      .insert({
        first_name,
        email,
        source,
        tag,
        download_sent: false,
      })
      .select('id');

    if (ins.error && ins.error.code === '23505') {
      await supabase.from('guide_leads').update({ first_name, source, tag }).eq('email', email);
    } else if (ins.error) {
      return res.status(500).json({
        ok: false,
        error: 'Something went wrong saving your signup. Please try again.',
        supabaseCode: ins.error.code || null,
      });
    }
  } catch {
    return res.status(500).json({ ok: false, error: 'Something went wrong saving your signup.' });
  }

  var emailSent = false;
  try {
    const sent = await sendToolkitSampleEmail(first_name, emailRaw);
    emailSent = !!(sent && sent.ok);
  } catch {
    emailSent = false;
  }

  if (emailSent) {
    await supabase
      .from('guide_leads')
      .update({ download_sent: true })
      .eq('email', email);
  }

  const formspreeEndpoint = String(process.env.FORMSPREE_TOOLKIT_ENDPOINT || '').trim();
  if (formspreeEndpoint) {
    try {
      await fetch(formspreeEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          first_name,
          email: emailRaw,
          source,
          tag,
        }),
      });
    } catch {
      // Non-blocking: keep primary signup flow working even if Formspree is unavailable.
    }
  }

  return res.status(200).json({
    ok: true,
    emailSent,
    showThankYouAnyway: !emailSent,
  });
};
