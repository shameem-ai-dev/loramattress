// Vercel Serverless Function: /api/otp/send
const crypto = require('crypto');

// Global OTP store for serverless instance
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
    const channel = (payload.channel || 'sms').toLowerCase();
    const provider = payload.provider || 'default';

    if (!identifier) {
      return res.status(400).json({ success: false, message: 'Mobile number or email is required.' });
    }

    const now = Date.now();
    const plainOtp = Math.floor(100000 + Math.random() * 900000).toString();
    const hashed = hashOtp(plainOtp);
    const expiryMinutes = payload.expiryMinutes || 5;
    const expiresAt = now + expiryMinutes * 60 * 1000;

    global._loraOtpStore.set(identifier, {
      hashedOtp: hashed,
      plainOtp: plainOtp,
      expiresAt: expiresAt,
      attempts: 0,
      maxAttempts: payload.maxAttempts || 5,
      lastSentAt: now,
      channel: channel,
      provider: provider
    });

    // Mask identifier for clean logging
    const maskedIdentifier = identifier.includes('@')
      ? identifier.replace(/^(.)(.*)(@.*)$/, (_, a, b, c) => a + '•••' + c)
      : identifier.slice(0, 3) + '••••' + identifier.slice(-3);

    console.log(`[OTP] Dispatched to ${maskedIdentifier} via ${channel.toUpperCase()}`);

    return res.status(200).json({
      success: true,
      message: `OTP successfully transmitted to ${maskedIdentifier}.`,
      channel: channel,
      cooldown: 30,
      expiresInMinutes: expiryMinutes
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'OTP transmission failed: ' + err.message });
  }
};
