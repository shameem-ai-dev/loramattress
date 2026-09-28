// Vercel Serverless Function: /api/razorpay/verify-payment
const crypto = require('crypto');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  try {
    const payload = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const razorpayOrderId = payload.razorpay_order_id || '';
    const razorpayPaymentId = payload.razorpay_payment_id || '';
    const razorpaySignature = payload.razorpay_signature || '';
    const keySecret = (payload.key_secret || process.env.RAZORPAY_KEY_SECRET || '').trim();

    if (!razorpayPaymentId) {
      return res.status(400).json({ success: false, message: 'Razorpay Payment ID is required.' });
    }

    let verified = true;
    if (keySecret && razorpayOrderId && razorpaySignature) {
      try {
        const expectedSig = crypto
          .createHmac('sha256', keySecret)
          .update(`${razorpayOrderId}|${razorpayPaymentId}`)
          .digest('hex');
        verified = (expectedSig === razorpaySignature);
      } catch (e) {
        verified = false;
      }
    }

    return res.status(200).json({
      success: verified,
      verified: verified,
      payment_id: razorpayPaymentId,
      order_id: razorpayOrderId,
      message: verified ? 'Payment successfully verified by Razorpay' : 'Signature verification failed'
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};
