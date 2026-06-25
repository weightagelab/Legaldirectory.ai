// Vercel Serverless Function - Cashfree payment verification
// Verifies by fetching the Cashfree order server-side and checking order_status.

function getCashfreeBaseUrl() {
  return process.env.CASHFREE_ENV === 'sandbox'
    ? 'https://sandbox.cashfree.com/pg'
    : 'https://api.cashfree.com/pg';
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { order_id } = req.body || {};

  if (!order_id) {
    return res.status(400).json({ success: false, error: 'Missing order_id' });
  }

  const clientId = process.env.CASHFREE_CLIENT_ID;
  const clientSecret = process.env.CASHFREE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return res.status(500).json({ success: false, error: 'Cashfree is not configured' });
  }

  try {
    const response = await fetch(`${getCashfreeBaseUrl()}/orders/${encodeURIComponent(order_id)}`, {
      method: 'GET',
      headers: {
        'x-api-version': '2025-01-01',
        'x-client-id': clientId,
        'x-client-secret': clientSecret,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Cashfree verify error:', data);
      return res.status(502).json({
        success: false,
        error: data.message || data.error || 'Payment verification failed',
      });
    }

    return res.status(200).json({
      success: data.order_status === 'PAID',
      order_id: data.order_id,
      order_status: data.order_status,
      amount: data.order_amount,
      currency: data.order_currency,
    });
  } catch (err) {
    console.error('Cashfree verification server error:', err);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}
