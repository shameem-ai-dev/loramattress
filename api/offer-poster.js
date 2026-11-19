// Vercel Serverless Function: /api/offer-poster
// Manages hero sticky offer poster and countdown timer settings for storefront

const fs = require('fs');
const path = require('path');

let memorySettings = null;

function getSettingsFilePath() {
  return path.join(process.cwd(), 'config', 'offer_poster.json');
}

function loadOfferPosterSettings() {
  if (memorySettings) return memorySettings;
  try {
    const filePath = getSettingsFilePath();
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf8');
      memorySettings = JSON.parse(content);
      return memorySettings;
    }
  } catch (err) {
    console.error('[API OFFER POSTER] Error reading settings file:', err);
  }
  // Safe default fallback
  return {
    enabled: true,
    posterImage: "assets/hero-bedroom-luxury.jpg",
    badge: "LIMITED TIME FESTIVE RELEASE",
    headline: "Flat 20% Off + Complimentary Luxury Sleep Kit",
    subtext: "Shipped 100% full-size and flat across India with direct factory warranty. Use coupon code at checkout.",
    couponCode: "LORA20",
    buttonText: "Explore Festive Offers →",
    buttonLink: "#the-collection",
    stickyEnabled: true,
    timerEnabled: true,
    timerEndTime: new Date(Date.now() + 7 * 864e5).toISOString(),
    timerLabel: "Limited Deal Ends In:",
    updatedAt: new Date().toISOString()
  };
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // GET: Return offer poster settings
  if (req.method === 'GET') {
    const settings = loadOfferPosterSettings();
    return res.status(200).json({ success: true, settings });
  }

  // POST: Update offer poster settings (Admin Auth Required)
  if (req.method === 'POST') {
    if (!require('./auth.js').verifyAdminAuth(req)) {
      return res.status(401).json({ success: false, message: 'Unauthorized: admin login required.' });
    }
    try {
      const payload = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
      const toSave = payload.settings || payload;

      if (!toSave || typeof toSave !== 'object') {
        return res.status(400).json({ success: false, message: 'Invalid payload' });
      }

      // Sanitize fields
      const cleanSettings = {
        enabled: typeof toSave.enabled === 'boolean' ? toSave.enabled : true,
        posterImage: String(toSave.posterImage || 'assets/hero-bedroom-luxury.jpg').trim().slice(0, 500),
        badge: String(toSave.badge || 'LIMITED TIME OFFER').trim().slice(0, 80),
        headline: String(toSave.headline || 'Special Festive Savings').trim().slice(0, 160),
        subtext: String(toSave.subtext || '').trim().slice(0, 300),
        couponCode: String(toSave.couponCode || 'LORA20').trim().toUpperCase().slice(0, 30),
        buttonText: String(toSave.buttonText || 'Claim Offer →').trim().slice(0, 60),
        buttonLink: String(toSave.buttonLink || '#the-collection').trim().slice(0, 300),
        stickyEnabled: toSave.stickyEnabled !== false,
        timerEnabled: typeof toSave.timerEnabled === 'boolean' ? toSave.timerEnabled : true,
        timerEndTime: String(toSave.timerEndTime || '').trim().slice(0, 50),
        timerLabel: String(toSave.timerLabel || 'Limited Deal Ends In:').trim().slice(0, 80),
        updatedAt: new Date().toISOString()
      };

      memorySettings = cleanSettings;

      try {
        const filePath = getSettingsFilePath();
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(filePath, JSON.stringify(cleanSettings, null, 2), 'utf8');
      } catch (fErr) {
        console.warn('[API OFFER POSTER] Filesystem write notice:', fErr.message);
      }

      return res.status(200).json({
        success: true,
        message: 'Offer poster settings updated successfully',
        settings: cleanSettings
      });
    } catch (err) {
      console.error('[API OFFER POSTER] Error updating settings:', err);
      return res.status(500).json({ success: false, message: 'Internal server error: ' + err.message });
    }
  }

  return res.status(405).json({ success: false, message: 'Method not allowed' });
};
