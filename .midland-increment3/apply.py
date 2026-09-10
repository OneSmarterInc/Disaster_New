from pathlib import Path
import hashlib
ROOT=Path('sim03')
def read(p): return (ROOT/p).read_text(encoding='utf-8')
def write(p,s): (ROOT/p).write_text(s,encoding='utf-8')
def once(s,a,b):
 n=s.count(a)
 if n!=1: raise ValueError(f'Expected one match, got {n}: {a[:130]!r}')
 return s.replace(a,b,1)
def between(s,a,b,new):
 start=s.index(a);end=s.index(b,start)
 return s[:start]+new+s[end:]
for p,sha in [('lib/scenario.js','fb18a882fe3ffaefe504dbe7a52a8e88eceec614'),('lib/closingLesson.js','1929b35e0da22877d0afaba0454fe4ba718f2e1b'),('public/index.html','eed872033385eee7287848d3ff7776cdbb8c8636')]:
 data=(ROOT/p).read_bytes();actual=hashlib.sha1(b'blob '+str(len(data)).encode()+b'\0'+data).hexdigest()
 if actual!=sha: raise ValueError(f'Baseline changed: {p} ({actual})')
s=read('lib/scenario.js')
s=between(s,'      people: [','      peopleNote:',"      people: META.detail.cast.map(({ name, role, quote }) => ({ name, role, quote })),\n")
s=s.replace('briefing packet before class','briefing packet before the session')
s=once(s,'About thirty minutes to play. The debrief is designed for the rest of the class hour.','About thirty minutes to play, followed by a debrief led by the instructor.')
s=once(s,'and two reflection questions. Instructor comparisons','and three reflection questions. Instructor comparisons')
s=once(s,'Six million a year keeps the lights on and produces nothing new. Every conversation should start with getting that number down.','Keep the current systems running for sixty-two technicians, but bring the operating bill down.')
s=once(s,'Six million dollars a year keeps the lights on and produces nothing new. Every conversation we have should start with getting that number down.','Six million dollars a year keeps the current systems running. If dispatch stops, sixty-two technicians lose their directions. Get that bill down without stopping their work.')
for line,clause in [('Run','Bring the operating bill down without stopping the work.'),('Uptime','Keep the trucks moving; she still wants eight more technicians.'),('Features','Something real to show the board within eighteen months.'),('Connect','Hear the machine before sending a $290 truck roll.')]:
 s=once(s,f"        line: '{line}',",f"        line: '{line}',\n        shortWant: '{clause}',")
s=once(s,"capacity: 'Headroom for growth and for anything that needs to compute.'","capacity: 'Headroom for growth and for anything that needs to compute. No one in the room speaks for this line.'")
s=once(s,'Keeps the existing systems alive. Dale: six million a year keeps the lights on and he wants that number down.','Keeps the existing systems alive. Dale wants the bill down without leaving sixty-two technicians without dispatch.')
s=once(s,' The market question arrived after the architecture decision had already been made.','')
s=once(s,'That is my board window. Eighteen months to build the thing after customers ask for it means we decided this before we knew we were deciding it.','That is my whole board window. Customers want the offer now; I cannot take an eighteen-month build to the board and call it a service.')
for a,b in {
'Predictive uptime becomes something Midland can actually sell, not a demo. Sam:':'Predictive uptime becomes something Midland can actually sell, not a demo. Tom: “That is a service I can take to the board, with customers to show for it.” Sam:',
'The CEO asks why it cannot go to every customer by spring, and the honest answer is that the harder half was built while the cheap half was starved. Sam:':'Tom: “I can show the board a demo. I still cannot promise customers a service that runs every morning.” Sam:',
'It catches some failures early and proves the idea without yet changing what Midland can sell at scale. Sam:':'It catches some failures early and proves the idea without yet changing what Midland can sell at scale. Tom: “I have something real to show the board. I do not yet have the business I promised them.” Sam:',
'Technicians are still making 14,000 service visits a year and 19% still find nothing wrong because the machines cannot tell Midland what they know remotely. Sam:':'Technicians are still making 14,000 service visits a year and 19% still find nothing wrong because the machines cannot tell Midland what they know remotely. Tom: “The board is still waiting for the service I said we could build. I have no field history to show them.” Sam:'}.items(): s=once(s,a,b)
s=once(s,"    description: 'Regional competitor',\n    copy:","    description: 'Regional competitor',\n    roomLink: 'Nobody in the room argued for this future: Carrolton wants the customer contracts, not the systems those four people were defending.',\n    copy:")
s=once(s,'Plans to hold four years and sell, and nothing in your portfolio gets in the way of that.','After the sale it plans to cut costs further, hold for four years, and sell again; its enthusiasm is for that plan, not an endorsement of the service you built.')
s=once(s,'reason: BUYERS.carrolton.copy','reason: BUYERS.carrolton.copy,\n      roomLink: BUYERS.carrolton.roomLink')
s=once(s,'advocate: cast ? { name: cast.name, want: cast.stake } : null','advocate: cast ? { name: cast.name, want: cast.quote, shortWant: cast.shortWant } : null')
s=once(s,'Reference copy of the pre-class packet. It is collapsed by default so the simulation does not reteach the briefing.','Read this packet before you start. You can reopen it throughout the simulation.')
s=once(s,'Read this before Tuesday. It is the only preparation for the class.','Read this before the session. Allow about six minutes for the packet.')
s=once(s,'You are about to take over technology decisions at Midland Equipment. On Tuesday your team will spend three years of the company’s money in eighty minutes. Nobody will re-explain this packet in class, and the teams that read it carefully will run the room. It should take you about six minutes.','You are about to take over technology decisions at Midland Equipment. The simulation takes about thirty minutes. Play individually or as part of a team, as your instructor has arranged: make two annual allocations, then see what happens in Year 3 without another allocation.')
s=once(s,'Your team runs Midland’s technology for three years. Each year you get $9 million, you spend all of it across five lines, and then you find out what happened that year.','You manage Midland’s technology individually or in a team. Allocate $9 million in Year 1 and another $9 million in Year 2, spending each budget across five lines. Year 3 reveals the result; there is no third allocation.')
s=once(s,"      'Selling equipment brings in most of the revenue. Servicing it brings in most of the profit.',\n      'The main office system is fourteen years old. Every unit installed since 2016 records its own run hours, temperatures, and faults. Nobody has ever looked at that data, because the only way to see it is to drive out and plug in a laptop.',","      'The main office system is fourteen years old. Every unit installed since 2016 records its own run hours, temperatures, and faults. Nobody has ever looked at that data, because the only way to see it is to drive out and plug in a laptop.',\n      'Selling equipment brings in most of the revenue. Servicing it brings in most of the profit.',")
s=once(s,'You have $9 million to allocate this year across five lines. You cannot borrow from next year, and the annual caps are real.','Allocate all $9 million this year. Run needs at least $3 million and can take the remaining budget. Uptime, Capacity, Connect, and Features each have a $3 million annual ceiling. You cannot borrow from next year.')
s=once(s,'    viewPrompt:',"    viewIntro: 'Dale wants a lower operating bill, Renata wants trucks moving, Tom wants something the board can see, and Sam wants to hear the machines. Back one of their positions, combine them, or argue for a fifth. What should Midland become?',\n    viewPrompt:")
s=once(s,'Dale, Renata, Tom, or Sam: whose argument did you overrule most, and would you make the same call after seeing Year 3?','Dale, Renata, Tom, or Sam: whose argument did you overrule most?')
s=once(s,'    reflectionDisclosure:',"    reflectionFollowUp: 'After seeing Year 3, would you make the same call? Explain why.',\n    reflectionDisclosure:")
s=s.replace('class debrief','session debrief')
helpers=r'''function year1NearMiss(connect, t) {
  const strong = t.year1ConnectStrong;
  const start = `Your Year 1 Connect allocation was $${connect}M.`;
  if (connect >= strong) {
    const spare = connect - strong;
    return start + (spare > 0
      ? ` The complete report needed $${strong}M; the other $${spare}M did not change this report.`
      : ' That was enough to deliver the complete report.');
  }
  const next = connect === 0 && strong > 1 ? 1 : strong;
  return `${start} Moving $${next - connect}M from another line into Connect would have ${next < strong ? 'brought back some data, although the report would still have been patchy' : 'supported the complete report'}.`;
}

function heatNearMiss(uptime, t) {
  const start = `Your cumulative Uptime allocation was $${uptime}M.`;
  const strong = t.heatUptimeStrong;
  if (uptime >= strong) {
    const spare = uptime - strong;
    return start + (spare > 0
      ? ` Dispatch needed $${strong}M to hold in this heat wave; the other $${spare}M did not change this event.`
      : ' That was exactly what dispatch needed to hold in this heat wave.');
  }
  const next = uptime < t.heatUptimeMiddle ? t.heatUptimeMiddle : strong;
  return `${start} Moving $${next - uptime}M from another line into Uptime across the two allocations would have ${next < strong ? 'limited the outage to six hours rather than four days' : 'kept dispatch up rather than sending it back to paper'}.`;
}

'''
s=once(s,'function evaluateYear1(y1, thresholds) {',helpers+'function evaluateYear1(y1, thresholds) {')
for band in ['strong','middle','weak']: s=once(s,f'year2Intro: YEAR2_INTRO.{band} }}',f'year2Intro: YEAR2_INTRO.{band}, nearMiss: year1NearMiss(c, t) }}')
s=once(s,"heat: { title: 'The heat wave', ...heat },","heat: { title: 'The heat wave', ...heat, nearMiss: heatNearMiss(c.uptime, t) },")
write('lib/scenario.js',s)
s=read('public/index.html')
s=once(s,'let C=null;','let C=null;\nlet year2SplitOpen=false;')
s=once(s,'<main class="page">${teamBanner()}${content}</main>','<main class="page ${S.step===0?\'brief-page\':\'\'} ${[4,6].includes(S.step)?\'allocation-page\':\'\'}">${teamBanner()}${content}</main>')
s=once(s,'  wireBriefingPacketModal();\n}',"  wireBriefingPacketModal();\n  const split=document.querySelector('.year2-split');if(split)split.ontoggle=()=>{year2SplitOpen=split.open};\n}")
s=once(s,'${esc(p.role)}.</b>','${esc(p.name)} · ${esc(p.role)}.</b>')
s=s.replace('What happens Tuesday','What happens in the session').replace('Pre-class briefing · about 6 minutes','Briefing packet · about 6 minutes').replace('Reference copy · read before starting the simulation','Read before starting the simulation')
s=once(s,'i===1?`<div class="brief-profit">','i===2?`<div class="brief-profit">')
s=once(s,'This sim assumes you have read the briefing packet your instructor posted before class.','Read the briefing packet before you start.')
s=once(s,'If you have not read it yet, read the full packet here before starting.','It introduces Midland and the four people you will meet.')
s=once(s,'<p class="lede">Write one sentence before you see the first allocation outcome.</p>','<p class="lede">${esc(C.viewIntro)}</p>')
s=once(s,'Reference copy of the pre-class briefing.','Reference copy of the briefing packet.')
s=between(s,'function lineAdvocate(line){','function year2BreakdownHTML(',r'''function lineAdvocate(line,year=1){
  const a=line?.advocate;
  if(!a)return '<div class="advocate-reminder capacity-silence"><span>No one in the room speaks for this line.</span></div>';
  const want=year===2?(a.shortWant||a.want):a.want;
  return `<div class="advocate-reminder"><b>${esc(a.name)} · ${esc(line.label)}</b><span>${year===1?'“':''}${esc(want)}${year===1?'”':''}</span></div>`;
}
''')
s=once(s,'return `<div class="eyebrow" style="margin-top:24px">Year 1 + Year 2 split</div><div class="year2-breakdown">','return `<details class="year2-split" ${year2SplitOpen?\'open\':\'\'}><summary>Year 1 + Year 2 split</summary><div class="year2-breakdown">')
s=once(s,'</div>${rows}</div>`;','</div>${rows}</div></details>`;')
s=once(s,'readOnlyAllocationHTML(committed,`Team Year ${year} allocation`)','readOnlyAllocationHTML(committed,`Team Year ${year} allocation`,year)')
s=once(s,'function readOnlyAllocationHTML(a,label){','function readOnlyAllocationHTML(a,label,year=1){')
old='<div class="constraint">${esc(l.description||\'\')}</div>${lineAdvocate(l)}<div class="alloc-rule">${esc(allocationRule(l))}</div>'
if s.count(old)!=2: raise ValueError('Expected two allocator copies')
s=s.replace(old,'${lineAdvocate(l,year)}')
s=once(s,'function allocRow(l,a,key){','function allocRow(l,a,year){')
s=once(s,'  <aside class="budget"><div class="n">${left}</div><div class="lab">$M remaining</div><div class="total">Allocated: <b>$${used}M</b> of $9M<br>Submit unlocks only at exactly $9M.</div></aside></div>\n  ${nav({backOk:year===1,nextLabel:left===0?`Commit Year ${year}`:\'Allocate all $9M\',disabled:blocked()||left!==0})}',r'''  </div>
  <div class="allocation-dock"><div class="budget-live" role="status" aria-live="polite" aria-atomic="true"><strong>$${left}M remaining</strong><span>$${used}M of $9M allocated</span></div>
  ${nav({backOk:year===1,nextLabel:left===0?`Commit Year ${year}`:'Allocate all $9M',disabled:blocked()||left!==0})}</div>''')
s=once(s,"  ${runningHTML(S.year1,'Year 1 portfolio')}\n",'')
s=once(s,"${o?`<div class=\"outcome\"><h3>${esc(o.title)}</h3><p>${esc(o.narrative)}</p></div>`:notice('Outcome not loaded. Return to Year 1 and recommit.',true)}","${o?`<div class=\"outcome\"><h3>${esc(o.title)}</h3><p>${esc(o.narrative)}</p>${outcomeNearMiss(o)}</div>`:notice('Outcome not loaded. Return to Year 1 and recommit.',true)}\n  ${runningHTML(S.year1,'Year 1 portfolio')}")
s=once(s,"const first=o?`<div class=\"outcome\"><h3>${esc(o.heat.title)}</h3><p>${esc(o.heat.narrative)}</p></div>`:'';","const first=o?`<div class=\"outcome\"><h3>${esc(o.heat.title)}</h3><p>${esc(o.heat.narrative)}</p>${outcomeNearMiss(o.heat)}</div>`:'';")
s=once(s,"</p>${cum?runningHTML(cum,'Cumulative portfolio'):''}",'</p>')
s=once(s,"${o?`<div class=\"events\" style=\"grid-template-columns:1fr\">${first}${S.year2Event>=1?second:''}</div>`:notice('Outcome not loaded. Return to Year 2 and recommit.',true)}","${o?`<div class=\"events\" style=\"grid-template-columns:1fr\">${first}${S.year2Event>=1?second:''}</div>`:notice('Outcome not loaded. Return to Year 2 and recommit.',true)}\n  ${cum?runningHTML(cum,'Cumulative portfolio'):''}")
s=once(s,'function renderYear1Outcome(){',"function outcomeNearMiss(o){return o?.nearMiss?`<p class=\"outcome-near-miss\">${esc(o.nearMiss)}</p>`:''}\nfunction renderYear1Outcome(){")
s=once(s,'The request is now on the table. The architecture underneath it is the one built over the previous two years.','There is no allocation in Year 3. Read what happened, then continue to the buyers.')
s=once(s,'The decisions are over. What changed your mind?','The decisions are over. Look back at your choices.')
s=once(s,'function renderClose(){',r'''const REFLECTION_DIVIDER='\n\nAfter Year 3 — would I make the same call?\n';
function splitFirstReflection(value){
  const text=String(value||''),i=text.indexOf(REFLECTION_DIVIDER);
  return i<0?{argument:text,reconsideration:''}:{argument:text.slice(0,i),reconsideration:text.slice(i+REFLECTION_DIVIDER.length)};
}
function firstReflectionHTML(){
  const answers=splitFirstReflection(S.reflection1);
  return `<div class="card"><h3>${esc(C.reflectionPrompts[0])}</h3><p style="white-space:pre-wrap">${esc(answers.argument||'—')}</p></div>${answers.reconsideration?`<div class="card" style="margin-top:12px"><h3>${esc(C.reflectionFollowUp)}</h3><p style="white-space:pre-wrap">${esc(answers.reconsideration)}</p></div>`:''}`;
}
function renderClose(){''')
s=once(s,'<div class="card"><h3>${esc(C.reflectionPrompts[0])}</h3><p style="white-space:pre-wrap">${esc(S.reflection1||\'—\')}</p></div>','${firstReflectionHTML()}')
s=once(s,'  shell(`<div class="eyebrow">Close</div>',"  const firstAnswers=splitFirstReflection(S.reflection1);\n  shell(`<div class=\"eyebrow\">Close</div>")
s=once(s,'<div class="field"><label>${esc(C.reflectionPrompts[0])}</label><textarea id="r1" maxlength="1500">${esc(S.reflection1)}</textarea><div class="hint reflection-note">Your instructor can see this response and may read it aloud in the debrief. It is not scored.</div></div>',r'''<div class="field"><label for="r1">${esc(C.reflectionPrompts[0])}</label><textarea id="r1" maxlength="500" required>${esc(firstAnswers.argument)}</textarea></div>
  <div class="field"><label for="r1FollowUp">${esc(C.reflectionFollowUp)}</label><textarea id="r1FollowUp" maxlength="900" required>${esc(firstAnswers.reconsideration)}</textarea><div class="hint reflection-note">Your instructor can see these responses and may read them aloud in the debrief. They are not scored.</div></div>''')
s=once(s,"  S.reflection1=document.getElementById('r1').value.trim();S.reflection2=document.getElementById('r2').value.trim();",r'''  const argument=document.getElementById('r1'),reconsideration=document.getElementById('r1FollowUp');
  if(!argument.value.trim()){argument.setCustomValidity('Name the argument you overruled.');argument.reportValidity();argument.oninput=()=>argument.setCustomValidity('');return}
  if(!reconsideration.value.trim()){reconsideration.setCustomValidity('Explain whether you would make the same call after Year 3.');reconsideration.reportValidity();reconsideration.oninput=()=>reconsideration.setCustomValidity('');return}
  S.reflection1=argument.value.trim()+REFLECTION_DIVIDER+reconsideration.value.trim();S.reflection2=document.getElementById('r2').value.trim();''')
css=r'''
/* Increment 3: keep decisions and the budget visible without truncating copy. */
.brief-page{padding-top:22px;padding-bottom:24px;width:min(1040px,calc(100% - 36px))}
.brief-page h2{font-size:32px;margin-bottom:12px}.brief-page .copy{max-width:none;font-size:16px;line-height:1.45}
.brief-page .copy>p{margin-bottom:10px}.brief-page .brief-profit{margin:12px 0;padding:10px 14px}.brief-page .brief-profit p{font-size:19px;line-height:1.35}
.brief-page>.lede{font-size:16px;line-height:1.45}.brief-page .briefing-prep{margin:14px 0;padding:12px 14px}.brief-page .actions{margin-top:14px}
.allocation-page{width:min(1120px,calc(100% - 36px));padding-top:18px;padding-bottom:20px}
.allocation-page h2{font-size:30px;margin-bottom:8px}.allocation-page>.lede{font-size:15px;line-height:1.4;max-width:none}
.allocation-page .briefing{margin:10px 0}.allocation-page .briefing>summary{padding:9px 12px}
.allocation-page .alloc-wrap{display:block;margin-top:10px}.allocation-page .allocs{gap:6px}
.allocation-page .alloc{padding:9px 12px;gap:12px}.allocation-page .alloc h3{font-size:19px}
.allocation-page .advocate-reminder{margin-top:5px;padding:5px 9px;font-size:14px;line-height:1.35}
.allocation-page .advocate-reminder b{display:inline;margin-right:8px;font-size:9px}
.capacity-silence{color:var(--dim)}
.allocation-dock{position:sticky;bottom:0;z-index:9;display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:10px;padding:12px 14px;border:1px solid #8A6427;background:var(--night);box-shadow:0 -8px 18px rgba(14,21,36,.25)}
.allocation-dock .actions{margin:0}.budget-live{display:flex;flex-direction:column;gap:3px}.budget-live strong{font:600 19px var(--mono);color:var(--amber)}.budget-live span{font:10px var(--mono);color:var(--dim)}
.year2-split{margin:10px 0;border:1px solid var(--line2);background:var(--panel)}.year2-split>summary{padding:8px 12px;cursor:pointer;font:11px var(--mono);color:var(--amber)}.year2-split .year2-breakdown{margin:0;border:0}
.outcome .outcome-near-miss{margin-top:14px;padding-top:12px;border-top:1px solid var(--line2);font-size:15px;color:var(--dim)}
@media(max-width:600px){.allocation-page .alloc{grid-template-columns:1fr}.allocation-page .stepper{justify-content:flex-end}.allocation-dock{flex-wrap:wrap;padding:10px}.allocation-dock .actions{flex:1;justify-content:flex-end}.budget-live strong{font-size:16px}.allocation-dock .btn{padding:10px;letter-spacing:.04em}.brief-page h2{font-size:29px}}
@media print{.allocation-dock{position:static;box-shadow:none}}
'''
s=once(s,'</style>',css+'</style>');write('public/index.html',s)
s=read('lib/closingLesson.js')
s=between(s,'function largestLine(c) {','function year3Sentence(','')
s=between(s,'function heatNearMiss(c, band, t) {','function year3NearMiss(','')
s=once(s,"return `${dollars(needConnect)} more in Connect would have moved Midland out of the pilot; with Capacity at ${dollars(c.capacity)}, that next outcome would have been ${destination}.`;","return `Reallocating ${dollars(needConnect)} more to Connect across the two years would have reached ${destination}${c.capacity < capStrong ? ', not yet a service at scale' : ''}.`;")
insert=r'''// Reallocate only Uptime spending above what this heat wave required.
// Validate the annual budgets/caps and re-evaluate the existing engine before
// describing an opportunity cost. This never writes a different allocation.
function uptimeTrade(y1, y2, outcomes, thresholds) {
  const engine=require('./scenario.js'),t=engine.sanitizeThresholds(thresholds);
  const c=cumulative(y1,y2),spare=c.uptime-t.heatUptimeStrong;
  if(spare<=0 || outcomes?.year2?.heat?.band!=='strong')return null;
  const band=outcomes?.year3?.band;
  const target=band==='data_no_room'?'capacity':band!=='strong'?'connect':'features';
  const need=target==='capacity'?t.year3CapacityStrong-c.capacity:target==='connect'?(band==='weak'?t.year3ConnectPilotMin:t.year3ConnectStrong)-c.connect:6-c.features;
  let left=Math.min(spare,Math.max(0,need)),moved=0;
  const a={...y1},b={...y2};
  for(const row of [a,b]){const n=Math.max(0,Math.min(left,row.uptime,3-row[target]));row.uptime-=n;row[target]+=n;left-=n;moved+=n;}
  if(!moved || !engine.validateAllocation(a).ok || !engine.validateAllocation(b).ok)return null;
  const next=engine.evaluateAll(a,b,t);
  if(next.year2.heat.band!==outcomes.year2.heat.band)return null;
  const person=target==='connect'?'Sam’s field connections':target==='capacity'?'the Capacity line with no advocate':'the visible Features Tom wanted';
  const consequence=next.year3.band!==band?({strong:' and made predictive service possible at scale',pilot:' and reached a Year 3 pilot',data_no_room:' and gathered the field history, although Capacity would still have been short'}[next.year3.band]||''):'';
  const multiple=c.uptime===2*t.heatUptimeStrong && t.heatUptimeStrong>0?' — twice what this heat wave needed':'';
  const text=`Renata’s Uptime received $${c.uptime}M${multiple}, while ${target==='connect'?'Sam’s Connect':target==='capacity'?'Capacity':'Tom’s Features'} received $${c[target]}M. Moving $${moved}M of that extra protection to ${person}, within the annual caps, would have kept dispatch up${consequence}. That was the opportunity the extra protection displaced.`;
  return {text,amount:moved,source:'uptime',target,year1:a,year2:b};
}

'''
s=once(s,'function buildClosingLesson(y1, y2, outcomes, thresholds) {',insert+'function buildClosingLesson(y1, y2, outcomes, thresholds) {')
s=once(s,'  const top = largestLine(c);',"  const t = require('./scenario.js').sanitizeThresholds(thresholds);")
s=between(s,'  const yourRun = [','\n  return {',r'''  const tradeoff=uptimeTrade(y1,y2,outcomes,t);
  const main=year3Sentence(c,y3);
  const comparison=y3==='strong' && heat!=='strong'
    ? `Reallocating ${dollars(Math.max(0,t.heatUptimeStrong-c.uptime))} more to Uptime across the two years would have kept dispatch up in the heat wave.`
    : year3NearMiss(c,y3,t);
  const yourRun = [
    tradeoff ? tradeoff.text : [main,comparison].filter(Boolean).join(' '),
    tradeoff ? main : '',
    buyerSentence(buyers)
  ].filter(Boolean);
''')
s=once(s,'    yourRun,','    yourRun,\n    tradeoff,');write('lib/closingLesson.js',s)
s=read('build.js')
s=once(s,'briefing packet your instructor posted before class','Read the briefing packet before you start.')
s=once(s,'The decisions are over. What changed your mind?','The decisions are over. Look back at your choices.')
s=once(s,"console.log('RapidSim 03 build guards passed.');","execFileSync(process.execPath, [path.join(__dirname, 'tools', 'increment3-check.js')], { stdio: 'inherit' });\n\nconsole.log('RapidSim 03 build guards passed.');")
write('build.js',s)
s=read('tools/increment2-check.js').replace('class debrief','session debrief')
s=once(s,"assert.ok(text.includes('more in Connect would have let Midland match the competitor outright'));\nassert.ok(/less in Uptime|more in Uptime/.test(text));","assert.ok(lesson.yourRun.length <= 3, 'Increment 3 selects a focused comparison');\nassert.ok(/Reallocating|more in Connect|Moving/.test(lesson.yourRun[0]), 'a concrete counterfactual remains');")
write('tools/increment2-check.js',s)
print('Applied Increment 3 to student copy/layout, server-side explanation and copy guards.')
