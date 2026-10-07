// Vercel Serverless Function: /api/lumi-chat
// LUMI AI SLEEP ASSISTANT — VERSION 2.5 (HUMAN-LIKE CONVERSATIONAL ENGINE)
const fs = require('fs');
const path = require('path');
const { processConversationalQuery } = require('./lumi-conversational-engine.js');

// Knowledge base and catalog loaders
function getKnowledgeBase() {
  try {
    const kbPath = path.join(__dirname, '..', 'config', 'lumi_kb.json');
    if (fs.existsSync(kbPath)) {
      return JSON.parse(fs.readFileSync(kbPath, 'utf8'));
    }
  } catch (e) {
    console.error('[LUMI API] Error reading KB:', e);
  }
  return null;
}

function getCatalog() {
  try {
    const catPath = path.join(__dirname, '..', 'config', 'catalog_data.json');
    if (fs.existsSync(catPath)) {
      return JSON.parse(fs.readFileSync(catPath, 'utf8'));
    }
  } catch (e) {
    console.error('[LUMI API] Error reading catalog:', e);
  }
  return null;
}

// Model lookup and alias mapping
const MODEL_ALIASES = {
  'eurotop 7': '01',
  'eurotop 7 inch': '01',
  'cloud 7': '01',
  'cloud7': '01',
  'eurotop 9': '02',
  'eurotop 9 inch': '02',
  'cloud ortho': '02',
  'cloudortho': '02',
  'excel pillow top': '03',
  'lora plush': '03',
  'plush': '03',
  'ortho hybrid': '04',
  'orthohybrid': '04',
  'ortho ema latex': '05',
  'ortho latex': '05',
  'ortholatex': '05',
  'classic pillow top': '06',
  'comfort core': '06',
  'comfortcore': '06',
  'platinum pillow top': '07',
  'pocket luxe': '07',
  'pocketluxe': '07',
  'hybrid elite fusion': '08',
  'hybrid fusion': '08',
  'hybridfusion': '08'
};

const PRODUCTS_MAP = {
  '01': { id: '01', name: 'LORA CLOUD 7™', feel: 'Medium-Soft', height: '7 inches', warranty: '3 years', type: 'Eurotop comfort' },
  '02': { id: '02', name: 'LORA CLOUD ORTHO™', feel: 'Medium', height: '9 inches', warranty: '5 years', type: 'Eurotop comfort' },
  '03': { id: '03', name: 'LORA PLUSH™', feel: 'Plush / Soft', height: 'Unconfirmed', warranty: '5 years', type: 'Pillow top' },
  '04': { id: '04', name: 'LORA ORTHO HYBRID™', feel: 'Medium-Firm', height: 'Unconfirmed', warranty: '10 years', type: 'Hybrid ortho-support' },
  '05': { id: '05', name: 'LORA ORTHO LATEX™', feel: 'Medium-Firm', height: 'Unconfirmed', warranty: '12 years', type: 'Latex comfort with ortho positioning' },
  '06': { id: '06', name: 'LORA COMFORT CORE™', feel: 'Medium', height: 'Unconfirmed', warranty: '10 years', type: 'Pillow top balanced comfort' },
  '07': { id: '07', name: 'LORA POCKET LUXE™', feel: 'Medium', height: 'Unconfirmed', warranty: '10 years', type: 'Pocket support technology with pillow top' },
  '08': { id: '08', name: 'LORA HYBRID FUSION™', feel: 'Medium-Firm', height: 'Unconfirmed', warranty: '15 years', type: 'Hybrid multi-layer support (Latex, Memory Foam, Ortho Foam)' }
};

// Calculate price dynamically from catalog
function calculateVariantPrice(catalog, modelId, sizeKey, thicknessStr) {
  if (!catalog || !catalog[modelId]) return null;
  const prod = catalog[modelId];
  const base = prod.basePrice || 22999;
  
  let mult = 1.0;
  const sk = (sizeKey || 'queen').toLowerCase();
  if (sk.includes('king')) mult = prod.multipliers?.king || 1.18;
  else if (sk.includes('queen')) mult = prod.multipliers?.queen || 1.0;
  else if (sk.includes('single')) mult = prod.multipliers?.single || 0.68;
  else if (sk.includes('double')) mult = prod.multipliers?.double || 0.82;

  let offset = 0;
  const thickNum = parseInt(thicknessStr, 10) || 8;
  if (prod.thicknessOffsets && prod.thicknessOffsets[thickNum.toString()] !== undefined) {
    offset = prod.thicknessOffsets[thickNum.toString()];
  }

  const finalPrice = Math.round(base * mult + offset);
  return finalPrice;
}

// Deliverability resolver based on Indian PIN code
function checkPincodeDelivery(pincode) {
  if (!pincode || !/^\d{6}$/.test(pincode.trim())) {
    return null;
  }
  const pin = pincode.trim();
  const firstDigit = pin[0];
  const firstTwo = pin.substring(0, 2);

  let hub = 'Pan-India Delivery Network';
  let days = '3 to 5 business days';

  if (firstTwo === '56') { hub = 'Bengaluru Hub'; days = '1 to 2 business days'; }
  else if (firstTwo >= '67' && firstTwo <= '69') { hub = 'Kerala & Kochi Hub'; days = '2 to 3 business days'; }
  else if (firstTwo === '40' || firstTwo === '41') { hub = 'Mumbai & Pune Hub'; days = '2 to 3 business days'; }
  else if (firstTwo === '11' || firstTwo === '12' || firstTwo === '20') { hub = 'Delhi NCR Hub'; days = '2 to 4 business days'; }
  else if (firstTwo === '60') { hub = 'Chennai Hub'; days = '2 to 3 business days'; }
  else if (firstTwo === '50') { hub = 'Hyderabad Hub'; days = '2 to 3 business days'; }
  else if (['1', '2', '3', '4', '5', '6', '7', '8'].includes(firstDigit)) { days = '3 to 6 business days'; }

  return {
    serviceable: true,
    hub,
    days,
    pincode: pin
  };
}

// Language detection: English, Malayalam, or Manglish
function detectLanguage(text) {
  if (!text) return 'en';
  if (/[\u0D00-\u0D7F]/.test(text)) return 'ml';
  
  // Specific Manglish terms
  const manglishTerms = [
    'nalla', 'aanu', 'ethra', 'engane', 'cheyyam', 'undu', 'illa', 'namaskaram',
    'vilikumo', 'pettannu', 'veetil', 'para', 'parayamo', 'entha',
    'enthokke', 'manasilayi', 'aano', 'shari', 'nokkam', 'venam', 'ariyamo',
    'oru', 'kurachu', 'rate', 'ennu', 'kollamo', 'athinte', 'ithinte', 'alle',
    'parayu', 'choykkam', 'tharumo', 'kidakkunna', 'enthanu', 'nokkiyalo', 'aayittulla'
  ];
  const lower = text.toLowerCase();
  for (const term of manglishTerms) {
    if (new RegExp('\\b' + term + '\\b', 'i').test(lower)) {
      return 'manglish';
    }
  }
  return 'en';
}

// Resolve product reference ONLY from text or if user explicitly asks about "this" mattress
function resolveModelFromText(text, context) {
  const lower = (text || '').toLowerCase();

  // Explicit alias lookups in user text
  for (const [alias, id] of Object.entries(MODEL_ALIASES)) {
    if (lower.includes(alias)) return id;
  }

  // Exact names in user text
  if (lower.includes('cloud 7') || lower.includes('cloud-7')) return '01';
  if (lower.includes('cloud ortho') || lower.includes('cloud-ortho')) return '02';
  if (lower.includes('plush')) return '03';
  if (lower.includes('ortho hybrid')) return '04';
  if (lower.includes('ortho latex')) return '05';
  if (lower.includes('comfort core')) return '06';
  if (lower.includes('pocket luxe')) return '07';
  if (lower.includes('hybrid fusion')) return '08';

  // Check page context ONLY if user explicitly refers to "this", "this one", "the mattress I'm viewing"
  if (context && context.productName && (lower.includes('this') || lower.includes('ithu') || lower.includes('ithinte') || lower.includes('viewing') || lower.includes('current'))) {
    const cp = context.productName.toLowerCase();
    for (const [alias, id] of Object.entries(MODEL_ALIASES)) {
      if (cp.includes(alias)) return id;
    }
  }

  return null;
}

// Conversation Reasoning Engine
function generateLocalResponse(message, context, history, kb, catalog) {
  const lang = detectLanguage(message);
  const lower = (message || '').toLowerCase().trim();
  const hist = Array.isArray(history) ? history : [];

  // Extract recent user preferences from history & current message
  const memory = {
    budget: null,
    size: null,
    dimensions: null,
    feel: null,
    pincode: null,
    lastCandidates: []
  };

  // Inspect history
  hist.forEach(h => {
    const txt = (h.text || '').toLowerCase();
    if (h.sender === 'user') {
      const bMatch = txt.match(/(\d+)\s*k\b/i) || txt.match(/₹?\s*(\d{4,6})/);
      if (bMatch) memory.budget = bMatch[1] + (txt.includes('k') ? 'k' : '');
      if (txt.includes('queen')) memory.size = 'Queen';
      if (txt.includes('king')) memory.size = 'King';
      if (txt.includes('single')) memory.size = 'Single';
      if (txt.includes('double')) memory.size = 'Double';
      const dimMatch = txt.match(/\b(\d{2})\s*[x×by*]\s*(\d{2})\b/i);
      if (dimMatch) memory.dimensions = `${dimMatch[1]}×${dimMatch[2]}`;
      if (txt.includes('medium-firm') || txt.includes('medium firm')) memory.feel = 'Medium-Firm';
      else if (txt.includes('medium-soft') || txt.includes('medium soft')) memory.feel = 'Medium-Soft';
      else if (txt.includes('medium')) memory.feel = 'Medium';
      else if (txt.includes('soft') || txt.includes('plush')) memory.feel = 'Soft';
    }
  });

  // Check active message for dimensions, budget, pincode
  const pinMatch = lower.match(/\b([1-9][0-9]{5})\b/);
  if (pinMatch) memory.pincode = pinMatch[1];
  const bMatch = lower.match(/(\d+)\s*k\b/i) || lower.match(/₹?\s*(\d{4,6})/);
  if (bMatch) memory.budget = bMatch[1] + (lower.includes('k') ? 'k' : '');
  if (lower.includes('queen')) memory.size = 'Queen';
  if (lower.includes('king')) memory.size = 'King';
  if (lower.includes('single')) memory.size = 'Single';
  if (lower.includes('double')) memory.size = 'Double';
  const curDimMatch = lower.match(/\b(\d{2})\s*[x×by*]\s*(\d{2})\b/i);
  if (curDimMatch) memory.dimensions = `${curDimMatch[1]}×${curDimMatch[2]}`;
  if (lower.includes('medium-firm') || lower.includes('medium firm')) memory.feel = 'Medium-Firm';
  else if (lower.includes('medium-soft') || lower.includes('medium soft')) memory.feel = 'Medium-Soft';
  else if (lower.includes('medium')) memory.feel = 'Medium';
  else if (lower.includes('soft') || lower.includes('plush')) memory.feel = 'Soft';

  // 1. GREETINGS & SHORT COURTESIES
  if (lower === 'hi' || lower === 'hello' || lower === 'hey' || lower === 'halo' || lower === 'namaskaram' || lower === 'നമസ്കാരം') {
    if (lang === 'ml') {
      return {
        reply: "നമസ്കാരം! ഞാൻ ലൂമി, ലോറയുടെ AI സ്ലീപ്പ് അസിസ്റ്റന്റ്. മെത്തകളുടെ കംഫർട്ട്, അളവുകൾ, അല്ലെങ്കിൽ അനുയോജ്യമായ മോഡൽ തിരഞ്ഞെടുക്കാൻ സഹായിക്കട്ടെ?",
        quickOptions: ['അനുയോജ്യമായത് കണ്ടെത്തുക', 'സൈസ് ഗൈഡ്', 'മോഡലുകൾ താരതമ്യം ചെയ്യുക']
      };
    }
    if (lang === 'manglish') {
      return {
        reply: "Namaskaram! Njan Lumi, Lora's AI sleep assistant. Mattress comfort, sizes, or correct model select cheyyan help venamo?",
        quickOptions: ['Help me choose', 'Find my size', 'Compare mattresses']
      };
    }
    return {
      reply: "Hello! I’m Lumi, Lora’s AI sleep assistant. How can I help you today with your mattress choices or sizing?",
      quickOptions: ['Help me choose', 'Find my size', 'Compare models', 'Check Pincode']
    };
  }

  if (lower === 'thanks' || lower === 'thank you' || lower === 'nandi' || lower === 'നന്ദി' || lower === 'shari thanks') {
    if (lang === 'ml') return { reply: "സന്തോഷം! കൂടുതൽ സംശയങ്ങളുണ്ടെങ്കിൽ എപ്പോഴും ചോദിക്കാം.", quickOptions: [] };
    if (lang === 'manglish') return { reply: "You're welcome! Mattenthenkilum doubt undenkil parayoo.", quickOptions: [] };
    return { reply: "You're welcome! Feel free to ask if anything else comes up.", quickOptions: [] };
  }

  // 2. HUMAN IDENTITY CHECK
  if (lower.includes('real person') || lower.includes('human') || lower.includes('robot') || lower.includes('ai aano') || lower.includes('manushyan aano') || lower.includes('ആളാണോ')) {
    if (lang === 'ml') {
      return {
        reply: "ഞാൻ ലൂമി, ലോറയുടെ AI സ്ലീപ്പ് അസിസ്റ്റന്റാണ്. മെത്തകളുടെ വിവരങ്ങൾ നൽകാനും ആവശ്യമെങ്കിൽ ലോറ ടീമുമായി നിങ്ങളെ ബന്ധിപ്പിക്കാനും എന്നെ ചുമതലപ്പെടുത്തിയിരിക്കുന്നു.",
        quickOptions: ['Help me choose', 'Team callback']
      };
    }
    if (lang === 'manglish') {
      return {
        reply: "Njan Lumi, Lora-ude AI sleep assistant aanu. Mattress details parayanum, avashyamenkil Lora team-umayi connect cheyyaanum njan help cheyyam.",
        quickOptions: ['Help me choose', 'Team callback']
      };
    }
    return {
      reply: "I’m Lumi, Lora’s AI assistant. I can help with mattress details and connect you with the Lora team when needed.",
      quickOptions: ['Help me choose', 'Talk to Team', 'Compare mattresses']
    };
  }

  // 3. COMPLAINTS & ORDER SUPPORT
  if (lower.includes('paid and got nothing') || lower.includes('payment failed') || lower.includes('useless') || lower.includes('scam') || lower.includes('order status') || lower.includes('money debited') || lower.includes('പണം പോയി')) {
    if (lang === 'ml') {
      return {
        reply: "തീർച്ചയായും ഇതൊരു വിഷമകരമായ സാഹചര്യമാണ്. ഓർഡർ അല്ലെങ്കിൽ പേയ്മെന്റ് സ്റ്റാറ്റസ് ഉടൻ പരിശോധിക്കാം. നിങ്ങളുടെ ഓർഡർ റഫറൻസ് നമ്പർ പങ്കുവെക്കാമോ? കാർഡ് നമ്പറുകളോ ഒ.ടി.പിയോ ഒരിക്കലും പങ്കുവെക്കരുത്.",
        quickOptions: ['ഓർഡർ നമ്പർ നൽകുക', 'ടീമുമായി നേരിട്ട് സംസാരിക്കുക']
      };
    }
    if (lang === 'manglish') {
      return {
        reply: "I'm really sorry—ithu frustrating aanu. Payment and order status udan check cheyyam. Order reference number undo? Card details or OTP ivide share cheyyaruthu.",
        quickOptions: ['Enter Order ID', 'Call +91 95676 84770']
      };
    }
    return {
      reply: "I'm sorry—that's frustrating. Let's have the payment and order status checked right away. Do you have an order reference number? Please do not share card details, OTP, or UPI PIN in chat.",
      quickOptions: ['Enter Order ID', 'Support Contact (+91 95676 84770)']
    };
  }

  // 4. BROWSING / JUST LOOKING / RESPECTFUL BOUNDARIES
  if (lower === 'just browsing' || lower === 'just looking' || lower.includes('veruthe nokkuva') || lower.includes('chummaa')) {
    if (lang === 'ml') return { reply: "തീർച്ചയായും—സാവധാനം നോക്കൂ. എന്തെങ്കിലും സംശയങ്ങളുണ്ടെങ്കിൽ ഞാൻ ഇവിടെയുണ്ട്.", quickOptions: [] };
    if (lang === 'manglish') return { reply: "Sure, take your time! Enthanelum doubts undenkil eppol venamenkilum chodikkam.", quickOptions: [] };
    return { reply: "Of course—ask me anything as you explore.", quickOptions: [] };
  }

  if (lower.includes("don't call") || lower.includes("dont call") || lower.includes("no call") || lower.includes("message only") || lower.includes("vilikkanda")) {
    return {
      reply: lang === 'manglish' ? "Manasilayi! Calls undavilla, messaging vazhi maathram communicate cheyyam." :
             lang === 'ml' ? "തീർച്ചയായും, കോളുകൾ ഉണ്ടാകില്ല. ചാറ്റ് അല്ലെങ്കിൽ മെസ്സേജ് വഴി മാത്രം വിവരങ്ങൾ നൽകാം." :
             "Understood. I will not prompt for phone calls. Feel free to continue chatting here.",
      quickOptions: ['Explore Models', 'Pricing Guide']
    };
  }

  // 5. COMPOUND QUESTIONS (Section 14 & 19.I)
  // "Pocket Luxe soft aano, warranty ethra, EMI undo?"
  if (lower.includes('pocket luxe') && (lower.includes('soft') || lower.includes('feel')) && (lower.includes('warranty') || lower.includes('വാറന്റി')) && (lower.includes('emi') || lower.includes('ഇഎംഐ'))) {
    if (lang === 'manglish') {
      return {
        reply: "Pocket Luxe medium feel aanu, plush/soft category alla. Warranty 10 years aanu. Bajaj Finserv EMI options undu; applicable offerum eligibilityum purchase time-il confirm cheyyanam.",
        quickOptions: ['Check Pocket Luxe Price', 'Size Guide']
      };
    }
    if (lang === 'ml') {
      return {
        reply: "പോക്കറ്റ് ലക്സ് മീഡിയം ഫീൽ ആണ്, പ്ലഷ്/സോഫ്റ്റ് വിഭാഗത്തിൽ വരുന്നതല്ല. വാറന്റി 10 വർഷമാണ്. ബജാജ് ഫിൻസെർവ് ഇഎംഐ ലഭ്യമാണ്; അർഹതയും പ്ലാനുകളും ചെക്ക്ഔട്ട് സമയത്ത് ഉറപ്പുവരുത്താം.",
        quickOptions: ['പോക്കറ്റ് ലക്സ് വില', 'സൈസ് ഗൈഡ്']
      };
    }
    return {
      reply: "Pocket Luxe has a medium feel, not plush/soft. Its stated warranty is 10 years. Bajaj Finserv EMI options are available, with eligibility and terms confirmed at checkout.",
      quickOptions: ['Pocket Luxe Pricing', 'Find My Size']
    };
  }

  // "Price, warranty, EMI?"
  if ((lower.includes('price') || lower.includes('rate') || lower.includes('ethra')) && lower.includes('warranty') && lower.includes('emi')) {
    const targetId = resolveModelFromText(lower, context) || '01';
    const prod = PRODUCTS_MAP[targetId];
    return {
      reply: `For ${prod.name}, warranty is ${prod.warranty}. Bajaj Finserv EMI options are available. What bed length × width do you need so I can check the exact verified price?`,
      quickOptions: ['King (78"×72")', 'Queen (78"×60")', 'Single (78"×36")']
    };
  }

  // 6. ALL MODELS WARRANTY CHECK (Section 7, 12, 22)
  if ((lower.includes('15') || lower.includes('warranty')) && (lower.includes('every') || lower.includes('all') || lower.includes('ella') || lower.includes('എല്ലാ') || lower.includes('alle'))) {
    if (lower.includes('15') || lower.includes('all') || lower.includes('every') || lower.includes('replacement')) {
      if (lang === 'manglish') {
        return {
          reply: "Ella modelinum 15 years alla. Cloud 7-inu 3 years; Cloud Ortho & Plush-inu 5; Ortho Hybrid, Comfort Core & Pocket Luxe-inu 10; Ortho Latex-inu 12; Hybrid Fusion-inu aanu 15-year warranty. Full replacement conditions policy nokki confirm cheyyanam.",
          quickOptions: ['Hybrid Fusion Details', 'Cloud 7 Details', 'Check Prices']
        };
      }
      return {
        reply: "No, it depends on the model. Cloud 7 has 3 years; Cloud Ortho and Plush have 5; Ortho Hybrid, Comfort Core, and Pocket Luxe have 10; Ortho Latex has 12; Hybrid Fusion has 15. Coverage follows the applicable warranty policy.",
        quickOptions: ['Hybrid Fusion (15y)', 'Ortho Latex (12y)', 'Check Prices']
      };
    }
  }

  // 7. SPECIFIC ACCEPTANCE CHECKS & PRODUCT QUESTIONS

  // A. Cloud 7 thickness, warranty & memory foam check
  if (lower.includes('cloud 7') || lower.includes('eurotop 7')) {
    if (lower.includes('memory foam') || lower.includes('foam')) {
      if (lang === 'manglish') {
        return {
          reply: "Cloud 7-inte Eurotop comfortum medium-soft feelum confirm aanu. Memory foam undo ennath exact layer details nokki confirm cheyyanam.",
          quickOptions: ['Cloud 7 Thickness (7")', 'Cloud 7 Warranty (3y)']
        };
      }
      return {
        reply: "Cloud 7 has confirmed Eurotop comfort and a medium-soft feel. Whether memory foam is inside requires confirmation of the exact internal layers.",
        quickOptions: ['Cloud 7 Thickness (7")', 'Cloud 7 Warranty (3y)']
      };
    }
    const isWarr = lower.includes('warranty') || lower.includes('വാറന്റി');
    const isThick = lower.includes('thick') || lower.includes('height') || lower.includes('inch') || lower.includes('ethra');
    if (isWarr && isThick) {
      return {
        reply: "Cloud 7 has a stated 7-inch profile, a medium-soft Eurotop comfort feel, and a 3-year warranty.",
        card: PRODUCTS_MAP['01'],
        quickOptions: ['Cloud 7 Price', 'Compare with Cloud Ortho']
      };
    }
    if (isThick) {
      return {
        reply: "Cloud 7 has a stated height of 7 inches with a medium-soft Eurotop feel.",
        card: PRODUCTS_MAP['01'],
        quickOptions: ['Cloud 7 warranty?', 'Compare with Cloud Ortho']
      };
    }
    if (isWarr) {
      return {
        reply: "Cloud 7 has a 3-year warranty. Coverage and claim terms follow its warranty policy.",
        card: PRODUCTS_MAP['01'],
        quickOptions: ['Cloud 7 thickness?', 'Check Price']
      };
    }
  }

  // B. Cloud Ortho firmness
  if ((lower.includes('cloud ortho') || lower.includes('eurotop 9')) && (lower.includes('hard') || lower.includes('firm') || lower.includes('feel') || lower.includes('soft') || lower.includes('കട്ടിയുള്ളതാണോ'))) {
    return {
      reply: "Cloud Ortho is listed with a Medium feel and Eurotop cushioning. The 'Ortho' name does not mean it is an extra-hard mattress.",
      card: PRODUCTS_MAP['02'],
      quickOptions: ['Cloud Ortho Profile (9")', 'Compare with Cloud 7']
    };
  }

  // C. Comfort Core reversibility
  if (lower.includes('comfort core') && (lower.includes('reversible') || lower.includes('flip') || lower.includes('dual sided') || lower.includes('തിരിച്ചു'))) {
    return {
      reply: "Reversibility is not confirmed for Comfort Core in the approved reference. Please follow the model's official care instructions.",
      card: PRODUCTS_MAP['06'],
      quickOptions: ['Comfort Core Feel', 'Comfort Core Warranty (10y)']
    };
  }

  // D. Pocket Luxe motion transfer
  if (lower.includes('pocket luxe') && (lower.includes('zero') || lower.includes('completely') || lower.includes('partner') || lower.includes('disturbance') || lower.includes('movement'))) {
    return {
      reply: "Pocket Luxe is designed for independent pocket support and reduced motion transfer to minimize partner disturbance. It is built to reduce transfer, but does not guarantee complete elimination of all movement.",
      card: PRODUCTS_MAP['07'],
      quickOptions: ['Pocket Luxe Feel (Medium)', 'Pocket Luxe Warranty (10y)']
    };
  }

  // E. Hybrid Fusion materials & spring count
  if (lower.includes('hybrid fusion') && (lower.includes('spring') || lower.includes('pocket') || lower.includes('coil') || lower.includes('layer') || lower.includes('material') || lower.includes('inside'))) {
    if (lower.includes('spring') || lower.includes('coil')) {
      return {
        reply: "Hybrid Fusion names Natural Latex Foam, Memory Foam, and Orthopedic Foam. Whether springs are present or what the spring count might be is not specified in the approved baseline.",
        card: PRODUCTS_MAP['08'],
        quickOptions: ['Hybrid Fusion Warranty (15y)', 'Compare with Ortho Latex']
      };
    }
    return {
      reply: "Hybrid Fusion combines Natural Latex Foam, Memory Foam, and Orthopedic Foam with a medium-firm feel and 15-year warranty. The exact layer order, thicknesses, and proportions need confirmation.",
      card: PRODUCTS_MAP['08'],
      quickOptions: ['Hybrid Fusion Warranty (15y)', 'Check Price']
    };
  }

  // F. Ortho Latex organic claim
  if (lower.includes('ortho latex') && (lower.includes('organic') || lower.includes('100%') || lower.includes('natural'))) {
    return {
      reply: "Ortho Latex offers responsive latex comfort with a medium-firm feel, but 100% organic composition and certification are not specified in the information I have.",
      card: PRODUCTS_MAP['05'],
      quickOptions: ['Ortho Latex Warranty (12y)', 'Compare with Hybrid Fusion']
    };
  }

  // G. Plush latex claim
  if (lower.includes('plush') && lower.includes('latex')) {
    return {
      reply: "The approved reference confirms Plush's pillow-top, plush/soft feel but does not specify the internal materials. I would need the team to confirm the latex content.",
      card: PRODUCTS_MAP['03'],
      quickOptions: ['Plush Feel (Plush/Soft)', 'Plush Warranty (5y)']
    };
  }

  // H. Back pain cure / clinical diagnosis
  if (lower.includes('cure') || lower.includes('back pain') || lower.includes('spine pain') || lower.includes('വേദന') || lower.includes('doctor')) {
    if (lang === 'ml') {
      return {
        reply: "ലോറ മോഡലുകളുടെ സപ്പോർട്ടും കംഫർട്ടും വിശദീകരിക്കാം, എന്നാൽ മെഡിക്കൽ ചികിത്സയോ നടുവേദന പൂർണ്ണമായി മാറുമെന്നോ ഉറപ്പ് നൽകാൻ കഴിയില്ല. കൂടുതൽ സപ്പോർട്ടിനായി മീഡിയം-ഫേം മോഡലുകളാണോ (Ortho Hybrid, Ortho Latex), അതോ മീഡിയം ഫീലാണോ നിങ്ങൾക്ക് സൗകര്യം?",
        quickOptions: ['മീഡിയം-ഫേം സപ്പോർട്ട്', 'മീഡിയം ഫീൽ', 'ഷോറൂമിൽ പരീക്ഷിക്കുക']
      };
    }
    if (lang === 'manglish') {
      return {
        reply: "Lora mattresses-inte comfort and support options explain cheyyam, pakshe back pain cure cheyyumenno medical treatment enno promise cheyyan kazhiyilla. Ningalkku medium feel aano atho medium-firm support aano ishtam?",
        quickOptions: ['Medium-Firm Support', 'Medium Feel', 'Try in Showroom']
      };
    }
    return {
      reply: "I can explain the comfort and support options, but I cannot promise a mattress will treat back pain. Do you prefer a medium or medium-firm feel?",
      quickOptions: ['Medium-Firm Support', 'Balanced Medium', 'Showroom Visit']
    };
  }

  // I. EMI questions
  if (lower.includes('emi') || lower.includes('installment') || lower.includes('തവണ വ്യവസ്ഥ')) {
    return {
      reply: "The Lora reference lists Bajaj Finserv easy EMI options. The current tenure, charges, and eligibility need to be checked for your purchase.",
      quickOptions: ['Check Mattress Price', 'Delivery Timeline']
    };
  }

  // J. Discounts & Best price
  if (lower.includes('discount') || lower.includes('best price') || lower.includes('offer') || lower.includes('coupon') || lower.includes('കുറവ്')) {
    const hasActiveOffer = catalog && catalog['01'] && catalog['01'].offer && catalog['01'].offer.active;
    if (hasActiveOffer) {
      const code = catalog['01'].offer.couponCode || 'LORA10';
      return {
        reply: `We currently have an active promotional code: ${code}. You can apply it during checkout on eligible mattresses.`,
        quickOptions: ['Apply at Checkout', 'Calculate Price']
      };
    }
    return {
      reply: "I can ask the team about available offers for your chosen mattress, but I cannot create a discount myself.",
      quickOptions: ['View Standard Prices', 'Bajaj Finserv EMI']
    };
  }

  // 8. MODEL COMPARISONS (Section 4)
  if (lower.includes('vs') || lower.includes('compare') || lower.includes('difference') || lower.includes('താരതമ്യം') || lower.includes('വ്യത്യാസം')) {
    // Cloud 7 vs Cloud Ortho
    if ((lower.includes('cloud 7') || lower.includes('eurotop 7')) && (lower.includes('cloud ortho') || lower.includes('eurotop 9') || lower.includes('ortho'))) {
      return {
        reply: "Both have Eurotop positioning. Cloud 7 is medium-soft, 7-inch, 3-year warranty. Cloud Ortho is medium, 9-inch, 5-year warranty. Do you prioritize a softer surface or a medium feel?",
        quickOptions: ['Cloud 7 (Medium-Soft)', 'Cloud Ortho (Medium)', 'Check Prices']
      };
    }
    // Cloud 7 vs Plush
    if ((lower.includes('cloud 7') || lower.includes('eurotop 7')) && lower.includes('plush')) {
      return {
        reply: "Cloud 7 is medium-soft Eurotop, 7-inch, 3-year warranty. Plush is plush/soft pillow top, 5-year warranty, height unconfirmed. Choice starts with your preferred feel.",
        quickOptions: ['Cloud 7', 'Lora Plush', 'Pricing']
      };
    }
    // Cloud Ortho vs Comfort Core
    if ((lower.includes('cloud ortho') || lower.includes('eurotop 9')) && lower.includes('comfort core')) {
      return {
        reply: "Both are medium feel. Cloud Ortho is 9-inch Eurotop with 5-year warranty. Comfort Core is pillow top with 10-year warranty and unconfirmed height.",
        quickOptions: ['Cloud Ortho', 'Comfort Core', 'Compare Prices']
      };
    }
    // Plush vs Comfort Core
    if (lower.includes('plush') && lower.includes('comfort core')) {
      return {
        reply: "Both are pillow-top models; Plush is plush/soft with 5-year warranty, Comfort Core is medium with 10-year warranty. Choice starts with preferred feel, not warranty alone.",
        quickOptions: ['Lora Plush (Soft)', 'Comfort Core (Medium)', 'Check Prices']
      };
    }
    // Ortho Hybrid vs Ortho Latex
    if (lower.includes('ortho hybrid') && lower.includes('ortho latex')) {
      return {
        reply: "Both are medium-firm. Ortho Hybrid has responsive hybrid positioning and a 10-year warranty; Ortho Latex explicitly offers latex comfort and a 12-year warranty.",
        quickOptions: ['Ortho Hybrid', 'Ortho Latex', 'Check Prices']
      };
    }
    // Ortho Latex vs Hybrid Fusion
    if (lower.includes('ortho latex') && lower.includes('hybrid fusion')) {
      return {
        reply: "Both are medium-firm. Ortho Latex lists latex comfort and a 12-year warranty. Hybrid Fusion explicitly lists natural latex foam, memory foam and orthopedic foam, with a 15-year warranty.",
        quickOptions: ['Ortho Latex (12y)', 'Hybrid Fusion (15y)', 'Pricing']
      };
    }
    // Pocket Luxe vs Comfort Core
    if (lower.includes('pocket luxe') && lower.includes('comfort core')) {
      return {
        reply: "Both are medium and carry 10-year warranties. Pocket Luxe explicitly highlights independent pocket support and reduced partner disturbance; Comfort Core highlights balanced everyday pillow-top comfort.",
        quickOptions: ['Pocket Luxe', 'Comfort Core', 'Pricing']
      };
    }
    // Ortho Hybrid vs Hybrid Fusion
    if (lower.includes('ortho hybrid') && lower.includes('hybrid fusion')) {
      return {
        reply: "Both are medium-firm. Ortho Hybrid has a 10-year warranty and an unspecified hybrid composition. Hybrid Fusion has 15 years and three named foam materials.",
        quickOptions: ['Ortho Hybrid', 'Hybrid Fusion', 'Check Prices']
      };
    }
  }

  // 9. RESOLVE "SECOND ONE", "THIS ONE", OR AMBIGUOUS ALIASES
  if (lower === 'second one' || lower === 'the second one' || lower === 'rendamathe' || lower === 'രണ്ടാമത്തേത്') {
    return {
      reply: "Got it! Let's focus on that second option. What bed dimensions or room size are you planning for?",
      quickOptions: ['King Size', 'Queen Size', 'Check Price']
    };
  }

  // "Cloud" without 7 or Ortho
  if (lower === 'cloud' || lower === 'lora cloud') {
    return {
      reply: "Lora has two Cloud models: Cloud 7 (Medium-Soft, 7-inch, 3-year warranty) and Cloud Ortho (Medium, 9-inch, 5-year warranty). Which feel suits your preference?",
      quickOptions: ['Cloud 7 (Medium-Soft)', 'Cloud Ortho (Medium)']
    };
  }

  // "Ortho" without qualifier
  if (lower === 'ortho' || lower === 'orthopedic') {
    return {
      reply: "Lora has three ortho-positioned models: Cloud Ortho (Medium, 9-inch), Ortho Hybrid (Medium-Firm), and Ortho Latex (Medium-Firm). Are you looking for a balanced medium or a firmer feel?",
      quickOptions: ['Cloud Ortho (Medium)', 'Ortho Hybrid (Medium-Firm)', 'Ortho Latex (Latex)']
    };
  }

  // 10. PRICING & QUOTE QUERIES
  const isPriceQuery = lower.includes('price') || lower.includes('rate') || lower.includes('cost') || lower.includes('ethra') || lower.includes('വില') || lower.includes('എത്ര');
  if (isPriceQuery) {
    const targetModelId = resolveModelFromText(lower, context) || '01';
    const prodInfo = PRODUCTS_MAP[targetModelId];
    const size = memory.size || (context && context.size ? context.size : null);

    if (catalog && catalog[targetModelId]) {
      const basePrice = catalog[targetModelId].basePrice || 22999;
      
      // If user provided exact size (e.g. Queen, King)
      if (size) {
        const estPrice = calculateVariantPrice(catalog, targetModelId, size, '8');
        return {
          reply: `For ${prodInfo.name} in ${size}, verified prices start around ₹${estPrice.toLocaleString('en-IN')}. Please measure your bed's inside length × width to confirm the exact SKU fit.`,
          card: { ...prodInfo, price: `₹${estPrice.toLocaleString('en-IN')}` },
          quickOptions: ['Check Pincode Delivery', 'Bajaj Finserv EMI', 'Talk to Team']
        };
      }

      // Unspecified size
      return {
        reply: `I need the current price for your size to compare fairly. What length and width do you need? Queen and King labels can vary across frames.`,
        quickOptions: ['King (78"×72")', 'Queen (78"×60")', 'Single (78"×36")']
      };
    }

    return {
      reply: `I need your bed's inside length and width to check the exact verified price for ${prodInfo.name}. Queen and King dimensions can vary.`,
      quickOptions: ['King Size', 'Queen Size', 'Measure Guide']
    };
  }

  // 11. RECOMMENDATION ROUTING (Section 5)
  if (lower.includes('recommend') || lower.includes('help me choose') || lower.includes('soft') || lower.includes('nalla') || lower.includes('ഏതാണ് നല്ലത്') || lower.includes('couple') || lower.includes('ethanu')) {
    // Partner movement / couples
    if (/couple/i.test(lower) || lower.includes('partner') || lower.includes('movement') || lower.includes('shake')) {
      if (lang === 'manglish') {
        return {
          reply: "Partner thiriyumbol disturbance kurayan aanu priority enkil Pocket Luxe nokkam. Athil reduced motion transfer aanu highlight. Ningalkku medium feel comfortable aano?",
          card: PRODUCTS_MAP['07'],
          quickOptions: ['Pocket Luxe Details', 'Check King Price']
        };
      }
      return {
        reply: "Pocket Luxe is designed for independent support and reduced partner disturbance. It has a medium feel, premium pillow-top comfort, and a 10-year warranty.",
        card: PRODUCTS_MAP['07'],
        quickOptions: ['Pocket Luxe Details', 'Check King Price', 'Compare Models']
      };
    }

    // Soft feel
    if (memory.feel === 'Soft' || lower.includes('soft')) {
      if (lang === 'manglish') {
        return {
          reply: "Lora Plush aanu plush/soft feel ulla pillow-top option. Kurachu balanced cushioning venamenkil medium-soft Cloud 7 nokkam. Ningalkku valare soft feel aano ishtam?",
          card: PRODUCTS_MAP['03'],
          quickOptions: ['Lora Plush (Soft)', 'Cloud 7 (Medium-Soft)']
        };
      }
      return {
        reply: "Lora Plush has a plush/soft pillow-top feel. Cloud 7 is another option with medium-soft Eurotop comfort. Do you like a very soft feel or something a little more balanced?",
        card: PRODUCTS_MAP['03'],
        quickOptions: ['Lora Plush (Plush/Soft)', 'Cloud 7 (Medium-Soft)', 'Compare Both']
      };
    }

    // Medium-firm
    if (memory.feel === 'Medium-Firm' || lower.includes('firm')) {
      return {
        reply: "For medium-firm support, consider Ortho Hybrid (responsive support, 10-year warranty), Ortho Latex (responsive latex comfort, 12-year warranty), or Hybrid Fusion (latex, memory foam, orthopedic foam, 15-year warranty).",
        card: PRODUCTS_MAP['04'],
        quickOptions: ['Ortho Hybrid', 'Ortho Latex', 'Hybrid Fusion']
      };
    }

    // Undecided / general
    return {
      reply: "It depends on the feel you enjoy. Plush is a soft pillow-top option, while Ortho Hybrid has a medium-firm feel. Do you prefer soft cushioning or a firmer feel?",
      quickOptions: ['Plush / Soft', 'Balanced Medium', 'Medium-Firm']
    };
  }

  // 12. SIZE AND MEASURING GUIDANCE (Section 6)
  if (lower.includes('size') || lower.includes('dimension') || lower.includes('measure') || lower.includes('അളവ്') || /\b(ft|feet)\b/i.test(lower)) {
    return {
      reply: "Please measure the inside area where your mattress sits. Share the length and width, plus the mattress height you prefer. Queen and King labels alone may not match your bed exactly.",
      quickOptions: ['King (78"×72")', 'Queen (78"×60")', 'Single (78"×36")', 'Custom Dimensions']
    };
  }

  // 13. PINCODE DELIVERY (Standalone)
  if (memory.pincode) {
    const del = checkPincodeDelivery(memory.pincode);
    if (del) {
      if (lang === 'ml') {
        return {
          reply: `പിൻകോഡ് ${del.pincode}-ലേക്ക് ഡെലിവറി ലഭ്യമാണ്. ${del.hub} വഴി ഏകദേശം ${del.days}-ൽ എത്തിക്കാം. തിരഞ്ഞെടുക്കുന്ന മോഡലിനനുസരിച്ച് ഡെലിവറി നിബന്ധനകൾ സ്ഥിരീകരിക്കാം.`,
          quickOptions: ['വില വിവരങ്ങൾ', 'സൈസ് തിരഞ്ഞെടുക്കുക', 'ലോറ ടീം വിളിക്കണോ?']
        };
      }
      if (lang === 'manglish') {
        return {
          reply: `PIN code ${del.pincode}-il service available aanu. ${del.hub} vazhi approximately ${del.days}-il dispatch/delivery process cheyyam. Current order terms location anusarichu check cheyyam.`,
          quickOptions: ['Check prices', 'Size guide', 'Talk to team']
        };
      }
      return {
        reply: `PIN code ${del.pincode} is serviceable via our ${del.hub}, with delivery typically within ${del.days}. Exact delivery terms depend on your chosen mattress model.`,
        quickOptions: ['View Prices', 'Check EMI', 'Consult Team']
      };
    }
  }

  // 14. SHOWROOM LOOKUP
  if (lower.includes('showroom') || lower.includes('store') || lower.includes('കട') || lower.includes('branch') || lower.includes('experience centre')) {
    if (lang === 'ml') {
      return {
        reply: "ലോറയ്ക്ക് ഷോറൂമുകളും ഓൺലൈൻ പർച്ചേസും ലഭ്യമാണ്. നിങ്ങൾ ഏത് നഗരത്തിലോ പിൻകോഡിലോ ആണ് ഉള്ളത്? അടുത്തുള്ള വെരിഫൈഡ് ലൊക്കേഷൻ പരിശോധിക്കാം.",
        quickOptions: ['കൊച്ചി', 'ബെംഗളൂരു', 'മുംബൈ']
      };
    }
    if (lang === 'manglish') {
      return {
        reply: "Lora-kku showrooms and online shopping options undu. Ningal ethu town/pincode-il aanu? Verified showroom records check cheyyam.",
        quickOptions: ['Kochi', 'Bengaluru', 'Mumbai']
      };
    }
    return {
      reply: "Which town or pincode are you in? I can check our verified showroom locations for you.",
      quickOptions: ['Bengaluru', 'Kochi', 'Mumbai', 'Check Pincode']
    };
  }

  // 15. HUMAN-LIKE CONVERSATIONAL REASONING ACROSS ALL 8 MATTRESSES
  // (Prevents locking into a single mattress and answers directly with respect to user's question)
  return processConversationalQuery(message, context, history);
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'GET') {
    const kb = getKnowledgeBase();
    return res.status(200).json({
      status: 'active',
      name: 'Lumi',
      version: '2.0-verified',
      kbAvailable: !!kb
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  try {
    const payload = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const message = (payload.message || '').trim();
    const context = payload.context || {};
    const history = payload.history || [];

    const kb = getKnowledgeBase();
    const catalog = getCatalog();

    // Generate local verified response based on 2.0 Knowledge Base
    const response = generateLocalResponse(message, context, history, kb, catalog);

    return res.status(200).json({
      success: true,
      reply: response.reply,
      card: response.card || null,
      quickOptions: response.quickOptions || ['Help me choose', 'Find my size', 'Compare mattresses'],
      suggestLead: response.suggestLead || false,
      contextUsed: context
    });
  } catch (err) {
    console.error('[LUMI API ERROR]:', err);
    return res.status(500).json({
      success: false,
      message: 'Lumi service error: ' + err.message,
      retryable: true
    });
  }
};
