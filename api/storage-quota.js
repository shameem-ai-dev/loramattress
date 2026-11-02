// LORA — Server-side storage quota (total bucket cap, no per-file limits)
//
// Usage is tracked in an in-memory ledger built from ONE bucket listing at startup and kept current
// on every write/delete, so checking usage never costs a cloud request.
//
// Concurrency: Node runs request handlers on a single thread, and reserve() checks and books bytes
// synchronously, so two simultaneous uploads can never both claim the same free space. Every
// in-progress upload holds a reservation until it is committed (stored) or released (failed/aborted).
//
// Budget layout (defaults):        8 GB total
//   ├─ backup reserve              256 MB (orders, leads, settings, catalog JSON) — uploads can never use it
//   └─ uploads (images/videos)     everything else
// If the data files ever grow beyond 80% of the reserve, the reserve grows with them (keeps 25% headroom).
//
// Env overrides: STORAGE_LIMIT_GB (default 8), STORAGE_RESERVE_MB (default 256). 1 GB = 1,000,000,000 bytes.

const GB = 1e9;
const MB = 1e6;
const DATA_HEADROOM_FACTOR = 1.25;

function isUploadKey(k) { return k.startsWith('uploads/'); }
function isDataKey(k) { return k.startsWith('data/') || k.startsWith('config/'); }

function createQuota(opts = {}) {
  const limitBytes = Math.round((opts.limitGb != null ? opts.limitGb : Number(process.env.STORAGE_LIMIT_GB || 8)) * GB);
  const reserveBytes = Math.round((opts.reserveMb != null ? opts.reserveMb : Number(process.env.STORAGE_RESERVE_MB || 256)) * MB);
  const now = opts.now || Date.now;

  const objects = new Map();     // relKey -> size   (our prefix)
  let otherBytes = 0;            // objects in the same bucket outside our prefix (still count toward the cap)
  const reservations = new Map(); // id -> { bytes, label, expiresAt, onExpire }
  let seq = 0;

  const sum = pred => { let t = 0; for (const [k, s] of objects) if (pred(k)) t += s; return t; };
  const pendingBytes = () => { let t = 0; for (const r of reservations.values()) t += r.bytes; return t; };
  const uploadsBytes = () => sum(isUploadKey);
  const dataBytes = () => sum(k => !isUploadKey(k));
  const effectiveReserve = () => Math.max(reserveBytes, Math.ceil(sum(isDataKey) * DATA_HEADROOM_FACTOR));
  // Objects inside our prefix that are neither uploads nor data backups (rare, but they occupy space too).
  const strayBytes = () => sum(k => !isUploadKey(k) && !isDataKey(k));
  // Max bytes uploads may occupy (committed + in progress).
  const uploadBudget = () => Math.max(0, limitBytes - effectiveReserve() - otherBytes - strayBytes());
  const uploadFree = () => Math.max(0, uploadBudget() - uploadsBytes() - pendingBytes());

  function sweepExpired() {
    const t = now();
    for (const [id, r] of reservations) {
      if (r.expiresAt && r.expiresAt <= t) {
        reservations.delete(id);
        if (typeof r.onExpire === 'function') { try { r.onExpire(); } catch (e) {} }
      }
    }
  }

  // Atomically books `bytes` for an upload. Returns { ok:true, id } or { ok:false, freeBytes, ... }.
  function reserve(bytes, { label = '', ttlMs = 0, onExpire = null } = {}) {
    sweepExpired();
    bytes = Math.max(0, Math.ceil(Number(bytes) || 0));
    const free = uploadFree();
    if (bytes > free) return { ok: false, requestedBytes: bytes, freeBytes: free, limitBytes };
    const id = `r${++seq}_${now().toString(36)}`;
    reservations.set(id, { bytes, label, expiresAt: ttlMs ? now() + ttlMs : 0, onExpire });
    return { ok: true, id, bytes };
  }

  function hasReservation(id) { sweepExpired(); return reservations.has(id); }
  function reservationOf(id) { return reservations.get(id) || null; }

  function release(id) { return reservations.delete(id); }

  // Moves a reservation into the ledger once the object really exists in storage.
  // If the stored size is larger than reserved, it only succeeds when the difference still fits.
  function commit(id, key, size) {
    reservations.delete(id); // its bytes become free again, then the real size must fit
    const free = uploadFree();
    if (size > free) return { ok: false, freeBytes: free };
    objects.set(key, size);
    return { ok: true };
  }

  // Data backups (orders/settings): may use the reserve, but never push the bucket past the hard limit.
  function canStoreData(key, size) {
    const after = usedBytes() + pendingBytes() - (objects.get(key) || 0) + size;
    return after <= limitBytes;
  }

  function set(key, size) { objects.set(key, size); }
  function remove(key) { objects.delete(key); }
  function sizeOf(key) { return objects.has(key) ? objects.get(key) : null; }

  // Replace the ledger with a fresh bucket listing (startup / periodic reconcile).
  function load(entries, other = 0) {
    objects.clear();
    for (const [k, s] of entries) objects.set(k, s);
    otherBytes = other;
  }

  function usedBytes() { return uploadsBytes() + dataBytes() + otherBytes; }

  function summary() {
    sweepExpired();
    return {
      limitBytes,
      usedBytes: usedBytes(),
      uploadsBytes: uploadsBytes(),
      dataBytes: dataBytes(),
      otherBytes,
      pendingBytes: pendingBytes(),
      reserveBytes: effectiveReserve(),
      uploadBudgetBytes: uploadBudget(),
      uploadFreeBytes: uploadFree(),
      activeUploads: reservations.size,
      fileCount: [...objects.keys()].filter(isUploadKey).length
    };
  }

  function uploads() {
    return [...objects].filter(([k]) => isUploadKey(k)).map(([k, s]) => ({ key: k, size: s }));
  }

  return { reserve, release, commit, hasReservation, reservationOf, canStoreData, set, remove, sizeOf, load, summary, uploads, limitBytes, sweepExpired };
}

function formatBytes(n) {
  if (n >= GB) return (n / GB).toFixed(2) + ' GB';
  if (n >= MB) return (n / MB).toFixed(1) + ' MB';
  return Math.max(0, Math.round(n / 1e3)) + ' KB';
}

module.exports = { createQuota, formatBytes };
