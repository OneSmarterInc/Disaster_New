// Sims report completions here. The message is signed with the same shared
// secret used for launches, so this is the same contract running the other way.
//
// The platform learns that a person finished, roughly how long it took, and
// whatever summary the sim chose to send. It learns nothing about the scenario,
// and the sim keeps no record of the person.
const crypto = require('crypto');
const { sql, id } = require('../lib/db.js');
const { verify } = require('../lib/launch.js');

function body(req) {
  let b = req.body;
  if (typeof b === 'string') { try { b = JSON.parse(b); } catch { b = null; } }
  return b || {};
}

module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'content-type');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    return res.status(204).end();
  }
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const b = body(req);
  const payload = verify(String(b.token || ''));
  if (!payload) return res.status(401).json({ error: 'bad_signature' });
  if (!payload.sub || !payload.sim) return res.status(400).json({ error: 'incomplete_token' });

  const s = sql();
  try {
    // Only accept a completion for someone who really launched this sim.
    const known = await s`
      SELECT 1 FROM launches
      WHERE user_id = ${payload.sub} AND sim_id = ${payload.sim}
      LIMIT 1`;
    if (!known.length) return res.status(404).json({ error: 'no_matching_launch' });

    const dur = payload.duration && Number.isFinite(+payload.duration)
      ? Math.max(0, Math.min(86400, Math.round(+payload.duration))) : null;

    let metrics = null;
    if (payload.metrics && typeof payload.metrics === 'object') {
      // Keep it small — this is a summary, not a transcript.
      const trimmed = {};
      Object.entries(payload.metrics).slice(0, 12).forEach(([k, v]) => {
        trimmed[String(k).slice(0, 60)] = typeof v === 'string' ? v.slice(0, 200) : v;
      });
      metrics = trimmed;
    }

    await s`INSERT INTO completions (id, user_id, sim_id, course_id, duration_seconds, summary, metrics)
            VALUES (${id('cmp')}, ${payload.sub}, ${payload.sim}, ${payload.course || null},
                    ${dur}, ${payload.summary ? String(payload.summary).slice(0, 400) : null},
                    ${metrics ? JSON.stringify(metrics) : null})`;

    return res.status(200).json({ ok: true });
  } catch (e) {
    if (e.code === 'NO_SECRET') return res.status(500).json({ error: 'no_secret' });
    if (e.code === 'NO_DB') return res.status(503).json({ error: 'no_db' });
    console.error('completion failure', e.message);
    return res.status(500).json({ error: 'server_error' });
  }
};
