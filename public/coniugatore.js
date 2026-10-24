// Motore di coniugazione dello spagnolo (variante della Spagna): regole generali + verbi irregolari.
// Le forme sono calcolate, non generate: così sono sempre le stesse e le irregolarità si possono evidenziare
// confrontando con la coniugazione regolare. Un verbo che non è in elenco viene coniugato come regolare.
var SPV = (function () {
  'use strict';

  var PERSONS = ['yo', 'tú', 'él / ella / usted', 'nosotros', 'vosotros', 'ellos / ellas / ustedes'];
  var V = {};   // infinito -> { inf, it, tags[], irr{} }

  function def(inf, it, tags, irr) { V[inf] = { inf: inf, it: it, tags: tags ? tags.split(' ') : [], irr: irr || {} }; }

  function accentLast(s) {
    var map = { a: 'á', e: 'é', i: 'í', o: 'ó', u: 'ú' };
    for (var i = s.length - 1; i >= 0; i--) if (map[s.charAt(i)]) return s.slice(0, i) + map[s.charAt(i)] + s.slice(i + 1);
    return s;
  }
  // Sostituisce l'ultima occorrenza di "from" in "s".
  function repl(s, from, to) {
    var i = s.lastIndexOf(from);
    return i < 0 ? s : s.slice(0, i) + to + s.slice(i + from.length);
  }

  // Un verbo derivato (mantener da tener, proponer da poner…): stesse irregolarità con il prefisso davanti.
  function derive(prefix, baseInf, it, extra) {
    var b = V[baseInf], irr = {}, k;
    function pre(x) { return Array.isArray(x) ? x.map(function (y) { return y == null ? y : prefix + y; }) : prefix + x; }
    for (k in b.irr) {
      if (k === 'impTu') irr[k] = /^(ten|pon|ven)$/.test(b.irr[k]) ? prefix + accentLast(b.irr[k]) : prefix + b.irr[k];
      else if (k === 'impNos' || typeof b.irr[k] === 'boolean') irr[k] = b.irr[k];
      else irr[k] = pre(b.irr[k]);
    }
    for (k in (extra || {})) irr[k] = extra[k];
    def(prefix + baseInf, it, b.tags.join(' '), irr);
  }

  var END = {
    pres: { ar: ['o', 'as', 'a', 'amos', 'áis', 'an'], er: ['o', 'es', 'e', 'emos', 'éis', 'en'], ir: ['o', 'es', 'e', 'imos', 'ís', 'en'] },
    ind: { ar: ['é', 'aste', 'ó', 'amos', 'asteis', 'aron'], er: ['í', 'iste', 'ió', 'imos', 'isteis', 'ieron'], ir: ['í', 'iste', 'ió', 'imos', 'isteis', 'ieron'] },
    imp: { ar: ['aba', 'abas', 'aba', 'ábamos', 'abais', 'aban'], er: ['ía', 'ías', 'ía', 'íamos', 'íais', 'ían'], ir: ['ía', 'ías', 'ía', 'íamos', 'íais', 'ían'] },
    fut: ['é', 'ás', 'á', 'emos', 'éis', 'án'],
    cond: ['ía', 'ías', 'ía', 'íamos', 'íais', 'ían'],
    sub: { ar: ['e', 'es', 'e', 'emos', 'éis', 'en'], er: ['a', 'as', 'a', 'amos', 'áis', 'an'], ir: ['a', 'as', 'a', 'amos', 'áis', 'an'] },
    he: ['he', 'has', 'ha', 'hemos', 'habéis', 'han'],
    habia: ['había', 'habías', 'había', 'habíamos', 'habíais', 'habían']
  };

  // Unisce radice e desinenza applicando le regole ortografiche.
  function fix(stem, end, inf, tags) {
    var s = stem, c0 = end.charAt(0);
    var front = c0 === 'e' || c0 === 'é';
    var back = c0 === 'o' || c0 === 'a' || c0 === 'á';
    var zc = tags.indexOf('zc') >= 0;
    if (front) {
      if (/car$/.test(inf) && /c$/.test(s)) s = s.slice(0, -1) + 'qu';
      else if (/guar$/.test(inf) && /gu$/.test(s)) s = s.slice(0, -1) + 'ü';
      else if (/gar$/.test(inf) && /g$/.test(s)) s = s + 'u';
      else if (/zar$/.test(inf) && /z$/.test(s)) s = s.slice(0, -1) + 'c';
    }
    if (back) {
      if (/g[ei]r$/.test(inf) && /g$/.test(s)) s = s.slice(0, -1) + 'j';
      else if (/guir$/.test(inf) && /gu$/.test(s)) s = s.slice(0, -1);
      else if (/c[ei]r$/.test(inf) && !zc && /[^aeiouáéíóú]c$/.test(s)) s = s.slice(0, -1) + 'z';
    }
    // i tra due vocali diventa y (leyó, cayendo, construyó); dopo vocale forte le desinenze con i accentata portano l'accento (leíste, caímos).
    if (/^(ió|ie)/.test(end) && (/[aeo]$/.test(s) || (tags.indexOf('y') >= 0 && /u$/.test(s)))) end = 'y' + end.slice(1);
    else if (/^(iste|imos|ís|í$)/.test(end) && /[aeo]$/.test(s)) end = 'í' + end.slice(end.charAt(0) === 'í' ? 1 : 1);
    return s + end;
  }

  function conj(inf, plain) {
    var e = V[inf] || null;
    var irr = (plain || !e) ? {} : e.irr;
    var tags = (plain || !e) ? [] : e.tags;
    var has = function (t) { return tags.indexOf(t) >= 0; };
    var last2 = inf.slice(-2);
    var cls = last2 === 'ar' ? 'ar' : last2 === 'er' ? 'er' : 'ir';
    var stem = inf.slice(0, -2);
    var infAcc = inf.replace('ír', 'ir');

    var strong = null, weak = null;
    if (has('ie')) strong = repl(stem, 'e', 'ie');
    else if (has('ue')) strong = repl(stem, 'o', 'ue');
    else if (has('jue')) strong = repl(stem, 'u', 'ue');
    else if (has('hue')) strong = 'h' + repl(stem, 'o', 'ue');
    else if (has('ie-i')) { strong = repl(stem, 'e', 'ie'); weak = repl(stem, 'e', 'i'); }
    else if (has('ue-u')) { strong = repl(stem, 'o', 'ue'); weak = repl(stem, 'o', 'u'); }
    else if (has('i')) { strong = repl(stem, 'e', 'i'); weak = strong; }
    else if (has('ia') || has('ua')) strong = accentLast(stem);
    else if (has('y')) strong = stem + 'y';

    var yoStem = irr.yo ? irr.yo.replace(/o$/, '') : has('zc') ? stem.replace(/c$/, 'zc') : has('y') ? stem + 'y' : null;

    var f = function (st, end) { return fix(st, end, inf, tags); };
    var out = { inf: inf, it: e ? e.it : '', known: !!e, cls: cls };

    // presente
    out.presente = [];
    for (var p = 0; p < 6; p++) {
      if (irr.pres && irr.pres[p] != null) out.presente[p] = irr.pres[p];
      else if (p === 0 && irr.yo) out.presente[p] = irr.yo;
      else if (p === 0 && has('zc')) out.presente[p] = stem.replace(/c$/, 'zc') + 'o';
      else out.presente[p] = f(strong && (p < 3 || p === 5) ? strong : stem, END.pres[cls][p]);
    }

    // pretérito indefinido
    out.indefinido = [];
    for (p = 0; p < 6; p++) {
      if (irr.ind) out.indefinido[p] = irr.ind[p];
      else if (irr.indStem) {
        var st = irr.indStem, ends = ['e', 'iste', 'o', 'imos', 'isteis', /j$/.test(st) ? 'eron' : 'ieron'];
        out.indefinido[p] = (p === 2 && /c$/.test(st)) ? st.slice(0, -1) + 'zo' : st + ends[p];
      } else out.indefinido[p] = f(weak && (p === 2 || p === 5) ? weak : stem, END.ind[cls][p]);
    }

    // pretérito imperfecto
    out.imperfecto = irr.imp ? irr.imp.slice() : END.imp[cls].map(function (d) { return stem + d; });

    // futuro y condicional
    var fstem = irr.futStem || infAcc;
    out.futuro = END.fut.map(function (d) { return fstem + d; });
    out.condicional = END.cond.map(function (d) { return fstem + d; });

    // gerundio y participio
    out.gerundio = irr.ger || (cls === 'ar' ? stem + 'ando' : f(weak && cls === 'ir' ? weak : stem, 'iendo'));
    out.participio = irr.part || (cls === 'ar' ? stem + 'ado' : (/[aeo]$/.test(stem) ? stem + 'ído' : stem + 'ido'));

    // subjuntivo presente
    out.subjPresente = [];
    for (p = 0; p < 6; p++) {
      if (irr.subj) { out.subjPresente[p] = irr.subj[p]; continue; }
      var sst = irr.subjStem || yoStem || (strong && (p < 3 || p === 5) ? strong : (weak && cls === 'ir' ? weak : stem));
      out.subjPresente[p] = f(sst, END.sub[cls][p]);
    }

    // subjuntivo imperfecto (forma in -ra, dalla 3ª persona plurale dell'indefinido)
    var base = out.indefinido[5].replace(/ron$/, '');
    out.subjImperfecto = [base + 'ra', base + 'ras', base + 'ra', accentLast(base) + 'ramos', base + 'rais', base + 'ran'];

    // tempi composti
    out.perfecto = END.he.map(function (h) { return h + ' ' + out.participio; });
    out.pluscuamperfecto = END.habia.map(function (h) { return h + ' ' + out.participio; });

    // imperativo: tú, usted, nosotros, vosotros, ustedes
    var sp = out.subjPresente;
    out.impAfirmativo = [irr.impTu || out.presente[2], sp[2], irr.impNos || sp[3], inf.slice(0, -1) + 'd', sp[5]];
    out.impNegativo = [sp[1], sp[2], sp[3], sp[4], sp[5]].map(function (x) { return 'no ' + x; });
    return out;
  }

  var TENSES = [
    { key: 'presente', label: 'Presente', group: 'Indicativo', use: 'Abitudini, azioni di adesso, verità generali.', n: 6 },
    { key: 'indefinido', label: 'Pretérito indefinido', group: 'Indicativo', use: 'Azioni concluse nel passato (ayer, el año pasado, en 2019).', n: 6 },
    { key: 'imperfecto', label: 'Pretérito imperfecto', group: 'Indicativo', use: 'Abitudini e descrizioni nel passato (cuando era niño…).', n: 6 },
    { key: 'futuro', label: 'Futuro', group: 'Indicativo', use: 'Progetti, previsioni e ipotesi sul presente (serán las ocho).', n: 6 },
    { key: 'condicional', label: 'Condicional', group: 'Indicativo', use: 'Cortesia, consigli, ipotesi (me gustaría, deberías).', n: 6 },
    { key: 'perfecto', label: 'Pretérito perfecto', group: 'Tempi composti', use: 'Passato collegato al presente (hoy, esta semana, ya).', n: 6 },
    { key: 'pluscuamperfecto', label: 'Pluscuamperfecto', group: 'Tempi composti', use: 'Passato prima di un altro passato.', n: 6 },
    { key: 'subjPresente', label: 'Presente de subjuntivo', group: 'Subjuntivo', use: 'Desideri, consigli, dubbi, emozioni (quiero que…, es posible que…).', n: 6 },
    { key: 'subjImperfecto', label: 'Imperfecto de subjuntivo', group: 'Subjuntivo', use: 'Ipotesi irreali (si tuviera…), desideri nel passato.', n: 6 },
    { key: 'impAfirmativo', label: 'Imperativo afirmativo', group: 'Imperativo', use: 'Ordini e inviti.', n: 5 },
    { key: 'impNegativo', label: 'Imperativo negativo', group: 'Imperativo', use: 'Divieti (no hables, no salgas).', n: 5 }
  ];
  var IMP_PERSONS = ['tú', 'usted', 'nosotros', 'vosotros', 'ustedes'];

  // ---------------------------------------------------------------- verbi
  // Completamente irregolari
  def('ser', 'essere', '', { pres: ['soy', 'eres', 'es', 'somos', 'sois', 'son'], ind: ['fui', 'fuiste', 'fue', 'fuimos', 'fuisteis', 'fueron'],
    imp: ['era', 'eras', 'era', 'éramos', 'erais', 'eran'], subjStem: 'se', impTu: 'sé', full: true });
  def('estar', 'stare, essere (posizione, stato)', '', { pres: ['estoy', 'estás', 'está', 'estamos', 'estáis', 'están'], indStem: 'estuv',
    subj: ['esté', 'estés', 'esté', 'estemos', 'estéis', 'estén'], full: true });
  def('ir', 'andare', '', { pres: ['voy', 'vas', 'va', 'vamos', 'vais', 'van'], ind: ['fui', 'fuiste', 'fue', 'fuimos', 'fuisteis', 'fueron'],
    imp: ['iba', 'ibas', 'iba', 'íbamos', 'ibais', 'iban'], subjStem: 'vay', ger: 'yendo', impTu: 've', impNos: 'vamos', full: true });
  def('haber', 'avere (ausiliare), esserci', '', { pres: ['he', 'has', 'ha', 'hemos', 'habéis', 'han'], indStem: 'hub', futStem: 'habr', subjStem: 'hay', full: true });
  def('dar', 'dare', '', { pres: ['doy', 'das', 'da', 'damos', 'dais', 'dan'], ind: ['di', 'diste', 'dio', 'dimos', 'disteis', 'dieron'],
    subj: ['dé', 'des', 'dé', 'demos', 'deis', 'den'], full: true });
  def('ver', 'vedere', '', { yo: 'veo', pres: ['veo', 'ves', 've', 'vemos', 'veis', 'ven'], ind: ['vi', 'viste', 'vio', 'vimos', 'visteis', 'vieron'],
    imp: ['veía', 'veías', 'veía', 'veíamos', 'veíais', 'veían'], part: 'visto' });

  // Radice irregolare e prima persona in -go
  def('tener', 'avere, tenere', 'ie', { yo: 'tengo', indStem: 'tuv', futStem: 'tendr', impTu: 'ten' });
  def('venir', 'venire', 'ie-i', { yo: 'vengo', indStem: 'vin', futStem: 'vendr', impTu: 'ven' });
  def('poner', 'mettere', '', { yo: 'pongo', indStem: 'pus', futStem: 'pondr', part: 'puesto', impTu: 'pon' });
  def('salir', 'uscire', '', { yo: 'salgo', futStem: 'saldr', impTu: 'sal' });
  def('valer', 'valere', '', { yo: 'valgo', futStem: 'valdr' });
  def('hacer', 'fare', '', { yo: 'hago', indStem: 'hic', futStem: 'har', part: 'hecho', impTu: 'haz' });
  def('decir', 'dire', 'i', { yo: 'digo', indStem: 'dij', futStem: 'dir', part: 'dicho', impTu: 'di' });
  def('traer', 'portare', '', { yo: 'traigo', indStem: 'traj' });
  def('caer', 'cadere', '', { yo: 'caigo' });
  def('oír', 'sentire, ascoltare', '', { pres: ['oigo', 'oyes', 'oye', 'oímos', 'oís', 'oyen'], yo: 'oigo' });
  def('saber', 'sapere', '', { yo: 'sé', indStem: 'sup', futStem: 'sabr', subjStem: 'sep' });
  def('caber', 'starci, entrare', '', { yo: 'quepo', indStem: 'cup', futStem: 'cabr' });
  def('poder', 'potere', 'ue', { indStem: 'pud', futStem: 'podr', ger: 'pudiendo' });
  def('querer', 'volere, amare', 'ie', { indStem: 'quis', futStem: 'querr' });
  def('andar', 'camminare, andare', '', { indStem: 'anduv' });

  // Derivati
  derive('man', 'tener', 'mantenere'); derive('con', 'tener', 'contenere'); derive('ob', 'tener', 'ottenere');
  derive('de', 'tener', 'fermare, trattenere'); derive('sos', 'tener', 'sostenere'); derive('re', 'tener', 'trattenere');
  derive('con', 'venir', 'convenire'); derive('pre', 'venir', 'prevenire'); derive('inter', 'venir', 'intervenire');
  derive('pro', 'poner', 'proporre'); derive('su', 'poner', 'supporre'); derive('com', 'poner', 'comporre');
  derive('im', 'poner', 'imporre'); derive('o', 'poner', 'opporsi a'); derive('ex', 'poner', 'esporre');
  derive('dis', 'poner', 'disporre'); derive('re', 'poner', 'rimettere, reintegrare');
  derive('des', 'hacer', 'disfare'); derive('re', 'hacer', 'rifare');
  derive('a', 'traer', 'attrarre'); derive('con', 'traer', 'contrarre'); derive('dis', 'traer', 'distrarre');
  derive('ex', 'traer', 'estrarre'); derive('sus', 'traer', 'sottrarre');

  // Cambio vocalico
  var ie = 'pensar:pensare|cerrar:chiudere|empezar:cominciare|comenzar:cominciare|despertar:svegliare|recomendar:consigliare|sentar:far sedere|acertar:azzeccare|' +
           'perder:perdere|entender:capire|defender:difendere|encender:accendere|descender:scendere|' +
           'merendar:fare merenda|regar:annaffiare|negar:negare|atravesar:attraversare|temblar:tremare';
  var ue = 'contar:contare, raccontare|encontrar:trovare|recordar:ricordare|costar:costare|mostrar:mostrare|probar:provare|almorzar:pranzare|soñar:sognare|volar:volare|' +
           'mover:muovere|doler:fare male|llover:piovere|devolver:restituire|volver:tornare|resolver:risolvere|envolver:avvolgere|revolver:rimescolare|' +
           'acostar:mettere a letto|apostar:scommettere|aprobar:approvare|rogar:pregare|sonar:suonare|colgar:appendere';
  var ieI = 'sentir:sentire, provare|preferir:preferire|mentir:mentire|divertir:divertire|hervir:bollire|sugerir:suggerire|convertir:convertire|advertir:avvertire|referir:riferire';
  var ueU = 'dormir:dormire|morir:morire';
  var iT = 'pedir:chiedere|servir:servire|repetir:ripetere|vestir:vestire|medir:misurare|despedir:congedare|impedir:impedire|competir:competere|elegir:scegliere|corregir:correggere|seguir:seguire|conseguir:ottenere, riuscire|perseguir:perseguire|reñir:litigare';
  function bulk(list, tag) { list.split('|').forEach(function (x) { var a = x.split(':'); if (!V[a[0]]) def(a[0], a[1], tag); }); }
  bulk(ie, 'ie'); bulk(ue, 'ue'); bulk(ieI, 'ie-i'); bulk(ueU, 'ue-u'); bulk(iT, 'i');
  V['volver'].irr = { part: 'vuelto' }; V['devolver'].irr = { part: 'devuelto' }; V['resolver'].irr = { part: 'resuelto' };
  V['envolver'].irr = { part: 'envuelto' }; V['revolver'].irr = { part: 'revuelto' }; V['morir'].irr = { part: 'muerto' };
  def('jugar', 'giocare', 'jue');
  def('oler', 'odorare, avere odore', 'hue');

  // -zco, -uyo, accenti
  bulk('conocer:conoscere|parecer:sembrare|ofrecer:offrire|nacer:nascere|crecer:crescere|agradecer:ringraziare|aparecer:apparire|desaparecer:scomparire|establecer:stabilire|' +
       'merecer:meritare|obedecer:obbedire|permanecer:rimanere|reconocer:riconoscere|pertenecer:appartenere|ofrecer:offrire', 'zc');
  ['conducir:guidare', 'traducir:tradurre', 'producir:produrre', 'introducir:introdurre', 'reducir:ridurre'].forEach(function (x) {
    var a = x.split(':'); def(a[0], a[1], 'zc', { indStem: a[0].slice(0, -3) + 'j' });
  });
  bulk('construir:costruire|incluir:includere|concluir:concludere|huir:fuggire|destruir:distruggere|contribuir:contribuire|distribuir:distribuire|sustituir:sostituire|influir:influire|excluir:escludere|atribuir:attribuire|disminuir:diminuire', 'y');
  bulk('enviar:inviare|confiar:fidarsi|guiar:guidare|variar:variare|fiar:fidare|vaciar:svuotare|enfriar:raffreddare|ampliar:ampliare', 'ia');
  bulk('continuar:continuare|actuar:agire|graduar:laureare|evaluar:valutare|situar:collocare|efectuar:effettuare', 'ua');

  // Altre irregolarità (participi)
  def('abrir', 'aprire', '', { part: 'abierto' }); def('cubrir', 'coprire', '', { part: 'cubierto' }); derive('des', 'cubrir', 'scoprire');
  def('escribir', 'scrivere', '', { part: 'escrito' }); def('describir', 'descrivere', '', { part: 'descrito' }); def('inscribir', 'iscrivere', '', { part: 'inscrito' });
  def('romper', 'rompere', '', { part: 'roto' }); def('imprimir', 'stampare', '', { part: 'impreso' });
  def('leer', 'leggere', ''); def('creer', 'credere', ''); def('poseer', 'possedere', ''); def('proveer', 'fornire', '');

  // Regolari e con solo ortografia
  bulk('hablar:parlare|trabajar:lavorare|estudiar:studiare|comprar:comprare|cantar:cantare|bailar:ballare|llamar:chiamare|necesitar:aver bisogno di|tomar:prendere|llevar:portare, indossare|' +
       'mirar:guardare|escuchar:ascoltare|buscar:cercare|llegar:arrivare|pagar:pagare|tocar:toccare, suonare|sacar:tirare fuori|cocinar:cucinare|limpiar:pulire|ayudar:aiutare|usar:usare|' +
       'esperar:aspettare, sperare|ganar:vincere, guadagnare|viajar:viaggiare|cambiar:cambiare|explicar:spiegare|practicar:praticare|olvidar:dimenticare|preguntar:chiedere (domandare)|' +
       'contestar:rispondere|caminar:camminare|nadar:nuotare|cenar:cenare|desayunar:fare colazione|ducharse:farsi la doccia|llorar:piangere|besar:baciare|apagar:spegnere|averiguar:accertare|' +
       'comer:mangiare|beber:bere|vender:vendere|correr:correre|aprender:imparare|comprender:comprendere|romper:rompere|temer:temere|responder:rispondere|' +
       'vivir:vivere|recibir:ricevere|subir:salire|decidir:decidere|compartir:condividere|partir:partire, dividere|cumplir:compiere, rispettare|sufrir:soffrire|permitir:permettere|' +
       'coger:prendere|escoger:scegliere|proteger:proteggere|recoger:raccogliere|dirigir:dirigere|exigir:esigere|vencer:vincere|convencer:convincere|esparcir:spargere', '');
  Object.keys(V).forEach(function (k) { /* nessun controllo: l'elenco è curato a mano */ });

  // ---------------------------------------------------------------- descrizioni delle irregolarità
  function notes(inf) {
    var e = V[inf];
    if (!e) return ['Verbo non presente nell\'elenco: è mostrata la coniugazione regolare, che potrebbe non essere corretta se il verbo è irregolare.'];
    var out = [], t = e.tags, irr = e.irr;
    if (irr.full) out.push('Verbo molto irregolare: conviene impararlo a memoria.');
    if (t.indexOf('ie') >= 0) out.push('Dittongo e → ie nelle forme accentate (yo, tú, él, ellos) e nel congiuntivo corrispondente; nosotros e vosotros restano regolari.');
    if (t.indexOf('ue') >= 0) out.push('Dittongo o → ue nelle forme accentate (yo, tú, él, ellos); nosotros e vosotros restano regolari.');
    if (t.indexOf('jue') >= 0) out.push('Dittongo u → ue nelle forme accentate (juego, juegas…).');
    if (t.indexOf('hue') >= 0) out.push('Dittongo o → hue nelle forme accentate (huelo, hueles…).');
    if (t.indexOf('ie-i') >= 0) out.push('Cambio e → ie nelle forme accentate, ed e → i alla 3ª persona dell\'indefinido, nel gerundio e nel congiuntivo di nosotros/vosotros.');
    if (t.indexOf('ue-u') >= 0) out.push('Cambio o → ue nelle forme accentate, ed o → u alla 3ª persona dell\'indefinido, nel gerundio e nel congiuntivo di nosotros/vosotros.');
    if (t.indexOf('i') >= 0) out.push('Cambio e → i in tutte le forme con radice accentata, nella 3ª persona dell\'indefinido, nel gerundio e nel congiuntivo.');
    if (t.indexOf('zc') >= 0) out.push('La 1ª persona del presente è in -zco (conozco) e questa radice si usa in tutto il congiuntivo presente.');
    if (t.indexOf('y') >= 0) out.push('Si inserisce una y (construyo, construyes…) e la i tra vocali diventa y (construyó, construyendo).');
    if (t.indexOf('ia') >= 0 || t.indexOf('ua') >= 0) out.push('L\'accento cade sulla vocale della radice (envío, continúo) nelle forme di yo, tú, él, ellos.');
    if (irr.yo && !irr.full) out.push('1ª persona del presente irregolare: ' + irr.yo + '.');
    if (irr.indStem) out.push('Indefinido con radice irregolare (' + irr.indStem + '-) e desinenze senza accento: -e, -iste, -o, -imos, -isteis, -ieron.');
    if (irr.futStem) out.push('Futuro e condizionale con radice irregolare (' + irr.futStem + '-).');
    if (irr.part) out.push('Participio irregolare: ' + irr.part + '.');
    if (irr.impTu && !irr.full) out.push('Imperativo di tú irregolare: ' + irr.impTu + '.');
    var sp = '';
    if (/car$/.test(inf)) sp = 'c → qu davanti a e (busqué, busque)';
    else if (/guar$/.test(inf)) sp = 'gu → gü davanti a e (averigüé)';
    else if (/gar$/.test(inf)) sp = 'g → gu davanti a e (llegué, llegue)';
    else if (/zar$/.test(inf)) sp = 'z → c davanti a e (empecé, empiece)';
    else if (/g[ei]r$/.test(inf)) sp = 'g → j davanti a o/a (cojo, coja)';
    else if (/guir$/.test(inf)) sp = 'gu → g davanti a o/a (sigo, siga)';
    else if (/[^aeiouáéíóú]c[ei]r$/.test(inf) && t.indexOf('zc') < 0) sp = 'c → z davanti a o/a (venzo, venza)';
    if (sp) out.push('Cambio ortografico: ' + sp + '.');
    if (!out.length) out.push('Verbo regolare.');
    return out;
  }

  // Coniuga e segna le forme diverse dalla coniugazione regolare.
  function full(inf) {
    var c = conj(inf, false), r = conj(inf, true), irregular = {};
    TENSES.forEach(function (t) {
      irregular[t.key] = c[t.key].map(function (form, i) { return form !== r[t.key][i]; });
    });
    c.irregular = irregular;
    c.irrGer = c.gerundio !== r.gerundio;
    c.irrPart = c.participio !== r.participio;
    c.notes = notes(inf);
    return c;
  }

  // Normalizza quello che l'utente scrive: minuscole, senza spazi; ritorna null se non è un infinito.
  function parse(text) {
    var t = String(text || '').trim().toLowerCase().normalize('NFC');
    if (!/^[a-záéíóúüñ]{2,}$/.test(t)) return null;
    if (/(ar|er|ir|ír)$/.test(t)) return { inf: t, reflexive: false };
    if (/(ar|er|ir|ír)se$/.test(t)) return { inf: t.slice(0, -2), reflexive: true };
    return null;
  }

  return {
    PERSONS: PERSONS, IMP_PERSONS: IMP_PERSONS, TENSES: TENSES, verbs: V, full: full, conj: conj, parse: parse,
    list: function () { return Object.keys(V).sort(); },
    irregularTop: ['ser', 'estar', 'ir', 'tener', 'hacer', 'poder', 'querer', 'decir', 'venir', 'poner', 'saber', 'ver', 'dar', 'salir', 'traer', 'oír', 'caer', 'haber',
                   'pedir', 'dormir', 'volver', 'seguir', 'sentir', 'pensar', 'empezar', 'jugar', 'conocer', 'construir', 'leer', 'conducir', 'andar', 'caber', 'morir', 'abrir', 'escribir', 'romper', 'mantener', 'proponer']
  };
})();
