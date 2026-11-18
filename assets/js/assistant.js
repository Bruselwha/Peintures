/* ==========================================================================
   Arij Color · assistant.js
   Asistente inteligente del catálogo (widget web, sin API de WhatsApp).
   - Responde sobre productos, precios, categorías, entrega, pagos y horario.
   - Recopila datos del cliente (nombre, teléfono y qué necesita).
   - Guarda el contacto como pedido/lead y ofrece continuar por WhatsApp.
   Solo lo carga catalogo.html.
   ========================================================================== */
(function (window, document) {
  'use strict';
  var CW = window.CW;
  var esc = CW.esc, money = CW.money;
  function t(k, v) { return CW.i18n.t(k, v); }
  function norm(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim(); }

  var A = { state: 'idle', lead: {}, els: null, opened: false, greeted: false, saved: false };

  function data() {
    var d = (CW.catalogData ? CW.catalogData() : null) || {};
    return { biz: d.biz, products: d.products || [], cats: d.cats || [] };
  }

  // ------------------------------------------------------------------ DOM
  function build() {
    if (document.querySelector('[data-asst-fab]')) return; // evita duplicados
    var wrap = document.createElement('div');
    wrap.innerHTML =
      '<button class="asst-fab" data-asst-fab aria-label="Abrir asistente">💬<span class="asst-dot"></span></button>' +
      '<section class="asst-panel" data-asst-panel>' +
        '<header class="asst-head">' +
          '<div class="asst-avatar" data-asst-avatar>🤖</div>' +
          '<div class="asst-title"><b data-asst-name>' + t('as.title') + '</b><small>' + t('as.online') + '</small></div>' +
          '<button class="icon-btn asst-reset" data-asst-reset type="button" title="' + t('as.reset') + '" aria-label="' + t('as.reset') + '">↺</button>' +
          '<button class="icon-btn" data-asst-close aria-label="' + t('common.close') + '">✕</button>' +
        '</header>' +
        '<div class="asst-msgs" data-asst-msgs aria-live="polite"></div>' +
        '<div class="asst-quick" data-asst-quick></div>' +
        '<form class="asst-form" data-asst-form>' +
          '<input data-asst-input autocomplete="off" placeholder="' + t('as.placeholder') + '" aria-label="' + t('common.name') + '">' +
          '<button type="submit" aria-label="➤">➤</button>' +
        '</form>' +
      '</section>';
    document.body.appendChild(wrap);
    A.els = {
      fab: wrap.querySelector('[data-asst-fab]'),
      panel: wrap.querySelector('[data-asst-panel]'),
      msgs: wrap.querySelector('[data-asst-msgs]'),
      quick: wrap.querySelector('[data-asst-quick]'),
      form: wrap.querySelector('[data-asst-form]'),
      input: wrap.querySelector('[data-asst-input]'),
      name: wrap.querySelector('[data-asst-name]'),
      avatar: wrap.querySelector('[data-asst-avatar]'),
      reset: wrap.querySelector('[data-asst-reset]')
    };
    A.els.fab.addEventListener('click', function () { setOpen(!A.opened); });
    wrap.querySelector('[data-asst-close]').addEventListener('click', function () { setOpen(false); });
    A.els.reset.addEventListener('click', function () { reset(); });
    A.els.form.addEventListener('submit', function (e) { e.preventDefault(); send(A.els.input.value); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && A.opened) setOpen(false); });
  }

  function setOpen(v) {
    A.opened = v;
    A.els.panel.classList.toggle('show', v);
    if (v && !A.greeted) { A.greeted = true; greet(); }
    if (v) setTimeout(function () { A.els.input.focus(); }, 120);
  }

  function say(text, opts) {
    opts = opts || {};
    var b = document.createElement('div');
    b.className = 'asst-msg bot';
    b.innerHTML = text;
    A.els.msgs.appendChild(b);
    A.els.msgs.scrollTop = A.els.msgs.scrollHeight;
    setQuick(opts.quick || []);
  }
  function echo(text) {
    var b = document.createElement('div');
    b.className = 'asst-msg user';
    b.textContent = text;
    A.els.msgs.appendChild(b);
    A.els.msgs.scrollTop = A.els.msgs.scrollHeight;
  }
  function typing(on) {
    var ex = A.els.msgs.querySelector('.asst-typing-wrap');
    if (on && !ex) {
      var b = document.createElement('div');
      b.className = 'asst-msg bot asst-typing-wrap';
      b.innerHTML = '<span class="asst-typing"><span></span><span></span><span></span></span>';
      A.els.msgs.appendChild(b); A.els.msgs.scrollTop = A.els.msgs.scrollHeight;
    } else if (!on && ex) { ex.remove(); }
  }
  // Cada opción es un texto o un objeto {label, value, action}. Las preguntas
  // del asistente se contestan pulsando botones; el campo de texto sigue
  // disponible para escribir libremente.
  function setQuick(list) {
    A.els.quick.innerHTML = '';
    (list || []).forEach(function (item) {
      var label = (typeof item === 'string') ? item : item.label;
      var value = (typeof item === 'string') ? item : (item.value || item.label);
      var action = (typeof item === 'object') ? item.action : null;
      var c = document.createElement('button');
      c.type = 'button'; c.className = 'asst-chip'; c.textContent = label;
      c.addEventListener('click', function () {
        if (action) { echo(label); action(); return; }
        send(value, label);
      });
      A.els.quick.appendChild(c);
    });
  }

  // ---------------------------------------------------------------- Motor
  var INTENTS = {
    greeting: ['hola', 'buenas', 'buenos dias', 'buenas tardes', 'buenas noches', 'hey', 'saludos', 'que tal'],
    thanks: ['gracias', 'muchas gracias'],
    farewell: ['adios', 'hasta luego', 'chao', 'nos vemos', 'buenas noches'],
    human: ['hablar con alguien', 'persona', 'humano', 'agente', 'contactar', 'hablar con el negocio', 'telefono', 'whatsapp'],
    contact: ['contacto', 'contactar', 'telefono', 'whatsapp', 'correo', 'email', 'mail', 'escribir', 'llamar'],
    location: ['donde estais', 'donde estan', 'donde se encuentran', 'direccion', 'ubicacion', 'como llegar', 'donde queda', 'tienda fisica'],
    delivery: ['envio', 'entrega', 'delivery', 'domicilio', 'reparto', 'traer', 'mandar', 'enviar'],
    payment: ['pago', 'pagar', 'efectivo', 'tarjeta', 'transferencia', 'como pago'],
    invoice: ['factura', 'ticket', 'recibo'],
    returns: ['devolucion', 'devolver', 'cambio', 'garantia', 'reembolso'],
    hours: ['horario', 'abierto', 'cerrado', 'abre', 'cierra', 'atienden', 'a que hora'],
    categories: ['categoria', 'que vendes', 'que tienes', 'que ofreces', 'servicios', 'catalogo', 'productos'],
    order: ['pedir', 'pedido', 'comprar', 'reservar', 'cita', 'apartar', 'encargar', 'quiero un', 'quiero una'],
    prep: ['prepar', 'preparar', 'preparo', 'preparacion', 'preparar pared', 'preparar la pared', 'rebocar', 'masilla', 'enduire', 'enduit', 'imprimacion', 'imprimante', 'sous-couche', 'subcapa', 'lijar', 'lija', 'limpiar pared', 'humedad', 'humidade', 'gotelé', 'gotel'],
    yieldq: ['rendimiento', 'cuanto cubre', 'cuantos metros', 'metros cuadrados', 'm2 por litro', 'cobertura', 'cubrir', 'cuanta pintura', 'litros necesito', 'cantidad de pintura', 'cuantos litros', 'bote', 'pot de peinture'],
    drying: ['secado', 'seca', 'secar', 'tiempo de secado', 'cuanto tarda en secar', 'segunda mano', 'repintar', 'retoque', 'retoques'],
    customcolor: ['color a medida', 'colores a medida', 'a medida', 'tenir', 'tenido', 'mezcla', 'mezclar', 'nuancier', 'carta de colores', 'tono personalizado', 'personalizado', 'pigmento', 'teinte sur mesure'],
    stock: ['stock', 'disponible', 'disponibilidad', 'hay existencias', 'tienen existencias', 'queda'],
    discount: ['descuento', 'oferta', 'ofertas', 'rebaja', 'promocion', 'promociones', 'barato'],
    about: ['quienes sois', 'quienes son', 'sobre vosotros', 'que empresa', 'a que os dedicais', 'de que sois'],
    options: ['color', 'colores', 'tamano', 'tamanos', 'talla', 'tallas', 'litro', 'litros', 'peso', 'pesos', 'medida', 'medidas', 'opciones', 'variedades', 'presentacion', 'acabado', 'acabados'],
    price: ['precio', 'cuanto', 'cuesta', 'vale', 'coste', 'costo']
  };

  function matchIntent(msg) {
    var n = norm(msg);
    for (var k in INTENTS) {
      for (var i = 0; i < INTENTS[k].length; i++) { if (n.indexOf(norm(INTENTS[k][i])) >= 0) return k; }
    }
    return null;
  }

  // El catálogo puede estar en francés y el cliente preguntar en español (o al
  // contrario). Este pequeño diccionario empareja las palabras habituales.
  var SYN = {
    pintura: 'peinture', pinturas: 'peintures', pintar: 'peinture',
    blanca: 'blanche', blanco: 'blanc', blancas: 'blanches', blancos: 'blancs',
    negra: 'noire', negro: 'noir', negras: 'noires',
    roja: 'rouge', rojo: 'rouge', azul: 'bleu', verde: 'vert',
    amarilla: 'jaune', amarillo: 'jaune', gris: 'gris', beige: 'beige',
    marron: 'marron', marrones: 'marron', crema: 'creme',
    color: 'couleur', colores: 'couleurs', tono: 'teinte', tonos: 'teintes',
    litro: 'litre', litros: 'litres', peso: 'poids', pesa: 'poids',
    tamano: 'taille', tamanos: 'tailles', medida: 'mesure', medidas: 'mesures',
    pared: 'mur', paredes: 'murs', techo: 'plafond', suelo: 'sol', suelos: 'sols',
    madera: 'bois', metal: 'metal', exterior: 'exterieur', interior: 'interieur',
    mate: 'mat', brillante: 'brillant', satinada: 'satin',
    agua: 'eau', disolvente: 'solvant', barniz: 'vernis', esmalte: 'email',
    rodillo: 'rouleau', brocha: 'pinceau', pincel: 'pinceau', cinta: 'ruban'
  };

  function words(s) {
    return norm(s).split(/[^a-z0-9]+/).filter(function (w) { return w.length > 2; })
      .map(function (w) { return SYN[w] || w; });
  }

  function findProducts(msg) {
    var d = data();
    var qWords = words(msg);
    if (!qWords.length) return [];
    var qNorm = norm(msg);
    return d.products.filter(function (p) {
      var name = CW.tx(p, 'name') || p.name || '';
      var pn = norm(name);
      if (pn && (qNorm.indexOf(pn) >= 0 || pn.indexOf(qNorm) >= 0)) return true;
      var hay = norm([name, p.name, CW.tx(p, 'short_desc'), CW.tx(p, 'description'),
        (catOfName(d, p.category_id))].filter(Boolean).join(' '));
      var pWords = words(hay);
      return qWords.some(function (w) {
        if (hay.indexOf(w) >= 0) return true;
        // Coincidencia por raíz (pintura ≈ peinture, blanca ≈ blanche…)
        return pWords.some(function (pw) {
          return pw === w || (w.length >= 4 && pw.indexOf(w.slice(0, 4)) === 0) ||
                 (pw.length >= 4 && w.indexOf(pw.slice(0, 4)) === 0);
        });
      });
    }).slice(0, 5);
  }

  function catOfName(d, id) {
    var c = (d.cats || []).find(function (x) { return x.id === id; });
    return c ? (CW.tx(c, 'name') || c.name) : '';
  }

  function productLine(p, biz) {
    var price = Number(p.promo_price) > 0 && Number(p.promo_price) < Number(p.price)
      ? money(p.promo_price, biz.currency) + ' (antes ' + money(p.price, biz.currency) + ')'
      : (Number(p.price) > 0 ? money(p.price, biz.currency) : t('cat.public.consult'));
    var extra = p.kind === 'service'
      ? (p.duration ? ' · ⏱ ' + esc(p.duration) : '') + (p.modality ? ' · 📍 ' + esc(p.modality) : '')
      : '';
    return '<span class="prod">• <b>' + esc(p.name) + '</b> — ' + price + extra + '</span>';
  }

  function send(raw, label) {
    var msg = String(raw || '').trim();
    if (!msg) return;
    echo(label || msg);
    A.els.input.value = '';
    typing(true);
    setTimeout(function () { typing(false); respond(msg); }, 420);
  }

  function respond(msg) {
    var d = data();
    if (!d.biz) { say(t('as.noCatalog')); return; }
    A.biz = d.biz;

    // Flujo de recopilación de datos
    if (A.state === 'lead') return handleLead(msg);

    // Búsqueda guiada
    if (A.state === 'await_search') {
      A.state = 'idle';
      var found = findProducts(msg);
      if (found.length) return showProducts(found);
      say(t('as.notFound', { q: esc(msg) }),
        { quick: [t('as.q.cats'), t('as.q.human')] });
      return;
    }

    var intent = matchIntent(msg);
    var hits = findProducts(msg);

    // Preguntas sobre un artículo concreto: contestar la opción pedida.
    if (hits.length) {
      if (intent === 'options') return answerOptions(d, hits);
      if (intent === 'stock') return answerStock(d, hits);
      if (intent === 'yieldq') return answerYield(msg);
      if (intent === 'prep') return answerPrep(msg);
      if (intent === 'drying') return answerDrying(msg);
      if (intent === 'customcolor') return answerCustomColor(msg);
      if (intent === 'price') {
        say(t('as.priceAsk'), { quick: [t('as.q.order'), t('as.q.options')] });
        return showProducts(hits);
      }
      return showProducts(hits);
    }

    if (intent === 'greeting') return greet(true);
    if (intent === 'thanks') { say(t('as.thanks'), { quick: [t('as.q.order'), t('as.q.contact')] }); return; }
    if (intent === 'farewell') { say(t('as.farewell')); return; }
    if (intent === 'contact' || intent === 'human') return answerContact(d);
    if (intent === 'location') return answerLocation(d);
    if (intent === 'prep') return answerPrep(msg);
    if (intent === 'yieldq') return answerYield(msg);
    if (intent === 'drying') return answerDrying(msg);
    if (intent === 'customcolor') return answerCustomColor(msg);
    if (intent === 'delivery') return answerDelivery(d);
    if (intent === 'payment') return answerPayment(d);
    if (intent === 'invoice') { say(t('as.invoice'), { quick: [t('as.q.order'), t('as.q.contact')] }); return; }
    if (intent === 'returns') { say(t('as.returns'), { quick: [t('as.q.contact'), t('as.q.order')] }); return; }
    if (intent === 'hours') return answerHours(d);
    if (intent === 'categories') return answerCategories(d);
    if (intent === 'options') return answerOptions(d, null);
    if (intent === 'stock') return answerStock(d, null);
    if (intent === 'discount') return answerDiscounts(d);
    if (intent === 'about') return answerAbout(d);
    if (intent === 'order') return startLead();
    if (intent === 'price') {
      say(t('as.priceAsk'), { quick: [t('as.q.cats'), t('as.q.contact')] });
      return;
    }
    // Sin intención clara: menú de ayuda, nunca silencio.
    say(t('as.fallback'),
      { quick: [t('as.q.cats'), t('as.q.options'), t('as.q.prep'), t('as.q.yield'), t('as.q.hours'), t('as.q.contact'), t('as.q.order')] });
  }

  // --------------------------------------------------------- Respuestas
  function greet(short) {
    var d = data(); var name = d.biz ? d.biz.name : '';
    if (A.els.name) A.els.name.textContent = t('as.title') + (name ? ' · ' + name : '');
    if (A.els.avatar && d.biz) A.els.avatar.textContent = (d.biz.name || 'M').trim().charAt(0).toUpperCase();
    say(t('as.greet', { name: name }),
      { quick: [t('as.q.order'), t('as.q.cats'), t('as.q.options'), t('as.q.prep'), t('as.q.yield'), t('as.q.hours'), t('as.q.contact')] });
  }

  function showProducts(list) {
    var d = data();
    var html = (list.length === 1 ? t('as.foundOne') : t('as.foundMany'));
    html += list.map(function (p) { return productLine(p, d.biz); }).join('');
    html += '<span class="prod">' + t('as.foundAsk') + '</span>';
    say(html, { quick: [t('as.q.order'), t('as.q.cats')] });
  }

  function answerCategories(d) {
    if (!d.cats.length) { say(t('as.noCats'), { quick: [t('as.q.search')] }); return; }
    var byKind = { product: [], service: [] };
    d.cats.forEach(function (c) {
      var n = d.products.filter(function (p) { return p.category_id === c.id; }).length;
      (c.kind === 'service' ? byKind.service : byKind.product).push(esc(c.name) + ' (' + n + ')');
    });
    var html = t('as.catsIntro');
    if (byKind.product.length) html += '<span class="prod">' + t('as.catsProducts') + ': ' + byKind.product.join(', ') + '</span>';
    if (byKind.service.length) html += '<span class="prod">' + t('as.catsServices') + ': ' + byKind.service.join(', ') + '</span>';
    html += '<span class="prod">' + t('as.catsAsk') + '</span>';
    say(html, { quick: [t('as.q.search'), t('as.q.order')] });
  }

  function contactOf(d) {
    return d.contact || { tel: '+212670964030', telText: '+212 670 964 030', wa: '212670964030', mail: 'contact@arijcolor.com', address: 'Casablanca, Marruecos' };
  }

  function answerContact(d) {
    var c = contactOf(d);
    var wa = 'https://wa.me/' + c.wa + '?text=' + encodeURIComponent(t('as.contactWaMsg'));
    say(t('as.contactTitle') +
      '<span class="prod">📞 ' + t('as.phoneL') + ': <b>' + esc(c.telText) + '</b>' +
      '<br>✉️ ' + t('as.mailL') + ': <b>' + esc(c.mail) + '</b>' +
      '<br>📍 ' + t('as.addressL') + ': <b>' + esc(c.address) + '</b>' +
      '<br><a href="' + wa + '" target="_blank" rel="noopener">💬 ' + t('as.waBtn') + '</a></span>',
      { quick: [t('as.q.location'), t('as.q.hours'), t('as.q.order')] });
  }

  function answerLocation(d) {
    var c = contactOf(d);
    say(t('as.location', { address: esc(c.address) }),
      { quick: [t('as.q.hours'), t('as.q.contact'), t('as.q.order')] });
  }

  function optionsOf(p) {
    var out = [];
    [['colors', 'opt.color'], ['sizes', 'opt.size'], ['liters', 'opt.liters'], ['weights', 'opt.weight']]
      .forEach(function (g) {
        var arr = (p.options || {})[g[0]];
        if (Array.isArray(arr) && arr.length) out.push(t(g[1]) + ': ' + arr.join(', '));
      });
    return out;
  }

  function answerOptions(d, hits) {
    var html = '';
    var list = hits && hits.length ? hits : d.products;
    if (hits && hits.length) {
      var blocks = [];
      hits.forEach(function (p) {
        var o = optionsOf(p);
        if (o.length) blocks.push('<b>' + esc(CW.tx(p, 'name')) + '</b><br>' + o.join('<br>'));
      });
      if (!blocks.length) { say(t('as.optionsNone'), { quick: [t('as.q.cats'), t('as.q.contact')] }); return; }
      html = t('as.optionsFor') + '<span class="prod">' + blocks.join('<br><br>') + '</span>';
      say(html, { quick: [t('as.q.order'), t('as.q.contact')] });
      return;
    }
    // Sin artículo concreto: resumen de todas las opciones publicadas.
    var agg = { colors: [], sizes: [], liters: [], weights: [] };
    list.forEach(function (p) {
      Object.keys(agg).forEach(function (k) {
        var arr = (p.options || {})[k];
        if (Array.isArray(arr)) arr.forEach(function (v) { if (v && agg[k].indexOf(v) === -1) agg[k].push(v); });
      });
    });
    var rows = [];
    [['colors', 'opt.colors'], ['sizes', 'opt.sizes'], ['liters', 'opt.liters'], ['weights', 'opt.weights']]
      .forEach(function (g) { if (agg[g[0]].length) rows.push(t(g[1]) + ': ' + esc(agg[g[0]].join(', '))); });
    if (!rows.length) { say(t('as.optionsNone'), { quick: [t('as.q.cats'), t('as.q.contact')] }); return; }
    say(t('as.optionsIntro') + '<span class="prod">' + rows.join('<br>') + '</span><span class="prod">' + t('as.optionsAsk') + '</span>',
      { quick: [t('as.q.cats'), t('as.q.order')] });
  }

  function answerStock(d, hits) {
    if (hits && hits.length) {
      say(hits.map(function (p) {
        return t('as.stockYes', { name: esc(CW.tx(p, 'name')) });
      }).join('<br>'), { quick: [t('as.q.order'), t('as.q.options')] });
      return;
    }
    say(t('as.stockAsk'), { quick: [t('as.q.cats'), t('as.q.search')] });
  }

  function answerDiscounts(d) {
    var promo = d.products.filter(function (p) {
      return Number(p.promo_price) > 0 && Number(p.promo_price) < Number(p.price);
    }).slice(0, 6);
    if (!promo.length) { say(t('as.noDiscounts'), { quick: [t('as.q.cats'), t('as.q.order')] }); return; }
    say(t('as.discounts') + promo.map(function (p) { return productLine(p, d.biz); }).join(''),
      { quick: [t('as.q.order'), t('as.q.cats')] });
  }

  function answerAbout(d) {
    var b = d.biz;
    say(t('as.about', { name: '<b>' + esc(b.name) + '</b>', desc: esc(CW.tx(b, 'description') || '') }),
      { quick: [t('as.q.cats'), t('as.q.order'), t('as.q.contact')] });
  }

  // Abre un documento de la web (ficha técnica, guía o seguridad).
  function openDoc(file) {
    try { window.open('./assets/docs/' + file, '_blank', 'noopener'); } catch (e) {}
  }

  function answerPrep(msg) {
    var n = norm(msg), extra = '';
    if (/humed|humid|moisiss|moho/.test(n)) extra = t('as.prepDamp');
    else if (/madera|bois|wood/.test(n)) extra = t('as.prepWood');
    else if (/metal|metálic|metall/.test(n)) extra = t('as.prepMetal');
    else if (/yeso|platre|plâtre|plaster|nuevo/.test(n)) extra = t('as.prepPlaster');
    say(t('as.prepIntro') +
      '<span class="prod">' + t('as.prepSteps') + '</span>' +
      (extra ? '<span class="prod">' + extra + '</span>' : ''),
      { quick: [t('as.q.order'), t('as.q.contact'),
        { label: '📄 ' + t('doc.guide'), action: function () { openDoc('guia-seleccion.pdf'); } }] });
  }

  function answerYield(msg) {
    var m = norm(msg).match(/(\d+(?:[.,]\d+)?)\s*(m2|m²|metros|metres|mètres|meter)/);
    var html = t('as.yieldInfo');
    if (m) {
      var area = parseFloat(m[1].replace(',', '.'));
      var liters = Math.ceil((area * 2 / 11) * 10) / 10;
      var pot = liters <= 5 ? '5 L' : (liters <= 10 ? '2 × 5 L' : Math.ceil(liters / 5) + ' × 5 L');
      html += '<span class="prod">' + t('as.yieldCalc', { area: area, liters: liters, pot: pot }) + '</span>';
    } else {
      html += '<span class="prod">' + t('as.yieldAsk') + '</span>';
    }
    say(html, { quick: [t('as.q.order'), t('as.q.contact')] });
  }

  function answerDrying() {
    say(t('as.drying') + '<span class="prod">' + t('as.dryingTip') + '</span>',
      { quick: [t('as.q.order'), t('as.q.prep'), t('as.q.contact')] });
  }

  function answerCustomColor() {
    say(t('as.customColor') + '<span class="prod">' + t('as.customColorTip') + '</span>',
      { quick: [t('as.q.order'), t('as.q.contact'),
        { label: '📄 ' + t('doc.guide'), action: function () { openDoc('guia-seleccion.pdf'); } }] });
  }

  function answerDelivery(d) {
    var b = d.biz, parts = [];
    if ((b.delivery && b.delivery !== 'whatsapp') || b.delivery_time || Number(b.delivery_fee) > 0 || b.delivery_notes) {
      parts.push(t('as.deliveryInfo'));
      if (Number(b.delivery_fee) > 0) parts.push(t('as.fee') + ': ' + money(b.delivery_fee, b.currency) + '.');
      if (b.delivery_time) parts.push(t('as.time') + ': ' + esc(b.delivery_time) + '.');
      if (b.delivery_notes) parts.push(esc(b.delivery_notes));
    } else {
      parts.push(t('as.deliveryCoord'));
    }
    say(parts.join(' '), { quick: [t('as.q.order'), t('set.payments')] });
  }

  function answerPayment(d) {
    var pays = d.biz.payments || [];
    say(pays.length ? t('as.payHas') + ' <b>' + esc(pays.join(', ')) + '</b>.' : t('as.payNone'),
      { quick: [t('as.q.order'), t('as.q.hours')] });
  }

  function answerHours(d) {
    var b = d.biz;
    var days = t('as.days');
    var names = days.split(',');
    var work = (b.work_days || []).slice().sort();
    var daysTxt = work.length ? work.map(function (i) { return names[i] || ''; }).join(', ') : t('as.daysNone');
    say(t('as.hours', { days: esc(daysTxt), open: esc(b.open_time || '—'), close: esc(b.close_time || '—') }),
      { quick: [t('as.q.order'), t('as.q.cats')] });
  }

  // ----------------------------------------------------- Recogida de datos
  // Flujo guiado: se avanza pulsando botones y se termina enviando la
  // solicitud a WhatsApp del negocio.
  function startLead() {
    A.state = 'lead'; A.step = 'need'; A.lead = {}; A.saved = false;
    say(t('as.leadNeed'), { quick: needChips() });
  }

  function needChips() {
    var d = data();
    var chips = d.cats.filter(function (c) { return c.active !== false; }).slice(0, 6)
      .map(function (c) { return { label: CW.tx(c, 'name'), value: CW.tx(c, 'name') }; });
    chips.push({ label: t('as.other'), value: '__other' });
    return chips;
  }

  function askDelivery() {
    say(t('as.leadDelivery'), { quick: [
      { label: '🏬 ' + t('as.leadPickup'), value: '__pickup' },
      { label: '🚚 ' + t('as.leadShip'), value: '__ship' }
    ] });
  }

  function askWhen() {
    say(t('as.leadWhen'), { quick: [
      { label: t('as.whenToday'), value: '__today' },
      { label: t('as.whenTomorrow'), value: '__tomorrow' },
      { label: t('as.whenWeek'), value: '__week' },
      { label: t('as.whenNoRush'), value: '__norush' }
    ] });
  }

  function handleLead(msg) {
    var v = String(msg || '').trim();
    if (!v) return;
    switch (A.step) {
      case 'need':
        if (v === '__other') { A.step = 'need_free'; say(t('as.leadNeedFree')); return; }
        A.lead.need = v; A.step = 'delivery'; askDelivery(); return;
      case 'need_free':
        A.lead.need = v; A.step = 'delivery'; askDelivery(); return;
      case 'delivery':
        if (v === '__pickup') { A.lead.delivery = 'pickup'; A.step = 'when'; askWhen(); return; }
        A.lead.delivery = 'ship'; A.step = 'address';
        say(t('as.leadAddress')); return;
      case 'address':
        A.lead.address = v; A.step = 'when'; askWhen(); return;
      case 'when':
        A.lead.when = v === '__today' ? t('as.whenToday')
          : v === '__tomorrow' ? t('as.whenTomorrow')
          : v === '__week' ? t('as.whenWeek') : t('as.whenNoRush');
        A.step = 'name';
        say(t('as.leadStart')); return;
      case 'name':
        if (v.length < 2) { say(t('as.leadNameBad')); return; }
        A.lead.name = v; A.step = 'phone';
        say(t('as.leadName', { name: esc(v) })); return;
      case 'phone':
        if (String(v).replace(/[^\d]/g, '').length < 8) {
          say(t('as.leadPhoneBad'), { quick: [{ label: '🔄 ' + t('as.restart'), action: reset }] });
          return;
        }
        A.lead.phone = v; A.step = 'confirm';
        saySummary(); return;
      default:
        A.state = 'idle'; A.step = null;
    }
  }

  function summaryHTML() {
    var L = A.lead, rows = [];
    rows.push(t('as.needLabel') + ': <b>' + esc(L.need || '—') + '</b>');
    rows.push(t('as.deliveryLabel') + ': <b>' + (L.delivery === 'ship' ? t('as.leadShip') : t('as.leadPickup')) + '</b>');
    if (L.address) rows.push(t('as.addressLabel') + ': <b>' + esc(L.address) + '</b>');
    if (L.when) rows.push(t('as.whenLabel') + ': <b>' + esc(L.when) + '</b>');
    rows.push(t('as.nameLabel') + ': <b>' + esc(L.name || '') + '</b>');
    rows.push(t('as.phoneLabel') + ': <b>' + esc(L.phone || '') + '</b>');
    return '<span class="prod">' + rows.join('<br>') + '</span>';
  }

  function saySummary() {
    say(t('as.summary') + summaryHTML(), { quick: [
      { label: '✅ ' + t('as.send'), action: submitLead },
      { label: '🔄 ' + t('as.restart'), action: reset }
    ] });
  }

  // Número del negocio; si está incompleto se usa el de soporte.
  function phoneDigits(biz) {
    var d = String((biz && biz.whatsapp) || '').replace(/[^\d]/g, '');
    if (d.length < 8) d = String((CW.config && CW.config.supportWhatsapp) || '').replace(/[^\d]/g, '');
    return d;
  }

  function waLink(biz) {
    var L = A.lead;
    var digits = phoneDigits(biz);
    if (!digits) return null;
    var msg = '*NUEVA SOLICITUD*\n' +
      t('as.nameLabel') + ': ' + (L.name || '') + '\n' +
      t('as.phoneLabel') + ': ' + (L.phone || '') + '\n' +
      t('as.needLabel') + ': ' + (L.need || '') + '\n' +
      t('as.deliveryLabel') + ': ' + (L.delivery === 'ship' ? t('as.leadShip') : t('as.leadPickup')) +
      (L.address ? '\n' + t('as.addressLabel') + ': ' + L.address : '') +
      (L.when ? '\n' + t('as.whenLabel') + ': ' + L.when : '') +
      '\n--------------------------------\n' + (biz.name || '');
    return 'https://wa.me/' + digits + '?text=' + encodeURIComponent(msg);
  }

  // El botón «Enviar por WhatsApp» abre WhatsApp y guarda el contacto.
  function submitLead() {
    var d = data(); if (!d.biz) return;
    A.state = 'idle'; A.step = null;
    var wa = waLink(d.biz);
    if (wa) { try { window.open(wa, '_blank', 'noopener'); } catch (e) {} }
    saveLead(wa);
  }

  function saveLead(wa) {
    var d = data();
    var L = A.lead;
    var note = 'Contacto desde el asistente. Necesita: ' + (L.need || '—') +
      (L.delivery ? ' · ' + (L.delivery === 'ship' ? 'Envío a domicilio' : 'Recogida en tienda') : '') +
      (L.when ? ' · ' + L.when : '');
    var order = {
      business_id: d.biz.id, code: CW.store.newOrderCode(),
      customer_name: L.name || '', customer_phone: L.phone || '',
      customer_address: L.address || '', customer_city: '', note: note,
      items: [], subtotal: 0, fee: 0, total: 0, status: 'new'
    };
    var save = (d.biz.id === 'demo') ? Promise.resolve(order) : CW.store.createOrder(order);
    save.then(function () { A.saved = true; }).catch(function () { A.saved = false; });

    var html = t('as.leadDone', { name: esc(L.name || '') }) + summaryHTML();
    if (wa) html += '<span class="prod">' + t('as.leadWa') + ' <a href="' + wa + '" target="_blank" rel="noopener">' + t('as.waOpen') + '</a></span>';
    else html += '<span class="prod">' + t('as.leadNoWa') + '</span>';

    say(html, { quick: [{ label: '🔄 ' + t('as.restart'), action: reset }, t('as.q.cats')] });
  }

  function reset() {
    if (!A.els) return;
    A.state = 'idle'; A.step = null; A.lead = {}; A.saved = false; A.greeted = true;
    A.els.msgs.innerHTML = ''; A.els.quick.innerHTML = '';
    greet();
  }

  // ---------------------------------------------------------------- Init
  // API pública: la cabecera del catálogo abre el asistente desde su botón.
  CW.assistant = {
    open: function () { if (A.els) setOpen(true); },
    close: function () { if (A.els) setOpen(false); },
    reset: function () { reset(); }
  };

  document.addEventListener('DOMContentLoaded', function () {
    build();
    // Re-traduce al cambiar de idioma
    window.addEventListener('cw:lang', function () {
      if (!A.els) return;
      A.els.input.placeholder = t('as.placeholder');
      // Si hay un pedido a medio rellenar, no se borra: se continúa donde iba.
      if (A.state === 'lead') return;
      try {
        A.els.msgs.innerHTML = ''; A.els.quick.innerHTML = '';
        A.greeted = true;
        reset();
      } catch (e) { console.warn('[CW] asistente:', e); }
    });
    // Refresca el nombre cuando el catálogo termine de cargar.
    var tries = 0;
    var iv = setInterval(function () {
      tries++;
      var d = data();
      if (d.biz) {
        if (A.els.name) A.els.name.textContent = 'Asistente · ' + d.biz.name;
        if (A.els.avatar) A.els.avatar.textContent = (d.biz.name || 'M').trim().charAt(0).toUpperCase();
        clearInterval(iv);
      }
      if (tries > 40) clearInterval(iv);
    }, 300);
  });
})(window, document);
