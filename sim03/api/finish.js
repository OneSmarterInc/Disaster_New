const { checkAccess, body } = require('../lib/guard.js');
const { reportCompletion } = require('../lib/launch.js');
const { verifyLaunch } = require('../lib/launch.js');
const S = require('../lib/scenario.js');
const { buildClosingLesson } = require('../lib/closingLesson.js');
const store = require('../lib/store.js');

async function sessionRun(b) {
  const code = String(b.sessionCode || '').toUpperCase().trim();
  const pid = String(b.participantId || '');
  if (!code || !pid || !store.configured()) return null;
  const sess = await store.getSession(code);
  if (!sess) {
    const e = new Error('no_such_session'); e.status = 404; throw e;
  }
  const participants = await store.getParticipants(code);
  const me = participants[pid];
  if (!me) {
    const e = new Error('not_joined'); e.status = 403; throw e;
  }
  const rid = sess.mode === 'individual' ? `individual:${me.id}` : me.groupId;
  const run = rid ? (await store.getRuns(code))[rid] : null;
  if (!run || !run.year1 || !run.year2) {
    const e = new Error('allocations_incomplete'); e.status = 409; throw e;
  }
  if (sess.mode === 'team' && !me.isCaptain && Number(run.phase || 0) < 3) {
    const e = new Error('team_run_not_complete'); e.status = 409; throw e;
  }
  return { sess, run, participants, me, rid, code, pid };
}


function overallOutcomeText(outcomes) {
  const y1 = outcomes && outcomes.year1 && outcomes.year1.band;
  const heat = outcomes && outcomes.year2 && outcomes.year2.heat && outcomes.year2.heat.band;
  const competitor = outcomes && outcomes.year2 && outcomes.year2.competitor && outcomes.year2.competitor.band;
  const y3 = outcomes && outcomes.year3 && outcomes.year3.band;
  const a = { strong:'Customer reporting became a real capability early.', middle:'Customer reporting became possible, but slowly and with manual work.', weak:'The first customer request exposed a reporting gap.' }[y1] || '';
  const b = { strong:'Operational resilience held when the heat wave tested the company.', middle:'The heat wave strained operations but did not fully break them.', weak:'The heat wave exposed a serious resilience weakness.' }[heat] || '';
  const c = { strong:'Midland could answer the competitor from a position of strength.', middle:'Midland could only mount a limited pilot response to the competitor.', weak:'Midland could not respond quickly to the competitor’s new service model.' }[competitor] || '';
  const d = { strong:'By Year 3, the architecture supported predictive service as something Midland could actually sell.', data_no_room:'You have three years of fault history and nowhere to put it.', pilot:'By Year 3, predictive service was promising, but still only a pilot.', weak:'By Year 3, the architecture still lacked the usable data foundation for predictive service.' }[y3] || '';
  return [a,b,c,d].filter(Boolean).join(' ');
}
function publicOutcome(o) { return o ? { title:o.title, narrative:o.narrative, band:o.band } : null; }

function allocationLabel(a) {
  return `Run ${a.run} · Uptime ${a.uptime} · Capacity ${a.capacity} · Connect ${a.connect} · Features ${a.features}`;
}

module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const b = body(req);
  let y1, y2, outcomes, summary, lessonThresholds;

  try {
    const sr = await sessionRun(b);
    if (sr) {
      y1 = sr.run.year1;
      y2 = sr.run.year2;
      lessonThresholds = sr.sess.thresholds || S.DEFAULT_THRESHOLDS;
      outcomes = sr.run.outcomes || S.evaluateAll(y1, y2, lessonThresholds);
      const reflection1 = String(b.reflection1 || '').slice(0, 1500);
      const reflection2 = String(b.reflection2 || '').slice(0, 1500);
      const reflections = { ...(sr.run.reflections || {}) };
      reflections[sr.pid] = { participantId: sr.pid, name: sr.me.name, reflection1, reflection2, at: Date.now() };
      const finishedBy = { ...(sr.run.finishedBy || {}), [sr.pid]: Date.now() };
      const members = Object.values(sr.participants).filter(p => p && p.groupId === sr.rid);
      const allDone = sr.sess.mode === 'individual' || (members.length > 0 && members.every(m => finishedBy[m.id]));
      const updated = { ...sr.run, reflections, finishedBy, done: allDone, phase: 3, updatedAt: Date.now() };
      if (allDone) updated.completedAt = Date.now();
      if (sr.sess.mode === 'individual' || sr.me.isCaptain) {
        updated.reflection1 = reflection1;
        updated.reflection2 = reflection2;
      }
      await store.setRun(sr.code, sr.rid, updated);
      summary = {
        strategicView: sr.run.strategicView || '',
        year1: y1,
        year2: y2,
        reflection1,
        reflection2,
        year3Band: outcomes.year3.band
      };
    } else {
      if (!checkAccess(req, res)) return;
      const v1 = S.validateAllocation(b.year1);
      const v2 = S.validateAllocation(b.year2);
      if (!v1.ok || !v2.ok) return res.status(400).json({ error: 'invalid_allocations' });
      y1 = v1.allocation; y2 = v2.allocation;
      lessonThresholds = S.DEFAULT_THRESHOLDS;
      outcomes = S.evaluateAll(y1, y2, lessonThresholds);
      summary = {
        strategicView: String(b.strategicView || '').slice(0, 500),
        year1: y1,
        year2: y2,
        reflection1: String(b.reflection1 || '').slice(0, 1500),
        reflection2: String(b.reflection2 || '').slice(0, 1500),
        year3Band: outcomes.year3.band
      };
    }
  } catch (e) {
    return res.status(e.status || 500).json({ error: e.message || 'server_error' });
  }

  const closingLesson = buildClosingLesson(y1, y2, outcomes, lessonThresholds);

  summary.result = {
    overall: overallOutcomeText(outcomes),
    year1: publicOutcome(outcomes.year1),
    year2: { heat: publicOutcome(outcomes.year2 && outcomes.year2.heat), competitor: publicOutcome(outcomes.year2 && outcomes.year2.competitor) },
    year3: publicOutcome(outcomes.year3),
    cumulative: outcomes.year3 && outcomes.year3.cumulative ? outcomes.year3.cumulative : null,
    buyers: outcomes.buyers || null
  };

  // These are intentionally decision/debrief summaries rather than hidden
  // thresholds. The platform faculty progress page renders metrics directly,
  // so the facilitator can see what the student chose and reflected on after a
  // platform-launched run without opening a separate Sim03 datastore.
  const metrics = {
    openingView: summary.strategicView,
    year1Allocation: allocationLabel(y1),
    reflection1: summary.reflection1,
    reflection2: summary.reflection2,
    year1Connect: y1.connect,
    cumulativeConnect: outcomes.year3.cumulative.connect,
    cumulativeUptime: outcomes.year3.cumulative.uptime,
    cumulativeCapacity: outcomes.year3.cumulative.capacity,
    year3Band: outcomes.year3.band
  };

  // A facilitated session can be used standalone. Report back only when this
  // browser also carries a valid platform launch token.
  const lt = req.headers['x-launch-token'];
  const launch = lt ? verifyLaunch(String(lt)) : null;
  let report = { ok: false, skipped: true };
  if (launch && (!launch.sim || launch.sim === S.META.id)) {
    report = await reportCompletion({ launch, summary, metrics });
  }

  return res.status(200).json({
    ok: true,
    completionReported: !!report.ok,
    outcomes,
    closingLesson
  });
};
