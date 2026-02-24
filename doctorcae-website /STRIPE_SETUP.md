# Stripe Integration Setup Guide

## Step 1: Create a Stripe Account
1. Go to https://stripe.com and create an account
2. Complete the account setup process

## Step 2: Get Your API Keys
1. Go to the Stripe Dashboard: https://dashboard.stripe.com
2. Navigate to Developers → API keys
3. Copy your **Publishable key** (starts with `pk_`)
4. Copy your **Secret key** (starts with `sk_`) - keep this secret!

## Step 3: Create a Product and Price in Stripe
1. In Stripe Dashboard, go to Products
2. Click "Add product"
3. Name: "Regulation, Confidence and Success Guide"
4. Description: (add your description)
5. Set the price (e.g., $19.99)
6. Click "Save product"
7. Copy the **Price ID** (starts with `price_`)

## Step 4: Update the Checkout Page
1. Open `checkout.html`
2. Replace `pk_test_YOUR_PUBLISHABLE_KEY_HERE` with your actual publishable key
3. Replace `price_YOUR_PRICE_ID` with your actual price ID
4. Update the price amount in the HTML (line with `priceAmount.textContent`)

## Step 5: Set Up Backend (Choose One Option)

### Option A: Vercel (Recommended - Easiest)
1. Install Vercel CLI: `npm i -g vercel`
2. Create a `package.json` file:
```json
{
  "name": "stripe-checkout",
  "version": "1.0.0",
  "dependencies": {
    "stripe": "^14.0.0"
  }
}
```
3. Create `vercel.json`:
```json
{
  "functions": {
    "api/create-checkout-session.js": {
      "runtime": "nodejs18.x"
    }
  }
}
```
4. Set environment variable in Vercel:
   - Go to your project settings
   - Add `STRIPE_SECRET_KEY` with your secret key
5. Deploy: `vercel`
6. Update `checkout.html` with your Vercel function URL

### Option B: Netlify Functions
1. Create `netlify.toml`:
```toml
[build]
  functions = "netlify/functions"
```
2. Move `api/create-checkout-session.js` to `netlify/functions/create-checkout-session.js`
3. Set environment variable in Netlify dashboard
4. Deploy to Netlify
5. Update `checkout.html` with your Netlify function URL

### Option C: AWS Lambda / Other Serverless
- Adapt the function code to your platform
- Set the `STRIPE_SECRET_KEY` environment variable
- Update the checkout page with your endpoint URL

## Step 6: Update Links
1. Open `index.html`
2. Find the "Purchase PDF" link for the Regulation Guide
3. Change it to: `<a href="checkout.html" class="resource-link">Purchase PDF</a>`

## Step 7: Test
1. Use Stripe test mode first
2. Use test card: 4242 4242 4242 4242
3. Any future expiry date, any CVC
4. Test the full flow

## Step 8: Go Live
1. Switch to live mode in Stripe Dashboard
2. Update publishable key in `checkout.html` to live key
3. Update backend to use live secret key
4. Test with a real small transaction

## Security Notes
- Never commit your secret keys to git
- Use environment variables for all sensitive data
- The success page currently allows direct download - you may want to add session verification for production

## Alternative: Stripe Payment Links (No Backend Needed)
If you want to skip the backend setup:
1. In Stripe Dashboard, go to Products
2. Click on your product
3. Click "Create payment link"
4. Copy the payment link
5. Update the "Purchase PDF" link in `index.html` to point directly to the Stripe payment link

This is simpler but less customizable.
