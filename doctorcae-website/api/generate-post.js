/**
 * POST JSON { platform, postType, topic, audience } → OpenAI structured social copy.
 * Env: OPENAI_API_KEY (optional OPENAI_MODEL, default gpt-4o-mini)
 * Auth: admin session cookie (same as other admin APIs).
 */
const { requireAdmin } = require('../lib/require-admin');

const PLATFORMS = ['instagram', 'pinterest'];
const POST_TYPES = ['carousel', 'single_post', 'story', 'pin'];

function parseJsonFromModel(text) {
  var t = String(text || '').trim();
  var m = /^```(?:json)?\s*([\s\S]*?)```$/im.exec(t);
  if (m) t = m[1].trim();
  return JSON.parse(t);
}

function buildUserPrompt(platform, postType, topic, audience) {
  return [
    'Platform: ' + platform,
    'Post type: ' + postType,
    'Topic: ' + topic,
    'Audience: ' + audience,
    '',
    'Tone: warm, parent-friendly, nervous-system and regulation focused, grounded in the "Body First Framework" (Dr. Caelan Soma — clinical psychologist).',
    'Respect clinical boundaries: no diagnosing individuals, no guarantees of outcomes.',
  ].join('\n');
}

function buildSystemPrompt(platform, postType) {
  if (platform === 'instagram') {
    var lines = [
      'You are an expert Instagram copywriter for a licensed clinical psychologist (Body First Framework, dysregulation, parenting).',
      'Return a single JSON object with these string keys (use straight double quotes, escape inner quotes):',
      'hook — one scroll-stopping opening line.',
      'captionShort — punchy, under ~220 characters where possible.',
      'captionLong — storytelling caption with short paragraphs or line breaks.',
      'cta — one clear call-to-action.',
      'hashtags — exactly 10 hashtags as one string, each starting with #, separated by single spaces.',
      'imageIdea — one paragraph: Canva-friendly overall visual direction.',
    ];
    if (postType === 'carousel') {
      lines.push(
        'carouselSlides — a JSON array (not a string) of 5 to 7 objects. Each object must have string fields: headline (short on-slide title), body (1–3 short lines of on-slide copy), visualNote (one line for the designer: layout, colors, photo vs graphic). Order slides as a coherent story arc.',
      );
    } else {
      lines.push('carouselSlides — JSON empty array [] (post type is not carousel).');
    }
    lines.push('Do not include any keys other than those listed above.');
    return lines.join(' ');
  }

  if (platform === 'pinterest') {
    return [
      'You are an expert Pinterest SEO copywriter for a licensed clinical psychologist (Body First Framework).',
      'Return a single JSON object with exactly these string keys:',
      'pinTitle — clear, searchable title (under ~100 characters).',
      'pinDescription — SEO-optimized description with natural keywords and helpful parent-facing language; use line breaks between short paragraphs.',
      'keywords — comma-separated keyword string for Pinterest search (no # symbols).',
      'imageTextOverlay — one or two short lines suggested for text on the pin image (Canva-friendly).',
      'hashtags — optional string of a few relevant hashtags with # for description end, or empty string.',
      'hook — one compelling hook line (can echo title).',
      'captionShort — first 2 sentences summary for previews.',
      'captionLong — same as pinDescription OR a slightly shorter variant; must be non-empty.',
      'cta — save / follow / click style CTA.',
      'imageIdea — visual direction for the pin graphic.',
      'carouselSlides — JSON empty array [] (not used on Pinterest).',
      'Use straight double quotes in JSON. Escape internal quotes properly.',
    ].join(' ');
  }

  return '';
}

function normalizeStrings(out, keys) {
  for (var i = 0; i < keys.length; i++) {
    var k = keys[i];
    if (typeof out[k] !== 'string') {
      out[k] = out[k] == null ? '' : String(out[k]);
    }
  }
}

function normalizeCarouselSlides(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.map(function (item, idx) {
    if (item == null) return { headline: '', body: '', visualNote: '' };
    if (typeof item === 'string') {
      return { headline: 'Slide ' + (idx + 1), body: item, visualNote: '' };
    }
    return {
      headline: String(item.headline || item.title || '').trim(),
      body: String(item.body || item.text || item.copy || '').trim(),
      visualNote: String(item.visualNote || item.visual || item.imageNote || '').trim(),
    };
  });
}

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!requireAdmin(req, res)) return;

  const body = req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body) ? req.body : {};
  var platform = String(body.platform || '').trim().toLowerCase();
  var postType = String(body.postType || '').trim().toLowerCase();
  var topic = String(body.topic || '').trim();
  var audience = String(body.audience || '').trim();

  if (PLATFORMS.indexOf(platform) === -1) {
    return res.status(400).json({ error: 'platform must be instagram or pinterest' });
  }
  if (POST_TYPES.indexOf(postType) === -1) {
    return res.status(400).json({ error: 'postType must be carousel, single_post, story, or pin' });
  }
  if (!topic) {
    return res.status(400).json({ error: 'topic is required' });
  }
  if (!audience) {
    audience = 'Parents of dysregulated children';
  }

  const apiKey = String(process.env.OPENAI_API_KEY || '').trim();
  if (!apiKey) {
    return res.status(503).json({
      error:
        'OpenAI is not configured. Add OPENAI_API_KEY to Vercel (and .env.local for local dev), then redeploy.',
    });
  }

  const model = String(process.env.OPENAI_MODEL || 'gpt-4o-mini').trim() || 'gpt-4o-mini';

  const systemPrompt = buildSystemPrompt(platform, postType);
  const userPrompt = buildUserPrompt(platform, postType, topic, audience);

  const maxTokens = platform === 'instagram' && postType === 'carousel' ? 2800 : 1600;

  try {
    const upstream = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        response_format: { type: 'json_object' },
        temperature: 0.7,
        max_tokens: maxTokens,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      }),
    });

    const raw = await upstream.text();
    var parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return res.status(502).json({ error: 'OpenAI returned non-JSON.', detail: raw.slice(0, 200) });
    }

    if (!upstream.ok) {
      const msg = (parsed.error && parsed.error.message) || raw.slice(0, 200);
      return res.status(502).json({ error: 'OpenAI request failed', detail: msg });
    }

    const choice = parsed.choices && parsed.choices[0];
    const contentStr = choice && choice.message && choice.message.content;
    if (!contentStr) {
      return res.status(502).json({ error: 'No completion content from OpenAI' });
    }

    var out;
    try {
      out = parseJsonFromModel(contentStr);
    } catch (e) {
      return res.status(502).json({
        error: 'Could not parse model JSON',
        detail: String(contentStr).slice(0, 400),
      });
    }

    const stringKeys = [
      'hook',
      'captionShort',
      'captionLong',
      'cta',
      'hashtags',
      'imageIdea',
      'pinTitle',
      'pinDescription',
      'keywords',
      'imageTextOverlay',
    ];
    normalizeStrings(out, stringKeys);

    var carouselSlides = normalizeCarouselSlides(out.carouselSlides);
    if (platform !== 'instagram' || postType !== 'carousel') {
      carouselSlides = [];
    }

    /** Plain-text blocks for Canva: one slide per block, easy copy/paste. */
    function formatCanvaCarouselBlocks(slides) {
      if (!slides.length) return '';
      return slides
        .map(function (s, i) {
          var n = i + 1;
          return [
            '══════════════════════════════════════',
            '  SLIDE ' + n + ' — ' + (s.headline || 'Untitled'),
            '══════════════════════════════════════',
            '',
            s.body || '',
            '',
            '— Visual / Canva: ' + (s.visualNote || '(add your own imagery)'),
            '',
          ].join('\n');
        })
        .join('\n');
    }

    const canvaCarouselExport = formatCanvaCarouselBlocks(carouselSlides);

    const response = {
      hook: out.hook,
      captionShort: out.captionShort,
      captionLong: out.captionLong,
      cta: out.cta,
      hashtags: out.hashtags,
      imageIdea: out.imageIdea,
      carouselSlides,
      canvaCarouselExport,
      pinTitle: out.pinTitle,
      pinDescription: out.pinDescription,
      keywords: out.keywords,
      imageTextOverlay: out.imageTextOverlay,
      meta: { platform, postType, topic, audience, model },
    };

    return res.status(200).json(response);
  } catch (e) {
    console.error('[generate-post]', e);
    return res.status(500).json({ error: 'Server error calling OpenAI' });
  }
};
