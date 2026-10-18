// Vercel Serverless Function: /api/otp/test-gateway
// Admin-only non-destructive credential validation for SMS, WhatsApp, and Email gateways

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

  // 1. Admin Authorization Enforcement
  if (!verifyAdminAuth(req)) {
    return res.status(401).json({
      success: false,
      message: 'Unauthorized: Admin authentication token required to test gateway integrations.'
    });
  }

  try {
    const payload = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const channel = (payload.channel || 'sms').toLowerCase();

    // 2. Test SMS Gateway (Read-only account/profile check)
    if (channel === 'sms') {
      const apiKey = (process.env.SMS_API_KEY || '').trim();
      const provider = (process.env.SMS_PROVIDER || 'FAST2SMS').toUpperCase();
      const senderId = (process.env.SMS_SENDER_ID || 'LORAMT').trim();

      if (!apiKey) {
        return res.status(200).json({
          success: false,
          configured: false,
          message: 'SMS Gateway Unconfigured: SMS_API_KEY is missing from GoDaddy environment variables.'
        });
      }

      if (provider === 'FAST2SMS') {
        // Query Fast2SMS balance/status endpoint (read-only; sends 0 messages, incurs 0 charge)
        const checkResult = await new Promise((resolve) => {
          const reqOpt = {
            hostname: 'www.fast2sms.com',
            path: '/dev/wallet',
            method: 'POST',
            headers: {
              'authorization': apiKey
            },
            timeout: 6000
          };
          const fReq = https.request(reqOpt, (fRes) => {
            let body = '';
            fRes.on('data', c => body += c);
            fRes.on('end', () => {
              try {
                const parsed = JSON.parse(body);
                resolve({ ok: parsed.return === true, wallet: parsed.wallet, message: parsed.message });
              } catch (e) {
                resolve({ ok: fRes.statusCode === 200, message: body });
              }
            });
          });
          fReq.on('error', err => resolve({ ok: false, message: err.message }));
          fReq.on('timeout', () => { fReq.destroy(); resolve({ ok: false, message: 'Timeout' }); });
          fReq.end();
        });

        if (checkResult.ok) {
          return res.status(200).json({
            success: true,
            configured: true,
            message: `Fast2SMS Gateway handshake verified! Active balance: ₹${checkResult.wallet ?? '0'}. Sender ID: ${senderId}.`
          });
        } else {
          return res.status(200).json({
            success: false,
            configured: true,
            message: `Fast2SMS authentication failed: ${checkResult.message || 'Invalid API key'}. Check SMS_API_KEY in GoDaddy.`
          });
        }
      }

      return res.status(200).json({
        success: true,
        configured: true,
        message: `${provider} Gateway credentials present (Sender ID: ${senderId}).`
      });
    }

    // 3. Test WhatsApp Gateway
    else if (channel === 'whatsapp') {
      const waProvider = (payload.provider || process.env.WHATSAPP_PROVIDER || 'META_CLOUD').toUpperCase();
      const isFast2Sms = waProvider === 'FAST2SMS' || waProvider.includes('FAST2SMS');

      if (isFast2Sms) {
        const apiKey = (process.env.FAST2SMS_API_KEY || process.env.WHATSAPP_API_TOKEN || process.env.SMS_API_KEY || '').trim();

        if (!apiKey) {
          return res.status(200).json({
            success: false,
            configured: false,
            message: 'Fast2SMS WhatsApp Gateway Unconfigured: FAST2SMS_API_KEY, WHATSAPP_API_TOKEN, or SMS_API_KEY is missing from GoDaddy.'
          });
        }

        // Query Fast2SMS balance/status endpoint (read-only; sends 0 messages, incurs 0 charge)
        const checkResult = await new Promise((resolve) => {
          const reqOpt = {
            hostname: 'www.fast2sms.com',
            path: '/dev/wallet',
            method: 'POST',
            headers: {
              'authorization': apiKey,
              'Content-Type': 'application/json'
            },
            timeout: 6000
          };
          const fReq = https.request(reqOpt, (fRes) => {
            let body = '';
            fRes.on('data', c => body += c);
            fRes.on('end', () => {
              try {
                const parsed = JSON.parse(body);
                resolve({ ok: parsed.return === true, wallet: parsed.wallet, message: parsed.message });
              } catch (e) {
                resolve({ ok: false, error: body });
              }
            });
          });
          fReq.on('error', err => resolve({ ok: false, error: err.message }));
          fReq.on('timeout', () => { fReq.destroy(); resolve({ ok: false, error: 'Fast2SMS timeout' }); });
          fReq.end();
        });

        if (checkResult.ok) {
          return res.status(200).json({
            success: true,
            configured: true,
            message: `Fast2SMS WhatsApp Gateway handshake verified! Active wallet balance: ₹${checkResult.wallet ?? '0'}. Ready for WhatsApp OTP dispatch.`
          });
        } else {
          return res.status(200).json({
            success: false,
            configured: true,
            message: `Fast2SMS authentication failed: ${checkResult.message || 'Invalid API key'}. Check FAST2SMS_API_KEY or WHATSAPP_API_TOKEN in GoDaddy.`
          });
        }
      }

      const waToken = (process.env.WHATSAPP_API_TOKEN || '').trim();
      const waPhoneId = (process.env.WHATSAPP_PHONE_NUMBER_ID || '').trim();

      if (!waToken || !waPhoneId) {
        return res.status(200).json({
          success: false,
          configured: false,
          message: 'WhatsApp Gateway Unconfigured: WHATSAPP_API_TOKEN or WHATSAPP_PHONE_NUMBER_ID is missing from GoDaddy.'
        });
      }

      // Check phone number status on Meta Graph API
      const waCheck = await new Promise((resolve) => {
        const reqOpt = {
          hostname: 'graph.facebook.com',
          path: `/v18.0/${waPhoneId}?fields=verified_name,code_verification_status,quality_rating`,
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${waToken}`
          },
          timeout: 6000
        };
        const mReq = https.request(reqOpt, (mRes) => {
          let body = '';
          mRes.on('data', c => body += c);
          mRes.on('end', () => {
            try {
              const parsed = JSON.parse(body);
              if (parsed.id) {
                resolve({ ok: true, name: parsed.verified_name || parsed.id });
              } else {
                resolve({ ok: false, error: parsed.error?.message });
              }
            } catch (e) {
              resolve({ ok: false, error: body });
            }
          });
        });
        mReq.on('error', err => resolve({ ok: false, error: err.message }));
        mReq.on('timeout', () => { mReq.destroy(); resolve({ ok: false, error: 'Meta API timeout' }); });
        mReq.end();
      });

      if (waCheck.ok) {
        return res.status(200).json({
          success: true,
          configured: true,
          message: `Meta WhatsApp Cloud API handshake verified for Account: "${waCheck.name}". Quality rating active.`
        });
      } else {
        return res.status(200).json({
          success: false,
          configured: true,
          message: `Meta API error: ${waCheck.error || 'Token expired or invalid phone number ID'}. Check WHATSAPP_API_TOKEN in GoDaddy.`
        });
      }
    }

    // 4. Test Email Gateway (Credentials presence check)
    else if (channel === 'email') {
      const smtpHost = (process.env.SMTP_HOST || '').trim();
      const smtpUser = (process.env.SMTP_USER || '').trim();
      const smtpPass = (process.env.SMTP_PASS || '').trim();

      if (!smtpHost || !smtpUser || !smtpPass) {
        return res.status(200).json({
          success: false,
          configured: false,
          message: 'Email Gateway Unconfigured: SMTP_HOST, SMTP_USER, or SMTP_PASS missing from GoDaddy.'
        });
      }

      return res.status(200).json({
        success: true,
        configured: true,
        message: `SMTP configuration present for ${smtpHost}:${process.env.SMTP_PORT || 587} (User: ${smtpUser}).`
      });
    }

    return res.status(400).json({ success: false, message: 'Invalid channel specified.' });

  } catch (err) {
    return res.status(500).json({ success: false, message: 'Gateway test error: ' + err.message });
  }
};
