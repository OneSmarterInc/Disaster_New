'use strict';
const assert = require('node:assert/strict');
const room = require('../lib/room');
const store = require('../lib/store');
const config = require('../data/config');
const engine = require('../engine/retention');
const { signBack } = require('../lib/launch');
const gate = require('../build');
const sessions = new Map(), reports = [];
const originals = { ...store }, oldEnv = { ...process.env };
const oldFetch = global.fetch, oldNow = Date.now;
let now = 1_780_000_000_000, failReport = false, failedCas = false;
Date.now = () => now;
Object.assign(process.env, { LAUNCH_SECRET: 'solo-test-secret', PLATFORM_URL: 'https://platform.test',
  SIM_URL: 'https://platform.test/sim04', ACCESS_CODE: 'guest-test-code' });
global.fetch = async (url, options) => {
  if (url.endsWith('/api/complete')) {
    if (failReport) return { ok: false, status: 503 };
    reports.push(JSON.parse(Buffer.from(JSON.parse(options.body).token.split('.')[0], 'base64url').toString()));
  }
  return { ok: true, status: 200 };
};
store.configured = () => true;
store.createSession = async (code, s) => {
  if (sessions.has(code)) return false;
  sessions.set(code, structuredClone(s)); return true;
};
store.getSession = async code => sessions.has(code) ? structuredClone(sessions.get(code)) : null;
store.compareAndSetSession = async (code, previous, next) => {
  if (failedCas) { failedCas = false; return false; }
  if (JSON.stringify(sessions.get(code)) !== JSON.stringify(previous)) return false;
  sessions.set(code, structuredClone(next)); return true;
};
const handler = require('../api/session');
const token = (id, course = 'course-04', role = 'student', mode = 'play') => signBack({
  sub: id, course, role, mode, name: id, sim: config.simId, exp: now + 3600000
});
async function call(body, lt, extra = {}) {
  const result = { status: 200 };
  const res = { setHeader() {}, status(n) { result.status = n; return this; },
    json(data) { result.body = data; return this; } };
  await handler({ method: 'POST', body, headers: { ...(lt ? { 'x-launch-token': lt } : {}), ...extra } }, res);
  return result;
}
let passed = 0;
async function check(name, fn) { await fn(); passed++; console.log('ok ' + name); }
(async () => {
  const ada = token('ada'), ben = token('ben');
  await check('solo start still requires a valid launch or guest access code', async () => {
    assert.equal((await call({ action: 'solo' })).status, 401);
    assert.equal((await call({ action: 'solo' }, 'invalid')).status, 401);
    assert.equal((await call({ action: 'solo' }, token('faculty', 'course-04', 'faculty', 'session'))).status, 409);
  });
  const started = await call({ action: 'solo' }, ada);
  const code = started.body.session.code, pid = started.body.participantId;
  await check('one student immediately gets materials and a running 25-minute clock', () => {
    assert.equal(started.status, 200);
    assert.equal(started.body.session.count, 1);
    assert.equal(started.body.view.state, 'running');
    assert.equal(started.body.view.clock.remaining, 1500);
    assert.equal(started.body.view.canCommit, true);
    assert.equal(started.body.view.lobby, null);
    assert.equal(started.body.view.data.accounts.length, 43);
    assert.equal(started.body.view.data.tickets.length, 53);
    assert.equal(started.body.debrief, null);
    assert.deepEqual(gate.studentLeaks(started.body, sessions.get(code).slots[0].sheetId), []);
  });
  await check('no other student or course can inspect or advance the private run', async () => {
    assert.equal((await call({ action: 'state', code }, ben)).status, 401);
    assert.equal((await call({ action: 'state', code }, token('ada', 'other-course'))).status, 401);
    assert.equal((await call({ action: 'solo_advance', code }, ben)).status, 401);
    assert.equal((await call({ action: 'join', code }, ben)).status, 403);
    let status;
    await require('../api/join')({ method: 'GET', query: { session: code } }, {
      setHeader() {}, status(n) { status = n; return this; }, json() {}
    });
    assert.equal(status, 403);
  });
  await check('each student has an independent timer and stable definition on resume', async () => {
    now += 10000;
    const other = await call({ action: 'solo' }, ben);
    assert.notEqual(other.body.session.code, code);
    assert.equal(other.body.view.clock.remaining, 1500);
    const resumed = await call({ action: 'state', code }, ada);
    assert.equal(resumed.body.view.clock.remaining, 1490);
    assert.deepEqual(resumed.body.view.data.sheet, started.body.view.data.sheet);
    assert.equal(resumed.body.debrief, null);
  });
  await check('answers and explanations remain unavailable until the report is locked', async () => {
    assert.equal((await call({ action: 'solo_advance', code }, ada)).status, 409);
    assert.equal((await call({ action: 'solo_report', code }, ada)).status, 409);
    assert.equal((await call({ action: 'state', code }, ada)).body.debrief, null);
  });
  const committed = await call({ action: 'commit', code, number: 20, confidence: 4 }, ada);
  await check('commit stays final and a CAS retry cannot unlock it', async () => {
    assert.equal(committed.status, 200);
    assert.equal(committed.body.view.canSoloAdvance, true);
    assert.equal(committed.body.debrief, null);
    assert.equal((await call({ action: 'commit', code, number: 30, confidence: 1 }, ada)).status, 409);
    failedCas = true;
    const reveal = await call({ action: 'solo_advance', code }, ada);
    assert.equal(reveal.status, 200);
    assert.equal(reveal.body.view.stage, 1);
    assert.equal(reveal.body.debrief.definitions, undefined);
    assert.deepEqual(reveal.body.debrief.numbers.map(x => x.number),
      config.assignmentOrder.map(id => engine.compute(id).value.toFixed(1)));
  });
  await check('student controls the explanation after viewing the numbers', async () => {
    const result = await call({ action: 'solo_advance', code }, ada);
    assert.equal(result.body.view.stage, 2);
    assert.equal(result.body.debrief.definitions.length, 5);
    assert.equal(result.body.debrief.definitions.filter(x => x.assigned).length, 1);
    assert.ok(result.body.debrief.definitions.every(x => x.derivation.length));
    assert.equal(JSON.stringify(result.body).includes('mismatch'), false);
    assert.equal(JSON.stringify(result.body).includes('correct'), false);
  });
  await check('completion reaches the course automatically without faculty actions', async () => {
    const finished = await call({ action: 'solo_advance', code }, ada);
    assert.equal(finished.body.view.state, 'complete');
    assert.equal(finished.body.view.completionPending, false);
    assert.equal(finished.body.completion.sent, 1);
    assert.equal(reports[0].sub, 'ada');
    assert.equal(reports[0].course, 'course-04');
    assert.equal(reports[0].metrics.reported, true);
    await call({ action: 'solo_report', code }, ada);
    assert.equal(reports.length, 1, 'already-delivered completions are not sent twice');
    assert.equal((await call({ action: 'state', code }, ada)).body.view.state, 'complete');
  });
  await check('timer expiry allows an uncommitted student to finish independently', async () => {
    const expired = await call({ action: 'solo' }, ada);
    const c = expired.body.session.code;
    now += config.clockMinutes * 60000;
    const state = await call({ action: 'state', code: c }, token('ada'));
    assert.equal(state.body.view.canSoloAdvance, true);
    assert.equal(state.body.view.commit, null);
    assert.equal(state.body.debrief, null);
    for (let i = 0; i < 3; i++) assert.equal((await call({ action: 'solo_advance', code: c }, token('ada'))).status, 200);
    assert.equal(reports.at(-1).metrics.reported, false);
  });
  await check('failed completion delivery can be retried by the student', async () => {
    const retryToken = token('ada');
    const retryRun = await call({ action: 'solo' }, retryToken);
    const c = retryRun.body.session.code;
    await call({ action: 'commit', code: c, number: 20, confidence: 2 }, retryToken);
    await call({ action: 'solo_advance', code: c }, retryToken);
    await call({ action: 'solo_advance', code: c }, retryToken);
    failReport = true;
    const failed = await call({ action: 'solo_advance', code: c }, retryToken);
    assert.equal(failed.body.view.state, 'complete');
    assert.equal(failed.body.view.completionPending, true);
    failReport = false;
    const recovered = await call({ action: 'solo_report', code: c }, retryToken);
    assert.equal(recovered.body.completion.sent, 1);
    assert.equal(recovered.body.view.completionPending, false);
  });
  await check('guests can start alone but cannot access another private guest run', async () => {
    const headers = { 'x-access-code': 'guest-test-code' };
    const guest = await call({ action: 'solo', name: 'Guest' }, null, headers);
    const c = guest.body.session.code, id = guest.body.participantId;
    assert.equal(guest.body.view.canCommit, true);
    assert.equal((await call({ action: 'state', code: c, participantId: 'other' }, null, headers)).status, 403);
    assert.equal((await call({ action: 'state', code: c, participantId: id }, null, headers)).status, 200);
  });
  await check('students cannot advance a facilitated class with private controls', async () => {
    let s = room.createSession({ code: 'ABCDE', owner: 'Faculty', mode: 'team', count: 3, now });
    s.platformAuth = true; s.ownerId = 'platform:faculty'; s.courseId = 'course-04';
    s = room.join(s, pid, 'ada', now); sessions.set(s.code, s);
    assert.equal((await call({ action: 'solo_advance', code: s.code }, token('ada'))).status, 403);
  });
  console.log(`${passed} self-paced checks passed, 0 failed`);
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => {
  Date.now = oldNow; global.fetch = oldFetch; Object.assign(store, originals);
  for (const key of Object.keys(process.env)) if (!(key in oldEnv)) delete process.env[key];
  Object.assign(process.env, oldEnv);
});
