// Sezione Test: verifica di livello (20 domande + produzione scritta) e riepilogo dei progressi.
(function () {
  'use strict';
  var el = SP.el;
  var SECTION_LABEL = { tempi: 'Tempi verbali', forme: 'Pronomi, preposizioni e forme', lessico: 'Vocabolario', comprensione: 'Comprensione scritta' };
  var WEIGHT = { A2: 1, B1: 2, B2: 3 };

  function estimate(ratio) {
    return ratio < 0.4 ? 'A2' : ratio < 0.6 ? 'B1-' : ratio < 0.8 ? 'B1' : ratio < 0.92 ? 'B1+' : 'B2';
  }
  var LEVEL_TEXT = {
    'A2': 'A2: base solida da consolidare',
    'B1-': 'appena sotto il B1: ci sei quasi',
    'B1': 'B1: livello raggiunto',
    'B1+': 'B1 pieno, con basi del B2',
    'B2': 'B2: oltre l\'obiettivo'
  };

  function intro(root) {
    var page = el('div', 'page');
    page.appendChild(el('h2', '', 'Test di livello'));
    var c = el('div', 'card');
    c.appendChild(el('p', '', '20 domande a scelta multipla (tempi verbali, forme, vocabolario, comprensione) e un breve testo scritto, valutato dal tutor. Ogni volta le domande sono diverse. Richiede circa 15 minuti.'));
    c.appendChild(el('p', 'muted', 'È una stima indicativa, non una certificazione: serve a vedere i progressi da qui al 2 dicembre. Consiglio un test a settimana.'));
    var start = el('button', 'primary', 'Inizia il test');
    c.appendChild(start);
    var area = el('div');
    page.appendChild(c);
    page.appendChild(area);
    start.addEventListener('click', function () {
      start.disabled = true;
      var stop = SP.loading(c, 'Preparo il test… (può richiedere fino a un minuto)');
      SP.call({ action: 'test' }).then(function (t) { stop(); SP.clear(page); runTest(page, t); })
        .catch(function (e) { stop(); c.appendChild(el('div', 'err', e.message)); start.disabled = false; });
    });
    progress(page);
    root.appendChild(page);
  }

  function progress(page) {
    var s = SP.stats;
    page.appendChild(el('div', 'sec-title', 'I miei progressi'));
    var c = el('div', 'card');
    c.appendChild(el('div', '', 'Giorni di pratica: ' + s.totalDays + ' · Serie attuale: ' + s.streak + ' · Parole nel mazzo: ' + s.vocabCount));
    if (s.tests && s.tests.length) {
      c.appendChild(el('h3', '', 'Test svolti'));
      var bars = el('div', 'bars');
      s.tests.forEach(function (t) {
        var b = el('div'), pct = Math.round(100 * t.correct / t.total);
        b.style.height = Math.max(4, Math.round(0.5 * pct)) + 'px'; b.title = t.t + ': ' + pct + '%';
        bars.appendChild(b);
      });
      c.appendChild(bars);
      var ul = el('ul');
      s.tests.slice().reverse().forEach(function (t) {
        ul.appendChild(el('li', '', t.t + ' — ' + t.correct + '/' + t.total + (t.level ? ' · stima ' + t.level : '') + (t.writing >= 0 ? ' · scritto ' + t.writing + '/10' : '')));
      });
      c.appendChild(ul);
    } else {
      c.appendChild(el('p', 'muted', 'Non hai ancora fatto nessun test: il primo ti dà il punto di partenza.'));
    }
    var keys = Object.keys(s.topErrors || {});
    if (keys.length) {
      c.appendChild(el('h3', '', 'Dove sbagli di più'));
      var ul2 = el('ul'); keys.forEach(function (k) { ul2.appendChild(el('li', '', k + ': ' + s.topErrors[k])); }); c.appendChild(ul2);
    }
    if (s.recentErrors && s.recentErrors.length) {
      c.appendChild(el('h3', '', 'Ultimi errori'));
      s.recentErrors.forEach(function (e) {
        var d = el('div', 'mist');
        d.appendChild(el('span', 'w', e.orig)); d.appendChild(document.createTextNode(' → ')); d.appendChild(el('span', 'r', e.corr));
        if (e.note) d.appendChild(el('div', 'muted', e.note));
        c.appendChild(d);
      });
      var ex = el('button', '', 'Esercitati sui miei errori');
      ex.addEventListener('click', function () { SP.go('esercizi', 'errori'); });
      c.appendChild(ex);
    }
    page.appendChild(c);
  }

  function runTest(page, t) {
    page.appendChild(el('h2', '', 'Test di livello'));
    var items = t.items, picked = [];
    // Raggruppa per sezione mantenendo l'ordine di arrivo.
    var order = [], bySec = {};
    items.forEach(function (it, i) {
      var sec = it.section && SECTION_LABEL[it.section] ? it.section : 'forme';
      it.section = sec;
      if (!bySec[sec]) { bySec[sec] = []; order.push(sec); }
      bySec[sec].push(i);
    });
    var submit = el('button', 'primary', '');
    function refresh() {
      var left = items.length - picked.filter(function (x) { return x !== undefined; }).length;
      submit.disabled = left > 0;
      submit.textContent = left > 0 ? 'Rispondi a tutte le domande (' + left + ' mancanti)' : 'Concludi il test';
    }
    var n = 0;
    order.forEach(function (sec) {
      page.appendChild(el('div', 'sec-title', SECTION_LABEL[sec]));
      bySec[sec].forEach(function (i) {
        var it = items[i];
        var q = el('div', 'card q');
        q.appendChild(el('div', 'muted', 'Domanda ' + (++n)));
        if (it.text) q.appendChild(el('div', 'passage', it.text));
        q.appendChild(el('div', 'stem', it.q));
        var btns = [];
        it.options.forEach(function (o, k) {
          var b = el('button', 'choice', o);
          b.addEventListener('click', function () {
            picked[i] = k;
            btns.forEach(function (x, j) { x.classList.toggle('sel', j === k); });
            refresh();
          });
          btns.push(b); q.appendChild(b);
        });
        page.appendChild(q);
      });
    });

    page.appendChild(el('div', 'sec-title', 'Produzione scritta (facoltativa, consigliata)'));
    var w = el('div', 'card');
    w.appendChild(el('div', 'stem', t.writing));
    var ta = el('textarea'); ta.rows = 6; ta.style.width = '100%'; ta.style.maxHeight = 'none';
    ta.placeholder = 'Scrivi in spagnolo…';
    w.appendChild(ta);
    page.appendChild(w);

    var fin = el('div', 'card');
    fin.appendChild(submit);
    page.appendChild(fin);
    refresh();

    submit.addEventListener('click', function () {
      submit.disabled = true;
      var text = ta.value.trim();
      var after = function (writing) { showResult(page, t, picked, writing, text); };
      if (text.length < 20) { after(null); return; }
      var stop = SP.loading(fin, 'Il tutor legge il tuo testo…');
      SP.call({ action: 'writing', prompt: t.writing, text: text })
        .then(function (r) { stop(); after(r); })
        .catch(function (e) { stop(); fin.appendChild(el('div', 'err', e.message + ' Puoi riprovare o svuotare il testo per concludere senza.')); submit.disabled = false; });
    });
  }

  function showResult(page, t, picked, writing, userText) {
    SP.clear(page);
    var items = t.items, correct = 0, wsum = 0, wmax = 0, secs = {}, errors = [];
    items.forEach(function (it, i) {
      var ok = picked[i] === it.answer, w = WEIGHT[it.level] || 2;
      wmax += w; if (ok) { correct++; wsum += w; }
      var s = secs[it.section] = secs[it.section] || { correct: 0, total: 0 };
      s.total++; if (ok) s.correct++;
      if (!ok) errors.push({ orig: it.options[picked[i]] || '', corr: it.options[it.answer], note: (it.q + ' ' + (it.why || '')).trim() });
    });
    var level = estimate(wsum / wmax);

    page.appendChild(el('h2', '', 'Risultato'));
    var top = el('div', 'card');
    top.appendChild(el('div', 'result', correct + ' / ' + items.length));
    top.appendChild(el('div', '', 'Stima: ' + (LEVEL_TEXT[level] || level)));
    Object.keys(secs).forEach(function (k) {
      var s = secs[k], row = el('div'), bar = el('div', 'progressbar'), f = el('i');
      f.style.width = Math.round(100 * s.correct / s.total) + '%'; bar.appendChild(f);
      row.appendChild(el('div', 'muted', SECTION_LABEL[k] + ': ' + s.correct + '/' + s.total));
      row.appendChild(bar); top.appendChild(row);
    });
    page.appendChild(top);

    if (writing) {
      var wc = el('div', 'card');
      wc.appendChild(el('h3', '', 'Testo scritto: ' + writing.score + '/10 · ' + writing.level));
      if (writing.comment) wc.appendChild(el('p', '', writing.comment));
      writing.corrections.forEach(function (c) {
        var d = el('div', 'mist');
        d.appendChild(el('span', 'w', c.original)); d.appendChild(document.createTextNode(' → ')); d.appendChild(el('span', 'r', c.corrected));
        if (c.note) d.appendChild(el('div', 'muted', c.note));
        wc.appendChild(d);
      });
      if (writing.improved) {
        wc.appendChild(el('h3', '', 'Versione migliorata'));
        var p = el('p', '', writing.improved + ' ');
        p.appendChild(SP.speakButton(writing.improved));
        wc.appendChild(p);
      }
      page.appendChild(wc);
    }

    var rev = el('div', 'card');
    rev.appendChild(el('h3', '', 'Rivedi le risposte'));
    items.forEach(function (it, i) {
      var ok = picked[i] === it.answer, d = el('div', 'verdict ' + (ok ? 'ok' : 'ko'));
      d.style.marginBottom = '8px';
      d.appendChild(el('div', '', (i + 1) + '. ' + (it.text ? it.text + ' — ' : '') + it.q));
      d.appendChild(el('div', '', ok ? '✓ ' + it.options[it.answer] : '✗ ' + (it.options[picked[i]] || '—') + '  →  ' + it.options[it.answer]));
      if (it.why) d.appendChild(el('div', 'why', it.why));
      rev.appendChild(d);
    });
    page.appendChild(rev);

    var again = el('button', 'primary', 'Torna ai progressi');
    again.addEventListener('click', function () { SP.clear(SP.$('view')); SP.sections.test.mount(SP.$('view')); });
    page.appendChild(again);

    SP.call({
      action: 'test_result', correct: correct, total: items.length, sections: secs, level: level,
      writing: writing ? writing.score : -1, errors: errors
    }).catch(function () {});
  }

  SP.sections.test = { mount: function (root) { intro(root); } };
})();
