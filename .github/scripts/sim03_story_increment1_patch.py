from pathlib import Path

SCENARIO = Path('sim03/lib/scenario.js')
INDEX = Path('sim03/public/index.html')
CHECK = Path('sim03/tools/check.js')
BUILD = Path('sim03/build.js')


def replace_once(text, old, new, label):
    if old not in text:
        raise SystemExit(f'missing anchor: {label}')
    return text.replace(old, new, 1)

# ---------- Scenario/public content data ----------
s = SCENARIO.read_text()

s = replace_once(
    s,
    """    roomIntro:\n      'There is no cast of advisers in this RapidSim. The argument is inside the allocation: what do you fund now when the evidence arrives later?',\n""",
    """    roomIntro:\n      'Four people want four different things from the same nine million dollars. None of them is wrong, and none of them is going to tell you what to do.',\n""",
    'roomIntro'
)

s = replace_once(
    s,
    """    cast: [],\n""",
    """    cast: [\n      {\n        name: 'Dale Brenner',\n        role: 'Chief Financial Officer',\n        line: 'Run',\n        stake: 'Six million a year keeps the lights on and produces nothing new. Every conversation should start with getting that number down.',\n        quote: 'Six million dollars a year keeps the lights on and produces nothing new. Every conversation we have should start with getting that number down.'\n      },\n      {\n        name: 'Renata Oyelaran',\n        role: 'VP, Service',\n        line: 'Uptime',\n        stake: \"Doesn't need software, needs eight more technicians. Every dollar spent on a system is a dollar that did not go to a truck.\",\n        quote: 'I do not need software. I need eight more technicians. Every dollar you spend on a system is a dollar that did not go to a truck.'\n      },\n      {\n        name: 'Tom Vasquez',\n        role: 'Chief Executive',\n        line: 'Features',\n        stake: \"In eighteen months has to stand in front of the board and show them something. Doesn't care what it is. Cares that it is real.\",\n        quote: 'In eighteen months I have to stand in front of the board and show them something. I do not care what it is. I care that it is real.'\n      },\n      {\n        name: 'Sam Achterberg',\n        role: 'Field technician, 22 years',\n        line: 'Connect',\n        stake: 'Those machines have been telling us they were about to fail for years. There has never been anywhere to put what they say.',\n        quote: 'Those machines have been telling us they were about to fail for years. There has never been anywhere to put what they say.'\n      }\n    ],\n""",
    'cast'
)

s = replace_once(
    s,
    """const LABELS = {\n  run: 'Run',\n  uptime: 'Uptime',\n  capacity: 'Capacity',\n  connect: 'Connect',\n  features: 'Features'\n};\n""",
    """const LABELS = {\n  run: 'Run',\n  uptime: 'Uptime',\n  capacity: 'Capacity',\n  connect: 'Connect',\n  features: 'Features'\n};\nconst LINE_DESCRIPTIONS = Object.freeze({\n  run: \"Keeps the existing systems alive. Dale's floor: $3M, non-negotiable.\",\n  uptime: \"Backup and redundancy so dispatch survives a bad day. Renata's line.\",\n  capacity: 'Headroom for growth and for anything that needs to compute. Nobody asks for this.',\n  connect: \"Gets the data back from the units in the field, automatically. Sam's line.\",\n  features: \"Visible new things the business can point at. Tom's line.\"\n});\n""",
    'line descriptions'
)

s = replace_once(
    s,
    """    lines: LINES.map(id => ({ id, label: LABELS[id] })),\n""",
    """    lines: LINES.map(id => ({ id, label: LABELS[id], description: LINE_DESCRIPTIONS[id] })),\n    room: {\n      intro: META.detail.roomIntro,\n      cast: META.detail.cast.map(({ name, role, line, stake, quote }) => ({ name, role, line, stake, quote }))\n    },\n""",
    'public lines and room'
)

s = replace_once(
    s,
    """    coldOpen: [\n      'Midland Equipment is a mid-sized HVAC company.',\n      'You are about to take responsibility for the technology choices that shape what it can become.',\n      'The choices arrive before the consequences.',\n      'Once the consequences show up, some of them will be too late to change.'\n    ],\n    position:\n      'You run technology at Midland. You have $9 million to allocate this year across five lines. ' +\n      'You cannot borrow from next year, and the annual caps are real.',\n""",
    """    coldOpen: [\n      'Midland sells and services the big rooftop heating and cooling units on schools, hospitals, and office buildings across Ohio, Indiana, and Michigan. About four thousand of them are out there right now. Sixty-two technicians drive to those buildings all day, every day.',\n      'Selling equipment brings in most of the revenue. Servicing it brings in most of the profit.',\n      'The main office system is fourteen years old. Every unit installed since 2016 records its own run hours, temperatures, and faults. Nobody has ever looked at that data, because the only way to see it is to drive out and plug in a laptop.',\n      'You are about to take over technology decisions here.'\n    ],\n    position:\n      'You have $9 million to allocate this year across five lines. You cannot borrow from next year, and the annual caps are real.',\n""",
    'brief and position copy'
)
SCENARIO.write_text(s)

# ---------- Student UI ----------
h = INDEX.read_text()

h = replace_once(
    h,
    ".cold{display:grid;gap:10px;margin:24px 0}.cold .line{border-left:2px solid var(--line2);padding:11px 16px;font-size:18px;color:#D1CEC6}.cold .line:last-child{border-left-color:var(--amber)}\n",
    ".cold{display:grid;gap:10px;margin:24px 0}.cold .line{border-left:2px solid var(--line2);padding:11px 16px;font-size:18px;color:#D1CEC6}.cold .line:last-child{border-left-color:var(--amber)}\n.room-tour{display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin-top:22px}.room-card{border:1px solid var(--line);background:var(--panel);padding:18px}.room-name{font-size:23px;font-weight:400;line-height:1.15}.room-role{font:10px var(--mono);letter-spacing:.1em;text-transform:uppercase;color:var(--dimmer);margin-top:5px}.room-line{display:inline-flex;margin-top:13px;border:1px solid #8A6427;background:rgba(240,166,60,.06);padding:4px 7px;font:600 9px var(--mono);letter-spacing:.12em;text-transform:uppercase;color:var(--amber)}.room-quote{font-size:16px;line-height:1.55;color:#C8C5BD;margin-top:12px}.room-close{border-left:2px solid var(--amber);padding:11px 14px;background:rgba(240,166,60,.05);color:#CBC8C0;margin-top:18px}.line-guide{display:grid;gap:0;border:1px solid var(--line);background:var(--panel);margin-top:18px}.line-guide-row{display:grid;grid-template-columns:110px 1fr;gap:14px;padding:12px 14px;border-bottom:1px solid var(--line);align-items:start}.line-guide-row:last-child{border-bottom:0}.line-guide-row b{font-size:17px;font-weight:500}.line-guide-row span{font-size:14px;color:var(--dim);line-height:1.45}\n",
    'room and line guide styles'
)

h = replace_once(
    h,
    "@media(max-width:760px){.page{width:min(100% - 26px,980px);padding-top:34px}h2{font-size:31px}.alloc-wrap{grid-template-columns:1fr}.budget{position:static}.events,.buyers,.summary{grid-template-columns:1fr}.running{grid-template-columns:repeat(2,1fr)}header{padding:11px 14px}.pills{order:3;width:100%}.joinbox .row{grid-template-columns:1fr}.briefing-prep{align-items:flex-start;flex-direction:column}.briefing-modal{padding:10px}.briefing-dialog{max-height:94vh}.briefing-dialog-body{padding:16px}.briefing-dialog-title{font-size:25px}}",
    "@media(max-width:760px){.page{width:min(100% - 26px,980px);padding-top:34px}h2{font-size:31px}.alloc-wrap{grid-template-columns:1fr}.budget{position:static}.events,.buyers,.summary,.room-tour{grid-template-columns:1fr}.line-guide-row{grid-template-columns:1fr;gap:3px}.running{grid-template-columns:repeat(2,1fr)}header{padding:11px 14px}.pills{order:3;width:100%}.joinbox .row{grid-template-columns:1fr}.briefing-prep{align-items:flex-start;flex-direction:column}.briefing-modal{padding:10px}.briefing-dialog{max-height:94vh}.briefing-dialog-body{padding:16px}.briefing-dialog-title{font-size:25px}}",
    'mobile room styles'
)

h = replace_once(
    h,
    "const STEPS=['Brief','Position','View','Year 1','Outcome','Year 2','Events','Year 3','Buyers','Close'];",
    "const STEPS=['Brief','Position','Room','View','Year 1','Outcome','Year 2','Events','Year 3','Buyers','Close'];",
    'step list'
)

h = replace_once(
    h,
    "const visibleSteps=STEPS.map((x,i)=>({x,i})).filter(o=>C?.buyers?.authored!==false||o.i!==8);",
    "const visibleSteps=STEPS.map((x,i)=>({x,i})).filter(o=>C?.buyers?.authored!==false||o.i!==9);",
    'buyer step visibility'
)

h = replace_once(
    h,
    "function next(){let n=Math.min(9,S.step+1);if(n===8&&C?.buyers?.authored===false)n=9;S.step=n;render()}\nfunction back(){let n=Math.max(0,S.step-1);if(n===8&&C?.buyers?.authored===false)n=7;S.step=n;render()}",
    "function next(){let n=Math.min(10,S.step+1);if(n===9&&C?.buyers?.authored===false)n=10;S.step=n;render()}\nfunction back(){let n=Math.max(0,S.step-1);if(n===9&&C?.buyers?.authored===false)n=8;S.step=n;render()}",
    'step navigation bounds'
)

h = replace_once(
    h,
    """    case 1:return renderPosition();\n    case 2:return renderView();\n    case 3:return renderAllocation(1);\n    case 4:return renderYear1Outcome();\n    case 5:return renderAllocation(2);\n    case 6:return renderYear2Events();\n    case 7:return renderYear3();\n    case 8:return renderBuyers();\n""",
    """    case 1:return renderPosition();\n    case 2:return renderRoom();\n    case 3:return renderView();\n    case 4:return renderAllocation(1);\n    case 5:return renderYear1Outcome();\n    case 6:return renderAllocation(2);\n    case 7:return renderYear2Events();\n    case 8:return renderYear3();\n    case 9:return renderBuyers();\n""",
    'render step switch'
)

h = replace_once(
    h,
    """function renderBrief(){\n  shell(`<div class=\"eyebrow\">Cold open</div><h2>Some decisions arrive years before their evidence.</h2>\n  <div class=\"cold\">${C.coldOpen.map(x=>`<div class=\"line\">${esc(x)}</div>`).join('')}</div>\n  <p class=\"lede\">There is no score, rank, grade or hidden correct allocation. You will find out what happened, not how you \"did.\"</p>\n""",
    """function renderBrief(){\n  shell(`<div class=\"eyebrow\">MIDLAND EQUIPMENT</div><h2>Forty-one years old, profitable, and nobody thinks it is in trouble.</h2>\n  <div class=\"copy\">${C.coldOpen.map(x=>`<p>${esc(x)}</p>`).join('')}</div>\n  <p class=\"lede\">There is no score, rank, grade or hidden correct allocation. You will find out what happened, not how you \"did.\"</p>\n""",
    'brief screen'
)

old_position = """function renderPosition(){\n  shell(`<div class=\"eyebrow\">Your position</div><h2>You run technology at Midland.</h2><p class=\"lede\">${esc(C.position)}</p>\n  <div class=\"rule\"></div><div class=\"card\"><h3>The five lines</h3><p><b>Run</b> keeps the operation functioning now. <b>Uptime</b>, <b>Capacity</b>, <b>Connect</b> and <b>Features</b> are the architecture choices competing for what remains.</p></div>\n  ${nav()}`);wireNav(next);\n}\nfunction renderView(){\n"""
new_position = """function lineGuide(){return `<div class=\"line-guide\">${C.lines.map(l=>`<div class=\"line-guide-row\"><b>${esc(l.label)}</b><span>${esc(l.description||'')}</span></div>`).join('')}</div>`}\nfunction renderPosition(){\n  shell(`<div class=\"eyebrow\">Your position</div><h2>You run technology at Midland.</h2><p class=\"lede\">${esc(C.position)}</p>\n  <div class=\"rule\"></div><div class=\"eyebrow\">The five lines</div>${lineGuide()}\n  ${nav()}`);wireNav(next);\n}\nfunction renderRoom(){\n  const room=C.room||{},cast=Array.isArray(room.cast)?room.cast:[];\n  shell(`<div class=\"eyebrow\">THE ROOM</div><h2>Four people, one budget.</h2>\n  <p class=\"lede\">Nobody here is going to tell you what to do. Each of them is responsible for a different part of the company and each of them is right about their own part.</p>\n  <div class=\"room-tour\">${cast.map(c=>`<div class=\"room-card\"><div class=\"room-name\">${esc(c.name)}</div><div class=\"room-role\">${esc(c.role)}</div><div class=\"room-line\">${esc(c.line)}</div><div class=\"room-quote\">“${esc(c.quote||c.stake||'')}”</div></div>`).join('')}</div>\n  <div class=\"room-close\">One of the five lines has nobody speaking for it. You may want to notice which.</div>\n  ${nav({nextLabel:'Take the seat'})}`);wireNav(next);\n}\nfunction renderView(){\n"""
h = replace_once(h, old_position, new_position, 'position and room screens')

h = replace_once(
    h,
    "${committed?runningHTML(committed,`Team Year ${year} allocation`):notice(`Waiting for ${captain} to commit Year ${year}.`)}",
    "${committed?readOnlyAllocationHTML(committed,`Team Year ${year} allocation`):notice(`Waiting for ${captain} to commit Year ${year}.`)}",
    'team read-only allocation descriptions'
)

h = replace_once(
    h,
    """function allocRow(l,a,key){\n  const n=a[l.id],min=l.id==='run'?3:0,max=l.id==='run'?9:3;\n  const readOnly=!S.canSubmit&&S.session?.mode==='team';\n  return `<div class=\"alloc\"><div><h3>${esc(l.label)}</h3><div class=\"constraint\">${l.id==='run'&&n<=min?'Run floor: $3M keeps current operations functioning.':''}</div></div><div class=\"stepper\">\n""",
    """function readOnlyAllocationHTML(a,label){return `<div class=\"eyebrow\" style=\"margin-top:24px\">${esc(label)}</div><div class=\"allocs\">${C.lines.map(l=>`<div class=\"alloc\"><div><h3>${esc(l.label)}</h3><div class=\"constraint\">${esc(l.description||'')}</div></div><div class=\"amount\">${a[l.id]}<small> M</small></div></div>`).join('')}</div>`}\nfunction allocRow(l,a,key){\n  const n=a[l.id],min=l.id==='run'?3:0,max=l.id==='run'?9:3;\n  const readOnly=!S.canSubmit&&S.session?.mode==='team';\n  return `<div class=\"alloc\"><div><h3>${esc(l.label)}</h3><div class=\"constraint\">${esc(l.description||'')}</div></div><div class=\"stepper\">\n""",
    'allocation line descriptions'
)

h = replace_once(h, "if(!b){S.step=9;return renderClose()}", "if(!b){S.step=10;return renderClose()}", 'buyers fallback close step')
INDEX.write_text(h)

# ---------- Regression tests ----------
c = CHECK.read_text()
anchor = """assert.equal(S.META.id, 'rapid-03-midland');\nassert.deepEqual(S.META.replaces, ['rapid-03-bench']);\n"""
new_checks = """assert.equal(S.META.id, 'rapid-03-midland');\nassert.deepEqual(S.META.replaces, ['rapid-03-bench']);\nassert.equal(S.META.detail.roomIntro, 'Four people want four different things from the same nine million dollars. None of them is wrong, and none of them is going to tell you what to do.');\nassert.equal(S.META.detail.cast.length, 4);\nassert.deepEqual(S.META.detail.cast.map(x => x.name), ['Dale Brenner','Renata Oyelaran','Tom Vasquez','Sam Achterberg']);\nassert.deepEqual(S.META.detail.cast.map(x => x.line), ['Run','Uptime','Features','Connect']);\nassert.equal(S.META.detail.cast.some(x => x.line === 'Capacity'), false);\nconst inc1 = S.publicConfig();\nassert.equal(inc1.room.cast.length, 4);\nassert.equal(inc1.lines.find(x => x.id === 'capacity').description, 'Headroom for growth and for anything that needs to compute. Nobody asks for this.');\nassert.equal(inc1.lines.find(x => x.id === 'connect').description, \"Gets the data back from the units in the field, automatically. Sam's line.\");\nassert.equal(inc1.coldOpen[0].startsWith('Midland sells and services the big rooftop heating and cooling units'), true);\nassert.equal(inc1.position.startsWith('You have $9 million'), true);\n"""
c = replace_once(c, anchor, new_checks, 'scenario increment tests')
CHECK.write_text(c)

b = BUILD.read_text()
anchor = """for (const marker of ['Briefing & exhibits','Your outcome','Overall result','Three-year consequence timeline','The portfolio that produced this','Your original view','Year 2 allocation','Cumulative portfolio','Three buyers','buyer-interest'])\n  if (!index.includes(marker)) refuse('briefing/outcome-results marker missing: ' + marker);\n"""
replacement = anchor + """for (const marker of ['Forty-one years old, profitable, and nobody thinks it is in trouble.','Four people, one budget.','Take the seat','One of the five lines has nobody speaking for it','Dale Brenner','Renata Oyelaran','Tom Vasquez','Sam Achterberg',\"Nobody asks for this.\",\"Sam's line.\"])\n  if (!index.includes(marker)) refuse('increment-1 story marker missing: ' + marker);\n"""
b = replace_once(b, anchor, replacement, 'build increment markers')
BUILD.write_text(b)
