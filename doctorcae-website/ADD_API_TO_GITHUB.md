# Add the API to GitHub so Enroll Now works

Your site is live at https://doctorcae-website.vercel.app but the **checkout API** isn’t in the repo, so Vercel never deploys it. Add these two things on GitHub.

---

## Step 1: Add `package.json`

1. Go to **https://github.com/drcaelansoma-hub/doctorcae-website**
2. Click **Add file** → **Create new file**
3. In the filename box type: **package.json**
4. In the content area, paste **exactly** this (replace anything that’s there):

```json
{"name":"doctorcae-website","version":"1.0.0","description":"Dr. Caelan Soma website with Stripe integration","dependencies":{"stripe":"^14.0.0"}}
```

5. Scroll down, click **Commit changes** (or **Commit new file**).

---

## Step 2: Add the API file `api/create-checkout-session.js`

1. Still in your repo, click **Add file** → **Create new file**
2. In the filename box type: **api/create-checkout-session.js**  
   (That creates the `api` folder and the file.)
3. In the content area, paste **exactly** this:

```javascript
// This is a serverless function for creating Stripe checkout sessions
// Vercel serverless function format

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

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

  try {
    const { priceId, successUrl, cancelUrl, productName } = req.body;

    const session = await stripe.checkout.sessions.create({
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
      metadata: {
        product: productName || 'Regulation, Confidence and Success Guide',
      },
    });

    return res.status(200).json({ id: session.id });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};
```

4. Click **Commit changes**.

---

## Step 3: Let Vercel redeploy

- Go to **https://vercel.com** → your **doctorcae-website** project.
- Vercel will usually redeploy automatically. If not: **Deployments** → **⋯** on the latest one → **Redeploy**.
- Wait 1–2 minutes until the deployment is **Ready**.

---

## Step 4: Try again

- Open **https://doctorcae-website.vercel.app**
- Go to the course page and click **Enroll Now**.

The 404 should be gone. If Stripe shows an error after that, it’s a Stripe/key/price issue and we can fix that next.
