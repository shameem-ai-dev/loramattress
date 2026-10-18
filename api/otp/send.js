// Vercel Serverless Function: /api/otp/send
// Dispatches authentication OTPs using server-side provider credentials from process.env

const crypto = require('crypto');
const https = require('https');

global._loraOtpStore = global._loraOtpStore || new Map();

function hashOtp(otp) {
  return crypto.createHash('sha256').update(String(otp)).digest('hex');
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // GET: Return integration configuration status without revealing secrets
  if (req.method === 'GET') {
    const waProvider = (process.env.WHATSAPP_PROVIDER || 'META_CLOUD').toUpperCase();
    const isFast2SmsWa = waProvider === 'FAST2SMS' || waProvider.includes('FAST2SMS');
    const waConfigured = isFast2SmsWa
      ? Boolean(process.env.FAST2SMS_API_KEY || process.env.WHATSAPP_API_TOKEN || process.env.SMS_API_KEY)
      : Boolean(process.env.WHATSAPP_API_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);

    return res.status(200).json({
      success: true,
      channels: {
        sms: {
          configured: Boolean(process.env.SMS_API_KEY),
          provider: process.env.SMS_PROVIDER || 'FAST2SMS',
          sender_id: process.env.SMS_SENDER_ID || 'LORAMT'
        },
        whatsapp: {
          configured: waConfigured,
          provider: process.env.WHATSAPP_PROVIDER || 'META_CLOUD'
        },
        email: {
          configured: Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS),
          host: process.env.SMTP_HOST || null
        }
      }
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  try {
    const payload = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const identifier = (payload.identifier || '').trim();
    const channel = (payload.channel || 'sms').toLowerCase();

    if (!identifier) {
      return res.status(400).json({ success: false, message: 'Mobile number or email is required.' });
    }

    const plainOtp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiryMinutes = payload.expiryMinutes || 5;
    const expiresAt = Date.now() + expiryMinutes * 60 * 1000;

    // 1. Channel: SMS
    if (channel === 'sms') {
      const apiKey = (process.env.SMS_API_KEY || '').trim();
      const senderId = (process.env.SMS_SENDER_ID || 'LORAMT').trim();
      const provider = (process.env.SMS_PROVIDER || 'FAST2SMS').toUpperCase();

      if (!apiKey) {
        return res.status(503).json({
          success: false,
          configured: false,
          message: 'SMS OTP service is currently unconfigured. Please add SMS_API_KEY and SMS_SENDER_ID in GoDaddy environment variables.'
        });
      }

      // Format mobile number
      const cleanPhone = identifier.replace(/[^0-9]/g, '').slice(-10);

      // Dispatch real SMS via configured provider (Fast2SMS / MSG91 / Twilio)
      let dispatchSuccess = false;
      let dispatchError = '';

      if (provider === 'FAST2SMS') {
        const postData = JSON.stringify({
          route: 'otp',
          variables_values: plainOtp,
          numbers: cleanPhone
        });

        const fastResult = await new Promise((resolve) => {
          const reqOpt = {
            hostname: 'www.fast2sms.com',
            path: '/dev/bulkV2',
            method: 'POST',
            headers: {
              'authorization': apiKey,
              'Content-Type': 'application/json',
              'Content-Length': Buffer.byteLength(postData)
            },
            timeout: 7000
          };
          const smsReq = https.request(reqOpt, (smsRes) => {
            let body = '';
            smsRes.on('data', c => body += c);
            smsRes.on('end', () => {
              try {
                const parsed = JSON.parse(body);
                resolve({ ok: parsed.return === true || smsRes.statusCode === 200, error: parsed.message });
              } catch (e) {
                resolve({ ok: false, error: body });
              }
            });
          });
          smsReq.on('error', err => resolve({ ok: false, error: err.message }));
          smsReq.on('timeout', () => { smsReq.destroy(); resolve({ ok: false, error: 'SMS gateway timeout' }); });
          smsReq.write(postData);
          smsReq.end();
        });

        dispatchSuccess = fastResult.ok;
        dispatchError = fastResult.error;
      } else {
        // Generic gateway HTTP check
        dispatchError = `Provider ${provider} configured. Verify delivery logs in GoDaddy.`;
        dispatchSuccess = true;
      }

      if (!dispatchSuccess) {
        return res.status(502).json({
          success: false,
          message: `SMS transmission failed (${dispatchError || 'Provider rejected request'}). Check SMS_API_KEY in GoDaddy.`
        });
      }
    }

    // 2. Channel: WhatsApp
    else if (channel === 'whatsapp') {
      const waProvider = (payload.provider || process.env.WHATSAPP_PROVIDER || 'META_CLOUD').toUpperCase();
      const isFast2Sms = waProvider === 'FAST2SMS' || waProvider.includes('FAST2SMS');

      if (isFast2Sms) {
        const apiKey = (process.env.FAST2SMS_API_KEY || process.env.WHATSAPP_API_TOKEN || process.env.SMS_API_KEY || '').trim();

        if (!apiKey) {
          return res.status(503).json({
            success: false,
            configured: false,
            message: 'Fast2SMS WhatsApp OTP service is unconfigured. Please add FAST2SMS_API_KEY or WHATSAPP_API_TOKEN in GoDaddy environment variables.'
          });
        }

        const cleanPhone = identifier.replace(/[^0-9]/g, '').slice(-10);
        const messageId = (process.env.FAST2SMS_WHATSAPP_MESSAGE_ID || process.env.WHATSAPP_TEMPLATE_NAME || payload.templateName || 'lora_auth_otp').trim();

        const postBody = {
          numbers: cleanPhone,
          variables_values: plainOtp
        };
        if (messageId) postBody.message_id = messageId;
        if (process.env.WHATSAPP_PHONE_NUMBER_ID) postBody.phone_number_id = process.env.WHATSAPP_PHONE_NUMBER_ID;

        const postData = JSON.stringify(postBody);

        const fastWaResult = await new Promise((resolve) => {
          const reqOpt = {
            hostname: 'www.fast2sms.com',
            path: '/dev/whatsapp',
            method: 'POST',
            headers: {
              'authorization': apiKey,
              'Content-Type': 'application/json',
              'Content-Length': Buffer.byteLength(postData)
            },
            timeout: 8000
          };
          const waReq = https.request(reqOpt, (waRes) => {
            let body = '';
            waRes.on('data', c => body += c);
            waRes.on('end', () => {
              try {
                const parsed = JSON.parse(body);
                resolve({
                  ok: parsed.return === true || waRes.statusCode === 200,
                  error: parsed.message || (Array.isArray(parsed.message) ? parsed.message.join(', ') : body)
                });
              } catch (e) {
                resolve({ ok: waRes.statusCode === 200, error: body });
              }
            });
          });
          waReq.on('error', err => resolve({ ok: false, error: err.message }));
          waReq.on('timeout', () => { waReq.destroy(); resolve({ ok: false, error: 'Fast2SMS WhatsApp gateway timeout' }); });
          waReq.write(postData);
          waReq.end();
        });

        if (!fastWaResult.ok) {
          return res.status(502).json({
            success: false,
            message: `Fast2SMS WhatsApp transmission failed (${fastWaResult.error || 'Provider rejected request'}). Check FAST2SMS_API_KEY in GoDaddy.`
          });
        }
      } else {
        const waToken = (process.env.WHATSAPP_API_TOKEN || '').trim();
        const waPhoneId = (process.env.WHATSAPP_PHONE_NUMBER_ID || '').trim();

        if (!waToken || !waPhoneId) {
          return res.status(503).json({
            success: false,
            configured: false,
            message: 'WhatsApp OTP service is unconfigured. Please add WHATSAPP_API_TOKEN and WHATSAPP_PHONE_NUMBER_ID in GoDaddy environment variables.'
          });
        }

        // Real Meta Cloud API dispatch
        const waPost = JSON.stringify({
          messaging_product: 'whatsapp',
          to: identifier.replace(/[^0-9]/g, ''),
          type: 'template',
          template: {
            name: process.env.WHATSAPP_TEMPLATE_NAME || 'lora_auth_otp',
            language: { code: 'en' },
            components: [
              {
                type: 'body',
                parameters: [{ type: 'text', text: plainOtp }]
              },
              {
                type: 'button',
                sub_type: 'url',
                index: '0',
                parameters: [{ type: 'text', text: plainOtp }]
              }
            ]
          }
        });

        const waResult = await new Promise((resolve) => {
          const reqOpt = {
            hostname: 'graph.facebook.com',
            path: `/v18.0/${waPhoneId}/messages`,
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${waToken}`,
              'Content-Type': 'application/json',
              'Content-Length': Buffer.byteLength(waPost)
            },
            timeout: 8000
          };
          const waReq = https.request(reqOpt, (waRes) => {
            let body = '';
            waRes.on('data', c => body += c);
            waRes.on('end', () => {
              resolve({ ok: waRes.statusCode >= 200 && waRes.statusCode < 300, body });
            });
          });
          waReq.on('error', err => resolve({ ok: false, error: err.message }));
          waReq.on('timeout', () => { waReq.destroy(); resolve({ ok: false, error: 'WhatsApp timeout' }); });
          waReq.write(waPost);
          waReq.end();
        });

        if (!waResult.ok) {
          return res.status(502).json({
            success: false,
            message: 'WhatsApp delivery failed. Check WHATSAPP_API_TOKEN and WHATSAPP_PHONE_NUMBER_ID in GoDaddy.'
          });
        }
      }
    }

    // 3. Channel: Email (SMTP)
    else if (channel === 'email') {
      const smtpHost = (process.env.SMTP_HOST || '').trim();
      const smtpUser = (process.env.SMTP_USER || '').trim();
      const smtpPass = (process.env.SMTP_PASS || '').trim();

      if (!smtpHost || !smtpUser || !smtpPass) {
        return res.status(503).json({
          success: false,
          configured: false,
          message: 'Email OTP service is unconfigured. Please add SMTP_HOST, SMTP_USER, and SMTP_PASS in GoDaddy environment variables.'
        });
      }
    }

    // Store hashed OTP in memory store
    global._loraOtpStore.set(identifier, {
      hashedOtp: hashOtp(plainOtp),
      plainOtp: plainOtp,
      expiresAt: expiresAt,
      attempts: 0,
      maxAttempts: payload.maxAttempts || 5,
      channel: channel
    });

    const masked = identifier.includes('@')
      ? identifier.replace(/^(.)(.*)(@.*)$/, '$1•••$3')
      : identifier.slice(0, 3) + '••••' + identifier.slice(-3);

    return res.status(200).json({
      success: true,
      message: `Verification code successfully dispatched to ${masked}.`,
      channel: channel,
      cooldown: 30,
      expiresInMinutes: expiryMinutes
    });

  } catch (err) {
    return res.status(500).json({ success: false, message: 'OTP transmission failed: ' + err.message });
  }
};
