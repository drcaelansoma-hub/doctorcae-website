/**
 * Journal CRUD — stored in Upstash Redis key admin:journal:posts (JSON array).
 * Env: UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN (+ existing admin session vars)
 *
 * GET    — { posts, configured }
 * POST   — JSON body new post fields → { post }
 * PUT    — JSON body { id, ...fields } → { post }
 * DELETE — ?id=... → { ok: true }
 */
const { Redis } = require('@upstash/redis');
const { requireAdmin } = require('./lib/require-admin');

const KEY = 'admin:journal:posts';

function getRedis() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

function slugify(title) {
  return (
    String(title || 'post')
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'post'
  );
}

function uniqueSlug(posts, base) {
  var s = base || 'post';
  var out = s;
  var n = 2;
  while (posts.some(function (p) { return p.slug === out; })) {
    out = s + '-' + n;
    n += 1;
  }
  return out;
}

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!requireAdmin(req, res)) return;

  const redis = getRedis();

  async function loadPosts() {
    if (!redis) return [];
    const raw = await redis.get(KEY);
    if (!raw) return [];
    if (typeof raw === 'string') {
      try {
        var parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }
    return Array.isArray(raw) ? raw : [];
  }

  if (req.method === 'GET') {
    const posts = await loadPosts();
    const id = (req.query && req.query.id) || '';
    if (id) {
      const post = posts.find(function (p) {
        return p.id === id;
      });
      if (!post) return res.status(404).json({ error: 'Not found' });
      return res.status(200).json({ post, configured: !!redis });
    }
    return res.status(200).json({ posts, configured: !!redis });
  }

  if (!redis) {
    return res.status(503).json({
      error:
        'Journal storage not configured. Create a free Redis database at upstash.com and set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN in Vercel.',
    });
  }

  if (req.method === 'POST') {
    const body = (req.body && typeof req.body === 'object') ? req.body : {};
    const posts = await loadPosts();
    const now = new Date().toISOString();
    const id = 'p_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
    const slug = uniqueSlug(posts, slugify(body.slug || body.title));
    const tags =
      Array.isArray(body.tags)
        ? body.tags.map(String)
        : String(body.tags || '')
            .split(',')
            .map(function (t) {
              return t.trim();
            })
            .filter(Boolean);
    const post = {
      id,
      title: String(body.title || '').trim() || 'Untitled',
      slug,
      excerpt: String(body.excerpt || '').trim(),
      author: String(body.author || '').trim(),
      publishedAt: String(body.publishedAt || '').slice(0, 10) || now.slice(0, 10),
      tags,
      bodyMd: String(body.bodyMd || ''),
      featuredImageUrl: String(body.featuredImageUrl || '').trim(),
      status: body.status === 'published' ? 'published' : 'draft',
      createdAt: now,
      updatedAt: now,
    };
    posts.push(post);
    await redis.set(KEY, JSON.stringify(posts));
    return res.status(201).json({ post });
  }

  if (req.method === 'PUT') {
    const body = (req.body && typeof req.body === 'object') ? req.body : {};
    const id = body.id;
    if (!id) return res.status(400).json({ error: 'Missing id' });
    const posts = await loadPosts();
    const idx = posts.findIndex(function (p) {
      return p.id === id;
    });
    if (idx === -1) return res.status(404).json({ error: 'Not found' });
    const cur = posts[idx];
    const others = posts.filter(function (p) {
      return p.id !== id;
    });
    var nextSlugRaw = body.slug != null ? body.slug : cur.slug;
    var nextSlug = slugify(String(nextSlugRaw || '').trim() || cur.title || 'post');
    const slug = uniqueSlug(others, nextSlug);
    const now = new Date().toISOString();
    const tags =
      body.tags != null
        ? Array.isArray(body.tags)
          ? body.tags.map(String)
          : String(body.tags)
              .split(',')
              .map(function (t) {
                return t.trim();
              })
              .filter(Boolean)
        : cur.tags;
    const post = {
      ...cur,
      title: body.title != null ? String(body.title).trim() : cur.title,
      slug,
      excerpt: body.excerpt != null ? String(body.excerpt).trim() : cur.excerpt,
      author: body.author != null ? String(body.author).trim() : cur.author,
      publishedAt:
        body.publishedAt != null ? String(body.publishedAt).slice(0, 10) : cur.publishedAt,
      tags,
      bodyMd: body.bodyMd != null ? String(body.bodyMd) : cur.bodyMd,
      featuredImageUrl:
        body.featuredImageUrl != null ? String(body.featuredImageUrl).trim() : cur.featuredImageUrl,
      status: body.status === 'published' || body.status === 'draft' ? body.status : cur.status,
      updatedAt: now,
    };
    posts[idx] = post;
    await redis.set(KEY, JSON.stringify(posts));
    return res.status(200).json({ post });
  }

  if (req.method === 'DELETE') {
    const id = (req.query && req.query.id) || '';
    if (!id) return res.status(400).json({ error: 'Missing id' });
    const posts = await loadPosts();
    const next = posts.filter(function (p) {
      return p.id !== id;
    });
    if (next.length === posts.length) return res.status(404).json({ error: 'Not found' });
    await redis.set(KEY, JSON.stringify(next));
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
