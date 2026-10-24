// Prove della logica del backend con archivio in memoria e Claude simulato. Si eseguono in un browser o in Node:
//   import { run } from './backend.test.mjs'; console.log(await run());
import { handle } from '../lib/router.mjs';
import { MemoryBlobs } from '../lib/memory-blobs.mjs';
import { setIterations } from '../lib/core.mjs';

const SECRET = 'x'.repeat(40);
const ENV = { SESSION_SECRET: SECRET, SETUP_TOKEN: 'token-di-setup', ANTHROPIC_API_KEY: 'chiave-finta', PUBLIC_URL: 'https://esempio.netlify.app' };


// Parole vere per la demo locale (le prove del backend usano invece parole sintetiche e prevedibili).
// Una riga per parola: spagnolo | italiano | sinonimi spagnoli separati da virgola | categoria
const DEMO_WORDS = {
  cibo: `el aguacate | avocado | | nome
la manzana | mela | | nome
el pan | pane | | nome
el queso | formaggio | | nome
la leche | latte | | nome
el huevo | uovo | | nome
el arroz | riso | | nome
la carne | carne | | nome
el pescado | pesce | | nome
la verdura | verdura | la hortaliza | nome
el postre | dolce, dessert | | nome
el desayuno | colazione | | nome
la cena | cena | | nome
cocinar | cucinare | guisar | verbo
la receta | ricetta | | nome
el camarero | cameriere | el mesero | nome
la cuenta | conto | | nome
pedir | ordinare, chiedere | | verbo
el plato | piatto | | nome
el vaso | bicchiere | | nome
sabroso | saporito, gustoso | rico | aggettivo
picante | piccante | | aggettivo
hervir | bollire | | verbo
la cuchara | cucchiaio | | nome`,
  casa: `la casa | casa | el hogar, la vivienda | nome
el piso | appartamento | el apartamento | nome
la habitación | camera | el cuarto, el dormitorio | nome
la cocina | cucina | | nome
el baño | bagno | | nome
la ventana | finestra | | nome
la puerta | porta | | nome
la escalera | scala | | nome
el sofá | divano | | nome
la mesa | tavolo | | nome
la silla | sedia | | nome
la cama | letto | | nome
el armario | armadio | | nome
la lámpara | lampada | | nome
el techo | soffitto | | nome
la pared | parete, muro | el muro | nome
limpiar | pulire | | verbo
barrer | spazzare | | verbo
alquilar | affittare | arrendar | verbo
mudarse | traslocare | | verbo
el vecino | vicino | | nome
el alquiler | affitto | | nome
la llave | chiave | | nome
el suelo | pavimento | | nome`,
  generico: `bonito | bello, carino | hermoso, lindo | aggettivo
rápido | veloce | veloz | aggettivo
grande | grande | | aggettivo
pequeño | piccolo | chico | aggettivo
hablar | parlare | conversar | verbo
empezar | cominciare | comenzar | verbo
ayudar | aiutare | | verbo
el trabajo | lavoro | el empleo | nome
la ciudad | città | | nome
el amigo | amico | | nome
viajar | viaggiare | | verbo
comprar | comprare | adquirir | verbo
la semana | settimana | | nome
el tiempo | tempo | | nome
cansado | stanco | agotado | aggettivo
contento | contento | feliz, alegre | aggettivo
difícil | difficile | complicado | aggettivo
fácil | facile | sencillo | aggettivo
aprender | imparare | | verbo
olvidar | dimenticare | | verbo
recordar | ricordare | acordarse | verbo
la pregunta | domanda | | nome
la respuesta | risposta | | nome
el viaje | viaggio | | nome`,
};
function demoWords(userText) {
  const key = /Casa/.test(userText) ? 'casa' : /Cibo/.test(userText) ? 'cibo' : 'generico';
  return DEMO_WORDS[key].split('\n').map((row) => row.split('|').map((x) => x.trim())).map((p) => ({
    es: p[0], it: p[1], syn: (p[2] || '').split(',').map((x) => x.trim()).filter(Boolean), ex: 'Frase di esempio con «' + p[0] + '».', exit: 'Frase d\'esempio.', type: p[3] || 'nome',
  }));
}

// Claude simulato: risponde in base a ciò che chiede il prompt di sistema. Con opts.realVocab le liste di vocabolario hanno parole vere.
// Italiano di prova per il tutor simulato (solo verbi regolari: il vero tutor coniuga anche gli irregolari).
const IT_PRON = ['io', 'tu', 'lui/lei', 'noi', 'voi', 'loro'];
const IT_PERSON = { yo: 0, eu: 0, 'tú': 1, tu: 1, 'él': 2, ele: 2, 'você': 2, usted: 2, nosotros: 3, 'nós': 3, vosotros: 4, ellos: 5, eles: 5, ustedes: 5, 'vocês': 5 };
export function fakeItalian(gloss, tenseIt, persons) {
  const inf = String(gloss).split(/[,;]/).map((x) => x.trim()).find((x) => /(are|ere|ire)$/.test(x)) || String(gloss).split(/[,;]/)[0].trim();
  const m = inf.match(/^(.*)(are|ere|ire)$/);
  if (!m) return persons.map((p) => IT_PRON[IT_PERSON[p.split(/\s/)[0].toLowerCase()] || 0] + ' ' + inf);
  const st = m[1], c = m[2], k = c === 'are' ? 0 : c === 'ere' ? 1 : 2, t = String(tenseIt);
  const part = st + ['ato', 'uto', 'ito'][k];
  const avere = ['ho', 'hai', 'ha', 'abbiamo', 'avete', 'hanno'], avevo = ['avevo', 'avevi', 'aveva', 'avevamo', 'avevate', 'avevano'];
  const fut = st + (k === 2 ? 'ir' : 'er');
  const T = {
    presente: [['o', 'i', 'a', 'iamo', 'ate', 'ano'], ['o', 'i', 'e', 'iamo', 'ete', 'ono'], ['o', 'i', 'e', 'iamo', 'ite', 'ono']][k].map((e) => st + e),
    remoto: [['ai', 'asti', 'ò', 'ammo', 'aste', 'arono'], ['ei', 'esti', 'é', 'emmo', 'este', 'erono'], ['ii', 'isti', 'ì', 'immo', 'iste', 'irono']][k].map((e) => st + e),
    imperfetto: ['avo', 'avi', 'ava', 'avamo', 'avate', 'avano'].map((e) => st + ['a', 'e', 'i'][k] + e.slice(1)),
    futuro: ['ò', 'ai', 'à', 'emo', 'ete', 'anno'].map((e) => fut + e),
    condizionale: ['ei', 'esti', 'ebbe', 'emmo', 'este', 'ebbero'].map((e) => fut + e),
    prossimo: avere.map((a) => a + ' ' + part),
    trapassato: avevo.map((a) => a + ' ' + part),
    congPres: [['i', 'i', 'i', 'iamo', 'iate', 'ino'], ['a', 'a', 'a', 'iamo', 'iate', 'ano'], ['a', 'a', 'a', 'iamo', 'iate', 'ano']][k].map((e) => st + e),
    congImp: ['ssi', 'ssi', 'sse', 'ssimo', 'ste', 'ssero'].map((e) => st + ['a', 'e', 'i'][k] + e),
  };
  const imp = [null, [['a', 'i', 'iamo', 'ate', 'ino'], ['i', 'a', 'iamo', 'ete', 'ano'], ['i', 'a', 'iamo', 'ite', 'ano']][k].map((e) => st + e)];
  const which = /remoto/.test(t) ? 'remoto' : /imperfetto/.test(t) && /congiuntivo/.test(t) ? 'congImp' : /congiuntivo/.test(t) ? 'congPres' : /trapassato/.test(t) ? 'trapassato'
    : /prossimo|azione ripetuta/.test(t) ? 'prossimo' : /imperfetto/.test(t) ? 'imperfetto' : /futuro/.test(t) ? 'futuro' : /condizionale/.test(t) ? 'condizionale' : /imperativo/.test(t) ? 'imp' : 'presente';
  return persons.map((p, i) => {
    const idx = IT_PERSON[p.split(/\s/)[0].toLowerCase()] ?? i;
    if (which === 'imp') {
      const f = imp[1][Math.max(0, idx - 1)] || inf;
      return (/negativo/.test(t) ? 'non ' + (idx === 1 ? inf : f) : f);
    }
    return (/congiuntivo/.test(t) ? 'che ' : '') + IT_PRON[idx] + ' ' + T[which][idx];
  });
}

export function fakeClaude(counter, opts = {}) {
  return async (url, init) => {
    counter.n++;
    const b = JSON.parse(init.body);
    const sys = b.system;
    counter.last = { system: sys, messages: b.messages, thinking: b.thinking };
    let payload;
    if (sys.includes('MODALITÀ')) payload = { reply: 'Hola, ¿qué tal?', corrections: [{ original: 'yo soy 20', corrected: 'tengo 20 años', note: 'Età con tener.', cat: 'ser/estar' }], suggestion: 'Tengo veinte años.', vocab: [{ es: 'la cena', it: 'la cena' }] };
    else if (sys.includes('Livello 1 (pista)')) payload = { hint: b.messages[0].content.includes('Livello richiesto: 2') ? 'La palabra es «huelga».' : 'Es cuando no se trabaja.', word: 'la huelga', it: 'lo sciopero' };
    else if (sys.includes('lezione di grammatica')) payload = { summary: 'Riassunto', blocks: [{ heading: 'Forme', text: 'Testo', table: { headers: ['a', 'b'], rows: [['1', '2']] }, examples: [{ es: 'Lo veo.', it: 'Lo vedo.' }] }], mistakes: [{ wrong: 'x', right: 'y', why: 'z' }], tips: ['t'] };
    else if (sys.includes('Crea esercizi')) {
      const stamp = counter.n;
      payload = { items: [
        { type: 'completa', q: `Esta mañana en la posta (correos) tú me ___ (decir) algo ${stamp}.`, answer: 'dijiste', alts: [], why: 'glossa nella frase' },
        { type: 'scelta', q: `Ayer ___ al mercado ${stamp}.`, options: ['fui', 'iba', 'voy', 'iré'], answer: 0, why: 'indefinido' },
        { type: 'completa', q: `Yo ___ (hacer) la compra ${stamp}.`, answer: 'hago', alts: [], why: 'yo' },
        { type: 'traduci', q: `Vado al mercato ${stamp}.`, ref: 'Voy al mercado.', why: 'ir' },
        { type: 'scelta', q: `Nosotros ___ en casa ${stamp}.`, options: ['estamos', 'somos', 'estáis', 'son'], answer: 0, why: 'estar' },
        { type: 'completa', q: `Tú ___ (poder) venir ${stamp}.`, answer: 'puedes', alts: [], why: 'poder' },
        { type: 'completa', q: 'Ayer ___ al mercado ' + (stamp - 2) + '.', answer: 'fui', alts: [], why: 'ripetuta' },
        { type: 'scelta', q: `Ellos ___ tarde ${stamp}.`, options: ['llegan', 'llegas', 'llego', 'llegamos'], answer: 0, why: 'llegar' },
        { type: 'traduci', q: `Mangio una mela ${stamp}.`, ref: 'Como una manzana.', why: 'comer' },
        { type: 'completa', q: `Ayer tú ___ (ir) al banco, pero ___ (ser) fiesta ${stamp}.`, answer: 'fuiste / era', alts: [], why: 'querer' },
        { type: 'scelta', q: `Mi hermana ___ médica ${stamp}.`, options: ['es', 'está', 'hay', 'tiene'], answer: 0, why: 'ser' },
      ] };
    } else if (sys.includes('Valuta traduzioni')) payload = { results: JSON.parse(b.messages[0].content).map((x, i) => ({ ok: i === 0, score: i === 1 ? 0.7 : undefined, corrected: x.ref, note: 'nota' })) };
    else if (sys.includes('forme coniugate del verbo')) {
      payload = { results: JSON.parse(b.messages[0].content).map((x) => ({ i: x.i, forms: fakeItalian(x.it, x.tenseIt, x.persons) })) };
    }
    else if (sys.includes('ha cercato un verbo')) {
      const w = b.messages[0].content.replace('Parola cercata: ', '');
      payload = w === 'ablar' ? { exists: false, it: '', regular: false, note: 'Probabile errore di battitura.', suggestions: ['hablar', 'ablandar'] }
        : w.startsWith('irr') ? { exists: true, it: 'verbo irregolare di prova', regular: false, note: 'Ha un presente irregolare.', suggestions: [] }
        : { exists: true, it: 'ronzare', regular: true, note: 'Verbo regolare.', suggestions: [] };
    }
    else if (sys.includes('test di vocabolario')) payload = { results: JSON.parse(b.messages[0].content).map((x) => ({ ok: x.answer.startsWith('sin'), note: x.answer.startsWith('sin') ? 'sinonimo valido di ' + x.es : 'significa altro' })) };
    else if (sys.includes('lista di vocabolario') && opts.realVocab) payload = { words: demoWords(b.messages[0].content) };
    else if (sys.includes('lista di vocabolario')) payload = { words: Array.from({ length: 24 }, (_, i) => ({ es: 'la palabra' + i, it: 'parola ' + i, syn: ['el vocablo' + i], ex: 'Ejemplo ' + i, exit: 'Esempio ' + i, type: 'nome' })) };
    else if (sys.includes('test di livello')) {
      const secs = ['tempi', 'forme', 'lessico', 'comprensione'];
      payload = { items: Array.from({ length: 20 }, (_, i) => ({ type: 'scelta', section: secs[Math.floor(i / 5)], level: ['A2', 'B1', 'B2'][i % 3], q: `Domanda test numero ${i} ${counter.n}`, text: i >= 15 ? 'Testo breve.' : undefined, options: ['a', 'b', 'c', 'd'], answer: i % 4, why: 'perché' })) };
    } else if (sys.includes('Valuta un breve testo')) payload = { level: 'B1', score: 7.4, comment: 'Bene.', corrections: [{ original: 'he comido', corrected: 'comí', note: 'ayer', cat: 'tempi del passato' }], improved: 'Texto mejorado.' };
    else payload = { reply: 'boh' };
    return new Response(JSON.stringify({ content: [{ type: 'text', text: JSON.stringify(payload) }] }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
}

export async function run({ iterations = 1000 } = {}) {
  setIterations(iterations);
  const results = [];
  let failures = 0;
  const ok = (cond, name, extra = '') => { results.push((cond ? 'OK   ' : 'FAIL ') + name + (cond ? '' : ' ' + extra)); if (!cond) failures++; };

  const blobs = new MemoryBlobs();
  const counter = { n: 0 };
  const fetchImpl = fakeClaude(counter);
  let lastCookie = null;
  const jar = {};   // nome utente -> cookie
  const call = async (method, path, { body, cookie, noHeader, ip = '1.2.3.4', env = ENV } = {}) => {
    const headers = { 'content-type': 'application/json' };
    if (!noHeader && method !== 'GET') headers['x-requested-with'] = 'spagnolo';
    lastCookie = null;
    const res = await handle(new Request('https://esempio.netlify.app' + path, { method, headers, body: body ? JSON.stringify(body) : undefined }),
      { blobs, env, ip, fetch: fetchImpl, cookie: cookie ? cookie.split(';')[0] : '', onSetCookie: (c) => { lastCookie = c; } });
    const text = await res.text();
    let json = null; try { json = JSON.parse(text); } catch {}
    return { status: res.status, json, cookie: lastCookie };
  };

  // ---------------- configurazione e protezioni di base
  let r = await call('GET', '/api', {});
  ok(r.status === 401, 'senza sessione: 401', JSON.stringify(r));
  r = await call('POST', '/api/auth/login', { body: { username: 'x', password: 'y' }, noHeader: true });
  ok(r.status === 403, 'POST senza intestazione di difesa: 403');
  r = await call('GET', '/api', { env: { ...ENV, SESSION_SECRET: 'corto' } });
  ok(r.status === 500, 'segreto di sessione assente o corto: 500');

  // ---------------- primo amministratore
  r = await call('POST', '/api/setup', { body: { token: 'sbagliato', username: 'salvatore' } });
  ok(r.status === 403, 'setup con token sbagliato: 403');
  r = await call('POST', '/api/setup', { body: { token: ENV.SETUP_TOKEN, username: 'salvatore' } });
  ok(r.status === 200 && /invito\.html\?t=[a-f0-9]{48}$/.test(r.json.link), 'setup con token giusto: link di invito', JSON.stringify(r));
  const adminLink = r.json.link, adminTok = adminLink.split('=')[1];
  r = await call('GET', '/api/auth/invite?t=' + adminTok);
  ok(r.status === 200 && r.json.username === 'salvatore', 'il link riconosce l\'utente');
  r = await call('POST', '/api/auth/accept', { body: { t: adminTok, password: 'corta', password2: 'corta' } });
  ok(r.status === 400 && r.json.problems.length > 0, 'password debole rifiutata: ' + (r.json && r.json.problems));
  r = await call('POST', '/api/auth/accept', { body: { t: adminTok, password: 'Trota-Verde-4821x', password2: 'diversa' } });
  ok(r.status === 400, 'password diverse rifiutate');
  r = await call('POST', '/api/auth/accept', { body: { t: adminTok, password: 'Trota-Verde-4821x', password2: 'Trota-Verde-4821x' } });
  ok(r.status === 200 && r.cookie && /HttpOnly/.test(r.cookie) && /Secure/.test(r.cookie) && /SameSite=Lax/.test(r.cookie), 'scelta la password: sessione creata', JSON.stringify(r));
  jar.salvatore = r.cookie;
  r = await call('GET', '/api/auth/invite?t=' + adminTok);
  ok(r.status === 404, 'il link è a uso singolo');
  r = await call('POST', '/api/setup', { body: { token: ENV.SETUP_TOKEN, username: 'altro' } });
  ok(r.status === 409, 'setup chiuso quando esiste un admin');

  // ---------------- sessione
  r = await call('GET', '/api', { cookie: jar.salvatore });
  ok(r.status === 200 && r.json.needsPlacement === true && r.json.profile.level === 'B1-' && r.json.plan.length === 8, 'stato iniziale: serve il test di ingresso', JSON.stringify(r.json).slice(0, 200));
  ok(r.json.me.user === 'salvatore' && r.json.me.role === 'admin' && r.json.grammar.length === 7 && r.json.themes.length === 16, 'stato: utente, grammatica, temi');
  const tampered = jar.salvatore.replace(/\.[^.;]+/, '.firmafalsa');
  r = await call('GET', '/api', { cookie: tampered });
  ok(r.status === 401, 'cookie manomesso: 401');

  // ---------------- accesso e blocco
  r = await call('POST', '/api/auth/login', { body: { username: 'salvatore', password: 'sbagliata' }, ip: '9.9.9.9' });
  ok(r.status === 401 && r.json.error === 'Nome utente o password non corretti.', 'password errata: messaggio generico');
  r = await call('POST', '/api/auth/login', { body: { username: 'inesistente', password: 'x' }, ip: '9.9.9.9' });
  ok(r.status === 401 && r.json.error === 'Nome utente o password non corretti.', 'utente inesistente: stesso messaggio');
  r = await call('POST', '/api/auth/login', { body: { username: 'salvatore', password: 'Trota-Verde-4821x' }, ip: '8.8.8.8' });
  ok(r.status === 200 && r.cookie, 'accesso con la password giusta');
  jar.salvatore2 = r.cookie;
  for (let i = 0; i < 5; i++) await call('POST', '/api/auth/login', { body: { username: 'salvatore', password: 'no' + i }, ip: '7.7.7.' + i });
  r = await call('POST', '/api/auth/login', { body: { username: 'salvatore', password: 'Trota-Verde-4821x' }, ip: '7.7.7.9' });
  ok(r.status === 401 && /bloccato/.test(r.json.error), 'blocco dopo 5 errori: ' + (r.json && r.json.error));

  // sblocco per proseguire con le prove
  await blobs.setJSON('users', Object.assign(await blobs.get('users'), {}));
  const users = await blobs.get('users'); users.salvatore.locked_until = 0; await blobs.setJSON('users', users);

  // ---------------- amministrazione
  r = await call('POST', '/api/admin/users', { cookie: jar.salvatore, body: { do: 'invite', user: 'guest', role: 'guest' } });
  ok(r.status === 200 && r.json.link, 'invito guest creato', JSON.stringify(r));
  const guestTok = r.json.link.split('=')[1];
  r = await call('POST', '/api/admin/users', { cookie: jar.salvatore, body: { do: 'invite', user: 'Nome Con Spazi', role: 'user' } });
  ok(r.status === 400, 'nome utente non valido rifiutato');
  r = await call('POST', '/api/auth/accept', { body: { t: guestTok, password: 'Ospite-Prova-2468z', password2: 'Ospite-Prova-2468z' } });
  jar.guest = r.cookie;
  ok(r.status === 200, 'guest completa l\'invito');
  r = await call('GET', '/api/admin/users', { cookie: jar.guest });
  ok(r.status === 403, 'guest non entra nell\'admin');
  r = await call('GET', '/api/admin/users', { cookie: jar.salvatore });
  ok(r.status === 200 && r.json.users.length === 2 && r.json.users.find((u) => u.user === 'guest').limit === 30, 'elenco utenti: guest con limite 30');
  r = await call('POST', '/api/admin/users', { cookie: jar.salvatore, body: { do: 'delete', user: 'salvatore' } });
  ok(r.status === 409, 'non puoi eliminarti');
  r = await call('POST', '/api/admin/users', { cookie: jar.salvatore, body: { do: 'role', user: 'salvatore', role: 'user' } });
  ok(r.status === 409, 'deve restare un admin');
  r = await call('POST', '/api/admin/users', { cookie: jar.salvatore, body: { do: 'limit', user: 'guest', limit: 2 } });
  ok(r.status === 200, 'limite del guest impostato a 2');

  // ---------------- azioni del tutor (come admin)
  const S = jar.salvatore2;
  r = await call('POST', '/api', { cookie: S, body: { action: 'profile_set', level: 'C1' } });
  ok(r.status === 400, 'livello non valido rifiutato');
  r = await call('POST', '/api', { cookie: S, body: { action: 'profile_set', level: 'A2', source: 'test' } });
  ok(r.status === 200 && r.json.plan[0].title === 'Presente regolare e articoli' && r.json.profile.level === 'A2', 'profilo A2: piano per il livello');
  r = await call('GET', '/api', { cookie: S });
  ok(r.json.needsPlacement === false && r.json.profile.level === 'A2', 'dopo il livello: niente più benvenuto');

  r = await call('POST', '/api', { cookie: S, body: { action: 'chat', messages: [], mode: 'conversazione', scenario: 'ristorante', topic: '' } });
  ok(r.status === 200 && r.json.topic && r.json.reply, 'chat: saluto con argomento');
  ok(counter.last.thinking && counter.last.thinking.type === 'between_tools', 'chat: ragionamento spento');
  ok(counter.last.system.includes('livello A2'), 'chat: prompt adattato al livello A2');
  const t1 = r.json.topic;
  r = await call('POST', '/api', { cookie: S, body: { action: 'chat', messages: [{ role: 'assistant', text: 'Hola' }, { role: 'user', text: 'yo soy 20' }], mode: 'conversazione', scenario: 'ristorante', topic: t1 } });
  ok(r.status === 200 && r.json.corrections.length === 1 && r.json.topic === t1 && r.json.stats.todayTurns === 1, 'chat: correzione, stesso argomento, attività registrata');
  ok(r.json.stats.vocabCount === 1, 'chat: parola nel mazzo');
  r = await call('POST', '/api', { cookie: S, body: { action: 'hint', level: 1, draft: 'sciopero', messages: [{ role: 'assistant', text: '¿Por qué llegaste tarde?' }] } });
  ok(r.status === 200 && r.json.hint.includes('trabaja'), 'hint livello 1');
  r = await call('POST', '/api', { cookie: S, body: { action: 'hint', level: 2, draft: 'sciopero', messages: [] } });
  ok(r.status === 200 && r.json.hint.includes('huelga'), 'hint livello 2');
  r = await call('POST', '/api', { cookie: S, body: { action: 'deck', limit: 20 } });
  ok(r.json.total === 2 && r.json.due.some((c) => c.es === 'la huelga'), 'la parola del suggerimento è nel mazzo');

  const before = counter.n;
  r = await call('POST', '/api', { cookie: S, body: { action: 'grammar', topic: 'pron-diretti' } });
  ok(r.status === 200 && r.json.lesson.blocks[0].table.headers.length === 2, 'lezione generata');
  r = await call('POST', '/api', { cookie: S, body: { action: 'grammar', topic: 'pron-diretti' } });
  ok(counter.n === before + 1, 'lezione in cache: una sola chiamata a Claude');
  r = await call('POST', '/api', { cookie: S, body: { action: 'grammar', topic: 'inesistente' } });
  ok(r.status === 400, 'argomento sconosciuto: 400');

  r = await call('POST', '/api', { cookie: S, body: { action: 'exercises', topic: 'mix', kind: 'misti', n: 6 } });
  ok(r.status === 200 && r.json.items.length === 6, 'esercizi: 6 richiesti, 6 consegnati', JSON.stringify(r.json).slice(0, 150));
  ok(!r.json.items.some((i) => /posta/.test(i.q)), 'esercizi: una glossa tra parentesi nella frase fa scartare l\'esercizio');
  const ex1 = r.json.items;
  const sc = ex1.find((i) => i.type === 'scelta');
  ok(sc && sc.options[sc.answer] !== undefined && ['fui', 'estamos', 'llegan', 'es'].includes(sc.options[sc.answer]), 'scelta: indice della risposta coerente dopo il rimescolamento');
  r = await call('POST', '/api', { cookie: S, body: { action: 'exercises', topic: 'mix', kind: 'misti', n: 6 } });
  const repeated = r.json.items.filter((i) => ex1.some((j) => j.q === i.q));
  ok(r.status === 200 && repeated.length === 0, 'seconda serie senza frasi uguali alla prima', repeated.map((i) => i.q).join(' | '));
  r = await call('POST', '/api', { cookie: S, body: { action: 'grade', items: [{ q: 'Vado al mercato.', ref: 'Voy al mercado.', answer: 'Voy al mercado' }, { q: 'x', ref: 'y', answer: '' }] } });
  ok(r.status === 200 && r.json.results.length === 2 && r.json.results[0].ok && !r.json.results[1].ok, 'grade: risultati nello stesso ordine');
  ok(r.json.results[0].score === 1 && r.json.results[1].score === 0.75, 'grade: punteggio decimale a passi di 0,25 (0,7 → 0,75)', JSON.stringify(r.json.results));
  r = await call('POST', '/api', { cookie: S, body: { action: 'record_exercise', topic: 'mix', correct: 3.6, total: 4, errors: [] } });
  ok(r.status === 200 && r.json.stats.exProgress.mix.correct === 3.5, 'record_exercise: accetta punteggi decimali (3,6 → 3,5)', JSON.stringify(r.json.stats.exProgress));
  r = await call('POST', '/api', { cookie: S, body: { action: 'record_exercise', topic: 'pron-diretti', correct: 5, total: 8, errors: [{ orig: 'lo', corr: 'la', note: 'n' }] } });
  ok(r.status === 200 && r.json.stats.exProgress['pron-diretti'].done === 8 && r.json.stats.topErrors['Pronomi'] === 1, 'record_exercise: progressi e errore per sezione');

  r = await call('POST', '/api', { cookie: S, body: { action: 'vocab', theme: 'cibo' } });
  ok(r.status === 200 && r.json.words.length === 24 && r.json.words[0].inDeck === false, 'vocabolario: 24 parole');
  r = await call('POST', '/api', { cookie: S, body: { action: 'deck_add', theme: 'cibo' } });
  ok(r.json.added === 24, 'deck_add: 24 parole aggiunte');
  r = await call('POST', '/api', { cookie: S, body: { action: 'deck_add', theme: 'cibo' } });
  ok(r.json.added === 0, 'deck_add: nessun doppione');
  r = await call('POST', '/api', { cookie: S, body: { action: 'deck_review', es: 'la palabra3', known: true } });
  ok(r.json.ok === true, 'deck_review: parola trovata');
  r = await call('POST', '/api', { cookie: S, body: { action: 'deck', limit: 40 } });
  ok(r.json.due.some((c) => c.es === 'la palabra5' && Array.isArray(c.syn) && c.syn[0] === 'el vocablo5'), 'il mazzo conserva i sinonimi');
  r = await call('POST', '/api', { cookie: S, body: { action: 'grade_vocab', items: [{ it: 'parola 1', es: 'la palabra1', answer: 'sinónimo' }, { it: 'parola 2', es: 'la palabra2', answer: 'casa' }, { it: 'parola 3', es: 'la palabra3', answer: '' }, { it: 'parola 4', es: 'la palabra4', answer: 'sinonimo italiano', dir: 'es-it' }] } });
  ok(r.status === 200 && r.json.results.length === 4 && r.json.results[0].ok && !r.json.results[1].ok && r.json.results[3].ok, 'grade_vocab: sinonimi accettati (anche nel verso spagnolo→italiano), altre parole no', JSON.stringify(r.json));
  ok(JSON.stringify(counter.last.messages).includes('es-it') && counter.last.system.includes('es-it'), 'grade_vocab: la direzione arriva al tutor');
  r = await call('POST', '/api', { cookie: S, body: { action: 'verb_check', inf: 'zumbar' } });
  ok(r.status === 200 && r.json.exists && r.json.regular && r.json.it === 'ronzare', 'verb_check: verbo esistente e regolare', JSON.stringify(r.json));
  const callsBefore = counter.n;
  r = await call('POST', '/api', { cookie: S, body: { action: 'verb_check', inf: 'zumbar' } });
  ok(r.status === 200 && counter.n === callsBefore, 'verb_check: la seconda richiesta viene dalla cache (nessuna chiamata a Claude)');
  r = await call('POST', '/api', { cookie: S, body: { action: 'verb_check', inf: 'ablar' } });
  ok(r.status === 200 && !r.json.exists && r.json.suggestions[0] === 'hablar' && r.json.regular === false, 'verb_check: verbo inesistente con suggerimenti', JSON.stringify(r.json));
  r = await call('POST', '/api', { cookie: S, body: { action: 'verb_check', inf: 'irregolarar' } });
  ok(r.status === 200 && r.json.exists && !r.json.regular, 'verb_check: verbo esistente ma irregolare');
  const vp = [{ inf: 'caber', tense: 'indefinido', tenseIt: 'passato remoto', it: 'starci', persons: ['yo', 'tú', 'él', 'nosotros', 'vosotros', 'ellos'] }];
  r = await call('POST', '/api', { cookie: S, body: { action: 'verb_italian', pairs: vp } });
  ok(r.status === 200 && r.json.items[0].forms.length === 6 && r.json.items[0].forms[1].startsWith('tu '), 'verb_italian: forme italiane per tutte le persone', JSON.stringify(r.json));
  const before2 = counter.n;
  r = await call('POST', '/api', { cookie: S, body: { action: 'verb_italian', pairs: vp } });
  ok(r.status === 200 && r.json.items[0].forms.length === 6 && counter.n === before2, 'verb_italian: la seconda richiesta viene dalla cache');
  r = await call('POST', '/api', { cookie: S, body: { action: 'verb_italian', pairs: [{ inf: 'casa', tense: 'indefinido', persons: ['yo'] }] } });
  ok(r.status === 400, 'verb_italian: infinito non valido rifiutato');
  r = await call('POST', '/api', { cookie: S, body: { action: 'verb_check', inf: 'casa' } });
  ok(r.status === 400, 'verb_check: parola che non è un infinito rifiutata');
  r = await call('POST', '/api', { cookie: S, body: { action: 'grade_vocab', items: [] } });
  ok(r.status === 400, 'grade_vocab senza risposte: 400');
  r = await call('POST', '/api', { cookie: S, body: { action: 'deck_review_many', items: [{ es: 'la palabra7', known: true }, { es: 'la palabra8', known: false }, { es: 'inesistente', known: true }] } });
  ok(r.status === 200 && r.json.found === 2, 'deck_review_many: aggiorna le parole del mazzo e ignora le altre', JSON.stringify(r.json));
  r = await call('POST', '/api', { cookie: S, body: { action: 'record_exercise', topic: 'vocabolario', correct: 1, total: 2, errors: [{ orig: 'x', corr: 'la palabra8', note: 'parola 8' }] } });
  ok(r.status === 200 && r.json.stats.topErrors['lessico'] >= 1, 'record_exercise vocabolario: errori nella categoria lessico');
  r = await call('POST', '/api', { cookie: S, body: { action: 'deck', limit: 40 } });
  ok(r.json.total === 26 && r.json.dueTotal === 24 && r.json.boxes[1] === 2, 'mazzo: due parole promosse e rimandate', JSON.stringify(r.json.boxes) + ' ' + r.json.dueTotal);

  r = await call('POST', '/api', { cookie: S, body: { action: 'test' } });
  ok(r.status === 200 && r.json.items.length === 20 && r.json.writing, 'test: 20 domande e una consegna');
  r = await call('POST', '/api', { cookie: S, body: { action: 'writing', prompt: 'x', text: 'corto' } });
  ok(r.status === 400, 'testo troppo corto: 400');
  r = await call('POST', '/api', { cookie: S, body: { action: 'writing', prompt: 'Racconta', text: 'Ayer he comido con mis amigos en un restaurante.' } });
  ok(r.status === 200 && r.json.score === 7 && r.json.level === 'B1', 'writing: punteggio arrotondato e livello');
  r = await call('POST', '/api', { cookie: S, body: { action: 'test_result', correct: 12, total: 20, sections: { tempi: { correct: 3, total: 5 } }, level: 'B1-', writing: 0, errors: [] } });
  ok(r.status === 200 && r.json.stats.tests[0].writing === 0 && r.json.stats.tests[0].correct === 12, 'test_result: punteggio scritto 0 conservato');
  r = await call('POST', '/api', { cookie: S, body: { action: 'inventata' } });
  ok(r.status === 400, 'azione sconosciuta: 400');

  // ---------------- limite giornaliero (guest: 2 richieste)
  const G = jar.guest;
  r = await call('POST', '/api', { cookie: G, body: { action: 'hint', level: 1, draft: 'a', messages: [] } });
  ok(r.status === 200, 'guest: richiesta 1');
  r = await call('POST', '/api', { cookie: G, body: { action: 'hint', level: 1, draft: 'b', messages: [] } });
  ok(r.status === 200, 'guest: richiesta 2');
  r = await call('POST', '/api', { cookie: G, body: { action: 'hint', level: 1, draft: 'c', messages: [] } });
  ok(r.status === 429 && /limite giornaliero/.test(r.json.error), 'guest: la terza è bloccata dal limite');
  r = await call('POST', '/api', { cookie: G, body: { action: 'deck', limit: 5 } });
  ok(r.status === 200, 'azioni senza Claude restano libere oltre il limite');

  // ---------------- dati separati e password
  r = await call('GET', '/api', { cookie: G });
  ok(r.json.stats.vocabCount === 0 && r.json.needsPlacement === true, 'i dati di un utente non si mescolano con quelli di un altro');
  r = await call('POST', '/api/auth/password', { cookie: S, body: { old: 'sbagliata', password: 'Nuovo-Segreto-77k', password2: 'Nuovo-Segreto-77k' } });
  ok(r.status === 400, 'cambio password: attuale errata');
  r = await call('POST', '/api/auth/password', { cookie: S, body: { old: 'Trota-Verde-4821x', password: 'Nuovo-Segreto-77k', password2: 'Nuovo-Segreto-77k' } });
  ok(r.status === 200 && r.cookie, 'cambio password riuscito');
  const newCookie = r.cookie;
  r = await call('GET', '/api', { cookie: jar.salvatore });
  ok(r.status === 401, 'le altre sessioni decadono dopo il cambio password');
  r = await call('GET', '/api', { cookie: newCookie });
  ok(r.status === 200, 'la sessione che ha cambiato la password resta valida');

  // ---------------- disattivazione ed eliminazione
  r = await call('POST', '/api/admin/users', { cookie: newCookie, body: { do: 'disable', user: 'guest' } });
  ok(r.status === 200, 'guest disattivato');
  r = await call('GET', '/api', { cookie: G });
  ok(r.status === 401, 'sessione del guest non più valida');
  r = await call('POST', '/api/auth/login', { body: { username: 'guest', password: 'Ospite-Prova-2468z' }, ip: '6.6.6.6' });
  ok(r.status === 401, 'guest disattivato non entra');
  r = await call('POST', '/api/admin/users', { cookie: newCookie, body: { do: 'delete', user: 'guest' } });
  ok(r.status === 200 && (await blobs.get('data/guest')) === null, 'guest eliminato con i suoi dati');
  r = await call('POST', '/api/auth/logout', { cookie: newCookie, body: {} });
  ok(r.status === 200 && /Max-Age=0/.test(r.cookie), 'logout: cookie azzerato');

  return { failures, total: results.length, results, claudeCalls: counter.n };
}
