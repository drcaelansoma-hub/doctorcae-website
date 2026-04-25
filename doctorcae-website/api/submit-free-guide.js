// POST JSON { first_name, email } → Supabase public.guide_leads, then nurture Email 1 (Resend).
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY, RESEND_FROM
// Nurture: email_step 0→1 on successful Email 1; daily cron sends 2–5 (see api/cron-nurture-emails.js).

const { createClient } = require('@supabase/supabase-js');
const { sendEmailStep1 } = require('../lib/nurture-emails');

function logSupabaseError(context, err) {
  if (err == null) return;
  try {
    console.error(
      '[submit-free-guide]',
      context,
      JSON.stringify(err, ['message', 'details', 'hint', 'code', 'name'], 2),
    );
  } catch {
    console.error('[submit-free-guide]', context, err);
  }
  if (typeof err === 'object') {
    console.error('[submit-free-guide]', context, 'message=', err.message);
    console.error('[submit-free-guide]', context, 'details=', err.details);
    console.error('[submit-free-guide]', context, 'hint=', err.hint);
    console.error('[submit-free-guide]', context, 'code=', err.code);
  }
}

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

  if (typeof existing === 'string' && existing.length > 0) {
    try {
      return JSON.parse(existing);
    } catch {
      return bodyFromUrlEncoded(existing);
    }
  }

  if (existing != null && typeof existing === 'object' && !Buffer.isBuffer(existing)) {
    var keys = Object.keys(existing);
    if (keys.length > 0) {
      return existing;
    }
  }

  var raw;
  try {
    raw = await readRawBody(req);
  } catch {
    return {};
  }

  if (!raw) {
    return {};
  }

  var ct = String(req.headers['content-type'] || '').toLowerCase();
  if (ct.includes('application/json')) {
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }
  if (ct.includes('application/x-www-form-urlencoded')) {
    return bodyFromUrlEncoded(raw);
  }
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

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    console.log('[submit-free-guide] request received method=', req.method, 'url=', req.url);
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  console.log('[submit-free-guide] request received POST url=', req.url);

  const body = await readParsedBody(req);
  console.log(
    '[submit-free-guide] input parsed keys=',
    Object.keys(body || {}),
    'first_name_len=',
    String(body.first_name || '').length,
    'has_email=',
    Boolean(body.email),
  );

  const first_name = String(body.first_name || '').trim();
  const emailRaw = String(body.email || '').trim();
  const source = 'guide_page';
  const tag = 'body_first_guide';

  if (!first_name) {
    console.log('[submit-free-guide] stop: validation failed (missing first_name)');
    return res.status(400).json({ ok: false, error: 'Please enter your first name.' });
  }
  if (!emailRaw || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailRaw)) {
    console.log('[submit-free-guide] stop: validation failed (invalid email)');
    return res.status(400).json({ ok: false, error: 'Please enter a valid email address.' });
  }

  const email = emailRaw.toLowerCase();

  const supabaseUrl = String(
    process.env.SUPABASE_URL_FREE_GUIDE || process.env.SUPABASE_URL || '',
  ).trim();
  const serviceRole = String(
    process.env.SUPABASE_SERVICE_ROLE_KEY_FREE_GUIDE || process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  ).trim();
  console.log(
    '[submit-free-guide] env check has_SUPABASE_URL=',
    Boolean(supabaseUrl),
    'has_SERVICE_ROLE_KEY=',
    Boolean(serviceRole),
  );
  if (!supabaseUrl || !serviceRole) {
    console.error('[submit-free-guide] stop: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    return res.status(503).json({
      ok: false,
      error:
        'Signup is not fully connected yet (database keys on the server). You can still use the thank-you page for the PDF.',
      showThankYouAnyway: true,
    });
  }

  const supabase = createClient(supabaseUrl, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  console.log('[submit-free-guide] Supabase client created (table guide_leads, schema public default)');

  var duplicate = false;
  var row = null;

  try {
    const insertPayload = {
      first_name,
      email,
      source,
      tag,
      download_sent: false,
      email_step: 0,
      last_email_sent_at: null,
    };
    console.log('[submit-free-guide] insert attempted public.guide_leads email=', email);

    const ins = await supabase
      .from('guide_leads')
      .insert(insertPayload)
      .select('id, email, download_sent, email_step, last_email_sent_at');

    if (ins.error && ins.error.code === '23505') {
      duplicate = true;
      console.log(
        '[submit-free-guide] insert duplicate (expected 23505), loading row code=',
        ins.error.code,
      );

      const sel = await supabase
        .from('guide_leads')
        .select('id, email, download_sent, email_step, last_email_sent_at, first_name')
        .eq('email', email)
        .maybeSingle();

      if (sel.error || !sel.data) {
        logSupabaseError('select existing lead failed', sel.error);
        return res.status(500).json({
          ok: false,
          error: 'Something went wrong saving your signup. Please try again.',
          supabaseCode: sel.error ? sel.error.code : 'NO_ROW',
          supabaseMessage: sel.error ? sel.error.message : null,
        });
      }
      row = sel.data;
      console.log('[submit-free-guide] loaded existing row id=', row.id);

      const upd = await supabase
        .from('guide_leads')
        .update({ first_name, source, tag })
        .eq('email', email);
      if (upd.error) {
        logSupabaseError('optional update failed', upd.error);
      } else {
        console.log('[submit-free-guide] duplicate row metadata updated');
      }
    } else if (ins.error) {
      logSupabaseError('insert failed', ins.error);
      return res.status(500).json({
        ok: false,
        error: 'Something went wrong saving your signup. Please try again.',
        supabaseCode: ins.error.code || null,
        supabaseMessage: ins.error.message || null,
        supabaseDetails: ins.error.details || null,
      });
    } else {
      var insertedRows = Array.isArray(ins.data) ? ins.data : ins.data ? [ins.data] : [];
      if (insertedRows.length > 0) {
        row = insertedRows[0];
        console.log('[submit-free-guide] insert succeeded id=', row && row.id, 'email=', row && row.email);
      } else {
        const recover = await supabase
          .from('guide_leads')
          .select('id, email, download_sent, email_step, last_email_sent_at')
          .eq('email', email)
          .maybeSingle();
        if (!recover.error && recover.data) {
          row = recover.data;
          console.log('[submit-free-guide] recovered row after insert returned no rows');
        } else {
          logSupabaseError('insert returned no rows and recover failed', recover.error);
          return res.status(500).json({
            ok: false,
            error: 'Something went wrong saving your signup. Please try again.',
            supabaseCode: recover.error ? recover.error.code : 'EMPTY_INSERT',
            supabaseMessage: recover.error ? recover.error.message : null,
          });
        }
      }
    }
  } catch (e) {
    console.error('[submit-free-guide] Supabase exception', e && e.stack ? e.stack : e);
    return res.status(500).json({
      ok: false,
      error: 'Something went wrong saving your signup. Please try again.',
    });
  }

  if (!row) {
    console.error('[submit-free-guide] stop: row is null after insert path');
    return res.status(500).json({
      ok: false,
      error: 'Something went wrong. Please try again.',
      supabaseCode: 'NO_ROW',
    });
  }

  var step = Number(row.email_step);
  if (Number.isNaN(step)) step = 0;

  if (step >= 1) {
    console.log('[submit-free-guide] skip email: nurture already started (email_step>=1)');
    return res.status(200).json({
      ok: true,
      duplicate: duplicate,
      emailSent: false,
      alreadyDelivered: true,
    });
  }

  if (row.download_sent === true) {
    console.log('[submit-free-guide] skip email: already marked delivered (legacy or prior send)');
    return res.status(200).json({
      ok: true,
      duplicate: duplicate,
      emailSent: false,
      alreadyDelivered: true,
    });
  }

  const resendKey = process.env.RESEND_API_KEY;
  const resendFrom = process.env.RESEND_FROM;
  if (!resendKey || !resendFrom) {
    console.error(
      '[submit-free-guide] lead saved; nurture email skipped — set RESEND_API_KEY, RESEND_FROM',
    );
    return res.status(200).json({
      ok: true,
      duplicate: duplicate,
      emailSent: false,
      alreadyDelivered: false,
    });
  }

  var emailSent = false;
  try {
    console.log('[submit-free-guide] nurture Email 1 send starting');
    const nurture = await sendEmailStep1(first_name, emailRaw);
    if (!nurture.ok) {
      console.error('[submit-free-guide] nurture Email 1 failed', nurture.error);
    } else {
      emailSent = true;
      console.log('[submit-free-guide] nurture Email 1 accepted');
    }
  } catch (e) {
    console.error('[submit-free-guide] nurture Email 1 exception', e && e.stack ? e.stack : e);
  }

  if (emailSent) {
    const nowIso = new Date().toISOString();
    const updFlag = await supabase
      .from('guide_leads')
      .update({
        download_sent: true,
        email_step: 1,
        last_email_sent_at: nowIso,
      })
      .eq('email', email);

    if (updFlag.error) {
      logSupabaseError('failed to set nurture fields after send', updFlag.error);
    } else {
      console.log('[submit-free-guide] email_step=1, last_email_sent_at set for email=', email);
    }
  } else {
    console.warn(
      '[submit-free-guide] lead saved but Email 1 not sent; email_step not incremented — cron will retry',
      email,
    );
  }

  console.log(
    '[submit-free-guide] response ok duplicate=',
    duplicate,
    'emailSent=',
    emailSent,
    'alreadyDelivered=',
    false,
  );
  return res.status(200).json({
    ok: true,
    duplicate: duplicate,
    emailSent: emailSent,
    alreadyDelivered: false,
  });
};
