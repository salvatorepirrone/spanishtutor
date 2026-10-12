// Primo accesso: si sceglie come stabilire il livello di partenza (test di ingresso o autovalutazione).
(function () {
  'use strict';
  var el = SP.el;

  var CHOICES = [
    { level: 'A2', title: 'Parto dalle basi', text: 'So presentarmi e fare frasi semplici, ma i passati e i pronomi mi mettono in difficoltà.' },
    { level: 'B1-', title: 'Appena sotto il B1', text: 'Mi faccio capire ma sbaglio spesso tempi del passato, ser/estar e pronomi.' },
    { level: 'B1', title: 'B1', text: 'Me la cavo nelle situazioni comuni; voglio consolidare subjuntivo e frasi complesse.' },
    { level: 'B1+', title: 'Più del B1', text: 'Parlo con una certa scioltezza; voglio puntare al B2.' }
  ];

  function mount(root) {
    var page = el('div', 'page');
    var name = SP.catalog && SP.catalog.me ? SP.catalog.me.user : '';
    page.appendChild(el('h2', '', 'Benvenuto' + (name ? ', ' + name : '')));
    page.appendChild(el('p', '', 'Prima di cominciare ho bisogno di sapere a che punto sei, così preparo un piano di 8 settimane e adatto conversazione, esercizi e lezioni al tuo livello.'));

    var test = el('div', 'card');
    test.appendChild(el('h3', '', 'Consigliato: test di ingresso'));
    test.appendChild(el('p', 'muted', '20 domande a scelta multipla e un breve testo scritto, circa 15 minuti. Il risultato fissa il tuo livello di partenza.'));
    var go = el('button', 'primary', 'Inizia il test');
    go.addEventListener('click', function () { SP.go('test', 'placement'); });
    test.appendChild(go);
    page.appendChild(test);

    page.appendChild(el('div', 'sec-title', 'Oppure scegli tu il livello'));
    var area = el('div');
    CHOICES.forEach(function (c) {
      var b = el('button', 'tile', '');
      b.style.width = '100%'; b.style.marginBottom = '8px'; b.style.cursor = 'pointer';
      b.appendChild(el('div', '', c.title));
      b.appendChild(el('div', 'sub', c.text));
      b.addEventListener('click', function () {
        Array.prototype.forEach.call(area.querySelectorAll('button'), function (x) { x.disabled = true; });
        SP.call({ action: 'profile_set', level: c.level, source: 'self' })
          .then(function () { return SP.reload(); })
          .then(function () { SP.go('piano'); })
          .catch(function (e) {
            area.appendChild(el('div', 'err', e.message));
            Array.prototype.forEach.call(area.querySelectorAll('button'), function (x) { x.disabled = false; });
          });
      });
      area.appendChild(b);
    });
    page.appendChild(area);
    page.appendChild(el('p', 'muted', 'Potrai rifare il test quando vuoi e aggiornare il piano.'));
    root.appendChild(page);
  }

  SP.sections.benvenuto = { mount: mount };
})();
