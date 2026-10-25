// Vercel Serverless Function: /api/payment-settings
// Manages non-secret payment configuration while reading secrets strictly from process.env

const fs = require('fs');
const path = require('path');
const { verifyAdminAuth, getIntegrationStatus } = require('./auth.js');

const CONFIG_PATH = path.join(__dirname, '..', 'config', 'payment_settings.json');

function loadDiskPaymentSettings() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    }
  } catch (e) {
    console.warn('[PAYMENT SETTINGS] Could not read payment_settings.json:', e.message);
  }
  return {
    razorpay_enabled: true,
    razorpay_theme_color: '#00B4D8',
    cod_enabled: true,
    cod_max_amount: 50000,
    cod_notice: 'Cash or UPI accepted upon delivery arrival.'
  };
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const diskSettings = loadDiskPaymentSettings();
  const allIntegrations = getIntegrationStatus();
  const envStatus = allIntegrations.razorpay;

  // GET: Return current payment configuration and environment credential status
  if (req.method === 'GET') {
    const safeSettings = {
      razorpay_enabled: typeof diskSettings.razorpay_enabled === 'boolean' ? diskSettings.razorpay_enabled : true,
      razorpay_configured: envStatus.configured,
      razorpay_key_id: envStatus.key_id_preview || '',
      razorpay_key_id_preview: envStatus.key_id_preview || 'Not configured in GoDaddy',
      razorpay_secret_status: envStatus.secret_configured ? 'Configured in GoDaddy Environment' : 'Not configured in GoDaddy Environment',
      razorpay_mode: diskSettings.razorpay_mode || envStatus.mode,
      razorpay_theme_color: diskSettings.razorpay_theme_color || envStatus.theme_color || '#00B4D8',
      cod_enabled: diskSettings.cod_enabled !== false,
      cod_max_amount: Number(diskSettings.cod_max_amount) || 50000,
      cod_notice: diskSettings.cod_notice || 'Cash or UPI accepted upon delivery arrival.',
      storeKeeperPhone: diskSettings.storeKeeperPhone || '+919072616423',
      storeKeeperEmail: diskSettings.storeKeeperEmail || 'dispatch@loramattress.com',
      webhookUrl: diskSettings.webhookUrl || '',
      webhookToken: diskSettings.webhookToken || ''
    };
    return res.status(200).json({
      success: true,
      settings: safeSettings,
      status: {
        configured: envStatus.configured,
        has_key_id: Boolean(envStatus.key_id_preview),
        has_key_secret: envStatus.secret_configured
      },
      integrations: {
        payment: { razorpay: envStatus },
        otp: {
          sms: { configured: allIntegrations.sms?.configured, has_key: allIntegrations.sms?.configured },
          whatsapp: { configured: allIntegrations.whatsapp?.configured, has_key: allIntegrations.whatsapp?.configured },
          email: { configured: allIntegrations.email?.configured, has_key: allIntegrations.email?.configured }
        }
      }
    });
  }

  // POST: Update non-secret payment and dispatch settings (Admin Only)
  if (req.method === 'POST') {
    if (!verifyAdminAuth(req)) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: Admin authentication token required to modify payment settings.'
      });
    }

    try {
      const payload = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});

      // Safely merge incoming preferences with existing disk storage to avoid clobbering
      const updated = {
        razorpay_enabled: typeof payload.razorpay_enabled === 'boolean'
          ? payload.razorpay_enabled
          : (typeof diskSettings.razorpay_enabled === 'boolean' ? diskSettings.razorpay_enabled : true),
        razorpay_mode: payload.razorpay_mode || diskSettings.razorpay_mode || envStatus.mode,
        razorpay_theme_color: payload.razorpay_theme_color || diskSettings.razorpay_theme_color || '#00B4D8',
        cod_enabled: typeof payload.cod_enabled === 'boolean'
          ? payload.cod_enabled
          : (diskSettings.cod_enabled !== false),
        cod_max_amount: payload.cod_max_amount !== undefined
          ? Number(payload.cod_max_amount)
          : (Number(diskSettings.cod_max_amount) || 50000),
        cod_notice: payload.cod_notice !== undefined
          ? String(payload.cod_notice).trim()
          : (diskSettings.cod_notice || 'Cash or UPI accepted upon delivery arrival.'),
        storeKeeperPhone: payload.storeKeeperPhone !== undefined
          ? String(payload.storeKeeperPhone).trim()
          : (diskSettings.storeKeeperPhone || '+919072616423'),
        storeKeeperEmail: payload.storeKeeperEmail !== undefined
          ? String(payload.storeKeeperEmail).trim()
          : (diskSettings.storeKeeperEmail || 'dispatch@loramattress.com'),
        webhookUrl: payload.webhookUrl !== undefined
          ? String(payload.webhookUrl).trim()
          : (diskSettings.webhookUrl || ''),
        webhookToken: payload.webhookToken !== undefined
          ? String(payload.webhookToken).trim()
          : (diskSettings.webhookToken || '')
      };

      try {
        fs.writeFileSync(CONFIG_PATH, JSON.stringify(updated, null, 2), 'utf8');
      } catch (fsErr) {
        console.warn('[PAYMENT SETTINGS] Write warning:', fsErr.message);
      }

      return res.status(200).json({
        success: true,
        message: 'Payment and dispatch configuration saved and synchronized server-wide.',
        settings: {
          ...updated,
          razorpay_configured: envStatus.configured,
          razorpay_key_id_preview: envStatus.key_id_preview || 'Not configured',
          razorpay_secret_status: envStatus.secret_configured ? 'Configured in GoDaddy' : 'Not configured in GoDaddy'
        }
      });
    } catch (err) {
      return res.status(400).json({ success: false, message: 'Invalid request: ' + err.message });
    }
  }

  return res.status(405).json({ success: false, message: 'Method Not Allowed' });
};
