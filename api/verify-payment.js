// api/verify-payment.js — Vercel Serverless Function
// Verifies Cashfree payment and writes to Google Sheet via Apps Script

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://legaldirectory.in');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { order_id, items, amount, customer } = req.body;
  if (!order_id) return res.status(400).json({ error: 'Missing order_id' });

  const CF_APP_ID = process.env.CASHFREE_APP_ID;
  const CF_SECRET = process.env.CASHFREE_SECRET_KEY;
  const CF_ENV    = process.env.CASHFREE_ENV || 'production';

  if (!CF_APP_ID || !CF_SECRET)
    return res.status(500).json({ error: 'Gateway not configured' });

  const apiBase = CF_ENV === 'sandbox'
    ? 'https://sandbox.cashfree.com/pg'
    : 'https://api.cashfree.com/pg';

  try {
    // ── 1. VERIFY WITH CASHFREE ──
    const cfRes = await fetch(`${apiBase}/orders/${order_id}/payments`, {
      headers: {
        'x-api-version':   '2023-08-01',
        'x-client-id':     CF_APP_ID,
        'x-client-secret': CF_SECRET,
      },
    });
    const payments = await cfRes.json();

    const paid = Array.isArray(payments)
      ? payments.find(p => p.payment_status === 'SUCCESS')
      : null;

    if (!paid) {
      return res.status(200).json({
        success: false,
        order_status: 'PENDING',
        message: 'Payment not completed'
      });
    }

    const paymentId   = paid.cf_payment_id || paid.payment_id || order_id;
    const serviceList = Array.isArray(items)
      ? items.map(i => i.name).join(', ')
      : (items || '');
    const amtStr = amount || ('₹' + (paid.order_amount || 0));
    const ts     = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

    console.log('✅ Payment verified:', { order_id, paymentId, serviceList });

    // ── 2. WRITE TO GOOGLE SHEET VIA APPS SCRIPT ──
    const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycby9szbPBrX6V5fXkMTUbd8TTCJStiSjZf-4DiS1avVWRsIb18_7a03U0kQRXCcc2uML/exec';

    try {
      const sheetRes = await fetch(APPS_SCRIPT_URL, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId:   order_id,
          date:      ts,
          name:      customer?.name  || '',
          phone:     customer?.phone || '',
          services:  serviceList,
          amount:    amtStr,
          paymentId: paymentId,
          status:    'Paid ✅',
          source:    'legaldirectory.in',
        }),
      });
      const sheetData = await sheetRes.json();
      console.log('📊 Sheet write result:', sheetData);
    } catch (sheetErr) {
      // Non-fatal — payment is confirmed, sheet write failed
      console.error('Sheet write error (non-fatal):', sheetErr.message);
    }

    return res.status(200).json({
      success:    true,
      payment_id: paymentId,
      order_id,
      message:    'Payment verified',
    });

  } catch (err) {
    console.error('Verify error:', err);
    return res.status(500).json({ error: 'Verification failed' });
  }
}
