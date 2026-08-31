'use strict';

// Where a session lives between requests.
//
// The key is derived from the identity the platform already signs into the
// launch token, so a participant returning on a different machine — a
// different room, a week later — resumes by signing in, with no resume code to
// lose. Nothing here invents an identity of its own.
//
// Two implementations. MemoryStore for tests and local runs; RedisStore for
// Upstash. The engine knows neither: it is handed something with get, set and
// del, which is the whole interface.

const { Session } = require('./engine');

/** Sessions belong to a person and a sim, and to nothing else. */
function sessionKey(simId, userId) {
  if (!simId || !userId) throw new Error('sessionKey needs simId and userId');
  return 'rapidsim:' + simId + ':' + userId;
}

class MemoryStore {
  constructor() { this.map = new Map(); }
  async get(key) { const v = this.map.get(key); return v === undefined ? null : JSON.parse(v); }
  async set(key, value) { this.map.set(key, JSON.stringify(value)); }
  async del(key) { this.map.delete(key); }
}

/**
 * Upstash over its REST API, so this works from a serverless function with no
 * connection pooling and no client library.
 *
 * TTL is long and deliberate. A split-session run may sit untouched from a
 * Tuesday class to a Thursday one, and a participant who comes back to an
 * expired session has lost half the exercise with no recovery path. Thirty
 * days costs nothing and removes the failure entirely.
 */
/**
 * Upstash over its REST API, using the command form the other sims use —
 * a POST of ["GET", key] to the root URL rather than a path per verb. Same
 * service, and worth matching so anyone moving between sims reads one shape.
 *
 * TTL is thirty days, not the forty-eight hours Sim 02 uses. Sim 02 has no
 * resume at all and its sessions are meant to evaporate. This one may sit
 * untouched from a Tuesday class to a Thursday one, and forty-eight hours
 * would expire exactly at the moment a participant came back.
 */
class RedisStore {
  constructor(opts) {
    const o = opts || {};
    this.url = o.url || process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
    this.token = o.token || process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
    this.ttlSeconds = o.ttlSeconds || 60 * 60 * 24 * 30;
    if (!this.url || !this.token) {
      const e = new Error('Session storage is not configured. Add a KV store to the Vercel project.');
      e.code = 'NO_STORE';
      throw e;
    }
  }

  async _cmd(args) {
    const r = await fetch(this.url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer ' + this.token },
      body: JSON.stringify(args)
    });
    const d = await r.json();
    if (!r.ok || d.error) {
      const e = new Error(d.error || 'KV error ' + r.status);
      e.code = 'KV_FAILED';
      throw e;
    }
    return d.result;
  }

  async get(key) {
    const v = await this._cmd(['GET', key]);
    if (v == null) return null;
    try { return JSON.parse(v); } catch { return null; }
  }

  async set(key, value) {
    await this._cmd(['SET', key, JSON.stringify(value), 'EX', String(this.ttlSeconds)]);
  }

  async del(key) { await this._cmd(['DEL', key]); }
}

/**
 * Load a session, or null if there is nothing stored.
 *
 * A version mismatch is reported rather than swallowed. If a sim is revised
 * mid-term, a participant carrying older state should be told plainly instead
 * of silently resuming into a session the engine no longer understands.
 */
async function load(store, simId, userId) {
  const state = await store.get(sessionKey(simId, userId));
  if (!state) return { session: null, stale: false };
  try {
    return { session: Session.fromJSON(state), stale: false };
  } catch (e) {
    if (e.code === 'STATE_VERSION_MISMATCH') return { session: null, stale: true, reason: e.message };
    throw e;
  }
}

async function save(store, simId, userId, session) {
  await store.set(sessionKey(simId, userId), session.toJSON());
  return session;
}

async function clear(store, simId, userId) {
  await store.del(sessionKey(simId, userId));
}

/**
 * End a class meeting. Seals the current window and writes.
 *
 * Sealing is what makes the split format honest: without it a participant
 * simply carries on at home and the availability calendar — the thing that
 * makes ordering a real decision — stops constraining anything at all.
 */
async function breakSession(store, simId, userId, session) {
  session.seal();
  return save(store, simId, userId, session);
}

module.exports = { MemoryStore, RedisStore, sessionKey, load, save, clear, breakSession };
