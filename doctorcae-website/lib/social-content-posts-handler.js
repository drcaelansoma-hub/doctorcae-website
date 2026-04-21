/**
 * Generated social posts — Supabase table public.social_posts.
 * Routed via /api/social-bundle?__=content-posts (Hobby: one fewer serverless file).
 */
const { createClient } = require('@supabase/supabase-js');
const { requireAdmin } = require('./require-admin');

function getSupabase() {
  const url = String(process.env.SUPABASE_URL || '').trim();
  const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!requireAdmin(req, res)) return;

  const supabase = getSupabase();
  if (!supabase) {
    return res.status(503).json({
      error: 'Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY, run sql/social_posts.sql, then redeploy.',
      configured: false,
    });
  }

  if (req.method === 'GET') {
    const lim = Math.min(50, Math.max(1, parseInt(String((req.query && req.query.limit) || '30'), 10) || 30));
    const { data, error } = await supabase
      .from('social_posts')
      .select('id, platform, content, created_at')
      .order('created_at', { ascending: false })
      .limit(lim);

    if (error) {
      console.error('[social-content-posts] GET', error);
      return res.status(500).json({
        error: 'Could not load posts',
        supabaseCode: error.code,
        supabaseMessage: error.message,
      });
    }
    return res.status(200).json({ posts: data || [], configured: true });
  }

  if (req.method === 'POST') {
    const body = req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body) ? req.body : {};
    const platform = String(body.platform || '').trim().toLowerCase();
    const content = body.content;
    if (!platform) {
      return res.status(400).json({ error: 'platform is required' });
    }
    if (content == null || (typeof content !== 'object' && typeof content !== 'string')) {
      return res.status(400).json({ error: 'content must be a JSON object' });
    }
    var contentJson;
    if (typeof content === 'string') {
      try {
        contentJson = JSON.parse(content);
      } catch {
        return res.status(400).json({ error: 'content string must be valid JSON' });
      }
    } else {
      contentJson = content;
    }

    const ins = await supabase
      .from('social_posts')
      .insert({ platform, content: contentJson })
      .select('id, platform, content, created_at');

    if (ins.error) {
      console.error('[social-content-posts] POST', ins.error);
      return res.status(500).json({
        error: 'Could not save post',
        supabaseCode: ins.error.code,
        supabaseMessage: ins.error.message,
      });
    }
    var rows = Array.isArray(ins.data) ? ins.data : ins.data ? [ins.data] : [];
    return res.status(201).json({ post: rows[0] || null });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
