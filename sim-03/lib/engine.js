// SERVER ONLY. This file is never sent to a browser.
//
// RapidSim 03 — local optimization against system outcome.
//
// The lesson: a participant who owns one station of a process improves the
// thing in front of them, and the cost lands somewhere they cannot see. The
// engine exists to make that structurally true rather than narratively true.
// Downstream state is not hidden by the client declining to render it. It is
// hidden because visible() never returns it and the transport has no other
// path to the browser.
//
// Two properties matter more than anything else here:
//
//   1. Downstream effects are DEFERRED. If an action's cost showed up in the
//      same round it was taken, the participant would learn the mapping by
//      round three and the sim would become an optimisation puzzle. The lag is
//      what makes local reasoning look correct for long enough to commit to it.
//
//   2. The sim is WINNABLE. There is an inspect action that reveals downstream
//      readings, priced in local performance. A participant who spends on it
//      loses the local scoreboard and saves the person downstream. That trade
//      IS the lesson. Without it this is a trick, not a simulation.

'use strict';

// ---------------------------------------------------------------------------
// Leak protection
//
// One array, used both as the written list and as the detector. Sim 01 shipped
// a forbidden-terms list that had drifted from the regex meant to enforce it,
// so the check never fired and the markers went to the browser. Never maintain
// two copies of this.
// ---------------------------------------------------------------------------

const PROTECTED_KEYS = [
  'readLog',
  'downstream',
  'pending',
  'harm',
  'strain',
  'rework',
  'trueCycleTime',
  'harmThreshold',
  'downstreamEffects'
];

// Everything visible() is permitted to emit at the top level. An allow-list
// rather than a deny-list, because a new state field added later defaults to
// hidden instead of defaulting to leaked.
// localScore is deliberately absent. It is invented — a real diagnosis bench is
// measured on units cleared and cycle time, and those two being real is what
// makes the trap work. Showing a made-up points figure tells the participant
// they are playing a game with a number to maximise, and a negative one reads
// as losing rather than as a working month. It stays server-side for the
// debrief, which needs one figure to compare runs against each other.
const VISIBLE_KEYS = [
  'round',
  'roundsTotal',
  'stationId',
  'stationName',
  'inbound',
  'cleared',
  'backlog',
  'localCycleTime',
  'actionsTaken',
  'readings',
  'finished'
];

// ---------------------------------------------------------------------------
// Session
// ---------------------------------------------------------------------------

class Session {
  // `process` is a process definition — see data/schema.md. It is passed in
  // rather than required at module scope so the engine can be tested against a
  // synthetic process before any scenario exists.
  constructor(processDef, opts = {}) {
    validateProcess(processDef);
    this.process = processDef;

    this.round = 0;
    this.roundsTotal = processDef.rounds;
    this.finished = false;

    // The station the participant owns. Everything else is downstream or
    // upstream of them and invisible either way.
    this.stationId = opts.stationId || processDef.participantStation;
    const own = processDef.stations.find(s => s.id === this.stationId);
    if (!own) throw new Error(`unknown participant station: ${this.stationId}`);
    this.stationName = own.name;

    // Visible local state.
    this.inbound = own.openingInbound;
    this.cleared = 0;
    this.backlog = own.openingBacklog;
    this.localScore = 0;
    this.localCycleTime = own.baseCycleTime;
    this.actionsTaken = [];
    this.readings = [];        // populated only by inspect actions

    // Hidden system state. Keyed by station id.
    this.downstream = {};
    for (const s of processDef.stations) {
      if (s.id === this.stationId) continue;
      this.downstream[s.id] = { strain: s.openingStrain || 0, rework: 0 };
    }

    // Effects waiting to land. Each is { round, stationId, field, delta }.
    this.pending = [];

    this.harm = { triggered: false, atRound: null, stationId: null, person: null };
    this.transcript = [];

    // One opaque token per action, minted per run. Random rather than derived,
    // so two participants comparing screens learn nothing from matching tokens.
    // What each inspect actually showed, with the figure behind it. Server
    // only — never in VISIBLE_KEYS. The debrief needs to know whether a
    // participant who looked was shown anything, because looking too early
    // and being told everything is fine is a different run from looking late
    // and ignoring it, and they must not get the same ending.
    this.readLog = [];

    this.tokens = {};
    for (const a of processDef.actions) {
      let t;
      do { t = Math.random().toString(36).slice(2, 10); } while (this.tokens[t]);
      this.tokens[t] = a.id;
    }
  }

  // -------------------------------------------------------------------------
  // The only thing the client is ever given.
  // -------------------------------------------------------------------------
  visible() {
    const out = {};
    for (const k of VISIBLE_KEYS) {
      if (this[k] === undefined) continue;
      out[k] = deepCopy(this[k]);
    }
    // Action ids are semantic — `call_field` announces that there is a field
    // to call, and `clear_fast` announces which option the sim considers fast.
    // A participant with the network tab open would have the shape of the sim
    // before their first decision. So the browser gets an opaque token that
    // means nothing outside this one run, and act() maps it back.
    // Each day carries its own situation and its own phrasing for the same
    // four choices. The choices do not change — the habit forming is the
    // lesson — but a participant should have to read the day rather than
    // recognise a button position.
    const day = this.today();
    out.note = day ? day.note : null;
    out.availableActions = this.availableActions().map(a => {
      const v = (day && day.variants && day.variants[a.id]) || {};
      // No price tag. Announcing "-4 bench score" turns the decision into
      // arithmetic — the participant compares numbers and takes the cheapest
      // instead of deciding whether to find out what happens to their work.
      // The cost is real and it lands where it should: a morning spent on the
      // phone clears nothing, and units cleared not moving says it better than
      // a label ever could.
      return {
        id: this.tokenFor(a.id),
        label: v.label || a.label,
        blurb: v.blurb || a.blurb || ''
      };
    });
    return out;
  }

  today() {
    const days = this.process.days;
    if (!days || !days.length) return null;
    return days[Math.min(this.round, days.length - 1)];
  }

  tokenFor(actionId) {
    for (const [tok, id] of Object.entries(this.tokens)) {
      if (id === actionId) return tok;
    }
    throw new Error(`no token for ${actionId}`);
  }

  resolveToken(given) {
    // Accept a token from the browser, or a real id from server-side callers
    // and tests. The browser is never given a real id, so a real id arriving
    // over HTTP simply matches nothing a participant could have guessed.
    if (this.tokens[given]) return this.tokens[given];
    return given;
  }

  // Action definitions carry their downstream consequences. Those must never
  // reach the client, so this strips to id, label and the local price only.
  availableActions() {
    if (this.finished) return [];
    return this.process.actions.filter(a => {
      if (a.availableFrom !== undefined && this.round < a.availableFrom) return false;
      if (a.oncePerRun && this.actionsTaken.includes(a.id)) return false;
      return true;
    });
  }

  // -------------------------------------------------------------------------
  // A round.
  // -------------------------------------------------------------------------
  act(given) {
    if (this.finished) throw new Error('run is over');
    const actionId = this.resolveToken(String(given));
    const action = this.availableActions().find(a => a.id === actionId);
    if (!action) throw new Error(`unavailable action: ${actionId}`);

    const before = this.snapshotLocal();
    const before_day = this.today();

    // Local effects land immediately. This is the whole reason local reasoning
    // feels correct — the feedback is fast and it is real.
    applyLocal(this, action);
    this.actionsTaken.push(action.id);

    // Downstream effects are queued against a future round.
    for (const e of action.downstreamEffects || []) {
      this.pending.push({
        round: this.round + (e.lag === undefined ? 1 : e.lag),
        stationId: e.stationId,
        field: e.field,
        delta: e.delta
      });
    }

    // Inspect actions are the escape hatch. They read hidden state and copy a
    // single reading into visible state, which is the only sanctioned path
    // from downstream to the participant.
    let reading = null;
    if (action.inspect) {
      reading = this.readDownstream(action.inspect);
      this.readings.push(reading);
      this.readLog.push({
        round: this.round,
        stationId: action.inspect.stationId,
        strain: this.downstream[action.inspect.stationId].strain,
        text: reading.text
      });
    }

    // Record the wording the participant actually read, not the generic name.
    // The debrief shows this back to them day by day, and it should match what
    // was on the screen at the time — on day 4 they chose "Clear hard for the
    // numbers", and being told they chose "Clear from the symptom code" makes
    // the record feel like somebody else's.
    const dayVariant = (before_day && before_day.variants && before_day.variants[action.id]) || {};
    this.transcript.push({
      round: this.round,
      actionId: action.id,
      label: dayVariant.label || action.label,
      localBefore: before,
      localAfter: this.snapshotLocal(),
      note: before_day ? before_day.note : null,
      reading
    });

    this.advance();
    return { visible: this.visible(), reading };
  }

  // Land anything due, run arrivals, check for harm, roll the clock.
  advance() {
    this.round += 1;

    const due = this.pending.filter(p => p.round <= this.round);
    this.pending = this.pending.filter(p => p.round > this.round);
    for (const p of due) {
      const st = this.downstream[p.stationId];
      if (!st) continue;
      st[p.field] = (st[p.field] || 0) + p.delta;
      if (st[p.field] < 0) st[p.field] = 0;
    }

    // Arrivals vary by day when the scenario says so. A flat arrival rate
    // makes the backlog settle after day four and then the screen stops
    // telling the participant anything.
    const day = this.today();
    this.inbound = (day && day.arrivals !== undefined)
      ? day.arrivals
      : this.process.arrivalsPerRound;
    this.backlog += this.inbound;

    this.checkHarm();

    if (this.round >= this.roundsTotal) this.finished = true;
  }

  // Harm is deterministic and lands on a named person, never on a metric.
  // It fires once. A run that has already harmed someone does not harm them
  // twice for a worse score — the participant either got there or did not.
  checkHarm() {
    if (this.harm.triggered) return;
    for (const s of this.process.stations) {
      const st = this.downstream[s.id];
      if (!st) continue;
      if (s.harmThreshold !== undefined && st.strain >= s.harmThreshold) {
        this.harm = {
          triggered: true,
          atRound: this.round,
          stationId: s.id,
          person: s.owner
        };
        return;
      }
    }
  }

  readDownstream(spec) {
    const st = this.downstream[spec.stationId];
    const station = this.process.stations.find(s => s.id === spec.stationId);
    if (!st || !station) throw new Error(`cannot inspect ${spec.stationId}`);
    // A reading is a rendered sentence, not a number the participant can
    // arithmetic against. They should come away knowing something is wrong
    // downstream, not holding a gauge they can optimise to zero.
    return {
      round: this.round,
      stationId: spec.stationId,
      stationName: station.name,
      text: describeStrain(st.strain, station)
    };
  }

  snapshotLocal() {
    return {
      cleared: this.cleared,
      backlog: this.backlog,
      localScore: this.localScore,
      localCycleTime: this.localCycleTime
    };
  }

  // -------------------------------------------------------------------------
  // Serialisation. Plain JSON so it can sit in Redis between turns the way
  // 01 and 02 do. No Maps — 02's askCounts Map needed special handling on both
  // sides of the wire and it was a recurring source of bugs.
  // -------------------------------------------------------------------------
  toJSON() {
    return {
      round: this.round,
      roundsTotal: this.roundsTotal,
      finished: this.finished,
      stationId: this.stationId,
      stationName: this.stationName,
      inbound: this.inbound,
      cleared: this.cleared,
      backlog: this.backlog,
      localScore: this.localScore,
      localCycleTime: this.localCycleTime,
      actionsTaken: this.actionsTaken,
      readings: this.readings,
      downstream: this.downstream,
      pending: this.pending,
      harm: this.harm,
      transcript: this.transcript,
      readLog: this.readLog,
      tokens: this.tokens,
      // Who launched this run, captured at the start while the token was still
      // valid. Never sent to the browser — it is not in VISIBLE_KEYS.
      launch: this.launch || null
    };
  }

  static fromJSON(processDef, obj) {
    const s = new Session(processDef, { stationId: obj.stationId });
    Object.assign(s, obj);
    return s;
  }
}

// ---------------------------------------------------------------------------
// Local effects
// ---------------------------------------------------------------------------

function applyLocal(session, action) {
  const l = action.local || {};
  const throughput = Math.min(session.backlog, l.clears || 0);
  session.cleared += throughput;
  session.backlog -= throughput;

  if (l.cycleTimeDelta) {
    session.localCycleTime = Math.max(1, session.localCycleTime + l.cycleTimeDelta);
  }

  // The local scoreboard is what the participant is measured on, and it is
  // honest. Improving it really does improve it. That is the trap.
  session.localScore += (l.scoreDelta || 0) + throughput;
  session.localScore -= (action.localCost || 0);
}

function describeStrain(strain, station) {
  const bands = station.strainBands || [
    [0, 'nothing unusual'],
    [3, 'running behind, catching up'],
    [6, 'consistently behind'],
    [9, 'not coping']
  ];
  let text = bands[0][1];
  for (const [floor, label] of bands) if (strain >= floor) text = label;
  return text;
}

// ---------------------------------------------------------------------------
// Process definition validation
//
// The engine computes what is legal rather than being told. If a definition is
// wrong the tests should say so loudly at construction, not silently produce a
// sim nobody can win.
// ---------------------------------------------------------------------------

function validateProcess(p) {
  if (!p || typeof p !== 'object') throw new Error('process definition required');
  const need = ['id', 'stations', 'actions', 'rounds', 'participantStation', 'arrivalsPerRound'];
  for (const k of need) {
    if (p[k] === undefined) throw new Error(`process definition missing: ${k}`);
  }
  if (!Array.isArray(p.stations) || p.stations.length < 2) {
    throw new Error('a process needs at least two stations, or there is no downstream');
  }
  if (!Array.isArray(p.actions) || p.actions.length < 2) {
    throw new Error('a process needs at least two actions, or there is no decision');
  }

  const ids = new Set();
  for (const s of p.stations) {
    if (!s.id) throw new Error('station missing id');
    if (ids.has(s.id)) throw new Error(`duplicate station id: ${s.id}`);
    ids.add(s.id);
    if (s.harmThreshold !== undefined && !s.owner) {
      // Harm must land on a named person. A station that can harm without an
      // owner would produce harm to a metric, which is the failure mode the
      // design rules exist to prevent.
      throw new Error(`station ${s.id} can harm but names nobody`);
    }
  }

  for (const a of p.actions) {
    if (!a.id) throw new Error('action missing id');
    if (!a.label) throw new Error(`action ${a.id} missing label`);
    for (const e of a.downstreamEffects || []) {
      if (!ids.has(e.stationId)) {
        throw new Error(`action ${a.id} targets unknown station ${e.stationId}`);
      }
      if (e.lag !== undefined && e.lag < 1) {
        // A same-round downstream effect is visible in the same breath as the
        // action that caused it, which teaches the mapping and destroys the sim.
        throw new Error(`action ${a.id} has a downstream effect with lag < 1`);
      }
    }
    if (a.inspect && !ids.has(a.inspect.stationId)) {
      throw new Error(`action ${a.id} inspects unknown station ${a.inspect.stationId}`);
    }
  }

  if (!p.actions.some(a => a.inspect)) {
    throw new Error('no inspect action: the sim would be unwinnable');
  }
}

function deepCopy(v) {
  return v === null || typeof v !== 'object' ? v : JSON.parse(JSON.stringify(v));
}

module.exports = { Session, PROTECTED_KEYS, VISIBLE_KEYS, validateProcess, describeStrain };
