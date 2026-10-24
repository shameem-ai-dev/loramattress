// Vercel Serverless Function: /api/otp/settings
// GET  -> selected SMS provider + configuration status (booleans only, never secret values)
// POST -> (admin only) save selected provider and its NON-secret settings
const otpLib = require('./_lib.js');
const { verifyAdminAuth } = require('../auth.js');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET') {
    const settings = otpLib.readOtpSettings();
    let previewProvider = null;
    try {
      const q = (req.query && req.query.provider) || new URL(req.url, 'http://localhost').searchParams.get('provider');
      previewProvider = otpLib.canonicalProvider(q);
    } catch (e) {}
    return res.status(200).json({
      success: true,
      settings,
      providers: otpLib.SMS_PROVIDERS,
      status: otpLib.smsProviderStatus(previewProvider || settings.sms.provider, settings)
    });
  }

  if (req.method === 'POST') {
    if (!verifyAdminAuth(req)) {
      return res.status(401).json({ success: false, message: 'Unauthorized: admin login required to change OTP settings.' });
    }
    try {
      const payload = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
      const sms = payload.sms || {};
      // Refuse anything that looks like a secret — secrets belong in hosting env vars only.
      const forbidden = Object.keys(sms).filter(k => /token|secret|key|password|sid/i.test(k));
      if (forbidden.length) {
        return res.status(400).json({ success: false, message: 'Secrets cannot be saved here. Add them as environment variables in your hosting panel.' });
      }
      const { settings, persisted } = otpLib.saveOtpSettings({ sms });
      return res.status(200).json({
        success: true,
        persisted,
        message: persisted
          ? `SMS provider saved: ${settings.sms.provider}.`
          : `SMS provider set to ${settings.sms.provider} (server storage is read-only; the setting resets on restart — set SMS_PROVIDER in hosting env vars to make it permanent).`,
        settings,
        status: otpLib.smsProviderStatus(settings.sms.provider, settings)
      });
    } catch (err) {
      return res.status(400).json({ success: false, message: err.message });
    }
  }

  return res.status(405).json({ success: false, message: 'Method Not Allowed' });
};
