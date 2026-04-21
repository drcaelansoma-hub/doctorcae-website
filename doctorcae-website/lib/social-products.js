/**
 * Social / Instagram product catalog — CRUD in Upstash Redis key admin:social:products (JSON array).
 * Same env as journal: UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN, requireAdmin.
 *
 * GET    — ?id= optional | list { products, configured }
 * POST   — create product
 * PUT    — update
 * DELETE — ?id=
 *
 * Product: title, category, shortDescription, price, callToAction, productUrl,
 *          status (draft|active), imageUrl, imageDataUrl (optional, from upload; max ~450KB)
 */
const { Redis } = require('@upstash/redis');
const { requireAdmin } = require('./require-admin');

const KEY = 'admin:social:products';
const MAX_IMAGE_DATA_URL_LEN = 450000;

function getRedis() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!requireAdmin(req, res)) return;

  const redis = getRedis();

  async function loadProducts() {
    if (!redis) return [];
    const raw = await redis.get(KEY);
    if (!raw) return [];
    if (typeof raw === 'string') {
      try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }
    return Array.isArray(raw) ? raw : [];
  }

  if (req.method === 'GET') {
    const products = await loadProducts();
    const id = (req.query && req.query.id) || '';
    if (id) {
      const product = products.find(function (p) {
        return p.id === id;
      });
      if (!product) return res.status(404).json({ error: 'Not found' });
      return res.status(200).json({ product, configured: !!redis });
    }
    return res.status(200).json({ products, configured: !!redis });
  }

  if (!redis) {
    return res.status(503).json({
      error:
        'Storage not configured. Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN in Vercel (same as Journal).',
    });
  }

  function normalizeBody(body) {
    const imageDataUrl = body.imageDataUrl != null ? String(body.imageDataUrl).trim() : '';
    if (imageDataUrl.length > MAX_IMAGE_DATA_URL_LEN) {
      return {
        error: 'Uploaded image is too large. Use a smaller file or paste an image URL instead.',
      };
    }
    return {
      title: String(body.title || '').trim(),
      category: String(body.category || '').trim(),
      shortDescription: String(body.shortDescription || '').trim(),
      price: String(body.price || '').trim(),
      callToAction: String(body.callToAction || '').trim(),
      productUrl: String(body.productUrl || '').trim(),
      status: body.status === 'active' ? 'active' : 'draft',
      imageUrl: String(body.imageUrl || '').trim(),
      imageDataUrl: imageDataUrl || undefined,
    };
  }

  if (req.method === 'POST') {
    const body = (req.body && typeof req.body === 'object') ? req.body : {};
    const n = normalizeBody(body);
    if (n.error) return res.status(400).json({ error: n.error });
    if (!n.title) return res.status(400).json({ error: 'Title is required' });

    const products = await loadProducts();
    const now = new Date().toISOString();
    const id = 'sp_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
    /** @type {Record<string, unknown>} */
    const product = {
      id,
      title: n.title,
      category: n.category,
      shortDescription: n.shortDescription,
      price: n.price,
      callToAction: n.callToAction,
      productUrl: n.productUrl,
      status: n.status,
      imageUrl: n.imageUrl,
      imageDataUrl: n.imageDataUrl,
      createdAt: now,
      updatedAt: now,
    };
    products.push(product);
    await redis.set(KEY, JSON.stringify(products));
    return res.status(201).json({ product });
  }

  if (req.method === 'PUT') {
    const body = (req.body && typeof req.body === 'object') ? req.body : {};
    const id = body.id;
    if (!id) return res.status(400).json({ error: 'Missing id' });
    const products = await loadProducts();
    const idx = products.findIndex(function (p) {
      return p.id === id;
    });
    if (idx === -1) return res.status(404).json({ error: 'Not found' });
    const cur = products[idx];
    const merged = {
      title: body.title != null ? body.title : cur.title,
      category: body.category != null ? body.category : cur.category,
      shortDescription: body.shortDescription != null ? body.shortDescription : cur.shortDescription,
      price: body.price != null ? body.price : cur.price,
      callToAction: body.callToAction != null ? body.callToAction : cur.callToAction,
      productUrl: body.productUrl != null ? body.productUrl : cur.productUrl,
      status: body.status != null ? body.status : cur.status,
      imageUrl: body.imageUrl != null ? body.imageUrl : cur.imageUrl,
      imageDataUrl:
        Object.prototype.hasOwnProperty.call(body, 'imageDataUrl')
          ? body.imageDataUrl
          : cur.imageDataUrl,
    };
    const n = normalizeBody(merged);
    if (n.error) return res.status(400).json({ error: n.error });

    const now = new Date().toISOString();
    const product = {
      ...cur,
      title: n.title,
      category: n.category,
      shortDescription: n.shortDescription,
      price: n.price,
      callToAction: n.callToAction,
      productUrl: n.productUrl,
      status: n.status,
      imageUrl: n.imageUrl,
      updatedAt: now,
    };
    if (merged.imageDataUrl === '' || merged.imageDataUrl == null) {
      delete product.imageDataUrl;
    } else {
      product.imageDataUrl = n.imageDataUrl;
    }
    products[idx] = product;
    await redis.set(KEY, JSON.stringify(products));
    return res.status(200).json({ product });
  }

  if (req.method === 'DELETE') {
    const id = (req.query && req.query.id) || '';
    if (!id) return res.status(400).json({ error: 'Missing id' });
    const products = await loadProducts();
    const next = products.filter(function (p) {
      return p.id !== id;
    });
    if (next.length === products.length) return res.status(404).json({ error: 'Not found' });
    await redis.set(KEY, JSON.stringify(next));
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
