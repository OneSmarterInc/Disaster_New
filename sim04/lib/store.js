'use strict';
// One compare-and-set JSON document per room. Slots, assignments and final
// commitments change atomically, including two teammates pressing Commit at once.
const url = () => process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const token = () => process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const TTL = 48 * 3600;
const key = code => `m04:sess:${code}`;
function configured() { return !!(url() && token()); }
async function cmd(args) {
  if (!configured()) throw new Error('Session storage is not configured.');
  const response = await fetch(url(), {
    method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token()}` },
    body: JSON.stringify(args), signal: AbortSignal.timeout(5000)
  });
  const body = await response.json();
  if (!response.ok || body.error) throw new Error(body.error || `Storage returned ${response.status}`);
  return body.result;
}
const CAS = `
if (redis.call('GET', KEYS[1]) or '') ~= ARGV[1] then return 0 end
redis.call('SET', KEYS[1], ARGV[2], 'EX', ARGV[3])
return 1
`;
module.exports = {
  configured,
  async getSession(code) {
    const raw = await cmd(['GET', key(code)]);
    return raw ? JSON.parse(raw) : null;
  },
  async createSession(code, session) {
    return (await cmd(['SET', key(code), JSON.stringify(session), 'EX', String(TTL), 'NX'])) === 'OK';
  },
  async compareAndSetSession(code, previous, next) {
    return Number(await cmd(['EVAL', CAS, '1', key(code), JSON.stringify(previous), JSON.stringify(next), String(TTL)])) === 1;
  }
};
