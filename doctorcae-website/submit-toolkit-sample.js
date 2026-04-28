// POST JSON { name?, first_name?, email } → Supabase public.toolkit_sample_leads + Resend sample email.
// Optional Formspree forward: set FORMSPREE_TOOLKIT_ENDPOINT to your Formspree endpoint URL.
const { createClient } = require('@supabase/supabase-js');

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

/** Trim and strip a single layer of wrapping quotes (common copy/paste mistake in Vercel). */
function normalizeEnvSecret(value) {
  var s = String(value || '').trim();
  if (
    (s.charAt(0) === '"' && s.charAt(s.length - 1) === '"') ||
    (s.charAt(0) === "'" && s.charAt(s.length - 1) === "'")
  ) {
    s = s.slice(1, -1).trim();
  }
  return s;
}

function supabaseInsertFailurePayload(err) {
  var code = err && err.code ? err.code : null;
  var message = err && err.message ? String(err.message) : '';
  var details = err && err.details != null ? err.details : null;
  var userError = 'Something went wrong saving your signup. Please try again.';
  if (/invalid api key/i.test(message) || /jwt\s*(is\s*)?(invalid|expired)/i.test(message)) {
    userError =
      'Supabase rejected the server key (often shown as “Invalid API key”). In Vercel, open your toolkit Supabase project → Settings → API: copy Project URL into SUPABASE_URL_TOOLKIT and the service_role secret into SUPABASE_SERVICE_ROLE_KEY_TOOLKIT (not the anon public key). Remove extra quotes or spaces, save, then Redeploy.';
  }
  return {
    ok: false,
    error: userError,
    supabaseCode: code,
    supabaseMessage: message || null,
    supabaseDetails: details,
  };
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
  const name = String(body.name || body.first_name || '').trim();
  const emailRaw = String(body.email || '').trim();
  const source = 'toolkit_sample';
  const productInterest = 'Body First Framework Manual and Toolkit';
  if (!emailRaw) return res.status(400).json({ ok: false, error: 'Email is required.' });
  if (!emailRaw || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailRaw)) {
    return res.status(400).json({ ok: false, error: 'Please enter a valid email address.' });
  }
  const email = emailRaw.toLowerCase();

  const supabaseUrl = normalizeEnvSecret(
    process.env.SUPABASE_URL_TOOLKIT || process.env.SUPABASE_URL || '',
  );
  const serviceRole = normalizeEnvSecret(
    process.env.SUPABASE_SERVICE_ROLE_KEY_TOOLKIT || process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  );
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

  var leadId = null;
  try {
    const ins = await supabase
      .from('toolkit_sample_leads')
      .insert({
        name: name || null,
        email,
        source,
        product_interest: productInterest,
        download_sent: false,
        error_message: null,
      })
      .select('id')
      .single();

    if (ins.error && ins.error.code === '23505') {
      const upd = await supabase
        .from('toolkit_sample_leads')
        .update({
          name: name || null,
          source,
          product_interest: productInterest,
        })
        .eq('email', email)
        .select('id')
        .single();
      if (upd.error) {
        console.error('[submit-toolkit-sample] duplicate update failed', upd.error);
        return res.status(500).json(supabaseInsertFailurePayload(upd.error));
      }
      leadId = upd.data && upd.data.id ? upd.data.id : null;
      console.log('[submit-toolkit-sample] duplicate lead updated id=', leadId, 'email=', email);
    } else if (ins.error) {
      console.error('[submit-toolkit-sample] insert failed', ins.error);
      return res.status(500).json(supabaseInsertFailurePayload(ins.error));
    } else {
      leadId = ins.data && ins.data.id ? ins.data.id : null;
      console.log('[submit-toolkit-sample] lead inserted id=', leadId, 'email=', email);
    }
  } catch (err) {
    console.error('[submit-toolkit-sample] insert exception', err && err.message ? err.message : err);
    return res.status(500).json({
      ok: false,
      error: 'Something went wrong saving your signup.',
      supabaseMessage: err && err.message ? String(err.message) : null,
    });
  }

  var sendToolkitSampleEmail = null;
  var addResendContactToAudience = null;
  try {
    var nurture = require('../lib/nurture-emails');
    sendToolkitSampleEmail = nurture.sendToolkitSampleEmail;
    addResendContactToAudience = nurture.addResendContactToAudience;
    if (typeof sendToolkitSampleEmail !== 'function') {
      throw new Error('sendToolkitSampleEmail export is missing');
    }
  } catch (err) {
    console.error(
      '[submit-toolkit-sample] failed to load nurture email module',
      err && err.stack ? err.stack : err,
    );
    sendToolkitSampleEmail = null;
  }

  const resendAudienceId = String(
    process.env.RESEND_AUDIENCE_ID_TOOLKIT ||
      process.env.RESEND_AUDIENCE_ID_FREE_GUIDE ||
      process.env.RESEND_AUDIENCE_ID ||
      '',
  ).trim();
  if (resendAudienceId && typeof addResendContactToAudience === 'function') {
    try {
      const sync = await addResendContactToAudience(email, name || 'there', resendAudienceId, 'toolkit_sample');
      if (!sync.ok && !sync.skipped) {
        console.warn('[submit-toolkit-sample] resend contact sync failed', sync.error);
      } else {
        console.log('[submit-toolkit-sample] resend contact sync ok duplicate=', Boolean(sync.duplicate));
      }
    } catch (syncErr) {
      console.warn(
        '[submit-toolkit-sample] resend contact sync exception',
        syncErr && syncErr.message ? syncErr.message : syncErr,
      );
    }
  }

  var emailSent = false;
  var resendMessageId = null;
  var resendErrorMessage = null;
  if (typeof sendToolkitSampleEmail === 'function') {
    try {
      const sent = await sendToolkitSampleEmail(name || 'there', email);
      emailSent = !!(sent && sent.ok);
      resendMessageId = sent && sent.resendMessageId ? String(sent.resendMessageId) : null;
      if (!emailSent) {
        resendErrorMessage = toErrorString(sent && sent.error, 'Resend send returned not ok');
      }
    } catch (err) {
      emailSent = false;
      resendErrorMessage = err && err.message ? String(err.message) : 'Resend send exception';
    }
  } else {
    resendErrorMessage = 'Email module unavailable on server; lead saved and email can be resent later.';
  }

  if (emailSent) {
    console.log('[submit-toolkit-sample] resend success email=', email, 'message_id=', resendMessageId);
  } else {
    console.error('[submit-toolkit-sample] resend failed email=', email, 'error=', resendErrorMessage);
  }

  try {
    if (emailSent) {
      await supabase
        .from('toolkit_sample_leads')
        .update({
          download_sent: true,
          email_sent_at: new Date().toISOString(),
          resend_message_id: resendMessageId,
          error_message: null,
        })
        .eq('email', email);
    } else {
      await supabase
        .from('toolkit_sample_leads')
        .update({
          download_sent: false,
          error_message: resendErrorMessage,
          resend_message_id: null,
        })
        .eq('email', email);
    }
  } catch (err) {
    console.error(
      '[submit-toolkit-sample] failed to update send status email=',
      email,
      'error=',
      err && err.message ? err.message : err,
    );
  }

  const formspreeEndpoint = String(process.env.FORMSPREE_TOOLKIT_ENDPOINT || '').trim();
  if (formspreeEndpoint) {
    try {
      await fetch(formspreeEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          name: name || '',
          email: emailRaw,
          source,
          product_interest: productInterest,
        }),
      });
    } catch {
      // Non-blocking: keep primary signup flow working even if Formspree is unavailable.
    }
  }

  var deliveryCode = emailSent ? 'sent' : 'send_failed';
  var deliveryHint = null;
  if (!emailSent) {
    if (typeof sendToolkitSampleEmail !== 'function') {
      deliveryCode = 'module_load_failed';
      deliveryHint =
        'Email module failed to load on the server — Resend send was not attempted. Check Vercel logs.';
    } else if (resendErrorMessage) {
      deliveryHint = String(resendErrorMessage).slice(0, 280);
    } else {
      deliveryCode = 'send_not_completed';
      deliveryHint = 'Lead saved but sample email did not complete — check Vercel logs for submit-toolkit-sample.';
    }
  } else {
    deliveryHint = 'Sample email accepted by Resend — check Resend → Emails for this recipient.';
  }

  return res.status(200).json({
    ok: true,
    emailSent,
    resendMessageId,
    showThankYouAnyway: !emailSent,
    leadId,
    emailDeliveryCode: deliveryCode,
    emailDeliveryHint: deliveryHint,
  });
};
