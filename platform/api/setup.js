// Run once against a fresh database. Creates the tables, seeds the catalogue,
// and makes the first admin. Refuses to do anything if an admin already exists,
// so it can't be used to mint a second one later.
const fs = require('fs');
const path = require('path');
const { sql, id } = require('../lib/db.js');
const { hashPassword, startSession } = require('../lib/auth.js');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  let b = req.body;
  if (typeof b === 'string') { try { b = JSON.parse(b); } catch { b = {}; } }
  b = b || {};

  const setupKey = process.env.SETUP_KEY;
  if (!setupKey) return res.status(500).json({ error: 'SETUP_KEY is not set on this deployment.' });
  if (b.setupKey !== setupKey) return res.status(401).json({ error: 'bad_setup_key' });

  const s = sql();

  try {
    const schema = fs.readFileSync(path.join(process.cwd(), 'lib', 'schema.sql'), 'utf8');
    // neon's http driver takes one statement at a time
    for (const stmt of schema.split(';').map(x => x.trim()).filter(x => x && !x.startsWith('--'))) {
      await s.query(stmt);
    }
  } catch (e) {
    console.error('schema failure', e.message);
    return res.status(500).json({ error: 'schema_failed', message: e.message });
  }

  const existing = await s`SELECT id FROM users WHERE role = 'admin' LIMIT 1`;
  if (existing.length) {
    return res.status(200).json({ ok: true, note: 'Schema is up to date. An admin already exists, so none was created.' });
  }

  const email = String(b.email || '').trim().toLowerCase();
  const name = String(b.name || '').trim();
  const password = String(b.password || '');
  if (!email || !name || password.length < 8) {
    return res.status(400).json({ error: 'need_admin_details', message: 'Give a name, an email, and a password of at least 8 characters.' });
  }

  const uid = id('usr');
  await s`INSERT INTO users (id, email, name, role, password_hash)
          VALUES (${uid}, ${email}, ${name}, 'admin', ${hashPassword(password)})`;

  // Seed the catalogue with the sim we already have.
  const simUrl = process.env.RAPID_01_URL || '';
  if (simUrl) {
    await s`INSERT INTO sims (id, title, tagline, description, minutes, launch_url, published)
            VALUES ('rapid-01-disaster', 'Disaster or Breach?',
              'Twenty minutes inside an incident nobody can classify yet.',
              'Data corruption is spreading across client applications. A failing storage array and an intruder look identical at Hour 4, and the two response playbooks are opposed. Students take expert advice from people whose exposure runs in opposite directions.',
              20, ${simUrl}, true)
            ON CONFLICT (id) DO UPDATE SET launch_url = EXCLUDED.launch_url`;
  }

  await startSession(res, uid);
  return res.status(200).json({ ok: true, admin: { id: uid, email, name }, seededSim: !!simUrl });
};
