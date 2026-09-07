from pathlib import Path

# Clean the accidental duplicate loader definition.
p=Path('platform/public/faculty.html')
s=p.read_text()
fn="""async function openStudentResults(courseId, studentId) {
  try { F.studentResults = await api('/api/faculty', { action:'student_results', courseId, studentId }); F.view = 'student-results'; F.err = null; }
  catch (e) { F.err = e.message; }
  render();
}
"""
if s.count(fn) == 2:
    s=s.replace(fn+fn, fn, 1)
elif s.count(fn) != 1:
    raise SystemExit('unexpected openStudentResults count')
p.write_text(s)

# Legacy rows can have a null course_id from older completion/transcript code.
# Keep those visible only when there was a real student launch of that sim in
# this exact course, so a preview or another course cannot bleed into results.
p=Path('platform/api/faculty.js')
s=p.read_text()
repls=[
("""            WHERE c2.user_id = u.id AND c2.sim_id = ${simId}
              AND (c2.course_id = ${course.id} OR c2.course_id IS NULL)
            ORDER BY (c2.course_id = ${course.id}) DESC, c2.completed_at DESC LIMIT 1
""","""            WHERE c2.user_id = u.id AND c2.sim_id = ${simId}
              AND (c2.course_id = ${course.id} OR (c2.course_id IS NULL AND EXISTS (
                SELECT 1 FROM launches lx WHERE lx.user_id = u.id AND lx.course_id = ${course.id}
                  AND lx.sim_id = ${simId} AND lx.as_role = 'student'
              )))
            ORDER BY (c2.course_id = ${course.id}) DESC, c2.completed_at DESC LIMIT 1
"""),
("""            WHERE t.user_id = u.id AND t.sim_id = ${simId}
              AND (t.course_id = ${course.id} OR t.course_id IS NULL)
            ORDER BY (t.course_id = ${course.id}) DESC, t.recorded_at DESC LIMIT 1
""","""            WHERE t.user_id = u.id AND t.sim_id = ${simId}
              AND (t.course_id = ${course.id} OR (t.course_id IS NULL AND EXISTS (
                SELECT 1 FROM launches lxt WHERE lxt.user_id = u.id AND lxt.course_id = ${course.id}
                  AND lxt.sim_id = ${simId} AND lxt.as_role = 'student'
              )))
            ORDER BY (t.course_id = ${course.id}) DESC, t.recorded_at DESC LIMIT 1
"""),
("""            WHERE c2.user_id = ${studentId} AND c2.sim_id = si.id
              AND (c2.course_id = ${course.id} OR c2.course_id IS NULL)
            ORDER BY (c2.course_id = ${course.id}) DESC, c2.completed_at DESC LIMIT 1
""","""            WHERE c2.user_id = ${studentId} AND c2.sim_id = si.id
              AND (c2.course_id = ${course.id} OR (c2.course_id IS NULL AND EXISTS (
                SELECT 1 FROM launches l4 WHERE l4.user_id = ${studentId} AND l4.course_id = ${course.id}
                  AND l4.sim_id = si.id AND l4.as_role = 'student'
              )))
            ORDER BY (c2.course_id = ${course.id}) DESC, c2.completed_at DESC LIMIT 1
"""),
("""            WHERE t.user_id = ${studentId} AND t.sim_id = si.id
              AND (t.course_id = ${course.id} OR t.course_id IS NULL)
            ORDER BY (t.course_id = ${course.id}) DESC, t.recorded_at DESC LIMIT 1
""","""            WHERE t.user_id = ${studentId} AND t.sim_id = si.id
              AND (t.course_id = ${course.id} OR (t.course_id IS NULL AND EXISTS (
                SELECT 1 FROM launches l5 WHERE l5.user_id = ${studentId} AND l5.course_id = ${course.id}
                  AND l5.sim_id = si.id AND l5.as_role = 'student'
              )))
            ORDER BY (t.course_id = ${course.id}) DESC, t.recorded_at DESC LIMIT 1
""")]
for old,new in repls:
    if old in s:
        s=s.replace(old,new,1)
    elif new not in s:
        raise SystemExit('course matching marker missing')
p.write_text(s)

p=Path('platform/tools/check-faculty-student-results.js')
s=p.read_text()
anchor="""assert(facultyApi.includes("AND l.as_role = 'student'"), 'faculty/preview launches can leak into student counts');
"""
extra=anchor+"""assert(facultyHtml.split('async function openStudentResults(').length - 1 === 1, 'openStudentResults must be defined exactly once');
assert(facultyApi.includes("c2.course_id IS NULL AND EXISTS"), 'legacy null-course completions are not tied to a real course launch');
"""
if 'openStudentResults must be defined exactly once' not in s:
    if anchor not in s: raise SystemExit('faculty result check anchor missing')
    s=s.replace(anchor,extra,1)
p.write_text(s)
