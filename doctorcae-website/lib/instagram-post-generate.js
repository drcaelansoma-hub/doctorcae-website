/**
 * POST JSON { topic, audience, tone, goal, notes? } → OpenAI structured Instagram copy.
 * Env: OPENAI_API_KEY (optional OPENAI_MODEL, default gpt-4o-mini)
 * Auth: admin session only — API key never sent to the browser.
 *
 * Server-only: OpenAI and env reads happen only in this file (not in static HTML).
 */
const { requireAdmin } = require('./require-admin');

const LOG = '[instagram-post-generate]';

function readRawBody(req) {
  return new Promise(function (resolve, reject) {
    var chunks = [];
    req.on('data', function (chunk) {
      chunks.push(chunk);
    });
    req.on('end', function () {
      resolve(Buffer.concat(chunks).toString('utf8'));
    });
    req.on('error', reject);
  });
}

/**
 * Vercel sometimes provides an empty object for POST JSON; read the stream when needed
 * (same pattern as api/submit-free-guide.js).
 */
async function readJsonBody(req) {
  var existing = req.body;

  if (typeof existing === 'string' && existing.trim()) {
    try {
      return JSON.parse(existing);
    } catch {
      return {};
    }
  }

  if (existing != null && typeof existing === 'object' && !Buffer.isBuffer(existing)) {
    var keys = Object.keys(existing);
    if (keys.length > 0) {
      return existing;
    }
  }

  var raw = '';
  try {
    raw = await readRawBody(req);
  } catch (e) {
    console.error(LOG, 'readRawBody failed', e && e.message ? e.message : e);
    return {};
  }
  if (!raw || !String(raw).trim()) {
    return {};
  }
  try {
    return JSON.parse(raw);
  } catch (e) {
    console.error(LOG, 'JSON.parse(body) failed', e && e.message ? e.message : e);
    return {};
  }
}

function envSnapshot() {
  return {
    OPENAI_API_KEY: !!String(process.env.OPENAI_API_KEY || '').trim(),
    UPSTASH_REDIS_REST_URL: !!String(process.env.UPSTASH_REDIS_REST_URL || '').trim(),
    UPSTASH_REDIS_REST_TOKEN: !!String(process.env.UPSTASH_REDIS_REST_TOKEN || '').trim(),
    ADMIN_SESSION_SECRET: !!String(process.env.ADMIN_SESSION_SECRET || '').trim(),
  };
}

function parseJsonFromModel(text) {
  var t = String(text || '').trim();
  var m = /^```(?:json)?\s*([\s\S]*?)```$/im.exec(t);
  if (m) t = m[1].trim();
  return JSON.parse(t);
}

function jsonError(res, status, error, message, extra) {
  var body = { error: error || 'Error', message: message || String(error || '') };
  if (extra && typeof extra === 'object') {
    for (var k in extra) {
      if (Object.prototype.hasOwnProperty.call(extra, k)) body[k] = extra[k];
    }
  }
  console.error(LOG, 'response', status, body.error, body.message);
  return res.status(status).json(body);
}

module.exports = async (req, res) => {
  var reqPath = String((req.url && req.url.split('?')[0]) || '/api/instagram-post-generate');

  try {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    console.log(LOG, 'request start', {
      method: req.method,
      path: reqPath,
      env: envSnapshot(),
    });

    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }
    if (req.method !== 'POST') {
      return jsonError(res, 405, 'Method not allowed', 'Only POST is supported.');
    }

    if (!requireAdmin(req, res)) {
      console.log(LOG, 'auth failed — 401');
      return;
    }

    var body = await readJsonBody(req);
    var topic = String(body.topic || '').trim();
    var audience = String(body.audience || '').trim();
    var tone = String(body.tone || '').trim();
    var goal = String(body.goal || '').trim();
    var notes = body.notes != null ? String(body.notes).trim() : '';

    if (!topic) {
      return jsonError(res, 400, 'Validation error', 'topic is required');
    }

    var apiKey = String(process.env.OPENAI_API_KEY || '').trim();
    if (!apiKey) {
      return jsonError(
        res,
        503,
        'OpenAI not configured',
        'Set OPENAI_API_KEY in Vercel (and .env.local for local dev), then redeploy.',
      );
    }

    var model = String(process.env.OPENAI_MODEL || 'gpt-4o-mini').trim() || 'gpt-4o-mini';

    var userBlock = [
      'Topic: ' + topic,
      'Audience: ' + (audience || 'parents'),
      'Tone: ' + (tone || 'warm and supportive'),
      'Goal: ' + (goal || 'engage and educate'),
      notes ? 'Additional notes: ' + notes : '',
    ]
      .filter(Boolean)
      .join('\n');

    var systemPrompt = [
      'You write Instagram posts for Dr. Caelan Soma, a licensed clinical psychologist.',
      'Framework: Body First Framework — nervous system, regulation, parenting without shame.',
      'Return a single JSON object with exactly these string keys (no extra keys):',
      'hook — one scroll-stopping first line.',
      'caption — main post body; use short paragraphs or line breaks; Instagram-friendly length.',
      'cta — one clear call-to-action.',
      'hashtags — one string of 8–12 hashtags separated by spaces, each starting with #.',
      'graphicTextSuggestion — one or two short lines suggested for on-image text in Canva.',
      'Clinical boundaries: no diagnosing individuals; no outcome guarantees.',
      'Use straight double quotes in JSON and escape inner quotes.',
    ].join(' ');

    console.log(LOG, 'calling OpenAI', { model });

    var upstream;
    try {
      upstream = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: model,
          response_format: { type: 'json_object' },
          temperature: 0.65,
          max_tokens: 1600,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userBlock },
          ],
        }),
      });
    } catch (e) {
      var netMsg = e && e.message ? e.message : String(e);
      console.error(LOG, 'OpenAI fetch threw', netMsg);
      return jsonError(
        res,
        502,
        'OpenAI connection failed',
        netMsg,
      );
    }

    console.log(LOG, 'OpenAI response status', upstream.status);

    var raw = await upstream.text();
    var parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      return jsonError(
        res,
        502,
        'OpenAI returned non-JSON',
        e && e.message ? e.message : 'parse error',
        { detail: raw.slice(0, 200) },
      );
    }

    if (!upstream.ok) {
      var msg = (parsed.error && parsed.error.message) || raw.slice(0, 200);
      return jsonError(res, 502, 'OpenAI request failed', String(msg), { detail: msg });
    }

    var contentStr =
      parsed.choices && parsed.choices[0] && parsed.choices[0].message && parsed.choices[0].message.content;
    if (!contentStr) {
      return jsonError(res, 502, 'No completion from OpenAI', 'Missing choices[0].message.content in response.');
    }

    var out;
    try {
      out = parseJsonFromModel(contentStr);
    } catch (e) {
      var parseErr = e && e.message ? e.message : String(e);
      return jsonError(res, 502, 'Could not parse model JSON', parseErr, {
        detail: String(contentStr).slice(0, 400),
      });
    }

    var keys = ['hook', 'caption', 'cta', 'hashtags', 'graphicTextSuggestion'];
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      if (typeof out[k] !== 'string') {
        out[k] = out[k] == null ? '' : String(out[k]);
      }
    }

    console.log(LOG, 'success 200');
    return res.status(200).json({
      hook: out.hook,
      caption: out.caption,
      cta: out.cta,
      hashtags: out.hashtags,
      graphicTextSuggestion: out.graphicTextSuggestion,
    });
  } catch (e) {
    var topMsg = e && e.stack ? e.stack : e && e.message ? e.message : String(e);
    console.error(LOG, 'unhandled error', topMsg);
    try {
      return jsonError(res, 500, 'Server error', e && e.message ? e.message : String(e));
    } catch (sendErr) {
      console.error(LOG, 'failed to send JSON error', sendErr);
    }
  }
};
