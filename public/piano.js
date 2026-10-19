// Il mio piano: otto settimane in base al livello, con gli argomenti consigliati per ciascuna.
(function () {
  'use strict';
  var el = SP.el;

  function topicTitle(id) {
    var found = null;
    SP.catalog.grammar.forEach(function (s) { s.topics.forEach(function (t) { if (t.id === id) found = t.title; }); });
    return found;
  }

  function mount(root) {
    var c = SP.catalog;
    var page = el('div', 'page');
    page.appendChild(el('h2', '', 'Il mio piano'));
    page.appendChild(el('p', '', 'Livello di partenza: ' + c.profile.label + ' · iniziato il ' + c.profile.start.split('-').reverse().join('/') + ' · ' + c.stats.daysLeft + ' giorni al 2 dicembre.'));

    var row = el('div', 'row');
    var retest = el('button', 'primary', 'Rifai il test di livello');
    retest.addEventListener('click', function () { SP.go('test', 'normal'); });
    var change = el('button', '', 'Cambia livello a mano');
    change.addEventListener('click', function () { SP.go('benvenuto'); });
    row.appendChild(retest); row.appendChild(change);
    page.appendChild(row);

    c.plan.forEach(function (w, i) {
      var card = el('div', 'card');
      if (i === c.week) card.style.borderLeft = '4px solid var(--accent)';
      card.appendChild(el('div', 'muted', 'Settimana ' + (i + 1) + (i === c.week ? ' · questa settimana' : i < c.week ? ' · fatta' : '')));
      card.appendChild(el('h3', '', w.title));
      card.appendChild(el('div', '', w.focus));
      if (w.topics && w.topics.length) {
        var t = el('div', 'row'); t.style.marginTop = '8px';
        w.topics.forEach(function (id) {
          var title = topicTitle(id);
          if (!title) return;
          var a = el('a', 'tile', title);
          a.href = '#/grammatica/' + encodeURIComponent(id);
          a.style.padding = '4px 10px'; a.style.fontSize = '13px'; a.style.borderRadius = '999px';
          t.appendChild(a);
        });
        card.appendChild(t);
      }
      page.appendChild(card);
    });
    root.appendChild(page);
  }

  SP.sections.piano = { mount: mount };
})();
