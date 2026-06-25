# Razorpay Standard Checkout — Legaldirectory.ai
## Deployment Guide

---

### What was changed

Both `index.html` and `instant-services.html` now use **Razorpay Standard Checkout** instead of a static payment button link. Every "Pay" button:

1. **Opens a confirmation modal** showing the service name + exact price
2. **Calls `/api/create-order`** (server-side) to generate a secure Razorpay `order_id`
3. **Opens the Razorpay checkout overlay** (UPI, Cards, Net Banking, Wallets)
4. **Verifies the payment signature** via `/api/verify-payment` after payment
5. **Sends a WhatsApp notification** to +919008999968 with order details

---

### Step 1 — Get your Razorpay API Keys

1. Login → [dashboard.razorpay.com](https://dashboard.razorpay.com)
2. Go to **Settings → API Keys → Generate Live Key**
3. Copy **Key ID** (starts with `rzp_live_`) and **Key Secret**

---

### Step 2 — Deploy to Vercel

This project is structured for Vercel (free tier works fine).

```
legaldirectory-razorpay/
├── api/
│   ├── create-order.js     ← server: creates Razorpay order
│   └── verify-payment.js   ← server: verifies signature
├── public/
│   ├── index.html          ← your main homepage
│   └── instant-services.html
└── vercel.json
```

**Deploy steps:**
```bash
# Install Vercel CLI
npm i -g vercel

# From the legaldirectory-razorpay/ folder
vercel login
vercel deploy --prod
```

---

### Step 3 — Set Environment Variables in Vercel

After deploying, go to: **Vercel Dashboard → Your Project → Settings → Environment Variables**

Add these two variables:

| Variable Name          | Value                        |
|------------------------|------------------------------|
| `RAZORPAY_KEY_ID`      | `rzp_live_XXXXXXXXXXXX`      |
| `RAZORPAY_KEY_SECRET`  | `your_secret_here`           |

Then **redeploy** (Vercel → Deployments → Redeploy).

---

### Step 4 — Point your domain

In Vercel → Settings → Domains, add `legaldirectory.in` and update your DNS as instructed.

---

### Step 5 — Test with test keys first

Before going live, use test keys:
- `RAZORPAY_KEY_ID` = `rzp_test_XXXX` (from Razorpay Dashboard → Test Mode)
- Test card: `4111 1111 1111 1111`, any future expiry, any CVV

---

### Custom pricing services (Trademark, Document Writer)

For services without a fixed price, the Razorpay "Pay Now" button is hidden automatically.
Customers are shown a WhatsApp button instead — they'll message you for a quote.

---

### Signature verification

`/api/verify-payment.js` verifies every payment using HMAC SHA256. **Never skip this.**
If signature check fails, the order is rejected. This prevents fraud.

---

### CORS

`create-order.js` and `verify-payment.js` only accept requests from `https://legaldirectory.in`.
If you test locally, temporarily change the CORS origin to `*` or `http://localhost:3000`.

---

### Support
- Razorpay Docs: https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/integration-steps/
- Vercel Docs: https://vercel.com/docs
