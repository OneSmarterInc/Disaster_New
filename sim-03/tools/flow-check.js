#!/usr/bin/env node
// The whole journey a student actually takes, end to end, with the platform's
// real signing code and the sim's real handlers.
//
// This exists because every check we had passed while the flow was broken. The
// engine was fine, the API was fine, the protocol was fine — and a student
// could still play all eight days and have faculty see "started, never
// finished" forever, because the launch token expired on day seven and the
// completion had nothing to report with.
//
// The thing that catches that is playing the whole run with the clock moving.

'use strict';

const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
process.env.LAUNCH_SECRET = 'shared-test-secret';
process.env.PLATFORM_URL = 'https://platform.invalid';
process.env.SIM_URL = 'https://platform.invalid/sim03';

// ---------------------------------------------------------------------------
// Stubs: storage in memory, and a fake platform that records what it receives.
// ---------------------------------------------------------------------------
const mem = {};
const storePath = path.join(ROOT, 'sim-03', 'lib', 'store.js');
require.cache[storePath] = {
  id: storePath, filename: storePath, loaded: true,
  exports: {
    configured: () => true,
    getRaw: async (k) => (mem[k] === undefined ? null : JSON.parse(mem[k])),
    putRaw: async (k, v) => { mem[k] = JSON.stringify(v); return v; }
  }
};

const received = [];
global.fetch = async (url, opts) => {
  received.push({ url: String(url), body: JSON.parse(opts.body) });
  return { ok: true, status: 200, json: async () => ({ ok: true }), text: async () => '' };
};

const platformLaunch = require(path.join(ROOT, 'platform', 'lib', 'launch.js'));
const run = require(path.join(ROOT, 'sim-03', 'api', 'run.js'));

let bad = 0;
const ok = (c, m) => { console.log((c ? '  ok   ' : '  FAIL ') + m); if (!c) bad++; };

function call(body, headers) {
  return new Promise((resolve) => {
    const req = { method: 'POST', headers: headers || {}, body };
    const res = {
      _s: 200,
      status(c) { this._s = c; return this; },
      json(p) { resolve({ status: this._s, body: p }); },
      end() { resolve({ status: this._s, body: null }); }
    };
    run(req, res);
  });
}

(async () => {
  console.log('\nstudent journey, end to end\n');

  // 1. The platform signs a launch, the way /api/launch does.
  const token = platformLaunch.launchToken({
    userId: 'usr_student', name: 'Akshay student', role: 'student',
    simId: 'rapid-03-bench', courseId: 'crs_test', mode: 'play'
  });
  ok(!!token, 'the platform signs a launch');

  const lifetimeMin = Math.round((JSON.parse(
    Buffer.from(token.split('.')[0], 'base64url').toString()).exp - Date.now()) / 60000);
  const playMin = require(path.join(ROOT, 'sim-03', 'lib', 'scenario.js')).PROCESS.rounds * 90 / 60;
  ok(lifetimeMin > playMin,
     `the token (${lifetimeMin} min) outlives the sim (${playMin} min)`);

  // 2. The student arrives with it and starts.
  const hdr = { 'x-launch-token': token };
  const started = await call({ action: 'start' }, hdr);
  ok(started.status === 200, 'the run starts for a launched student');
  const runId = started.body.runId;

  // 3. Play all eight days. Partway through, drop the token entirely — this is
  //    what expiry looks like from the server's side, and it is the exact
  //    condition that broke the completion.
  let view = started.body.view, finished = false, day = 0;
  while (!finished && day < 20) {
    day++;
    const headers = day <= 3 ? hdr : {};   // token gone from day 4 on
    const r = await call({ action: 'act', runId, choice: view.availableActions[0].id }, headers);
    if (r.status !== 200) { ok(false, `day ${day} refused: ${JSON.stringify(r.body)}`); break; }
    view = r.body.view;
    finished = r.body.finished;
  }
  ok(finished, 'the student reaches the end');
  ok(day === 8, `all eight days played (was ${day})`);

  // 4. The debrief, with no valid token — the realistic case.
  const deb = await call({ action: 'debrief', runId }, {});
  ok(deb.status === 200, 'the debrief is served without a live token');
  ok(!!deb.body.debrief.title, 'the debrief has an ending');

  // 5. Did the platform hear about it?
  await new Promise(r => setTimeout(r, 30));
  const completions = received.filter(x => x.url.includes('/api/complete'));
  ok(completions.length === 1, `exactly one completion reported (was ${completions.length})`);

  if (completions.length) {
    const payload = platformLaunch.verify(completions[0].body.token);
    ok(!!payload, 'the platform verifies the completion signature');
    ok(payload.sub === 'usr_student', 'it names the student');
    ok(payload.sim === 'rapid-03-bench', 'it names the sim');
    ok(payload.course === 'crs_test',
       'it names the course — without this it never reaches a faculty roster');
    ok(typeof payload.summary === 'string' && payload.summary.length > 0,
       'it carries a summary faculty can read');
    ok(payload.metrics && payload.metrics.verdict,
       'it carries which of the endings the student got');
  }

  // 6. A run played with no launch at all must not report anything.
  received.length = 0;
  const solo = await call({ action: 'start' }, {});
  let v2 = solo.body.view, done2 = false, n = 0;
  while (!done2 && n++ < 20) {
    const r = await call({ action: 'act', runId: solo.body.runId, choice: v2.availableActions[0].id }, {});
    v2 = r.body.view; done2 = r.body.finished;
  }
  await call({ action: 'debrief', runId: solo.body.runId }, {});
  await new Promise(r => setTimeout(r, 30));
  ok(received.filter(x => x.url.includes('/api/complete')).length === 0,
     'a standalone run reports nothing to the platform');

  console.log(bad ? `\n${bad} failed\n` : '\nthe whole journey works\n');
  process.exit(bad ? 1 : 0);
})().catch(e => { console.error('flow check threw:', e); process.exit(1); });
