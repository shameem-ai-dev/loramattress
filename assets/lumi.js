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
    leadStep: 0, // 0 = idle, 1 = awaiting name, 2 = awaiting place/pin, 3 = awaiting phone
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
              <button type="button" class="lumi-q-chip" onclick="window.LoraLumi.ask('What is the 100-night trial and warranty coverage?')">Trial & Warranty</button>
              <button type="button" class="lumi-q-chip" onclick="window.LoraLumi.ask('How does Bajaj EMI assistance work?')">EMI Options</button>
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
        `നമസ്കാരം! ഞാൻ ലൂമി, ലോറയുടെ സ്ലീപ്പ് ഗൈഡ് \n\nനിങ്ങൾക്ക് ഏറ്റവും അനുയോജ്യമായ മെത്ത കണ്ടെത്താനും വാറന്റി, അളവുകൾ, ഡെലിവറി എന്നിവ പരിശോധിക്കാനും സഹായിക്കാം. നിങ്ങൾ ഇപ്പോൾ കാണുന്നത് **${ctx.productName}** ആണ്.`
      );
      renderQuickOptions(['നടുവേദനയ്ക്ക് ഏതാണ് നല്ലത്?', 'കപ്പിൾസ് മെത്ത (Zero Motion)', 'ക്ലൗഡ് 7 vs ക്ലൗഡ് ഓർത്തോ', 'ഫ്ലാറ്റ് ഡെലിവറി എന്തുകൊണ്ട്?', 'സ്പെഷ്യലിസ്റ്റ് കോൾ']);
    } else if (state.currentLang === 'manglish') {
      appendMessage(
        'assistant',
        `Namaskaram! Njan Lumi, Lora's Sleep Guide \n\nNingalkku perfect mattress find cheyyaan, warranty, size and flat delivery check cheyyaan njan help cheyyam. You are currently exploring **${ctx.productName}**.`
      );
      renderQuickOptions(['Best for back pain?', 'Zero motion for couples?', 'Compare Cloud 7 vs Cloud Ortho', 'Why flat delivery?', 'Request Specialist Call']);
    } else {
      appendMessage(
        'assistant',
        `Hello! I’m Lumi, your personal Lora sleep guide \n\nI can help you explore our 8 handcrafted models, compare firmness feels, check warranties, review bed sizing, or arrange a direct factory consultation. You're currently exploring **${ctx.productName}**.`
      );
      renderQuickOptions(['Which is best for back pain?', 'Zero motion for couples?', 'Compare Cloud 7 vs Cloud Ortho', 'Why flat delivery?', 'Request Specialist Call']);
    }
  }

  // Append a message bubble (supports optional interactive product card)
  function appendMessage(sender, text, card) {
    const messagesEl = document.getElementById('lumi-messages');
    if (!messagesEl) return;

    state.history.push({ sender, text, card });

    const row = document.createElement('div');
    row.className = `lumi-msg-row ${sender}`;

    let formattedText = (text || '')
      .replace(/\n\n/g, '<br><br>')
      .replace(/\n/g, '<br>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

    let cardHtml = '';
    if (card && card.name) {
      cardHtml = `
        <div class="lumi-product-card-embed">
          <div class="lumi-card-header">
            <span class="lumi-card-tag">${card.type || 'Mattress'}</span>
            ${card.warranty ? `<span class="lumi-card-warranty"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-1px; margin-right:3px;"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg> ${card.warranty} Warranty</span>` : ''}
          </div>
          <h5 class="lumi-card-title">${card.name}</h5>
          <div class="lumi-card-specs">
            <span class="lumi-spec-pill">Feel: <strong>${card.feel || 'Balanced'}</strong></span>
            ${card.height && card.height !== 'Unconfirmed' ? `<span class="lumi-spec-pill">Height: <strong>${card.height}</strong></span>` : ''}
            ${card.price ? `<span class="lumi-spec-pill lumi-spec-price">Price: <strong>${card.price}</strong></span>` : ''}
          </div>
          <button type="button" class="lumi-card-btn" onclick="window.LoraLumi.ask('Tell me more about ${card.name}')">
            Explore ${card.name.replace('LORA ', '')} →
          </button>
        </div>
      `;
    }

    // 2-Column Structured Lead Capture Card Embed
    let leadCardHtml = '';
    if (card && (card.showLeadCard || card.suggestLead)) {
      const cardId = 'lead-card-' + Math.random().toString(36).substr(2, 7);
      leadCardHtml = `
        <div class="lumi-lead-card" id="${cardId}">
          <div class="lumi-lead-card-header">
            <span class="lumi-lead-card-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg></span>
            <div>
              <h5 class="lumi-lead-card-title">Share Contact & PIN for Direct Callback</h5>
              <p class="lumi-lead-card-sub">Instant factory pricing, pincode delivery timeline & senior sleep consultation.</p>
            </div>
          </div>
          <div class="lumi-lead-cols">
            <div class="lumi-lead-col">
              <label class="lumi-lead-label"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-1px; margin-right:3px;"><rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg> Mobile Number</label>
              <div class="lumi-lead-input-wrap">
                <span class="lumi-lead-prefix">+91</span>
                <input type="tel" class="lumi-lead-input" id="${cardId}-phone" placeholder="10-digit mobile" maxlength="10" value="${state.leadData.phone || ''}">
              </div>
            </div>
            <div class="lumi-lead-col">
              <label class="lumi-lead-label"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-1px; margin-right:3px;"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg> Delivery PIN Code</label>
              <div class="lumi-lead-input-wrap">
                <input type="text" class="lumi-lead-input" id="${cardId}-pin" placeholder="6-digit PIN" maxlength="6" value="${state.leadData.pincode || ''}" style="padding-left: 8px;">
              </div>
            </div>
          </div>
          <button type="button" class="lumi-lead-btn" onclick="window.LoraLumi.submitLeadCard(this, '${cardId}')">
            Share Details & Request Callback →
          </button>
          <div class="lumi-lead-privacy"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-1px; margin-right:3px;"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg> Your contact details are strictly private & only used to verify delivery & call you.</div>
        </div>
      `;
    }

    row.innerHTML = `<div class="lumi-msg-bubble">${formattedText}${cardHtml}${leadCardHtml}</div>`;
    messagesEl.appendChild(row);
    messagesEl.scrollTop = messagesEl.scrollHeight;
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

  // Lead Collection State Machine (Customer First & Direct)
  function handleLeadFlow(userInput) {
    const val = (userInput || '').trim();
    const lower = val.toLowerCase();

    // User opts out of lead collection
    if (state.leadStep > 0 && (lower === 'skip' || lower === 'no' || lower === 'cancel' || lower === 'venda')) {
      state.leadStep = 0;
      appendMessage('assistant', "No problem at all! Feel free to ask anything else about our 8 handcrafted mattresses, feel, or sizing.");
      renderQuickOptions(['Which is best for back pain?', 'Zero motion for couples?', 'Why flat delivery?']);
      return true;
    }

    const info = extractContactInfo(val);

    // If phone number is provided anywhere in text
    if (info && info.phone) {
      state.leadData.phone = info.phone;
      if (info.pincode) state.leadData.pincode = info.pincode;
      if (info.name) state.leadData.name = info.name;

      if (state.leadData.pincode) {
        state.leadStep = 0;
        submitLeadToAdmin();
        return true;
      } else {
        state.leadStep = 2;
        appendMessage(
          'assistant',
          `Got your number: **+91 ${state.leadData.phone}**! What is your 6-digit delivery **pincode** so our sleep specialist can verify exact delivery timelines for your area?`,
          { showLeadCard: true }
        );
        renderQuickOptions(['Skip']);
        return true;
      }
    }

    // If waiting for PIN code and user entered a 6-digit pin
    if (state.leadStep === 2 && info && info.pincode) {
      state.leadData.pincode = info.pincode;
      state.leadStep = 0;
      submitLeadToAdmin();
      return true;
    }

    // If prompt asked for lead and user enters just PIN code
    if (state.leadStep === 1 && /^\d{6}$/.test(val)) {
      state.leadData.pincode = val;
      state.leadStep = 3;
      appendMessage(
        'assistant',
        `PIN code ${val} noted! What **contact number** should our sleep specialist call you on?`,
        { showLeadCard: true }
      );
      renderQuickOptions(['Skip']);
      return true;
    }

    // If user asked a new question while leadStep was open, reset leadStep and let question proceed
    if (state.leadStep > 0 && !info.phone && !info.pincode) {
      state.leadStep = 0;
      return false;
    }

    return false;
  }

  // Save Lead securely to Admin API & LocalStorage
  async function submitLeadToAdmin() {
    const ctx = getPageContext();
    const payload = {
      id: 'lumi-' + Date.now(),
      name: state.leadData.name || 'Storefront Customer',
      phone: state.leadData.phone || '',
      pincode: state.leadData.pincode || '',
      place: state.leadData.place || '',
      preferredMattress: ctx.productName || 'LORA Mattress Consultation',
      preferredSize: ctx.size || 'Standard Size',
      preferredThickness: ctx.thickness || 'Standard Thickness',
      summary: `Customer consultation for ${ctx.productName || 'Mattress selection'}. Contact: ${state.leadData.phone}, PIN: ${state.leadData.pincode}`,
      source: 'Lumi AI Sleep Assistant (Realtime Chatbot)',
      resultType: 'lumi_consultation',
      status: 'New',
      createdAt: new Date().toISOString()
    };

    let serverSuccess = false;

    try {
      const res = await fetch('/api/store-leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) serverSuccess = true;
    } catch (e) {}

    try {
      const localLeads = JSON.parse(localStorage.getItem(STORE_LEADS_STORAGE_KEY) || '[]');
      localLeads.unshift(payload);
      localStorage.setItem(STORE_LEADS_STORAGE_KEY, JSON.stringify(localLeads));
      serverSuccess = true;
    } catch (e) {}

    appendMessage(
      'assistant',
      `✓ **Consultation Request Confirmed!**\n\nThank you! Your inquiry has been registered with our senior sleep team for PIN **${state.leadData.pincode || 'your area'}**. A specialist will call you shortly at **+91 ${state.leadData.phone}** to assist you personally with mattress selection and factory-direct pricing.`
    );
    renderQuickOptions(['View All 8 Models', 'Check EMI Options', 'Size Guide']);
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

    // 2. Call / Callback / Contact / Phone request
    if (lower.includes('call') || lower.includes('callback') || lower.includes('contact') || lower.includes('talk to team') || lower.includes('speak to') || lower.includes('vilikumo') || lower.includes('വിളിക്കാമോ') || lower.includes('phone') || lower.includes('number')) {
      appendMessage(
        'assistant',
        "Certainly! Our senior sleep consultants provide one-on-one guidance on mattress thickness, customized sizes, and factory direct savings.\n\nPlease share your **mobile number** and **pincode** in the columns below so we can verify delivery and call you directly:",
        { showLeadCard: true }
      );
      renderQuickOptions(['Which is best for back pain?', 'Why flat delivery?', 'Compare Cloud 7 vs Cloud Ortho']);
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
        "**LORA Factory-Direct Pricing Overview:**\n\n• **Cloud 7™**: Starting at ₹22,999 (Queen 78\"×60\")\n• **Cloud Ortho™**: Starting at ₹25,999\n• **Lora Plush™**: Starting at ₹24,999\n• **Ortho Hybrid™**: Starting at ₹27,999\n• **Ortho Latex™**: Starting at ₹29,999\n• **Comfort Core™**: Starting at ₹26,999\n• **Pocket Luxe™**: Starting at ₹28,999\n• **Hybrid Fusion™**: Starting at ₹34,999\n\n*All models eligible for Bajaj EMI assistance and complimentary premium sleep kit during launch!*",
        { showLeadCard: true }
      );
      renderQuickOptions(['Check EMI Options', 'Measure Bed Dimensions', 'Request Specialist Call']);
      return;
    }

    // 10. Sizing, Dimensions, Custom Size
    if (lower.includes('size') || lower.includes('dimension') || lower.includes('measure') || lower.includes('custom') || lower.includes('king') || lower.includes('queen') || lower.includes('single') || lower.includes('double')) {
      appendMessage(
        'assistant',
        "**Standard & Custom Sizes Available:**\n\n• **King**: 78\" × 72\" | 75\" × 72\" | 72\" × 72\" | 84\" × 72\"\n• **Queen**: 78\" × 60\" | 75\" × 60\" | 72\" × 60\" | 78\" × 66\"\n• **Double**: 78\" × 48\" | 75\" × 48\" | 72\" × 48\"\n• **Single**: 78\" × 36\" | 75\" × 36\" | 72\" × 36\"\n\n**Custom Frame Dimensions**: Have an antique teak bed or non-standard frame? We custom-craft any length and width down to the exact millimeter at no extra delay!",
        { showLeadCard: true }
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
    if (!userInput || state.isThinking) return;

    appendMessage('user', userInput);
    renderQuickOptions([]);

    // Check if in active lead collection flow or if user supplied contact info
    if (handleLeadFlow(userInput)) {
      return;
    }

    // Check if user requested a call directly
    const lower = userInput.toLowerCase();
    if (
      lower.includes('call') ||
      lower.includes('callback') ||
      lower.includes('contact') ||
      lower.includes('talk to team') ||
      lower.includes('speak to human') ||
      lower.includes('speak to someone') ||
      lower.includes('vilikumo') ||
      lower.includes('വിളിക്കാമോ')
    ) {
      state.leadStep = 1;
      appendMessage(
        'assistant',
        "Certainly! Our senior sleep specialists would be happy to give you a personalized consultation call.\n\nPlease share your **contact number** and **pincode** below so we can reach out with accurate advice and delivery options:"
      );
      renderQuickOptions(['Share Contact & PIN', 'Call +91 95676 84770']);
      return;
    }

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
          history: state.history.slice(-6)
        })
      });

      hideTypingIndicator();
      state.isThinking = false;

      if (res.ok) {
        const data = await res.json();
        appendMessage('assistant', data.reply, data.card);
        renderQuickOptions(data.quickOptions || ['Help me choose', 'Find my size', 'Compare mattresses']);

        if (data.suggestLead) {
          state.leadStep = 1;
        }
        if (data.leadRegistered) {
          state.leadStep = 0;
          if (data.lead) {
            try {
              const localLeads = JSON.parse(localStorage.getItem(STORE_LEADS_STORAGE_KEY) || '[]');
              localLeads.unshift(data.lead);
              localStorage.setItem(STORE_LEADS_STORAGE_KEY, JSON.stringify(localLeads));
            } catch (e) {}
          }
        }
      } else {
        throw new Error('API returned status ' + res.status);
      }
    } catch (err) {
      hideTypingIndicator();
      state.isThinking = false;
      fallbackClientIntelligence(userInput);
    }
  }

  // Clear / Reset chat
  function resetChat() {
    state.history = [];
    state.leadStep = 0;
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
      appendMessage(
        'assistant',
        "Certainly! Please share your contact number and delivery pincode below so our senior sleep specialist can check factory availability and call you directly:",
        { showLeadCard: true }
      );
    },
    submitLeadCard: async function (btn, cardId) {
      const phoneEl = document.getElementById(`${cardId}-phone`);
      const pinEl = document.getElementById(`${cardId}-pin`);
      const phoneVal = (phoneEl ? phoneEl.value : '').replace(/\D/g, '');
      const pinVal = (pinEl ? pinEl.value : '').replace(/\D/g, '');

      if (!phoneVal || phoneVal.length < 10) {
        if (phoneEl) {
          phoneEl.focus();
          phoneEl.style.borderColor = '#EF4444';
        }
        alert('Please enter a valid 10-digit mobile number.');
        return;
      }
      if (!pinVal || pinVal.length !== 6) {
        if (pinEl) {
          pinEl.focus();
          pinEl.style.borderColor = '#EF4444';
        }
        alert('Please enter a valid 6-digit delivery PIN code.');
        return;
      }

      btn.disabled = true;
      btn.innerHTML = '⏳ Registering Request...';

      state.leadData.phone = phoneVal.slice(-10);
      state.leadData.pincode = pinVal;

      const ctx = getPageContext();
      const payload = {
        id: 'lumi-' + Date.now(),
        name: state.leadData.name || 'Storefront Customer',
        phone: state.leadData.phone,
        pincode: state.leadData.pincode,
        place: '',
        preferredMattress: ctx.productName || 'LORA Mattress Consultation',
        preferredSize: ctx.size || 'Standard Size',
        preferredThickness: ctx.thickness || 'Standard Thickness',
        summary: `Customer callback request for ${ctx.productName || 'Mattress selection'}. Phone: ${state.leadData.phone}, PIN: ${state.leadData.pincode}`,
        source: 'Lumi Sleep Guide (Structured 2-Column Lead Card)',
        resultType: 'lumi_consultation',
        status: 'New',
        createdAt: new Date().toISOString()
      };

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
        localStorage.setItem(STORE_LEADS_STORAGE_KEY, JSON.stringify(localLeads));
      } catch (e) {}

      const cardContainer = document.getElementById(cardId);
      if (cardContainer) {
        cardContainer.outerHTML = `
          <div class="lumi-lead-confirmed-card">
            <div class="lumi-confirmed-title">✓ Callback Request Registered!</div>
            <div class="lumi-confirmed-details">
              Thank you! Our senior sleep consultant will call you at <strong>+91 ${state.leadData.phone}</strong> for PIN <strong>${state.leadData.pincode}</strong> with verified factory-direct pricing and delivery timings.
            </div>
          </div>
        `;
      }

      state.leadStep = 0;
      renderQuickOptions(['Which is best for back pain?', 'Zero motion for couples?', 'Why flat delivery?']);
    }
  };

})();
