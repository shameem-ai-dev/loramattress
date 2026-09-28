// Vercel Serverless Function: /api/payment-settings
const fs = require('fs');
const path = require('path');

// In-memory cache for serverless container lifecycle
let memorySettings = {
  razorpay_key_id: process.env.RAZORPAY_KEY_ID || '',
  razorpay_key_secret: process.env.RAZORPAY_KEY_SECRET || '',
  razorpay_mode: process.env.RAZORPAY_MODE || (process.env.RAZORPAY_KEY_ID?.startsWith('rzp_live_') ? 'live' : 'test'),
  razorpay_theme_color: '#00B4D8'
};

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // GET: Return current settings (masking secret)
  if (req.method === 'GET') {
    const safeSettings = {
      razorpay_key_id: memorySettings.razorpay_key_id || process.env.RAZORPAY_KEY_ID || '',
      razorpay_key_secret: (memorySettings.razorpay_key_secret || process.env.RAZORPAY_KEY_SECRET) ? '••••••••' : '',
      razorpay_mode: memorySettings.razorpay_mode || 'test',
      razorpay_theme_color: memorySettings.razorpay_theme_color || '#00B4D8'
    };
    return res.status(200).json({ success: true, settings: safeSettings });
  }

  // POST: Update settings
  if (req.method === 'POST') {
    try {
      const payload = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
      const newKeyId = (payload.razorpay_key_id || '').trim();
      const newSecret = (payload.razorpay_key_secret || '').trim();
      const newMode = payload.razorpay_mode || (newKeyId.startsWith('rzp_live_') ? 'live' : 'test');
      const newTheme = payload.razorpay_theme_color || '#00B4D8';

      if (newKeyId) memorySettings.razorpay_key_id = newKeyId;
      if (newSecret && newSecret !== '••••••••') memorySettings.razorpay_key_secret = newSecret;
      memorySettings.razorpay_mode = newMode;
      memorySettings.razorpay_theme_color = newTheme;

      return res.status(200).json({
        success: true,
        message: 'Payment gateway configuration saved successfully.',
        settings: {
          razorpay_key_id: memorySettings.razorpay_key_id,
          razorpay_key_secret: memorySettings.razorpay_key_secret ? '••••••••' : '',
          razorpay_mode: memorySettings.razorpay_mode,
          razorpay_theme_color: memorySettings.razorpay_theme_color
        }
      });
    } catch (err) {
      return res.status(400).json({ success: false, message: 'Invalid request: ' + err.message });
    }
  }

  return res.status(405).json({ success: false, message: 'Method Not Allowed' });
};
