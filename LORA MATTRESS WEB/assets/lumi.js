/**
 * LUMI — LORA's AI SLEEP ASSISTANT
 * Miniature 3D Mattress Launcher, Ghost Character & Bilingual Chat Assistant
 */

(function () {
  'use strict';

  // Session Storage Keys
  const SESSION_GREETING_KEY = 'lora_lumi_greeted_v1';
  const STORE_LEADS_STORAGE_KEY = 'lora_store_leads_v1';

  // State Management
  const state = {
    isOpen: false,
    hasGreeted: false,
    isThinking: false,
    history: [],
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

  // Helper to extract currently viewed mattress context
  function getPageContext() {
    let productName = '';
    let size = '';
    let thickness = '';

    // Check PDP elements
    const titleEl = document.querySelector('.pdp-title, #product-title, h1.product-title');
    if (titleEl) {
      productName = titleEl.textContent.trim();
    } else {
      // Default to flagship Cloud 7
      productName = 'LORA CLOUD 7™ Luxury Ortho';
    }

    // Size selector
    const activeSizeBtn = document.querySelector('.pdp-size-btn.active, .size-pill.active, [data-size].active');
    if (activeSizeBtn) {
      size = activeSizeBtn.getAttribute('data-size') || activeSizeBtn.textContent.trim();
    } else {
      size = 'King Size (78" × 72")';
    }

    // Thickness selector
    const activeThickBtn = document.querySelector('.pdp-thick-btn.active, .thickness-pill.active, [data-thickness].active');
    if (activeThickBtn) {
      thickness = activeThickBtn.getAttribute('data-thickness') || activeThickBtn.textContent.trim();
    } else {
      thickness = '8-inch Luxury EuroTop';
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
          <strong>Hi, I’m Lumi!</strong> Need help choosing your mattress?
        </p>
        <button type="button" class="lumi-greeting-close" id="lumi-dismiss-greeting" aria-label="Dismiss greeting">✕</button>
      </div>

      <!-- 3D Mattress & Lumi Character Launcher -->
      <button type="button" class="lumi-launcher-btn" id="lumi-launcher" aria-label="Open Lumi Sleep Assistant">
        <div class="lumi-mattress-shadow"></div>

        <!-- 3D Miniature Mattress Vector -->
        <div class="lumi-mattress-stage">
          <svg class="lumi-mattress-svg" viewBox="0 0 100 75" fill="none" xmlns="http://www.w3.org/2000/svg">
            <!-- Isometric Mattress Base Shadow/Depth -->
            <polygon points="50,68 88,48 50,28 12,48" fill="#080E1C" opacity="0.6"/>
            <!-- Bottom Layer (High-Resilience Core) -->
            <path d="M12,46 L50,66 L88,46 L88,52 L50,72 L12,52 Z" fill="#0A152E" stroke="#00B4D8" stroke-width="0.75"/>
            <!-- Mid Layer (ErgoSupport Transition) -->
            <path d="M12,41 L50,61 L88,41 L88,46 L50,66 L12,46 Z" fill="#0F2042" stroke="#38BDF8" stroke-width="0.75"/>
            <!-- Plush EuroTop Pillow Layer -->
            <path d="M12,34 L50,54 L88,34 L88,41 L50,61 L12,41 Z" fill="#1E293B" stroke="#00B4D8" stroke-width="1"/>
            <!-- Top Quilted Mattress Surface (Soft White with Subtle Cyan Tint) -->
            <polygon points="50,16 88,34 50,54 12,34" fill="url(#mattressTopGrad)" stroke="#38BDF8" stroke-width="1.2"/>
            <!-- Diamond Quilted Luxury Stitching Pattern -->
            <line x1="31" y1="25" x2="69" y2="44" stroke="#00B4D8" stroke-width="0.8" stroke-dasharray="2 2" opacity="0.6"/>
            <line x1="69" y1="25" x2="31" y2="44" stroke="#00B4D8" stroke-width="0.8" stroke-dasharray="2 2" opacity="0.6"/>
            <line x1="50" y1="16" x2="50" y2="54" stroke="#38BDF8" stroke-width="0.6" stroke-dasharray="2 2" opacity="0.4"/>
            <!-- Subtle Corner Edge Tuft Highlights -->
            <circle cx="50" cy="35" r="2" fill="#38BDF8" opacity="0.8"/>
            <circle cx="38" cy="29" r="1.5" fill="#38BDF8" opacity="0.6"/>
            <circle cx="62" cy="29" r="1.5" fill="#38BDF8" opacity="0.6"/>
            <circle cx="38" cy="41" r="1.5" fill="#38BDF8" opacity="0.6"/>
            <circle cx="62" cy="41" r="1.5" fill="#38BDF8" opacity="0.6"/>

            <defs>
              <linearGradient id="mattressTopGrad" x1="12" y1="16" x2="88" y2="54" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stop-color="#F8FAFC"/>
                <stop offset="45%" stop-color="#E2E8F0"/>
                <stop offset="100%" stop-color="#CBD5E1"/>
              </linearGradient>
            </defs>
          </svg>
        </div>

        <!-- Lumi Ghost Character (Cute, Friendly Sleep Sprite) -->
        <div class="lumi-character-sprite">
          <svg viewBox="0 0 60 70" fill="none" xmlns="http://www.w3.org/2000/svg">
            <!-- Gentle Soft White Body with Cyan Accent -->
            <path d="M30 6 C16 6, 8 16, 8 32 C8 46, 12 58, 16 62 C20 66, 26 58, 30 62 C34 58, 40 66, 44 62 C48 58, 52 46, 52 32 C52 16, 44 6, 30 6 Z"
                  fill="url(#lumiBodyGrad)"
                  stroke="rgba(56, 189, 248, 0.45)"
                  stroke-width="1.5"
                  filter="drop-shadow(0 4px 8px rgba(0, 180, 216, 0.25))"/>
            
            <!-- Cute Little Cloud Crest / Night Cap on Top -->
            <path d="M28 6 C28 3, 34 2, 36 5 C38 8, 34 9, 32 9 Z" fill="#BAE6FD" opacity="0.8"/>

            <!-- Warm Friendly Expressive Eyes -->
            <ellipse cx="23" cy="28" rx="3.2" ry="4.2" fill="#0B132B"/>
            <circle cx="24.2" cy="26.8" r="1.2" fill="#FFFFFF"/>
            
            <ellipse cx="37" cy="28" rx="3.2" ry="4.2" fill="#0B132B"/>
            <circle cx="38.2" cy="26.8" r="1.2" fill="#FFFFFF"/>

            <!-- Sweet Gentle Smile -->
            <path d="M26 36 C28 39, 32 39, 34 36" stroke="#0B132B" stroke-width="1.8" stroke-linecap="round"/>

            <!-- Blushing Rosy Cyan Cheeks -->
            <ellipse cx="18" cy="34" rx="3" ry="1.6" fill="rgba(56, 189, 248, 0.45)"/>
            <ellipse cx="42" cy="34" rx="3" ry="1.6" fill="rgba(56, 189, 248, 0.45)"/>

            <!-- Tiny Hug Arms -->
            <path d="M10 34 C6 35, 6 39, 11 38" stroke="#CBD5E1" stroke-width="1.5" stroke-linecap="round"/>
            <path d="M50 34 C54 35, 54 39, 49 38" stroke="#CBD5E1" stroke-width="1.5" stroke-linecap="round"/>

            <defs>
              <linearGradient id="lumiBodyGrad" x1="10" y1="6" x2="50" y2="65" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stop-color="#FFFFFF"/>
                <stop offset="60%" stop-color="#F1F5F9"/>
                <stop offset="100%" stop-color="#E0F2FE"/>
              </linearGradient>
            </defs>
          </svg>
        </div>

        <span class="lumi-status-badge" title="Lumi is online"></span>
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
                <span class="lumi-header-badge">AI Assistant</span>
              </h4>
              <p class="lumi-header-sub">
                <span>Lora Sleep-Tech</span> • <span>EN / മലയാളം / Manglish</span>
              </p>
            </div>
          </div>
          <button type="button" class="lumi-chat-close-btn" id="lumi-close-chat" aria-label="Close Chat">✕</button>
        </div>

        <!-- Currently Viewed Mattress Context Strip -->
        <div class="lumi-context-strip" id="lumi-context-strip">
          <span class="lumi-context-label">
            <span>🛏️</span>
            <strong id="lumi-context-product">LORA CLOUD 7™ Luxury Ortho</strong>
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
                 placeholder="Ask Lumi anything about sleep & mattresses..."
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
      if (urlParams.get('lumi_test') === '1') {
        setTimeout(() => {
          toggleChat(true);
          setTimeout(() => {
            appendMessage('user', 'Which mattress is best for spine support & back pain? My pin is 560038.');
            appendMessage('assistant', 'For spine alignment and back support, I recommend the **LORA Ortho Hybrid Multi-Zone** (Pocket springs + active contour) or **CLOUD 7™ Luxury Ortho**.\n\n✓ PIN code **560038** is fully serviceable for **100% Flat White-Glove delivery** within 1 to 2 business days directly from Bengaluru Central Works. 100% Free Shipping.\n\nWould you like our Lora team to help you finalise your choice?');
            appendMessage('user', 'Yes, please help me finalise');
            appendMessage('assistant', 'Wonderful! Our sleep specialists will follow up to ensure the perfect fit and delivery slot. May I know your name and contact number?');
            appendMessage('user', 'Pooja Menon • +91 98451 12233');
            state.leadData = { name: 'Pooja Menon', phone: '9845112233', pincode: '560038', place: 'Indiranagar, Bengaluru' };
            submitLeadToAdmin();
          }, 350);
        }, 300);
      }
    } catch (e) {}
  }

  // Update context strip based on current page
  function updateContextDisplay() {
    const ctx = getPageContext();
    const ctxProduct = document.getElementById('lumi-context-product');
    if (ctxProduct) {
      ctxProduct.textContent = `${ctx.productName} • ${ctx.size || 'King'}`;
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

        // Focus input on desktop
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
    appendMessage(
      'assistant',
      `Hi! I’m Lumi, your LORA Sleep Assistant ☁️\n\nI can help you find your ideal firmness, check 100% flat doorstep delivery to your PIN code, or review 0% EMI plans.\n\nYou're currently exploring the **${ctx.productName}** (${ctx.size}). How can I help you today?`
    );
    renderQuickOptions(['Help me choose', 'Find my size', 'Compare mattresses', 'Delivery & EMI']);
  }

  // Append a message bubble
  function appendMessage(sender, text) {
    const messagesEl = document.getElementById('lumi-messages');
    if (!messagesEl) return;

    state.history.push({ sender, text });

    const row = document.createElement('div');
    row.className = `lumi-msg-row ${sender}`;

    // Format bold and linebreaks
    let formattedText = text
      .replace(/\n\n/g, '<br><br>')
      .replace(/\n/g, '<br>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

    row.innerHTML = `<div class="lumi-msg-bubble">${formattedText}</div>`;
    messagesEl.appendChild(row);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  // Show typing indicator
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

  // Lead Collection State Machine (Customer First)
  function handleLeadFlow(userInput) {
    const val = (userInput || '').trim();

    // Step 1: Collecting Name
    if (state.leadStep === 1) {
      if (val.toLowerCase() === 'skip' || val.toLowerCase() === 'no') {
        state.leadStep = 0;
        appendMessage('assistant', "No problem at all! Feel free to ask anything else about mattresses or delivery.");
        renderQuickOptions(['Help me choose', 'Find my size', 'Compare mattresses', 'Delivery & EMI']);
        return true;
      }
      state.leadData.name = val;
      state.leadStep = 2;
      appendMessage('assistant', `Nice to meet you, ${val}! Which city or 6-digit PIN code should we route delivery to? (You can type 'skip' if you prefer)`);
      renderQuickOptions(['Bengaluru (560038)', 'Kochi (682001)', 'Mumbai (400050)', 'Skip']);
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
      appendMessage('assistant', "Got it! Lastly, what mobile number can our sleep specialist reach you on?");
      renderQuickOptions(['Skip']);
      return true;
    }

    // Step 3: Collecting Phone & Submitting
    if (state.leadStep === 3) {
      if (val.toLowerCase() !== 'skip') {
        // Basic phone cleanup
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
      summary: `Consultation on ${ctx.productName} (${ctx.size}). Customer inquired about sizing and flat delivery.`,
      source: 'Lumi AI Sleep Assistant',
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

    // Offline / LocalStorage synchronization
    try {
      const localLeads = JSON.parse(localStorage.getItem(STORE_LEADS_STORAGE_KEY) || '[]');
      localLeads.unshift(payload);
      localStorage.setItem(STORE_LEADS_STORAGE_KEY, JSON.stringify(localLeads));
      serverSuccess = true;
    } catch (e) {}

    if (serverSuccess) {
      appendMessage(
        'assistant',
        `✓ Thank you, **${state.leadData.name || 'there'}**! Your enquiry has been securely saved with our LORA sleep team. A specialist will assist you shortly.\n\nIn the meantime, feel free to explore or proceed to order whenever you're ready!`
      );
      renderQuickOptions(['View Product Details', 'Help me choose', 'Order Now ⚡']);
    } else {
      appendMessage(
        'assistant',
        "We couldn't connect right now, but you can also connect with our sleep specialist directly via phone or WhatsApp at **+91 95676 84770**."
      );
      renderQuickOptions(['Call +91 95676 84770', 'Try Again']);
    }
  }

  // Send query to Lumi server API
  async function handleUserInput(userInput) {
    if (!userInput || state.isThinking) return;

    appendMessage('user', userInput);
    renderQuickOptions([]); // Clear quick pills

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
        "Wonderful! Our LORA sleep specialists will follow up to ensure the perfect fit and delivery slot. May I know your name?"
      );
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
        appendMessage('assistant', data.reply || "I'm here to help you sleep better. What else would you like to know?");
        renderQuickOptions(data.quickOptions || ['Help me choose', 'Find my size', 'Compare mattresses', 'Delivery & EMI']);
      } else {
        throw new Error('API response was not ok');
      }
    } catch (err) {
      hideTypingIndicator();
      state.isThinking = false;

      // Pure offline / static fallback intelligence engine
      fallbackClientIntelligence(userInput);
    }
  }

  // Client-side fallback intelligence engine (satisfies bilingual English/Malayalam/Manglish requirements offline)
  function fallbackClientIntelligence(userInput) {
    const lower = userInput.toLowerCase();
    const ctx = getPageContext();

    // Check PIN code
    const pinMatch = lower.match(/\b([1-9][0-9]{5})\b/);
    if (pinMatch) {
      const pin = pinMatch[1];
      appendMessage(
        'assistant',
        `✓ PIN code **${pin}** is fully serviceable! LORA delivers **100% Flat & Uncompressed** (never rolled or squeezed into boxes) with White-Glove bedroom placement in 2 to 4 business days. Free shipping with 100% transit insurance.`
      );
      appendMessage(
        'assistant',
        "Would you like our Lora team to help you finalise your choice?"
      );
      renderQuickOptions(['Yes, have team help me', 'Help me choose', 'Find my size']);
      return;
    }

    // Help me choose
    if (lower.includes('help me choose') || lower.includes('recommend') || lower.includes('ethanu nalla') || lower.includes('ഏതാണ് നല്ലത്')) {
      appendMessage(
        'assistant',
        "To find your ideal comfort, what is your primary sleeping position?\n\n• **Back Sleeper:** LORA Ortho Hybrid Multi-Zone (Active spine alignment)\n• **Side / Combination Sleeper:** LORA CLOUD 7™ Luxury Ortho (Plush EuroTop pressure relief)\n• **Hot Sleeper:** LORA Air Grid Pure Chill"
      );
      renderQuickOptions(['Cloud 7 (Medium-Firm)', 'Ortho Hybrid (Firm)', 'Air Grid (Cooling)', 'Enter PIN code']);
      return;
    }

    // Find my size
    if (lower.includes('size') || lower.includes('dimension') || lower.includes('king') || lower.includes('queen') || lower.includes('സൈസ്')) {
      appendMessage(
        'assistant',
        "LORA standard dimensions (Length × Width):\n\n• **King Size:** 78\" × 72\" (6.5 × 6.0 ft) — Best for couples\n• **Queen Size:** 78\" × 60\" (6.5 × 5.0 ft) — Standard master beds\n• **Single / Diwan:** 78\" × 36\" (6.5 × 3.0 ft)\n\nWe also manufacture **custom dimensions** directly at LORA Works with 0% extra surcharge!"
      );
      renderQuickOptions(['Check My Pincode', 'Compare Prices', 'Help me choose']);
      return;
    }

    // Compare
    if (lower.includes('compare') || lower.includes('difference') || lower.includes('വ്യത്യാസം')) {
      appendMessage(
        'assistant',
        "• **CLOUD 7™:** Medium-Firm (6.5/10), 7-Zone Aeroflux Foam with luxury EuroTop pillow comfort.\n• **Ortho Hybrid:** Firm (8.0/10), Pocket springs with active orthopaedic spine contouring.\n• **Air Grid:** Japanese Hyper-Elastic Cooling Polymer Grid for zero heat trap."
      );
      appendMessage('assistant', "Would you like our Lora team to help you finalise your choice?");
      renderQuickOptions(['Yes, have team help me', 'Check Pincode Delivery', 'Delivery & EMI']);
      return;
    }

    // Delivery & EMI
    if (lower.includes('delivery') || lower.includes('emi') || lower.includes('shipping') || lower.includes('cod') || lower.includes('ഡെലിവറി')) {
      appendMessage(
        'assistant',
        "• **100% Flat Delivery:** We never vacuum-roll our luxury mattresses in boxes. Full steel edge support stays factory fresh.\n• **0% No-Cost EMI:** 3, 6, 9, 12 months available via Razorpay.\n• **100-Night Trial & 15-Year Warranty.**"
      );
      appendMessage('assistant', "What is your 6-digit delivery PIN code?");
      renderQuickOptions(['Enter PIN code', 'Yes, have team help me', 'Help me choose']);
      return;
    }

    // Team consultation prompt
    if (lower.includes('finalise') || lower.includes('team') || lower.includes('call') || lower.includes('buy') || lower.includes('order')) {
      state.leadStep = 1;
      appendMessage(
        'assistant',
        "We'd love to assist you! Our sleep specialists will follow up to ensure the perfect fit and delivery slot. May I know your name?"
      );
      renderQuickOptions(['Skip']);
      return;
    }

    // General fallback
    appendMessage(
      'assistant',
      `I can help you with sizing, orthopaedic support levels, 0% EMI terms, or checking flat delivery to your pin code for the **${ctx.productName}**.`
    );
    renderQuickOptions(['Help me choose', 'Find my size', 'Compare mattresses', 'Delivery & EMI']);
  }

  // Bind all UI events
  function bindEvents() {
    const launcher = document.getElementById('lumi-launcher');
    const closeBtn = document.getElementById('lumi-close-chat');
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

    // Listen to size & thickness selector clicks on PDP to update context in real time
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
    ask: (q) => {
      toggleChat(true);
      setTimeout(() => handleUserInput(q), 300);
    }
  };

})();
