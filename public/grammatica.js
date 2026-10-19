// Sezione Grammatica: indice per sezioni e lezioni (generate una volta e conservate sul server).
(function () {
  'use strict';
  var el = SP.el;

  function index(root) {
    var page = el('div', 'page');
    page.appendChild(el('h2', '', 'Grammatica'));
    page.appendChild(el('p', 'muted', 'Scegli un argomento: spiegazione in italiano, tabelle, esempi ed errori tipici. In fondo a ogni lezione trovi gli esercizi su quell\'argomento.'));
    var prog = (SP.stats && SP.stats.exProgress) || {};
    var rec = (SP.catalog.plan[SP.catalog.week] || {}).topics || [];
    if (rec.length) {
      page.appendChild(el('div', 'sec-title', 'Per te questa settimana'));
      var rg = el('div', 'grid');
      rec.forEach(function (id) {
        var f = findTopic(id);
        if (!f) return;
        var a = el('a', 'tile', f.t.title);
        a.href = '#/grammatica/' + encodeURIComponent(id);
        a.appendChild(el('div', 'sub', f.s.title));
        rg.appendChild(a);
      });
      page.appendChild(rg);
    }
    SP.catalog.grammar.forEach(function (s) {
      page.appendChild(el('div', 'sec-title', s.title));
      var g = el('div', 'grid');
      s.topics.forEach(function (t) {
        var a = el('a', 'tile', t.title);
        a.href = '#/grammatica/' + encodeURIComponent(t.id);
        var p = prog[t.id];
        if (p && p.done) {
          a.classList.add('done');
          a.appendChild(el('div', 'sub', 'Esercizi: ' + p.correct + '/' + p.done + ' giuste'));
        }
        g.appendChild(a);
      });
      page.appendChild(g);
    });
    root.appendChild(page);
  }

  function findTopic(id) {
    var found = null;
    SP.catalog.grammar.forEach(function (s) { s.topics.forEach(function (t) { if (t.id === id) found = { t: t, s: s }; }); });
    return found;
  }

  function renderLesson(page, L) {
    var box = el('div', 'lesson');
    box.appendChild(el('div', 'muted', L.section));
    box.appendChild(el('h2', '', L.title));
    if (L.summary) box.appendChild(el('p', 'summary', L.summary));
    L.blocks.forEach(function (b) {
      var c = el('div', 'card');
      if (b.heading) c.appendChild(el('h3', '', b.heading));
      if (b.text) c.appendChild(el('div', '', b.text));
      if (b.table && b.table.headers.length) {
        var wrap = el('div', 'tablewrap'), tb = el('table'), thead = el('thead'), tr = el('tr');
        b.table.headers.forEach(function (h) { tr.appendChild(el('th', '', h)); });
        thead.appendChild(tr); tb.appendChild(thead);
        var body = el('tbody');
        b.table.rows.forEach(function (r) { var row = el('tr'); r.forEach(function (cell) { row.appendChild(el('td', '', cell)); }); body.appendChild(row); });
        tb.appendChild(body); wrap.appendChild(tb); c.appendChild(wrap);
      }
      b.examples.forEach(function (x) {
        var e = el('div', 'ex'), line = el('div', 'es', x.es + ' ');
        line.appendChild(SP.speakButton(x.es));
        e.appendChild(line);
        if (x.it) e.appendChild(el('div', 'it', x.it));
        c.appendChild(e);
      });
      box.appendChild(c);
    });
    if (L.mistakes.length) {
      var m = el('div', 'card');
      m.appendChild(el('h3', '', 'Errori tipici'));
      L.mistakes.forEach(function (x) {
        var d = el('div', 'mist');
        d.appendChild(el('span', 'w', x.wrong)); d.appendChild(document.createTextNode(' → ')); d.appendChild(el('span', 'r', x.right));
        if (x.why) d.appendChild(el('div', 'muted', x.why));
        m.appendChild(d);
      });
      box.appendChild(m);
    }
    if (L.tips.length) {
      var t = el('div', 'card');
      t.appendChild(el('h3', '', 'Per ricordare'));
      var ul = el('ul'); L.tips.forEach(function (x) { ul.appendChild(el('li', '', x)); }); t.appendChild(ul);
      box.appendChild(t);
    }
    var go = el('div', 'row');
    var ex = el('button', 'primary', 'Esercitati su questo argomento');
    ex.addEventListener('click', function () { SP.go('esercizi', L.id); });
    var chat = el('button', '', 'Parlane nella conversazione');
    chat.addEventListener('click', function () { SP.go('conversazione'); });
    go.appendChild(ex); go.appendChild(chat);
    box.appendChild(go);
    page.appendChild(box);
  }

  function lesson(root, id) {
    var page = el('div', 'page');
    var back = el('a', 'back', '← Tutti gli argomenti'); back.href = '#/grammatica';
    page.appendChild(back);
    root.appendChild(page);
    var f = findTopic(id);
    if (!f) { page.appendChild(el('div', 'err', 'Argomento non trovato.')); return; }
    var done = SP.loading(page, 'Preparo la lezione… (la prima volta ci vuole qualche secondo, poi resta salvata)');
    SP.call({ action: 'grammar', topic: id })
      .then(function (r) { done(); renderLesson(page, r.lesson); })
      .catch(function (e) {
        done();
        page.appendChild(el('div', 'err', e.message));
        var retry = el('button', '', 'Riprova');
        retry.addEventListener('click', function () { SP.clear(root); lesson(root, id); });
        page.appendChild(retry);
      });
  }

  SP.sections.grammatica = {
    mount: function (root, arg) { if (arg) lesson(root, arg); else index(root); }
  };
})();
