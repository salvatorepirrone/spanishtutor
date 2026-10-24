// Sezione Verbi: tabelle di coniugazione con le forme irregolari evidenziate, e allenamento.
(function () {
  'use strict';
  var el = SP.el;
  var TENSES = SPV.TENSES;

  function setHash(arg) { SP.go('verbi', arg || ''); }

  // ---------------------------------------------------------------- pagina principale
  function mount(root, arg) {
    var page = el('div', 'page');
    page.appendChild(el('h2', '', 'Verbi'));
    page.appendChild(el('p', 'muted', 'Cerca un verbo per vederne la coniugazione: le forme irregolari sono evidenziate. Poi allenati a scriverle.'));

    // Ricerca
    var card = el('div', 'card');
    var row = el('div', 'row');
    var input = el('input'); input.type = 'text'; input.placeholder = 'Un verbo all\'infinito, per esempio tener'; input.setAttribute('aria-label', 'Verbo');
    input.autocapitalize = 'off'; input.autocomplete = 'off'; input.spellcheck = false;
    input.setAttribute('list', 'verbi-elenco');
    var dl = el('datalist'); dl.id = 'verbi-elenco';
    SPV.list().forEach(function (v) { var o = el('option'); o.value = v; dl.appendChild(o); });
    var go = el('button', 'primary', 'Coniuga');
    var train = el('button', '', 'Allenati');
    row.appendChild(input); row.appendChild(go); row.appendChild(train);
    card.appendChild(row); card.appendChild(dl);

    card.appendChild(el('div', 'muted', 'Irregolari più importanti:')).style.marginTop = '10px';
    var chips = el('div', 'chipsrow');
    SPV.irregularTop.forEach(function (v) {
      var b = el('button', 'small chipv', v);
      b.addEventListener('click', function () { setHash(v); });
      chips.appendChild(b);
    });
    card.appendChild(chips);
    page.appendChild(card);

    var area = el('div'); page.appendChild(area);
    root.appendChild(page);

    function search() {
      var p = SPV.parse(input.value);
      if (!p) { SP.clear(area); area.appendChild(el('div', 'err', 'Scrivi un verbo all\'infinito (che finisce in -ar, -er o -ir).')); return; }
      setHash(p.inf);
    }
    go.addEventListener('click', search);
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') search(); });
    train.addEventListener('click', function () { setHash('allenati'); });

    if (arg === 'allenati') { input.value = ''; practiceSetup(area, null); }
    else if (arg) {
      var p = SPV.parse(arg);
      if (p) { input.value = p.inf; show(area, p); } else area.appendChild(el('div', 'err', 'Verbo non valido.'));
    } else {
      area.appendChild(el('div', 'sec-title', 'Tutti i verbi dell\'elenco'));
      var all = el('div', 'chipsrow');
      SPV.list().forEach(function (v) {
        var b = el('button', 'small chipv', v);
        b.addEventListener('click', function () { setHash(v); });
        all.appendChild(b);
      });
      area.appendChild(all);
    }
  }

  // ---------------------------------------------------------------- tabelle
  // Verbo non presente nell'elenco: niente tabelle a sorpresa (potrebbe non esistere o essere irregolare). Si propongono i verbi
  // simili e, solo se la parola sembra un infinito, si può chiedere la coniugazione regolare.
  function unknown(area, parsed) {
    SP.clear(area);
    var card = el('div', 'card');
    card.appendChild(el('h2', '', parsed.inf));
    var ok = SPV.plausible(parsed.inf);
    card.appendChild(el('p', '', ok
      ? 'Non trovo «' + parsed.inf + '» tra i verbi dell\'elenco. Non ti mostro una coniugazione alla cieca: il verbo potrebbe non esistere, oppure essere irregolare.'
      : '«' + parsed.inf + '» non sembra un verbo all\'infinito.'));
    var sug = SPV.suggest(parsed.inf, 6);
    if (sug.length) {
      card.appendChild(el('div', 'muted', 'Forse cercavi:'));
      var chips = el('div', 'chipsrow');
      sug.forEach(function (v) {
        var b = el('button', 'small chipv', v);
        b.addEventListener('click', function () { setHash(v); });
        chips.appendChild(b);
      });
      card.appendChild(chips);
    } else {
      card.appendChild(el('p', 'muted', 'Nessun verbo simile nell\'elenco.'));
    }
    if (ok) {
      var force = el('button', '', 'Mostra comunque la coniugazione regolare'); force.style.marginTop = '12px';
      force.addEventListener('click', function () { show(area, { inf: parsed.inf, reflexive: parsed.reflexive, forceRegular: true }); });
      card.appendChild(force);
    }
    area.appendChild(card);
  }

  function show(area, parsed) {
    SP.clear(area);
    var c = SPV.full(parsed.inf);
    if (!c.known && !parsed.forceRegular) { unknown(area, parsed); return; }
    var head = el('div', 'card');
    var h = el('h2', '', c.inf + ' ');
    h.appendChild(SP.speakButton(c.inf));
    head.appendChild(h);
    if (c.it) head.appendChild(el('div', 'muted', c.it));
    if (parsed.reflexive) head.appendChild(el('div', 'muted', 'È un verbo riflessivo (' + c.inf + 'se): si coniuga come ' + c.inf + ' aggiungendo il pronome me, te, se, nos, os, se davanti alla forma (me lavo, te lavas…).'));
    var nl = el('ul');
    c.notes.forEach(function (n) { nl.appendChild(el('li', '', n)); });
    head.appendChild(nl);
    var gp = el('div');
    gp.appendChild(document.createTextNode('Gerundio: '));
    gp.appendChild(el('b', c.irrGer ? 'irr' : '', c.gerundio));
    gp.appendChild(document.createTextNode(' · Participio: '));
    gp.appendChild(el('b', c.irrPart ? 'irr' : '', c.participio));
    head.appendChild(gp);
    var row = el('div', 'row'); row.style.marginTop = '10px';
    var tr = el('button', 'primary', 'Allenati su ' + c.inf);
    tr.addEventListener('click', function () { setHash('allenati:' + c.inf); });
    row.appendChild(tr);
    head.appendChild(row);
    area.appendChild(head);

    var group = '', grid = null;
    TENSES.forEach(function (t) {
      if (t.group !== group) { group = t.group; area.appendChild(el('div', 'sec-title', group)); grid = el('div', 'tgrid'); area.appendChild(grid); }
      var card = el('div', 'card tense');
      var title = el('h3', '', t.label);
      title.style.marginTop = '0';
      card.appendChild(title);
      card.appendChild(el('div', 'muted', t.use));
      var tb = el('table', 'conj'), body = el('tbody');
      c[t.key].forEach(function (form, i) {
        var tr = el('tr');
        tr.appendChild(el('td', 'pn', t.key === 'impAfirmativo' || t.key === 'impNegativo' ? SPV.IMP_PERSONS[i] : SPV.PERSONS[i]));
        var td = el('td', c.irregular[t.key][i] ? 'irr' : '', form + ' ');
        td.appendChild(SP.speakButton(form));
        tr.appendChild(td);
        body.appendChild(tr);
      });
      tb.appendChild(body); card.appendChild(tb);
      grid.appendChild(card);
    });
    var leg = el('p', 'muted'); leg.appendChild(el('span', 'irr', 'Evidenziato')); leg.appendChild(document.createTextNode(' = forma diversa da quella che avrebbe un verbo regolare.'));
    area.appendChild(leg);
  }

  // ---------------------------------------------------------------- allenamento
  var PRACTICE_TENSES = ['presente', 'indefinido', 'imperfecto', 'futuro', 'condicional', 'perfecto', 'subjPresente', 'impAfirmativo'];

  function practiceSetup(area, onlyVerb) {
    SP.clear(area);
    var card = el('div', 'card');
    card.appendChild(el('h3', '', 'Allenamento' + (onlyVerb ? ': ' + onlyVerb : '')));
    card.appendChild(el('p', 'muted', 'Ti do un verbo, un tempo e una persona: scrivi la forma corretta.'));

    var pool = el('select'); pool.setAttribute('aria-label', 'Verbi');
    [['top', 'Irregolari principali'], ['all', 'Tutti i verbi dell\'elenco']].forEach(function (o) { var op = el('option', '', o[1]); op.value = o[0]; pool.appendChild(op); });
    if (onlyVerb) { var op = el('option', '', 'Solo ' + onlyVerb); op.value = 'one'; pool.insertBefore(op, pool.firstChild); pool.value = 'one'; }
    card.appendChild(pool);

    card.appendChild(el('div', 'muted', 'Tempi:')).style.marginTop = '10px';
    var checks = el('div', 'opts');
    var boxes = {};
    PRACTICE_TENSES.forEach(function (k) {
      var t = TENSES.filter(function (x) { return x.key === k; })[0];
      var l = el('label'), c = document.createElement('input');
      c.type = 'checkbox'; c.checked = k === 'presente' || k === 'indefinido';
      boxes[k] = c; l.appendChild(c); l.appendChild(document.createTextNode(' ' + t.label)); checks.appendChild(l);
    });
    card.appendChild(checks);

    var n = el('select'); n.setAttribute('aria-label', 'Numero');
    [10, 15, 20].forEach(function (k) { var o = el('option', '', k + ' domande'); o.value = k; n.appendChild(o); });
    n.style.marginTop = '10px';
    card.appendChild(n);

    var go = el('button', 'primary', 'Comincia'); go.style.marginTop = '10px'; go.style.display = 'block';
    var err = el('div', 'err');
    card.appendChild(go); card.appendChild(err);
    area.appendChild(card);
    var run = el('div'); area.appendChild(run);

    go.addEventListener('click', function () {
      var tenses = PRACTICE_TENSES.filter(function (k) { return boxes[k].checked; });
      if (!tenses.length) { err.textContent = 'Scegli almeno un tempo.'; return; }
      err.textContent = '';
      var verbs = pool.value === 'one' ? [onlyVerb] : pool.value === 'all' ? SPV.list() : SPV.irregularTop;
      SP.clear(run);
      practice(run, buildQuestions(verbs, tenses, parseInt(n.value, 10)));
      card.style.display = 'none';
    });
  }

  function buildQuestions(verbs, tenses, n) {
    var qs = [], seen = {}, guard = 0;
    while (qs.length < n && guard++ < n * 20) {
      var v = verbs[Math.floor(Math.random() * verbs.length)];
      var tk = tenses[Math.floor(Math.random() * tenses.length)];
      var c = SPV.full(v);
      var t = TENSES.filter(function (x) { return x.key === tk; })[0];
      var i = Math.floor(Math.random() * t.n);
      var key = v + tk + i;
      if (seen[key]) continue;
      seen[key] = true;
      var person = (tk === 'impAfirmativo' || tk === 'impNegativo') ? SPV.IMP_PERSONS[i] : SPV.PERSONS[i];
      qs.push({ inf: v, it: c.it, tense: t.label, person: person, answer: c[tk][i], irregular: c.irregular[tk][i] });
    }
    return qs;
  }

  function practice(area, qs) {
    var idx = 0, correct = 0, errors = [];
    var bar = el('div', 'progressbar'), fill = el('i'); bar.appendChild(fill);
    area.appendChild(bar);
    var box = el('div'); area.appendChild(box);

    function next() {
      SP.clear(box);
      fill.style.width = Math.round(100 * idx / qs.length) + '%';
      if (idx >= qs.length) { finish(); return; }
      var q = qs[idx];
      var card = el('div', 'card q');
      card.appendChild(el('div', 'muted', (idx + 1) + '/' + qs.length));
      var stem = el('div', 'stem');
      stem.appendChild(el('b', '', q.inf));
      stem.appendChild(document.createTextNode(' · ' + q.tense + ' · '));
      stem.appendChild(el('b', '', q.person));
      card.appendChild(stem);
      if (q.it) card.appendChild(el('div', 'muted', q.it));
      var inp = el('input'); inp.type = 'text'; inp.autocomplete = 'off'; inp.autocapitalize = 'off'; inp.spellcheck = false;
      inp.placeholder = 'Scrivi la forma';
      card.appendChild(inp);
      var verdict = el('div');
      var btn = el('button', 'primary', 'Controlla'); btn.style.marginTop = '8px';
      var answered = false;
      function check() {
        if (answered) { idx++; next(); return; }
        if (!inp.value.trim()) return;
        answered = true; inp.disabled = true;
        var r = SP.compare(inp.value, q.answer);
        var ok = r !== 'no';
        if (ok) correct++; else errors.push({ orig: q.inf + ' (' + q.tense + ', ' + q.person + '): ' + inp.value.trim(), corr: q.answer, note: q.inf + ' · ' + q.tense });
        verdict.className = 'verdict ' + (ok ? 'ok' : 'ko');
        verdict.textContent = r === 'ok' ? 'Giusto! ' + q.answer : r === 'accent' ? 'Giusto, ma attento agli accenti: ' + q.answer : 'Non proprio. Si dice: ' + q.answer;
        if (q.irregular && ok) verdict.appendChild(el('div', 'why', 'Era una forma irregolare: bravo!'));
        btn.textContent = idx + 1 >= qs.length ? 'Vedi il risultato' : 'Avanti';
        btn.focus();
      }
      btn.addEventListener('click', check);
      inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); check(); } });
      card.appendChild(btn); card.appendChild(verdict);
      box.appendChild(card);
      inp.focus();
    }

    function finish() {
      fill.style.width = '100%';
      var c = el('div', 'card');
      c.appendChild(el('div', 'result', correct + ' / ' + qs.length));
      c.appendChild(el('div', 'muted', correct === qs.length ? 'Serie perfetta!' : correct >= qs.length * 0.7 ? 'Buon lavoro: ripassa le forme sbagliate.' : 'Rivedi le tabelle dei verbi che hai sbagliato e riprova.'));
      if (errors.length) {
        c.appendChild(el('h3', '', 'Da rivedere'));
        errors.forEach(function (e) {
          var d = el('div', 'mist');
          d.appendChild(el('span', 'w', e.orig.split(': ').slice(1).join(': ') || e.orig)); d.appendChild(document.createTextNode(' → ')); d.appendChild(el('span', 'r', e.corr));
          d.appendChild(el('div', 'muted', e.note));
          c.appendChild(d);
        });
      }
      var again = el('button', 'primary', 'Un\'altra serie'); again.style.marginTop = '10px';
      again.addEventListener('click', function () { var v = SP.clear(SP.$('view')); SP.sections.verbi.mount(v, decodeURIComponent(location.hash.split('/')[2] || '')); });
      c.appendChild(again);
      box.appendChild(c);
      SP.call({ action: 'record_exercise', topic: 'coniugazione', correct: correct, total: qs.length, errors: errors }).catch(function () {});
    }
    next();
  }

  SP.sections.verbi = {
    mount: function (root, arg) {
      if (arg && arg.indexOf('allenati:') === 0) {
        var page = el('div', 'page');
        var back = el('a', 'back', '← Verbi'); back.href = '#/verbi/' + encodeURIComponent(arg.slice(9)); page.appendChild(back);
        var area = el('div'); page.appendChild(area); root.appendChild(page);
        practiceSetup(area, arg.slice(9));
        return;
      }
      if (arg === 'allenati') {
        var page2 = el('div', 'page');
        var back2 = el('a', 'back', '← Verbi'); back2.href = '#/verbi'; page2.appendChild(back2);
        var area2 = el('div'); page2.appendChild(area2); root.appendChild(page2);
        practiceSetup(area2, null);
        return;
      }
      mount(root, arg);
    }
  };
})();
