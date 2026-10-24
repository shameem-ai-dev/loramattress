// Vercel Serverless Function: /api/otp/send
// Dispatches authentication OTPs using server-side provider credentials from process.env

const crypto = require('crypto');
const https = require('https');
const otpLib = require('./_lib.js');

global._loraOtpStore = global._loraOtpStore || new Map();

function hashOtp(otp) {
  return crypto.createHash('sha256').update(String(otp)).digest('hex');
}

function postJson(hostname, apiPath, headers, payloadObj, timeout) {
  const data = payloadObj ? JSON.stringify(payloadObj) : '';
  return new Promise((resolve) => {
    const r = https.request({
      hostname, path: apiPath, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data), ...headers },
      timeout: timeout || 8000
    }, (resp) => {
      let body = '';
      resp.on('data', c => body += c);
      resp.on('end', () => {
        let parsed = null;
        try { parsed = JSON.parse(body); } catch (e) {}
        resolve({ statusCode: resp.statusCode, data: parsed, raw: body });
      });
    });
    r.on('error', err => resolve({ statusCode: 0, error: err.message }));
    r.on('timeout', () => { r.destroy(); resolve({ statusCode: 0, error: 'Gateway timeout' }); });
    if (data) r.write(data);
    r.end();
  });
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
    const otpSettings = otpLib.readOtpSettings();
    const smsStatus = otpLib.smsProviderStatus(otpSettings.sms.provider, otpSettings);

    return res.status(200).json({
      success: true,
      channels: {
        sms: {
          configured: smsStatus.configured,
          provider: smsStatus.provider,
          vars: smsStatus.vars,
          message: smsStatus.message
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

  let payload;
  try {
    payload = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
  } catch (e) {
    return res.status(400).json({ success: false, message: 'Invalid request body.' });
  }

  const rawIdentifier = String(payload.identifier || '').trim();
  const channel = String(payload.channel || 'sms').toLowerCase();
  if (!['sms', 'whatsapp', 'email'].includes(channel)) {
    return res.status(400).json({ success: false, message: 'Invalid OTP channel.' });
  }
  if (!rawIdentifier) {
    return res.status(400).json({ success: false, message: 'Mobile number or email is required.' });
  }

  let identifier;
  if (channel === 'email') {
    identifier = rawIdentifier.toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier)) {
      return res.status(400).json({ success: false, message: 'Please enter a valid email address.' });
    }
  } else {
    identifier = otpLib.normalizeIndianPhone(rawIdentifier);
    if (!identifier) {
      return res.status(400).json({ success: false, message: 'Please enter a valid 10-digit Indian mobile number (e.g. +91 98765 43210).' });
    }
  }

  // Server-side rate limiting, cooldown and duplicate-click protection
  const ip = otpLib.clientIp(req);
  const blocked = otpLib.checkSendAllowed(identifier, ip);
  if (blocked) {
    return res.status(blocked.status).json({ success: false, message: blocked.message, retryAfter: blocked.retryAfter });
  }

  otpLib.beginSend(identifier);
  let sendSucceeded = false;
  try {
    const now = Date.now();
    const cleanPhone = channel === 'email' ? '' : otpLib.last10(identifier);
    const existingSession = global._loraOtpStore.get(identifier) || null;
    const otpSettings = otpLib.readOtpSettings();
    let smsProvider = null;

    const plainOtp = crypto.randomInt(100000, 1000000).toString();
    const expiryMinutes = Math.min(Math.max(Number(payload.expiryMinutes) || 5, 1), 10);
    let expiresAt = now + expiryMinutes * 60 * 1000;

    // 1. Channel: SMS (provider chosen in Admin → OTP settings, saved server-side)
    if (channel === 'sms') {
      smsProvider = otpSettings.sms.provider;
      const status = otpLib.smsProviderStatus(smsProvider, otpSettings);
      if (!status.configured) {
        return res.status(503).json({
          success: false,
          configured: false,
          provider: smsProvider,
          message: `SMS OTP is not available right now (${smsProvider}: ${status.message}) Please try again later or choose another method.`
        });
      }

      if (smsProvider === 'Twilio') {
        // Twilio Verify generates, sends and stores the code itself
        const tw = await otpLib.twilioSendVerification(identifier);
        if (!tw.ok) {
          return res.status(tw.code === 60203 || tw.code === 20429 ? 429 : 502).json({
            success: false,
            provider: 'Twilio',
            message: tw.message
          });
        }
        expiresAt = now + 10 * 60 * 1000; // Twilio Verify default code lifetime
      } else if (smsProvider === 'Fast2SMS') {
        const apiKey = (process.env.SMS_API_KEY || process.env.FAST2SMS_API_KEY || '').trim();
        const r = await postJson('www.fast2sms.com', '/dev/bulkV2', { authorization: apiKey },
          { route: 'otp', variables_values: plainOtp, numbers: cleanPhone }, 7000);
        const ok = r.data ? r.data.return === true : false;
        if (!ok) {
          const msg = (r.data && (Array.isArray(r.data.message) ? r.data.message.join(', ') : r.data.message)) || r.error || 'Provider rejected request';
          return res.status(502).json({ success: false, provider: 'Fast2SMS', message: `SMS could not be sent via Fast2SMS (${String(msg).slice(0, 200)}).` });
        }
      } else if (smsProvider === 'MSG91') {
        const apiKey = (process.env.SMS_API_KEY || '').trim();
        const qs = new URLSearchParams({
          template_id: otpSettings.sms.templateId,
          mobile: '91' + cleanPhone,
          otp: plainOtp,
          otp_expiry: String(expiryMinutes)
        }).toString();
        const r = await postJson('control.msg91.com', `/api/v5/otp?${qs}`, { authkey: apiKey }, {}, 8000);
        const ok = r.data && String(r.data.type).toLowerCase() === 'success';
        if (!ok) {
          const msg = (r.data && r.data.message) || r.error || `HTTP ${r.statusCode}`;
          return res.status(502).json({ success: false, provider: 'MSG91', message: `SMS could not be sent via MSG91 (${String(msg).slice(0, 200)}).` });
        }
      }
    }

    // 2. Channel: WhatsApp
    else if (channel === 'whatsapp') {
      const hasFast2smsKey = Boolean(process.env.FAST2SMS_API_KEY || process.env.SMS_API_KEY);
      const waProvider = (
        payload.provider || 
        process.env.WHATSAPP_PROVIDER || 
        (hasFast2smsKey ? 'FAST2SMS' : 'META_CLOUD')
      ).toUpperCase();
      const isFast2Sms = waProvider === 'FAST2SMS' || waProvider.includes('FAST2SMS');

      if (isFast2Sms) {
        const apiKey = (process.env.FAST2SMS_API_KEY || process.env.WHATSAPP_API_TOKEN || process.env.SMS_API_KEY || '').trim();

        if (!apiKey) {
          return res.status(503).json({
            success: false,
            configured: false,
            message: 'Fast2SMS WhatsApp OTP service is unconfigured. Please add FAST2SMS_API_KEY or SMS_API_KEY in GoDaddy environment variables.'
          });
        }

        if (!cleanPhone || cleanPhone.length !== 10) {
          return res.status(400).json({
            success: false,
            message: 'Please provide a valid 10-digit Indian mobile number for WhatsApp verification.'
          });
        }

        const otpId = (
          process.env.FAST2SMS_OTP_ID || 
          process.env.FAST2SMS_WHATSAPP_MESSAGE_ID || 
          process.env.WHATSAPP_TEMPLATE_NAME || 
          payload.otp_id || 
          payload.templateName || 
          ''
        ).trim();

        let fastResult = null;
        let triedSmartOtp = false;

        // Step 1: Use Fast2SMS Smart OTP Endpoint: POST https://www.fast2sms.com/dev/otp/send
        // Parameters: otp_id, mobile, otp, otp_expiry, otp_length
        if (otpId) {
          triedSmartOtp = true;
          const smartOtpPayload = JSON.stringify({
            otp_id: otpId,
            mobile: cleanPhone,
            otp: plainOtp,
            otp_expiry: expiryMinutes,
            otp_length: 6
          });

          fastResult = await new Promise((resolve) => {
            const reqOpt = {
              hostname: 'www.fast2sms.com',
              path: '/dev/otp/send',
              method: 'POST',
              headers: {
                'authorization': apiKey,
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Content-Length': Buffer.byteLength(smartOtpPayload)
              },
              timeout: 9000
            };
            const sReq = https.request(reqOpt, (sRes) => {
              let body = '';
              sRes.on('data', c => body += c);
              sRes.on('end', () => {
                try {
                  const parsed = JSON.parse(body);
                  const isOk = parsed.return === true || parsed.status_code === 200;
                  resolve({
                    ok: isOk,
                    statusCode: sRes.statusCode,
                    message: parsed.message || (Array.isArray(parsed.message) ? parsed.message.join(', ') : body)
                  });
                } catch (e) {
                  resolve({ ok: false, statusCode: sRes.statusCode, message: body });
                }
              });
            });
            sReq.on('error', err => resolve({ ok: false, message: 'Fast2SMS connection error: ' + err.message }));
            sReq.on('timeout', () => { sReq.destroy(); resolve({ ok: false, message: 'Fast2SMS gateway timeout' }); });
            sReq.write(smartOtpPayload);
            sReq.end();
          });
        }

        // Step 2: Fallback to WhatsApp endpoint if Smart OTP was not attempted or returned template error
        if (!fastResult || (!fastResult.ok && String(fastResult.message).toLowerCase().includes('otp id'))) {
          const waPayload = {
            numbers: cleanPhone,
            variables_values: plainOtp
          };
          if (otpId) waPayload.message_id = otpId;
          if (process.env.WHATSAPP_PHONE_NUMBER_ID) waPayload.phone_number_id = process.env.WHATSAPP_PHONE_NUMBER_ID;

          const waData = JSON.stringify(waPayload);

          const waResult = await new Promise((resolve) => {
            const reqOpt = {
              hostname: 'www.fast2sms.com',
              path: '/dev/whatsapp',
              method: 'POST',
              headers: {
                'authorization': apiKey,
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(waData)
              },
              timeout: 9000
            };
            const wReq = https.request(reqOpt, (wRes) => {
              let body = '';
              wRes.on('data', c => body += c);
              wRes.on('end', () => {
                try {
                  const parsed = JSON.parse(body);
                  const isOk = parsed.return === true || wRes.statusCode === 200;
                  resolve({
                    ok: isOk,
                    statusCode: wRes.statusCode,
                    message: parsed.message || (Array.isArray(parsed.message) ? parsed.message.join(', ') : body)
                  });
                } catch (e) {
                  resolve({ ok: false, statusCode: wRes.statusCode, message: body });
                }
              });
            });
            wReq.on('error', err => resolve({ ok: false, message: 'Fast2SMS connection error: ' + err.message }));
            wReq.on('timeout', () => { wReq.destroy(); resolve({ ok: false, message: 'Fast2SMS gateway timeout' }); });
            wReq.write(waData);
            wReq.end();
          });

          if (waResult.ok || !triedSmartOtp) {
            fastResult = waResult;
          }
        }

        // If provider rejected, return 502 with honest provider error
        if (!fastResult || !fastResult.ok) {
          const errMsg = fastResult ? fastResult.message : (otpId ? 'Fast2SMS dispatch rejected' : 'Missing approved OTP Template ID. Please configure FAST2SMS_OTP_ID or WHATSAPP_TEMPLATE_NAME in GoDaddy.');
          return res.status(502).json({
            success: false,
            message: `Fast2SMS WhatsApp delivery rejected: ${errMsg}`
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

    // Store hashed OTP in memory (ONLY after provider accepted the send). Plain OTPs are never stored.
    const isFast2SmsActive = (channel === 'whatsapp' && (
      (payload.provider || '').toUpperCase().includes('FAST2SMS') || 
      (process.env.WHATSAPP_PROVIDER || '').toUpperCase().includes('FAST2SMS') ||
      Boolean(process.env.FAST2SMS_API_KEY || process.env.SMS_API_KEY)
    ));

    let providerTag;
    if (channel === 'sms') providerTag = smsProvider === 'Twilio' ? 'TWILIO' : smsProvider.toUpperCase();
    else if (channel === 'whatsapp') providerTag = isFast2SmsActive ? 'FAST2SMS' : 'META_CLOUD';
    else providerTag = 'SMTP';

    const sessionObj = {
      hashedOtp: providerTag === 'TWILIO' ? null : hashOtp(plainOtp),
      expiresAt: expiresAt,
      attempts: 0,
      maxAttempts: otpLib.LIMITS.maxVerifyAttemptsPer15Min,
      channel: channel,
      provider: providerTag,
      lastSentAt: now,
      firstSentAt: existingSession?.firstSentAt || now,
      sendCount: (existingSession?.sendCount || 0) + 1
    };

    global._loraOtpStore.set(identifier, sessionObj);
    sendSucceeded = true;

    const masked = channel === 'email'
      ? identifier.replace(/^(.)(.*)(@.*)$/, '$1•••$3')
      : otpLib.maskPhone(identifier);

    return res.status(200).json({
      success: true,
      message: `Verification code sent to ${masked} via ${channel === 'sms' ? 'SMS' : channel === 'whatsapp' ? 'WhatsApp' : 'Email'}.`,
      channel: channel,
      identifier: identifier,
      provider: channel === 'sms' ? smsProvider : providerTag,
      cooldown: otpLib.LIMITS.resendCooldownSec,
      expiresInMinutes: Math.round((expiresAt - now) / 60000)
    });

  } catch (err) {
    return res.status(500).json({ success: false, message: 'OTP could not be sent due to a server error. Please try again.' });
  } finally {
    otpLib.endSend(identifier, ip, sendSucceeded);
  }
};
