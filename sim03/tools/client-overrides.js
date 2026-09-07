// Client functions applied by build.js to the prebuilt student bundle.
// These are defined here so the build can replace whole functions without
// fragile string surgery. They are never executed in Node; build.js uses
// Function#toString() and inserts them into public/index.html.

function renderYear1Outcome(){
  const o=S.year1Outcome;
  shell(`<div class="eyebrow">Year 1 outcome</div><h2>The first consequence arrives.</h2>
  ${runningHTML(S.year1,'Year 1 portfolio')}
  ${o?`<div class="outcome"><h3>${esc(o.title)}</h3><p>${esc(o.narrative)}</p></div>`:notice('Outcome not loaded. Return to Year 1 and recommit.',true)}
  ${nav({backOk:false})}`);wireNav(next,false);
}

function renderYear2Events(){
  const o=S.year2Outcome;
  const cum=S.year1&&S.year2?runningTotals(S.year1,S.year2):null;
  const first=o?`<div class="outcome"><h3>${esc(o.heat.title)}</h3><p>${esc(o.heat.narrative)}</p></div>`:'';
  const second=o?`<div class="outcome"><h3>${esc(o.competitor.title)}</h3><p>${esc(o.competitor.narrative)}</p></div>`:'';
  shell(`<div class="eyebrow">Year 2 outcomes</div><h2>Two events resolve in sequence.</h2>${cum?runningHTML(cum,'Cumulative portfolio'):''}
  ${o?`<div class="events" style="grid-template-columns:1fr">${first}${S.year2Event>=1?second:''}</div>`:notice('Outcome not loaded. Return to Year 2 and recommit.',true)}
  ${S.year2Event<1
    ? nav({backOk:false,nextLabel:'Continue to the second event'})
    : nav({backOk:false,nextLabel:'Go to Year 3'})}`);
  if(S.year2Event<1){wireNav(()=>{S.year2Event=1;render()},false);return}
  wireNav(async()=>{
    try{const d=await request('/api/outcome',{stage:'all',year1:S.year1,year2:S.year2,sessionCode:S.sessionCode,participantId:S.participantId});S.allOutcomes=d.outcome;next()}catch(e){alert(e.message)}
  },false);
}

function renderYear3(){
  const o=S.allOutcomes?.year3;
  const cum=o?.cumulative||(S.year1&&S.year2?runningTotals(S.year1,S.year2):null);
  shell(`<div class="eyebrow">Year 3 · no allocation</div><h2>You do not get another move.</h2>
  <p class="lede">The CEO wants AI failure prediction. The architecture you funded is now the architecture you have.</p>
  ${cum?runningHTML(cum,'Cumulative portfolio'):''}
  ${o?`<div class="outcome"><h3>${esc(o.title)}</h3><p>${esc(o.narrative)}</p></div>`:notice('Year 3 outcome is unavailable.',true)}
  ${o?.band==='unresolved_calibration'?notice('This is a known authored-calibration gap, not a random failure. The instructor view flags the run.') : ''}
  ${nav({backOk:false,nextLabel:'See the three buyers'})}`);wireNav(next,false);
}

function renderBuyers(){
  const cum=S.allOutcomes?.year3?.cumulative||runningTotals(S.year1,S.year2);
  shell(`<div class="eyebrow">The three buyers</div><h2>The portfolio does not change. The valuation does.</h2>
  ${runningHTML(cum,'Same cumulative portfolio')}
  <div class="buyers"><div class="buyer"><h3>Buyer 1</h3><div class="value">Valuation pending authored rule</div><p>The build specification calls for three buyer valuations but does not define this buyer's rule or copy.</p></div>
  <div class="buyer"><h3>Buyer 2</h3><div class="value">Valuation pending authored rule</div><p>No value is invented in the application. This content must be authored before publication.</p></div>
  <div class="buyer"><h3>Buyer 3</h3><div class="value">Valuation pending authored rule</div><p>The instructor can still debrief the portfolio; this screen remains visibly incomplete until the valuation rules are supplied.</p></div></div>
  ${notice('No winner is declared. The missing valuation content is deliberately not fabricated.')}
  ${nav({backOk:false})}`);wireNav(next,false);
}

function renderClose(){
  if(S.finished){
    shell(`<div class="eyebrow">Your summary</div><h2>What you chose, and what you would change.</h2>
    <div class="summary"><div class="card"><h3>Your opening view</h3><p>${esc(S.strategicView||'—')}</p></div>
    <div class="card"><h3>Your Year 1 allocation</h3>${S.year1?miniAlloc(S.year1):'<p>—</p>'}</div></div>
    <div class="card" style="margin-top:12px"><h3>${esc(C.reflectionPrompts[0])}</h3><p style="white-space:pre-wrap">${esc(S.reflection1||'—')}</p></div>
    <div class="card" style="margin-top:12px"><h3>${esc(C.reflectionPrompts[1])}</h3><p style="white-space:pre-wrap">${esc(S.reflection2||'—')}</p></div>
    ${notice('Run complete. This summary is ready to screenshot or print to PDF.')}
    <div class="actions"><button class="btn pri" id="printBtn">Print / save PDF</button></div>`);
    document.getElementById('printBtn').onclick=()=>window.print();
    return;
  }
  shell(`<div class="eyebrow">Close</div><h2>Return to what you believed before the consequences.</h2>
  <div class="summary"><div class="card"><h3>Your opening view</h3><p>${esc(S.strategicView||'—')}</p></div>
  <div class="card"><h3>Your Year 1 allocation</h3>${S.year1?miniAlloc(S.year1):'<p>—</p>'}</div></div>
  <div class="field"><label>${esc(C.reflectionPrompts[0])}</label><textarea id="r1" maxlength="1500">${esc(S.reflection1)}</textarea></div>
  <div class="field"><label>${esc(C.reflectionPrompts[1])}</label><textarea id="r2" maxlength="1500">${esc(S.reflection2)}</textarea></div>
  <div class="actions"><button class="btn pri" id="finishBtn">Complete run</button></div>`);
  document.getElementById('finishBtn').onclick=finish;
}

module.exports={renderYear1Outcome,renderYear2Events,renderYear3,renderBuyers,renderClose};
