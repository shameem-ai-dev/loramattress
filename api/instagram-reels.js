// Serverless Function: /api/instagram-reels
// Serves and saves Instagram Reels configuration (autoplay, title, reels list)

const fs = require('fs');
const path = require('path');

const CONFIG_DIR = path.join(process.cwd(), 'config');
const DATA_DIR = process.env.LORA_DATA_DIR || path.join(require('os').homedir(), 'lora-data');

function getReelsFilePath() {
  const p = path.join(DATA_DIR, 'instagram_reels.json');
  if (fs.existsSync(p)) return p;
  return path.join(CONFIG_DIR, 'instagram_reels.json');
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const filePath = getReelsFilePath();

  if (req.method === 'GET') {
    let data = { enabled: true, autoplay: true, title: 'Watch LORA', subtitle: '', profileUrl: '', reels: [] };
    try {
      if (fs.existsSync(filePath)) {
        data = Object.assign(data, JSON.parse(fs.readFileSync(filePath, 'utf8')));
      }
    } catch (e) {}
    if (typeof data.autoplay !== 'boolean') data.autoplay = true;
    res.setHeader('Cache-Control', 'no-cache');
    return res.status(200).json({ success: true, settings: data });
  }

  if (req.method === 'POST') {
    try {
      const payload = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
      const s = payload.settings || payload;
      const igRe = /^https:\/\/(www\.)?instagram\.com\/(p|reel|reels|tv)\/[A-Za-z0-9_-]+/i;
      const localRe = /^\/assets\/uploads\/[A-Za-z0-9_\/.-]+$/;

      const clean = {
        enabled: s.enabled !== false,
        autoplay: s.autoplay !== false,
        title: String(s.title || 'Watch LORA').slice(0, 80),
        subtitle: String(s.subtitle || '').slice(0, 200),
        profileUrl: /^https:\/\/(www\.)?instagram\.com\//i.test(s.profileUrl || '') ? String(s.profileUrl) : '',
        reels: (Array.isArray(s.reels) ? s.reels : []).slice(0, 30).map((r, i) => ({
          id: String(r.id || `reel_${Date.now()}_${i}`).slice(0, 60),
          instagramUrl: igRe.test(r.instagramUrl || '') ? String(r.instagramUrl).split('?')[0] : '',
          videoUrl: localRe.test(r.videoUrl || '') ? String(r.videoUrl) : (r.videoUrl || ''),
          posterUrl: localRe.test(r.posterUrl || '') ? String(r.posterUrl) : (r.posterUrl || ''),
          caption: String(r.caption || '').slice(0, 140),
          active: r.active !== false
        })).filter(r => r.instagramUrl || r.videoUrl),
        updatedAt: new Date().toISOString()
      };

      try {
        if (!fs.existsSync(CONFIG_DIR)) fs.mkdirSync(CONFIG_DIR, { recursive: true });
        fs.writeFileSync(path.join(CONFIG_DIR, 'instagram_reels.json'), JSON.stringify(clean, null, 2), 'utf8');
      } catch (e) {}

      try {
        if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
        fs.writeFileSync(path.join(DATA_DIR, 'instagram_reels.json'), JSON.stringify(clean, null, 2), 'utf8');
      } catch (e) {}

      return res.status(200).json({ success: true, settings: clean });
    } catch (err) {
      return res.status(400).json({ success: false, message: err.message });
    }
  }

  return res.status(405).json({ success: false, message: 'Method not allowed' });
};
