// Sezione Conversazione: dialogo scritto e a voce con correzioni dopo ogni frase.
(function () {
  'use strict';
  var el = SP.el;
  var ui = null;                 // elementi creati una volta sola e riattaccati a ogni visita
  var history = [];              // {role:'user'|'assistant', text}
  var topic = '';                // argomento della sessione, scelto dal server alla prima risposta
  var busy = false, listening = false, lastVoice = false, rec = null;
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  var secure = window.isSecureContext;

  function opt(id) { return ui[id].checked; }

  function scrollDown() { ui.log.scrollTop = ui.log.scrollHeight; }
  function note(text, cls) { ui.log.appendChild(el('div', cls || 'sys', text)); scrollDown(); }

  function addMsg(role, text) {
    var m = el('div', 'msg ' + (role === 'user' ? 'me' : 'tutor'), text);
    if (role !== 'user' && window.speechSynthesis) {
      var t = el('div', 'tools'), b = el('button', 'small', '🔊 Riascolta');
      b.addEventListener('click', function () { SP.say(text, null, opt('slow')); });
      t.appendChild(b); m.appendChild(t);
    }
    ui.log.appendChild(m); scrollDown();
  }

  function addFeedback(r) {
    var cs = r.corrections || [], card = null;
    if (!cs.length) { card = el('div', 'fb good', '✓ Frase corretta.'); ui.log.appendChild(card); }
    cs.forEach(function (c) {
      card = el('div', 'fb');
      card.appendChild(el('div', 'cat', c.cat));
      var l = el('div');
      l.appendChild(el('span', 'o', c.original)); l.appendChild(document.createTextNode(' → ')); l.appendChild(el('span', 'c', c.corrected));
      card.appendChild(l);
      if (c.note) card.appendChild(el('div', 'n', c.note));
      ui.log.appendChild(card);
    });
    if (r.suggestion) card.appendChild(el('div', 'sug', 'Potresti dire: ' + r.suggestion));
    if (r.vocab && r.vocab.length) card.appendChild(el('div', 'voc', 'Parole utili: ' + r.vocab.map(function (v) { return v.es + ' = ' + v.it; }).join(' · ') + ' (salvate nel vocabolario)'));
    scrollDown();
  }

  var wantListen = false, sendOnEnd = false, committed = '', silenceTimer = null, quickEnds = 0;
  var recActive = false;         // true tra l'avvio e la fine di una sessione del riconoscimento
  var boxFromVoice = false;      // il testo nella casella viene dal microfono (non l'hai scritto tu)

  function setMicUi(on) {
    ui.mic.classList.toggle('on', on);
    ui.mic.textContent = on ? '⏹' : '🎤';
    ui.mic.title = on ? 'Stop: ho finito di parlare' : 'Parla (spagnolo)';
    ui.mic.setAttribute('aria-label', ui.mic.title);
    ui.status.textContent = on ? 'Ti ascolto… premi ⏹ quando hai finito.' : '';
  }

  // Scollega una sessione del riconoscimento: non deve più scrivere nella casella, nemmeno con eventi in ritardo.
  function detach(r) {
    if (!r) return;
    r.onresult = r.onend = r.onerror = r.onstart = null;
    try { r.abort(); } catch (e) {}
  }

  // Ferma l'ascolto; con send=true il testo raccolto viene inviato, altrimenti resta nella casella.
  function stopListening(send) {
    wantListen = false; sendOnEnd = !!send;
    clearTimeout(silenceTimer);
    if (rec && recActive) { try { rec.stop(); return; } catch (e) {} }
    onFinished();   // nessuna sessione attiva (per esempio nella pausa tra due riaperture): si chiude subito
  }

  function onFinished() {
    clearTimeout(silenceTimer);
    var was = listening;
    detach(rec);
    listening = false; rec = null; recActive = false; committed = '';
    if (ui) setMicUi(false);
    var send_ = was && sendOnEnd && ui && ui.box.value.trim() && SP.current === 'conversazione';
    sendOnEnd = false;
    if (send_) { lastVoice = true; send(); }
  }

  // In modalità mani libere una pausa lunga chiude il turno; altrimenti si aspetta sempre il tasto Stop.
  function armSilence() {
    clearTimeout(silenceTimer);
    if (opt('hands')) silenceTimer = setTimeout(function () { stopListening(true); }, 3500);
  }

  // Trascrizione di una sessione. Alcuni browser (soprattutto su telefono) ripetono nei risultati successivi
  // il testo già riconosciuto: se un risultato comincia con il precedente, sostituisce il precedente.
  function transcript(results) {
    var finals = [], interim = '';
    for (var i = 0; i < results.length; i++) {
      var t = String(results[i][0].transcript || '').trim();
      if (!t) continue;
      if (results[i].isFinal) {
        var last = finals.length ? finals[finals.length - 1] : '';
        if (last && t.toLowerCase().indexOf(last.toLowerCase()) === 0) finals[finals.length - 1] = t; else finals.push(t);
      } else interim += (interim ? ' ' : '') + t;
    }
    return { fin: finals.join(' '), interim: interim };
  }

  function beginRecognition() {
    var r = new SR();
    rec = r;
    r.lang = 'es-ES'; r.interimResults = true; r.continuous = true; r.maxAlternatives = 1;
    var startedAt = Date.now();
    r.onstart = function () { if (rec === r) recActive = true; };
    r.onresult = function (e) {
      if (rec !== r) return;     // evento di una sessione vecchia: ignorato
      var t = transcript(e.results);
      ui.box.value = (committed + t.fin + ' ' + t.interim).replace(/\s+/g, ' ').trim();
      boxFromVoice = true;
      ui.box.style.height = 'auto'; ui.box.style.height = Math.min(ui.box.scrollHeight, 120) + 'px';
      armSilence();
    };
    r.onerror = function (e) {
      if (rec !== r) return;
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        wantListen = false; ui.hands.checked = false;
        note('Permesso al microfono negato: abilitalo nelle impostazioni del sito.', 'err');
      } else if (e.error === 'network') {
        wantListen = false;
        note('Il riconoscimento vocale richiede connessione a internet.', 'err');
      }
      // no-speech / aborted: il browser chiude la sessione, sotto la riapriamo finché non premi Stop.
    };
    r.onend = function () {
      if (rec !== r) return;
      recActive = false;
      committed = ui.box.value.trim();
      if (committed) committed += ' ';
      if (wantListen) {
        // Il browser chiude da solo dopo un po' di silenzio: si riapre, a meno che continui a fallire subito.
        quickEnds = Date.now() - startedAt < 500 ? quickEnds + 1 : 0;
        if (quickEnds < 4) {
          detach(r); rec = null;
          setTimeout(function () { if (wantListen && !rec) beginRecognition(); }, 150);
          return;
        }
        wantListen = false;
      }
      onFinished();
    };
    try { r.start(); } catch (e) { wantListen = false; onFinished(); }
  }

  function startListening() {
    if (!SR || !secure || busy || listening) return;
    SP.stopSpeaking();
    wantListen = true; listening = true; quickEnds = 0; recActive = false;
    // Il testo lasciato da un ascolto precedente (suggerimento, errore di rete) non si riporta nella nuova frase:
    // si tiene solo quello che hai scritto tu a mano.
    if (boxFromVoice) { ui.box.value = ''; boxFromVoice = false; }
    committed = ui.box.value.trim() ? ui.box.value.trim() + ' ' : '';
    setMicUi(true);
    beginRecognition();
  }

  function send(opts) {
    opts = opts || {};
    if (busy) return;
    var text = ui.box.value.trim();
    if (!text && !opts.start) return;
    var voice = lastVoice; lastVoice = false;
    if (text) { history.push({ role: 'user', text: text }); addMsg('user', text); ui.box.value = ''; ui.box.style.height = ''; boxFromVoice = false; committed = ''; }
    busy = true; ui.send.disabled = true;
    var wait = el('div', 'sys', '…'); ui.log.appendChild(wait); scrollDown();
    SP.call({ action: 'chat', messages: history, mode: ui.mode.value, scenario: ui.scenario.value, voice: voice, topic: topic })
      .then(function (r) {
        wait.remove();
        if (!topic && r.topic) {
          topic = r.topic;
          note((ui.mode.value === 'conversazione' ? 'Oggi: ' : 'Contesto: ') + r.topic, 'sys');
        }
        if (text) addFeedback(r);
        history.push({ role: 'assistant', text: r.reply });
        addMsg('tutor', r.reply);
        var after = function () { if (opt('hands') && SP.current === 'conversazione') setTimeout(startListening, 250); };
        if (opt('speak')) SP.say(r.reply, after, opt('slow')); else after();
      })
      .catch(function (e) {
        wait.remove(); note(e.message || 'Errore di rete', 'err');
        if (text) { history.pop(); var mine = ui.log.querySelectorAll('.msg.me'); if (mine.length) mine[mine.length - 1].remove(); ui.box.value = text; boxFromVoice = voice; }
      })
      .then(function () { busy = false; ui.send.disabled = false; });
  }

  // Suggerimento in spagnolo. Livello 1: una pista senza dire la parola; livello 2: la parola con un esempio.
  function askHint(level, lastHint) {
    if (busy) return;
    if (listening) stopListening(false);   // il testo detto finora resta nella casella
    var draft = ui.box.value.trim();
    busy = true; ui.send.disabled = ui.hint.disabled = true;
    var wait = el('div', 'sys', '…'); ui.log.appendChild(wait); scrollDown();
    SP.call({ action: 'hint', level: level, draft: draft, previous: lastHint || '', messages: history, scenario: ui.scenario.value })
      .then(function (r) {
        wait.remove();
        var card = el('div', 'fb hint');
        card.appendChild(el('div', 'cat', level === 1 ? 'Pista' : 'La palabra'));
        card.appendChild(el('div', '', r.hint));
        if (level === 1) {
          var more = el('button', 'small', 'No me sale: dímelo');
          more.addEventListener('click', function () { more.remove(); askHint(2, r.hint); });
          card.appendChild(more);
        }
        ui.log.appendChild(card); scrollDown();
        if (opt('speak')) SP.say(r.hint, null, opt('slow'));
      })
      .catch(function (e) { wait.remove(); note(e.message || 'Errore di rete', 'err'); })
      .then(function () { busy = false; ui.send.disabled = ui.hint.disabled = false; });
  }

  // Schermata iniziale: la conversazione non parte da sola, la avvii tu.
  function showIntro() {
    SP.clear(ui.log);
    var c = el('div', 'card');
    c.style.alignSelf = 'center'; c.style.maxWidth = '520px'; c.style.textAlign = 'center';
    c.appendChild(el('h3', '', 'Pronto a parlare?'));
    c.appendChild(el('p', 'muted', 'Scegli sopra la modalità e, se vuoi, lo scenario. Poi premi Inizia: il tutor ti fa la prima domanda. Puoi rispondere con il microfono o scrivendo, e dopo ogni frase ti correggo.'));
    var b = el('button', 'primary', 'Inizia la conversazione');
    b.addEventListener('click', restart);
    c.appendChild(b);
    ui.log.appendChild(c);
    ui.restartBtn.textContent = 'Inizia';
  }

  function restart() {
    ui.restartBtn.textContent = 'Nuova sessione';
    stopListening(false); SP.stopSpeaking();
    history = []; topic = ''; SP.clear(ui.log);
    SP.pref('mode', ui.mode.value); SP.pref('scenario', ui.scenario.value);
    note('Premi 🎤 per parlare o scrivi. Ti correggo dopo ogni frase.');
    send({ start: true });
  }

  function build() {
    ui = {};
    var bar = el('div', 'bar');
    ui.mode = el('select'); ui.mode.setAttribute('aria-label', 'Modalità');
    [['conversazione', 'Conversazione'], ['quiz', 'Quiz di grammatica'], ['ripasso', 'Ripasso dei miei errori']].forEach(function (o) {
      var op = el('option', '', o[1]); op.value = o[0]; ui.mode.appendChild(op);
    });
    ui.scenario = el('select'); ui.scenario.setAttribute('aria-label', 'Scenario');
    SP.catalog.scenarios.forEach(function (s) { var op = el('option', '', s.label); op.value = s.id; ui.scenario.appendChild(op); });
    var restartBtn = el('button', 'primary', 'Inizia'); ui.restartBtn = restartBtn;
    bar.appendChild(ui.mode); bar.appendChild(ui.scenario); bar.appendChild(restartBtn);
    var m = SP.pref('mode'), s = SP.pref('scenario');
    if (m) ui.mode.value = m;
    if (s) ui.scenario.value = s;
    ui.scenario.disabled = ui.mode.value !== 'conversazione';
    ui.mode.addEventListener('change', function () { ui.scenario.disabled = ui.mode.value !== 'conversazione'; });
    restartBtn.addEventListener('click', restart);

    ui.log = el('div'); ui.log.id = 'log'; ui.log.setAttribute('aria-live', 'polite');

    var foot = el('div', 'foot'), row = el('div', 'in');
    ui.mic = el('button', 'mic', '🎤'); ui.mic.title = 'Parla (spagnolo)'; ui.mic.setAttribute('aria-label', 'Parla');
    ui.box = el('textarea'); ui.box.rows = 1; ui.box.placeholder = 'Scrivi in spagnolo…'; ui.box.setAttribute('aria-label', 'Il tuo messaggio');
    ui.hint = el('button', '', '💡'); ui.hint.title = 'Non so una parola: chiedi un suggerimento (in spagnolo)'; ui.hint.setAttribute('aria-label', 'Suggerimento');
    ui.send = el('button', 'primary', 'Invia');
    row.appendChild(ui.mic); row.appendChild(ui.hint); row.appendChild(ui.box); row.appendChild(ui.send);
    ui.status = el('div', 'sys'); ui.status.style.textAlign = 'left'; ui.status.style.minHeight = '18px';
    var opts = el('div', 'opts');
    function check(id, label, def) {
      var l = el('label'), c = document.createElement('input');
      c.type = 'checkbox'; c.checked = def;
      var saved = SP.pref(id); if (saved !== null) c.checked = saved === '1';
      c.addEventListener('change', function () { SP.pref(id, c.checked ? '1' : '0'); if (id === 'hands' && c.checked) ui.speak.checked = true; });
      l.appendChild(c); l.appendChild(document.createTextNode(' ' + label)); opts.appendChild(l);
      ui[id] = c;
    }
    check('speak', 'Leggi le risposte ad alta voce', true);
    check('slow', 'Voce lenta', false);
    check('hands', 'Conversazione a mani libere', false);
    var vn = el('span'); opts.appendChild(vn);
    if (!SR) { ui.mic.disabled = true; ui.hands.disabled = true; vn.textContent = 'Il microfono non è supportato da questo browser: usa Chrome, Edge o Safari.'; }
    else if (!secure) { ui.mic.disabled = true; ui.hands.disabled = true; vn.textContent = 'Il microfono funziona solo su https: apri il sito da QuickConnect.'; }
    foot.appendChild(row); foot.appendChild(ui.status); foot.appendChild(opts);

    ui.mic.addEventListener('click', function () { if (listening) stopListening(true); else startListening(); });
    ui.send.addEventListener('click', function () { if (listening) stopListening(true); else send(); });
    ui.hint.addEventListener('click', function () { askHint(1); });
    ui.box.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } });
    ui.box.addEventListener('input', function () { boxFromVoice = false; ui.box.style.height = 'auto'; ui.box.style.height = Math.min(ui.box.scrollHeight, 120) + 'px'; });

    ui.parts = [bar, ui.log, foot];
  }

  SP.sections.conversazione = {
    mount: function (root) {
      var fresh = !ui;
      if (fresh) build();
      ui.parts.forEach(function (p) { root.appendChild(p); });
      if (fresh) showIntro(); else scrollDown();
    },
    unmount: function () { stopListening(false); }
  };
})();
