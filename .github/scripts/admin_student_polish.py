from pathlib import Path

ADMIN = Path('platform/public/admin.html')
STUDENT = Path('platform/public/student.html')
CSS = Path('platform/public/app.css')
admin = ADMIN.read_text()
student = STUDENT.read_text()
css = CSS.read_text()


def once(text, old, new, label):
    if old not in text:
        raise SystemExit(f'{label} anchor missing')
    return text.replace(old, new, 1)

# ── Admin: keep the existing console behavior, fill the remaining pagination gaps ──
admin = once(admin, 'const PER_PAGE = 25;', 'const PER_PAGE = 10;', 'admin page size')

cat_start = admin.find('function catTab() {')
cat_end = admin.find('function wireCat()', cat_start)
if cat_start < 0 or cat_end < 0:
    raise SystemExit('catalogue function bounds missing')
cat = admin[cat_start:cat_end]
cat = once(cat,
    """  const list = rapid.concat(rapidPlus);\n  return `\n""",
    """  const list = rapid.concat(rapidPlus);\n  const P = paged('cat', list);\n  return `\n""",
    'catalogue pager source')
cat = once(cat,
    """    ${list.length ? list.map((si, index) => {\n""",
    """    ${P.rows.length ? P.rows.map((si, index) => {\n""",
    'catalogue page rows')
cat = once(cat,
    """      const beginsLine = index === 0 || (index === rapid.length && rapidPlus.length);\n""",
    """      const prev = index > 0 ? P.rows[index - 1] : null;\n      const prevPlus = prev ? (Number(prev.minutes) || 0) >= 60 : null;\n      const beginsLine = index === 0 || prevPlus !== plus;\n""",
    'catalogue section headers')
cat = once(cat,
    """    </div>\n\n    <div class=\"section\" style=\"margin:22px 0 0\">\n""",
    """      ${foot('cat', P, 'simulation')}\n    </div>\n\n    <div class=\"section\" style=\"margin:22px 0 0\">\n""",
    'catalogue footer')
admin = admin[:cat_start] + cat + admin[cat_end:]

# Facilitator detail: always make the student list searchable and paginate each course.
admin = once(admin,
    """      ${students.filter(s => !s.dropped).length > 6 ? `<div class=\"toolbar\">\n        <div class=\"search\"><input data-q=\"det\" type=\"text\" placeholder=\"Search this facilitator's students\" value=\"${esc(D.q.det||'')}\"></div>\n      </div>` : ''}\n""",
    """      ${students.filter(s => !s.dropped).length ? `<div class=\"toolbar admin-detail-toolbar\">\n        <div class=\"search\"><input data-q=\"det\" type=\"text\" placeholder=\"Search this facilitator's students\" value=\"${esc(D.q.det||'')}\"></div>\n      </div>` : ''}\n""",
    'admin detail search')
admin = once(admin,
    """        const inCourse = students.filter(s => s.course_id === c.id && !s.dropped)\n          .filter(s => !q || [s.name, s.email].join(' ').toLowerCase().includes(q));\n        return `<div class=\"cbox\">\n""",
    """        const matchingStudents = students.filter(s => s.course_id === c.id && !s.dropped)\n          .filter(s => !q || [s.name, s.email].join(' ').toLowerCase().includes(q));\n        const coursePage = paged('det_' + c.id, matchingStudents);\n        const inCourse = coursePage.rows;\n        return `<div class=\"cbox admin-detail-course\">\n""",
    'admin detail course pager')
admin = once(admin,
    """              <td data-l=\"Played\" class=\"num\">${s.launches}</td>\n            </tr>`).join('')}</tbody></table></div>`\n            : `<div class=\"empty\">${q ? 'Nobody in this course matches that.' : 'Nobody enrolled yet.'}</div>`}\n        </div>`;\n""",
    """              <td data-l=\"Played\" class=\"num\">${s.launches}</td>\n            </tr>`).join('')}</tbody></table></div>${foot('det_' + c.id, coursePage, 'student')}`\n            : `<div class=\"empty\">${q ? 'Nobody in this course matches that.' : 'Nobody enrolled yet.'}</div>`}\n        </div>`;\n""",
    'admin detail course footer')
admin = once(admin,
    """    D.q[k] = i.value; D.page[k] = 1; render();\n""",
    """    D.q[k] = i.value; D.page[k] = 1;\n    if (k === 'det') Object.keys(D.page).filter(x => x.startsWith('det_')).forEach(x => { D.page[x] = 1; });\n    render();\n""",
    'admin detail search reset')

# ── Student: add scan-friendly summary, client-side search/filter, and pagination ──
student = once(student,
    """  .before{border-left:2px solid var(--line2);padding:0 0 0 14px;margin:16px 0 0;font-size:13.5px;color:var(--ink2);line-height:1.6}\n""",
    """  .before{border-left:2px solid var(--line2);padding:0 0 0 14px;margin:16px 0 0;font-size:13.5px;color:var(--ink2);line-height:1.6}\n  .student-summary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));border:1px solid var(--line);background:var(--card);margin:0 0 22px}\n  .student-summary .cell{padding:14px 16px;border-right:1px solid var(--line)}\n  .student-summary .cell:last-child{border-right:none}\n  .student-summary .n{font:600 19px var(--mono);line-height:1}\n  .student-summary .l{font:9px var(--mono);letter-spacing:.13em;text-transform:uppercase;color:var(--ink3);margin-top:6px}\n  .student-tools{display:flex;gap:9px;align-items:center;margin:0 0 18px;flex-wrap:wrap}\n  .student-tools .search{flex:1;min-width:220px}\n  .student-filter{display:flex;border:1px solid var(--line2);background:var(--card)}\n  .student-filter button{font:10px var(--mono);letter-spacing:.1em;text-transform:uppercase;padding:8px 11px;color:var(--ink3);border-right:1px solid var(--line);background:transparent}\n  .student-filter button:last-child{border-right:0}\n  .student-filter button.on{background:var(--ink);color:var(--card)}\n  .student-pager{display:flex;justify-content:space-between;align-items:center;gap:10px;margin:12px 0 24px;font:10px var(--mono);letter-spacing:.08em;text-transform:uppercase;color:var(--ink3)}\n  .student-pager .nav{display:flex;gap:6px;align-items:center}\n  .student-course{margin-bottom:30px}\n  @media(max-width:640px){\n    .student-summary{grid-template-columns:1fr 1fr}.student-summary .cell:nth-child(2){border-right:0}.student-summary .cell:nth-child(-n+2){border-bottom:1px solid var(--line)}\n    .student-tools{align-items:stretch}.student-filter{width:100%}.student-filter button{flex:1}\n  }\n""",
    'student styles')
student = once(student,
    """let LAST = '';\nlet FAILED = 0;\n""",
    """let LAST = '';\nlet FAILED = 0;\nconst SV = { q:'', filter:'All', page:1 };\nconst STUDENT_PAGE_SIZE = 8;\n\nfunction applyStudentView() {\n  const cards = [...app.querySelectorAll('[data-student-card]')];\n  if (!cards.length) return;\n  const q = SV.q.trim().toLowerCase();\n  const matching = cards.filter(card => {\n    const status = card.dataset.status || '';\n    const statusOk = SV.filter === 'All' || (SV.filter === 'Finished' ? status === 'Finished' : status !== 'Finished');\n    return statusOk && (!q || (card.dataset.search || '').includes(q));\n  });\n  const pages = Math.max(1, Math.ceil(matching.length / STUDENT_PAGE_SIZE));\n  SV.page = Math.min(Math.max(1, SV.page), pages);\n  const visible = new Set(matching.slice((SV.page-1)*STUDENT_PAGE_SIZE, SV.page*STUDENT_PAGE_SIZE));\n  cards.forEach(card => { card.style.display = visible.has(card) ? '' : 'none'; });\n  app.querySelectorAll('.student-course').forEach(course => {\n    const own = [...course.querySelectorAll('[data-student-card]')];\n    course.style.display = !own.length || own.some(card => visible.has(card)) ? '' : 'none';\n  });\n  const empty = document.getElementById('studentEmpty');\n  if (empty) empty.style.display = matching.length ? 'none' : '';\n  app.querySelectorAll('[data-student-filter]').forEach(b => b.classList.toggle('on', b.dataset.studentFilter === SV.filter));\n  const pager = document.getElementById('studentPager');\n  if (pager) pager.innerHTML = `<span>${matching.length} simulation${matching.length===1?'':'s'}</span><span class=\"nav\"><button class=\"btn sm\" id=\"sprev\" ${SV.page<=1?'disabled':''}>Previous</button><span>Page ${SV.page} of ${pages}</span><button class=\"btn sm\" id=\"snext\" ${SV.page>=pages?'disabled':''}>Next</button></span>`;\n  const prev = document.getElementById('sprev'), next = document.getElementById('snext');\n  if (prev) prev.onclick = () => { SV.page--; applyStudentView(); };\n  if (next) next.onclick = () => { SV.page++; applyStudentView(); };\n}\nfunction wireStudentView() {\n  const search = document.getElementById('studentSearch');\n  if (search) { search.value = SV.q; search.oninput = () => { SV.q = search.value; SV.page = 1; applyStudentView(); }; }\n  app.querySelectorAll('[data-student-filter]').forEach(b => b.onclick = () => { SV.filter = b.dataset.studentFilter; SV.page = 1; applyStudentView(); });\n  applyStudentView();\n}\n""",
    'student view state')

student = once(student,
    """  const { courses, sims } = d;\n\n  app.innerHTML = courses.length ? courses.map(c => {\n""",
    """  const { courses, sims } = d;\n  const finishedCount = sims.filter(x => x.completed_at).length;\n  const inProgressCount = sims.filter(x => !x.completed_at && Number(x.played) > 0).length;\n\n  app.innerHTML = courses.length ? `\n    <div class=\"student-summary\">\n      <div class=\"cell\"><div class=\"n\">${courses.length}</div><div class=\"l\">Courses</div></div>\n      <div class=\"cell\"><div class=\"n\">${sims.length}</div><div class=\"l\">Simulations</div></div>\n      <div class=\"cell\"><div class=\"n\">${finishedCount}</div><div class=\"l\">Finished</div></div>\n      <div class=\"cell\"><div class=\"n\">${inProgressCount}</div><div class=\"l\">In progress</div></div>\n    </div>\n    <div class=\"student-tools\">\n      <div class=\"search\"><input id=\"studentSearch\" type=\"text\" placeholder=\"Search courses or simulations\" value=\"${esc(SV.q)}\"></div>\n      <div class=\"student-filter\">${['All','To do','Finished'].map(x => `<button data-student-filter=\"${x}\" class=\"${SV.filter===x?'on':''}\">${x}</button>`).join('')}</div>\n    </div>\n    <div id=\"studentEmpty\" class=\"panel\" style=\"display:none;margin-bottom:18px\"><div class=\"empty\">Nothing matches that search or filter.</div></div>\n    <div id=\"studentCourseList\">\n    ${courses.map(c => {\n""",
    'student summary/search start')
student = once(student,
    """      <div style=\"margin-bottom:30px\">\n""",
    """      <div class=\"student-course\">\n""",
    'student course class')
student = once(student,
    """          const done = !!x.completed_at;\n          const m = x.metrics || {};\n          return `<div class=\"simcard\">\n""",
    """          const done = !!x.completed_at;\n          const m = x.metrics || {};\n          const status = done ? 'Finished' : Number(x.played) > 0 ? 'In progress' : 'To do';\n          const searchText = [c.title, c.term, c.faculty_name, x.title, x.description, x.tagline, status].filter(Boolean).join(' ').toLowerCase();\n          return `<div class=\"simcard\" data-student-card data-status=\"${esc(status)}\" data-search=\"${esc(searchText)}\">\n""",
    'student card metadata')
student = once(student,
    """  }).join('') + `\n    <div class=\"before\">\n""",
    """  }).join('')}\n    </div>\n    <div id=\"studentPager\" class=\"student-pager\"></div>\n    <div class=\"before\">\n""",
    'student course list close')
student = once(student,
    """  const j = document.getElementById('join');\n""",
    """  if (courses.length) wireStudentView();\n\n  const j = document.getElementById('join');\n""",
    'student filter wiring')

# Admin-specific visual polish, using the same theme variables introduced for faculty.
marker = '/* admin/student console polish — same Flexee theme */'
if marker not in css:
    css += r'''

/* admin/student console polish — same Flexee theme */
.admin-detail-toolbar{margin-bottom:12px}
.admin-detail-course{margin-bottom:14px}
.admin-detail-course .chead{background:var(--sunk);padding:14px 16px}
.admin-detail-course .chead b{font-size:16px;font-weight:500}
.admin-detail-course .foot{border-top:1px solid var(--line)}
body.console .panel > .foot:last-child{border-bottom:0}
@media(max-width:820px){
  .admin-detail-course .chead{align-items:flex-start}
}
'''

ADMIN.write_text(admin)
STUDENT.write_text(student)
CSS.write_text(css)
print('Admin and student UI polish applied.')
