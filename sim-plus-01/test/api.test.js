'use strict';

// Drives the real endpoint handlers, not the engine directly. This is the
// layer where persistence, access and leakage can go wrong, so it is worth
// testing through the same door a browser comes in.

const assert = require('assert');
const crypto = require('crypto');

process.env.LAUNCH_SECRET = 'test-secret-for-local-runs';
delete process.env.KV_REST_API_URL;          // force the memory store
delete process.env.UPSTASH_REDIS_REST_URL;
delete process.env.PLATFORM_URL;             // no callbacks during tests

const session = require('../api/session.js');
const ask = require('../api/ask.js');
const report = require('../api/report.js');

let pass = 0, fail = 0;
function t(name, fn) {
  const done = (e) => { if (e) { console.log(`  FAIL ${name}\n         ${e.message}`); fail++; }
                        else { console.log(`  ok   ${name}`); pass++; } };
  try { const r = fn(); if (r && r.then) return r.then(() => done(), done); done(); }
  catch (e) { done(e); }
}

function token(sub, role) {
  const body = Buffer.from(JSON.stringify({
    sub, name: 'Test Person', role: role || 'student',
    sim: 'rapidsimplus-01', course: 'course-1',
    iat: Date.now(), exp: Date.now() + 3600000
  })).toString('base64url');
  const mac = crypto.createHmac('sha256', process.env.LAUNCH_SECRET).update(body).digest('base64url');
  return body + '.' + mac;
}

function call(handler, body, launchToken) {
  const req = { method: 'POST', body, headers: launchToken ? { 'x-launch-token': launchToken } : {} };
  let out = { code: 0, payload: null };
  const res = {
    status(c) { out.code = c; return res; },
    json(p) { out.payload = p; return res; },
    setHeader() {}, end() { return res; }
  };
  return Promise.resolve(handler(req, res)).then(() => out);
}

(async function () {

const alice = token('user-alice');

console.log('\naccess');

await t('a bad launch token is refused', async () => {
  const r = await call(session, { action: 'state' }, 'not.a.token');
  assert.strictEqual(r.code, 401);
});

await t('standalone play needs a run id', async () => {
  const r = await call(session, { action: 'state' });
  assert.strictEqual(r.code, 400);
  assert.strictEqual(r.payload.error, 'no_run_id');
});

console.log('\nchoosing an order');

await t('a fresh run offers exactly the two legal orders', async () => {
  const r = await call(session, { action: 'state' }, alice);
  assert.strictEqual(r.payload.state, 'choosing');
  assert.strictEqual(r.payload.orders.length, 2);
});

await t('an order outside the calendar is refused', async () => {
  const r = await call(session, { action: 'choose', order: ['ray', 'terry', 'ruth'] }, alice);
  assert.strictEqual(r.code, 400);
  assert.strictEqual(r.payload.error, 'order_not_permitted');
});

await t('choosing opens the first appointment', async () => {
  const r = await call(session, { action: 'choose', order: ['terry', 'ray', 'ruth'] }, alice);
  assert.strictEqual(r.payload.state, 'open');
  assert.strictEqual(r.payload.source.name, 'Terry Voss');
  assert.strictEqual(r.payload.remaining, 900);
});

await t('the order cannot be chosen twice', async () => {
  const r = await call(session, { action: 'choose', order: ['ruth', 'terry', 'ray'] }, alice);
  assert.strictEqual(r.code, 409);
  assert.strictEqual(r.payload.error, 'order_already_chosen');
});

console.log('\nasking');

await t('a question returns an answer and spends time', async () => {
  const r = await call(ask, { question: 'Why does the log exist?' }, alice);
  assert.match(r.payload.answer, /ten years/);
  assert.strictEqual(r.payload.spent, 90);
  assert.strictEqual(r.payload.remaining, 810);
});

await t('an open-ended question costs three minutes', async () => {
  const r = await call(ask, { question: 'So what do you do here?' }, alice);
  assert.strictEqual(r.payload.spent, 180);
});

await t('nothing in the response names a bucket or a posture', async () => {
  const r = await call(ask, { question: 'Who reads the log?' }, alice);
  const json = JSON.stringify(r.payload);
  ['PURPOSE_ORIGIN', 'DOWNSTREAM_CONSUMER', 'GUARDED', 'CLOSED', 'bucket', 'posture', 'answerKey']
    .forEach((w) => assert.ok(!json.includes(w), `client response leaked "${w}"`));
});

console.log('\npersistence');

await t('a second request resumes the same run', async () => {
  const r = await call(session, { action: 'state' }, alice);
  assert.strictEqual(r.payload.source.name, 'Terry Voss');
  assert.strictEqual(r.payload.exchanges.length, 3);
});

await t('another participant is unaffected', async () => {
  const bob = token('user-bob');
  const r = await call(session, { action: 'state' }, bob);
  assert.strictEqual(r.payload.state, 'choosing');
});

console.log('\nthe break between class meetings');

await t('a break seals the appointment', async () => {
  const r = await call(session, { action: 'break' }, alice);
  assert.strictEqual(r.payload.state, 'sealed');
});

await t('a sealed appointment refuses further questions — no finishing at home', async () => {
  const r = await call(ask, { question: 'One more thing?' }, alice);
  assert.strictEqual(r.code, 409);
  assert.strictEqual(r.payload.error, 'window_sealed');
});

await t('the next meeting opens the next appointment cleanly', async () => {
  const r = await call(session, { action: 'next' }, alice);
  assert.strictEqual(r.payload.state, 'open');
  assert.strictEqual(r.payload.source.name, 'Ray Duffy');
  assert.strictEqual(r.payload.remaining, 900);
});

console.log('\nthe report');

await t('an incomplete report is refused', async () => {
  const r = await call(report, { submission: { rootCause: '', rows: {} } }, alice);
  assert.strictEqual(r.code, 400);
  assert.ok(r.payload.errors.length >= 4);
});

await t('a complete report returns consequences, not a score', async () => {
  const J = 'Recorded during the appointments.';
  const r = await call(report, {
    observationSeconds: 30,
    submission: {
      rootCause: 'Nothing acknowledges receipt, so providers send again.',
      rows: {
        intake: { disposition: 'automate', justification: J },
        log: { disposition: 'eliminate', justification: J },
        vendor: { disposition: 'cannot_assess', justification: J },
        review: { disposition: 'automate', justification: J }
      }
    }
  }, alice);
  assert.strictEqual(r.code, 200);
  assert.strictEqual(r.payload.harmFired, true);
  assert.ok(r.payload.consequences.some((c) => /Denial letters/.test(c.consequence)));
  const json = JSON.stringify(r.payload);
  ['severity', 'evidence', 'reachability', 'unsupported']
    .forEach((w) => assert.ok(!json.includes(w), `instructor-only field "${w}" reached the participant`));
});

console.log('\nfaculty');

await t('a student cannot reset a run', async () => {
  const r = await call(session, { action: 'reset' }, alice);
  assert.strictEqual(r.code, 403);
});

await t('faculty can', async () => {
  const r = await call(session, { action: 'reset', userId: 'user-alice' }, token('user-chuck', 'faculty'));
  assert.strictEqual(r.code, 200);
  const after = await call(session, { action: 'state' }, alice);
  assert.strictEqual(after.payload.state, 'choosing');
});

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
})();
