// Build guard. Two invariants that, if broken, break the sim silently.
//
// 1. Every bucket named in the fact contracts must exist in the bank,
//    and every bucket in the bank must be one the contracts script.
//    A bucket with no scripted answer returns nothing at runtime.
// 2. Ordering invariants. The bank is order-sensitive and a well-meaning
//    alphabetical sort would close Ruth on innocent questions.
const bank = require('./data/phrasings');

const CONTRACT_BUCKETS = [
  'GENERIC_DESCRIPTIVE','PURPOSE_ORIGIN','DOWNSTREAM_CONSUMER',
  'EXCEPTION_HANDLING','COUNTERFACTUAL','SENDER_PERSPECTIVE',
  'VOLUME_TIMING','PERSONAL_HISTORY','TOOLS_SYSTEMS',
  'EFFICIENCY_FRAMING','AMBIGUOUS_PRESSURE'
];

let fail = 0;
const err = (m) => { console.log('  FAIL ' + m); fail++; };

const inBank = new Set(bank.map(e => e.bucket));
for (const b of CONTRACT_BUCKETS) if (!inBank.has(b)) err(`contract bucket "${b}" has no patterns`);
for (const b of inBank) if (!CONTRACT_BUCKETS.includes(b)) err(`bank bucket "${b}" has no scripted answers`);

// first index of each bucket in the ordered bank
const idx = (b) => bank.findIndex(e => e.bucket === b);
const before = (a, b, why) => { if (idx(a) >= idx(b)) err(`${a} must precede ${b} — ${why}`); };

before('TOOLS_SYSTEMS','EFFICIENCY_FRAMING','current-state automation questions would close Ruth');
before('AMBIGUOUS_PRESSURE','EFFICIENCY_FRAMING','"what slows you down" would close Ruth');
before('SENDER_PERSPECTIVE','PURPOSE_ORIGIN','"why do they send it again" would return the wrong script');
before('SENDER_PERSPECTIVE','DOWNSTREAM_CONSUMER','sender questions would be read as routing questions');
before('COUNTERFACTUAL','EXCEPTION_HANDLING','"what if you stopped" would be read as "what if it is wrong"');
before('EXCEPTION_HANDLING','GENERIC_DESCRIPTIVE','"what do you do when..." would cost 3 minutes');

// GENERIC must be the most expensive bucket — that cost is the lesson
const generic = bank.find(e => e.bucket === 'GENERIC_DESCRIPTIVE');
for (const e of bank) {
  if (e.bucket !== 'GENERIC_DESCRIPTIVE' && e.cost >= generic.cost)
    err(`${e.bucket} costs ${e.cost}s, not less than GENERIC_DESCRIPTIVE (${generic.cost}s)`);
}

// --- report invariants -------------------------------------------------
const { ROWS, OUTCOMES, DISPOSITIONS, EVIDENCE, LOOP_PAIRS } = require('./data/report');

// Every row must price every disposition. A missing outcome returns
// severity 'unknown' at runtime, which reads as a silent pass.
for (const row of ROWS) {
  const o = OUTCOMES[row.id];
  if (!o) { err(`report row "${row.id}" has no outcomes`); continue; }
  for (const d of DISPOSITIONS) {
    if (!o[d]) err(`report row "${row.id}" has no outcome for disposition "${d}"`);
  }
}

// Exactly one row may be answered with cannot_assess correctly. If a
// second appears, the dodge detection stops meaning anything.
const correctRows = ROWS.filter(r => (OUTCOMES[r.id].cannot_assess || {}).severity === 'correct');
if (correctRows.length !== 1)
  err(`expected exactly one row where cannot_assess is correct, found ${correctRows.length}`);

// Harm must be reachable, and only from the review row.
const harmRows = ROWS.filter(r => DISPOSITIONS.some(d => (OUTCOMES[r.id][d] || {}).severity === 'harm'));
if (harmRows.length !== 1 || harmRows[0].id !== 'review')
  err(`harm must fire from the review row alone, found: ${harmRows.map(r => r.id).join(', ') || 'none'}`);

// Loop pairs may only reference declared markers.
const markerIds = new Set(EVIDENCE.map(e => e.id));
for (const pair of LOOP_PAIRS)
  for (const id of pair)
    if (!markerIds.has(id)) err(`loop pair references undeclared marker "${id}"`);

// Markers keyed on variant must be guarded by answerKey, or a catch-all
// rotation will satisfy them with an answer that was never given.
for (const e of EVIDENCE) {
  const src = e.match.toString();
  if (src.includes('variant') && !src.includes('answerKey'))
    err(`marker "${e.id}" tests variant without guarding answerKey`);
}

// --- persistence invariants -------------------------------------------
const { Session, STATE_VERSION } = require('./src/engine');

// Stored state must never contain a line any character speaks. The session
// store would otherwise become a second copy of the answer key, reachable by
// anyone with read access to the KV.
{
  const probe = new Session().chooseOrder(['terry','ray','ruth']);
  ['Why does the log exist?','What do you tell them when they call?','Who reads the log?']
    .forEach(q => probe.ask(q));
  probe.advanceWindow();
  probe.ask('Do we send anything back to them?');
  const stored = JSON.stringify(probe.toJSON());
  ['PO box','been processed','Audit pull it','Nothing goes out from here']
    .forEach(line => { if (stored.includes(line)) err(`answer text "${line}" reached stored state`); });
  if (/"answer"\s*:/.test(stored)) err('stored transcript has an answer field');

  // Round trip must be lossless for everything the sim depends on.
  const back = Session.fromJSON(JSON.parse(stored));
  if (back.transcript.length !== probe.transcript.length) err('transcript lost across a round trip');
  if (back.askCounts.size !== probe.askCounts.size) err('askCounts lost — repeat escalation would reset');
  if (back.posture.ruth !== probe.posture.ruth) err('posture lost across a round trip');

  // A sealed window is the whole basis of the split-session format.
  const sealed = new Session().chooseOrder(['terry','ray','ruth']);
  sealed.ask('Why does the log exist?');
  sealed.seal();
  const resumed = Session.fromJSON(JSON.parse(JSON.stringify(sealed.toJSON())));
  if (resumed.ask('Who reads the log?').error !== 'WINDOW_SEALED')
    err('a sealed window reopened after a resume — the calendar stops constraining anything');
}

if (typeof STATE_VERSION !== 'number') err('STATE_VERSION must be a number');

console.log(fail ? `\nGUARD FAILED (${fail})` : '\nGUARD PASSED — all invariants hold');
process.exit(fail ? 1 : 0);
