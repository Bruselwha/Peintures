/* ==========================================================================
   Arij Color · catalog.js
   Catálogo público: filtros, tarjetas, ficha, carrito y pedido por WhatsApp.
   ========================================================================== */
(function (window, document) {
  'use strict';
  var CW = window.CW;
  var $ = CW.$, $$ = CW.$$, esc = CW.esc, money = CW.money;
  var t = function (k, v) { return CW.i18n.t(k, v); };

  var S = {
    biz: null, cats: [], products: [], portfolio: [], team: [],
    filterType: 'all', filterCat: '', q: '',
    cart: [] // {id, name, price, qty, kind, image}
  };

  function param(k) { return new URLSearchParams(location.search).get(k); }

  // Datos de contacto del negocio (los que se muestran en la sección de
  // contacto y en la ayuda del asistente).
  var CONTACT = {
    tel: '+212670964030',
    telText: '+212 670 964 030',
    wa: '212670964030',
    mail: 'contact@arijcolor.com',
    address: 'Casablanca, Marruecos'
  };



  // ---- Datos ----------------------------------------------------------
  // El catálogo de ejemplo (`?b=demo`) se puede editar desde el panel:
  // Administración → Demo. Si no hay nada guardado, usa los valores base.
  function demoData(cb) {
    CW.store.getSiteSettings().then(function (settings) {
      cb(CW.demoCatalogMerged(settings && settings.demo_catalog));
    }).catch(function () { cb(CW.demoCatalogMerged(null)); });
  }

  function load() {
    var slug = param('b') || param('biz');
    return CW.store.init().then(function () {
      if (!slug) return null;
      if (slug === 'demo') {
        // Si existe un negocio real "demo", úsalo; si no, datos de ejemplo.
        return CW.store.getBusinessBySlug('demo').then(function (b) { return b || null; });
      }
      return CW.store.getBusinessBySlug(slug);
    }).then(function (biz) {
      if (!biz && slug === 'demo') {
        return new Promise(function (resolve) {
          demoData(function (d) {
            S.biz = d.biz; S.cats = d.cats; S.products = d.products; S.portfolio = d.portfolio || [];
            resolve();
          });
        });
      }
      if (!biz || (!biz.published && !CW.isDemo)) { S.biz = null; return; }
      S.biz = biz;
      return Promise.all([
        CW.store.listCategories(biz.id),
        CW.store.listProducts(biz.id, { activeOnly: true }),
        CW.store.listPortfolio(biz.id, { activeOnly: true }).catch(function () { return []; }),
        (CW.store.listProfessionals ? CW.store.listProfessionals(biz.id, { activeOnly: true }) : Promise.resolve([])).catch(function () { return []; })
      ]).then(function (r) {
        S.cats = r[0]; S.products = r[1];
        S.portfolio = (r[2] || []).filter(function (i) { return i.active !== false; });
        S.team = (r[3] || []).filter(function (p) { return p.active !== false; });
      });
    });
  }

  // ---- Render principal ----------------------------------------------
  function render() {
    var root = $('[data-catalog-root]');
    if (!S.biz) {
      root.innerHTML = '<div class="wrap empty-state big"><div class="es-icon">🔍</div><b>' + t('cat.public.notfound') + '</b><p>' + t('cat.public.notfound.desc') + '</p><a class="btn primary" href="' + CW.url('index.html') + '">Arij Color</a></div>';
      return;
    }
    var b = S.biz;
    document.title = (CW.tx(b, 'seo_title') || CW.tx(b, 'name')) + ' · Arij Color';
    document.querySelector('meta[name=description]').setAttribute('content', CW.tx(b, 'seo_description') || CW.tx(b, 'description') || '');
    document.documentElement.style.setProperty('--brand', b.brand_color || '#5B1A80');
    document.documentElement.style.setProperty('--brand-soft', hexSoft(b.brand_color || '#5B1A80'));

    // Cabecera
    var brand = $('[data-cat-brand]');
    // El logo lleva al catálogo publicado del negocio.
    if (brand && brand.tagName === 'A') {
      brand.href = CW.absUrl('catalogo.html') + '?b=' + encodeURIComponent(b.slug || '');
    }
    brand.innerHTML =
      (b.logo_url ? '<img src="' + esc(b.logo_url) + '" alt="" class="cat-logo">' : '<span class="cat-logo ph" style="background:' + esc(b.brand_color) + '">' + esc((CW.tx(b, 'name') || 'M').charAt(0)) + '</span>') +
      '<div><b>' + brandNameHTML(b) + '</b>' + (CW.tx(b, 'description') ? '<small>' + esc(CW.tx(b, 'description')) + '</small>' : '') + '</div>';

    // Enlace al porfolio: solo si el negocio ha publicado trabajos.
    $$('[data-wa-header]').forEach(function (wa) {
      if (b.whatsapp) {
        wa.hidden = false;
        wa.href = CW.api.waLink(b.whatsapp, 'Hola ' + CW.tx(b, 'name') + ', quiero hacer un pedido.');
      } else {
        wa.hidden = true;
      }
    });

    $$('[data-pf-link]').forEach(function (pf) {
      if (S.portfolio.length) {
        pf.hidden = false;
        pf.href = CW.url('porfolio.html') + '?b=' + encodeURIComponent(b.slug || '');
        pf.textContent = t('port.link');
      } else {
        pf.hidden = true;
      }
    });

    // Hero
    var hero = '';
    if (b.hero_enabled) {
      hero = '<section class="cat-hero" style="' + (b.hero_image ? 'background-image:linear-gradient(rgba(0,0,0,.45),rgba(0,0,0,.45)),url(' + esc(b.hero_image) + ')' : '') + '">' +
        '<div class="wrap"><h1>' + esc(CW.tx(b, 'hero_title') || CW.tx(b, 'name')) + '</h1>' +
        (CW.tx(b, 'hero_desc') ? '<p>' + esc(CW.tx(b, 'hero_desc')) + '</p>' : '') + '</div></section>';
    }

    // Info entrega / pagos
    var info = '';
    var dvModes = (b.delivery && b.delivery !== 'whatsapp') ? String(b.delivery).split(',') : [];
    var hasDelivery = dvModes.length > 0 || b.delivery_time || b.delivery_notes || Number(b.delivery_fee) > 0;
    var hasPays = (b.payments || []).length;
    if (hasDelivery || hasPays) {
      info = '<section class="cat-info"><div class="wrap cat-info-grid">' +
        (hasDelivery ? '<div class="info-card"><span>🚚</span><div><b>' + t('cat.public.delivery') + '</b>' +
          '<small>' + (dvModes.length ? dvModes.map(function (m) { return m === 'pickup' ? t('cat.public.pickup') : t('cat.public.deliveryMode'); }).join(' · ') + ' · ' : '') +
          (Number(b.delivery_fee) > 0 ? t('cat.public.fee') + ': ' + money(b.delivery_fee, b.currency) : '') +
          (b.delivery_time ? ' · ' + esc(b.delivery_time) : '') + (b.delivery_notes ? ' · ' + esc(b.delivery_notes) : '') + '</small></div></div>' : '') +
        (hasPays ? '<div class="info-card"><span>💳</span><div><b>' + t('cat.public.payment') + '</b><small>' + esc((b.payments || []).join(', ')) + '</small></div></div>' : '') +
        '</div></section>';
    }

    // El menú (categorías + buscador) vive en la cabecera, entre el logo y las
    // banderas de idioma. En móvil se despliega desde la hamburguesa.
    var menu = $('[data-cat-menu]');
    if (menu) menu.innerHTML = renderFilters();

    root.innerHTML = hero + info +
      '<section class="wrap cat-grid" id="categorias" data-grid></section>' +
      teamHTML() +
      qualityHTML() +
      equipmentHTML() +
      reviewsHTML() +
      contactHTML() +
      '<footer class="cat-footer"><div class="wrap"><div>' + esc(CW.tx(b, 'name')) + ' · Arij Color</div>' +
        '<nav class="cat-policies">' +
          (S.portfolio.length ? '<a href="' + esc(CW.url('porfolio.html') + '?b=' + encodeURIComponent(b.slug || '')) + '">' + t('port.link') + '</a>' : '') +
          ['legal', 'privacy', 'cookies', 'terms', 'returns', 'shipping'].map(function (k) {
            return '<a href="#" data-policy="' + k + '">' + t('pol.' + k) + '</a>';
          }).join('') +
        '</nav></div></footer>';

    bindFilters();
    bindSections();
    drawGrid();
    updateCartUI();
  }

  // Abre los pop-ups de Calidad, Equipamiento y Equipo.
  function bindSections() {
    $$('[data-sq]').forEach(function (b) {
      b.addEventListener('click', function () { openSectionItem(b.dataset.sq, Number(b.dataset.i)); });
    });
    $$('[data-pro]').forEach(function (b) {
      b.addEventListener('click', function () { openPro(S.team[Number(b.dataset.pro)]); });
    });
  }

  // ---- Secciones editables: Calidad, Equipamiento y Equipo -------------
  function blockHead(sec) {
    return '<div class="cat-block-head">' +
      (sec.kicker ? '<span class="cat-block-kicker">' + esc(sec.kicker) + '</span>' : '') +
      '<h2>' + esc(sec.title) + '</h2>' +
      (sec.sub ? '<p>' + esc(sec.sub) + '</p>' : '') +
    '</div>';
  }

  function qualityHTML() {
    var sec = CW.sections(S.biz).quality;
    if (!sec || sec.enabled === false) return '';
    var cards = sec.items.map(function (it, i) {
      return '<button type="button" class="sq-card sq-card--q" data-sq="quality" data-i="' + i + '">' +
        '<span class="sq-icon" aria-hidden="true">' + esc(it.icon || '•') + '</span>' +
        '<b class="sq-title">' + esc(it.title) + '</b>' +
        '<span class="sq-text">' + esc(it.text || '') + '</span>' +
      '</button>';
    }).join('');
    return '<section class="cat-block" id="qualite"><div class="wrap">' + blockHead(sec) +
      '<div class="sq-grid sq-grid--q">' + cards + '</div></div></section>';
  }

  function equipmentHTML() {
    var sec = CW.sections(S.biz).equipment;
    if (!sec || sec.enabled === false) return '';
    var cards = sec.items.map(function (it, i) {
      return '<button type="button" class="sq-card sq-card--eq" data-sq="equipment" data-i="' + i + '">' +
        '<span class="sq-thumb" aria-hidden="true">' + (it.image ? '<img src="' + esc(it.image) + '" alt="">' : esc(it.icon || '•')) + '</span>' +
        '<span class="sq-body"><b>' + esc(it.title) + '</b>' +
          (it.sub ? '<small>' + esc(it.sub) + '</small>' : '') +
        '</span>' +
        '<span class="sq-arrow" aria-hidden="true">›</span>' +
      '</button>';
    }).join('');
    return '<section class="cat-block cat-block--soft" id="equipement"><div class="wrap">' + blockHead(sec) +
      '<div class="sq-grid sq-grid--eq">' + cards + '</div></div></section>';
  }

  function teamHTML() {
    var sec = CW.sections(S.biz).team;
    if (!sec || sec.enabled === false) return '';
    var wa = 'https://wa.me/' + ((CW.config && String(CW.config.supportWhatsapp || '').replace(/[^\d]/g, '')) || CONTACT.wa) + '?text=' + encodeURIComponent(t('team.ctaMsg'));
    var body;
    if (!S.team.length) {
      body = '<div class="tm-empty"><p>' + t('team.empty') + '</p>' +
        '<a class="btn primary small" href="' + wa + '" target="_blank" rel="noopener">💬 ' + t('team.cta') + '</a></div>';
    } else {
      body = '<div class="tm-grid">' + S.team.map(function (p, i) {
        var rating = Number(p.rating) > 0 ? Number(p.rating) : 0;
        var stars = rating ? '<span class="tm-stars">' + new Array(Math.round(rating) + 1).join('★') +
          (p.reviews_count ? ' <small>(' + p.reviews_count + ')</small>' : '') + '</span>' : '';
        var cita = 'https://wa.me/' + proPhone(p) + '?text=' + encodeURIComponent(t('team.bookMsg', { name: p.name }));
        return '<article class="tm-card">' +
          '<button type="button" class="tm-card-main" data-pro="' + i + '">' +
            '<span class="tm-photo">' + (p.photo_url ? '<img src="' + esc(p.photo_url) + '" alt="">' : esc((p.name || '?').charAt(0).toUpperCase())) + '</span>' +
            '<span class="tm-body">' +
              '<b>' + esc(p.name) + '</b>' +
              (p.role ? '<small class="tm-role">' + esc(p.role) + '</small>' : '') +
              (p.city ? '<small class="tm-city">📍 ' + esc(p.city) + '</small>' : '') +
              stars +
              (Number(p.price) > 0 ? '<span class="tm-price">' + money(p.price, S.biz.currency) + (p.price_note ? ' · ' + esc(p.price_note) : '') + '</span>' : '') +
            '</span>' +
          '</button>' +
          (p.bio ? '<p class="tm-bio-line">' + esc(p.bio) + '</p>' : '') +
          '<div class="tm-card-foot">' +
            '<a class="btn primary small" href="' + cita + '" target="_blank" rel="noopener">📅 ' + t('team.book') + '</a>' +
            '<button type="button" class="btn ghost small" data-pro="' + i + '">' + t('team.card') + ' ›</button>' +
          '</div>' +
        '</article>';
      }).join('') + '</div>';
    }
    return '<section class="cat-block" id="equipo"><div class="wrap">' + blockHead(sec) + body + '</div></section>';
  }

  // Pop-up de una tarjeta de Calidad o Equipamiento.
  function openSectionItem(kind, i) {
    var sec = CW.sections(S.biz)[kind];
    var it = sec && sec.items[i]; if (!it) return;
    var text = String(it.details || it.text || '').replace(/\n/g, '<br>');
    var html = '<div class="sq-modal">' +
      (it.image
        ? '<div class="sq-modal-img"><img src="' + esc(it.image) + '" alt="' + esc(it.title) + '"></div>'
        : '<div class="sq-modal-icon" aria-hidden="true">' + esc(it.icon || '•') + '</div>') +
      (it.sub ? '<span class="sq-modal-sub">' + esc(it.sub) + '</span>' : '') +
      '<p class="sq-modal-text">' + text + '</p>' +
      '</div>';
    CW.modal({
      className: 'sq-modal-wrap',
      title: it.title,
      html: html,
      footer: '<button class="btn ghost" data-close>' + t('common.close') + '</button>'
    });
  }

  // Teléfono de un profesional (si no tiene, el del negocio/soporte).
  function proPhone(p) {
    var tel = String(p.whatsapp || p.phone || '').replace(/[^\d]/g, '');
    if (tel.length < 8) tel = String((S.biz && S.biz.whatsapp) || '').replace(/[^\d]/g, '');
    if (tel.length < 8) tel = ((CW.config && String(CW.config.supportWhatsapp || '').replace(/[^\d]/g, '')) || CONTACT.wa);
    return tel;
  }

  // Pop-up del profesional con toda su ficha.
  function openPro(p) {
    if (!p) return;
    var tel = proPhone(p);
    var cita = 'https://wa.me/' + tel + '?text=' + encodeURIComponent(t('team.bookMsg', { name: p.name }));
    var rating = Number(p.rating) > 0 ? Number(p.rating) : 0;
    var rows = [];
    if (p.city) rows.push('<li><span>📍</span><b>' + esc(p.city) + '</b></li>');
    if (Number(p.price) > 0) rows.push('<li><span>💶</span><b>' + money(p.price, S.biz.currency) + '</b>' + (p.price_note ? ' <small>' + esc(p.price_note) + '</small>' : '') + '</li>');
    if (p.phone) rows.push('<li><span>📞</span><a href="tel:' + esc(p.phone) + '">' + esc(p.phone) + '</a></li>');
    if (p.website) rows.push('<li><span>🌐</span><a href="' + esc(p.website) + '" target="_blank" rel="noopener">' + esc(p.website.replace(/^https?:\/\//, '')) + '</a></li>');

    var html = '<div class="tm-modal">' +
      '<div class="tm-modal-head">' +
        '<span class="tm-photo tm-photo--big">' + (p.photo_url ? '<img src="' + esc(p.photo_url) + '" alt="">' : esc((p.name || '?').charAt(0).toUpperCase())) + '</span>' +
        '<div><b>' + esc(p.name) + '</b>' +
          (p.role ? '<small>' + esc(p.role) + '</small>' : '') +
          (rating ? '<span class="tm-stars">' + new Array(Math.round(rating) + 1).join('★') + (p.reviews_count ? ' <small>(' + p.reviews_count + ')</small>' : '') + '</span>' : '') +
        '</div>' +
      '</div>' +
      (p.bio ? '<p class="tm-bio">' + esc(p.bio).replace(/\n/g, '<br>') + '</p>' : '') +
      (rows.length ? '<ul class="tm-rows">' + rows.join('') + '</ul>' : '') +
      '<div class="tm-modal-actions">' +
        '<a class="btn primary" href="' + cita + '" target="_blank" rel="noopener">📅 ' + t('team.book') + '</a>' +
        (p.website ? '<a class="btn ghost" href="' + esc(p.website) + '" target="_blank" rel="noopener">🌐 ' + t('team.web') + '</a>' : '') +
      '</div>' +
      '</div>';
    CW.modal({
      className: 'tm-modal-wrap',
      title: t('team.card'),
      html: html,
      footer: '<button class="btn ghost" data-close>' + t('common.close') + '</button>'
    });
  }

  // Reseñas de clientes (antes de contacto).
  function reviewsHTML() {
    var sec = CW.sections(S.biz).reviews;
    if (!sec || sec.enabled === false) return '';
    var wa = 'https://wa.me/' + CONTACT.wa + '?text=' + encodeURIComponent(t('rev.waMsg'));
    var cards = sec.items.map(function (r, i) {
      var stars = Math.max(1, Math.min(5, Number(r.stars) || 5));
      var text = r.text || t('rev.' + (i + 1) + '.text');
      return '<article class="rev-card">' +
        '<div class="rev-stars" aria-label="' + stars + '/5">' + new Array(stars + 1).join('★') + '</div>' +
        '<p>' + esc(text) + '</p>' +
        '<footer><b>' + esc(r.name || '') + '</b><span>' + esc(r.city || '') + '</span></footer>' +
      '</article>';
    }).join('');
    return '<section class="cat-reviews" id="resenas"><div class="wrap">' +
      '<div class="rev-head">' +
        '<span class="cc-kicker">' + esc(sec.kicker || t('rev.kicker')) + '</span>' +
        '<h2>' + esc(sec.title || t('rev.title')) + '</h2>' +
        '<p>' + esc(sec.sub || t('rev.sub')) + '</p>' +
      '</div>' +
      '<div class="rev-grid">' + cards + '</div>' +
      '<a class="btn ghost rev-cta" href="' + wa + '" target="_blank" rel="noopener">💬 ' + t('rev.cta') + '</a>' +
    '</div></section>';
  }

  // Sección de contacto justo encima del pie, con el color de los botones.
  function contactHTML() {
    var b = S.biz;
    var wa = 'https://wa.me/' + CONTACT.wa + '?text=' + encodeURIComponent(t('cc.waMsg'));
    var names = String(t('as.days')).split(',');
    var work = (b.work_days || [1, 2, 3, 4, 5, 6]).slice().sort();
    var days = work.map(function (i) { return names[i] || ''; }).filter(Boolean).join(', ');
    var hours = days ? days + ' · ' + (b.open_time || '') + ' – ' + (b.close_time || '') : '';

    return '<section class="cat-contact" id="contacto"><div class="wrap cc-inner">' +
      '<div class="cc-copy">' +
        '<span class="cc-kicker">' + t('cc.kicker') + '</span>' +
        '<h2>' + t('cc.title') + '</h2>' +
        '<p>' + t('cc.sub') + '</p>' +
        '<div class="cc-actions">' +
          '<a class="btn wa lg" href="' + wa + '" target="_blank" rel="noopener">💬 ' + t('cc.wa') + '</a>' +
          '<a class="btn ghost light lg" href="mailto:' + CONTACT.mail + '">✉️ ' + t('cc.mail') + '</a>' +
        '</div>' +
      '</div>' +
      '<ul class="cc-facts">' +
        '<li><i>📞</i><div><b>' + t('cc.phone') + '</b><a href="tel:' + CONTACT.tel + '">' + CONTACT.telText + '</a></div></li>' +
        '<li><i>💬</i><div><b>WhatsApp</b><a href="' + wa + '" target="_blank" rel="noopener">' + CONTACT.telText + '</a></div></li>' +
        '<li><i>✉️</i><div><b>' + t('cc.mail') + '</b><a href="mailto:' + CONTACT.mail + '">' + CONTACT.mail + '</a></div></li>' +
        '<li><i>📍</i><div><b>' + t('cc.address') + '</b><span>' + CONTACT.address + '</span></div></li>' +
        (hours ? '<li><i>🕒</i><div><b>' + t('cc.hours') + '</b><span>' + esc(hours) + '</span></div></li>' : '') +
      '</ul>' +
      '</div></section>';
  }

  // Nombre del negocio en dos colores: «Peintures» en azul y el resto
  // («Arij Color») en naranja. Para otros nombres se muestra tal cual.
  function brandNameHTML(biz) {
    var name = CW.tx(biz, 'name') || '';
    var m = name.match(/^(peintures)\s+(.+)$/i);
    if (!m) return esc(name);
    return '<span class="brand-blue">' + esc(m[1]) + '</span> <span class="brand-orange">' + esc(m[2]) + '</span>';
  }

  function hexSoft(hex) {
    try {
      var h = hex.replace('#', '');
      var r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), bl = parseInt(h.slice(4, 6), 16);
      return 'rgba(' + r + ',' + g + ',' + bl + ',0.10)';
    } catch (e) { return 'rgba(91,26,128,.1)'; }
  }

  // ---- Filtros --------------------------------------------------------
  function countInCat(catId) { return S.products.filter(function (p) { return p.category_id === catId; }).length; }

  function renderFilters() {
    // Detectamos qué tipos existen realmente en el catálogo.
    var hasP = S.products.some(function (p) { return p.kind !== 'service'; });
    var hasS = S.products.some(function (p) { return p.kind === 'service'; });
    // Si solo hay un tipo, fijamos ese tipo y ocultamos el selector.
    if (hasP && !hasS && S.filterType === 'service') S.filterType = 'product';
    if (hasS && !hasP && S.filterType === 'product') S.filterType = 'service';
    var showTypes = hasP && hasS;

    // Una sola lista de categorias, agrupada por tipo y respetando el filtro de tipo.
    // Las categorías desactivadas en el panel no aparecen en el catálogo público.
    var cats = S.cats.filter(function (c) {
      if (c.active === false) return false;
      if (S.filterType === 'product') return c.kind !== 'service';
      if (S.filterType === 'service') return c.kind === 'service';
      return true;
    });
    var prodCats = cats.filter(function (c) { return c.kind !== 'service'; });
    var servCats = cats.filter(function (c) { return c.kind === 'service'; });
    function opt(c) { return '<option value="' + c.id + '"' + (c.id === S.filterCat ? ' selected' : '') + '>' + esc(CW.tx(c, 'name')) + ' (' + countInCat(c.id) + ')</option>'; }
    var catOpts = '<option value="">' + t('cat.public.allcat') + '</option>';
    if (prodCats.length && servCats.length) {
      catOpts += '<optgroup label="' + t('cat.public.products') + '">' + prodCats.map(opt).join('') + '</optgroup>';
      catOpts += '<optgroup label="' + t('cat.public.services') + '">' + servCats.map(opt).join('') + '</optgroup>';
    } else {
      catOpts += cats.map(opt).join('');
    }
    var active = (showTypes && S.filterType !== 'all') || S.filterCat;
    return '<div class="filter-inner" data-filters>' +
      (showTypes ? '<select class="cat-type" data-ftype aria-label="' + t('prod.type') + '">' +
        '<option value="all"' + (S.filterType === 'all' ? ' selected' : '') + '>' + t('common.all') + '</option>' +
        '<option value="product"' + (S.filterType === 'product' ? ' selected' : '') + '>' + t('cat.public.products') + '</option>' +
        '<option value="service"' + (S.filterType === 'service' ? ' selected' : '') + '>' + t('cat.public.services') + '</option>' +
      '</select>' : '') +
      (cats.length ? '<select data-fcat aria-label="' + t('common.category') + '">' + catOpts + '</select>' : '') +
      (active ? '<button class="btn ghost small" data-fclear>' + t('cat.public.clear') + '</button>' : '') +
      '</div>' +
      '<div class="cat-quick">' +
        '<a class="cat-quick-btn" href="' + esc(CW.url('porfolio.html') + '?b=' + encodeURIComponent((S.biz && S.biz.slug) || '')) + '">' +
          '<i>📸</i><span><b>' + t('nav.portfolio.btn') + '</b><small>' + t('nav.portfolio.sub') + '</small></span></a>' +
        '<a class="cat-quick-btn" href="#equipo">' +
          '<i>👥</i><span><b>' + t('nav.team') + '</b><small>' + t('nav.team.sub') + '</small></span></a>' +
      '</div>';
  }

  function bindFilters() {
    var ft = $('[data-ftype]');
    if (ft) ft.addEventListener('change', function () { S.filterType = ft.value; S.filterCat = ''; rerenderFilters(); });
    var fc = $('[data-fcat]'); if (fc) fc.addEventListener('change', function () { S.filterCat = fc.value; drawGrid(); });
    var cl = $('[data-fclear]'); if (cl) cl.addEventListener('click', function () { S.filterType = 'all'; S.filterCat = ''; rerenderFilters(); });
  }
  function rerenderFilters() {
    var menu = $('[data-cat-menu]');
    if (menu) menu.innerHTML = renderFilters();
    bindFilters();
    drawGrid();
  }

  // ---- Tarjetas -------------------------------------------------------
  function visible() {
    var list = S.products.slice();
    if (S.filterType === 'product') list = list.filter(function (p) { return p.kind !== 'service'; });
    if (S.filterType === 'service') list = list.filter(function (p) { return p.kind === 'service'; });
    if (S.filterCat) list = list.filter(function (p) { return p.category_id === S.filterCat; });
    // Nota: una categoría desactivada desaparece del selector, pero sus
    // artículos siguen visibles en «Todas».
    list.sort(function (a, b) { return (a.sort_order || 0) - (b.sort_order || 0); });
    return list;
  }
  function eff(p) { return Number(p.promo_price) > 0 ? Number(p.promo_price) : Number(p.price || 0); }
  function catOf(id) { return S.cats.find(function (c) { return c.id === id; }); }

  function drawGrid() {
    var list = visible();
    var grid = $('[data-grid]');
    if (!list.length) { grid.innerHTML = '<div class="empty-state"><div class="es-icon">📦</div><b>' + t('prod.empty') + '</b></div>'; return; }
    grid.innerHTML = list.map(cardHTML).join('');
    $$('[data-add]', grid).forEach(function (b) { b.addEventListener('click', function () { addToCart(b.dataset.add); }); });
    $$('[data-book]', grid).forEach(function (b) { b.addEventListener('click', function () { openBooking(b.dataset.book); }); });
    $$('[data-detail]', grid).forEach(function (b) { b.addEventListener('click', function () { openDetail(b.dataset.detail); }); });
    $$('[data-share]', grid).forEach(function (b) { b.addEventListener('click', function (e) { e.stopPropagation(); shareCard(b.dataset.share); }); });
  }

  function shareCard(id) {
    var p = S.products.find(function (x) { return x.id === id; }); if (!p) return;
    var c = catOf(p.category_id);
    CW.api.shareWhatsApp(CW.api.shareItem(S.biz, Object.assign({}, p, { name: CW.tx(p, 'name'), description: CW.tx(p, 'description'), category_name: c ? CW.tx(c, 'name') : '' })));
  }

  // Descripción breve para las tarjetas: se usa la del panel; si está vacía,
  // se recorta la descripción larga a 90 caracteres.
  function shortText(p) {
    var s = String(CW.tx(p, 'short_desc') || '').replace(/\s+/g, ' ').trim();
    var isOwn = !!s;
    if (!s) s = String(CW.tx(p, 'description') || '').replace(/\s+/g, ' ').trim();
    if (!s) return '';
    if (s.length > 90) {
      s = s.slice(0, 89).replace(/[\s,.;:]+\S*$/, '').replace(/[\s,.;:]+$/, '') + '…';
      if (!isOwn && s.length > 90) s = s.slice(0, 90);
    }
    return s;
  }

  function cardHTML(p) {
    var c = catOf(p.category_id);
    var short = shortText(p);
    var isService = p.kind === 'service';
    var hasPromo = !isService && Number(p.promo_price) > 0 && Number(p.promo_price) < Number(p.price);
    var img = (p.images && p.images[0]) ? '<img src="' + esc(p.images[0]) + '" alt="' + esc(CW.tx(p, 'name')) + '" loading="lazy">' : '<div class="ph-img">🖼️</div>';
    var inCart = S.cart.find(function (x) { return x.id === p.id; });

    var media = '<div class="pc-media" data-detail="' + p.id + '">' + img +
      (isService ? '<span class="pc-kind">🔧 ' + t('prod.type.service') + '</span>' : '') +
      (c ? '<span class="pc-cat">' + esc(CW.tx(c, 'name')) + '</span>' : '') +
      (hasPromo ? '<span class="pc-off">-' + CW.api.pct(p.promo_price, p.price) + '%</span>' : '') +
      (inCart ? '<span class="pc-incart">✓ ' + inCart.qty + '</span>' : '') +
      '</div>';

    var btn = isService ? (p.bookable ? t('cat.public.book') : t('cat.public.request')) : t('cat.public.add');
    var actions = '<div class="pc-actions">' +
      (isService && p.bookable
        ? '<button class="btn primary small" data-book="' + p.id + '">📅 ' + t('cat.public.book') + '</button>'
        : '<button class="btn ' + (isService ? 'soft' : 'primary') + ' small" data-add="' + p.id + '">' + btn + '</button>') +
      '<button class="btn ghost small" data-detail="' + p.id + '">' + t('cat.public.details') + '</button>' +
      '<button class="btn ghost small pc-share" data-share="' + p.id + '" aria-label="' + t('common.share') + '" title="' + t('common.share') + '">↗</button>' +
      '</div>';

    // ---- Tarjeta de SERVICIO: pensada para servicios ----
    if (isService) {
      var price = Number(p.price) > 0
        ? '<b>' + money(p.price, S.biz.currency) + '</b>'
        : '<b class="consult">' + t('cat.public.consult') + '</b>';
      var specs = '';
      if (p.duration) specs += '<span class="pc-spec"><i>⏱</i>' + esc(p.duration) + '</span>';
      if (p.modality) specs += '<span class="pc-spec"><i>📍</i>' + esc(p.modality) + '</span>';
      return '<article class="pc pc--service">' + media +
        '<div class="pc-body">' +
          '<h3 class="pc-name">' + esc(CW.tx(p, 'name')) + '</h3>' +
          (short ? '<p class="pc-desc">' + esc(short) + '</p>' : '') +
          (specs ? '<div class="pc-specs-list">' + specs + '</div>' : '') +
          '<div class="pc-service-foot">' +
            '<div class="pc-price">' + price + '</div>' +
            '<span class="pc-avail">✅ ' + t('cat.public.available') + '</span>' +
          '</div>' +
          actions +
        '</div></article>';
    }

    // ---- Tarjeta de PRODUCTO ----
    var priceHtml = hasPromo
      ? '<div class="pc-price"><b>' + money(p.promo_price, S.biz.currency) + '</b><s>' + money(p.price, S.biz.currency) + '</s></div>'
      : '<div class="pc-price"><b>' + money(p.price, S.biz.currency) + '</b></div>';
    var promo = hasPromo
      ? '<div class="pc-specs"><span class="save">🎁 ' + t('cat.public.save') + ' ' + CW.api.pct(p.promo_price, p.price) + '%</span></div>'
      : '';
    return '<article class="pc pc--product">' + media +
      '<div class="pc-body">' +
        '<h3 class="pc-name">' + esc(CW.tx(p, 'name')) + '</h3>' +
        (short ? '<p class="pc-desc">' + esc(short) + '</p>' : '') +
        priceHtml + promo +
        actions +
      '</div></article>';
  }

  // ---- Opciones del producto (color, tamaño, litros, peso) -----------
  var OPT_GROUPS = [
    { k: 'colors', label: 'opt.color' },
    { k: 'sizes', label: 'opt.size' },
    { k: 'liters', label: 'opt.liters' },
    { k: 'weights', label: 'opt.weight' }
  ];

  function optList(p, k) {
    var o = (p && p.options) || {};
    var arr = o[k];
    if (!Array.isArray(arr)) return [];
    return arr.map(function (v) { return String(v).trim(); }).filter(Boolean);
  }
  function optGroups(p) {
    return OPT_GROUPS.map(function (g) {
      return { k: g.k, label: t(g.label), values: optList(p, g.k) };
    }).filter(function (g) { return g.values.length; });
  }
  function optSig(options) {
    return (options || []).map(function (o) { return (o.k || o.label) + '=' + o.value; }).join('|');
  }

  // ---- Ficha de detalle ----------------------------------------------
  function openDetail(id) {
    var p = S.products.find(function (x) { return x.id === id; }); if (!p) return;
    if (S.biz.id !== 'demo') CW.store.incrementViews(p.id);
    var c = catOf(p.category_id);
    var imgs = (p.images && p.images.length) ? p.images : [null];
    var groups = p.kind === 'service' ? [] : optGroups(p);
    var short = shortText(p);
    var m = CW.modal({
      className: 'detail-modal detail-modal--xl',
      title: CW.tx(p, 'name'),
      html:
        '<div class="detail-grid">' +
          '<div class="detail-gallery"><div class="dg-main" data-dg-main>' + (imgs[0] ? '<img src="' + esc(imgs[0]) + '">' : '<div class="ph-img big">🖼️</div>') + '</div>' +
          (imgs.length > 1 ? '<div class="dg-thumbs">' + imgs.map(function (u, i) { return '<button data-dg="' + i + '" class="' + (i === 0 ? 'active' : '') + '">' + (u ? '<img src="' + esc(u) + '">' : '🖼️') + '</button>'; }).join('') + '</div>' : '') + '</div>' +
          '<div class="detail-info"><span class="detail-type">' + (p.kind === 'service' ? t('prod.type.service') : t('prod.type.product')) + (c ? ' · ' + esc(CW.tx(c, 'name')) : '') + '</span>' +
          '<h2>' + esc(CW.tx(p, 'name')) + '</h2>' +
          (short ? '<p class="detail-short">' + esc(short) + '</p>' : '') +
          '<div class="detail-price">' + (Number(p.promo_price) > 0 && Number(p.promo_price) < Number(p.price) ?
            '<b>' + money(p.promo_price, S.biz.currency) + '</b> <s>' + money(p.price, S.biz.currency) + '</s> <span class="tag warn">-' + CW.api.pct(p.promo_price, p.price) + '%</span>' :
            (Number(p.price) > 0 ? '<b>' + money(p.price, S.biz.currency) + '</b>' : '<b>' + t('cat.public.consult') + '</b>')) + '</div>' +
          '<ul class="detail-rows">' +
            '<li>🏷️ ' + t('cat.public.category') + ': <b>' + esc(c ? CW.tx(c, 'name') : '—') + '</b></li>' +
            (p.duration ? '<li>⏱ ' + t('cat.public.duration') + ': <b>' + esc(p.duration) + '</b></li>' : '') +
            (p.modality ? '<li>📍 ' + t('cat.public.modality') + ': <b>' + esc(p.modality) + '</b></li>' : '') +
            (p.kind === 'service' ? '<li>✅ ' + t('cat.public.available') + '</li>' : '') +
          '</ul>' +
          (groups.length ? '<div class="opt-groups">' + groups.map(function (g) {
            return '<label class="opt-field"><span>' + esc(g.label) + '</span>' +
              '<select data-opt="' + g.k + '">' + g.values.map(function (v) {
                return '<option value="' + esc(v) + '">' + esc(v) + '</option>';
              }).join('') + '</select></label>';
          }).join('') + '</div>' : '') +
          (CW.tx(p, 'description') ? '<p class="detail-desc">' + esc(CW.tx(p, 'description')).replace(/\n/g, '<br>') + '</p>' : '') +
          '<div class="detail-docs">' +
            '<a class="doc-btn" href="./assets/docs/ficha-tecnica.pdf" target="_blank" rel="noopener"><span>📄</span>' + t('doc.tech') + '</a>' +
            '<a class="doc-btn" href="./assets/docs/guia-seleccion.pdf" target="_blank" rel="noopener"><span>🎨</span>' + t('doc.guide') + '</a>' +
            '<a class="doc-btn" href="./assets/docs/seguridad.pdf" target="_blank" rel="noopener"><span>🛡️</span>' + t('doc.safety') + '</a>' +
          '</div>' +
          '<div class="detail-actions"><button class="btn primary" data-d-add="' + p.id + '">' + (p.kind === 'service' ? (p.bookable ? t('cat.public.book') : t('cat.public.request')) : t('cat.public.add')) + '</button>' +
          '<button class="btn ghost" data-d-share="' + p.id + '">↗ ' + t('common.share') + '</button></div></div>' +
        '</div>'
    });
    $$('[data-dg]', m.modal).forEach(function (b) {
      b.addEventListener('click', function () {
        var i = Number(b.dataset.dg);
        $$('[data-dg]', m.modal).forEach(function (x) { x.classList.remove('active'); }); b.classList.add('active');
        $('[data-dg-main]', m.modal).innerHTML = imgs[i] ? '<img src="' + esc(imgs[i]) + '">' : '<div class="ph-img big">🖼️</div>';
      });
    });
    // Mismo formulario de reserva que el botón de la tarjeta: un solo flujo.
    $('[data-d-add]', m.modal).addEventListener('click', function () {
      if (p.kind === 'service' && p.bookable) {
        m.close(); return openBooking(p.id);
      }
      // Opciones elegidas en la ficha (color, tamaño, litros, peso).
      var chosen = groups.map(function (g) {
        var el = $('[data-opt="' + g.k + '"]', m.modal);
        return el && el.value ? { k: g.k, label: g.label, value: el.value } : null;
      }).filter(Boolean);
      m.close();
      addToCart(p.id, { options: chosen });
      openCart();
    });
    $('[data-d-share]', m.modal).addEventListener('click', function () {
      CW.api.shareWhatsApp(CW.api.shareItem(S.biz, Object.assign({}, p, { name: CW.tx(p, 'name'), description: CW.tx(p, 'description'), category_name: c ? CW.tx(c, 'name') : '' })));
    });
  }

  // ---- Reserva de servicios -------------------------------------------
  // Formulario propio para servicios (fontanero, peluquería, diseño web…):
  // calendario con días cerrados y ocupados, horas disponibles y detalles.
  var BK = { item: null, month: null, date: '', time: '', busy: [], modal: null };

  function ymd(d) {
    return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
  }
  function parseYmd(v) { var p = String(v).split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function workDays(biz) { return (biz.work_days && biz.work_days.length) ? biz.work_days : [1, 2, 3, 4, 5, 6]; }

  var BK = { modal: null, service: null };

  function bkToday() { return ymd(new Date()); }

  function bookingServices() {
    return S.products.filter(function (p) { return p.kind === 'service'; });
  }

  // Formulario de reserva con la lógica de disponibilidad del negocio:
  // días cerrados, horas ya ocupadas y citas de hoy ya pasadas.
  function openBooking(id) {
    CW.store.listProfessionals(S.biz.id, { activeOnly: true }).then(function (pros) {
      buildBooking(id, pros || []);
    }).catch(function () { buildBooking(id, []); });
  }

  function buildBooking(id, pros) {
    var services = bookingServices();
    var pre = id ? services.find(function (x) { return x.id === id; }) : null;
    BK.service = pre || (services.length === 1 ? services[0] : null);

    var m = CW.modal({
      className: 'bk-modal',
      title: '📅 ' + t('bk.title'),
      html:
        '<div class="bk-field"><label class="bk-label"><span class="bk-num"></span>' + t('bk.service') + '</label>' +
          '<select data-bk-service>' +
            '<option value="">' + t('bk.selectService') + '</option>' +
            services.map(function (p) {
              return '<option value="' + p.id + '"' + (BK.service && p.id === BK.service.id ? ' selected' : '') + '>' +
                esc(CW.tx(p, 'name')) + (Number(p.price) > 0 ? ' · ' + money(p.price, S.biz.currency) : '') + '</option>';
            }).join('') +
          '</select>' +
        '</div>' +
        (pros.length ? '<div class="bk-field"><label class="bk-label"><span class="bk-num"></span>' + t('bk.pro') + '</label>' +
          '<select data-bk-pro><option value="">' + t('bk.choosePro') + '</option>' +
            pros.map(function (m) { return '<option value="' + m.id + '">' + esc(m.name) + (m.role ? ' · ' + esc(m.role) : '') + '</option>'; }).join('') +
          '</select></div>' : '') +
        '<p class="bk-req" data-bk-req hidden></p>' +
        '<div class="bk-two">' +
          '<div class="bk-field"><label class="bk-label"><span class="bk-num"></span>' + t('bk.date') + '</label>' +
            '<input type="date" data-bk-date min="' + bkToday() + '" value="' + bkToday() + '"></div>' +
          '<div class="bk-field"><label class="bk-label"><span class="bk-num"></span>' + t('bk.hour') + '</label>' +
            '<select data-bk-hour><option value="">' + t('bk.chooseHour') + '</option></select></div>' +
        '</div>' +
        '<p class="bk-hint" data-bk-hint hidden></p>' +
        '<div class="bk-field"><label class="bk-label"><span class="bk-num"></span>' + t('bk.yourName') + '</label>' +
          '<input data-bk-name autocomplete="name" placeholder="' + t('bk.namePh') + '"></div>' +
        '<div class="bk-field"><label class="bk-label"><span class="bk-num"></span>WhatsApp</label>' +
          '<input data-bk-phone inputmode="tel" autocomplete="tel" placeholder="600123456"></div>' +
        '<div class="bk-field" data-bk-addr-wrap><label class="bk-label"><span class="bk-num"></span>' + t('bk.address') + '</label>' +
          '<input data-bk-address placeholder="' + t('bk.addressPh') + '"></div>' +
        '<div class="bk-field"><label class="bk-label">📧 ' + t('bk.email') + ' <span class="muted">(' + t('common.optional') + ')</span></label>' +
          '<input type="email" data-bk-email autocomplete="email" placeholder="tu@correo.com"></div>' +
        '<div class="bk-field"><label class="bk-label"><span class="bk-num"></span>' + t('bk.notes') + ' <span class="muted">(' + t('common.optional') + ')</span></label>' +
          '<textarea data-bk-notes rows="2" placeholder="' + t('bk.notesPh') + '"></textarea></div>' +
        '<button type="button" class="bk-submit" data-bk-confirm>💬 ' + t('bk.confirmWa') + '</button>',
      footer: ''
    });
    BK.modal = m;

    var serviceSel = $('[data-bk-service]', m.modal);
    var dateEl = $('[data-bk-date]', m.modal);
    var hourEl = $('[data-bk-hour]', m.modal);
    var proSel = $('[data-bk-pro]', m.modal);

    function currentPro() {
      return proSel ? pros.find(function (x) { return x.id === proSel.value; }) : null;
    }
    // Horario: el del profesional si se ha elegido; si no, el del negocio.
    function schedule() {
      var pro = currentPro();
      if (!pro) return S.biz;
      return {
        work_days: pro.work_days && pro.work_days.length ? pro.work_days : (S.biz.work_days || [1,2,3,4,5,6]),
        open_time: pro.open_time || S.biz.open_time,
        close_time: pro.close_time || S.biz.close_time,
        slot_minutes: pro.slot_minutes || S.biz.slot_minutes
      };
    }

    function needAddress(p) {
      return /domicilio|domicile|home|à domicile/i.test(String(p && p.modality || '')) ||
             /delivery/.test(String(S.biz.delivery || ''));
    }
    function syncAddress() {
      var p = services.find(function (x) { return x.id === serviceSel.value; });
      var wrap = $('[data-bk-addr-wrap]', m.modal);
      var input = $('[data-bk-address]', m.modal);
      var required = needAddress(p);
      wrap.classList.toggle('req', required);
      input.setAttribute('data-required', required ? '1' : '0');

      // Requisitos que el negocio haya escrito para ese servicio.
      var req = $('[data-bk-req]', m.modal);
      var text = p ? String(CW.tx(p, 'requirements') || '').trim() : '';
      req.hidden = !text;
      req.textContent = text ? 'ℹ️ ' + text : '';
    }

    function loadSlots() {
      var day = dateEl.value;
      hourEl.innerHTML = '<option value="">' + t('common.loading') + '</option>';
      var hint = $('[data-bk-hint]', m.modal);
      hint.hidden = true;
      if (!day) return;
      var pro = currentPro();
      CW.store.busySlots(S.biz.id, day, pro ? pro.id : null).then(function (busy) {
        var slots = CW.api.timeSlots(schedule(), day);
        if (day === bkToday()) {
          var now = new Date();
          slots = slots.filter(function (h) {
            var p = h.split(':');
            var t2 = new Date(); t2.setHours(+p[0], +p[1], 0, 0);
            return t2 > now;
          });
        }
        busy = busy || [];
        var free = slots.filter(function (h) { return busy.indexOf(h) === -1; });
        if (!free.length) {
          hourEl.innerHTML = '<option value="">—</option>';
          hint.hidden = false;
          hint.textContent = slots.length ? t('bk.full') : t('bk.closedDay');
          return;
        }
        hourEl.innerHTML = '<option value="">' + t('bk.chooseHour') + '</option>' +
          free.map(function (h) { return '<option value="' + h + '">' + h + '</option>'; }).join('');
      });
    }

    serviceSel.addEventListener('change', function () { syncAddress(); loadSlots(); });
    if (proSel) proSel.addEventListener('change', loadSlots);
    dateEl.addEventListener('change', loadSlots);
    syncAddress();
    loadSlots();

    $('[data-bk-confirm]', m.modal).addEventListener('click', function () {
      var btn = $('[data-bk-confirm]', m.modal);
      var service = services.find(function (x) { return x.id === serviceSel.value; });
      var pro = currentPro();
      var name = ($('[data-bk-name]', m.modal).value || '').trim();
      var phone = ($('[data-bk-phone]', m.modal).value || '').trim();
      var email = ($('[data-bk-email]', m.modal).value || '').trim();
      var address = ($('[data-bk-address]', m.modal).value || '').trim();
      var notes = ($('[data-bk-notes]', m.modal).value || '').trim();
      var date = dateEl.value, hour = hourEl.value;
      var addrRequired = $('[data-bk-address]', m.modal).getAttribute('data-required') === '1';

      if (!service || !date || !hour || !name || !phone || (addrRequired && !address) || (pros.length && !pro)) {
        CW.toast(pros.length && !pro ? t('bk.proRequired') : t('bk.required'), 'error');
        return;
      }

      btn.disabled = true;
      var when = new Date(date + 'T' + hour + ':00');
      var order = {
        business_id: S.biz.id,
        code: CW.store.newOrderCode(),
        customer_name: name, customer_phone: phone, customer_email: email,
        customer_address: address, customer_city: '',
        note: notes,
        items: [{
          name: CW.tx(service, 'name'), qty: 1, price: eff(service), kind: 'service',
          duration: service.duration || '', modality: service.modality || '',
          appointment: { date: date, time: hour, notes: notes, address: address, professional: pro ? pro.name : '' }
        }],
        subtotal: eff(service), fee: 0, total: eff(service),
        appointment_at: when.toISOString(),
        professional_id: pro ? pro.id : null,
        professional_name: pro ? pro.name : '',
        status: 'new'
      };

      var save = (S.biz.id === 'demo' && CW.isDemo) ? Promise.resolve(order) : CW.store.createOrder(order);
      save.then(function () {
        m.close();
        showBookingDone(order, service, pro, when);
      }).catch(function (err) {
        btn.disabled = false;
        console.warn('[CW] No se pudo guardar la reserva:', err);
        CW.toast(t('bk.error'), 'error');
      });
    });
  }

  // Pantalla de confirmación: resumen + avisos al cliente y al negocio.
  function showBookingDone(order, service, pro, when) {
    var lang = (CW.i18n && CW.i18n.lang) || 'es';
    var dateTxt = when.toLocaleDateString(lang, { weekday: 'long', day: 'numeric', month: 'long' });
    var timeTxt = when.toLocaleTimeString(lang, { hour: '2-digit', minute: '2-digit' });
    var bizName = CW.tx(S.biz, 'name');
    var svc = CW.tx(service, 'name');

    var body =
      '*CITA CONFIRMADA*\n' + bizName + '\n' +
      'Código: *' + order.code + '*\n' +
      'Servicio: ' + svc + '\n' +
      (pro ? 'Profesional: ' + pro.name + '\n' : '') +
      'Fecha: ' + dateTxt + '\n' +
      'Hora: ' + timeTxt + '\n' +
      (order.customer_address ? 'Dirección: ' + order.customer_address + '\n' : '');

    var bizBody = body + '\nCliente: ' + order.customer_name + '\nTeléfono: ' + order.customer_phone + '\n' +
      (order.note ? 'Notas: ' + order.note : '');

    var cards = CW.modal({
      className: 'bk-done',
      title: '✅ ' + t('bk.confirm.title'),
      html:
        '<div class="bk-done-card">' +
          '<div class="bk-done-row"><span>' + t('bk.service') + '</span><b>' + esc(svc) + '</b></div>' +
          (pro ? '<div class="bk-done-row"><span>' + t('bk.pro') + '</span><b>' + esc(pro.name) + '</b></div>' : '') +
          '<div class="bk-done-row"><span>' + t('bk.date') + '</span><b>' + esc(dateTxt) + '</b></div>' +
          '<div class="bk-done-row"><span>' + t('bk.hour') + '</span><b>' + esc(timeTxt) + '</b></div>' +
          (order.customer_address ? '<div class="bk-done-row"><span>' + t('bk.address') + '</span><b>' + esc(order.customer_address) + '</b></div>' : '') +
          '<div class="bk-done-row"><span>' + t('common.phone') + '</span><b>' + esc(order.customer_phone) + '</b></div>' +
        '</div>' +
        '<p class="muted bk-done-hint">' + t('bk.confirm.desc') + '</p>' +
        (S.biz.whatsapp ? '<a class="btn wa block" target="_blank" rel="noopener" href="' +
          CW.api.waLink(S.biz.whatsapp, bizBody) + '">💬 ' + t('bk.confirm.business') + '</a>' : '') +
        '<a class="btn soft block" target="_blank" rel="noopener" href="' +
          CW.api.waLink(order.customer_phone, body) + '">💬 ' + t('bk.confirm.client') + '</a>' +
        (order.customer_email ? '<a class="btn ghost block" href="mailto:' + esc(order.customer_email) +
          '?subject=' + encodeURIComponent(t('bk.confirm.title') + ' · ' + svc) +
          '&body=' + encodeURIComponent(body.replace(/\*/g, '')) + '">📧 ' + t('bk.confirm.mail') + '</a>' : '') +
        '<button class="btn ghost block" data-close>' + t('common.close') + '</button>',
      footer: ''
    });
    void cards;
    CW.toast(t('bk.added'), 'ok');
  }

  // ---- Carrito --------------------------------------------------------
  function addToCart(id, opts) {
    var p = S.products.find(function (x) { return x.id === id; }); if (!p) return;
    opts = opts || {};
    var options = opts.options || [];
    var sig = optSig(options);
    // Una reserva de servicio nunca se suma a otra: es una cita con su hora.
    // Cada combinación de opciones es una línea distinta del carrito.
    var it = opts.appointment ? null : S.cart.find(function (x) {
      return x.id === id && !x.appointment && (x.optSig || '') === sig;
    });
    if (it) it.qty++;
    else S.cart.push({
      key: p.id + (sig ? '#' + sig : ''), id: p.id, name: CW.tx(p, 'name'),
      price: eff(p), qty: 1, kind: p.kind,
      image: (p.images && p.images[0]) || '', bookable: !!p.bookable,
      category_name: (catOf(p.category_id) || {}).name || '',
      duration: p.duration || '', modality: p.modality || '',
      options: options, optSig: sig,
      appointment: opts.appointment || null
    });
    if (!opts.appointment) CW.toast(t('common.add') + ': ' + CW.tx(p, 'name'));
    updateCartUI(); drawGrid();
  }
  function removeFromCart(key) { S.cart = S.cart.filter(function (x) { return x.key !== key; }); updateCartUI(); drawGrid(); }
  function setQty(key, d) {
    var it = S.cart.find(function (x) { return x.key === key; }); if (!it) return;
    it.qty += d; if (it.qty <= 0) removeFromCart(key); else { updateCartUI(); }
  }
  function cartCount() { return S.cart.reduce(function (s, x) { return s + x.qty; }, 0); }
  function subtotal() { return S.cart.reduce(function (s, x) { return s + x.price * x.qty; }, 0); }

  function updateCartUI() {
    var fab = $('[data-cart-fab]');
    $('[data-cart-count]').textContent = cartCount();
    fab.hidden = cartCount() === 0;
    if (!$('[data-cart]').hidden) drawCart();
  }

  function openCart() {
    $('[data-cart]').hidden = false; $('[data-cart-overlay]').hidden = false;
    document.body.classList.add('cart-open');
    requestAnimationFrame(function () { $('[data-cart]').classList.add('show'); });
    drawCart();
  }
  function closeCart() {
    $('[data-cart]').classList.remove('show');
    setTimeout(function () { $('[data-cart]').hidden = true; $('[data-cart-overlay]').hidden = true; document.body.classList.remove('cart-open'); }, 200);
  }

  function drawCart() {
    var body = $('[data-cart-body]');
    var foot = $('[data-cart-foot]');
    // Conserva lo que el cliente ya escribió antes de re-renderizar.
    var prev = {};
    ['name', 'phone', 'address', 'city', 'note', 'date'].forEach(function (k) {
      var el = $('[data-c-' + k + ']', body); if (el) prev[k] = el.value;
    });
    if (!S.cart.length) {
      body.innerHTML = '<div class="empty-state"><div class="es-icon">🛒</div><b>' + t('cat.public.emptycart') + '</b></div>';
      foot.innerHTML = '';
      return;
    }
    var hasBookable = S.cart.some(function (x) { return x.bookable; });
    var fee = S.biz.delivery === 'custom' ? Number(S.biz.delivery_fee || 0) : 0;
    var total = subtotal() + fee;
    body.innerHTML =
      '<ul class="cart-items">' + S.cart.map(function (it) {
        return '<li class="cart-item">' +
          '<div class="ci-thumb">' + (it.image ? '<img src="' + esc(it.image) + '">' : '🖼️') + '</div>' +
          '<div class="ci-info"><b>' + esc(it.name) + '</b>' + (it.kind === 'service' ? '<small>' + t('prod.type.service') + '</small>' : '') +
          (it.options && it.options.length ? '<small class="ci-opts">' + it.options.map(function (o) { return esc(o.label) + ': ' + esc(o.value); }).join(' · ') + '</small>' : '') +
          (it.appointment ? '<small class="ci-appt">📅 ' + esc(it.appointment.date) + ' · ' + esc(it.appointment.time) + '</small>' : '') +
          '<div class="qty"><button data-qm="' + esc(it.key) + '">−</button><span>' + it.qty + '</span><button data-qp="' + esc(it.key) + '">+</button></div></div>' +
          '<div class="ci-right"><b>' + (it.price > 0 ? money(it.price * it.qty, S.biz.currency) : t('cat.public.consult')) + '</b>' +
          '<button class="icon-btn" data-rm="' + esc(it.key) + '">✕</button></div></li>';
      }).join('') + '</ul>' +
      '<div class="cart-form">' +
        '<h4>' + t('cat.public.yourdata') + '</h4>' +
        '<div class="two-col-inline">' +
          '<label class="field"><span>' + t('common.name') + ' *</span><input data-c-name></label>' +
          '<label class="field"><span>' + t('common.phone') + ' *</span><input data-c-phone></label>' +
        '</div>' +
        '<div class="two-col-inline">' +
          '<label class="field"><span>' + t('cat.public.address') + '</span><input data-c-address></label>' +
          '<label class="field"><span>' + t('cat.public.city') + '</span><input data-c-city></label>' +
        '</div>' +
        '<label class="field"><span>' + t('cat.public.note') + '</span><textarea data-c-note rows="2"></textarea></label>' +
        (hasBookable ? '<div class="appt-block"><h4>' + t('cat.public.appt') + '</h4><div class="two-col-inline">' +
          '<label class="field"><span>' + t('cat.public.date') + '</span><input type="date" data-c-date></label>' +
          '<label class="field"><span>' + t('cat.public.time') + '</span><select data-c-time></select></label></div>' +
          '<small class="muted" data-c-closed hidden>' + t('cat.public.closed') + '</small></div>' : '') +
      '</div>';

    foot.innerHTML =
      '<div class="cart-totals">' +
        (fee > 0 ? '<div><span>' + t('cat.public.subtotal') + '</span><b>' + money(subtotal(), S.biz.currency) + '</b></div>' +
          '<div><span>' + t('cat.public.fee') + '</span><b>+' + money(fee, S.biz.currency) + '</b></div>' : '') +
        '<div class="grand"><span>' + t('cat.public.total') + '</span><b>' + money(total, S.biz.currency) + '</b></div>' +
      '</div>' +
      '<button class="btn wa block" data-send>💬 ' + t('cat.public.send') + '</button>';

    $$('[data-qm]', body).forEach(function (b) { b.addEventListener('click', function () { setQty(b.dataset.qm, -1); }); });
    $$('[data-qp]', body).forEach(function (b) { b.addEventListener('click', function () { setQty(b.dataset.qp, 1); }); });
    $$('[data-rm]', body).forEach(function (b) { b.addEventListener('click', function () { removeFromCart(b.dataset.rm); }); });

    // Restaura los datos del cliente.
    ['name', 'phone', 'address', 'city', 'note', 'date'].forEach(function (k) {
      var el = $('[data-c-' + k + ']', body); if (el && prev[k] != null) el.value = prev[k];
    });

    if (hasBookable) {
      var dateEl = $('[data-c-date]', body), timeEl = $('[data-c-time]', body);
      function refreshSlots() {
        var slots = CW.api.timeSlots(S.biz, dateEl.value);
        $('[data-c-closed]', body).hidden = !dateEl.value || slots.length > 0;
        timeEl.innerHTML = slots.length ? slots.map(function (s) { return '<option>' + s + '</option>'; }).join('') : '<option>—</option>';
      }
      dateEl.addEventListener('change', refreshSlots);
      var today = new Date().toISOString().slice(0, 10); dateEl.min = today;
      dateEl.value = prev.date || today;
      refreshSlots();
    }

    $('[data-send]', foot).addEventListener('click', function () {
      var name = ($('[data-c-name]', body).value || '').trim();
      var phone = ($('[data-c-phone]', body).value || '').trim();
      if (!name || !phone) { CW.toast(t('cat.public.required')); return; }
      var appt = null;
      var booked = S.cart.filter(function (x) { return x.appointment && x.appointment.date; })[0];
      if (booked) appt = new Date(booked.appointment.date + 'T' + booked.appointment.time + ':00').toISOString();
      else if (hasBookable) {
        var d = $('[data-c-date]', body).value, h = $('[data-c-time]', body).value;
        if (d && h && h !== '—') appt = new Date(d + 'T' + h + ':00').toISOString();
      }
      var order = {
        business_id: S.biz.id, code: CW.store.newOrderCode(),
        customer_name: name, customer_phone: phone,
        customer_address: ($('[data-c-address]', body).value || '').trim(),
        customer_city: ($('[data-c-city]', body).value || '').trim(),
        note: ($('[data-c-note]', body).value || '').trim(),
        items: S.cart.map(function (x) {
          return {
            name: x.name, qty: x.qty, price: x.price, kind: x.kind,
            duration: x.duration || '', modality: x.modality || '',
            options: x.options || [],
            appointment: x.appointment || null
          };
        }),
        subtotal: subtotal(), fee: fee, total: total, appointment_at: appt, status: 'new'
      };
      var msg = CW.api.orderMessage(S.biz, order);
      // Guarda (si no es demo) y abre WhatsApp
      var save = (S.biz.id === 'demo' && CW.isDemo) ? Promise.resolve(order) : CW.store.createOrder(order);
      save.then(function () {
        window.open(CW.api.waLink(S.biz.whatsapp, msg), '_blank');
        S.cart = []; updateCartUI(); closeCart(); drawGrid();
        CW.toast('✓');
      }).catch(function () { window.open(CW.api.waLink(S.biz.whatsapp, msg), '_blank'); });
    });
  }

  // ---- API para otros módulos (p. ej. el asistente) -------------------
  CW.catalogData = function () {
    return { biz: S.biz, products: S.products, cats: S.cats, cart: S.cart, contact: CONTACT };
  };
  CW.catalogAdd = function (id) { addToCart(id); };
  CW.catalogOpen = function () { openCart(); };

  // ---- Init -----------------------------------------------------------
  document.addEventListener('DOMContentLoaded', function () {
    var ov = $('[data-cart-overlay]'); if (ov) ov.addEventListener('click', closeCart);
    var cc = $('[data-cart-close]'); if (cc) cc.addEventListener('click', closeCart);
    var fab = $('[data-cart-fab]'); if (fab) fab.addEventListener('click', openCart);

    // Hamburguesa: despliega el menú completo (categorías, buscador, idioma,
    // porfolio y asistente) en móvil.
    var burger = $('[data-cat-burger]');
    var header = $('[data-cat-header]');
    if (burger && header && !burger._catBound) {
      burger._catBound = true;
      burger.addEventListener('click', function () {
        var open = header.classList.toggle('menu-open');
        burger.setAttribute('aria-expanded', open ? 'true' : 'false');
        burger.textContent = open ? '✕' : '☰';
      });
      document.addEventListener('click', function (e) {
        if (!header.classList.contains('menu-open')) return;
        if (header.contains(e.target)) return;
        header.classList.remove('menu-open');
        burger.setAttribute('aria-expanded', 'false');
        burger.textContent = '☰';
      });
    }

    // Cambio de idioma: se cierra lo que esté abierto y se vuelve a pintar.
    // Si algo fallara, se recarga una vez para no dejar la página bloqueada.
    var reloading = false;
    window.addEventListener('cw:lang', function () {
      if (!S.biz || reloading) return;
      try {
        if (header) { header.classList.remove('menu-open'); }
        if (burger) { burger.setAttribute('aria-expanded', 'false'); burger.textContent = '☰'; }
        document.querySelectorAll('.lang-dd.open').forEach(function (d) { d.classList.remove('open'); });
        render();
      } catch (e) {
        console.error('[CW] Error al cambiar de idioma:', e);
        reloading = true;
        location.reload();
      }
    });
    load().then(render).catch(function (e) { console.error(e); render(); });
  });
})(window, document);
