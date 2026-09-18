/**
 * LORA Mattress — Guided Mattress Finder Quiz (V2)
 * Matches user's sleep profile to the 8 approved LORA models from the brand brief.
 */

(function () {
  'use strict';

  const QUIZ_DATA = {
    step1: {
      question: "What is your primary sleeping position?",
      options: [
        { id: "side", title: "Side Sleeper", desc: "Requires contouring shoulder and hip pressure relief." },
        { id: "back", title: "Back Sleeper", desc: "Needs supportive lumbar contouring with neutral spine alignment." },
        { id: "stomach", title: "Stomach Sleeper", desc: "Prefers firmer pushback to prevent midsection sinking." },
        { id: "combo", title: "Combination Sleeper", desc: "Shifts positions frequently; needs dynamic ease of movement." }
      ]
    },
    step2: {
      question: "How do you prefer your mattress to feel?",
      options: [
        { id: "plush", title: "Plush & Cushioned (Soft)", desc: "Gentle pressure relief with cosy pillow-top or Eurotop softness." },
        { id: "medium", title: "Balanced Medium Feel", desc: "The sweet spot of contouring cushioning and underlying support." },
        { id: "ortho", title: "Strong Orthopedic Support", desc: "Enhanced spinal stability, responsive pushback, and firm alignment." }
      ]
    },
    step3: {
      question: "Who will be resting on this mattress?",
      options: [
        { id: "solo", title: "Just Me", desc: "Tailored purely to your personal weight and posture preferences." },
        { id: "partner", title: "Me & a Partner", desc: "Prioritizes independent pocket support and reduced partner disturbance." },
        { id: "family", title: "Family & Kids", desc: "Heavy-duty durability, balanced body support, and everyday resilience." }
      ]
    },
    step4: {
      question: "What size mattress are you looking for?",
      options: [
        { id: "queen", title: "Queen Size (78\" × 60\")", desc: "Standard master bedroom dimension in Indian homes." },
        { id: "king", title: "King Size (78\" × 72\")", desc: "Maximum space for couples and family cosiness." },
        { id: "double", title: "Double / Diwan (72\" × 48\")", desc: "Ideal for compact guest bedrooms and daybeds." },
        { id: "single", title: "Single Cot (72\" × 36\")", desc: "Individual comfort for solo sleepers and teens." }
      ]
    },
    step5: {
      question: "What is your top priority for sleep?",
      options: [
        { id: "latex", title: "Natural Latex & Breathability", desc: "100% natural comfort and tropical temperature regulation." },
        { id: "backpain", title: "Spinal Health & Lumbar Relief", desc: "Orthopedic-focused engineering to alleviate stiffness." },
        { id: "pocket", title: "Zero Partner Disturbance", desc: "Independent pocket coils so you never feel your partner move." },
        { id: "fusion", title: "Advanced Multi-Layer Luxury", desc: "Latex + Memory + Ortho foam with a 15-year warranty." }
      ]
    }
  };

  const RECOMMENDATIONS = {
    plush: {
      title: "LORA PLUSH™",
      tagline: "Sink into comfort. Wake up refreshed.",
      comfort: "Plush / Soft (●●●●■)",
      price: "₹32,999",
      comparePrice: "₹38,999",
      warranty: "5 Years Warranty",
      img: "comfort-plush.jpg",
      why: "Because you prefer a softer, cosier sleep experience, LORA PLUSH™ features a dedicated pillow-top construction that cushions shoulders and hips while relieving everyday pressure points."
    },
    cloud_ortho: {
      title: "LORA CLOUD ORTHO™",
      tagline: "Plush comfort. Deeper support.",
      comfort: "Medium (●●●■■)",
      price: "₹29,999",
      comparePrice: "₹34,999",
      warranty: "5 Years Warranty",
      img: "comfort-balanced.jpg",
      why: "The generous 9-inch Eurotop profile gives you enhanced cushioning on top while maintaining deeper, balanced body support throughout the night."
    },
    pocket_luxe: {
      title: "LORA POCKET LUXE™",
      tagline: "Premium comfort. Refined support.",
      comfort: "Medium (●●●■■)",
      price: "₹41,999",
      comparePrice: "₹48,999",
      warranty: "10 Years Warranty",
      img: "material-pocket-springs.jpg",
      why: "Since you sleep with a partner, LORA POCKET LUXE™ pairs independent pocket support coils with a premium pillow-top to eliminate partner disturbance completely."
    },
    ortho_hybrid: {
      title: "LORA ORTHO HYBRID™",
      tagline: "Engineered for comfort. Built for support.",
      comfort: "Medium-Firm (●●■■■)",
      price: "₹36,999",
      comparePrice: "₹42,999",
      warranty: "10 Years Warranty",
      img: "comfort-firm.jpg",
      why: "Engineered for sleepers who want stronger support with responsive comfort. Features hybrid orthopedic technology to maintain neutral spinal alignment."
    },
    ortho_latex: {
      title: "LORA ORTHO LATEX™",
      tagline: "Natural comfort. Orthopedic support.",
      comfort: "Medium-Firm (●●■■■)",
      price: "₹39,999",
      comparePrice: "₹46,999",
      warranty: "12 Years Warranty",
      img: "material-natural-latex.jpg",
      why: "Combines 100% natural latex with orthopedic support for responsive, breathable, and all-natural temperature-regulated sleep."
    },
    hybrid_fusion: {
      title: "LORA HYBRID FUSION™",
      tagline: "Advanced comfort. Complete support.",
      comfort: "Medium-Firm (●●●■■)",
      price: "₹46,999",
      comparePrice: "₹54,999",
      warranty: "15 Years Warranty (Flagship)",
      img: "comfort-balanced.jpg",
      why: "Our most advanced multi-layer comfort system uniting Natural Latex Foam, Memory Foam, and Orthopedic Foam with a premier 15-year warranty."
    }
  };

  function initMattressFinder() {
    const finderEl = document.querySelector('.finder-card');
    if (!finderEl) return;

    let currentStep = 1;
    const answers = {};

    const questionEl = finderEl.querySelector('.quiz-question');
    const optionsGrid = finderEl.querySelector('.finder-options-grid');
    const dots = finderEl.querySelectorAll('.step-dot');
    const prevBtn = finderEl.querySelector('.quiz-prev-btn');
    const nextBtn = finderEl.querySelector('.quiz-next-btn');
    const resultBox = finderEl.querySelector('.quiz-result-box');
    const quizForm = finderEl.querySelector('.quiz-active-form');

    function renderStep(step) {
      if (step > 5) {
        showResults();
        return;
      }

      quizForm.style.display = 'block';
      if (resultBox) resultBox.style.display = 'none';

      dots.forEach((dot, index) => {
        dot.classList.toggle('active', index < step);
      });

      const dataKey = 'step' + step;
      const data = QUIZ_DATA[dataKey];

      if (questionEl) questionEl.textContent = data.question;
      if (optionsGrid) {
        optionsGrid.innerHTML = data.options.map(opt => `
          <button type="button" class="quiz-option-btn ${answers[dataKey] === opt.id ? 'selected' : ''}" data-val="${opt.id}">
            <span class="quiz-option-title">${opt.title}</span>
            <span class="quiz-option-desc">${opt.desc}</span>
          </button>
        `).join('');

        optionsGrid.querySelectorAll('.quiz-option-btn').forEach(btn => {
          btn.addEventListener('click', function () {
            const val = this.getAttribute('data-val');
            answers[dataKey] = val;
            optionsGrid.querySelectorAll('.quiz-option-btn').forEach(b => b.classList.remove('selected'));
            this.classList.add('selected');
            if (nextBtn) nextBtn.disabled = false;
          });
        });
      }

      if (prevBtn) prevBtn.style.visibility = step === 1 ? 'hidden' : 'visible';
      if (nextBtn) {
        nextBtn.disabled = !answers[dataKey];
        nextBtn.textContent = step === 5 ? 'Reveal My LORA Recommendation' : 'Next Step →';
      }
    }

    function showResults() {
      quizForm.style.display = 'none';
      if (!resultBox) return;

      resultBox.style.display = 'block';

      // Recommendation matching algorithm
      let matchKey = 'cloud_ortho';
      if (answers.step2 === 'plush') {
        matchKey = 'plush';
      } else if (answers.step5 === 'fusion') {
        matchKey = 'hybrid_fusion';
      } else if (answers.step5 === 'latex') {
        matchKey = 'ortho_latex';
      } else if (answers.step3 === 'partner' || answers.step5 === 'pocket') {
        matchKey = 'pocket_luxe';
      } else if (answers.step2 === 'ortho' || answers.step5 === 'backpain') {
        matchKey = 'ortho_hybrid';
      }

      const rec = RECOMMENDATIONS[matchKey];

      resultBox.innerHTML = `
        <div style="text-align: center; max-width: 680px; margin: 0 auto;">
          <span class="eyebrow" style="color: var(--color-olive);">Your Approved Model Match</span>
          <h3 style="font-size: 2.2rem; margin-bottom: 0.35rem;">${rec.title}</h3>
          <p style="font-size: 1rem; color: var(--color-olive); font-weight: 600; margin-bottom: 0.5rem;">${rec.tagline}</p>
          <div style="display: flex; justify-content: center; gap: 1rem; margin-bottom: 1.5rem; font-size: 0.85rem;">
            <span>Comfort: <strong>${rec.comfort}</strong></span>
            <span>•</span>
            <span>Coverage: <strong>${rec.warranty}</strong></span>
          </div>
          
          <div style="aspect-ratio: 16/9; max-width: 480px; margin: 0 auto 1.75rem; border-radius: 4px; overflow: hidden; border: 1px solid var(--border-light);">
            <img src="${rec.img}" alt="${rec.title}" style="width: 100%; height: 100%; object-fit: cover;">
          </div>

          <p style="font-size: 1.05rem; line-height: 1.65; color: var(--text-secondary); margin-bottom: 2rem; background: var(--bg-primary); padding: 1.25rem 1.5rem; border-radius: 4px; text-align: left;">
            <strong style="color: var(--color-espresso);">Why this fits your profile:</strong> ${rec.why}
          </p>

          <div style="display: flex; align-items: center; justify-content: center; gap: 1.25rem; flex-wrap: wrap;">
            <div style="text-align: left;">
              <span style="font-size: 0.8rem; color: var(--text-muted); display: block;">Starting from</span>
              <strong style="font-size: 1.5rem; color: var(--color-espresso);">${rec.price}</strong>
            </div>
            <button type="button" class="btn btn-primary" data-action="add-to-cart" data-title="${rec.title}" data-price="29999" data-img="${rec.img}">
              Add to Order • ${rec.price}
            </button>
            <button type="button" class="btn btn-secondary quiz-restart-btn">Retake Quiz</button>
          </div>
        </div>
      `;

      const restartBtn = resultBox.querySelector('.quiz-restart-btn');
      if (restartBtn) {
        restartBtn.addEventListener('click', () => {
          currentStep = 1;
          for (let k in answers) delete answers[k];
          renderStep(currentStep);
        });
      }
    }

    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        if (currentStep <= 5 && answers['step' + currentStep]) {
          currentStep++;
          renderStep(currentStep);
        }
      });
    }

    if (prevBtn) {
      prevBtn.addEventListener('click', () => {
        if (currentStep > 1) {
          currentStep--;
          renderStep(currentStep);
        }
      });
    }

    renderStep(currentStep);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMattressFinder);
  } else {
    initMattressFinder();
  }
})();
