#!/usr/bin/env node
// Boots the real API handlers against an in-memory store and plays a whole run
// through them. This is the check that catches what the engine tests cannot:
// a route that references a field the engine renamed, a response shape the
// client does not expect, or a debrief that throws on a run nobody looked at.
//
// No network, no Redis, no Vercel. Run it before every handoff.

'use strict';

const path = require('path');
const Module = require('module');

// ---------------------------------------------------------------------------
// Stub the store before anything requires it. An object, not Redis.
// ---------------------------------------------------------------------------
const mem = {};
const stubStore = {
  configured: () => true,
  getRaw: async (k) => (mem[k] === undefined ? null : JSON.parse(mem[k])),
  putRaw: async (k, v) => { mem[k] = JSON.stringify(v); return v; }
};

const storePath = path.join(__dirname, '..', 'lib', 'store.js');
const realResolve = Module._resolveFilename;
require.cache[storePath] = { id: storePath, filename: storePath, loaded: true, exports: stubStore };

// The access guard announces itself to the platform on first request. There is
// no platform here, so make sure that path is inert rather than slow.
process.env.LAUNCH_SECRET = '';
process.env.ACCESS_CODE = '';
process.env.PLATFORM_URL = '';

const run = require('../api/run.js');
const health = require('../api/health.js');

// ---------------------------------------------------------------------------
// Minimal req/res doubles
// ---------------------------------------------------------------------------
function call(handler, body) {
  return new Promise((resolve) => {
    const req = { method: 'POST', headers: {}, body };
    const res = {
      _status: 200,
      status(c) { this._status = c; return this; },
      json(payload) { resolve({ status: this._status, body: payload }); },
      end() { resolve({ status: this._status, body: null }); }
    };
    handler(req, res);
  });
}

let failed = 0;
const ok = (cond, msg) => {
  if (cond) { console.log(`  ok   ${msg}`); }
  else { failed++; console.error(`  FAIL ${msg}`); }
};

(async () => {
  console.log('\nboot check\n');

  const h = await call(health, {});
  ok(h.body && h.body.sim, 'health responds with a sim id');

  // The catalogue reads this endpoint. It was never exercised until a
  // deployment showed nothing on the home page.
  const meta = require('../api/meta.js');
  const m = await call(meta, {});
  ok(m.status === 200 && m.body.meta && m.body.meta.id, 'meta returns a catalogue entry');
  ok(m.body.meta.title && m.body.meta.minutes && m.body.meta.detail,
     'the catalogue entry has what the platform renders');
  // Naming Dev here is correct — the catalogue is faculty-facing and the
  // opening brief names him too. What it must not carry is the mechanism.
  const cat = JSON.stringify(m.body).toLowerCase();
  ok(cat.includes('okonjo'), 'the catalogue names who is at stake');
  ok(!['symptom code', 'wrong part', 'first-time-fix', 'bench-test'].some(s => cat.includes(s)),
     'catalogue copy does not give away the mechanism');

  const brief = await call(run, { action: 'brief' });
  ok(brief.status === 200 && brief.body.brief.lines.length > 0, 'brief returns opening copy');
  ok(!JSON.stringify(brief.body).toLowerCase().includes('strain'),
     'brief does not mention hidden state');

  const started = await call(run, { action: 'start' });
  ok(started.status === 200 && started.body.runId, 'start creates a run');
  const runId = started.body.runId;
  const first = started.body.view;
  ok(Array.isArray(first.availableActions) && first.availableActions.length >= 3,
     'the first day offers a choice');
  ok(first.availableActions.every(a => a.label && typeof a.localCost === 'number'),
     'every option carries a label and a price');

  // Play the greedy path all the way through, using only what the client sees.
  let view = first, guard = 0, finished = false, sawReading = false;
  while (!finished && guard++ < 30) {
    const pick = view.availableActions[0].id;      // token, not an id
    const r = await call(run, { action: 'act', runId, choice: pick });
    if (r.status !== 200) { ok(false, `act failed on day ${guard}: ${JSON.stringify(r.body)}`); break; }
    view = r.body.view;
    if (r.body.reading) sawReading = true;
    finished = r.body.finished;
  }
  ok(finished, 'the run reaches an end');
  ok(guard === 8, `the run is eight days long (was ${guard})`);
  ok(!sawReading, 'the greedy path is never shown anything downstream');

  // On a live run, not the finished one — a finished run rejects everything
  // with 'run over' and would pass this check for the wrong reason.
  const probe = await call(run, { action: 'start' });
  const bad = await call(run, { action: 'act', runId: probe.body.runId, choice: 'made-up-token' });
  ok(bad.status === 400 && bad.body.error === 'illegal_action',
     'a fabricated token is rejected on a live run');
  const overRun = await call(run, { action: 'act', runId, choice: 'anything' });
  ok(overRun.status === 409, 'acting on a finished run is refused');

  const d = await call(run, { action: 'debrief', runId });
  ok(d.status === 200 && d.body.debrief.title, 'debrief assembles');
  ok(d.body.debrief.outcome && d.body.debrief.outcome.person,
     'the greedy run names who it cost');
  ok(d.body.debrief.timeline.length === 8, 'the timeline covers every day');

  // A run that only bench-tests should finish clean, which proves the sim is
  // not simply unwinnable.
  const s2 = await call(run, { action: 'start' });
  const id2 = s2.body.runId;
  let v2 = s2.body.view, done2 = false, n = 0;
  while (!done2 && n++ < 30) {
    const careful = v2.availableActions[1].id;
    const r = await call(run, { action: 'act', runId: id2, choice: careful });
    v2 = r.body.view; done2 = r.body.finished;
  }
  const d2 = await call(run, { action: 'debrief', runId: id2 });
  ok(!d2.body.debrief.outcome, 'the careful path harms nobody');
  ok(d2.body.debrief.localScore < d.body.debrief.localScore,
     'and it costs the participant on the only score they are shown');

  // Resume, because faculty run these across a break.
  const again = await call(run, { action: 'resume', runId });
  ok(again.status === 200 && again.body.finished, 'a finished run resumes as finished');

  const missing = await call(run, { action: 'resume', runId: 'nope' });
  ok(missing.status === 404, 'an unknown run is a clean 404');

  // ---------------------------------------------------------------------------
  // Deployability. The first deploy failed because .vercelignore stripped src/
  // and then Vercel ran the build script that reads it. Nothing in the engine
  // or scenario tests could have caught that.
  // ---------------------------------------------------------------------------
  const fs = require('fs');
  const ignore = fs.readFileSync(path.join(__dirname, '..', '.vercelignore'), 'utf8')
    .split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'));

  const buildNeeds = ['/src/', '/lib/', '/public/', '/build.js', '/package.json'];
  for (const need of buildNeeds) {
    ok(!ignore.some(l => need.startsWith(l.replace(/\/$/, '') + '/') || l === need),
       `.vercelignore keeps ${need}`);
  }
  ok(ignore.every(l => l.startsWith('/')),
     '.vercelignore patterns are anchored (a bare rule also strips platform/tools)');

  const pkg = require('../package.json');
  ok(!pkg.scripts.build || fs.existsSync(path.join(__dirname, '..', 'src', 'shell.html')),
     'the build script has the sources it reads');

  console.log(failed ? `\n${failed} failed\n` : '\nall clear\n');
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error('boot check threw:', e); process.exit(1); });
