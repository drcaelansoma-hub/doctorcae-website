/**
 * GET — list forms visible to your API key (debug / find correct hashid).
 * https://formspree.io/api/0/forms
 *
 * Same env as admin-formspree-submissions: FORMSPREE_API_KEY
 */
const { requireAdmin } = require('./require-admin');

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!requireAdmin(req, res)) return;

  const apiKey = (process.env.FORMSPREE_API_KEY || '').trim();
  if (!apiKey) {
    return res.status(200).json({
      configured: false,
      message: 'Set FORMSPREE_API_KEY in Vercel.',
    });
  }

  const url = 'https://formspree.io/api/0/forms';

  async function fetchForms(authHeader) {
    return fetch(url, {
      headers: {
        Authorization: authHeader,
        Accept: 'application/json',
      },
    });
  }

  try {
    var fr = await fetchForms('Bearer ' + apiKey);
    if (fr.status === 401) {
      const basic = Buffer.from(':' + apiKey, 'utf8').toString('base64');
      fr = await fetchForms('Basic ' + basic);
    }
    const text = await fr.text();
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
    var rawList = Array.isArray(body) ? body : body.forms || body.data || [];
    if (!Array.isArray(rawList)) {
      rawList = [];
    }
    return res.status(200).json({
      configured: true,
      forms: rawList,
    });
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Fetch failed' });
  }
};
