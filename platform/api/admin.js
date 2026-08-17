const crypto = require('crypto');
const SCHEMA = require('../lib/schema.js');
const { sql, id } = require('../lib/db.js');
const A = require('../lib/auth.js');

function body(req) {
  let b = req.body;
  if (typeof b === 'string') { try { b = JSON.parse(b); } catch { b = null; } }
  return b || {};
}
const baseUrl = () => (process.env.PUBLIC_BASE_URL || '').replace(/\/$/, '');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const me = await A.requireRole(req, res, 'admin');
  if (!me) return;

  const b = body(req);
  const s = sql();

  try {
    switch (String(b.action || '')) {

      // Everything the admin dashboard shows in one call.
      case 'overview': {
        const faculty = await s`
          SELECT u.id, u.name, u.email, u.institution, u.created_at, u.last_seen_at, u.disabled,
                 u.password_hash IS NOT NULL AS accepted,
                 (SELECT count(*) FROM courses c WHERE c.faculty_id = u.id AND c.archived = false) AS courses,
                 (SELECT count(*) FROM enrolments e JOIN courses c ON c.id = e.course_id
                   WHERE c.faculty_id = u.id AND e.dropped = false) AS students,
                 (SELECT count(*) FROM enrolments e JOIN courses c ON c.id = e.course_id
                   WHERE c.faculty_id = u.id AND e.dropped = false AND e.paid = true) AS paid_students
          FROM users u WHERE u.role = 'faculty' ORDER BY u.created_at DESC`;
        const sims = await s`SELECT * FROM sims ORDER BY created_at`;
        const totals = (await s`
          SELECT
            (SELECT count(*) FROM users WHERE role = 'student') AS students,
            (SELECT count(*) FROM courses WHERE archived = false) AS courses,
            (SELECT count(*) FROM enrolments WHERE paid = true AND dropped = false) AS paid_seats,
            (SELECT count(*) FROM launches) AS launches`)[0];
        return res.status(200).json({ faculty, sims, totals, baseUrl: baseUrl() });
      }

      // One faculty member, their courses, and who's in them.
      case 'faculty_detail': {
        const fid = String(b.facultyId || '');
        const person = (await s`SELECT id, name, email, institution, created_at, last_seen_at, disabled,
                                       password_hash IS NOT NULL AS accepted
                                FROM users WHERE id = ${fid} AND role = 'faculty'`)[0];
        if (!person) return res.status(404).json({ error: 'no_such_faculty' });
        const courses = await s`
          SELECT c.*,
            (SELECT count(*) FROM enrolments e WHERE e.course_id = c.id AND e.dropped = false) AS enrolled,
            (SELECT count(*) FROM enrolments e WHERE e.course_id = c.id AND e.dropped = false AND e.paid = true) AS paid
          FROM courses c WHERE c.faculty_id = ${fid} ORDER BY c.created_at DESC`;
        const students = await s`
          SELECT e.id AS enrolment_id, e.course_id, e.paid, e.paid_at, e.paid_note, e.dropped,
                 u.id AS student_id, u.name, u.email, u.last_seen_at,
                 (SELECT count(*) FROM launches l WHERE l.user_id = u.id AND l.course_id = e.course_id) AS launches
          FROM enrolments e
          JOIN users u ON u.id = e.student_id
          JOIN courses c ON c.id = e.course_id
          WHERE c.faculty_id = ${fid}
          ORDER BY u.name`;
        const courseSims = await s`
          SELECT cs.*, si.title FROM course_sims cs
          JOIN courses c ON c.id = cs.course_id
          JOIN sims si ON si.id = cs.sim_id
          WHERE c.faculty_id = ${fid}`;
        return res.status(200).json({ person, courses, students, courseSims });
      }

      // Creates the account and returns a one-time link to send by hand.
      // No email service involved.
      case 'invite_faculty': {
        const email = String(b.email || '').trim().toLowerCase();
        const name = String(b.name || '').trim();
        const institution = String(b.institution || '').trim() || null;
        if (!email || !name) return res.status(400).json({ error: 'need_name_and_email' });

        let uid;
        const existing = (await s`SELECT id, role FROM users WHERE email = ${email}`)[0];
        if (existing) {
          if (existing.role !== 'faculty') return res.status(409).json({ error: 'email_in_use', message: 'That email already belongs to a different kind of account.' });
          uid = existing.id;
        } else {
          uid = id('usr');
          await s`INSERT INTO users (id, email, name, role, institution)
                  VALUES (${uid}, ${email}, ${name}, 'faculty', ${institution})`;
        }

        const token = crypto.randomBytes(24).toString('base64url');
        const expires = new Date(Date.now() + 14 * 86400000);
        await s`INSERT INTO tokens (token, user_id, purpose, expires_at)
                VALUES (${token}, ${uid}, 'invite', ${expires})`;
        return res.status(200).json({
          facultyId: uid,
          inviteUrl: `${baseUrl()}/accept.html?t=${token}`,
          expiresAt: expires
        });
      }

      // Cancels any unused invitation for this person, so a link sent to the
      // wrong address stops working.
      case 'revoke_invites': {
        const uid = String(b.facultyId || '');
        const r = await s`UPDATE tokens SET used_at = now()
                          WHERE user_id = ${uid} AND purpose = 'invite' AND used_at IS NULL`;
        return res.status(200).json({ ok: true });
      }

      // Only for accounts that never got used. Anyone with courses should be
      // disabled instead, so their students' history survives.
      case 'delete_faculty': {
        const uid = String(b.facultyId || '');
        const person = (await s`SELECT id, name FROM users WHERE id = ${uid} AND role = 'faculty'`)[0];
        if (!person) return res.status(404).json({ error: 'no_such_faculty' });
        const courses = await s`SELECT id FROM courses WHERE faculty_id = ${uid}`;
        if (courses.length) {
          return res.status(409).json({ error: 'has_courses',
            message: `${person.name} has ${courses.length} course${courses.length === 1 ? '' : 's'}. Disable the account instead — deleting would take their students' history with it.` });
        }
        await s`DELETE FROM users WHERE id = ${uid}`;
        return res.status(200).json({ ok: true });
      }

      case 'set_faculty_disabled': {
        await s`UPDATE users SET disabled = ${!!b.disabled} WHERE id = ${String(b.facultyId || '')} AND role = 'faculty'`;
        return res.status(200).json({ ok: true });
      }

      // ---------- catalogue ----------
      case 'save_sim': {
        const sid = String(b.id || '').trim();
        if (!sid) return res.status(400).json({ error: 'need_id' });
        await s`
          INSERT INTO sims (id, title, tagline, description, minutes, launch_url, published)
          VALUES (${sid}, ${String(b.title || '')}, ${b.tagline || null}, ${b.description || null},
                  ${b.minutes ? parseInt(b.minutes, 10) : null}, ${String(b.launchUrl || '')}, ${!!b.published})
          ON CONFLICT (id) DO UPDATE SET
            title = EXCLUDED.title, tagline = EXCLUDED.tagline, description = EXCLUDED.description,
            minutes = EXCLUDED.minutes, launch_url = EXCLUDED.launch_url, published = EXCLUDED.published`;
        // Once it's published, review grants mean nothing and would otherwise
        // accumulate as rows nobody reads.
        if (b.published) await s`DELETE FROM sim_access WHERE sim_id = ${sid}`;
        return res.status(200).json({ ok: true });
      }

      // Every course across every facilitator, for when the question is
      // "who is running what right now" rather than "how is Chuck doing".
      case 'all_courses': {
        const courses = await s`
          SELECT c.id, c.title, c.term, c.join_code, c.archived, c.created_at,
                 u.id AS faculty_id, u.name AS faculty_name, u.institution,
                 (SELECT count(*) FROM enrolments e WHERE e.course_id = c.id AND e.dropped = false) AS enrolled,
                 (SELECT count(*) FROM enrolments e WHERE e.course_id = c.id AND e.dropped = false AND e.paid = true) AS paid,
                 (SELECT count(*) FROM launches l WHERE l.course_id = c.id) AS launches,
                 (SELECT string_agg(si.title, ', ') FROM course_sims cs JOIN sims si ON si.id = cs.sim_id
                   WHERE cs.course_id = c.id) AS sim_titles
          FROM courses c JOIN users u ON u.id = c.faculty_id
          ORDER BY c.created_at DESC`;
        return res.status(200).json({ courses });
      }

      // No email service, so a reset is a link the admin hands over.
      case 'issue_reset': {
        const uid = String(b.userId || '');
        const person = (await s`SELECT id, name, email FROM users WHERE id = ${uid}`)[0];
        if (!person) return res.status(404).json({ error: 'no_such_user' });
        const token = crypto.randomBytes(24).toString('base64url');
        const expires = new Date(Date.now() + 3 * 86400000);
        await s`INSERT INTO tokens (token, user_id, purpose, expires_at)
                VALUES (${token}, ${uid}, 'reset', ${expires})`;
        return res.status(200).json({
          resetUrl: `${baseUrl()}/reset.html?t=${token}`,
          who: person.name, expiresAt: expires
        });
      }

      // Brings the database up to date after a release that adds tables or
      // indexes. Every statement is CREATE ... IF NOT EXISTS, so running it
      // repeatedly is harmless and it never drops anything.
      case 'migrate': {
        const runRaw = (text) => {
          if (typeof s.query === 'function') return s.query(text);
          const parts = [text]; parts.raw = [text];
          return s(parts);
        };
        let done = 0;
        for (const stmt of SCHEMA) { await runRaw(stmt); done++; }
        return res.status(200).json({ ok: true, statements: done });
      }

      // Wipes everything except administrators and the catalogue, so a pilot
      // can be run again from nothing. Guarded by typing the phrase out.
      case 'reset_test_data': {
        if (String(b.confirm || '') !== 'DELETE EVERYTHING') {
          return res.status(400).json({ error: 'not_confirmed',
            message: 'Type DELETE EVERYTHING exactly to confirm.' });
        }
        await s`DELETE FROM completions`;
        await s`DELETE FROM launches`;
        await s`DELETE FROM enrolments`;
        await s`DELETE FROM course_sims`;
        await s`DELETE FROM courses`;
        await s`DELETE FROM previews`;
        await s`DELETE FROM tokens WHERE user_id IN (SELECT id FROM users WHERE role <> 'admin')`;
        await s`DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE role <> 'admin')`;
        await s`DELETE FROM users WHERE role <> 'admin'`;
        return res.status(200).json({ ok: true });
      }

      case 'delete_sim': {
        const sid = String(b.simId || '');
        const used = await s`SELECT count(*)::int AS n FROM course_sims WHERE sim_id = ${sid}`;
        if (used[0] && used[0].n > 0 && !b.force) {
          return res.status(409).json({ error: 'in_use',
            message: `That simulation is in ${used[0].n} course${used[0].n === 1 ? '' : 's'}. Unpublish it instead, or confirm to remove it from them.` });
        }
        await s`DELETE FROM sims WHERE id = ${sid}`;
        return res.status(200).json({ ok: true });
      }

      // ---------- pre-publication review ----------
      case 'grant_sim_access': {
        const simId = String(b.simId || '');
        const email = String(b.email || '').trim().toLowerCase();
        const sim = (await s`SELECT id, title, published FROM sims WHERE id = ${simId}`)[0];
        if (!sim) return res.status(404).json({ error: 'no_such_sim' });
        const person = (await s`SELECT id, name, role FROM users WHERE email = ${email}`)[0];
        if (!person) return res.status(404).json({ error: 'no_such_user',
          message: 'Nobody with that email has an account yet. Invite them first.' });
        if (person.role === 'student') return res.status(409).json({ error: 'is_a_student',
          message: 'Review access is for facilitators and administrators.' });
        await s`INSERT INTO sim_access (id, user_id, sim_id, granted_by, note)
                VALUES (${id('acc')}, ${person.id}, ${simId}, ${me.id}, ${String(b.note || '').trim() || null})
                ON CONFLICT (user_id, sim_id) DO UPDATE SET note = EXCLUDED.note, granted_by = EXCLUDED.granted_by`;
        return res.status(200).json({ ok: true, who: person.name });
      }

      case 'revoke_sim_access': {
        await s`DELETE FROM sim_access WHERE id = ${String(b.grantId || '')}`;
        return res.status(200).json({ ok: true });
      }

      case 'sim_access_list': {
        // Two statements rather than one composed query — the neon driver's
        // tagged templates can't be nested.
        const simId = String(b.simId || '');
        const rows = simId
          ? await s`
              SELECT sa.id, sa.sim_id, sa.note, sa.created_at,
                     u.id AS user_id, u.name, u.email, u.role, g.name AS granted_by_name
              FROM sim_access sa
              JOIN users u ON u.id = sa.user_id
              LEFT JOIN users g ON g.id = sa.granted_by
              WHERE sa.sim_id = ${simId}
              ORDER BY sa.created_at DESC`
          : await s`
              SELECT sa.id, sa.sim_id, sa.note, sa.created_at,
                     u.id AS user_id, u.name, u.email, u.role, g.name AS granted_by_name
              FROM sim_access sa
              JOIN users u ON u.id = sa.user_id
              LEFT JOIN users g ON g.id = sa.granted_by
              ORDER BY sa.created_at DESC`;
        return res.status(200).json({ grants: rows });
      }

      default:
        return res.status(400).json({ error: 'unknown_action' });
    }
  } catch (e) {
    if (e.code === 'NO_DB') return res.status(503).json({ error: 'no_db' });
    console.error('admin failure', e.message);
    return res.status(500).json({ error: 'server_error', message: e.message });
  }
};
