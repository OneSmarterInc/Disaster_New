from pathlib import Path

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

old="""      ${rows.length ? rows.map(r => {
        const m = r.metrics || {};
        const st = r.dropped ? ['off','removed']
          : r.completed_at ? ['ok','finished']
          : Number(r.starts) > 0 ? ['warn','started']
          : !r.paid ? ['off','not released'] : ['off','not started'];
        return `<tr style="${r.dropped?'opacity:.5':''}">
          <td data-l="Student" style="vertical-align:top">
            <div class="nm">${esc(r.name)}</div>
            <div class="sub">${esc(r.email)}</div>
            <div style="margin-top:7px">${dot(st[0], st[1])}</div>
            ${r.completed_at ? `<div class="sub" style="margin-top:4px">${when(r.completed_at)}${mins(r.duration_seconds) ? ' · ' + mins(r.duration_seconds) : ''}</div>` : ''}
          </td>
          <td data-l="What came back" style="vertical-align:top">
            ${Object.keys(m).length
              ? `<div class="metrics">${Object.entries(m).map(([k,v]) =>
                  `<div><span>${esc(k)}</span><b>${esc(v)}</b></div>`).join('')}</div>`
              : `<span class="dim" style="font-size:13.5px">${r.completed_at ? 'Finished, but reported nothing.'
                  : Number(r.starts) > 0 ? 'Started but has not reached the end yet.'
                  : !r.paid ? 'Waiting for you to give them access.'
                  : 'Has not opened it yet.'}</span>`}
            ${r.transcript ? renderTranscript(r.transcript, r.transcript_recorded_at) : ''}
          </td>
        </tr>`;
      }).join('') : '<tr><td colspan="2" class="empty">Nobody enrolled yet.</td></tr>`}
"""
new="""      ${rows.length ? rows.map(r => {
        const m = r.metrics || {};
        const st = r.dropped ? ['off','removed']
          : r.completed_at ? ['ok','finished']
          : Number(r.starts) > 0 ? ['warn','started']
          : !r.paid ? ['off','not released'] : ['off','not started'];
        let summary = '';
        if (r.summary) {
          const raw = String(r.summary);
          try {
            const parsed = JSON.parse(raw);
            summary = parsed && typeof parsed === 'object'
              ? `<details style="margin-top:10px"><summary>Simulation summary</summary><pre style="white-space:pre-wrap;font:12px/1.5 var(--mono);margin-top:8px">${esc(JSON.stringify(parsed,null,2))}</pre></details>`
              : `<div class="sub" style="margin-top:8px;white-space:pre-wrap">${esc(raw)}</div>`;
          } catch { summary = `<div class="sub" style="margin-top:8px;white-space:pre-wrap">${esc(raw)}</div>`; }
        }
        return `<tr style="${r.dropped?'opacity:.5':''}">
          <td data-l="Student" style="vertical-align:top">
            <div class="nm">${esc(r.name)}</div>
            <div class="sub">${esc(r.email)}</div>
            <div style="margin-top:7px">${dot(st[0], st[1])}</div>
            ${r.completed_at ? `<div class="sub" style="margin-top:4px">${when(r.completed_at)}${mins(r.duration_seconds) ? ' · ' + mins(r.duration_seconds) : ''}</div>` : ''}
          </td>
          <td data-l="What came back" style="vertical-align:top">
            ${Object.keys(m).length ? `<div class="metrics">${Object.entries(m).map(([k,v]) =>
                `<div><span>${esc(k)}</span><b>${esc(typeof v==='object'?JSON.stringify(v):v)}</b></div>`).join('')}</div>` : ''}
            ${summary}
            ${r.transcript ? renderTranscript(r.transcript, r.transcript_recorded_at) : ''}
            ${!Object.keys(m).length && !r.summary && !r.transcript
              ? `<span class="dim" style="font-size:13.5px">${r.completed_at ? 'Finished, but this simulation reported no result detail.'
                  : Number(r.starts) > 0 ? 'Started but has not reached the end yet.'
                  : !r.paid ? 'Waiting for you to give them access.'
                  : 'Has not opened it yet.'}</span>` : ''}
          </td>
        </tr>`;
      }).join('') : '<tr><td colspan="2" class="empty">Nobody enrolled yet.</td></tr>`}
"""
if old in s:
    s=s.replace(old,new,1)
elif new not in s:
    raise SystemExit('renderPlayed block marker missing')
p.write_text(s)

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
assert(facultyHtml.includes('Simulation summary'), 'per-sim faculty progress does not render completion summaries');
assert(facultyApi.includes("c2.course_id IS NULL AND EXISTS"), 'legacy null-course completions are not tied to a real course launch');
"""
if 'openStudentResults must be defined exactly once' not in s:
    if anchor not in s: raise SystemExit('faculty result check anchor missing')
    s=s.replace(anchor,extra,1)
p.write_text(s)
