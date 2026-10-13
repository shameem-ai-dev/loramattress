// Vercel Serverless Function: /api/razorpay/test-connection
// Admin-only non-destructive credential verification against Razorpay API

const https = require('https');
const { verifyAdminAuth } = require('../auth.js');

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

  // 1. Enforce Server-Side Admin Authorization
  if (!verifyAdminAuth(req)) {
    return res.status(401).json({
      success: false,
      message: 'Unauthorized: Admin authentication token required to test gateway connection.'
    });
  }

  try {
    // 2. Read credentials exclusively from server-side environment variables
    const keyId = (process.env.RAZORPAY_KEY_ID || '').trim();
    const keySecret = (process.env.RAZORPAY_KEY_SECRET || '').trim();

    if (!keyId || !keySecret) {
      return res.status(200).json({
        success: false,
        configured: false,
        message: 'Razorpay is unconfigured: RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET is missing from GoDaddy environment variables.'
      });
    }

    const isLive = keyId.startsWith('rzp_live_');
    const modeName = isLive ? 'Live Production Mode' : 'Sandbox Test Mode';
    const authHeader = 'Basic ' + Buffer.from(`${keyId}:${keySecret}`).toString('base64');

    // 3. Perform read-only API check (fetches 1 past payment record metadata; no charge, no write)
    const verification = await new Promise((resolve) => {
      const options = {
        hostname: 'api.razorpay.com',
        port: 443,
        path: '/v1/payments?count=1',
        method: 'GET',
        headers: {
          'Authorization': authHeader,
          'User-Agent': 'LORA-Mattress-Admin-Verification'
        },
        timeout: 7000
      };

      const rzpReq = https.request(options, (rzpRes) => {
        let data = '';
        rzpRes.on('data', chunk => data += chunk);
        rzpRes.on('end', () => {
          if (rzpRes.statusCode === 200) {
            resolve({ success: true, statusCode: 200 });
          } else {
            let errorMsg = `HTTP ${rzpRes.statusCode}`;
            try {
              const parsed = JSON.parse(data);
              errorMsg = parsed.error?.description || parsed.error?.reason || errorMsg;
            } catch (e) {}
            resolve({ success: false, statusCode: rzpRes.statusCode, error: errorMsg });
          }
        });
      });

      rzpReq.on('error', (err) => resolve({ success: false, error: err.message }));
      rzpReq.on('timeout', () => {
        rzpReq.destroy();
        resolve({ success: false, error: 'Connection to api.razorpay.com timed out' });
      });

      rzpReq.end();
    });

    if (verification.success) {
      return res.status(200).json({
        success: true,
        configured: true,
        mode: isLive ? 'live' : 'test',
        key_id_preview: keyId.slice(0, 8) + '••••' + keyId.slice(-4),
        message: `Connection to Razorpay (${modeName}) validated successfully with live gateway handshake.`
      });
    } else {
      return res.status(200).json({
        success: false,
        configured: true,
        mode: isLive ? 'live' : 'test',
        key_id_preview: keyId.slice(0, 8) + '••••' + keyId.slice(-4),
        message: `Razorpay connection failed (${verification.statusCode || 'Error'}): ${verification.error}. Check RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in GoDaddy.`
      });
    }

  } catch (err) {
    return res.status(500).json({ success: false, message: 'Test verification error: ' + err.message });
  }
};
