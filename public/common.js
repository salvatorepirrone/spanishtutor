// Parti comuni del tutor: chiamate all'API, voce, router a schede.
var SP = (function () {
  'use strict';
  var API = '/api';
  var sp = { sections: {}, catalog: null, stats: null, current: null };

  sp.$ = function (id) { return document.getElementById(id); };

  // el('div', 'classe', 'testo') — il testo entra sempre come testo, mai come HTML.
  sp.el = function (tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined && text !== null) e.textContent = text;
    return e;
  };

  sp.clear = function (node) { while (node.firstChild) node.removeChild(node.firstChild); return node; };

  sp.pref = function (k, v) {
    try { if (v === undefined) return localStorage.getItem('sp_' + k); localStorage.setItem('sp_' + k, v); } catch (e) {}
    return null;
  };

  sp.call = function (body) {
    return fetch(API, {
      method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'spagnolo' }, body: JSON.stringify(body)
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (r.status === 401) { location.href = '/login.html'; throw new Error(j.error || 'Sessione scaduta'); }
        if (!r.ok) throw new Error(j.error || ('Errore ' + r.status));
        if (j.stats) sp.setStats(j.stats);
        return j;
      });
    });
  };

  // Nome utente con i collegamenti all'account (e agli accessi, per gli admin) e il pulsante Esci.
  sp.renderMe = function (me) {
    var box = sp.clear(sp.$('me'));
    if (!me) return;
    var a = sp.el('a', '', '👤 ' + me.user); a.href = '/account.html'; a.title = 'Il mio account';
    box.appendChild(a);
    if (me.role === 'admin') { var ad = sp.el('a', '', 'Accessi'); ad.href = '/admin.html'; box.appendChild(ad); }
    var b = sp.el('button', 'small', 'Esci');
    b.style.background = 'rgba(255,255,255,.16)'; b.style.color = '#fff'; b.style.border = '0';
    b.addEventListener('click', function () {
      fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin', headers: { 'X-Requested-With': 'spagnolo' } })
        .then(function () { location.href = '/login.html'; });
    });
    box.appendChild(b);
  };

  // Riga sotto il titolo: livello, settimana del piano e tema; cliccandola si apre il piano completo.
  sp.renderWeek = function () {
    var c = sp.catalog, box = sp.clear(sp.$('week'));
    if (!c) return;
    var w = c.plan[c.week];
    var a = sp.el('a', '', 'Livello ' + c.profile.label + ' · settimana ' + (c.week + 1) + ' di ' + c.plan.length + ' · ' + w.title);
    a.href = '#/piano'; a.title = 'Vedi il piano completo';
    box.appendChild(a);
  };

  // Rilegge lo stato dal server (dopo un cambio di livello) e aggiorna testata e piano.
  sp.reload = function () {
    return fetch(API, { credentials: 'same-origin' }).then(function (r) { return r.json(); }).then(function (c) {
      sp.catalog = c; sp.setStats(c.stats); sp.renderMe(c.me); sp.renderWeek();
      return c;
    });
  };

  sp.setStats = function (s) {
    if (!s) return;
    sp.stats = s;
    sp.$('days').textContent = s.daysLeft;
    sp.$('streak').textContent = s.streak;
    sp.$('today').textContent = s.todayTurns;
  };

  // Mostra un indicatore di attesa in un contenitore e restituisce una funzione per toglierlo.
  sp.loading = function (node, text) {
    var w = sp.el('div', 'card muted');
    w.appendChild(sp.el('span', 'spin'));
    w.appendChild(document.createTextNode(text || 'Un momento…'));
    node.appendChild(w);
    return function () { if (w.parentNode) w.parentNode.removeChild(w); };
  };

  sp.shuffle = function (a) {
    a = a.slice();
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  };

  // ---- Voce
  var voices = [];
  function loadVoices() { voices = (window.speechSynthesis ? speechSynthesis.getVoices() : []).filter(function (v) { return /^es/i.test(v.lang); }); }
  if (window.speechSynthesis) { loadVoices(); speechSynthesis.onvoiceschanged = loadVoices; }
  sp.say = function (text, then, slow) {
    if (!window.speechSynthesis) { if (then) then(); return; }
    speechSynthesis.cancel();
    var u = new SpeechSynthesisUtterance(text);
    u.lang = 'es-ES'; u.rate = slow ? 0.75 : 0.95;
    var v = voices.filter(function (x) { return /es[-_]ES/i.test(x.lang); })[0] || voices[0];
    if (v) u.voice = v;
    u.onend = u.onerror = function () { if (then) then(); };
    speechSynthesis.speak(u);
  };
  sp.stopSpeaking = function () { if (window.speechSynthesis) speechSynthesis.cancel(); };

  // Pulsante "ascolta" accanto a un testo spagnolo.
  sp.speakButton = function (text) {
    if (!window.speechSynthesis) return document.createTextNode('');
    var b = sp.el('button', 'small', '🔊');
    b.title = 'Ascolta'; b.setAttribute('aria-label', 'Ascolta');
    b.addEventListener('click', function (ev) { ev.preventDefault(); sp.say(text); });
    return b;
  };

  // ---- Confronto tra risposte: ignora maiuscole e spazi; gli accenti mancanti sono "quasi giusti".
  // Confronto tra la risposta data e quella attesa: ignora maiuscole, spazi (anche all'inizio, alla fine, doppi o
  // "strani" come lo spazio non separabile o i caratteri invisibili di alcune tastiere), punteggiatura e la forma
  // degli accenti (e + accento combinato = é).
  function norm(s) {
    return String(s).normalize('NFC').toLowerCase()
      .replace(/[\u200b-\u200d\u2060\u00ad\ufeff]/g, '')
      .replace(/[.,;:!?¡¿"'“”‘’«»()…–—]/g, '')
      .replace(/\s+/g, ' ').trim();
  }
  function strip(s) { return norm(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ñ/g, 'n'); }
  // Chi risponde spesso scrive anche il soggetto ("yo fui"): lo si accetta se la risposta attesa non lo contiene.
  function withoutSubject(s) { return s.replace(/^(yo|tú|usted|nosotros|nosotras|vosotros|vosotras|ellos|ellas|ustedes|ella)\s+/, ''); }
  // Ritorna 'ok', 'accent' (giusta ma senza accenti/ñ) oppure 'no'.
  // Con opts.articles (test di vocabolario) l'articolo si può omettere ("aguacate" per "el aguacate") e una risposta attesa
  // può avere varianti separate da "/", "," o ";" e commenti tra parentesi ("ganar (ue)").
  function noArticle(s) { return s.replace(/^(el|la|los|las|un|una|unos|unas)\s+/, ''); }
  function variants(s) {
    var base = String(s).replace(/\([^)]*\)/g, ' ').split(/[\/,;]/), out = [String(s)];
    base.forEach(function (x) { x = x.trim(); if (x) { out.push(x); out.push(noArticle(norm(x))); } });
    return out;
  }
  sp.compare = function (given, answer, alts, opts) {
    var all = [answer].concat(alts || []);
    var cands = [norm(given)];
    var ws = withoutSubject(cands[0]);
    if (ws && ws !== cands[0]) cands.push(ws);
    if (opts && opts.articles) {
      var na = noArticle(cands[0]);
      if (na && na !== cands[0]) cands.push(na);
      all = all.reduce(function (acc, x) { return acc.concat(variants(x)); }, []);
    }
    if (!cands[0]) return 'no';
    var i, j, c;
    for (c = 0; c < cands.length; c++) for (i = 0; i < all.length; i++) if (norm(all[i]) === cands[c]) return 'ok';
    for (c = 0; c < cands.length; c++) {
      var gs = strip(cands[c]);
      for (j = 0; j < all.length; j++) if (strip(all[j]) === gs) return 'accent';
    }
    return 'no';
  };

  // ---- Router a schede: #/sezione/parametro
  function route() {
    var parts = (location.hash || '#/home').replace(/^#\/?/, '').split('/');
    var name = parts[0] || 'home';
    if (!sp.sections[name]) name = 'home';
    var arg = parts[1] ? decodeURIComponent(parts[1]) : '';
    if (sp.current && sp.sections[sp.current].unmount) sp.sections[sp.current].unmount();
    sp.stopSpeaking();
    sp.current = name;
    Array.prototype.forEach.call(sp.$('nav').querySelectorAll('a'), function (a) { a.classList.toggle('on', a.getAttribute('data-s') === name); });
    var view = sp.clear(sp.$('view'));
    sp.sections[name].mount(view, arg);
  }

  sp.go = function (name, arg) { location.hash = '#/' + name + (arg ? '/' + encodeURIComponent(arg) : ''); };

  sp.start = function () {
    var view = sp.$('view');
    fetch(API, { credentials: 'same-origin' })
      .then(function (r) {
        if (r.status === 401) { location.href = '/login.html'; throw new Error('Sessione scaduta'); }
        return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || ('Errore ' + r.status)); return j; });
      })
      .then(function (c) {
        sp.catalog = c;
        sp.setStats(c.stats);
        sp.renderMe(c.me);
        sp.renderWeek();
        // Al primo accesso si propone il test di livello, da cui dipende il piano.
        if (c.needsPlacement && (!location.hash || location.hash === '#/home' || location.hash === '#/')) location.hash = '#/benvenuto';
        // Aprendo il sito (indirizzo digitato, segnalibro, link) si parte dalla home, anche se il segnalibro porta a una sezione.
        var navEntry = (performance.getEntriesByType && performance.getEntriesByType('navigation')[0]) || {};
        if (navEntry.type === 'navigate' && location.hash && location.hash !== '#/home' && location.hash !== '#/benvenuto') {
          history.replaceState(null, '', location.pathname + location.search + '#/home');
        }
        window.addEventListener('hashchange', route);
        route();
      })
      .catch(function (e) { view.appendChild(sp.el('div', 'page err', 'Impossibile caricare il tutor: ' + e.message)); });
  };

  return sp;
})();
