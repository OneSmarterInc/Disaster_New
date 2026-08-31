'use strict';

const assert = require('assert');
process.env.ACCESS_CODE = '';
process.env.KV_REST_API_URL = 'memory://test';
process.env.KV_REST_API_TOKEN = 'test';

const store = require('../lib/store');
const memory = new Map();
store.configured = () => true;
store.getRaw = async (key) => memory.get(key) || null;
store.putRaw = async (key, value) => { memory.set(key, value); return value; };
const run = require('../api/run');
const { classify } = require('../src/classifier');

async function call(action, extra = {}, launch = null) {
  const req = { method: 'POST', headers: {}, body: { action, ...extra } };
  if (launch) req.launch = launch;
  let status = 200, payload;
  const res = { status(n) { status = n; return this; }, json(v) { payload = v; return this; }, end() { return this; } };
  await run(req, res);
  return { status, payload };
}

(async () => {
  let r = await call('brief');
  assert.equal(r.status, 200);
  assert.equal(r.payload.orderings.length, 2);
  assert.equal(r.payload.sources.terry.suggestions.length, 7);
  assert.match(r.payload.sources.terry.suggestions[0], /receipt log/i);
  for (const source of Object.values(r.payload.sources)) {
    for (const question of source.suggestions) {
      assert.notEqual(classify(question).bucket, 'UNMATCHED', `unmatched suggestion: ${question}`);
    }
  }

  const launch = { sub: 'participant-1', name: 'Split Session Tester', course: 'course-1', role: 'student' };
  r = await call('start', { order: ['terry', 'ray', 'ruth'], observationSeconds: 30 }, launch);
  assert.equal(r.status, 200);
  const runId = r.payload.runId;
  assert.equal(r.payload.state.source.id, 'terry');
  assert.equal(r.payload.state.observationSeconds, 30);

  // Simulate Thursday on another browser/device: no runId is supplied.
  r = await call('resume', {}, launch);
  assert.equal(r.status, 200);
  assert.equal(r.payload.runId, runId);
  assert.equal(r.payload.state.observationSeconds, 30);
  assert.equal(r.payload.state.source.id, 'terry');

  r = await call('ask', { runId, question: 'Why does the log exist?' });
  assert.equal(r.status, 200);
  assert.match(r.payload.answer, /ten years/i);
  assert.equal(r.payload.state.remaining, 810);

  await call('advance', { runId });
  await call('advance', { runId });
  r = await call('advance', { runId });
  assert.equal(r.payload.state.finishedInterviews, true);
  assert.equal(r.payload.state.observationSeconds, 30);

  const rows = {};
  for (const row of ['intake', 'log', 'vendor', 'review']) rows[row] = { disposition: row === 'vendor' ? 'cannot_assess' : 'keep', justification: 'This is supported by interview evidence.' };
  r = await call('submit', { runId, submission: { rootCause: 'The process creates repeat submissions through delayed feedback.', rows } });
  assert.equal(r.status, 200);
  assert.equal(r.payload.review.ok, true);

  r = await call('resume', { runId });
  assert.equal(r.payload.submitted, true);
  console.log('api integration: passed');
})().catch((e) => { console.error(e); process.exit(1); });
