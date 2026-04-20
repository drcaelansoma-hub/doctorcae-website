/**
 * Instagram AI drafts — Upstash Redis key admin:instagram_post_ai_drafts (JSON array).
 * GET  — list drafts (newest first), { drafts, configured }
 * POST — save one draft { topic, audience, tone, goal, notes, output, status? }
 *        Stored: id, createdAt, topic, platform, inputs, output, status
 * Auth: admin session + UPSTASH_REDIS_* (same as Journal / social).
 */
const { Redis } = require('@upstash/redis');
const { requireAdmin } = require('../require-admin');

const KEY = 'admin:instagram_post_ai_drafts';

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

  async function loadAll() {
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
    const list = await loadAll();
    list.sort(function (a, b) {
      return String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
    });
    return res.status(200).json({ drafts: list, configured: !!redis });
  }

  if (!redis) {
    return res.status(503).json({
      error:
        'Redis not configured. Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN in Vercel (same as Journal).',
      configured: false,
    });
  }

  if (req.method === 'POST') {
    const body = req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body) ? req.body : {};
    const topic = String(body.topic || '').trim();
    if (!topic) return res.status(400).json({ error: 'topic is required' });

    const inputs = {
      topic,
      audience: String(body.audience || '').trim(),
      tone: String(body.tone || '').trim(),
      goal: String(body.goal || '').trim(),
      notes: body.notes != null ? String(body.notes).trim() : '',
    };

    const output = body.output && typeof body.output === 'object' ? body.output : {};
    const hook = String(output.hook || '').trim();
    const caption = String(output.caption || '').trim();
    if (!hook && !caption) {
      return res.status(400).json({ error: 'output must include at least hook or caption' });
    }

    let status = String(body.status || 'draft').trim();
    if (status !== 'draft' && status !== 'ready' && status !== 'archived') status = 'draft';

    const drafts = await loadAll();
    const id = 'igai_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10);
    const createdAt = new Date().toISOString();

    const draft = {
      id,
      createdAt,
      topic,
      platform: 'instagram',
      inputs,
      output: {
        hook: String(output.hook || ''),
        caption: String(output.caption || ''),
        cta: String(output.cta || ''),
        hashtags: String(output.hashtags || ''),
        graphicTextSuggestion: String(output.graphicTextSuggestion || ''),
      },
      status,
    };

    drafts.push(draft);
    await redis.set(KEY, JSON.stringify(drafts));
    return res.status(201).json({ draft });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
