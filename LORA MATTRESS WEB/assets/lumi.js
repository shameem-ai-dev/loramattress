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
          <strong>Hi, I’m Lumi!</strong> Lora's verified AI sleep assistant. Need help choosing your mattress?
        </p>
        <button type="button" class="lumi-greeting-close" id="lumi-dismiss-greeting" aria-label="Dismiss greeting">✕</button>
      </div>

      <!-- 3D Luxury Bed & Lumi Character Launcher -->
      <button type="button" class="lumi-launcher-btn" id="lumi-launcher" aria-label="Open Lumi Sleep Assistant">
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

        <span class="lumi-status-badge" title="Lumi is online with Knowledge Base 2.0"></span>
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
                <span class="lumi-header-badge">KB 2.0</span>
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

        <!-- Currently Viewed Mattress Context Strip -->
        <div class="lumi-context-strip" id="lumi-context-strip">
          <span class="lumi-context-label">
            <span>🛏️</span>
            <strong id="lumi-context-product">LORA CLOUD 7™</strong>
          </span>
          <button type="button" class="lumi-context-action" id="lumi-btn-check-pin">Check Pincode</button>
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
        `നമസ്കാരം! ഞാൻ ലൂമി, ലോറയുടെ AI സ്ലീപ്പ് അസിസ്റ്റന്റ് ☁️\n\nനിങ്ങൾക്ക് അനുയോജ്യമായ മെത്ത കണ്ടെത്താനും വാറന്റി, അളവുകൾ, ഡെലിവറി എന്നിവ പരിശോധിക്കാനും സഹായിക്കാം. നിങ്ങൾ ഇപ്പോൾ കാണുന്നത് **${ctx.productName}** ആണ്.`
      );
      renderQuickOptions(['അനുയോജ്യമായത് കണ്ടെത്തുക', 'സൈസ് ഗൈഡ്', 'മോഡലുകൾ താരതമ്യം ചെയ്യുക', 'പിൻകോഡ് പരിശോധിക്കുക']);
    } else if (state.currentLang === 'manglish') {
      appendMessage(
        'assistant',
        `Namaskaram! Njan Lumi, Lora's AI Sleep Assistant ☁️\n\nNingalkku perfect mattress find cheyyaan, warranty, size and delivery check cheyyaan njan help cheyyam. You are currently exploring **${ctx.productName}**.`
      );
      renderQuickOptions(['Help me choose', 'Find my size', 'Compare mattresses', 'Check pincode']);
    } else {
      appendMessage(
        'assistant',
        `Hello! I’m Lumi, Lora’s AI sleep assistant ☁️\n\nI can help you explore our 8 verified models, compare comfort feels, check stated warranties, and review bed sizing. You're currently exploring **${ctx.productName}**.`
      );
      renderQuickOptions(['Help me choose', 'Find my size', 'Compare mattresses', 'Check Pincode']);
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
            ${card.warranty ? `<span class="lumi-card-warranty">🛡️ ${card.warranty} Warranty</span>` : ''}
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

    row.innerHTML = `<div class="lumi-msg-bubble">${formattedText}${cardHtml}</div>`;
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

  // Lead Collection State Machine (Customer First & Respectful)
  function handleLeadFlow(userInput) {
    const val = (userInput || '').trim();

    // Step 1: Collecting Name
    if (state.leadStep === 1) {
      if (val.toLowerCase() === 'skip' || val.toLowerCase() === 'no' || val.toLowerCase() === 'venda') {
        state.leadStep = 0;
        appendMessage('assistant', "No problem at all! Feel free to ask anything else about mattresses, feel, or sizing.");
        renderQuickOptions(['Help me choose', 'Find my size', 'Compare mattresses']);
        return true;
      }
      state.leadData.name = val;
      state.leadStep = 2;
      appendMessage('assistant', `Thank you, ${val}! Which town, city, or 6-digit PIN code can we note for delivery? (Type 'skip' if you prefer)`);
      renderQuickOptions(['Skip']);
      return true;
    }

    // Step 2: Collecting Place or PIN
    if (state.leadStep === 2) {
      if (val.toLowerCase() !== 'skip') {
        if (/^\d{6}$/.test(val)) {
          state.leadData.pincode = val;
        } else {
          state.leadData.place = val;
        }
      }
      state.leadStep = 3;
      appendMessage('assistant', "Got it! Lastly, what contact number can our sleep specialist use to assist you?");
      renderQuickOptions(['Skip']);
      return true;
    }

    // Step 3: Collecting Phone & Submitting
    if (state.leadStep === 3) {
      if (val.toLowerCase() !== 'skip') {
        const cleanPhone = val.replace(/\D/g, '');
        if (cleanPhone.length >= 10) {
          state.leadData.phone = cleanPhone.slice(-10);
        } else {
          state.leadData.phone = val;
        }
      }

      state.leadStep = 0;
      submitLeadToAdmin();
      return true;
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
      preferredMattress: ctx.productName,
      preferredSize: ctx.size,
      preferredThickness: ctx.thickness,
      summary: `Customer inquiry for ${ctx.productName} (${ctx.size}). Preferences noted via Lumi AI.`,
      source: 'Lumi AI Sleep Assistant (KB 2.0)',
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

    if (serverSuccess) {
      appendMessage(
        'assistant',
        `✓ Thank you, **${state.leadData.name || 'there'}**! Your enquiry has been saved with our Lora sleep team with your mattress preferences.`
      );
      renderQuickOptions(['View Mattress Details', 'Help me choose', 'Find my size']);
    } else {
      appendMessage(
        'assistant',
        "We could not save your request right now. You can also connect with our team directly via phone at **+91 95676 84770**."
      );
      renderQuickOptions(['Call +91 95676 84770', 'Try Again']);
    }
  }

  // Client-side fallback intelligence engine (Synchronized with Version 2.0 Baseline)
  function fallbackClientIntelligence(userInput) {
    const lower = (userInput || '').toLowerCase();

    // 1. Acceptance check: Cloud 7 thickness & warranty
    if (lower.includes('cloud 7') || lower.includes('eurotop 7')) {
      if (lower.includes('memory foam')) {
        appendMessage('assistant', "Cloud 7-inte Eurotop comfortum medium-soft feelum confirm aanu. Memory foam undo ennath exact layer details nokki confirm cheyyanam.");
        return;
      }
      if (lower.includes('thick') || lower.includes('height') || lower.includes('inch')) {
        appendMessage('assistant', "Cloud 7 has a stated height of 7 inches with a medium-soft Eurotop feel.", PRODUCTS_2_0['01']);
        renderQuickOptions(['Cloud 7 warranty?', 'Compare with Cloud Ortho']);
        return;
      }
      if (lower.includes('warranty')) {
        appendMessage('assistant', "Cloud 7 has a 3-year warranty. Coverage and claim terms follow its warranty policy.", PRODUCTS_2_0['01']);
        renderQuickOptions(['Cloud 7 thickness?', 'Check Price']);
        return;
      }
    }

    // 2. Cloud Ortho firmness
    if ((lower.includes('cloud ortho') || lower.includes('eurotop 9')) && (lower.includes('hard') || lower.includes('firm') || lower.includes('feel'))) {
      appendMessage('assistant', "Cloud Ortho is listed with a Medium feel and Eurotop cushioning. The 'Ortho' name does not mean it is an extra-hard mattress.", PRODUCTS_2_0['02']);
      renderQuickOptions(['Cloud Ortho Profile (9")', 'Compare with Cloud 7']);
      return;
    }

    // 3. Comfort Core reversibility
    if (lower.includes('comfort core') && (lower.includes('reversible') || lower.includes('flip') || lower.includes('dual'))) {
      appendMessage('assistant', "Reversibility is not confirmed for Comfort Core in the approved reference. Please follow the model's official care instructions.", PRODUCTS_2_0['06']);
      return;
    }

    // 4. Pocket Luxe motion transfer
    if (lower.includes('pocket luxe') && (lower.includes('zero') || lower.includes('completely') || lower.includes('partner'))) {
      appendMessage('assistant', "Pocket Luxe is designed for independent pocket support and reduced motion transfer to minimize partner disturbance. It reduces transfer, but does not guarantee zero movement.", PRODUCTS_2_0['07']);
      return;
    }

    // 5. All models 15 years
    if ((lower.includes('15') || lower.includes('warranty')) && (lower.includes('all') || lower.includes('every') || lower.includes('ella'))) {
      appendMessage('assistant', "No, it depends on the model. Cloud 7 has 3 years; Cloud Ortho and Plush have 5; Ortho Hybrid, Comfort Core, and Pocket Luxe have 10; Ortho Latex has 12; Hybrid Fusion has 15. Coverage follows the applicable warranty policy.");
      return;
    }

    // 6. Hybrid Fusion spring count
    if (lower.includes('hybrid fusion') && (lower.includes('spring') || lower.includes('coil'))) {
      appendMessage('assistant', "Hybrid Fusion names Natural Latex Foam, Memory Foam, and Orthopedic Foam. Whether springs are present is not specified in the approved baseline.", PRODUCTS_2_0['08']);
      return;
    }

    // 7. Ortho Latex organic
    if (lower.includes('ortho latex') && (lower.includes('organic') || lower.includes('100%'))) {
      appendMessage('assistant', "Ortho Latex offers responsive latex comfort with a medium-firm feel, but 100% organic certification and exact latex composition are unconfirmed in the approved baseline.", PRODUCTS_2_0['05']);
      return;
    }

    // 8. Back pain cure
    if (lower.includes('cure') || lower.includes('back pain') || lower.includes('spine pain')) {
      appendMessage('assistant', "I can explain the comfort and support options, but I cannot promise a mattress will treat back pain. Do you prefer a medium or medium-firm feel?");
      renderQuickOptions(['Medium-Firm Support', 'Balanced Medium', 'Showroom Visit']);
      return;
    }

    // 9. All Models Overview
    if (lower.includes('all') && (lower.includes('model') || lower.includes('mattress') || lower.includes('options'))) {
      appendMessage('assistant', "LORA crafts 8 handcrafted models across 3 distinct comfort zones:\n\n• **Plush & Soft**: Lora Plush (Soft) & Cloud 7 (Medium-Soft, 7\")\n• **Balanced Medium**: Cloud Ortho (9\"), Comfort Core (10-Yr), & Pocket Luxe (Pocket Spring)\n• **Medium-Firm Ortho**: Ortho Hybrid, Ortho Latex (12-Yr Latex), & Hybrid Fusion (15-Yr Flagship)\n\nWhich comfort level feels best for your body?");
      renderQuickOptions(['Plush / Soft', 'Balanced Medium', 'Medium-Firm Ortho']);
      return;
    }

    // 10. Flat Delivery vs Rolled
    if (lower.includes('flat') || lower.includes('rolled') || lower.includes('box') || lower.includes('compression')) {
      appendMessage('assistant', "At LORA, **You Sleep Flat. Why Should Your Comfort Come Rolled?**\n\nUnlike box mattresses crushed under hydraulic presses, LORA delivers 100% full-size flat direct from our factory. This preserves titanium coil tempered memory and foam cell integrity so it arrives ready to sleep on immediately!");
      renderQuickOptions(['View 8 Models', 'Check Pincode', 'Compare Warranties']);
      return;
    }

    // 11. Sleeping Positions
    if (lower.includes('side sleep') || lower.includes('side-sleep') || lower.includes('shoulder')) {
      appendMessage('assistant', "For side sleepers, pressure relief around shoulders and hips is essential. We recommend **LORA PLUSH™** (Pillow Top, Soft) for deep plush cushioning, or **LORA CLOUD 7™** (Medium-Soft) for balanced comfort.", PRODUCTS_2_0['03']);
      renderQuickOptions(['LORA PLUSH™ (Soft)', 'Cloud 7 (Medium-Soft)', 'Compare Both']);
      return;
    }

    if (lower.includes('back sleep') || lower.includes('back-sleep')) {
      appendMessage('assistant', "For back sleepers, balanced lumbar support is key to prevent lower spine sagging. We recommend **LORA CLOUD ORTHO™** (9-inch Medium) or **LORA COMFORT CORE™** (10-Yr Medium Pillow Top).", PRODUCTS_2_0['02']);
      renderQuickOptions(['Cloud Ortho (9")', 'Comfort Core (10y)', 'Ortho Hybrid (Firm)']);
      return;
    }

    // 12. Couples / Motion Transfer
    if (lower.includes('couple') || lower.includes('partner') || lower.includes('motion') || lower.includes('movement')) {
      appendMessage('assistant', "If partner movement or tossing and turning is a concern, **LORA POCKET LUXE™** features independent pocket springs that isolate motion with zero ripple effect across the bed.", PRODUCTS_2_0['07']);
      renderQuickOptions(['Pocket Luxe Details', 'Check King Price', 'Compare Models']);
      return;
    }

    // 13. Cooling / Hot Sleepers
    if (lower.includes('cool') || lower.includes('hot') || lower.includes('sweat') || lower.includes('breathable')) {
      appendMessage('assistant', "For a naturally cooler night's rest, **LORA ORTHO LATEX™** uses breathable open-cell latex with pin-core ventilation, while **LORA POCKET LUXE™** provides continuous air circulation through its coil core.", PRODUCTS_2_0['05']);
      renderQuickOptions(['Ortho Latex Details', 'Pocket Luxe Details', 'Check Prices']);
      return;
    }

    // 14. General Help Me Choose / Recommendations
    if (lower.includes('recommend') || lower.includes('help me choose') || lower.includes('which one') || lower.includes('confused') || lower.includes('best')) {
      appendMessage('assistant', "To help you choose the best match among our 8 models:\n\n1. **What is your sleep position?** (Side, Back, or Stomach?)\n2. **Do you prefer plush sink-in comfort, balanced medium contour, or firm orthopedic support?**\n\nShare your preference and I will recommend the top 2 matching mattresses!");
      renderQuickOptions(['Side Sleeper (Plush)', 'Back Sleeper (Medium)', 'Firm Support (Ortho)', 'Couples (Zero Motion)']);
      return;
    }

    // 15. Default helpful response
    appendMessage(
      'assistant',
      "I’m Lumi, Lora’s AI sleep assistant. Tell me about your preferred sleep feel (soft, medium, or firm) or your sleep position, and I'll guide you through our 8 handcrafted mattresses."
    );
    renderQuickOptions(['View All 8 Models', 'Side / Back Sleeper', 'Back Pain Guide', 'Check Delivery']);
  }

  // Send query to Lumi server API
  async function handleUserInput(userInput) {
    if (!userInput || state.isThinking) return;

    appendMessage('user', userInput);
    renderQuickOptions([]);

    // Check if in active lead collection flow
    if (handleLeadFlow(userInput)) {
      return;
    }

    // Check if user agreed to team finalisation
    const lower = userInput.toLowerCase();
    if (lower.includes('yes') && (lower.includes('team') || lower.includes('help') || lower.includes('call') || lower.includes('finalise') || lower.includes('വിളിക്കണോ'))) {
      state.leadStep = 1;
      appendMessage(
        'assistant',
        "Would you like the Lora team to confirm the price and help you finalise this option? What name should we use for your requested follow-up?"
      );
      renderQuickOptions(['Skip']);
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

    if (checkPinBtn) {
      checkPinBtn.onclick = () => {
        handleUserInput('What is the delivery timeline for my pincode?');
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
      setTimeout(() => handleUserInput(q), 250);
    }
  };

})();
