// api/create-order.js  — Vercel Serverless Function
// Creates a Razorpay order server-side and returns order_id to the client
// Supports single service OR cart (multiple services) — amount is always validated server-side

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', 'https://legaldirectory.in');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { amount, currency = 'INR', receipt, notes, items } = req.body;

  // Validate amount
  if (!amount || isNaN(amount) || amount <= 0) {
    return res.status(400).json({ error: 'Invalid amount' });
  }

  // If items array is provided, cross-check the total
  if (items && Array.isArray(items) && items.length > 0) {
    const computedTotal = items.reduce((sum, item) => {
      const itemAmt = parseInt(String(item.amount).replace(/[₹,]/g, ''), 10) || 0;
      return sum + itemAmt;
    }, 0);
    if (computedTotal !== parseInt(amount, 10)) {
      return res.status(400).json({ error: `Amount mismatch: expected ${computedTotal}, got ${amount}` });
    }
  }

  const KEY_ID     = process.env.RAZORPAY_KEY_ID;
  const KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;

  if (!KEY_ID || !KEY_SECRET) {
    return res.status(500).json({ error: 'Payment gateway not configured' });
  }

  try {
    const response = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Basic ' + Buffer.from(`${KEY_ID}:${KEY_SECRET}`).toString('base64'),
      },
      body: JSON.stringify({
        amount:   Math.round(amount * 100),   // ₹ → paise
        currency: currency,
        receipt:  receipt || `LD-${Date.now()}`,
        notes:    notes || {},
      }),
    });

    const order = await response.json();

    if (!response.ok) {
      console.error('Razorpay error:', order);
      return res.status(502).json({ error: order.error?.description || 'Order creation failed' });
    }

    return res.status(200).json({
      order_id:  order.id,
      amount:    order.amount,
      currency:  order.currency,
      key_id:    KEY_ID,
    });

  } catch (err) {
    console.error('Server error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
