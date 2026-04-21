/**
 * Daily cron: nurture emails (Vercel Node serverless).
 * Auth: Authorization header must equal Bearer + process.env.CRON_SECRET
 *
 * Next.js equivalent: app/api/cron/route.ts
 */
const { runNurtureCron } = require('./lib/run-nurture-cron');

const LOG = '[cron-nurture-emails]';

function authorize(req) {
  var secret = String(process.env.CRON_SECRET || '').trim();
  if (!secret) {
    console.error(LOG, 'CRON_SECRET is not set');
    return false;
  }
  var auth = String(req.headers.authorization || '');
  return auth === 'Bearer ' + secret;
}

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  if (!authorize(req)) {
    return res.status(401).json({ ok: false, error: 'Unauthorized' });
  }

  var result = await runNurtureCron();
  if (!result.ok) {
    return res.status(result.status).json({ ok: false, error: result.error });
  }

  return res.status(200).json(result);
};
