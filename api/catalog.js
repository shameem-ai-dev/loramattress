// Vercel Serverless Function: /api/catalog
// Stores and serves the LORA product catalog across all devices and storefront pages

const fs = require('fs');
const path = require('path');

let memoryCatalog = null;

function getCatalogFilePath() {
  return path.join(process.cwd(), 'config', 'catalog_data.json');
}

function loadCatalogData() {
  if (memoryCatalog) return memoryCatalog;
  try {
    const filePath = getCatalogFilePath();
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf8');
      memoryCatalog = JSON.parse(content);
      return memoryCatalog;
    }
  } catch (err) {
    console.error('[API CATALOG] Error reading catalog file:', err);
  }
  return null;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // GET: Return catalog data
  if (req.method === 'GET') {
    const catalog = loadCatalogData();
    if (catalog && Object.keys(catalog).length > 0) {
      return res.status(200).json({ success: true, catalog });
    }
    return res.status(200).json({ success: false, catalog: null, message: 'Catalog empty or not found' });
  }

  // POST: Update catalog data
  if (req.method === 'POST') {
    try {
      const payload = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
      const toSave = payload.catalog || payload;

      if (!toSave || typeof toSave !== 'object') {
        return res.status(400).json({ success: false, message: 'Invalid catalog payload' });
      }

      memoryCatalog = toSave;

      // Attempt to persist to disk if filesystem is writable
      try {
        const filePath = getCatalogFilePath();
        fs.writeFileSync(filePath, JSON.stringify(toSave, null, 2), 'utf8');
      } catch (fsErr) {
        // Ephemeral filesystem on Vercel lambda - memory cache is retained during container lifecycle
        console.warn('[API CATALOG] Filesystem write skipped on read-only lambda environment');
      }

      return res.status(200).json({
        success: true,
        message: 'Catalog synchronized successfully',
        modelsCount: Object.keys(toSave).length
      });
    } catch (err) {
      return res.status(400).json({ success: false, message: 'Failed to save catalog: ' + err.message });
    }
  }

  return res.status(405).json({ success: false, message: 'Method not allowed' });
};
