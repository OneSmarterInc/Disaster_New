'use strict';
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { store, keys } = require('../lib/store');
const L = require('../lib/launch');
const C = require('../data/config');
const meta = require('../lib/meta');
process.env.LAUNCH_SECRET = 'integration-secret';
process.env.HEALTH_SECRET = 'diagnostics-secret';
process.env.FACULTY_CODES = 'Host:faculty-code';
process.env.ACCESS_CODE = 'guest-code';
process.env.PLATFORM_URL = 'https://platform.test';
process.env.SIM_URL = 'https://platform.test/simplus02';
let now = 1800000000000;
Date.now = () => now;
const db = new Map();
Object.assign(store, {
  configured: () => true,
  get: async k => db.has(k) ? JSON.parse(db.get(k)) : null,
  getMany: async ks => ks.map(k => db.has(k) ? JSON.parse(db.get(k)) : null),
  cas: async (k, prev, next) => {
    if ((db.get(k) || '') !== (prev == null ? '' : JSON.stringify(prev))) return false;
    db.set(k, JSON.stringify(next)); return true;
  },
});
const session = require('../api/session'), finish = require('../api/finish'), health = require('../api/health');
function token(p) {
  const raw = Buffer.from(JSON.stringify({ sim: C.id, role: 'student', sub: 'student', course: 'c1', iat: now, exp: now + 3600000, ...p })).toString('base64url');
  return raw + '.' + crypto.createHmac('sha256', process.env.LAUNCH_SECRET).update(raw).digest('base64url');
}
const auth = p => ({ 'x-launch-token': token(p) });
async function call(handler, body = {}, headers = {}, method = 'POST') {
  const res = { code: 200, payload: null, headers: {}, setHeader(k,v) { this.headers[k] = v; }, status(n) { this.code = n; return this; }, json(v) { this.payload = v; return this; } };
  await handler({ method, headers, body }, res);
  return { status: res.code, body: res.payload, headers: res.headers };
}
let assertions = 0;
function eq(a,b,message) { assert.deepEqual(a,b,message); assertions++; }
const callbacks = [];
let registrationOk = false, completionOk = false, releaseCallback, callbackStarted;
global.fetch = async (url, options) => {
  assert.ok(url.startsWith(process.env.PLATFORM_URL + '/api/'));
  const payload = L.verifyLaunch(JSON.parse(options.body).token);
  assert.ok(payload, 'all callbacks are signed');
  callbacks.push({ url, payload });
  if (url.endsWith('/register')) return { ok: registrationOk, status: registrationOk ? 200 : 503, text: async () => 'fixture unavailable' };
  if (callbackStarted) { const started = callbackStarted; callbackStarted = null; started(); await new Promise(resolve => { releaseCallback = resolve; }); }
  return { ok: completionOk, status: completionOk ? 200 : 503, text: async () => 'fixture unavailable' };
};

(async () => {
  eq((await call(health, {}, {}, 'GET')).body, { ok: true, sim: C.id }, 'public liveness exposes no diagnostics');
  eq(callbacks.length, 0, 'health never registers or calls the platform');
  const diagnostic = await call(health, {}, { 'x-health-key': process.env.HEALTH_SECRET }, 'GET');
  eq(diagnostic.body.diagnostic, true);
  eq(diagnostic.body.registersAs, process.env.SIM_URL);
  eq(diagnostic.body.features.includes('self-register'), true);
  assert.ok(!JSON.stringify(diagnostic.body).includes(process.env.LAUNCH_SECRET));

  await Promise.all([L.announce(), L.announce()]);
  eq(callbacks.length, 1, 'concurrent announcements share one request');
  registrationOk = true;
  await L.announce(); await L.announce();
  eq(callbacks.length, 2, 'a failed registration retries, success is cached');
  eq([callbacks[1].payload.sim, callbacks[1].payload.number, callbacks[1].payload.title, callbacks[1].payload.minutes], [C.id, 102, meta.title, 65]);
  eq(callbacks[1].payload.detail, meta.detail);

  const owner = auth({ sub: 'teacher', role: 'faculty' });
  for (const invalid of [{ sim: 'rapid-05-approve', role: 'faculty' }, { role: 'admin' }, { sub: null, role: 'faculty' }, { role: 'faculty', exp: now - 1 }]) {
    eq((await call(session, { action: 'create' }, auth(invalid))).status, 401, 'wrong sim, role, account or expiry cannot create a room');
  }
  const made = await call(session, { action: 'create' }, owner);
  eq(made.status, 200);
  const code = made.body.code;
  eq((await store.get(keys.session(code))).courseId, 'c1');
  eq((await call(session, { action: 'entry' }, auth({ sub: 'student0' }))).body, { code }, 'course account finds its open room');
  eq((await call(session, { action: 'entry' }, auth({ course: 'c2' }))).body, { code: null });
  const before = await store.get(keys.session(code));
  for (const action of ['console', 'seat', 'phase', 'extend', 'notice', 'close', 'reveal']) {
    eq((await call(session, { action, code, to: 'briefing', on: true }, auth({ sub: 'other-teacher', role: 'faculty' }))).status, 403, action + ' belongs to the creating instructor');
  }
  eq((await call(session, { action: 'console', code }, auth({ sub: 'teacher', role: 'faculty', course: 'c2' }))).status, 403);
  eq(await store.get(keys.session(code)), before, 'unauthorised faculty requests do not mutate the room');
  eq((await call(session, { action: 'join', code }, { 'x-access-code': 'guest-code' })).status, 403, 'guest code cannot enter a course room');
  eq((await call(session, { action: 'join', code }, auth({ course: 'c2' }))).status, 403, 'other course cannot join');
  const people = [];
  for (let i = 0; i < 4; i++) {
    const headers = auth({ sub: 'student' + i });
    const joined = await call(session, { action: 'join', code }, headers);
    eq(joined.status, 200);
    people.push({ ...joined.body, headers: { ...headers, 'x-participant-key': joined.body.participantKey } });
  }
  const me = people[0], input = { code, participantId: me.participantId };
  const rejoined = await call(session, { action: 'join', code }, auth({ sub: 'student0' }));
  eq(rejoined.body.participantId, me.participantId);
  eq(rejoined.body.participantKey, me.participantKey);
  eq(Object.keys(await store.get(keys.roster(code))).length, 4, 'account rejoin does not duplicate students');
  eq((await call(session, { action: 'seat', code }, owner)).body.tables, 1);
  eq((await call(session, { action: 'join', code }, auth({ sub: 'student0' }))).status, 200, 'existing owner can rejoin after seating');
  eq((await call(session, { action: 'join', code }, auth({ sub: 'late' }))).status, 409);
  for (const headers of [{ 'x-participant-key': me.participantKey }, { ...auth({ sub: 'intruder' }), 'x-participant-key': me.participantKey },
    { ...auth({ sub: 'student0', course: 'c2' }), 'x-participant-key': me.participantKey }]) {
    eq((await call(session, { action: 'view', ...input }, headers)).status, 403, 'a leaked key cannot replace account and course identity');
    eq((await call(finish, input, headers)).body.reported || false, false);
  }
  for (const to of ['briefing', 'openings', 'negotiation']) eq((await call(session, { action: 'phase', code, to }, owner)).status, 200);
  eq((await call(finish, input, me.headers)).status, 409, 'cannot report before the outcome');
  now += 45 * 60000;
  const started = new Promise(resolve => { callbackStarted = resolve; });
  const first = call(finish, input, me.headers);
  await started;
  const concurrent = await call(finish, input, me.headers);
  eq(concurrent.body.pending, true, 'concurrent completion shares the outstanding report');
  releaseCallback();
  eq((await first).body.reported, false, 'failed callback is not marked complete');
  eq((await store.get(keys.session(code))).phase, 'closed', 'finish can settle an expired negotiation before any poll');
  completionOk = true;
  eq((await call(finish, input, me.headers)).body.reported, true, 'failed callback retries');
  eq((await call(finish, input, me.headers)).body.already, true, 'successful callback is reported once');
  const reports = callbacks.filter(c => c.url.endsWith('/complete'));
  eq(reports.length, 2, 'one failed and one successful completion callback');
  eq([reports[1].payload.sub, reports[1].payload.course, reports[1].payload.sim], ['student0', 'c1', C.id]);
  eq(reports[1].payload.summary.seat, (await store.get(keys.roster(code)))[me.participantId].seat);

  const guestRoom = await call(session, { action: 'create' }, { 'x-faculty-code': 'faculty-code' });
  delete process.env.ACCESS_CODE;
  eq((await call(session, { action: 'join', code: guestRoom.body.code })).status, 401, 'missing access configuration fails closed');
  eq((await call(session, { action: 'console', code: guestRoom.body.code }, owner)).status, 403, 'platform faculty cannot take over a standalone instructor room');
  console.log(`All integration tests pass (${assertions} assertions).`);
})().catch(e => { console.error('FAIL', e.stack); process.exit(1); });
