// The report, and the end of the run.
//
// This is the instrument of harm: what is filed here is what the configuration
// team builds against. Validation refuses an incomplete report because omitting
// a step is dodging the decision rather than making it.
const { checkAccess, whoIsPlaying, body } = require('../lib/guard.js');
const { reportCompletion, reportTranscript } = require('../lib/launch.js');
const { validate, review } = require('../src/report');
const { buildEnvelope } = require('../src/transcript');
const { ROWS } = require('../data/report');
const R = require('../lib/run.js');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  if (!checkAccess(req, res)) return;

  const b = body(req);
  const who = whoIsPlaying(req, b);
  if (!who) return res.status(400).json({ error: 'no_run_id' });

  try {
    const { session } = await R.get(who.id);
    if (!session || !session.order) return res.status(409).json({ error: 'no_run' });

    // The form itself, so the client never has to hold a copy of the rows.
    if (String(b.action || '') === 'form') {
      return res.status(200).json({ rows: ROWS.map(function (r) {
        return { id: r.id, label: r.label, chartNote: r.chartNote };
      }) });
    }

    const submission = b.submission || {};
    const v = validate(submission);
    if (!v.ok) return res.status(400).json({ error: 'incomplete', errors: v.errors });

    const result = review(submission, session.transcript);

    // What the participant sees. Consequences, not a score — the report was
    // accurate and that is the whole difficulty.
    const shown = {
      consequences: result.consequences.map(function (c) {
        return { label: c.label, disposition: c.disposition,
                 configured: c.configured, consequence: c.consequence };
      }),
      harmFired: result.harmFired
    };

    const envelope = buildEnvelope(session, result, {
      participant: req.launch ? { id: req.launch.sub, displayName: req.launch.name || null } : null,
      cohortId: req.launch ? req.launch.course || null : null,
      observationSeconds: b.observationSeconds == null ? null : Number(b.observationSeconds),
      completedAt: new Date().toISOString()
    });

    // Awaited, both of them. A serverless function can be frozen the moment it
    // responds, and a transcript that never left the machine takes the debrief
    // with it.
    if (req.launch) {
      await reportTranscript({ launch: req.launch, envelope });
      await reportCompletion({
        launch: req.launch,
        summary: result.harmFired
          ? 'Filed a report that removed the matching judgement.'
          : 'Filed a report without firing the harm.',
        metrics: {
          questions: session.transcript.length,
          order: session.order.join(' > '),
          findings_reached: envelope.reachability.filter(function (r) { return r.held; }).length,
          findings_available: envelope.reachability.length,
          harm: result.harmFired ? 'yes' : 'no',
          observed_seconds: b.observationSeconds == null ? null : Number(b.observationSeconds)
        }
      });
    }

    return res.status(200).json(shown);
  } catch (e) {
    if (e.code === 'NO_STORE') return res.status(503).json({ error: 'no_store' });
    console.error('report failure', e.message);
    return res.status(500).json({ error: 'server_error' });
  }
};
