// Utilità condivise dal backend del tutor: errori, date, crittografia, archivio dati, profilo e statistiche.
// Nessuna dipendenza da Node: usa solo API web (fetch, crypto.subtle), così la logica si può provare anche nel browser.
import DATA from './data.mjs';

export const CFG = {
  DEADLINE: '2026-12-02',
  START: '2026-10-12',
  MODEL: 'claude-sonnet-5-5',
  MAX_MESSAGES: 24,
  MAX_CHARS: 800,
  SRS_DAYS: [1, 3, 7, 16, 35],
  BASE_RULES: 'Sei un insegnante di spagnolo (variante della Spagna) per studenti italiani adulti di livello A2-B1. Spiegazioni e consegne in italiano; frasi di esempio e contenuti da imparare in spagnolo, naturali e corretti. Rispondi SOLO con un oggetto JSON valido, senza testo prima o dopo e senza blocchi di codice.',
};
export const LEVELS = DATA.levels;
export { DATA };

export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

// ---------------------------------------------------------------- testo, date, casualità

export function str(v, max) {
  return (typeof v === 'string' || typeof v === 'number') ? String(v).slice(0, max).trim() : '';
}

export function today(now = new Date()) {
  return now.toLocaleDateString('sv-SE', { timeZone: 'Europe/Rome' });   // AAAA-MM-GG
}

export function addDays(date, n) {
  const d = new Date(date + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function daysBetween(a, b) {
  return Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86400000);
}

export function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
export const pickN = (arr, n) => shuffle(arr).slice(0, n);
export const pickOne = (arr) => (arr.length ? arr[Math.floor(Math.random() * arr.length)] : '');

// ---------------------------------------------------------------- crittografia (WebCrypto)

const enc = new TextEncoder();
const toB64 = (buf) => { let s = ''; for (const b of new Uint8Array(buf)) s += String.fromCharCode(b); return btoa(s); };
const fromB64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
export const b64url = (buf) => toB64(buf).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
export const unb64url = (s) => fromB64(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4));

export function randomHex(bytes) {
  return [...crypto.getRandomValues(new Uint8Array(bytes))].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function sha256Hex(text) {
  const h = await crypto.subtle.digest('SHA-256', enc.encode(text));
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function constantTimeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

let iterOverride = 0;
export function setIterations(n) { iterOverride = n; }   // solo per le prove: abbassa il costo della derivazione

function iterations() {
  if (iterOverride > 0) return iterOverride;
  const e = typeof process !== 'undefined' && process.env ? Number(process.env.PBKDF2_ITER) : 0;
  return e > 0 ? e : 600000;
}

async function pbkdf2(pw, salt, iter) {
  const key = await crypto.subtle.importKey('raw', enc.encode(pw), 'PBKDF2', false, ['deriveBits']);
  return crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: iter }, key, 256);
}

export async function hashPassword(pw, iter = iterations()) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return `pbkdf2$${iter}$${toB64(salt)}$${toB64(await pbkdf2(pw, salt, iter))}`;
}

export async function verifyPassword(pw, stored) {
  const p = String(stored || '').split('$');
  if (p.length !== 4 || p[0] !== 'pbkdf2') return false;
  const bits = toB64(await pbkdf2(pw, fromB64(p[2]), Number(p[1])));
  return constantTimeEqual(bits, p[3]);
}

export async function hmac(secret, data) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return b64url(await crypto.subtle.sign('HMAC', key, enc.encode(data)));
}

// ---------------------------------------------------------------- archivio (Netlify Blobs o equivalente)

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const clone = (v) => JSON.parse(JSON.stringify(v));

// `blobs` è un oggetto con la stessa interfaccia di uno store di @netlify/blobs.
export function makeStore(blobs) {
  return {
    async read(key, fallback) {
      const v = await blobs.get(key, { type: 'json', consistency: 'strong' });
      return v == null ? clone(fallback) : v;
    },
    async write(key, value) { await blobs.setJSON(key, value); },
    async remove(key) { await blobs.delete(key); },
    // Legge, modifica e salva con scrittura condizionale: se qualcun altro ha scritto nel frattempo, si riprova.
    async update(key, fallback, fn) {
      for (let i = 0; i < 8; i++) {
        const r = await blobs.getWithMetadata(key, { type: 'json', consistency: 'strong' });
        const cur = r && r.data != null ? r.data : clone(fallback);
        const next = await fn(cur);
        const res = await blobs.setJSON(key, next, r && r.etag ? { onlyIfMatch: r.etag } : { onlyIfNew: true });
        if (res && res.modified !== false) return next;
        await sleep(20 + Math.random() * 80);
      }
      throw new HttpError(503, 'Archivio occupato, riprova.');
    },
  };
}

// ---------------------------------------------------------------- dati dello studente

export function defaults(d) {
  d = d && typeof d === 'object' ? d : {};
  return Object.assign({ days: {}, errors: [], vocab: [], deck: {}, ex: {}, tests: [], profile: null, recent: null }, d);
}

export async function loadData(store, user) { return defaults(await store.read('data/' + user, {})); }
export async function updateData(store, user, fn) { return store.update('data/' + user, {}, async (d) => fn(defaults(d))); }

export function logActivity(d, n = 1, now = new Date()) {
  const day = today(now);
  d.days[day] = (d.days[day] || 0) + n;
  return d;
}

export function addErrors(d, errors, now = new Date()) {
  const day = today(now);
  for (const e of errors) d.errors.push({ t: day, cat: e.cat, orig: e.orig, corr: e.corr, note: e.note || '' });
  d.errors = d.errors.slice(-300);
  return d;
}

export function deckAdd(d, es, it, ex, theme, now = new Date(), syn = []) {
  const key = es.toLowerCase();
  if (!key || !it || d.deck[key]) return d;
  d.deck[key] = { es, it, ex, theme, box: 0, due: today(now), seen: 0 };
  if (Array.isArray(syn) && syn.length) d.deck[key].syn = syn.slice(0, 4);
  const keys = Object.keys(d.deck);
  if (keys.length > 1500) delete d.deck[keys[0]];
  return d;
}

// ---------------------------------------------------------------- catalogo, livello e piano

export const scenarios = () => DATA.scenarios;
export const grammar = () => DATA.grammar;

export function topicById(id) {
  for (const s of DATA.grammar) for (const t of s.topics) if (t.id === id) return { ...t, section: s.title, sectionId: s.id };
  return null;
}
export const vocabThemeById = (id) => DATA.vocabThemes.find((t) => t.id === id) || null;
export const levelText = (l) => DATA.levelText[l] || DATA.levelText['B1-'];
export const levelLabel = (l) => DATA.levelLabel[l] || DATA.levelLabel['B1-'];

export function profileOf(d) {
  const p = d.profile && typeof d.profile === 'object' ? d.profile : {};
  return {
    level: LEVELS.includes(p.level) ? p.level : 'B1-',
    start: p.start || CFG.START,
    placed: !!p.placed,
    source: p.source || '',
  };
}
export const planOf = (profile) => DATA.tracks[profile.level];
export function weekIndex(profile, now = new Date()) {
  const days = daysBetween(profile.start, today(now));
  return Math.max(0, Math.min(7, Math.floor(Math.max(0, days) / 7)));
}
export const publicProfile = (p) => ({ level: p.level, label: levelLabel(p.level), start: p.start, source: p.source });

export function stats(d, now = new Date()) {
  const t = today(now);
  let streak = 0;
  let cur = t;
  if (!d.days[cur]) cur = addDays(cur, -1);
  while (d.days[cur]) { streak++; cur = addDays(cur, -1); }
  const counts = {};
  for (const e of d.errors.slice(-150)) { const c = e.cat || 'altro'; counts[c] = (counts[c] || 0) + 1; }
  const topErrors = {};
  Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 6).forEach(([k, v]) => { topErrors[k] = v; });
  let deckDue = 0;
  for (const c of Object.values(d.deck)) if ((c.due || t) <= t) deckDue++;
  return {
    streak,
    todayTurns: d.days[t] || 0,
    totalDays: Object.keys(d.days).length,
    topErrors,
    recentErrors: d.errors.slice(-8).reverse(),
    vocabCount: Object.keys(d.deck).length,
    deckDue,
    recentVocab: d.vocab.slice(-12),
    exProgress: d.ex,
    tests: d.tests.slice(-10),
    daysLeft: Math.max(0, daysBetween(t, CFG.DEADLINE)),
  };
}

// ---------------------------------------------------------------- varietà

export function normStem(s) {
  return String(s).toLowerCase().replace(/[^\p{L}\p{N} ]+/gu, ' ').replace(/\s+/g, ' ').trim();
}
const bagKey = (stem) => '~' + stem.split(' ').sort().join(' ');

export function recentOf(d) {
  const r = d.recent && typeof d.recent === 'object' ? d.recent : {};
  return { topics: r.topics || [], items: r.items || [] };
}

export function remember(d, topics = [], stems = []) {
  const r = recentOf(d);
  r.topics = r.topics.concat(topics).slice(-20);
  r.items = r.items.concat(stems.map(normStem)).slice(-150);
  d.recent = r;
  return d;
}

export function dropRepeats(items, recentStems) {
  const seen = new Set();
  for (const s of recentStems) { seen.add(s); seen.add(bagKey(s)); }
  const out = [];
  for (const it of items) {
    const k = normStem(it.q || '');
    if (seen.has(k) || seen.has(bagKey(k))) continue;
    seen.add(k); seen.add(bagKey(k));
    out.push(it);
  }
  return out;
}

export function pickTopic(d, mode, scenario) {
  const tw = DATA.twists;
  const pool = mode === 'conversazione' ? (tw[scenario] || DATA.topics) : DATA.contexts;
  const recent = recentOf(d).topics;
  const fresh = pool.filter((t) => !recent.includes(t));
  return pickOne(fresh.length ? fresh : pool);
}
