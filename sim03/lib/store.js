// Upstash/Vercel KV REST storage for facilitated RapidSim 03 sessions.
// Sessions expire automatically after 48 hours.
const URL_ = () => process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOK_ = () => process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

function configured() { return !!(URL_() && TOK_()); }

async function cmd(args) {
  if (!configured()) {
    const e = new Error('Session storage is not configured.');
    e.code = 'NO_STORE';
    throw e;
  }
  const r = await fetch(URL_(), {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${TOK_()}` },
    body: JSON.stringify(args)
  });
  const d = await r.json();
  if (!r.ok || d.error) throw new Error(d.error || `KV error ${r.status}`);
  return d.result;
}

const TTL = 60 * 60 * 48;
const J = (v) => { try { return JSON.parse(v); } catch { return null; } };

async function hgetall(key) {
  const flat = await cmd(['HGETALL', key]) || [];
  const out = {};
  if (Array.isArray(flat)) {
    for (let i = 0; i < flat.length; i += 2) out[flat[i]] = J(flat[i + 1]);
  } else {
    Object.entries(flat).forEach(([k, v]) => { out[k] = J(v); });
  }
  return out;
}

module.exports = {
  configured,
  async getSession(code) { return J(await cmd(['GET', `m03:sess:${code}`])); },
  async putSession(code, obj) {
    await cmd(['SET', `m03:sess:${code}`, JSON.stringify(obj), 'EX', String(TTL)]);
    return obj;
  },
  async addParticipant(code, id, obj) {
    await cmd(['HSET', `m03:sess:${code}:p`, id, JSON.stringify(obj)]);
    await cmd(['EXPIRE', `m03:sess:${code}:p`, String(TTL)]);
  },
  async setParticipant(code, id, obj) {
    await cmd(['HSET', `m03:sess:${code}:p`, id, JSON.stringify(obj)]);
  },
  async getParticipants(code) { return hgetall(`m03:sess:${code}:p`); },

  async setRun(code, runId, obj) {
    await cmd(['HSET', `m03:sess:${code}:run`, runId, JSON.stringify(obj)]);
    await cmd(['EXPIRE', `m03:sess:${code}:run`, String(TTL)]);
  },
  async getRuns(code) { return hgetall(`m03:sess:${code}:run`); },

  async wipe(code) {
    await cmd(['DEL', `m03:sess:${code}`, `m03:sess:${code}:p`, `m03:sess:${code}:run`]);
  }
};
