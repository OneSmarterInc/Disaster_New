const assert = require('assert');
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
