from pathlib import Path

SCENARIO = Path('sim03/lib/scenario.js')
INDEX = Path('sim03/public/index.html')
BUILD = Path('sim03/build.js')
CHECK = Path('sim03/tools/check.js')


def replace_once(text, old, new, label):
    if old not in text:
        raise SystemExit(f'missing anchor: {label}')
    return text.replace(old, new, 1)

# B1: expose each existing cast member's one-line want beside the corresponding
# allocation line. Capacity deliberately remains without an advocate.
s = SCENARIO.read_text()
s = replace_once(
    s,
    "    lines: LINES.map(id => ({ id, label: LABELS[id], description: LINE_DESCRIPTIONS[id] })),",
    """    lines: LINES.map(id => {\n      const cast = META.detail.cast.find(x => x.line === LABELS[id]);\n      return {\n        id,\n        label: LABELS[id],\n        description: LINE_DESCRIPTIONS[id],\n        advocate: cast ? { name: cast.name, want: cast.stake } : null\n      };\n    }),""",
    'public line advocates'
)
SCENARIO.write_text(s)

h = INDEX.read_text()

# F10: make the revenue/profit sentence read as a business-model callout rather
# than another body paragraph.
h = replace_once(
    h,
    ".copy{font-size:17px;color:#C9C6BE;line-height:1.7;max-width:780px}.copy p{margin-bottom:14px}.copy .brief-profit{font-size:20px;color:var(--bone);border-left:2px solid var(--amber);padding:11px 14px;background:rgba(240,166,60,.05)}",
    ".copy{font-size:17px;color:#C9C6BE;line-height:1.7;max-width:780px}.copy>p{margin-bottom:14px}.brief-profit{border:1px solid #8A6427;border-left:3px solid var(--amber);padding:15px 17px;background:rgba(240,166,60,.07);margin:18px 0}.brief-profit .eyebrow{margin-bottom:5px}.brief-profit p{font-size:21px;line-height:1.5;color:var(--bone);margin:0;font-weight:500}",
    'brief profit callout styles'
)

# F3/B1: make constraints and advocates impossible to miss on the allocator.
h = replace_once(
    h,
    ".allocs{display:grid;gap:8px}.alloc{border:1px solid var(--line);background:var(--panel);display:grid;grid-template-columns:1fr auto;align-items:center;padding:14px 14px 14px 17px;gap:14px}.alloc h3{font-size:20px;font-weight:400}.alloc .constraint{font:10px var(--mono);color:var(--dimmer);margin-top:5px;letter-spacing:.02em;line-height:1.5}.alloc-rule{font:9px var(--mono);letter-spacing:.09em;text-transform:uppercase;color:var(--amber);margin-top:7px}.stepper",
    ".allocs{display:grid;gap:8px}.alloc{border:1px solid var(--line);background:var(--panel);display:grid;grid-template-columns:1fr auto;align-items:center;padding:14px 14px 14px 17px;gap:14px}.alloc-title-row{display:flex;align-items:center;gap:9px;flex-wrap:wrap}.alloc h3{font-size:20px;font-weight:400}.alloc-cap{display:inline-flex;border:1px solid #8A6427;background:rgba(240,166,60,.08);padding:3px 6px;font:600 9px var(--mono);letter-spacing:.1em;text-transform:uppercase;color:var(--amber)}.alloc .constraint{font:10px var(--mono);color:var(--dimmer);margin-top:5px;letter-spacing:.02em;line-height:1.5}.advocate-reminder{margin-top:9px;padding:8px 10px;border-left:2px solid var(--line2);background:rgba(255,255,255,.018);font-size:13px;line-height:1.45;color:#C8C5BD}.advocate-reminder b{display:block;font:600 9px var(--mono);letter-spacing:.09em;text-transform:uppercase;color:var(--bone);margin-bottom:3px}.alloc-rule{font:9px var(--mono);letter-spacing:.09em;text-transform:uppercase;color:var(--amber);margin-top:7px}.stepper",
    'allocator visibility styles'
)

# F9/F8 support styles.
h = replace_once(
    h,
    ".running{display:grid;grid-template-columns:repeat(5,1fr);gap:7px;margin:20px 0}.run-cell{border:1px solid var(--line);background:var(--panel);padding:12px;text-align:center}.run-cell .v{font:600 22px var(--mono);color:var(--amber)}.run-cell .k{font:9px var(--mono);letter-spacing:.1em;text-transform:uppercase;color:var(--dimmer);margin-top:4px}",
    ".running{display:grid;grid-template-columns:repeat(5,1fr);gap:7px;margin:20px 0}.run-cell{border:1px solid var(--line);background:var(--panel);padding:12px;text-align:center}.run-cell .v{font:600 22px var(--mono);color:var(--amber)}.run-cell .k{font:9px var(--mono);letter-spacing:.1em;text-transform:uppercase;color:var(--dimmer);margin-top:4px}.year2-breakdown{border:1px solid var(--line);background:var(--panel);margin:20px 0;overflow:auto}.year2-breakdown-row{display:grid;grid-template-columns:minmax(100px,1.2fr) repeat(3,minmax(86px,.8fr));border-bottom:1px solid var(--line);min-width:470px}.year2-breakdown-row:last-child{border-bottom:0}.year2-breakdown-row>div{padding:9px 11px;border-right:1px solid var(--line);text-align:right}.year2-breakdown-row>div:last-child{border-right:0}.year2-breakdown-head{background:var(--panel2);font:9px var(--mono);letter-spacing:.08em;text-transform:uppercase;color:var(--dimmer)}.year2-breakdown-name{text-align:left!important;font-size:14px;color:var(--bone)}.year2-breakdown-num{font:600 14px var(--mono);color:var(--bone)}.year2-breakdown-total{color:var(--amber)}.reflection-note{padding:7px 9px;border-left:2px solid var(--line2);background:rgba(255,255,255,.018)}",
    'year2 breakdown and reflection styles'
)

h = replace_once(
    h,
    "  <div class=\"copy\">${C.coldOpen.map((x,i)=>`<p class=\"${i===1?'brief-profit':''}\">${esc(x)}</p>`).join('')}</div>",
    "  <div class=\"copy\">${C.coldOpen.map((x,i)=>i===1?`<div class=\"brief-profit\"><div class=\"eyebrow\">The business model</div><p>${esc(x)}</p></div>`:`<p>${esc(x)}</p>`).join('')}</div>",
    'brief profit markup'
)

h = replace_once(
    h,
    "function allocationRule(line){return line.id==='run'?'$3M minimum · balance of budget is the only ceiling':'$3M annual ceiling'}\nfunction allocationConfirmation",
    """function allocationRule(line){return line.id==='run'?'$3M minimum · balance of budget is the only ceiling':'$3M annual ceiling'}\nfunction allocationCap(line){return line.id==='run'?'MIN $3M':'MAX $3M / YEAR'}\nfunction lineAdvocate(line){const a=line?.advocate;if(!a)return '';return `<div class=\"advocate-reminder\"><b>${esc(a.name)} · speaks for ${esc(line.label)}</b><span>${esc(a.want)}</span></div>`}\nfunction year2BreakdownHTML(y1,y2,year2Label='Year 2 draft'){\n  if(!y1||!y2)return '';\n  const rows=C.lines.map(l=>{const a=Number(y1[l.id]||0),b=Number(y2[l.id]||0);return `<div class=\"year2-breakdown-row\"><div class=\"year2-breakdown-name\">${esc(l.label)}</div><div class=\"year2-breakdown-num\">$${a}M</div><div class=\"year2-breakdown-num\">$${b}M</div><div class=\"year2-breakdown-num year2-breakdown-total\">$${a+b}M</div></div>`}).join('');\n  return `<div class=\"eyebrow\" style=\"margin-top:24px\">Year 1 + Year 2 split</div><div class=\"year2-breakdown\"><div class=\"year2-breakdown-row year2-breakdown-head\"><div>Line</div><div>Year 1 committed</div><div>${esc(year2Label)}</div><div>Cumulative</div></div>${rows}</div>`;\n}\nfunction allocationConfirmation""",
    'allocator helper functions'
)

# F9: replace separate/ambiguous running strips on the Year 2 allocator with a
# table that explicitly shows Year 1, Year 2, and cumulative for every line.
h = replace_once(
    h,
    "    ${year===2&&S.year1?runningHTML(S.year1,'Year 1 committed'):''}\n    ${committed?readOnlyAllocationHTML(committed,`Team Year ${year} allocation`):notice(`Waiting for ${captain} to commit Year ${year}.`)}\n    ${running?runningHTML(running,'Cumulative team portfolio'):''}",
    "    ${year===2&&S.year1&&committed?year2BreakdownHTML(S.year1,committed,'Year 2 committed'):''}\n    ${committed?readOnlyAllocationHTML(committed,`Team Year ${year} allocation`):notice(`Waiting for ${captain} to commit Year ${year}.`)}",
    'team year2 split'
)
h = replace_once(
    h,
    "  ${year===2&&S.year1?runningHTML(S.year1,'Year 1 committed'):''}\n  ${running?runningHTML(running,'Running totals, including this draft'):''}",
    "  ${year===2&&S.year1?year2BreakdownHTML(S.year1,a,'Year 2 draft'):''}",
    'editable year2 split'
)

# F3/B1 markup on both editable and read-only allocation rows.
h = replace_once(
    h,
    "function readOnlyAllocationHTML(a,label){return `<div class=\"eyebrow\" style=\"margin-top:24px\">${esc(label)}</div><div class=\"allocs\">${C.lines.map(l=>`<div class=\"alloc\"><div><h3>${esc(l.label)}</h3><div class=\"constraint\">${esc(l.description||'')}</div><div class=\"alloc-rule\">${esc(allocationRule(l))}</div></div><div class=\"amount\">${a[l.id]}<small> M</small></div></div>`).join('')}</div>`}",
    "function readOnlyAllocationHTML(a,label){return `<div class=\"eyebrow\" style=\"margin-top:24px\">${esc(label)}</div><div class=\"allocs\">${C.lines.map(l=>`<div class=\"alloc\"><div><div class=\"alloc-title-row\"><h3>${esc(l.label)}</h3><span class=\"alloc-cap\">${esc(allocationCap(l))}</span></div><div class=\"constraint\">${esc(l.description||'')}</div>${lineAdvocate(l)}<div class=\"alloc-rule\">${esc(allocationRule(l))}</div></div><div class=\"amount\">${a[l.id]}<small> M</small></div></div>`).join('')}</div>`}",
    'read-only allocation visibility'
)
h = replace_once(
    h,
    "  return `<div class=\"alloc\"><div><h3>${esc(l.label)}</h3><div class=\"constraint\">${esc(l.description||'')}</div><div class=\"alloc-rule\">${esc(allocationRule(l))}</div></div><div class=\"stepper\">",
    "  return `<div class=\"alloc\"><div><div class=\"alloc-title-row\"><h3>${esc(l.label)}</h3><span class=\"alloc-cap\">${esc(allocationCap(l))}</span></div><div class=\"constraint\">${esc(l.description||'')}</div>${lineAdvocate(l)}<div class=\"alloc-rule\">${esc(allocationRule(l))}</div></div><div class=\"stepper\">",
    'editable allocation visibility'
)

# F8: put the disclosure directly under each reflection, not once at the bottom.
h = replace_once(
    h,
    "  <div class=\"field\"><label>${esc(C.reflectionPrompts[0])}</label><textarea id=\"r1\" maxlength=\"1500\">${esc(S.reflection1)}</textarea></div>\n  <div class=\"field\"><label>${esc(C.reflectionPrompts[1])}</label><textarea id=\"r2\" maxlength=\"1500\">${esc(S.reflection2)}</textarea></div>\n  <div class=\"hint\">${esc(C.reflectionDisclosure||'Your instructor can see these responses. They are not scored.')}</div>",
    "  <div class=\"field\"><label>${esc(C.reflectionPrompts[0])}</label><textarea id=\"r1\" maxlength=\"1500\">${esc(S.reflection1)}</textarea><div class=\"hint reflection-note\">Your instructor can see this response and may read it aloud in the debrief. It is not scored.</div></div>\n  <div class=\"field\"><label>${esc(C.reflectionPrompts[1])}</label><textarea id=\"r2\" maxlength=\"1500\">${esc(S.reflection2)}</textarea><div class=\"hint reflection-note\">Your instructor can see this response and may read it aloud in the debrief. It is not scored.</div></div>",
    'reflection disclosures'
)
INDEX.write_text(h)

# Regression guards: the six heading replacements already landed. Lock those in
# while adding markers for the five visibility items in this follow-up.
b = BUILD.read_text()
anchor = "if (!instructor.includes('Corven high / Ridge Hollow low')) refuse('instructor buyer debate finder is missing');"
addition = """if (!instructor.includes('Corven high / Ridge Hollow low')) refuse('instructor buyer debate finder is missing');\nfor (const marker of ['MAX $3M / YEAR','The business model','function year2BreakdownHTML(','Year 1 + Year 2 split','advocate-reminder','may read it aloud in the debrief'])\n  if (!index.includes(marker)) refuse('Increment 2 visibility follow-up marker missing: ' + marker);\nfor (const marker of ['Year 2 stops being quiet.','The CEO asks whether Midland can predict a failure before the truck rolls.','The decisions are over. What changed your mind?'])\n  if (!index.includes(marker)) refuse('situation heading missing: ' + marker);\nfor (const old of ['Two events resolve in sequence.','You do not get another move.','Return to what you believed before the consequences.'])\n  if (index.includes(old)) refuse('old moralizing/software heading remains: ' + old);"""
b = replace_once(b, anchor, addition, 'build follow-up guards')
BUILD.write_text(b)

c = CHECK.read_text()
anchor = "assert.equal(inc1.lines.find(x => x.id === 'connect').description, \"Gets the data back from the units in the field, automatically. Sam: the machines already know things his technicians still have to drive out to learn.\");"
addition = anchor + "\nassert.equal(inc1.lines.find(x => x.id === 'run').advocate.name, 'Dale Brenner');\nassert.equal(inc1.lines.find(x => x.id === 'uptime').advocate.name, 'Renata Oyelaran');\nassert.equal(inc1.lines.find(x => x.id === 'connect').advocate.name, 'Sam Achterberg');\nassert.equal(inc1.lines.find(x => x.id === 'features').advocate.name, 'Tom Vasquez');\nassert.equal(inc1.lines.find(x => x.id === 'capacity').advocate, null);"
c = replace_once(c, anchor, addition, 'public advocate checks')
CHECK.write_text(c)
