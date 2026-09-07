const { checkAccess, body } = require('../lib/guard.js');
const { reportCompletion } = require('../lib/launch.js');
const { verifyLaunch } = require('../lib/launch.js');
const S = require('../lib/scenario.js');
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
  return { sess, run };
}

function allocationLabel(a) {
  return `Run ${a.run} · Uptime ${a.uptime} · Capacity ${a.capacity} · Connect ${a.connect} · Features ${a.features}`;
}

module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const b = body(req);
  let y1, y2, outcomes, summary;

  try {
    const sr = await sessionRun(b);
    if (sr) {
      y1 = sr.run.year1;
      y2 = sr.run.year2;
      outcomes = sr.run.outcomes || S.evaluateAll(y1, y2, sr.sess.thresholds);
      summary = {
        strategicView: sr.run.strategicView || '',
        year1: y1,
        year2: y2,
        reflection1: sr.run.reflection1 || '',
        reflection2: sr.run.reflection2 || '',
        year3Band: outcomes.year3.band
      };
    } else {
      if (!checkAccess(req, res)) return;
      const v1 = S.validateAllocation(b.year1);
      const v2 = S.validateAllocation(b.year2);
      if (!v1.ok || !v2.ok) return res.status(400).json({ error: 'invalid_allocations' });
      y1 = v1.allocation; y2 = v2.allocation;
      outcomes = S.evaluateAll(y1, y2, S.DEFAULT_THRESHOLDS);
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
    outcomes
  });
};
