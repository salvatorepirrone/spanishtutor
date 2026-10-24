// Sezione Vocabolario: temi con liste di parole e test di scrittura (con ripasso a intervalli sul mazzo personale).
// Nel test si legge il significato in italiano e si scrive la parola in spagnolo; i sinonimi valgono come risposte esatte.
(function () {
  'use strict';
  var el = SP.el;

  function overview(root) {
    var page = el('div', 'page');
    page.appendChild(el('h2', '', 'Vocabolario'));
    var deckCard = el('div', 'card');
    page.appendChild(deckCard);
    page.appendChild(el('div', 'sec-title', 'Temi'));
    var g = el('div', 'grid');
    SP.catalog.themes.forEach(function (t) {
      var a = el('a', 'tile', t.title);
      a.href = '#/vocabolario/' + encodeURIComponent(t.id);
      g.appendChild(a);
    });
    page.appendChild(g);
    root.appendChild(page);

    var done = SP.loading(deckCard, 'Carico il tuo mazzo…');
    SP.call({ action: 'deck', limit: 1 }).then(function (r) {
      done();
      deckCard.appendChild(el('h3', '', 'Il mio mazzo'));
      if (!r.total) {
        deckCard.appendChild(el('p', 'muted', 'Il mazzo è vuoto. Apri un tema e aggiungi le parole, oppure parla nella sezione Conversazione: le parole nuove arrivano qui da sole.'));
        return;
      }
      deckCard.appendChild(el('div', '', r.total + ' parole nel mazzo · ' + r.dueTotal + ' da verificare oggi'));
      var bars = el('div', 'bars'), max = Math.max.apply(null, r.boxes.concat([1]));
      r.boxes.forEach(function (n, i) {
        var b = el('div'); b.style.height = Math.max(4, Math.round(50 * n / max)) + 'px'; b.title = 'Livello ' + (i + 1) + ': ' + n + ' parole';
        bars.appendChild(b);
      });
      deckCard.appendChild(bars);
      deckCard.appendChild(el('div', 'muted', 'Livelli di memoria: da "nuove" (sinistra) a "sicure" (destra). Le parole che sbagli tornano presto, quelle che sai a intervalli sempre più lunghi.'));
      var go = el('button', 'primary', r.dueTotal ? 'Fai il test (' + Math.min(r.dueTotal, 20) + ' parole)' : 'Niente da verificare oggi');
      go.disabled = !r.dueTotal; go.style.marginTop = '8px';
      go.addEventListener('click', function () { SP.go('vocabolario', 'ripasso'); });
      deckCard.appendChild(go);
    }).catch(function (e) { done(); deckCard.appendChild(el('div', 'err', e.message)); });
  }

  function theme(root, id) {
    var page = el('div', 'page');
    var back = el('a', 'back', '← Tutti i temi'); back.href = '#/vocabolario';
    page.appendChild(back);
    root.appendChild(page);
    var done = SP.loading(page, 'Preparo la lista… (la prima volta ci vuole qualche secondo, poi resta salvata)');
    SP.call({ action: 'vocab', theme: id }).then(function (r) {
      done();
      page.appendChild(el('h2', '', r.title));
      var row = el('div', 'row');
      var test = el('button', 'primary', 'Fai il test su questo tema');
      var addAll = el('button', '', 'Aggiungi tutto al mazzo');
      var study = el('button', '', 'Aggiungi e fai il test del mazzo');
      row.appendChild(test); row.appendChild(addAll); row.appendChild(study);
      page.appendChild(row);
      var msg = el('div', 'muted'); page.appendChild(msg);
      test.addEventListener('click', function () { SP.go('vocabolario', 'test:' + id); });
      function add(goTest) {
        addAll.disabled = study.disabled = true;
        SP.call({ action: 'deck_add', theme: id }).then(function (a) {
          if (goTest) { SP.go('vocabolario', 'ripasso'); return; }
          msg.textContent = a.added ? a.added + ' parole aggiunte al mazzo.' : 'Erano già tutte nel mazzo.';
          addAll.disabled = study.disabled = false;
        }).catch(function (e) { msg.textContent = e.message; addAll.disabled = study.disabled = false; });
      }
      addAll.addEventListener('click', function () { add(false); });
      study.addEventListener('click', function () { add(true); });

      var card = el('div', 'card'), tb = el('table', 'words'), body = el('tbody');
      r.words.forEach(function (w) {
        var tr = el('tr'), c1 = el('td', 'es', w.es + ' '), c2 = el('td');
        c1.appendChild(SP.speakButton(w.es));
        c2.appendChild(el('div', '', w.it + (w.type ? ' (' + w.type + ')' : '')));
        if (w.syn && w.syn.length) c2.appendChild(el('div', 'muted', 'Sinonimi: ' + w.syn.join(', ')));
        if (w.ex) c2.appendChild(el('div', 'muted', w.ex + (w.exit ? ' — ' + w.exit : '')));
        tr.appendChild(c1); tr.appendChild(c2); body.appendChild(tr);
      });
      tb.appendChild(body); card.appendChild(tb); page.appendChild(card);
    }).catch(function (e) { done(); page.appendChild(el('div', 'err', e.message)); });
  }

  // ---------------------------------------------------------------- il test
  // cards: [{ es, it, syn?, type? }]. Con opts.deck l'esito aggiorna anche il mazzo (ripasso a intervalli).
  function runTest(area, cards, opts) {
    var idx = 0, results = [];
    var bar = el('div', 'progressbar'), fill = el('i'); bar.appendChild(fill);
    var box = el('div');
    area.appendChild(bar); area.appendChild(box);

    function ask() {
      SP.clear(box);
      fill.style.width = Math.round(100 * idx / cards.length) + '%';
      if (idx >= cards.length) { finish(); return; }
      var card = cards[idx];
      var c = el('div', 'card q');
      c.appendChild(el('div', 'muted', 'Parola ' + (idx + 1) + ' di ' + cards.length));
      c.appendChild(el('div', 'stem', card.it));
      c.appendChild(el('div', 'muted', 'Scrivi la parola in spagnolo' + (card.type ? ' (' + card.type + ')' : '') + '. Valgono anche i sinonimi.'));
      var inp = el('input'); inp.type = 'text'; inp.autocomplete = 'off'; inp.autocapitalize = 'off'; inp.spellcheck = false;
      inp.placeholder = 'La parola in spagnolo'; inp.style.marginTop = '8px';
      c.appendChild(inp);
      var verdict = el('div');
      var row = el('div', 'row'); row.style.marginTop = '8px';
      var btn = el('button', 'primary', 'Controlla'), skip = el('button', '', 'Non lo so');
      row.appendChild(btn); row.appendChild(skip);
      c.appendChild(row); c.appendChild(verdict);
      box.appendChild(c);
      inp.focus();
      var answered = false;

      function show(kind, text, extra) {
        verdict.className = 'verdict ' + kind;
        SP.clear(verdict);
        verdict.appendChild(el('div', '', text));
        if (extra) verdict.appendChild(el('div', 'why', extra));
        verdict.appendChild(SP.speakButton(card.es));
      }
      function next() { idx++; ask(); }
      function check() {
        if (answered) { next(); return; }
        var given = inp.value.trim();
        if (!given) return;
        answered = true; inp.disabled = true; skip.style.display = 'none';
        var exact = SP.compare(given, card.es, [], { articles: true });
        var any = exact !== 'no' ? exact : SP.compare(given, card.es, card.syn || [], { articles: true });
        var rec = { card: card, given: given, ok: false, pending: false, note: '' };
        if (exact !== 'no') {
          rec.ok = true;
          show('ok', exact === 'ok' ? 'Giusto! ' + card.es : 'Giusto, ma attento agli accenti: ' + card.es);
        } else if (any !== 'no') {
          rec.ok = true; rec.note = 'sinonimo';
          show('ok', 'Giusto: «' + given + '» è un sinonimo.', 'La parola in elenco era «' + card.es + '».');
        } else {
          rec.pending = true;
          show('warn', 'Non è la parola in elenco («' + card.es + '»), ma potrebbe essere un sinonimo valido.', 'Lo controllo alla fine del test.');
        }
        results.push(rec);
        btn.textContent = idx + 1 >= cards.length ? 'Vedi il risultato' : 'Avanti';
        btn.focus();
      }
      skip.addEventListener('click', function () {
        if (answered) return;
        answered = true; inp.disabled = true; skip.style.display = 'none';
        results.push({ card: card, given: '', ok: false, pending: false, note: '' });
        show('ko', 'La parola era: ' + card.es);
        btn.textContent = idx + 1 >= cards.length ? 'Vedi il risultato' : 'Avanti';
        btn.focus();
      });
      btn.addEventListener('click', check);
      inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); check(); } });
    }

    function finish() {
      SP.clear(box);
      fill.style.width = '100%';
      var pend = results.filter(function (r) { return r.pending; });
      var wait = pend.length ? SP.loading(box, 'Il tutor controlla le risposte che non coincidevano con l\'elenco…') : null;
      var graded = pend.length
        ? SP.call({ action: 'grade_vocab', items: pend.map(function (r) { return { it: r.card.it, es: r.card.es, type: r.card.type || '', answer: r.given }; }) })
        : Promise.resolve({ results: [] });
      graded.then(function (g) {
        if (wait) wait();
        pend.forEach(function (r, i) {
          var x = g.results[i] || { ok: false, note: '' };
          r.ok = !!x.ok; r.note = x.note || ''; r.pending = false; r.fromTutor = true;
        });
        report();
      }).catch(function (e) {
        if (wait) wait();
        // Se il tutor non risponde le risposte da controllare restano non valutate (contano come errate).
        pend.forEach(function (r) { r.pending = false; r.note = 'non controllata: ' + e.message; });
        report();
      });
    }

    function report() {
      var correct = results.filter(function (r) { return r.ok; }).length;
      var c = el('div', 'card');
      c.appendChild(el('div', 'result', correct + ' / ' + cards.length));
      c.appendChild(el('div', 'muted', correct === cards.length ? 'Test perfetto!' : correct >= cards.length * 0.7 ? 'Buon lavoro: ripassa le parole sbagliate.' : 'Rivedi le parole sbagliate: torneranno presto.'));
      var accepted = results.filter(function (r) { return r.ok && r.note; });
      if (accepted.length) {
        c.appendChild(el('h3', '', 'Risposte accettate come sinonimi'));
        accepted.forEach(function (r) {
          var d = el('div', 'mist');
          d.appendChild(el('span', 'r', r.given)); d.appendChild(document.createTextNode(' per «' + r.card.it + '» (in elenco: ' + r.card.es + ')'));
          if (r.fromTutor && r.note) d.appendChild(el('div', 'muted', r.note));
          c.appendChild(d);
        });
      }
      var wrong = results.filter(function (r) { return !r.ok; });
      if (wrong.length) {
        c.appendChild(el('h3', '', 'Da rivedere'));
        wrong.forEach(function (r) {
          var d = el('div', 'mist');
          if (r.given) { d.appendChild(el('span', 'w', r.given)); d.appendChild(document.createTextNode(' → ')); }
          d.appendChild(el('span', 'r', r.card.es)); d.appendChild(document.createTextNode(' (' + r.card.it + ')'));
          if (r.note) d.appendChild(el('div', 'muted', r.note));
          c.appendChild(d);
        });
      }
      var again = el('button', 'primary', 'Un altro test'); again.style.marginTop = '10px';
      again.addEventListener('click', function () { var v = SP.clear(SP.$('view')); SP.sections.vocabolario.mount(v, decodeURIComponent(location.hash.split('/')[2] || '')); });
      c.appendChild(again);
      box.appendChild(c);

      // salvataggi: mazzo (solo per il test del mazzo) e attività
      if (opts.deck) SP.call({ action: 'deck_review_many', items: results.map(function (r) { return { es: r.card.es, known: r.ok }; }) }).catch(function () {});
      SP.call({ action: 'record_exercise', topic: 'vocabolario', correct: correct, total: cards.length,
        errors: wrong.map(function (r) { return { orig: r.given || '(nessuna risposta)', corr: r.card.es, note: r.card.it }; }) }).catch(function () {});
    }

    ask();
  }

  function testPage(root, mode) {
    var page = el('div', 'page');
    var back = el('a', 'back', '← Vocabolario'); back.href = '#/vocabolario';
    page.appendChild(back);
    page.appendChild(el('h2', '', 'Test di vocabolario'));
    root.appendChild(page);
    var area = el('div'); page.appendChild(area);
    var done = SP.loading(area, 'Preparo il test…');

    if (mode.indexOf('test:') === 0) {                      // test su un tema, senza toccare il mazzo
      SP.call({ action: 'vocab', theme: mode.slice(5) }).then(function (r) {
        done();
        var cards = SP.shuffle(r.words).slice(0, 10);
        runTest(area, cards, { deck: false });
      }).catch(function (e) { done(); area.appendChild(el('div', 'err', e.message)); });
      return;
    }
    SP.call({ action: 'deck', limit: 20 }).then(function (r) {   // test del mazzo: parole da verificare oggi
      done();
      if (!r.due.length) { area.appendChild(el('div', 'card', 'Nessuna parola da verificare adesso. Torna domani o aggiungi nuove parole.')); return; }
      runTest(area, SP.shuffle(r.due), { deck: true });
    }).catch(function (e) { done(); area.appendChild(el('div', 'err', e.message)); });
  }

  SP.sections.vocabolario = {
    mount: function (root, arg) {
      if (arg === 'ripasso' || (arg && arg.indexOf('test:') === 0)) testPage(root, arg);
      else if (arg) theme(root, arg);
      else overview(root);
    }
  };
})();
