// api/verify-payment.js — Vercel Serverless Function
// Verifies Cashfree payment with retry, writes to Google Sheet + Firestore

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { order_id, items, amount, customer } = req.body;
  if (!order_id) return res.status(400).json({ error: 'Missing order_id' });

  const CF_APP_ID = process.env.CASHFREE_APP_ID;
  const CF_SECRET = process.env.CASHFREE_SECRET_KEY;
  const CF_ENV    = process.env.CASHFREE_ENV || 'production';
  const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycby9szbPBrX6V5fXkMTUbd8TTCJStiSjZf-4DiS1avVWRsIb18_7a03U0kQRXCcc2uML/exec';

  if (!CF_APP_ID || !CF_SECRET)
    return res.status(500).json({ error: 'Gateway not configured' });

  const apiBase = CF_ENV === 'sandbox'
    ? 'https://sandbox.cashfree.com/pg'
    : 'https://api.cashfree.com/pg';

  const sleep = ms => new Promise(r => setTimeout(r, ms));

  // ── 1. VERIFY WITH CASHFREE — retry 6x with 3s delay (18s total window) ──
  let paid = null;
  for (let attempt = 1; attempt <= 6; attempt++) {
    try {
      const cfRes = await fetch(`${apiBase}/orders/${order_id}/payments`, {
        headers: {
          'x-api-version':   '2023-08-01',
          'x-client-id':     CF_APP_ID,
          'x-client-secret': CF_SECRET,
        },
      });
      const payments = await cfRes.json();
      console.log(`Attempt ${attempt} response:`, JSON.stringify(payments).slice(0, 200));
      paid = Array.isArray(payments)
        ? payments.find(p => p.payment_status === 'SUCCESS')
        : (payments?.payment_status === 'SUCCESS' ? payments : null);
      if (paid) { console.log(`✅ Payment SUCCESS on attempt ${attempt}`); break; }
      if (attempt < 6) await sleep(3000);
    } catch (e) {
      console.error(`Attempt ${attempt} error:`, e.message);
      if (attempt < 6) await sleep(3000);
    }
  }

  if (!paid) {
    // ── FALLBACK: check order status directly ──
    try {
      const orderRes = await fetch(`${apiBase}/orders/${order_id}`, {
        headers: {
          'x-api-version':   '2023-08-01',
          'x-client-id':     CF_APP_ID,
          'x-client-secret': CF_SECRET,
        },
      });
      const orderData = await orderRes.json();
      console.log('Order status fallback:', JSON.stringify(orderData).slice(0, 300));
      if (orderData?.order_status === 'PAID') {
        paid = { cf_payment_id: orderData.cf_order_id, order_amount: orderData.order_amount };
      }
    } catch(e) { console.error('Order status fallback error:', e.message); }
  }

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

  console.log('✅ Verified:', { order_id, paymentId, serviceList, amtStr });

  // ── 2. WRITE TO GOOGLE SHEET ──
  try {
    await fetch(APPS_SCRIPT_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      redirect: 'follow',
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
    console.log('📊 Sheet write sent');
  } catch (sheetErr) {
    console.error('Sheet write error (non-fatal):', sheetErr.message);
  }

  return res.status(200).json({
    success:      true,
    payment_id:   paymentId,
    order_id,
    service_list: serviceList,
    amount:       amtStr,
    customer:     customer || {},
    timestamp:    ts,
    message:      'Payment verified',
  });
}
