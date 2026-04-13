// Proxies free-guide signups to Formspree from the server (avoids browser CORS).
// Parses the body from the stream when Vercel does not populate req.body.

const FORMSPREE_URL = 'https://formspree.io/f/xjgpvoag';

function bodyFromUrlEncoded(raw) {
  const out = {};
  new URLSearchParams(raw).forEach((value, key) => {
    out[key] = value;
  });
  return out;
}

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

async function readParsedBody(req) {
  var existing = req.body;

  if (typeof existing === 'string' && existing.length > 0) {
    try {
      return JSON.parse(existing);
    } catch {
      return bodyFromUrlEncoded(existing);
    }
  }

  if (existing != null && typeof existing === 'object' && !Buffer.isBuffer(existing)) {
    var keys = Object.keys(existing);
    if (keys.length > 0) {
      return existing;
    }
  }

  var raw;
  try {
    raw = await readRawBody(req);
  } catch {
    return {};
  }

  if (!raw) {
    return {};
  }

  var ct = String(req.headers['content-type'] || '').toLowerCase();
  if (ct.includes('application/json')) {
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }
  if (ct.includes('application/x-www-form-urlencoded')) {
    return bodyFromUrlEncoded(raw);
  }
  try {
    return JSON.parse(raw);
  } catch {
    return bodyFromUrlEncoded(raw);
  }
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const body = await readParsedBody(req);
  const first_name = String(body.first_name || '').trim();
  const email = String(body.email || '').trim();

  if (!first_name) {
    return res.status(400).json({ ok: false, error: 'Please enter your first name.' });
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ ok: false, error: 'Please enter a valid email address.' });
  }

  const params = new URLSearchParams();
  params.set('first_name', first_name);
  params.set('email', email);
  params.set('_subject', 'Free guide — Body First download');
  params.set('_gotcha', '');

  try {
    const upstream = await fetch(FORMSPREE_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    let data = {};
    const ct = upstream.headers.get('content-type') || '';
    if (ct.includes('application/json')) {
      try {
        data = await upstream.json();
      } catch {
        data = {};
      }
    }

    if (!upstream.ok) {
      const msg =
        (typeof data.error === 'string' && data.error) ||
        (data.errors && data.errors[0] && data.errors[0].message) ||
        'Something went wrong. Please try again.';
      return res.status(502).json({ ok: false, error: String(msg) });
    }

    return res.status(200).json({ ok: true });
  } catch {
    return res.status(500).json({
      ok: false,
      error: 'Something went wrong. Please try again in a moment.',
    });
  }
};
