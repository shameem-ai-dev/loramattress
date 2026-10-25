// Vercel Serverless Function: /api/razorpay/verify-payment
// Strictly verifies HMAC-SHA256 payment signature using server-side RAZORPAY_KEY_SECRET

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
    const keySecret = (process.env.RAZORPAY_KEY_SECRET || '').trim();

    if (!keySecret) {
      return res.status(500).json({
        success: false,
        verified: false,
        message: 'Server error: RAZORPAY_KEY_SECRET is not configured in GoDaddy environment variables. Payment cannot be verified.'
      });
    }

    const payload = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const razorpayOrderId = (payload.razorpay_order_id || '').trim();
    const razorpayPaymentId = (payload.razorpay_payment_id || '').trim();
    const razorpaySignature = (payload.razorpay_signature || '').trim();

    if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      return res.status(400).json({
        success: false,
        verified: false,
        message: 'Incomplete verification parameters. Order ID, Payment ID, and Signature are required.'
      });
    }

    const expectedSignature = crypto
      .createHmac('sha256', keySecret)
      .update(`${razorpayOrderId}|${razorpayPaymentId}`)
      .digest('hex');

    const expBuf = Buffer.from(expectedSignature, 'utf8');
    const sigBuf = Buffer.from(razorpaySignature, 'utf8');

    const isValid = expBuf.length === sigBuf.length && crypto.timingSafeEqual(expBuf, sigBuf);

    if (!isValid) {
      return res.status(400).json({
        success: false,
        verified: false,
        message: 'Invalid payment signature. Payment authenticity could not be verified.'
      });
    }

    return res.status(200).json({
      success: true,
      verified: true,
      payment_id: razorpayPaymentId,
      order_id: razorpayOrderId,
      message: 'Payment signature verified successfully.'
    });

  } catch (err) {
    return res.status(500).json({ success: false, verified: false, message: 'Verification processing failed: ' + err.message });
  }
};
