const assert = require('assert');
const store = require('../lib/store.js');
const handler = require('../api/session.js');

const originalEnv = { FACULTY_CODE: process.env.FACULTY_CODE, FACULTY_CODES: process.env.FACULTY_CODES, LAUNCH_SECRET: process.env.LAUNCH_SECRET };
const originalStore = { configured: store.configured, putSession: store.putSession, getSession: store.getSession, getParticipants: store.getParticipants, getRuns: store.getRuns, setParticipant: store.setParticipant, addParticipant: store.addParticipant, setRun: store.setRun };
const sessions = new Map(), participants = new Map(), runs = new Map();
store.configured = () => true;
store.putSession = async (code, value) => { sessions.set(code, { ...value }); return value; };
store.getSession = async code => sessions.get(code) || null;
store.getParticipants = async code => participants.get(code) || {};
store.getRuns = async code => runs.get(code) || {};
store.setParticipant = async (code, pid, value) => { const all = participants.get(code) || {}; all[pid] = { ...value }; participants.set(code, all); };
store.addParticipant = store.setParticipant;
store.setRun = async (code, rid, value) => { const all = runs.get(code) || {}; all[rid] = { ...value }; runs.set(code, all); };
async function invoke(body, headers = {}) { const req = { method: 'POST', headers, body }; const res = { statusCode: 200, payload: null, status(n) { this.statusCode = n; return this; }, json(payload) { this.payload = payload; return payload; }, end() { return null; } }; await handler(req, res); return { status: res.statusCode, body: res.payload }; }
const y1 = { run: 3, uptime: 2, capacity: 1, connect: 2, features: 1 };
const y2 = { run: 3, uptime: 1, capacity: 1, connect: 2, features: 2 };

(async () => {
  try {
    process.env.FACULTY_CODE = 'faculty-secret'; delete process.env.FACULTY_CODES; delete process.env.LAUNCH_SECRET;
    let r = await invoke({ action: 'create', name: 'Team regression', mode: 'team', facultyCode: 'faculty-secret' });
    assert.equal(r.status, 200); const code = r.body.session.code;

    r = await invoke({ action: 'join', code, name: 'Ann', participantId: 'ann' });
    assert.equal(r.status, 200); assert.equal(r.body.me.groupId, null); assert.equal(r.body.me.isCaptain, false);
    r = await invoke({ action: 'join', code, name: 'Ben', participantId: 'ben' });
    assert.equal(r.status, 200); assert.equal(r.body.me.groupId, null);

    r = await invoke({ action: 'control', code, set: 'start', facultyCode: 'faculty-secret' });
    assert.equal(r.status, 409); assert.equal(r.body.error, 'unassigned_participants'); assert.equal(r.body.count, 2);

    r = await invoke({ action: 'group', code, assign: { ann: 'Alpha', ben: 'Alpha' }, facultyCode: 'faculty-secret' });
    assert.equal(r.status, 200); let roster = participants.get(code);
    assert.equal(roster.ann.groupId, 'team:alpha'); assert.equal(roster.ann.isCaptain, true); assert.equal(roster.ben.isCaptain, false);

    r = await invoke({ action: 'rename_team', code, groupId: 'team:alpha', teamLabel: 'Architecture A', facultyCode: 'faculty-secret' });
    assert.equal(r.status, 200); roster = participants.get(code); assert.equal(roster.ann.groupId, 'team:alpha'); assert.equal(roster.ann.teamLabel, 'Architecture A'); assert.equal(roster.ben.teamLabel, 'Architecture A');

    r = await invoke({ action: 'set_captain', code, participantId: 'ben', facultyCode: 'faculty-secret' });
    assert.equal(r.status, 200); roster = participants.get(code); assert.equal(roster.ben.isCaptain, true); assert.equal(roster.ann.isCaptain, false);

    r = await invoke({ action: 'control', code, set: 'start', facultyCode: 'faculty-secret' });
    assert.equal(r.status, 200);

    r = await invoke({ action: 'join', code, name: 'Cal', participantId: 'cal' });
    assert.equal(r.status, 200, 'late joiner should be admitted after start'); assert.equal(r.body.me.groupId, null, 'late joiner stays unassigned until faculty places them');
    r = await invoke({ action: 'group', code, assign: { cal: 'team:alpha' }, facultyCode: 'faculty-secret' });
    assert.equal(r.status, 200); roster = participants.get(code); assert.equal(roster.cal.groupId, 'team:alpha'); assert.equal(roster.ben.isCaptain, true, 'adding a member must preserve the selected lead');

    r = await invoke({ action: 'join', code, name: 'Ann', participantId: 'new-device' });
    assert.equal(r.status, 200); assert.equal(r.body.participantId, 'ann', 'same-name return should reuse existing identity'); assert.equal(r.body.me.groupId, 'team:alpha');

    r = await invoke({ action: 'submit', code, participantId: 'ann', strategicView: 'Ann should not commit this.' });
    assert.equal(r.status, 403); assert.equal(r.body.error, 'captain_only');
    r = await invoke({ action: 'submit', code, participantId: 'ben', strategicView: 'Build a resilient service platform.' }); assert.equal(r.status, 200);
    r = await invoke({ action: 'submit', code, participantId: 'ben', year1: y1 }); assert.equal(r.status, 200);
    r = await invoke({ action: 'submit', code, participantId: 'ben', year2: y2 }); assert.equal(r.status, 200);

    r = await invoke({ action: 'submit', code, participantId: 'ann', reflection1: 'Ann one', reflection2: 'Ann two', done: true }); assert.equal(r.status, 200);
    let teamRun = (runs.get(code) || {})['team:alpha']; assert.equal(teamRun.done, false);
    r = await invoke({ action: 'group', code, assign: { cal: '__unassigned__' }, facultyCode: 'faculty-secret' }); assert.equal(r.status, 200); roster = participants.get(code); assert.equal(roster.cal.groupId, null); assert.equal(roster.ben.isCaptain, true);
    r = await invoke({ action: 'submit', code, participantId: 'ben', reflection1: 'Ben one', reflection2: 'Ben two', done: true }); assert.equal(r.status, 200);
    teamRun = (runs.get(code) || {})['team:alpha']; assert.equal(teamRun.done, true, 'shared run completes when every current assigned member is finished');

    r = await invoke({ action: 'state', code, participantId: 'ann' }); assert.equal(r.status, 200); assert.equal(r.body.run.reflection1, 'Ann one'); assert.equal(r.body.run.done, true);
    console.log('RapidSim 03 instructor-managed team handler regression checks passed.');
  } finally {
    for (const [k, v] of Object.entries(originalEnv)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
    Object.assign(store, originalStore);
  }
})().catch((e) => { console.error(e); process.exit(1); });
