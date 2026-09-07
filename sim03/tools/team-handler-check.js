const assert = require('assert');
const store = require('../lib/store.js');
const handler = require('../api/session.js');

const originalEnv = {
  FACULTY_CODE: process.env.FACULTY_CODE,
  FACULTY_CODES: process.env.FACULTY_CODES,
  LAUNCH_SECRET: process.env.LAUNCH_SECRET
};
const originalStore = {
  configured: store.configured,
  putSession: store.putSession,
  getSession: store.getSession,
  getParticipants: store.getParticipants,
  getRuns: store.getRuns,
  setParticipant: store.setParticipant,
  addParticipant: store.addParticipant,
  setRun: store.setRun
};

const sessions = new Map();
const participants = new Map();
const runs = new Map();
store.configured = () => true;
store.putSession = async (code, value) => { sessions.set(code, { ...value }); return value; };
store.getSession = async code => sessions.get(code) || null;
store.getParticipants = async code => participants.get(code) || {};
store.getRuns = async code => runs.get(code) || {};
store.setParticipant = async (code, pid, value) => {
  const all = participants.get(code) || {};
  all[pid] = { ...value };
  participants.set(code, all);
};
store.addParticipant = store.setParticipant;
store.setRun = async (code, rid, value) => {
  const all = runs.get(code) || {};
  all[rid] = { ...value };
  runs.set(code, all);
};

async function invoke(body, headers = {}) {
  const req = { method: 'POST', headers, body };
  const res = {
    statusCode: 200,
    payload: null,
    status(n) { this.statusCode = n; return this; },
    json(payload) { this.payload = payload; return payload; },
    end() { return null; }
  };
  await handler(req, res);
  return { status: res.statusCode, body: res.payload };
}

const y1 = { run: 3, uptime: 2, capacity: 1, connect: 2, features: 1 };
const y2 = { run: 3, uptime: 1, capacity: 1, connect: 2, features: 2 };

(async () => {
  try {
    process.env.FACULTY_CODE = 'faculty-secret';
    delete process.env.FACULTY_CODES;
    delete process.env.LAUNCH_SECRET;

    let r = await invoke({ action: 'create', name: 'Team regression', mode: 'team', facultyCode: 'faculty-secret' });
    assert.equal(r.status, 200);
    const code = r.body.session.code;

    r = await invoke({ action: 'join', code, name: 'Ann', teamName: 'Alpha', participantId: 'ann' });
    assert.equal(r.status, 200);
    assert.equal(r.body.participantId, 'ann');
    assert.equal(r.body.me.groupId, 'team:alpha');
    assert.equal(r.body.me.isCaptain, true, 'first team member should become captain');

    r = await invoke({ action: 'join', code, name: 'Ben', teamName: 'Alpha', participantId: 'ben' });
    assert.equal(r.status, 200);
    assert.equal(r.body.me.isCaptain, false, 'second team member should not replace captain');

    r = await invoke({ action: 'control', code, set: 'start', facultyCode: 'faculty-secret' });
    assert.equal(r.status, 200);

    r = await invoke({ action: 'join', code, name: 'Cal', teamName: 'Alpha', participantId: 'cal' });
    assert.equal(r.status, 200, 'late joiner should be admitted after start');
    assert.equal(r.body.me.groupId, 'team:alpha');

    r = await invoke({ action: 'join', code, name: 'Ann', teamName: 'Alpha', participantId: 'new-device' });
    assert.equal(r.status, 200, 'returning student should reattach after start');
    assert.equal(r.body.participantId, 'ann', 'same-name return should reuse existing identity');

    r = await invoke({ action: 'submit', code, participantId: 'ben', strategicView: 'Ben should not commit this.' });
    assert.equal(r.status, 403);
    assert.equal(r.body.error, 'captain_only');

    r = await invoke({ action: 'submit', code, participantId: 'ann', strategicView: 'Build a resilient service platform.' });
    assert.equal(r.status, 200);
    r = await invoke({ action: 'submit', code, participantId: 'ann', year1: y1 });
    assert.equal(r.status, 200);
    r = await invoke({ action: 'submit', code, participantId: 'ann', year2: y2 });
    assert.equal(r.status, 200);

    r = await invoke({ action: 'submit', code, participantId: 'ben', reflection1: 'Ben one', reflection2: 'Ben two', done: true });
    assert.equal(r.status, 200, 'non-captain reflections should save');
    let teamRun = (runs.get(code) || {})['team:alpha'];
    assert.equal(teamRun.reflections.ben.reflection1, 'Ben one');
    assert.equal(!!teamRun.finishedBy.ben, true);
    assert.equal(teamRun.done, false, 'one team member finishing must not complete the shared run');

    r = await invoke({ action: 'set_captain', code, participantId: 'ben', facultyCode: 'faculty-secret' });
    assert.equal(r.status, 200, 'captain handoff should work after start');
    let roster = participants.get(code);
    assert.equal(roster.ben.isCaptain, true);
    assert.equal(roster.ann.isCaptain, false);

    r = await invoke({ action: 'group', code, assign: { cal: '__solo__' }, facultyCode: 'faculty-secret' });
    assert.equal(r.status, 200, 'faculty should be able to move a student after start');
    roster = participants.get(code);
    assert.equal(roster.cal.groupId, 'solo:cal');
    assert.equal(roster.ben.isCaptain, true, 'moving a teammate must preserve the existing captain');

    r = await invoke({ action: 'submit', code, participantId: 'ann', reflection1: 'Ann one', reflection2: 'Ann two', done: true });
    assert.equal(r.status, 200, 'former captain can still save personal reflections');
    teamRun = (runs.get(code) || {})['team:alpha'];
    assert.equal(teamRun.reflections.ann.reflection2, 'Ann two');
    assert.equal(teamRun.done, true, 'shared team run completes only after all current team members finish');

    r = await invoke({ action: 'state', code, participantId: 'ben' });
    assert.equal(r.status, 200);
    assert.equal(r.body.run.reflection1, 'Ben one', 'each member should receive their own reflection on resume');
    assert.equal(r.body.run.done, true);

    console.log('RapidSim 03 team handler regression checks passed.');
  } finally {
    for (const [k, v] of Object.entries(originalEnv)) {
      if (v === undefined) delete process.env[k]; else process.env[k] = v;
    }
    Object.assign(store, originalStore);
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
