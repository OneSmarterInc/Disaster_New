// The bridge between an HTTP request and the engine.
//
// Every endpoint follows the same three steps: load the session, do one thing
// to it, save it. Nothing else in api/ touches the store, so there is one
// place where persistence can be got wrong.
const { Session } = require('../src/engine');
const { MemoryStore, RedisStore, load, save, clear, breakSession } = require('../src/store');
const { feasibleOrderings, WINDOWS, WINDOW_SECONDS } = require('../data/calendar');
const { SOURCES } = require('../src/engine');
const META = require('./meta.js');

// One store per cold start. Falls back to memory when no KV is configured,
// which keeps local development working — and which loses sessions on restart,
// so it must never be what production quietly ends up using.
let _store = null;
function store() {
  if (_store) return _store;
  try { _store = new RedisStore(); }
  catch (e) {
    if (e.code !== 'NO_STORE') throw e;
    console.warn('No KV configured — sessions are in memory and will not survive a restart.');
    _store = new MemoryStore();
  }
  return _store;
}

async function get(userId) {
  return load(store(), META.id, userId);
}
async function put(userId, session) {
  return save(store(), META.id, userId, session);
}
async function drop(userId) {
  return clear(store(), META.id, userId);
}
async function endMeeting(userId, session) {
  return breakSession(store(), META.id, userId, session);
}

/**
 * What the browser is allowed to know.
 *
 * Never the bucket a question landed in, never a posture, never a marker of
 * any kind. A participant who learns the taxonomy exists starts hunting
 * categories instead of thinking about what they want to know, and a
 * participant who can see a door shut has been told the thing the debrief is
 * for. Time spent is visible because time is visible in the room.
 */
function view(session) {
  if (!session || !session.order) {
    return {
      state: 'choosing',
      orders: feasibleOrderings().map(function (o) {
        return { ids: o, people: o.map(function (id) {
          return { id: id, name: SOURCES[id].name, role: SOURCES[id].role };
        }) };
      })
    };
  }
  const sourceId = session.currentSourceId;
  if (!sourceId) return { state: 'finished', order: session.order };

  const w = WINDOWS[session.windowIndex];
  const c = SOURCES[sourceId];
  return {
    state: session.isSealed() ? 'sealed' : (session.remaining > 0 ? 'open' : 'closed'),
    order: session.order,
    window: { index: session.windowIndex, id: w.id, label: w.label, of: WINDOWS.length },
    source: { id: sourceId, name: c.name, role: c.role },
    remaining: Math.max(0, session.remaining),
    budget: WINDOW_SECONDS,
    exchanges: session.transcript
      .filter(function (t) { return t.window === w.id; })
      .map(function (t) { return { question: t.question, answer: t.answer, spent: t.spent }; })
  };
}

module.exports = { get, put, drop, endMeeting, view, Session, store };
