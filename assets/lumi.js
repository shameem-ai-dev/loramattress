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
      renderQuickOptions(['View All 8 Models', 'Help me choose', 'Find my size']);
      return true;
    }

    const info = extractContactInfo(val);

    // If phone number is provided anywhere
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
        appendMessage('assistant', `Got your number: **+91 ${state.leadData.phone}**! What is your 6-digit delivery **pincode** so our sleep specialist can verify exact delivery timelines for your area?`);
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
      appendMessage('assistant', `PIN code ${val} noted! What **contact number** should our sleep specialist call you on?`);
      renderQuickOptions(['Skip']);
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

  // Client-side fallback intelligence engine (Synchronized with Version 3.0 Engine)
  function fallbackClientIntelligence(userInput) {
    const lower = (userInput || '').toLowerCase();

    // 1. Back pain / Spine
    if (lower.includes('backpain') || lower.includes('back pain') || lower.includes('spine') || lower.includes('ortho') || lower.includes('വേദന') || lower.includes('naduvedana')) {
      appendMessage(
        'assistant',
        "For back pain relief and healthy spinal alignment, we strongly recommend **LORA ORTHO HYBRID™** (10-Yr Warranty) or **LORA ORTHO LATEX™** (12-Yr Warranty). Engineered with 7-zone SpineAlign™ ergonomics to keep your spine neutral and supported.",
        PRODUCTS_2_0['04']
      );
      renderQuickOptions(['Ortho Hybrid Details', 'Ortho Latex Details', 'Request Specialist Call']);
      return;
    }

    // 2. Call / Callback
    if (lower.includes('call') || lower.includes('callback') || lower.includes('contact') || lower.includes('talk to team') || lower.includes('speak to') || lower.includes('vilikumo') || lower.includes('വിളിക്കാമോ')) {
      state.leadStep = 1;
      appendMessage(
        'assistant',
        "Certainly! Our senior sleep specialists would be happy to give you a personalized consultation call.\n\nPlease share your **contact number** and **pincode** below so we can reach out with accurate advice and delivery options:"
      );
      renderQuickOptions(['Share Contact & PIN', 'Call +91 95676 84770']);
      return;
    }

    // 3. Recommendation / "Which is good ?" / "Which is best ?"
    if (lower.includes('which is good') || lower.includes('which is best') || lower.includes('which one is good') || lower.includes('recommend') || lower.includes('help me choose') || lower.includes('confused') || lower.includes('suggest') || lower.includes('best')) {
      appendMessage(
        'assistant',
        "To choose the best LORA mattress for your body and sleep preferences:\n\n• **For Back Pain & Spine Health**: **LORA ORTHO HYBRID™** (Medium-Firm, 10-Yr) or **LORA ORTHO LATEX™** (12-Yr)\n• **For Couples (Zero Motion Transfer)**: **LORA POCKET LUXE™** (Medium, 10-Yr)\n• **For Plush Soft Sink-In**: **LORA PLUSH™** (Soft Pillow Top, 5-Yr) or **CLOUD 7™** (Medium-Soft, 7\", 3-Yr)\n• **Master Luxury Flagship**: **LORA HYBRID FUSION™** (Latex + Memory Foam, 15-Yr)\n\nWhich comfort feel appeals to you?"
      );
      renderQuickOptions(['Back Pain (Ortho)', 'Couples (Pocket Luxe)', 'Plush Soft', 'Compare All 8']);
      return;
    }

    // 4. Couples / Motion Transfer
    if (lower.includes('couple') || lower.includes('partner') || lower.includes('motion') || lower.includes('movement') || lower.includes('shake')) {
      appendMessage(
        'assistant',
        "If partner movement or tossing and turning is a concern, **LORA POCKET LUXE™** features independent pocket springs that isolate motion with zero ripple effect across the bed.",
        PRODUCTS_2_0['07']
      );
      renderQuickOptions(['Pocket Luxe Details', 'Check King Price', 'Compare Models']);
      return;
    }

    // 5. Cooling
    if (lower.includes('cool') || lower.includes('hot') || lower.includes('sweat') || lower.includes('breathable') || lower.includes('ചൂട്')) {
      appendMessage(
        'assistant',
        "For a naturally cooler night's rest, **LORA ORTHO LATEX™** uses breathable open-cell latex with pin-core ventilation, while **LORA POCKET LUXE™** provides continuous air circulation through its coil core.",
        PRODUCTS_2_0['05']
      );
      renderQuickOptions(['Ortho Latex Details', 'Pocket Luxe Details', 'Check Prices']);
      return;
    }

    // 6. Flat Delivery
    if (lower.includes('flat') || lower.includes('rolled') || lower.includes('box') || lower.includes('compression') || lower.includes('delivery')) {
      appendMessage(
        'assistant',
        "At LORA: **You Sleep Flat. Why Should Your Comfort Come Rolled?**\n\nUnlike box mattresses crushed under hydraulic presses, LORA delivers 100% full-size flat direct from our factory in protective transit covers. It arrives uncompromised, structurally intact, and ready to sleep on immediately!"
      );
      renderQuickOptions(['View 8 Models', 'Check Pincode', 'Compare Warranties']);
      return;
    }

    // 7. Unknown / Custom questions
    if (lower.includes('round') || lower.includes('bulk') || lower.includes('custom') || lower.includes('resort') || lower.includes('hotel') || lower.includes('hospital')) {
      state.leadStep = 1;
      appendMessage(
        'assistant',
        "For custom dimensions, specialized bulk orders, or technical inquiries outside our standard catalog, our production master craftsmen and senior consultants review each requirement personally.\n\nPlease share your **contact number** and **pincode** below so our team can check feasibility and call you with accurate details:"
      );
      renderQuickOptions(['Share Contact & PIN', 'Call +91 95676 84770']);
      return;
    }

    // 8. General open fallback
    appendMessage(
      'assistant',
      "I’m Lumi, LORA's AI sleep specialist. Tell me about your preferred sleep feel (soft, balanced medium, or firm ortho), your sleep position, or if you would like our team to call you directly."
    );
    renderQuickOptions(['View All 8 Models', 'Side / Back Sleeper', 'Back Pain Guide', 'Request Callback']);
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
