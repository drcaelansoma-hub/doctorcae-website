# Deploy Your Website to Vercel

This guide will walk you through hosting your website on Vercel for free.

## Step 1: Create a GitHub Repository

### 1.1 Create a GitHub Account
1. Go to https://github.com
2. Click "Sign up"
3. Create an account (or log in if you have one)

### 1.2 Create a New Repository
1. Click the "+" icon (top right) → "New repository"
2. Name it: `doctorcae-website` (or any name)
3. Description: "Dr. Caelan Soma website" (optional)
4. Choose "Public" (so Vercel can access it)
5. Click "Create repository"

### 1.3 Upload Your Files to GitHub
Option A: Using Git (Command Line)
```bash
cd /Users/caelansoma/Desktop/WEBSITE/doctorcae-website
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/doctorcae-website.git
git push -u origin main
```

Option B: Using GitHub Web Interface (Easier)
1. In your new repository, click "Add file" → "Upload files"
2. Drag and drop all files from your local folder:
   - index.html
   - checkout.html
   - success.html
   - consultation.html
   - when-worry-shows-up-at-bedtime.html
   - doctorcaelogo.png
   - package.json
   - vercel.json
   - api/create-checkout-session.js
   - All PDF files
3. Add commit message: "Initial website upload"
4. Click "Commit changes"

---

## Step 2: Deploy to Vercel

### 2.1 Sign Up for Vercel
1. Go to https://vercel.com
2. Click "Sign Up"
3. Choose "Continue with GitHub"
4. Authorize Vercel to access your GitHub account

### 2.2 Import Your Project
1. On Vercel dashboard, click "Add New..." → "Project"
2. Select your `doctorcae-website` repository
3. Click "Import"

### 2.3 Configure Project
1. **Root Directory:** Leave as `.` (default)
2. **Framework Preset:** Select "Other"
3. **Build Command:** Leave empty (no build needed)
4. **Output Directory:** Leave empty
5. Click "Deploy"

Vercel will deploy your site! Wait 1-2 minutes.

---

## Step 3: Add Environment Variable (For Stripe)

### 3.1 Add Secret Key
1. In Vercel dashboard, go to your project
2. Click "Settings" (top menu)
3. Click "Environment Variables"
4. Add new variable:
   - Name: `STRIPE_SECRET_KEY`
   - Value: `sk_test_REDACTED_set_in_Vercel_env_only`
   - Select "Production" and "Preview"
5. Click "Save"

### 3.2 Redeploy
1. Click "Deployments" tab
2. Find latest deployment
3. Click the three dots → "Redeploy"

---

## Step 4: Update Checkout Page with Backend URL

After deployment, your backend URL will be:
`https://YOUR-VERCEL-URL.vercel.app/api/create-checkout-session`

### 4.1 Update checkout.html
1. Open `checkout.html` on your computer
2. Find this line (around line 160):
   ```javascript
   const response = await fetch('YOUR_BACKEND_URL/create-checkout-session', {
   ```
3. Replace with your Vercel URL:
   ```javascript
   const response = await fetch('https://YOUR-VERCEL-URL.vercel.app/api/create-checkout-session', {
   ```
   (Replace `YOUR-VERCEL-URL` with your actual Vercel URL from the dashboard)

### 4.2 Upload Updated File
1. In GitHub, click "Add file" → "Upload files"
2. Upload the updated `checkout.html`
3. Add commit message: "Update backend URL"
4. Click "Commit changes"

### 4.3 Redeploy
1. Go back to Vercel
2. It should auto-redeploy when it detects the GitHub change
3. Wait 1-2 minutes

---

## Step 5: Add Your Custom Domain (Optional)

If you have a domain like `doctorcae.com`:

1. In Vercel, go to project Settings → "Domains"
2. Click "Add Domain"
3. Enter your domain: `doctorcae.com`
4. Follow the instructions to update your domain's DNS settings
5. Verify domain

---

## Step 6: Create Stripe Product

Before testing purchases:

1. Go to https://dashboard.stripe.com/products
2. Click "Add product"
3. Name: "Regulation, Confidence and Success Guide"
4. Price: $19.99 (or your price)
5. Click "Save product"
6. Copy the **Price ID** (starts with `price_`)

### Update checkout.html with Price ID
1. Open `checkout.html`
2. Find line ~166:
   ```javascript
   priceId: 'price_YOUR_PRICE_ID',
   ```
3. Replace with your Price ID:
   ```javascript
   priceId: 'price_1SswrHB3UFcbtuoTxxxxxxxx',
   ```
4. Also update the price display (line ~152):
   ```javascript
   priceAmount.textContent = '19.99'; // Change to your price
   ```
5. Upload the updated file to GitHub
6. Vercel will auto-redeploy

---

## Test Your Setup

1. Go to your Vercel URL (e.g., `https://doctorcae-website.vercel.app`)
2. Click "Purchase PDF" on the Regulation Guide resource
3. Click "Purchase PDF" button
4. You should see Stripe checkout (in test mode)
5. Use test card: `4242 4242 4242 4242`
6. Any future expiry date
7. Any CVC
8. Complete the purchase

---

## Troubleshooting

### Stripe checkout not loading?
- Check browser console (F12) for errors
- Verify backend URL is correct in checkout.html
- Check environment variable is set in Vercel

### Files not updating?
- Wait 2-3 minutes after GitHub upload for Vercel to redeploy
- Check Vercel "Deployments" tab to see deployment status

### Need help?
- Vercel docs: https://vercel.com/docs
- Stripe docs: https://stripe.com/docs

---

## Summary of Your Live Website

✅ Website hosted on Vercel (free)
✅ Backend function for Stripe (free tier)
✅ Custom domain support (optional)
✅ Auto-deploy when you push to GitHub
✅ SSL certificate included (https://)
✅ Global CDN for fast loading

You're all set!
