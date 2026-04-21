/**
 * POST — clears admin cookie.
 */
module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const isProd = process.env.VERCEL_ENV === 'production';
  const secureFlag = isProd ? '; Secure' : '';

  res.setHeader(
    'Set-Cookie',
    `admin_session=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax${secureFlag}`,
  );

  return res.status(200).json({ ok: true });
};
