const { sql, id, joinCode } = require('../lib/db.js');
const A = require('../lib/auth.js');

function body(req) {
  let b = req.body;
  if (typeof b === 'string') { try { b = JSON.parse(b); } catch { b = null; } }
  return b || {};
}
const baseUrl = () => (process.env.PUBLIC_BASE_URL || '').replace(/\/$/, '');

// Confirms this course belongs to the person asking.
async function ownCourse(s, facultyId, courseId) {
  const rows = await s`SELECT * FROM courses WHERE id = ${courseId} AND faculty_id = ${facultyId}`;
  return rows[0] || null;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const me = await A.requireRole(req, res, 'faculty', 'admin');
  if (!me) return;

  const b = body(req);
  const s = sql();

  try {
    switch (String(b.action || '')) {

      case 'overview': {
        const courses = await s`
          SELECT c.*,
            (SELECT count(*) FROM enrolments e WHERE e.course_id = c.id AND e.dropped = false) AS enrolled,
            (SELECT count(*) FROM enrolments e WHERE e.course_id = c.id AND e.dropped = false AND e.paid = true) AS paid,
            (SELECT count(*) FROM course_sims cs WHERE cs.course_id = c.id) AS sims
          FROM courses c WHERE c.faculty_id = ${me.id} AND c.archived = false
          ORDER BY c.created_at DESC`;
        const catalogue = await s`SELECT * FROM sims WHERE published = true ORDER BY created_at`;
        const previews = await s`SELECT * FROM previews WHERE user_id = ${me.id}`;
        return res.status(200).json({ courses, catalogue, previews, baseUrl: baseUrl(), me: A.publicUser(me) });
      }

      // Every simulation this person is using, across all their courses, with
      // how many students have actually played it.
      case 'sims_overview': {
        const rows = await s`
          SELECT si.id, si.title, si.tagline, si.minutes,
                 count(DISTINCT c.id) AS courses,
                 count(DISTINCT e.student_id) FILTER (WHERE e.dropped = false) AS enrolled,
                 count(DISTINCT e.student_id) FILTER (WHERE e.dropped = false AND e.paid = true) AS released,
                 count(DISTINCT l.user_id) FILTER (WHERE l.as_role = 'student') AS started,
                 count(DISTINCT cp.user_id) AS finished
          FROM course_sims cs
          JOIN courses c ON c.id = cs.course_id AND c.faculty_id = ${me.id} AND c.archived = false
          JOIN sims si ON si.id = cs.sim_id
          LEFT JOIN enrolments e ON e.course_id = c.id
          LEFT JOIN launches l ON l.course_id = c.id AND l.sim_id = si.id
          LEFT JOIN completions cp ON cp.course_id = c.id AND cp.sim_id = si.id
          GROUP BY si.id, si.title, si.tagline, si.minutes
          ORDER BY si.title`;
        return res.status(200).json({ sims: rows });
      }

      // Who in this course has played this sim, and what came back.
      case 'sim_progress': {
        const course = await ownCourse(s, me.id, String(b.courseId || ''));
        if (!course) return res.status(404).json({ error: 'no_such_course' });
        const simId = String(b.simId || '');
        const rows = await s`
          SELECT u.id AS student_id, u.name, u.email, e.paid, e.dropped,
                 (SELECT count(*) FROM launches l
                   WHERE l.user_id = u.id AND l.course_id = ${course.id} AND l.sim_id = ${simId}) AS starts,
                 cp.completed_at, cp.duration_seconds, cp.summary, cp.metrics
          FROM enrolments e
          JOIN users u ON u.id = e.student_id
          LEFT JOIN LATERAL (
            SELECT * FROM completions c2
            WHERE c2.user_id = u.id AND c2.course_id = ${course.id} AND c2.sim_id = ${simId}
            ORDER BY c2.completed_at DESC LIMIT 1
          ) cp ON true
          WHERE e.course_id = ${course.id}
          ORDER BY e.dropped, u.name`;
        const sim = (await s`SELECT id, title FROM sims WHERE id = ${simId}`)[0];
        return res.status(200).json({ sim, course, rows });
      }

      case 'create_course': {
        const title = String(b.title || '').trim();
        if (!title) return res.status(400).json({ error: 'need_title' });
        const cid = id('crs');
        // join codes are short; retry on the rare collision
        let code = joinCode();
        for (let i = 0; i < 5; i++) {
          const clash = await s`SELECT id FROM courses WHERE join_code = ${code}`;
          if (!clash.length) break;
          code = joinCode();
        }
        await s`INSERT INTO courses (id, faculty_id, title, term, join_code)
                VALUES (${cid}, ${me.id}, ${title}, ${String(b.term || '').trim() || null}, ${code})`;
        return res.status(200).json({ courseId: cid, joinCode: code });
      }

      case 'course_detail': {
        const course = await ownCourse(s, me.id, String(b.courseId || ''));
        if (!course) return res.status(404).json({ error: 'no_such_course' });
        const sims = await s`
          SELECT cs.*, si.title, si.minutes, si.tagline,
            (SELECT count(DISTINCT l.user_id) FROM launches l
              WHERE l.course_id = ${course.id} AND l.sim_id = cs.sim_id AND l.as_role = 'student') AS started,
            (SELECT count(DISTINCT c2.user_id) FROM completions c2
              WHERE c2.course_id = ${course.id} AND c2.sim_id = cs.sim_id) AS finished
          FROM course_sims cs JOIN sims si ON si.id = cs.sim_id
          WHERE cs.course_id = ${course.id} ORDER BY cs.added_at`;
        const roster = await s`
          SELECT e.id AS enrolment_id, e.paid, e.paid_at, e.paid_note, e.dropped, e.created_at,
                 u.id AS student_id, u.name, u.email, u.last_seen_at,
                 (SELECT count(*) FROM launches l WHERE l.user_id = u.id AND l.course_id = e.course_id) AS launches
          FROM enrolments e JOIN users u ON u.id = e.student_id
          WHERE e.course_id = ${course.id}
          ORDER BY e.dropped, u.name`;
        const catalogue = await s`SELECT * FROM sims WHERE published = true ORDER BY created_at`;
        return res.status(200).json({
          course, sims, roster, catalogue,
          enrolUrl: `${baseUrl()}/join.html?c=${course.join_code}`
        });
      }

      case 'update_course': {
        const course = await ownCourse(s, me.id, String(b.courseId || ''));
        if (!course) return res.status(404).json({ error: 'no_such_course' });
        if (b.title !== undefined) await s`UPDATE courses SET title = ${String(b.title).trim()} WHERE id = ${course.id}`;
        if (b.term !== undefined) await s`UPDATE courses SET term = ${String(b.term).trim() || null} WHERE id = ${course.id}`;
        if (b.archived !== undefined) await s`UPDATE courses SET archived = ${!!b.archived} WHERE id = ${course.id}`;
        return res.status(200).json({ ok: true });
      }

      case 'delete_course': {
        const course = await ownCourse(s, me.id, String(b.courseId || ''));
        if (!course) return res.status(404).json({ error: 'no_such_course' });
        const played = await s`SELECT count(*)::int AS n FROM launches WHERE course_id = ${course.id}`;
        if (played[0] && played[0].n > 0 && !b.force) {
          return res.status(409).json({ error: 'has_history',
            message: `Students have opened simulations in this course ${played[0].n} time${played[0].n === 1 ? '' : 's'}. Archive it instead to keep the record, or confirm to delete it and that history.` });
        }
        await s`DELETE FROM courses WHERE id = ${course.id}`;
        return res.status(200).json({ ok: true });
      }

      case 'add_sim': {
        const course = await ownCourse(s, me.id, String(b.courseId || ''));
        if (!course) return res.status(404).json({ error: 'no_such_course' });
        const simId = String(b.simId || '');
        const seats = b.expectedSeats ? parseInt(b.expectedSeats, 10) : null;
        await s`INSERT INTO course_sims (course_id, sim_id, expected_seats, hard_cap)
                VALUES (${course.id}, ${simId}, ${seats}, ${!!b.hardCap})
                ON CONFLICT (course_id, sim_id) DO UPDATE
                SET expected_seats = EXCLUDED.expected_seats, hard_cap = EXCLUDED.hard_cap`;
        return res.status(200).json({ ok: true });
      }

      case 'remove_sim': {
        const course = await ownCourse(s, me.id, String(b.courseId || ''));
        if (!course) return res.status(404).json({ error: 'no_such_course' });
        await s`DELETE FROM course_sims WHERE course_id = ${course.id} AND sim_id = ${String(b.simId || '')}`;
        return res.status(200).json({ ok: true });
      }

      // Marks individuals, or the whole course at once. This is the entitlement
      // switch — payment happens outside the system and lands here.
      case 'set_paid': {
        const course = await ownCourse(s, me.id, String(b.courseId || ''));
        if (!course) return res.status(404).json({ error: 'no_such_course' });
        const paid = !!b.paid;
        const note = String(b.note || '').trim() || null;
        if (b.all) {
          if (paid) {
            await s`UPDATE enrolments SET paid = true, paid_at = now(), paid_by = ${me.id}, paid_note = ${note}
                    WHERE course_id = ${course.id} AND dropped = false AND paid = false`;
          } else {
            await s`UPDATE enrolments SET paid = false, paid_at = NULL, paid_by = NULL
                    WHERE course_id = ${course.id} AND dropped = false`;
          }
        } else {
          const ids = Array.isArray(b.enrolmentIds) ? b.enrolmentIds.map(String) : [];
          if (!ids.length) return res.status(400).json({ error: 'nobody_selected' });
          if (paid) {
            await s`UPDATE enrolments SET paid = true, paid_at = now(), paid_by = ${me.id}, paid_note = ${note}
                    WHERE course_id = ${course.id} AND id = ANY(${ids})`;
          } else {
            await s`UPDATE enrolments SET paid = false, paid_at = NULL, paid_by = NULL
                    WHERE course_id = ${course.id} AND id = ANY(${ids})`;
          }
        }
        return res.status(200).json({ ok: true });
      }

      case 'set_dropped': {
        const course = await ownCourse(s, me.id, String(b.courseId || ''));
        if (!course) return res.status(404).json({ error: 'no_such_course' });
        await s`UPDATE enrolments SET dropped = ${!!b.dropped}
                WHERE course_id = ${course.id} AND id = ${String(b.enrolmentId || '')}`;
        return res.status(200).json({ ok: true });
      }

      // Seven days to look at a sim before committing a course to it.
      case 'start_preview': {
        const simId = String(b.simId || '');
        const exists = await s`SELECT id FROM sims WHERE id = ${simId} AND published = true`;
        if (!exists.length) return res.status(404).json({ error: 'no_such_sim' });
        const expires = new Date(Date.now() + 7 * 86400000);
        await s`INSERT INTO previews (id, user_id, sim_id, expires_at)
                VALUES (${id('prv')}, ${me.id}, ${simId}, ${expires})
                ON CONFLICT (user_id, sim_id) DO NOTHING`;
        const row = (await s`SELECT * FROM previews WHERE user_id = ${me.id} AND sim_id = ${simId}`)[0];
        return res.status(200).json({ preview: row });
      }

      default:
        return res.status(400).json({ error: 'unknown_action' });
    }
  } catch (e) {
    if (e.code === 'NO_DB') return res.status(503).json({ error: 'no_db' });
    console.error('faculty failure', e.message);
    return res.status(500).json({ error: 'server_error', message: e.message });
  }
};
