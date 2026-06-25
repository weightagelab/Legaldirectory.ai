// Vercel Serverless Function - Cashfree order creation
// Required environment variables:
// CASHFREE_CLIENT_ID, CASHFREE_CLIENT_SECRET, CASHFREE_ENV=production|sandbox

function getCashfreeBaseUrl() {
  return process.env.CASHFREE_ENV === 'sandbox'
    ? 'https://sandbox.cashfree.com/pg'
    : 'https://api.cashfree.com/pg';
}

function getSiteOrigin(req) {
  const proto = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'legaldirectory.in';
  return `${proto}://${host}`;
}

function cleanPhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.length >= 10) return digits.slice(-10);
  return '9999999999';
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { amount, currency = 'INR', receipt, notes = {}, customer = {} } = req.body || {};
  const orderAmount = Number(amount);

  if (!orderAmount || Number.isNaN(orderAmount) || orderAmount <= 0) {
    return res.status(400).json({ error: 'Invalid amount' });
  }

  const clientId = process.env.CASHFREE_CLIENT_ID;
  const clientSecret = process.env.CASHFREE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return res.status(500).json({ error: 'Cashfree is not configured' });
  }

  const orderId = receipt || `LD-${Date.now()}`;
  const origin = getSiteOrigin(req);
  const phone = cleanPhone(customer.phone);
  const name = String(customer.name || 'Guest').trim() || 'Guest';

  try {
    const response = await fetch(`${getCashfreeBaseUrl()}/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-version': '2025-01-01',
        'x-client-id': clientId,
        'x-client-secret': clientSecret,
      },
      body: JSON.stringify({
        order_id: orderId,
        order_amount: orderAmount,
        order_currency: currency,
        customer_details: {
          customer_id: phone,
          customer_name: name,
          customer_phone: phone,
        },
        order_meta: {
          return_url: `${origin}/index.html?payment=success&order_id=${encodeURIComponent(orderId)}&amount=${encodeURIComponent(`₹${orderAmount.toLocaleString('en-IN')}`)}`,
        },
        order_note: notes.services || notes.service || 'Legaldirectory.ai booking',
        order_tags: notes,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Cashfree order error:', data);
      return res.status(502).json({ error: data.message || data.error || 'Order creation failed' });
    }

    return res.status(200).json({
      order_id: data.order_id,
      payment_session_id: data.payment_session_id,
      mode: process.env.CASHFREE_ENV === 'sandbox' ? 'sandbox' : 'production',
    });
  } catch (err) {
    console.error('Cashfree server error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
