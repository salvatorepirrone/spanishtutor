// Pagine di accesso del tutor: login, invito, account, amministrazione, primo setup. Parlano con /api/auth/*, /api/admin/* e /api/setup.
var Auth = (function () {
  'use strict';

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined && text !== null) e.textContent = text;
    return e;
  }
  function main() { return document.getElementById('main'); }
  function clear(n) { while (n.firstChild) n.removeChild(n.firstChild); return n; }

  function api(method, path, body) {
    return fetch(path, {
      method: method, credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'spagnolo' },
      body: body ? JSON.stringify(body) : undefined
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) { return { status: r.status, ok: r.ok, json: j }; });
    }).catch(function () { return { status: 0, ok: false, json: { error: 'Rete non raggiungibile: riprova.' } }; });
  }

  function field(form, id, label, type, opts) {
    opts = opts || {};
    var l = el('label', 'f', label); l.setAttribute('for', id);
    var i = el('input'); i.id = id; i.name = id; i.type = type || 'text';
    if (opts.autocomplete) i.autocomplete = opts.autocomplete;
    if (opts.autofocus) i.autofocus = true;
    if (type === 'text') { i.autocapitalize = 'off'; i.spellcheck = false; }
    i.required = opts.required !== false;
    form.appendChild(l); form.appendChild(i);
    return i;
  }

  function card(title) {
    var c = el('div', 'card auth');
    if (title) c.appendChild(el('h2', '', title));
    clear(main()).appendChild(c);
    return c;
  }

  function showError(node, text) { node.textContent = text; node.style.display = text ? '' : 'none'; }

  // ---------------------------------------------------------------- accesso
  function login() {
    var c = card('Accedi');
    var err = el('p', 'err'); err.setAttribute('role', 'alert'); showError(err, '');
    c.appendChild(err);
    var f = el('form'); c.appendChild(f);
    var u = field(f, 'username', 'Nome utente', 'text', { autocomplete: 'username', autofocus: true });
    var p = field(f, 'password', 'Password', 'password', { autocomplete: 'current-password' });
    var b = el('button', 'primary', 'Entra'); b.type = 'submit'; b.style.marginTop = '14px';
    f.appendChild(b);
    c.appendChild(el('p', 'muted', 'L\'accesso è solo su invito: se non hai un link, chiedilo a chi gestisce il tutor.'));
    f.addEventListener('submit', function (e) {
      e.preventDefault(); b.disabled = true; showError(err, '');
      api('POST', '/api/auth/login', { username: u.value.trim(), password: p.value }).then(function (r) {
        if (r.ok) { location.href = '/'; return; }
        showError(err, r.json.error || 'Accesso non riuscito.'); b.disabled = false; p.value = '';
      });
    });
  }

  // ---------------------------------------------------------------- invito (scelta della password)
  function invite() {
    var token = new URLSearchParams(location.search).get('t') || '';
    api('GET', '/api/auth/invite?t=' + encodeURIComponent(token)).then(function (r) {
      if (!r.ok) {
        var c0 = card('Link non valido o scaduto');
        c0.appendChild(el('p', '', 'Chiedi a chi gestisce il tutor un nuovo link di invito.'));
        var a = el('a', '', 'Vai all\'accesso'); a.href = '/login.html'; c0.appendChild(a);
        return;
      }
      var c = card('Benvenuto, ' + r.json.username);
      c.appendChild(el('p', '', 'Scegli la tua password per entrare nel tutor di spagnolo.'));
      var err = el('div', 'err'); err.setAttribute('role', 'alert'); showError(err, '');
      c.appendChild(err);
      var f = el('form'); c.appendChild(f);
      var p1 = field(f, 'password', 'Nuova password', 'password', { autocomplete: 'new-password', autofocus: true });
      var p2 = field(f, 'password2', 'Ripetila', 'password', { autocomplete: 'new-password' });
      f.appendChild(el('p', 'muted', 'Almeno 10 caratteri, con almeno tre tra minuscole, maiuscole, numeri e simboli.'));
      var b = el('button', 'primary', 'Salva e entra'); b.type = 'submit';
      f.appendChild(b);
      f.addEventListener('submit', function (e) {
        e.preventDefault(); b.disabled = true; showError(err, '');
        api('POST', '/api/auth/accept', { t: token, password: p1.value, password2: p2.value }).then(function (r2) {
          if (r2.ok) { location.href = '/'; return; }
          showError(err, r2.json.error || 'Non è stato possibile salvare la password.'); b.disabled = false;
        });
      });
    });
  }

  // ---------------------------------------------------------------- il mio account
  function account() {
    api('GET', '/api/auth/me').then(function (r) {
      if (r.status === 401) { location.href = '/login.html'; return; }
      var m = main(); clear(m);
      var back = el('a', 'back', '← Torna al tutor'); back.href = '/'; m.appendChild(back);
      var c = el('div', 'card'); m.appendChild(c);
      c.appendChild(el('h2', '', 'Il mio account'));
      var p = el('p', '', 'Utente: '); p.appendChild(el('b', '', r.json.user)); c.appendChild(p);
      c.appendChild(el('p', 'muted', 'Richieste al tutor oggi: ' + r.json.used + (r.json.limit > 0 ? ' su ' + r.json.limit : ' (nessun limite)') + '.'));

      var c2 = el('div', 'card'); m.appendChild(c2);
      c2.appendChild(el('h3', '', 'Cambia password'));
      var msg = el('p', 'verdict ok'); msg.style.display = 'none'; c2.appendChild(msg);
      var err = el('div', 'err'); err.setAttribute('role', 'alert'); showError(err, ''); c2.appendChild(err);
      var f = el('form'); c2.appendChild(f);
      var o = field(f, 'old', 'Password attuale', 'password', { autocomplete: 'current-password' });
      var n1 = field(f, 'password', 'Nuova password', 'password', { autocomplete: 'new-password' });
      var n2 = field(f, 'password2', 'Ripeti la nuova', 'password', { autocomplete: 'new-password' });
      var b = el('button', 'primary', 'Cambia password'); b.type = 'submit'; b.style.marginTop = '14px'; f.appendChild(b);
      f.addEventListener('submit', function (e) {
        e.preventDefault(); b.disabled = true; showError(err, ''); msg.style.display = 'none';
        api('POST', '/api/auth/password', { old: o.value, password: n1.value, password2: n2.value }).then(function (r2) {
          b.disabled = false;
          if (r2.ok) { msg.textContent = 'Password cambiata. Le altre sessioni aperte sono state chiuse.'; msg.style.display = ''; f.reset(); }
          else showError(err, r2.json.error || 'Non è stato possibile cambiare la password.');
        });
      });

      var out = el('button', '', 'Esci');
      out.addEventListener('click', function () { api('POST', '/api/auth/logout', {}).then(function () { location.href = '/login.html'; }); });
      m.appendChild(out);
    });
  }

  // ---------------------------------------------------------------- amministrazione
  function admin() {
    var m = main();
    var flash = null;

    function render(data) {
      clear(m);
      m.className = 'page wide';
      var back = el('a', 'back', '← Torna al tutor'); back.href = '/'; m.appendChild(back);
      m.appendChild(el('h2', '', 'Accessi'));
      if (flash) {
        m.appendChild(el('p', 'verdict ' + (flash.error ? 'ko' : 'ok'), flash.error || flash.message));
        if (flash.link) {
          var lc = el('div', 'card'); lc.appendChild(el('b', '', 'Link da inviare'));
          var inp = el('input'); inp.type = 'text'; inp.readOnly = true; inp.value = flash.link; inp.style.width = '100%'; inp.style.marginTop = '8px';
          inp.addEventListener('click', function () { inp.select(); });
          lc.appendChild(inp); m.appendChild(lc);
        }
      }
      // invito
      var ic = el('div', 'card'); m.appendChild(ic);
      ic.appendChild(el('h3', '', 'Invita una persona'));
      var f = el('form', 'row'); ic.appendChild(f);
      var name = el('input'); name.type = 'text'; name.placeholder = 'nome utente o email'; name.required = true; name.autocapitalize = 'off'; name.spellcheck = false;
      var role = el('select'); role.setAttribute('aria-label', 'Ruolo');
      [['user', 'user'], ['guest', 'guest (limite basso)'], ['admin', 'admin']].forEach(function (x) { var o = el('option', '', x[1]); o.value = x[0]; role.appendChild(o); });
      var lim = el('input'); lim.type = 'text'; lim.inputMode = 'numeric'; lim.placeholder = 'limite/giorno'; lim.className = 'num';
      var go = el('button', 'primary', 'Crea invito'); go.type = 'submit';
      f.appendChild(name); f.appendChild(role); f.appendChild(lim); f.appendChild(go);
      ic.appendChild(el('p', 'muted', 'Il limite conta le richieste a Claude per persona (0 = nessun limite). Predefinito: 150 per user, 30 per guest.'));
      f.addEventListener('submit', function (e) { e.preventDefault(); act({ do: 'invite', user: name.value, role: role.value, limit: lim.value }); });

      // elenco
      var uc = el('div', 'card'); m.appendChild(uc);
      uc.appendChild(el('h3', '', 'Utenti'));
      var wrap = el('div', 'tablewrap'); uc.appendChild(wrap);
      var tb = el('table', 'tbl'); wrap.appendChild(tb);
      var hr = el('tr'); ['Utente', 'Ruolo', 'Limite', ''].forEach(function (h) { hr.appendChild(el('th', '', h)); });
      var th = el('thead'); th.appendChild(hr); tb.appendChild(th);
      var body = el('tbody'); tb.appendChild(body);
      data.users.forEach(function (u) {
        var tr = el('tr');
        var c1 = el('td'); c1.appendChild(el('b', '', u.user));
        if (u.user === data.me) c1.appendChild(el('span', 'muted', ' (tu)'));
        var last = u.last_login ? new Date(u.last_login * 1000).toLocaleString('it-IT') : '—';
        c1.appendChild(el('div', 'muted', u.status + ' · ultimo accesso ' + last));
        tr.appendChild(c1);

        var c2 = el('td'); var sel = el('select'); sel.setAttribute('aria-label', 'Ruolo');
        ['admin', 'user', 'guest'].forEach(function (r) { var o = el('option', '', r); o.value = r; if (r === u.role) o.selected = true; sel.appendChild(o); });
        sel.addEventListener('change', function () { act({ do: 'role', user: u.user, role: sel.value }); });
        c2.appendChild(sel); tr.appendChild(c2);

        var c3 = el('td'); var lf = el('form', 'inline');
        var li = el('input'); li.type = 'text'; li.inputMode = 'numeric'; li.value = String(u.limit); li.className = 'num'; li.setAttribute('aria-label', 'Limite giornaliero');
        var lb = el('button', 'small', 'Ok'); lb.type = 'submit';
        lf.appendChild(li); lf.appendChild(lb);
        lf.addEventListener('submit', function (e) { e.preventDefault(); act({ do: 'limit', user: u.user, limit: li.value }); });
        c3.appendChild(lf); c3.appendChild(el('div', 'muted', 'oggi: ' + u.used)); tr.appendChild(c3);

        var c4 = el('td', 'acts');
        function btn(label, doit, confirmText) {
          var b = el('button', 'small', label);
          b.addEventListener('click', function () { if (!confirmText || confirm(confirmText)) act({ do: doit, user: u.user }); });
          c4.appendChild(b);
        }
        btn('Nuovo link', 'link');
        if (u.disabled) btn('Riattiva', 'enable');
        else if (u.user !== data.me) btn('Disattiva', 'disable');
        if (u.user !== data.me) btn('Elimina', 'delete', 'Eliminare ' + u.user + ' e i suoi dati?');
        tr.appendChild(c4);
        body.appendChild(tr);
      });
    }

    function load() {
      api('GET', '/api/admin/users').then(function (r) {
        if (r.status === 401) { location.href = '/login.html'; return; }
        if (r.status === 403) { clear(m).appendChild(el('div', 'card', 'Questa pagina è riservata agli amministratori.')); return; }
        render(r.json);
      });
    }
    function act(body) {
      api('POST', '/api/admin/users', body).then(function (r) {
        flash = r.ok ? r.json : { error: r.json.error || 'Operazione non riuscita.' };
        load();
      });
    }
    load();
  }

  // ---------------------------------------------------------------- primo amministratore
  function setup() {
    var c = card('Primo amministratore');
    c.appendChild(el('p', 'muted', 'Serve il token di setup configurato come variabile SETUP_TOKEN su Netlify. Funziona solo finché non esiste un amministratore.'));
    var err = el('p', 'err'); showError(err, ''); c.appendChild(err);
    var f = el('form'); c.appendChild(f);
    var u = field(f, 'username', 'Nome utente (o email)', 'text', { autofocus: true });
    var t = field(f, 'token', 'Token di setup', 'password', { autocomplete: 'off' });
    var b = el('button', 'primary', 'Crea invito amministratore'); b.type = 'submit'; b.style.marginTop = '14px'; f.appendChild(b);
    var out = el('div'); c.appendChild(out);
    f.addEventListener('submit', function (e) {
      e.preventDefault(); b.disabled = true; showError(err, ''); clear(out);
      api('POST', '/api/setup', { username: u.value.trim(), token: t.value }).then(function (r) {
        b.disabled = false;
        if (!r.ok) { showError(err, r.json.error || 'Non riuscito.'); return; }
        out.appendChild(el('p', 'verdict ok', 'Apri questo link per scegliere la password (vale 7 giorni, si usa una volta sola):'));
        var a = el('a', '', r.json.link); a.href = r.json.link; out.appendChild(a);
        t.value = '';
      });
    });
  }

  return { login: login, invite: invite, account: account, admin: admin, setup: setup };
})();
