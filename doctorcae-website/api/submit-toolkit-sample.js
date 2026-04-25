// POST JSON { name?, first_name?, email } → Supabase public.toolkit_sample_leads + Resend sample email.
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
  const name = String(body.name || body.first_name || '').trim();
  const emailRaw = String(body.email || '').trim();
  const source = 'toolkit_sample';
  const productInterest = 'Body First Framework Manual and Toolkit';
  if (!emailRaw) return res.status(400).json({ ok: false, error: 'Email is required.' });
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
        return res.status(500).json({
          ok: false,
          error: 'Something went wrong saving your signup. Please try again.',
          supabaseCode: upd.error.code || null,
        });
      }
      leadId = upd.data && upd.data.id ? upd.data.id : null;
      console.log('[submit-toolkit-sample] duplicate lead updated id=', leadId, 'email=', email);
    } else if (ins.error) {
      console.error('[submit-toolkit-sample] insert failed', ins.error);
      return res.status(500).json({
        ok: false,
        error: 'Something went wrong saving your signup. Please try again.',
        supabaseCode: ins.error.code || null,
      });
    } else {
      leadId = ins.data && ins.data.id ? ins.data.id : null;
      console.log('[submit-toolkit-sample] lead inserted id=', leadId, 'email=', email);
    }
  } catch (err) {
    console.error('[submit-toolkit-sample] insert exception', err && err.message ? err.message : err);
    return res.status(500).json({ ok: false, error: 'Something went wrong saving your signup.' });
  }

  var emailSent = false;
  var resendMessageId = null;
  var resendErrorMessage = null;
  try {
    const sent = await sendToolkitSampleEmail(name || 'there', emailRaw);
    emailSent = !!(sent && sent.ok);
    resendMessageId = sent && sent.resendMessageId ? String(sent.resendMessageId) : null;
    if (!emailSent) {
      resendErrorMessage = sent && sent.error ? String(sent.error) : 'Resend send returned not ok';
    }
  } catch (err) {
    emailSent = false;
    resendErrorMessage = err && err.message ? String(err.message) : 'Resend send exception';
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

  return res.status(200).json({
    ok: true,
    emailSent,
    resendMessageId,
    showThankYouAnyway: !emailSent,
    leadId,
  });
};
