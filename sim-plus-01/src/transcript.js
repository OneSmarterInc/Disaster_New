'use strict';

const { EVIDENCE } = require('../data/report');
const { SOURCES } = require('./engine');
const meta = require('../data/simmeta');
const pkg = require('../package.json');

/**
 * Build the transcript envelope described in
 * PLATFORM_SPEC_transcript_view.md.
 *
 * Critical property: the envelope contains NO answer text. Each event
 * carries an outputRef, and the text is resolved at render time from
 * the sim at the matching simVersion. A leak of the transcript store is
 * therefore not a leak of the answer key, and a transcript read against
 * a revised sim fails loudly instead of misleading the reader.
 */
function buildEnvelope(session, reviewResult, opts) {
  const o = opts || {};

  // The observation estimate is the participant's own measurement, made
  // before any interview. It is the number the platform gets configured
  // against, so the debrief needs it beside what Ruth eventually says
  // about it.
  const observation = o.observationSeconds == null ? null : {
    estimateSeconds: Number(o.observationSeconds),
    trueMean: meta.OBSERVATION.trueMean,
    claimsWatched: meta.OBSERVATION.claims,
    reading: meta.readEstimate(o.observationSeconds)
  };
  const path = (session.order || []).map((id) => SOURCES[id].name);

  const events = session.transcript.map((t, i) => {
    const character = SOURCES[t.sourceId];
    return {
      ordinal: i + 1,
      phase: 'window-' + t.window,
      actorId: t.sourceId,
      actorLabel: character.name,
      actorRole: character.role,
      input: t.question,
      classification: t.bucket,
      classificationLabel: meta.CLASSIFICATION_LABELS[t.bucket] || t.bucket,
      cost: { amount: t.spent, unit: 'seconds', remaining: t.remaining },
      stateBefore: t.postureBefore,
      stateAfter: t.postureAfter,
      // Resolvable, and meaningless without the sim at this version.
      outputRef: [t.sourceId, t.postureAfter || '-', t.answerKey, t.variant].join(':')
    };
  });

  const transitions = events
    .filter((e) => e.stateBefore !== e.stateAfter && e.stateAfter)
    .map((e) => ({
      ordinal: e.ordinal,
      actorId: e.actorId,
      from: e.stateBefore,
      to: e.stateAfter,
      kind: meta.transitionKind(e.stateBefore, e.stateAfter),
      label: meta.transitionLabel(e.actorLabel, e.stateBefore, e.stateAfter),
      causedBy: e.input
    }));

  // An actor is sealed from the ordinal at which they went irreversible.
  const sealedAt = {};
  for (const tr of transitions) {
    if (tr.kind === 'irreversible' && sealedAt[tr.actorId] === undefined) {
      sealedAt[tr.actorId] = tr.ordinal;
    }
  }

  const reachability = EVIDENCE.map((marker) => {
    const idx = session.transcript.findIndex((t) => marker.match(t));
    const held = idx >= 0;
    let blockedBy = null;
    if (!held) {
      if (sealedAt[marker.actorId] !== undefined) blockedBy = 'irreversible-transition';
      else if (!(session.order || []).includes(marker.actorId)) blockedBy = 'actor-not-visited';
      else blockedBy = 'not-asked';
    }
    return {
      id: marker.id,
      label: marker.label,
      actorId: marker.actorId,
      actorLabel: SOURCES[marker.actorId].name,
      held,
      heldAt: held ? idx + 1 : null,
      blockedBy
    };
  });

  return {
    sessionId: o.sessionId || null,
    simId: meta.SIM_ID,
    simVersion: pkg.version,
    participant: o.participant || null,
    cohortId: o.cohortId || null,
    startedAt: o.startedAt || null,
    completedAt: o.completedAt || null,
    path,
    phases: [...new Set(events.map((e) => e.phase))].map((id) => ({
      id,
      label: meta.phaseLabel(id, path)
    })),
    events,
    transitions,
    reachability,
    observation,
    outcome: meta.toOutcome(reviewResult, observation)
  };
}

/**
 * Resolve an outputRef back to authored text.
 *
 * Lives with the sim, not the platform. The renderer receives this as a
 * function so a deployment can decline to supply it — an instructor view
 * with no resolver shows the timeline without the answers, which is a
 * legitimate configuration and not a bug.
 */
function makeResolver() {
  const { RAY, TERRY, RUTH } = require('../data/contracts');
  const map = { ray: RAY, terry: TERRY, ruth: RUTH };
  return function resolve(outputRef) {
    const [actorId, posture, key, variantStr] = String(outputRef).split(':');
    const character = map[actorId];
    if (!character) return null;
    let table = character.answers;
    if (posture && posture !== '-') table = table[posture];
    if (!table) return null;
    const variants = table[key];
    if (!variants) return null;
    return variants[Math.min(Number(variantStr) || 0, variants.length - 1)] || null;
  };
}

module.exports = { buildEnvelope, makeResolver };
