/**
 * LUMI CONVERSATIONAL REASONING ENGINE (VERSION 2.5)
 * Enables natural, human-like dialogue across all 8 LORA mattresses
 * Grounded in config/lumi_general_chatbot.json, config/lumi_kb.json, and config/catalog_data.json
 */

const fs = require('fs');
const path = require('path');

// Safe file loaders with caching
let cachedKB = null;
let cachedCatalog = null;
let cachedGeneralBot = null;

function loadJSON(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }
  } catch (e) {
    console.error(`[Lumi Engine] Error loading ${filePath}:`, e);
  }
  return null;
}

function getGeneralBotData() {
  const p = path.join(__dirname, '..', 'config', 'lumi_general_chatbot.json');
  return loadJSON(p) || {};
}

function getKBData() {
  const p = path.join(__dirname, '..', 'config', 'lumi_kb.json');
  return loadJSON(p) || {};
}

function getCatalogData() {
  const p = path.join(__dirname, '..', 'config', 'catalog_data.json');
  return loadJSON(p) || {};
}

// 8 Verified LORA Models
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

// Aliases for explicit mentions
const MODEL_ALIASES = {
  'cloud 7': '01',
  'cloud7': '01',
  'eurotop 7': '01',
  'cloud ortho': '02',
  'cloudortho': '02',
  'eurotop 9': '02',
  'plush': '03',
  'lora plush': '03',
  'excel pillow top': '03',
  'ortho hybrid': '04',
  'orthohybrid': '04',
  'ortho latex': '05',
  'ortholatex': '05',
  'ortho ema latex': '06',
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
    'vilikumo', 'pettannu', 'veetil', 'para', 'parayamo', 'entha', 'enthokke',
    'manasilayi', 'aano', 'shari', 'nokkam', 'venam', 'ariyamo', 'oru', 'kurachu',
    'rate', 'ennu', 'kollamo', 'athinte', 'ithinte', 'alle', 'parayu', 'choykkam',
    'tharumo', 'kidakkunna', 'enthanu', 'nokkiyalo', 'aayittulla'
  ];
  const lower = text.toLowerCase();
  for (const w of manglishKeywords) {
    if (new RegExp('\\b' + w + '\\b', 'i').test(lower)) return 'manglish';
  }
  return 'en';
}

/**
 * Main conversational reasoner
 */
function processConversationalQuery(message, context, history) {
  const lang = detectLang(message);
  const lower = (message || '').toLowerCase().trim();
  const botData = getGeneralBotData();
  const topics = botData.conversational_topics || {};
  const catalog = getCatalogData();

  // Helper to pick trilingual string
  const pickLang = (topicKey, fallback) => {
    if (topics[topicKey] && topics[topicKey][lang]) {
      return topics[topicKey][lang];
    }
    if (topics[topicKey] && topics[topicKey]['en']) {
      return topics[topicKey]['en'];
    }
    return fallback;
  };

  // 1. GREETINGS & SHORT SOCIAL PLEASANTRIES
  if (/^(hi|hello|hey|hai|halo|namaskaram|നമസ്കാരം|good morning|good evening)\b/i.test(lower) && lower.length < 25) {
    if (lang === 'ml') {
      return {
        reply: "നമസ്കാരം! ഞാൻ ലൂമി, ലോറയുടെ AI സ്ലീപ്പ് അസിസ്റ്റന്റ്. ലോറയുടെ 8 മോഡലുകളിൽ നിന്നും നിങ്ങളുടെ സ്ലീപ്പിംഗ് സ്റ്റൈലിന് ഏറ്റവും അനുയോജ്യമായ മെത്ത കണ്ടെത്താൻ സഹായിക്കട്ടെ?",
        quickOptions: ['എല്ലാ മോഡലുകളും കാണുക', 'സ്ലീപ്പ് പൊസിഷൻ അനുസരിച്ച്', 'നടുവേദനയ്ക്ക് ഉള്ളത്']
      };
    }
    if (lang === 'manglish') {
      return {
        reply: "Namaskaram! Njan Lumi, Lora's AI sleep assistant. Lora-ude 8 mattress models-il ninnum ningalude sleep style-inu correct match select cheyyan help venamo?",
        quickOptions: ['View All 8 Models', 'Side / Back Sleeper', 'Back Pain Guide']
      };
    }
    return {
      reply: "Hello! I’m Lumi, your personal LORA sleep specialist. Whether you need deep plush pressure relief, balanced medium support, or orthopedic firmness, I can guide you through all 8 handcrafted models. How can I help you today?",
      quickOptions: ['View All 8 Models', 'Side / Back Sleeper', 'Back Pain Guide', 'Check Delivery']
    };
  }

  // 2. GRATITUDE / FAREWELL
  if (/^(thanks|thank you|nandi|നന്ദി|shari thanks|super thanks)\b/i.test(lower)) {
    if (lang === 'ml') return { reply: "സന്തോഷം! ലോറ മെത്തകളെക്കുറിച്ച് കൂടുതൽ അറിയാൻ എപ്പോൾ വേണമെങ്കിലും ചോദിക്കാം. നല്ലൊരു ഉറക്കം ആശംസിക്കുന്നു!", quickOptions: [] };
    if (lang === 'manglish') return { reply: "You're most welcome! Mattenthenkilum doubt undenkil parayoo. Happy sleeping!", quickOptions: [] };
    return { reply: "You’re very welcome! If any other mattress or sizing questions come up, I’m right here. Wishing you deep, restorative sleep!", quickOptions: [] };
  }

  // 3. ALL MODELS / LIST / CATALOG OVERVIEW ("show me all", "what mattresses do you have in total?", "list all models")
  if (
    lower.includes('all mattress') ||
    lower.includes('all model') ||
    lower.includes('all 8') ||
    lower.includes('list all') ||
    lower.includes('show all') ||
    lower.includes('what models do you have') ||
    lower.includes('what mattresses do you have') ||
    lower.includes('ethokke models') ||
    lower.includes('enthokke undu') ||
    lower.includes('എല്ലാ മോഡലുകളും') ||
    (lower.includes('mattress') && (lower.includes('what are the options') || lower.includes('catalog')))
  ) {
    return {
      reply: pickLang('all_models_overview', "LORA crafts 8 distinct mattresses: Plush & Soft (Lora Plush, Cloud 7), Balanced Medium (Cloud Ortho, Comfort Core, Pocket Luxe), and Medium-Firm Support (Ortho Hybrid, Ortho Latex, Hybrid Fusion). Which comfort zone do you prefer?"),
      quickOptions: ['Plush / Soft', 'Balanced Medium', 'Medium-Firm Ortho']
    };
  }

  // 4. FLAT DELIVERY VS ROLLED IN A BOX ("delivery", "delivered", "shipping", "flat", "rolled", "box", "packed")
  if (
    lower.includes('flat') ||
    lower.includes('deliver') ||
    lower.includes('shipping') ||
    lower.includes('rolled') ||
    lower.includes('box') ||
    lower.includes('compressed') ||
    lower.includes('roll') ||
    lower.includes('ചുരുട്ടി') ||
    lower.includes('ഡെലിവറി')
  ) {
    return {
      reply: pickLang('flat_delivery', "LORA delivers all mattresses 100% Full-Size Flat direct from the factory! Unlike box mattresses crushed under hydraulic rollers, our flat delivery preserves spring temper and edge foam integrity completely."),
      quickOptions: ['View 8 Models', 'Check My Pincode', 'Compare Warranties']
    };
  }

  // 5. SLEEP POSITIONS
  // Side Sleeper
  if (lower.includes('side sleep') || lower.includes('side-sleep') || lower.includes('shoulder') || lower.includes('hip pain') || lower.includes('വശം ചരിഞ്ഞ്')) {
    return {
      reply: pickLang('side_sleepers', "For side sleepers, contouring pressure relief around shoulders and hips is essential. Lora Plush (Pillow Top, Soft) and Cloud 7 (Medium-Soft) are our top recommendations."),
      card: PRODUCTS_MAP['03'],
      quickOptions: ['LORA PLUSH™ Details', 'Cloud 7 Details', 'Compare Both']
    };
  }

  // Back Sleeper
  if (lower.includes('back sleep') || lower.includes('back-sleep') || lower.includes('മലർന്ന്')) {
    return {
      reply: pickLang('back_sleepers', "For back sleepers, balanced lumbar support is key to prevent lower spine sagging. We recommend Cloud Ortho (9\" Medium Eurotop) or Comfort Core (10-Yr Medium Pillow Top)."),
      card: PRODUCTS_MAP['02'],
      quickOptions: ['Cloud Ortho Details', 'Comfort Core Details', 'Ortho Hybrid (Firm)']
    };
  }

  // Stomach Sleeper
  if (lower.includes('stomach') || lower.includes('tummy') || lower.includes('prone') || lower.includes('കമിഴ്ന്ന്')) {
    return {
      reply: pickLang('stomach_sleepers', "Stomach sleepers require medium-firm support to prevent hips from sinking and hyperextending the lower back. Ortho Hybrid, Ortho Latex, and Hybrid Fusion keep your spine straight."),
      card: PRODUCTS_MAP['04'],
      quickOptions: ['Ortho Hybrid (10y)', 'Ortho Latex (12y)', 'Hybrid Fusion (15y)']
    };
  }

  // 6. BACK PAIN / ORTHOPEDIC / SPINE ALIGNMENT
  if (lower.includes('back pain') || lower.includes('backache') || lower.includes('spine') || lower.includes('ortho') || lower.includes('വേദന') || lower.includes('doctor')) {
    // If asking about a specific model's ortho status
    if (lower.includes('cloud ortho')) {
      return {
        reply: "Cloud Ortho is a generous 9-inch Eurotop with a balanced Medium feel and a 5-year warranty. While named 'Ortho' for balanced posture support, it is not an overly stiff or extra-hard mattress. Would you like to compare it with Ortho Hybrid?",
        card: PRODUCTS_MAP['02'],
        quickOptions: ['Compare with Ortho Hybrid', 'Cloud Ortho Price', 'Size Guide']
      };
    }
    return {
      reply: pickLang('back_pain_guidance', "While a mattress is not a medical prescription, healthy spinal neutrality makes a huge difference. For back care, we recommend medium-firm models like Ortho Hybrid (10-Yr), Ortho Latex (12-Yr), or Cloud Ortho (5-Yr)."),
      card: PRODUCTS_MAP['04'],
      quickOptions: ['Ortho Hybrid (Medium-Firm)', 'Ortho Latex (Latex Lift)', 'Cloud Ortho (Medium)']
    };
  }

  // 7. COUPLES / MOTION TRANSFER / PARTNER DISTURBANCE
  if (lower.includes('couple') || lower.includes('partner') || lower.includes('movement') || lower.includes('motion') || lower.includes('shake') || lower.includes('disturb') || lower.includes('അനക്കം')) {
    return {
      reply: pickLang('couples_motion_transfer', "If partner movement disturbs your sleep, LORA POCKET LUXE™ is engineered specifically for you. Each pocket coil operates independently, isolating motion with zero ripple effect across the bed."),
      card: PRODUCTS_MAP['07'],
      quickOptions: ['Pocket Luxe Details', 'King Size Price', 'Compare with Hybrid Fusion']
    };
  }

  // 8. COOLING / HOT SLEEPERS / TEMPERATURE REGULATION
  if (lower.includes('cool') || lower.includes('hot') || lower.includes('warm') || lower.includes('heat') || lower.includes('sweat') || lower.includes('breathable') || lower.includes('ചൂട്')) {
    return {
      reply: pickLang('cooling_and_breathability', "If you sleep hot, choose breathable open-cell materials like LORA ORTHO LATEX™ (ventilated natural latex bounce) or LORA POCKET LUXE™ (spring core airflow). Both prevent heat buildup effectively."),
      card: PRODUCTS_MAP['05'],
      quickOptions: ['Ortho Latex Details', 'Pocket Luxe Details', 'Check Prices']
    };
  }

  // 9. GENERAL RECOMMENDATION / CONFUSION / "HELP ME CHOOSE"
  if (
    lower.includes('help me choose') ||
    lower.includes('recommend') ||
    lower.includes('confused') ||
    lower.includes('which one') ||
    lower.includes('suggest') ||
    lower.includes('better') ||
    lower.includes('best mattress') ||
    lower.includes('ഏതാണ് നല്ലത്') ||
    lower.includes('ethanu nallathu')
  ) {
    if (lang === 'ml') {
      return {
        reply: "തീർച്ചയായും! ശരിയായ മെത്ത തിരഞ്ഞെടുക്കാൻ 2 കാര്യങ്ങൾ ശ്രദ്ധിച്ചാൽ മതി:\n\n1. **നിങ്ങളുടെ സ്ലീപ്പിംഗ് പൊസിഷൻ**: വശം ചരിഞ്ഞാണോ (സോഫ്റ്റ്/മീഡിയം), മലർന്നാണോ (ബാലൻസ്ഡ് മീഡിയം), അതോ കമിഴ്ന്നാണോ (മീഡിയം-ഫേം)?\n2. **കംഫർട്ട് മുൻഗണന**: മൃദുവായ പില്ലോ ടോപ്പ് (Plush), സ്പ്രിംഗ് സപ്പോർട്ട് (Pocket Luxe), അതോ പ്രകൃതിദത്ത ലാറ്റക്സ് (Ortho Latex)?\n\nനിങ്ങൾക്ക് ഇതിൽ ഏതാണ് കൂടുതൽ ഇഷ്ടം?",
        quickOptions: ['വശം ചരിഞ്ഞ് (Side Sleeper)', 'മലർന്ന് (Back Sleeper)', 'കമിഴ്ന്ന് (Stomach Sleeper)']
      };
    }
    if (lang === 'manglish') {
      return {
        reply: "Sure! Correct mattress choose cheyyan 2 simple points nokkam:\n\n1. **Sleep Position**: Side sleeper (soft/medium), Back sleeper (balanced medium), or Stomach sleeper (medium-firm)?\n2. **Comfort Feel**: Soft sink-in pillow top (Plush), zero disturbance pocket springs (Pocket Luxe), or breathable bouncy latex (Ortho Latex)?\n\nNingalkku ethu sleeping style aanu ullath?",
        quickOptions: ['Side Sleeper (Soft)', 'Back Sleeper (Medium)', 'Stomach Sleeper (Firm)']
      };
    }
    return {
      reply: "I’d love to help you find your ideal match! To narrow it down to the top 2 models:\n\n1. **What is your primary sleep position?** (Side, Back, Stomach, or Combination?)\n2. **Do you prefer softer cushioning, balanced medium contouring, or firm orthopedic support?**\n\nTell me your preference and I will recommend the exact right mattress for you!",
      quickOptions: ['Side Sleeper (Plush)', 'Back Sleeper (Medium)', 'Firm Support (Ortho)', 'Couples (Zero Motion)']
    };
  }

  // 10. EXPLICIT PRODUCT QUERIES (User mentions a specific model by name)
  for (const [alias, id] of Object.entries(MODEL_ALIASES)) {
    if (lower.includes(alias)) {
      const p = PRODUCTS_MAP[id];
      // Price question for this model
      if (lower.includes('price') || lower.includes('rate') || lower.includes('cost') || lower.includes('ethra') || lower.includes('വില')) {
        let baseP = catalog && catalog[id] ? catalog[id].basePrice : 24999;
        return {
          reply: `For **${p.name}**, verified prices start from around ₹${baseP?.toLocaleString('en-IN') || '22,999'} for single/queen configurations. What bed length × width do you need so I can check your exact size?`,
          card: { ...p, price: `From ₹${baseP?.toLocaleString('en-IN')}` },
          quickOptions: ['King (78"×72")', 'Queen (78"×60")', 'Single (78"×36")']
        };
      }
      // General question for this specific model
      return {
        reply: `**${p.name}** features ${p.type} with a **${p.feel}** feel and a **${p.warranty}** factory warranty.${p.height !== 'Unconfirmed' ? ` It has a verified ${p.height} depth.` : ''}\n\nWould you like to check prices for your bed size, or compare it with another model?`,
        card: p,
        quickOptions: [`${p.name} Price`, 'Compare with Another', 'Delivery Timeline']
      };
    }
  }

  // 11. CONTEXT FALLBACK (ONLY if the user is ON a product page AND asking about "this" mattress)
  const isPdpContext = context && context.productName && (lower.includes('this') || lower.includes('it') || lower.includes('cost') || lower.includes('price') || lower.includes('thickness'));
  if (isPdpContext) {
    for (const [alias, id] of Object.entries(MODEL_ALIASES)) {
      if (context.productName.toLowerCase().includes(alias)) {
        const p = PRODUCTS_MAP[id];
        return {
          reply: `You're currently viewing **${p.name}** (${p.feel}, ${p.type}, ${p.warranty} warranty). How can I assist you with this model?`,
          card: p,
          quickOptions: ['Calculate Exact Price', 'Check Pincode Delivery', 'Compare with Another']
        };
      }
    }
  }

  // 12. NATURAL OPEN-ENDED HUMAN FALLBACK (Respects the conversation without repeating Cloud 7)
  if (lang === 'ml') {
    return {
      reply: "നിങ്ങളുടെ ചോദ്യം മനസ്സിലായി. ലോറയുടെ 8 മോഡലുകളിൽ നിന്നും ഏറ്റവും അനുയോജ്യമായത് കണ്ടെത്താൻ നിങ്ങളുടെ സ്ലീപ്പിംഗ് പൊസിഷനോ (വശം ചരിഞ്ഞോ, മലർന്നോ), ഇഷ്ടപ്പെടുന്ന കംഫർട്ടോ (സോഫ്റ്റ്, മീഡിയം, ഫേം) പറയാമോ?",
      quickOptions: ['എല്ലാ മോഡലുകളും കാണുക', 'സോഫ്റ്റ് / പ്ലഷ്', 'മീഡിയം ഫീൽ', 'മീഡിയം-ഫേം സപ്പോർട്ട്']
    };
  }
  if (lang === 'manglish') {
    return {
      reply: "Manasilayi! Ningalude question-u pariharamayi, Lora-ude 8 models-il ninnum correct choice select cheyyan ningalude sleep position (side, back) or preferred feel (soft, medium, firm) parayamo?",
      quickOptions: ['View All 8 Models', 'Soft / Plush', 'Balanced Medium', 'Medium-Firm Ortho']
    };
  }
  return {
    reply: "I understand! To give you the most accurate advice across our 8 handcrafted mattresses, what sleep feel do you typically enjoy most: a cloud-like soft surface, a balanced medium contour, or firm orthopedic back support?",
    quickOptions: ['Plush / Soft', 'Balanced Medium', 'Medium-Firm Ortho', 'Compare All Models']
  };
}

module.exports = {
  processConversationalQuery,
  detectLang,
  PRODUCTS_MAP,
  MODEL_ALIASES
};
