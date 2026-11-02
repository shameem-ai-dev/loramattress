/* LORA Admin — Instagram Reels manager (tab-reels)
 * Saves to POST /api/instagram-reels; videos upload as raw binary to /api/upload-video (original quality kept).
 * A poster frame is captured from each uploaded video in the browser and stored via /api/upload.
 */
(function () {
  'use strict';

  var root;
  var state = { enabled: true, autoplay: true, title: 'Watch LORA', subtitle: '', profileUrl: '', reels: [] };
  var IG_RE = /^https:\/\/(www\.)?instagram\.com\/(p|reel|reels|tv)\/[A-Za-z0-9_-]+/i;

  function token() { return localStorage.getItem('lora_admin_token') || 'admin-session-active'; }
  function esc(s) { return String(s || '').replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function uid() { return 'reel_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function mb(n) { return (n / 1e6).toFixed(1) + ' MB'; }

  /* Storage hook (admin.html is left untouched):
   * - adds the admin Authorization header to image uploads (/api/upload) and storage API calls
   * - when the server blocks an upload because the storage limit is reached (HTTP 507), tells the admin clearly */
  if (window.fetch && !window.__loraStorageFetchHook) {
    window.__loraStorageFetchHook = true;
    var nativeFetch = window.fetch.bind(window);
    window.fetch = function (input, init) {
      var url = typeof input === 'string' ? input : (input && input.url) || '';
      var isUpload = /^(https?:\/\/[^/]+)?\/api\/(upload|storage\/)/.test(url) && url.indexOf('/api/upload-video') === -1;
      if (isUpload && typeof input === 'string') {
        init = Object.assign({}, init || {});
        var h = new Headers(init.headers || {});
        if (!h.has('Authorization')) h.set('Authorization', 'Bearer ' + token());
        init.headers = h;
      }
      var p = nativeFetch(input, init);
      if (/\/api\/upload(\?|$)/.test(url)) {
        p.then(function (res) {
          if (res.status === 507) {
            res.clone().json().then(function (d) {
              alert('⚠ Upload blocked — storage is full.\n\n' + ((d && d.message) || 'Delete unused photos/videos in the Storage panel to free space.') +
                '\n\nThe image was NOT saved. Free some space, then upload it again.');
            }).catch(function () {});
          }
          if (res.ok && window.LoraStorage) window.LoraStorage.refresh();
        }).catch(function () {});
      }
      return p;
    };
  }

  // Storage usage panel (Photos + Reels tabs)
  (function loadStoragePanel() {
    if (document.getElementById('lora-storage-js')) return;
    var s = document.createElement('script');
    s.id = 'lora-storage-js';
    s.src = '/assets/admin-storage.js?v=1';
    s.defer = true;
    document.head.appendChild(s);
  })();

  var S = {
    card: 'background:rgba(15,23,42,.7);border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:1.1rem;',
    input: 'width:100%;height:38px;background:#0B1220;border:1px solid rgba(255,255,255,.12);border-radius:8px;color:#fff;padding:0 .75rem;font-size:.85rem;box-sizing:border-box;',
    label: 'display:block;font-size:.72rem;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#94A3B8;margin-bottom:.35rem;',
    btn: 'height:34px;padding:0 .9rem;border-radius:8px;border:1px solid rgba(255,255,255,.15);background:rgba(255,255,255,.06);color:#fff;font-size:.78rem;font-weight:600;cursor:pointer;',
    primary: 'height:40px;padding:0 1.4rem;border-radius:8px;border:0;background:linear-gradient(135deg,#F58529,#DD2A7B 50%,#8134AF);color:#fff;font-weight:700;font-size:.85rem;cursor:pointer;box-shadow:0 6px 18px rgba(221,42,123,.35);'
  };

  function render() {
    root.innerHTML =
      '<div class="admin-card" style="margin-bottom:1.5rem">' +
        '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:1rem;align-items:end">' +
          '<div style="display:flex;flex-direction:column;gap:.65rem">' +
            '<label style="display:flex;align-items:center;gap:.5rem;color:#fff;font-weight:600;font-size:.88rem;cursor:pointer"><input type="checkbox" id="reels-enabled" ' + (state.enabled !== false ? 'checked' : '') + ' style="accent-color:#DD2A7B;width:16px;height:16px"> Show section on homepage</label>' +
            '<label style="display:flex;align-items:center;gap:.5rem;color:#38BDF8;font-weight:600;font-size:.85rem;cursor:pointer"><input type="checkbox" id="reels-autoplay" ' + (state.autoplay !== false ? 'checked' : '') + ' style="accent-color:#00B4D8;width:16px;height:16px"> Autoplay videos (muted on scroll)</label>' +
          '</div>' +
          '<div><span style="' + S.label + '">Section Title</span><input id="reels-title" style="' + S.input + '" value="' + esc(state.title) + '"></div>' +
          '<div><span style="' + S.label + '">Subtitle (optional)</span><input id="reels-subtitle" style="' + S.input + '" value="' + esc(state.subtitle) + '"></div>' +
          '<div><span style="' + S.label + '">Instagram Profile URL (Follow button)</span><input id="reels-profile" style="' + S.input + '" placeholder="https://www.instagram.com/loramattress/" value="' + esc(state.profileUrl) + '"></div>' +
        '</div>' +
      '</div>' +
      '<div class="admin-card" style="margin-bottom:1.5rem">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;gap:1rem;flex-wrap:wrap;margin-bottom:1rem">' +
          '<div><h3 class="admin-card-title" style="margin:0">Reels (' + state.reels.length + ')</h3>' +
          '<p style="margin:.3rem 0 0;color:#94A3B8;font-size:.8rem">For maximum quality, upload the <b>original 1080×1920 MP4</b> you posted (not a screen recording). Link-only reels use Instagram\'s official player.</p></div>' +
          '<button type="button" id="reels-add" style="' + S.primary + '">+ Add Reel</button>' +
        '</div>' +
        '<div id="reels-list" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:1rem"></div>' +
      '</div>' +
      '<div style="display:flex;justify-content:flex-end;align-items:center;gap:1rem">' +
        '<span id="reels-status" style="font-size:.8rem;color:#94A3B8"></span>' +
        '<button type="button" id="reels-save" style="' + S.primary + '">Publish to Homepage</button>' +
      '</div>';

    var list = root.querySelector('#reels-list');
    if (!state.reels.length) {
      list.innerHTML = '<div style="' + S.card + 'color:#94A3B8;text-align:center;grid-column:1/-1">No reels yet. Click "+ Add Reel".</div>';
    }
    state.reels.forEach(function (r, i) { list.appendChild(rowEl(r, i)); });

    root.querySelector('#reels-add').onclick = function () { syncTop(); state.reels.push({ id: uid(), instagramUrl: '', videoUrl: '', posterUrl: '', caption: '', active: true }); render(); };
    root.querySelector('#reels-save').onclick = save;
  }

  function rowEl(r, i) {
    var el = document.createElement('div');
    el.style.cssText = S.card + 'display:flex;flex-direction:column;gap:.7rem';
    var preview = r.videoUrl
      ? '<video src="' + esc(r.videoUrl) + '" ' + (r.posterUrl ? 'poster="' + esc(r.posterUrl) + '"' : '') + ' muted loop playsinline controls preload="metadata" style="width:100%;aspect-ratio:9/16;max-height:340px;object-fit:cover;border-radius:10px;background:#000"></video>'
      : '<div style="aspect-ratio:9/16;max-height:340px;border-radius:10px;background:linear-gradient(160deg,#1a1030,#2a0f24);display:flex;align-items:center;justify-content:center;color:#FBCFE8;font-size:.8rem;text-align:center;padding:1rem">' +
        (r.instagramUrl ? 'Instagram embed player<br><small style="opacity:.7">Upload MP4 for HD autoplay</small>' : 'No video yet') + '</div>';
    el.innerHTML =
      '<div style="display:flex;justify-content:space-between;align-items:center">' +
        '<strong style="color:#fff;font-size:.85rem">Reel #' + (i + 1) + '</strong>' +
        '<div style="display:flex;gap:.35rem">' +
          '<label style="display:flex;align-items:center;gap:.3rem;color:#CBD5E1;font-size:.75rem;margin-right:.4rem"><input type="checkbox" data-f="active" ' + (r.active !== false ? 'checked' : '') + '> Live</label>' +
          '<button type="button" data-a="up" style="' + S.btn + 'width:30px;padding:0" ' + (i === 0 ? 'disabled' : '') + '>▲</button>' +
          '<button type="button" data-a="down" style="' + S.btn + 'width:30px;padding:0" ' + (i === state.reels.length - 1 ? 'disabled' : '') + '>▼</button>' +
          '<button type="button" data-a="del" style="' + S.btn + 'width:30px;padding:0;color:#F87171">✕</button>' +
        '</div>' +
      '</div>' + preview +
      '<div><span style="' + S.label + '">Instagram Link</span><input data-f="instagramUrl" style="' + S.input + '" placeholder="https://www.instagram.com/reel/XXXX/" value="' + esc(r.instagramUrl) + '"></div>' +
      '<div><span style="' + S.label + '">Caption (optional)</span><input data-f="caption" maxlength="140" style="' + S.input + '" value="' + esc(r.caption) + '"></div>' +
      '<div style="display:flex;gap:.5rem;align-items:center;flex-wrap:wrap">' +
        '<label style="' + S.btn + 'display:inline-flex;align-items:center">' + (r.videoUrl ? 'Replace MP4' : 'Upload Original MP4') +
          '<input type="file" accept="video/mp4,video/quicktime,video/webm" data-a="file" style="display:none"></label>' +
        (r.videoUrl ? '<button type="button" data-a="rmvideo" style="' + S.btn + '">Remove video</button>' : '') +
        '<span data-progress style="font-size:.75rem;color:#94A3B8"></span>' +
      '</div>';

    el.querySelectorAll('[data-f]').forEach(function (inp) {
      inp.addEventListener(inp.type === 'checkbox' ? 'change' : 'input', function () {
        r[inp.dataset.f] = inp.type === 'checkbox' ? inp.checked : inp.value.trim();
      });
    });
    el.querySelector('[data-a="up"]').onclick = function () { move(i, -1); };
    el.querySelector('[data-a="down"]').onclick = function () { move(i, 1); };
    el.querySelector('[data-a="del"]').onclick = function () { if (confirm('Remove this reel?')) { syncTop(); state.reels.splice(i, 1); render(); } };
    var rm = el.querySelector('[data-a="rmvideo"]');
    if (rm) rm.onclick = function () { syncTop(); r.videoUrl = ''; r.posterUrl = ''; render(); };
    el.querySelector('[data-a="file"]').onchange = function (e) {
      var f = e.target.files[0];
      if (f) uploadVideo(f, r, el.querySelector('[data-progress]'));
    };
    return el;
  }

  function move(i, d) { syncTop(); var a = state.reels; var t = a[i]; a[i] = a[i + d]; a[i + d] = t; render(); }

  function syncTop() {
    var g = function (id) { var n = root.querySelector(id); return n ? n : null; };
    if (!g('#reels-title')) return;
    state.enabled = g('#reels-enabled') ? g('#reels-enabled').checked : true;
    state.autoplay = g('#reels-autoplay') ? g('#reels-autoplay').checked : true;
    state.title = g('#reels-title') ? g('#reels-title').value.trim() : 'Watch LORA';
    state.subtitle = g('#reels-subtitle') ? g('#reels-subtitle').value.trim() : '';
    state.profileUrl = g('#reels-profile') ? g('#reels-profile').value.trim() : '';
  }

  /* Upload flow (no per-file size limit — only the total storage cap, enforced by the server):
   * 1. Ask the server to book space → it returns presigned URL(s) for direct browser → cloud upload
   *    (bypasses the Cloudflare proxy body limit; multi-part for very large files).
   * 2. Tell the server the upload finished → it verifies the real size and commits it.
   * Falls back to streaming through the server when cloud storage is not configured. */
  function uploadVideo(file, r, progressEl) {
    var type = file.type || (/\.mov$/i.test(file.name) ? 'video/quicktime' : (/\.webm$/i.test(file.name) ? 'video/webm' : 'video/mp4'));
    var showErr = function (msg) { progressEl.style.color = '#F87171'; progressEl.textContent = msg; };
    progressEl.style.color = '#94A3B8';
    progressEl.textContent = 'Checking storage…';
    api('/api/storage/upload-url', { size: file.size, contentType: type }).then(function (s) {
      if (s.mode === 'server') return serverUpload(file, type, progressEl);
      return directUpload(file, type, s, progressEl).then(function () {
        progressEl.textContent = 'Finalizing…';
        return api('/api/storage/upload-complete', { uploadId: s.uploadId, rel: s.rel, s3UploadId: s.s3UploadId, parts: s.doneParts });
      }, function (err) {
        api('/api/storage/upload-abort', { uploadId: s.uploadId }).catch(function () {});
        if (err && err.network && file.size < 95e6) {
          // Bucket CORS not set up yet — small files can still go through the server.
          progressEl.textContent = 'Direct upload unavailable, retrying via server…';
          return serverUpload(file, type, progressEl);
        }
        throw err && err.network
          ? new Error('Direct upload to cloud storage was blocked (check the bucket CORS settings).')
          : err;
      });
    }).then(function (d) {
      onVideoUploaded(file, r, d, progressEl);
    }).catch(function (e) {
      showErr(e.message || 'Upload failed');
      if (e.status === 507) alert('⚠ Upload blocked — storage is full.\n\n' + e.message);
    }).then(function () { if (window.LoraStorage) window.LoraStorage.refresh(); });
  }

  function api(url, body) {
    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token() },
      body: JSON.stringify(body)
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (d) {
        if (!res.ok || !d.success) { var e = new Error(d.message || ('Request failed (' + res.status + ')')); e.status = res.status; throw e; }
        return d;
      });
    });
  }

  function putBlob(url, blob, contentType, onProgress) {
    return new Promise(function (resolve, reject) {
      var xhr = new XMLHttpRequest();
      xhr.open('PUT', url);
      if (contentType) xhr.setRequestHeader('Content-Type', contentType);
      xhr.upload.onprogress = function (e) { if (e.lengthComputable) onProgress(e.loaded); };
      xhr.onload = function () {
        if (xhr.status >= 200 && xhr.status < 300) resolve(xhr.getResponseHeader('ETag'));
        else reject(new Error('Cloud storage rejected the upload (' + xhr.status + ')'));
      };
      xhr.onerror = function () { var e = new Error('Network error'); e.network = true; reject(e); };
      xhr.send(blob);
    });
  }

  function directUpload(file, type, s, progressEl) {
    var show = function (done) { progressEl.textContent = 'Uploading ' + Math.round(done / file.size * 100) + '% (' + mb(file.size) + ')'; };
    if (s.mode === 'single') return putBlob(s.url, file, type, show);
    // Multipart: parts uploaded one after another (equal size except the last).
    s.doneParts = [];
    var chain = Promise.resolve();
    s.parts.forEach(function (part) {
      chain = chain.then(function () {
        var start = (part.partNumber - 1) * s.partSize;
        var blob = file.slice(start, Math.min(file.size, start + s.partSize));
        return putBlob(part.url, blob, null, function (loaded) { show(start + loaded); }).then(function (etag) {
          if (!etag) throw new Error('Cloud storage did not return an ETag — add "ETag" to the bucket CORS ExposeHeaders.');
          s.doneParts.push({ partNumber: part.partNumber, etag: etag });
        });
      });
    });
    return chain;
  }

  function serverUpload(file, type, progressEl) {
    return new Promise(function (resolve, reject) {
      var xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/upload-video');
      xhr.setRequestHeader('Content-Type', type);
      xhr.setRequestHeader('Authorization', 'Bearer ' + token());
      xhr.upload.onprogress = function (e) {
        if (e.lengthComputable) progressEl.textContent = 'Uploading ' + Math.round(e.loaded / e.total * 100) + '% (' + mb(file.size) + ')';
      };
      xhr.onload = function () {
        var d = {};
        try { d = JSON.parse(xhr.responseText); } catch (e) {}
        if (xhr.status !== 200 || !d.success) {
          var err = new Error(d.message || (xhr.status === 413 ? 'File is too large for the website proxy (Cloudflare). Set up direct cloud upload (bucket CORS).' : 'Upload failed'));
          err.status = xhr.status;
          return reject(err);
        }
        resolve(d);
      };
      xhr.onerror = function () { reject(new Error('Network error during upload')); };
      xhr.send(file);
    });
  }

  function onVideoUploaded(file, r, d, progressEl) {
    progressEl.textContent = 'Generating cover frame…';
    syncTop();
    r.videoUrl = d.url;
    capturePoster(file).then(function (dataUrl) {
      if (!dataUrl) return null;
      return fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token() },
        body: JSON.stringify({ image: dataUrl, model: 'reel', slot: 'poster' })
      }).then(function (x) { return x.json(); }).then(function (p) { if (p && p.success) r.posterUrl = p.url; });
    }).catch(function () {}).then(function () {
      render();
      setStatus('Video uploaded — click "Publish to Homepage" to go live.', '#FBBF24');
    });
  }

  /* Grab a high-quality frame (~1s in) at the video's native resolution for the poster */
  function capturePoster(file) {
    return new Promise(function (resolve) {
      var url = URL.createObjectURL(file);
      var v = document.createElement('video');
      v.muted = true; v.playsInline = true; v.preload = 'auto'; v.src = url;
      var done = function (val) { URL.revokeObjectURL(url); resolve(val); };
      v.onloadedmetadata = function () { v.currentTime = Math.min(1, (v.duration || 2) / 3); };
      v.onseeked = function () {
        try {
          var c = document.createElement('canvas');
          c.width = v.videoWidth; c.height = v.videoHeight;
          c.getContext('2d').drawImage(v, 0, 0, c.width, c.height);
          done(c.toDataURL('image/jpeg', 0.9));
        } catch (e) { done(null); }
      };
      v.onerror = function () { done(null); };
      setTimeout(function () { done(null); }, 15000);
    });
  }

  function setStatus(msg, color) { var s = root.querySelector('#reels-status'); if (s) { s.textContent = msg; s.style.color = color || '#94A3B8'; } }

  function save() {
    syncTop();
    var bad = state.reels.filter(function (r) { return r.instagramUrl && !IG_RE.test(r.instagramUrl); });
    if (bad.length) { alert('Please check Instagram links. They must look like https://www.instagram.com/reel/XXXX/'); return; }
    var empty = state.reels.filter(function (r) { return !r.instagramUrl && !r.videoUrl; });
    if (empty.length && !confirm(empty.length + ' reel(s) have no link or video and will be dropped. Continue?')) return;
    setStatus('Publishing…');
    fetch('/api/instagram-reels', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token() },
      body: JSON.stringify({ settings: state })
    }).then(function (r) { return r.json(); }).then(function (d) {
      if (!d.success) throw new Error(d.message || 'Save failed');
      state = d.settings;
      render();
      setStatus('● Live on homepage (' + state.reels.filter(function (r) { return r.active; }).length + ' active)', '#34D399');
    }).catch(function (e) { setStatus('✕ ' + e.message, '#F87171'); });
  }

  function init() {
    root = document.getElementById('reels-admin-root');
    if (!root) return;
    render();
    fetch('/api/instagram-reels', { cache: 'no-store' }).then(function (r) { return r.json(); })
      .then(function (d) {
        if (d && d.success && d.settings) {
          state = d.settings;
          state.reels = state.reels || [];
          if (typeof state.autoplay !== 'boolean') state.autoplay = true;
          render();
        }
      })
      .catch(function () {});
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
