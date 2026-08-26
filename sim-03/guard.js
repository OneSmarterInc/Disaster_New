#!/usr/bin/env node
// Build guard for RapidSim 03.
//
// The tests prove the engine works. This proves the process definition it is
// pointed at still teaches the lesson. They are different failures: a tuned
// action cost can leave every test green and quietly turn the dilemma into a
// dominant strategy.
//
// Run it after any edit to a process definition. It takes the definition path
// as an argument so it can be pointed at the fixture or at a real scenario.

'use strict';

const path = require('path');
const { Session } = require('./lib/engine');

const target = process.argv[2] || './test/fixture-process.js';
const proc = require(path.resolve(process.cwd(), target));

const failures = [];
function check(name, fn, why) {
  try {
    const ok = fn();
    if (ok) { console.log(`  ok   ${name}`); return; }
    failures.push(`${name}\n       ${why}`);
    console.error(`  FAIL ${name}`);
  } catch (e) {
    failures.push(`${name}\n       threw: ${e.message}`);
    console.error(`  FAIL ${name} — threw`);
  }
}

const run = (plan) => {
  const s = new Session(proc);
  let i = 0;
  while (!s.finished) { s.act(plan[Math.min(i, plan.length - 1)]); i++; }
  return s;
};

const greedyAction = proc.actions
  .filter(a => (a.downstreamEffects || []).some(e => e.delta > 0))
  .sort((a, b) => (b.local?.clears || 0) - (a.local?.clears || 0))[0];

const inspectAction = proc.actions.find(a => a.inspect);
const remedyAction = proc.actions
  .find(a => (a.downstreamEffects || []).some(e => e.delta < 0));

console.log(`\nguard: ${target}\n`);

check('a locally optimal action exists', () => !!greedyAction,
  'no action improves local performance at downstream cost — there is no trap');

check('an inspect action exists', () => !!inspectAction,
  'nothing lets the participant see downstream — the sim is unwinnable');

check('a remedy exists', () => !!remedyAction,
  'seeing the problem with no way to act on it is a lecture, not a simulation');

check('the greedy path harms somebody', () => run([greedyAction.id]).harm.triggered,
  'playing the local scoreboard causes no harm — nothing is being taught');

check('the greedy path names who it harmed', () => {
  const h = run([greedyAction.id]).harm;
  return typeof h.person === 'string' && h.person.length > 0;
}, 'harm landed on a metric rather than a person');

check('harm arrives late enough to be a surprise', () => {
  const s = run([greedyAction.id]);
  return s.harm.atRound >= Math.ceil(proc.rounds / 3);
}, 'harm fires too early — the participant never commits to the wrong model');

check('harm arrives early enough to be recoverable', () => {
  const s = run([greedyAction.id]);
  return s.harm.atRound <= proc.rounds;
}, 'harm never fires within the run');

check('the trap outscores the careful path locally', () => {
  const safe = proc.actions.find(a => a.id !== greedyAction.id && !a.inspect &&
    !(a.downstreamEffects || []).length);
  if (!safe) return false;
  return run([greedyAction.id]).localScore > run([safe.id]).localScore;
}, 'the wrong answer does not pay, so nobody will choose it');

check('inspecting costs local score', () => !!(inspectAction.localCost > 0),
  'looking downstream is free, so there is no trade and no lesson');

check('every downstream effect is deferred', () =>
  proc.actions.every(a => (a.downstreamEffects || [])
    .every(e => e.lag === undefined || e.lag >= 1)),
  'a same-round effect teaches the mapping immediately');

check('every harming station names an owner', () =>
  proc.stations.filter(s => s.harmThreshold !== undefined).every(s => !!s.owner),
  'harm must land on a named individual, never on a system');

console.log('');
if (failures.length) {
  console.error(`REFUSING: ${failures.length} invariant(s) broken\n`);
  failures.forEach(f => console.error(`  - ${f}\n`));
  process.exit(1);
}
console.log(`clean — 11 invariants checked\n`);
