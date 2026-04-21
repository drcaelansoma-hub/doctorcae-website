/**
 * Bundled admin + Formspree + financial (Hobby plan: one function instead of six).
 * Original URLs preserved via vercel.json rewrites → /api/admin-bundle?__=…
 */
function dispatchKey(req) {
  if (req.query && req.query.__ != null && String(req.query.__) !== '') {
    return String(req.query.__);
  }
  var url = String(req.url || '');
  var idx = url.indexOf('?');
  if (idx === -1) return '';
  try {
    return new URLSearchParams(url.slice(idx + 1)).get('__') || '';
  } catch {
    return '';
  }
}

module.exports = async (req, res) => {
  var k = dispatchKey(req);
  try {
    if (k === 'login') return await require('../lib/admin-login')(req, res);
    if (k === 'logout') return await require('../lib/admin-logout')(req, res);
    if (k === 'session') return await require('../lib/admin-session-route')(req, res);
    if (k === 'financial') return await require('../lib/admin-financial')(req, res);
    if (k === 'formspree-forms') return await require('../lib/admin-formspree-forms')(req, res);
    if (k === 'formspree-submissions') return await require('../lib/admin-formspree-submissions')(req, res);
  } catch (err) {
    console.error('[admin-bundle]', k || '(no __)', err && err.stack ? err.stack : err);
    res.setHeader('Content-Type', 'application/json');
    return res.status(500).json({
      error: 'Admin handler failed. See Vercel Logs for [admin-bundle].',
      route: k || null,
      detail: err && err.message ? String(err.message).slice(0, 240) : undefined,
    });
  }
  res.setHeader('Content-Type', 'application/json');
  return res.status(404).json({ error: 'Not found', hint: 'Missing or unknown ?__= (login, session, …)' });
};
