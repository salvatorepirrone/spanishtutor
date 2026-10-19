// Home: cos'è il tutor, a che punto sei e accesso rapido alle funzioni.
(function () {
  'use strict';
  var el = SP.el;

  var FEATURES = [
    { to: 'conversazione', icon: '💬', title: 'Conversazione', text: 'Parla o scrivi con il tutor: domande, giochi di ruolo e correzioni dopo ogni frase.' },
    { to: 'esercizi', icon: '✏️', title: 'Esercizi', text: 'Serie nuove ogni volta: scelta multipla, completamenti e traduzioni sugli argomenti che scegli.' },
    { to: 'grammatica', icon: '📖', title: 'Grammatica', text: 'Pronomi, avverbi, tempi verbali e altro: spiegazioni chiare con tabelle ed esempi.' },
    { to: 'vocabolario', icon: '🗂️', title: 'Vocabolario', text: 'Liste per tema e flashcard con ripasso a intervalli, per ricordare davvero le parole.' },
    { to: 'verbi', icon: '🔁', title: 'Verbi', text: 'Coniuga qualsiasi verbo: le forme irregolari sono evidenziate. Poi allenati a scriverle.' },
    { to: 'test', icon: '🎯', title: 'Test', text: 'Verifica il livello con 20 domande e un testo scritto, e guarda i progressi nel tempo.' }
  ];

  function mount(root) {
    var c = SP.catalog, s = SP.stats || c.stats;
    var page = el('div', 'page');

    var hero = el('div', 'hero');
    var name = c.me ? c.me.user : '';
    hero.appendChild(el('h2', '', 'Ciao' + (name ? ', ' + name : '') + ' 👋'));
    hero.appendChild(el('p', '', 'Il tuo tutor personale di spagnolo. Conversi a voce o per iscritto, ricevi correzioni e suggerimenti in spagnolo, ti alleni con esercizi sempre diversi, studi la grammatica, ripassi il vocabolario e misuri i progressi: tutto su misura per il tuo livello.'));
    page.appendChild(hero);

    // Numeri del giorno
    var stats = el('div', 'stats');
    [['📅', s.daysLeft, 'giorni al 2 dicembre'], ['🔥', s.streak, 'giorni di fila'], ['✅', s.todayTurns, 'attività oggi'], ['🗂️', s.deckDue || 0, 'parole da ripassare']].forEach(function (x) {
      var b = el('div', 'stat');
      b.appendChild(el('div', 'n', String(x[1])));
      b.appendChild(el('div', 'l', x[0] + ' ' + x[2]));
      stats.appendChild(b);
    });
    page.appendChild(stats);

    // Piano della settimana
    var w = c.plan[c.week];
    var plan = el('div', 'card plan');
    plan.appendChild(el('div', 'muted', 'Il tuo piano · livello ' + c.profile.label + ' · settimana ' + (c.week + 1) + ' di ' + c.plan.length));
    plan.appendChild(el('h3', '', w.title));
    plan.appendChild(el('div', '', w.focus));
    var row = el('div', 'row'); row.style.marginTop = '10px';
    var go = el('button', 'primary', 'Fai gli esercizi della settimana');
    go.addEventListener('click', function () { SP.go('esercizi', 'mix'); });
    var talk = el('button', '', 'Parla con il tutor');
    talk.addEventListener('click', function () { SP.go('conversazione'); });
    var all = el('button', '', 'Vedi tutto il piano');
    all.addEventListener('click', function () { SP.go('piano'); });
    row.appendChild(go); row.appendChild(talk); row.appendChild(all);
    plan.appendChild(row);
    page.appendChild(plan);

    // Riquadri delle funzioni
    page.appendChild(el('div', 'sec-title', 'Cosa vuoi fare?'));
    var grid = el('div', 'features');
    FEATURES.forEach(function (f) {
      var a = el('a', 'feature');
      a.href = '#/' + f.to;
      a.appendChild(el('div', 'ficon', f.icon));
      a.appendChild(el('div', 'ftitle', f.title));
      a.appendChild(el('div', 'ftext', f.text));
      var extra = '';
      if (f.to === 'vocabolario' && s.deckDue) extra = s.deckDue + ' parole da ripassare oggi';
      if (f.to === 'test' && s.tests && s.tests.length) {
        var t = s.tests[s.tests.length - 1];
        extra = 'Ultimo test: ' + t.correct + '/' + t.total + (t.level ? ' · ' + t.level : '');
      }
      if (f.to === 'esercizi' && s.topErrors && Object.keys(s.topErrors).length) extra = 'Hai errori da ripassare';
      if (extra) a.appendChild(el('div', 'fnote', extra));
      grid.appendChild(a);
    });
    page.appendChild(grid);

    var foot = el('p', 'muted');
    foot.style.marginTop = '18px';
    foot.appendChild(document.createTextNode('Il microfono richiede Chrome, Edge o Safari. '));
    var acc = el('a', '', 'Il mio account'); acc.href = '/account.html';
    foot.appendChild(acc);
    page.appendChild(foot);

    root.appendChild(page);
  }

  SP.sections.home = { mount: mount };
})();
