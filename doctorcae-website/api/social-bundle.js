/**
 * Bundled Redis social routes (drafts, templates, products) — one serverless function.
 * Original URLs preserved via vercel.json rewrites.
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
  if (k === 'drafts') return require('../lib/api-impl/social-drafts')(req, res);
  if (k === 'templates') return require('../lib/api-impl/social-templates')(req, res);
  if (k === 'products') return require('../lib/api-impl/social-products')(req, res);
  res.setHeader('Content-Type', 'application/json');
  return res.status(404).json({ error: 'Not found' });
};
