// Archivio in memoria con la stessa interfaccia di uno store di @netlify/blobs: serve solo per provare la logica senza Netlify.
export class MemoryBlobs {
  constructor() { this.m = new Map(); this.n = 0; }
  async get(key) { const e = this.m.get(key); return e ? JSON.parse(e.v) : null; }
  async getWithMetadata(key) { const e = this.m.get(key); return e ? { data: JSON.parse(e.v), etag: e.etag, metadata: {} } : null; }
  async setJSON(key, value, opts = {}) {
    const cur = this.m.get(key);
    if (opts.onlyIfNew && cur) return { modified: false };
    if (opts.onlyIfMatch && (!cur || cur.etag !== opts.onlyIfMatch)) return { modified: false };
    const etag = '"' + (++this.n) + '"';
    this.m.set(key, { v: JSON.stringify(value), etag });
    return { modified: true, etag };
  }
  async delete(key) { this.m.delete(key); }
}
