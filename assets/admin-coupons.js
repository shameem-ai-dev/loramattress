/* LORA Admin — real Coupon Codes manager (Promotions tab → "Promotional Coupon Codes Engine")
   Loads/saves /api/coupons. Each coupon: code, % or flat ₹, min order, max discount,
   usage limit, expiry, active, "show at checkout" (tap-to-apply chip for customers). */
(function () {
  'use strict';
  function token() { return localStorage.getItem('lora_admin_token') || ''; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  var coupons = [];
  var tbody, addBtn, statusEl;

  function api(method, body) {
    return fetch('/api/coupons', {
      method: method, cache: 'no-store',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token() },
      body: body ? JSON.stringify(body) : undefined
    }).then(function (r) { return r.json().then(function (d) { if (!r.ok || !d.success) throw new Error(d.message || ('HTTP ' + r.status)); return d; }); });
  }

  function status(t, ok) {
    if (!statusEl) return;
    statusEl.textContent = t || '';
    statusEl.style.color = ok === false ? '#F87171' : '#34D399';
  }

  function row(c, i) {
    var inp = 'class="admin-input" style="height:32px;font-size:0.8rem;width:100%;box-sizing:border-box;"';
    return '<tr data-i="' + i + '">' +
      '<td><input ' + inp + ' data-f="code" value="' + esc(c.code) + '" placeholder="CODE" style="height:32px;font-size:0.8rem;width:100%;box-sizing:border-box;text-transform:uppercase;font-weight:700;">' +
        '<input ' + inp + ' data-f="description" value="' + esc(c.description) + '" placeholder="Short description" style="margin-top:4px;height:28px;font-size:0.72rem;width:100%;box-sizing:border-box;"></td>' +
      '<td><div style="display:flex;gap:4px;"><select ' + inp + ' data-f="type" style="height:32px;font-size:0.78rem;width:62px;"><option value="percent"' + (c.type !== 'flat' ? ' selected' : '') + '>%</option><option value="flat"' + (c.type === 'flat' ? ' selected' : '') + '>₹</option></select>' +
        '<input ' + inp + ' data-f="value" type="number" min="1" value="' + esc(c.value) + '"></div>' +
        '<input ' + inp + ' data-f="maxDiscount" type="number" min="0" value="' + esc(c.maxDiscount || '') + '" placeholder="Max ₹ (opt.)" style="margin-top:4px;height:28px;font-size:0.72rem;width:100%;box-sizing:border-box;"></td>' +
      '<td><input ' + inp + ' data-f="minOrder" type="number" min="0" value="' + esc(c.minOrder || '') + '" placeholder="0 = none">' +
        '<input ' + inp + ' data-f="expiresAt" type="date" value="' + esc((c.expiresAt || '').slice(0, 10)) + '" title="Expiry date (optional)" style="margin-top:4px;height:28px;font-size:0.72rem;width:100%;box-sizing:border-box;"></td>' +
      '<td><input ' + inp + ' data-f="usageLimit" type="number" min="0" value="' + esc(c.usageLimit || '') + '" placeholder="0 = unlimited">' +
        '<div style="font-size:0.7rem;color:#94A3B8;margin-top:4px;">Used: ' + (c.usedCount || 0) + '</div></td>' +
      '<td style="font-size:0.75rem;"><label style="display:flex;gap:4px;align-items:center;"><input type="checkbox" data-f="active"' + (c.active !== false ? ' checked' : '') + '> Active</label>' +
        '<label style="display:flex;gap:4px;align-items:center;margin-top:4px;" title="Show as a tap-to-apply chip in checkout"><input type="checkbox" data-f="showAtCheckout"' + (c.showAtCheckout !== false ? ' checked' : '') + '> Show in checkout</label></td>' +
      '<td><button type="button" class="btn-logout" data-del="' + i + '" style="height:28px;padding:0 0.6rem;font-size:0.72rem;">Delete</button></td>' +
      '</tr>';
  }

  function render() {
    tbody.innerHTML = coupons.length ? coupons.map(row).join('') :
      '<tr><td colspan="6" style="text-align:center;color:#94A3B8;font-size:0.8rem;padding:1rem;">No coupons yet — click "+ Create New Coupon".</td></tr>';
  }

  function readForm() {
    tbody.querySelectorAll('tr[data-i]').forEach(function (tr) {
      var c = coupons[Number(tr.getAttribute('data-i'))];
      tr.querySelectorAll('[data-f]').forEach(function (el) {
        var f = el.getAttribute('data-f');
        if (el.type === 'checkbox') c[f] = el.checked;
        else if (el.type === 'number') c[f] = Number(el.value) || 0;
        else c[f] = f === 'code' ? el.value.toUpperCase().replace(/[^A-Z0-9_-]/g, '') : el.value;
      });
    });
  }

  function saveAll() {
    readForm();
    var bad = coupons.find(function (c) { return !c.code || !(c.value > 0); });
    if (bad) { status('Every coupon needs a code and a discount value.', false); return; }
    status('Saving…');
    api('POST', { coupons: coupons }).then(function (d) {
      coupons = d.coupons; render();
      status(d.persisted === false ? 'Saved (memory only — server disk not writable)' : '✓ Coupons saved — live on checkout now', d.persisted !== false);
    }).catch(function (e) { status('Save failed: ' + e.message, false); });
  }

  function init() {
    tbody = document.getElementById('coupon-list-tbody');
    addBtn = document.getElementById('btn-add-coupon');
    if (!tbody || !addBtn) return;
    var header = addBtn.parentNode;
    var saveBtn = document.createElement('button');
    saveBtn.type = 'button';
    saveBtn.className = 'btn-action-primary';
    saveBtn.textContent = '💾 Save Coupons';
    saveBtn.style.cssText = 'height:36px;font-size:0.8rem;padding:0 1.1rem;margin-left:0.5rem;background:#059669;border:none;';
    statusEl = document.createElement('span');
    statusEl.style.cssText = 'font-size:0.76rem;font-weight:700;margin-left:0.75rem;';
    var actions = document.createElement('div');
    actions.style.cssText = 'display:flex;align-items:center;flex-wrap:wrap;gap:0.25rem;';
    header.insertBefore(actions, addBtn);
    actions.appendChild(addBtn); actions.appendChild(saveBtn); actions.appendChild(statusEl);

    var note = document.createElement('p');
    note.style.cssText = 'font-size:0.74rem;color:#94A3B8;margin:0.25rem 0 0.75rem;';
    note.innerHTML = 'Customers enter these in checkout. Coupons ticked <b>Show in checkout</b> appear as one-tap chips, and the best eligible one is applied automatically. The code in the Offer Poster should exist here too.';
    header.parentNode.insertBefore(note, header.nextSibling);

    addBtn.addEventListener('click', function () {
      readForm();
      coupons.unshift({ code: '', type: 'percent', value: 10, minOrder: 0, maxDiscount: 0, usageLimit: 0, usedCount: 0, expiresAt: '', active: true, showAtCheckout: true, description: '' });
      render();
      var first = tbody.querySelector('input[data-f="code"]'); if (first) first.focus();
    });
    saveBtn.addEventListener('click', saveAll);
    tbody.addEventListener('click', function (e) {
      var del = e.target.closest('[data-del]');
      if (!del) return;
      readForm();
      var c = coupons[Number(del.getAttribute('data-del'))];
      if (!confirm('Delete coupon ' + (c.code || '(new)') + '? Click "Save Coupons" afterwards to apply.')) return;
      coupons.splice(Number(del.getAttribute('data-del')), 1);
      render();
    });

    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#94A3B8;font-size:0.8rem;padding:1rem;">Loading coupons…</td></tr>';
    api('GET').then(function (d) { coupons = d.coupons || []; render(); })
      .catch(function (e) { status('Could not load coupons: ' + e.message, false); coupons = []; render(); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
