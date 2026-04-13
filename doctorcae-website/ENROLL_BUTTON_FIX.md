# Fix "Enroll Now" / Course Checkout Error

Two things usually cause the error. Do both.

---

## 1. Same Stripe "mode" everywhere

You put a **live** secret key in Vercel (`sk_live_...`). So the site must use your **live** publishable key too.

- In Stripe: **Developers → API keys** (or go to https://dashboard.stripe.com/apikeys).
- Copy your **Publishable key** (the one that starts with `pk_live_`).
- Open **course-checkout.html** in a text editor.
- Find the line that says:  
  `const stripe = Stripe('pk_test_...');`
- Replace the whole key inside the quotes with your **pk_live_...** key. Save.

Do the same in **checkout.html** and **consultation-checkout.html** if you want those to take real payments (use `pk_live_...` in the `Stripe('...')` line).

---

## 2. Create the course product and use its Price ID

The "Enroll Now" button sends a **Price ID** to Stripe. That price must exist in your Stripe account.

**In Stripe:**

1. Go to **Product catalog** (or **Products**).
2. Click **Add product**.
3. Name: **When Big Feelings Take Over** (or your course name).
4. Set the price (e.g. one-time $X).
5. Save the product.
6. On the product page, find the **Price** and copy its **Price ID** (starts with `price_`).

**In your site:**

1. Open **course-checkout.html**.
2. Find the line:  
   `priceId: 'price_1T4Oz9B46KXPlNVSbakdMjz8',`
3. Replace that `price_...` value with the Price ID you just copied from Stripe. Save.

Upload the updated **course-checkout.html** to GitHub (replace the file and commit). After Vercel redeploys, try "Enroll Now" again.
