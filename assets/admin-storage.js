/* LORA Admin — Cloud Storage panel (usage bar, file manager, delete to free space)
 * Injected into the Photos and Reels tabs by admin-reels.js (admin.html is not modified).
 * Data: GET /api/storage/usage (served from the server's in-memory ledger — no cloud requests).
 *       POST /api/storage/delete { path, force }
 */
(function () {
  'use strict';
  if (window.LoraStorage) return;

  var PANES = ['tab-photos', 'tab-reels'];
  var state = { usage: null, files: [], filter: 'all', open: false, loading: false, error: '' };
  var hosts = [];

  function token() { return localStorage.getItem('lora_admin_token') || 'admin-session-active'; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function fmt(n) {
    n = Number(n) || 0;
    if (n >= 1e9) return (n / 1e9).toFixed(2) + ' GB';
    if (n >= 1e6) return (n / 1e6).toFixed(1) + ' MB';
    return Math.max(0, Math.round(n / 1e3)) + ' KB';
  }
  function pct(a, b) { return b ? Math.min(100, Math.max(0, a / b * 100)) : 0; }

  function injectStyles() {
    if (document.getElementById('lora-storage-css')) return;
    var css = document.createElement('style');
    css.id = 'lora-storage-css';
    css.textContent = [
      '.lst-card{background:linear-gradient(160deg,rgba(15,23,42,.92),rgba(17,24,39,.78));border:1px solid rgba(148,163,184,.14);border-radius:14px;padding:1.1rem 1.25rem;margin:0 0 1.5rem;color:#E2E8F0;font-family:inherit;box-shadow:0 10px 30px rgba(2,6,23,.35)}',
      '.lst-head{display:flex;justify-content:space-between;align-items:center;gap:1rem;flex-wrap:wrap}',
      '.lst-title{display:flex;align-items:center;gap:.6rem;font-weight:700;font-size:.95rem;color:#F8FAFC;margin:0}',
      '.lst-badge{font-size:.66rem;font-weight:700;letter-spacing:.06em;text-transform:uppercase;padding:.2rem .5rem;border-radius:999px;background:rgba(56,189,248,.12);color:#7DD3FC;border:1px solid rgba(56,189,248,.25)}',
      '.lst-badge.warn{background:rgba(251,191,36,.12);color:#FCD34D;border-color:rgba(251,191,36,.3)}',
      '.lst-badge.bad{background:rgba(248,113,113,.12);color:#FCA5A5;border-color:rgba(248,113,113,.3)}',
      '.lst-btn{height:32px;padding:0 .85rem;border-radius:8px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.05);color:#E2E8F0;font-size:.76rem;font-weight:600;cursor:pointer;transition:background .15s,border-color .15s,transform .1s}',
      '.lst-btn:hover{background:rgba(255,255,255,.1);border-color:rgba(255,255,255,.25)}',
      '.lst-btn:active{transform:scale(.97)}',
      '.lst-btn.del{color:#FCA5A5;border-color:rgba(248,113,113,.3)}',
      '.lst-btn.del:hover{background:rgba(248,113,113,.14)}',
      '.lst-btn[disabled]{opacity:.5;cursor:wait}',
      '.lst-bar{position:relative;height:12px;border-radius:999px;background:rgba(148,163,184,.14);overflow:hidden;margin:.95rem 0 .6rem;display:flex}',
      '.lst-seg{height:100%;transition:width .6s cubic-bezier(.2,.8,.2,1)}',
      '.lst-seg.up{background:linear-gradient(90deg,#06B6D4,#3B82F6)}',
      '.lst-seg.data{background:linear-gradient(90deg,#8B5CF6,#A855F7)}',
      '.lst-seg.pend{background:repeating-linear-gradient(45deg,#F59E0B 0 6px,#FBBF24 6px 12px)}',
      '.lst-seg.other{background:#64748B}',
      '.lst-reserve{position:absolute;top:0;bottom:0;border-left:2px dashed rgba(226,232,240,.55)}',
      '.lst-legend{display:flex;flex-wrap:wrap;gap:.4rem 1.1rem;font-size:.75rem;color:#94A3B8}',
      '.lst-legend b{color:#F1F5F9;font-weight:700}',
      '.lst-dot{display:inline-block;width:9px;height:9px;border-radius:3px;margin-right:.35rem;vertical-align:-1px}',
      '.lst-note{margin-top:.7rem;font-size:.78rem;padding:.55rem .75rem;border-radius:8px}',
      '.lst-note.warn{background:rgba(251,191,36,.08);color:#FCD34D;border:1px solid rgba(251,191,36,.22)}',
      '.lst-note.bad{background:rgba(248,113,113,.08);color:#FCA5A5;border:1px solid rgba(248,113,113,.22)}',
      '.lst-files{margin-top:1rem;border-top:1px solid rgba(148,163,184,.12);padding-top:.9rem}',
      '.lst-filters{display:flex;gap:.4rem;flex-wrap:wrap;margin-bottom:.75rem}',
      '.lst-chip{height:28px;padding:0 .75rem;border-radius:999px;border:1px solid rgba(255,255,255,.12);background:transparent;color:#CBD5E1;font-size:.72rem;font-weight:600;cursor:pointer}',
      '.lst-chip.on{background:rgba(6,182,212,.16);border-color:rgba(6,182,212,.45);color:#67E8F9}',
      '.lst-list{display:flex;flex-direction:column;gap:.45rem;max-height:420px;overflow:auto;padding-right:.25rem}',
      '.lst-row{display:grid;grid-template-columns:52px 1fr auto auto;gap:.8rem;align-items:center;padding:.45rem .55rem;border-radius:10px;background:rgba(2,6,23,.35);border:1px solid rgba(148,163,184,.08);transition:border-color .15s}',
      '.lst-row:hover{border-color:rgba(148,163,184,.25)}',
      '.lst-thumb{width:52px;height:52px;border-radius:8px;object-fit:cover;background:#0B1220;display:flex;align-items:center;justify-content:center;color:#94A3B8;font-size:1.2rem}',
      '.lst-name{font-size:.78rem;color:#E2E8F0;word-break:break-all;line-height:1.35}',
      '.lst-name small{display:block;color:#94A3B8;font-size:.7rem;margin-top:.15rem}',
      '.lst-tag{font-size:.64rem;font-weight:700;letter-spacing:.05em;text-transform:uppercase;padding:.18rem .45rem;border-radius:6px}',
      '.lst-tag.use{background:rgba(52,211,153,.12);color:#6EE7B7}',
      '.lst-tag.free{background:rgba(148,163,184,.12);color:#CBD5E1}',
      '@media (max-width:640px){.lst-row{grid-template-columns:44px 1fr auto}.lst-row .lst-tag{display:none}.lst-thumb{width:44px;height:44px}}'
    ].join('');
    document.head.appendChild(css);
  }

  function mount() {
    injectStyles();
    PANES.forEach(function (id) {
      var pane = document.getElementById(id);
      if (!pane || pane.querySelector('.lst-card')) return;
      var host = document.createElement('section');
      host.className = 'lst-card';
      host.id = 'storage-panel-' + id;
      host.setAttribute('aria-label', 'Cloud storage usage');
      var header = pane.querySelector('.stage-header');
      if (header && header.nextSibling) pane.insertBefore(host, header.nextSibling); else pane.insertBefore(host, pane.firstChild);
      hosts.push(host);
    });
    render();
  }

  function render() {
    hosts.forEach(function (h) { h.innerHTML = html(); bind(h); });
  }

  function html() {
    var u = state.usage;
    if (!u) {
      return '<div class="lst-head"><h3 class="lst-title">☁ Storage</h3>' +
        '<button type="button" class="lst-btn" data-act="refresh">' + (state.loading ? 'Loading…' : 'Refresh') + '</button></div>' +
        (state.error ? '<div class="lst-note bad">' + esc(state.error) + '</div>' : '');
    }
    var used = u.usedBytes, lim = u.limitBytes;
    var p = pct(used + u.pendingBytes, lim);
    var level = u.uploadFreeBytes <= 0 ? 'bad' : (p >= 90 ? 'warn' : '');
    var badge = !u.cloudEnabled ? '<span class="lst-badge bad">Not permanent</span>'
      : '<span class="lst-badge' + (level ? ' ' + level : '') + '">' + (u.provider === 'cloudflare_r2' ? 'Cloudflare R2' : 'Cloud') + '</span>';
    var reserveLeft = pct(lim - u.reserveBytes, lim);

    var out = '<div class="lst-head">' +
        '<h3 class="lst-title">☁ Storage ' + badge + '</h3>' +
        '<div style="display:flex;gap:.45rem">' +
          '<button type="button" class="lst-btn" data-act="toggle">' + (state.open ? 'Hide files' : 'Manage files (' + u.fileCount + ')') + '</button>' +
          '<button type="button" class="lst-btn" data-act="refresh"' + (state.loading ? ' disabled' : '') + '>↻</button>' +
        '</div>' +
      '</div>' +
      '<div class="lst-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + Math.round(p) + '">' +
        '<div class="lst-seg up" style="width:' + pct(u.uploadsBytes, lim) + '%"></div>' +
        '<div class="lst-seg pend" style="width:' + pct(u.pendingBytes, lim) + '%"></div>' +
        '<div class="lst-seg other" style="width:' + pct(u.otherBytes, lim) + '%"></div>' +
        '<div class="lst-seg data" style="width:' + pct(u.dataBytes, lim) + '%"></div>' +
        '<div class="lst-reserve" style="left:' + reserveLeft + '%" title="Space reserved for order & settings backups"></div>' +
      '</div>' +
      '<div class="lst-legend">' +
        '<span><b>' + fmt(used) + '</b> of ' + fmt(lim) + ' used (' + Math.round(pct(used, lim)) + '%)</span>' +
        '<span><span class="lst-dot" style="background:#06B6D4"></span>Photos &amp; videos ' + fmt(u.uploadsBytes) + '</span>' +
        '<span><span class="lst-dot" style="background:#A855F7"></span>Backups ' + fmt(u.dataBytes) + '</span>' +
        (u.pendingBytes ? '<span><span class="lst-dot" style="background:#F59E0B"></span>Uploading ' + fmt(u.pendingBytes) + '</span>' : '') +
        (u.otherBytes ? '<span><span class="lst-dot" style="background:#64748B"></span>Other ' + fmt(u.otherBytes) + '</span>' : '') +
        '<span>Free for uploads <b>' + fmt(u.uploadFreeBytes) + '</b></span>' +
        '<span title="Never used by uploads — keeps orders, leads and settings backed up">Backup reserve ' + fmt(u.reserveBytes) + '</span>' +
      '</div>';

    if (!u.cloudEnabled) out += '<div class="lst-note bad">Cloud storage is not configured — files are kept on the server disk only and will be lost on the next restart.</div>';
    else if (level === 'bad') out += '<div class="lst-note bad">Storage is full. New uploads are blocked until you delete unused files below.</div>';
    else if (level === 'warn') out += '<div class="lst-note warn">Storage is over 90% full. Consider deleting unused files.</div>';
    if (state.error) out += '<div class="lst-note bad">' + esc(state.error) + '</div>';

    if (state.open) out += filesHtml();
    return out;
  }

  function filesHtml() {
    var f = state.filter;
    var list = state.files.filter(function (x) {
      return f === 'all' || (f === 'unused' && !x.inUse) || (f === 'video' && x.type === 'video') || (f === 'image' && x.type === 'image');
    });
    var unused = state.files.filter(function (x) { return !x.inUse; });
    var unusedBytes = unused.reduce(function (a, x) { return a + x.size; }, 0);
    var chip = function (k, label) { return '<button type="button" class="lst-chip' + (f === k ? ' on' : '') + '" data-filter="' + k + '">' + label + '</button>'; };
    var rows = list.map(function (x) {
      var thumb = x.type === 'image'
        ? '<img class="lst-thumb" loading="lazy" src="' + esc(x.url) + '" alt="">'
        : '<div class="lst-thumb">▶</div>';
      return '<div class="lst-row">' + thumb +
        '<div class="lst-name"><a href="' + esc(x.url) + '" target="_blank" rel="noopener" style="color:inherit;text-decoration:none">' + esc(x.path) + '</a><small>' + fmt(x.size) + ' · ' + x.type + '</small></div>' +
        '<span class="lst-tag ' + (x.inUse ? 'use' : 'free') + '">' + (x.inUse ? 'In use' : 'Unused') + '</span>' +
        '<button type="button" class="lst-btn del" data-del="' + esc(x.path) + '" data-inuse="' + (x.inUse ? 1 : 0) + '" aria-label="Delete ' + esc(x.path) + '">Delete</button>' +
      '</div>';
    }).join('');
    return '<div class="lst-files">' +
      '<div class="lst-filters">' + chip('all', 'All (' + state.files.length + ')') + chip('unused', 'Unused (' + unused.length + ' · ' + fmt(unusedBytes) + ')') +
        chip('video', 'Videos') + chip('image', 'Images') + '</div>' +
      '<div class="lst-list">' + (rows || '<div style="color:#94A3B8;font-size:.8rem;padding:.5rem">No files.</div>') + '</div>' +
    '</div>';
  }

  function bind(h) {
    h.querySelectorAll('[data-act="refresh"]').forEach(function (b) { b.onclick = refresh; });
    h.querySelectorAll('[data-act="toggle"]').forEach(function (b) { b.onclick = function () { state.open = !state.open; render(); }; });
    h.querySelectorAll('[data-filter]').forEach(function (b) { b.onclick = function () { state.filter = b.getAttribute('data-filter'); render(); }; });
    h.querySelectorAll('[data-del]').forEach(function (b) {
      b.onclick = function () { del(b.getAttribute('data-del'), b.getAttribute('data-inuse') === '1', b); };
    });
  }

  function refresh() {
    if (state.loading) return;
    state.loading = true;
    fetch('/api/storage/usage', { cache: 'no-store', headers: { 'Authorization': 'Bearer ' + token() } })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (!d.success) throw new Error(d.message || 'Could not load storage usage');
        state.usage = d.usage; state.files = d.files || []; state.error = '';
      })
      .catch(function (e) { state.error = e.message; })
      .then(function () { state.loading = false; render(); });
  }

  function del(path, inUse, btn) {
    var msg = inUse
      ? 'This file is USED on the website (product photo or reel).\nDeleting it will leave a broken image/video until you replace it.\n\nDelete "' + path + '" anyway?'
      : 'Delete "' + path + '" permanently?';
    if (!confirm(msg)) return;
    btn.disabled = true;
    btn.textContent = '…';
    fetch('/api/storage/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token() },
      body: JSON.stringify({ path: path, force: inUse })
    }).then(function (r) { return r.json().then(function (d) { return { r: r, d: d }; }); })
      .then(function (x) {
        if (x.r.status === 409 && x.d.inUse && confirm(x.d.message + '\n\nDelete anyway?')) {
          return fetch('/api/storage/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token() },
            body: JSON.stringify({ path: path, force: true })
          }).then(function (r) { return r.json(); });
        }
        return x.d;
      })
      .then(function (d) {
        if (d && !d.success) throw new Error(d.message || 'Delete failed');
        state.error = '';
      })
      .catch(function (e) { state.error = e.message; })
      .then(refresh);
  }

  window.LoraStorage = { refresh: refresh };

  function init() {
    mount();
    refresh();
    // Refresh when the admin opens the Photos/Reels tab (served from memory — costs no cloud requests).
    PANES.forEach(function (id) {
      var btn = document.querySelector('[data-tab="' + id + '"]');
      if (btn) btn.addEventListener('click', function () { refresh(); });
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
