const { checkAccess, body } = require('../lib/guard.js');
const S = require('../lib/scenario.js');
const store = require('../lib/store.js');

function evaluate(stage, y1, y2, thresholds) {
  if (stage === 'year1') return { outcome: S.evaluateYear1(y1, thresholds) };
  if (stage === 'year2') return { outcome: S.evaluateYear2(y1, y2, thresholds) };
  if (stage === 'year3' || stage === 'all') {
    return { outcome: S.evaluateAll(y1, y2, thresholds) };
  }
  return null;
}

async function fromSession(b, res) {
  const code = String(b.sessionCode || '').toUpperCase().trim();
  const pid = String(b.participantId || '');
  if (!code || !pid || !store.configured()) return false;

  const sess = await store.getSession(code);
  if (!sess) { res.status(404).json({ error: 'no_such_session' }); return true; }
  const participants = await store.getParticipants(code);
  const me = participants[pid];
  if (!me) { res.status(403).json({ error: 'not_joined' }); return true; }
  if (sess.mode === 'team' && !me.isCaptain) {
    res.status(403).json({ error: 'team_lead_only', message: 'Only the selected team runner opens and advances the simulation.' });
    return true;
  }

  const rid = sess.mode === 'individual' ? `individual:${me.id}` : me.groupId;
  if (!rid) { res.status(409).json({ error: 'team_not_assigned' }); return true; }
  const run = (await store.getRuns(code))[rid];
  if (!run) { res.status(409).json({ error: 'nothing_committed_yet' }); return true; }

  const stage = String(b.stage || '');
  if (!run.year1) { res.status(409).json({ error: 'year1_not_committed' }); return true; }
  if (stage !== 'year1' && !run.year2) {
    res.status(409).json({ error: 'year2_not_committed' });
    return true;
  }

  const result = evaluate(stage, run.year1, run.year2, sess.thresholds);
  if (!result) { res.status(400).json({ error: 'unknown_stage' }); return true; }
  res.status(200).json(result);
  return true;
}

module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const b = body(req);
  try {
    if (await fromSession(b, res)) return;
  } catch (e) {
    console.error('session outcome lookup failed', e.message);
    return res.status(500).json({ error: 'server_error' });
  }

  if (!checkAccess(req, res)) return;

  const stage = String(b.stage || '');
  const v1 = S.validateAllocation(b.year1);
  if (!v1.ok) return res.status(400).json(v1);

  if (stage === 'year1') {
    return res.status(200).json(evaluate(stage, v1.allocation, null, S.DEFAULT_THRESHOLDS));
  }

  const v2 = S.validateAllocation(b.year2);
  if (!v2.ok) return res.status(400).json(v2);
  const result = evaluate(stage, v1.allocation, v2.allocation, S.DEFAULT_THRESHOLDS);
  if (!result) return res.status(400).json({ error: 'unknown_stage' });
  return res.status(200).json(result);
};
