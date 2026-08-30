'use strict';

const assert = require('assert');
const { Session, STATE_VERSION } = require('../src/engine');
const { MemoryStore, sessionKey, load, save, clear, breakSession } = require('../src/store');

let pass = 0, fail = 0;
function t(name, fn) {
  const done = (e) => { if (e) { console.log(`  FAIL ${name}\n         ${e.message}`); fail++; }
                        else { console.log(`  ok   ${name}`); pass++; } };
  try { const r = fn(); if (r && r.then) return r.then(() => done(), done); done(); }
  catch (e) { done(e); }
}

function run(order, questions) {
  const s = new Session().chooseOrder(order);
  questions.forEach((q) => s.ask(q));
  return s;
}

(async function () {

console.log('\nserialisation');

await t('a session survives a JSON round trip', () => {
  const a = run(['terry', 'ray', 'ruth'],
    ['Why does the log exist?', 'Who reads the log?', 'Have you ever seen anyone pull it up?']);
  const b = Session.fromJSON(JSON.parse(JSON.stringify(a.toJSON())));
  assert.strictEqual(b.transcript.length, a.transcript.length);
  assert.strictEqual(b.remaining, a.remaining);
  assert.deepStrictEqual(b.order, a.order);
  b.transcript.forEach((row, i) => assert.strictEqual(row.answer, a.transcript[i].answer));
});

await t('repeat escalation survives, so a resumed source does not repeat itself', () => {
  const a = run(['terry', 'ray', 'ruth'], ['Who reads the log?']);
  const b = Session.fromJSON(JSON.parse(JSON.stringify(a.toJSON())));
  // Terry's audit guess cracks only on the second ask. If askCounts were lost,
  // resuming would hand the participant the first answer again.
  assert.match(b.ask('Have you ever seen anyone pull it up?').answer, /not personally/);
});

await t('posture survives — a closed source stays closed after a resume', () => {
  const a = run(['ruth', 'terry', 'ray'], ['How much of this could the new system handle?']);
  const b = Session.fromJSON(JSON.parse(JSON.stringify(a.toJSON())));
  assert.strictEqual(b.posture.ruth, 'CLOSED');
  assert.strictEqual(b.ask("What happens when a claim doesn't match?").postureAfter, 'CLOSED');
});

await t('stored state carries no answer text', () => {
  const a = run(['terry', 'ray', 'ruth'], ['Why does the log exist?', 'What do you tell them when they call?']);
  const json = JSON.stringify(a.toJSON());
  ['PO box', 'been processed', 'Audit pull it'].forEach((p) =>
    assert.ok(!json.includes(p), `answer text leaked into stored state: ${p}`));
});

await t('state written by another version is refused, not guessed at', () => {
  const a = run(['terry', 'ray', 'ruth'], ['Why does the log exist?']);
  const state = a.toJSON();
  state.v = STATE_VERSION + 1;
  assert.throws(() => Session.fromJSON(state), (e) => e.code === 'STATE_VERSION_MISMATCH');
});

console.log('\nsealing — the break between class meetings');

await t('a sealed window refuses further questions', () => {
  const s = run(['terry', 'ray', 'ruth'], ['Why does the log exist?']);
  s.seal();
  assert.strictEqual(s.ask('Who reads the log?').error, 'WINDOW_SEALED');
});

await t('sealing survives the round trip — you cannot finish at home', () => {
  const a = run(['terry', 'ray', 'ruth'], ['Why does the log exist?']);
  a.seal();
  const b = Session.fromJSON(JSON.parse(JSON.stringify(a.toJSON())));
  assert.ok(b.isSealed(0));
  assert.strictEqual(b.ask('Who reads the log?').error, 'WINDOW_SEALED');
});

await t('the next window opens clean after a break', () => {
  const a = run(['terry', 'ray', 'ruth'], ['Why does the log exist?']);
  a.seal();
  const b = Session.fromJSON(JSON.parse(JSON.stringify(a.toJSON())));
  b.advanceWindow();
  assert.strictEqual(b.isSealed(), false);
  assert.strictEqual(b.remaining, 900);
  assert.strictEqual(b.currentSourceId, 'ray');
  assert.ok(b.ask('How many claims a day?').answer);
});

await t('an earlier window stays sealed once later ones are open', () => {
  const s = run(['terry', 'ray', 'ruth'], ['Why does the log exist?']);
  s.seal(); s.advanceWindow();
  assert.ok(s.isSealed(0));
  assert.strictEqual(s.isSealed(1), false);
});

console.log('\nstore');

await t('a session round-trips through the store', async () => {
  const store = new MemoryStore();
  const a = run(['terry', 'ray', 'ruth'], ['Why does the log exist?']);
  await save(store, 'simplus-01', 'user-1', a);
  const { session } = await load(store, 'simplus-01', 'user-1');
  assert.strictEqual(session.transcript.length, 1);
});

await t('resuming on another machine is just loading the same key', async () => {
  const store = new MemoryStore();
  const laptop = run(['terry', 'ray', 'ruth'], ['Why does the log exist?', 'Who reads the log?']);
  await breakSession(store, 'simplus-01', 'user-1', laptop);
  // Thursday, a different room, a different machine. Same signed identity.
  const { session: lab } = await load(store, 'simplus-01', 'user-1');
  assert.strictEqual(lab.transcript.length, 2);
  assert.strictEqual(lab.ask('Anything else?').error, 'WINDOW_SEALED');
  lab.advanceWindow();
  assert.strictEqual(lab.currentSourceId, 'ray');
});

await t('nothing stored reads as a fresh start, not an error', async () => {
  const { session, stale } = await load(new MemoryStore(), 'simplus-01', 'nobody');
  assert.strictEqual(session, null);
  assert.strictEqual(stale, false);
});

await t('state from an older engine reports stale rather than throwing', async () => {
  const store = new MemoryStore();
  const a = run(['terry', 'ray', 'ruth'], ['Why does the log exist?']);
  const state = a.toJSON();
  state.v = STATE_VERSION + 1;
  await store.set(sessionKey('simplus-01', 'user-1'), state);
  const out = await load(store, 'simplus-01', 'user-1');
  assert.strictEqual(out.session, null);
  assert.strictEqual(out.stale, true);
  assert.match(out.reason, /engine expects/);
});

await t('two participants never collide', async () => {
  const store = new MemoryStore();
  await save(store, 'simplus-01', 'u1', run(['terry', 'ray', 'ruth'], ['Why does the log exist?']));
  await save(store, 'simplus-01', 'u2', run(['ruth', 'terry', 'ray'], ['What do you do here?']));
  const a = await load(store, 'simplus-01', 'u1');
  const b = await load(store, 'simplus-01', 'u2');
  assert.deepStrictEqual(a.session.order, ['terry', 'ray', 'ruth']);
  assert.deepStrictEqual(b.session.order, ['ruth', 'terry', 'ray']);
});

await t('the same person in two sims never collides', () => {
  assert.notStrictEqual(sessionKey('simplus-01', 'u1'), sessionKey('sim-03', 'u1'));
});

await t('clearing removes it', async () => {
  const store = new MemoryStore();
  await save(store, 'simplus-01', 'u1', run(['terry', 'ray', 'ruth'], ['Why does the log exist?']));
  await clear(store, 'simplus-01', 'u1');
  assert.strictEqual((await load(store, 'simplus-01', 'u1')).session, null);
});

console.log('\nthe clock is spent by asking, not by the wall');

await t('time away from the browser costs nothing', async () => {
  const store = new MemoryStore();
  const a = run(['terry', 'ray', 'ruth'], ['Why does the log exist?']);
  const before = a.remaining;
  await save(store, 'simplus-01', 'u1', a);
  // ...an hour passes...
  const { session } = await load(store, 'simplus-01', 'u1');
  assert.strictEqual(session.remaining, before,
    'wall-clock decay would let a dropped connection cost someone their window');
});

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
})();
