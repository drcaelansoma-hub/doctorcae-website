/**
 * GET ?period=all|today|week|month|year
 * Requires admin cookie. Uses Stripe Checkout sessions when STRIPE_SECRET_KEY is set.
 */
const stripe = require('stripe');
const { requireAdmin } = require('./require-admin');

function periodStart(period) {
  const now = Date.now();
  const d = new Date();
  if (period === 'today') {
    d.setUTCHours(0, 0, 0, 0);
    return d.getTime();
  }
  if (period === 'week') return now - 7 * 24 * 60 * 60 * 1000;
  if (period === 'month') return now - 30 * 24 * 60 * 60 * 1000;
  if (period === 'year') return now - 365 * 24 * 60 * 60 * 1000;
  return 0;
}

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!requireAdmin(req, res)) return;

  const period = (req.query && req.query.period) || 'all';
  const since = periodStart(period);
  const stripeKey = process.env.STRIPE_SECRET_KEY;

  if (!stripeKey) {
    return res.status(200).json({
      mock: true,
      period,
      summary: {
        totalRevenue: 0,
        unitsSold: 0,
        averageOrderValue: 0,
        successRate: null,
      },
      payments: [],
      message:
        'Add STRIPE_SECRET_KEY in Vercel to load live Checkout data. Until then, totals stay at zero.',
    });
  }

  try {
    const stripeClient = stripe(stripeKey);
    const sessions = await stripeClient.checkout.sessions.list({ limit: 100 });
    const rows = sessions.data
      .filter(function (s) {
        return (s.created || 0) * 1000 >= since;
      })
      .map(function (s) {
        var amt = (s.amount_total || 0) / 100;
        return {
          date: new Date((s.created || 0) * 1000).toISOString(),
          amount: amt,
          currency: s.currency || 'usd',
          status: s.payment_status || 'unknown',
          email: (s.customer_details && s.customer_details.email) || s.customer_email || '',
          description: (s.metadata && s.metadata.product) || 'Checkout',
        };
      });

    const paid = rows.filter(function (r) {
      return r.status === 'paid';
    });
    const totalRevenue = Math.round(paid.reduce(function (acc, r) {
      return acc + r.amount;
    }, 0) * 100) / 100;
    const unitsSold = paid.length;
    const attempted = rows.length;
    const successRate = attempted ? Math.round((unitsSold / attempted) * 1000) / 10 : null;
    const averageOrderValue = unitsSold ? Math.round((totalRevenue / unitsSold) * 100) / 100 : 0;

    return res.status(200).json({
      mock: false,
      period,
      summary: {
        totalRevenue,
        unitsSold,
        averageOrderValue,
        successRate,
      },
      payments: rows,
    });
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Stripe error' });
  }
};
