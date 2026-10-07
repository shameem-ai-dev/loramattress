// Vercel Serverless Function: /api/otp/verify
const crypto = require('crypto');

global._loraOtpStore = global._loraOtpStore || new Map();

function hashOtp(otp) {
  return crypto.createHash('sha256').update(String(otp)).digest('hex');
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  try {
    const payload = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const identifier = (payload.identifier || '').trim();
    const enteredOtp = (payload.otp || '').trim();
    const now = Date.now();

    if (!identifier || !enteredOtp) {
      return res.status(400).json({ success: false, message: 'Identifier and OTP passcode are required.' });
    }

    const record = global._loraOtpStore.get(identifier);

    if (!record) {
      return res.status(400).json({
        success: false,
        message: 'No active OTP found or code expired. Please request a new OTP.'
      });
    }

    if (now > record.expiresAt) {
      global._loraOtpStore.delete(identifier);
      return res.status(400).json({
        success: false,
        message: 'OTP passcode has expired. Please request a new code.'
      });
    }

    const hashedEntered = hashOtp(enteredOtp);
    const isValid = (hashedEntered === record.hashedOtp || enteredOtp === record.plainOtp);

    if (!isValid) {
      record.attempts += 1;
      const remaining = Math.max(0, record.maxAttempts - record.attempts);

      if (record.attempts >= record.maxAttempts) {
        global._loraOtpStore.delete(identifier);
        return res.status(400).json({
          success: false,
          message: 'Maximum verification attempts exceeded. Please request a new code.'
        });
      }

      return res.status(400).json({
        success: false,
        message: `Incorrect verification code. ${remaining} attempt(s) remaining.`
      });
    }

    // Success: Remove OTP and verify
    global._loraOtpStore.delete(identifier);

    return res.status(200).json({
      success: true,
      message: 'OTP verified successfully.',
      verifiedIdentifier: identifier
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Verification error: ' + err.message });
  }
};
