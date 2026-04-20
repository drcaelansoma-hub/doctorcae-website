/**
 * Reusable social templates — Redis key admin:social:templates (JSON array).
 * Placeholders in text fields: {{product_title}}, {{product_description}}, {{price}}, {{cta}}, {{product_url}}
 */
const { Redis } = require('@upstash/redis');
const { requireAdmin } = require('../require-admin');

const KEY = 'admin:social:templates';

const TEMPLATE_TYPES = [
  'instagram_post',
  'instagram_carousel',
  'instagram_story',
  'product_promotion',
  'educational_promotion',
  'testimonial_promotion',
];

function getRedis() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

function normalizeTemplateBody(body) {
  let templateType = String(body.templateType || 'instagram_post').trim();
  if (TEMPLATE_TYPES.indexOf(templateType) === -1) templateType = 'instagram_post';

  return {
    title: String(body.title || '').trim(),
    templateType,
    headline: String(body.headline != null ? body.headline : '').trim(),
    subheadline: String(body.subheadline != null ? body.subheadline : '').trim(),
    caption: String(body.caption != null ? body.caption : '').trim(),
    hashtags: String(body.hashtags != null ? body.hashtags : '').trim(),
    callToAction: String(body.callToAction != null ? body.callToAction : '').trim(),
  };
}

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!requireAdmin(req, res)) return;

  const redis = getRedis();

  async function loadTemplates() {
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
    const templates = await loadTemplates();
    const id = (req.query && req.query.id) || '';
    if (id) {
      const template = templates.find(function (t) {
        return t.id === id;
      });
      if (!template) return res.status(404).json({ error: 'Not found' });
      return res.status(200).json({ template, configured: !!redis });
    }
    return res.status(200).json({ templates, configured: !!redis });
  }

  if (!redis) {
    return res.status(503).json({
      error:
        'Storage not configured. Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN in Vercel.',
    });
  }

  if (req.method === 'POST') {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const n = normalizeTemplateBody(body);
    if (!n.title) return res.status(400).json({ error: 'Template title is required' });

    const templates = await loadTemplates();
    const now = new Date().toISOString();
    const id = 'tpl_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
    const template = {
      id,
      title: n.title,
      templateType: n.templateType,
      headline: n.headline,
      subheadline: n.subheadline,
      caption: n.caption,
      hashtags: n.hashtags,
      callToAction: n.callToAction,
      createdAt: now,
      updatedAt: now,
    };
    templates.push(template);
    await redis.set(KEY, JSON.stringify(templates));
    return res.status(201).json({ template });
  }

  if (req.method === 'PUT') {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const id = body.id;
    if (!id) return res.status(400).json({ error: 'Missing id' });
    const templates = await loadTemplates();
    const idx = templates.findIndex(function (t) {
      return t.id === id;
    });
    if (idx === -1) return res.status(404).json({ error: 'Not found' });
    const cur = templates[idx];
    const merged = {
      title: body.title != null ? body.title : cur.title,
      templateType: body.templateType != null ? body.templateType : cur.templateType,
      headline: body.headline != null ? body.headline : cur.headline,
      subheadline: body.subheadline != null ? body.subheadline : cur.subheadline,
      caption: body.caption != null ? body.caption : cur.caption,
      hashtags: body.hashtags != null ? body.hashtags : cur.hashtags,
      callToAction: body.callToAction != null ? body.callToAction : cur.callToAction,
    };
    const n = normalizeTemplateBody(merged);
    if (!n.title) return res.status(400).json({ error: 'Template title is required' });

    const now = new Date().toISOString();
    const template = {
      ...cur,
      title: n.title,
      templateType: n.templateType,
      headline: n.headline,
      subheadline: n.subheadline,
      caption: n.caption,
      hashtags: n.hashtags,
      callToAction: n.callToAction,
      updatedAt: now,
    };
    templates[idx] = template;
    await redis.set(KEY, JSON.stringify(templates));
    return res.status(200).json({ template });
  }

  if (req.method === 'DELETE') {
    const id = (req.query && req.query.id) || '';
    if (!id) return res.status(400).json({ error: 'Missing id' });
    const templates = await loadTemplates();
    const next = templates.filter(function (t) {
      return t.id !== id;
    });
    if (next.length === templates.length) return res.status(404).json({ error: 'Not found' });
    await redis.set(KEY, JSON.stringify(next));
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
