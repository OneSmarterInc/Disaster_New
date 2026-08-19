// Simulations register themselves here. A deployment that exists should appear
// in the catalogue without anyone typing it in, so this is called by the sim
// itself on its first request after a cold start, signed with the shared launch
// secret.
//
// Two rules make this safe to run repeatedly. It always creates as unpublished,
// so a new simulation is invisible until an administrator decides otherwise.
// And on any later announcement it refreshes only the technical facts — the
// address and duration — leaving the title, tagline and description alone once
// an administrator has edited them, because their wording should win over the
// developer's.
const { sql, id } = require('../lib/db.js');
const { verify } = require('../lib/launch.js');

function body(req) {
  let b = req.body;
  if (typeof b === 'string') { try { b = JSON.parse(b); } catch { b = null; } }
  return b || {};
}
const clip = (v, n) => v == null ? null : String(v).slice(0, n);

module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'content-type');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    return res.status(204).end();
  }
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const p = verify(String(body(req).token || ''));
  if (!p) return res.status(401).json({ error: 'bad_signature' });
  if (p.kind !== 'register' || !p.sim) return res.status(400).json({ error: 'not_a_registration' });
  if (!p.launchUrl || !/^https?:\/\//.test(p.launchUrl)) {
    return res.status(400).json({ error: 'no_address', message: 'A registration must say where it is.' });
  }

  const s = sql();
  try {
    const existing = (await s`SELECT * FROM sims WHERE id = ${p.sim}`)[0];
    const minutes = Number.isFinite(+p.minutes) ? Math.max(1, Math.min(600, Math.round(+p.minutes))) : null;

    if (!existing) {
      // Give it the next free number so it reads sensibly straight away. An
      // administrator can change it; nothing depends on the value.
      const taken = (await s`SELECT number FROM sims WHERE number IS NOT NULL`).map(r => r.number);
      let n = 1;
      while (taken.includes(n)) n++;

      await s`INSERT INTO sims (id, number, title, tagline, description, minutes, launch_url, published, detail)
              VALUES (${p.sim}, ${n}, ${clip(p.title, 200) || p.sim}, ${clip(p.tagline, 300)},
                      ${clip(p.description, 4000)}, ${minutes}, ${clip(p.launchUrl, 500)}, false,
                      ${p.detail ? JSON.stringify(p.detail).slice(0, 12000) : null})`;
      return res.status(200).json({ ok: true, created: true, number: n });
    }

    // The simulation's own copy refreshes on every announcement, except for any
    // field an administrator has rewritten — theirs wins from then on, because
    // a redeploy should not quietly undo their words.
    if (p.detail) {
      const edited = (existing.detail && existing.detail._edited) || [];
      const merged = Object.assign({}, p.detail);
      for (const k of edited) {
        if (existing.detail && existing.detail[k] !== undefined) merged[k] = existing.detail[k];
      }
      merged._edited = edited;
      await s`UPDATE sims SET detail = ${JSON.stringify(merged).slice(0, 12000)} WHERE id = ${p.sim}`;
    }

    // Already known. Keep the address and duration current — those are facts
    // about the deployment — and leave the words alone.
    await s`UPDATE sims SET launch_url = ${clip(p.launchUrl, 500)} WHERE id = ${p.sim}`;
    if (minutes) await s`UPDATE sims SET minutes = ${minutes} WHERE id = ${p.sim}`;

    // Fill in anything an administrator has never supplied.
    if (!existing.tagline && p.tagline) await s`UPDATE sims SET tagline = ${clip(p.tagline, 300)} WHERE id = ${p.sim}`;
    if (!existing.description && p.description) await s`UPDATE sims SET description = ${clip(p.description, 4000)} WHERE id = ${p.sim}`;

    return res.status(200).json({ ok: true, created: false });
  } catch (e) {
    if (e.code === 'NO_SECRET') return res.status(500).json({ error: 'no_secret' });
    if (e.code === 'NO_DB') return res.status(503).json({ error: 'no_db' });
    console.error('registration failure', e.message);
    return res.status(500).json({ error: 'server_error' });
  }
};
