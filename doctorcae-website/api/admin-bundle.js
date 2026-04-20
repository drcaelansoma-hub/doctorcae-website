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
  if (k === 'login') return require('../lib/api-impl/admin-login')(req, res);
  if (k === 'logout') return require('../lib/api-impl/admin-logout')(req, res);
  if (k === 'session') return require('../lib/api-impl/admin-session')(req, res);
  if (k === 'financial') return require('../lib/api-impl/admin-financial')(req, res);
  if (k === 'formspree-forms') return require('../lib/api-impl/admin-formspree-forms')(req, res);
  if (k === 'formspree-submissions') return require('../lib/api-impl/admin-formspree-submissions')(req, res);
  res.setHeader('Content-Type', 'application/json');
  return res.status(404).json({ error: 'Not found' });
};
