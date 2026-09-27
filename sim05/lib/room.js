// RapidSim 05 room logic. Pure functions over a session, its participants and a
// timestamp, so every rule can be tested without Redis or a real clock.
//
// Nothing is written when a round closes. A vote missing at close is read as a
// timeout, and a timeout ships, so the record never needs a sweeper.
const C = require('../config/content.js');
const E = require('./engine.js');

const INTENSITIES = ['standard', 'lighter'];
const MODES = ['individual', 'team'];

function elapsedSeconds(sess, now) {
  if (!sess || !sess.startedAt) return 0;
  const pausedMs = (sess.pausedTotalMs || 0) + (sess.paused && sess.pausedAt ? now - sess.pausedAt : 0);
  return Math.max(0, (now - sess.startedAt - pausedMs) / 1000);
}

function clock(sess, now) {
  if (!sess || sess.state === 'lobby') return { phase: 'lobby', round: 0, remaining: 0, closedRounds: 0, openedRounds: 0 };
  if (sess.state === 'closed') return { phase: 'closed', round: 0, remaining: 0, closedRounds: 5, openedRounds: 5 };
  const p = E.phaseAt(elapsedSeconds(sess, now));
  let closedRounds = 0, openedRounds = 0;
  if (p.phase === 'decide') { closedRounds = p.round - 1; openedRounds = p.round; }
  else if (p.phase === 'reveal') { closedRounds = p.round; openedRounds = p.round; }
  else if (p.phase === 'ending' || p.phase === 'closed') { closedRounds = 5; openedRounds = 5; }
  return { ...p, remaining: Math.ceil(p.remaining), closedRounds, openedRounds, paused: !!sess.paused };
}

// A participant who joined after round 1 closed still plays, but their missed
// rounds are timeouts they never saw, so they stay out of the room's totals.
function isLate(sess, participant) {
  if (!sess.startedAt || !participant.joinedAt) return false;
  const round1Closes = sess.startedAt + (C.CLOCK.briefingSeconds + C.CLOCK.decisionSeconds) * 1000 + (sess.pausedTotalMs || 0);
  return participant.joinedAt >= round1Closes;
}

function ownVotes(participant, closedRounds) {
  const v = participant.votes || {};
  return C.ROUNDS.map((r, i) => (i < closedRounds ? E.normalise(v[r.n]) : v[r.n] || undefined));
}

function teamMembers(sess, groupId) {
  return (sess.teams && sess.teams[groupId]) || [];
}

function teamDecisions(sess, participants, groupId, closedRounds) {
  const members = teamMembers(sess, groupId);
  return C.ROUNDS.map((r, i) => {
    if (i >= closedRounds) return { decision: undefined, split: false };
    const votes = {};
    for (const id of members) if (participants[id]?.votes?.[r.n]) votes[id] = participants[id].votes[r.n];
    return E.teamDecision(members, votes);
  });
}

// Everything one student may see. Future rounds never leave the server.
function studentView(sess, participants, pid, now) {
  const me = participants[pid];
  const clk = clock(sess, now);
  const intensity = sess.intensity || 'standard';
  const inTeam = sess.mode === 'team';
  const mine = ownVotes(me, clk.closedRounds);
  let decisions;
  if (inTeam) decisions = teamDecisions(sess, participants, me.groupId, clk.closedRounds).map(t => t.decision);
  else decisions = mine.map((d, i) => (i < clk.closedRounds ? d : undefined));

  const rounds = [];
  for (let n = 1; n <= clk.openedRounds; n++) {
    const r = C.ROUNDS[n - 1];
    const entry = {
      n, title: r.title, request: r.request, reason: r.reason, adds: r.adds,
      myVote: (me.votes || {})[n] || null
    };
    if (n <= clk.closedRounds) {
      const res = E.roundResult(decisions, n, intensity);
      entry.result = res;
      if (inTeam) entry.myVote = mine[n - 1];
    }
    rounds.push(entry);
  }

  const view = {
    clock: clk,
    mode: sess.mode,
    team: inTeam ? { label: me.teamLabel || '', size: teamMembers(sess, me.groupId).length } : null,
    rounds,
    canVote: clk.phase === 'decide' && !clk.paused && !(me.votes || {})[clk.round] && (!inTeam || !!me.groupId && teamMembers(sess, me.groupId).includes(pid)),
    ending: null
  };
  if (clk.closedRounds === 5 && (clk.phase === 'ending' || clk.phase === 'closed')) {
    const e = E.ending(decisions, intensity);
    view.ending = {
      decisions: e.decisions.map((d, i) => ({ ...d, myVote: inTeam ? mine[i] : undefined })),
      knows: e.knows,
      missing: e.missing
    };
  }
  return view;
}

// The projector sees totals only. During a decision window it shows how many
// have decided, never which way: a live split on the wall invites herding.
function projectorView(sess, participants, now) {
  const clk = clock(sess, now);
  const intensity = sess.intensity || 'standard';
  const all = Object.values(participants || {}).filter(Boolean);
  let runs = [];
  let deciders = [];
  if (sess.mode === 'team') {
    for (const groupId of Object.keys(sess.teams || {})) {
      const t = teamDecisions(sess, participants, groupId, clk.closedRounds);
      runs.push({ decisions: t.map(x => x.decision), splits: t.map(x => x.split) });
    }
    deciders = all.filter(p => p.groupId && teamMembers(sess, p.groupId).includes(p.id));
  } else {
    const counted = all.filter(p => !isLate(sess, p));
    runs = counted.map(p => ({ decisions: ownVotes(p, clk.closedRounds).map((d, i) => (i < clk.closedRounds ? d : undefined)) }));
    deciders = counted;
  }
  const agg = E.aggregate(runs, intensity);
  const live = clk.phase === 'decide'
    ? { round: clk.round, decided: deciders.filter(p => (p.votes || {})[clk.round]).length, of: deciders.length }
    : null;
  return {
    clock: clk,
    mode: sess.mode,
    intensity,
    joined: all.length,
    late: sess.mode === 'individual' ? all.filter(p => isLate(sess, p)).length : 0,
    teams: sess.mode === 'team' ? Object.keys(sess.teams || {}).length : null,
    live,
    rounds: agg.rounds.slice(0, clk.closedRounds),
    endings: clk.closedRounds === 5 ? agg.groups : null,
    headline: clk.closedRounds === 5 ? agg.headline : null,
    disagreement: clk.closedRounds === 5 ? agg.disagreement : null,
    debrief: {
      naming: C.DEBRIEF.naming,
      turn: C.DEBRIEF.turn,
      teamPrompt: sess.mode === 'team' ? C.DEBRIEF.teamPrompt : null
    }
  };
}

// Validate and apply one vote. Returns { next } or { error }.
function applyVote(sess, participant, round, decision, now) {
  const clk = clock(sess, now);
  if (sess.state !== 'running') return { error: 'session_not_running', status: 409 };
  if (sess.paused) return { error: 'session_paused', status: 409 };
  if (clk.phase !== 'decide') return { error: 'no_round_open', status: 409 };
  if (Number(round) !== clk.round) return { error: 'round_closed', status: 409 };
  if (!['approve', 'decline'].includes(decision)) return { error: 'invalid_decision', status: 400 };
  if (sess.mode === 'team' && !teamMembers(sess, participant.groupId).includes(participant.id)) {
    return { error: 'team_not_assigned', status: 409 };
  }
  if ((participant.votes || {})[clk.round]) return { error: 'already_decided', status: 409 };
  return { next: { ...participant, votes: { ...(participant.votes || {}), [clk.round]: decision } } };
}

// Freeze team membership at start so a vote can never move between teams.
function freezeTeams(participants) {
  const teams = {};
  for (const p of Object.values(participants)) {
    if (p && p.groupId) (teams[p.groupId] ||= []).push(p.id);
  }
  for (const k of Object.keys(teams)) teams[k].sort();
  return teams;
}

function applyControl(sess, set, now) {
  const next = { ...sess };
  if (set === 'pause') {
    if (sess.state !== 'running' || sess.paused) return { error: 'cannot_pause', status: 409 };
    next.paused = true; next.pausedAt = now;
  } else if (set === 'resume') {
    if (!sess.paused) return { error: 'not_paused', status: 409 };
    next.paused = false;
    next.pausedTotalMs = (sess.pausedTotalMs || 0) + (now - (sess.pausedAt || now));
    next.pausedAt = null;
  } else if (set === 'close') {
    next.state = 'closed'; next.paused = false; next.closedAt = now;
  } else {
    return { error: 'invalid_control', status: 400 };
  }
  return { next };
}

// Ending summary for the platform completion report: no score, no verdict.
function completionSummary(sess, participants, pid, now) {
  const v = studentView(sess, participants, pid, now);
  if (!v.ending) return null;
  return {
    summary: `${v.ending.decisions.filter(d => d.decision === 'decline').length} of 5 declined`,
    metrics: {
      mode: sess.mode,
      intensity: sess.intensity || 'standard',
      decisions: v.ending.decisions.map(d => d.decision),
      endingGroup: E.endingGroup(v.ending.knows)
    }
  };
}

module.exports = {
  INTENSITIES, MODES,
  elapsedSeconds, clock, isLate, ownVotes, teamDecisions, freezeTeams,
  studentView, projectorView, applyVote, applyControl, completionSummary
};
