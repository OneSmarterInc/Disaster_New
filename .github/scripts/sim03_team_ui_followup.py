from pathlib import Path
import re

p=Path('sim03/public/index.html')
s=p.read_text()
# Do not offer a second session join control after someone is already attached.
s=s.replace("""  ${sessionGate()}<div class=\"actions\"><button class=\"btn\" id=\"joinSessionEntry\">Join a facilitated session</button></div>${nav({backOk:false,disabled:blocked()})}`);
  document.getElementById('joinSessionEntry').onclick=()=>{S.error='';renderJoin()};
""", """  ${sessionGate()}${!S.session?'<div class=\"actions\"><button class=\"btn\" id=\"joinSessionEntry\">Join a facilitated session</button></div>':''}${nav({backOk:false,disabled:blocked()})}`);
  const joinEntry=document.getElementById('joinSessionEntry');if(joinEntry)joinEntry.onclick=()=>{S.error='';renderJoin()};
""",1)

pat=re.compile(r"function renderAllocation\(year\)\{.*?\n\}\nfunction allocRow",re.S)
new="""function renderAllocation(year){
  const key=year===1?'year1':'year2';
  const teamReadOnly=!S.canSubmit&&S.session?.mode==='team';
  if(teamReadOnly){
    const committed=S.teamRun?.[key]||null;
    if(committed)S[key]=committed;
    const captain=S.mates.find(m=>m.isCaptain)?.name||'your captain';
    const running=year===2&&S.year1&&committed?runningTotals(S.year1,committed):null;
    shell(`<div class=\"eyebrow\">Year ${year} allocation</div><h2>${year===1?'Nine million. Five lines.':'You get one more allocation.'}</h2>
    <p class=\"lede\">${year===1?'The physical constraint is the point: taking a million for one line means it does not exist somewhere else.':'Your Year 1 choices stay with you. The second allocation is shared by your team.'}</p>
    ${committed?runningHTML(committed,`Team Year ${year} allocation`):notice(`Waiting for ${captain} to commit Year ${year}.`)}
    ${running?runningHTML(running,'Cumulative team portfolio'):''}
    <div class=\"locked\">Team allocation is read-only for non-captains. ${committed?`Committed by ${esc(captain)}.`:`${esc(captain)} is choosing the shared allocation.`}</div>
    ${nav({backOk:year===1,nextLabel:committed?'Continue':'Waiting for captain',disabled:blocked()||!committed})}`);
    wireNav(async()=>{
      if(!committed)return;
      try{
        if(year===1){const d=await request('/api/outcome',{stage:'year1',year1:S.year1,sessionCode:S.sessionCode,participantId:S.participantId});S.year1Outcome=d.outcome}
        else {const d=await request('/api/outcome',{stage:'year2',year1:S.year1,year2:S.year2,sessionCode:S.sessionCode,participantId:S.participantId});S.year2Outcome=d.outcome}
        next();
      }catch(e){alert(e.message)}
    });
    return;
  }
  if(!S[key])S[key]=defaultAlloc();
  const a=S[key],used=Object.values(a).reduce((x,y)=>x+y,0),left=9-used;
  const running=year===2&&S.year1?runningTotals(S.year1,a):null;
  shell(`<div class=\"eyebrow\">Year ${year} allocation</div><h2>${year===1?'Nine million. Five lines.':'You get one more allocation.'}</h2>
  <p class=\"lede\">${year===1?'The physical constraint is the point: taking a million for one line means it does not exist somewhere else.':'Your Year 1 choices stay with you. Allocate the second $9M with the running totals visible.'}</p>
  ${running?runningHTML(running,'Running totals, including this draft'):''}
  <div class=\"alloc-wrap\"><div class=\"allocs\">${C.lines.map(l=>allocRow(l,a,year)).join('')}</div>
  <aside class=\"budget\"><div class=\"n\">${left}</div><div class=\"lab\">$M remaining</div><div class=\"total\">Allocated: <b>$${used}M</b> of $9M<br>Submit unlocks only at exactly $9M.</div></aside></div>
  ${nav({backOk:year===1,nextLabel:left===0?`Commit Year ${year}`:'Allocate all $9M',disabled:blocked()||left!==0})}`);
  document.querySelectorAll('.step').forEach(b=>b.onclick=()=>changeAlloc(key,b.dataset.line,Number(b.dataset.delta)));
  wireNav(async()=>{
    const v=validateClient(S[key]);if(v)return alert(v);
    try{
      await saveRun({[key]:S[key]});
      if(year===1){const d=await request('/api/outcome',{stage:'year1',year1:S.year1,sessionCode:S.sessionCode,participantId:S.participantId});S.year1Outcome=d.outcome}
      else {const d=await request('/api/outcome',{stage:'year2',year1:S.year1,year2:S.year2,sessionCode:S.sessionCode,participantId:S.participantId});S.year2Outcome=d.outcome}
      next();
    }catch(e){alert(e.message)}
  });
}
function allocRow"""
if not pat.search(s):raise SystemExit('renderAllocation block missing')
s=pat.sub(new,s,count=1)
p.write_text(s)

p=Path('sim03/public/instructor.html')
s=p.read_text().replace("Faculty groups participants; one captain commits.","Students name teams; one captain commits the shared decisions.")
p.write_text(s)

p=Path('sim03/build.js')
s=p.read_text()
old="""  'Join a facilitated session', 'Team name <span', 'function safeToRerender()',
"""
new="""  'Join a facilitated session', 'Team name <span', 'function safeToRerender()', 'Team allocation is read-only for non-captains',
"""
if old in s:s=s.replace(old,new,1)
p.write_text(s)
