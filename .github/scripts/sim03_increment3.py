from pathlib import Path
import re

SCENARIO=Path('sim03/lib/scenario.js')
INDEX=Path('sim03/public/index.html')
CLOSING=Path('sim03/lib/closingLesson.js')
BUILD=Path('sim03/build.js')
CHECK=Path('sim03/tools/check.js')
INC2=Path('sim03/tools/increment2-check.js')
CLOSECHECK=Path('sim03/tools/closing-lesson-check.js')
INC3=Path('sim03/tools/increment3-check.js')


def rep(text, old, new, label):
    if old not in text:
        raise SystemExit(f'missing anchor: {label}')
    return text.replace(old,new,1)

# ---------------- scenario / authored content ----------------
s=SCENARIO.read_text()
s=rep(s,"{ label: 'preparation', value: 'briefing packet before class' }","{ label: 'preparation', value: 'briefing packet before the session' }",'catalogue preparation')

# Keep one canonical cast source; shortWant is only for the second allocator.
s=rep(s,"stake: 'Six million a year keeps the lights on and produces nothing new. Every conversation should start with getting that number down.',\n        quote:","stake: 'Six million a year keeps the lights on and produces nothing new. Every conversation should start with getting that number down.',\n        shortWant: 'Get the Run cost down without breaking the systems Midland still depends on.',\n        quote:",'Dale short want')
s=rep(s,"stake: \"Doesn't need software, needs eight more technicians. Every dollar spent on a system is a dollar that did not go to a truck.\",\n        quote:","stake: \"Doesn't need software, needs eight more technicians. Every dollar spent on a system is a dollar that did not go to a truck.\",\n        shortWant: 'Keep dispatch dependable; every system dollar is competing with trucks and technicians.',\n        quote:",'Renata short want')
s=rep(s,"stake: \"In eighteen months has to stand in front of the board and show them something. Doesn't care what it is. Cares that it is real.\",\n        quote:","stake: \"In eighteen months has to stand in front of the board and show them something. Doesn't care what it is. Cares that it is real.\",\n        shortWant: 'Have something real to show the board inside eighteen months.',\n        quote:",'Tom short want')
s=rep(s,"stake: 'Nineteen percent of 14,000 service visits find nothing wrong. At $290 a truck roll, the machines should be able to tell us before we drive there.',\n        quote:","stake: 'Nineteen percent of 14,000 service visits find nothing wrong. At $290 a truck roll, the machines should be able to tell us before we drive there.',\n        shortWant: 'Hear the machines before a $290 truck roll has to go find out in person.',\n        quote:",'Sam short want')

old_desc="""const LINE_DESCRIPTIONS = Object.freeze({
  run: \"Keeps the existing systems alive. Dale: six million a year keeps the lights on and he wants that number down.\",
  uptime: \"Backup and redundancy so dispatch survives a bad day. Renata: she would rather have eight more technicians than another system.\",
  capacity: 'Headroom for growth and for anything that needs to compute.',
  connect: \"Gets the data back from the units in the field, automatically. Sam: the machines already know things his technicians still have to drive out to learn.\",
  features: \"Visible new things the business can point at. Tom: in eighteen months he needs something real to show the board.\"
});"""
new_desc="""const LINE_DESCRIPTIONS = Object.freeze({
  run: 'Keeps the existing systems alive: the 14-year-old ERP, help desk, licenses, and the systems Midland uses today.',
  uptime: 'Backup and redundancy so dispatch survives a bad day.',
  capacity: 'Headroom for growth and for anything that needs to compute.',
  connect: 'Gets data back from units in the field automatically.',
  features: 'Visible new things the business can point at.'
});"""
s=rep(s,old_desc,new_desc,'line descriptions')

# Remove design-voice reveal from the competitor weak branch and keep Tom on the board window.
s=rep(s,
"The market question arrived after the architecture decision had already been made. Tom: “That is my board window. Eighteen months to build the thing after customers ask for it means we decided this before we knew we were deciding it.”",
"Tom: “That is my board window. If the build takes eighteen months from today, I have nothing real to show when I walk into that room.”",
'competitor weak voice')

# Tom asks the Year 3 question; Sam still closes every branch.
y3_old={
"strong": "Predictive uptime becomes something Midland can actually sell, not a demo. Sam: “We used to spend $290 to send a truck to hear what the machine could have told us yesterday. Now it tells us before the customer calls.”",
"data": "The CEO asks why it cannot go to every customer by spring, and the honest answer is that the harder half was built while the cheap half was starved. Sam: “You finally listened to the machines and then built nowhere for the answer to live. Now we can see the service we still cannot deliver.”",
"pilot": "It catches some failures early and proves the idea without yet changing what Midland can sell at scale. Sam: “It is real on the units we can hear. Four thousand units is a business; a corner of the fleet is still a demonstration.”",
"weak": "Technicians are still making 14,000 service visits a year and 19% still find nothing wrong because the machines cannot tell Midland what they know remotely. Sam: “There has never been anywhere to put what they say. Three years later, that is still true.”"
}
y3_new={
"strong": "Predictive uptime becomes something Midland can actually sell, not a demo. Tom: “This is real. I can put a service in front of the board instead of another promise.” Sam: “We used to spend $290 to send a truck to hear what the machine could have told us yesterday. Now it tells us before the customer calls.”",
"data": "The CEO asks why it cannot go to every customer by spring, and the honest answer is that the harder half was built while the cheap half was starved. Tom: “A demo that works some mornings is not a launch plan I can take to the board.” Sam: “You finally listened to the machines and then built nowhere for the answer to live. Now we can see the service we still cannot deliver.”",
"pilot": "It catches some failures early and proves the idea without yet changing what Midland can sell at scale. Tom: “I can show the board a pilot. I still cannot show them a business.” Sam: “It is real on the units we can hear. Four thousand units is a business; a corner of the fleet is still a demonstration.”",
"weak": "Technicians are still making 14,000 service visits a year and 19% still find nothing wrong because the machines cannot tell Midland what they know remotely. Tom: “I asked for something real. There is still nothing here that customers can buy at scale.” Sam: “There has never been anywhere to put what they say. Three years later, that is still true.”"
}
for k in y3_old: s=rep(s,y3_old[k],y3_new[k],f'year3 {k} Tom reaction')

s=rep(s,
"copy: 'We are buying the customers and the service contracts. Your systems are overhead we plan to retire in the first year.'",
"copy: 'We are buying the customers and the service contracts. Your systems are overhead we plan to retire in the first year.',\n    roomLink: 'No one in the room was arguing for this outcome. Carrolton is buying Midland’s customers and contracts, not the architecture.'",
'Carrolton room link')
s=rep(s,
"high: 'Likes what it sees: a lean operation with no expensive habits. Plans to hold four years and sell, and nothing in your portfolio gets in the way of that.'",
"high: 'Likes what it sees: a lean operation with no expensive habits. After closing, it plans to keep capital spending tight, harvest cash for four years, and sell; nothing in your portfolio gets in the way of that plan.'",
'Ridge high consequence')

# Outcome-attached allocation signals: after the event, not before it.
anchor='function evaluateYear1(y1, thresholds) {'
helpers="""function year1AllocationNotes(y1, t, band) {
  const connect = Number(y1.connect || 0), run = Number(y1.run || 0);
  let connectNote;
  if (band === 'strong') {
    const margin = connect - t.year1ConnectStrong;
    connectNote = `Year 1 Connect was $${connect}M. ${margin === 0 ? 'That put Midland exactly on the line that made the district report a remote-data job instead of a field exercise.' : `That was $${margin}M above the level that made the district report a remote-data job instead of a field exercise.`}`;
  } else if (band === 'middle') {
    connectNote = `Year 1 Connect was $${connect}M. $${Math.max(1, t.year1ConnectStrong - connect)}M more would have moved the district report from patchwork to a clean remote pull.`;
  } else {
    connectNote = `Year 1 Connect was $0M. With no remote path to the units, the district report became a week on roofs; $${t.year1ConnectStrong}M in Connect would have put Midland on the strong-report line.`;
  }
  const baseline = 6.1;
  const delta = baseline - run;
  const daleNote = delta > 0
    ? `Dale started from last year’s $6.1M Run bill. Holding Run at $${run}M freed $${delta.toFixed(1)}M versus last year for the other four lines.`
    : `Dale started from last year’s $6.1M Run bill. At $${run}M, Run used at least as much of the fixed $9M as last year, leaving less room for new capability.`;
  return [connectNote, daleNote];
}

function heatAllocationNotes(c, t, band) {
  const x = Number(c.uptime || 0), strong = Number(t.heatUptimeStrong), middle = Number(t.heatUptimeMiddle);
  if (band === 'strong') {
    const extra = x - strong;
    return [`Cumulative Uptime was $${x}M. Dispatch needed $${strong}M to hold through the heat wave; ${extra > 0 ? `$${extra}M sat above that line.` : 'you were exactly on that line.'}`];
  }
  if (band === 'middle') {
    return [`Cumulative Uptime was $${x}M. $${strong - x}M more would have kept dispatch fully online; $${x - middle + 1}M less would have produced the four-day outage.`];
  }
  return [`Cumulative Uptime was $${x}M. $${Math.max(0, middle - x)}M more would have avoided the four-day outage, and $${Math.max(0, strong - x)}M more would have kept dispatch fully online.`];
}

"""
if anchor not in s: raise SystemExit('missing evaluateYear1 anchor')
s=s.replace(anchor,helpers+anchor,1)

old_y1="""function evaluateYear1(y1, thresholds) {
  const t = sanitizeThresholds(thresholds);
  const c = y1.connect;
  if (c >= t.year1ConnectStrong) {
    return { band: 'strong', title: 'The school district asks for a performance report', narrative: COPY.year1.strong, year2Intro: YEAR2_INTRO.strong };
  }
  if (c > 0) {
    return { band: 'middle', title: 'The school district asks for a performance report', narrative: COPY.year1.middle, year2Intro: YEAR2_INTRO.middle };
  }
  return { band: 'weak', title: 'The school district asks for a performance report', narrative: COPY.year1.weak, year2Intro: YEAR2_INTRO.weak };
}"""
new_y1="""function evaluateYear1(y1, thresholds) {
  const t = sanitizeThresholds(thresholds);
  const c = y1.connect;
  if (c >= t.year1ConnectStrong) {
    return { band: 'strong', title: 'The school district asks for a performance report', narrative: COPY.year1.strong, allocationNotes: year1AllocationNotes(y1, t, 'strong'), year2Intro: YEAR2_INTRO.strong };
  }
  if (c > 0) {
    return { band: 'middle', title: 'The school district asks for a performance report', narrative: COPY.year1.middle, allocationNotes: year1AllocationNotes(y1, t, 'middle'), year2Intro: YEAR2_INTRO.middle };
  }
  return { band: 'weak', title: 'The school district asks for a performance report', narrative: COPY.year1.weak, allocationNotes: year1AllocationNotes(y1, t, 'weak'), year2Intro: YEAR2_INTRO.weak };
}"""
s=rep(s,old_y1,new_y1,'year1 allocation notes')
s=rep(s,"if (c.uptime >= t.heatUptimeStrong) heat = { band: 'strong', narrative: COPY.heat.strong };","if (c.uptime >= t.heatUptimeStrong) heat = { band: 'strong', narrative: COPY.heat.strong, allocationNotes: heatAllocationNotes(c, t, 'strong') };",'heat strong note')
s=rep(s,"else if (c.uptime >= t.heatUptimeMiddle) heat = { band: 'middle', narrative: COPY.heat.middle };","else if (c.uptime >= t.heatUptimeMiddle) heat = { band: 'middle', narrative: COPY.heat.middle, allocationNotes: heatAllocationNotes(c, t, 'middle') };",'heat middle note')
s=rep(s,"else heat = { band: 'weak', narrative: COPY.heat.weak };","else heat = { band: 'weak', narrative: COPY.heat.weak, allocationNotes: heatAllocationNotes(c, t, 'weak') };",'heat weak note')

s=rep(s,"reason: BUYERS.carrolton.copy\n    },","reason: BUYERS.carrolton.copy,\n      roomLink: BUYERS.carrolton.roomLink\n    },",'Carrolton public roomLink')

s=rep(s,
"advocate: cast ? { name: cast.name, want: cast.stake } : null",
"advocate: cast ? { name: cast.name, want: cast.quote, shortWant: cast.shortWant || cast.stake } : null",
'public advocate copy')

old_intro="""      intro: [
        'Read this before Tuesday. It is the only preparation for the class.',
        'You are about to take over technology decisions at Midland Equipment. On Tuesday your team will spend three years of the company’s money in eighty minutes. Nobody will re-explain this packet in class, and the teams that read it carefully will run the room. It should take you about six minutes.'
      ],"""
new_intro="""      intro: [
        'Read this before the session. It is the briefing built into the simulation.',
        'You are about to take over technology decisions at Midland Equipment. In about thirty minutes you will make two annual $9 million allocations, then see what the third year reveals after the decision window has closed. The simulation can be played individually or as a team. This briefing should take about six minutes.'
      ],"""
s=rep(s,old_intro,new_intro,'generic briefing intro')
s=rep(s,"note: 'Reference copy of the pre-class packet. It is collapsed by default so the simulation does not reteach the briefing.',","note: 'In-app briefing packet. It is collapsed during play so you can reopen facts without rereading the whole setup.',",'briefing note')

old_people="""      people: [
        { role: 'The CFO', quote: 'Six million dollars a year keeps the lights on and produces nothing new. Every conversation we have should start with getting that number down.' },
        { role: 'The VP of Service', quote: 'I do not need software. I need eight more technicians. Every dollar you spend on a system is a dollar that did not go to a truck.' },
        { role: 'The CEO', quote: 'In eighteen months I have to stand in front of the board and show them something. I do not care what it is. I care that it is real.' },
        { role: 'A technician, 22 years at Midland', quote: 'Those machines have been telling us they were about to fail for years. There has never been anywhere to put what they say.' }
      ],"""
new_people="""      people: META.detail.cast.map(({ name, role, quote }) => ({ name, role, quote })),"""
s=rep(s,old_people,new_people,'packet cast from canonical source')
old_happens="""      whatHappens: [
        'Your team runs Midland’s technology for three years. Each year you get $9 million, you spend all of it across five lines, and then you find out what happened that year.',
        'You do not get to save money. Come with a view about what this company should become. You will be asked for it early, in one sentence.'
      ]"""
new_happens="""      whatHappens: [
        'You make two annual $9 million allocations across five lines. Year 1 reveals the first consequence; after the second allocation, two Year 2 events resolve; Year 3 is then revealed with no further allocation.',
        'In individual mode you commit your own choices. In team mode the group works from one shared run. In either mode, you cannot save money or borrow from the next year.',
        'Come with a view about what this company should become. You will be asked for it early, in one sentence.'
      ]"""
s=rep(s,old_happens,new_happens,'packet structure')

old_cold="""    coldOpen: [
      'Midland sells and services the big rooftop heating and cooling units on schools, hospitals, and office buildings across Ohio, Indiana, and Michigan. About four thousand of them are out there right now. Sixty-two technicians drive to those buildings all day, every day.',
      'Selling equipment brings in most of the revenue. Servicing it brings in most of the profit.',
      'The main office system is fourteen years old. Every unit installed since 2016 records its own run hours, temperatures, and faults. Nobody has ever looked at that data, because the only way to see it is to drive out and plug in a laptop.',
      'You are about to take over technology decisions here.'
    ],"""
new_cold="""    coldOpen: [
      'Midland sells and services the big rooftop heating and cooling units on schools, hospitals, and office buildings across Ohio, Indiana, and Michigan. About four thousand of them are out there right now. Sixty-two technicians drive to those buildings all day, every day.',
      'The main office system is fourteen years old. Every unit installed since 2016 records its own run hours, temperatures, and faults. Nobody has ever looked at that data, because the only way to see it is to drive out and plug in a laptop.',
      'Selling equipment brings in most of the revenue. Servicing it brings in most of the profit.',
      'You are about to take over technology decisions here.'
    ],"""
s=rep(s,old_cold,new_cold,'brief callout order')
s=rep(s,"'You have $9 million to allocate this year across five lines. You cannot borrow from next year, and the annual caps are real.'","'You have $9 million to allocate this year across five lines. Run has a $3M minimum. Uptime, Capacity, Connect, and Features each have a $3M annual ceiling. Spend all $9M; you cannot borrow from next year.'",'position explicit caps')
s=rep(s,
"      'Dale, Renata, Tom, or Sam: whose argument did you overrule most, and would you make the same call after seeing Year 3?',\n      'If you could change one Year 1 million after seeing Year 3, where would it move and why?'\n    ],\n    reflectionDisclosure:",
"      'Which of Dale, Renata, Tom, or Sam did you overrule most?',\n      'If you could change one Year 1 million after seeing Year 3, where would it move and why?'\n    ],\n    reflectionFollowups: [\n      'After seeing Year 3, would you make the same call? Why or why not?',\n      ''\n    ],\n    reflectionDisclosure:",
'reflection split')
SCENARIO.write_text(s)

# ---------------- student UI / layout ----------------
h=INDEX.read_text()
# Add override/new classes without disturbing established visual language.
css="""
.brief-screen .copy{line-height:1.55}.brief-screen .copy>p{margin-bottom:10px}.brief-screen .brief-profit{margin:12px 0;padding:11px 14px}.brief-screen .briefing-prep{margin-top:14px;padding:11px 13px}.brief-screen .actions{margin-top:16px}
.line-guide-main{min-width:0}.line-guide-desc{display:block;font-size:14px;color:var(--dim);line-height:1.45}.line-guide-voice{margin-top:7px;padding:7px 9px;border-left:2px solid var(--line2);background:rgba(255,255,255,.018);font-size:13px;color:#C8C5BD;line-height:1.45}.line-guide-voice b{display:block;font:600 9px var(--mono);letter-spacing:.09em;text-transform:uppercase;color:var(--bone);margin-bottom:3px}.line-guide-voice.capacity{color:var(--dim);font-style:italic}
.budget{align-self:start;height:max-content}.advocate-reminder.capacity-silence{color:var(--dim);font-style:italic}.advocate-reminder.capacity-silence b{color:var(--dim)}
.year2-history{margin:16px 0;border:1px solid var(--line);background:var(--panel)}.year2-history>summary{cursor:pointer;padding:10px 12px;font:10px var(--mono);letter-spacing:.11em;text-transform:uppercase;color:var(--amber);list-style:none}.year2-history>summary::-webkit-details-marker{display:none}.year2-history>summary:after{content:'+';float:right;color:var(--dim)}.year2-history[open]>summary:after{content:'−'}.year2-history .year2-breakdown{margin:0;border:0;border-top:1px solid var(--line)}
.outcome-signals{display:grid;gap:7px;margin-top:10px}.outcome-signal{border-left:2px solid var(--line2);padding:8px 10px;background:rgba(255,255,255,.018);font-size:13px;line-height:1.5;color:var(--dim)}.year3-lock{display:inline-flex;margin:4px 0 8px;border:1px solid var(--line2);padding:5px 8px;font:10px var(--mono);letter-spacing:.08em;text-transform:uppercase;color:var(--dim)}.reflection-followup{margin:-1px 0 8px;font-size:15px;color:#C9C6BE;line-height:1.5}
"""
if '</style>' not in h: raise SystemExit('missing style close')
h=h.replace('</style>',css+'\n</style>',1)

h=rep(h,"const people=(b.people||[]).map(p=>`<div class=\"briefing-person\"><b>${esc(p.role)}.</b> “${esc(p.quote)}”</div>`).join('');","const people=(b.people||[]).map(p=>`<div class=\"briefing-person\"><b>${esc(p.name||p.role)} · ${esc(p.role)}</b><br>“${esc(p.quote)}”</div>`).join('');",'packet named people')
h=rep(h,'Pre-class briefing · about 6 minutes','Pre-session briefing · about 6 minutes','briefing kicker')
h=rep(h,'<h3>What happens Tuesday</h3>','<h3>What happens in the simulation</h3>','briefing section title')

old_brief="""function renderBrief(){
  shell(`<div class=\"eyebrow\">MIDLAND EQUIPMENT</div><h2>Forty-one years old, profitable, and nobody thinks it is in trouble.</h2>
  <div class=\"copy\">${C.coldOpen.map((x,i)=>i===1?`<div class=\"brief-profit\"><div class=\"eyebrow\">The business model</div><p>${esc(x)}</p></div>`:`<p>${esc(x)}</p>`).join('')}</div>
  <p class=\"lede\">There is no score, rank, grade or hidden correct allocation. You will find out what happened, not how you \"did.\"</p>
  <div class=\"briefing-prep\"><div class=\"briefing-prep-copy\"><span class=\"small\">Before you continue</span><b>This sim assumes you have read the briefing packet your instructor posted before class.</b> If you have not read it yet, read the full packet here before starting.</div><button class=\"btn\" data-open-briefing>Read briefing packet</button></div>
  ${sessionGate()}${!S.session?(LAUNCH&&(LAUNCH.role==='faculty'||LAUNCH.role==='faculty_preview')?'<div class=\"actions\"><button class=\"btn\" id=\"runSessionEntry\">Run a facilitated session</button></div>':'<div class=\"actions\"><button class=\"btn\" id=\"joinSessionEntry\">Join a facilitated session</button></div>'):''}${nav({backOk:false,disabled:blocked()})}`);
  const runEntry=document.getElementById('runSessionEntry');if(runEntry)runEntry.onclick=()=>location.assign(BASE+'/instructor.html#lt='+encodeURIComponent(LAUNCH_TOKEN));
  const joinEntry=document.getElementById('joinSessionEntry');if(joinEntry)joinEntry.onclick=()=>{S.error='';renderJoin()};
  wireNav(next,false);
}"""
new_brief="""function renderBrief(){
  shell(`<section class=\"brief-screen\"><div class=\"eyebrow\">MIDLAND EQUIPMENT</div><h2>Forty-one years old, profitable, and nobody thinks it is in trouble.</h2>
  <div class=\"copy\">${C.coldOpen.map((x,i)=>i===2?`<div class=\"brief-profit\"><div class=\"eyebrow\">The business model</div><p>${esc(x)}</p></div>`:`<p>${esc(x)}</p>`).join('')}</div>
  <p class=\"lede\">There is no score, rank, grade or hidden correct allocation. You will find out what happened, not how you \"did.\"</p>
  <div class=\"briefing-prep\"><div class=\"briefing-prep-copy\"><span class=\"small\">Before you continue</span><b>This sim assumes you have read the briefing packet before starting.</b> If you have not read it yet, open the in-app packet here before continuing.</div><button class=\"btn\" data-open-briefing>Read briefing packet</button></div>
  ${sessionGate()}${!S.session?(LAUNCH&&(LAUNCH.role==='faculty'||LAUNCH.role==='faculty_preview')?'<div class=\"actions\"><button class=\"btn\" id=\"runSessionEntry\">Run a facilitated session</button></div>':'<div class=\"actions\"><button class=\"btn\" id=\"joinSessionEntry\">Join a facilitated session</button></div>'):''}${nav({backOk:false,disabled:blocked()})}</section>`);
  const runEntry=document.getElementById('runSessionEntry');if(runEntry)runEntry.onclick=()=>location.assign(BASE+'/instructor.html#lt='+encodeURIComponent(LAUNCH_TOKEN));
  const joinEntry=document.getElementById('joinSessionEntry');if(joinEntry)joinEntry.onclick=()=>{S.error='';renderJoin()};
  wireNav(next,false);
}"""
h=rep(h,old_brief,new_brief,'brief screen')

old_lineguide="""function lineGuide(){return `<div class=\"line-guide\">${C.lines.map(l=>`<div class=\"line-guide-row\"><b>${esc(l.label)}</b><span>${esc(l.description||'')}</span></div>`).join('')}</div>`}
function renderPosition(){
  shell(`<div class=\"eyebrow\">Your position</div><h2>You run technology at Midland.</h2><p class=\"lede\">${esc(C.position)}</p>
  <div class=\"rule\"></div><div class=\"eyebrow\">The five lines</div>${lineGuide()}
  ${nav()}`);wireNav(next);
}"""
new_lineguide="""function positionVoice(l){const a=l?.advocate;return a?`<div class=\"line-guide-voice\"><b>${esc(a.name)} · speaks for ${esc(l.label)}</b>${esc(a.shortWant||a.want||'')}</div>`:`<div class=\"line-guide-voice capacity\"><b>Capacity</b>No one in the room speaks for this line.</div>`}
function lineGuide(){return `<div class=\"line-guide\">${C.lines.map(l=>`<div class=\"line-guide-row\"><b>${esc(l.label)}</b><div class=\"line-guide-main\"><span class=\"line-guide-desc\">${esc(l.description||'')}</span>${positionVoice(l)}</div></div>`).join('')}</div>`}
function renderPosition(){
  shell(`<div class=\"eyebrow\">Your position</div><h2>You run technology at Midland.</h2><p class=\"lede\">${esc(C.position)}</p>
  <div class=\"rule\"></div><div class=\"eyebrow\">The five lines</div>${lineGuide()}
  ${nav()}`);wireNav(next);
}"""
h=rep(h,old_lineguide,new_lineguide,'position voices')

old_helpers="""function allocationRule(line){return line.id==='run'?'$3M minimum · balance of budget is the only ceiling':'$3M annual ceiling'}
function allocationCap(line){return line.id==='run'?'MIN $3M':'MAX $3M / YEAR'}
function lineAdvocate(line){const a=line?.advocate;if(!a)return '';return `<div class=\"advocate-reminder\"><b>${esc(a.name)} · speaks for ${esc(line.label)}</b><span>${esc(a.want)}</span></div>`}
function year2BreakdownHTML(y1,y2,year2Label='Year 2 draft'){
  if(!y1||!y2)return '';
  const rows=C.lines.map(l=>{const a=Number(y1[l.id]||0),b=Number(y2[l.id]||0);return `<div class=\"year2-breakdown-row\"><div class=\"year2-breakdown-name\">${esc(l.label)}</div><div class=\"year2-breakdown-num\">$${a}M</div><div class=\"year2-breakdown-num\">$${b}M</div><div class=\"year2-breakdown-num year2-breakdown-total\">$${a+b}M</div></div>`}).join('');
  return `<div class=\"eyebrow\" style=\"margin-top:24px\">Year 1 + Year 2 split</div><div class=\"year2-breakdown\"><div class=\"year2-breakdown-row year2-breakdown-head\"><div>Line</div><div>Year 1 committed</div><div>${esc(year2Label)}</div><div>Cumulative</div></div>${rows}</div>`;
}"""
new_helpers="""function allocationCap(line){return line.id==='run'?'MIN $3M':'MAX $3M / YEAR'}
function lineAdvocate(line,year=1){const a=line?.advocate;if(!a)return `<div class=\"advocate-reminder capacity-silence\"><b>No advocate · ${esc(line.label)}</b><span>No one in the room speaks for this line.</span></div>`;const text=year===2?(a.shortWant||a.want):a.want;return `<div class=\"advocate-reminder\"><b>${esc(a.name)} · speaks for ${esc(line.label)}</b><span>${esc(text)}</span></div>`}
function year2BreakdownHTML(y1,y2,year2Label='Year 2 draft'){
  if(!y1||!y2)return '';
  const rows=C.lines.map(l=>{const a=Number(y1[l.id]||0),b=Number(y2[l.id]||0);return `<div class=\"year2-breakdown-row\"><div class=\"year2-breakdown-name\">${esc(l.label)}</div><div class=\"year2-breakdown-num\">$${a}M</div><div class=\"year2-breakdown-num\">$${b}M</div><div class=\"year2-breakdown-num year2-breakdown-total\">$${a+b}M</div></div>`}).join('');
  return `<details class=\"year2-history\"><summary>Year 1 + Year 2 split · open to compare</summary><div class=\"year2-breakdown\"><div class=\"year2-breakdown-row year2-breakdown-head\"><div>Line</div><div>Year 1 committed</div><div>${esc(year2Label)}</div><div>Cumulative</div></div>${rows}</div></details>`;
}"""
h=rep(h,old_helpers,new_helpers,'allocator helpers')
h=rep(h,"<p class=\"lede\">Write one sentence before you see the first allocation outcome.</p>","<p class=\"lede\">You have heard four reasonable, incompatible answers about what Midland needs. Write one sentence that picks a side — or states a fifth position — before you see the first allocation outcome.</p>",'view tied to voices')

# Keep behavior, remove repeated paraphrase/footer from allocator rows.
old_read="function readOnlyAllocationHTML(a,label){return `<div class=\"eyebrow\" style=\"margin-top:24px\">${esc(label)}</div><div class=\"allocs\">${C.lines.map(l=>`<div class=\"alloc\"><div><div class=\"alloc-title-row\"><h3>${esc(l.label)}</h3><span class=\"alloc-cap\">${esc(allocationCap(l))}</span></div><div class=\"constraint\">${esc(l.description||'')}</div>${lineAdvocate(l)}<div class=\"alloc-rule\">${esc(allocationRule(l))}</div></div><div class=\"amount\">${a[l.id]}<small> M</small></div></div>`).join('')}</div>`}"
new_read="function readOnlyAllocationHTML(a,label,year=1){return `<div class=\"eyebrow\" style=\"margin-top:24px\">${esc(label)}</div><div class=\"allocs\">${C.lines.map(l=>`<div class=\"alloc\"><div><div class=\"alloc-title-row\"><h3>${esc(l.label)}</h3><span class=\"alloc-cap\">${esc(allocationCap(l))}</span></div>${lineAdvocate(l,year)}</div><div class=\"amount\">${a[l.id]}<small> M</small></div></div>`).join('')}</div>`}"
h=rep(h,old_read,new_read,'read only allocator dedupe')
h=rep(h,"return `<div class=\"alloc\"><div><div class=\"alloc-title-row\"><h3>${esc(l.label)}</h3><span class=\"alloc-cap\">${esc(allocationCap(l))}</span></div><div class=\"constraint\">${esc(l.description||'')}</div>${lineAdvocate(l)}<div class=\"alloc-rule\">${esc(allocationRule(l))}</div></div><div class=\"stepper\">","return `<div class=\"alloc\"><div><div class=\"alloc-title-row\"><h3>${esc(l.label)}</h3><span class=\"alloc-cap\">${esc(allocationCap(l))}</span></div>${lineAdvocate(l,key)}</div><div class=\"stepper\">",'editable allocator dedupe')
# allocRow third argument is the year number despite the old variable name.
h=h.replace('function allocRow(l,a,key){','function allocRow(l,a,key){',1)
# shared results know which annual allocator the student is reviewing.
h=rep(h,"${r.year1?readOnlyAllocationHTML(r.year1,'Shared Year 1 allocation'):''}\n    ${r.year2?readOnlyAllocationHTML(r.year2,'Shared Year 2 allocation'):''}","${r.year1?readOnlyAllocationHTML(r.year1,'Shared Year 1 allocation',1):''}\n    ${r.year2?readOnlyAllocationHTML(r.year2,'Shared Year 2 allocation',2):''}",'team shared allocation copy')

# Outcome signals and story-first ordering.
insert='function runningHTML(o,label){return `<div class="eyebrow" style="margin-top:24px">${esc(label)}</div><div class="running">${C.lines.map(l=>`<div class="run-cell"><div class="v">${o[l.id]}</div><div class="k">${esc(l.label)}</div></div>`).join(\'\')}</div>`}\n'
if insert not in h: raise SystemExit('missing runningHTML anchor')
h=h.replace(insert,insert+"function allocationNotesHTML(o){const notes=Array.isArray(o?.allocationNotes)?o.allocationNotes.filter(Boolean):[];return notes.length?`<div class=\"outcome-signals\">${notes.map(x=>`<div class=\"outcome-signal\">${esc(x)}</div>`).join('')}</div>`:''}\n",1)

old_y1ui="""function renderYear1Outcome(){
  const o=S.year1Outcome;
  shell(`<div class=\"eyebrow\">Year 1 outcome</div><h2>A renewal is six weeks away. The district wants proof.</h2>
  ${runningHTML(S.year1,'Year 1 portfolio')}
  ${o?`<div class=\"outcome\"><h3>${esc(o.title)}</h3><p>${esc(o.narrative)}</p></div>`:notice('Outcome not loaded. Return to Year 1 and recommit.',true)}
  ${nav({backOk:false})}`);wireNav(next,false);
}"""
new_y1ui="""function renderYear1Outcome(){
  const o=S.year1Outcome;
  shell(`<div class=\"eyebrow\">Year 1 outcome</div><h2>A renewal is six weeks away. The district wants proof.</h2>
  ${o?`<div class=\"outcome\"><h3>${esc(o.title)}</h3><p>${esc(o.narrative)}</p>${allocationNotesHTML(o)}</div>`:notice('Outcome not loaded. Return to Year 1 and recommit.',true)}
  ${runningHTML(S.year1,'Year 1 portfolio')}
  ${nav({backOk:false})}`);wireNav(next,false);
}"""
h=rep(h,old_y1ui,new_y1ui,'year1 story first')

old_y2ui="""  const first=o?`<div class=\"outcome\"><h3>${esc(o.heat.title)}</h3><p>${esc(o.heat.narrative)}</p></div>`:'';
  const second=o?`<div class=\"outcome\"><h3>${esc(o.competitor.title)}</h3><p>${esc(o.competitor.narrative)}</p></div>`:'';
  shell(`<div class=\"eyebrow\">Year 2 outcomes</div><h2>Year 2 stops being quiet.</h2><p class=\"lede\">First the weather turns. Then the market does.</p>${cum?runningHTML(cum,'Cumulative portfolio'):''}
  ${o?`<div class=\"events\" style=\"grid-template-columns:1fr\">${first}${S.year2Event>=1?second:''}</div>`:notice('Outcome not loaded. Return to Year 2 and recommit.',true)}"""
new_y2ui="""  const first=o?`<div class=\"outcome\"><h3>${esc(o.heat.title)}</h3><p>${esc(o.heat.narrative)}</p>${allocationNotesHTML(o.heat)}</div>`:'';
  const second=o?`<div class=\"outcome\"><h3>${esc(o.competitor.title)}</h3><p>${esc(o.competitor.narrative)}</p></div>`:'';
  shell(`<div class=\"eyebrow\">Year 2 outcomes</div><h2>Year 2 stops being quiet.</h2><p class=\"lede\">First the weather turns. Then the market does.</p>
  ${o?`<div class=\"events\" style=\"grid-template-columns:1fr\">${first}${S.year2Event>=1?second:''}</div>`:notice('Outcome not loaded. Return to Year 2 and recommit.',true)}
  ${cum?runningHTML(cum,'Cumulative portfolio'):''}"""
h=rep(h,old_y2ui,new_y2ui,'year2 story first and heat signal')

h=rep(h,"  <p class=\"lede\">The request is now on the table. The architecture underneath it is the one built over the previous two years.</p>","  <p class=\"lede\">The request is now on the table.</p><div class=\"year3-lock\">No Year 3 allocation · the two committed portfolios now stand</div>",'year3 no allocation')

# Split the first reflection visually while retaining the existing two saved response fields.
h=rep(h,"<div class=\"field\"><label>${esc(C.reflectionPrompts[0])}</label><textarea id=\"r1\" maxlength=\"1500\">${esc(S.reflection1)}</textarea>","<div class=\"field\"><label>${esc(C.reflectionPrompts[0])}</label>${C.reflectionFollowups?.[0]?`<div class=\"reflection-followup\">${esc(C.reflectionFollowups[0])}</div>`:''}<textarea id=\"r1\" maxlength=\"1500\">${esc(S.reflection1)}</textarea>",'team reflection followup')
# same literal appears a second time in runner close; replace next occurrence.
h=rep(h,"<div class=\"field\"><label>${esc(C.reflectionPrompts[0])}</label><textarea id=\"r1\" maxlength=\"1500\">${esc(S.reflection1)}</textarea>","<div class=\"field\"><label>${esc(C.reflectionPrompts[0])}</label>${C.reflectionFollowups?.[0]?`<div class=\"reflection-followup\">${esc(C.reflectionFollowups[0])}</div>`:''}<textarea id=\"r1\" maxlength=\"1500\">${esc(S.reflection1)}</textarea>",'runner reflection followup')
h=rep(h,'<div class="eyebrow">Close</div><h2>The decisions are over. What changed your mind?</h2>','<div class="eyebrow">Close</div><h2>The decisions are over. Explain what you would defend or change.</h2>','close headline')
INDEX.write_text(h)

# ---------------- closing lesson ----------------
CLOSING.write_text(r'''\'use strict\';

// Student-specific closing interpretation. It only explains outcomes already
// resolved by the scenario engine; it does not add thresholds, scores or bands.
const ORDER = ['run', 'uptime', 'capacity', 'connect', 'features'];
const LABELS = { run:'Run', uptime:'Uptime', capacity:'Capacity', connect:'Connect', features:'Features' };
const PEOPLE = { run:'Dale', uptime:'Renata', connect:'Sam', features:'Tom' };

function amount(v){ const n=Number(v); return Number.isFinite(n)?n:0; }
function cumulative(y1,y2){ const out={}; for(const k of ORDER) out[k]=amount(y1&&y1[k])+amount(y2&&y2[k]); return out; }
function largestLine(c){ let key=ORDER[0]; for(const k of ORDER.slice(1)) if(c[k]>c[key]) key=k; return {key,label:LABELS[key],amount:c[key]}; }
function dollars(n){ return `$${Math.max(0,Number(n)||0)}M`; }

function year3Sentence(c,band){
  if(band==='strong') return `By Year 3, your $${c.connect}M in Connect and $${c.capacity}M in Capacity worked together: Midland had both field history and room to turn predictive service into something it could actually sell.`;
  if(band==='data_no_room') return `By Year 3, your $${c.connect}M in Connect had created the field history, but $${c.capacity}M in Capacity left too little room to run the model reliably at scale.`;
  if(band==='pilot') return `By Year 3, your $${c.connect}M in Connect and $${c.capacity}M in Capacity got Midland to a promising pilot, but not yet to a predictive-service business.`;
  if(band==='weak') return `By Year 3, your $${c.connect}M in Connect had not created enough usable field history for prediction to become a real capability.`;
  return '';
}
function heatSentence(c,band){
  if(band==='strong') return `Your $${c.uptime}M in Uptime meant dispatch held when the heat wave tested it.`;
  if(band==='middle') return `Your $${c.uptime}M in Uptime kept the heat wave from becoming a full breakdown, but the service operation still fell back to manual work.`;
  if(band==='weak') return `Your $${c.uptime}M in Uptime left the service operation exposed when the heat wave arrived.`;
  return '';
}
function competitorSentence(c,band){
  if(band==='strong') return `The same $${c.connect}M Connect investment let Midland answer the competitor from a position of strength.`;
  if(band==='middle') return `The same $${c.connect}M Connect investment got Midland only as far as a limited pilot against the competitor.`;
  if(band==='weak') return `The same $${c.connect}M Connect investment was not enough to answer the competitor quickly.`;
  return '';
}
function buyerSentence(buyers){
  const ridge=buyers&&buyers.ridge_hollow&&buyers.ridge_hollow.interest;
  const corven=buyers&&buyers.corven&&buyers.corven.interest;
  if(!ridge||!corven)return '';
  if(ridge===corven)return `Ridge Hollow and Corven both showed ${ridge} interest, but for different reasons: Ridge Hollow was asking Dale’s question about the spending base while Corven was asking Sam’s question about the connected-data asset.`;
  return `Ridge Hollow showed ${ridge} interest while Corven showed ${corven} interest. Ridge Hollow was asking Dale’s question about the cost base; Corven was asking Sam’s question about the connected-data asset. The portfolio did not change between those judgments; what each buyer valued did.`;
}

function primaryNearMiss(c,y3,heat,competitor,t){
  if(!t)return '';
  const ys=Number(t.year3ConnectStrong), cap=Number(t.year3CapacityStrong), yp=Number(t.year3ConnectPilotMin), hs=Number(t.heatUptimeStrong), hm=Number(t.heatUptimeMiddle), cs=Number(t.competitorConnectStrong), cp=Number(t.competitorConnectPilotMin);
  if(![ys,cap,yp,hs,hm,cs,cp].every(Number.isFinite))return '';
  if(y3==='data_no_room') return `${dollars(cap-c.capacity)} more in Capacity would have turned the working demo into a capability Midland could run at scale.`;
  if(y3==='weak') return `${dollars(Math.max(0,yp-c.connect))} more in Connect would have reached the Year 3 pilot.`;
  if(y3==='pilot') return `${dollars(Math.max(0,ys-c.connect))} more in Connect would have moved Midland out of the pilot; with Capacity at ${dollars(c.capacity)}, the next outcome would have been ${c.capacity>=cap?'the full predictive-service capability':'data without room to run it'}.`;
  if(competitor==='weak') return `${dollars(Math.max(0,cp-c.connect))} more in Connect would have given Midland a credible competitor pilot.`;
  if(competitor==='middle') return `${dollars(Math.max(0,cs-c.connect))} more in Connect would have let Midland match the competitor outright.`;
  if(heat==='weak') return `${dollars(Math.max(0,hm-c.uptime))} more in Uptime would have avoided the four-day dispatch outage.`;
  if(heat==='middle') return `${dollars(Math.max(0,hs-c.uptime))} more in Uptime would have kept dispatch fully online.`;
  const candidates=[
    {n:c.capacity-cap+1,text:`${dollars(c.capacity-cap+1)} less in Capacity would have left the same field history without enough room to run reliably.`},
    {n:c.connect-cs+1,text:`${dollars(c.connect-cs+1)} less in Connect would have reduced Midland’s competitor response to a pilot.`},
    {n:c.uptime-hs+1,text:`${dollars(c.uptime-hs+1)} less in Uptime would have pushed the heat wave into the degraded-dispatch outcome.`}
  ].filter(x=>Number.isFinite(x.n)&&x.n>0).sort((a,b)=>a.n-b.n);
  return candidates[0]?.text||'';
}

function tradeSentence(c,t){
  if(!t)return '';
  const hs=Number(t.heatUptimeStrong), cp=Number(t.competitorConnectPilotMin), ys=Number(t.year3ConnectStrong), cap=Number(t.year3CapacityStrong);
  if(Number.isFinite(hs)&&Number.isFinite(cp)&&c.uptime>=2*hs&&c.connect<cp){
    return `Renata’s Uptime line received $${c.uptime}M — at least twice the level that held dispatch in the heat wave — while Sam’s Connect line received $${c.connect}M. The extra resilience came with less field visibility.`;
  }
  if(Number.isFinite(ys)&&Number.isFinite(cap)&&c.connect>=ys&&c.capacity<cap){
    return `Sam’s Connect line received $${c.connect}M while Capacity received $${c.capacity}M. Midland bought the field history and not enough room to use it at scale.`;
  }
  if(c.features>=4&&c.connect<=2){
    return `Tom’s Features line received $${c.features}M while Sam’s Connect line received $${c.connect}M. Midland bought more that people could point at and less of the field visibility needed to respond later.`;
  }
  if(c.run>=8){
    return `Dale’s Run line received $${c.run}M of the two-year $18M total. Keeping today’s systems funded that heavily left correspondingly less room for capabilities that only paid off when later events arrived.`;
  }
  const hi=ORDER.reduce((a,k)=>c[k]>c[a]?k:a,ORDER[0]);
  const lo=ORDER.reduce((a,k)=>c[k]<c[a]?k:a,ORDER[0]);
  if(c[hi]-c[lo]>=3){
    const hip=PEOPLE[hi]?`${PEOPLE[hi]}’s ${LABELS[hi]} line`:`${LABELS[hi]}`;
    const lop=PEOPLE[lo]?`${PEOPLE[lo]}’s ${LABELS[lo]} line`:`${LABELS[lo]} — the line with no advocate`;
    return `${hip} received $${c[hi]}M while ${lop} received $${c[lo]}M. That spread is the opportunity cost the room’s arguments were competing to create.`;
  }
  return 'Your cumulative portfolio stayed relatively balanced. That kept several options alive, but it also meant no single argument from the room dominated the two-year spend.';
}

function buildClosingLesson(y1,y2,outcomes,thresholds){
  const c=cumulative(y1,y2), top=largestLine(c);
  const y3=outcomes&&outcomes.year3&&outcomes.year3.band;
  const heat=outcomes&&outcomes.year2&&outcomes.year2.heat&&outcomes.year2.heat.band;
  const competitor=outcomes&&outcomes.year2&&outcomes.year2.competitor&&outcomes.year2.competitor.band;
  const buyers=outcomes&&outcomes.buyers;
  const near=primaryNearMiss(c,y3,heat,competitor,thresholds);
  const trade=tradeSentence(c,thresholds);
  const yourRun=[
    [year3Sentence(c,y3), near?`Closest counterfactual: ${near}`:''].filter(Boolean).join(' '),
    [`Your largest cumulative commitment was ${top.label} at $${top.amount}M.`,trade].filter(Boolean).join(' '),
    [heatSentence(c,heat),competitorSentence(c,competitor)].filter(Boolean).join(' '),
    buyerSentence(buyers)
  ].filter(Boolean);
  return {
    title:'What this run was teaching you',
    paragraphs:[
      'You spent two years making choices before you knew which consequences would matter. That is the work of architecture. It is not predicting the future. It is deciding which capabilities Midland will already have when the future arrives.',
      'Every million you put into Run, Uptime, Capacity, Connect, or Features was also a million you did not put somewhere else. Dale was right that Run consumed money without producing something new. Renata was right that her trucks and technicians were stretched. Tom was right that the board needed something visible. Sam was right that the machines already knew more than Midland could hear. The hard part was seeing the whole company while each person was correctly defending only one part of it.',
      'Capacity had no advocate. Connect did. Features were visible. Run and Uptime had immediate operational arguments. Foundations get starved precisely because nobody is asking for them yet, while the visible and urgent work arrives with a person attached.',
      'The three buyers were the final reminder that value depends on who is looking. You did not control which future arrived or what an eventual buyer would care about. You controlled whether Midland had built enough real capability that more than one future could still work.'
    ],
    yourRun,
    carryOut:'You never controlled which future arrived. You controlled what Midland was ready for when it did.'
  };
}
module.exports={buildClosingLesson};
'''.lstrip("\\'"))

# ---------------- regression checks ----------------
c=CHECK.read_text()
c=rep(c,"assert.equal(inc1.lines.find(x => x.id === 'connect').description.includes('Sam'), true);","assert.equal(inc1.lines.find(x => x.id === 'connect').description, 'Gets data back from units in the field automatically.');",'check objective connect description')
CHECK.write_text(c)

inc2=INC2.read_text()
inc2=rep(inc2,"assert.ok(cfg.lines.find(x=>x.id==='uptime').description.includes('Renata'));\nassert.ok(cfg.lines.find(x=>x.id==='connect').description.includes('Sam'));\nassert.ok(cfg.lines.find(x=>x.id==='features').description.includes('Tom'));","assert.equal(cfg.lines.find(x=>x.id==='uptime').description,'Backup and redundancy so dispatch survives a bad day.');\nassert.equal(cfg.lines.find(x=>x.id==='connect').description,'Gets data back from units in the field automatically.');\nassert.equal(cfg.lines.find(x=>x.id==='features').description,'Visible new things the business can point at.');",'increment2 objective descriptions')
inc2=rep(inc2,"assert.ok(text.includes('more in Connect would have let Midland match the competitor outright'));\nassert.ok(/less in Uptime|more in Uptime/.test(text));","assert.ok(text.includes('Closest counterfactual:'));\nassert.equal((text.match(/Closest counterfactual:/g)||[]).length,1);",'increment2 single near miss')
INC2.write_text(inc2)

CLOSECHECK.write_text(r'''const assert = require('assert');
const S = require('../lib/scenario.js');
const { buildClosingLesson } = require('../lib/closingLesson.js');
const valid=x=>{const v=S.validateAllocation(x);assert.equal(v.ok,true,JSON.stringify(v));return v.allocation;};
const noRoomA=valid({run:3,uptime:3,capacity:0,connect:3,features:0});
const noRoomB=valid({run:3,uptime:0,capacity:0,connect:3,features:3});
const noRoomOutcomes=S.evaluateAll(noRoomA,noRoomB);
const noRoom=buildClosingLesson(noRoomA,noRoomB,noRoomOutcomes,S.DEFAULT_THRESHOLDS);
assert.equal(noRoom.title,'What this run was teaching you');
assert.ok(noRoom.yourRun.some(x=>x.includes('$6M in Connect')));
assert.ok(noRoom.yourRun.some(x=>x.includes('$0M in Capacity')));
assert.ok(noRoom.yourRun.some(x=>x.includes('Closest counterfactual:')));
assert.ok(noRoom.yourRun.some(x=>x.includes('Corven showed high interest')));
const strongA=valid({run:3,uptime:1,capacity:1,connect:3,features:1});
const strongB=valid({run:3,uptime:2,capacity:1,connect:2,features:1});
const strongOutcomes=S.evaluateAll(strongA,strongB);
const strong=buildClosingLesson(strongA,strongB,strongOutcomes,S.DEFAULT_THRESHOLDS);
assert.equal(strongOutcomes.year3.band,'strong');assert.ok(strong.yourRun.some(x=>x.includes('worked together')));assert.notDeepEqual(strong.yourRun,noRoom.yourRun);
const weakA=valid({run:4,uptime:2,capacity:1,connect:1,features:1});
const weakB=valid({run:4,uptime:2,capacity:1,connect:1,features:1});
const weakOutcomes=S.evaluateAll(weakA,weakB);
const weak=buildClosingLesson(weakA,weakB,weakOutcomes,S.DEFAULT_THRESHOLDS);
assert.equal(weakOutcomes.year3.band,'weak');assert.ok(weak.yourRun.some(x=>x.includes('not created enough usable field history')));
const overspendA=valid({run:3,uptime:3,capacity:3,connect:0,features:0});
const overspendB=valid({run:3,uptime:3,capacity:3,connect:0,features:0});
const overspend=buildClosingLesson(overspendA,overspendB,S.evaluateAll(overspendA,overspendB),S.DEFAULT_THRESHOLDS);
assert.ok(overspend.yourRun.some(x=>x.includes('Renata')&&x.includes('Sam')&&x.includes('$6M')&&x.includes('$0M')));
for(const lesson of [noRoom,strong,weak,overspend]){
  const all=[...lesson.paragraphs,...lesson.yourRun,lesson.carryOut].join(' ');
  assert.equal((all.match(/Closest counterfactual:/g)||[]).length,1);
  for(const forbidden of ['Score:','Grade:','Rank:'])assert.equal(all.includes(forbidden),false);
}
assert.deepEqual(buildClosingLesson(noRoomA,noRoomB,noRoomOutcomes,S.DEFAULT_THRESHOLDS),buildClosingLesson(noRoomA,noRoomB,noRoomOutcomes,S.DEFAULT_THRESHOLDS));
console.log('RapidSim 03 dynamic closing lesson checks passed.');
''')

INC3.write_text(r'''const assert=require('assert');
const fs=require('fs');
const path=require('path');
const S=require('../lib/scenario.js');
const {buildClosingLesson}=require('../lib/closingLesson.js');
const cfg=S.publicConfig();
const packet=JSON.stringify(cfg.briefing);
for(const forbidden of ['Tuesday','eighty minutes','semester','your team runs Midland']) assert.equal(packet.toLowerCase().includes(forbidden.toLowerCase()),false,forbidden);
for(const name of ['Dale Brenner','Renata Oyelaran','Tom Vasquez','Sam Achterberg']) assert.ok(packet.includes(name),name);
assert.ok(packet.includes('thirty minutes')&&packet.includes('two annual $9 million allocations')&&packet.includes('third year'));
assert.ok(packet.includes('Nineteen percent of our visits find nothing wrong')&&packet.includes('$290'));
assert.equal(cfg.meta.minutes,30);
assert.ok(cfg.position.includes('Run has a $3M minimum')&&cfg.position.includes('Features each have a $3M annual ceiling'));
assert.equal(cfg.reflectionPrompts[0],'Which of Dale, Renata, Tom, or Sam did you overrule most?');
assert.ok(cfg.reflectionFollowups[0].includes('After seeing Year 3'));
const y1={run:3,uptime:2,capacity:2,connect:0,features:2};
const y1o=S.evaluateYear1(y1);
assert.equal(y1o.band,'weak');assert.ok(y1o.allocationNotes.some(x=>x.includes('Connect was $0M')));assert.ok(y1o.allocationNotes.some(x=>x.includes('$6.1M Run bill')));
const heatA={run:3,uptime:3,capacity:0,connect:3,features:0},heatB={run:3,uptime:3,capacity:0,connect:3,features:0};
const heat=S.evaluateYear2(heatA,heatB).heat;assert.equal(heat.band,'strong');assert.ok(heat.allocationNotes.some(x=>x.includes('Cumulative Uptime was $6M')&&x.includes('$3M sat above that line')));
for(const band of ['strong','data_no_room','pilot','weak']){
  const copy={strong:S.evaluateYear3({run:3,uptime:1,capacity:1,connect:3,features:1},{run:3,uptime:2,capacity:1,connect:2,features:1}),data_no_room:S.evaluateYear3({run:3,uptime:3,capacity:0,connect:3,features:0},{run:3,uptime:0,capacity:0,connect:3,features:3}),pilot:S.evaluateYear3({run:3,uptime:2,capacity:1,connect:2,features:1},{run:3,uptime:1,capacity:1,connect:1,features:3}),weak:S.evaluateYear3({run:3,uptime:2,capacity:1,connect:1,features:2},{run:3,uptime:2,capacity:1,connect:1,features:2})}[band];
  assert.ok(copy.narrative.includes('Tom:')&&copy.narrative.includes('Sam:'),band);
}
const weakComp=S.evaluateYear2({run:3,uptime:0,capacity:3,connect:0,features:3},{run:3,uptime:1,capacity:3,connect:1,features:1}).competitor.narrative;
assert.equal(weakComp.includes('market question arrived after the architecture decision'),false);assert.equal(weakComp.includes('we decided this before we knew'),false);
const buyers=S.evaluateBuyers({run:3,uptime:2,capacity:1,connect:1,features:2},{run:3,uptime:2,capacity:1,connect:1,features:2});
assert.ok(buyers.carrolton.roomLink.includes('No one in the room'));assert.ok(S.evaluateBuyers({run:3,uptime:2,capacity:1,connect:2,features:1},{run:3,uptime:2,capacity:1,connect:2,features:1}).ridge_hollow.reason.includes('After closing'));
assert.equal(new Set(Object.values(['strong','middle','weak'].reduce((o,b)=>(o[b]=S.evaluateYear1(b==='strong'?{run:3,uptime:1,capacity:1,connect:2,features:2}:b==='middle'?{run:3,uptime:2,capacity:1,connect:1,features:2}:{run:3,uptime:2,capacity:2,connect:0,features:2}).year2Intro,o),{}))).size,3);
const html=fs.readFileSync(path.join(__dirname,'..','public','index.html'),'utf8');
for(const marker of ['Pre-session briefing','What happens in the simulation','No one in the room speaks for this line.','year2-history','No Year 3 allocation','reflection-followup','align-self:start','The decisions are over. Explain what you would defend or change.']) assert.ok(html.includes(marker),marker);
for(const forbidden of ['What happens Tuesday','briefing packet your instructor posted before class','The architecture underneath it is the one built over the previous two years.']) assert.equal(html.includes(forbidden),false,forbidden);
const y1fn=html.slice(html.indexOf('function renderYear1Outcome'),html.indexOf('function renderYear2Events'));
assert.ok(y1fn.indexOf('<div class="outcome">')<y1fn.indexOf("runningHTML(S.year1"));
const y2fn=html.slice(html.indexOf('function renderYear2Events'),html.indexOf('function renderYear3'));
assert.ok(y2fn.indexOf('<div class="events"')<y2fn.indexOf("runningHTML(cum"));
assert.equal(html.includes('<div class="constraint">${esc(l.description'),false);
assert.equal(html.includes('<div class="alloc-rule">'),false);
const lesson=buildClosingLesson({run:3,uptime:3,capacity:3,connect:0,features:0},{run:3,uptime:3,capacity:3,connect:0,features:0},S.evaluateAll({run:3,uptime:3,capacity:3,connect:0,features:0},{run:3,uptime:3,capacity:3,connect:0,features:0}),S.DEFAULT_THRESHOLDS);
assert.equal((lesson.yourRun.join(' ').match(/Closest counterfactual:/g)||[]).length,1);assert.ok(lesson.yourRun.some(x=>x.includes('Renata')&&x.includes('Sam')));
console.log('RapidSim 03 Increment 3 checks passed.');
''')

b=BUILD.read_text()
b=rep(b,"'briefing packet your instructor posted before class',","'briefing packet before starting',",'build generic brief marker')
b=rep(b,"for (const marker of ['Year 2 stops being quiet.','The CEO asks whether Midland can predict a failure before the truck rolls.','The decisions are over. What changed your mind?'])","for (const marker of ['Year 2 stops being quiet.','The CEO asks whether Midland can predict a failure before the truck rolls.','The decisions are over. Explain what you would defend or change.'])",'build close heading marker')
anchor="execFileSync(process.execPath, [path.join(__dirname, 'tools', 'increment2-check.js')], { stdio: 'inherit' });"
if anchor not in b: raise SystemExit('missing build increment2 runner')
b=b.replace(anchor,anchor+"\nexecFileSync(process.execPath, [path.join(__dirname, 'tools', 'increment3-check.js')], { stdio: 'inherit' });",1)
BUILD.write_text(b)

print('Increment 3 patch applied')
