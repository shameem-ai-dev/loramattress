// Vercel Serverless Function: /api/otp/verify
// Verifies an OTP and, for phone numbers, issues a signed customer session token.
// - Twilio Verify: customer is authenticated ONLY when Twilio returns status "approved".
// - Other providers: constant-time comparison against the SHA-256 hash stored at send time.
const crypto = require('crypto');
const https = require('https');
const otpLib = require('./_lib.js');

global._loraOtpStore = global._loraOtpStore || new Map();

function hashOtp(otp) {
  return crypto.createHash('sha256').update(String(otp)).digest('hex');
}

function safeEqualHex(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
}

function fast2smsRemoteVerify(cleanPhone, enteredOtp) {
  const apiKey = (process.env.FAST2SMS_API_KEY || process.env.WHATSAPP_API_TOKEN || process.env.SMS_API_KEY || '').trim();
  if (!apiKey || !cleanPhone) return Promise.resolve(false);
  const verifyPost = JSON.stringify({ mobile: cleanPhone, otp: enteredOtp });
  return new Promise((resolve) => {
    const vReq = https.request({
      hostname: 'www.fast2sms.com',
      path: '/dev/otp/verify',
      method: 'POST',
      headers: { 'authorization': apiKey, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(verifyPost) },
      timeout: 6000
    }, (vRes) => {
      let body = '';
      vRes.on('data', c => body += c);
      vRes.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve(parsed.return === true || parsed.status_code === 200);
        } catch (e) { resolve(false); }
      });
    });
    vReq.on('error', () => resolve(false));
    vReq.on('timeout', () => { vReq.destroy(); resolve(false); });
    vReq.write(verifyPost);
    vReq.end();
  });
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  try {
    const payload = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const rawIdentifier = String(payload.identifier || '').trim();
    const enteredOtp = String(payload.otp || '').replace(/\s+/g, '');

    if (!rawIdentifier || !enteredOtp) {
      return res.status(400).json({ success: false, message: 'Phone number and OTP are required.' });
    }
    if (!/^\d{4,10}$/.test(enteredOtp)) {
      return res.status(400).json({ success: false, message: 'Please enter the numeric code you received.' });
    }

    const isEmail = rawIdentifier.includes('@');
    const identifier = isEmail ? rawIdentifier.toLowerCase() : otpLib.normalizeIndianPhone(rawIdentifier);
    if (!identifier) {
      return res.status(400).json({ success: false, message: 'Please enter a valid 10-digit Indian mobile number.' });
    }

    const blocked = otpLib.checkVerifyAllowed(identifier);
    if (blocked) {
      return res.status(blocked.status).json({ success: false, message: blocked.message });
    }

    const now = Date.now();
    const record = global._loraOtpStore.get(identifier) || null;
    const otpSettingsNow = otpLib.readOtpSettings();
    const twilioActive = otpSettingsNow.sms.provider === 'Twilio' || otpSettingsNow.whatsapp.provider === 'Twilio';

    // Twilio Verify keeps the code server-side at Twilio, so we can check even if this
    // instance has no local record (e.g. after a restart or on another serverless instance).
    const useTwilio = !isEmail && (
      (record && record.provider === 'TWILIO') ||
      (!record && twilioActive)
    );

    let isValid = false;

    if (useTwilio) {
      const tw = await otpLib.twilioCheckVerification(identifier, enteredOtp);
      if (!tw.ok) {
        // 20404 = verification expired / already used / not found
        if (tw.code === 20404) {
          global._loraOtpStore.delete(identifier);
          return res.status(400).json({ success: false, message: 'This code has expired or was already used. Please request a new OTP.' });
        }
        if (tw.code === 60202) {
          global._loraOtpStore.delete(identifier);
          return res.status(429).json({ success: false, message: tw.message });
        }
        return res.status(400).json({ success: false, message: tw.message });
      }
      isValid = tw.approved === true; // ONLY "approved" authenticates
    } else {
      if (!record) {
        return res.status(400).json({ success: false, message: 'No active OTP found for this number. Please request a new OTP.' });
      }
      if (now > record.expiresAt) {
        global._loraOtpStore.delete(identifier);
        return res.status(400).json({ success: false, message: 'This OTP has expired. Please request a new code.' });
      }
      isValid = safeEqualHex(hashOtp(enteredOtp), record.hashedOtp);
      if (!isValid && record.provider === 'FAST2SMS') {
        isValid = await fast2smsRemoteVerify(otpLib.last10(identifier), enteredOtp);
      }
    }

    if (!isValid) {
      otpLib.recordVerifyFailure(identifier);
      const remaining = otpLib.verifyAttemptsLeft(identifier);
      if (remaining <= 0) {
        global._loraOtpStore.delete(identifier);
        return res.status(429).json({ success: false, message: 'Too many incorrect attempts. Please request a new OTP after a few minutes.' });
      }
      return res.status(400).json({ success: false, message: `Incorrect code. ${remaining} attempt(s) remaining.` });
    }

    // Success
    global._loraOtpStore.delete(identifier);
    otpLib.clearVerify(identifier);

    const response = {
      success: true,
      message: 'Mobile number verified successfully.',
      verifiedIdentifier: identifier
    };
    if (!isEmail) {
      const session = otpLib.issueCustomerToken(identifier);
      response.sessionToken = session.token;
      response.phone = session.phone;
      response.sessionExpiresAt = session.expiresAt;
    }
    return res.status(200).json(response);
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Verification failed due to a server error. Please try again.' });
  }
};
