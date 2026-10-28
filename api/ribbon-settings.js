// Vercel Serverless Function: /api/ribbon-settings
// Manages shared offer ribbon settings for all storefront visitors

const fs = require('fs');
const path = require('path');

let memorySettings = null;

function getSettingsFilePath() {
  return path.join(process.cwd(), 'config', 'ribbon_settings.json');
}

function loadRibbonSettings() {
  if (memorySettings) return memorySettings;
  try {
    const filePath = getSettingsFilePath();
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf8');
      memorySettings = JSON.parse(content);
      return memorySettings;
    }
  } catch (err) {
    console.error('[API RIBBON] Error reading settings file:', err);
  }
  // Safe default fallback
  return {
    enabled: true,
    speedSeconds: 28,
    pauseOnHover: true,
    messages: [
      {
        id: "ribbon_1",
        tag: "FESTIVE SALE",
        text: "Get Flat 20% Off + Complimentary Orthopedic Pillow Pair with Code LORA20",
        link: "#the-collection"
      },
      {
        id: "ribbon_2",
        tag: "FACTORY DIRECT",
        text: "100% Natural Latex & Memory Foam Mattresses Direct from Factory to Your Bedroom",
        link: "#the-collection"
      },
      {
        id: "ribbon_3",
        tag: "15-YEAR WARRANTY",
        text: "Direct Factory Craftsmanship with up to 15 Years Warranty",
        link: "#the-collection"
      },
      {
        id: "ribbon_4",
        tag: "FREE DELIVERY",
        text: "Complimentary Flat Delivery & Unboxing Across India within 24–48 Hours",
        link: "#the-collection"
      }
    ],
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

  // GET: Return ribbon settings
  if (req.method === 'GET') {
    const settings = loadRibbonSettings();
    return res.status(200).json({ success: true, settings });
  }

  // POST: Update ribbon settings
  if (req.method === 'POST') {
    try {
      const payload = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
      const toSave = payload.settings || payload;

      if (!toSave || typeof toSave !== 'object') {
        return res.status(400).json({ success: false, message: 'Invalid payload' });
      }

      // Sanitize fields
      const cleanSettings = {
        enabled: typeof toSave.enabled === 'boolean' ? toSave.enabled : true,
        speedSeconds: Math.max(8, Math.min(120, Number(toSave.speedSeconds) || 28)),
        pauseOnHover: toSave.pauseOnHover !== false,
        messages: Array.isArray(toSave.messages) ? toSave.messages.map((m, idx) => ({
          id: m.id || `ribbon_${idx + 1}`,
          tag: String(m.tag || '').trim().slice(0, 30),
          text: String(m.text || '').trim().slice(0, 180),
          link: String(m.link || '').trim()
        })).filter(m => m.text.length > 0) : [],
        updatedAt: new Date().toISOString()
      };

      memorySettings = cleanSettings;

      let filePersisted = false;
      try {
        const filePath = getSettingsFilePath();
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(filePath, JSON.stringify(cleanSettings, null, 2), 'utf8');
        filePersisted = true;
      } catch (fsErr) {
        console.warn('[API RIBBON] Could not persist to disk (serverless ephemeral environment):', fsErr.message);
      }

      return res.status(200).json({
        success: true,
        persisted: filePersisted,
        message: filePersisted
          ? 'Offer ribbon settings saved and published permanently to storefront.'
          : 'Offer ribbon settings saved to server memory.',
        settings: cleanSettings
      });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  return res.status(405).json({ success: false, message: 'Method Not Allowed' });
};
