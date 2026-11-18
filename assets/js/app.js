/* ============================================================
   KaizzShop storefront logic
   ============================================================ */
(function () {
  'use strict';

  var cfg = window.KAIZZ_CONFIG || {};
  var merchant = cfg.merchant || {};
  var STORE_KEY = 'kaizz.orders.v1';
  var USER_KEY = 'kaizz.username.v1';
  var CONTACT_KEY = 'kaizz.contact.v1';
  var IS_LOCAL = location.protocol === 'file:' ||
    /^(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])$/.test(location.hostname);

  var state = { pkg: null, order: null, orders: [], timer: null, toastTimer: null };
  var el = {};

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  function init() {
    cacheEls();
    applyConfig();
    loadOrders();
    bindPriceCards();
    bindDialogs();
    bindCheckout();
    bindOrdersUI();
    bindHeader();
    initReveal();
    openFromQuery();
    registerSW();
    renderOrders();
  }

  function cacheEls() {
    el.header = document.getElementById('siteHeader');
    el.checkout = document.getElementById('checkoutDialog');
    el.ordersDialog = document.getElementById('ordersDialog');
    el.checkoutEyebrow = document.getElementById('checkoutEyebrow');
    el.checkoutTitle = document.getElementById('checkoutTitle');
    el.setupHint = document.getElementById('setupHint');
    el.stepDetails = document.getElementById('stepDetails');
    el.stepPay = document.getElementById('stepPay');
    el.pkgSummary = document.getElementById('pkgSummary');
    el.checkoutForm = document.getElementById('checkoutForm');
    el.usernameInput = document.getElementById('usernameInput');
    el.contactInput = document.getElementById('contactInput');
    el.formError = document.getElementById('formError');
    el.sheetBody = el.checkout.querySelector('.sheet-body');
    el.payOrderId = document.getElementById('payOrderId');
    el.payAmount = document.getElementById('payAmount');
    el.payPack = document.getElementById('payPack');
    el.payUser = document.getElementById('payUser');
    el.payTimer = document.getElementById('payTimer');
    el.timerChip = document.getElementById('timerChip');
    el.qrHost = document.getElementById('qrHost');
    el.qrFrame = document.getElementById('qrFrame');
    el.qrExpired = document.getElementById('qrExpired');
    el.savedLine = document.getElementById('savedLine');
    el.ordersList = document.getElementById('ordersList');
    el.ordersEmpty = document.getElementById('ordersEmpty');
    el.ordersCount = document.getElementById('ordersCount');
    el.clearOrdersBtn = document.getElementById('clearOrdersBtn');
    el.toast = document.getElementById('toast');
  }

  function applyConfig() {
    document.querySelectorAll('[data-telegram]').forEach(function (a) {
      if (cfg.telegramUrl) a.href = cfg.telegramUrl;
    });
    document.querySelectorAll('[data-telegram-handle]').forEach(function (node) {
      node.textContent = '@' + (cfg.telegramHandle || 'Kaizz');
    });
    document.querySelectorAll('[data-hours]').forEach(function (node) {
      if (cfg.supportHours) node.textContent = cfg.supportHours;
    });
    if (cfg.shopName) document.title = cfg.shopName + ' — Instant Roblox Top-Up (KHQR)';
    var year = document.getElementById('year');
    if (year) year.textContent = String(new Date().getFullYear());

    if (merchant.placeholder) {
      console.warn('[KaizzShop] Placeholder Bakong account — edit assets/js/config.js before accepting real payments.');
      if (IS_LOCAL) el.setupHint.hidden = false;
    }
  }

  /* ---------- price cards ---------- */
  function bindPriceCards() {
    document.querySelectorAll('.pkg').forEach(function (card) {
      card.addEventListener('click', function () {
        openCheckout({ robux: Number(card.dataset.robux), price: card.dataset.price });
      });
    });
  }

  function summaryMarkup(pkg) {
    return '<span class="summary-icon"><svg class="icon" aria-hidden="true"><use href="#i-robux"/></svg></span>' +
      '<span class="summary-main"><strong>' + fmt(pkg.robux) + ' Robux</strong>' +
      '<span>Instant delivery to your Roblox username</span></span>' +
      '<span class="summary-price">' + money(pkg.price) + '</span>';
  }

  function openCheckout(pkg) {
    state.pkg = pkg;
    state.order = null;
    stopTimer();
    el.pkgSummary.innerHTML = summaryMarkup(pkg);
    el.checkoutForm.reset();
    el.usernameInput.value = readSetting(USER_KEY);
    el.contactInput.value = readSetting(CONTACT_KEY);
    el.usernameInput.classList.remove('invalid');
    el.formError.hidden = true;
    el.savedLine.hidden = true;
    el.qrHost.innerHTML = '';
    el.qrExpired.hidden = true;
    el.qrFrame.classList.remove('expired');
    el.timerChip.classList.remove('dead', 'warn');
    el.sheetBody.scrollTop = 0;
    showStep('details');
    openDialog(el.checkout);
    if (window.matchMedia('(min-width: 761px)').matches) {
      setTimeout(function () { el.usernameInput.focus(); }, 90);
    }
  }

  function showStep(name) {
    var details = name === 'details';
    el.stepDetails.hidden = !details;
    el.stepPay.hidden = details;
    el.checkoutEyebrow.textContent = details ? 'Checkout' : 'Step 2 of 2 · Payment';
    el.checkoutTitle.textContent = details ? 'Roblox top-up' : 'Scan & pay';
    if (el.sheetBody) el.sheetBody.scrollTop = 0;
  }

  /* ---------- checkout ---------- */
  function bindCheckout() {
    el.checkoutForm.addEventListener('submit', function (event) {
      event.preventDefault();
      var username = el.usernameInput.value.trim();
      var contact = el.contactInput.value.trim();
      var valid = /^[A-Za-z0-9_]{3,20}$/.test(username);

      if (!valid) {
        el.usernameInput.classList.add('invalid');
        el.formError.textContent = username
          ? 'Roblox usernames are 3–20 characters: letters, numbers and underscore only.'
          : 'Enter your Roblox username so we know where to send the Robux.';
        el.formError.hidden = false;
        el.usernameInput.focus();
        return;
      }

      el.usernameInput.classList.remove('invalid');
      el.formError.hidden = true;

      if (merchant.placeholder && !IS_LOCAL) {
        el.formError.textContent = 'Payments are not open yet — message us on Telegram and we will help you order.';
        el.formError.hidden = false;
        return;
      }

      writeSetting(USER_KEY, username);
      writeSetting(CONTACT_KEY, contact);

      var order = createOrder(username, contact);
      try {
        renderQr(order);
      } catch (err) {
        el.formError.textContent = 'Payment setup error: ' + (err.message || 'invalid merchant configuration') + '.';
        el.formError.hidden = false;
        return;
      }

      state.order = order;
      upsertOrder(order);
      updatePayUI(order);
      el.savedLine.hidden = false;
      showStep('pay');
      startTimer(order);
    });

    document.getElementById('backBtn').addEventListener('click', function () {
      stopTimer();
      showStep('details');
    });

    document.getElementById('regenBtn').addEventListener('click', regenerateOrder);

    document.getElementById('downloadQrBtn').addEventListener('click', downloadQr);

    document.getElementById('copyAmountBtn').addEventListener('click', function () {
      if (!state.order) return;
      copyText(money(state.order.price)).then(function (ok) {
        toast(ok ? 'Amount copied: ' + money(state.order.price) : 'Copy failed — long-press the amount instead.');
      });
    });

    document.getElementById('paidBtn').addEventListener('click', function () {
      if (!state.order) return;
      var order = state.order;
      if (order.status !== 'awaiting') {
        order.status = 'awaiting';
        upsertOrder(order);
      }
      el.savedLine.hidden = false;
      copyText(orderMessage(order));
      if (cfg.telegramUrl) window.open(cfg.telegramUrl, '_blank', 'noopener');
      toast('Order details copied — paste them in Telegram with your receipt.');
    });

    document.getElementById('openOrdersFromPay').addEventListener('click', function () {
      el.checkout.close();
      renderOrders();
      openDialog(el.ordersDialog);
    });

    el.usernameInput.addEventListener('input', function () {
      el.usernameInput.classList.remove('invalid');
      el.formError.hidden = true;
    });

    el.checkout.addEventListener('close', stopTimer);
  }

  function createOrder(username, contact) {
    var now = Date.now();
    return {
      id: makeOrderId(now),
      robux: state.pkg.robux,
      price: Number(state.pkg.price).toFixed(2),
      username: username,
      contact: contact,
      createdAt: now,
      expiresAt: now + minutes() * 60000,
      status: 'pending',
      qr: ''
    };
  }

  function minutes() {
    var value = Number(cfg.paymentWindowMinutes);
    return value > 0 ? value : 15;
  }

  function makeOrderId(now) {
    var alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    var date = new Date(now);
    var rand = '';
    for (var i = 0; i < 4; i++) rand += alphabet.charAt(Math.floor(Math.random() * alphabet.length));
    return 'KZ-' + String(date.getFullYear()).slice(2) + pad2(date.getMonth() + 1) + pad2(date.getDate()) + '-' + rand;
  }

  function renderQr(order) {
    if (!window.KHQR) throw new Error('KHQR module did not load');
    if (!window.qrcode) throw new Error('QR renderer did not load');

    var payload = window.KHQR.build({
      type: merchant.type,
      bakongId: merchant.bakongId,
      merchantId: merchant.merchantId,
      bankName: merchant.bankName,
      merchantName: merchant.merchantName || cfg.shopName || 'KaizzShop',
      city: merchant.city,
      mcc: merchant.mcc,
      amount: order.price,
      currency: merchant.currency,
      billNumber: order.id,
      storeLabel: cfg.shopName || 'KaizzShop',
      mobileNumber: cfg.supportPhone,
      createdAt: order.createdAt,
      expiresAt: order.expiresAt
    });

    order.qr = payload;

    var qr = window.qrcode(0, 'M');
    qr.addData(payload);
    qr.make();
    el.qrHost.innerHTML = qr.createSvgTag({ cellSize: 7, margin: 3 });
    var svg = el.qrHost.querySelector('svg');
    if (svg) {
      svg.setAttribute('aria-hidden', 'true');
      svg.removeAttribute('width');
      svg.removeAttribute('height');
    }
  }

  function updatePayUI(order) {
    el.payOrderId.textContent = order.id;
    el.payAmount.textContent = money(order.price);
    el.payPack.textContent = fmt(order.robux) + ' Robux';
    el.payUser.textContent = order.username;
  }

  function startTimer(order) {
    stopTimer();
    el.timerChip.classList.remove('dead', 'warn');
    el.qrExpired.hidden = true;
    el.qrFrame.classList.remove('expired');

    function tick() {
      var left = order.expiresAt - Date.now();
      if (left <= 0) {
        el.payTimer.textContent = '00:00';
        el.timerChip.classList.remove('warn');
        el.timerChip.classList.add('dead');
        el.qrExpired.hidden = false;
        el.qrFrame.classList.add('expired');
        if (order.status === 'pending') {
          order.status = 'expired';
          upsertOrder(order);
        }
        stopTimer();
        return;
      }
      var mins = Math.floor(left / 60000);
      var secs = Math.floor((left % 60000) / 1000);
      el.payTimer.textContent = pad2(mins) + ':' + pad2(secs);
      el.timerChip.classList.toggle('warn', left <= 180000);
    }

    tick();
    state.timer = setInterval(tick, 1000);
  }

  function stopTimer() {
    if (state.timer) {
      clearInterval(state.timer);
      state.timer = null;
    }
  }

  function regenerateOrder() {
    var order = state.order;
    if (!order) return;
    order.createdAt = Date.now();
    order.expiresAt = order.createdAt + minutes() * 60000;
    order.status = 'pending';
    try {
      renderQr(order);
    } catch (err) {
      toast('Could not generate a new QR: ' + (err.message || 'configuration error'));
      return;
    }
    upsertOrder(order);
    updatePayUI(order);
    el.savedLine.hidden = false;
    startTimer(order);
    toast('New QR generated — valid for ' + minutes() + ' minutes.');
  }

  function downloadQr() {
    if (!state.order) return;
    var svg = el.qrHost.querySelector('svg');
    if (!svg) {
      toast('Generate a QR first.');
      return;
    }
    var size = 1024;
    var clone = svg.cloneNode(true);
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    clone.setAttribute('width', String(size));
    clone.setAttribute('height', String(size));
    var xml = new XMLSerializer().serializeToString(clone);
    var img = new Image();

    img.onload = function () {
      var canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      var ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, size, size);
      var pad = Math.round(size * 0.04);
      ctx.drawImage(img, pad, pad, size - pad * 2, size - pad * 2);
      canvas.toBlob(function (blob) {
        if (!blob) {
          toast('Could not export the QR — take a screenshot instead.');
          return;
        }
        var link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'KaizzShop-' + state.order.id + '.png';
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(function () { URL.revokeObjectURL(link.href); }, 5000);
        toast('QR saved to your downloads.');
      }, 'image/png');
    };

    img.onerror = function () {
      toast('Could not export the QR — take a screenshot instead.');
    };

    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(xml);
  }

  /* ---------- orders ---------- */
  function bindOrdersUI() {
    document.getElementById('ordersBtn').addEventListener('click', function () {
      renderOrders();
      openDialog(el.ordersDialog);
    });

    document.getElementById('browsePacksBtn').addEventListener('click', function () {
      el.ordersDialog.close();
      document.getElementById('prices').scrollIntoView({ behavior: 'smooth' });
    });

    el.ordersList.addEventListener('click', function (event) {
      var button = event.target.closest('button[data-action]');
      if (!button) return;
      var order = state.orders.find(function (item) { return item.id === button.dataset.id; });
      if (!order) return;

      if (button.dataset.action === 'telegram') {
        copyText(orderMessage(order));
        if (cfg.telegramUrl) window.open(cfg.telegramUrl, '_blank', 'noopener');
        toast('Order details copied — paste them in Telegram.');
      }

      if (button.dataset.action === 'view') {
        el.ordersDialog.close();
        setTimeout(function () { openOrder(order); }, 60);
      }
    });

    el.clearOrdersBtn.addEventListener('click', function () {
      if (!state.orders.length) return;
      if (!window.confirm('Clear all saved order history on this device?')) return;
      state.orders = [];
      persistOrders();
      renderOrders();
      toast('Order history cleared.');
    });
  }

  function loadOrders() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      var parsed = raw ? JSON.parse(raw) : [];
      state.orders = Array.isArray(parsed) ? parsed.filter(function (order) {
        return order && typeof order.id === 'string' && typeof order.username === 'string';
      }) : [];
    } catch (err) {
      state.orders = [];
    }
  }

  function persistOrders() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(state.orders));
    } catch (err) {
      /* storage full or blocked — orders still work for this session */
    }
  }

  function upsertOrder(order) {
    var index = state.orders.findIndex(function (item) { return item.id === order.id; });
    if (index >= 0) state.orders[index] = order;
    else state.orders.unshift(order);
    var limit = Number(cfg.orderHistoryLimit) > 0 ? Number(cfg.orderHistoryLimit) : 30;
    state.orders = state.orders.slice(0, limit);
    persistOrders();
    renderOrders();
  }

  function renderOrders() {
    if (!el.ordersList) return;
    var count = state.orders.length;
    el.ordersCount.hidden = count === 0;
    el.ordersCount.textContent = count > 99 ? '99+' : String(count);
    el.ordersEmpty.hidden = count > 0;
    el.clearOrdersBtn.hidden = count === 0;
    el.ordersList.hidden = count === 0;

    if (!count) {
      el.ordersList.innerHTML = '';
      return;
    }

    el.ordersList.innerHTML = state.orders.map(function (order) {
      var status = statusOf(order);
      return '<article class="order-item">' +
        '<div class="order-top"><span class="order-id">' + esc(order.id) + '</span>' +
        '<span class="status-chip status-' + status.key + '">' + status.label + '</span></div>' +
        '<div class="order-mid"><strong>' + fmt(order.robux) + ' Robux</strong>' +
        '<span>' + money(order.price) + '</span></div>' +
        '<p class="order-user">' + esc(order.username) + ' · ' + esc(fmtDate(order.createdAt)) + '</p>' +
        '<div class="order-actions">' +
        '<button class="btn btn-ghost" type="button" data-action="telegram" data-id="' + esc(order.id) + '">' +
        '<svg class="icon" aria-hidden="true"><use href="#i-telegram"/></svg> Send on Telegram</button>' +
        '<button class="btn btn-ghost" type="button" data-action="view" data-id="' + esc(order.id) + '">View QR</button>' +
        '</div></article>';
    }).join('');
  }

  function statusOf(order) {
    if (order.status === 'awaiting') return { key: 'awaiting', label: 'Receipt sent' };
    if (order.status === 'expired' || order.expiresAt <= Date.now()) return { key: 'expired', label: 'QR expired' };
    return { key: 'pending', label: 'Awaiting payment' };
  }

  function openOrder(order) {
    state.pkg = { robux: order.robux, price: order.price };
    state.order = order;
    stopTimer();
    el.pkgSummary.innerHTML = summaryMarkup(state.pkg);
    el.usernameInput.value = order.username;
    el.contactInput.value = order.contact || '';
    el.savedLine.hidden = true;
    updatePayUI(order);

    var expired = order.status === 'expired' || order.expiresAt <= Date.now();
    if (expired) {
      order.createdAt = Date.now();
      order.expiresAt = order.createdAt + minutes() * 60000;
      order.status = 'pending';
    }

    try {
      renderQr(order);
    } catch (err) {
      toast('Could not load this QR: ' + (err.message || 'configuration error'));
      return;
    }

    if (expired) upsertOrder(order);
    startTimer(order);
    showStep('pay');
    openDialog(el.checkout);
  }

  /* ---------- dialogs ---------- */
  function bindDialogs() {
    document.querySelectorAll('dialog').forEach(function (dialog) {
      dialog.addEventListener('click', function (event) {
        if (event.target === dialog) dialog.close();
      });
      dialog.addEventListener('close', syncScrollLock);
      dialog.addEventListener('cancel', syncScrollLock);
    });
    document.querySelectorAll('[data-close]').forEach(function (button) {
      button.addEventListener('click', function () {
        var dialog = button.closest('dialog');
        if (dialog) dialog.close();
      });
    });
  }

  function openDialog(dialog) {
    if (!dialog || dialog.open) return;
    dialog.showModal();
    syncScrollLock();
  }

  function syncScrollLock() {
    var anyOpen = !!document.querySelector('dialog[open]');
    document.documentElement.classList.toggle('dialog-open', anyOpen);
  }

  /* ---------- header / reveal / misc ---------- */
  function bindHeader() {
    function onScroll() {
      el.header.classList.toggle('scrolled', window.scrollY > 8);
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  function initReveal() {
    var items = Array.prototype.slice.call(document.querySelectorAll('.reveal'));
    if (!('IntersectionObserver' in window)) {
      items.forEach(function (item) { item.classList.add('is-visible'); });
      return;
    }
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });
    items.forEach(function (item) { observer.observe(item); });
  }

  function openFromQuery() {
    try {
      var value = Number(new URLSearchParams(window.location.search).get('pkg'));
      if (!isFinite(value) || value <= 0) return;
      var card = document.querySelector('.pkg[data-robux="' + value + '"]');
      if (card) setTimeout(function () { card.click(); }, 250);
    } catch (err) {
      /* ignore malformed query strings */
    }
  }

  function registerSW() {
    if (!('serviceWorker' in navigator) || !/^https?:$/.test(location.protocol)) return;
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function () { /* offline cache is optional */ });
    });
  }

  /* ---------- helpers ---------- */
  function orderMessage(order) {
    return [
      'KaizzShop — Roblox top-up',
      'Order ID: ' + order.id,
      'Pack: ' + fmt(order.robux) + ' Robux',
      'Amount: ' + money(order.price),
      'Roblox username: ' + order.username,
      order.contact ? 'Contact: ' + order.contact : '',
      'Payment: I have paid via KHQR (receipt attached)'
    ].filter(Boolean).join('\n');
  }

  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text).then(function () { return true; }).catch(function () {
        return legacyCopy(text);
      });
    }
    return Promise.resolve(legacyCopy(text));
  }

  function legacyCopy(text) {
    try {
      var area = document.createElement('textarea');
      area.value = text;
      area.setAttribute('readonly', '');
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      var ok = document.execCommand('copy');
      area.remove();
      return ok;
    } catch (err) {
      return false;
    }
  }

  function toast(message) {
    if (!el.toast) return;
    el.toast.textContent = message;
    el.toast.classList.add('show');
    clearTimeout(state.toastTimer);
    state.toastTimer = setTimeout(function () {
      el.toast.classList.remove('show');
    }, 3800);
  }

  function money(value) {
    return '$' + Number(value).toFixed(2);
  }

  function fmt(value) {
    return Number(value).toLocaleString('en-US');
  }

  function pad2(value) {
    return String(value).padStart(2, '0');
  }

  function fmtDate(timestamp) {
    try {
      return new Date(timestamp).toLocaleString('en-GB', {
        day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
      });
    } catch (err) {
      return '';
    }
  }

  function esc(value) {
    return String(value).replace(/[&<>"']/g, function (char) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char];
    });
  }

  function readSetting(key) {
    try { return localStorage.getItem(key) || ''; } catch (err) { return ''; }
  }

  function writeSetting(key, value) {
    try {
      if (value) localStorage.setItem(key, value);
      else localStorage.removeItem(key);
    } catch (err) {
      /* private mode — settings just won't persist */
    }
  }
})();
