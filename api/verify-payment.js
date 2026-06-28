// api/verify-payment.js — Vercel Serverless Function
// Verifies Cashfree payment with retry, returns confirmed status.

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { order_id, items, amount, customer, service } = req.body || {};
  if (!order_id) return res.status(400).json({ error: 'Missing order_id' });

  const CF_APP_ID = process.env.CASHFREE_CLIENT_ID;
  const CF_SECRET = process.env.CASHFREE_CLIENT_SECRET;
  const CF_ENV = process.env.CASHFREE_ENV || 'production';
  if (!CF_APP_ID || !CF_SECRET) return res.status(500).json({ error: 'Gateway not configured' });

  const apiBase = CF_ENV === 'sandbox' ? 'https://sandbox.cashfree.com/pg' : 'https://api.cashfree.com/pg';
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  let paid = null;

  for (let attempt = 1; attempt <= 6; attempt++) {
    try {
      const cfRes = await fetch(`${apiBase}/orders/${encodeURIComponent(order_id)}/payments`, {
        headers: { 'x-api-version': '2025-01-01', 'x-client-id': CF_APP_ID, 'x-client-secret': CF_SECRET }
      });
      const payments = await cfRes.json();
      paid = Array.isArray(payments) ? payments.find(p => p.payment_status === 'SUCCESS') : (payments?.payment_status === 'SUCCESS' ? payments : null);
      if (paid) break;
    } catch (e) { console.error(`Verify attempt ${attempt} failed`, e.message); }
    if (attempt < 6) await sleep(3000);
  }

  if (!paid) return res.status(200).json({ success: false, order_status: 'PENDING', message: 'Payment not completed yet. Verification retried 6 times.' });

  const paymentId = paid.cf_payment_id || paid.payment_id || order_id;
  const serviceList = Array.isArray(items) && items.length ? items.map(i => i.name).join(', ') : (service || (typeof items === 'string' ? items : ''));
  const amtStr = amount || ('₹' + (paid.order_amount || 0));
  const ts = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

  return res.status(200).json({ success: true, order_status: 'PAID', payment_id: paymentId, order_id, service_list: serviceList, amount: amtStr, customer: customer || {}, timestamp: ts, message: 'Payment verified' });
}
