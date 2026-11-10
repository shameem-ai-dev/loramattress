/*
 * LORA Variant Visibility Engine
 * Single source of truth for which Bed Type / Size / Thickness combinations
 * are visible & selectable on the storefront. Driven by admin catalog fields:
 *   availableThicknesses : [6..12]                 (global thickness ticks)
 *   disabledCots         : { single: true, ... }   (hide whole bed type)
 *   disabledSizes        : { "queen_78x66": true } (hide one size)
 *   hiddenCombos         : { "queen_78x60_7": true } (hide one exact combination)
 */
(function () {
  const ALL_THICK = [6, 7, 8, 9, 10, 11, 12];
  const COT_ORDER = ['queen', 'king', 'double', 'single', 'custom'];

  // Friendly metadata shown on size cards (feet conversion + helper tag)
  const SIZE_META = {
    '78x72': { ft: '6.5 × 6 ft', tag: 'Most Popular' },
    '75x72': { ft: '6.25 × 6 ft' },
    '72x72': { ft: '6 × 6 ft' },
    '84x72': { ft: '7 × 6 ft', tag: 'Extra Long' },
    '78x60': { ft: '6.5 × 5 ft', tag: 'Most Popular' },
    '75x60': { ft: '6.25 × 5 ft' },
    '72x60': { ft: '6 × 5 ft' },
    '78x66': { ft: '6.5 × 5.5 ft', tag: 'Olympic' },
    '72x66': { ft: '6 × 5.5 ft' },
    '75x66': { ft: '6.25 × 5.5 ft' },
    '72x36': { ft: '6 × 3 ft', tag: 'Most Popular' },
    '75x36': { ft: '6.25 × 3 ft' },
    '78x36': { ft: '6.5 × 3 ft' },
    '72x30': { ft: '6 × 2.5 ft' },
    '75x30': { ft: '6.25 × 2.5 ft' },
    '78x30': { ft: '6.5 × 2.5 ft' },
    '72x42': { ft: '6 × 3.5 ft' },
    '75x42': { ft: '6.25 × 3.5 ft', tag: 'Wide' },
    '78x42': { ft: '6.5 × 3.5 ft' },
    '72x48': { ft: '6 × 4 ft', tag: 'Most Popular' },
    '75x48': { ft: '6.25 × 4 ft' },
    '78x48': { ft: '6.5 × 4 ft' }
  };

  // Custom size → the next (smallest covering) standard size. Returns { cot, inch } or null.
  function nextStandardSize(specs, len, wid) {
    len = Number(len) || 0; wid = Number(wid) || 0;
    let best = null;
    ['single', 'double', 'queen', 'king'].forEach(cot => {
      (specs[cot] || []).forEach(s => {
        const [l, w] = String(s.id).split('x').map(Number);
        if (!l || !w || l < len || w < wid) return;
        const area = l * w;
        if (!best || area < best.area || (area === best.area && w < best.w)) best = { cot, inch: s.id, area, w };
      });
    });
    return best ? { cot: best.cot, inch: best.inch } : null;
  }

  // Admin-entered per-combination MRP ("Website MRP"), or null when not set.
  function comboMrp(d, key) {
    const v = d && d.combinationMrp ? parseInt(d.combinationMrp[key], 10) : NaN;
    return v > 0 ? v : null;
  }

  function thicknesses(d) {
    const list = (d && Array.isArray(d.availableThicknesses) && d.availableThicknesses.length)
      ? d.availableThicknesses.map(Number)
      : ALL_THICK.slice();
    return list.filter(n => ALL_THICK.includes(n)).sort((a, b) => a - b);
  }

  function cotEnabled(d, cot) {
    return !((d && d.disabledCots) || {})[cot];
  }

  function sizeEnabled(d, cot, inch) {
    return cotEnabled(d, cot) && !((d && d.disabledSizes) || {})[`${cot}_${inch}`];
  }

  function comboVisible(d, cot, inch, th) {
    th = Number(th);
    if (!thicknesses(d).includes(th)) return false;
    if (cot === 'custom') return cotEnabled(d, 'custom');
    if (!sizeEnabled(d, cot, inch)) return false;
    return !((d && d.hiddenCombos) || {})[`${cot}_${inch}_${th}`];
  }

  function visibleThicks(d, cot, inch) {
    return thicknesses(d).filter(th => comboVisible(d, cot, inch, th));
  }

  function sizeAvailable(d, cot, inch) {
    return visibleThicks(d, cot, inch).length > 0;
  }

  function cotAvailable(d, cot, specs) {
    if (cot === 'custom') return cotEnabled(d, 'custom') && thicknesses(d).length > 0;
    return (specs[cot] || []).some(s => sizeAvailable(d, cot, s.id));
  }

  // Coerce a (possibly invalid) selection into the nearest valid one.
  function resolve(d, specs, sel) {
    let { cot, inch, thick } = sel;
    thick = Number(thick);
    if (!cotAvailable(d, cot, specs)) {
      cot = COT_ORDER.find(c => cotAvailable(d, c, specs)) || cot;
    }
    if (cot !== 'custom') {
      const list = specs[cot] || [];
      if (!list.find(s => s.id === inch && sizeAvailable(d, cot, s.id))) {
        const first = list.find(s => sizeAvailable(d, cot, s.id));
        inch = first ? first.id : (list[0] ? list[0].id : inch);
      }
    }
    const ths = visibleThicks(d, cot, inch);
    if (!ths.includes(thick)) {
      thick = ths.includes(8) ? 8 : (ths[0] || thick);
    }
    return { cot, inch, thick };
  }

  function meta(inch) {
    return SIZE_META[inch] || {};
  }

  window.LoraVariants = {
    ALL_THICK, COT_ORDER, thicknesses, cotEnabled, sizeEnabled, comboVisible,
    visibleThicks, sizeAvailable, cotAvailable, resolve, meta, nextStandardSize, comboMrp
  };
})();
