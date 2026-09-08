from pathlib import Path

SCENARIO = Path('sim03/lib/scenario.js')
CHECK = Path('sim03/tools/check.js')
INDEX = Path('sim03/public/index.html')
INSTRUCTOR = Path('sim03/public/instructor.html')
FINISH = Path('sim03/api/finish.js')
BUILD = Path('sim03/build.js')
README = Path('sim03/README.md')


def replace_once(text, old, new, label):
    if old not in text:
        raise SystemExit(f'missing anchor: {label}')
    return text.replace(old, new, 1)

# ---------- scenario engine ----------
s = SCENARIO.read_text()

s = replace_once(s,
"""  year3: {
    strong: 'It works. Three years of fault history, somewhere to run it. Uptime becomes a product you sell.',
    pilot: 'Pilot on the newest units. Promising, not a business.',
    weak: 'Nothing to predict from. The model is fine. There is no data.'
  }
});
""",
"""  year3: {
    strong: 'It works. Three years of fault history, somewhere to run it. Uptime becomes a product you sell.',
    data_no_room: 'You have three years of fault history and nowhere to put it. The model runs overnight on borrowed capacity and finishes some mornings. The CEO sees a demo that works and asks why it cannot go to every customer by spring. The honest answer is that you built the harder half and skipped the cheap half.',
    pilot: 'Pilot on the newest units. Promising, not a business.',
    weak: 'Nothing to predict from. The model is fine. There is no data.'
  }
});

const BUYERS = Object.freeze({
  carrolton: {
    id: 'carrolton',
    name: 'Carrolton Systems',
    description: 'Regional competitor',
    copy: 'Buys the customers and the contracts. Everything you built is overhead they intend to retire in the first year. Your portfolio did not change this number, which is worth sitting with.'
  },
  ridge_hollow: {
    id: 'ridge_hollow',
    name: 'Ridge Hollow Partners',
    description: 'Private equity',
    high: 'Likes what it sees: a lean operation with no expensive habits. Plans to hold four years and sell, and nothing in your portfolio gets in the way of that.',
    qualified: 'Interested, with reservations about how much of the spending it would have to keep funding.',
    low: 'Sees a cost base it would have to cut hard, and it has done this often enough to know how that goes.'
  },
  corven: {
    id: 'corven',
    name: 'Corven Building Systems',
    description: 'Platform acquirer',
    high: 'This is the only reason it is at the table. Three years of fault history from four thousand units in buildings it does not yet serve. It is not buying an HVAC dealer, it is buying what those machines have been saying.',
    qualified: 'Sees the beginning of something and would want to finish it themselves, which changes the price and who runs the company afterward.',
    low: 'Cannot see what it would be buying. Says so politely.'
  }
});
const BUYER_CLOSING = 'Three buyers, one company, three different answers. Which one showed up was never yours to control. What you controlled was whether there was anything worth paying for.';
""", 'year3 copy and buyers')

old_y3 = """  if (c.connect >= t.year3ConnectStrong && c.capacity >= t.year3CapacityStrong) {
    return { band: 'strong', title: 'The CEO wants AI failure prediction', narrative: COPY.year3.strong, cumulative: c };
  }
  if (c.connect >= t.year3ConnectPilotMin && c.connect <= t.year3ConnectPilotMax) {
    return { band: 'pilot', title: 'The CEO wants AI failure prediction', narrative: COPY.year3.pilot, cumulative: c };
  }
  if (c.connect < t.year3ConnectPilotMin) {
    return { band: 'weak', title: 'The CEO wants AI failure prediction', narrative: COPY.year3.weak, cumulative: c };
  }

  // The authored build spec has no row for Connect >= strong with Capacity below
  // the strong capacity requirement. Students must never see development
  // scaffolding, so use the nearest authored non-success narrative while
  // retaining a separate calibrationGap flag for the instructor console.
  return {
    band: 'pilot',
    calibrationGap: true,
    internalBand: 'unresolved_calibration',
    title: 'The CEO wants AI failure prediction',
    narrative: COPY.year3.pilot,
    cumulative: c
  };
}

function evaluateAll(y1, y2, thresholds) {
  return {
    year1: evaluateYear1(y1, thresholds),
    year2: evaluateYear2(y1, y2, thresholds),
    year3: evaluateYear3(y1, y2, thresholds)
  };
}
"""
new_y3 = """  if (c.connect >= t.year3ConnectStrong && c.capacity >= t.year3CapacityStrong) {
    return { band: 'strong', title: 'The CEO wants AI failure prediction', narrative: COPY.year3.strong, cumulative: c };
  }
  if (c.connect >= t.year3ConnectStrong && c.capacity < t.year3CapacityStrong) {
    return { band: 'data_no_room', title: 'The CEO wants AI failure prediction', narrative: COPY.year3.data_no_room, cumulative: c };
  }
  if (c.connect >= t.year3ConnectPilotMin && c.connect <= t.year3ConnectPilotMax) {
    return { band: 'pilot', title: 'The CEO wants AI failure prediction', narrative: COPY.year3.pilot, cumulative: c };
  }
  return { band: 'weak', title: 'The CEO wants AI failure prediction', narrative: COPY.year3.weak, cumulative: c };
}

function evaluateBuyers(y1, y2) {
  const c = cumulative(y1, y2);
  const ridgeSpend = c.run + c.features;
  const ridgeInterest = ridgeSpend <= 8 ? 'high' : ridgeSpend >= 12 ? 'low' : 'qualified';
  const corvenInterest = c.connect >= 5 ? 'high' : c.connect >= 3 ? 'qualified' : 'low';
  return {
    carrolton: {
      id: BUYERS.carrolton.id,
      name: BUYERS.carrolton.name,
      description: BUYERS.carrolton.description,
      interest: 'qualified',
      reason: BUYERS.carrolton.copy
    },
    ridge_hollow: {
      id: BUYERS.ridge_hollow.id,
      name: BUYERS.ridge_hollow.name,
      description: BUYERS.ridge_hollow.description,
      interest: ridgeInterest,
      reason: BUYERS.ridge_hollow[ridgeInterest]
    },
    corven: {
      id: BUYERS.corven.id,
      name: BUYERS.corven.name,
      description: BUYERS.corven.description,
      interest: corvenInterest,
      reason: BUYERS.corven[corvenInterest]
    },
    closing: BUYER_CLOSING
  };
}

function evaluateAll(y1, y2, thresholds) {
  return {
    year1: evaluateYear1(y1, thresholds),
    year2: evaluateYear2(y1, y2, thresholds),
    year3: evaluateYear3(y1, y2, thresholds),
    buyers: evaluateBuyers(y1, y2)
  };
}
"""
s = replace_once(s, old_y3, new_y3, 'year3 evaluator and buyers')

s = replace_once(s,
"""    buyers: {
      authored: false,
      note:
        'The build specification requires three buyer valuations but does not yet define their valuation rules or copy.'
    }
""",
"""    buyers: {
      authored: true,
      title: 'Three buyers, one company',
      note: 'Each buyer gives a verdict and an interest level. There is no total, ranking or winner.',
      closing: BUYER_CLOSING
    }
""", 'public buyer authored flag')

s = replace_once(s,
"""  META, LINES, LABELS, DEFAULT_THRESHOLDS, sanitizeThresholds, validateThresholds,
  validateAllocation, cumulative, evaluateYear1, evaluateYear2, evaluateYear3,
  evaluateAll, publicConfig
};
""",
"""  META, LINES, LABELS, DEFAULT_THRESHOLDS, sanitizeThresholds, validateThresholds,
  validateAllocation, cumulative, evaluateYear1, evaluateYear2, evaluateYear3,
  evaluateBuyers, evaluateAll, publicConfig
};
""", 'scenario exports')
SCENARIO.write_text(s)

# ---------- unit checks ----------
c = CHECK.read_text()
c = replace_once(c,
"""const gapA = valid({ run: 3, uptime: 1, capacity: 0, connect: 3, features: 2 });
const gapB = valid({ run: 3, uptime: 1, capacity: 1, connect: 2, features: 2 });
const gap3 = S.evaluateYear3(gapA, gapB);
assert.equal(gap3.band, 'pilot');
assert.equal(gap3.calibrationGap, true);
""",
"""const dataNoRoomA = valid({ run: 3, uptime: 3, capacity: 0, connect: 3, features: 0 });
const dataNoRoomB = valid({ run: 3, uptime: 0, capacity: 0, connect: 3, features: 3 });
const dataNoRoom3 = S.evaluateYear3(dataNoRoomA, dataNoRoomB);
assert.equal(dataNoRoom3.band, 'data_no_room');
assert.equal(dataNoRoom3.calibrationGap, undefined);
assert.equal(dataNoRoom3.internalBand, undefined);
assert.ok(dataNoRoom3.narrative.includes('three years of fault history and nowhere to put it'));

const buyerCarrolton = S.evaluateBuyers(dataNoRoomA, dataNoRoomB);
assert.equal(buyerCarrolton.carrolton.interest, 'qualified');
assert.equal(buyerCarrolton.corven.interest, 'high');
assert.equal(buyerCarrolton.ridge_hollow.interest, 'qualified');

const ridgeHighA = valid({ run: 3, uptime: 2, capacity: 1, connect: 2, features: 1 });
const ridgeHighB = valid({ run: 3, uptime: 2, capacity: 1, connect: 2, features: 1 });
assert.equal(S.evaluateBuyers(ridgeHighA, ridgeHighB).ridge_hollow.interest, 'high');

const ridgeLowA = valid({ run: 6, uptime: 0, capacity: 0, connect: 0, features: 3 });
const ridgeLowB = valid({ run: 6, uptime: 0, capacity: 0, connect: 0, features: 3 });
const ridgeLow = S.evaluateBuyers(ridgeLowA, ridgeLowB);
assert.equal(ridgeLow.ridge_hollow.interest, 'low');
assert.equal(ridgeLow.corven.interest, 'low');

const corvenQualifiedA = valid({ run: 3, uptime: 2, capacity: 1, connect: 2, features: 1 });
const corvenQualifiedB = valid({ run: 3, uptime: 2, capacity: 1, connect: 1, features: 2 });
assert.equal(S.evaluateBuyers(corvenQualifiedA, corvenQualifiedB).corven.interest, 'qualified');
""", 'replace calibration gap test')
CHECK.write_text(c)

# ---------- student sim UI ----------
h = INDEX.read_text()
h = replace_once(h,
""".buyers{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:21px}.buyer{border:1px solid var(--line);background:var(--panel);padding:18px}.buyer h3{font-size:21px;font-weight:400}.buyer .value{font:10px var(--mono);letter-spacing:.13em;text-transform:uppercase;color:var(--dimmer);margin-top:12px}.buyer p{font-size:14px;color:var(--dim);margin-top:7px}
""",
""".buyers{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:21px}.buyer{border:1px solid var(--line);background:var(--panel);padding:18px}.buyer h3{font-size:21px;font-weight:400}.buyer .value{font:10px var(--mono);letter-spacing:.13em;text-transform:uppercase;color:var(--dimmer);margin-top:12px}.buyer p{font-size:14px;color:var(--dim);margin-top:7px}.buyer-interest{display:inline-flex;margin:10px 0 3px;padding:4px 7px;border:1px solid var(--line2);font:600 9px var(--mono);letter-spacing:.12em;text-transform:uppercase}.buyer-interest.high{color:var(--green);border-color:#476b58}.buyer-interest.qualified{color:var(--amber);border-color:#8A6427}.buyer-interest.low{color:var(--red);border-color:#7d4553}.buyer-close{border-left:2px solid var(--amber);padding:12px 14px;margin-top:18px;background:rgba(240,166,60,.05);font-size:18px;color:#D0CDC5}
""", 'buyer ui styles')

h = replace_once(h,
"""function renderBuyers(){S.step=9;return renderClose()}
""",
"""function renderBuyers(){
  const b=S.allOutcomes?.buyers;
  if(!b){S.step=9;return renderClose()}
  const ordered=[b.carrolton,b.ridge_hollow,b.corven].filter(Boolean);
  shell(`<div class=\"eyebrow\">Three buyers</div><h2>Same company. Three different answers.</h2>
  <p class=\"lede\">There is no valuation total, ranking or winner. Each buyer sees a different thing in the company you built.</p>
  <div class=\"buyers\">${ordered.map(x=>`<div class=\"buyer\"><div class=\"eyebrow\">${esc(x.description)}</div><h3>${esc(x.name)}</h3><div class=\"buyer-interest ${esc(x.interest)}\">${esc(x.interest)}</div><p>${esc(x.reason)}</p></div>`).join('')}</div>
  <div class=\"buyer-close\">${esc(b.closing||C.buyers?.closing||'')}</div>
  ${nav({backOk:false,nextLabel:'Continue to close'})}`);wireNav(next,false);
}
""", 'student buyers screen')

h = replace_once(h,
"""    weak:'By Year 3, the architecture still lacked the usable data foundation for predictive service.'
  }[y3]||'';
""",
"""    data_no_room:'You have three years of fault history and nowhere to put it.',
    weak:'By Year 3, the architecture still lacked the usable data foundation for predictive service.'
  }[y3]||'';
""", 'overall data_no_room text')

h = replace_once(h,
"""    <div class=\"result-section\"><div class=\"eyebrow\">Your original view</div>
""",
"""    ${S.allOutcomes?.buyers?`<div class=\"result-section\"><div class=\"eyebrow\">The three buyers</div><div class=\"buyers\">${[S.allOutcomes.buyers.carrolton,S.allOutcomes.buyers.ridge_hollow,S.allOutcomes.buyers.corven].filter(Boolean).map(x=>`<div class=\"buyer\"><h3>${esc(x.name)}</h3><div class=\"buyer-interest ${esc(x.interest)}\">${esc(x.interest)}</div><p>${esc(x.reason)}</p></div>`).join('')}</div><div class=\"buyer-close\">${esc(S.allOutcomes.buyers.closing||'')}</div></div>`:''}
    <div class=\"result-section\"><div class=\"eyebrow\">Your original view</div>
""", 'buyers in final result')
INDEX.write_text(h)

# ---------- completion summary ----------
f = FINISH.read_text()
f = replace_once(f,
"""  const d = { strong:'By Year 3, the architecture supported predictive service as something Midland could actually sell.', pilot:'By Year 3, predictive service was promising, but still only a pilot.', weak:'By Year 3, the architecture still lacked the usable data foundation for predictive service.' }[y3] || '';
""",
"""  const d = { strong:'By Year 3, the architecture supported predictive service as something Midland could actually sell.', data_no_room:'You have three years of fault history and nowhere to put it.', pilot:'By Year 3, predictive service was promising, but still only a pilot.', weak:'By Year 3, the architecture still lacked the usable data foundation for predictive service.' }[y3] || '';
""", 'finish overall data_no_room')
f = replace_once(f,
"""    year3: publicOutcome(outcomes.year3),
    cumulative: outcomes.year3 && outcomes.year3.cumulative ? outcomes.year3.cumulative : null
  };
""",
"""    year3: publicOutcome(outcomes.year3),
    cumulative: outcomes.year3 && outcomes.year3.cumulative ? outcomes.year3.cumulative : null,
    buyers: outcomes.buyers || null
  };
""", 'finish public buyers')
FINISH.write_text(f)

# ---------- instructor UI ----------
i = INSTRUCTOR.read_text()
i = replace_once(i,
"""--a:#F0A63C;--g:#75A98C;--r:#CE7C8D;--s:'Newsreader'""",
"""--a:#F0A63C;--g:#75A98C;--r:#CE7C8D;--x:#6FA8D6;--s:'Newsreader'""", 'instructor blue color')
i = replace_once(i,
""".bands{display:grid;gap:7px}.band{display:flex;justify-content:space-between;border-bottom:1px solid var(--l);padding:8px 0}.band b{font:600 20px var(--m);color:var(--a)}.warn{color:var(--r)!important}.contrast""",
""".bands{display:grid;gap:7px}.band{display:flex;justify-content:space-between;border-bottom:1px solid var(--l);padding:8px 0}.band b{font:600 20px var(--m);color:var(--a)}.band.data-room{border-left:2px solid var(--x);padding-left:10px}.band.data-room span,.band.data-room b{color:var(--x)}.buyer-dist{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.buyer-dist .runbox h4{margin:0 0 8px;font-size:18px;font-weight:400}.interest-row{display:flex;justify-content:space-between;border-bottom:1px solid var(--l);padding:6px 0}.interest-row span{font:9px var(--m);letter-spacing:.08em;text-transform:uppercase;color:var(--dd)}.interest-row b{font:600 16px var(--m);color:var(--a)}.buyer-find{margin-top:12px;border-left:2px solid var(--x);padding:10px 12px;background:rgba(111,168,214,.06)}.warn{color:var(--r)!important}.contrast""", 'instructor buyer styles')

i = replace_once(i,
"""<div class=\"kpi\"><b>${rs.filter(r=>r.outcomes?.year3?.calibrationGap||r.outcomes?.year3?.band==='unresolved_calibration').length}</b><span>calibration gaps</span></div>""",
"""<div class=\"kpi\"><b>${rs.filter(r=>r.outcomes?.year3?.band==='data_no_room').length}</b><span>data without room</span></div>""", 'instructor KPI')

i = replace_once(i,
"""${notice('Calibration note: Connect at the strong threshold with Capacity below the strong threshold is shown to students with the nearest authored pilot narrative and flagged here for review.')}""",
"""${notice('Year 3 treats strong Connect with sub-strong Capacity as its own authored outcome: Data without room to run it.')}""", 'calibration note')

i = replace_once(i,
"""function analytics(rs){return `<section class=\"card full\"><div class=\"meta\">Projector view</div><h2>What the room chose</h2><p class=\"lede\">Debrief cue: the annual cap is the wall. Every million above Run displaced an architecture choice somewhere else.</p>${distribution(rs)}</section><section class=\"card\"><div class=\"meta\">Year 3 bands</div><h3>Where portfolios landed</h3>${bands(rs)}</section><section class=\"card\"><div class=\"meta\">Connect vs Uptime</div><h3>The argument in two axes</h3>${scatter(rs)}</section><section class=\"card full\"><div class=\"meta\">Contrasting runs</div><h3>Two anonymous positions side by side</h3>${contrast(rs)}</section><section class=\"card full\"><div class=\"meta\">Opening views + export</div><h3>What they said the company should become</h3>${sentences(rs)}<div class=\"actions\"><button class=\"btn\" id=\"export\" ${rs.length?'':'disabled'}>Export CSV</button></div></section>`}
""",
"""function analytics(rs){return `<section class=\"card full\"><div class=\"meta\">Projector view</div><h2>What the room chose</h2><p class=\"lede\">Debrief cue: the annual cap is the wall. Every million above Run displaced an architecture choice somewhere else.</p>${distribution(rs)}</section><section class=\"card\"><div class=\"meta\">Year 3 bands</div><h3>Where portfolios landed</h3>${bands(rs)}</section><section class=\"card\"><div class=\"meta\">Connect vs Uptime</div><h3>The argument in two axes</h3>${scatter(rs)}</section><section class=\"card full\"><div class=\"meta\">Buyer interest</div><h3>Three buyers, three different answers</h3>${buyerInterest(rs)}</section><section class=\"card full\"><div class=\"meta\">Contrasting runs</div><h3>Two anonymous positions side by side</h3>${contrast(rs)}</section><section class=\"card full\"><div class=\"meta\">Opening views + export</div><h3>What they said the company should become</h3>${sentences(rs)}<div class=\"actions\"><button class=\"btn\" id=\"export\" ${rs.length?'':'disabled'}>Export CSV</button></div></section>`}
""", 'analytics buyer section')

i = replace_once(i,
"""function bands(rs){let c={strong:0,pilot:0,weak:0},gaps=0;rs.forEach(r=>{let b=r.outcomes?.year3?.band;if(b)c[b]=(c[b]||0)+1;if(r.outcomes?.year3?.calibrationGap)gaps++});return `<div class=\"bands\">${Object.entries(c).map(([k,n])=>`<div class=\"band\"><span>${esc(k)}</span><b>${n}</b></div>`).join('')}${gaps?`<div class=\"band\"><span class=\"warn\">calibration review</span><b class=\"warn\">${gaps}</b></div>`:''}</div>`}
""",
"""function bands(rs){const c={strong:0,data_no_room:0,pilot:0,weak:0},labels={strong:'strong',data_no_room:'Data without room to run it',pilot:'pilot',weak:'weak'};rs.forEach(r=>{const b=r.outcomes?.year3?.band;if(Object.prototype.hasOwnProperty.call(c,b))c[b]++});return `<div class=\"bands\">${Object.entries(c).map(([k,n])=>`<div class=\"band ${k==='data_no_room'?'data-room':''}\"><span>${esc(labels[k])}</span><b>${n}</b></div>`).join('')}</div>`}
function buyerInterest(rs){const names=[['carrolton','Carrolton Systems'],['ridge_hollow','Ridge Hollow Partners'],['corven','Corven Building Systems']];const cards=names.map(([key,name])=>{const c={high:0,qualified:0,low:0};rs.forEach(r=>{const v=r.outcomes?.buyers?.[key]?.interest;if(v)c[v]=(c[v]||0)+1});return `<div class=\"runbox\"><h4>${esc(name)}</h4>${['high','qualified','low'].map(k=>`<div class=\"interest-row\"><span>${k}</span><b>${c[k]||0}</b></div>`).join('')}</div>`}).join('');const matches=rs.map((r,i)=>({r,i})).filter(x=>x.r.outcomes?.buyers?.corven?.interest==='high'&&x.r.outcomes?.buyers?.ridge_hollow?.interest==='low');return `<div class=\"buyer-dist\">${cards}</div><div class=\"buyer-find\"><div class=\"meta\">Debate finder · Corven high / Ridge Hollow low</div>${matches.length?`<div class=\"actions\">${matches.map(x=>`<button class=\"btn buyer-run\" data-run=\"${esc(x.r.runId)}\">Anonymous run ${x.i+1}</button>`).join('')}</div>`:'<p>No run has landed there yet.</p>'}</div>`}
""", 'bands and buyer interest')

i = replace_once(i,
"""function startPresent(){document.body.classList.add('present');const cards=[...document.querySelectorAll('#app .card')].filter(x=>/Projector view|Year 3 bands|Connect vs Uptime|Contrasting runs/.test(x.textContent));""",
"""function startPresent(){document.body.classList.add('present');const cards=[...document.querySelectorAll('#app .card')].filter(x=>/Projector view|Year 3 bands|Connect vs Uptime|Buyer interest|Contrasting runs/.test(x.textContent));""", 'present buyer panel')

i = replace_once(i,
"""let ex=document.getElementById('export');if(ex)ex.onclick=exportCsv;let pb=document.getElementById('presentBtn');if(pb)pb.onclick=startPresent}""",
"""document.querySelectorAll('.buyer-run').forEach(b=>b.onclick=()=>{aSel=b.dataset.run;render()});let ex=document.getElementById('export');if(ex)ex.onclick=exportCsv;let pb=document.getElementById('presentBtn');if(pb)pb.onclick=startPresent}""", 'wire buyer finder')

i = replace_once(i,
"""const cols=['participant','team','run','strategic_view','y1_run','y1_uptime','y1_capacity','y1_connect','y1_features','y2_run','y2_uptime','y2_capacity','y2_connect','y2_features','year3_band','reflection_1','reflection_2'];""",
"""const cols=['participant','team','run','strategic_view','y1_run','y1_uptime','y1_capacity','y1_connect','y1_features','y2_run','y2_uptime','y2_capacity','y2_connect','y2_features','year3_band','buyer_carrolton','buyer_ridge_hollow','buyer_corven','reflection_1','reflection_2'];""", 'csv columns')
i = i.replace("r.outcomes?.year3?.band,mine.reflection1,mine.reflection2", "r.outcomes?.year3?.band,r.outcomes?.buyers?.carrolton?.interest,r.outcomes?.buyers?.ridge_hollow?.interest,r.outcomes?.buyers?.corven?.interest,mine.reflection1,mine.reflection2")
i = i.replace("r.outcomes?.year3?.band,r.reflection1,r.reflection2", "r.outcomes?.year3?.band,r.outcomes?.buyers?.carrolton?.interest,r.outcomes?.buyers?.ridge_hollow?.interest,r.outcomes?.buyers?.corven?.interest,r.reflection1,r.reflection2")
INSTRUCTOR.write_text(i)

# ---------- build guards ----------
b = BUILD.read_text()
b = replace_once(b,
"""for (const marker of ['Briefing & exhibits','Your outcome','Overall result','Three-year consequence timeline','The portfolio that produced this','Your original view','Year 2 allocation','Cumulative portfolio'])
""",
"""for (const marker of ['Briefing & exhibits','Your outcome','Overall result','Three-year consequence timeline','The portfolio that produced this','Your original view','Year 2 allocation','Cumulative portfolio','Three buyers','buyer-interest'])
""", 'student buyer guards')
b = replace_once(b,
"""for (const marker of ['Exhibit 1 — Where the revenue comes from','Exhibit 6 — What the machines already know'])
  if (!S.publicConfig().briefing?.exhibits?.some(x => x.title === marker)) refuse('briefing data missing: ' + marker);
""",
"""for (const marker of ['Exhibit 1 — Where the revenue comes from','Exhibit 6 — What the machines already know'])
  if (!S.publicConfig().briefing?.exhibits?.some(x => x.title === marker)) refuse('briefing data missing: ' + marker);
if (S.publicConfig().buyers?.authored !== true) refuse('buyer content is not marked authored');
if (!index.includes('data_no_room')) refuse('student final result does not recognize data_no_room');
if (index.includes('calibrationGap') || index.includes('unresolved_calibration')) refuse('resolved Year 3 calibration scaffolding remains in the student UI');
if (!instructor.includes('Data without room to run it')) refuse('instructor Year 3 distribution is missing data_no_room label');
if (!instructor.includes('Corven high / Ridge Hollow low')) refuse('instructor buyer debate finder is missing');
""", 'authored content build guards')
BUILD.write_text(b)

# ---------- README ----------
r = README.read_text()
r = replace_once(r,
"""## Content gaps deliberately not invented

The supplied build spec does not define:
1. the Year-3 result when cumulative Connect is at least 5 but Capacity is below 2;
2. the actual three buyer valuation rules/content.

The engine reports the first case as `unresolved_calibration` and the student view
does not fabricate buyer values. Both are visible to faculty so the missing authored
content can be supplied before publishing the sim.

""",
"""## Authored Year 3 and buyer content

The formerly open Year 3 calibration case is now authored as `data_no_room` when
Connect reaches the strong threshold but Capacity does not. The buyer stage is also
authored: Carrolton Systems, Ridge Hollow Partners and Corven Building Systems each
return a deterministic `high`, `qualified` or `low` interest verdict without a
dollar valuation, total, ranking or winner.

""", 'README content status')
README.write_text(r)

# Safety assertions
all_s = SCENARIO.read_text()
assert 'calibrationGap' not in all_s
assert 'unresolved_calibration' not in all_s
assert "band: 'data_no_room'" in all_s
assert "function evaluateBuyers" in all_s
assert "authored: true" in all_s
assert 'Corven Building Systems' in all_s
assert 'Ridge Hollow Partners' in all_s
assert 'Carrolton Systems' in all_s
assert 'Data without room to run it' in INSTRUCTOR.read_text()
assert 'Corven high / Ridge Hollow low' in INSTRUCTOR.read_text()
