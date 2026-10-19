// Sezione Vocabolario: temi con liste di parole e mazzo personale con ripasso a intervalli (flashcard).
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
      deckCard.appendChild(el('div', '', r.total + ' parole nel mazzo · ' + r.dueTotal + ' da ripassare oggi'));
      var bars = el('div', 'bars'), max = Math.max.apply(null, r.boxes.concat([1]));
      r.boxes.forEach(function (n, i) {
        var b = el('div'); b.style.height = Math.max(4, Math.round(50 * n / max)) + 'px'; b.title = 'Livello ' + (i + 1) + ': ' + n + ' parole';
        bars.appendChild(b);
      });
      deckCard.appendChild(bars);
      deckCard.appendChild(el('div', 'muted', 'Livelli di memoria: da "nuove" (sinistra) a "sicure" (destra).'));
      var go = el('button', 'primary', r.dueTotal ? 'Ripassa ora (' + Math.min(r.dueTotal, 20) + ')' : 'Niente da ripassare oggi');
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
      var addAll = el('button', 'primary', 'Aggiungi tutto al mazzo');
      var study = el('button', '', 'Aggiungi e ripassa');
      row.appendChild(addAll); row.appendChild(study);
      page.appendChild(row);
      var msg = el('div', 'muted'); page.appendChild(msg);
      function add(goReview) {
        addAll.disabled = study.disabled = true;
        SP.call({ action: 'deck_add', theme: id }).then(function (a) {
          if (goReview) { SP.go('vocabolario', 'ripasso'); return; }
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
        if (w.ex) c2.appendChild(el('div', 'muted', w.ex + (w.exit ? ' — ' + w.exit : '')));
        tr.appendChild(c1); tr.appendChild(c2); body.appendChild(tr);
      });
      tb.appendChild(body); card.appendChild(tb); page.appendChild(card);
    }).catch(function (e) { done(); page.appendChild(el('div', 'err', e.message)); });
  }

  function review(root) {
    var page = el('div', 'page');
    var back = el('a', 'back', '← Vocabolario'); back.href = '#/vocabolario';
    page.appendChild(back);
    root.appendChild(page);
    var area = el('div'); page.appendChild(area);
    var done = SP.loading(area, 'Preparo le carte…');
    SP.call({ action: 'deck', limit: 20 }).then(function (r) {
      done();
      var cards = SP.shuffle(r.due), i = 0, known = 0;
      if (!cards.length) { area.appendChild(el('div', 'card', 'Nessuna parola da ripassare adesso. Torna domani o aggiungi nuove parole.')); return; }
      function show() {
        SP.clear(area);
        if (i >= cards.length) {
          var c = el('div', 'card');
          c.appendChild(el('div', 'result', known + ' / ' + cards.length));
          c.appendChild(el('div', 'muted', 'Le parole che non sapevi torneranno presto; quelle che sai tornano con intervalli sempre più lunghi.'));
          var again = el('button', 'primary', 'Ancora'); again.style.marginTop = '8px';
          again.addEventListener('click', function () { SP.clear(root); review(root); });
          c.appendChild(again);
          area.appendChild(c);
          return;
        }
        var card = cards[i], toSpanish = Math.random() < 0.4;
        var bar = el('div', 'progressbar'), f = el('i'); f.style.width = Math.round(100 * i / cards.length) + '%'; bar.appendChild(f);
        area.appendChild(bar);
        var c = el('div', 'card flash');
        var front = el('div', 'big', toSpanish ? card.it : card.es);
        c.appendChild(front);
        if (!toSpanish) { var sb = SP.speakButton(card.es); c.appendChild(sb); }
        c.appendChild(el('div', 'small', toSpanish ? 'Come si dice in spagnolo?' : 'Che cosa significa?'));
        var reveal = el('button', 'primary', 'Mostra'), back2 = el('div');
        c.appendChild(reveal); c.appendChild(back2);
        area.appendChild(c);
        if (!toSpanish && !SP.pref('no_autoplay')) SP.say(card.es);
        reveal.addEventListener('click', function () {
          reveal.remove();
          back2.appendChild(el('div', 'big', toSpanish ? card.es : card.it));
          if (toSpanish) { back2.appendChild(SP.speakButton(card.es)); SP.say(card.es); }
          if (card.ex) back2.appendChild(el('div', 'small', card.ex));
          var row = el('div', 'row'); row.style.justifyContent = 'center'; row.style.marginTop = '10px';
          var no = el('button', '', 'Non lo sapevo'), yes = el('button', 'primary', 'Lo sapevo');
          function rate(ok) {
            no.disabled = yes.disabled = true;
            if (ok) known++;
            SP.call({ action: 'deck_review', es: card.es, known: ok }).catch(function () {});
            i++; show();
          }
          no.addEventListener('click', function () { rate(false); });
          yes.addEventListener('click', function () { rate(true); });
          row.appendChild(no); row.appendChild(yes); back2.appendChild(row);
        });
      }
      show();
    }).catch(function (e) { done(); area.appendChild(el('div', 'err', e.message)); });
  }

  SP.sections.vocabolario = {
    mount: function (root, arg) {
      if (arg === 'ripasso') review(root);
      else if (arg) theme(root, arg);
      else overview(root);
    }
  };
})();
