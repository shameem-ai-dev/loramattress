/* LORA — "Watch LORA" Instagram Reels carousel (homepage)
 * Data: GET /api/instagram-reels (managed in Admin → Instagram Reels)
 * - Uploaded MP4 reels: original resolution, muted autoplay/loop when visible, tap → full-screen with sound
 * - Instagram link only: official Instagram embed player (loaded on tap to keep the page fast)
 */
(function () {
  'use strict';

  var IG_ICON = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor"/></svg>';
  var PLAY_ICON = '<svg viewBox="0 0 24 24" width="26" height="26" fill="#fff"><path d="M8 5v14l11-7z"/></svg>';

  function esc(s) {
    return String(s || '').replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function embedUrl(igUrl) {
    var m = /instagram\.com\/(p|reel|reels|tv)\/([A-Za-z0-9_-]+)/i.exec(igUrl || '');
    if (!m) return '';
    var kind = m[1].toLowerCase() === 'p' ? 'p' : 'reel';
    return 'https://www.instagram.com/' + kind + '/' + m[2] + '/embed/';
  }

  function buildCard(r, i) {
    var card = document.createElement('article');
    card.className = 'lr-card' + (r.videoUrl ? '' : ' lr-embed');
    card.style.animationDelay = (i * 70) + 'ms';
    var igBtn = r.instagramUrl
      ? '<a class="lr-ig" href="' + esc(r.instagramUrl) + '" target="_blank" rel="noopener">' + IG_ICON + 'View on Instagram</a>'
      : '';

    if (r.videoUrl) {
      card.innerHTML =
        (r.posterUrl ? '<img class="lr-poster" src="' + esc(r.posterUrl) + '" alt="" loading="lazy" decoding="async">' : '') +
        '<video muted loop playsinline preload="none" disablepictureinpicture' +
        (r.posterUrl ? ' poster="' + esc(r.posterUrl) + '"' : '') + '>' +
        '<source src="' + esc(r.videoUrl) + '"></video>' +
        '<div class="lr-shade"></div><div class="lr-play">' + PLAY_ICON + '</div>' +
        '<button type="button" class="lr-hit" aria-label="Play video full screen' + (r.caption ? ': ' + esc(r.caption) : '') + '"></button>' +
        '<div class="lr-meta">' + (r.caption ? '<div class="lr-cap">' + esc(r.caption) + '</div>' : '') + igBtn + '</div>';
      card.querySelector('.lr-hit').addEventListener('click', function () { openLightbox(r); });
    } else {
      var src = embedUrl(r.instagramUrl);
      card.innerHTML =
        '<button type="button" class="lr-embed-load" aria-label="Load Instagram video">' +
        '<div class="lr-play" style="position:static;margin:0">' + PLAY_ICON + '</div>' +
        '<span>' + IG_ICON + ' Play Instagram Reel</span>' +
        (r.caption ? '<small style="opacity:.75;font-weight:500;padding:0 1rem;text-align:center">' + esc(r.caption) + '</small>' : '') +
        '</button>';
      card.querySelector('.lr-embed-load').addEventListener('click', function () {
        card.innerHTML = '<iframe src="' + esc(src) + '" allow="autoplay; encrypted-media; fullscreen; picture-in-picture" allowfullscreen loading="lazy" scrolling="no" title="Instagram reel"></iframe>';
      });
    }
    return card;
  }

  /* Autoplay muted previews only while visible (saves bandwidth & battery) */
  var observer = 'IntersectionObserver' in window ? new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      var v = e.target.querySelector('video');
      if (!v) return;
      if (e.isIntersecting && e.intersectionRatio > 0.55) {
        if (v.preload !== 'auto') v.preload = 'auto';
        var p = v.play();
        if (p && p.catch) p.catch(function () {});
        e.target.classList.add('is-playing');
      } else {
        v.pause();
        e.target.classList.remove('is-playing');
      }
    });
  }, { threshold: [0, 0.55, 1] }) : null;

  /* Full-screen lightbox, original resolution with sound */
  var lb;
  function openLightbox(r) {
    if (!lb) {
      lb = document.createElement('div');
      lb.className = 'lr-lightbox';
      lb.setAttribute('role', 'dialog');
      lb.setAttribute('aria-modal', 'true');
      lb.innerHTML = '<button type="button" class="lr-lb-close" aria-label="Close">✕</button><video controls playsinline preload="auto"></video><div class="lr-lb-ig"></div>';
      document.body.appendChild(lb);
      lb.addEventListener('click', function (e) { if (e.target === lb || e.target.classList.contains('lr-lb-close')) closeLightbox(); });
      document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeLightbox(); });
    }
    var v = lb.querySelector('video');
    v.src = r.videoUrl;
    if (r.posterUrl) v.poster = r.posterUrl; else v.removeAttribute('poster');
    lb.querySelector('.lr-lb-ig').innerHTML = r.instagramUrl
      ? '<a class="lr-follow" href="' + esc(r.instagramUrl) + '" target="_blank" rel="noopener">' + IG_ICON + ' View on Instagram</a>' : '';
    lb.classList.add('open');
    document.documentElement.style.overflow = 'hidden';
    v.muted = false;
    var p = v.play();
    if (p && p.catch) p.catch(function () {});
  }
  function closeLightbox() {
    if (!lb || !lb.classList.contains('open')) return;
    var v = lb.querySelector('video');
    v.pause();
    v.removeAttribute('src');
    v.load();
    lb.classList.remove('open');
    document.documentElement.style.overflow = '';
  }

  function render(settings) {
    var section = document.getElementById('lora-reels');
    if (!section) return;
    var reels = (settings.reels || []).filter(function (r) { return r.active !== false && (r.videoUrl || r.instagramUrl); });
    if (settings.enabled === false || !reels.length) { section.hidden = true; return; }

    section.querySelector('.lr-title').innerHTML = esc(settings.title || 'Watch LORA').replace(/LORA/, '<span>LORA</span>');
    var sub = section.querySelector('.lr-sub');
    sub.textContent = settings.subtitle || '';
    sub.hidden = !settings.subtitle;
    var follow = section.querySelector('.lr-follow');
    if (settings.profileUrl) { follow.href = settings.profileUrl; follow.hidden = false; } else { follow.hidden = true; }

    var track = section.querySelector('.lr-track');
    track.innerHTML = '';
    reels.forEach(function (r, i) {
      var c = buildCard(r, i);
      track.appendChild(c);
      if (observer && r.videoUrl) observer.observe(c);
    });
    section.hidden = false;

    var prev = section.querySelector('.lr-prev');
    var next = section.querySelector('.lr-next');
    function step() { var c = track.querySelector('.lr-card'); return c ? c.getBoundingClientRect().width + 18 : 300; }
    function sync() {
      prev.disabled = track.scrollLeft < 8;
      next.disabled = track.scrollLeft + track.clientWidth >= track.scrollWidth - 8;
    }
    prev.onclick = function () { track.scrollBy({ left: -step() * 2, behavior: 'smooth' }); };
    next.onclick = function () { track.scrollBy({ left: step() * 2, behavior: 'smooth' }); };
    track.addEventListener('scroll', sync, { passive: true });
    window.addEventListener('resize', sync);
    sync();
  }

  function init() {
    fetch('/api/instagram-reels', { cache: 'no-store' })
      .then(function (r) { return r.json(); })
      .then(function (d) { if (d && d.success) render(d.settings || {}); })
      .catch(function () {});
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
