/**
 * Shared nurture cron processing (no HTTP). Used by api/cron-nurture-emails.js and Next app route.
 */
const { createClient } = require('@supabase/supabase-js');
const {
  sendEmailStep1,
  sendEmailStep2,
  sendEmailStep3,
  sendEmailStep4,
  sendEmailStep5,
} = require('./nurture-emails');

const LOG = '[run-nurture-cron]';
const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000;

const SENDERS = [sendEmailStep1, sendEmailStep2, sendEmailStep3, sendEmailStep4, sendEmailStep5];

function eligibleForNext(row) {
  var step = Number(row.email_step);
  if (Number.isNaN(step)) step = 0;
  if (step >= 5) return false;
  var last = row.last_email_sent_at ? new Date(row.last_email_sent_at).getTime() : 0;
  if (step === 0) {
    return !last || Date.now() - last >= TWO_DAYS_MS;
  }
  if (!last) return true;
  return Date.now() - last >= TWO_DAYS_MS;
}

/**
 * @returns {Promise<{ ok: true, totalRows: number, processed: number, sent: number, skipped: number, errorCount: number, errors?: Array<unknown> } | { ok: false, error: string, status: number }>}
 */
async function runNurtureCron() {
  var supabaseUrl = String(process.env.SUPABASE_URL || '').trim();
  var serviceRole = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  if (!supabaseUrl || !serviceRole) {
    return { ok: false, error: 'Supabase not configured', status: 503 };
  }

  var supabase = createClient(supabaseUrl, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  var sel = await supabase
    .from('guide_leads')
    .select('id, email, first_name, email_step, last_email_sent_at')
    .lt('email_step', 5);

  if (sel.error) {
    console.error(LOG, 'select failed', sel.error);
    return { ok: false, error: sel.error.message, status: 500 };
  }

  var rows = sel.data || [];
  var processed = 0;
  var sent = 0;
  var skipped = 0;
  var errors = [];

  for (var i = 0; i < rows.length; i++) {
    var row = rows[i];
    if (!eligibleForNext(row)) {
      skipped += 1;
      continue;
    }

    var step = Number(row.email_step);
    if (Number.isNaN(step)) step = 0;
    var sendFn = SENDERS[step];
    if (!sendFn) {
      skipped += 1;
      continue;
    }

    processed += 1;
    var email = String(row.email || '').trim();
    var firstName = row.first_name;
    if (!email) {
      console.error(LOG, 'skip row missing email id=', row.id);
      errors.push({ id: row.id, error: 'missing email' });
      continue;
    }

    var result = await sendFn(firstName, email);
    if (!result.ok) {
      console.error(LOG, 'send failed id=', row.id, 'step=', step, result.error);
      errors.push({ id: row.id, step: step, error: result.error || 'send failed' });
      continue;
    }

    var nextStep = step + 1;
    var nowIso = new Date().toISOString();
    var upd = await supabase
      .from('guide_leads')
      .update({
        email_step: nextStep,
        last_email_sent_at: nowIso,
        download_sent: true,
      })
      .eq('id', row.id);

    if (upd.error) {
      console.error(LOG, 'update after send failed id=', row.id, upd.error);
      errors.push({ id: row.id, error: 'db update failed after send: ' + upd.error.message });
      continue;
    }

    sent += 1;
    console.log(LOG, 'sent nurture step', step + 1, '→ email_step=', nextStep, 'id=', row.id);
  }

  /** @type {{ ok: true, totalRows: number, processed: number, sent: number, skipped: number, errorCount: number, errors?: Array<unknown> }} */
  var out = {
    ok: true,
    totalRows: rows.length,
    processed,
    sent,
    skipped,
    errorCount: errors.length,
  };
  if (errors.length) out.errors = errors.slice(0, 20);

  return out;
}

module.exports = { runNurtureCron };
