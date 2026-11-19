/**
 * LORA Mattress — Hero Sticky Offer Poster & Live Countdown Timer
 * Renders high-impact festive offer poster in/under hero section,
 * maintains live countdown clock, and docks into a sleek sticky bar on scroll.
 */

(function () {
  'use strict';

  var STORAGE_KEY = 'lora_offer_poster_v1';
  var DISMISS_KEY = 'lora_offer_dock_dismissed_v1';
  var timerInterval = null;
  var currentSettings = null;

  var DEFAULT_SETTINGS = {
    enabled: true,
    posterImage: "assets/hero-bedroom-luxury.jpg",
    badge: "LIMITED TIME FESTIVE RELEASE",
    headline: "Flat 20% Off + Complimentary Luxury Sleep Kit",
    subtext: "Shipped 100% full-size and flat across India with direct factory warranty. Use coupon code at checkout.",
    couponCode: "LORA20",
    buttonText: "Explore Festive Offers →",
    buttonLink: "#the-collection",
    stickyEnabled: true,
    timerEnabled: true,
    timerEndTime: new Date(Date.now() + 7 * 864e5).toISOString(),
    timerLabel: "Limited Deal Ends In:"
  };

  function loadSettings() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          return Object.assign({}, DEFAULT_SETTINGS, parsed);
        }
      }
    } catch (e) {}
    return Object.assign({}, DEFAULT_SETTINGS);
  }

  function fetchServerSettings() {
    fetch('/api/offer-poster', { cache: 'no-store' })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (data && data.success && data.settings) {
          currentSettings = Object.assign({}, DEFAULT_SETTINGS, data.settings);
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(currentSettings));
          } catch (e) {}
          renderOfferPoster(currentSettings);
        }
      })
      .catch(function () {});
  }

  // Format 2 digits
  function pad2(n) {
    return (n < 10 ? '0' : '') + Math.max(0, Math.floor(n));
  }

  function startCountdownClock(endTimeStr, timerEnabled) {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }

    if (!timerEnabled || !endTimeStr) {
      toggleTimerVisibility(false);
      return;
    }

    toggleTimerVisibility(true);

    var targetTime = new Date(endTimeStr).getTime();
    if (isNaN(targetTime)) {
      toggleTimerVisibility(false);
      return;
    }

    function tick() {
      var now = Date.now();
      var diff = targetTime - now;

      if (diff <= 0) {
        // Expired: hide the clock instead of showing a stale 00:00:00 (kills trust)
        setTimerDigits(0, 0, 0, 0);
        toggleTimerVisibility(false);
        if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
        return;
      }

      var days = Math.floor(diff / (1000 * 60 * 60 * 24));
      var hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
      var minutes = Math.floor((diff / (1000 * 60)) % 60);
      var seconds = Math.floor((diff / 1000) % 60);

      setTimerDigits(days, hours, minutes, seconds);
    }

    tick();
    timerInterval = setInterval(tick, 1000);
  }

  function toggleTimerVisibility(show) {
    var timerWraps = document.querySelectorAll('.lora-offer-timer-wrap, .lora-dock-timer');
    timerWraps.forEach(function (el) {
      if (show) {
        el.classList.remove('is-hidden');
      } else {
        el.classList.add('is-hidden');
      }
    });
  }

  function setTimerDigits(d, h, m, s) {
    // Main Section Digits
    var dEl = document.getElementById('poster-timer-days');
    var hEl = document.getElementById('poster-timer-hours');
    var mEl = document.getElementById('poster-timer-mins');
    var sEl = document.getElementById('poster-timer-secs');

    if (dEl) dEl.textContent = pad2(d);
    if (hEl) hEl.textContent = pad2(h);
    if (mEl) mEl.textContent = pad2(m);
    if (sEl) sEl.textContent = pad2(s);

    // Sticky Dock Digits
    var dockTimerText = document.getElementById('dock-timer-digits');
    if (dockTimerText) {
      if (d > 0) {
        dockTimerText.textContent = d + 'd ' + pad2(h) + ':' + pad2(m) + ':' + pad2(s);
      } else {
        dockTimerText.textContent = pad2(h) + ':' + pad2(m) + ':' + pad2(s);
      }
    }
  }

  function copyCouponToClipboard(code, el) {
    if (!code) return;
    navigator.clipboard.writeText(code).then(function () {
      var copyText = el.querySelector('.lora-offer-coupon-copy');
      if (copyText) {
        var prev = copyText.innerHTML;
        copyText.innerHTML = '✓ Copied!';
        copyText.style.background = '#059669';
        copyText.style.color = '#FFFFFF';
        setTimeout(function () {
          copyText.innerHTML = prev;
          copyText.style.background = '';
          copyText.style.color = '';
        }, 2200);
      }
    }).catch(function () {});
  }

  function escHtml(t) {
    return String(t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  }
  // Make the discount itself ("20% Off", "₹3000 Off", "Flat 20%") pop in the headline
  function highlightHeadline(text) {
    var safe = escHtml(text);
    return safe.replace(/((?:flat\s+)?(?:₹\s?[\d,]+|\d+\s?%)\s*off|(?:flat\s+)?\d+\s?%)/i, '<span class="highlight">$1</span>');
  }

  function showToast(msg) {
    var t = document.getElementById('lora-offer-toast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'lora-offer-toast';
      t.className = 'lora-offer-toast';
      t.setAttribute('role', 'status');
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.classList.add('is-visible');
    clearTimeout(t._h);
    t._h = setTimeout(function () { t.classList.remove('is-visible'); }, 2600);
  }

  // Clicking "Shop" auto-copies the coupon so the shopper never loses it on the way to checkout
  function claimOffer() {
    var code = currentSettings && currentSettings.couponCode;
    if (!code) return;
    try { localStorage.setItem('lora_claimed_coupon_v1', code); } catch (e) {}
    try {
      if (navigator.clipboard) navigator.clipboard.writeText(code).catch(function () {});
    } catch (e) {}
    showToast('✓ Offer unlocked — code ' + code + ' copied');
  }

  function renderOfferPoster(s) {
    var container = document.getElementById('lora-hero-offer');
    var dock = document.getElementById('lora-sticky-offer-dock');
    var launcher = document.getElementById('lora-offer-launcher-btn');

    if (!s || s.enabled === false) {
      if (container) container.classList.add('is-hidden');
      if (dock) dock.classList.add('is-hidden');
      if (launcher) launcher.classList.remove('is-active');
      if (timerInterval) clearInterval(timerInterval);
      return;
    }

    if (container) container.classList.remove('is-hidden');
    if (dock) dock.classList.remove('is-hidden');

    // 1. Update Main Poster Card
    var badgeEl = document.getElementById('poster-card-badge');
    var headlineEl = document.getElementById('poster-card-headline');
    var subtextEl = document.getElementById('poster-card-subtext');
    var imgEl = document.getElementById('poster-card-img');
    var ctaEl = document.getElementById('poster-card-cta');
    var codeEl = document.getElementById('poster-card-coupon');
    var timerLabelEl = document.getElementById('poster-card-timer-label');

    if (badgeEl) badgeEl.textContent = s.badge || 'LIMITED TIME OFFER';
    if (headlineEl) headlineEl.innerHTML = highlightHeadline(s.headline || 'Exclusive Factory Offer');
    if (subtextEl) subtextEl.textContent = s.subtext || '';
    if (imgEl && s.posterImage) {
      imgEl.src = s.posterImage;
      var frameEl = imgEl.closest('.lora-offer-poster-frame');
      if (frameEl) frameEl.style.setProperty('--lop-poster-bg', 'url("' + String(s.posterImage).replace(/"/g, '%22') + '")');
      imgEl.alt = s.headline || 'LORA Mattress Offer Poster';
    }
    if (ctaEl) {
      ctaEl.textContent = s.buttonText || 'Claim Offer →';
      ctaEl.href = s.buttonLink || '#the-collection';
    }
    if (codeEl) codeEl.textContent = s.couponCode || 'LORA20';
    if (timerLabelEl) timerLabelEl.textContent = s.timerLabel || 'Limited Deal Ends In:';

    // 2. Update Sticky Dock Elements
    var dockImg = document.getElementById('dock-thumb-img');
    var dockTitle = document.getElementById('dock-title-text');
    var dockCode = document.getElementById('dock-coupon-code');
    var dockCta = document.getElementById('dock-cta-btn');

    if (dockImg && s.posterImage) dockImg.src = s.posterImage;
    if (dockTitle) dockTitle.textContent = s.headline || 'Exclusive Festive Offer';
    if (dockCode) dockCode.textContent = s.couponCode || 'LORA20';
    if (dockCta) {
      dockCta.textContent = s.buttonText || 'Claim →';
      dockCta.href = s.buttonLink || '#the-collection';
    }

    // 3. Start Timer Clock
    startCountdownClock(s.timerEndTime, s.timerEnabled);
  }

  function setupScrollPersistence() {
    var dock = document.getElementById('lora-sticky-offer-dock');
    var launcher = document.getElementById('lora-offer-launcher-btn');
    var mainSection = document.getElementById('lora-hero-offer');

    if (!dock) return;

    var dismissed = false;
    try {
      dismissed = sessionStorage.getItem(DISMISS_KEY) === 'true';
    } catch (e) {}

    function checkScroll() {
      if (!currentSettings || !currentSettings.enabled || !currentSettings.stickyEnabled) {
        dock.classList.remove('is-visible');
        if (launcher) launcher.classList.remove('is-active');
        return;
      }

      var triggerPoint = 420;
      if (mainSection) {
        var rect = mainSection.getBoundingClientRect();
        triggerPoint = rect.bottom < 100;
      } else {
        triggerPoint = window.scrollY > 450;
      }

      if (triggerPoint) {
        if (!dismissed) {
          dock.classList.add('is-visible');
          if (launcher) launcher.classList.remove('is-active');
        } else {
          dock.classList.remove('is-visible');
          if (launcher) launcher.classList.add('is-active');
        }
      } else {
        dock.classList.remove('is-visible');
        if (launcher) launcher.classList.remove('is-active');
      }
    }

    window.addEventListener('scroll', checkScroll, { passive: true });
    window.addEventListener('resize', checkScroll, { passive: true });
    checkScroll();

    // Close button dismisses dock and summons floating pill
    var closeBtn = document.getElementById('dock-close-btn');
    if (closeBtn) {
      closeBtn.addEventListener('click', function (e) {
        e.preventDefault();
        dismissed = true;
        try { sessionStorage.setItem(DISMISS_KEY, 'true'); } catch (err) {}
        dock.classList.remove('is-visible');
        if (launcher) launcher.classList.add('is-active');
      });
    }

    // Launcher pill restores full dock
    if (launcher) {
      launcher.addEventListener('click', function () {
        dismissed = false;
        try { sessionStorage.removeItem(DISMISS_KEY); } catch (err) {}
        launcher.classList.remove('is-active');
        dock.classList.add('is-visible');
      });
    }
  }

  function init() {
    currentSettings = loadSettings();
    renderOfferPoster(currentSettings);
    setupScrollPersistence();
    fetchServerSettings();

    // Copy coupon on click
    var couponPill = document.getElementById('poster-coupon-pill');
    if (couponPill) {
      couponPill.addEventListener('click', function () {
        var code = currentSettings ? currentSettings.couponCode : 'LORA20';
        copyCouponToClipboard(code, couponPill);
      });
    }

    ['poster-card-cta', 'dock-cta-btn'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.addEventListener('click', claimOffer);
    });
    if (couponPill) {
      couponPill.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); couponPill.click(); }
      });
    }
    var posterImg = document.getElementById('poster-card-img');
    if (posterImg) posterImg.addEventListener('error', function () {
      if (posterImg.src.indexOf('hero-bedroom-luxury.jpg') === -1) posterImg.src = 'assets/hero-bedroom-luxury.jpg';
    });

    // Cross-tab synchronization
    window.addEventListener('storage', function (e) {
      if (e.key === STORAGE_KEY) {
        try {
          var updated = JSON.parse(e.newValue);
          if (updated) {
            currentSettings = Object.assign({}, DEFAULT_SETTINGS, updated);
            renderOfferPoster(currentSettings);
          }
        } catch (err) {}
      }
    });

    // Custom in-page dispatch
    window.addEventListener('lora:offer_poster_updated', function (e) {
      if (e.detail) {
        currentSettings = Object.assign({}, DEFAULT_SETTINGS, e.detail);
        renderOfferPoster(currentSettings);
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.LoraOfferPoster = {
    getSettings: function () { return currentSettings; },
    refresh: fetchServerSettings
  };
})();
