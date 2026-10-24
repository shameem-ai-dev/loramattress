// Vercel Serverless Function: /api/otp/session
// Validates a customer session token (header: X-Customer-Session) so the storefront can
// reuse an existing verification instead of sending another (paid) OTP.
const otpLib = require('./_lib.js');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Customer-Session');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ success: false, message: 'Method Not Allowed' });

  const session = otpLib.verifyCustomerToken(otpLib.getCustomerTokenFromReq(req));
  if (!session) {
    return res.status(200).json({ success: true, valid: false });
  }
  return res.status(200).json({ success: true, valid: true, phone: session.phone, expiresAt: session.expiresAt });
};
