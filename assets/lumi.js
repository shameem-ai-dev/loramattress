/**
 * LUMI — LORA's AI SLEEP ASSISTANT (VERSION 2.0)
 * Grounded in Lora Mattress Complete Carousel Baseline (8 Approved Models)
 * Features Trilingual Support (EN / മലയാളം / Manglish), Live Catalog Pricing & Verified Specifications
 */

(function () {
  'use strict';

  // Storage Keys
  const SESSION_GREETING_KEY = 'lora_lumi_greeted_v2';
  const STORE_LEADS_STORAGE_KEY = 'lora_store_leads_v1';
  const LUMI_LANG_KEY = 'lora_lumi_preferred_lang_v2';

  // Product Master Reference (Version 2.0 Baseline)
  const PRODUCTS_2_0 = {
    '01': { id: '01', name: 'LORA CLOUD 7™', feel: 'Medium-Soft', height: '7 inches', warranty: '3 years', type: 'Eurotop comfort' },
    '02': { id: '02', name: 'LORA CLOUD ORTHO™', feel: 'Medium', height: '9 inches', warranty: '5 years', type: 'Eurotop comfort' },
    '03': { id: '03', name: 'LORA PLUSH™', feel: 'Plush / Soft', height: 'Unconfirmed', warranty: '5 years', type: 'Pillow top' },
    '04': { id: '04', name: 'LORA ORTHO HYBRID™', feel: 'Medium-Firm', height: 'Unconfirmed', warranty: '10 years', type: 'Hybrid ortho-support' },
    '05': { id: '05', name: 'LORA ORTHO LATEX™', feel: 'Medium-Firm', height: 'Unconfirmed', warranty: '12 years', type: 'Latex comfort with ortho positioning' },
    '06': { id: '06', name: 'LORA COMFORT CORE™', feel: 'Medium', height: 'Unconfirmed', warranty: '10 years', type: 'Pillow top balanced comfort' },
    '07': { id: '07', name: 'LORA POCKET LUXE™', feel: 'Medium', height: 'Unconfirmed', warranty: '10 years', type: 'Pocket support technology with pillow top' },
    '08': { id: '08', name: 'LORA HYBRID FUSION™', feel: 'Medium-Firm', height: 'Unconfirmed', warranty: '15 years', type: 'Hybrid multi-layer support' }
  };

  // State Management
  const state = {
    isOpen: false,
    hasGreeted: false,
    isThinking: false,
    history: [],
    currentLang: localStorage.getItem(LUMI_LANG_KEY) || 'en', // 'en', 'ml', 'manglish'
    leadStep: null, // null = idle, 'phone' = awaiting mobile number, 'pin' = awaiting PIN code
    pinPurpose: null, // 'delivery' when the customer only wants a delivery check (no callback)
    leadSubmitted: false,
    lastSubmittedKey: '',
    pendingLeadCardId: null,
    leadData: {
      name: '',
      place: '',
      pincode: '',
      phone: '',
      preferredMattress: '',
      preferredSize: '',
      preferredThickness: '',
      summary: ''
    }
  };

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------
  const SUPPORT_PHONE = '9072616423'; // Lora's own support line — never treat it as a customer's number
  const LEAD_SESSION_KEY = 'lora_lumi_lead_v1';
  const DEFAULT_PILLS = ['Which is best for back pain?', 'Zero motion for couples?', 'Check Prices', 'Request Specialist Call'];
  const MODEL_NAME_ALIASES = [
    ['cloud ortho', '02'], ['cloudortho', '02'], ['cloud 7', '01'], ['cloud7', '01'], ['cloud-7', '01'],
    ['ortho hybrid', '04'], ['ortho latex', '05'], ['comfort core', '06'], ['pocket luxe', '07'],
    ['hybrid fusion', '08'], ['plush', '03']
  ];

  // Local intents (handled instantly in the browser so quick-reply pills can never loop)
  const RE_DIRECT_CALL = /^(call\s*\+?\s*91|support contact|നേരിട്ട് വിളിക്കുക)/i;
  const RE_LEAD = /(share (contact|phone|my number|number)|enter (phone|mobile)|request (a )?(specialist )?call|request callback|call ?back|call me|talk to (a )?(specialist|team|someone|human|expert)|speak to|consult(ation)? (team|call)|team callback|specialist call|lora team|സ്പെഷ്യലിസ്റ്റ് കോൾ|ഫോൺ (നമ്പർ )?നൽകുക|കൺസൾട്ടേഷൻ കോൾ|ടീം വിളിക്കണോ|\bvilik|വിളിക്കാമോ|വിളിക്കുമോ)/i;
  const RE_PIN = /^(check( my)? pin ?code( delivery)?|enter pin ?code|pin ?code|check delivery|പിൻകോഡ് നൽകുക)/i;
  const RE_UPDATE = /^update my (number|details)/i;
  const RE_SKIP = /^(skip|no|cancel|venda|not now|no thanks|chat with lumi|സ്കിപ്പ് ചെയ്യുക)$/i;
  const RE_ORDER = /^(order|buy|view)\s+(.+)/i;
  const RE_ALL_MODELS = /^((view|explore|see)( all)?( 8)? (models|mattresses)|എല്ലാ മോഡലുകളും കാണുക)$/i;

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function resolveModelId(input) {
    if (!input) return null;
    if (typeof input === 'object') {
      if (input.id && PRODUCTS_2_0[input.id]) return input.id;
      input = input.name || '';
    }
    const lower = String(input).toLowerCase();
    for (const [alias, id] of MODEL_NAME_ALIASES) {
      if (lower.includes(alias)) return id;
    }
    return null;
  }

  function productUrl(id) {
    return 'product.html?model=' + encodeURIComponent(id);
  }

  function currentModelId() {
    try {
      const m = new URLSearchParams(window.location.search).get('model');
      if (m && PRODUCTS_2_0[m] && /product/i.test(window.location.pathname)) return m;
    } catch (e) {}
    return null;
  }

  function isHomePage() {
    return !!document.getElementById('the-collection');
  }

  // Navigate to a product page (or just reveal it if the customer is already on it)
  function goToProduct(id) {
    if (!id || !PRODUCTS_2_0[id]) return false;
    if (currentModelId() === id) {
      toggleChat(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return true;
    }
    window.location.href = productUrl(id);
    return true;
  }

  function goToCollection() {
    const section = document.getElementById('the-collection');
    if (section) {
      toggleChat(false);
      section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      window.location.href = 'index.html#the-collection';
    }
  }

  function loadLeadSession() {
    try {
      const saved = JSON.parse(sessionStorage.getItem(LEAD_SESSION_KEY) || 'null');
      if (saved) {
        state.leadData.phone = saved.phone || '';
        state.leadData.pincode = saved.pincode || '';
        state.leadSubmitted = !!saved.submitted;
        state.lastSubmittedKey = saved.key || '';
      }
    } catch (e) {}
  }

  function saveLeadSession() {
    try {
      sessionStorage.setItem(LEAD_SESSION_KEY, JSON.stringify({
        phone: state.leadData.phone,
        pincode: state.leadData.pincode,
        submitted: state.leadSubmitted,
        key: state.lastSubmittedKey
      }));
    } catch (e) {}
  }

  function normalizePhone(raw) {
    let d = String(raw || '').replace(/\D/g, '');
    if (d.length === 12 && d.startsWith('91')) d = d.slice(2);
    if (d.length === 11 && d.startsWith('0')) d = d.slice(1);
    return /^[6-9]\d{9}$/.test(d) && d !== SUPPORT_PHONE ? d : null;
  }

  function pincodeDelivery(pin) {
    const p2 = String(pin).slice(0, 2);
    let hub = 'our Pan-India delivery network';
    let days = '3 to 5 business days';
    if (p2 === '56') { hub = 'our Bengaluru Hub'; days = '1 to 2 business days'; }
    else if (p2 >= '67' && p2 <= '69') { hub = 'our Kerala & Kochi Hub'; days = '2 to 3 business days'; }
    else if (p2 === '40' || p2 === '41') { hub = 'our Mumbai & Pune Hub'; days = '2 to 3 business days'; }
    else if (['11', '12', '20'].includes(p2)) { hub = 'our Delhi NCR Hub'; days = '2 to 4 business days'; }
    else if (p2 === '60') { hub = 'our Chennai Hub'; days = '2 to 3 business days'; }
    else if (p2 === '50') { hub = 'our Hyderabad Hub'; days = '2 to 3 business days'; }
    return { hub, days };
  }

  loadLeadSession();

  // Helper to extract currently viewed mattress context from PDP
  function getPageContext() {
    let productName = null;
    let size = null;
    let thickness = null;

    const titleEl = document.querySelector('.pdp-title, #product-title, h1.product-title, .pdp-product-name');
    if (titleEl && titleEl.textContent.trim()) {
      productName = titleEl.textContent.trim();
    } else {
      const urlParams = new URLSearchParams(window.location.search);
      const modelParam = urlParams.get('model');
      if (modelParam && PRODUCTS_2_0[modelParam]) {
        productName = PRODUCTS_2_0[modelParam].name;
      }
    }

    const activeSizeBtn = document.querySelector('.pdp-size-btn.active, .size-pill.active, [data-size].active');
    if (activeSizeBtn) {
      size = activeSizeBtn.getAttribute('data-size') || activeSizeBtn.textContent.trim();
    }

    const activeThickBtn = document.querySelector('.pdp-thick-btn.active, .thickness-pill.active, [data-thickness].active');
    if (activeThickBtn) {
      thickness = activeThickBtn.getAttribute('data-thickness') || activeThickBtn.textContent.trim();
    }

    return { productName, size, thickness, url: window.location.href };
  }

  // Inject HTML Structure
  function initWidgetDOM() {
    if (document.getElementById('lumi-widget')) return;

    const container = document.createElement('div');
    container.id = 'lumi-widget';
    container.className = 'lumi-widget-container';

    container.innerHTML = `
      <!-- Speech Greeting Bubble (once per session) -->
      <div class="lumi-greeting-bubble" id="lumi-greeting" style="display: none;">
        <p class="lumi-greeting-text">
          <strong>Hi, I’m Lumi!</strong> Need help choosing your perfect mattress?
        </p>
        <button type="button" class="lumi-greeting-close" id="lumi-dismiss-greeting" aria-label="Dismiss greeting">✕</button>
      </div>

      <!-- 3D Luxury Bed & Lumi Character Launcher -->
      <button type="button" class="lumi-launcher-btn" id="lumi-launcher" aria-label="Open Lumi Sleep Guide">
        <!-- Ambient Floor Contact Shadow -->
        <div class="lumi-mattress-shadow"></div>

        <!-- Unmistakable Luxury Bed Stage (Headboard, 2 Pillows, Quilted Mattress, Bed Frame & Legs) -->
        <div class="lumi-mattress-stage">
          <svg class="lumi-mattress-svg" viewBox="0 0 100 85" fill="none" xmlns="http://www.w3.org/2000/svg">
            <!-- Floor Shadow -->
            <ellipse cx="50" cy="74" rx="40" ry="8" fill="rgba(0, 0, 0, 0.55)"/>

            <!-- Bed Frame Legs -->
            <rect x="19" y="65" width="4" height="8" rx="1.5" fill="#0A1124" stroke="#1E293B" stroke-width="0.8"/>
            <rect x="77" y="65" width="4" height="8" rx="1.5" fill="#0A1124" stroke="#1E293B" stroke-width="0.8"/>
            
            <!-- Bed Base Platform -->
            <path d="M16 58 L84 58 L82 66 L18 66 Z" fill="#0F172A" stroke="#1E293B" stroke-width="1"/>

            <!-- Luxury Upholstered Headboard -->
            <rect x="20" y="10" width="60" height="34" rx="6" fill="url(#lumiHbGrad)" stroke="#38BDF8" stroke-width="1" stroke-opacity="0.6"/>
            <!-- Headboard Channel Seams -->
            <line x1="35" y1="12" x2="35" y2="38" stroke="#0F172A" stroke-width="1.2"/>
            <line x1="50" y1="11" x2="50" y2="38" stroke="#0F172A" stroke-width="1.2"/>
            <line x1="65" y1="12" x2="65" y2="38" stroke="#0F172A" stroke-width="1.2"/>

            <!-- Two Fluffy Sleeping Pillows Propped at the Head of the Bed -->
            <!-- Left Pillow -->
            <g>
              <rect x="25" y="24" width="22" height="13" rx="4" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="0.8"/>
              <path d="M31 30 Q36 32 41 30" stroke="#94A3B8" stroke-width="0.8" fill="none" stroke-linecap="round"/>
            </g>
            <!-- Right Pillow -->
            <g>
              <rect x="53" y="24" width="22" height="13" rx="4" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="0.8"/>
              <path d="M59 30 Q64 32 69 30" stroke="#94A3B8" stroke-width="0.8" fill="none" stroke-linecap="round"/>
            </g>

            <!-- White Quilted Mattress Surface -->
            <path d="M22 34 L78 34 L85 54 L15 54 Z" fill="url(#lumiMatTop)" stroke="#E2E8F0" stroke-width="0.8"/>
            <!-- Gentle Tufting Accents -->
            <circle cx="36" cy="42" r="1.1" fill="#0284C7" opacity="0.4"/>
            <circle cx="50" cy="40" r="1.1" fill="#0284C7" opacity="0.4"/>
            <circle cx="64" cy="42" r="1.1" fill="#0284C7" opacity="0.4"/>

            <!-- Mattress Front Drop & Edge Piping -->
            <path d="M15 54 L85 54 L84 60 L16 60 Z" fill="#F8FAFC" stroke="#CBD5E1" stroke-width="0.8"/>
            <line x1="15" y1="54" x2="85" y2="54" stroke="#38BDF8" stroke-width="1" stroke-opacity="0.75"/>

            <!-- Cozy Duvet Runner Fold (Bottom Edge of Mattress) -->
            <path d="M16 47 L84 47 L85 55 L15 55 Z" fill="url(#lumiDuvetGrad)" stroke="rgba(56, 189, 248, 0.35)" stroke-width="0.7"/>

            <defs>
              <linearGradient id="lumiHbGrad" x1="50" y1="10" x2="50" y2="44" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stop-color="#1E293B"/>
                <stop offset="100%" stop-color="#0A1124"/>
              </linearGradient>
              <linearGradient id="lumiMatTop" x1="50" y1="34" x2="50" y2="54" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stop-color="#FFFFFF"/>
                <stop offset="100%" stop-color="#F1F5F9"/>
              </linearGradient>
              <linearGradient id="lumiDuvetGrad" x1="50" y1="47" x2="50" y2="55" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stop-color="#0284C7" stop-opacity="0.85"/>
                <stop offset="100%" stop-color="#0369A1" stop-opacity="0.95"/>
              </linearGradient>
            </defs>
          </svg>
        </div>

        <!-- Lumi Ghost Mascot Floating Gently Above Bed -->
        <div class="lumi-character-sprite">
          <svg viewBox="0 0 60 70" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M30 6 C16 6, 8 16, 8 32 C8 46, 12 58, 16 62 C20 66, 26 58, 30 62 C34 58, 40 66, 44 62 C48 58, 52 46, 52 32 C52 16, 44 6, 30 6 Z"
                  fill="url(#lumiBodyGrad)"
                  stroke="#38BDF8"
                  stroke-width="1.6"
                  stroke-opacity="0.85"/>
            <!-- Sleep Cowlick Accent -->
            <path d="M28 6 C28 3, 34 2, 36 5 C38 8, 34 9, 32 9 Z" fill="#BAE6FD" opacity="0.9"/>
            <!-- Expressive Friendly Eyes -->
            <ellipse cx="23" cy="28" rx="3.5" ry="4.5" fill="#0B132B"/>
            <circle cx="24.5" cy="26.5" r="1.5" fill="#FFFFFF"/>
            <circle cx="22" cy="29.5" r="0.75" fill="#38BDF8"/>
            <ellipse cx="37" cy="28" rx="3.5" ry="4.5" fill="#0B132B"/>
            <circle cx="38.5" cy="26.5" r="1.5" fill="#FFFFFF"/>
            <circle cx="36" cy="29.5" r="0.75" fill="#38BDF8"/>
            <!-- Warm Smile -->
            <path d="M25 35.5 C27.5 39.5, 32.5 39.5, 35 35.5" stroke="#0B132B" stroke-width="2" stroke-linecap="round"/>
            <!-- Soft Rosy Cheeks -->
            <ellipse cx="17" cy="34" rx="3.2" ry="1.9" fill="rgba(244, 114, 182, 0.5)"/>
            <ellipse cx="43" cy="34" rx="3.2" ry="1.9" fill="rgba(244, 114, 182, 0.5)"/>
            <!-- Cute Floating Tiny Arms -->
            <path d="M10 33 C6 34.5, 7 38.5, 11 38" stroke="#94A3B8" stroke-width="1.6" stroke-linecap="round"/>
            <path d="M50 33 C54 34.5, 53 38.5, 49 38" stroke="#94A3B8" stroke-width="1.6" stroke-linecap="round"/>

            <defs>
              <linearGradient id="lumiBodyGrad" x1="10" y1="6" x2="50" y2="65" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stop-color="#FFFFFF"/>
                <stop offset="60%" stop-color="#F0F9FF"/>
                <stop offset="100%" stop-color="#BAE6FD"/>
              </linearGradient>
            </defs>
          </svg>
        </div>

        <span class="lumi-status-badge" title="Lumi Sleep Guide is online"></span>
      </button>

      <!-- Lumi Chat Panel -->
      <div class="lumi-chat-panel" id="lumi-chat-panel">
        <!-- Header -->
        <div class="lumi-chat-header">
          <div class="lumi-header-info">
            <div class="lumi-avatar-mini">
              <svg viewBox="0 0 60 70" fill="none">
                <path d="M30 6 C16 6, 8 16, 8 32 C8 46, 12 58, 16 62 C20 66, 26 58, 30 62 C34 58, 40 66, 44 62 C48 58, 52 46, 52 32 C52 16, 44 6, 30 6 Z" fill="#FFFFFF"/>
                <ellipse cx="23" cy="28" rx="3" ry="4" fill="#0B132B"/><circle cx="24" cy="27" r="1" fill="#FFFFFF"/>
                <ellipse cx="37" cy="28" rx="3" ry="4" fill="#0B132B"/><circle cx="38" cy="27" r="1" fill="#FFFFFF"/>
                <path d="M26 36 C28 39, 32 39, 34 36" stroke="#0B132B" stroke-width="2" stroke-linecap="round"/>
              </svg>
              <span class="lumi-avatar-online-dot"></span>
            </div>
            <div>
              <h4 class="lumi-header-title">
                Lumi
                <span class="lumi-header-badge">Sleep Guide</span>
              </h4>
              <p class="lumi-header-sub">
                <span>Lora Sleep-Tech</span> • <span id="lumi-header-lang-display">EN / മലയാളം / Manglish</span>
              </p>
            </div>
          </div>
          
          <div class="lumi-header-actions">
            <!-- Language Quick Switcher -->
            <div class="lumi-lang-selector" id="lumi-lang-selector" title="Select response tone">
              <button type="button" class="lumi-lang-btn ${state.currentLang === 'en' ? 'active' : ''}" data-lang="en">EN</button>
              <button type="button" class="lumi-lang-btn ${state.currentLang === 'ml' ? 'active' : ''}" data-lang="ml">മല</button>
              <button type="button" class="lumi-lang-btn ${state.currentLang === 'manglish' ? 'active' : ''}" data-lang="manglish">Man</button>
            </div>
            <button type="button" class="lumi-chat-reset-btn" id="lumi-reset-chat" title="Clear conversation" aria-label="Clear chat">↺</button>
            <button type="button" class="lumi-chat-close-btn" id="lumi-close-chat" aria-label="Close Chat">✕</button>
          </div>
        </div>

        <!-- Currently Viewed Mattress Context Strip with Questions Toggle -->
        <div class="lumi-context-strip" id="lumi-context-strip">
          <span class="lumi-context-label">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px; margin-right:3px;"><path d="M2 4v16M22 4v16M2 10h20M2 16h20M4 10V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v4"/></svg>
            <strong id="lumi-context-product">LORA CLOUD 7™</strong>
          </span>
          <div style="display: flex; gap: 5px; align-items: center;">
            <button type="button" class="lumi-questions-toggle-btn" id="lumi-toggle-questions" title="Browse possible questions to ask Lumi"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-1px; margin-right:3px;"><path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-7 7c0 3 2 5 3 6h8c1-1 3-3 3-6a7 7 0 0 0-7-7z"/></svg> Possible Questions</button>
            <button type="button" class="lumi-context-action" id="lumi-btn-check-pin">Check Pincode</button>
          </div>
        </div>

        <!-- Categorized Possible Questions Drawer -->
        <div class="lumi-questions-tray" id="lumi-questions-tray" style="display: none;">
          <div>
            <div class="lumi-q-category-title">Sleep Health & Back Support</div>
            <div class="lumi-q-chip-grid">
              <button type="button" class="lumi-q-chip" onclick="window.LoraLumi.ask('Which mattress is best for severe back pain and spine support?')">Best for back pain?</button>
              <button type="button" class="lumi-q-chip" onclick="window.LoraLumi.ask('Which mattress has zero partner motion disturbance for couples?')">Zero partner disturbance?</button>
              <button type="button" class="lumi-q-chip" onclick="window.LoraLumi.ask('Which is the coolest, most breathable mattress for hot sleepers?')">Coolest & breathable?</button>
              <button type="button" class="lumi-q-chip" onclick="window.LoraLumi.ask('I am a side sleeper, which mattress gives best shoulder pressure relief?')">Side sleeper recommendation?</button>
            </div>
          </div>
          <div>
            <div class="lumi-q-category-title">The 8 Models & Comparisons</div>
            <div class="lumi-q-chip-grid">
              <button type="button" class="lumi-q-chip" onclick="window.LoraLumi.ask('Compare Cloud 7 vs Cloud Ortho')">Cloud 7 vs Cloud Ortho</button>
              <button type="button" class="lumi-q-chip" onclick="window.LoraLumi.ask('Compare Ortho Hybrid vs Ortho Latex')">Ortho Hybrid vs Ortho Latex</button>
              <button type="button" class="lumi-q-chip" onclick="window.LoraLumi.ask('Tell me about LORA Plush soft comfort')">LORA Plush feel</button>
              <button type="button" class="lumi-q-chip" onclick="window.LoraLumi.ask('Tell me about Hybrid Fusion 15-Year flagship')">Hybrid Fusion 15-Yr</button>
            </div>
          </div>
          <div>
            <div class="lumi-q-category-title">Delivery, Sizing & Guarantees</div>
            <div class="lumi-q-chip-grid">
              <button type="button" class="lumi-q-chip" onclick="window.LoraLumi.ask('Why is LORA full-size flat delivery better than compressed rolled box?')">Why flat delivery?</button>
              <button type="button" class="lumi-q-chip" onclick="window.LoraLumi.ask('What standard sizes and custom dimensions can you make?')">Sizing & Custom fit</button>
              <button type="button" class="lumi-q-chip" onclick="window.LoraLumi.ask('What is the 15-year warranty and factory guarantee coverage?')">15-Year Warranty</button>
              <button type="button" class="lumi-q-chip" onclick="window.LoraLumi.ask('What payment methods are accepted?')">Payment Options</button>
              <button type="button" class="lumi-q-chip" onclick="window.LoraLumi.requestLeadCard()">Request Specialist Call</button>
            </div>
          </div>
        </div>

        <!-- Messages Area -->
        <div class="lumi-chat-messages" id="lumi-messages"></div>

        <!-- Quick Options Row -->
        <div class="lumi-quick-options-row" id="lumi-quick-options" style="padding: 6px 14px;"></div>

        <!-- Error Retry Container (Hidden by default) -->
        <div id="lumi-retry-container" style="display: none; padding: 0 14px 6px 14px;">
          <div class="lumi-retry-bar">
            <span>Connection paused. Tap to retry.</span>
            <button type="button" class="lumi-retry-btn" id="lumi-retry-btn">Retry ↻</button>
          </div>
        </div>

        <!-- Input Bar -->
        <form class="lumi-chat-input-bar" id="lumi-chat-form">
          <input type="text"
                 id="lumi-user-input"
                 class="lumi-input-field"
                 placeholder="Ask Lumi about firmness, warranty, sizes..."
                 autocomplete="off">
          <button type="submit" class="lumi-send-btn" id="lumi-send-btn" aria-label="Send message">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <line x1="22" y1="2" x2="11" y2="13"/>
              <polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
          </button>
        </form>
      </div>
    `;

    document.body.appendChild(container);
    bindEvents();
    checkGreetingSession();
    updateContextDisplay();

    // Support direct open via ?lumi=1 or #lumi
    try {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('lumi') === '1' || window.location.hash === '#lumi') {
        setTimeout(() => toggleChat(true), 400);
      }
    } catch (e) {}
  }

  // Update context strip based on current page
  function updateContextDisplay() {
    const ctx = getPageContext();
    const ctxProduct = document.getElementById('lumi-context-product');
    if (ctxProduct) {
      if (ctx.productName) {
        ctxProduct.textContent = `${ctx.productName}${ctx.size ? ' • ' + ctx.size : ''}`;
      } else {
        ctxProduct.textContent = 'LORA Mattress Guide • 8 Models Available';
      }
    }
  }

  // Check once-per-session greeting
  function checkGreetingSession() {
    try {
      const alreadyGreeted = sessionStorage.getItem(SESSION_GREETING_KEY);
      if (!alreadyGreeted) {
        setTimeout(() => {
          if (!state.isOpen) {
            const bubble = document.getElementById('lumi-greeting');
            if (bubble) bubble.style.display = 'flex';
            sessionStorage.setItem(SESSION_GREETING_KEY, 'true');
          }
        }, 1800);
      }
    } catch (e) {}
  }

  // Toggle Chat
  function toggleChat(forceState) {
    state.isOpen = typeof forceState === 'boolean' ? forceState : !state.isOpen;
    const widget = document.getElementById('lumi-widget');
    const bubble = document.getElementById('lumi-greeting');

    if (widget) {
      if (state.isOpen) {
        widget.classList.add('is-active');
        if (bubble) bubble.style.display = 'none';

        // Initial welcome message if conversation is empty
        if (state.history.length === 0) {
          sendWelcomeMessage();
        }

        if (window.innerWidth > 768) {
          setTimeout(() => {
            const inp = document.getElementById('lumi-user-input');
            if (inp) inp.focus();
          }, 200);
        }
      } else {
        widget.classList.remove('is-active');
      }
    }
  }

  // Initial Welcome Message
  function sendWelcomeMessage() {
    const ctx = getPageContext();
    if (state.currentLang === 'ml') {
      appendMessage(
        'assistant',
        `നമസ്കാരം! ഞാൻ ലൂമി, ലോറയുടെ സ്ലീപ്പ് ഗൈഡ് \n\nനിങ്ങൾക്ക് ഏറ്റവും അനുയോജ്യമായ മെത്ത കണ്ടെത്താനും വാറന്റി, അളവുകൾ, ഡെലിവറി എന്നിവ പരിശോധിക്കാനും സഹായിക്കാം.${ctx.productName ? ` നിങ്ങൾ ഇപ്പോൾ കാണുന്നത് **${ctx.productName}** ആണ്.` : ''}`
      );
      renderQuickOptions(['നടുവേദനയ്ക്ക് ഏതാണ് നല്ലത്?', 'കപ്പിൾസ് മെത്ത (Zero Motion)', 'ക്ലൗഡ് 7 vs ക്ലൗഡ് ഓർത്തോ', 'ഫ്ലാറ്റ് ഡെലിവറി എന്തുകൊണ്ട്?', 'സ്പെഷ്യലിസ്റ്റ് കോൾ']);
    } else if (state.currentLang === 'manglish') {
      appendMessage(
        'assistant',
        `Namaskaram! Njan Lumi, Lora's Sleep Guide \n\nNingalkku perfect mattress find cheyyaan, warranty, size and flat delivery check cheyyaan njan help cheyyam. ${ctx.productName ? ` You are currently exploring **${ctx.productName}**.` : ''}`
      );
      renderQuickOptions(['Best for back pain?', 'Zero motion for couples?', 'Compare Cloud 7 vs Cloud Ortho', 'Why flat delivery?', 'Request Specialist Call']);
    } else {
      appendMessage(
        'assistant',
        `Hello! I’m Lumi, your personal Lora sleep guide \n\nI can help you explore our 8 handcrafted models, compare firmness feels, check warranties, review bed sizing, or arrange a direct factory consultation.${ctx.productName ? ` You're currently exploring **${ctx.productName}**.` : ''}`
      );
      renderQuickOptions(['Which is best for back pain?', 'Zero motion for couples?', 'Compare Cloud 7 vs Cloud Ortho', 'Why flat delivery?', 'Request Specialist Call']);
    }
  }

  // Append a message bubble (supports optional interactive product card / lead card)
  function appendMessage(sender, text, card) {
    const messagesEl = document.getElementById('lumi-messages');
    if (!messagesEl) return;

    state.history.push({ sender, text, card: card && card.name ? { id: card.id, name: card.name } : null });

    const row = document.createElement('div');
    row.className = `lumi-msg-row ${sender}`;

    // Escape first (user text and server text are untrusted), then apply the tiny markdown subset
    const formattedText = escapeHtml(text || '')
      .replace(/\n\n/g, '<br><br>')
      .replace(/\n/g, '<br>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

    let cardHtml = '';
    if (card && card.name) {
      const pid = resolveModelId(card);
      const shortName = escapeHtml(String(card.name).replace(/^LORA\s+/i, ''));
      const onThisPage = pid && pid === currentModelId();
      const actions = pid
        ? `<div class="lumi-card-actions">
            <a class="lumi-card-btn" href="${productUrl(pid)}" data-lumi-action="open-product" data-model="${pid}">
              ${onThisPage ? 'You’re viewing this — see details ↑' : `Explore ${shortName} →`}
            </a>
            <button type="button" class="lumi-card-btn-ghost" data-lumi-action="ask" data-q="${escapeHtml('Price for ' + String(card.name).replace(/^LORA\s+/i, ''))}">Check price</button>
          </div>`
        : `<button type="button" class="lumi-card-btn" data-lumi-action="ask" data-q="${escapeHtml('Tell me more about ' + card.name)}">Explore ${shortName} →</button>`;
      cardHtml = `
        <div class="lumi-product-card-embed">
          <div class="lumi-card-header">
            <span class="lumi-card-tag">${escapeHtml(card.type || 'Mattress')}</span>
            ${card.warranty ? `<span class="lumi-card-warranty"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-1px; margin-right:3px;"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg> ${escapeHtml(card.warranty)} Warranty</span>` : ''}
          </div>
          <h5 class="lumi-card-title">${escapeHtml(card.name)}</h5>
          <div class="lumi-card-specs">
            <span class="lumi-spec-pill">Feel: <strong>${escapeHtml(card.feel || 'Balanced')}</strong></span>
            ${card.height && card.height !== 'Unconfirmed' ? `<span class="lumi-spec-pill">Height: <strong>${escapeHtml(card.height)}</strong></span>` : ''}
            ${card.price ? `<span class="lumi-spec-pill lumi-spec-price">Price: <strong>${escapeHtml(card.price)}</strong></span>` : ''}
          </div>
          ${actions}
        </div>
      `;
    }

    const leadCardHtml = (card && (card.showLeadCard || card.suggestLead)) ? buildLeadCardHtml(card.leadMode || nextLeadMode()) : '';

    row.innerHTML = `<div class="lumi-msg-bubble">${formattedText}${cardHtml}${leadCardHtml}</div>`;
    messagesEl.appendChild(row);
    messagesEl.scrollTop = messagesEl.scrollHeight;

    if (leadCardHtml && window.innerWidth > 768) {
      const first = row.querySelector('.lumi-lead-input');
      if (first) setTimeout(() => first.focus(), 150);
    }
  }

  // Which single detail should we ask for next? (one question at a time)
  function nextLeadMode() {
    if (!state.leadData.phone) return 'phone';
    if (!state.leadData.pincode) return 'pin';
    return 'phone';
  }

  // Compact one-field lead card. Only one active card exists at a time.
  function buildLeadCardHtml(mode) {
    retirePendingCard(null);
    const cardId = 'lead-card-' + Math.random().toString(36).slice(2, 9);
    state.pendingLeadCardId = cardId;
    const isPin = mode === 'pin';
    const title = isPin ? 'Delivery PIN code' : 'Mobile number for a callback';
    const label = isPin ? 'PIN Code' : 'Mobile Number';
    const field = isPin
      ? `<input type="text" inputmode="numeric" autocomplete="postal-code" class="lumi-lead-input" id="${cardId}-pin" placeholder="6-digit PIN (e.g. 682001)" maxlength="6" value="${escapeHtml(state.leadData.pincode || '')}" style="padding-left: 10px;">`
      : `<span class="lumi-lead-prefix">+91</span><input type="tel" inputmode="numeric" autocomplete="tel-national" class="lumi-lead-input" id="${cardId}-phone" placeholder="10-digit mobile" maxlength="14" value="${escapeHtml(state.leadData.phone || '')}">`;
    return `
      <div class="lumi-lead-card" id="${cardId}" data-mode="${isPin ? 'pin' : 'phone'}">
        <div class="lumi-lead-card-header">
          <span class="lumi-lead-card-icon">${isPin
            ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>'
            : '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>'}</span>
          <div>
            <h5 class="lumi-lead-card-title">${title}</h5>
            <p class="lumi-lead-card-sub">${isPin ? 'Used only to confirm delivery timelines.' : 'Used only by our sleep specialist to call you.'}</p>
          </div>
        </div>
        <div class="lumi-lead-col">
          <label class="lumi-lead-label" for="${cardId}-${isPin ? 'pin' : 'phone'}">${label}</label>
          <div class="lumi-lead-input-wrap">${field}</div>
          <div class="lumi-lead-error" id="${cardId}-error" role="alert" style="display:none;"></div>
        </div>
        <button type="button" class="lumi-lead-btn" data-lumi-action="submit-lead" data-card-id="${cardId}">${isPin ? 'Continue →' : 'Continue →'}</button>
        <div class="lumi-lead-privacy"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-1px; margin-right:3px;"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg> Private &amp; never shared.</div>
      </div>
    `;
  }

  // Replace the active lead card (if any) so stale forms never pile up in the chat
  function retirePendingCard(replacementHtml) {
    const id = state.pendingLeadCardId;
    state.pendingLeadCardId = null;
    if (!id) return;
    const el = document.getElementById(id);
    if (!el) return;
    if (replacementHtml) el.outerHTML = replacementHtml;
    else el.remove();
  }

  // Typing indicator
  function showTypingIndicator() {
    const messagesEl = document.getElementById('lumi-messages');
    if (!messagesEl) return;

    const ind = document.createElement('div');
    ind.id = 'lumi-typing';
    ind.className = 'lumi-typing-indicator';
    ind.innerHTML = `
      <span class="lumi-typing-dot"></span>
      <span class="lumi-typing-dot"></span>
      <span class="lumi-typing-dot"></span>
    `;
    messagesEl.appendChild(ind);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function hideTypingIndicator() {
    const ind = document.getElementById('lumi-typing');
    if (ind) ind.remove();
  }

  // Render Quick Options Pills
  function renderQuickOptions(options) {
    const container = document.getElementById('lumi-quick-options');
    if (!container) return;

    container.innerHTML = '';
    if (!options || options.length === 0) return;

    options.forEach(opt => {
      const pill = document.createElement('button');
      pill.type = 'button';
      pill.className = 'lumi-quick-pill';
      pill.textContent = opt;
      pill.onclick = () => handleUserInput(opt);
      container.appendChild(pill);
    });
  }

  // Extract Contact Details (Phone, PIN code, Name) from string
  function extractContactInfo(text) {
    if (!text) return null;
    const str = String(text);
    let phone = null;
    let pincode = null;
    let name = null;

    const phonePattern = /(?:\+?91[\s\-]?)?([6-9]\d{9})\b/;
    const phoneMatch = str.match(phonePattern);
    if (phoneMatch) {
      phone = phoneMatch[1];
    } else {
      const digits = str.replace(/\D/g, '');
      if (digits.length === 10 && /^[6-9]/.test(digits)) {
        phone = digits;
      } else if (digits.length === 12 && digits.startsWith('91') && /^[6-9]/.test(digits.slice(2))) {
        phone = digits.slice(2);
      }
    }

    if (phone === SUPPORT_PHONE) phone = null;

    const pinPattern = /\b([1-9][0-9]{5})\b/g;
    const pinMatches = str.match(pinPattern);
    if (pinMatches) {
      for (const p of pinMatches) {
        if (!phone || !phone.includes(p)) {
          pincode = p;
          break;
        }
      }
    }

    const namePattern = /(?:my name is|i am|name[:\s]+)\s*([a-zA-Z\s]{2,30})/i;
    const nameMatch = str.match(namePattern);
    if (nameMatch) {
      name = nameMatch[1].trim();
    }

    return { phone, pincode, name };
  }

  // ---------------------------------------------------------------------------
  // Lead collection — ONE question at a time (mobile first, then PIN), no loops
  // ---------------------------------------------------------------------------
  function clearLeadPrompt() {
    state.leadStep = null;
    state.pinPurpose = null;
  }

  function filterPills(options) {
    const lastUser = [...state.history].reverse().find(m => m.sender === 'user');
    const lastText = lastUser ? String(lastUser.text).trim().toLowerCase() : '';
    const seen = new Set();
    return (options || []).filter(opt => {
      const key = String(opt).trim().toLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      if (key === lastText) return false; // never offer the exact pill the customer just tapped
      if (state.leadSubmitted && RE_LEAD.test(opt)) return false; // lead already captured
      return true;
    }).slice(0, 4);
  }

  function askForPhone(intro) {
    state.leadStep = 'phone';
    state.pinPurpose = null;
    appendMessage('assistant', intro || "Happy to arrange that! 😊 Our senior sleep specialist will call you for a free, no-obligation consultation.\n\nWhat's the best **mobile number** to reach you?", { showLeadCard: true, leadMode: 'phone' });
    renderQuickOptions(['Skip', 'Call +91 90726 16423']);
  }

  function askForPin() {
    state.leadStep = 'pin';
    state.pinPurpose = null;
    appendMessage('assistant', `Thanks! 📱 **+91 ${state.leadData.phone}** noted.\n\nOne last thing — which **6-digit PIN code** should we deliver to? It lets our specialist confirm delivery timelines for your area.`, { showLeadCard: true, leadMode: 'pin' });
    renderQuickOptions(['Skip']);
  }

  function startLead() {
    if (state.leadSubmitted && state.leadData.phone) {
      clearLeadPrompt();
      appendMessage('assistant', `You're all set ✓ Our sleep specialist will call you at **+91 ${state.leadData.phone}**${state.leadData.pincode ? ` (PIN ${state.leadData.pincode})` : ''} shortly.\n\nWould you like to use a different number, or can I help with anything else meanwhile?`);
      renderQuickOptions(['Update my number', 'Call +91 90726 16423', 'Which is best for back pain?', 'Check Prices']);
      return;
    }
    if (state.leadData.phone && state.leadData.pincode) { submitLead(); return; }
    if (state.leadData.phone) { askForPin(); return; }
    if (state.leadData.pincode) {
      askForPhone(`Sure! I already have your PIN **${state.leadData.pincode}**. What's the best **mobile number** for our specialist to call?`);
      return;
    }
    askForPhone();
  }

  function askDeliveryPin() {
    state.pinPurpose = 'delivery';
    state.leadStep = null;
    appendMessage('assistant', "Sure! Type your **6-digit PIN code** and I'll check delivery timelines for your area.", { showLeadCard: true, leadMode: 'pin' });
    renderQuickOptions(state.leadData.pincode ? [state.leadData.pincode, 'Skip'] : ['Skip']);
  }

  function replyDelivery(pin) {
    const d = pincodeDelivery(pin);
    state.pinPurpose = null;
    let text = `✓ PIN **${pin}** is serviceable via ${d.hub} — delivery usually takes **${d.days}**, 100% full-size and flat (never rolled).`;
    if (state.leadStep === 'phone' && !state.leadData.phone) {
      text += "\n\nAnd what's your **mobile number** so our specialist can call you?";
      appendMessage('assistant', text, { showLeadCard: true, leadMode: 'phone' });
      renderQuickOptions(['Skip']);
      return;
    }
    state.leadStep = null;
    saveLeadSession();
    appendMessage('assistant', text);
    renderQuickOptions(filterPills(state.leadSubmitted
      ? ['Which is best for back pain?', 'Check Prices', 'Size Guide']
      : ['Request Specialist Call', 'Check Prices', 'Which is best for back pain?']));
  }

  function handleLeadFlow(userInput) {
    const val = (userInput || '').trim();
    const info = extractContactInfo(val) || {};
    const active = state.leadStep || state.pinPurpose;

    if (active && RE_SKIP.test(val)) {
      clearLeadPrompt();
      retirePendingCard(null);
      appendMessage('assistant', "No problem at all! Ask me anything about our 8 mattresses — feel, sizes, prices or delivery.");
      renderQuickOptions(DEFAULT_PILLS.filter(p => !RE_LEAD.test(p)));
      return true;
    }

    if (info.name) state.leadData.name = info.name;

    if (info.phone) {
      state.leadData.phone = info.phone;
      if (info.pincode) state.leadData.pincode = info.pincode;
      saveLeadSession();
      if (state.leadData.pincode) submitLead();
      else askForPin(); // a DIFFERENT follow-up question, not the same prompt again
      return true;
    }

    if (info.pincode && (active || /^\D*\d{6}\D*$/.test(val))) {
      state.leadData.pincode = info.pincode;
      saveLeadSession();
      if (state.leadStep === 'pin' && state.leadData.phone) { submitLead(); return true; }
      retirePendingCard(null);
      replyDelivery(info.pincode);
      return true;
    }

    if (active && /\d{5,}/.test(val.replace(/[\s-]/g, ''))) {
      const askingPin = state.leadStep === 'pin' || state.pinPurpose === 'delivery';
      appendMessage('assistant', askingPin
        ? "Hmm, that doesn't look like a valid 6-digit PIN code. Could you re-check it? (e.g. 682001)"
        : "That doesn't look like a valid 10-digit Indian mobile number. Could you re-check it? (e.g. 98765 43210)");
      renderQuickOptions(['Skip']);
      return true;
    }

    // Customer asked something else — leave the card in place but stop waiting for it
    if (active) clearLeadPrompt();
    return false;
  }

  // Quick-reply actions that must never be sent to the server (they caused the loops)
  function handleLocalIntent(text) {
    const val = (text || '').trim();
    const lower = val.toLowerCase();

    if (RE_DIRECT_CALL.test(val)) {
      appendMessage('assistant', "Calling our sleep team at **+91 90726 16423** 📞 (Mon–Sat, 9 AM – 8 PM). If the call doesn't start, just dial the number from your phone.");
      renderQuickOptions(filterPills(['Request Specialist Call', 'Which is best for back pain?', 'Check Prices']));
      try { window.location.href = 'tel:+919072616423'; } catch (e) {}
      return true;
    }
    if (RE_UPDATE.test(val)) {
      state.leadSubmitted = false;
      state.leadData.phone = '';
      state.lastSubmittedKey = '';
      saveLeadSession();
      askForPhone("Sure — what's the new **mobile number** we should call?");
      return true;
    }
    if (RE_SKIP.test(val)) {
      clearLeadPrompt();
      appendMessage('assistant', "Sure! Ask me anything — back pain, couples, cooling, sizes, prices or delivery.");
      renderQuickOptions(DEFAULT_PILLS.filter(p => !RE_LEAD.test(p)));
      return true;
    }
    if (RE_PIN.test(val)) { askDeliveryPin(); return true; }
    if (RE_LEAD.test(val)) { startLead(); return true; }
    if (RE_ALL_MODELS.test(val)) {
      appendMessage('assistant', isHomePage() ? 'Taking you to the full collection of 8 mattresses ↓' : 'Opening the full collection of 8 mattresses…');
      setTimeout(goToCollection, 350);
      return true;
    }
    const orderMatch = val.match(RE_ORDER);
    if (orderMatch) {
      const id = resolveModelId(orderMatch[2]);
      if (id) {
        appendMessage('assistant', currentModelId() === id
          ? `You're already on **${PRODUCTS_2_0[id].name}** — pick your size and thickness above to see the exact price.`
          : `Opening **${PRODUCTS_2_0[id].name}** for you…`);
        setTimeout(() => goToProduct(id), 350);
        return true;
      }
    }
    return false;
  }

  // Save Lead securely to Admin API & LocalStorage (deduplicated per session)
  async function submitLead() {
    const phone = state.leadData.phone;
    const pin = state.leadData.pincode;
    clearLeadPrompt();
    const key = `${phone}|${pin}`;
    if (state.leadSubmitted && state.lastSubmittedKey === key) {
      retirePendingCard(null);
      appendMessage('assistant', `You're already registered ✓ Our specialist will call **+91 ${phone}** shortly.`);
      renderQuickOptions(filterPills(['Which is best for back pain?', 'Check Prices', 'View All 8 Models']));
      return;
    }

    const ctx = getPageContext();
    const lastModel = [...state.history].reverse().find(m => m.card && m.card.name);
    const payload = {
      id: 'lumi-' + Date.now(),
      name: state.leadData.name || 'Storefront Customer',
      phone,
      pincode: pin,
      place: state.leadData.place || '',
      preferredMattress: ctx.productName || (lastModel ? lastModel.card.name : 'LORA Mattress Consultation'),
      preferredSize: ctx.size || 'Standard Size',
      preferredThickness: ctx.thickness || 'Standard Thickness',
      summary: `Callback via Lumi for ${ctx.productName || (lastModel ? lastModel.card.name : 'mattress selection')}. Phone: ${phone}, PIN: ${pin}`,
      source: 'Lumi AI Sleep Assistant',
      resultType: 'lumi_consultation',
      status: 'New',
      createdAt: new Date().toISOString()
    };

    state.leadSubmitted = true;
    state.lastSubmittedKey = key;
    saveLeadSession();
    retirePendingCard('<div class="lumi-lead-confirmed-card"><div class="lumi-confirmed-title">✓ Details received</div></div>');

    try {
      await fetch('/api/store-leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } catch (e) {}
    try {
      const localLeads = JSON.parse(localStorage.getItem(STORE_LEADS_STORAGE_KEY) || '[]');
      localLeads.unshift(payload);
      localStorage.setItem(STORE_LEADS_STORAGE_KEY, JSON.stringify(localLeads.slice(0, 50)));
    } catch (e) {}

    const d = pincodeDelivery(pin);
    appendMessage(
      'assistant',
      `✓ **Callback request confirmed!**\n\nOur senior sleep specialist will call you at **+91 ${phone}** shortly. Delivery to PIN **${pin}** usually takes ${d.days}.\n\nMeanwhile, shall I help you compare models or check prices?`
    );
    renderQuickOptions(['Which is best for back pain?', 'Check Prices', 'View All 8 Models']);
  }

  // Client-side fallback intelligence engine (Synchronized with 8 LORA Mattresses)
  function fallbackClientIntelligence(userInput) {
    const lower = (userInput || '').toLowerCase();

    // 1. Back pain / Spine
    if (lower.includes('backpain') || lower.includes('back pain') || lower.includes('spine') || lower.includes('ortho') || lower.includes('വേദന') || lower.includes('naduvedana')) {
      appendMessage(
        'assistant',
        "For back pain relief and healthy spinal alignment, we strongly recommend:\n\n• **LORA ORTHO HYBRID™** (10-Yr Warranty): Features 7-zone SpineAlign™ core with targeted lumbar reinforcement to keep your spine neutral and decompress vertebrae.\n• **LORA ORTHO LATEX™** (12-Yr Warranty): 100% natural pin-core Dunlop latex that dynamically pushes back without pressure points.\n\nBoth deliver optimal Medium-Firm support so your lower back doesn't sag.",
        PRODUCTS_2_0['04']
      );
      renderQuickOptions(['Compare Ortho Hybrid vs Latex', 'Zero motion for couples?', 'Request Specialist Call']);
      return;
    }

    // 2. Call / Callback / Contact request -> one-question-at-a-time lead flow
    if (RE_LEAD.test(lower) || /\b(call|contact|phone|callback)\b/.test(lower)) {
      startLead();
      return;
    }

    // 3. Recommendation / "Which is good ?" / "Which is best ?"
    if (lower.includes('which is good') || lower.includes('which is best') || lower.includes('which one is good') || lower.includes('recommend') || lower.includes('help me choose') || lower.includes('confused') || lower.includes('suggest') || lower.includes('best')) {
      appendMessage(
        'assistant',
        "Here is the verified quick-guide to choosing the ideal LORA mattress for your body:\n\n• **Severe Back Pain / Lumbar Support**: **LORA ORTHO HYBRID™** (Medium-Firm, 10-Yr) or **ORTHO LATEX™** (12-Yr)\n• **Couples & Light Sleepers (Zero Motion)**: **LORA POCKET LUXE™** (Medium, 10-Yr)\n• **Plush Soft Cloud Cushioning**: **LORA PLUSH™** (Soft Pillow-Top, 5-Yr) or **CLOUD 7™** (Medium-Soft 7\", 3-Yr)\n• **Flagship Tri-Hybrid Luxury**: **LORA HYBRID FUSION™** (Latex + Memory Foam + Ortho Core, 15-Yr)\n\nWhich sleeping feel sounds closest to your preference?"
      );
      renderQuickOptions(['Back Pain (Ortho)', 'Couples (Pocket Luxe)', 'Plush Soft Feel', 'Request Specialist Call']);
      return;
    }

    // 4. Couples / Motion Transfer
    if (lower.includes('couple') || lower.includes('partner') || lower.includes('motion') || lower.includes('movement') || lower.includes('shake') || lower.includes('disturbance')) {
      appendMessage(
        'assistant',
        "If partner tossing and turning disturbs your sleep, **LORA POCKET LUXE™** is the definitive choice. It is crafted with individually encased barrel pocket springs—each spring responds independently so movement on one side never ripples across the bed.",
        PRODUCTS_2_0['07']
      );
      renderQuickOptions(['Pocket Luxe Specs', 'Check King Price', 'Request Specialist Call']);
      return;
    }

    // 5. Cloud 7 vs Cloud Ortho comparison
    if ((lower.includes('cloud 7') || lower.includes('cloud-7')) && (lower.includes('ortho') || lower.includes('compare') || lower.includes('difference'))) {
      appendMessage(
        'assistant',
        "**Cloud 7™ vs Cloud Ortho™ Comparison:**\n\n• **LORA CLOUD 7™**: 7-inch profile, Medium-Soft Eurotop feel, 3-year warranty. Best for sleepers who love a gentle cushioned surface on a sleek profile.\n• **LORA CLOUD ORTHO™**: 9-inch profile, Balanced Medium feel, 5-year warranty. Offers thicker posture cushioning with more structured spinal support.\n\nBoth feature factory-direct pricing and 100% full-size flat delivery.",
        PRODUCTS_2_0['02']
      );
      renderQuickOptions(['Check Cloud 7 Price', 'Check Cloud Ortho Price', 'Request Specialist Call']);
      return;
    }

    // 6. Ortho Hybrid vs Ortho Latex comparison
    if (lower.includes('ortho hybrid') && (lower.includes('latex') || lower.includes('compare'))) {
      appendMessage(
        'assistant',
        "**Ortho Hybrid™ vs Ortho Latex™ Comparison:**\n\n• **LORA ORTHO HYBRID™**: 10-Year Warranty. Engineered with a 7-zone SpineAlign™ core designed for targeted lumbar pushback and vertebral decompression.\n• **LORA ORTHO LATEX™**: 12-Year Warranty. Built with 100% natural pin-core Dunlop latex over an orthopedic core. Naturally antibacterial, hypoallergenic, and extremely breathable for hot sleepers.",
        PRODUCTS_2_0['05']
      );
      renderQuickOptions(['Check Ortho Latex Price', 'Check Ortho Hybrid Price', 'Request Specialist Call']);
      return;
    }

    // 7. Cooling & Breathability
    if (lower.includes('cool') || lower.includes('hot') || lower.includes('sweat') || lower.includes('breathable') || lower.includes('ചൂട്')) {
      appendMessage(
        'assistant',
        "For the coolest and most breathable sleep, **LORA ORTHO LATEX™** is our top recommendation. Natural Dunlop latex contains thousands of open-cell pin-core channels that continuously circulate air and dissipate body heat throughout the night.",
        PRODUCTS_2_0['05']
      );
      renderQuickOptions(['Ortho Latex Details', 'Check Prices', 'Request Specialist Call']);
      return;
    }

    // 8. Flat Delivery vs Rolled Box
    if (lower.includes('flat') || lower.includes('rolled') || lower.includes('box') || lower.includes('compression') || lower.includes('delivery')) {
      appendMessage(
        'assistant',
        "**Why LORA Never Rolls or Compresses Mattresses:**\n\nMost online brands use hydraulic presses to crush mattresses into compact cardboard boxes to save shipping costs. This breaks spring integrity, creates edge sagging, and weakens foam cell structures.\n\nAt LORA: **You sleep flat. Why should your comfort arrive rolled?**\nWe deliver 100% full-size and completely flat in heavy-duty protective transit casing straight to your bedroom.",
        PRODUCTS_2_0['08']
      );
      renderQuickOptions(['View 8 Models', 'Check Pincode Delivery', 'Request Specialist Call']);
      return;
    }

    // 9. Pricing & Quotes
    if (lower.includes('price') || lower.includes('rate') || lower.includes('cost') || lower.includes('ethra') || lower.includes('വില') || lower.includes('എത്ര')) {
      appendMessage(
        'assistant',
        "**LORA Factory-Direct Pricing Overview:**\n\n• **Cloud 7™**: Starting at ₹22,999 (Queen 78\"×60\")\n• **Cloud Ortho™**: Starting at ₹25,999\n• **Lora Plush™**: Starting at ₹24,999\n• **Ortho Hybrid™**: Starting at ₹27,999\n• **Ortho Latex™**: Starting at ₹29,999\n• **Comfort Core™**: Starting at ₹26,999\n• **Pocket Luxe™**: Starting at ₹28,999\n• **Hybrid Fusion™**: Starting at ₹34,999\n\n*All models include 100% factory-direct savings and complimentary premium sleep kit during launch!*",
        null
      );
      renderQuickOptions(['View Mattress Models', 'Measure Bed Dimensions', 'Request Specialist Call']);
      return;
    }

    // 10. Sizing, Dimensions, Custom Size
    if (lower.includes('size') || lower.includes('dimension') || lower.includes('measure') || lower.includes('custom') || lower.includes('king') || lower.includes('queen') || lower.includes('single') || lower.includes('double')) {
      appendMessage(
        'assistant',
        "**Standard & Custom Sizes Available:**\n\n• **King**: 78\" × 72\" | 75\" × 72\" | 72\" × 72\" | 84\" × 72\"\n• **Queen**: 78\" × 60\" | 75\" × 60\" | 72\" × 60\" | 78\" × 66\"\n• **Double**: 78\" × 48\" | 75\" × 48\" | 72\" × 48\"\n• **Single**: 78\" × 36\" | 75\" × 36\" | 72\" × 36\"\n\n**Custom Frame Dimensions**: Have an antique teak bed or non-standard frame? We custom-craft any length and width down to the exact millimeter at no extra delay!",
        null
      );
      renderQuickOptions(['Which is best for back pain?', 'Check Pincode', 'Request Specialist Call']);
      return;
    }

    // 11. Dynamic open fallback (Rotates through informative topics, NEVER repeats identical text)
    const fallbackVariations = [
      "I'm here to guide you across LORA's 8 handcrafted mattresses! Are you looking for relief from back pain, zero motion transfer for couples, or a plush soft cloud-like feel?",
      "To help you find your perfect match, could you share your favorite sleep posture (back, side, or stomach), or would you prefer a direct callback from our senior sleep consultant?",
      "Every LORA mattress is delivered 100% full-size flat with warranties up to 15 years. Which model or feature can I explain in detail for you?"
    ];
    const pickedText = fallbackVariations[state.history.length % fallbackVariations.length];

    appendMessage(
      'assistant',
      pickedText
    );
    renderQuickOptions(['Which is best for back pain?', 'Zero motion for couples?', 'Compare Cloud 7 vs Cloud Ortho', 'Request Specialist Call']);
  }

  // Send query to Lumi server API
  async function handleUserInput(userInput) {
    userInput = String(userInput || '').trim();
    if (!userInput || state.isThinking) return;

    appendMessage('user', userInput);
    renderQuickOptions([]);

    // 1. Contact / PIN answers and lead-flow control
    if (handleLeadFlow(userInput)) return;
    // 2. Pill actions handled locally (callback, pincode check, open product, call us)
    if (handleLocalIntent(userInput)) return;

    state.isThinking = true;
    showTypingIndicator();
    const retryContainer = document.getElementById('lumi-retry-container');
    if (retryContainer) retryContainer.style.display = 'none';

    try {
      const ctx = getPageContext();
      const res = await fetch('/api/lumi-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userInput,
          context: ctx,
          history: state.history.slice(-8, -1),
          lead: { hasPhone: !!state.leadData.phone, hasPin: !!state.leadData.pincode, submitted: state.leadSubmitted }
        })
      });

      hideTypingIndicator();
      state.isThinking = false;

      if (!res.ok) throw new Error('API returned status ' + res.status);
      const data = await res.json();
      let reply = data.reply || '';
      let card = data.card || null;
      let pills = data.quickOptions || ['Help me choose', 'Find my size', 'Compare mattresses'];

      // Never print the exact same answer twice in a row
      const lastAssistant = [...state.history].reverse().find(m => m.sender === 'assistant');
      if (lastAssistant && lastAssistant.text === reply) {
        reply = "I've covered that just above ☝️ Would you like to look at it from a different angle — exact price, size, or a comparison with another model?";
        card = null;
        pills = ['Check Prices', 'Compare mattresses', 'Size Guide', 'Request Specialist Call'];
      }

      if (data.leadRegistered && data.lead && data.lead.phone) {
        state.leadData.phone = String(data.lead.phone).slice(-10);
        if (data.lead.pincode) {
          state.leadData.pincode = data.lead.pincode;
          state.leadSubmitted = true;
          state.lastSubmittedKey = `${state.leadData.phone}|${state.leadData.pincode}`;
        }
        saveLeadSession();
      }

      if (data.suggestLead && !state.leadSubmitted) {
        const mode = nextLeadMode();
        card = Object.assign({}, card || {}, { showLeadCard: true, leadMode: mode });
        state.leadStep = mode;
      }

      appendMessage('assistant', reply, card);
      renderQuickOptions(filterPills(pills));
    } catch (err) {
      hideTypingIndicator();
      state.isThinking = false;
      fallbackClientIntelligence(userInput);
    }
  }

  // Clear / Reset chat
  function resetChat() {
    state.history = [];
    clearLeadPrompt();
    state.pendingLeadCardId = null;
    const messagesEl = document.getElementById('lumi-messages');
    if (messagesEl) messagesEl.innerHTML = '';
    sendWelcomeMessage();
  }

  // Switch preferred language
  function setLanguage(lang) {
    state.currentLang = lang;
    localStorage.setItem(LUMI_LANG_KEY, lang);
    document.querySelectorAll('.lumi-lang-btn').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-lang') === lang);
    });
    const langDisplay = document.getElementById('lumi-header-lang-display');
    if (langDisplay) {
      if (lang === 'ml') langDisplay.textContent = 'മലയാളം മോഡ്';
      else if (lang === 'manglish') langDisplay.textContent = 'Manglish Mode';
      else langDisplay.textContent = 'English Mode';
    }
  }

  // Bind all UI events
  function bindEvents() {
    const launcher = document.getElementById('lumi-launcher');
    const closeBtn = document.getElementById('lumi-close-chat');
    const resetBtn = document.getElementById('lumi-reset-chat');
    const greetingBubble = document.getElementById('lumi-greeting');
    const dismissGreeting = document.getElementById('lumi-dismiss-greeting');
    const form = document.getElementById('lumi-chat-form');
    const input = document.getElementById('lumi-user-input');
    const checkPinBtn = document.getElementById('lumi-btn-check-pin');
    const retryBtn = document.getElementById('lumi-retry-btn');

    if (launcher) {
      launcher.onclick = (e) => {
        e.preventDefault();
        toggleChat();
      };
    }

    if (closeBtn) {
      closeBtn.onclick = (e) => {
        e.preventDefault();
        toggleChat(false);
      };
    }

    if (resetBtn) {
      resetBtn.onclick = (e) => {
        e.preventDefault();
        resetChat();
      };
    }

    if (greetingBubble) {
      greetingBubble.onclick = (e) => {
        if (e.target !== dismissGreeting) {
          toggleChat(true);
        }
      };
    }

    if (dismissGreeting) {
      dismissGreeting.onclick = (e) => {
        e.stopPropagation();
        greetingBubble.style.display = 'none';
        try { sessionStorage.setItem(SESSION_GREETING_KEY, 'true'); } catch (e) {}
      };
    }

    const toggleQuestionsBtn = document.getElementById('lumi-toggle-questions');
    const questionsTray = document.getElementById('lumi-questions-tray');

    if (toggleQuestionsBtn && questionsTray) {
      toggleQuestionsBtn.onclick = (e) => {
        e.preventDefault();
        const isOpen = questionsTray.style.display !== 'none';
        questionsTray.style.display = isOpen ? 'none' : 'flex';
        toggleQuestionsBtn.classList.toggle('active', !isOpen);
      };
    }

    if (retryBtn) {
      retryBtn.onclick = () => {
        const lastMsg = state.history.filter(m => m.sender === 'user').pop();
        if (lastMsg) handleUserInput(lastMsg.text);
      };
    }

    if (form && input) {
      form.onsubmit = (e) => {
        e.preventDefault();
        const text = input.value.trim();
        if (text) {
          input.value = '';
          handleUserInput(text);
        }
      };
    }

    // Context strip "Check Pincode" button
    if (checkPinBtn) {
      checkPinBtn.onclick = (e) => {
        e.preventDefault();
        toggleChat(true);
        askDeliveryPin();
      };
    }

    // Delegated actions inside messages (product links, ask buttons, lead cards)
    const messagesBox = document.getElementById('lumi-messages');
    if (messagesBox) {
      messagesBox.addEventListener('click', (e) => {
        const el = e.target.closest('[data-lumi-action]');
        if (!el) return;
        const action = el.getAttribute('data-lumi-action');
        if (action === 'open-product') {
          // Allow ctrl/cmd/middle-click to open in a new tab normally
          if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return;
          e.preventDefault();
          goToProduct(el.getAttribute('data-model'));
        } else if (action === 'ask') {
          e.preventDefault();
          handleUserInput(el.getAttribute('data-q'));
        } else if (action === 'submit-lead') {
          e.preventDefault();
          window.LoraLumi.submitLeadCard(el, el.getAttribute('data-card-id'));
        }
      });
      messagesBox.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter' || !e.target.classList.contains('lumi-lead-input')) return;
        e.preventDefault();
        const cardEl = e.target.closest('.lumi-lead-card');
        const btn = cardEl && cardEl.querySelector('[data-lumi-action="submit-lead"]');
        if (btn) btn.click();
      });
    }

    // Language switcher buttons
    document.querySelectorAll('.lumi-lang-btn').forEach(btn => {
      btn.onclick = () => {
        const lang = btn.getAttribute('data-lang');
        if (lang) setLanguage(lang);
      };
    });

    // Listen to size & thickness selector clicks on PDP
    document.addEventListener('click', (e) => {
      if (e.target.closest('.pdp-size-btn, .size-pill, .pdp-thick-btn, .thickness-pill, [data-size], [data-thickness]')) {
        setTimeout(updateContextDisplay, 100);
      }
    });
  }

  // Initialize on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initWidgetDOM);
  } else {
    initWidgetDOM();
  }

  // Expose global controller
  window.LoraLumi = {
    open: () => toggleChat(true),
    close: () => toggleChat(false),
    reset: resetChat,
    ask: (q) => {
      toggleChat(true);
      const tray = document.getElementById('lumi-questions-tray');
      if (tray) tray.style.display = 'none';
      setTimeout(() => handleUserInput(q), 250);
    },
    requestLeadCard: () => {
      toggleChat(true);
      startLead();
    },
    submitLeadCard: function (btn, cardId) {
      const cardEl = document.getElementById(cardId);
      if (!cardEl) return;
      const mode = cardEl.getAttribute('data-mode') || 'phone';
      const errEl = document.getElementById(`${cardId}-error`);
      const showErr = (msg, input) => {
        if (errEl) { errEl.textContent = msg; errEl.style.display = 'block'; }
        if (input) { input.focus(); input.closest('.lumi-lead-input-wrap').style.borderColor = '#EF4444'; }
      };

      if (mode === 'phone') {
        const input = document.getElementById(`${cardId}-phone`);
        const phone = normalizePhone(input ? input.value : '');
        if (!phone) return showErr('Please enter a valid 10-digit Indian mobile number.', input);
        state.leadData.phone = phone;
        saveLeadSession();
        appendMessage('user', `+91 ${phone}`);
        if (state.leadData.pincode) submitLead();
        else { retirePendingCard(null); askForPin(); }
        return;
      }

      const input = document.getElementById(`${cardId}-pin`);
      const pin = String(input ? input.value : '').replace(/\D/g, '');
      if (!/^[1-9]\d{5}$/.test(pin)) return showErr('Please enter a valid 6-digit PIN code.', input);
      state.leadData.pincode = pin;
      saveLeadSession();
      appendMessage('user', pin);
      if (state.pinPurpose !== 'delivery' && state.leadData.phone && !state.leadSubmitted) {
        submitLead();
      } else {
        retirePendingCard(null);
        replyDelivery(pin);
      }
    }
  };

})();
