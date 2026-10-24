// Prova nel browser dell'interfaccia contro la VERA logica del backend, senza Netlify: archivio in memoria (salvato nella sessione
// del browser) e Claude simulato. Lo usa solo il server di prova locale, non il sito pubblicato.
import { handle } from '../lib/router.mjs';
import { MemoryBlobs } from '../lib/memory-blobs.mjs';
import { setIterations } from '../lib/core.mjs';
import { fakeClaude } from './backend.test.mjs';

setIterations(1000);

class Persistent extends MemoryBlobs {
  constructor() {
    super();
    try { const s = JSON.parse(sessionStorage.getItem('blobs') || 'null'); if (s) { this.m = new Map(s.m); this.n = s.n; } } catch {}
  }
  save() { sessionStorage.setItem('blobs', JSON.stringify({ m: [...this.m], n: this.n })); }
  async setJSON(...a) { const r = await super.setJSON(...a); this.save(); return r; }
  async delete(k) { await super.delete(k); this.save(); }
}

const blobs = new Persistent();
const env = { SESSION_SECRET: 'x'.repeat(40), SETUP_TOKEN: 'token-di-setup', ANTHROPIC_API_KEY: 'finta', PUBLIC_URL: location.origin };
const fake = fakeClaude({ n: 0 }, { realVocab: true });

// Utente "demo" già creato e collegato, così la demo si apre direttamente nell'app.
const DEMO_PASSWORD = 'Rosso-Giallo-2468x';
let seeded = null;
async function seed() {
  if (sessionStorage.getItem('seeded')) return;
  const h = { 'content-type': 'application/json', 'x-requested-with': 'spagnolo' };
  const post = (path, body) => run(new URL(location.origin + path), { method: 'POST', headers: h, body: JSON.stringify(body) });
  const link = (await (await post('/api/setup', { token: env.SETUP_TOKEN, username: 'demo' })).json()).link;
  const r = await post('/api/auth/accept', { t: link.split('=')[1], password: DEMO_PASSWORD, password2: DEMO_PASSWORD });
  if (r.ok) sessionStorage.setItem('seeded', '1');
}

export async function handleFetch(url, init = {}) {
  seeded = seeded || seed();
  await seeded;
  return run(url, init);
}

function run(url, init = {}) {
  const req = new Request(url.href, { method: init.method || 'GET', headers: new Headers(init.headers || {}), body: init.body });
  return handle(req, {
    blobs, env, ip: '1.1.1.1', fetch: fake, cookie: sessionStorage.getItem('cookie') || '',
    onSetCookie: (c) => sessionStorage.setItem('cookie', /Max-Age=0/.test(c) ? '' : c.split(';')[0]),
  });
}
