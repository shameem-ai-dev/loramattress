// Vercel Serverless Function: /api/upload
// Handles image uploads for LORA Merchant Studio with support for local persistent storage and cloud storage providers

const fs = require('fs');
const path = require('path');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  try {
    const payload = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const rawImage = payload.image || payload.data;
    const modelKey = (payload.model || 'general').replace(/[^a-zA-Z0-9_-]/g, '');
    const slotName = (payload.slot || 'slot').replace(/[^a-zA-Z0-9_-]/g, '');

    if (!rawImage) {
      return res.status(400).json({ success: false, message: 'No image data provided' });
    }

    let buffer;
    let ext = '.jpg';
    let mimeType = 'image/jpeg';

    if (rawImage.startsWith('data:')) {
      const matches = rawImage.match(/^data:image\/([a-zA-Z0-9+]+);base64,(.+)$/);
      if (matches) {
        mimeType = `image/${matches[1]}`;
        ext = matches[1] === 'jpeg' ? '.jpg' : `.${matches[1]}`;
        buffer = Buffer.from(matches[2], 'base64');
      } else {
        return res.status(400).json({ success: false, message: 'Invalid base64 image data' });
      }
    } else {
      buffer = Buffer.from(rawImage, 'base64');
    }

    const safeFileName = `prod_${modelKey}_${slotName}_${Date.now()}${ext}`;

    // 1. Check if external Vercel Blob storage is configured
    if (process.env.BLOB_READ_WRITE_TOKEN) {
      try {
        const { put } = require('@vercel/blob');
        const blob = await put(`lora-images/${safeFileName}`, buffer, {
          access: 'public',
          contentType: mimeType
        });
        return res.status(200).json({
          success: true,
          url: blob.url,
          filename: safeFileName,
          storageType: 'vercel_blob',
          message: 'Image published to Vercel Blob storage'
        });
      } catch (blobErr) {
        console.error('[UPLOAD API] Vercel Blob upload failed:', blobErr);
      }
    }

    // 2. Check if local filesystem is writable (Local Server / Dev / Node container)
    try {
      const uploadsDir = path.join(process.cwd(), 'assets', 'uploads');
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }
      const targetFilePath = path.join(uploadsDir, safeFileName);
      fs.writeFileSync(targetFilePath, buffer);

      const publicUrl = `/assets/uploads/${safeFileName}`;
      return res.status(200).json({
        success: true,
        url: publicUrl,
        filename: safeFileName,
        storageType: 'local_disk',
        size: buffer.length,
        message: 'Image saved to local persistent storage'
      });
    } catch (fsErr) {
      // Serverless lambda read-only filesystem on Vercel without cloud token
      console.warn('[UPLOAD API] Filesystem write failed on lambda:', fsErr.message);
    }

    // 3. Fallback: If on read-only serverless environment and no cloud token configured
    return res.status(200).json({
      success: true,
      url: rawImage,
      storageType: 'base64_memory',
      warning: 'Serverless persistent disk is read-only. For permanent cross-device hosting on Vercel, connect Vercel Blob (BLOB_READ_WRITE_TOKEN) or commit local assets/uploads to GitHub.',
      message: 'Image prepared as data URL'
    });

  } catch (err) {
    return res.status(500).json({ success: false, message: 'Upload processing failed: ' + err.message });
  }
};
