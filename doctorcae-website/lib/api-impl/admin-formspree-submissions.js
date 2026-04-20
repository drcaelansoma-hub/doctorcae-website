/**
 * GET — proxy Formspree submissions for the admin UI (never expose API key to the browser).
 *
 * Env (Vercel):
 *   FORMSPREE_API_KEY   — from Formspree form → API / settings (Professional+)
 *   FORMSPREE_FORM_HASH — form id from URL https://formspree.io/f/<this>  (e.g. xjgpvoag)
 *
 * Docs: https://help.formspree.io/hc/en-us/articles/360015233153-Form-Submissions-API
 */
const { requireAdmin } = require('../require-admin');

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!requireAdmin(req, res)) return;

  const apiKey = (process.env.FORMSPREE_API_KEY || '').trim();
  const hash = (process.env.FORMSPREE_FORM_HASH || process.env.FORMSPREE_FORM_ID || '').trim();

  if (!apiKey || !hash) {
    return res.status(200).json({
      configured: false,
      message:
        'Set FORMSPREE_API_KEY and FORMSPREE_FORM_HASH in Vercel (Formspree Professional+ Submissions API). Free tier: use Formspree Inbox export or connect Google Sheets / Zapier.',
    });
  }

  const limit = Math.min(100, Math.max(1, parseInt(String((req.query && req.query.limit) || '50'), 10) || 50));
  const url = `https://formspree.io/api/0/forms/${encodeURIComponent(hash)}/submissions?limit=${limit}&order=desc`;

  try {
    // Formspree: Bearer or Basic — https://help.formspree.io/hc/en-us/articles/360015232733-API-Authentication
    async function fetchSubmissions(authHeader) {
      const r = await fetch(url, {
        headers: {
          Authorization: authHeader,
          Accept: 'application/json',
        },
      });
      const t = await r.text();
      return { r: r, text: t };
    }

    var bearer = 'Bearer ' + apiKey;
    var result = await fetchSubmissions(bearer);
    var fr = result.r;
    var text = result.text;

    // Retry with Basic (curl -u :KEY) if Bearer unauthorized — some setups differ.
    if (fr.status === 401) {
      const basic = Buffer.from(':' + apiKey, 'utf8').toString('base64');
      result = await fetchSubmissions('Basic ' + basic);
      fr = result.r;
      text = result.text;
    }
    var body;
    try {
      body = JSON.parse(text);
    } catch {
      return res.status(502).json({ error: 'Invalid response from Formspree', raw: text.slice(0, 200) });
    }
    if (!fr.ok) {
      return res.status(fr.status).json({
        error: body.error || body.message || 'Formspree request failed',
        details: body,
      });
    }
    return res.status(200).json({
      configured: true,
      fields: body.fields,
      submissions: body.submissions || [],
    });
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Fetch failed' });
  }
};
