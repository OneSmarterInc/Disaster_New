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

// Compare the run, session state and roster in one Redis operation. A handoff,
// pause or reassignment invalidates an in-flight write; callers reread/revalidate.
// Reflections share this path so concurrent member saves cannot erase each other.
const CAS_RUN = `
if (redis.call('GET', KEYS[1]) or '') ~= ARGV[1] then return 0 end
if (redis.call('HGET', KEYS[3], ARGV[2]) or '') ~= ARGV[3] then return 0 end
local count = tonumber(ARGV[6])
if redis.call('HLEN', KEYS[2]) ~= count then return 0 end
for i = 1, count do
  local offset = 7 + (i - 1) * 2
  if (redis.call('HGET', KEYS[2], ARGV[offset]) or '') ~= ARGV[offset + 1] then return 0 end
end
redis.call('HSET', KEYS[3], ARGV[2], ARGV[4])
redis.call('EXPIRE', KEYS[3], ARGV[5])
return 1
`;

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
  async compareAndSetRun(code, runId, previous, next, session, participants) {
    const roster = Object.entries(participants).flatMap(([id, p]) => [id, JSON.stringify(p)]);
    const result = await cmd(['EVAL', CAS_RUN, '3',
      `m03:sess:${code}`, `m03:sess:${code}:p`, `m03:sess:${code}:run`,
      JSON.stringify(session), runId, previous ? JSON.stringify(previous) : '',
      JSON.stringify(next), String(TTL), String(roster.length / 2), ...roster]);
    return Number(result) === 1;
  },

  async wipe(code) {
    await cmd(['DEL', `m03:sess:${code}`, `m03:sess:${code}:p`, `m03:sess:${code}:run`]);
  }
};
