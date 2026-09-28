'use strict';
const assert = require('node:assert/strict');
const sheets = require('../data/sheets');
const config = require('../data/config');
const room = require('../lib/room');
const gate = require('../build');
const store = require('../lib/store');
const { signBack } = require('../lib/launch');

let passed = 0;
function check(name, fn) { return Promise.resolve().then(fn).then(() => { passed++; console.log('ok', name); }); }
const NOW = 1_780_000_000_000;
let now = NOW;
const realDateNow = Date.now, realFetch = global.fetch, oldEnv = { ...process.env };
Date.now = () => now;
Object.assign(process.env, {
  LAUNCH_SECRET: 'test-secret-not-for-production', PLATFORM_URL: 'https://platform.test',
  SIM_URL: 'https://rapidsims.flexee.org/sim04', FACULTY_CODE: 'private-instructor', ACCESS_CODE: 'private-student'
});
const sessions = new Map(), requests = [];
global.fetch = async (url, options) => {
  requests.push({ url, payload: JSON.parse(Buffer.from(JSON.parse(options.body).token.split('.')[0], 'base64url').toString('utf8')) });
  return { ok: true, status: 200, text: async () => '' };
};
store.configured = () => true;
store.createSession = async (code, session) => {
  if (sessions.has(code)) return false;
  sessions.set(code, structuredClone(session)); return true;
};
store.getSession = async code => sessions.has(code) ? structuredClone(sessions.get(code)) : null;
store.compareAndSetSession = async (code, previous, next) => {
  if (JSON.stringify(sessions.get(code)) !== JSON.stringify(previous)) return false;
  sessions.set(code, structuredClone(next)); return true;
};

const handler = require('../api/session');
const token = (sub, role) => signBack({ sub, name: sub, role, sim: config.simId,
  course: 'course-4', mode: role === 'student' ? 'play' : 'session', iat: now, exp: now + 600000 });
const teacher = token('instructor', 'faculty');
const students = ['ada', 'ben', 'cy'].map(id => token(id, 'student'));
async function call(payload, launch = teacher) {
  const result = { status: 200, body: null };
  const res = { setHeader() {}, status(n) { result.status = n; return this; }, json(b) { result.body = b; return this; } };
  await handler({ method: 'POST', body: payload, headers: launch ? { 'x-launch-token': launch } : {} }, res);
  return result;
}

(async () => {
  await check('mode and at least three groups required', () => {
    assert.throws(() => room.createSession({ code: 'ABCDE', count: 3, now }), /Choose team or individual/);
    assert.throws(() => room.createSession({ code: 'ABCDE', count: 2, mode: 'team', now }), /between 3 and 100/);
  });
  await check('seven groups cycle A, E, D, C, B, A, E', () => {
    const seven = room.createSession({ code: 'ABCDEFG', count: 7, mode: 'team', now });
    assert.deepEqual(seven.slots.map(x => x.sheetId), ['A', 'E', 'D', 'C', 'B', 'A', 'E']);
  });
  const rejected = await call({ action: 'create', mode: 'individual', count: 2 });
  await check('API refuses a two-participant session', () => assert.equal(rejected.status, 400));
  const created = await call({ action: 'create', mode: 'team', count: 3, clockMinutes: 1 });
  assert.equal(created.status, 200);
  const code = created.body.session.code;
  await check('registration states explicit identity, number and canonical route', () => {
    const r = requests.find(x => x.url === 'https://platform.test/api/register');
    assert.equal(r.payload.sim, config.simId); assert.equal(r.payload.number, 4);
    assert.equal(r.payload.launchUrl, process.env.SIM_URL);
  });
  for (let i = 0; i < 3; i++) {
    const joined = await call({ action: 'join', code }, students[i]);
    assert.equal(joined.status, 200);
    assert.equal(joined.body.view.data, null);
    const assigned = await call({ action: 'assign', code, participantId: `platform:${['ada','ben','cy'][i]}`, slotId: `slot-${i + 1}` });
    assert.equal(assigned.status, 200);
  }
  const started = await call({ action: 'start', code });
  assert.equal(started.status, 200);
  for (let i = 0; i < 3; i++) {
    const response = await call({ action: 'state', code }, students[i]);
    await check(`real student API response ${i + 1} has only its own sheet`, () => {
      assert.equal(response.status, 200);
      assert.deepEqual(gate.studentLeaks(response.body, ['A', 'E', 'D'][i]), []);
      assert.ok(response.body.view.data.sheet.lines.includes(sheets.contested[['A', 'E', 'D'][i]]));
      assert.equal(response.body.view.data.accounts.length, 43);
      assert.equal(response.body.view.data.tickets.length, 53);
    });
  }
  const forbidden = await call({ action: 'private_check', code }, students[0]);
  await check('private error check requires faculty authorization', () => assert.equal(forbidden.status, 401));
  const first = await call({ action: 'commit', code, number: 90.0, confidence: 4 }, students[0]);
  const repeated = await call({ action: 'commit', code, number: 85.0, confidence: 2 }, students[0]);
  await check('commit is final', () => { assert.equal(first.status, 200); assert.equal(repeated.status, 409); });
  const wrong = await call({ action: 'commit', code, number: 20.0, confidence: 1 }, students[1]);
  assert.equal(wrong.status, 200);
  const prereveal = await call({ action: 'faculty_state', code });
  await check('projector before reveal has only names and commitment status', () => {
    assert.equal(prereveal.body.projector.numbers, undefined);
    assert.equal(prereveal.body.projector.reveal, undefined);
    assert.deepEqual(prereveal.body.projector.groups.map(g => g.committed), [true, true, false]);
  });
  await check('cannot reveal while the third group is still working', async () => {
    const early = await call({ action: 'advance', code }); assert.equal(early.status, 409);
  });
  now += 61000;
  const stage1 = await call({ action: 'advance', code });
  await check('stage 1 reveals all figures, including no number, without sheets', () => {
    assert.equal(stage1.status, 200);
    const p = room.projector(sessions.get(code), now);
    assert.deepEqual(p.numbers.map(n => n.number), ['90.0', '20.0', null]);
    assert.equal(p.reveal, undefined);
    assert.ok(!JSON.stringify(p).includes(sheets.contested.E));
  });
  const checkResult = await call({ action: 'private_check', code });
  await check('private check flags a wrong report and leaves no report unscored', () => {
    assert.deepEqual(checkResult.body.checks.map(c => c.status), ['ok', 'mismatch', 'none']);
    assert.equal(checkResult.body.checks[1].correct, 69.6);
  });
  await call({ action: 'advance', code });
  await check('stage 2 groups same sheets and derives numbers from the engine', () => {
    const p = room.projector(sessions.get(code), now);
    assert.equal(p.reveal.length, 3);
    assert.ok(p.reveal[0].derivation.at(-1).includes('90.0%'));
    assert.ok(p.reveal[1].derivation.at(-1).includes('69.6%'));
    assert.equal(p.reveal[0].contestedIndex, 3);
    assert.equal(p.reveal[0].department, 'Sales');
  });
  const stillPrivate = await call({ action: 'state', code }, students[0]);
  await check('student remains on its own locked report through stage 2', () => {
    assert.equal(stillPrivate.body.view.commit.number, '90.0');
    assert.deepEqual(gate.studentLeaks(stillPrivate.body, 'A'), []);
    assert.equal(stillPrivate.body.view.canCommit, false);
  });
  const original = room.studentView;
  room.studentView = (...args) => ({ ...original(...args), injected: sheets.contested.E });
  const planted = await call({ action: 'state', code }, students[0]);
  room.studentView = original;
  await check('leak guard catches a planted fault in the real API path', () => {
    assert.ok(gate.studentLeaks(planted.body, 'A').some(s => s.includes('another sheet')));
  });
  const complete = await call({ action: 'advance', code });
  await check('completion reports all three launched participants to the platform', () => {
    assert.equal(complete.body.session.stage, 3);
    const completions = requests.filter(x => x.url === 'https://platform.test/api/complete');
    assert.deepEqual(completions.map(x => x.payload.sub).sort(), ['ada', 'ben', 'cy']);
    assert.equal(complete.body.completion.sent, 3);
    assert.equal(completions[2].payload.sim, config.simId);
  });
  await check('build guards catch planted student content', () => {
    const fs = require('node:fs'), path = require('node:path');
    const pages = ['launch.html','index.html','student.js','instructor.html','instructor.js','private-check.html','private-check.js'];
    const source = Object.fromEntries(pages.map(p => ['public/' + p, fs.readFileSync(path.join(__dirname, '../public', p), 'utf8')]));
    source['public/student.js'] += '\n// TODO missing text';
    assert.ok(gate.checkSource(source).some(s => s.includes('placeholder')));
    source['public/student.js'] += '\n// ' + sheets.reveal.E.purpose;
    assert.ok(gate.checkSource(source).some(s => s.includes('reveal')));
  });
  await check('deployment guards catch disabled builds, missing URL and host-derived registration', () => {
    assert.ok(gate.checkWiring({ vercel: { git: { deploymentEnabled: false } } }).some(s => s.includes('deployment disabled')));
    assert.ok(gate.checkWiring({ env: 'SIM_URL=' }).some(s => s.includes('SIM_URL missing')));
    assert.ok(gate.checkWiring({ launch: "req.headers['x-forwarded-host']" }).some(s => s.includes('request host')));
    assert.ok(gate.checkWiring({ platform: { rewrites: [] } }).some(s => s.includes('platform route missing')));
  });
  console.log(`${passed} runtime checks passed, 0 failed`);
})().catch(e => { console.error('FAIL', e.stack); process.exitCode = 1; }).finally(() => {
  Date.now = realDateNow; global.fetch = realFetch;
  for (const k of Object.keys(process.env)) if (!(k in oldEnv)) delete process.env[k];
  Object.assign(process.env, oldEnv);
});
