const { body } = require('../lib/guard.js');
const store = require('../lib/store.js');
const { verifyLaunch } = require('../lib/launch.js');
const S = require('../lib/scenario.js');

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const newCode = () => Array.from({ length: 5 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');
const newId = () => Math.random().toString(36).slice(2, 10);

function facultyRoster() {
  const raw = process.env.FACULTY_CODES || '';
  const out = [];
  raw.split(',').map(s => s.trim()).filter(Boolean).forEach(entry => {
    const i = entry.lastIndexOf(':');
    if (i > 0) out.push({ name: entry.slice(0, i).trim(), code: entry.slice(i + 1).trim() });
  });
  if (process.env.FACULTY_CODE) out.push({ name: 'Facilitator', code: process.env.FACULTY_CODE });
  return out;
}

function whoIsFaculty(req, b) {
  const lt = req.headers['x-launch-token'] || (b && b.launchToken);
  if (lt) {
    const p = verifyLaunch(String(lt));
    if (p && p.sim === S.META.id && (p.role === 'faculty' || p.role === 'faculty_preview')) {
      return { name: p.name || 'Facilitator' };
    }
  }

  // Fail closed. An empty standalone faculty roster is not authorization.
  // Platform-launched faculty use the signed launch token above; direct
  // standalone faculty access requires an explicitly configured code.
  const roster = facultyRoster();
  if (!roster.length) return null;
  const given = String((b && b.facultyCode) || req.headers['x-faculty-code'] || '').trim();
  if (!given) return null;
  const hit = roster.find(r => r.code === given);
  return hit ? { name: hit.name } : null;
}

function ownsSession(who, sess) {
  return !!who && (!sess.owner || sess.owner === who.name);
}

function publicSession(sess) {
  return {
    code: sess.code,
    name: sess.name,
    mode: sess.mode,
    state: sess.state,
    paused: !!sess.paused,
    createdAt: sess.createdAt,
    startedAt: sess.startedAt || null
  };
}

function captainMap(participants, explicit) {
  const groups = {};
  Object.values(participants).filter(Boolean).forEach(p => {
    if (!p.groupId) return;
    (groups[p.groupId] ||= []).push(p);
  });
  const result = {};
  for (const [gid, members] of Object.entries(groups)) {
    const requested = explicit && explicit[gid];
    const chosen = requested && members.find(m => m.id === requested)
      ? requested
      : members.sort((a, b) => (a.joinedAt || 0) - (b.joinedAt || 0))[0].id;
    result[gid] = chosen;
  }
  return result;
}

function runIdFor(sess, participant) {
  if (!participant) return null;
  return sess.mode === 'individual' ? `individual:${participant.id}` : participant.groupId;
}

function publicRun(run) {
  if (!run) return null;
  return {
    runId: run.runId,
    phase: run.phase || 0,
    year1: run.year1 || null,
    year2: run.year2 || null,
    strategicView: run.strategicView || '',
    reflection1: run.reflection1 || '',
    reflection2: run.reflection2 || '',
    outcomes: run.outcomes || null,
    done: !!run.done,
    updatedAt: run.updatedAt || null
  };
}

module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  if (!store.configured()) {
    return res.status(503).json({
      error: 'no_store',
      message: 'Session storage is not configured for this deployment.'
    });
  }

  const b = body(req);
  const action = String(b.action || '');
  const code = String(b.code || '').toUpperCase().trim();

  try {
    switch (action) {
      case 'create': {
        const who = whoIsFaculty(req, b);
        if (!who) return res.status(401).json({ error: 'faculty_authorization_required' });
        const mode = String(b.mode || '');
        if (!['individual', 'team'].includes(mode)) {
          return res.status(400).json({ error: 'play_mode_required' });
        }
        const thresholdCheck = S.validateThresholds(b.thresholds);
        if (!thresholdCheck.ok) return res.status(400).json(thresholdCheck);
        const c = newCode();
        const sess = {
          code: c,
          owner: who.name,
          name: String(b.name || 'Midland Equipment').slice(0, 80),
          mode,
          state: 'lobby',
          paused: false,
          thresholds: thresholdCheck.thresholds,
          createdAt: Date.now()
        };
        await store.putSession(c, sess);
        return res.status(200).json({ session: sess, you: who.name });
      }

      case 'faculty_state': {
        const who = whoIsFaculty(req, b);
        if (!who) return res.status(401).json({ error: 'faculty_authorization_required' });
        const sess = await store.getSession(code);
        if (!sess) return res.status(404).json({ error: 'no_such_session' });
        if (!ownsSession(who, sess)) {
          return res.status(403).json({ error: 'not_your_session', message: `That session belongs to ${sess.owner}.` });
        }
        const [participants, runs] = await Promise.all([
          store.getParticipants(code),
          store.getRuns(code)
        ]);
        return res.status(200).json({
          session: sess,
          participants,
          runs,
          you: who.name,
          defaultThresholds: S.DEFAULT_THRESHOLDS
        });
      }

      case 'calibrate': {
        const who = whoIsFaculty(req, b);
        if (!who) return res.status(401).json({ error: 'faculty_authorization_required' });
        const sess = await store.getSession(code);
        if (!sess) return res.status(404).json({ error: 'no_such_session' });
        if (!ownsSession(who, sess)) return res.status(403).json({ error: 'not_your_session' });
        if (sess.state !== 'lobby') {
          return res.status(409).json({ error: 'session_already_started', message: 'Calibration is locked once the session starts.' });
        }
        const thresholdCheck = S.validateThresholds(b.thresholds);
        if (!thresholdCheck.ok) return res.status(400).json(thresholdCheck);
        sess.thresholds = thresholdCheck.thresholds;
        await store.putSession(code, sess);
        return res.status(200).json({ session: sess });
      }

      case 'group': {
        const who = whoIsFaculty(req, b);
        if (!who) return res.status(401).json({ error: 'faculty_authorization_required' });
        const sess = await store.getSession(code);
        if (!sess) return res.status(404).json({ error: 'no_such_session' });
        if (!ownsSession(who, sess)) return res.status(403).json({ error: 'not_your_session' });
        if (sess.mode !== 'team') return res.status(409).json({ error: 'not_team_mode' });
        if (sess.state !== 'lobby') {
          return res.status(409).json({ error: 'session_already_started', message: 'Team assignments lock when the session starts.' });
        }

        const participants = await store.getParticipants(code);
        const rawAssign = b.assign && typeof b.assign === 'object' ? b.assign : {};
        for (const p of Object.values(participants)) {
          if (!p || !Object.prototype.hasOwnProperty.call(rawAssign, p.id)) continue;
          const gid = String(rawAssign[p.id] || '').trim().slice(0, 40);
          p.groupId = gid || null;
        }
        const caps = captainMap(participants, b.captains || {});
        for (const p of Object.values(participants)) {
          if (!p) continue;
          p.isCaptain = !!(p.groupId && caps[p.groupId] === p.id);
          await store.setParticipant(code, p.id, p);
        }
        return res.status(200).json({ ok: true, captains: caps });
      }

      case 'control': {
        const who = whoIsFaculty(req, b);
        if (!who) return res.status(401).json({ error: 'faculty_authorization_required' });
        const sess = await store.getSession(code);
        if (!sess) return res.status(404).json({ error: 'no_such_session' });
        if (!ownsSession(who, sess)) return res.status(403).json({ error: 'not_your_session' });

        if (b.set === 'start') {
          if (sess.mode === 'team') {
            const participants = await store.getParticipants(code);
            const unassigned = Object.values(participants).filter(p => p && !p.groupId);
            if (unassigned.length) {
              return res.status(409).json({
                error: 'unassigned_participants',
                count: unassigned.length,
                message: 'Every participant must be assigned to a team before starting.'
              });
            }
          }
          sess.state = 'running';
          sess.startedAt = Date.now();
        }
        if (b.set === 'pause') sess.paused = true;
        if (b.set === 'resume') sess.paused = false;
        if (b.set === 'close') sess.state = 'closed';
        await store.putSession(code, sess);
        return res.status(200).json({ session: sess });
      }

      case 'join': {
        const sess = await store.getSession(code);
        if (!sess) return res.status(404).json({ error: 'no_such_session' });
        if (sess.state === 'closed') return res.status(410).json({ error: 'session_closed' });

        const name = String(b.name || '').slice(0, 60).trim();
        if (!name) return res.status(400).json({ error: 'name_required' });
        const id = String(b.participantId || '') || newId();
        const all = await store.getParticipants(code);
        const existing = all[id];
        if (sess.mode === 'team' && sess.state !== 'lobby' && !existing) {
          return res.status(409).json({
            error: 'team_session_already_started',
            message: 'Team assignments are locked because this session has already started.'
          });
        }
        const participant = {
          id,
          name,
          groupId: existing ? existing.groupId : (sess.mode === 'individual' ? `individual:${id}` : null),
          isCaptain: existing ? !!existing.isCaptain : sess.mode === 'individual',
          joinedAt: existing ? existing.joinedAt : Date.now()
        };
        await store.addParticipant(code, id, participant);
        return res.status(200).json({ participantId: id, session: publicSession(sess), me: participant });
      }

      case 'state': {
        const sess = await store.getSession(code);
        if (!sess) return res.status(404).json({ error: 'no_such_session' });
        const pid = String(b.participantId || '');
        const participants = await store.getParticipants(code);
        const me = participants[pid] || null;
        if (!me) return res.status(403).json({ error: 'not_joined' });

        let mates = [];
        if (me.groupId) {
          mates = Object.values(participants)
            .filter(p => p && p.groupId === me.groupId)
            .map(p => ({ id: p.id, name: p.name, isCaptain: !!p.isCaptain }));
        }
        const runs = await store.getRuns(code);
        const rid = runIdFor(sess, me);
        return res.status(200).json({
          session: publicSession(sess),
          me,
          mates,
          canSubmit: sess.mode === 'individual' || !!me.isCaptain,
          run: publicRun(rid ? runs[rid] : null)
        });
      }

      case 'submit': {
        const sess = await store.getSession(code);
        if (!sess) return res.status(404).json({ error: 'no_such_session' });
        if (sess.state !== 'running') return res.status(409).json({ error: 'session_not_running' });
        if (sess.paused) return res.status(409).json({ error: 'session_paused' });

        const pid = String(b.participantId || '');
        const participants = await store.getParticipants(code);
        const me = participants[pid];
        if (!me) return res.status(403).json({ error: 'not_joined' });
        if (sess.mode === 'team' && !me.groupId) return res.status(409).json({ error: 'team_not_assigned' });
        if (sess.mode === 'team' && !me.isCaptain) return res.status(403).json({ error: 'captain_only' });

        const rid = runIdFor(sess, me);
        const runs = await store.getRuns(code);
        const current = runs[rid] || { runId: rid, phase: 0, done: false, createdAt: Date.now() };

        const next = { ...current };
        if (b.strategicView !== undefined) next.strategicView = String(b.strategicView || '').slice(0, 500);
        if (b.year1 !== undefined) {
          const v = S.validateAllocation(b.year1);
          if (!v.ok) return res.status(400).json(v);
          next.year1 = v.allocation;
          next.phase = Math.max(next.phase || 0, 1);
        }
        if (b.year2 !== undefined) {
          const v = S.validateAllocation(b.year2);
          if (!v.ok) return res.status(400).json(v);
          next.year2 = v.allocation;
          next.phase = Math.max(next.phase || 0, 2);
        }
        if (b.reflection1 !== undefined) next.reflection1 = String(b.reflection1 || '').slice(0, 1500);
        if (b.reflection2 !== undefined) next.reflection2 = String(b.reflection2 || '').slice(0, 1500);

        if (next.year1 && next.year2) {
          next.outcomes = S.evaluateAll(next.year1, next.year2, sess.thresholds);
        }
        if (b.done) {
          if (!next.year1 || !next.year2) return res.status(409).json({ error: 'allocations_incomplete' });
          next.done = true;
          next.phase = 3;
          next.completedAt = Date.now();
        }
        next.updatedAt = Date.now();
        await store.setRun(code, rid, next);
        return res.status(200).json({ ok: true, run: publicRun(next) });
      }

      default:
        return res.status(400).json({ error: 'unknown_action' });
    }
  } catch (e) {
    if (e.code === 'NO_STORE') return res.status(503).json({ error: 'no_store', message: e.message });
    console.error('session failure', action, e.message);
    return res.status(500).json({ error: 'server_error' });
  }
};
