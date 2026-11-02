// LORA — Cloud sync orchestration for the Node server (preview/server.js)
// - Restores data JSON files + knows where uploads live on startup
// - Mirrors changed data files to the bucket (mtime polling, robust on any host)
// - Mirrors new uploads (images/videos) immediately after they are written
// - Lazily re-downloads any upload that vanished from local disk after a container recycle
// - Enforces the total storage cap (see storage-quota.js) for every upload path
// - Issues presigned URLs so the admin browser can upload large videos straight to the bucket

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const cloud = require('./cloud-store.js');
const { createQuota, formatBytes } = require('./storage-quota.js');

// Runtime-written files inside the app's config/ folder (orders, leads, settings).
// Static repo files (lumi_kb.json, settings_data.json, ...) are intentionally NOT synced,
// so code deploys can still update them.
const CONFIG_RUNTIME_FILES = [
  'orders_data.json',
  'store_leads.json',
  'store_leads_trash.json',
  'payment_settings.json',
  'otp_settings.json',
  'marketing_settings.json',
  'instagram_reels.json',
  'ribbon_settings.json',
  'catalog_data.json',
  'studios_data.json'
];

const MIME = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp',
  '.gif': 'image/gif', '.avif': 'image/avif', '.svg': 'image/svg+xml',
  '.mp4': 'video/mp4', '.m4v': 'video/mp4', '.webm': 'video/webm', '.mov': 'video/quicktime',
  '.json': 'application/json'
};
const mimeOf = p => MIME[path.extname(p).toLowerCase()] || 'application/octet-stream';

const VIDEO_TYPES = { 'video/mp4': '.mp4', 'video/webm': '.webm', 'video/quicktime': '.mov', 'video/x-m4v': '.m4v' };
const DIRECT_TTL_MS = 12 * 60 * 60 * 1000; // presigned upload sessions (covers multi-GB uploads on slow links)
const SAFE_UPLOAD_REL = /^[A-Za-z0-9_-]+(\/[A-Za-z0-9_-]+)*\.[A-Za-z0-9]+$/;
const DIRECT_REL = /^videos\/reel_\d+_[0-9a-f]{8}\.(mp4|webm|mov|m4v)$/;

class QuotaError extends Error {
  constructor(message, info) { super(message); this.code = 'QUOTA_EXCEEDED'; this.status = 507; this.info = info || {}; }
}

function create({ dataDir, configDir, uploadsDir }) {
  const tracked = new Map(); // absPath -> { key, mtime }
  const inflight = new Map(); // upload key -> Promise (lazy downloads)
  const direct = new Map();   // reservation id -> { rel, contentType, size, s3UploadId }
  const quota = createQuota();
  let pollTimer = null;
  let reconcileTimer = null;
  let lastReconcile = null;

  function track(absPath, key) {
    let mtime = 0;
    try { mtime = fs.statSync(absPath).mtimeMs; } catch (e) {}
    tracked.set(absPath, { key, mtime });
  }

  function trackedFiles() {
    const out = [];
    try {
      for (const f of fs.readdirSync(dataDir)) {
        if (f.endsWith('.json')) out.push([path.join(dataDir, f), `data/${f}`]);
      }
    } catch (e) {}
    for (const f of CONFIG_RUNTIME_FILES) out.push([path.join(configDir, f), `config/${f}`]);
    return out;
  }

  function walk(dir, base = '') {
    let files = [];
    try {
      for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
        const rel = base ? `${base}/${ent.name}` : ent.name;
        if (ent.isDirectory()) files = files.concat(walk(path.join(dir, ent.name), rel));
        else if (!ent.name.endsWith('.part') && !ent.name.startsWith('.')) files.push(rel);
      }
    } catch (e) {}
    return files;
  }

  const fileSize = p => { try { return fs.statSync(p).size; } catch (e) { return null; } };

  // Ledger from local disk (used when cloud storage is not configured, so the cap still protects the disk).
  function loadLocalLedger() {
    const entries = [];
    for (const rel of walk(uploadsDir)) {
      const s = fileSize(path.join(uploadsDir, rel));
      if (s != null) entries.push([`uploads/${rel}`, s]);
    }
    for (const [abs, key] of trackedFiles()) {
      const s = fileSize(abs);
      if (s != null) entries.push([key, s]);
    }
    quota.load(entries, 0);
  }

  // ONE listing of the whole bucket (1 request per 1000 objects) gives every key + size.
  async function listBucket() {
    const base = cloud.fullKey('');
    const objects = await cloud.listRaw('');
    const ours = [];
    let other = 0;
    for (const o of objects) {
      if (base && !o.key.startsWith(base)) { other += o.size; continue; }
      ours.push([o.key.slice(base.length), o.size]);
    }
    return { ours, other };
  }

  async function reconcile() {
    if (!cloud.isEnabled()) return;
    const { ours, other } = await listBucket();
    quota.load(ours, other);
    lastReconcile = new Date().toISOString();
  }

  // 1. Startup: pull data from cloud, push anything local the cloud doesn't have yet.
  async function bootstrap() {
    fs.mkdirSync(uploadsDir, { recursive: true });
    if (!cloud.isEnabled()) {
      console.warn('[CLOUD] Permanent storage NOT configured (S3_ENDPOINT / S3_BUCKET / S3_ACCESS_KEY_ID / S3_SECRET_ACCESS_KEY). ' +
        'Uploaded photos, videos, orders and settings will be lost whenever the hosting container restarts.');
      loadLocalLedger();
      startTimers();
      return { enabled: false };
    }
    const started = Date.now();
    fs.mkdirSync(dataDir, { recursive: true });

    const { ours, other } = await listBucket();
    const remote = new Map(ours);

    let restored = 0;
    for (const [key] of ours) {
      if (key.startsWith('data/')) {
        const name = key.slice('data/'.length);
        if (!name || name.includes('/') || !name.endsWith('.json')) continue;
        if (await cloud.getToFile(key, path.join(dataDir, name))) restored++;
      } else if (key.startsWith('config/')) {
        const name = key.slice('config/'.length);
        if (!CONFIG_RUNTIME_FILES.includes(name)) continue;
        if (await cloud.getToFile(key, path.join(configDir, name))) restored++;
      }
    }

    // First-time enable (or files created before restore): push local files missing in cloud.
    let pushed = 0;
    for (const [abs, key] of trackedFiles()) {
      const s = fileSize(abs);
      if (!remote.has(key) && s != null) {
        try { await cloud.putFile(key, abs, 'application/json'); remote.set(key, s); pushed++; } catch (e) { console.error('[CLOUD]', e.message); }
      }
    }
    quota.load([...remote], other);
    for (const rel of walk(uploadsDir)) {
      const key = `uploads/${rel}`;
      if (remote.has(key)) continue;
      const s = fileSize(path.join(uploadsDir, rel));
      const r = quota.reserve(s, { label: key });
      if (!r.ok) { console.error(`[CLOUD] Not backing up ${key}: storage limit reached`); continue; }
      try { await cloud.putFile(key, path.join(uploadsDir, rel), mimeOf(rel)); quota.commit(r.id, key, s); pushed++; }
      catch (e) { quota.release(r.id); console.error('[CLOUD]', e.message); }
    }
    lastReconcile = new Date().toISOString();

    for (const [abs, key] of trackedFiles()) track(abs, key);
    startTimers();
    const u = quota.summary();
    console.log(`[CLOUD] Permanent storage active (${cloud.status().provider}, bucket "${cloud.status().bucket}"). ` +
      `Restored ${restored} data file(s), backed up ${pushed} local file(s), ${u.fileCount} upload(s) in cloud. ` +
      `Usage ${formatBytes(u.usedBytes)} / ${formatBytes(u.limitBytes)} — ${Date.now() - started} ms`);
    return { enabled: true, restored, pushed };
  }

  // 2. Mirror data-file changes (orders, catalog, settings ...) every few seconds.
  async function syncChanged() {
    for (const [abs, key] of trackedFiles()) {
      if (!tracked.has(abs)) tracked.set(abs, { key, mtime: 0 }); // appeared after startup → back it up now
      const entry = tracked.get(abs);
      let st;
      try { st = fs.statSync(abs); } catch (e) { continue; }
      if (st.mtimeMs === entry.mtime) continue;
      if (!quota.canStoreData(key, st.size)) {
        // Never exceed the hard cap — keep retrying; frees up as soon as admin deletes uploads.
        if (entry.warned !== st.mtimeMs) console.error(`[CLOUD] CRITICAL: backup of ${key} skipped — storage limit reached. Delete uploads in Admin → Storage.`);
        entry.warned = st.mtimeMs;
        continue;
      }
      entry.mtime = st.mtimeMs;
      try {
        await cloud.putFile(key, abs, 'application/json');
        quota.set(key, st.size);
      } catch (e) {
        entry.mtime = 0; // retry on next tick
        console.error('[CLOUD] Data backup failed:', e.message);
      }
    }
  }

  function startTimers() {
    if (cloud.isEnabled() && !pollTimer) {
      let running = false;
      pollTimer = setInterval(async () => {
        if (running) return;
        running = true;
        try { await syncChanged(); } finally { running = false; }
      }, 4000);
      if (pollTimer.unref) pollTimer.unref();

      // Re-count the bucket occasionally (catches changes made outside this server). Default every 6 h.
      const hours = Number(process.env.STORAGE_RECONCILE_HOURS || 6);
      if (hours > 0) {
        reconcileTimer = setInterval(() => reconcile().catch(e => console.error('[CLOUD] Reconcile failed:', e.message)), hours * 3600 * 1000);
        if (reconcileTimer.unref) reconcileTimer.unref();
      }
    }
    // Expire abandoned presigned upload sessions (releases their reserved space).
    const sweep = setInterval(() => quota.sweepExpired(), 10 * 60 * 1000);
    if (sweep.unref) sweep.unref();
  }

  // 3. Quota-checked uploads through the server.
  // Book space before writing anything. Throws QuotaError when it does not fit.
  function reserveUpload(bytes, label) {
    const r = quota.reserve(bytes, { label });
    if (!r.ok) throw new QuotaError(quotaMessage(r.requestedBytes, r.freeBytes), r);
    return r.id;
  }
  function releaseUpload(id) { if (id) quota.release(id); }

  // Called right after an image/video is written to disk. Throws if cloud is enabled but upload fails.
  async function persistUpload(relPath, reservationId) {
    const key = `uploads/${relPath}`;
    const abs = path.join(uploadsDir, relPath);
    const size = fileSize(abs);
    try {
      if (cloud.isEnabled()) await cloud.putFile(key, abs, mimeOf(relPath));
    } catch (e) {
      releaseUpload(reservationId);
      throw e;
    }
    const c = quota.commit(reservationId, key, size);
    if (!c.ok) {
      if (cloud.isEnabled()) await cloud.del(key).catch(() => {});
      fs.unlink(abs, () => {});
      throw new QuotaError(quotaMessage(size, c.freeBytes));
    }
    return cloud.isEnabled()
      ? { persisted: true, storage: cloud.status().provider }
      : { persisted: false, storage: 'local_disk_ephemeral' };
  }

  // 4. Browser → bucket direct uploads (videos). Bypasses the Cloudflare proxy body limit and the server disk.
  async function beginDirectUpload({ size, contentType }) {
    size = Number(size);
    if (!Number.isFinite(size) || size <= 0) throw Object.assign(new Error('File size is required'), { status: 400 });
    const ext = VIDEO_TYPES[String(contentType || '').toLowerCase()];
    if (!ext) throw Object.assign(new Error('Only MP4, WebM or MOV videos are supported'), { status: 415 });
    if (!cloud.isEnabled()) {
      // No bucket: tell the browser to stream through the server instead (quota is checked there).
      const free = quota.summary().uploadFreeBytes;
      if (size > free) throw new QuotaError(quotaMessage(size, free));
      return { mode: 'server' };
    }

    const rel = `videos/reel_${Date.now()}_${crypto.randomBytes(4).toString('hex')}${ext}`;
    const key = `uploads/${rel}`;
    const session = { rel, contentType: contentType.toLowerCase(), size, s3UploadId: null };
    const r = quota.reserve(size, {
      label: key,
      ttlMs: DIRECT_TTL_MS,
      onExpire: () => { direct.delete(r.id); cleanupDirect(session); }
    });
    if (!r.ok) throw new QuotaError(quotaMessage(r.requestedBytes, r.freeBytes), r);
    direct.set(r.id, session);

    const expiresIn = DIRECT_TTL_MS / 1000;
    try {
      if (size > cloud.multipartThreshold()) {
        session.s3UploadId = await cloud.createMultipart(key, session.contentType);
        const partSize = cloud.partSizeFor(size);
        const parts = [];
        for (let n = 1; (n - 1) * partSize < size; n++) {
          parts.push({ partNumber: n, url: cloud.presignUrl('PUT', key, { query: { partNumber: String(n), uploadId: session.s3UploadId }, expiresIn }) });
        }
        return { mode: 'multipart', uploadId: r.id, rel, s3UploadId: session.s3UploadId, partSize, parts };
      }
      return { mode: 'single', uploadId: r.id, rel, url: cloud.presignUrl('PUT', key, { expiresIn }), contentType: session.contentType };
    } catch (e) {
      quota.release(r.id);
      direct.delete(r.id);
      throw e;
    }
  }

  async function completeDirectUpload({ uploadId, rel, s3UploadId, parts }) {
    let session = direct.get(uploadId);
    let reservationId = session && quota.hasReservation(uploadId) ? uploadId : null;
    if (!session) {
      // Server restarted mid-upload: accept it only if it still fits the cap.
      if (!DIRECT_REL.test(String(rel || ''))) throw Object.assign(new Error('Upload session expired — please upload again'), { status: 410 });
      session = { rel, s3UploadId: s3UploadId || null };
    }
    const key = `uploads/${session.rel}`;
    try {
      if (session.s3UploadId) {
        if (!Array.isArray(parts) || !parts.length) throw Object.assign(new Error('Missing upload parts'), { status: 400 });
        await cloud.completeMultipart(key, session.s3UploadId, parts);
      }
      const actual = await cloud.head(key);
      if (actual == null) throw Object.assign(new Error('Upload did not reach storage — please try again'), { status: 400 });
      if (!reservationId) {
        const r = quota.reserve(actual, { label: key });
        if (!r.ok) { await cloud.del(key).catch(() => {}); throw new QuotaError(quotaMessage(actual, r.freeBytes)); }
        reservationId = r.id;
      }
      const c = quota.commit(reservationId, key, actual);
      reservationId = null;
      if (!c.ok) { await cloud.del(key).catch(() => {}); throw new QuotaError(quotaMessage(actual, c.freeBytes)); }
      direct.delete(uploadId);
      return { rel: session.rel, size: actual };
    } catch (e) {
      if (reservationId) quota.release(reservationId);
      if (direct.has(uploadId)) { direct.delete(uploadId); cleanupDirect(session); }
      throw e;
    }
  }

  async function abortDirectUpload({ uploadId }) {
    const session = direct.get(uploadId);
    quota.release(uploadId);
    direct.delete(uploadId);
    if (session) await cleanupDirect(session);
    return true;
  }

  function cleanupDirect(session) {
    const key = `uploads/${session.rel}`;
    const p = session.s3UploadId ? cloud.abortMultipart(key, session.s3UploadId) : cloud.del(key);
    return p.catch(e => console.error('[CLOUD] Cleanup failed:', e.message));
  }

  // 5. A requested upload is missing locally (container was recycled) -> fetch it back from the cloud.
  async function restoreUpload(relPath) {
    if (!cloud.isEnabled()) return false;
    const key = `uploads/${relPath}`;
    if (!inflight.has(key)) {
      inflight.set(key, cloud.getToFile(key, path.join(uploadsDir, relPath))
        .catch(e => { console.error('[CLOUD] Restore failed:', e.message); return false; })
        .finally(() => setTimeout(() => inflight.delete(key), 1000)));
    }
    return inflight.get(key);
  }

  // 6. Admin storage management.
  function siteReferences() {
    let text = '';
    for (const [abs] of trackedFiles()) { try { text += fs.readFileSync(abs, 'utf8'); } catch (e) {} }
    return text;
  }

  function listUploads() {
    const refs = siteReferences();
    return quota.uploads().map(({ key, size }) => {
      const rel = key.slice('uploads/'.length);
      return {
        path: rel,
        url: `/assets/uploads/${rel}`,
        size,
        type: /^videos\//.test(rel) || /\.(mp4|webm|mov|m4v)$/i.test(rel) ? 'video' : 'image',
        inUse: refs.includes(`uploads/${rel}`)
      };
    }).sort((a, b) => b.size - a.size);
  }

  async function deleteUpload(rel, { force = false } = {}) {
    rel = String(rel || '').replace(/^\/+/, '').replace(/^assets\/uploads\//, '');
    if (!SAFE_UPLOAD_REL.test(rel)) throw Object.assign(new Error('Invalid file path'), { status: 400 });
    const key = `uploads/${rel}`;
    if (quota.sizeOf(key) == null && fileSize(path.join(uploadsDir, rel)) == null) {
      throw Object.assign(new Error('File not found'), { status: 404 });
    }
    if (!force && siteReferences().includes(key)) {
      throw Object.assign(new Error('This file is still used on the website. Remove it from the product/reel first, or confirm to delete anyway.'), { status: 409, inUse: true });
    }
    if (cloud.isEnabled()) await cloud.del(key);
    try { fs.unlinkSync(path.join(uploadsDir, rel)); } catch (e) {}
    const freed = quota.sizeOf(key) || 0;
    quota.remove(key);
    return { freedBytes: freed };
  }

  function usage() {
    return Object.assign(quota.summary(), {
      cloudEnabled: cloud.isEnabled(),
      provider: cloud.status().provider,
      bucket: cloud.status().bucket,
      lastReconcile
    });
  }

  function quotaMessage(requested, free) {
    return `Storage limit reached: this file needs ${formatBytes(requested)} but only ${formatBytes(free)} is free ` +
      `(limit ${formatBytes(quota.limitBytes)}). Delete unused photos/videos in Admin → Storage to free space.`;
  }

  // Free space for an upload of unknown size (used to bound request bodies before reading them).
  function uploadFreeBytes() { return quota.summary().uploadFreeBytes; }

  async function flush() {
    if (cloud.isEnabled()) await syncChanged();
  }

  return {
    bootstrap, persistUpload, restoreUpload, flush, reconcile,
    reserveUpload, releaseUpload, uploadFreeBytes,
    beginDirectUpload, completeDirectUpload, abortDirectUpload,
    listUploads, deleteUpload, usage,
    publicUrlFor: rel => cloud.publicUrlFor(`uploads/${rel}`),
    status: cloud.status
  };
}

module.exports = { create, QuotaError };
