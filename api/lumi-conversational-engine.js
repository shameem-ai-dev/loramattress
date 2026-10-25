/**
 * LUMI CONVERSATIONAL REASONING & REALTIME INTELLIGENCE ENGINE (VERSION 3.0)
 * Grounded in verified LORA Mattress catalog, SpineAlign™ science, and store leads pipeline.
 * Features:
 * - Realtime human-like conversation across all 8 handcrafted LORA mattresses
 * - Instant semantic recognition of back pain, recommendation, couples, cooling, delivery, prices
 * - Direct lead generation: captures contact number + pincode and persists to store_leads.json
 * - Intelligent routing: asks for contact & pincode whenever user asks something not known or requests a call
 * - Seamless trilingual support (English, Malayalam, Manglish)
 */

const fs = require('fs');
const path = require('path');

const LEADS_FILE = path.join(__dirname, '..', 'config', 'store_leads.json');
const KB_FILE = path.join(__dirname, '..', 'config', 'lumi_kb.json');
const CATALOG_FILE = path.join(__dirname, '..', 'config', 'catalog_data.json');
const GENERAL_BOT_FILE = path.join(__dirname, '..', 'config', 'lumi_general_chatbot.json');

// Safe file loaders
function loadJSON(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }
  } catch (e) {
    console.error(`[Lumi Engine] Error reading ${filePath}:`, e.message);
  }
  return null;
}

function getCatalogData() {
  return loadJSON(CATALOG_FILE) || {};
}

function getGeneralBotData() {
  return loadJSON(GENERAL_BOT_FILE) || {};
}

// 8 Verified LORA Models
const PRODUCTS_MAP = {
  '01': {
    id: '01',
    name: 'LORA CLOUD 7™',
    feel: 'Medium-Soft',
    height: '7 inches',
    warranty: '3 years',
    type: 'Eurotop comfort',
    basePrice: 22999,
    description: 'Plush Eurotop comfort with balanced everyday body support on a sleek 7-inch profile.'
  },
  '02': {
    id: '02',
    name: 'LORA CLOUD ORTHO™',
    feel: 'Medium',
    height: '9 inches',
    warranty: '5 years',
    type: 'Eurotop comfort',
    basePrice: 25999,
    description: 'Generous 9-inch Eurotop cushioning with balanced posture alignment. Cushioning without sinking too deep.'
  },
  '03': {
    id: '03',
    name: 'LORA PLUSH™',
    feel: 'Plush / Soft',
    height: '8-10 inches',
    warranty: '5 years',
    type: 'Pillow top',
    basePrice: 24999,
    description: 'Deep cloud-like sink-in luxury with gentle pressure relief for shoulders and hips. Ideal for side sleepers.'
  },
  '04': {
    id: '04',
    name: 'LORA ORTHO HYBRID™',
    feel: 'Medium-Firm',
    height: '8-10 inches',
    warranty: '10 years',
    type: 'Hybrid ortho-support',
    basePrice: 27999,
    description: 'Dynamic 7-zone SpineAlign™ core with targeted lumbar reinforcement. Best for back sleepers and back pain relief.'
  },
  '05': {
    id: '05',
    name: 'LORA ORTHO LATEX™',
    feel: 'Medium-Firm',
    height: '8-10 inches',
    warranty: '12 years',
    type: 'Latex comfort + Ortho core',
    basePrice: 29999,
    description: '100% natural pin-core Dunlop latex with open-cell ventilation. Naturally buoyant, cool, anti-dust-mite, with 12-year warranty.'
  },
  '06': {
    id: '06',
    name: 'LORA COMFORT CORE™',
    feel: 'Medium',
    height: '8-10 inches',
    warranty: '10 years',
    type: 'Pillow top balanced comfort',
    basePrice: 26999,
    description: 'Everyday balanced pillow-top comfort built for long-term resilience and versatile sleeping styles.'
  },
  '07': {
    id: '07',
    name: 'LORA POCKET LUXE™',
    feel: 'Medium',
    height: '8-10 inches',
    warranty: '10 years',
    type: 'Pocket spring + Pillow top',
    basePrice: 28999,
    description: 'Independently encased pocket coils with zero motion transfer. Partner movement does not shake the bed.'
  },
  '08': {
    id: '08',
    name: 'LORA HYBRID FUSION™',
    feel: 'Medium-Firm',
    height: '10-12 inches',
    warranty: '15 years',
    type: 'Tri-hybrid flagship (Latex + Memory Foam + Ortho Core)',
    basePrice: 34999,
    description: 'Master multi-layer luxury blending buoyant natural latex, contouring memory foam, and high-density orthopedic core with 15-year warranty.'
  }
};

const MODEL_ALIASES = {
  'cloud 7': '01',
  'cloud7': '01',
  'eurotop 7': '01',
  'eurotop 7 inch': '01',
  'cloud ortho': '02',
  'cloudortho': '02',
  'eurotop 9': '02',
  'eurotop 9 inch': '02',
  'lora plush': '03',
  'plush': '03',
  'excel pillow top': '03',
  'ortho hybrid': '04',
  'orthohybrid': '04',
  'ortho latex': '05',
  'ortholatex': '05',
  'ortho ema latex': '05',
  'comfort core': '06',
  'comfortcore': '06',
  'classic pillow top': '06',
  'pocket luxe': '07',
  'pocketluxe': '07',
  'platinum pillow top': '07',
  'hybrid fusion': '08',
  'hybridfusion': '08',
  'hybrid elite fusion': '08'
};

// Language detection
function detectLang(text) {
  if (!text) return 'en';
  if (/[\u0D00-\u0D7F]/.test(text)) return 'ml';
  const manglishKeywords = [
    'nalla', 'aanu', 'ethra', 'engane', 'cheyyam', 'undu', 'illa', 'namaskaram',
    'vilikumo', 'vilikkumo', 'vilikkoo', 'call cheyyo', 'pettannu', 'veetil', 'para',
    'parayamo', 'entha', 'enthokke', 'manasilayi', 'aano', 'shari', 'nokkam', 'venam',
    'ariyamo', 'oru', 'kurachu', 'rate', 'ennu', 'kollamo', 'athinte', 'ithinte',
    'alle', 'parayu', 'choykkam', 'tharumo', 'kidakkunna', 'enthanu', 'nokkiyalo',
    'aayittulla', 'naduvedana', 'vedana'
  ];
  const lower = text.toLowerCase();
  for (const w of manglishKeywords) {
    if (new RegExp('\\b' + w + '\\b', 'i').test(lower)) return 'manglish';
  }
  return 'en';
}

// Extract contact details (Phone, PIN code, Name) from message
function extractContactInfo(text) {
  if (!text) return null;
  const str = String(text);

  let phone = null;
  let pincode = null;
  let name = null;

  // 1. Phone matching: 10 consecutive digits or +91 format
  const phonePattern = /(?:\+?91[\s\-]?)?([6-9]\d{9})\b/;
  const phoneMatch = str.match(phonePattern);
  if (phoneMatch) {
    phone = phoneMatch[1];
  } else {
    // Check digits only
    const digits = str.replace(/\D/g, '');
    if (digits.length === 10 && /^[6-9]/.test(digits)) {
      phone = digits;
    } else if (digits.length === 12 && digits.startsWith('91') && /^[6-9]/.test(digits.slice(2))) {
      phone = digits.slice(2);
    }
  }

  if (phone === '9072616423') phone = null; // Lora support line (appears in quick replies)

  // 2. PIN code matching: 6 digits starting with 1-9
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

  // 3. Name matching
  const namePattern = /(?:my name is|i am|name[:\s]+)\s*([a-zA-Z\s]{2,30})/i;
  const nameMatch = str.match(namePattern);
  if (nameMatch) {
    name = nameMatch[1].trim();
  }

  return { phone, pincode, name };
}

// Save lead directly to config/store_leads.json
function saveLeadToStore(leadPayload) {
  try {
    let leads = [];
    if (fs.existsSync(LEADS_FILE)) {
      leads = JSON.parse(fs.readFileSync(LEADS_FILE, 'utf8')) || [];
    }

    const cleanPhone = (leadPayload.phone || '').replace(/\D/g, '').slice(-10);
    const newLead = {
      id: leadPayload.id || ('lumi-' + Date.now()),
      name: leadPayload.name || 'Storefront Customer',
      phone: cleanPhone,
      pincode: leadPayload.pincode || '',
      place: leadPayload.place || '',
      preferredMattress: leadPayload.preferredMattress || null,
      preferredSize: leadPayload.preferredSize || null,
      preferredThickness: leadPayload.preferredThickness || null,
      summary: leadPayload.summary || 'Customer consultation via Lumi AI',
      source: leadPayload.source || 'Lumi AI Sleep Assistant (Realtime)',
      resultType: leadPayload.resultType || 'lumi_consultation',
      studioId: null,
      studioName: leadPayload.pincode ? `Direct Serviced PIN ${leadPayload.pincode}` : 'Direct Customer Consultation',
      distanceKm: null,
      status: 'New',
      createdAt: new Date().toISOString(),
      notes: leadPayload.notes || leadPayload.summary || 'Customer inquiry submitted via Lumi AI'
    };

    // Check if recent lead with same phone exists, update it or unshift new
    const existingIdx = leads.findIndex(l => l.phone && l.phone.slice(-10) === cleanPhone);
    if (existingIdx !== -1 && cleanPhone.length === 10) {
      leads[existingIdx] = {
        ...leads[existingIdx],
        ...newLead,
        summary: `${leads[existingIdx].summary} | Updated: ${newLead.summary}`,
        updatedAt: new Date().toISOString()
      };
    } else {
      leads.unshift(newLead);
    }

    fs.writeFileSync(LEADS_FILE, JSON.stringify(leads, null, 2), 'utf8');
    return newLead;
  } catch (err) {
    console.error('[Lumi Engine] Error saving lead:', err);
    return null;
  }
}

// PIN code deliverability lookup
function resolvePincodeInfo(pincode) {
  if (!pincode || !/^\d{6}$/.test(pincode)) return null;
  const pin = pincode.trim();
  const prefix = pin.substring(0, 2);

  let hub = 'Pan-India Express Logistics';
  let days = '3 to 5 business days';

  if (prefix === '56') { hub = 'Bengaluru Hub'; days = '1 to 2 business days'; }
  else if (prefix >= '67' && prefix <= '69') { hub = 'Kerala & Kochi Hub'; days = '2 to 3 business days'; }
  else if (prefix === '40' || prefix === '41') { hub = 'Mumbai & Pune Hub'; days = '2 to 3 business days'; }
  else if (prefix === '11' || prefix === '12' || prefix === '20') { hub = 'Delhi NCR Hub'; days = '2 to 4 business days'; }
  else if (prefix === '60') { hub = 'Chennai Hub'; days = '2 to 3 business days'; }
  else if (prefix === '50') { hub = 'Hyderabad Hub'; days = '2 to 3 business days'; }

  return { pincode: pin, hub, days };
}

// Calculate variant price dynamically
function getDynamicPrice(modelId, sizeStr, thickStr) {
  const cat = getCatalogData();
  const prod = cat[modelId] || PRODUCTS_MAP[modelId];
  if (!prod) return '₹22,999';

  const base = prod.basePrice || 22999;
  let mult = 1.0;
  const s = (sizeStr || 'queen').toLowerCase();
  if (s.includes('king')) mult = prod.multipliers?.king || 1.18;
  else if (s.includes('queen')) mult = prod.multipliers?.queen || 1.0;
  else if (s.includes('single')) mult = prod.multipliers?.single || 0.68;
  else if (s.includes('double')) mult = prod.multipliers?.double || 0.82;

  let offset = 0;
  const thickNum = parseInt(thickStr, 10) || 8;
  if (prod.thicknessOffsets && prod.thicknessOffsets[thickNum.toString()] !== undefined) {
    offset = prod.thicknessOffsets[thickNum.toString()];
  }

  const finalVal = Math.round(base * mult + offset);
  return '₹' + finalVal.toLocaleString('en-IN');
}

// Find every model mentioned in a text, in order of appearance
function findModelIds(text) {
  const lower = String(text || '').toLowerCase();
  const found = [];
  for (const [alias, id] of Object.entries(MODEL_ALIASES)) {
    const idx = lower.indexOf(alias);
    if (idx !== -1) found.push([idx, id]);
  }
  found.sort((a, b) => a[0] - b[0]);
  return [...new Set(found.map(f => f[1]))];
}

function shortName(id) {
  return PRODUCTS_MAP[id].name.replace(/^LORA\s+/, '');
}

const FIRMNESS = { 'Plush / Soft': 1, 'Medium-Soft': 2, 'Medium': 3, 'Medium-Firm': 4 };

function priceReply(id, size) {
  const p = PRODUCTS_MAP[id];
  const requestedSize = size ? size.charAt(0).toUpperCase() + size.slice(1).toLowerCase() : 'Queen';
  const requestedPrice = getDynamicPrice(id, requestedSize.toLowerCase(), '8');
  const qPrice = getDynamicPrice(id, 'queen', '8');
  const kPrice = getDynamicPrice(id, 'king', '8');
  const sizeLine = requestedSize !== 'Queen'
    ? `• **${requestedSize} Size**: **${requestedPrice}** (Queen: ${qPrice}, King: ${kPrice})`
    : `• **Queen Size (78"×60")**: **${qPrice}**\n• **King Size (78"×72")**: **${kPrice}**`;
  return {
    reply: `Factory-direct pricing for **${p.name}** (${p.feel}, ${p.warranty} warranty):\n\n${sizeLine}\n\n✓ Factory-direct savings (no showroom markup)\n✓ 0% No-Cost EMI with Bajaj Finserv\n✓ Complimentary 5-Piece Bedding Kit\n✓ 100% Full-Size Flat Doorstep Delivery\n\nExact price depends on thickness — you can pick it on the product page.`,
    card: { ...p, price: requestedPrice },
    quickOptions: [`Order ${shortName(id)}`, requestedSize === 'King' ? 'Queen Price' : 'King Price', 'Check Pincode', 'Compare with Another']
  };
}

function compareReply(a, b) {
  const A = PRODUCTS_MAP[a];
  const B = PRODUCTS_MAP[b];
  const fa = FIRMNESS[A.feel] || 3;
  const fb = FIRMNESS[B.feel] || 3;
  let verdict;
  if (fa !== fb) {
    const softer = fa < fb ? A : B;
    const firmer = fa < fb ? B : A;
    verdict = `Choose **${softer.name}** if you love softer cushioning (great for side sleepers). Choose **${firmer.name}** for firmer, more supportive comfort (back/stomach sleepers or back pain).`;
  } else {
    const wa = parseInt(A.warranty, 10) || 0;
    const wb = parseInt(B.warranty, 10) || 0;
    const longer = wa >= wb ? A : B;
    const cheaper = A.basePrice <= B.basePrice ? A : B;
    verdict = `Both share a **${A.feel}** feel. **${longer.name}** gives you the longer ${longer.warranty} warranty, while **${cheaper.name}** is the more budget-friendly pick.`;
  }
  const pick = (parseInt(A.warranty, 10) || 0) >= (parseInt(B.warranty, 10) || 0) ? A : B;
  return {
    reply: `**${A.name} vs ${B.name}**\n\n• **Feel**: ${A.feel} vs ${B.feel}\n• **Build**: ${A.type} vs ${B.type}\n• **Height**: ${A.height} vs ${B.height}\n• **Warranty**: ${A.warranty} vs ${B.warranty}\n• **Starts from**: ₹${A.basePrice.toLocaleString('en-IN')} vs ₹${B.basePrice.toLocaleString('en-IN')}\n\n**My take:** ${verdict}`,
    card: pick,
    quickOptions: [`Price for ${shortName(a)}`, `Price for ${shortName(b)}`, 'Which suits back pain?', 'Request Specialist Call']
  };
}

function modelDetailsReply(id, lower) {
  const p = PRODUCTS_MAP[id];
  let note = '';
  if (/\b(back ?pain|spine|spinal|lower back|backache)\b/.test(lower)) {
    note = (FIRMNESS[p.feel] || 3) >= 4
      ? `\n\n✓ **Good for back pain** — its ${p.feel} support keeps the spine aligned.`
      : `\n\nFor back pain, a firmer option such as **LORA ORTHO HYBRID™** (Medium-Firm) usually gives better spinal support than this ${p.feel} feel.`;
  } else if (/\b(couple|partner|motion)\b/.test(lower) && id !== '07') {
    note = '\n\nFor zero partner disturbance, **LORA POCKET LUXE™** (independent pocket springs) is our top pick.';
  }
  return {
    reply: `**${p.name}**\n• **Feel**: ${p.feel}\n• **Design**: ${p.type}\n• **Height Profile**: ${p.height}\n• **Factory Warranty**: ${p.warranty}\n• **Highlights**: ${p.description}${note}\n\nPrices start from around **₹${p.basePrice.toLocaleString('en-IN')}** (Queen), including the Complimentary 5-Piece Bedding Kit.`,
    card: p,
    quickOptions: [`Price for ${shortName(id)}`, 'King Price', 'Compare with Another', 'Request Specialist Call']
  };
}

function feelGroupReply(group) {
  const groups = {
    soft: { title: 'Plush & Soft', ids: ['03', '01'], why: 'deep cushioning that cradles shoulders and hips — ideal for side sleepers' },
    medium: { title: 'Balanced Medium', ids: ['02', '06', '07'], why: 'the sweet spot of cushioning and support for most sleepers and couples' },
    firm: { title: 'Medium-Firm & Orthopedic', ids: ['04', '05', '08'], why: 'firmer support that keeps the spine neutral — best for back pain, back and stomach sleepers' }
  };
  const g = groups[group];
  const lines = g.ids.map(id => `• **${PRODUCTS_MAP[id].name}** — ${PRODUCTS_MAP[id].feel}, ${PRODUCTS_MAP[id].warranty} warranty, from ₹${PRODUCTS_MAP[id].basePrice.toLocaleString('en-IN')}`).join('\n');
  return {
    reply: `**${g.title}** mattresses give ${g.why}:\n\n${lines}\n\nWhich one would you like to explore?`,
    card: PRODUCTS_MAP[g.ids[0]],
    quickOptions: g.ids.map(id => shortName(id)).concat(['Compare ' + shortName(g.ids[0]) + ' vs ' + shortName(g.ids[1])]).slice(0, 4)
  };
}

function isPricingQueryEarly(lower) {
  return /\b(price|prices|pricing|cost|rates?|how much|discount|offers?|emi|bajaj|ethra)\b|വില/.test(lower);
}

/**
 * MASTER CONVERSATIONAL LOGIC
 */
function processConversationalQuery(message, context, history) {
  const lang = detectLang(message);
  const raw = (message || '').trim();
  const lower = raw.toLowerCase();
  const ctx = context || {};

  // Extract contact info
  const contactInfo = extractContactInfo(raw);

  // Extract memory from history
  let activePhone = contactInfo.phone;
  let activePin = contactInfo.pincode;
  let activeName = contactInfo.name;
  let lastInquiry = raw;

  if (Array.isArray(history)) {
    for (let i = history.length - 1; i >= 0; i--) {
      const h = history[i];
      if (h.sender === 'user') {
        const histContact = extractContactInfo(h.text);
        if (!activePhone && histContact.phone) activePhone = histContact.phone;
        if (!activePin && histContact.pincode) activePin = histContact.pincode;
        if (!activeName && histContact.name) activeName = histContact.name;
        if (!lastInquiry && h.text && h.text.length > 5) lastInquiry = h.text;
      }
    }
  }

  // =========================================================================
  // 1. LEAD CAPTURE: User provided contact number (and/or pincode)
  // =========================================================================
  if (contactInfo.phone) {
    const leadPayload = {
      name: contactInfo.name || activeName || 'Storefront Customer',
      phone: contactInfo.phone,
      pincode: contactInfo.pincode || activePin || '',
      place: '',
      preferredMattress: ctx.productName || 'LORA Mattress Consultation',
      preferredSize: ctx.size || 'Standard Size',
      preferredThickness: ctx.thickness || 'Standard Thickness',
      summary: `Customer inquiry: "${raw}" | Ref: ${ctx.productName || 'Catalog'}`,
      source: 'Lumi AI Sleep Assistant (Realtime Chatbot)',
      notes: `User asked: "${raw}". Phone: ${contactInfo.phone}, PIN: ${contactInfo.pincode || activePin || 'Pending'}`
    };

    const savedLead = saveLeadToStore(leadPayload);

    if (contactInfo.pincode || activePin) {
      const pinUsed = contactInfo.pincode || activePin;
      const pinDetails = resolvePincodeInfo(pinUsed);
      const deliveryText = pinDetails ? ` (${pinDetails.hub}, ~${pinDetails.days})` : '';

      if (lang === 'ml') {
        return {
          reply: `✓ **വിവരങ്ങൾ വിജയകരമായി രജിസ്റ്റർ ചെയ്തു!**\n\nനന്ദി ${contactInfo.name || ''}! പിൻകോഡ് **${pinUsed}**${deliveryText}-ലേക്കുള്ള നിങ്ങളുടെ വിവരങ്ങൾ ഞങ്ങളുടെ സീനിയർ സ്ലീപ്പ് ടീമിന് കൈമാറി. **+91 ${contactInfo.phone}** എന്ന നമ്പറിലേക്ക് ഞങ്ങളുടെ വിദഗ്ദ്ധൻ ഉടൻ ബന്ധപ്പെടുന്നതാണ്.`,
          quickOptions: ['എല്ലാ മോഡലുകളും കാണുക', 'വില വിവരങ്ങൾ', 'വാറന്റി വിശദാംശങ്ങൾ'],
          leadRegistered: true,
          lead: savedLead
        };
      }
      if (lang === 'manglish') {
        return {
          reply: `✓ **Enquiry Successfully Saved!**\n\nThank you ${contactInfo.name || ''}! PIN code **${pinUsed}**${deliveryText}-ലേക്കുള്ള details Lora specialist team-il save cheythittundu. **+91 ${contactInfo.phone}**-il nammude senior advisor udan vilichu help cheyyum.`,
          quickOptions: ['View 8 Models', 'Check EMI Options', 'Size Guide'],
          leadRegistered: true,
          lead: savedLead
        };
      }
      return {
        reply: `✓ **Consultation Request Confirmed!**\n\nThank you ${contactInfo.name ? contactInfo.name + '! ' : ''}Your inquiry has been registered with our senior sleep team for PIN **${pinUsed}**${deliveryText}. A specialist will call you shortly at **+91 ${contactInfo.phone}** to assist you personally with mattress selection and factory-direct pricing.`,
        quickOptions: ['View All 8 Models', 'Check EMI Options', 'Size Guide'],
        leadRegistered: true,
        lead: savedLead
      };
    } else {
      // Phone given, but PIN code pending
      if (lang === 'ml') {
        return {
          reply: `ഫോൺ നമ്പർ (+91 ${contactInfo.phone}) ലഭിച്ചു! നിങ്ങളുടെ പ്രദേശത്തെ ഡെലിവറി സമയവും സമീപത്തെ ഷോറൂം വിവരങ്ങളും അറിയാൻ നിങ്ങളുടെ **6-അക്ക പിൻകോഡ്** (PIN code) കൂടി പങ്കുവെക്കാമോ?`,
          quickOptions: ['പിൻകോഡ് നൽകുക', 'സ്കിപ്പ് ചെയ്യുക'],
          suggestLead: true,
          leadRegistered: true,
          lead: savedLead
        };
      }
      if (lang === 'manglish') {
        return {
          reply: `Phone number (+91 ${contactInfo.phone}) noted! Ningalude location-le delivery timeline and service verify cheyyan **6-digit PIN code** koodi share cheyyamo?`,
          quickOptions: ['Enter Pincode', 'Skip'],
          suggestLead: true,
          leadRegistered: true,
          lead: savedLead
        };
      }
      return {
        reply: `Got your contact number: **+91 ${contactInfo.phone}**! What is your 6-digit delivery **pincode** so our sleep specialist can verify exact delivery timelines and showroom support for your area?`,
        quickOptions: ['Enter PIN code', 'Skip'],
        suggestLead: true,
        leadRegistered: true,
        lead: savedLead
      };
    }
  }

  // If user only provided a 6-digit PIN code without other query
  if (contactInfo.pincode && raw.replace(/\D/g, '').length === 6) {
    const pinDetails = resolvePincodeInfo(contactInfo.pincode);
    const hubText = pinDetails ? `PIN **${contactInfo.pincode}** is serviceable via our **${pinDetails.hub}** (${pinDetails.days} doorstep delivery).` : `PIN **${contactInfo.pincode}** is serviceable pan-India.`;

    if (lang === 'ml') {
      return {
        reply: `${hubText}\n\nനിങ്ങൾക്ക് അനുയോജ്യമായ മെത്ത തിരഞ്ഞെടുക്കാനും ഫാക്ടറി വില ഉറപ്പാക്കാനും ഞങ്ങളുടെ സ്പെഷ്യലിസ്റ്റ് വിളിക്കാൻ നിങ്ങളുടെ **ഫോൺ നമ്പർ** നൽകാമോ?`,
        quickOptions: ['ഫോൺ നമ്പർ നൽകുക', 'മെത്തകൾ കാണുക'],
        suggestLead: true
      };
    }
    return {
      reply: `${hubText}\n\nWould you like our senior sleep consultant to call you and guide your mattress selection? Please share your **contact number**:`,
      quickOptions: ['Share Phone Number', 'Explore 8 Models', 'Check Prices'],
      suggestLead: true
    };
  }

  // =========================================================================
  // 2. CALL / CALLBACK / SPECIALIST CONSULTATION REQUEST
  // =========================================================================
  const isCallRequest =
    /\bcall/.test(lower) ||
    lower.includes('callback') ||
    /\bcontact\b/.test(lower) ||
    /\bphone\b/.test(lower) ||
    lower.includes('talk to team') ||
    lower.includes('speak to human') ||
    lower.includes('speak to someone') ||
    lower.includes('talk to someone') ||
    lower.includes('reach me') ||
    lower.includes('representative') ||
    lower.includes('consultant') ||
    lower.includes('vilikumo') ||
    lower.includes('vilikkumo') ||
    lower.includes('vilikkoo') ||
    lower.includes('വിളിക്കാമോ') ||
    lower.includes('വിളിക്കുമോ');

  const alreadyRegistered = Array.isArray(history) && history.some(h => h.sender === 'assistant' && /callback request confirmed|consultation request confirmed|already registered|details received/i.test(h.text || ''));
  if (isCallRequest && alreadyRegistered) {
    return {
      reply: "You're already registered ✓ Our sleep specialist will call you shortly. Meanwhile, I can compare models, check prices or confirm delivery for you.",
      quickOptions: ['Which is best for back pain?', 'Check Prices', 'View All 8 Models']
    };
  }

  if (isCallRequest) {
    if (lang === 'ml') {
      return {
        reply: "തീർച്ചയായും! ലോറയുടെ സീനിയർ സ്ലീപ്പ് സ്പെഷ്യലിസ്റ്റിന്റെ നേരിട്ടുള്ള ഫോൺ കൺസൾട്ടേഷൻ ലഭ്യമാക്കാം.\n\nനിങ്ങളെ തിരിച്ചുവിളിക്കാൻ നിങ്ങളുടെ **ഫോൺ നമ്പറും** **പിൻകോഡും** നൽകുമോ? ഞങ്ങളുടെ വിദഗ്ദ്ധൻ അനുയോജ്യമായ മോഡലും കൃത്യമായ വിലയും പറഞ്ഞുതരുന്നതാണ്.",
        quickOptions: ['ഫോൺ നൽകുക', 'നേരിട്ട് വിളിക്കുക (+91 90726 16423)'],
        suggestLead: true
      };
    }
    if (lang === 'manglish') {
      return {
        reply: "Sure! Lora-ude senior sleep specialist ningale direct vilichu correct mattress advise cheyyam.\n\nNingale reach cheyyan **Contact Number**-um **PIN code**-um share cheyyamo? Accurate price and details udan parayam.",
        quickOptions: ['Share Contact & PIN', 'Call +91 90726 16423'],
        suggestLead: true
      };
    }
    return {
      reply: "Certainly! Our senior sleep specialists would be happy to give you a personalized consultation call.\n\nPlease share your **contact number** and **pincode** below so we can reach out with accurate advice and delivery timelines for your location:",
      quickOptions: ['Share Contact & PIN', 'Call +91 90726 16423', 'Chat with Lumi'],
      suggestLead: true
    };
  }

  // =========================================================================
  // 2b. CONTEXT-AWARE REASONING (compare, specific model, feel groups, follow-ups)
  // =========================================================================
  const histArr = Array.isArray(history) ? history : [];
  const mentionedIds = findModelIds(lower);
  const recentIds = [];
  for (let i = histArr.length - 1; i >= 0 && recentIds.length < 3; i--) {
    const h = histArr[i];
    if (h && h.card && h.card.id && PRODUCTS_MAP[h.card.id] && !recentIds.includes(h.card.id)) recentIds.push(h.card.id);
  }
  const lastAssistant = [...histArr].reverse().find(h => h && h.sender === 'assistant');
  const lastAssistantIds = lastAssistant ? findModelIds(lastAssistant.text) : [];
  const pageId = ctx.productName ? (findModelIds(ctx.productName)[0] || null) : null;
  const refersToThis = /\b(this|this one|it|ithu|ithinte|current)\b/.test(lower);
  const focusId = mentionedIds[0] || recentIds[0] || (refersToThis ? pageId : null);
  const sizeWord = (lower.match(/\b(king|queen|single|double)\b/) || [])[1] || null;

  // Comparisons ("Compare A vs B", "Compare with Another", "Compare Both")
  if (/\b(compare|vs|versus|difference|differ)\b/.test(lower) || /\bboth\b/.test(lower)) {
    const ids = mentionedIds.slice(0, 2);
    if (ids.length < 2) {
      for (const id of [...lastAssistantIds, ...recentIds, pageId]) {
        if (ids.length >= 2) break;
        if (id && !ids.includes(id)) ids.push(id);
      }
    }
    if (ids.length >= 2) return compareReply(ids[0], ids[1]);
    if (ids.length === 1) {
      const others = Object.keys(PRODUCTS_MAP).filter(id => id !== ids[0]);
      const p = PRODUCTS_MAP[ids[0]];
      const firmer = others.filter(id => (FIRMNESS[PRODUCTS_MAP[id].feel] || 3) !== (FIRMNESS[p.feel] || 3)).slice(0, 2);
      const similar = others.filter(id => PRODUCTS_MAP[id].feel === p.feel).slice(0, 1);
      return {
        reply: `Which model would you like to compare **${p.name}** with?`,
        quickOptions: [...similar, ...firmer].slice(0, 3).map(id => `Compare ${shortName(ids[0])} vs ${shortName(id)}`)
      };
    }
  }

  // Feel groups
  if (/plush\s*(&|and|\/)?\s*soft|soft\s*(\/|&|and)\s*plush|^soft$|soft (feel|mattress)/.test(lower)) return feelGroupReply('soft');
  if (/medium[- ]firm|^firm\b|firm (feel|mattress|support)/.test(lower) && mentionedIds.length === 0) return feelGroupReply('firm');
  if (/balanced medium|^medium( feel)?$|medium (feel|mattress)/.test(lower) && mentionedIds.length === 0) return feelGroupReply('medium');

  // Warranty overview
  if (/\bwarrant(y|ies)|guarantee/.test(lower) && mentionedIds.length === 0 && !/\bclaim\b/.test(lower)) {
    const lines = Object.values(PRODUCTS_MAP).map(p => `• **${p.name}** — ${p.warranty}`).join('\n');
    return {
      reply: `Every LORA mattress carries a direct factory warranty:\n\n${lines}\n\nLonger warranties come with our hybrid and latex builds. Which one interests you?`,
      quickOptions: ['Hybrid Fusion (15y)', 'Ortho Latex (12y)', 'Ortho Hybrid (10y)', 'Check Prices']
    };
  }

  // Size follow-ups ("King Price", "Queen (78"×60")") -> price for the model being discussed
  if (sizeWord && !/\bcustom\b/.test(lower) && !isPricingQueryEarly(lower)) {
    if (focusId) return priceReply(focusId, sizeWord);
    if (/^\s*(king|queen|single|double)\b/.test(lower)) {
      const label = sizeWord.charAt(0).toUpperCase() + sizeWord.slice(1);
      const lines = Object.keys(PRODUCTS_MAP).map(id => `• **${shortName(id)}** (${PRODUCTS_MAP[id].feel}) — ${getDynamicPrice(id, sizeWord, '8')}`).join('\n');
      return {
        reply: `**${label} size** starting prices (8" thickness):\n\n${lines}\n\nTell me your preferred feel or sleep concern and I'll narrow it down.`,
        quickOptions: ['Which is best for back pain?', 'Zero motion for couples?', 'Plush & Soft', 'Custom Size Quote']
      };
    }
  }

  // A specific model is named -> answer about THAT model (even if words like ortho/cool/soft appear)
  if (mentionedIds.length === 1 && !isPricingQueryEarly(lower)) {
    return modelDetailsReply(mentionedIds[0], lower);
  }

  const isPricingQuery =
    lower.includes('price') ||
    lower.includes('cost') ||
    /\brates?\b/.test(lower) ||
    lower.includes('how much') ||
    lower.includes('discount') ||
    /\boffers?\b/.test(lower) ||
    /\bemi\b/.test(lower) ||
    lower.includes('bajaj') ||
    lower.includes('ethra') ||
    lower.includes('വില');

  const isBackPain =
    !isPricingQuery &&
    (lower.includes('backpain') ||
      lower.includes('back pain') ||
      lower.includes('back ache') ||
      lower.includes('backache') ||
      lower.includes('lower back') ||
      lower.includes('spine') ||
      lower.includes('spinal') ||
      /\bdiscs?\b/.test(lower) ||
      lower.includes('sciatica') ||
      lower.includes('neck pain') ||
      lower.includes('stiff') ||
      lower.includes('ortho') ||
      lower.includes('orthopedic') ||
      lower.includes('posture') ||
      lower.includes('doctor') ||
      lower.includes('വേദന') ||
      lower.includes('നടുവേദന') ||
      lower.includes('naduvedana'));

  if (isBackPain) {
    // Specific check if asking about Cloud Ortho firmness
    if (lower.includes('cloud ortho')) {
      return {
        reply: "Cloud Ortho is a generous 9-inch Eurotop mattress with a **Medium** feel and 5-year warranty. While named 'Ortho' for balanced posture support, it is not an overly stiff or extra-hard mattress. It provides balanced contouring without sinking.\n\nFor a firmer orthopedic feel, **LORA ORTHO HYBRID™** (10-Yr) is our primary recommendation.",
        card: PRODUCTS_MAP['02'],
        quickOptions: ['Cloud Ortho Price', 'Compare with Ortho Hybrid', 'Talk to Specialist']
      };
    }

    if (lang === 'ml') {
      return {
        reply: "നടുവേദനയ്ക്കും നട്ടെല്ലിന്റെ ആരോഗ്യത്തിനും ഞങ്ങൾ പ്രധാനമായും ശുപാർശ ചെയ്യുന്നത് **LORA ORTHO HYBRID™** (10 വർഷ വാറന്റി) അല്ലെങ്കിൽ **LORA ORTHO LATEX™** (12 വർഷ വാറന്റി) ആണ്.\n\nകാരണങ്ങൾ:\n1. **SpineAlign™ 7-സോൺ ബയോമെട്രിക്സ്**: നട്ടെല്ല് സ്വാഭാവികമായ സമാന്തര നിലയിൽ നിലനിർത്തുന്നു.\n2. **മീഡിയം-ഫേം സപ്പോർട്ട്**: അമിതമായി മൃദുവായ മെത്തകൾ നട്ടെല്ല് താഴേക്ക് താഴ്ത്തി വേദന വർദ്ധിപ്പിക്കും; അമിതമായി കട്ടിയുള്ളവ പ്രഷർ പോയിന്റുകൾ ഉണ്ടാക്കും. മീഡിയം-ഫേം ആണ് ഏറ്റവും അനുയോജ്യം.\n\nനിങ്ങൾക്ക് ഏത് സൈസ് മെത്തയാണ് (King, Queen, Single) ആവശ്യമുള്ളത്?",
        card: PRODUCTS_MAP['04'],
        quickOptions: ['Ortho Hybrid (10y)', 'Ortho Latex (12y)', 'സ്പെഷ്യലിസ്റ്റ് കോൾ', 'സൈസ് ഗൈഡ്']
      };
    }
    if (lang === 'manglish') {
      return {
        reply: "Back pain and spine support-inu LORA-il best matches:\n\n1. **LORA ORTHO HYBRID™** (Medium-Firm, 10-Yr Warranty) — SpineAlign™ 7-zone ergonomic support lumbar sagging thadayum.\n2. **LORA ORTHO LATEX™** (Medium-Firm, 12-Yr Warranty) — 100% natural Dunlop latex buoyant bounce and natural spine lift provide cheyyum.\n3. **LORA CLOUD ORTHO™** (9-inch Medium, 5-Yr) — Balanced medium cushioning with posture care.\n\nNingalkku ethu bed size (King, Queen, Single) aanu vendathu?",
        card: PRODUCTS_MAP['04'],
        quickOptions: ['Ortho Hybrid Details', 'Ortho Latex Details', 'Request Callback', 'Check Prices']
      };
    }
    return {
      reply: "For back pain and healthy spinal alignment, we strongly recommend **LORA ORTHO HYBRID™** (Medium-Firm, 10-Yr Warranty) or **LORA ORTHO LATEX™** (12-Yr Warranty).\n\nHere is why:\n1. **SpineAlign™ 7-Zone Ergonomics**: Directly supports cervical, thoracic, and lumbar vertebrae, preventing lower spine sagging while you sleep.\n2. **Medium-Firm Posture Support**: Medical orthopedists advise medium-firm because extra-hard mattresses cause pressure points, while soft mattresses let hips sink and strain the spine.\n3. If you prefer balanced cushioning without sinking, **LORA CLOUD ORTHO™** (9-inch Medium, 5-Yr) is also a fantastic balanced option.\n\nWhat bed size (King, Queen, Single) are you looking for, or would you like our sleep specialist to call you for personalized advice?",
      card: PRODUCTS_MAP['04'],
      quickOptions: ['Ortho Hybrid (10y)', 'Ortho Latex (12y)', 'Cloud Ortho (9")', 'Request Specialist Call']
    };
  }

  // =========================================================================
  // 4. RECOMMENDATION / "WHICH IS GOOD ?" / "WHICH IS BEST ?" / "HELP ME CHOOSE"
  // =========================================================================
  const isRecommendation =
    lower.includes('which is good') ||
    lower.includes('which is best') ||
    lower.includes('which one is good') ||
    lower.includes('which one is best') ||
    lower.includes('which mattress is best') ||
    lower.includes('which mattress is good') ||
    lower.includes('which to buy') ||
    lower.includes('which should i buy') ||
    lower.includes('what is good') ||
    lower.includes('what is best') ||
    lower.includes('what do you recommend') ||
    lower.includes('help me choose') ||
    lower.includes('confused') ||
    lower.includes('recommend') ||
    lower.includes('suggest') ||
    lower.includes('best mattress') ||
    lower.includes('ഏതാണ് നല്ലത്') ||
    lower.includes('ethanu nallathu') ||
    lower.includes('ethanu best');

  if (isRecommendation) {
    if (lang === 'ml') {
      return {
        reply: "ലോറയുടെ 8 മോഡലുകളിൽ നിന്നും നിങ്ങളുടെ സ്ലീപ്പിംഗ് ആവശ്യങ്ങൾക്ക് അനുസൃതമായ മികച്ച മെത്ത തിരഞ്ഞെടുക്കാൻ ഇതാ ഒരു ഗൈഡ്:\n\n• **നടുവേദനയ്ക്കും നട്ടെല്ല് സപ്പോർട്ടിനും**: **LORA ORTHO HYBRID™** (മീഡിയം-ഫേം, 10 വർഷ വാറന്റി) അല്ലെങ്കിൽ **LORA ORTHO LATEX™** (12 വർഷം).\n• **പങ്കാളിയുടെ ചലനങ്ങൾ അറിയാതിരിക്കാൻ (Couples)**: **LORA POCKET LUXE™** (പോക്കറ്റ് സ്പ്രിംഗ്, സീറോ മോഷൻ ട്രാൻസ്ഫർ, 10 വർഷം).\n• **മൃദുവായ ക്ലൗഡ് ഫീൽ (Plush / Soft)**: **LORA PLUSH™** (സോഫ്റ്റ് പില്ലോ ടോപ്പ്, 5 വർഷം) അല്ലെങ്കിൽ **CLOUD 7™** (മീഡിയം-സോഫ്റ്റ്, 7-ഇഞ്ച്).\n• **ഫ്ലാഗ്ഷിപ്പ് ലക്ഷ്വറി**: **LORA HYBRID FUSION™** (നാച്ചുറൽ ലാറ്റക്സ് + മെമ്മറി ഫോം, 15 വർഷ വാറന്റി).\n\nനിങ്ങൾക്ക് ഇതിൽ ഏത് തരത്തിലുള്ള കംഫർട്ടാണ് താല്പര്യം?",
        quickOptions: ['Ortho Hybrid (നടുവേദനയ്ക്ക്)', 'Pocket Luxe (Couples)', 'Plush (സോഫ്റ്റ്)', 'എല്ലാ മോഡലുകളും']
      };
    }
    if (lang === 'manglish') {
      return {
        reply: "Lora-ude 8 mattresses-il ningalkku best choice select cheyyan simple guide:\n\n• **Back Pain & Spine Support**: **LORA ORTHO HYBRID™** (Medium-Firm, 10-Yr) or **LORA ORTHO LATEX™** (12-Yr).\n• **Couples (Zero Partner Disturbance)**: **LORA POCKET LUXE™** (Medium Pocket Spring, 10-Yr).\n• **Plush Sink-In Softness**: **LORA PLUSH™** (Soft Pillow Top, 5-Yr) or **CLOUD 7™** (Medium-Soft, 7-inch, 3-Yr).\n• **Master Flagship Luxury**: **LORA HYBRID FUSION™** (Latex + Memory Foam, 15-Yr).\n\nNingalkku ethu comfort level aanu kooduthal ishtam?",
        quickOptions: ['Back Pain (Ortho)', 'Couples (Pocket Luxe)', 'Plush Soft', 'Compare All 8']
      };
    }
    return {
      reply: "To choose the best LORA mattress for your body and sleep preferences:\n\n• **For Back Pain & Spine Health**: **LORA ORTHO HYBRID™** (Medium-Firm, 10-Yr Warranty) or **LORA ORTHO LATEX™** (12-Yr Warranty). Engineered with 7-zone SpineAlign™ ergonomics.\n• **For Couples (Zero Motion Transfer)**: **LORA POCKET LUXE™** (Medium, 10-Yr Warranty). Independent pocket springs isolate partner movement completely.\n• **For Cloud-Like Plush Softness**: **LORA PLUSH™** (Soft Pillow Top, 5-Yr Warranty) or **CLOUD 7™** (Medium-Soft, 7-inch, 3-Yr). Ideal for side sleepers.\n• **The Ultimate Flagship**: **LORA HYBRID FUSION™** (Medium-Firm, 15-Yr Warranty). Combines Natural Dunlop Latex, Memory Foam & Orthopedic Core.\n\nWhich sleeping style or comfort feel matches what you're looking for?",
      quickOptions: ['Back Pain (Ortho)', 'Couples (Pocket Luxe)', 'Plush Soft', 'Compare All 8']
    };
  }

  // =========================================================================
  // 5. COUPLES / ZERO MOTION TRANSFER / PARTNER DISTURBANCE
  // =========================================================================
  const isCouples =
    lower.includes('couple') ||
    lower.includes('partner') ||
    lower.includes('motion') ||
    lower.includes('movement') ||
    lower.includes('shake') ||
    lower.includes('tossing') ||
    lower.includes('turning') ||
    lower.includes('disturb') ||
    lower.includes('wake up') ||
    lower.includes('അനക്കം');

  if (isCouples) {
    return {
      reply: "If you or your partner toss and turn, **LORA POCKET LUXE™** is engineered specifically for you. Each titanium pocket spring is individually encased, absorbing movement directly beneath the sleeper with zero ripple effect across the bed.\n\n• Feel: Balanced Medium\n• Construction: Independent Pocket Coils + Pillow Top\n• Warranty: 10 Years Factory Warranty\n\nWould you like pricing for King Size (78\"×72\") or Queen Size (78\"×60\")?",
      card: PRODUCTS_MAP['07'],
      quickOptions: ['King Price (Pocket Luxe)', 'Queen Price', 'Talk to Specialist']
    };
  }

  // =========================================================================
  // 6. SLEEP POSITIONS (Side, Back, Stomach)
  // =========================================================================
  if (lower.includes('side sleep') || lower.includes('side-sleep') || lower.includes('shoulder') || /\bhips?\b/.test(lower) || lower.includes('വശം ചരിഞ്ഞ്')) {
    return {
      reply: "For side sleepers, contouring pressure relief around your shoulders and hips is essential to avoid numbness and pinched nerves.\n\n• **Top Pick**: **LORA PLUSH™** (Pillow Top, Soft) — deep cushioning that cradles side contours.\n• **Balanced Pick**: **LORA CLOUD 7™** (Medium-Soft Eurotop, 7-inch) or **LORA POCKET LUXE™** (Medium pocket springs).\n\nDo you prefer a deeper plush sink-in feel, or a slightly more balanced medium contour?",
      card: PRODUCTS_MAP['03'],
      quickOptions: ['LORA PLUSH™ (Soft)', 'Cloud 7 (Medium-Soft)', 'Compare Both']
    };
  }

  if (lower.includes('stomach') || lower.includes('tummy') || lower.includes('prone') || lower.includes('കമിഴ്ന്ന്')) {
    return {
      reply: "For stomach sleeping, a medium-firm mattress is essential. Softer mattresses allow your pelvis to sink, hyperextending your lower spine and creating lower back stiffness.\n\n• **Recommended**: **LORA ORTHO HYBRID™** (Medium-Firm dynamic core)\n• **Eco Luxury**: **LORA ORTHO LATEX™** (Medium-Firm buoyant latex lift)\n• **Flagship**: **LORA HYBRID FUSION™** (15-Yr multi-layer)\n\nThese keep your spine level throughout the night.",
      card: PRODUCTS_MAP['04'],
      quickOptions: ['Ortho Hybrid Details', 'Ortho Latex Details', 'Check Prices']
    };
  }

  // =========================================================================
  // 7. COOLING / HOT SLEEPERS / BREATHABILITY
  // =========================================================================
  if (/\b(cool|cooler|coolest|cooling|hot|sweat\w*|warm|heat|breathable|temperature)\b/.test(lower) || lower.includes('ചൂട്')) {
    return {
      reply: "For hot sleepers, natural airflow and open-cell structure are critical:\n\n• **LORA ORTHO LATEX™**: Features 100% natural pin-core Dunlop latex. Its open-cell structure dissipates body heat continuously, sleeping naturally cool without synthetic cooling gels.\n• **LORA POCKET LUXE™**: Pocket coil interior allows massive air circulation through the mattress core.\n• **LORA HYBRID FUSION™**: Combines natural latex with breathable micro-knit surface fabrics.\n\nWould you like to explore Ortho Latex or Pocket Luxe?",
      card: PRODUCTS_MAP['05'],
      quickOptions: ['Ortho Latex (Latex Cool)', 'Pocket Luxe (Coil Airflow)', 'Compare Both']
    };
  }

  // =========================================================================
  // 8. 100% FULL-SIZE FLAT DELIVERY VS ROLLED IN A BOX
  // =========================================================================
  if (lower.includes('flat') || lower.includes('rolled') || lower.includes('box') || lower.includes('roll') || lower.includes('compress') || lower.includes('packing') || lower.includes('ചുരുട്ടി') || lower.includes('ഡെലിവറി')) {
    return {
      reply: "At LORA, **YOU SLEEP FLAT. WHY SHOULD YOUR COMFORT COME ROLLED?**\n\nMany brands crush mattresses under 50-ton hydraulic rollers into cardboard boxes. This damages titanium coil tempered memory, fractures high-density foam cells, and weakens edge rails.\n\n**LORA Delivers 100% Full-Size FLAT** direct from our factory in heavy-duty protective transit covers. It arrives uncompromised, structurally intact, and ready to sleep on immediately!\n\nDelivery is provided pan-India within 1 to 5 business days based on your PIN code.",
      quickOptions: ['Check My Pincode', 'View 8 Models', 'Talk to Specialist']
    };
  }

  // =========================================================================
  // 9. PRICING, DISCOUNTS, FACTORY DIRECT & EMI
  // =========================================================================
  if (isPricingQueryEarly(lower)) {
    // Check if user named a specific model
    // Named model, else the model we were just discussing ("King Price", "Check Price"), else "this" page model
    let targetModelId = mentionedIds[0] || null;
    if (!targetModelId && !/\bprices\b|all|every|range|list/.test(lower)) targetModelId = recentIds[0] || (refersToThis ? pageId : null) || null;

    if (targetModelId) {
      const p = PRODUCTS_MAP[targetModelId];
      let requestedSize = 'Queen';
      if (lower.includes('king')) requestedSize = 'King';
      else if (lower.includes('single')) requestedSize = 'Single';
      else if (lower.includes('double')) requestedSize = 'Double';

      const requestedPrice = getDynamicPrice(targetModelId, requestedSize.toLowerCase(), '8');
      const qPrice = getDynamicPrice(targetModelId, 'queen', '8');
      const kPrice = getDynamicPrice(targetModelId, 'king', '8');

      const sizeLine = requestedSize !== 'Queen'
        ? `• **${requestedSize} Size**: **${requestedPrice}** (Queen: ${qPrice}, King: ${kPrice})`
        : `• **Queen Size (78"×60")**: **${qPrice}**\n• **King Size (78"×72")**: **${kPrice}**`;

      return {
        reply: `Factory-direct pricing for **${p.name}** (${p.feel}, ${p.warranty} warranty):\n\n${sizeLine}\n\n✓ Save up to ₹14,949 Direct from Factory (Zero 40% retail markup)\n✓ 0% No-Cost EMI with Bajaj Finserv starting at ~₹1,249/mo\n✓ Complimentary 5-Piece Master Bedding Kit Included\n✓ 100% Full-Size Flat Doorstep Delivery\n\nWould you like to verify delivery timelines for your 6-digit PIN code?`,
        card: { ...p, price: requestedPrice },
        quickOptions: [`Order ${p.name.replace('LORA ', '')}`, 'Check Pincode', 'Request Specialist Call']
      };
    }

    return {
      reply: "LORA operates on a **100% Factory-Direct Model**—completely eliminating the 40% retail showroom markups! Prices start from **₹22,999** for Cloud 7 up to ₹34,999+ for flagship Hybrid Fusion.\n\nEvery order includes:\n✓ Direct Factory Savings (Save up to ₹14,949)\n✓ Complimentary 5-Piece Master Bedding Kit Included\n✓ Bajaj Finserv 0% No-Cost EMI starting from ~₹1,249/month\n✓ 100% Full-Size Flat Doorstep Delivery\n\nWhich mattress model or bed size (King, Queen, Single) would you like an exact price check for?",
      quickOptions: ['Cloud 7 (from ₹22,999)', 'Cloud Ortho (from ₹25,999)', 'Ortho Hybrid (from ₹27,999)', 'Hybrid Fusion (from ₹34,999)']
    };
  }

  // =========================================================================
  // 10. SIZING, DIMENSIONS & CUSTOM MEASUREMENTS
  // =========================================================================
  if (lower.includes('size') || lower.includes('dimension') || lower.includes('king') || lower.includes('queen') || lower.includes('single') || lower.includes('double') || lower.includes('length') || lower.includes('width') || lower.includes('feet') || lower.includes('inch') || /\bcustom\b/.test(lower)) {
    if (/\bcustom\b/.test(lower) || lower.includes('odd size') || lower.includes('special size')) {
      return {
        reply: "Yes! Because LORA is a 100% direct-from-factory manufacturer, we craft **Custom Bed Dimensions** to the exact inch for any wooden, metal, or antique cot!\n\nPlease share your **contact number** and **pincode** along with your required Length × Width in inches. Our production team will quote you the exact factory-direct price.",
        quickOptions: ['Share Contact & PIN', 'Standard Sizing Guide'],
        suggestLead: true
      };
    }
    return {
      reply: "LORA mattresses are crafted in all standard Indian bed dimensions (Available in 6\", 8\", 10\", and 12\" heights):\n\n• **King Size**: 78\" × 72\" (or 75\" × 72\") — Spacious luxury for couples & families.\n• **Queen Size**: 78\" × 60\" (or 75\" × 60\") — Standard master bedroom size.\n• **Double Size**: 78\" × 48\" (or 72\" × 48\") — Ideal for single adults with extra room.\n• **Single Size**: 78\" × 36\" (or 72\" × 36\") — Perfect for children or guest bedrooms.\n\nWe also craft custom sizes directly from the factory. Which model and size are you planning for?",
      quickOptions: ['King (78"×72")', 'Queen (78"×60")', 'Single (78"×36")', 'Custom Size Quote']
    };
  }

  // =========================================================================
  // 11. BEDDING KIT / COMPLIMENTARY GIFTS
  // =========================================================================
  if (lower.includes('bedding kit') || lower.includes('gift') || lower.includes('free pillow') || lower.includes('pillow') || lower.includes('protector')) {
    return {
      reply: "Every LORA mattress order comes with our **Complimentary 5-Piece Master Bedding Kit**:\n\n1. Premium Waterproof Breathable Mattress Protector\n2. Two Luxury Ergonomic Sleep Pillows\n3. Two Ultra-Soft Pillow Encasement Covers\n\nIt is included automatically at zero additional charge with your flat factory delivery!",
      quickOptions: ['Explore Mattresses', 'Check Prices', 'Check Pincode']
    };
  }

  // =========================================================================
  // 12. SHOWROOMS & STORES
  // =========================================================================
  if (lower.includes('showroom') || /\bstores?\b/.test(lower) || lower.includes('centre') || lower.includes('visit') || lower.includes('kochi') || lower.includes('bengaluru') || lower.includes('mumbai') || lower.includes('കട')) {
    return {
      reply: "LORA operates flagship **Experience Studios** in:\n• **Kochi, Kerala**: Experience Center & Direct Factory Dispatch\n• **Bengaluru, Karnataka**: Flagship Sleep Experience Zone\n• **Mumbai, Maharashtra**: Regional Display & Metro Logistics Hub\n\nWe also provide **100% Flat Doorstep Delivery across India**. Share your **PIN code** to find your nearest showroom or verify home delivery timelines!",
      quickOptions: ['Check My Pincode', 'Request Callback', 'Explore Models']
    };
  }

  // =========================================================================
  // 13. EXPLICIT PRODUCT DETAILS (User asks about a specific model)
  // =========================================================================
  for (const [alias, id] of Object.entries(MODEL_ALIASES)) {
    if (lower.includes(alias)) {
      const p = PRODUCTS_MAP[id];
      return {
        reply: `**${p.name}**\n• **Feel**: ${p.feel}\n• **Design**: ${p.type}\n• **Height Profile**: ${p.height}\n• **Factory Warranty**: ${p.warranty}\n• **Highlights**: ${p.description}\n\nFactory direct prices start from around **₹${p.basePrice.toLocaleString('en-IN')}** including the Complimentary 5-Piece Bedding Kit.\n\nWould you like an exact price for your bed size (King, Queen, Single)?`,
        card: p,
        quickOptions: [`Price for ${p.name.replace('LORA ', '')}`, 'Compare with Another', 'Request Specialist Call']
      };
    }
  }

  // =========================================================================
  // 14. ALL MODELS LIST / CATALOG OVERVIEW
  // =========================================================================
  if (lower.includes('all model') || lower.includes('all mattress') || lower.includes('all 8') || /\b(list|catalog|options|explore|models|mattresses)\b/.test(lower) || lower.includes('എല്ലാ')) {
    return {
      reply: "LORA crafts 8 handcrafted mattress models across 3 distinct comfort zones:\n\n• **Plush & Soft**: Lora Plush (Pillow Top, Soft) & Cloud 7 (Eurotop 7\", Medium-Soft)\n• **Balanced Medium**: Cloud Ortho (Eurotop 9\"), Comfort Core (Pillow Top, 10-Yr), & Pocket Luxe (Pocket Spring, Zero Disturbance)\n• **Medium-Firm & Orthopedic**: Ortho Hybrid (10-Yr), Ortho Latex (Breathable Dunlop Latex, 12-Yr), & Hybrid Fusion (Flagship Latex+Memory Foam, 15-Yr)\n\nWhich comfort zone matches your sleep preference?",
      quickOptions: ['Plush & Soft', 'Balanced Medium', 'Medium-Firm Ortho', 'Request Specialist Call']
    };
  }

  // =========================================================================
  // 15. UNKNOWN / SPECIALIZED / OUT-OF-SCOPE QUESTIONS
  // ("if anything ask which dont know ask thier contact and pincode , and move in to lead section")
  // =========================================================================
  const isSpecializedUnknown =
    /\b(round|triangle|boat|rv|caravan|bulk|hotel|resort|hospital|wholesale|export|carpenter|headboard|cod|international|dubai|uae)\b/.test(lower) ||
    lower.includes('cash on delivery') ||
    lower.includes('scoliosis surgery');

  if (isSpecializedUnknown) {
    if (lang === 'ml') {
      return {
        reply: "കസ്റ്റം ആകൃതിയിലുള്ള മെത്തകൾ (Custom shapes), ഹോട്ടൽ/റിസോർട്ട് ബൾക്ക് ഓർഡറുകൾ, അല്ലെങ്കിൽ പ്രത്യേക ആവശ്യങ്ങൾ എന്നിവ ഞങ്ങളുടെ ഫാക്ടറി മാസ്റ്റർ ക്രാഫ്റ്റ്‌സ്മാൻമാരും സ്ലീപ്പ് സ്പെഷ്യലിസ്റ്റുകളും നേരിട്ടാണ് പരിശോധിക്കുന്നത്.\n\nഇതിന്റെ കൃത്യമായ വിവരങ്ങളും ഫാക്ടറി വിലയും നേരിട്ട് അറിയിക്കാൻ നിങ്ങളുടെ **ഫോൺ നമ്പറും** **പിൻകോഡും** പങ്കുവെക്കാമോ?",
        quickOptions: ['ഫോൺ നമ്പറും പിൻകോഡും നൽകുക', 'ഹെൽപ്പ്‌ലൈൻ (+91 90726 16423)'],
        suggestLead: true
      };
    }
    if (lang === 'manglish') {
      return {
        reply: "Custom dimensions, specialized bulk/resort orders, or unique specifications Lora production team direct aayittanu review cheyyunnathu.\n\nExact feasibility and factory quote parayan ningalude **Contact Number**-um **PIN code**-um share cheyyamo? Specialist direct vilichu details tharum.",
        quickOptions: ['Share Contact & PIN', 'Call +91 90726 16423'],
        suggestLead: true
      };
    }
    return {
      reply: "For custom dimensions, specialized bulk hotel/resort orders, or technical inquiries outside our standard catalog, our master production team and senior consultants review each requirement personally.\n\nPlease share your **contact number** and **pincode** below so our sleep specialist can check feasibility and call you directly with verified answers and quotations:",
      quickOptions: ['Share Contact & PIN', 'Call +91 90726 16423'],
      suggestLead: true
    };
  }

  // =========================================================================
  // 16. DYNAMIC NATURAL FALLBACK (Never repeats the exact same message!)
  // =========================================================================
  const fallbacks = [
    {
      reply: "I’m right here to help you navigate LORA's 8 handcrafted mattresses! To guide you accurately, could you share if you prefer a softer plush feel, balanced medium contouring, or firm orthopedic back support?",
      quickOptions: ['Back Pain / Ortho Support', 'Couples / Zero Motion', 'Plush & Soft', 'Request Specialist Call']
    },
    {
      reply: "Whether you need targeted relief for back pain, zero motion transfer for couples, or cooler latex sleep, I can find your ideal LORA match. Would you like a personal recommendation, or would you like our sleep specialist to call you directly?",
      quickOptions: ['Help Me Choose', 'Request Specialist Call', 'View All 8 Models', 'Check Pincode Delivery']
    },
    {
      reply: "I want to make sure you get the most accurate advice for your sleep comfort and bed dimensions. What bed size (King, Queen, Single) are you shopping for, or would you like to speak directly with our senior sleep team?",
      quickOptions: ['King Size (78"×72")', 'Queen Size (78"×60")', 'Request Specialist Call', 'Compare Warranties']
    }
  ];

  // Pick variation based on history length so it NEVER repeats consecutively
  const histLen = Array.isArray(history) ? history.length : 0;
  const picked = fallbacks[histLen % fallbacks.length];

  if (lang === 'ml') {
    return {
      reply: "ലോറയുടെ 8 മെത്തകളിൽ നിന്നും ഏറ്റവും അനുയോജ്യമായത് കണ്ടെത്താൻ സഹായിക്കാം! നിങ്ങൾക്ക് മൃദുവായ കുഷ്യനിംഗാണോ (Soft), ബാലൻസ്ഡ് മീഡിയം ഫീലാണോ, അതോ ഉറപ്പുള്ള ഓർത്തോ സപ്പോർട്ടാണോ (Medium-Firm) കൂടുതൽ സൗകര്യപ്രദം?",
      quickOptions: ['നടുവേദനയ്ക്ക് (Ortho)', 'സോഫ്റ്റ് / പ്ലഷ്', 'കൺസൾട്ടേഷൻ കോൾ', 'എല്ലാ മോഡലുകളും']
    };
  }
  if (lang === 'manglish') {
    return {
      reply: "Lora-ude 8 mattresses-il ningalkku perfect aayath select cheyyan help cheyyam! Ningalkku plush soft sink-in aano, balanced medium aano, atho back support-inu vendi medium-firm aano thalparyam?",
      quickOptions: ['Back Pain Support', 'Couples (Pocket Luxe)', 'Request Specialist Call', 'Compare 8 Models']
    };
  }

  return picked;
}

module.exports = {
  processConversationalQuery,
  extractContactInfo,
  saveLeadToStore,
  detectLang,
  PRODUCTS_MAP,
  MODEL_ALIASES
};
