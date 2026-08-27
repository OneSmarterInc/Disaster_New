// Engine tests. Run with: node test/engine.test.js
//
// Four things are being defended here, in order of how badly it hurts when
// they break:
//
//   1. Nothing hidden reaches visible(). If this fails the sim teaches nothing,
//      because the participant can read the answer.
//   2. Downstream effects are deferred. If this fails the participant learns
//      the mapping and the sim becomes an optimisation puzzle.
//   3. The sim is winnable AND losable. Both paths must exist or it is a trick.
//   4. State survives a round trip through JSON, because faculty run these
//      across breaks and a lost session is a lost exercise.

'use strict';

const assert = require('assert');
const { Session, PROTECTED_KEYS } = require('../lib/engine');
const proc = require('./fixture-process');

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log(`  ok   ${name}`); }
  catch (e) { failed++; console.error(`  FAIL ${name}\n       ${e.message}`); }
}

// ---------------------------------------------------------------------------
console.log('\nleak protection');
// ---------------------------------------------------------------------------

test('visible() emits no protected key at the top level', () => {
  const s = new Session(proc);
  const v = s.visible();
  for (const k of PROTECTED_KEYS) {
    assert.strictEqual(v[k], undefined, `visible() leaked ${k}`);
  }
});

test('visible() emits no protected key anywhere in the tree', () => {
  const s = new Session(proc);
  s.act('clear_fast');
  s.act('walk_downstream');
  s.act('clear_fast');
  const blob = JSON.stringify(s.visible());
  for (const k of PROTECTED_KEYS) {
    // Match the key position specifically. Matching a bare quoted token also
    // matches any string VALUE that happens to equal a protected word, which
    // is a false positive waiting to happen the moment a station is named
    // something sensible like "settlement" or "rework".
    assert.ok(!blob.includes(`"${k}":`), `visible() leaked ${k} in a nested object`);
  }
});

test('available actions do not carry their downstream consequences', () => {
  const s = new Session(proc);
  const blob = JSON.stringify(s.visible().availableActions);
  assert.ok(!blob.includes('downstreamEffects'), 'action list leaked its effects');
  assert.ok(!blob.includes('inspect'), 'action list leaked which action inspects');
  assert.ok(!blob.includes('strain'), 'action list leaked the hidden field name');
});

test('an inspect reading is prose, not a number', () => {
  const s = new Session(proc);
  s.act('clear_fast');
  s.act('clear_fast');
  const { reading } = s.act('walk_downstream');
  assert.ok(reading && typeof reading.text === 'string');
  assert.ok(!/\d/.test(reading.text), 'reading contained a figure to optimise against');
});

// ---------------------------------------------------------------------------
console.log('\ndeferral');
// ---------------------------------------------------------------------------

test('a downstream effect does not land in the round it was caused', () => {
  const s = new Session(proc);
  const before = s.downstream.settlement.strain;
  s.act('clear_fast');
  assert.strictEqual(s.downstream.settlement.strain, before,
    'lag 2 effect landed immediately');
});

test('a downstream effect lands on schedule', () => {
  const s = new Session(proc);
  // Taken during round 0 with lag 2, so it is due at round 2, and round 2 is
  // reached by the second advance. The participant therefore takes one whole
  // decision after the causing one before anything shows.
  s.act('clear_fast');            // acts in round 0, queues for round 2, clock -> 1
  assert.strictEqual(s.downstream.settlement.strain, 0, 'landed same round');
  s.act('clear_complete');        // clock -> 2, the effect lands
  assert.strictEqual(s.downstream.settlement.strain, 2);
});

test('the definition rejects a same-round downstream effect', () => {
  const bad = JSON.parse(JSON.stringify(proc));
  bad.actions[0].downstreamEffects[0].lag = 0;
  assert.throws(() => new Session(bad), /lag < 1/);
});

// ---------------------------------------------------------------------------
console.log('\nthe trap and the way out');
// ---------------------------------------------------------------------------

test('pure local optimisation harms a named person', () => {
  const s = new Session(proc);
  while (!s.finished) s.act('clear_fast');
  assert.ok(s.harm.triggered, 'the locally optimal path caused no harm — no lesson');
  assert.strictEqual(typeof s.harm.person, 'string');
  assert.ok(s.harm.person.length > 0, 'harm landed on nobody');
});

test('pure local optimisation scores well locally', () => {
  const greedy = new Session(proc);
  while (!greedy.finished) greedy.act('clear_fast');
  const careful = new Session(proc);
  while (!careful.finished) careful.act('clear_complete');
  assert.ok(greedy.localScore > careful.localScore,
    'the trap must pay, or nobody falls into it');
});

test('a participant who looks and then acts avoids the harm', () => {
  const s = new Session(proc);
  s.act('clear_fast');
  s.act('walk_downstream');
  s.act('clear_fast');
  s.act('walk_downstream');
  while (!s.finished) s.act('rework_batch');
  assert.ok(!s.harm.triggered, 'the sim is unwinnable as configured');
});

test('avoiding the harm costs local score', () => {
  const greedy = new Session(proc);
  while (!greedy.finished) greedy.act('clear_fast');
  const wise = new Session(proc);
  wise.act('clear_fast');
  wise.act('walk_downstream');
  wise.act('clear_fast');
  wise.act('walk_downstream');
  while (!wise.finished) wise.act('rework_batch');
  assert.ok(wise.localScore < greedy.localScore,
    'if the right answer is also locally optimal there is no dilemma');
});

test('harm fires once and keeps its round', () => {
  const s = new Session(proc);
  while (!s.finished) s.act('clear_fast');
  const at = s.harm.atRound;
  s.checkHarm();
  assert.strictEqual(s.harm.atRound, at);
});

// ---------------------------------------------------------------------------
console.log('\nvalidation');
// ---------------------------------------------------------------------------

test('a station that can harm must name somebody', () => {
  const bad = JSON.parse(JSON.stringify(proc));
  delete bad.stations[2].owner;
  assert.throws(() => new Session(bad), /names nobody/);
});

test('a process with no inspect action is rejected', () => {
  const bad = JSON.parse(JSON.stringify(proc));
  bad.actions = bad.actions.filter(a => !a.inspect);
  assert.throws(() => new Session(bad), /unwinnable/);
});

test('a single-station process is rejected', () => {
  const bad = JSON.parse(JSON.stringify(proc));
  bad.stations = [bad.stations[1]];
  assert.throws(() => new Session(bad), /at least two stations/);
});

test('an action targeting an unknown station is rejected', () => {
  const bad = JSON.parse(JSON.stringify(proc));
  bad.actions[0].downstreamEffects[0].stationId = 'nowhere';
  assert.throws(() => new Session(bad), /unknown station/);
});

// ---------------------------------------------------------------------------
console.log('\nlifecycle and persistence');
// ---------------------------------------------------------------------------

test('the run ends after the configured number of rounds', () => {
  const s = new Session(proc);
  let n = 0;
  while (!s.finished) { s.act('clear_complete'); n++; if (n > 50) break; }
  assert.strictEqual(n, proc.rounds);
});

test('acting after the end throws', () => {
  const s = new Session(proc);
  while (!s.finished) s.act('clear_complete');
  assert.throws(() => s.act('clear_complete'), /run is over/);
});

test('an unavailable action throws rather than silently doing nothing', () => {
  const s = new Session(proc);
  assert.throws(() => s.act('rework_batch'), /unavailable/);
});

test('state survives a JSON round trip', () => {
  const s = new Session(proc);
  s.act('clear_fast');
  s.act('walk_downstream');
  const revived = Session.fromJSON(proc, JSON.parse(JSON.stringify(s)));
  assert.deepStrictEqual(revived.downstream, s.downstream);
  assert.deepStrictEqual(revived.pending, s.pending);
  assert.deepStrictEqual(revived.transcript, s.transcript);
  assert.strictEqual(revived.round, s.round);
});

test('a revived session continues to behave', () => {
  const a = new Session(proc);
  a.act('clear_fast');
  const b = Session.fromJSON(proc, JSON.parse(JSON.stringify(a)));
  a.act('clear_fast');
  b.act('clear_fast');
  assert.deepStrictEqual(b.downstream, a.downstream);
  assert.strictEqual(b.localScore, a.localScore);
});

test('the transcript records every action taken', () => {
  const s = new Session(proc);
  s.act('clear_fast');
  s.act('clear_complete');
  s.act('walk_downstream');
  assert.strictEqual(s.transcript.length, 3);
  assert.deepStrictEqual(s.transcript.map(t => t.actionId),
    ['clear_fast', 'clear_complete', 'walk_downstream']);
});


// ---------------------------------------------------------------------------
console.log('\naction tokens');
// ---------------------------------------------------------------------------

test('the browser is given opaque tokens, not action ids', () => {
  const s = new Session(proc);
  for (const a of s.visible().availableActions) {
    assert.ok(!proc.actions.some(pa => pa.id === a.id),
      `real action id ${a.id} reached the client`);
  }
});

test('two runs get different tokens for the same action', () => {
  const a = new Session(proc), b = new Session(proc);
  assert.notDeepStrictEqual(
    a.visible().availableActions.map(x => x.id),
    b.visible().availableActions.map(x => x.id),
    'tokens are stable across runs — comparing screens would leak');
});

test('a token from the run resolves to its action', () => {
  const s = new Session(proc);
  const tok = s.visible().availableActions[0].id;
  const before = s.actionsTaken.length;
  s.act(tok);
  assert.strictEqual(s.actionsTaken.length, before + 1);
});

test('tokens survive a JSON round trip', () => {
  const s = new Session(proc);
  const tok = s.visible().availableActions[0].id;
  const revived = Session.fromJSON(proc, JSON.parse(JSON.stringify(s)));
  assert.strictEqual(revived.tokens[tok], s.tokens[tok]);
  revived.act(tok);   // must not throw
});

// ---------------------------------------------------------------------------
console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
