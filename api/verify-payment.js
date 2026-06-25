// api/verify-payment.js  — Vercel Serverless Function
// Verifies Razorpay payment signature after checkout completes
// Works for both single-service and multi-service (cart) payments

import crypto from 'crypto';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://legaldirectory.in');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const {
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
    items,        // array of { name, amount } for cart orders
    service,      // fallback for single-service orders
    amount,
    customer
  } = req.body;

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return res.status(400).json({ error: 'Missing payment fields' });
  }

  const KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;
  if (!KEY_SECRET) return res.status(500).json({ error: 'Not configured' });

  // ── VERIFY SIGNATURE ──
  const payload  = `${razorpay_order_id}|${razorpay_payment_id}`;
  const expected = crypto.createHmac('sha256', KEY_SECRET).update(payload).digest('hex');
  const isValid  = expected === razorpay_signature;

  if (!isValid) {
    console.error('Signature mismatch — possible fraud attempt');
    return res.status(400).json({ success: false, error: 'Payment verification failed' });
  }

  // ── PAYMENT IS AUTHENTIC ──
  const serviceLabel = items && items.length > 0
    ? items.map(i => `${i.name} (₹${i.amount})`).join(', ')
    : (service || 'Unknown');

  console.log('✅ Verified payment:', {
    payment_id: razorpay_payment_id,
    order_id:   razorpay_order_id,
    services:   serviceLabel,
    amount,
    customer,
    ts: new Date().toISOString(),
  });

  return res.status(200).json({
    success:    true,
    payment_id: razorpay_payment_id,
    message:    'Payment verified',
  });
}
