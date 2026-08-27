// Scenario tests. Run with: node test/scenario.test.js
//
// The engine tests prove the machine works. These prove the machine is pointed
// at something that teaches. They are separate files because they fail for
// different reasons: an engine test breaks when the code is wrong, a scenario
// test breaks when somebody tunes a cost and does not realise what it cost.

'use strict';

const assert = require('assert');
const { Session } = require('../lib/engine');
const S = require('../lib/scenario');

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log(`  ok   ${name}`); }
  catch (e) { failed++; console.error(`  FAIL ${name}\n       ${e.message}`); }
}

// Play a plan to the end. The last entry repeats if the plan is short.
function play(plan) {
  const s = new Session(S.PROCESS);
  let i = 0;
  while (!s.finished) s.act(plan[Math.min(i++, plan.length - 1)]);
  return { session: s, debrief: S.debriefFor(s) };
}

const PLANS = {
  greedy:        ['clear_fast'],
  lookedEarly:   ['clear_fast', 'clear_fast', 'call_field', 'clear_fast'],
  lookedIgnored: ['clear_fast', 'clear_fast', 'clear_fast', 'clear_fast', 'call_field', 'clear_fast'],
  lookedLate:    ['clear_fast', 'clear_fast', 'clear_fast', 'clear_fast', 'call_field', 'reissue', 'reissue', 'bench_test'],
  blindFix:      ['clear_fast', 'clear_fast', 'call_field', 'reissue', 'call_field', 'reissue', 'bench_test', 'bench_test'],
  careful:       ['bench_test'],
  // Found by brute-force search over play plans rather than written by hand.
  // Both were reachable but unpinned, which meant two of the eight endings
  // could have broken without a single test noticing.
  sawAndActed:   ['clear_fast', 'clear_fast', 'clear_fast', 'call_field', 'call_field', 'call_field', 'reissue', 'call_field'],
  luckyRun:      ['call_field', 'call_field', 'call_field', 'call_field', 'call_field', 'clear_fast', 'bench_test', 'bench_test']
};

// ---------------------------------------------------------------------------
console.log('\nendings');
// ---------------------------------------------------------------------------

const EXPECTED = {
  greedy:        'never-looked',
  lookedEarly:   'looked-too-early',
  lookedIgnored: 'looked-did-nothing',
  lookedLate:    'looked-too-late',
  blindFix:      'acted-blind',
  careful:       'never-caused-it',
  sawAndActed:   'saw-and-acted',
  luckyRun:      'lucky'
};

for (const [plan, verdict] of Object.entries(EXPECTED)) {
  test(`${plan} ends in ${verdict}`, () => {
    assert.strictEqual(play(PLANS[plan]).debrief.verdict, verdict);
  });
}

test('every verdict defined in the scenario is pinned by a test here', () => {
  const src = require('fs').readFileSync(require('path').join(__dirname, '..', 'lib', 'scenario.js'), 'utf8');
  const defined = [...new Set([...src.matchAll(/^    '([a-z-]+)': \{/gm)].map(m => m[1]))];
  const pinned = Object.values(EXPECTED);
  const loose = defined.filter(v => !pinned.includes(v));
  assert.strictEqual(loose.length, 0, `verdicts with copy but no test: ${loose.join(', ')}`);
});

test('every ending has a title and a body', () => {
  for (const plan of Object.keys(PLANS)) {
    const d = play(PLANS[plan]).debrief;
    assert.ok(d.title && d.title.length > 10, `${plan} has no title`);
    assert.ok(d.body && d.body.length > 100, `${plan} has no body`);
  }
});

// ---------------------------------------------------------------------------
console.log('\nthe debrief must not lie');
// ---------------------------------------------------------------------------

test('a participant told everything was fine is not accused of ignoring a warning', () => {
  const { session, debrief } = play(PLANS.lookedEarly);
  const calm = S.PROCESS.stations.find(s => s.id === 'field').strainBands[0][1];
  const everShown = session.readLog.some(r => r.text !== calm);
  assert.strictEqual(everShown, false, 'this plan was supposed to see only calm readings');
  assert.ok(!/told .*running behind|told .*two visits/i.test(debrief.body),
    'the debrief claims they were warned when they were not');
});

test('a run that harms somebody names them', () => {
  for (const plan of ['greedy', 'lookedEarly', 'lookedIgnored', 'lookedLate']) {
    const d = play(PLANS[plan]).debrief;
    assert.ok(d.outcome && d.outcome.person, `${plan} harmed nobody it could name`);
  }
});

test('a run that harms nobody claims no outcome', () => {
  for (const plan of ['blindFix', 'careful', 'sawAndActed', 'luckyRun']) {
    assert.strictEqual(play(PLANS[plan]).debrief.outcome, null, `${plan} reported harm`);
  }
});

test('the timeline covers every day and marks the days they looked', () => {
  const { debrief } = play(PLANS.lookedIgnored);
  assert.strictEqual(debrief.timeline.length, S.PROCESS.rounds);
  assert.strictEqual(debrief.timeline.filter(t => t.sawIt).length, 1);
});

// ---------------------------------------------------------------------------
console.log('\nthe score gradient runs the wrong way, on purpose');
// ---------------------------------------------------------------------------

test('the worst outcome carries the best score', () => {
  const greedy = play(PLANS.greedy).debrief.localScore;
  for (const plan of ['lookedEarly', 'lookedIgnored', 'lookedLate', 'blindFix', 'careful', 'sawAndActed', 'luckyRun']) {
    assert.ok(play(PLANS[plan]).debrief.localScore < greedy,
      `${plan} scores at least as well as pure local optimisation — the trap does not pay`);
  }
});

test('the two clean runs score worst of all', () => {
  const clean = ['blindFix', 'careful'].map(p => play(PLANS[p]).debrief.localScore);
  const dirty = ['greedy', 'lookedEarly', 'lookedIgnored'].map(p => play(PLANS[p]).debrief.localScore);
  assert.ok(Math.max(...clean) < Math.min(...dirty),
    'protecting Dev is not the most expensive thing a participant can do — the dilemma is soft');
});

// ---------------------------------------------------------------------------
console.log('\nwhat the participant is allowed to read');
// ---------------------------------------------------------------------------

test('the opening brief names the person who can be harmed', () => {
  const blob = JSON.stringify(S.BRIEF);
  assert.ok(blob.includes('Dev Okonjo'),
    'harm must land on somebody they were told about, or it is a twist rather than a lesson');
});

test('the opening brief does not describe the mechanism', () => {
  const blob = JSON.stringify(S.BRIEF).toLowerCase();
  for (const t of ['wrong part', 'second visit', 'strain', 'first-time-fix']) {
    assert.ok(!blob.includes(t), `the brief gives away ${t}`);
  }
});

test('catalogue copy does not give the ending away', () => {
  const blob = [S.META.tagline, S.META.description, S.META.detail.turn, S.META.detail.after]
    .join(' ').toLowerCase();
  for (const t of ['wrong part', 'symptom code', 'first-time-fix']) {
    assert.ok(!blob.includes(t), `catalogue copy leaks ${t}`);
  }
});

// ---------------------------------------------------------------------------
console.log('\nplatform catalogue contract');
// ---------------------------------------------------------------------------

test('the sim supplies every catalogue field rather than inheriting defaults', () => {
  // The platform's defaults describe a four-character conversation sim with
  // three written moments. This sim has neither, so inheriting any of them
  // would put a description of a different product on the public page.
  const cat = require('../../platform/lib/catalogue.js');
  const eff = cat.effective(S.META.detail);
  const inherited = Object.keys(eff)
    .filter(k => typeof eff[k] === 'string' && eff[k] && S.META.detail[k] === undefined);
  assert.strictEqual(inherited.length, 0,
    `these fall back to platform copy written for a different sim: ${inherited.join(', ')}`);
});

test('the catalogue entry carries what registration needs', () => {
  for (const k of ['id', 'title', 'tagline', 'description', 'minutes']) {
    assert.ok(S.META[k], `META.${k} is missing and registration would reject or blank it`);
  }
  assert.ok(S.META.detail.cast.length > 0, 'no cast means an empty section on the detail page');
  assert.ok(S.META.detail.beats.length > 0, 'no beats means an empty section on the detail page');
});

test('the platform routes this sim', () => {
  const cfg = JSON.parse(require('fs').readFileSync(
    require('path').join(__dirname, '..', '..', 'platform', 'vercel.json'), 'utf8'));
  const routed = cfg.rewrites.filter(r => r.source.startsWith('/sim03'));
  assert.ok(routed.length >= 2, 'platform/vercel.json has no /sim03 rewrite');
  assert.ok(cfg.headers.some(h => h.source.startsWith('/sim03')),
    '/sim03 is missing the noindex header that 01 and 02 carry');
});

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
