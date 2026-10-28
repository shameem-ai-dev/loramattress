// Vercel Serverless Function: /api/catalog
// Stores and serves the LORA product catalog across all devices and storefront pages
// Persistence order: Vercel Blob (permanent, if BLOB_READ_WRITE_TOKEN set) -> local disk (dev) -> bundled file.

const fs = require('fs');
const path = require('path');

const BLOB_KEY = 'lora-data/catalog.json';
let memoryCatalog = null;
let memoryLoadedAt = 0;
const MEMORY_TTL_MS = 30 * 1000; // re-check Blob regularly so all instances stay in sync

function getCatalogFilePath() {
  return path.join(process.cwd(), 'config', 'catalog_data.json');
}

function hasBlob() {
  return !!process.env.BLOB_READ_WRITE_TOKEN;
}

async function loadFromBlob() {
  const { list } = require('@vercel/blob');
  const { blobs } = await list({ prefix: BLOB_KEY, limit: 10 });
  const match = blobs.find(b => b.pathname === BLOB_KEY);
  if (!match) return null;
  const resp = await fetch(`${match.url}?t=${Date.now()}`, { cache: 'no-store' });
  if (!resp.ok) return null;
  return await resp.json();
}

async function saveToBlob(data) {
  const { put } = require('@vercel/blob');
  await put(BLOB_KEY, JSON.stringify(data), {
    access: 'public',
    contentType: 'application/json',
    addRandomSuffix: false,
    allowOverwrite: true,
    cacheControlMaxAge: 0
  });
}

function loadFromDisk() {
  try {
    const filePath = getCatalogFilePath();
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }
  } catch (err) {
    console.error('[API CATALOG] Error reading catalog file:', err);
  }
  return null;
}

async function loadCatalogData() {
  if (memoryCatalog && Date.now() - memoryLoadedAt < MEMORY_TTL_MS) return memoryCatalog;
  let data = null;
  if (hasBlob()) {
    try {
      data = await loadFromBlob();
    } catch (err) {
      console.error('[API CATALOG] Blob read failed:', err.message);
    }
  }
  if (!data) data = loadFromDisk();
  if (data) {
    memoryCatalog = data;
    memoryLoadedAt = Date.now();
  }
  return data || memoryCatalog;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // GET: Return catalog data
  if (req.method === 'GET') {
    const catalog = await loadCatalogData();
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

      let persisted = false;

      if (hasBlob()) {
        try {
          await saveToBlob(toSave);
          persisted = true;
        } catch (blobErr) {
          console.error('[API CATALOG] Blob write failed:', blobErr.message);
        }
      }

      if (!persisted) {
        try {
          fs.writeFileSync(getCatalogFilePath(), JSON.stringify(toSave, null, 2), 'utf8');
          persisted = true;
        } catch (fsErr) {
          console.warn('[API CATALOG] Filesystem write failed (read-only serverless environment)');
        }
      }

      if (!persisted) {
        return res.status(500).json({
          success: false,
          message: 'Catalog could not be saved permanently. Connect a Vercel Blob store (BLOB_READ_WRITE_TOKEN) and redeploy.'
        });
      }

      memoryCatalog = toSave;
      memoryLoadedAt = Date.now();

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
