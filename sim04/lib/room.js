'use strict';
const config = require('../data/config');
const sheets = require('../data/sheets');
const engine = require('../engine/retention');

function createSession({ code, owner, mode, count, clockMinutes = config.clockMinutes, name, now }) {
  if (!['team', 'individual'].includes(mode)) throw new Error('Choose team or individual mode.');
  if (!Number.isSafeInteger(count) || count < config.minTeams || count > 100) {
    throw new Error(`Choose between ${config.minTeams} and 100 teams or participants.`);
  }
  if (!Number.isSafeInteger(clockMinutes) || clockMinutes < 1 || clockMinutes > 120) {
    throw new Error('Clock minutes must be between 1 and 120.');
  }
  const assignment = engine.assignSheets(count);
  return {
    code, name: String(name || 'Whose Number Is Right?').slice(0, 80),
    owner, mode, count, clockMinutes, createdAt: now,
    state: 'lobby', stage: 0, startedAt: null,
    slots: assignment.map((sheetId, i) => ({
      id: `slot-${i + 1}`, label: `${mode === 'team' ? 'Team' : 'Participant'} ${i + 1}`,
      sheetId, memberIds: [], commit: null
    })),
    participants: {}
  };
}

function deadline(session) { return session.startedAt + session.clockMinutes * 60000; }
function secondsLeft(session, now) {
  return session.startedAt ? Math.max(0, Math.ceil((deadline(session) - now) / 1000)) : null;
}
function allLocked(session, now) {
  return !!session.startedAt && (now >= deadline(session) || session.slots.every(s => s.commit));
}
function clock(session, now) {
  const remaining = secondsLeft(session, now);
  return {
    remaining, warning: remaining !== null && remaining > 0 && remaining <= config.warningMinutes * 60,
    expired: remaining === 0, running: !!session.startedAt && remaining > 0 && session.stage === 0
  };
}
function slotFor(session, id) {
  const p = session.participants[id];
  return p && session.slots.find(s => s.id === p.slotId && s.memberIds.includes(id));
}
// Drop unfilled slots, then assign sheets to the remaining groups in order.
// Lobby moves can leave gaps, and no participant has seen a sheet yet.
function start(session, now) {
  if (session.state !== 'lobby') throw new Error('The session has already started.');
  if (Object.values(session.participants).some(p => !slotFor(session, p.id))) throw new Error('Assign every joined participant to a group.');
  const filled = session.slots.filter(s => s.memberIds.length);
  if (filled.length < config.minTeams) {
    throw new Error(`At least ${config.minTeams} ${session.mode === 'team' ? 'groups' : 'participants'} must have joined before play starts.`);
  }
  const assignment = engine.assignSheets(filled.length);
  const slots = filled.map((s, i) => ({ ...s, sheetId: assignment[i] }));
  return { ...session, slots, count: slots.length, state: 'running', startedAt: now };
}
// Team mode: place a new participant in the smallest group, earliest first.
function openSlot(session) {
  return session.slots.reduce((best, s) => (!best || s.memberIds.length < best.memberIds.length ? s : best), null);
}
function assign(session, participantId, slotId, label) {
  if (session.state !== 'lobby') throw new Error('Assignments are locked after the clock starts.');
  const p = session.participants[participantId];
  const slot = session.slots.find(s => s.id === slotId);
  if (!p || !slot) throw new Error('Choose a joined participant and an existing group.');
  if (session.mode === 'individual' && slot.memberIds.length && !slot.memberIds.includes(participantId)) {
    throw new Error('This participant slot is already taken.');
  }
  const next = structuredClone(session);
  for (const s of next.slots) s.memberIds = s.memberIds.filter(id => id !== participantId);
  const target = next.slots.find(s => s.id === slotId);
  target.memberIds.push(participantId);
  next.participants[participantId].slotId = slotId;
  if (label && session.mode === 'team') target.label = String(label).trim().slice(0, 40) || target.label;
  return next;
}
function join(session, id, name, now) {
  if (session.stage === 3) throw new Error('The session is complete.');
  if (session.mode === 'team' && session.state !== 'lobby' && !session.participants[id]) {
    throw new Error('Teams are fixed after the clock starts.');
  }
  const clean = String(name || '').trim().slice(0, 60);
  if (!clean) throw new Error('A participant name is required.');
  const next = structuredClone(session);
  if (next.participants[id]) {
    next.participants[id].joinedAt ||= now;
    return next;
  }
  next.participants[id] = { id, name: clean, joinedAt: now, slotId: null, reportedAt: null };
  const target = next.mode === 'individual' ? next.slots.find(s => s.memberIds.length === 0) : openSlot(next);
  if (!target) throw new Error('This session is full.');
  target.memberIds.push(id);
  next.participants[id].slotId = target.id;
  return next;
}
function commit(session, participantId, number, confidence, now) {
  const slot = slotFor(session, participantId);
  if (!slot) throw new Error('Ask your instructor to assign you to a group.');
  if (session.stage !== 0 || !session.startedAt || now >= deadline(session)) throw new Error('The number is locked.');
  if (slot.commit) throw new Error('This group has already committed its number.');
  const n = Number(number);
  if (number === '' || number === null || !Number.isFinite(n) || n < 0 || n > 100 || Math.abs(n * 10 - Math.round(n * 10)) > 1e-8) {
    throw new Error('Enter a percentage from 0.0 to 100.0, to one decimal place.');
  }
  if (!Number.isInteger(Number(confidence)) || Number(confidence) < 1 || Number(confidence) > 5) {
    throw new Error('Choose a confidence rating from 1 to 5.');
  }
  const next = structuredClone(session);
  next.slots.find(s => s.id === slot.id).commit = { number: n, confidence: Number(confidence), at: now };
  return next;
}
function advance(session, now) {
  if (session.stage === 0 && !allLocked(session, now)) throw new Error('Wait until every group commits or the clock reaches zero.');
  if (session.stage >= 3 || !session.startedAt) throw new Error('No further stage is available.');
  const next = { ...session, stage: session.stage + 1 };
  if (next.stage === 3) next.state = 'complete';
  return next;
}
function studentView(session, participantId, now) {
  const slot = slotFor(session, participantId);
  const p = session.participants[participantId];
  if (!p) throw new Error('Join the session first.');
  return {
    state: session.state, mode: session.mode, group: slot ? slot.label : null,
    lobby: session.state === 'lobby' ? {
      readyGroups: session.slots.filter(s => s.memberIds.length).length,
      totalGroups: session.slots.length,
      clockMinutes: session.clockMinutes
    } : null,
    clock: clock(session, now),
    // No sheet before the clock starts: a participant moved between groups in the
    // lobby must never have seen another group's definition.
    data: slot && session.state !== 'lobby' ? engine.studentPayload(slot.sheetId) : null,
    commit: slot ? slot.commit && { number: slot.commit.number.toFixed(1), confidence: slot.commit.confidence } : null,
    canCommit: !!slot && session.stage === 0 && !!session.startedAt && now < deadline(session) && !slot.commit
  };
}
function projector(session, now) {
  const c = clock(session, now);
  const base = {
    session: { code: session.code, name: session.name, mode: session.mode, count: session.count, state: session.state, stage: session.stage },
    clock: c,
    groups: session.slots.map(s => ({ id: s.id, label: s.label, committed: !!s.commit, locked: !!s.commit || c.expired }))
  };
  if (session.stage >= 1) {
    base.numbers = session.slots.map(s => ({ id: s.id, label: s.label,
      number: s.commit ? s.commit.number.toFixed(1) : null,
      confidence: s.commit?.confidence || null }));
  }
  if (session.stage >= 2) {
    base.reveal = config.assignmentOrder.map(sheetId => ({
      sheetId, lines: sheets.sheetLines(sheetId), contestedIndex: 3,
      department: sheets.reveal[sheetId].department,
      purpose: sheets.reveal[sheetId].purpose,
      derivation: engine.derivation(sheetId),
      groups: session.slots.filter(s => s.sheetId === sheetId).map(s => ({
        id: s.id, label: s.label, number: s.commit ? s.commit.number.toFixed(1) : null
      }))
    })).filter(x => x.groups.length);
  }
  return base;
}
function privateCheck(session) {
  return session.slots.map(s => ({
    label: s.label,
    number: s.commit ? s.commit.number.toFixed(1) : null,
    ...engine.checkCommit(s.sheetId, s.commit?.number ?? null)
  }));
}
module.exports = { createSession, deadline, allLocked, clock, slotFor, start, assign, join, commit, advance, studentView, projector, privateCheck };
