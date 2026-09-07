from pathlib import Path

STUDENT=Path('platform/public/student.html')
SIM=Path('sim03/public/index.html')
FINISH=Path('sim03/api/finish.js')
CONFIG=Path('sim03/api/config.js')

s=STUDENT.read_text()

s=s.replace('.swrap{max-width:800px;margin:0 auto;padding:30px 22px 80px}', '.swrap{max-width:1180px;margin:0 auto;padding:38px 28px 80px}')

css_anchor='  .student-course{margin-bottom:30px}\n'
css_extra=r'''  .student-page-kicker{font:10px var(--mono);letter-spacing:.15em;text-transform:uppercase;color:var(--ink3);margin-bottom:4px}
  .student-page-title{font-size:38px;font-weight:300;letter-spacing:-.025em;line-height:1.1;margin:0 0 8px}
  .student-page-lede{font-size:16.5px;color:var(--ink2);margin:0 0 26px}
  .student-section-head{display:flex;justify-content:space-between;align-items:flex-end;gap:14px;margin:0 0 12px}
  .student-section-head h2{font-size:24px;font-weight:400;letter-spacing:-.015em;margin:0}
  .student-section-head span{font:9.5px var(--mono);letter-spacing:.11em;text-transform:uppercase;color:var(--ink3)}
  .student-course{border:1px solid var(--line);background:var(--card);margin-bottom:18px}
  .student-course-head{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:20px;align-items:start;padding:18px 20px;border-bottom:1px solid var(--line);background:var(--sunk)}
  .student-course-label{font:9px var(--mono);letter-spacing:.14em;text-transform:uppercase;color:var(--ink3)}
  .student-course-title{font-size:24px;font-weight:500;letter-spacing:-.015em;margin:2px 0 3px}
  .student-course-meta{font-size:13px;color:var(--ink3)}
  .student-course-status{text-align:right}.student-course-status .progress-text{font:10px var(--mono);color:var(--ink3);margin-top:8px}
  .student-course-body{padding:18px 20px}
  .student-sim-row{display:grid;grid-template-columns:64px minmax(0,1fr) 190px;gap:18px;align-items:center;padding:15px 0;border-bottom:1px solid var(--line)}
  .student-sim-row:last-child{border-bottom:none}.student-sim-no{font:12px var(--mono);color:var(--ink3)}
  .student-sim-title{font-size:18px;font-weight:500;margin-bottom:3px}.student-sim-tag{font-size:13.5px;color:var(--ink2);line-height:1.45}
  .student-sim-side{text-align:right}.student-sim-side .btn{margin-top:6px}
  .student-result-preview{margin-top:13px;border-left:2px solid #E8C88E;background:#FBF3E7;padding:11px 13px}
  .student-result-preview .mini{margin-bottom:5px}.student-result-preview p{font-size:13.5px;color:var(--ink2);line-height:1.45;margin:0}
  .student-result-page{max-width:980px;margin:0 auto}.student-result-hero{border:1px solid #E8C88E;background:#FBF3E7;padding:20px 22px;margin:18px 0 24px}
  .student-result-hero .mini{color:var(--amber);margin-bottom:6px}.student-result-hero p{font-size:20px;line-height:1.5;margin:0}
  .student-result-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.student-result-card{border:1px solid var(--line);background:var(--card);padding:16px 18px}
  .student-result-card h3{font:10px var(--mono);letter-spacing:.13em;text-transform:uppercase;color:var(--ink3);margin:0 0 8px}.student-result-card p{margin:0;line-height:1.55;color:var(--ink2)}
  .student-result-timeline{display:grid;gap:10px}.student-result-event{border:1px solid var(--line);background:var(--card);padding:15px 17px}.student-result-event b{display:block;font-size:17px;margin-bottom:4px}.student-result-event p{margin:0;color:var(--ink2);line-height:1.5}
  .student-result-metrics{display:grid;grid-template-columns:1fr 1fr;gap:8px 16px}.student-result-metric{border-bottom:1px solid var(--line);padding:7px 0}.student-result-metric span{display:block;font:9px var(--mono);letter-spacing:.09em;text-transform:uppercase;color:var(--ink3);margin-bottom:3px}.student-result-metric b{font-weight:500}
'''
if css_extra.strip() not in s:
    s=s.replace(css_anchor, css_anchor+css_extra, 1)

s=s.replace('    .student-tools{align-items:stretch}.student-filter{width:100%}.student-filter button{flex:1}\n', '    .student-tools{align-items:stretch}.student-filter{width:100%}.student-filter button{flex:1}\n    .student-course-head,.student-sim-row,.student-result-grid{grid-template-columns:1fr}.student-course-status,.student-sim-side{text-align:left}\n', 1)

s=s.replace("const SV = { q:'', filter:'All', page:1 };", "const SV = { q:'', filter:'All', page:1, result:null };\nlet CURRENT = null;")

helper_anchor='function wireStudentView() {\n'
helpers=r'''function summaryObject(x){
  if(!x||!x.summary)return {};
  if(typeof x.summary==='object')return x.summary;
  try{return JSON.parse(x.summary)||{}}catch{return {}}
}
function friendlyLabel(k){
  const known={year3Band:'Year 3 outcome',openingView:'Opening view',reflection1:'Reflection 1',reflection2:'Reflection 2',year1Connect:'Year 1 Connect',year1Allocation:'Year 1 allocation',cumulativeConnect:'Cumulative Connect',cumulativeUptime:'Cumulative Uptime',cumulativeCapacity:'Cumulative Capacity'};
  return known[k]||String(k).replace(/([a-z])([A-Z])/g,'$1 $2').replace(/_/g,' ').replace(/^./,c=>c.toUpperCase());
}
function bandCopy(b){return ({strong:'The architecture reached the strongest authored outcome for this stage.',pilot:'The architecture supports a credible pilot, but not yet a full capability.',middle:'The result landed in the middle path: workable, but with visible constraints.',weak:'The architecture left an important capability gap exposed.'})[b]||''}
function renderStudentResult(){
  if(!CURRENT||!SV.result)return;
  const {courseId,simId}=SV.result;
  const c=CURRENT.courses.find(x=>x.id===courseId), x=CURRENT.sims.find(y=>y.id===simId&&y.course_id===courseId);
  if(!c||!x){SV.result=null;LAST='';draw();return}
  const m=x.metrics||{}, sum=summaryObject(x), publicResult=sum.result||{};
  const y1=sum.year1||null, y2=sum.year2||null, cum=publicResult.cumulative||null;
  const overall=publicResult.overall||bandCopy(sum.year3Band||m.year3Band)||'This run is complete. The simulation recorded your choices and outcome.';
  const events=[];
  if(publicResult.year1)events.push(['Year 1',publicResult.year1]);
  if(publicResult.year2&&publicResult.year2.heat)events.push(['Year 2 · Heat wave',publicResult.year2.heat]);
  if(publicResult.year2&&publicResult.year2.competitor)events.push(['Year 2 · Competitor',publicResult.year2.competitor]);
  if(publicResult.year3)events.push(['Year 3',publicResult.year3]);
  const alloc=(a)=>a?`Run ${a.run} · Uptime ${a.uptime} · Capacity ${a.capacity} · Connect ${a.connect} · Features ${a.features}`:'—';
  const hiddenKeys=new Set(['openingView','reflection1','reflection2','year1Allocation','year3Band']);
  const otherMetrics=Object.entries(m).filter(([k])=>!hiddenKeys.has(k));
  app.innerHTML=`<div class="student-result-page">
    <div class="crumb"><a href="#" id="resultBack">← My courses</a></div>
    <div class="student-page-kicker">Completed simulation</div>
    <div style="display:flex;justify-content:space-between;gap:18px;align-items:flex-start;flex-wrap:wrap">
      <div><h1 class="student-page-title" style="font-size:34px">${esc(x.title)}</h1><div class="student-course-meta">${esc(c.title)} · ${esc(c.faculty_name||'')}</div></div>
      ${dot('ok','finished')}
    </div>
    <div class="strip" style="border-top:1px solid var(--line);margin-top:20px">
      <div class="cell"><div class="n">${Number(x.played)||1}</div><div class="l">Run starts</div></div>
      <div class="cell"><div class="n">${x.completed_at?when(x.completed_at):'—'}</div><div class="l">Latest completion</div></div>
      <div class="cell"><div class="n">${mins(x.duration_seconds)||'—'}</div><div class="l">Time taken</div></div>
    </div>
    <div class="student-result-hero"><div class="mini">Your result</div><p>${esc(overall)}</p></div>
    ${events.length?`<div class="section"><span>What happened</span></div><div class="student-result-timeline">${events.map(([label,o])=>`<div class="student-result-event"><div class="mini">${esc(label)}</div><b>${esc(o.title||friendlyLabel(o.band||''))}</b><p>${esc(o.narrative||bandCopy(o.band))}</p></div>`).join('')}</div>`:''}
    ${(y1||y2||cum)?`<div class="section"><span>The portfolio that produced this</span></div><div class="student-result-grid">
      <div class="student-result-card"><h3>Year 1 allocation</h3><p>${esc(alloc(y1))}</p></div>
      <div class="student-result-card"><h3>Year 2 allocation</h3><p>${esc(alloc(y2))}</p></div>
      ${cum?`<div class="student-result-card" style="grid-column:1/-1"><h3>Cumulative portfolio</h3><p>${esc(alloc(cum))}</p></div>`:''}
    </div>`:''}
    ${(sum.strategicView||m.openingView)?`<div class="section"><span>Your opening view</span></div><div class="student-result-card"><p>${esc(sum.strategicView||m.openingView)}</p></div>`:''}
    ${(sum.reflection1||sum.reflection2||m.reflection1||m.reflection2)?`<div class="section"><span>Your reflections</span></div><div class="student-result-grid"><div class="student-result-card"><h3>Reflection 1</h3><p>${esc(sum.reflection1||m.reflection1||'—')}</p></div><div class="student-result-card"><h3>Reflection 2</h3><p>${esc(sum.reflection2||m.reflection2||'—')}</p></div></div>`:''}
    ${otherMetrics.length&&!events.length?`<div class="section"><span>Recorded result details</span></div><div class="student-result-card"><div class="student-result-metrics">${otherMetrics.map(([k,v])=>`<div class="student-result-metric"><span>${esc(friendlyLabel(k))}</span><b>${esc(typeof v==='object'?JSON.stringify(v):v)}</b></div>`).join('')}</div></div>`:''}
    <div class="actions" style="margin-top:24px"><button class="btn" id="resultHome">Back to my courses</button><a class="btn pri" href="/api/launch?sim=${encodeURIComponent(x.id)}&course=${encodeURIComponent(c.id)}">Play again</a></div>
  </div>`;
  const back=()=>{SV.result=null;LAST='';draw()};
  document.getElementById('resultBack').onclick=e=>{e.preventDefault();back()};
  document.getElementById('resultHome').onclick=back;
}
function openStudentResult(courseId,simId){SV.result={courseId,simId};renderStudentResult()}
'''
if helpers not in s:
    s=s.replace(helper_anchor, helpers+helper_anchor, 1)

s=s.replace("  const { courses, sims } = d;\n  const finishedCount", "  CURRENT=d;\n  if(SV.result){renderStudentResult();return;}\n  const { courses, sims } = d;\n  const finishedCount", 1)

old="""  app.innerHTML = courses.length ? `
    <div class=\"student-summary\">
      <div class=\"cell\"><div class=\"n\">${courses.length}</div><div class=\"l\">Courses</div></div>
      <div class=\"cell\"><div class=\"n\">${sims.length}</div><div class=\"l\">Simulations</div></div>
      <div class=\"cell\"><div class=\"n\">${finishedCount}</div><div class=\"l\">Finished</div></div>
      <div class=\"cell\"><div class=\"n\">${inProgressCount}</div><div class=\"l\">In progress</div></div>
    </div>
"""
new="""  app.innerHTML = courses.length ? `
    <div class=\"student-page-kicker\">Student dashboard</div>
    <h1 class=\"student-page-title\">My courses and simulations</h1>
    <p class=\"student-page-lede\">Your courses are shown first. Each course contains the RapidSims assigned by your facilitator, along with your progress and latest result.</p>
    <div class=\"student-summary\">
      <div class=\"cell\"><div class=\"n\">${courses.length}</div><div class=\"l\">Enrolled courses</div></div>
      <div class=\"cell\"><div class=\"n\">${sims.length}</div><div class=\"l\">Assigned simulations</div></div>
      <div class=\"cell\"><div class=\"n\">${finishedCount}</div><div class=\"l\">Completed</div></div>
      <div class=\"cell\"><div class=\"n\">${inProgressCount}</div><div class=\"l\">Need attention</div></div>
    </div>
"""
if old not in s: raise SystemExit('student summary anchor missing')
s=s.replace(old,new,1)

s=s.replace('    <div id="studentCourseList">\n', '    <div class="student-section-head"><h2>My courses</h2><span>${courses.length} course${courses.length===1?\'\':\'s\'}</span></div>\n    <div id="studentCourseList">\n',1)

old=r'''      <div class="student-course">
        <div class="crumb" style="margin:0 0 4px">${esc(c.term || '')}</div>
        <div style="display:flex;justify-content:space-between;align-items:baseline;gap:14px;flex-wrap:wrap">
          <h1 style="font-size:26px;font-weight:400;letter-spacing:-.02em">${esc(c.title)}</h1>
          ${c.paid ? dot('ok','you can start') : dot('warn','waiting on your instructor')}
        </div>
        <div class="sub" style="font-size:12px;margin-top:5px">${esc(c.faculty_name)}</div>

        ${!c.paid ? `<div class="note" style="margin-top:14px">
          You are enrolled. ${esc(c.faculty_name)} opens this up once your registration is settled. Nothing for you
          to do — this page will change on its own.
        </div>` : ''}

        <div style="margin-top:16px">
'''
new=r'''      <div class="student-course">
        <div class="student-course-head">
          <div><div class="student-course-label">${esc(c.term || 'Course')}</div><div class="student-course-title">${esc(c.title)}</div><div class="student-course-meta">Facilitator: ${esc(c.faculty_name)}</div></div>
          <div class="student-course-status">${c.paid ? dot('ok','access open') : dot('warn','waiting on instructor')}<div class="progress-text">${mine.filter(x=>x.completed_at).length} of ${mine.length} simulation${mine.length===1?'':'s'} completed</div></div>
        </div>
        ${!c.paid ? `<div class="note" style="margin:14px 20px 0">You are enrolled. ${esc(c.faculty_name)} opens this up once your registration is settled. Nothing for you to do — this page will change on its own.</div>` : ''}
        <div class="student-course-body">
'''
if old not in s: raise SystemExit('course header anchor missing')
s=s.replace(old,new,1)

old=r'''          return `<div class="simcard" data-student-card data-status="${esc(status)}" data-search="${esc(searchText)}">
            <div class="body">
              <div class="no">${x.number ? 'RapidSim ' + String(x.number).padStart(2,'0') : 'Simulation'}</div>
              <h3>${esc(x.title)}</h3>
              <div class="tag">${esc(x.description || x.tagline || '')}</div>
              <div class="facts" style="margin-top:14px">
                ${x.minutes ? `<span>about <b>${x.minutes} minutes</b></span>` : ''}
                <span>played <b>on your own</b></span>
                <span><b>not marked</b></span>
              </div>
            </div>

            ${done ? `<div class="result">
              <div class="mini">Your run${x.completed_at ? ' · ' + when(x.completed_at) : ''}${mins(x.duration_seconds) ? ' · took ' + mins(x.duration_seconds) : ''}</div>
              ${Object.keys(m).length ? Object.entries(m).map(([k,v]) =>
                `<div class="row2"><span>${esc(k)}</span><span>${esc(v)}</span></div>`).join('')
                : '<div class="row2"><span>Finished</span><span>—</span></div>'}
            </div>` : ''}

            <div class="foot2">
              <div>${done ? dot('ok','finished')
                : Number(x.played) > 0 ? dot('warn','started, not finished')
                : c.paid ? dot('off','not started yet') : dot('off','not open yet')}</div>
              ${c.paid
                ? `<a class="btn pri" href="/api/launch?sim=${encodeURIComponent(x.id)}&course=${encodeURIComponent(c.id)}">${done ? 'Play it again' : Number(x.played) > 0 ? 'Carry on' : 'Start'}</a>`
                : `<button class="btn" disabled>Not open yet</button>`}
            </div>
          </div>`;
'''
new=r'''          const so=summaryObject(x), result=so.result||{};
          const resultText=result.overall||bandCopy(so.year3Band||m.year3Band)||'Your completed run is recorded.';
          return `<div class="student-sim-row" data-student-card data-status="${esc(status)}" data-search="${esc(searchText)}">
            <div class="student-sim-no">${x.number ? String(x.number).padStart(2,'0') : '··'}</div>
            <div><div class="student-sim-title">${esc(x.title)}</div><div class="student-sim-tag">${esc(x.description || x.tagline || '')}</div>
              <div class="facts" style="margin-top:8px">${x.minutes ? `<span>about <b>${x.minutes} min</b></span>` : ''}<span><b>not marked</b></span></div>
              ${done?`<div class="student-result-preview"><div class="mini">Latest result · ${when(x.completed_at)}</div><p>${esc(resultText)}</p></div>`:''}
            </div>
            <div class="student-sim-side"><div>${done ? dot('ok','finished') : Number(x.played)>0 ? dot('warn','in progress') : c.paid ? dot('off','not started') : dot('off','not open')}</div>
              ${done?`<button class="btn" data-view-result="${esc(c.id)}:${esc(x.id)}">View result</button>`:''}
              ${c.paid?`<a class="btn pri" href="/api/launch?sim=${encodeURIComponent(x.id)}&course=${encodeURIComponent(c.id)}">${done?'Play again':Number(x.played)>0?'Carry on':'Start'}</a>`:`<button class="btn" disabled>Not open yet</button>`}
            </div>
          </div>`;
'''
if old not in s: raise SystemExit('sim card anchor missing')
s=s.replace(old,new,1)

s=s.replace('  if (courses.length) wireStudentView();\n', "  if (courses.length) { wireStudentView(); app.querySelectorAll('[data-view-result]').forEach(b=>b.onclick=()=>{const [courseId,simId]=b.dataset.viewResult.split(':');openStudentResult(courseId,simId)}); }\n",1)

STUDENT.write_text(s)

f=FINISH.read_text()
helper=r'''
function overallOutcomeText(outcomes) {
  const y1 = outcomes && outcomes.year1 && outcomes.year1.band;
  const heat = outcomes && outcomes.year2 && outcomes.year2.heat && outcomes.year2.heat.band;
  const competitor = outcomes && outcomes.year2 && outcomes.year2.competitor && outcomes.year2.competitor.band;
  const y3 = outcomes && outcomes.year3 && outcomes.year3.band;
  const a = { strong:'Customer reporting became a real capability early.', middle:'Customer reporting became possible, but slowly and with manual work.', weak:'The first customer request exposed a reporting gap.' }[y1] || '';
  const b = { strong:'Operational resilience held when the heat wave tested the company.', middle:'The heat wave strained operations but did not fully break them.', weak:'The heat wave exposed a serious resilience weakness.' }[heat] || '';
  const c = { strong:'Midland could answer the competitor from a position of strength.', middle:'Midland could only mount a limited pilot response to the competitor.', weak:'Midland could not respond quickly to the competitor’s new service model.' }[competitor] || '';
  const d = { strong:'By Year 3, the architecture supported predictive service as something Midland could actually sell.', pilot:'By Year 3, predictive service was promising, but still only a pilot.', weak:'By Year 3, the architecture still lacked the usable data foundation for predictive service.' }[y3] || '';
  return [a,b,c,d].filter(Boolean).join(' ');
}
function publicOutcome(o) { return o ? { title:o.title, narrative:o.narrative, band:o.band } : null; }
'''
if 'function overallOutcomeText(outcomes)' not in f:
    f=f.replace('function allocationLabel(a) {', helper+'\nfunction allocationLabel(a) {',1)
anchor='''  // These are intentionally decision/debrief summaries rather than hidden\n  // thresholds.'''
insert='''  summary.result = {\n    overall: overallOutcomeText(outcomes),\n    year1: publicOutcome(outcomes.year1),\n    year2: { heat: publicOutcome(outcomes.year2 && outcomes.year2.heat), competitor: publicOutcome(outcomes.year2 && outcomes.year2.competitor) },\n    year3: publicOutcome(outcomes.year3),\n    cumulative: outcomes.year3 && outcomes.year3.cumulative ? outcomes.year3.cumulative : null\n  };\n\n'''
if insert.strip() not in f:
    if anchor not in f: raise SystemExit('finish summary anchor missing')
    f=f.replace(anchor,insert+anchor,1)
FINISH.write_text(f)

c=CONFIG.read_text()
c=c.replace('return res.status(200).json(S.publicConfig());', "return res.status(200).json({ ...S.publicConfig(), platformUrl: process.env.PLATFORM_URL || 'https://rapidsims.flexee.org' });")
CONFIG.write_text(c)

i=SIM.read_text()
old='''    <div class=\"actions\"><button class=\"btn pri\" id=\"printBtn\">Print / save PDF</button></div>`);\n    document.getElementById('printBtn').onclick=()=>window.print();\n'''
new='''    <div class=\"actions\"><button class=\"btn pri\" id=\"printBtn\">Print / save PDF</button><a class=\"btn\" id=\"studentHomeBtn\" href=\"${esc((C.platformUrl||'https://rapidsims.flexee.org').replace(/\\/$/,'')+'/student.html')}\">Back to student home</a></div>`);\n    document.getElementById('printBtn').onclick=()=>window.print();\n'''
if old not in i: raise SystemExit('sim03 print anchor missing')
i=i.replace(old,new,1)
SIM.write_text(i)

print('student/result/sim03 polish applied')
