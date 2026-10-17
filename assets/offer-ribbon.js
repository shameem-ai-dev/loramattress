/**
 * LORA Mattress — Premium 3D Rotating Offer Ribbon (Moving Belt)
 * Fetches shared ribbon configuration and renders smooth continuous 3D belt
 */
(function () {
  'use strict';

  const STORAGE_KEY = 'lora_ribbon_settings_v1';
  const API_ENDPOINT = '/api/ribbon-settings';

  const DEFAULT_SETTINGS = {
    enabled: true,
    speedSeconds: 28,
    pauseOnHover: true,
    messages: [
      {
        id: "ribbon_1",
        tag: "FESTIVE SALE",
        text: "Get Flat 20% Off + Complimentary Orthopedic Pillow Pair with Code LORA20",
        link: "#the-collection"
      },
      {
        id: "ribbon_2",
        tag: "FACTORY DIRECT",
        text: "100% Natural Latex & Memory Foam Mattresses Direct from Factory to Your Bedroom",
        link: "#the-collection"
      },
      {
        id: "ribbon_3",
        tag: "BAJAJ FINANCING",
        text: "Bajaj EMI Assistance Available starting ₹1,833/month • Verification on request",
        link: "product.html"
      },
      {
        id: "ribbon_4",
        tag: "FREE DELIVERY",
        text: "Complimentary Flat Delivery & Unboxing Across India within 24–48 Hours",
        link: "#the-collection"
      }
    ]
  };

  function escapeHTML(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function renderRibbon(settings) {
    const ribbonEl = document.getElementById('lora-offer-ribbon');
    if (!ribbonEl) return;

    if (!settings || settings.enabled === false || !Array.isArray(settings.messages) || settings.messages.length === 0) {
      ribbonEl.classList.add('is-hidden');
      document.body.classList.remove('has-offer-ribbon');
      return;
    }

    const messages = settings.messages.filter(m => m && m.text && m.text.trim().length > 0);
    if (messages.length === 0) {
      ribbonEl.classList.add('is-hidden');
      document.body.classList.remove('has-offer-ribbon');
      return;
    }

    // Apply speed and hover behavior
    const speed = Math.max(8, Math.min(120, Number(settings.speedSeconds) || 28));
    ribbonEl.style.setProperty('--lora-ribbon-speed', `${speed}s`);

    const track = ribbonEl.querySelector('.lora-ribbon-track');
    if (!track) return;

    // Helper to generate HTML for one group of messages
    const buildGroupHTML = () => {
      return messages.map(m => {
        const tagHtml = m.tag && m.tag.trim()
          ? `<span class="lora-ribbon-tag">${escapeHTML(m.tag.trim())}</span>`
          : '';
        const href = m.link && m.link.trim() ? escapeHTML(m.link.trim()) : 'javascript:void(0);';
        return `
          <a href="${href}" class="lora-ribbon-item">
            ${tagHtml}
            <span class="lora-ribbon-text">${escapeHTML(m.text.trim())}</span>
          </a>
          <span class="lora-ribbon-divider" aria-hidden="true">◆</span>
        `;
      }).join('');
    };

    // Build seamless looping tracks (group 1 + group 2 for -50% translateX loop)
    track.innerHTML = `
      <div class="lora-ribbon-group" role="region" aria-label="Current Offers">${buildGroupHTML()}</div>
      <div class="lora-ribbon-group" aria-hidden="true">${buildGroupHTML()}</div>
    `;

    ribbonEl.classList.remove('is-hidden');
    document.body.classList.add('has-offer-ribbon');
  }

  async function initOfferRibbon() {
    // 1. Instant paint from cache
    let cached = null;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        cached = JSON.parse(stored);
      }
    } catch (e) {}

    if (cached) {
      renderRibbon(cached);
    } else {
      renderRibbon(DEFAULT_SETTINGS);
    }

    // 2. Fetch fresh config from shared API storage
    try {
      const res = await fetch(API_ENDPOINT, { cache: 'no-cache' });
      if (res.ok) {
        const data = await res.json();
        if (data && data.success && data.settings) {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(data.settings));
          renderRibbon(data.settings);
        }
      }
    } catch (err) {
      // Offline fallback: keep cached / default
    }
  }

  // Window-level hook for instant preview or updates
  window.updateLoraOfferRibbon = function (newSettings) {
    if (newSettings) {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(newSettings)); } catch (e) {}
      renderRibbon(newSettings);
    }
  };

  window.addEventListener('lora:ribbon_updated', function (e) {
    if (e.detail) {
      window.updateLoraOfferRibbon(e.detail);
    }
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initOfferRibbon);
  } else {
    initOfferRibbon();
  }
})();
