/**
 * Bundled Instagram AI generate + drafts (one serverless function).
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
  if (k === 'generate') return require('../lib/api-impl/instagram-post-generate')(req, res);
  if (k === 'drafts') return require('../lib/api-impl/instagram-post-ai-drafts')(req, res);
  res.setHeader('Content-Type', 'application/json');
  return res.status(404).json({ error: 'Not found' });
};
