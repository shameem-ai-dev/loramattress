// Vercel Serverless Function: /api/razorpay/create-order
// Creates official Razorpay order with server-side environment credentials exclusively

const https = require('https');

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
    const keyId = (process.env.RAZORPAY_KEY_ID || '').trim();
    const keySecret = (process.env.RAZORPAY_KEY_SECRET || '').trim();

    // Enforce server-side environment variables as single source of truth
    if (!keyId || !keySecret) {
      return res.status(400).json({
        success: false,
        configured: false,
        message: 'Razorpay payment gateway is not configured on the server. Please configure RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in GoDaddy environment variables.'
      });
    }

    const payload = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const rawAmount = Number(payload.amount);
    if (!rawAmount || isNaN(rawAmount) || rawAmount < 500 || rawAmount > 500000) {
      return res.status(400).json({ success: false, message: 'Valid payment amount between ₹500 and ₹5,00,000 is required.' });
    }

    // Checkout phone verification enforced server-side before any payment order is created
    const otpLib = require('../otp/_lib.js');
    const { verifyAdminAuth } = require('../auth.js');
    const checkoutPhone = (payload.notes && payload.notes.customer_phone) || '';
    const denied = otpLib.authorizeNewOrders(req, [{ phone: checkoutPhone }], verifyAdminAuth(req));
    if (denied) {
      return res.status(denied.status).json({ success: false, code: denied.code, message: denied.message });
    }

    const amountInPaise = Math.round(rawAmount * 100);
    const currency = (payload.currency || 'INR').toUpperCase();
    const receipt = String(payload.receipt || ('rcpt_' + Date.now())).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40);

    const safeNotes = {};
    if (payload.notes && typeof payload.notes === 'object') {
      ['order_id', 'customer_name', 'customer_phone', 'product_name', 'specs'].forEach(k => {
        if (payload.notes[k]) safeNotes[k] = String(payload.notes[k]).slice(0, 150);
      });
    }

    const postData = JSON.stringify({
      amount: amountInPaise,
      currency: currency,
      receipt: receipt,
      notes: safeNotes
    });

    const authHeader = 'Basic ' + Buffer.from(`${keyId}:${keySecret}`).toString('base64');

    const rzpOrder = await new Promise((resolve) => {
      const options = {
        hostname: 'api.razorpay.com',
        port: 443,
        path: '/v1/orders',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData),
          'Authorization': authHeader
        },
        timeout: 8000
      };

      const rzpReq = https.request(options, (rzpRes) => {
        let data = '';
        rzpRes.on('data', chunk => data += chunk);
        rzpRes.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            if (rzpRes.statusCode >= 200 && rzpRes.statusCode < 300 && parsed.id) {
              resolve({ success: true, order: parsed });
            } else {
              resolve({
                success: false,
                statusCode: rzpRes.statusCode,
                error: parsed.error?.description || parsed.error?.reason || 'Razorpay order creation rejected by gateway'
              });
            }
          } catch (e) {
            resolve({ success: false, statusCode: rzpRes.statusCode, error: 'Invalid gateway response' });
          }
        });
      });

      rzpReq.on('error', (err) => resolve({ success: false, error: 'Network error communicating with Razorpay: ' + err.message }));
      rzpReq.on('timeout', () => {
        rzpReq.destroy();
        resolve({ success: false, error: 'Gateway request timed out' });
      });

      rzpReq.write(postData);
      rzpReq.end();
    });

    if (!rzpOrder.success) {
      return res.status(502).json({
        success: false,
        message: rzpOrder.error || 'Failed to create payment order with Razorpay.'
      });
    }

    return res.status(200).json({
      success: true,
      configured: true,
      order_id: rzpOrder.order.id,
      amount: amountInPaise,
      currency: currency,
      key_id: keyId,
      theme_color: process.env.RAZORPAY_THEME_COLOR || '#00B4D8'
    });

  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server order processing error: ' + err.message });
  }
};
