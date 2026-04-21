/**
 * Social content drafts — CRUD in Redis key admin:social:drafts (JSON array).
 * Same auth/env as social-products.
 *
 * Fields: draftTitle, linkedProductId, contentType (instagram_post|carousel|story),
 * caption, headline, subheadline, callToAction, hashtags, imageUrl, imageDataUrl,
 * status (draft|ready|archived)
 */
const { Redis } = require('@upstash/redis');
const { requireAdmin } = require('./require-admin');

const KEY = 'admin:social:drafts';
const MAX_IMAGE_DATA_URL_LEN = 450000;

const CONTENT_TYPES = ['instagram_post', 'carousel', 'story'];
const STATUSES = ['draft', 'ready', 'archived'];

function getRedis() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

function normalizeDraftBody(body) {
  const imageDataUrl = body.imageDataUrl != null ? String(body.imageDataUrl).trim() : '';
  if (imageDataUrl.length > MAX_IMAGE_DATA_URL_LEN) {
    return {
      error: 'Uploaded image is too large. Use a smaller file or paste an image URL instead.',
    };
  }
  let contentType = String(body.contentType || 'instagram_post').trim();
  if (CONTENT_TYPES.indexOf(contentType) === -1) contentType = 'instagram_post';
  let status = String(body.status || 'draft').trim();
  if (STATUSES.indexOf(status) === -1) status = 'draft';

  return {
    draftTitle: String(body.draftTitle || '').trim(),
    linkedProductId: String(body.linkedProductId || '').trim(),
    contentType,
    caption: String(body.caption || '').trim(),
    headline: String(body.headline || '').trim(),
    subheadline: String(body.subheadline || '').trim(),
    callToAction: String(body.callToAction || '').trim(),
    hashtags: String(body.hashtags || '').trim(),
    imageUrl: String(body.imageUrl || '').trim(),
    imageDataUrl: imageDataUrl || undefined,
    status,
  };
}

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!requireAdmin(req, res)) return;

  const redis = getRedis();

  async function loadDrafts() {
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
    const drafts = await loadDrafts();
    const id = (req.query && req.query.id) || '';
    if (id) {
      const draft = drafts.find(function (d) {
        return d.id === id;
      });
      if (!draft) return res.status(404).json({ error: 'Not found' });
      return res.status(200).json({ draft, configured: !!redis });
    }
    return res.status(200).json({ drafts, configured: !!redis });
  }

  if (!redis) {
    return res.status(503).json({
      error:
        'Storage not configured. Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN in Vercel.',
    });
  }

  if (req.method === 'POST') {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const n = normalizeDraftBody(body);
    if (n.error) return res.status(400).json({ error: n.error });
    if (!n.draftTitle) return res.status(400).json({ error: 'Draft title is required' });

    const drafts = await loadDrafts();
    const now = new Date().toISOString();
    const id = 'sd_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
    const draft = {
      id,
      draftTitle: n.draftTitle,
      linkedProductId: n.linkedProductId,
      contentType: n.contentType,
      caption: n.caption,
      headline: n.headline,
      subheadline: n.subheadline,
      callToAction: n.callToAction,
      hashtags: n.hashtags,
      imageUrl: n.imageUrl,
      imageDataUrl: n.imageDataUrl,
      status: n.status,
      createdAt: now,
      updatedAt: now,
    };
    drafts.push(draft);
    await redis.set(KEY, JSON.stringify(drafts));
    return res.status(201).json({ draft });
  }

  if (req.method === 'PUT') {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const id = body.id;
    if (!id) return res.status(400).json({ error: 'Missing id' });
    const drafts = await loadDrafts();
    const idx = drafts.findIndex(function (d) {
      return d.id === id;
    });
    if (idx === -1) return res.status(404).json({ error: 'Not found' });
    const cur = drafts[idx];
    const merged = {
      draftTitle: body.draftTitle != null ? body.draftTitle : cur.draftTitle,
      linkedProductId: body.linkedProductId != null ? body.linkedProductId : cur.linkedProductId,
      contentType: body.contentType != null ? body.contentType : cur.contentType,
      caption: body.caption != null ? body.caption : cur.caption,
      headline: body.headline != null ? body.headline : cur.headline,
      subheadline: body.subheadline != null ? body.subheadline : cur.subheadline,
      callToAction: body.callToAction != null ? body.callToAction : cur.callToAction,
      hashtags: body.hashtags != null ? body.hashtags : cur.hashtags,
      imageUrl: body.imageUrl != null ? body.imageUrl : cur.imageUrl,
      imageDataUrl: Object.prototype.hasOwnProperty.call(body, 'imageDataUrl')
        ? body.imageDataUrl
        : cur.imageDataUrl,
      status: body.status != null ? body.status : cur.status,
    };
    const n = normalizeDraftBody(merged);
    if (n.error) return res.status(400).json({ error: n.error });
    if (!n.draftTitle) return res.status(400).json({ error: 'Draft title is required' });

    const now = new Date().toISOString();
    const draft = {
      ...cur,
      draftTitle: n.draftTitle,
      linkedProductId: n.linkedProductId,
      contentType: n.contentType,
      caption: n.caption,
      headline: n.headline,
      subheadline: n.subheadline,
      callToAction: n.callToAction,
      hashtags: n.hashtags,
      imageUrl: n.imageUrl,
      status: n.status,
      updatedAt: now,
    };
    if (merged.imageDataUrl === '' || merged.imageDataUrl == null) {
      delete draft.imageDataUrl;
    } else {
      draft.imageDataUrl = n.imageDataUrl;
    }
    drafts[idx] = draft;
    await redis.set(KEY, JSON.stringify(drafts));
    return res.status(200).json({ draft });
  }

  if (req.method === 'DELETE') {
    const id = (req.query && req.query.id) || '';
    if (!id) return res.status(400).json({ error: 'Missing id' });
    const drafts = await loadDrafts();
    const next = drafts.filter(function (d) {
      return d.id !== id;
    });
    if (next.length === drafts.length) return res.status(404).json({ error: 'Not found' });
    await redis.set(KEY, JSON.stringify(next));
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
