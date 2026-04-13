// This is a serverless function for creating Stripe checkout sessions
// Vercel serverless function format

const stripe = require('stripe');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    return res.status(500).json({ error: 'STRIPE_SECRET_KEY is not set. Add it in Vercel → Settings → Environment Variables, then redeploy.' });
  }

  const stripeClient = stripe(stripeKey);

  try {
    const { priceId, successUrl, cancelUrl, productName } = req.body;

    // Create Stripe Checkout Session
    const session = await stripeClient.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: successUrl + '?session_id={CHECKOUT_SESSION_ID}',
      cancel_url: cancelUrl,
      allow_promotion_codes: true,
      metadata: {
        product: productName || 'Regulation, Confidence and Success Guide',
      },
    });

    return res.status(200).json({ id: session.id });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};
