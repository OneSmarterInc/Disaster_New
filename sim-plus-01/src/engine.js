'use strict';

const { classify } = require('./classifier');
const { RAY, TERRY, RUTH } = require('../data/contracts');
const { WINDOW_SECONDS, WINDOWS, isFeasible, feasibleOrderings } = require('../data/calendar');

const SOURCES = { ray: RAY, terry: TERRY, ruth: RUTH };

/**
 * Resolve the next posture given the current one and an incoming bucket.
 * Terminal states absorb everything. The transition happens BEFORE the
 * answer is looked up, so a guarded Ruth asked a door-opening question
 * answers in her open voice — the shift is never announced, it only
 * shows in what she gives.
 */
function nextPosture(character, current, bucket) {
  const rules = character.posture;
  if (!rules) return null;
  if (rules.terminal.includes(current)) return current;
  if (rules.closes.includes(bucket)) return 'CLOSED';
  if (current === 'GUARDED' && rules.opens.includes(bucket)) return 'OPEN';
  return current;
}

/** Pick the answer variant for a bucket, advancing on repeat asks. */
function resolveAnswer(character, posture, bucket, askCounts) {
  let table = character.answers;
  if (posture) table = table[posture];

  // A closed source answers every bucket from one rotation.
  const key = table.ANY ? 'ANY' : bucket;
  const variants = table[key] || table.UNMATCHED;
  if (!variants) return null;

  const countKey = `${character.id}:${posture || '-'}:${key}`;
  // key === bucket means the reply came from that bucket's own answers.
  // key === 'ANY' means it came from a catch-all rotation and the
  // variant index carries no bucket meaning.
  const n = askCounts.get(countKey) || 0;
  askCounts.set(countKey, n + 1);
  const index = Math.min(n, variants.length - 1);
  return { text: variants[index], index, key };
}

// Bumped when the shape of a serialised session changes. Rehydrating state
// written by an older shape is refused rather than attempted, because a
// half-understood session is worse than an honest failure.
const STATE_VERSION = 1;

class Session {
  constructor() {
    this.order = null;
    this.windowIndex = 0;
    this.remaining = WINDOW_SECONDS;
    this.posture = { ruth: RUTH.posture.initial };
    this.askCounts = new Map();
    this.transcript = [];
    // Windows closed for good. A break between class meetings seals whatever
    // came before it, or the availability calendar stops constraining
    // anything and a participant simply finishes at home.
    this.sealed = [];
  }

  /**
   * Plain JSON. Everything here is already serialisable except askCounts,
   * which is a Map and needs unpacking.
   *
   * Note what is NOT stored: answer text. The transcript keeps answerKey and
   * variant, and the text is resolved from the contracts at render time. A
   * dump of the session store is not a dump of the answer key.
   */
  toJSON() {
    return {
      v: STATE_VERSION,
      order: this.order,
      windowIndex: this.windowIndex,
      remaining: this.remaining,
      posture: this.posture,
      askCounts: [...this.askCounts],
      sealed: this.sealed,
      transcript: this.transcript.map(function (t) {
        const { answer, ...rest } = t;   // dropped; resolvable from outputRef
        return rest;
      })
    };
  }

  /** Rebuild a session from stored state. Throws rather than guessing. */
  static fromJSON(state) {
    if (!state || typeof state !== 'object') throw new Error('no state');
    if (state.v !== STATE_VERSION) {
      const e = new Error('state written by version ' + state.v + ', engine expects ' + STATE_VERSION);
      e.code = 'STATE_VERSION_MISMATCH';
      throw e;
    }
    const s = new Session();
    s.order = state.order || null;
    s.windowIndex = state.windowIndex || 0;
    s.remaining = typeof state.remaining === 'number' ? state.remaining : WINDOW_SECONDS;
    s.posture = state.posture || { ruth: RUTH.posture.initial };
    s.askCounts = new Map(state.askCounts || []);
    s.sealed = state.sealed || [];
    s.transcript = (state.transcript || []).map(function (t) {
      const character = SOURCES[t.sourceId];
      const table = character.posture ? character.answers[t.postureAfter] : character.answers;
      const variants = (table && (table.ANY || table[t.answerKey])) || [];
      return { ...t, answer: variants[Math.min(t.variant, variants.length - 1)] || null };
    });
    return s;
  }

  /**
   * Close the current window permanently. Called at a between-session break.
   *
   * The clock is spent by asking, not by the wall, so closing a browser
   * costs nothing and a participant can think as long as they like between
   * questions — thinking time is not the resource being taught. What a break
   * must not allow is going back to a source already seen, and that is what
   * sealing prevents.
   */
  seal() {
    if (this.order && this.sealed.indexOf(this.windowIndex) === -1) {
      this.sealed.push(this.windowIndex);
    }
    this.remaining = 0;
    return this;
  }

  isSealed(windowIndex) {
    return this.sealed.indexOf(
      windowIndex === undefined ? this.windowIndex : windowIndex
    ) !== -1;
  }

  chooseOrder(order) {
    if (this.order) throw new Error('order already chosen');
    if (!isFeasible(order)) {
      throw new Error(
        `ordering [${order.join(', ')}] is not permitted by the calendar. ` +
        `Legal: ${feasibleOrderings().map((o) => o.join('>')).join('  |  ')}`
      );
    }
    this.order = order;
    return this;
  }

  get currentSourceId() {
    if (!this.order) throw new Error('no order chosen');
    return this.order[this.windowIndex] || null;
  }

  get isWindowOpen() {
    return this.currentSourceId !== null && this.remaining > 0;
  }

  ask(text) {
    if (!this.order) throw new Error('no order chosen');
    const sourceId = this.currentSourceId;
    if (!sourceId) return { error: 'SESSION_OVER' };
    if (this.isSealed()) return { error: 'WINDOW_SEALED', sourceId };
    if (this.remaining <= 0) return { error: 'WINDOW_CLOSED', sourceId };

    const character = SOURCES[sourceId];
    const { bucket, cost, matchedBy } = classify(text);

    const postureBefore = this.posture[sourceId] ?? null;
    const postureAfter = nextPosture(character, postureBefore, bucket);
    if (postureAfter !== null) this.posture[sourceId] = postureAfter;

    const resolved = resolveAnswer(character, postureAfter, bucket, this.askCounts);

    const spent = Math.min(cost, this.remaining);
    this.remaining -= spent;

    const entry = {
      window: WINDOWS[this.windowIndex].id,
      sourceId,
      sourceName: character.name,
      question: text,
      bucket,
      matchedBy,
      cost,
      spent,
      remaining: this.remaining,
      postureBefore,
      postureAfter,
      postureChanged: postureBefore !== postureAfter,
      answer: resolved.text,
      variant: resolved.index,
      answerKey: resolved.key
    };
    this.transcript.push(entry);
    return entry;
  }

  advanceWindow() {
    if (this.windowIndex >= WINDOWS.length - 1) {
      this.windowIndex = WINDOWS.length;
      return { done: true };
    }
    this.windowIndex += 1;
    this.remaining = WINDOW_SECONDS;
    return { done: false, window: WINDOWS[this.windowIndex], sourceId: this.currentSourceId };
  }

  /** Instructor view. Everything the debrief needs, nothing a participant sees. */
  summary() {
    const byWindow = WINDOWS.map((w) => {
      const rows = this.transcript.filter((t) => t.window === w.id);
      const last = rows[rows.length - 1];
      return {
        window: w.id,
        label: w.label,
        source: rows.length ? rows[0].sourceName : null,
        questions: rows.length,
        openerBucket: rows.length ? rows[0].bucket : null,
        openerCost: rows.length ? rows[0].cost : null,
        secondsUnused: last ? last.remaining : WINDOW_SECONDS,
        postureEnd: last ? last.postureAfter : null,
        closedBy: rows.find((r) => r.postureAfter === 'CLOSED') || null
      };
    });
    return {
      order: this.order,
      senderPerspectiveAskedIn: [
        ...new Set(
          this.transcript.filter((t) => t.bucket === 'SENDER_PERSPECTIVE').map((t) => t.sourceName)
        )
      ],
      genericOpeners: this.transcript.filter(
        (t, i, a) => t.bucket === 'GENERIC_DESCRIPTIVE' && (i === 0 || a[i - 1].window !== t.window)
      ).length,
      byWindow
    };
  }
}

module.exports = { Session, nextPosture, resolveAnswer, SOURCES, STATE_VERSION };
