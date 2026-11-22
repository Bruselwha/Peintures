/* ==========================================================================
   Arij Color · common.js
   Utilidades compartidas, sesión, idioma, toasts, modales, PWA y WhatsApp.
   ========================================================================== */
(function (window, document) {
  'use strict';
  var CW = (window.CW = window.CW || {});
  var cfg = CW.config;

  var CWU = {
    // ---- DOM -----------------------------------------------------------
    qs: function (sel, root) { return (root || document).querySelector(sel); },
    qsa: function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); },

    esc: function (s) {
      return String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    },

    el: function (tag, attrs, html) {
      var n = document.createElement(tag);
      if (attrs) Object.keys(attrs).forEach(function (k) {
        if (k === 'class') n.className = attrs[k];
        else if (k === 'dataset') Object.keys(attrs[k]).forEach(function (d) { n.dataset[d] = attrs[k][d]; });
        else if (k.indexOf('on') === 0 && typeof attrs[k] === 'function') n.addEventListener(k.slice(2), attrs[k]);
        else n.setAttribute(k, attrs[k]);
      });
      if (html != null) n.innerHTML = html;
      return n;
    },

    // ---- Números y fechas ---------------------------------------------
    money: function (n, currency) {
      currency = currency || cfg.defaultCurrency;
      var v = Number(n || 0);
      var s = v.toFixed(2).replace('.', ',');
      // separador de miles
      s = s.replace(/\B(?=(\d{3})+(?!\d)(?=,))/g, '.');
      return s + ' ' + currency;
    },

    pct: function (a, b) {
      a = Number(a || 0); b = Number(b || 0);
      if (!b || b <= 0) return 0;
      return Math.round((1 - a / b) * 100);
    },

    dateShort: function (iso) {
      if (!iso) return '';
      var d = new Date(iso);
      return d.toLocaleDateString(CW.i18n.lang === 'ar' ? 'ar-MA' : CW.i18n.lang + '-' + 'MA', { year: 'numeric', month: '2-digit', day: '2-digit' });
    },
    dateTime: function (iso) {
      if (!iso) return '';
      var d = new Date(iso);
      return CWU.dateShort(iso) + ' · ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    },

    // ---- Teléfono / WhatsApp -------------------------------------------
    normalizePhone: function (country, local) {
      var cc = (COUNTRY_CODES[country] || {}).code || '';
      var digits = String(local || '').replace(/[^\d]/g, '').replace(/^0+/, '');
      return cc + digits;
    },

    COUNTRY_CODES: null, // se asigna abajo

    // Texto de compartir: estructurado, con negrita nativa de WhatsApp y SIN
    // emojis ni simbolos que algunos dispositivos no muestran bien.
    shareItem: function (biz, item) {
      var cur = biz.currency || cfg.defaultCurrency;
      var line = '--------------------------------';
      var L = [];
      L.push('*' + item.name + '*');
      L.push(line);
      if (item.kind === 'service') {
        L.push('Tipo: Servicio');
        L.push('Precio: ' + (Number(item.price) > 0 ? CWU.money(item.price, cur) : 'A consultar'));
        if (item.duration) L.push('Duracion: ' + item.duration);
        if (item.modality) L.push('Modalidad: ' + item.modality);
        L.push('Disponibilidad: Si');
      } else {
        L.push('Tipo: Producto');
        if (Number(item.promo_price) > 0 && Number(item.promo_price) < Number(item.price)) {
          L.push('Precio: ' + CWU.money(item.promo_price, cur));
          L.push('Antes: ' + CWU.money(item.price, cur));
          L.push('Ahorro: ' + CWU.pct(item.promo_price, item.price) + '%');
        } else {
          L.push('Precio: ' + CWU.money(item.price, cur));
        }
      }
      if (item.category_name) L.push('Categoria: ' + item.category_name);
      if (item.description) {
        L.push(line);
        L.push(String(item.description).trim().slice(0, 260));
      }
      L.push(line);
      L.push('*' + biz.name + '*');
      if (biz.whatsapp) L.push('WhatsApp: ' + biz.whatsapp);
      L.push(CW.catalogUrl(biz.slug));
      return L.join('\n');
    },

    // Comparte por WhatsApp (elige contacto) o usa el compartir del sistema.
    shareWhatsApp: function (text) {
      var url = 'https://wa.me/?text=' + encodeURIComponent(text);
      if (navigator.share) {
        navigator.share({ text: text }).catch(function () { window.open(url, '_blank', 'noopener'); });
      } else {
        window.open(url, '_blank', 'noopener');
      }
    },

    // Genera el mensaje de pedido estructurado (sin emojis).
    orderMessage: function (biz, order, opts) {
      opts = opts || {};
      var cur = biz.currency || cfg.defaultCurrency;
      var L = [];
      var line = '--------------------------------';
      L.push('*NUEVO PEDIDO*');
      L.push(biz.name);
      L.push('Código del pedido: *' + order.code + '*');
      L.push(line);
      L.push('*Cliente*');
      L.push('Nombre: ' + (order.customer_name || ''));
      L.push('Teléfono: ' + (order.customer_phone || ''));
      if (order.customer_address) L.push('Dirección: ' + order.customer_address);
      if (order.customer_city) L.push('Ciudad: ' + order.customer_city);
      if (order.note) L.push('Nota: ' + order.note);
      if (order.appointment_at) {
        L.push(line);
        L.push('*Cita*');
        var d = new Date(order.appointment_at);
        L.push('Fecha: ' + d.toLocaleDateString('es-ES'));
        L.push('Hora: ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      }
      L.push(line);
      L.push('*PRODUCTOS*');
      (order.items || []).forEach(function (it, i) {
        var name = it.name + (it.kind === 'service' ? ' (Servicio)' : '');
        L.push((i + 1) + '. ' + name);
        if (Number(it.price) > 0) {
          L.push('    ' + it.qty + ' x ' + CWU.money(it.price, cur) + ' = ' + CWU.money(it.price * it.qty, cur));
        } else {
          L.push('    ' + it.qty + ' x A consultar');
        }
        if (it.options && it.options.length) {
          L.push('    ' + it.options.map(function (o) { return o.label + ': ' + o.value; }).join(' · '));
        }
        if (it.duration || it.modality) L.push('    ' + [it.duration, it.modality].filter(Boolean).join(' · '));
        if (it.appointment && it.appointment.date) L.push('    Cita: ' + it.appointment.date + ' a las ' + it.appointment.time);
        if (it.appointment && it.appointment.notes) L.push('    Detalles: ' + it.appointment.notes);
        if (it.appointment && it.appointment.address) L.push('    Dirección: ' + it.appointment.address);
      });
      L.push(line);
      L.push('*RESUMEN*');
      if (Number(order.fee) > 0) L.push('Subtotal: ' + CWU.money(order.subtotal, cur));
      if (Number(order.fee) > 0) L.push('Entrega: +' + CWU.money(order.fee, cur));
      L.push('TOTAL: *' + CWU.money(order.total, cur) + '*');
      if ((biz.delivery && biz.delivery !== 'whatsapp') || biz.delivery_notes || biz.delivery_time) {
        L.push(line);
        L.push('*ENTREGA*');
        if (biz.delivery_time) L.push('Plazo: ' + biz.delivery_time);
        if (biz.delivery_notes) L.push(biz.delivery_notes);
      }
      var pays = biz.payments || [];
      if (pays.length) {
        L.push(line);
        L.push('*FORMA DE PAGO*');
        L.push(pays.join(', '));
      }
      L.push(line);
      L.push('Creado con Arij Color');
      return L.join('\n');
    },

    waLink: function (phone, text) {
      var p = String(phone || '').replace(/[^\d]/g, '');
      return 'https://wa.me/' + p + '?text=' + encodeURIComponent(text || '');
    },

    // Huecos horarios según horario del negocio
    timeSlots: function (biz, dateStr) {
      var slots = [];
      if (!dateStr) return slots;
      var d = new Date(dateStr + 'T00:00:00');
      var day = d.getDay();
      var work = biz.work_days || [1, 2, 3, 4, 5, 6];
      if (work.indexOf(day) === -1) return slots;
      function toMin(t) { var p = String(t || '09:00').split(':'); return (+p[0]) * 60 + (+p[1] || 0); }
      var open = toMin(biz.open_time), close = toMin(biz.close_time), step = biz.slot_minutes || 30;
      for (var m = open; m + step <= close; m += step) {
        var h = Math.floor(m / 60), mi = m % 60;
        slots.push(('0' + h).slice(-2) + ':' + ('0' + mi).slice(-2));
      }
      return slots;
    },

    // ---- Sesión --------------------------------------------------------
    guard: function (redirect) {
      return CW.store.init().then(function () {
        return CW.store.getSession();
      }).then(function (sess) {
        if (!sess || !sess.user) {
          location.replace(CW.url('login.html'));
          return Promise.reject(new Error('NO_SESSION'));
        }
        CW.session = sess;
        return sess;
      });
    },

    // ---- Catálogo de demostración ---------------------------------------
    // Datos por defecto de `catalogo.html?b=demo`. Se pueden editar desde
    // Administración → Demo; lo guardado se superpone a estos valores.
    demoCatalog: function () {
      return {
        biz: {
          id: 'demo', name: 'Marmol', slug: 'demo',
          description: 'Piedra natural para cocinas y baños, con entrega a domicilio.',
          whatsapp: '212600112233', country: 'MA', currency: 'MAD', brand_color: '#5B1A80',
          logo_url: '', hero_enabled: true, hero_title: 'Todo para tu hogar',
          hero_desc: 'Productos y servicios seleccionados para ti.', hero_image: '',
          delivery: 'custom', delivery_fee: 25, delivery_time: '24-48 h',
          payments: ['Efectivo', 'Transferencia bancaria'],
          open_time: '09:00', close_time: '18:00', slot_minutes: 30,
          work_days: [1, 2, 3, 4, 5, 6], published: true
        },
        cats: [
          { id: 'c1', name: 'Ropa', slug: 'ropa', kind: 'product', sort_order: 1, active: true },
          { id: 'c2', name: 'Abarrotes', slug: 'abarrotes', kind: 'product', sort_order: 2, active: true },
          { id: 'c3', name: 'Cortes', slug: 'cortes', kind: 'service', sort_order: 3, active: true },
          { id: 'c4', name: 'Reparaciones', slug: 'reparaciones', kind: 'service', sort_order: 4, active: true }
        ],
        products: [
          { id: 'p1', category_id: 'c1', name: 'Camiseta', description: 'Camiseta 100% algodón peinado. Disponible en varias tallas.', short_desc: 'Algodón peinado, varias tallas', price: 100, promo_price: 60, images: ['assets/demo/camiseta.svg'], kind: 'product', active: true, sort_order: 1 },
          { id: 'p2', category_id: 'c2', name: 'Arroz extra 5 kg', description: 'Arroz de grano largo, ideal para el día a día.', short_desc: 'Grano largo, saco de 5 kg', price: 45, images: ['assets/demo/arroz.svg'], kind: 'product', active: true, sort_order: 2 },
          { id: 'p3', category_id: 'c3', name: 'Corte de pelo', description: 'Corte clásico con lavado y peinado.', price: 0, images: ['assets/demo/corte.svg'], kind: 'service', duration: '45 minutos', modality: 'En el local', bookable: true, active: true, sort_order: 3 },
          { id: 'p4', category_id: 'c4', name: 'Reparación de electrodoméstico', description: 'Diagnóstico y reparación a domicilio.', price: 150, images: ['assets/demo/reparacion.svg'], kind: 'service', duration: '2 horas', modality: 'A domicilio', bookable: false, active: true, sort_order: 4 }
        ],
        portfolio: [
          { id: 'w1', title: 'Encimera de cocina', description: 'Mármol blanco pulido con canto recto y fregadero integrado.', details: 'Material: mármol blanco\nMedidas: 3,2 m\nAcabado: pulido', image_url: 'assets/demo/camiseta.svg', sort_order: 1, active: true },
          { id: 'w2', title: 'Baño completo', description: 'Revestimiento y lavabo a medida en piedra natural.', details: 'Lavabo a medida\nRevestimiento completo', image_url: 'assets/demo/arroz.svg', sort_order: 2, active: true },
          { id: 'w3', title: 'Escaleras', description: 'Peldaños macizos con acabado antideslizante.', details: 'Peldaño macizo\nAntideslizante', image_url: 'assets/demo/corte.svg', sort_order: 3, active: true },
          { id: 'w4', title: 'Restauración', description: 'Recuperación de una mesa antigua de mármol.', details: 'Mesa restaurada\nPulido fino', image_url: 'assets/demo/reparacion.svg', sort_order: 4, active: true }
        ]
      };
    },

    // Mezcla lo guardado en site_settings.demo_catalog con los valores por
    // defecto (lo guardado manda; lo que falte se rellena con el original).
    demoCatalogMerged: function (saved) {
      var base = CWU.demoCatalog();
      if (!saved || typeof saved !== 'object') return base;
      var out = {
        biz: Object.assign({}, base.biz, saved.biz || {}),
        cats: Array.isArray(saved.cats) ? saved.cats : base.cats,
        products: Array.isArray(saved.products) ? saved.products : base.products,
        portfolio: Array.isArray(saved.portfolio) ? saved.portfolio : base.portfolio
      };
      return out;
    },

    // ---- Contenido traducible -------------------------------------------
    // Texto de un contenido del usuario (negocio, categoría, artículo,
    // trabajo del porfolio) en el idioma activo. Si no hay traducción, cae
    // al idioma base, que es el que se escribe en el panel.
    tx: function (row, field) {
      if (!row) return '';
      var lang = (CW.i18n && CW.i18n.lang) || 'es';
      var pack = row.i18n && row.i18n[lang];
      var v = pack && pack[field];
      if (v != null && String(v).trim() !== '') return v;
      return row[field] != null ? row[field] : '';
    },

    // ---- UI: toast -----------------------------------------------------
    toast: function (msg, type) {
      var t = CWU.el('div', { class: 'cw-toast ' + (type || '') }, CWU.esc(msg));
      document.body.appendChild(t);
      requestAnimationFrame(function () { t.classList.add('show'); });
      setTimeout(function () { t.classList.remove('show'); setTimeout(function () { t.remove(); }, 250); }, 2600);
    },

    // ---- UI: modal -----------------------------------------------------
    modal: function (opts) {
      var overlay = CWU.el('div', { class: 'cw-modal-overlay' });
      var modal = CWU.el('div', { class: 'cw-modal ' + (opts.className || '') });
      modal.innerHTML =
        '<div class="cw-modal-head"><h3>' + CWU.esc(opts.title || '') + '</h3>' +
        '<button class="icon-btn" data-close aria-label="Cerrar">✕</button></div>' +
        '<div class="cw-modal-body">' + (opts.html || '') + '</div>' +
        (opts.footer ? '<div class="cw-modal-foot">' + opts.footer + '</div>' : '');
      overlay.appendChild(modal);
      document.body.appendChild(overlay);
      requestAnimationFrame(function () { overlay.classList.add('show'); });
      function close() {
        overlay.classList.remove('show');
        setTimeout(function () { overlay.remove(); }, 200);
        document.removeEventListener('keydown', onKey);
        if (opts.onClose) opts.onClose();
      }
      function onKey(e) { if (e.key === 'Escape') close(); }
      overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });
      CWU.qsa('[data-close]', modal).forEach(function (b) { b.addEventListener('click', close); });
      document.addEventListener('keydown', onKey);
      return { overlay: overlay, modal: modal, close: close };
    },

    confirm: function (msg, onYes, danger) {
      var m = CWU.modal({
        title: CWU.t('common.confirm'),
        html: '<p>' + CWU.esc(msg) + '</p>',
        footer: '<button class="btn ghost" data-no>' + CWU.esc(CWU.t('common.cancel')) + '</button>' +
          '<button class="btn ' + (danger ? 'danger' : 'primary') + '" data-yes>' + CWU.esc(CWU.t('common.confirm')) + '</button>'
      });
      CWU.qs('[data-no]', m.modal).addEventListener('click', m.close);
      CWU.qs('[data-yes]', m.modal).addEventListener('click', function () { m.close(); onYes(); });
    },

    t: function (k, v) { return CW.i18n.t(k, v); },

    // ---- Cabecera pública con selector de idioma -----------------------
    mountLangSwitchers: function () {
      CWU.qsa('[data-lang-switch]').forEach(function (el) { CW.i18n.langSwitcher(el); });
    },

    // ---- PWA -----------------------------------------------------------
    // Instalación de la app del catálogo: aviso en móvil, botón «Instalar» y
    // ayuda paso a paso en iPhone/iPad (Safari no muestra el aviso del sistema).
    initPWA: function () {
      if ('serviceWorker' in navigator) {
        window.addEventListener('load', function () {
          navigator.serviceWorker.register(CW.url('/sw.js')).catch(function () {});
        });
      }

      var banner = CWU.qs('[data-pwa-banner]');
      var deferred = null;
      var ua = navigator.userAgent || '';
      var isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
      var isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(ua) || window.matchMedia('(max-width: 900px)').matches;
      var installed = ['standalone', 'fullscreen', 'minimal-ui'].some(function (m) {
        try { return window.matchMedia('(display-mode: ' + m + ')').matches; } catch (e) { return false; }
      }) || window.navigator.standalone === true;

      function dismissed() { try { return !!localStorage.getItem('cw_pwa_dismissed'); } catch (e) { return false; } }
      function dismiss() { try { localStorage.setItem('cw_pwa_dismissed', '1'); } catch (e) {} }
      function hide() { if (banner) banner.classList.remove('show'); }
      function show() { if (banner && isMobile && !installed && !dismissed()) banner.classList.add('show'); }

      function help() {
        var steps = isIOS
          ? ['1. ' + CW.t('pwa.ios.1'), '2. ' + CW.t('pwa.ios.2'), '3. ' + CW.t('pwa.ios.3')]
          : ['1. ' + CW.t('pwa.and.1'), '2. ' + CW.t('pwa.and.2'), '3. ' + CW.t('pwa.and.3')];
        CWU.modal({
          className: 'pwa-help-modal',
          title: CW.t('pwa.help.title'),
          html: '<p class="muted">' + CW.t('pwa.help.sub') + '</p><ol class="pwa-steps">' +
            steps.map(function (s) { return '<li>' + CWU.esc(s.replace(/^\d+\.\s*/, '')) + '</li>'; }).join('') + '</ol>'
        });
      }

      window.addEventListener('beforeinstallprompt', function (e) {
        e.preventDefault(); deferred = e; show();
      });
      window.addEventListener('appinstalled', function () { deferred = null; dismiss(); hide(); });

      function launch() {
        if (deferred && deferred.prompt) {
          deferred.prompt();
          if (deferred.userChoice && deferred.userChoice.then) {
            deferred.userChoice.then(function () { deferred = null; hide(); });
          } else { deferred = null; hide(); }
        } else {
          help();
        }
      }

      // Accesible desde cualquier botón «Instalar app».
      CW.pwa = { install: launch, help: help, show: show };

      if (banner) {
        var btn = CWU.qs('[data-pwa-install]', banner);
        var no = CWU.qs('[data-pwa-dismiss]', banner);
        if (btn) btn.addEventListener('click', launch);
        if (no) no.addEventListener('click', function () { dismiss(); hide(); });
      }
      CWU.qsa('[data-pwa-open]').forEach(function (b) {
        b.addEventListener('click', function () { hide(); launch(); });
      });

      // Android/Chrome puede tardar en ofrecer el aviso; en iOS nunca llega.
      setTimeout(show, 2500);
    },

    // ---- Varios --------------------------------------------------------
    download: function (filename, content, mime) {
      var blob = new Blob([content], { type: mime || 'text/plain;charset=utf-8' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = filename;
      document.body.appendChild(a); a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    },

    toCSV: function (rows) {
      return rows.map(function (r) {
        return r.map(function (c) {
          var s = String(c == null ? '' : c);
          return /[",;\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
        }).join(';');
      }).join('\r\n');
    },

    copy: function (text) {
      if (navigator.clipboard) return navigator.clipboard.writeText(text).then(function () { CWU.toast(CWU.t('common.copied')); });
      var ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta);
      ta.select(); document.execCommand('copy'); ta.remove(); CWU.toast(CWU.t('common.copied'));
    },

    countryOptions: function (selected) {
      return Object.keys(COUNTRY_CODES).map(function (c) {
        return '<option value="' + c + '"' + (c === selected ? ' selected' : '') + '>' +
          COUNTRY_CODES[c].name + ' (' + COUNTRY_CODES[c].dial + ')</option>';
      }).join('');
    }
  };

  // Códigos de país (reducido y ampliable)
  var COUNTRY_CODES = {
    MA: { name: 'Marruecos', code: '212', dial: '+212', flag: '🇲🇦' },
    ES: { name: 'España', code: '34', dial: '+34', flag: '🇪🇸' },
    FR: { name: 'Francia', code: '33', dial: '+33', flag: '🇫🇷' },
    DZ: { name: 'Argelia', code: '213', dial: '+213', flag: '🇩🇿' },
    TN: { name: 'Túnez', code: '216', dial: '+216', flag: '🇹🇳' },
    EG: { name: 'Egipto', code: '20', dial: '+20', flag: '🇪🇬' },
    SA: { name: 'Arabia Saudí', code: '966', dial: '+966', flag: '🇸🇦' },
    AE: { name: 'Emiratos Árabes', code: '971', dial: '+971', flag: '🇦🇪' },
    SN: { name: 'Senegal', code: '221', dial: '+221', flag: '🇸🇳' },
    CI: { name: 'Costa de Marfil', code: '225', dial: '+225', flag: '🇨🇮' },
    US: { name: 'Estados Unidos', code: '1', dial: '+1', flag: '🇺🇸' },
    GB: { name: 'Reino Unido', code: '44', dial: '+44', flag: '🇬🇧' },
    DE: { name: 'Alemania', code: '49', dial: '+49', flag: '🇩🇪' },
    IT: { name: 'Italia', code: '39', dial: '+39', flag: '🇮🇹' },
    BE: { name: 'Bélgica', code: '32', dial: '+32', flag: '🇧🇪' },
    NL: { name: 'Países Bajos', code: '31', dial: '+31', flag: '🇳🇱' }
  };
  CWU.COUNTRY_CODES = COUNTRY_CODES;

  CWU.currencyList = [
    { code: 'MAD', label: 'dirham marroquí (MAD)' },
    { code: 'EUR', label: 'euro (EUR)' },
    { code: 'USD', label: 'dólar (USD)' },
    { code: 'DZD', label: 'dinar argelino (DZD)' },
    { code: 'TND', label: 'dinar tunecino (TND)' },
    { code: 'EGP', label: 'libra egipcia (EGP)' },
    { code: 'SAR', label: 'rial saudí (SAR)' },
    { code: 'AED', label: 'dirham de EAU (AED)' },
    { code: 'XOF', label: 'franco CFA (XOF)' }
  ];

  // Alias cómodo
  CW.$ = CWU.qs;
  CW.$$ = CWU.qsa;
  CW.esc = CWU.esc;
  CW.el = CWU.el;
  CW.money = CWU.money;
  CW.toast = CWU.toast;
  CW.tx = CWU.tx;
  CW.demoCatalog = CWU.demoCatalog;
  CW.demoCatalogMerged = CWU.demoCatalogMerged;
  CW.sections = mergeSections;

  CW.modal = CWU.modal;
  CW.confirm = CWU.confirm;
  CW.t = CWU.t;
  CW.api = CWU; // acceso completo
  CW.COUNTRY_CODES = COUNTRY_CODES;

  // Contenido por defecto de las secciones del catálogo. Se puede cambiar desde el panel
  // (Ajustes → Contenido del catálogo) y se guarda en businesses.sections.
  var SECTION_DEFAULTS = {
    quality: {
      enabled: true,
      kicker: 'QUALITÉ ET CONFIANCE',
      title: 'Des solutions pour chaque projet',
      sub: 'Des produits pour les particuliers, peintres professionnels, distributeurs et entreprises.',
      items: [
        { icon: '🏠', title: 'Décoration', text: 'Peintures pour rénover intérieurs et extérieurs.', image: '', details: '' },
        { icon: '🛡️', title: 'Protection', text: 'Solutions contre l’humidité et pour les surfaces.', image: '', details: '' },
        { icon: '💼', title: 'Professionnel', text: 'Des outils pour les travaux exigeants.', image: '', details: '' },
        { icon: '🎨', title: 'Couleur', text: 'Une gamme de couleurs pour chaque espace.', image: '', details: '' }
      ]
    },
    equipment: {
      enabled: true,
      kicker: 'ÉQUIPEMENT',
      title: 'Accessoires de peinture',
      sub: 'Tout le nécessaire pour préparer, appliquer et finir chaque travail.',
      items: [
        { icon: '🖌️', title: 'Brosses professionnelles', sub: 'ARIJ COLOR TOOLS', text: 'Brosses et pinceaux pour les angles, les finitions et les retouches.', image: 'assets/img/equip/brosses.jpg', details: '' },
        { icon: '🧹', title: 'Rouleaux et manchons', sub: 'ARIJ COLOR TOOLS', text: 'Manchons de différentes fibres pour murs et plafonds, selon le rendu souhaité.', image: 'assets/img/equip/rouleaux.jpg', details: '' },
        { icon: '🔺', title: 'Spatules et taloches', sub: 'ARIJ COLOR TOOLS', text: 'Pour reboucher, lisser et préparer les surfaces avant la peinture.', image: 'assets/img/equip/spatules.jpg', details: '' },
        { icon: '⬜', title: 'Abrasifs et papiers', sub: 'ARIJ COLOR TOOLS', text: 'Papiers et abrasifs pour poncer et obtenir une surface régulière.', image: 'assets/img/equip/abrasifs.jpg', details: '' },
        { icon: '🎗️', title: 'Rubans de masquage', sub: 'ARIJ COLOR TOOLS', text: 'Rubans qui protègent les plinthes, vitres et contours pendant les travaux.', image: 'assets/img/equip/rubans.jpg', details: '' },
        { icon: '🪣', title: 'Seaux et bacs', sub: 'ARIJ COLOR TOOLS', text: 'Seaux, bacs et grilles pour préparer, mélanger et charger les outils.', image: 'assets/img/equip/seaux.jpg', details: '' },
        { icon: '🛡️', title: 'Bâches de protection', sub: 'ARIJ COLOR TOOLS', text: 'Bâches et films pour protéger le sol et le mobilier.', image: 'assets/img/equip/baches.jpg', details: '' },
        { icon: '⚙️', title: 'Pistolets et machines', sub: 'ARIJ COLOR TOOLS', text: 'Pistolets et machines pour les grandes surfaces et les finitions régulières.', image: 'assets/img/equip/pistolets.jpg', details: '' }
      ]
    },
    reviews: {
      // Vacío = se usa el texto traducido de i18n (rev.kicker/title/sub).
      enabled: true,
      kicker: '',
      title: '',
      sub: '',
      items: [
        { name: 'Salma B.', city: 'Casablanca', stars: 5, text: '' },
        { name: 'Youssef K.', city: 'Rabat', stars: 5, text: '' },
        { name: 'Nadia E.', city: 'Casablanca', stars: 5, text: '' }
      ]
    },
    team: {
      enabled: true,
      kicker: 'ÉQUIPE',
      title: 'Nos professionnels',
      sub: 'Une équipe qualifiée pour vous conseiller et réaliser vos travaux.'
    }
  };

  // Mezcla lo guardado en el panel con los valores por defecto (los campos
  // que falten usan el original).
  function mergeSections(biz) {
    var saved = (biz && biz.sections) || {};
    function merge(key) {
      var def = SECTION_DEFAULTS[key];
      var cur = saved[key] || {};
      var out = {};
      Object.keys(def).forEach(function (k) { out[k] = (cur[k] === undefined || cur[k] === null) ? def[k] : cur[k]; });
      out.items = (def.items || []).map(function (item, i) {
        var got = (cur.items && cur.items[i]) || {};
        var merged = {};
        Object.keys(item).forEach(function (k) { merged[k] = got[k] === undefined ? item[k] : got[k]; });
        return merged;
      });
      return out;
    }
    return { quality: merge('quality'), equipment: merge('equipment'), reviews: merge('reviews'), team: merge('team') };
  }

  // Aplica i18n al cargar y en cada cambio de idioma.
  document.addEventListener('DOMContentLoaded', function () {
    if (CW._domReady) return; // evita doble inicializacion
    CW._domReady = true;
    CW.i18n.apply();
    CWU.mountLangSwitchers();
    CWU.initPWA();
    // Botón de idioma de cabecera (alterna entre los 3)
    CWU.qsa('[data-lang-toggle]').forEach(function (b) {
      b.addEventListener('click', function () {
        var langs = cfg.languages, i = langs.indexOf(CW.i18n.lang);
        CW.i18n.setLang(langs[(i + 1) % langs.length]);
        b.textContent = CWU.t('common.lang') + ': ' + CW.i18n.lang.toUpperCase();
      });
    });
    // Botón flotante de WhatsApp (soporte del producto).
    var waf = document.querySelector('.wa-float');
    if (waf) {
      if (cfg.supportWhatsapp) waf.href = 'https://wa.me/' + String(cfg.supportWhatsapp).replace(/\D/g, '');
      else waf.hidden = true;
    }

    // Imágenes configurables de la home (Administración → Apariencia)
    var hiEls = document.querySelectorAll('[data-home-img]');
    if (hiEls.length && CW.store && CW.store.getSiteSettings) {
      CW.store.init().then(function () { return CW.store.getSiteSettings(); }).then(function (s) {
        var imgs = (s && s.home_images) || {};
        hiEls.forEach(function (el) {
          var u = imgs[el.getAttribute('data-home-img')];
          if (!u) return;
          el.style.backgroundImage = 'url("' + u + '")';
          el.classList.add('has');
        });
      }).catch(function () {});
    }

    // Menú móvil de la home
    var burger = document.querySelector('[data-lp-burger]');
    var lpMenu = document.querySelector('[data-lp-menu]');
    if (burger && lpMenu) {
      function closeMenu() { lpMenu.hidden = true; burger.setAttribute('aria-expanded', 'false'); burger.textContent = '☰'; }
      burger.addEventListener('click', function (e) {
        e.stopPropagation();
        var willOpen = lpMenu.hidden;
        lpMenu.hidden = !willOpen;
        burger.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
        burger.textContent = willOpen ? '✕' : '☰';
      });
      lpMenu.querySelectorAll('a').forEach(function (a) { a.addEventListener('click', closeMenu); });
      document.addEventListener('click', function (e) { if (!lpMenu.hidden && !lpMenu.contains(e.target)) closeMenu(); });
      document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !lpMenu.hidden) closeMenu(); });
    }
  });
})(window, document);

/* ==== Enlace de "Laisser mon avis" / "Dejar mi opinión" ==== */
(function () {
  var REVIEW_URL = 'https://g.page/r/PEGA_AQUI_TU_CODIGO/review'; /* ← ÚNICA LÍNEA QUE EDITAS: tu enlace real de reseñas */
  if (/PEGA_AQUI/.test(REVIEW_URL)) return; /* no toca nada hasta que pongas tu enlace */

  var LABEL = /laisser mon avis|donner mon avis|dejar mi opini|deja tu (rese|opini)|leave a review|أضف تقييم|اترك رأي/i;
  var HREF = /writereview|g\.page\/|google\.[a-z.]+\/maps.*review|placeid=/i;

  function fix(el) {
    if (!el || el.nodeType !== 1 || el.dataset.reviewFixed) return;
    var isLink = el.tagName === 'A';
    var txt = (el.textContent || '').trim();
    var href = isLink ? (el.getAttribute('href') || '') : '';
    if (!LABEL.test(txt) && !(isLink && HREF.test(href))) return;
    if (isLink) {
      el.dataset.reviewFixed = '1';
      el.href = REVIEW_URL;
      el.target = '_blank';
      el.rel = 'noopener noreferrer';
    } else {
      var a = document.createElement('a');
      a.className = el.className;
      a.innerHTML = el.innerHTML;
      a.style.cssText = el.style.cssText;
      a.href = REVIEW_URL;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.dataset.reviewFixed = '1';
      el.replaceWith(a); /* mismo aspecto, ahora es un enlace real */
    }
  }

  function scan() { document.querySelectorAll('a,button').forEach(fix); }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', scan);
  scan();
  window.addEventListener('load', scan);
  setTimeout(scan, 800);
  setTimeout(scan, 2500);
  if ('MutationObserver' in window) {
    new MutationObserver(function (muts) {
      for (var i = 0; i < muts.length; i++) {
        var added = muts[i].addedNodes;
        for (var j = 0; j < added.length; j++) {
          var n = added[j];
          if (n.nodeType !== 1) continue;
          if (n.matches && n.matches('a,button')) fix(n);
          if (n.querySelectorAll) n.querySelectorAll('a,button').forEach(fix);
        }
      }
    }).observe(document.body, { childList: true, subtree: true });
  }
})();
