// Accessi del tutor: utenti, inviti, sessioni firmate, blocco dopo errori, limite giornaliero di richieste.
// Tutto sta nell'archivio (Netlify Blobs): 'users', 'tokens', 'ipfails', 'usage/<utente>'.
import { HttpError, hashPassword, verifyPassword, sha256Hex, randomHex, hmac, b64url, unb64url, constantTimeEqual, today } from './core.mjs';

export const ROLES = ['admin', 'user', 'guest'];
export const MIN_PW = 10;
export const INVITE_TTL = 7 * 86400;
export const SESSION_TTL = 30 * 86400;
export const DEFAULT_LIMIT = 150;
export const GUEST_LIMIT = 30;
const MAX_FAILS = 5;
const LOCK_SECONDS = 300;
const IP_MAX_FAILS = 20;
const COOKIE = 'spagnolo_session';

const nowSec = () => Math.floor(Date.now() / 1000);

export const validUsername = (u) => typeof u === 'string' && /^[a-z0-9][a-z0-9._@+-]{2,63}$/.test(u) && !u.includes('..');

export function passwordProblems(pw, username) {
  const p = [];
  if (pw.length < MIN_PW) p.push(`almeno ${MIN_PW} caratteri`);
  const classes = (/[a-z]/.test(pw) ? 1 : 0) + (/[A-Z]/.test(pw) ? 1 : 0) + (/\d/.test(pw) ? 1 : 0) + (/[^a-zA-Z\d]/.test(pw) ? 1 : 0);
  if (classes < 3) p.push('almeno tre tra minuscole, maiuscole, numeri e simboli');
  const low = pw.toLowerCase();
  if (username && low.includes(username.toLowerCase())) p.push('non deve contenere il nome utente');
  if (['password', 'qwerty', 'spagnolo', 'espanol', 'letmein', 'abc123'].some((w) => low.includes(w))) p.push('non deve contenere parole comuni');
  if (/(.)\1{3,}/.test(pw)) p.push('non più di 3 caratteri uguali di fila');
  return p;
}

export const getUsers = (store) => store.read('users', {});
export async function getUser(store, name) {
  const u = (await getUsers(store))[String(name).toLowerCase()];
  return u && typeof u === 'object' ? u : null;
}
export const fingerprint = async (u) => (await sha256Hex(String(u.hash || ''))).slice(0, 16);
export const adminCount = (users) => Object.values(users).filter((u) => u.role === 'admin' && !u.disabled && !u.pending).length;

// ---------------------------------------------------------------- inviti e password

// Crea (o rinnova per un utente esistente) un link a uso singolo e lo restituisce.
export async function invite(store, origin, username, role = 'user', limit = null) {
  username = String(username).toLowerCase();
  if (!validUsername(username)) throw new HttpError(400, 'Nome utente non valido: da 3 a 64 caratteri tra lettere, numeri e . _ - @ + (senza spazi).');
  if (!ROLES.includes(role)) role = 'user';
  await store.update('users', {}, (users) => {
    if (!users[username]) {
      users[username] = {
        hash: '!', role, pending: true, created: nowSec(), fails: 0, locked_until: 0, last_login: 0,
        limit: limit === null ? (role === 'guest' ? GUEST_LIMIT : DEFAULT_LIMIT) : Math.max(0, limit),
      };
    }
    return users;
  });
  const token = randomHex(24);
  const key = await sha256Hex(token);
  await store.update('tokens', {}, (t) => {
    const now = nowSec();
    for (const [k, v] of Object.entries(t)) if ((v.exp || 0) < now || v.user === username) delete t[k];   // un solo link valido per utente
    t[key] = { user: username, exp: now + INVITE_TTL };
    return t;
  });
  return `${origin}/invito.html?t=${token}`;
}

export async function tokenUser(store, token) {
  if (!/^[a-f0-9]{48}$/.test(String(token))) return null;
  const t = (await store.read('tokens', {}))[await sha256Hex(token)];
  if (!t || (t.exp || 0) < nowSec()) return null;
  return (await getUser(store, t.user)) ? t.user : null;
}

export async function burnToken(store, token) {
  const key = await sha256Hex(token);
  await store.update('tokens', {}, (t) => { delete t[key]; return t; });
}

export async function setPassword(store, username, pw) {
  const hash = await hashPassword(pw);
  await store.update('users', {}, (users) => {
    if (!users[username]) return users;
    users[username].hash = hash;
    delete users[username].pending;
    users[username].fails = 0;
    users[username].locked_until = 0;
    return users;
  });
}

// ---------------------------------------------------------------- accesso

let dummyHash = null;

// Verifica nome e password con blocco temporaneo dopo troppi errori. Restituisce { ok, error }.
export async function attemptLogin(store, username, pw, ip = '?') {
  username = String(username).trim().toLowerCase();
  const now = nowSec();
  const generic = 'Nome utente o password non corretti.';

  const ipLog = await store.read('ipfails', {});
  const recent = (ipLog[ip] || []).filter((t) => t > now - 900);
  if (recent.length >= IP_MAX_FAILS) return { ok: false, error: 'Troppi tentativi da questo indirizzo. Riprova tra qualche minuto.' };

  const u = validUsername(username) ? await getUser(store, username) : null;
  if (u && (u.locked_until || 0) > now) return { ok: false, error: 'Account bloccato per qualche minuto dopo troppi errori. Riprova più tardi.' };

  let ok = false;
  if (u && !u.pending && !u.disabled) ok = await verifyPassword(pw, u.hash);
  else {
    dummyHash = dummyHash || hashPassword('dummy-' + randomHex(4));   // stesso tempo di risposta anche se l'utente non c'è
    await verifyPassword(pw, await dummyHash);
  }
  if (ok) return { ok: true, username };

  await store.update('ipfails', {}, (l) => {
    for (const k of Object.keys(l)) { l[k] = l[k].filter((t) => t > now - 900); if (!l[k].length) delete l[k]; }
    (l[ip] = l[ip] || []).push(now);
    return l;
  });
  if (u) {
    await store.update('users', {}, (users) => {
      if (!users[username]) return users;
      const f = (users[username].fails || 0) + 1;
      users[username].fails = f;
      if (f >= MAX_FAILS) { users[username].locked_until = now + LOCK_SECONDS; users[username].fails = 0; }
      return users;
    });
  }
  return { ok: false, error: generic };
}

export async function markLogin(store, username) {
  await store.update('users', {}, (users) => {
    if (users[username]) { users[username].last_login = nowSec(); users[username].fails = 0; users[username].locked_until = 0; }
    return users;
  });
}

// ---------------------------------------------------------------- sessione (cookie firmato)

export async function sessionCookie(secret, username, user) {
  const payload = b64url(new TextEncoder().encode(JSON.stringify({ u: username, v: await fingerprint(user), e: nowSec() + SESSION_TTL })));
  const sig = await hmac(secret, payload);
  return `${COOKIE}=${payload}.${sig}; Path=/; Max-Age=${SESSION_TTL}; HttpOnly; Secure; SameSite=Lax`;
}
export const clearCookie = () => `${COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`;

function cookieValue(h) {
  h = h || '';
  for (const part of h.split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === COOKIE) return part.slice(i + 1).trim();
  }
  return '';
}

// Utente della sessione, se la firma è valida, non è scaduta, l'utente esiste ancora, non è disattivato
// e la password è quella con cui ha fatto l'accesso. Restituisce { name, user } oppure null.
export async function sessionUser(cookieHeader, secret, store) {
  const raw = cookieValue(cookieHeader);
  const dot = raw.indexOf('.');
  if (!secret || dot < 1) return null;
  const payload = raw.slice(0, dot);
  if (!constantTimeEqual(await hmac(secret, payload), raw.slice(dot + 1))) return null;
  let p;
  try { p = JSON.parse(new TextDecoder().decode(unb64url(payload))); } catch { return null; }
  if (!p || typeof p.u !== 'string' || (p.e || 0) < nowSec()) return null;
  const user = await getUser(store, p.u);
  if (!user || user.disabled || user.pending || p.v !== await fingerprint(user)) return null;
  return { name: p.u, user };
}

// ---------------------------------------------------------------- limite giornaliero di richieste a Claude

export const limitOf = (user) => (user ? Math.max(0, Number(user.limit ?? DEFAULT_LIMIT)) : 0);

export async function usageToday(store, name) {
  return (await store.read('usage/' + name, {}))[today()] || 0;
}

// Registra una richiesta; false se il limite del giorno è già stato raggiunto.
export async function quotaHit(store, name, user) {
  const limit = limitOf(user);
  const day = today();
  let allowed = true;
  await store.update('usage/' + name, {}, (mine) => {
    const n = mine[day] || 0;
    if (limit > 0 && n >= limit) { allowed = false; return mine; }
    mine[day] = n + 1;
    const keep = Object.keys(mine).sort().reverse().slice(0, 14);
    return Object.fromEntries(keep.map((k) => [k, mine[k]]));
  });
  return allowed;
}

// ---------------------------------------------------------------- amministrazione

export async function listUsers(store) {
  const users = await getUsers(store);
  const out = [];
  for (const name of Object.keys(users).sort()) {
    const u = users[name];
    out.push({
      user: name, role: u.role || 'user', status: u.disabled ? 'disattivato' : u.pending ? 'in attesa di invito' : 'attivo',
      disabled: !!u.disabled, pending: !!u.pending, last_login: u.last_login || 0, limit: limitOf(u), used: await usageToday(store, name),
    });
  }
  return out;
}

// Esegue un'azione dell'admin. Restituisce { message, link? }.
export async function adminAction(store, origin, me, body) {
  const doit = String(body.do || '');
  const target = String(body.user || '').trim().toLowerCase();
  const users = await getUsers(store);

  if (doit === 'invite') {
    if (users[target] && !users[target].pending) throw new HttpError(409, 'Esiste già un utente con questo nome.');
    const role = ROLES.includes(body.role) ? body.role : 'user';
    const limit = body.limit === '' || body.limit == null ? null : Math.max(0, parseInt(body.limit, 10) || 0);
    const link = await invite(store, origin, target, role, limit);
    return { message: `Invito creato per ${target}. Copia il link e mandalo alla persona: vale 7 giorni e non si rivede più.`, link };
  }
  if (!users[target]) throw new HttpError(404, 'Utente non trovato.');

  if (doit === 'link') {
    const link = await invite(store, origin, target, users[target].role || 'user');
    return { message: `Nuovo link per ${target} (vale 7 giorni; la password attuale resta valida finché non lo usa).`, link };
  }
  if (doit === 'limit') {
    const n = Math.max(0, Math.min(5000, parseInt(body.limit, 10) || 0));
    await store.update('users', {}, (all) => { if (all[target]) all[target].limit = n; return all; });
    return { message: `Limite giornaliero di ${target}: ${n > 0 ? n + ' richieste' : 'nessun limite'}.` };
  }
  if (['disable', 'enable', 'delete', 'role'].includes(doit)) {
    const newRole = ROLES.includes(body.role) ? body.role : users[target].role || 'user';
    const wasActiveAdmin = users[target].role === 'admin' && !users[target].disabled && !users[target].pending;
    const removesAdmin = wasActiveAdmin && (doit === 'disable' || doit === 'delete' || (doit === 'role' && newRole !== 'admin'));
    if (removesAdmin && adminCount(users) <= 1) throw new HttpError(409, 'Deve restare almeno un amministratore attivo.');
    if (target === me && (doit === 'disable' || doit === 'delete')) throw new HttpError(409, 'Non puoi disattivare o eliminare te stesso.');
    await store.update('users', {}, (all) => {
      if (!all[target]) return all;
      if (doit === 'delete') delete all[target];
      else if (doit === 'disable') all[target].disabled = true;
      else if (doit === 'enable') delete all[target].disabled;
      else all[target].role = newRole;
      return all;
    });
    if (doit === 'delete') {
      await store.update('tokens', {}, (t) => { for (const [k, v] of Object.entries(t)) if (v.user === target) delete t[k]; return t; });
      await store.remove('usage/' + target);
      await store.remove('data/' + target);
    }
    return { message: { disable: 'Utente disattivato: le sue sessioni non valgono più.', enable: 'Utente riattivato.', delete: 'Utente eliminato, con i suoi dati di studio.', role: 'Ruolo aggiornato.' }[doit] };
  }
  throw new HttpError(400, 'Azione sconosciuta.');
}

// Primo amministratore: possibile solo finché non ce n'è uno attivo e con il token di setup configurato sul sito.
export async function setupFirstAdmin(store, origin, setupToken, givenToken, username) {
  if (!setupToken) throw new HttpError(404, 'Non disponibile.');
  if (!constantTimeEqual(String(givenToken || ''), setupToken)) throw new HttpError(403, 'Token di setup non corretto.');
  if (adminCount(await getUsers(store)) > 0) throw new HttpError(409, 'Esiste già un amministratore: usa la pagina Accessi.');
  return invite(store, origin, username, 'admin');
}
