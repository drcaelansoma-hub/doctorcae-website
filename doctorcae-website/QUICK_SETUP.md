# Quick Stripe Setup Guide

## You Already Have:
✅ Stripe Publishable Key (added to checkout.html)
✅ Stripe Secret Key (for backend)

## What You Need:

### Step 1: Create Product in Stripe
1. Go to https://dashboard.stripe.com/products
2. Click "Add product"
3. Fill in:
   - Name: "Regulation, Confidence and Success Guide"
   - Description: (optional)
   - Price: $19.99 (or your price)
   - Billing: One time
4. Click "Save product"
5. Copy the **Price ID** (starts with `price_`)

### Step 2: Choose Your Setup Method

#### Option A: Payment Links (EASIEST - No Backend)
1. In your product page, click "Create payment link"
2. Copy the payment link
3. I'll update index.html to use that link instead of checkout.html

#### Option B: Full Checkout (More Control)
1. Get your Price ID from Step 1
2. Deploy backend to Vercel/Netlify
3. Set environment variable: `STRIPE_SECRET_KEY` = your secret key
4. Update checkout.html with Price ID and backend URL

## Next Steps:
Once you have either:
- Payment Link (for Option A), OR
- Price ID (for Option B)

Share it with me and I'll complete the setup!
