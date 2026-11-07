// Pulsante «Feedback» presente in tutte le pagine del tutor: chi lo usa scrive una segnalazione che va nel registro letto dall'amministratore.
(function () {
  'use strict';
  var el = SP.el;
  var KINDS = [['errore', 'Qualcosa non funziona o è sbagliato'], ['contenuto', 'Esercizio, lezione o correzione sbagliati'], ['idea', 'Un\'idea o una richiesta'], ['altro', 'Altro']];

  function open() {
    if (document.getElementById('fb-overlay')) return;
    var ov = el('div', 'fb-overlay'); ov.id = 'fb-overlay';
    var box = el('form', 'fb-box');
    box.setAttribute('role', 'dialog'); box.setAttribute('aria-label', 'Invia un feedback');
    box.appendChild(el('h3', '', 'Invia un feedback'));
    box.appendChild(el('p', 'muted', 'Scrivi cosa non va o cosa vorresti: arriva direttamente a chi sviluppa il tutor. La pagina in cui ti trovi viene allegata.'));
    var kind = el('select'); kind.setAttribute('aria-label', 'Tipo di segnalazione');
    KINDS.forEach(function (k) { var o = el('option', '', k[1]); o.value = k[0]; kind.appendChild(o); });
    var text = el('textarea'); text.rows = 5; text.maxLength = 2000; text.placeholder = 'Per esempio: nell\'esercizio sul passato mi dà sbagliata una risposta giusta…';
    text.setAttribute('aria-label', 'Testo del feedback'); text.required = true;
    var msg = el('div', 'fb-msg');
    var row = el('div', 'row');
    var send = el('button', 'primary', 'Invia'); send.type = 'submit';
    var cancel = el('button', '', 'Annulla'); cancel.type = 'button';
    row.appendChild(send); row.appendChild(cancel);
    [kind, text, msg, row].forEach(function (n) { box.appendChild(n); });
    ov.appendChild(box); document.body.appendChild(ov);
    text.focus();

    function close() { if (ov.parentNode) ov.parentNode.removeChild(ov); document.removeEventListener('keydown', onKey); }
    function onKey(e) { if (e.key === 'Escape') close(); }
    document.addEventListener('keydown', onKey);
    cancel.addEventListener('click', close);
    ov.addEventListener('click', function (e) { if (e.target === ov) close(); });
    box.addEventListener('submit', function (e) {
      e.preventDefault();
      if (text.value.trim().length < 3) { msg.className = 'fb-msg err'; msg.textContent = 'Scrivi qualche parola in più.'; return; }
      send.disabled = true; msg.className = 'fb-msg'; msg.textContent = 'Invio…';
      SP.call({ action: 'feedback', kind: kind.value, text: text.value, page: location.hash || '#/home',
        device: (window.innerWidth || 0) + 'x' + (window.innerHeight || 0) + ' · ' + (navigator.userAgent || '').slice(0, 80) })
        .then(function () { msg.className = 'fb-msg ok'; msg.textContent = 'Grazie! Il tuo feedback è stato registrato.'; text.disabled = true; setTimeout(close, 1400); })
        .catch(function (err) { send.disabled = false; msg.className = 'fb-msg err'; msg.textContent = err.message; });
    });
  }

  var b = el('button', 'fb-btn', '💬 Feedback');
  b.type = 'button'; b.title = 'Segnala un problema o lascia un suggerimento';
  b.addEventListener('click', open);
  document.body.appendChild(b);
})();
