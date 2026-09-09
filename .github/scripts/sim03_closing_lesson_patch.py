from pathlib import Path

FINISH = Path('sim03/api/finish.js')
INDEX = Path('sim03/public/index.html')
BUILD = Path('sim03/build.js')


def replace_once(text, old, new, label):
    if old not in text:
        raise SystemExit(f'missing anchor: {label}')
    return text.replace(old, new, 1)

# Server-authored closing lesson. It is returned only after /api/finish succeeds,
# so the lesson is not available to the student before their reflections are submitted.
f = FINISH.read_text()
f = replace_once(
    f,
    "function publicOutcome(o) { return o ? { title:o.title, narrative:o.narrative, band:o.band } : null; }\n",
    "function publicOutcome(o) { return o ? { title:o.title, narrative:o.narrative, band:o.band } : null; }\n\nfunction closingLesson() {\n  return {\n    title: 'What this run was teaching you',\n    paragraphs: [\n      'You spent two years making choices before you knew which consequences would matter. That is the work of architecture. It is not predicting the future. It is deciding which capabilities Midland will already have when the future arrives.',\n      'Every million you put into Run, Uptime, Capacity, Connect, or Features was also a million you did not put somewhere else. The people in the room made every choice sound reasonable because each of them was right about their own part. The hard part was seeing the whole company before the evidence made the answer obvious.',\n      'Capacity had no advocate. Connect did. Features were visible. Run and Uptime had immediate operational arguments. That imbalance was intentional: important foundations are often easiest to starve when nobody is asking for them yet.',\n      'The three buyers were the final reminder that value depends on who is looking. You did not control which future arrived or what an eventual buyer would care about. You controlled whether Midland had built enough real capability that more than one future could still work.'\n    ],\n    carryOut: 'You never controlled which future arrived. You controlled what Midland was ready for when it did.'\n  };\n}\n",
    'closing lesson function'
)
f = replace_once(
    f,
    "    completionReported: !!report.ok,\n    outcomes\n",
    "    completionReported: !!report.ok,\n    outcomes,\n    closingLesson: closingLesson()\n",
    'finish response closing lesson'
)
FINISH.write_text(f)

h = INDEX.read_text()
# Insert lesson styles before .joinbox.
h = replace_once(
    h,
    ".joinbox{max-width:560px}",
    ".closing-lesson{border:1px solid var(--line);background:var(--panel);padding:24px;margin-top:12px;break-inside:avoid;page-break-inside:avoid}.closing-lesson-inner{max-width:68ch;margin:0 auto}.closing-lesson p{font-size:1.05rem;line-height:1.7;color:#C9C6BE;margin:0 0 16px}.closing-carry{border-left:2px solid var(--amber);padding:12px 14px;margin-top:20px;background:rgba(240,166,60,.05);font-size:18px;font-style:italic;color:var(--bone)}.joinbox{max-width:560px}",
    'closing lesson styles'
)
# Print: keep lesson, hide transactional footer so the PDF closes on the carry-out line.
h = replace_once(
    h,
    "@media print{header,.actions,.team{display:none!important}",
    "@media print{header,.actions,.team,.run-complete{display:none!important}",
    'print footer hide'
)
# Add state slot.
h = replace_once(
    h,
    "  poll:null,error:''\n};",
    "  poll:null,error:'',closingLesson:null\n};",
    'closing lesson state'
)
# Helper is client-rendering only; all lesson copy comes from server after finish.
h = replace_once(
    h,
    "function renderClose(){\n",
    "function closingLessonHTML(){const d=S.closingLesson;if(!d)return '';const ps=Array.isArray(d.paragraphs)?d.paragraphs:[];return `<div class=\"result-section\" id=\"closingLesson\"><div class=\"eyebrow\">${esc(d.title||'What this run was teaching you')}</div><div class=\"closing-lesson\"><div class=\"closing-lesson-inner\">${ps.map(p=>`<p>${esc(p)}</p>`).join('')}<div class=\"closing-carry\">${esc(d.carryOut||'')}</div></div></div></div>`}\nfunction renderClose(){\n",
    'closing lesson renderer'
)
# Insert exactly between reflections and the Run complete banner.
h = replace_once(
    h,
    "    </div>\n    ${notice('Run complete. The full outcome, portfolio and reflections are ready to screenshot or print to PDF.')}\n    <div class=\"actions\"><button class=\"btn pri\" id=\"printBtn\">Print / save PDF</button>",
    "    </div>\n    ${closingLessonHTML()}\n    <div class=\"notice run-complete\">Run complete. The full outcome, portfolio and reflections are ready to screenshot or print to PDF.</div>\n    <div class=\"actions\"><button class=\"btn pri\" id=\"printBtn\">Print / save PDF</button>",
    'lesson placement'
)
# Capture the server-authored lesson only after finish succeeds.
h = replace_once(
    h,
    "    await request('/api/finish',{year1:S.year1,year2:S.year2,strategicView:S.strategicView,reflection1:S.reflection1,reflection2:S.reflection2,sessionCode:S.sessionCode,participantId:S.participantId});\n    S.finished=true;render();",
    "    const done=await request('/api/finish',{year1:S.year1,year2:S.year2,strategicView:S.strategicView,reflection1:S.reflection1,reflection2:S.reflection2,sessionCode:S.sessionCode,participantId:S.participantId});\n    S.closingLesson=done.closingLesson||null;S.finished=true;render();\n    requestAnimationFrame(()=>document.getElementById('closingLesson')?.scrollIntoView({behavior:'smooth',block:'start'}));",
    'finish lesson capture'
)
INDEX.write_text(h)

b = BUILD.read_text()
anchor = "if (!index.includes('data_no_room')) refuse('student final result does not recognize data_no_room');\n"
addition = "for (const marker of ['function closingLessonHTML()','What this run was teaching you','run-complete','closingLesson=done.closingLesson']) if (!index.includes(marker)) refuse('closing lesson marker missing: ' + marker);\nif (!fs.readFileSync(path.join(__dirname, 'api', 'finish.js'), 'utf8').includes('function closingLesson()')) refuse('server-authored closing lesson missing');\n"
b = replace_once(b, anchor, anchor + addition, 'build closing lesson guards')
BUILD.write_text(b)
