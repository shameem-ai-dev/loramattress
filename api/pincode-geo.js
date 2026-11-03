// LORA — Indian pincode → coordinates (for the "find a showroom near me" 40 km search)
//
// Lookup chain (results cached on disk forever; misses cached 1 day):
//   1. OpenStreetMap Nominatim postcode search
//   2. India Post API (post office + district + state) → Nominatim place search
// Nominatim policy: ≤ 1 request/second with an identifying User-Agent — enforced by a serial queue.
// The cache file lives in DATA_DIR, so it is also backed up to cloud storage.

const fs = require('fs');
const path = require('path');
const https = require('https');

const UA = 'LORA-Mattress-StoreLocator/1.0 (+https://loramattress.com; support@loramattress.com)';
const MISS_TTL = 24 * 3600 * 1000;

function getJson(url, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': UA, Accept: 'application/json', 'Accept-Language': 'en' }, timeout: timeoutMs }, res => {
      let b = '';
      res.on('data', d => { b += d; });
      res.on('end', () => {
        if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`));
        try { resolve(JSON.parse(b)); } catch (e) { reject(e); }
      });
    });
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', reject);
  });
}

function create({ dataDir }) {
  const cacheFile = path.join(dataDir, 'pincode_geo_cache.json');
  let cache = {};
  try { cache = JSON.parse(fs.readFileSync(cacheFile, 'utf8')); } catch (e) {}
  let saveTimer = null;
  const save = () => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => { try { fs.writeFileSync(cacheFile, JSON.stringify(cache)); } catch (e) {} }, 500);
  };

  // Serial queue → at most one Nominatim call per 1.1 s across the whole server.
  let chain = Promise.resolve();
  let last = 0;
  const nominatim = url => {
    const run = chain.then(async () => {
      const wait = Math.max(0, last + 1100 - Date.now());
      if (wait) await new Promise(r => setTimeout(r, wait));
      last = Date.now();
      return getJson(url);
    });
    chain = run.catch(() => {});
    return run;
  };

  const inflight = new Map();

  async function resolvePin(pin) {
    let hit = await nominatim(`https://nominatim.openstreetmap.org/search?postalcode=${pin}&country=India&format=json&limit=1`).catch(() => []);
    if (Array.isArray(hit) && hit[0]) {
      return { lat: +(+hit[0].lat).toFixed(5), lng: +(+hit[0].lon).toFixed(5), place: hit[0].display_name, source: 'osm_postcode' };
    }
    const post = await getJson(`https://api.postalpincode.in/pincode/${pin}`).catch(() => null);
    const po = post && post[0] && post[0].Status === 'Success' && post[0].PostOffice && post[0].PostOffice[0];
    if (!po) return null;
    for (const q of [`${po.Name}, ${po.District}, ${po.State}, India`, `${po.District}, ${po.State}, India`]) {
      hit = await nominatim(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&countrycodes=in&format=json&limit=1`).catch(() => []);
      if (Array.isArray(hit) && hit[0]) {
        return { lat: +(+hit[0].lat).toFixed(5), lng: +(+hit[0].lon).toFixed(5), place: `${po.Name}, ${po.District}, ${po.State}`, source: 'indiapost_osm' };
      }
    }
    return null;
  }

  // Returns { lat, lng, place, source } or null.
  async function lookup(pin) {
    pin = String(pin || '').trim();
    if (!/^[1-9]\d{5}$/.test(pin)) return null;
    const c = cache[pin];
    if (c && c.lat != null) return c;
    if (c && c.miss && Date.now() - c.miss < MISS_TTL) return null;
    if (!inflight.has(pin)) {
      inflight.set(pin, resolvePin(pin).then(r => {
        cache[pin] = r || { miss: Date.now() };
        save();
        return r;
      }).catch(() => null).finally(() => inflight.delete(pin)));
    }
    return inflight.get(pin);
  }

  return { lookup };
}

module.exports = { create };
