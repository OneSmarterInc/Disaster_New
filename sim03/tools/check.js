const assert = require('assert');
const S = require('../lib/scenario.js');

const valid = (x) => {
  const v = S.validateAllocation(x);
  assert.equal(v.ok, true, JSON.stringify(v));
  return v.allocation;
};

const y1Weak = valid({ run: 3, uptime: 2, capacity: 2, connect: 0, features: 2 });
const y1Mid = valid({ run: 3, uptime: 2, capacity: 1, connect: 1, features: 2 });
const y1Strong = valid({ run: 3, uptime: 1, capacity: 1, connect: 2, features: 2 });

assert.equal(S.evaluateYear1(y1Weak).band, 'weak');
assert.equal(S.evaluateYear1(y1Mid).band, 'middle');
assert.equal(S.evaluateYear1(y1Strong).band, 'strong');

assert.equal(S.validateAllocation({ run: 2, uptime: 2, capacity: 2, connect: 2, features: 1 }).ok, false);
assert.equal(S.validateAllocation({ run: 3, uptime: 4, capacity: 0, connect: 1, features: 1 }).ok, false);
assert.equal(S.validateAllocation({ run: 3, uptime: 1, capacity: 1, connect: 1, features: 1 }).ok, false);

const a = valid({ run: 3, uptime: 2, capacity: 1, connect: 2, features: 1 });
const b = valid({ run: 3, uptime: 1, capacity: 1, connect: 2, features: 2 });
const y2 = S.evaluateYear2(a, b);
assert.equal(y2.heat.band, 'strong');
assert.equal(y2.competitor.band, 'strong');

const strong3a = valid({ run: 3, uptime: 0, capacity: 1, connect: 3, features: 2 });
const strong3b = valid({ run: 3, uptime: 0, capacity: 1, connect: 2, features: 3 });
assert.equal(S.evaluateYear3(strong3a, strong3b).band, 'strong');

const pilot3a = valid({ run: 3, uptime: 1, capacity: 1, connect: 2, features: 2 });
const pilot3b = valid({ run: 3, uptime: 1, capacity: 1, connect: 1, features: 3 });
assert.equal(S.evaluateYear3(pilot3a, pilot3b).band, 'pilot');

const weak3a = valid({ run: 3, uptime: 2, capacity: 1, connect: 1, features: 2 });
const weak3b = valid({ run: 3, uptime: 2, capacity: 1, connect: 1, features: 2 });
assert.equal(S.evaluateYear3(weak3a, weak3b).band, 'weak');

const gapA = valid({ run: 3, uptime: 1, capacity: 0, connect: 3, features: 2 });
const gapB = valid({ run: 3, uptime: 1, capacity: 1, connect: 2, features: 2 });
assert.equal(S.evaluateYear3(gapA, gapB).band, 'unresolved_calibration');

// Retuning must keep values between thresholds in the intended middle band.
const raisedYear1 = { ...S.DEFAULT_THRESHOLDS, year1ConnectStrong: 3 };
assert.equal(S.evaluateYear1(y1Strong, raisedYear1).band, 'middle');

const heatA = valid({ run: 3, uptime: 2, capacity: 1, connect: 1, features: 2 });
const heatB = valid({ run: 3, uptime: 1, capacity: 1, connect: 1, features: 3 });
const raisedHeat = { ...S.DEFAULT_THRESHOLDS, heatUptimeStrong: 4, heatUptimeMiddle: 2 };
assert.equal(S.evaluateYear2(heatA, heatB, raisedHeat).heat.band, 'middle');

assert.equal(S.validateThresholds(S.DEFAULT_THRESHOLDS).ok, true);
assert.equal(S.validateThresholds({ ...S.DEFAULT_THRESHOLDS, heatUptimeStrong: 2, heatUptimeMiddle: 2 }).ok, false);
assert.equal(S.validateThresholds({ ...S.DEFAULT_THRESHOLDS, competitorConnectStrong: 5, competitorConnectPilotMax: 3 }).ok, false);
assert.equal(S.validateThresholds({ ...S.DEFAULT_THRESHOLDS, year3ConnectStrong: 6, year3ConnectPilotMax: 4 }).ok, false);

const publicText = JSON.stringify(S.publicConfig());
for (const key of Object.keys(S.DEFAULT_THRESHOLDS)) {
  assert.equal(publicText.includes(key), false, `public config leaked threshold key ${key}`);
}
assert.equal(S.META.id, 'rapid-03-midland');
assert.deepEqual(S.META.replaces, ['rapid-03-bench']);

console.log('RapidSim 03 checks passed.');
