/**
 * LORA Mattress — Global Theme Architecture (V2)
 * Handles Cart Drawer, Comparison Dock, Quick View, 5-Slide Carousel Decks, and Category Filtering.
 */

(function () {
  'use strict';

  window.LORA = window.LORA || {};

  // ==========================================
  // 1. PRODUCT CARD 5-SLIDE CAROUSEL DECKS
  // ==========================================
  function initProductCardCarousels() {
    document.addEventListener('click', function (e) {
      const tabBtn = e.target.closest('.slide-tab-btn');
      if (tabBtn) {
        e.preventDefault();
        const deck = tabBtn.closest('.carousel-card-deck');
        if (!deck) return;

        const targetSlide = tabBtn.getAttribute('data-tab');
        
        // Update tab buttons
        deck.querySelectorAll('.slide-tab-btn').forEach(btn => btn.classList.remove('active'));
        tabBtn.classList.add('active');

        // Update slide panels
        deck.querySelectorAll('.product-slide-panel').forEach(panel => {
          panel.classList.remove('active');
          if (panel.getAttribute('data-panel') === targetSlide) {
            panel.classList.add('active');
          }
        });
      }
    });

    // Category filter tabs in Featured Mattresses
    const categoryBtns = document.querySelectorAll('.category-filter-btn');
    categoryBtns.forEach(btn => {
      btn.addEventListener('click', function () {
        categoryBtns.forEach(b => b.classList.remove('active'));
        this.classList.add('active');

        const category = this.getAttribute('data-category');
        const cards = document.querySelectorAll('.carousel-card-deck');

        cards.forEach(card => {
          if (category === 'all' || card.getAttribute('data-category') === category) {
            card.style.display = 'flex';
          } else {
            card.style.display = 'none';
          }
        });
      });
    });
  }

  // ==========================================
  // 2. CART DRAWER & STATE
  // ==========================================
  const CartDrawer = {
    cartData: {
      items: [
        {
          id: 101,
          title: "LORA CLOUD 7™",
          variant: "Queen (78\" × 60\") • 7-Inch Eurotop",
          price: 26999,
          quantity: 1,
          image: "comfort-plush.jpg"
        }
      ],
      itemCount: 1,
      totalPrice: 26999
    },

    threshold: 35000, // ₹35,000 Free White Glove Setup

    init: function () {
      this.overlay = document.querySelector('.cart-drawer-overlay');
      this.drawer = document.querySelector('.cart-drawer');
      this.openBtns = document.querySelectorAll('[data-action="open-cart"]');
      this.closeBtns = document.querySelectorAll('[data-action="close-cart"]');
      this.itemsContainer = document.querySelector('.cart-drawer-items');
      this.badge = document.querySelector('.cart-count-badge');
      this.subtotalVal = document.querySelector('.subtotal-val');
      this.freeTierFill = document.querySelector('.free-tier-fill');
      this.freeTierText = document.querySelector('.free-tier-text');

      this.bindEvents();
      this.render();
    },

    bindEvents: function () {
      const self = this;
      this.openBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          self.open();
        });
      });

      this.closeBtns.forEach(btn => {
        btn.addEventListener('click', () => self.close());
      });

      if (this.overlay) {
        this.overlay.addEventListener('click', () => self.close());
      }

      // Intercept Add to Cart buttons
      document.addEventListener('click', function (e) {
        const atcBtn = e.target.closest('[data-action="add-to-cart"]');
        if (atcBtn) {
          e.preventDefault();
          const title = atcBtn.getAttribute('data-title') || "LORA CLOUD 7™";
          const price = parseInt(atcBtn.getAttribute('data-price') || "26999", 10);
          const variant = atcBtn.getAttribute('data-variant') || "Queen (78\" × 60\")";
          const img = atcBtn.getAttribute('data-img') || "comfort-plush.jpg";

          self.addItem({
            id: Date.now(),
            title: title,
            variant: variant,
            price: price,
            quantity: 1,
            image: img
          });
        }
      });
    },

    open: function () {
      if (this.drawer) this.drawer.classList.add('active');
      if (this.overlay) this.overlay.classList.add('active');
      document.body.style.overflow = 'hidden';
    },

    close: function () {
      if (this.drawer) this.drawer.classList.remove('active');
      if (this.overlay) this.overlay.classList.remove('active');
      document.body.style.overflow = '';
    },

    addItem: function (item) {
      this.cartData.items.push(item);
      this.cartData.itemCount++;
      this.cartData.totalPrice += item.price;
      this.render();
      this.open();
      if (this.openBtns) {
        this.openBtns.forEach(btn => {
          btn.classList.remove('cart-pop');
          void btn.offsetWidth;
          btn.classList.add('cart-pop');
          setTimeout(() => btn.classList.remove('cart-pop'), 700);
        });
      }
    },

    removeItem: function (index) {
      const item = this.cartData.items[index];
      if (item) {
        this.cartData.totalPrice -= (item.price * item.quantity);
        this.cartData.itemCount -= item.quantity;
        this.cartData.items.splice(index, 1);
        this.render();
      }
    },

    updateQty: function (index, delta) {
      const item = this.cartData.items[index];
      if (item) {
        item.quantity += delta;
        if (item.quantity <= 0) {
          this.removeItem(index);
          return;
        }
        this.cartData.itemCount += delta;
        this.cartData.totalPrice += (item.price * delta);
        this.render();
      }
    },

    render: function () {
      const self = this;
      if (this.badge) {
        this.badge.textContent = this.cartData.itemCount;
        this.badge.style.display = this.cartData.itemCount > 0 ? 'flex' : 'none';
      }

      if (this.openBtns) {
        this.openBtns.forEach(btn => {
          if (this.cartData.itemCount > 0) {
            btn.classList.add('has-items');
          } else {
            btn.classList.remove('has-items');
          }
        });
      }

      if (this.subtotalVal) {
        this.subtotalVal.textContent = '₹' + this.cartData.totalPrice.toLocaleString('en-IN');
      }

      // Free white glove tier calculation
      if (this.freeTierFill && this.freeTierText) {
        const progress = Math.min(1, this.cartData.totalPrice / this.threshold);
        this.freeTierFill.style.width = (progress * 100) + '%';

        if (this.cartData.totalPrice >= this.threshold) {
          this.freeTierText.innerHTML = '✨ <strong>Free White-Glove In-Home Setup Unlocked!</strong>';
        } else {
          const remaining = this.threshold - this.cartData.totalPrice;
          this.freeTierText.innerHTML = `Add <strong>₹${remaining.toLocaleString('en-IN')}</strong> to unlock Free White-Glove Delivery`;
        }
      }

      // Render Items
      if (this.itemsContainer) {
        if (this.cartData.items.length === 0) {
          this.itemsContainer.innerHTML = `
            <div style="text-align: center; padding: 4rem 1rem;">
              <p style="font-size: 1.15rem; color: var(--text-muted); margin-bottom: 1.5rem;">Your sleep order is empty.</p>
              <button type="button" class="btn btn-secondary" data-action="close-cart">Explore Mattresses</button>
            </div>
          `;
          const cBtn = this.itemsContainer.querySelector('[data-action="close-cart"]');
          if (cBtn) cBtn.addEventListener('click', () => self.close());
        } else {
          this.itemsContainer.innerHTML = this.cartData.items.map((item, idx) => `
            <div class="cart-item">
              <img src="${item.image}" alt="${item.title}" class="cart-item-img">
              <div class="cart-item-info">
                <div class="cart-item-title">${item.title}</div>
                <div class="cart-item-variant">${item.variant}</div>
                <div class="cart-item-bottom">
                  <div class="qty-stepper">
                    <button type="button" class="qty-btn" data-cart-idx="${idx}" data-delta="-1">−</button>
                    <span class="qty-val">${item.quantity}</span>
                    <button type="button" class="qty-btn" data-cart-idx="${idx}" data-delta="1">+</button>
                  </div>
                  <strong style="color: var(--color-espresso); font-size: 0.95rem;">₹${(item.price * item.quantity).toLocaleString('en-IN')}</strong>
                </div>
              </div>
            </div>
          `).join('');

          this.itemsContainer.querySelectorAll('.qty-btn').forEach(btn => {
            btn.addEventListener('click', function () {
              const idx = parseInt(this.getAttribute('data-cart-idx'), 10);
              const delta = parseInt(this.getAttribute('data-delta'), 10);
              self.updateQty(idx, delta);
            });
          });
        }
      }
    }
  };

  // ==========================================
  // 3. MATTRESS COMPARISON ENGINE (UP TO 3)
  // ==========================================
  const MattressCompare = {
    items: [],

    init: function () {
      this.dock = document.querySelector('.comparison-dock');
      this.dockCount = document.querySelector('.compare-dock-count');
      this.modal = document.querySelector('#modal-comparison');

      this.bindEvents();
    },

    bindEvents: function () {
      const self = this;
      document.addEventListener('click', function (e) {
        const btn = e.target.closest('[data-action="add-compare"]');
        if (btn) {
          e.preventDefault();
          const prod = {
            id: btn.getAttribute('data-id'),
            title: btn.getAttribute('data-title'),
            comfort: btn.getAttribute('data-comfort'),
            price: btn.getAttribute('data-price'),
            origin: btn.getAttribute('data-origin') || 'Factory Direct',
            warranty: btn.getAttribute('data-warranty'),
            layers: btn.getAttribute('data-layers'),
            image: btn.getAttribute('data-img')
          };
          self.toggleItem(prod, btn);
        }

        const openModalBtn = e.target.closest('[data-action="open-compare-modal"]');
        if (openModalBtn) {
          e.preventDefault();
          self.openModal();
        }

        const clearBtn = e.target.closest('[data-action="clear-compare"]');
        if (clearBtn) {
          e.preventDefault();
          self.clear();
        }
      });
    },

    toggleItem: function (prod, btn) {
      const existingIdx = this.items.findIndex(i => i.id === prod.id);
      if (existingIdx > -1) {
        this.items.splice(existingIdx, 1);
        if (btn) btn.textContent = '+ Compare';
      } else {
        if (this.items.length >= 3) {
          alert('You can compare up to 3 mattresses at a time.');
          return;
        }
        this.items.push(prod);
        if (btn) btn.textContent = '✓ Compared';
      }
      this.updateDock();
    },

    updateDock: function () {
      if (!this.dock) return;
      if (this.items.length > 0) {
        this.dock.classList.add('visible');
        if (this.dockCount) this.dockCount.textContent = `(${this.items.length}/3)`;
      } else {
        this.dock.classList.remove('visible');
      }
    },

    clear: function () {
      this.items = [];
      document.querySelectorAll('[data-action="add-compare"]').forEach(btn => {
        btn.textContent = '+ Compare';
      });
      this.updateDock();
      if (this.modal) this.modal.classList.remove('active');
    },

    openModal: function () {
      if (!this.modal) return;
      const tableBody = this.modal.querySelector('.comparison-table-body');
      if (tableBody) {
        tableBody.innerHTML = `
          <tr>
            <th>Product</th>
            ${this.items.map(i => `
              <td>
                <img src="${i.image}" style="width: 100%; aspect-ratio: 4/3; object-fit: cover; border-radius: 2px; margin-bottom: 0.5rem;">
                <strong>${i.title}</strong>
              </td>
            `).join('')}
          </tr>
          <tr>
            <th>Comfort Profile</th>
            ${this.items.map(i => `<td><strong>${i.comfort}</strong></td>`).join('')}
          </tr>
          <tr>
            <th>Starting Price</th>
            ${this.items.map(i => `<td><strong style="color: var(--color-espresso);">${i.price}</strong></td>`).join('')}
          </tr>
          <tr>
            <th>Motion Isolation</th>
            ${this.items.map(i => `<td>Zero Motion Disturbance</td>`).join('')}
          </tr>
          <tr>
            <th>Warranty</th>
            ${this.items.map(i => `<td><strong>${i.warranty}</strong></td>`).join('')}
          </tr>
          <tr>
            <th>Layer Architecture</th>
            ${this.items.map(i => `<td>${i.layers}</td>`).join('')}
          </tr>
          <tr>
            <th>Action</th>
            ${this.items.map(i => `
              <td>
                <button type="button" class="btn btn-primary btn-sm" data-action="add-to-cart" data-title="${i.title}" data-price="29999" data-img="${i.image}">Add to Order</button>
              </td>
            `).join('')}
          </tr>
        `;
      }
      this.modal.classList.add('active');
    }
  };

  // ==========================================
  // 4. QUICK VIEW MODAL
  // ==========================================
  const QuickView = {
    init: function () {
      this.modal = document.querySelector('#modal-quick-view');
      this.bindEvents();
    },

    bindEvents: function () {
      const self = this;
      document.addEventListener('click', function (e) {
        const btn = e.target.closest('[data-action="quick-view"]');
        if (btn) {
          e.preventDefault();
          const title = btn.getAttribute('data-title');
          const comfort = btn.getAttribute('data-comfort');
          const price = btn.getAttribute('data-price');
          const desc = btn.getAttribute('data-desc');
          const img = btn.getAttribute('data-img');
          const warranty = btn.getAttribute('data-warranty') || '10 Years';
          self.open({ title, comfort, price, desc, img, warranty });
        }
      });
    },

    open: function (data) {
      if (!this.modal) return;
      const content = this.modal.querySelector('.quick-view-content');
      if (content) {
        content.innerHTML = `
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2.5rem; align-items: center;">
            <div style="aspect-ratio: 4/3; overflow: hidden; border-radius: 4px;">
              <img src="${data.img}" alt="${data.title}" style="width: 100%; height: 100%; object-fit: cover;">
            </div>
            <div>
              <span class="eyebrow">${data.comfort}</span>
              <h3 style="font-size: 2rem; margin-bottom: 0.35rem;">${data.title}</h3>
              <p style="font-size: 1.35rem; font-weight: 700; color: var(--color-espresso); margin-bottom: 0.5rem;">${data.price}</p>
              <span style="display: inline-block; font-size: 0.76rem; font-weight: 700; color: var(--color-olive); background: rgba(98,106,86,0.1); padding: 0.2rem 0.5rem; border-radius: 2px; margin-bottom: 1rem;">
                🛡️ ${data.warranty} Warranty • Direct Factory Craft
              </span>
              <p style="margin-bottom: 1.5rem; font-size: 0.95rem; line-height: 1.6;">${data.desc}</p>
              
              <div style="margin-bottom: 1.5rem;">
                <label style="display: block; font-size: 0.8rem; font-weight: 600; text-transform: uppercase; margin-bottom: 0.4rem;">Select Cot Size</label>
                <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                  <button type="button" class="swatch-pill selected">Queen (78" × 60")</button>
                  <button type="button" class="swatch-pill">King (78" × 72")</button>
                  <button type="button" class="swatch-pill">Double (72" × 48")</button>
                  <button type="button" class="swatch-pill">Single (72" × 36")</button>
                </div>
              </div>

              <button type="button" class="btn btn-primary" style="width: 100%;" data-action="add-to-cart" data-title="${data.title}" data-price="29999" data-img="${data.img}">
                Add to Sanctuary Order • ${data.price}
              </button>
            </div>
          </div>
        `;
      }
      this.modal.classList.add('active');
    }
  };

  // ==========================================
  // 5. GLOBAL MODALS & ACCORDIONS
  // ==========================================
  function initModalsAndAccordions() {
    // Modal close buttons
    document.querySelectorAll('[data-action="close-modal"]').forEach(btn => {
      btn.addEventListener('click', function () {
        const modal = this.closest('.modal-overlay');
        if (modal) modal.classList.remove('active');
      });
    });

    document.querySelectorAll('.modal-overlay').forEach(modal => {
      modal.addEventListener('click', function (e) {
        if (e.target === this) this.classList.remove('active');
      });
    });

    // Size Guide Trigger
    document.querySelectorAll('[data-action="open-size-guide"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const sg = document.querySelector('#modal-size-guide');
        if (sg) sg.classList.add('active');
      });
    });

    // Inside Comfort layer selector
    const layerItems = document.querySelectorAll('.layer-item');
    const layerImg = document.querySelector('.material-layer-img');
    layerItems.forEach(item => {
      item.addEventListener('click', function () {
        layerItems.forEach(i => i.classList.remove('active'));
        this.classList.add('active');
        const imgSrc = this.getAttribute('data-img');
        if (layerImg && imgSrc) {
          layerImg.src = imgSrc;
        }
      });
    });

    // FAQ Accordion
    const faqItems = document.querySelectorAll('.faq-item');
    faqItems.forEach(item => {
      const trigger = item.querySelector('.faq-trigger');
      if (trigger) {
        trigger.addEventListener('click', function () {
          const isActive = item.classList.contains('active');
          faqItems.forEach(i => i.classList.remove('active'));
          if (!isActive) item.classList.add('active');
        });
      }
    });

    // Sticky Header Scroll Direction
    let lastScroll = 0;
    const header = document.querySelector('.site-header');
    window.addEventListener('scroll', function () {
      const currentScroll = window.pageYOffset;
      if (header) {
        if (currentScroll > 100) {
          header.classList.add('header-scrolled');
        } else {
          header.classList.remove('header-scrolled');
        }

        if (currentScroll > 250 && currentScroll > lastScroll) {
          header.classList.add('header-hidden');
        } else {
          header.classList.remove('header-hidden');
        }
      }
      lastScroll = currentScroll;
    }, { passive: true });

    // Announcement dismiss
    const annDismiss = document.querySelector('.announcement-dismiss');
    if (annDismiss) {
      annDismiss.addEventListener('click', function () {
        const bar = this.closest('.announcement-bar');
        if (bar) bar.style.display = 'none';
      });
    }
  }

  // Init on DOM ready
  document.addEventListener('DOMContentLoaded', function () {
    initProductCardCarousels();
    CartDrawer.init();
    MattressCompare.init();
    QuickView.init();
    initModalsAndAccordions();
  });

  window.LORA.CartDrawer = CartDrawer;
  window.LORA.MattressCompare = MattressCompare;
  window.LORA.QuickView = QuickView;
})();
