// Sezione Esercizi: serie generate sull'argomento scelto; scelta multipla e completamenti corretti subito,
// traduzioni valutate dal tutor.
(function () {
  'use strict';
  var el = SP.el;

  function setup(root, preset) {
    var page = el('div', 'page');
    page.appendChild(el('h2', '', 'Esercizi'));
    page.appendChild(el('p', 'muted', 'Scegli cosa allenare: ogni serie è nuova, generata al momento. Gli errori finiscono nel tuo ripasso.'));

    var card = el('div', 'card');
    var topic = el('select'); topic.setAttribute('aria-label', 'Argomento');
    function add(group, value, label) {
      var o = el('option', '', label); o.value = value;
      (group || topic).appendChild(o);
    }
    var g0 = el('optgroup'); g0.label = 'Consigliati'; topic.appendChild(g0);
    add(g0, 'mix', 'Tema della settimana');
    add(g0, 'errori', 'I miei errori recenti');
    SP.catalog.grammar.forEach(function (s) {
      var g = el('optgroup'); g.label = s.title; topic.appendChild(g);
      s.topics.forEach(function (t) { add(g, t.id, t.title); });
    });
    topic.value = preset || SP.pref('ex_topic') || 'mix';
    if (!topic.value) topic.value = 'mix';

    var kind = el('select'); kind.setAttribute('aria-label', 'Tipo');
    [['misti', 'Tipi misti'], ['scelta', 'Scelta multipla'], ['completa', 'Completa la frase'], ['traduci', 'Traduci in spagnolo']].forEach(function (k) {
      var o = el('option', '', k[1]); o.value = k[0]; kind.appendChild(o);
    });
    kind.value = SP.pref('ex_kind') || 'misti';
    var n = el('select'); n.setAttribute('aria-label', 'Numero');
    [6, 8, 10].forEach(function (k) { var o = el('option', '', k + ' esercizi'); o.value = k; n.appendChild(o); });
    n.value = SP.pref('ex_n') || '8';

    var row = el('div', 'row');
    row.appendChild(topic); row.appendChild(kind); row.appendChild(n);
    card.appendChild(row);
    var go = el('button', 'primary', 'Comincia');
    go.style.marginTop = '10px';
    card.appendChild(go);
    page.appendChild(card);

    var area = el('div');
    page.appendChild(area);
    root.appendChild(page);

    go.addEventListener('click', function () {
      SP.pref('ex_topic', topic.value); SP.pref('ex_kind', kind.value); SP.pref('ex_n', n.value);
      SP.clear(area);
      go.disabled = true;
      var done = SP.loading(area, 'Preparo gli esercizi…');
      SP.call({ action: 'exercises', topic: topic.value, kind: kind.value, n: parseInt(n.value, 10) })
        .then(function (r) { done(); run(area, r, function () { go.disabled = false; }); })
        .catch(function (e) { done(); area.appendChild(el('div', 'err', e.message)); go.disabled = false; });
    });
    if (preset) go.click();
  }

  // Svolge una serie: ogni esercizio ha una scheda; il risultato si calcola alla fine.
  function run(area, set, finished) {
    var items = set.items, states = [];
    var summary = el('div', 'card');
    var bar = el('div', 'progressbar'), fill = el('i'); bar.appendChild(fill);
    summary.appendChild(el('div', 'muted', set.label + ' — ' + items.length + ' esercizi'));
    summary.appendChild(bar);
    area.appendChild(summary);

    function answered() { return states.filter(function (s) { return s && s.answered; }).length; }
    function refresh() {
      fill.style.width = Math.round(100 * answered() / items.length) + '%';
      var need = items.filter(function (it, i) { return it.type !== 'traduci' && !(states[i] && states[i].answered); }).length;
      finish.disabled = need > 0;
      finish.textContent = need > 0 ? 'Rispondi a tutte le domande (' + need + ' mancanti)' : 'Controlla e concludi';
    }

    var finish = el('button', 'primary', '');
    items.forEach(function (it, i) {
      var q = el('div', 'card q'), st = states[i] = { answered: false, ok: null, given: '' };
      q.appendChild(el('div', 'muted', (i + 1) + '/' + items.length));
      q.appendChild(el('div', 'stem', it.q));
      var verdict = el('div');

      if (it.type === 'scelta') {
        var btns = [];
        it.options.forEach(function (o, k) {
          var b = el('button', 'choice', o);
          b.addEventListener('click', function () {
            if (st.answered) return;
            st.answered = true; st.given = o; st.ok = k === it.answer;
            btns.forEach(function (x, j) { x.disabled = true; if (j === it.answer) x.classList.add('right'); else if (j === k) x.classList.add('wrong'); });
            showVerdict(verdict, st.ok ? 'ok' : 'ko', st.ok ? 'Giusto!' : 'Non proprio. Risposta: ' + it.options[it.answer], it.why);
            refresh();
          });
          btns.push(b); q.appendChild(b);
        });
      } else {
        function newInput(placeholder) {
          var x = el('input'); x.type = 'text'; x.autocomplete = 'off'; x.autocapitalize = 'off'; x.spellcheck = false;
          x.placeholder = placeholder;
          return x;
        }
        if (it.type === 'completa') {
          // Una casella per ogni spazio ___: con più spazi la risposta attesa è "prima / seconda" e si confronta una per una.
          var blanks = (it.q.match(/___/g) || []).length;
          var parts = it.answer.split(/\s*[\/;]\s*/).filter(Boolean);
          var multi = blanks > 1 && parts.length === blanks;
          var inps = [];
          for (var k = 0; k < (multi ? blanks : 1); k++) {
            var xi = newInput(multi ? 'Spazio ' + (k + 1) + ' di ' + blanks : 'Scrivi la forma corretta');
            inps.push(xi); q.appendChild(xi);
            if (multi) xi.style.marginBottom = '6px';
          }
          var chk = el('button', '', 'Controlla'); chk.style.marginTop = '8px';
          var doCheck = function () {
            if (st.answered) return;
            var vals = inps.map(function (x) { return x.value.trim(); });
            if (vals.some(function (v) { return !v; })) return;
            var r;
            if (multi) {
              var rs = vals.map(function (v, k) { return SP.compare(v, parts[k]); });
              r = rs.indexOf('no') >= 0 ? 'no' : (rs.indexOf('accent') >= 0 ? 'accent' : 'ok');
              if (r === 'no') r = SP.compare(vals.join(' / '), it.answer, it.alts);   // combinazioni alternative indicate dal tutor
            } else {
              r = SP.compare(vals[0], it.answer, (it.alts || []).concat(parts.length > 1 ? parts : []));
            }
            st.answered = true; st.given = vals.join(' / '); st.ok = r !== 'no';
            inps.forEach(function (x) { x.disabled = true; }); chk.disabled = true;
            var msg = r === 'ok' ? 'Giusto!' : r === 'accent' ? 'Giusto, ma attento agli accenti: ' + it.answer : 'Non proprio. Risposta: ' + it.answer;
            showVerdict(verdict, st.ok ? 'ok' : 'ko', msg, it.why);
            refresh();
          };
          chk.addEventListener('click', doCheck);
          inps.forEach(function (x, k) {
            x.addEventListener('keydown', function (e) {
              if (e.key !== 'Enter') return;
              e.preventDefault();
              if (k < inps.length - 1) inps[k + 1].focus(); else doCheck();
            });
          });
          q.appendChild(chk);
        } else {
          var inp = newInput('Scrivi la traduzione in spagnolo');
          q.appendChild(inp);
          inp.addEventListener('input', function () { st.given = inp.value; });
          q.appendChild(el('div', 'muted', 'Verrà valutata dal tutor alla fine.'));
          st.input = inp;
        }
      }
      q.appendChild(verdict);
      area.appendChild(q);
    });

    var fin = el('div', 'card');
    fin.appendChild(finish);
    area.appendChild(fin);
    refresh();

    finish.addEventListener('click', function () {
      finish.disabled = true;
      var pend = [];
      items.forEach(function (it, i) { if (it.type === 'traduci') pend.push(i); });
      var go = function (grades) {
        var errors = [], correct = 0;
        items.forEach(function (it, i) {
          var st = states[i];
          if (it.type === 'traduci') {
            var g = grades[i] || { ok: false, corrected: it.ref, note: '' };
            st.score = typeof g.score === 'number' ? g.score : (g.ok ? 1 : 0); st.ok = st.score === 1; st.answered = true;
            var v = el('div');
            var host = area.querySelectorAll('.q')[i];
            showVerdict(host.lastChild, st.score === 1 ? 'ok' : st.score > 0 ? 'warn' : 'ko', (st.score === 1 ? 'Giusto' : st.score > 0 ? 'Quasi: ' + fmt(st.score) + ' punti su 1' : 'Da correggere') + (g.corrected ? ' → ' + g.corrected : ''), g.note || it.why);
            if (st.input) st.input.disabled = true;
          }
          correct += st.score !== undefined ? st.score : (st.ok ? 1 : 0);
          if (!st.ok) errors.push({ orig: st.given || '(vuota)', corr: it.type === 'scelta' ? it.options[it.answer] : it.type === 'completa' ? it.answer : (it.ref), note: it.why || it.q });
        });
        SP.clear(fin);
        fin.appendChild(el('div', 'result', fmt(correct) + ' / ' + items.length));
        fin.appendChild(el('div', 'muted', correct === items.length ? 'Serie perfetta!' : correct >= items.length * 0.7 ? 'Buon lavoro, ripassa gli errori qui sopra.' : 'Vale la pena rivedere la grammatica di questo argomento.'));
        var again = el('button', 'primary', 'Un\'altra serie'); again.style.marginTop = '8px';
        again.addEventListener('click', function () { SP.clear(area); finished(); area.parentNode.scrollIntoView(); });
        fin.appendChild(again);
        if (set.topic && set.topic !== 'mix' && set.topic !== 'errori') {
          var lessonBtn = el('button', '', 'Rivedi la lezione'); lessonBtn.style.margin = '8px 0 0 8px';
          lessonBtn.addEventListener('click', function () { SP.go('grammatica', set.topic); });
          fin.appendChild(lessonBtn);
        }
        SP.call({ action: 'record_exercise', topic: set.topic, correct: correct, total: items.length, errors: errors }).catch(function () {});
      };
      if (!pend.length) { go({}); return; }
      var stop = SP.loading(fin, 'Il tutor corregge le traduzioni…');
      SP.call({ action: 'grade', items: pend.map(function (i) { return { q: items[i].q, ref: items[i].ref, answer: states[i].given }; }) })
        .then(function (r) {
          stop();
          var grades = {};
          pend.forEach(function (i, k) { grades[i] = r.results[k]; });
          go(grades);
        })
        .catch(function (e) { stop(); fin.appendChild(el('div', 'err', e.message)); finish.disabled = false; });
    });
  }

  // Punteggio con la virgola e al massimo due decimali (6,25)
  function fmt(x) { return String(Math.round(x * 100) / 100).replace('.', ','); }

  function showVerdict(node, kind, text, why) {
    SP.clear(node);
    node.className = 'verdict ' + kind;
    node.appendChild(el('div', '', text));
    if (why) node.appendChild(el('div', 'why', why));
  }

  SP.sections.esercizi = {
    mount: function (root, arg) { setup(root, arg); }
  };
})();
