// Vercel Serverless Function: /api/otp/test-gateway
// Admin-only non-destructive credential validation for SMS, WhatsApp, and Email gateways

const https = require('https');
const { verifyAdminAuth } = require('../auth.js');
const otpLib = require('./_lib.js');

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

    // 2. Test SMS Gateway — tests the provider currently selected in the admin form
    if (channel === 'sms') {
      const settings = otpLib.readOtpSettings();
      const provider = otpLib.canonicalProvider(payload.provider) || settings.sms.provider;
      const status = otpLib.smsProviderStatus(provider, settings);

      if (!status.configured) {
        return res.status(200).json({
          success: false,
          configured: false,
          provider,
          vars: status.vars,
          message: `${provider} is not ready: ${status.message}`
        });
      }

      if (provider === 'Twilio') {
        // Read-only handshake: fetch the Verify service (sends nothing, costs nothing)
        const svc = await otpLib.twilioFetchService();
        if (!svc.ok) {
          return res.status(200).json({ success: false, configured: true, provider, message: `Twilio check failed: ${svc.message}` });
        }
        let extra = '';
        if (payload.sendTest === true) {
          const phone = otpLib.normalizeIndianPhone(payload.identifier);
          if (!phone) {
            return res.status(200).json({ success: false, configured: true, provider, message: 'Credentials OK, but the test number is not a valid +91 mobile number.' });
          }
          const sent = await otpLib.twilioSendVerification(phone);
          if (!sent.ok) {
            return res.status(200).json({ success: false, configured: true, provider, message: `Credentials OK, but the test SMS failed: ${sent.message}` });
          }
          extra = ` A real test OTP was sent to ${otpLib.maskPhone(phone)} (status: ${sent.status}).`;
        }
        return res.status(200).json({
          success: true,
          configured: true,
          provider,
          message: `Twilio Verify connected — service "${svc.friendlyName}" (${svc.codeLength}-digit codes).${extra}`
        });
      }

      if (provider === 'MSG91') {
        return res.status(200).json({
          success: true,
          configured: true,
          provider,
          message: `MSG91 credentials present (SMS_API_KEY set, template ID configured). MSG91 has no free read-only check; send a real OTP from the storefront to confirm delivery.`
        });
      }

      // Fast2SMS
      const apiKey = (process.env.SMS_API_KEY || process.env.FAST2SMS_API_KEY || '').trim();
      const senderId = (process.env.SMS_SENDER_ID || 'LORAMT').trim();
      {
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
            provider,
            message: `Fast2SMS Gateway handshake verified! Active balance: ₹${checkResult.wallet ?? '0'}. Sender ID: ${senderId}.`
          });
        } else {
          return res.status(200).json({
            success: false,
            configured: true,
            provider,
            message: `Fast2SMS authentication failed: ${String(checkResult.message || 'Invalid API key').slice(0, 200)}. Check SMS_API_KEY in your hosting environment variables.`
          });
        }
      }
    }

    // 3. Test WhatsApp Gateway
    else if (channel === 'whatsapp') {
      const waSettings = otpLib.readOtpSettings();
      const waSelected = otpLib.canonicalWaProvider(payload.provider) || waSettings.whatsapp.provider;
      const waProvider = waSelected.toUpperCase();
      const isFast2Sms = waProvider === 'FAST2SMS' || waProvider.includes('FAST2SMS');

      if (waSelected === 'Twilio') {
        const st = otpLib.waProviderStatus('Twilio', waSettings);
        if (!st.configured) {
          return res.status(200).json({ success: false, configured: false, provider: 'Twilio', vars: st.vars, message: `Twilio (WhatsApp) is not ready: ${st.message}` });
        }
        const svc = await otpLib.twilioFetchService();
        if (!svc.ok) {
          return res.status(200).json({ success: false, configured: true, provider: 'Twilio', message: `Twilio check failed: ${svc.message}` });
        }
        let extra = ' Make sure WhatsApp is enabled on this Verify service.';
        if (payload.sendTest === true) {
          const phone = otpLib.normalizeIndianPhone(payload.identifier);
          if (!phone) {
            return res.status(200).json({ success: false, configured: true, provider: 'Twilio', message: 'Credentials OK, but the test number is not a valid +91 mobile number.' });
          }
          const sent = await otpLib.twilioSendVerification(phone, 'whatsapp');
          if (!sent.ok) {
            return res.status(200).json({ success: false, configured: true, provider: 'Twilio', message: `Credentials OK, but the WhatsApp test OTP failed: ${sent.message}` });
          }
          extra = ` A real WhatsApp test OTP was sent to ${otpLib.maskPhone(phone)} (status: ${sent.status}).`;
        }
        return res.status(200).json({ success: true, configured: true, provider: 'Twilio', message: `Twilio Verify connected — service "${svc.friendlyName}".${extra}` });
      }

      if (!isFast2Sms && waSelected !== 'Meta WhatsApp Cloud API') {
        return res.status(200).json({ success: false, configured: false, provider: waSelected, message: `${waSelected} is not supported for server-side WhatsApp OTP. Select Twilio, Fast2SMS or Meta WhatsApp Cloud API.` });
      }

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
          const otpId = (process.env.FAST2SMS_OTP_ID || process.env.FAST2SMS_WHATSAPP_MESSAGE_ID || process.env.WHATSAPP_TEMPLATE_NAME || '').trim();
          const templateStatus = otpId ? `Template / OTP ID configured: "${otpId}".` : 'Note: Configure FAST2SMS_OTP_ID in GoDaddy for Smart OTP delivery.';
          return res.status(200).json({
            success: true,
            configured: true,
            message: `Fast2SMS API Credential Handshake Verified! Active wallet balance: ₹${checkResult.wallet ?? '0'}. ${templateStatus} (Note: This is an admin connection test; live OTPs are sent through the customer login flow).`
          });
        } else {
          return res.status(200).json({
            success: false,
            configured: true,
            message: `Fast2SMS authentication failed: ${checkResult.message || 'Invalid API key'}. Check FAST2SMS_API_KEY or SMS_API_KEY in GoDaddy.`
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
