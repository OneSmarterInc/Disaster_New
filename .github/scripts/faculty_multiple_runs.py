from pathlib import Path

# Backend: keep student coverage counts, add run counts, make roster counts attempts,
# and return all completion attempts for faculty review.
p = Path('platform/api/faculty.js')
s = p.read_text()

old = """                 count(DISTINCT l.user_id) FILTER (WHERE l.as_role = 'student') AS started,\n                 count(DISTINCT cp.user_id) AS finished\n"""
new = """                 count(DISTINCT l.user_id) FILTER (WHERE l.as_role = 'student') AS started,\n                 count(DISTINCT cp.user_id) FILTER (WHERE EXISTS (\n                   SELECT 1 FROM enrolments ec WHERE ec.course_id = c.id\n                     AND ec.student_id = cp.user_id AND ec.dropped = false\n                 )) AS finished,\n                 count(DISTINCT l.id) FILTER (WHERE l.as_role = 'student') AS started_runs,\n                 count(DISTINCT cp.id) FILTER (WHERE EXISTS (\n                   SELECT 1 FROM enrolments er WHERE er.course_id = c.id\n                     AND er.student_id = cp.user_id AND er.dropped = false\n                 )) AS finished_runs\n"""
if old not in s: raise SystemExit('sims_overview count anchor missing')
s = s.replace(old, new, 1)

old = """                 (SELECT count(*) FROM launches l\n                   WHERE l.user_id = u.id AND l.course_id = ${course.id} AND l.sim_id = ${simId}) AS starts,\n                 cp.completed_at, cp.duration_seconds, cp.summary, cp.metrics,\n"""
new = """                 (SELECT count(*) FROM launches l\n                   WHERE l.user_id = u.id AND l.course_id = ${course.id} AND l.sim_id = ${simId}\n                     AND l.as_role = 'student') AS starts,\n                 (SELECT count(*) FROM completions c3\n                   WHERE c3.user_id = u.id AND c3.sim_id = ${simId}\n                     AND (c3.course_id = ${course.id} OR (c3.course_id IS NULL AND EXISTS (\n                       SELECT 1 FROM launches lx3 WHERE lx3.user_id = u.id AND lx3.course_id = ${course.id}\n                         AND lx3.sim_id = ${simId} AND lx3.as_role = 'student'\n                     )))) AS completions,\n                 cp.completed_at, cp.duration_seconds, cp.summary, cp.metrics,\n"""
if old not in s: raise SystemExit('sim_progress starts anchor missing')
s = s.replace(old, new, 1)

old = """            (SELECT count(DISTINCT l.user_id) FROM launches l\n              WHERE l.course_id = ${course.id} AND l.sim_id = cs.sim_id AND l.as_role = 'student') AS started,\n            (SELECT count(DISTINCT c2.user_id) FROM completions c2\n              WHERE c2.course_id = ${course.id} AND c2.sim_id = cs.sim_id) AS finished\n"""
new = """            (SELECT count(DISTINCT l.user_id) FROM launches l\n              WHERE l.course_id = ${course.id} AND l.sim_id = cs.sim_id AND l.as_role = 'student') AS started,\n            (SELECT count(DISTINCT c2.user_id) FROM completions c2\n              WHERE c2.course_id = ${course.id} AND c2.sim_id = cs.sim_id\n                AND EXISTS (SELECT 1 FROM enrolments e2 WHERE e2.course_id = ${course.id}\n                  AND e2.student_id = c2.user_id AND e2.dropped = false)) AS finished,\n            (SELECT count(*) FROM launches l\n              WHERE l.course_id = ${course.id} AND l.sim_id = cs.sim_id AND l.as_role = 'student') AS started_runs,\n            (SELECT count(*) FROM completions c2\n              WHERE c2.course_id = ${course.id} AND c2.sim_id = cs.sim_id\n                AND EXISTS (SELECT 1 FROM enrolments e2 WHERE e2.course_id = ${course.id}\n                  AND e2.student_id = c2.user_id AND e2.dropped = false)) AS finished_runs\n"""
if old not in s: raise SystemExit('course sims count anchor missing')
s = s.replace(old, new, 1)

old = """                 (SELECT count(DISTINCT l.sim_id) FROM launches l\n                   WHERE l.user_id = u.id AND l.course_id = e.course_id AND l.as_role = 'student') AS started,\n                 (SELECT count(DISTINCT c2.sim_id) FROM completions c2\n"""
new = """                 (SELECT count(*) FROM launches l\n                   WHERE l.user_id = u.id AND l.course_id = e.course_id AND l.as_role = 'student') AS started,\n                 (SELECT count(*) FROM completions c2\n"""
if old not in s: raise SystemExit('roster distinct-count anchor missing')
s = s.replace(old, new, 1)

old = """                 cp.completed_at, cp.duration_seconds, cp.summary, cp.metrics,\n                 tr.recorded_at AS transcript_recorded_at, tr.envelope AS transcript\n"""
new = """                 cp.completed_at, cp.duration_seconds, cp.summary, cp.metrics,\n                 (SELECT COALESCE(json_agg(json_build_object(\n                    'id', c4.id, 'completed_at', c4.completed_at,\n                    'duration_seconds', c4.duration_seconds, 'summary', c4.summary, 'metrics', c4.metrics\n                  ) ORDER BY c4.completed_at DESC), '[]'::json)\n                  FROM completions c4\n                  WHERE c4.user_id = ${studentId} AND c4.sim_id = si.id\n                    AND (c4.course_id = ${course.id} OR (c4.course_id IS NULL AND EXISTS (\n                      SELECT 1 FROM launches l6 WHERE l6.user_id = ${studentId}\n                        AND l6.course_id = ${course.id} AND l6.sim_id = si.id AND l6.as_role = 'student'\n                    )))) AS completion_history,\n                 tr.recorded_at AS transcript_recorded_at, tr.envelope AS transcript\n"""
# Only replace the student_results occurrence: it contains ${studentId}; the first similar block is sim_progress.
pos = s.find("case 'student_results':")
if pos < 0: raise SystemExit('student_results case missing')
head, tail = s[:pos], s[pos:]
if old not in tail: raise SystemExit('student_results history anchor missing')
tail = tail.replace(old, new, 1)
s = head + tail
p.write_text(s)

# Faculty UI: distinguish student coverage from run attempts and expose repeated completions.
p = Path('platform/public/faculty.html')
s = p.read_text()
s = s.replace("const finished = (F.simsOverview||[]).reduce((n,x) => n + Number(x.finished||0), 0);",
              "const finished = (F.simsOverview||[]).reduce((n,x) => n + Number(x.finished_runs||0), 0);", 1)

old = """            <div class=\"sub\" style=\"margin-top:5px\"><b style=\"color:var(--ink)\">${x.finished||0}</b> finished · <b style=\"color:var(--ink)\">${x.started||0}</b> started${x.expected_seats ? ' · ' + x.expected_seats + ' expected' : ''}</div>\n            <div style=\"height:3px;background:var(--line);margin-top:8px;max-width:260px\"><i style=\"display:block;height:3px;background:var(--green);width:${pct}%\"></i></div>\n"""
new = """            <div class=\"sub\" style=\"margin-top:5px\"><b style=\"color:var(--ink)\">${x.finished||0}</b> student${Number(x.finished)===1?'':'s'} finished · <b style=\"color:var(--ink)\">${x.started||0}</b> student${Number(x.started)===1?'':'s'} started${x.expected_seats ? ' · ' + x.expected_seats + ' expected' : ''}</div>\n            <div class=\"sub\" style=\"margin-top:4px\"><b style=\"color:var(--ink)\">${x.finished_runs||0}</b> run${Number(x.finished_runs)===1?'':'s'} finished · <b style=\"color:var(--ink)\">${x.started_runs||0}</b> run${Number(x.started_runs)===1?'':'s'} started</div>\n            <div style=\"height:3px;background:var(--line);margin-top:8px;max-width:260px\"><i style=\"display:block;height:3px;background:var(--green);width:${pct}%\"></i></div>\n"""
if old not in s: raise SystemExit('course sim card anchor missing')
s = s.replace(old, new, 1)

s = s.replace('<th class="num">Joined</th><th class="num">Started</th><th class="num">Finished</th><th class="act"></th></tr></thead>',
              '<th class="num">Joined</th><th class="num">Runs started</th><th class="num">Runs finished</th><th class="act"></th></tr></thead>', 1)
s = s.replace('<td data-l="Started" class="num">${r.started || 0}</td>\n        <td data-l="Finished" class="num">${r.finished || 0}</td>',
              '<td data-l="Runs started" class="num">${r.started || 0}</td>\n        <td data-l="Runs finished" class="num">${r.finished || 0}</td>', 1)

old = """function renderStudentResults() {\n  const { course, student, rows } = F.studentResults;\n  const started = rows.filter(r => Number(r.starts) > 0).length;\n  const finished = rows.filter(r => r.completed_at).length;\n"""
new = """function renderStudentResults() {\n  const { course, student, rows } = F.studentResults;\n  const started = rows.reduce((n,r) => n + Number(r.starts||0), 0);\n  const finished = rows.reduce((n,r) => n + Number(r.completions||0), 0);\n"""
if old not in s: raise SystemExit('student result totals anchor missing')
s = s.replace(old, new, 1)
s = s.replace('<div class="cell"><div class="n">${started}</div><div class="l">Started</div></div>\n      <div class="cell"><div class="n">${finished}</div><div class="l">Finished</div></div>',
              '<div class="cell"><div class="n">${started}</div><div class="l">Runs started</div></div>\n      <div class="cell"><div class="n">${finished}</div><div class="l">Runs finished</div></div>', 1)
s = s.replace('Latest result from each simulation</span></div>',
              'Latest result from each simulation · every completed run is retained</span></div>', 1)
s = s.replace("const status = r.completed_at ? dot('ok','finished') : Number(r.starts) > 0 ? dot('warn','started') : dot('off','not started');",
              "const status = r.completed_at ? dot('ok', Number(r.completions)>1 ? `finished ×${r.completions}` : 'finished') : Number(r.starts) > 0 ? dot('warn','started') : dot('off','not started');", 1)
s = s.replace("${Number(r.starts)||0} launch${Number(r.starts)===1?'':'es'}${Number(r.completions)>1?' · '+r.completions+' completions':''}",
              "${Number(r.starts)||0} launch${Number(r.starts)===1?'':'es'} · ${Number(r.completions)||0} completion${Number(r.completions)===1?'':'s'}", 1)

# Add a generic history renderer before renderStudentResults.
anchor = "/* ── one student's progress/results across the course ───────────────────── */\nfunction renderStudentResults() {"
helper = """/* ── one student's progress/results across the course ───────────────────── */\nfunction completionHistory(r) {\n  const h = Array.isArray(r.completion_history) ? r.completion_history : [];\n  if (h.length <= 1) return '';\n  const cards = h.map((x,i) => {\n    const m = x.metrics && typeof x.metrics === 'object' ? x.metrics : {};\n    let sum = '';\n    if (x.summary) {\n      try { const p = JSON.parse(x.summary); sum = p && typeof p === 'object' ? `<pre style=\"white-space:pre-wrap;font:12px/1.5 var(--mono);margin-top:7px\">${esc(JSON.stringify(p,null,2))}</pre>` : `<div class=\"sub\" style=\"margin-top:7px;white-space:pre-wrap\">${esc(x.summary)}</div>`; }\n      catch { sum = `<div class=\"sub\" style=\"margin-top:7px;white-space:pre-wrap\">${esc(x.summary)}</div>`; }\n    }\n    return `<div style=\"border-top:1px solid var(--line);padding:10px 0\"><div class=\"sub\"><b>Run ${h.length-i}</b> · ${esc(new Date(x.completed_at).toLocaleString())}${x.duration_seconds?' · '+Math.round(x.duration_seconds/60)+' min':''}</div>${Object.keys(m).length?`<div class=\"metrics\" style=\"margin-top:7px\">${Object.entries(m).map(([k,v])=>`<div><span>${esc(k)}</span><b>${esc(typeof v==='object'?JSON.stringify(v):v)}</b></div>`).join('')}</div>`:''}${sum}</div>`;\n  }).join('');\n  return `<details style=\"margin-top:12px\"><summary>All ${h.length} completed runs</summary>${cards}</details>`;\n}\nfunction renderStudentResults() {"""
if anchor not in s: raise SystemExit('student results helper anchor missing')
s = s.replace(anchor, helper, 1)

# Put completion history after the latest summary in the student-centric view only.
pos = s.find('function renderStudentResults()')
head, tail = s[:pos], s[pos:]
needle = """            ${summary}\n            ${r.transcript ? renderTranscript(r.transcript, r.transcript_recorded_at) : ''}\n"""
repl = """            ${summary}\n            ${completionHistory(r)}\n            ${r.transcript ? renderTranscript(r.transcript, r.transcript_recorded_at) : ''}\n"""
if needle not in tail: raise SystemExit('student results summary/history anchor missing')
tail = tail.replace(needle, repl, 1)
s = head + tail

# Who-has-played view: preserve student coverage, but also show total run attempts.
old = """  const done = active.filter(r => r.completed_at);\n  const started = active.filter(r => Number(r.starts) > 0 && !r.completed_at);\n  const mins = s => s ? Math.round(s/60) + ' min' : '—';\n"""
new = """  const done = active.filter(r => r.completed_at);\n  const started = active.filter(r => Number(r.starts) > 0 && !r.completed_at);\n  const runStarts = active.reduce((n,r) => n + Number(r.starts||0), 0);\n  const runFinishes = active.reduce((n,r) => n + Number(r.completions||0), 0);\n  const mins = s => s ? Math.round(s/60) + ' min' : '—';\n"""
if old not in s: raise SystemExit('renderPlayed totals anchor missing')
s = s.replace(old, new, 1)
old = """      <div class=\"cell\"><div class=\"n\">${done.length}</div><div class=\"l\">Finished</div></div>\n      <div class=\"cell\"><div class=\"n\">${started.length}</div><div class=\"l\">Started, not finished</div></div>\n      <div class=\"cell\"><div class=\"n\">${active.length - done.length - started.length}</div><div class=\"l\">Not started</div></div>\n"""
new = """      <div class=\"cell\"><div class=\"n\">${done.length}</div><div class=\"l\">Students finished</div></div>\n      <div class=\"cell\"><div class=\"n\">${started.length}</div><div class=\"l\">Students in progress</div></div>\n      <div class=\"cell\"><div class=\"n\">${active.length - done.length - started.length}</div><div class=\"l\">Not started</div></div>\n      <div class=\"cell\"><div class=\"n\">${runStarts}</div><div class=\"l\">Run starts</div></div>\n      <div class=\"cell\"><div class=\"n\">${runFinishes}</div><div class=\"l\">Runs finished</div></div>\n"""
if old not in s: raise SystemExit('renderPlayed strip anchor missing')
s = s.replace(old, new, 1)
old = """            <div class=\"sub\">${esc(r.email)}</div>\n            <div style=\"margin-top:7px\">${dot(st[0], st[1])}</div>\n"""
new = """            <div class=\"sub\">${esc(r.email)}</div>\n            <div class=\"sub\" style=\"margin-top:4px\">${Number(r.starts)||0} run start${Number(r.starts)===1?'':'s'} · ${Number(r.completions)||0} finish${Number(r.completions)===1?'':'es'}</div>\n            <div style=\"margin-top:7px\">${dot(st[0], st[1])}</div>\n"""
if old not in s: raise SystemExit('renderPlayed student row anchor missing')
s = s.replace(old, new, 1)
p.write_text(s)

# Update the permanent regression check: repeated runs must be counted, not collapsed.
p = Path('platform/tools/check-faculty-student-results.js')
s = p.read_text()
s = s.replace("assert(facultyApi.includes('count(DISTINCT l.sim_id)'), 'student-wise started count is not distinct by simulation');\nassert(facultyApi.includes('count(DISTINCT c2.sim_id)'), 'student-wise finished count is not distinct by simulation');",
              "assert(!facultyApi.includes('count(DISTINCT l.sim_id)'), 'student-wise starts still collapse repeated runs by simulation');\nassert(!facultyApi.includes('count(DISTINCT c2.sim_id)'), 'student-wise finishes still collapse repeated runs by simulation');\nassert(facultyApi.includes('AS started_runs'), 'per-simulation run-start count is missing');\nassert(facultyApi.includes('AS finished_runs'), 'per-simulation run-finish count is missing');\nassert(facultyApi.includes('AS completion_history'), 'student result history does not preserve repeated completions');")
s = s.replace("  'Latest result from each simulation',",
              "  'Latest result from each simulation · every completed run is retained',\n  'Runs started',\n  'Runs finished',\n  'All ${h.length} completed runs',")
p.write_text(s)
