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
    finishedBy: run.finishedBy || {},
    updatedAt: run.updatedAt || null
  };
}

function sameAllocation(a, b) {
  return !!a && !!b && S.LINES.every(k => Number(a[k]) === Number(b[k]));
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

        const participants = await store.getParticipants(code);
        const previousCaptains = {};
        for (const p of Object.values(participants)) if (p && p.groupId && p.isCaptain) previousCaptains[p.groupId] = p.id;
        const rawAssign = b.assign && typeof b.assign === 'object' ? b.assign : {};
        for (const p of Object.values(participants)) {
          if (!p || !Object.prototype.hasOwnProperty.call(rawAssign, p.id)) continue;
          const label = String(rawAssign[p.id] || '').trim().slice(0, 40);
          if (label === '__unassigned__' || !label) {
            p.groupId = null;
            p.teamLabel = '';
            p.isCaptain = false;
          } else if (label.startsWith('team:')) {
            const target = Object.values(participants).find(x => x && x.groupId === label);
            if (!target) return res.status(404).json({ error: 'no_such_team' });
            p.groupId = label;
            p.teamLabel = target.teamLabel || label.slice(5);
          } else if (label === '__solo__') {
            p.groupId = `solo:${p.id}`;
            p.teamLabel = p.name;
          } else {
            const norm = label.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9_-]/g, '');
            if (!norm) return res.status(400).json({ error: 'team_name_required' });
            p.groupId = `team:${norm}`;
            p.teamLabel = label;
          }
        }
        const caps = captainMap(participants, { ...previousCaptains, ...(b.captains || {}) });
        for (const p of Object.values(participants)) {
          if (!p) continue;
          p.isCaptain = !!(p.groupId && caps[p.groupId] === p.id);
          await store.setParticipant(code, p.id, p);
        }
        return res.status(200).json({ ok: true, captains: caps });
      }

      case 'rename_team': {
        const who = whoIsFaculty(req, b);
        if (!who) return res.status(401).json({ error: 'faculty_authorization_required' });
        const sess = await store.getSession(code);
        if (!sess) return res.status(404).json({ error: 'no_such_session' });
        if (!ownsSession(who, sess)) return res.status(403).json({ error: 'not_your_session' });
        if (sess.mode !== 'team') return res.status(409).json({ error: 'not_team_mode' });
        const groupId = String(b.groupId || '').trim();
        const teamLabel = String(b.teamLabel || '').trim().slice(0, 40);
        if (!groupId || !teamLabel) return res.status(400).json({ error: 'team_name_required' });
        const participants = await store.getParticipants(code);
        const members = Object.values(participants).filter(p => p && p.groupId === groupId);
        if (!members.length) return res.status(404).json({ error: 'no_such_team' });
        for (const p of members) {
          p.teamLabel = teamLabel;
          await store.setParticipant(code, p.id, p);
        }
        return res.status(200).json({ ok: true, groupId, teamLabel });
      }

      case 'set_captain': {
        const who = whoIsFaculty(req, b);
        if (!who) return res.status(401).json({ error: 'faculty_authorization_required' });
        const sess = await store.getSession(code);
        if (!sess) return res.status(404).json({ error: 'no_such_session' });
        if (!ownsSession(who, sess)) return res.status(403).json({ error: 'not_your_session' });
        if (sess.mode !== 'team') return res.status(409).json({ error: 'not_team_mode' });
        const participants = await store.getParticipants(code);
        const pid = String(b.participantId || '');
        const chosen = participants[pid];
        if (!chosen || !chosen.groupId) return res.status(404).json({ error: 'no_such_participant' });
        for (const p of Object.values(participants)) {
          if (!p || p.groupId !== chosen.groupId) continue;
          p.isCaptain = p.id === pid;
          await store.setParticipant(code, p.id, p);
        }
        return res.status(200).json({ ok: true, groupId: chosen.groupId, captainId: pid });
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
            const all = Object.values(participants).filter(Boolean);
            if (!all.length) {
              return res.status(409).json({ error: 'participants_required', message: 'At least one student must join before a team session can start.' });
            }
            const unassigned = all.filter(p => !p.groupId);
            if (unassigned.length) {
              return res.status(409).json({
                error: 'unassigned_participants',
                count: unassigned.length,
                participantIds: unassigned.map(p => p.id),
                message: `${unassigned.length} student${unassigned.length === 1 ? ' is' : 's are'} still unassigned. Assign every student to a team before starting.`
              });
            }
            const groups = {};
            for (const p of all) (groups[p.groupId] ||= []).push(p);
            const missingLead = Object.entries(groups).filter(([, members]) => !members.some(p => p.isCaptain)).map(([gid]) => gid);
            if (missingLead.length) {
              return res.status(409).json({ error: 'team_lead_required', groupIds: missingLead, message: 'Every team must have one team lead before the session starts.' });
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
        const all = await store.getParticipants(code);
        const key = x => String(x || '').trim().toLowerCase();
        const lt = req.headers['x-launch-token'] || b.launchToken;
        const launched = lt ? verifyLaunch(String(lt)) : null;
        let id = launched && launched.sub ? `platform:${launched.sub}` : String(b.participantId || '').trim();
        if (!id || !all[id]) {
          const match = Object.values(all).find(p => p && key(p.name) === key(name));
          id = match ? match.id : (id || newId());
        }
        const existing = all[id];

        let groupId = existing ? existing.groupId : null;
        let teamLabel = existing ? (existing.teamLabel || '') : '';
        if (sess.mode === 'individual') {
          groupId = `individual:${id}`;
          teamLabel = name;
        } else if (!existing) {
          // Team sessions are instructor-managed. New students always enter the
          // unassigned pool; the faculty console creates teams and chooses leads.
          groupId = null;
          teamLabel = '';
        }

        const participant = {
          id,
          name,
          groupId,
          teamLabel,
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
        const rawRun = rid ? runs[rid] : null;
        const run = publicRun(rawRun);
        if (run && rawRun && rawRun.reflections && rawRun.reflections[pid]) {
          run.reflection1 = rawRun.reflections[pid].reflection1 || '';
          run.reflection2 = rawRun.reflections[pid].reflection2 || '';
        }
        if (run && sess.mode === 'team') run.done = !!(rawRun && rawRun.finishedBy && rawRun.finishedBy[pid]);
        return res.status(200).json({
          session: publicSession(sess),
          me,
          mates,
          canSubmit: sess.mode === 'individual' || !!me.isCaptain,
          run
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
        const wantsSharedDecision = b.strategicView !== undefined || b.year1 !== undefined || b.year2 !== undefined;
        if (sess.mode === 'team' && wantsSharedDecision && !me.isCaptain) {
          return res.status(403).json({ error: 'captain_only' });
        }

        const rid = runIdFor(sess, me);
        const runs = await store.getRuns(code);
        const current = runs[rid] || { runId: rid, phase: 0, done: false, createdAt: Date.now() };
        if (current.done && (wantsSharedDecision || sess.mode === 'individual')) {
          return res.status(409).json({ error: 'run_already_completed' });
        }

        const next = { ...current };
        if (b.strategicView !== undefined) {
          const proposed = String(b.strategicView || '').slice(0, 500);
          if (current.strategicView && current.strategicView !== proposed) {
            return res.status(409).json({ error: 'strategic_view_locked' });
          }
          next.strategicView = current.strategicView || proposed;
        }
        if (b.year1 !== undefined) {
          const v = S.validateAllocation(b.year1);
          if (!v.ok) return res.status(400).json(v);
          if (current.year1 && !sameAllocation(current.year1, v.allocation)) {
            return res.status(409).json({ error: 'year1_locked' });
          }
          next.year1 = current.year1 || v.allocation;
          next.phase = Math.max(next.phase || 0, 1);
        }
        if (b.year2 !== undefined) {
          if (!next.year1) return res.status(409).json({ error: 'year1_required' });
          const v = S.validateAllocation(b.year2);
          if (!v.ok) return res.status(400).json(v);
          if (current.year2 && !sameAllocation(current.year2, v.allocation)) {
            return res.status(409).json({ error: 'year2_locked' });
          }
          next.year2 = current.year2 || v.allocation;
          next.phase = Math.max(next.phase || 0, 2);
        }
        if (b.reflection1 !== undefined || b.reflection2 !== undefined) {
          const map = { ...(current.reflections || {}) };
          const mine = map[pid] || {};
          map[pid] = {
            participantId: pid,
            name: me.name,
            reflection1: b.reflection1 !== undefined ? String(b.reflection1 || '').slice(0, 1500) : (mine.reflection1 || ''),
            reflection2: b.reflection2 !== undefined ? String(b.reflection2 || '').slice(0, 1500) : (mine.reflection2 || ''),
            at: Date.now()
          };
          next.reflections = map;
          if (sess.mode === 'individual' || me.isCaptain) {
            next.reflection1 = map[pid].reflection1;
            next.reflection2 = map[pid].reflection2;
          }
        }

        if (next.year1 && next.year2) {
          next.outcomes = S.evaluateAll(next.year1, next.year2, sess.thresholds);
        }
        if (b.done) {
          if (!next.year1 || !next.year2) return res.status(409).json({ error: 'allocations_incomplete' });
          if (sess.mode === 'team') {
            next.finishedBy = { ...(current.finishedBy || {}), [pid]: Date.now() };
            const members = Object.values(participants).filter(p => p && p.groupId === rid);
            next.done = members.length > 0 && members.every(m => next.finishedBy[m.id]);
          } else {
            next.done = true;
          }
          next.phase = 3;
          if (next.done) next.completedAt = Date.now();
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