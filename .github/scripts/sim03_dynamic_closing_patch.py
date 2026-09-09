from pathlib import Path

FINISH = Path('sim03/api/finish.js')
INDEX = Path('sim03/public/index.html')
BUILD = Path('sim03/build.js')
LESSON = Path('sim03/lib/closingLesson.js')
TEST = Path('sim03/tools/closing-lesson-check.js')


def replace_once(text, old, new, label):
    if old not in text:
        raise SystemExit(f'missing anchor: {label}')
    return text.replace(old, new, 1)

lesson_source = r'''\'use strict\';

// Builds the student-specific part of the closing lesson from allocations and
// outcomes that have already been resolved by the existing scenario engine.
// This module does not introduce thresholds, scores, or alternate outcome rules.
const ORDER = ['run', 'uptime', 'capacity', 'connect', 'features'];
const LABELS = {
  run: 'Run',
  uptime: 'Uptime',
  capacity: 'Capacity',
  connect: 'Connect',
  features: 'Features'
};

function amount(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function cumulative(y1, y2) {
  const out = {};
  for (const key of ORDER) out[key] = amount(y1 && y1[key]) + amount(y2 && y2[key]);
  return out;
}

function largestLine(c) {
  let key = ORDER[0];
  for (const candidate of ORDER.slice(1)) {
    if (c[candidate] > c[key]) key = candidate;
  }
  return { key, label: LABELS[key], amount: c[key] };
}

function year3Sentence(c, band) {
  if (band === 'strong') {
    return `By Year 3, your $${c.connect}M in Connect and $${c.capacity}M in Capacity worked together: Midland had both field history and room to turn predictive service into something it could actually sell.`;
  }
  if (band === 'data_no_room') {
    return `By Year 3, your $${c.connect}M in Connect had created the field history, but $${c.capacity}M in Capacity left too little room to run the model reliably at scale.`;
  }
  if (band === 'pilot') {
    return `By Year 3, your $${c.connect}M in Connect and $${c.capacity}M in Capacity got Midland to a promising pilot, but not yet to a predictive-service business.`;
  }
  if (band === 'weak') {
    return `By Year 3, your $${c.connect}M in Connect had not created enough usable field history for prediction to become a real capability.`;
  }
  return '';
}

function heatSentence(c, band) {
  if (band === 'strong') return `Your $${c.uptime}M in Uptime also meant dispatch held when the heat wave tested it.`;
  if (band === 'middle') return `Your $${c.uptime}M in Uptime kept the heat wave from becoming a full breakdown, but the service operation still had to fall back to manual work.`;
  if (band === 'weak') return `Your $${c.uptime}M in Uptime left the service operation exposed when the heat wave arrived.`;
  return '';
}

function competitorSentence(c, band) {
  if (band === 'strong') return `The same $${c.connect}M Connect investment let Midland answer the competitor from a position of strength.`;
  if (band === 'middle') return `The same $${c.connect}M Connect investment got Midland only as far as a limited pilot against the competitor.`;
  if (band === 'weak') return `The same $${c.connect}M Connect investment was not enough to answer the competitor quickly.`;
  return '';
}

function buyerSentence(buyers) {
  const ridge = buyers && buyers.ridge_hollow && buyers.ridge_hollow.interest;
  const corven = buyers && buyers.corven && buyers.corven.interest;
  if (!ridge || !corven) return '';
  if (ridge === corven) {
    return `Ridge Hollow and Corven both showed ${ridge} interest, but for different reasons: Ridge Hollow was testing the spending base while Corven was testing the connected-data asset.`;
  }
  return `Ridge Hollow showed ${ridge} interest while Corven showed ${corven} interest. The portfolio did not change between those judgments; what each buyer valued did.`;
}

function buildClosingLesson(y1, y2, outcomes) {
  const c = cumulative(y1, y2);
  const top = largestLine(c);
  const y3 = outcomes && outcomes.year3 && outcomes.year3.band;
  const heat = outcomes && outcomes.year2 && outcomes.year2.heat && outcomes.year2.heat.band;
  const competitor = outcomes && outcomes.year2 && outcomes.year2.competitor && outcomes.year2.competitor.band;
  const buyers = outcomes && outcomes.buyers;

  const yourRun = [
    `Your largest cumulative commitment was ${top.label} at $${top.amount}M. ${year3Sentence(c, y3)}`.trim(),
    [heatSentence(c, heat), competitorSentence(c, competitor)].filter(Boolean).join(' '),
    buyerSentence(buyers)
  ].filter(Boolean);

  return {
    title: 'What this run was teaching you',
    paragraphs: [
      'You spent two years making choices before you knew which consequences would matter. That is the work of architecture. It is not predicting the future. It is deciding which capabilities Midland will already have when the future arrives.',
      'Every million you put into Run, Uptime, Capacity, Connect, or Features was also a million you did not put somewhere else. The people in the room made every choice sound reasonable because each of them was right about their own part. The hard part was seeing the whole company before the evidence made the answer obvious.',
      'Capacity had no advocate. Connect did. Features were visible. Run and Uptime had immediate operational arguments. That imbalance was intentional: important foundations are often easiest to starve when nobody is asking for them yet.',
      'The three buyers were the final reminder that value depends on who is looking. You did not control which future arrived or what an eventual buyer would care about. You controlled whether Midland had built enough real capability that more than one future could still work.'
    ],
    yourRun,
    carryOut: 'You never controlled which future arrived. You controlled what Midland was ready for when it did.'
  };
}

module.exports = { buildClosingLesson };
'''.replace("\\'use strict\\';", "'use strict';")

if LESSON.exists():
    raise SystemExit('closingLesson.js already exists')
LESSON.write_text(lesson_source)

test_source = r'''const assert = require('assert');
const S = require('../lib/scenario.js');
const { buildClosingLesson } = require('../lib/closingLesson.js');

const valid = (x) => {
  const v = S.validateAllocation(x);
  assert.equal(v.ok, true, JSON.stringify(v));
  return v.allocation;
};

const noRoomA = valid({ run: 3, uptime: 3, capacity: 0, connect: 3, features: 0 });
const noRoomB = valid({ run: 3, uptime: 0, capacity: 0, connect: 3, features: 3 });
const noRoomOutcomes = S.evaluateAll(noRoomA, noRoomB);
const noRoom = buildClosingLesson(noRoomA, noRoomB, noRoomOutcomes);
assert.equal(noRoom.title, 'What this run was teaching you');
assert.ok(noRoom.yourRun.some(x => x.includes('$6M in Connect')));
assert.ok(noRoom.yourRun.some(x => x.includes('$0M in Capacity')));
assert.ok(noRoom.yourRun.some(x => x.includes('field history')));
assert.ok(noRoom.yourRun.some(x => x.includes('Corven showed high interest')));

const strongA = valid({ run: 3, uptime: 1, capacity: 1, connect: 3, features: 1 });
const strongB = valid({ run: 3, uptime: 2, capacity: 1, connect: 2, features: 1 });
const strongOutcomes = S.evaluateAll(strongA, strongB);
const strong = buildClosingLesson(strongA, strongB, strongOutcomes);
assert.equal(strongOutcomes.year3.band, 'strong');
assert.ok(strong.yourRun.some(x => x.includes('worked together')));
assert.notDeepEqual(strong.yourRun, noRoom.yourRun);

const weakA = valid({ run: 4, uptime: 2, capacity: 1, connect: 1, features: 1 });
const weakB = valid({ run: 4, uptime: 2, capacity: 1, connect: 1, features: 1 });
const weakOutcomes = S.evaluateAll(weakA, weakB);
const weak = buildClosingLesson(weakA, weakB, weakOutcomes);
assert.equal(weakOutcomes.year3.band, 'weak');
assert.ok(weak.yourRun.some(x => x.includes('not created enough usable field history')));

assert.deepEqual(
  buildClosingLesson(noRoomA, noRoomB, noRoomOutcomes),
  buildClosingLesson(noRoomA, noRoomB, noRoomOutcomes),
  'identical run must produce identical closing lesson'
);

for (const lesson of [noRoom, strong, weak]) {
  const all = [...lesson.paragraphs, ...lesson.yourRun, lesson.carryOut].join(' ');
  for (const forbidden of ['Score:', 'Grade:', 'Rank:']) assert.equal(all.includes(forbidden), false);
}

console.log('RapidSim 03 dynamic closing lesson checks passed.');
'''
if TEST.exists():
    raise SystemExit('closing-lesson-check.js already exists')
TEST.write_text(test_source)

# Wire the pure server-side lesson builder into finish without changing the
# completion/session/reporting path.
f = FINISH.read_text()
f = replace_once(
    f,
    "const S = require('../lib/scenario.js');\nconst store = require('../lib/store.js');",
    "const S = require('../lib/scenario.js');\nconst { buildClosingLesson } = require('../lib/closingLesson.js');\nconst store = require('../lib/store.js');",
    'closing lesson import'
)
old_fixed = """function closingLesson() {\n  return {\n    title: 'What this run was teaching you',\n    paragraphs: [\n      'You spent two years making choices before you knew which consequences would matter. That is the work of architecture. It is not predicting the future. It is deciding which capabilities Midland will already have when the future arrives.',\n      'Every million you put into Run, Uptime, Capacity, Connect, or Features was also a million you did not put somewhere else. The people in the room made every choice sound reasonable because each of them was right about their own part. The hard part was seeing the whole company before the evidence made the answer obvious.',\n      'Capacity had no advocate. Connect did. Features were visible. Run and Uptime had immediate operational arguments. That imbalance was intentional: important foundations are often easiest to starve when nobody is asking for them yet.',\n      'The three buyers were the final reminder that value depends on who is looking. You did not control which future arrived or what an eventual buyer would care about. You controlled whether Midland had built enough real capability that more than one future could still work.'\n    ],\n    carryOut: 'You never controlled which future arrived. You controlled what Midland was ready for when it did.'\n  };\n}\n\n"""
f = replace_once(f, old_fixed, '', 'old fixed closing lesson')
f = replace_once(
    f,
    "  summary.result = {\n",
    "  const closingLesson = buildClosingLesson(y1, y2, outcomes);\n\n  summary.result = {\n",
    'build dynamic lesson after outcomes'
)
f = replace_once(
    f,
    "    closingLesson: closingLesson()\n",
    "    closingLesson\n",
    'return dynamic lesson'
)
FINISH.write_text(f)

# Render only server-provided run-specific prose. No scoring or interpretation is
# added to the browser.
h = INDEX.read_text()
h = replace_once(
    h,
    ".closing-lesson{border:1px solid var(--line);background:var(--panel);padding:24px;margin-top:12px;break-inside:avoid;page-break-inside:avoid}.closing-lesson-inner{max-width:68ch;margin:0 auto}.closing-lesson p{font-size:1.05rem;line-height:1.7;color:#C9C6BE;margin:0 0 16px}.closing-carry{border-left:2px solid var(--amber);padding:12px 14px;margin-top:20px;background:rgba(240,166,60,.05);font-size:18px;font-style:italic;color:var(--bone)}.joinbox{max-width:560px}",
    ".closing-lesson{border:1px solid var(--line);background:var(--panel);padding:24px;margin-top:12px;break-inside:avoid;page-break-inside:avoid}.closing-lesson-inner{max-width:68ch;margin:0 auto}.closing-lesson p{font-size:1.05rem;line-height:1.7;color:#C9C6BE;margin:0 0 16px}.closing-run{margin:20px 0;padding:17px 0;border-top:1px solid var(--line);border-bottom:1px solid var(--line)}.closing-run h3{font:10px var(--mono);letter-spacing:.14em;text-transform:uppercase;color:var(--amber);margin:0 0 10px}.closing-run p:last-child{margin-bottom:0}.closing-carry{border-left:2px solid var(--amber);padding:12px 14px;margin-top:20px;background:rgba(240,166,60,.05);font-size:18px;font-style:italic;color:var(--bone)}.joinbox{max-width:560px}",
    'closing run styles'
)
old_renderer = "function closingLessonHTML(){const d=S.closingLesson;if(!d)return '';const ps=Array.isArray(d.paragraphs)?d.paragraphs:[];return `<div class=\"result-section\" id=\"closingLesson\"><div class=\"eyebrow\">${esc(d.title||'What this run was teaching you')}</div><div class=\"closing-lesson\"><div class=\"closing-lesson-inner\">${ps.map(p=>`<p>${esc(p)}</p>`).join('')}<div class=\"closing-carry\">${esc(d.carryOut||'')}</div></div></div></div>`}"
new_renderer = "function closingLessonHTML(){const d=S.closingLesson;if(!d)return '';const ps=Array.isArray(d.paragraphs)?d.paragraphs:[];const run=Array.isArray(d.yourRun)?d.yourRun:[];return `<div class=\"result-section\" id=\"closingLesson\"><div class=\"eyebrow\">${esc(d.title||'What this run was teaching you')}</div><div class=\"closing-lesson\"><div class=\"closing-lesson-inner\">${ps.map(p=>`<p>${esc(p)}</p>`).join('')}${run.length?`<div class=\"closing-run\"><h3>In your run</h3>${run.map(p=>`<p>${esc(p)}</p>`).join('')}</div>`:''}<div class=\"closing-carry\">${esc(d.carryOut||'')}</div></div></div></div>`}"
h = replace_once(h, old_renderer, new_renderer, 'closing lesson renderer')
INDEX.write_text(h)

# Extend guards and run the deterministic lesson tests from the build.
b = BUILD.read_text()
b = replace_once(
    b,
    "for (const marker of ['function closingLessonHTML()','What this run was teaching you','run-complete','closingLesson=done.closingLesson']) if (!index.includes(marker)) refuse('closing lesson marker missing: ' + marker);\nif (!fs.readFileSync(path.join(__dirname, 'api', 'finish.js'), 'utf8').includes('function closingLesson()')) refuse('server-authored closing lesson missing');",
    "for (const marker of ['function closingLessonHTML()','What this run was teaching you','In your run','d.yourRun','run-complete','closingLesson=done.closingLesson']) if (!index.includes(marker)) refuse('closing lesson marker missing: ' + marker);\nconst finishSource = fs.readFileSync(path.join(__dirname, 'api', 'finish.js'), 'utf8');\nif (!finishSource.includes('buildClosingLesson(y1, y2, outcomes)')) refuse('server-authored dynamic closing lesson missing');\nif (index.includes('Your largest cumulative commitment was')) refuse('run-specific closing prose leaked into student bundle before completion');",
    'build closing lesson guards'
)
b = replace_once(
    b,
    "execFileSync(process.execPath, [path.join(__dirname, 'tools', 'team-handler-check.js')], { stdio: 'inherit' });\n",
    "execFileSync(process.execPath, [path.join(__dirname, 'tools', 'team-handler-check.js')], { stdio: 'inherit' });\nexecFileSync(process.execPath, [path.join(__dirname, 'tools', 'closing-lesson-check.js')], { stdio: 'inherit' });\n",
    'run closing lesson test in build'
)
BUILD.write_text(b)
