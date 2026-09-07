from pathlib import Path

HTML = Path('platform/public/faculty.html')
CSS = Path('platform/public/app.css')
html = HTML.read_text()
css = CSS.read_text()


def replace_once(text, old, new, label):
    if old not in text:
        raise SystemExit(f'{label} anchor missing')
    return text.replace(old, new, 1)

# ── Shared pagination/filter state ──────────────────────────────────────────
html = replace_once(
    html,
    """  me:null, err:null, q:{}, filter:{}, sel:new Set(),\n  newCourse:false, editCourse:false, addSim:false, help:null, looking:null\n};\n""",
    """  me:null, err:null, q:{}, filter:{}, sel:new Set(),\n  page:{crs:1,sim:1,ros:1,studentResults:1,played:1},\n  newCourse:false, editCourse:false, addSim:false, help:null, looking:null\n};\n\nconst PAGE_SIZE = 10;\nfunction paginate(rows, key) {\n  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));\n  const page = Math.min(Math.max(1, Number(F.page[key] || 1)), pages);\n  F.page[key] = page;\n  const start = (page - 1) * PAGE_SIZE;\n  return { rows: rows.slice(start, start + PAGE_SIZE), page, pages, total: rows.length };\n}\nfunction pagerControls(key, page, pages) {\n  return `<span class=\"faculty-pager\">\n    <button class=\"btn sm\" data-page-key=\"${esc(key)}\" data-page=\"${page-1}\" ${page<=1?'disabled':''}>Previous</button>\n    <span class=\"info\">Page ${page} of ${pages}</span>\n    <button class=\"btn sm\" data-page-key=\"${esc(key)}\" data-page=\"${page+1}\" ${page>=pages?'disabled':''}>Next</button>\n  </span>`;\n}\nfunction wirePager() {\n  app.querySelectorAll('[data-page-key]').forEach(b => b.onclick = () => {\n    const key = b.dataset.pageKey;\n    F.page[key] = Number(b.dataset.page || 1);\n    render();\n  });\n}\n""",
    'faculty state/pagination'
)

# Reset pagination when entering detail views.
html = replace_once(
    html,
    """async function openCourse(id) {\n  try { F.course = await api('/api/faculty', { action:'course_detail', courseId:id }); F.view = 'course'; F.sel.clear(); F.err = null; }\n""",
    """async function openCourse(id) {\n  try { F.course = await api('/api/faculty', { action:'course_detail', courseId:id }); F.view = 'course'; F.sel.clear(); F.page.ros = 1; F.err = null; }\n""",
    'openCourse'
)
html = replace_once(
    html,
    """async function openProgress(courseId, simId) {\n  try { F.progress = await api('/api/faculty', { action:'sim_progress', courseId, simId }); F.view = 'played'; F.err = null; }\n""",
    """async function openProgress(courseId, simId) {\n  try { F.progress = await api('/api/faculty', { action:'sim_progress', courseId, simId }); F.view = 'played'; F.page.played = 1; F.err = null; }\n""",
    'openProgress'
)
html = replace_once(
    html,
    """async function openStudentResults(courseId, studentId) {\n  try { F.studentResults = await api('/api/faculty', { action:'student_results', courseId, studentId }); F.view = 'student-results'; F.err = null; }\n""",
    """async function openStudentResults(courseId, studentId) {\n  try { F.studentResults = await api('/api/faculty', { action:'student_results', courseId, studentId }); F.view = 'student-results'; F.page.studentResults = 1; F.err = null; }\n""",
    'openStudentResults'
)

# ── Courses tab: keep search, add pagination ────────────────────────────────
html = replace_once(
    html,
    """function coursesTab() {\n  const rows = F.data.courses.filter(c => matches('crs', [c.title, c.term, c.join_code]));\n  return `\n""",
    """function coursesTab() {\n  const matching = F.data.courses.filter(c => matches('crs', [c.title, c.term, c.join_code]));\n  const pg = paginate(matching, 'crs');\n  const rows = pg.rows;\n  return `\n""",
    'courses pagination source'
)
html = replace_once(
    html,
    """      <div class=\"foot\"><span class=\"info\">${rows.length} course${rows.length===1?'':'s'}</span><span class=\"info\">Page 1 of 1</span></div>\n""",
    """      <div class=\"foot\"><span class=\"info\">${pg.total} course${pg.total===1?'':'s'}</span>${pagerControls('crs', pg.page, pg.pages)}</div>\n""",
    'courses footer'
)

# ── Simulations tab: keep existing search/filters and paginate results ──────
html = replace_once(
    html,
    """  const rapid = matching.filter(x => (Number(x.minutes) || 0) < 60);\n  const rapidPlus = matching.filter(x => (Number(x.minutes) || 0) >= 60);\n  const shown = rapid.concat(rapidPlus);\n  return `\n""",
    """  const rapid = matching.filter(x => (Number(x.minutes) || 0) < 60);\n  const rapidPlus = matching.filter(x => (Number(x.minutes) || 0) >= 60);\n  const allShown = rapid.concat(rapidPlus);\n  const pg = paginate(allShown, 'sim');\n  const shown = pg.rows;\n  return `\n""",
    'sim pagination source'
)
html = replace_once(
    html,
    """        const plus = (Number(x.minutes) || 0) >= 60;\n        const beginsLine = index === 0 || (index === rapid.length && rapidPlus.length);\n""",
    """        const plus = (Number(x.minutes) || 0) >= 60;\n        const prev = index > 0 ? shown[index-1] : null;\n        const prevPlus = prev ? (Number(prev.minutes) || 0) >= 60 : null;\n        const beginsLine = index === 0 || prevPlus !== plus;\n""",
    'sim grouped header on paginated page'
)
html = replace_once(
    html,
    """      <div class=\"foot\"><span class=\"info\">${shown.length} simulation${shown.length===1?'':'s'}</span><span class=\"info\">Page 1 of 1</span></div>\n""",
    """      <div class=\"foot\"><span class=\"info\">${pg.total} simulation${pg.total===1?'':'s'}</span>${pagerControls('sim', pg.page, pg.pages)}</div>\n""",
    'sim footer'
)

# ── Course page: approved static design, preserving all existing actions ────
html = replace_once(
    html,
    """  const shown = roster.filter(r => !q || [r.name, r.email].join(' ').toLowerCase().includes(q));\n  const notAdded = catalogue.filter(si => !sims.find(x => x.sim_id === si.id));\n\n  app.innerHTML = `\n""",
    """  const filteredRoster = roster.filter(r => !q || [r.name, r.email].join(' ').toLowerCase().includes(q));\n  const rosterPg = paginate(filteredRoster, 'ros');\n  const shown = rosterPg.rows;\n  const notAdded = catalogue.filter(si => !sims.find(x => x.sim_id === si.id));\n  const runStarts = sims.reduce((n,x) => n + Number(x.started_runs || 0), 0);\n  const runFinishes = sims.reduce((n,x) => n + Number(x.finished_runs || 0), 0);\n\n  app.innerHTML = `\n""",
    'course source/pagination totals'
)
html = replace_once(
    html,
    """    </div>\n    ${F.editCourse ? `<div class=\"panel\" style=\"padding:15px 16px;margin-bottom:14px\">\n""",
    """    </div>\n    <div class=\"faculty-course-summary\" aria-label=\"Course activity summary\">\n      <div class=\"faculty-summary-cell\"><div class=\"faculty-summary-n\">${active.length}</div><div class=\"faculty-summary-l\">Enrolled</div></div>\n      <div class=\"faculty-summary-cell\"><div class=\"faculty-summary-n\">${active.filter(r=>r.paid).length}</div><div class=\"faculty-summary-l\">Released</div></div>\n      <div class=\"faculty-summary-cell\"><div class=\"faculty-summary-n\">${runStarts}</div><div class=\"faculty-summary-l\">Run starts</div></div>\n      <div class=\"faculty-summary-cell\"><div class=\"faculty-summary-n\">${runFinishes}</div><div class=\"faculty-summary-l\">Runs finished</div></div>\n    </div>\n    ${F.editCourse ? `<div class=\"panel\" style=\"padding:15px 16px;margin-bottom:14px\">\n""",
    'course summary strip'
)

sim_start = html.find("      ${sims.length ? sims.map(x => {", html.find('function renderCourse()'))
sim_end_marker = "      }).join('') : '<div class=\"empty\">None yet. Add one above, then share the join link with your students.</div>'}"
sim_end = html.find(sim_end_marker, sim_start)
if sim_start < 0 or sim_end < 0:
    raise SystemExit('simulation card slice missing')
sim_end += len(sim_end_marker)
new_sim = r'''      ${sims.length ? sims.map(x => {
        const runPct = Number(x.started_runs) ? Math.min(100, Math.round(Number(x.finished_runs)/Number(x.started_runs)*100)) : 0;
        return `<div class="sim faculty-sim-card">
          <div class="no">${x.number ? String(x.number).padStart(2,'0') : '··'}</div>
          <div class="body">
            <div class="faculty-sim-title-row"><div class="t">${esc(x.title)}${eye(x.sim_id)}</div></div>
            <div class="faculty-sim-kpis">
              <div class="faculty-sim-kpi"><b>${x.started||0}</b><span>Students started</span></div>
              <div class="faculty-sim-kpi"><b>${x.finished||0}</b><span>Students finished</span></div>
              <div class="faculty-sim-kpi"><b>${x.started_runs||0}</b><span>Run starts</span></div>
              <div class="faculty-sim-kpi"><b>${x.finished_runs||0}</b><span>Runs finished</span></div>
              ${x.expected_seats ? `<div class="faculty-sim-kpi"><b>${x.expected_seats}</b><span>Expected</span></div>` : ''}
            </div>
            <div class="faculty-run-progress" title="${x.finished_runs||0} of ${x.started_runs||0} started runs completed"><i style="width:${runPct}%"></i></div>
          </div>
          <div class="side faculty-sim-side">
            <div class="faculty-sim-actions">
              <a class="btn pri sm" href="/api/launch?sim=${encodeURIComponent(x.sim_id)}&course=${encodeURIComponent(course.id)}&mode=session">Run a session</a>
              <a class="btn sm" href="/api/launch?sim=${encodeURIComponent(x.sim_id)}&course=${encodeURIComponent(course.id)}">Play it yourself</a>
              <button class="btn sm faculty-result-btn" data-prog="${esc(x.sim_id)}">Who has played</button>
              <button class="btn sm" data-seats="${esc(x.sim_id)}" data-cur="${x.expected_seats||''}">Expected number</button>
              <button class="btn sm danger" data-rmsim="${esc(x.sim_id)}">Remove</button>
            </div>
          </div>
        </div>`;
      }).join('') : '<div class="empty">None yet. Add one above, then share the join link with your students.</div>'}'''
html = html[:sim_start] + new_sim + html[sim_end:]

html = replace_once(
    html,
    """    <div class=\"note\">\n      <b>Students join this course with one link.</b> Send it however you normally reach them — it covers every simulation in the course, so they never join twice.\n      <div class=\"copyrow\"><input id=\"eurl\" readonly value=\"${esc(enrolUrl)}\"><button class=\"btn\" id=\"ecopy\">Copy</button></div>\n    </div>\n\n    <div class=\"toolbar\">\n      <div class=\"search\"><input data-q=\"ros\" type=\"text\" placeholder=\"Search this course's students\" value=\"${esc(F.q.ros||'')}\"></div>\n      <input id=\"p_note\" placeholder=\"note, e.g. dept PO 4471\" style=\"width:210px;border:1px solid var(--line2);padding:8px 10px;font-size:14px;background:var(--card)\">\n""",
    """    <div class=\"note faculty-share\">\n      <div class=\"faculty-share-copy\"><b>Students join this course with one link.</b> Send it once; it covers every simulation in the course. <span class=\"faculty-join-code\">${esc(course.join_code)}</span></div>\n      <div class=\"copyrow\"><input id=\"eurl\" readonly value=\"${esc(enrolUrl)}\"><button class=\"btn\" id=\"ecopy\">Copy</button></div>\n    </div>\n\n    <div class=\"toolbar faculty-roster-toolbar\">\n      <div class=\"search\"><input data-q=\"ros\" type=\"text\" placeholder=\"Search this course's students\" value=\"${esc(F.q.ros||'')}\"></div>\n      <input id=\"p_note\" class=\"faculty-note-input\" placeholder=\"note, e.g. dept PO 4471\">\n""",
    'course share/toolbar'
)
html = replace_once(
    html,
    """      <thead><tr><th style=\"width:30px\"></th><th style=\"width:26%\">Student</th><th style=\"width:1%\">Access</th><th>Note</th>\n        <th class=\"num\">Joined</th><th class=\"num\">Runs started</th><th class=\"num\">Runs finished</th><th class=\"act\"></th></tr></thead>\n""",
    """      <thead><tr><th style=\"width:30px\"></th><th style=\"width:26%\">Student</th><th style=\"width:1%\">Access</th><th>Note</th>\n        <th class=\"num\">Joined</th><th>Run activity</th><th class=\"act\"></th></tr></thead>\n""",
    'course roster header'
)
html = replace_once(
    html,
    """        <td data-l=\"Joined\" class=\"num\">${when(r.created_at)}</td>\n        <td data-l=\"Runs started\" class=\"num\">${r.started || 0}</td>\n        <td data-l=\"Runs finished\" class=\"num\">${r.finished || 0}</td>\n        <td data-l=\"\" class=\"act\">\n          <button class=\"btn sm\" data-student-results=\"${esc(r.student_id)}\">Results</button>\n""",
    """        <td data-l=\"Joined\" class=\"num\">${when(r.created_at)}</td>\n        <td data-l=\"Run activity\"><div class=\"faculty-run-activity\"><div><b>${r.started || 0}</b><span>Started</span></div><div><b>${r.finished || 0}</b><span>Finished</span></div></div></td>\n        <td data-l=\"\" class=\"act\">\n          <button class=\"btn sm faculty-result-btn\" data-student-results=\"${esc(r.student_id)}\">Results</button>\n""",
    'course roster activity cell'
)
html = replace_once(
    html,
    """      <div class=\"foot\">\n        <span class=\"info\">${active.length} enrolled · ${active.filter(r=>r.paid).length} released</span>\n        <span class=\"info\">Page 1 of 1</span>\n      </div>\n""",
    """      <div class=\"foot\">\n        <span class=\"info\">${rosterPg.total} shown · ${active.length} enrolled · ${active.filter(r=>r.paid).length} released</span>\n        ${pagerControls('ros', rosterPg.page, rosterPg.pages)}\n      </div>\n""",
    'course roster footer'
)
html = html.replace('`<tr><td colspan="8" class="empty">${roster.length', '`<tr><td colspan="7" class="empty">${roster.length', 1)

# ── Student results internal page: search/filter + pagination ───────────────
html = replace_once(
    html,
    """function renderStudentResults() {\n  const { course, student, rows } = F.studentResults;\n  const started = rows.reduce((n,r) => n + Number(r.starts||0), 0);\n  const finished = rows.reduce((n,r) => n + Number(r.completions||0), 0);\n  const mins = s => s ? Math.round(s/60) + ' min' : '—';\n""",
    """function renderStudentResults() {\n  const { course, student, rows } = F.studentResults;\n  const started = rows.reduce((n,r) => n + Number(r.starts||0), 0);\n  const finished = rows.reduce((n,r) => n + Number(r.completions||0), 0);\n  const filtered = rows.filter(r => matches('studentResults', [simLabel(r), r.completed_at ? 'finished' : Number(r.starts)>0 ? 'started' : 'not started']));\n  const pg = paginate(filtered, 'studentResults');\n  const shown = pg.rows;\n  const mins = s => s ? Math.round(s/60) + ' min' : '—';\n""",
    'student results pagination source'
)
html = replace_once(
    html,
    """    <div class=\"section\"><span>Results</span><span style=\"font-family:var(--serif);text-transform:none;letter-spacing:0;font-size:13px;color:var(--ink3)\">Latest result from each simulation · every completed run is retained</span></div>\n    <div class=\"panel\"><div class=\"tablewrap\"><table>\n""",
    """    <div class=\"section\"><span>Results</span><span style=\"font-family:var(--serif);text-transform:none;letter-spacing:0;font-size:13px;color:var(--ink3)\">Latest result from each simulation · every completed run is retained</span></div>\n    <div class=\"toolbar faculty-internal-toolbar\"><div class=\"search\"><input data-q=\"studentResults\" type=\"text\" placeholder=\"Filter simulations or status\" value=\"${esc(F.q.studentResults||'')}\"></div></div>\n    <div class=\"panel\"><div class=\"tablewrap\"><table>\n""",
    'student results search'
)
student_view_pos = html.find('function renderStudentResults()')
map_old = "      <tbody>${rows.length ? rows.map(r => {"
map_pos = html.find(map_old, student_view_pos)
if map_pos < 0:
    raise SystemExit('student results map missing')
html = html[:map_pos] + html[map_pos:].replace(map_old, "      <tbody>${shown.length ? shown.map(r => {", 1)
html = replace_once(
    html,
    """      }).join('') : '<tr><td colspan=\"3\" class=\"empty\">No simulations are attached to this course.</td></tr>'}</tbody>\n    </table></div></div>`;\n  document.getElementById('backCourse').onclick = () => openCourse(course.id);\n}\n""",
    """      }).join('') : `<tr><td colspan=\"3\" class=\"empty\">${rows.length ? 'Nothing matches that filter.' : 'No simulations are attached to this course.'}</td></tr>`}</tbody>\n    </table></div><div class=\"foot\"><span class=\"info\">${pg.total} simulation${pg.total===1?'':'s'} shown</span>${pagerControls('studentResults', pg.page, pg.pages)}</div></div>`;\n  document.getElementById('backCourse').onclick = () => openCourse(course.id);\n  wireCommon();\n}\n""",
    'student results footer/wiring'
)

# ── Who has played internal page: search/filter + pagination ────────────────
html = replace_once(
    html,
    """  const runStarts = active.reduce((n,r) => n + Number(r.starts||0), 0);\n  const runFinishes = active.reduce((n,r) => n + Number(r.completions||0), 0);\n  const mins = s => s ? Math.round(s/60) + ' min' : '—';\n""",
    """  const runStarts = active.reduce((n,r) => n + Number(r.starts||0), 0);\n  const runFinishes = active.reduce((n,r) => n + Number(r.completions||0), 0);\n  const filtered = rows.filter(r => matches('played', [r.name, r.email, r.completed_at ? 'finished' : Number(r.starts)>0 ? 'started' : !r.paid ? 'not released' : 'not started']));\n  const pg = paginate(filtered, 'played');\n  const shown = pg.rows;\n  const mins = s => s ? Math.round(s/60) + ' min' : '—';\n""",
    'played pagination source'
)
html = replace_once(
    html,
    """    </div>\n    <div class=\"panel\"><div class=\"tablewrap\"><table>\n      <thead><tr>\n        <th style=\"width:30%\">Student</th>\n        <th>What came back</th>\n      </tr></thead>\n      <tbody>\n      ${rows.length ? rows.map(r => {\n""",
    """    </div>\n    <div class=\"toolbar faculty-internal-toolbar\"><div class=\"search\"><input data-q=\"played\" type=\"text\" placeholder=\"Filter students or status\" value=\"${esc(F.q.played||'')}\"></div></div>\n    <div class=\"panel\"><div class=\"tablewrap\"><table>\n      <thead><tr>\n        <th style=\"width:30%\">Student</th>\n        <th>What came back</th>\n      </tr></thead>\n      <tbody>\n      ${shown.length ? shown.map(r => {\n""",
    'played search/map'
)
html = replace_once(
    html,
    """      }).join('') : '<tr><td colspan=\"2\" class=\"empty\">Nobody enrolled yet.</td></tr>'}\n      </tbody></table></div>\n      <div class=\"foot\"><span class=\"info\">${done.length} of ${active.length} finished</span><span class=\"info\">Page 1 of 1</span></div>\n    </div>\n    <div class=\"hint\" style=\"margin-top:12px\">Completion summaries appear for every simulation. Simulations that support instructor transcripts also show questions, classifications, timing, state changes and evidence reached.</div>`;\n  document.getElementById('back').onclick = () => openCourse(course.id);\n}\n""",
    """      }).join('') : `<tr><td colspan=\"2\" class=\"empty\">${rows.length ? 'Nothing matches that filter.' : 'Nobody enrolled yet.'}</td></tr>`}\n      </tbody></table></div>\n      <div class=\"foot\"><span class=\"info\">${pg.total} shown · ${done.length} of ${active.length} students finished</span>${pagerControls('played', pg.page, pg.pages)}</div>\n    </div>\n    <div class=\"hint\" style=\"margin-top:12px\">Completion summaries appear for every simulation. Simulations that support instructor transcripts also show questions, classifications, timing, state changes and evidence reached.</div>`;\n  document.getElementById('back').onclick = () => openCourse(course.id);\n  wireCommon();\n}\n""",
    'played footer/wiring'
)

# Search/filter changes reset the corresponding page before rerender.
html = replace_once(
    html,
    """  app.querySelectorAll('[data-q]').forEach(i => i.oninput = () => {\n    const k = i.dataset.q; F.q[k] = i.value; render();\n""",
    """  app.querySelectorAll('[data-q]').forEach(i => i.oninput = () => {\n    const k = i.dataset.q; F.q[k] = i.value; F.page[k] = 1; render();\n""",
    'search resets page'
)
html = replace_once(
    html,
    """  app.querySelectorAll('[data-f]').forEach(b => b.onclick = () => {\n    const [k,v] = b.dataset.f.split(':'); F.filter[k] = v; render(); });\n}\n""",
    """  app.querySelectorAll('[data-f]').forEach(b => b.onclick = () => {\n    const [k,v] = b.dataset.f.split(':'); F.filter[k] = v; F.page[k] = 1; render(); });\n  wirePager();\n}\n""",
    'filter resets page/wire pager'
)

# ── CSS: scoped polish; no theme/color/font changes ─────────────────────────
marker = '/* faculty console polish + pagination — existing theme only */'
if marker not in css:
    css += r'''

/* faculty console polish + pagination — existing theme only */
.faculty-course-summary{
  display:grid;grid-template-columns:repeat(4,minmax(0,1fr));
  background:var(--card);border:1px solid var(--line);margin:0 0 28px;
}
.faculty-summary-cell{padding:14px 18px;border-right:1px solid var(--line)}
.faculty-summary-cell:last-child{border-right:none}
.faculty-summary-n{font-family:var(--mono);font-size:20px;font-weight:600;line-height:1;color:var(--ink)}
.faculty-summary-l{font-family:var(--mono);font-size:9px;letter-spacing:.14em;text-transform:uppercase;color:var(--ink3);margin-top:6px}

.sim.faculty-sim-card{display:grid;grid-template-columns:38px minmax(0,1fr) auto;gap:18px;align-items:start;padding:17px 18px;border-bottom:0}
.faculty-sim-title-row{display:flex;align-items:center;gap:8px}
.faculty-sim-card .t{font-size:18px}
.faculty-sim-kpis{display:flex;gap:22px;flex-wrap:wrap;margin-top:11px}
.faculty-sim-kpi{min-width:82px}
.faculty-sim-kpi b{display:block;font-family:var(--mono);font-size:14px;font-weight:600;color:var(--ink)}
.faculty-sim-kpi span{display:block;font-family:var(--mono);font-size:8.5px;letter-spacing:.1em;text-transform:uppercase;color:var(--ink3);margin-top:2px}
.faculty-run-progress{height:3px;background:var(--line);margin-top:13px;max-width:470px;overflow:hidden}
.faculty-run-progress i{display:block;height:3px;background:var(--green)}
.faculty-sim-card .faculty-sim-side{display:flex;align-items:flex-start;white-space:normal}
.faculty-sim-actions{display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end;max-width:560px}
.faculty-result-btn{background:var(--sunk)}

.faculty-share{margin-top:0;padding:12px 15px}
.faculty-share-copy{font-size:14px;color:var(--ink2)}
.faculty-join-code{display:inline-block;margin-left:7px;padding:2px 7px;border:1px solid var(--amber-line);background:#fff9ef;color:var(--amber);font-family:var(--mono);font-size:10px;font-weight:600;letter-spacing:.08em}
.faculty-roster-toolbar{display:grid;grid-template-columns:minmax(260px,1fr) 220px auto auto;align-items:center}
.faculty-note-input{width:100%;border:1px solid var(--line2);padding:8px 10px;font-size:14px;background:var(--card)}
.faculty-run-activity{display:inline-grid;grid-template-columns:auto auto;border:1px solid var(--line);background:var(--sunk)}
.faculty-run-activity>div{padding:6px 10px;min-width:68px;text-align:center}
.faculty-run-activity>div+div{border-left:1px solid var(--line)}
.faculty-run-activity b{display:block;font-family:var(--mono);font-size:13px;font-weight:600;line-height:1.2;color:var(--ink)}
.faculty-run-activity span{display:block;font-family:var(--mono);font-size:8px;letter-spacing:.1em;text-transform:uppercase;color:var(--ink3);margin-top:3px}
.faculty-internal-toolbar{margin:0 0 12px}
.faculty-internal-toolbar .search{max-width:520px}
.faculty-pager{display:flex;align-items:center;gap:8px;margin-left:auto}
.faculty-pager .btn{padding:5px 9px}

@media(max-width:1100px){
  .sim.faculty-sim-card{grid-template-columns:38px minmax(0,1fr)}
  .faculty-sim-card .faculty-sim-side{grid-column:2}
  .faculty-sim-actions{justify-content:flex-start;max-width:none}
  .faculty-roster-toolbar{grid-template-columns:minmax(240px,1fr) 210px}
  .faculty-roster-toolbar>.btn{width:100%}
}
@media(max-width:820px){
  .faculty-course-summary{grid-template-columns:1fr 1fr}
  .faculty-summary-cell:nth-child(2){border-right:none}
  .faculty-summary-cell:nth-child(-n+2){border-bottom:1px solid var(--line)}
  .sim.faculty-sim-card{grid-template-columns:1fr}
  .faculty-sim-card .faculty-sim-side{grid-column:auto}
  .faculty-roster-toolbar{grid-template-columns:1fr}
  .faculty-run-activity{margin-top:2px}
  .faculty-pager{width:100%;justify-content:flex-end;margin-left:0;flex-wrap:wrap}
}
'''

HTML.write_text(html)
CSS.write_text(css)
print('Faculty console polish and pagination applied.')
