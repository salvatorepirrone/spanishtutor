// Instradamento delle richieste /api/*: accessi, amministrazione e azioni del tutor.
// Riceve le dipendenze (archivio, variabili d'ambiente, indirizzo IP, fetch) e restituisce una Response: così si può provare anche fuori da Netlify.
import { HttpError, makeStore, verifyPassword } from './core.mjs';
import * as auth from './auth.mjs';
import { ACTIONS, state } from './actions.mjs';

const BASE_HEADERS = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' };

function reply(data, status = 200, cookie = null) {
  const h = new Headers(BASE_HEADERS);
  if (cookie) h.append('set-cookie', cookie);
  return new Response(JSON.stringify(data), { status, headers: h });
}

async function body(req) {
  const j = await req.json().catch(() => null);
  if (!j || typeof j !== 'object' || Array.isArray(j)) throw new HttpError(400, 'Richiesta non valida');
  return j;
}

export async function handle(req, deps) {
  try {
    return await route(req, deps);
  } catch (e) {
    if (e instanceof HttpError) return reply({ error: e.message, ...(e.extra || {}) }, e.status);
    console.error('Errore non gestito:', e && e.stack ? e.stack : e);
    return reply({ error: 'Errore del server, riprova.' }, 500);
  }
}

async function route(req, deps) {
  const store = makeStore(deps.blobs);
  const env = deps.env || {};
  const url = new URL(req.url);
  const path = url.pathname.replace(/\/+$/, '') || '/';
  const method = req.method.toUpperCase();
  const origin = env.PUBLIC_URL || url.origin;
  const secret = env.SESSION_SECRET || '';
  // deps.onSetCookie serve solo alle prove: nel browser l'intestazione Set-Cookie di una Response costruita a mano viene scartata.
  const out = (data, status = 200, cookie = null) => { if (cookie && deps.onSetCookie) deps.onSetCookie(cookie); return reply(data, status, cookie); };

  // Le richieste che modificano qualcosa devono avere un'intestazione che un altro sito non può aggiungere (difesa da richieste incrociate).
  if (method !== 'GET' && method !== 'HEAD' && req.headers.get('x-requested-with') !== 'spagnolo') throw new HttpError(403, 'Richiesta non consentita.');
  if (!secret || secret.length < 32) throw new HttpError(500, 'SESSION_SECRET non configurato sul sito (almeno 32 caratteri).');

  // ---- pagine pubbliche: accesso, invito, primo amministratore
  if (path === '/api/auth/login' && method === 'POST') {
    const b = await body(req);
    const r = await auth.attemptLogin(store, String(b.username || ''), String(b.password || ''), deps.ip || '?');
    if (!r.ok) throw new HttpError(401, r.error);
    const user = await auth.getUser(store, r.username);
    await auth.markLogin(store, r.username);
    return out({ ok: true }, 200, await auth.sessionCookie(secret, r.username, user));
  }
  if (path === '/api/auth/logout' && method === 'POST') return out({ ok: true }, 200, auth.clearCookie());

  if (path === '/api/auth/invite' && method === 'GET') {
    const name = await auth.tokenUser(store, url.searchParams.get('t') || '');
    if (!name) throw new HttpError(404, 'Link non valido o scaduto');
    return out({ username: name });
  }
  if (path === '/api/auth/accept' && method === 'POST') {
    const b = await body(req);
    const token = String(b.t || '');
    const name = await auth.tokenUser(store, token);
    if (!name) throw new HttpError(404, 'Link non valido o scaduto');
    const pw = String(b.password || '');
    const problems = auth.passwordProblems(pw, name);
    if (pw !== String(b.password2 || '')) problems.push('le due password non coincidono');
    if (problems.length) { const e = new HttpError(400, 'La password non va bene: ' + problems.join('; ') + '.'); e.extra = { problems }; throw e; }
    await auth.setPassword(store, name, pw);
    await auth.burnToken(store, token);
    await auth.markLogin(store, name);
    return out({ ok: true }, 200, await auth.sessionCookie(secret, name, await auth.getUser(store, name)));
  }
  if (path === '/api/setup' && method === 'POST') {
    const b = await body(req);
    const link = await auth.setupFirstAdmin(store, origin, env.SETUP_TOKEN, b.token, String(b.username || '').trim().toLowerCase());
    return out({ link });
  }

  // ---- da qui serve una sessione valida
  // deps.cookie serve solo alle prove (nel browser l'intestazione Cookie di una Request costruita a mano viene scartata).
  const sess = await auth.sessionUser(deps.cookie !== undefined ? deps.cookie : req.headers.get('cookie'), secret, store);
  if (!sess) throw new HttpError(401, 'Sessione scaduta: accedi di nuovo.');
  const ctx = { store, user: sess.name, userRec: sess.user, env, now: new Date(), fetch: deps.fetch };

  if (path === '/api/auth/me' && method === 'GET') {
    return out({ user: sess.name, role: sess.user.role || 'user', limit: auth.limitOf(sess.user), used: await auth.usageToday(store, sess.name) });
  }
  if (path === '/api/auth/password' && method === 'POST') {
    const b = await body(req);
    if (!(await verifyPassword(String(b.old || ''), sess.user.hash))) throw new HttpError(400, 'La password attuale non è corretta.');
    const pw = String(b.password || '');
    const problems = auth.passwordProblems(pw, sess.name);
    if (pw !== String(b.password2 || '')) problems.push('le due password nuove non coincidono');
    if (problems.length) { const e = new HttpError(400, 'La nuova password non va bene: ' + problems.join('; ') + '.'); e.extra = { problems }; throw e; }
    await auth.setPassword(store, sess.name, pw);
    return out({ ok: true }, 200, await auth.sessionCookie(secret, sess.name, await auth.getUser(store, sess.name)));   // questa sessione resta valida, le altre decadono
  }

  if (path === '/api/admin/users') {
    if ((sess.user.role || 'user') !== 'admin') throw new HttpError(403, 'Riservato agli amministratori.');
    if (method === 'GET') return out({ users: await auth.listUsers(store), me: sess.name });
    if (method === 'POST') return out(await auth.adminAction(store, origin, sess.name, await body(req)));
  }

  // ---- il tutor
  if (path === '/api') {
    if (method === 'GET') return out(await state(ctx));
    if (method === 'POST') {
      const b = await body(req);
      const fn = ACTIONS[String(b.action || '')];
      if (!fn) throw new HttpError(400, 'Azione sconosciuta');
      return out(await fn(ctx, b));
    }
  }
  throw new HttpError(404, 'Non trovato');
}
