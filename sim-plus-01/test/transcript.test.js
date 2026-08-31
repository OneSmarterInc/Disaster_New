'use strict';

const assert = require('assert');
const { Session } = require('../src/engine');
const { review } = require('../src/report');
const { buildEnvelope, makeResolver } = require('../src/transcript');

let pass = 0, fail = 0;
function t(name, fn) {
  try { fn(); console.log(`  ok   ${name}`); pass++; }
  catch (e) { console.log(`  FAIL ${name}\n         ${e.message}`); fail++; }
}

const J = 'Recorded during the interview windows.';
function submission(rows, rootCause = 'Latency drives the repeat volume.') {
  return {
    rootCause,
    rows: Object.fromEntries(
      Object.entries(rows).map(([k, d]) => [k, { disposition: d, justification: J }])
    )
  };
}
const SAFE = { intake: 'keep', log: 'keep', vendor: 'keep', review: 'keep' };

function informedRun() {
  const s = new Session().chooseOrder(['terry', 'ray', 'ruth']);
  s.ask('Why does the log exist?');
  s.ask('Who reads the log?');
  s.ask('Have you ever seen anyone pull it up?');
  s.ask('What do you tell them when they call?');
  s.advanceWindow();
  s.ask('How many claims a day?');
  s.ask('Do we send anything back to them?');
  s.advanceWindow();
  s.ask('Is there anything you catch that nothing else would?');
  s.ask('Why do they send it again?');
  s.ask('How long is the gap between copies?');
  return s;
}

function closedRun() {
  const s = new Session().chooseOrder(['ruth', 'terry', 'ray']);
  s.ask('So what do you do here?');
  s.ask('How much of this could the new system handle?');
  s.ask('Do you get many repeat claims?');
  s.advanceWindow();
  s.ask('Why does the log exist?');
  s.advanceWindow();
  s.ask('Do we send anything back to them?');
  return s;
}

console.log('\nenvelope shape');

t('envelope carries the declared fields', () => {
  const s = informedRun();
  const env = buildEnvelope(s, review(submission(SAFE), s.transcript), {
    sessionId: 'sess-1', participant: { id: 'p1', displayName: 'A. Participant' }
  });
  ['simId', 'simVersion', 'path', 'phases', 'events', 'transitions', 'reachability', 'outcome']
    .forEach((k) => assert.ok(env[k] !== undefined, `missing ${k}`));
  assert.strictEqual(env.simId, 'rapid-03-bench');
  assert.ok(env.simVersion, 'simVersion must never be empty');
});

t('ordinals are contiguous and start at 1', () => {
  const s = informedRun();
  const env = buildEnvelope(s, review(submission(SAFE), s.transcript), {});
  env.events.forEach((e, i) => assert.strictEqual(e.ordinal, i + 1));
});

t('phases carry sim-supplied labels', () => {
  const s = informedRun();
  const env = buildEnvelope(s, review(submission(SAFE), s.transcript), {});
  assert.match(env.phases[0].label, /Window 1 · Terry Voss/);
});

console.log('\nno answer text in the stored record');

t('no event carries answer text', () => {
  const s = informedRun();
  const env = buildEnvelope(s, review(submission(SAFE), s.transcript), {});
  for (const e of env.events) {
    assert.ok(!('answer' in e), 'event exposed an answer field');
    assert.ok(!('text' in e), 'event exposed a text field');
  }
});

t('the serialised envelope contains no scripted line', () => {
  const s = informedRun();
  const env = buildEnvelope(s, review(submission(SAFE), s.transcript), {});
  const json = JSON.stringify(env);
  // Distinctive phrases from the contracts. None may survive into storage.
  const leaks = [
    'one in seven', 'two extractions', 'Audit pull it', 'PO box',
    'hardly ever see twice', 'no patience', 'Nothing goes out from here'
  ].filter((p) => json.includes(p));
  assert.deepStrictEqual(leaks, [], `leaked into envelope: ${leaks.join(' | ')}`);
});

console.log('\nresolver');

t('outputRef round-trips to the line actually delivered', () => {
  const s = informedRun();
  const env = buildEnvelope(s, review(submission(SAFE), s.transcript), {});
  const resolve = makeResolver();
  env.events.forEach((e, i) => {
    assert.strictEqual(resolve(e.outputRef), s.transcript[i].answer,
      `ordinal ${e.ordinal} resolved to the wrong line`);
  });
});

t('a closed source resolves to its rotation, not the bucket answer', () => {
  const s = closedRun();
  const env = buildEnvelope(s, review(submission(SAFE), s.transcript), {});
  const resolve = makeResolver();
  const third = env.events[2]; // asked about repeats AFTER she closed
  assert.strictEqual(third.classification, 'EXCEPTION_HANDLING');
  assert.ok(!/one in seven/.test(resolve(third.outputRef)),
    'closed source resolved to open content');
});

console.log('\ntransitions');

t('closing is marked irreversible and names the question', () => {
  const s = closedRun();
  const env = buildEnvelope(s, review(submission(SAFE), s.transcript), {});
  const irr = env.transitions.filter((x) => x.kind === 'irreversible');
  assert.strictEqual(irr.length, 1);
  assert.match(irr[0].causedBy, /new system handle/);
  assert.match(irr[0].label, /stopped volunteering/);
});

t('opening is a gate, not irreversible', () => {
  const s = informedRun();
  const env = buildEnvelope(s, review(submission(SAFE), s.transcript), {});
  const gates = env.transitions.filter((x) => x.kind === 'gate');
  assert.strictEqual(gates.length, 1);
  assert.strictEqual(gates[0].to, 'OPEN');
});

console.log('\nreachability');

t('held markers record where they were reached', () => {
  const s = informedRun();
  const env = buildEnvelope(s, review(submission(SAFE), s.transcript), {});
  const held = env.reachability.filter((r) => r.held);
  assert.ok(held.length >= 5, `only ${held.length} held`);
  held.forEach((r) => assert.ok(r.heldAt >= 1, `${r.id} held without an ordinal`));
});

t('markers missed behind a closed door say so', () => {
  const s = closedRun();
  const env = buildEnvelope(s, review(submission(SAFE), s.transcript), {});
  const blocked = env.reachability.filter((r) => r.blockedBy === 'irreversible-transition');
  assert.ok(blocked.length >= 2, `expected several blocked, got ${blocked.length}`);
  blocked.forEach((r) => assert.strictEqual(r.actorId, 'ruth'));
});

t('markers simply not asked about are distinguished from blocked ones', () => {
  const s = informedRun();
  const env = buildEnvelope(s, review(submission(SAFE), s.transcript), {});
  const notAsked = env.reachability.filter((r) => r.blockedBy === 'not-asked');
  assert.ok(notAsked.length >= 1);
  assert.strictEqual(
    env.reachability.filter((r) => r.blockedBy === 'irreversible-transition').length, 0
  );
});

console.log('\nobservation estimate');

t('the estimate travels with its debrief reading', () => {
  const s = informedRun();
  const env = buildEnvelope(s, review(submission(SAFE), s.transcript), { observationSeconds: 30 });
  assert.strictEqual(env.observation.estimateSeconds, 30);
  assert.strictEqual(env.observation.trueMean, 30);
  assert.strictEqual(env.observation.reading.band, 'averaged-it-in');
});

t('excluding the long claims reads differently from averaging them in', () => {
  const s = informedRun();
  const r = review(submission(SAFE), s.transcript);
  assert.strictEqual(buildEnvelope(s, r, { observationSeconds: 12 }).observation.reading.band,
    'excluded-the-long-claims');
  assert.strictEqual(buildEnvelope(s, r, { observationSeconds: 48 }).observation.reading.band,
    'over-weighted-the-long-claims');
});

t('the estimate surfaces as an artifact beside the root cause', () => {
  const s = informedRun();
  const env = buildEnvelope(s, review(submission(SAFE), s.transcript), { observationSeconds: 30 });
  const art = env.outcome.artifacts.find((a) => /Observed pace/.test(a.label));
  assert.ok(art, 'estimate missing from artifacts');
  assert.match(art.value, /30 seconds per claim/);
  assert.match(art.value, /eighty-minute batch/);
});

t('no estimate is a clean absence, not a zero', () => {
  const s = informedRun();
  const env = buildEnvelope(s, review(submission(SAFE), s.transcript), {});
  assert.strictEqual(env.observation, null);
  assert.ok(!env.outcome.artifacts.some((a) => /Observed pace/.test(a.label)));
});

t('the estimate is never scored', () => {
  const s = informedRun();
  const env = buildEnvelope(s, review(submission(SAFE), s.transcript), { observationSeconds: 12 });
  const json = JSON.stringify(env.observation);
  ['correct', 'wrong', 'score', 'incorrect'].forEach((w) =>
    assert.ok(!json.toLowerCase().includes(w), `estimate carries a verdict: ${w}`));
});

console.log('\noutcome');

t('harm surfaces as the envelope severity', () => {
  const s = informedRun();
  const env = buildEnvelope(s, review(submission({ ...SAFE, review: 'automate' }), s.transcript), {});
  assert.strictEqual(env.outcome.severity, 'harm');
  assert.match(env.outcome.summary, /caused harm/);
  assert.match(env.outcome.detail, /Denial letters/);
});

t('the root cause travels as an artifact, verbatim', () => {
  const s = informedRun();
  const rc = 'Nothing acknowledges receipt, so providers send again.';
  const env = buildEnvelope(s, review(submission(SAFE, rc), s.transcript), {});
  assert.strictEqual(env.outcome.artifacts[0].value, rc);
});

t('envelope is JSON-serialisable with no loss', () => {
  const s = informedRun();
  const env = buildEnvelope(s, review(submission(SAFE), s.transcript), { sessionId: 'x' });
  assert.deepStrictEqual(JSON.parse(JSON.stringify(env)), env);
});

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
