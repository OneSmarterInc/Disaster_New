'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const S = require('../lib/scenario');
const {buildClosingLesson, transferRoom} = require('../lib/closingLesson');
const c = S.publicConfig(), html=fs.readFileSync(path.join(__dirname,'../public/index.html'),'utf8');
const packet=JSON.stringify(c.briefing);
assert.doesNotMatch(packet,/\b(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|semester|eighty minutes|your team)\b/i);
assert.equal(S.META.minutes,30);
assert.match(packet,/two annual allocations/);assert.match(packet,/individually or as a team/);assert.match(packet,/no third allocation/);
assert.equal(c.briefing.people.length,4);
for(const person of c.room.cast){
  const p=c.briefing.people.find(x=>x.name===person.name), line=c.lines.find(x=>x.advocate?.name===person.name);
  assert.equal(p.role,person.role);assert.equal(p.quote,person.quote);assert.equal(line.advocate.want,person.quote);
  assert.ok(line.advocate.shortWant.length<person.quote.length);assert.ok(line.advocate.shortWant.length<100);
}
assert.match(c.briefing.people.find(x=>x.name.startsWith('Sam')).quote,/Nineteen percent.*\$290/);
assert.match(c.briefing.people[0].quote,/sixty-two technicians.*paper/);
assert.equal(c.lines.find(x=>x.id==='capacity').unrepresented,'No one in the room speaks for this line.');
assert.match(c.position,/Run needs at least \$3M/);assert.match(c.position,/each have a \$3M per-year ceiling/);
assert.match(c.viewContext,/Dale.*Renata.*Tom.*Sam.*fifth position/);
assert.doesNotMatch(c.reflectionPrompts[0],/same call/);assert.match(c.reflectionFollowUp,/After seeing Year 3.*same call/);
for(const text of ['r1followup','REFLECTION_SEPARATOR','readFirstReflection','S.reflection1.length>1500','The decisions are over. Which would you revisit?','Year 3 is a reveal only. There is no allocation.','position:sticky;bottom:0','allocationSplit'])assert.ok(html.includes(text),text);
const row=html.slice(html.indexOf('function allocRow('),html.indexOf('function changeAlloc('));
assert.ok(row.includes('lineAdvocate(l,year)'));assert.doesNotMatch(row,/constraint|alloc-rule|l.description/);
assert.ok(c.coldOpen[1].includes('fourteen years'));assert.ok(c.coldOpen[2].includes('profit'));assert.ok(c.coldOpen[3].includes('take over'));
const a0={run:3,uptime:3,capacity:1,connect:0,features:2};
const a1={run:3,uptime:3,capacity:1,connect:1,features:1};
const a2={run:3,uptime:2,capacity:1,connect:2,features:1};
const intros=[a0,a1,a2].map(a=>S.evaluateYear1(a).year2Intro);
assert.equal(new Set(intros).size,3);
assert.match(intros[0],/renewed on price.*competitor calls.*week spent on roofs/);
assert.match(intros[1],/renewed, grudgingly.*late report/);
assert.match(intros[2],/renewed early.*Sam’s report/);
for(const intro of intros){assert.match(intro,/A year has passed/);assert.match(intro,/same \$9 million/)}
const outcome=S.evaluateAll(a0,a0);
assert.match(outcome.year1.allocationNote,/\$0M.*Sam.*\$1M.*partial coverage/);
assert.match(outcome.year2.heat.allocationNote,/\$6M.*\$3M.*\$3M/);
assert.match(outcome.buyers.carrolton.roomLink,/No one in the room/);
const ridge=S.evaluateBuyers({run:3,uptime:3,capacity:3,connect:0,features:0},{run:3,uptime:3,capacity:3,connect:0,features:0}).ridge_hollow;
assert.equal(ridge.interest,'high');assert.match(ridge.reason,/After the sale.*cut costs further/);
const lesson=buildClosingLesson(a0,a0,outcome,S.DEFAULT_THRESHOLDS);
assert.equal(lesson.yourRun.length,3);assert.equal(lesson.otherConsequences.length,2);
const trade=lesson.yourRun[1];
assert.match(trade,/Renata.*\$6M.*twice.*\$3M.*Sam.*\$0M.*Moving \$3M from Uptime to Connect/);
assert.match(trade,/prediction pilot, not a full service/);assert.match(trade,/Dispatch would still have held/);
assert.doesNotMatch(lesson.yourRun[0],/more.*would have/,'Do not repeat the transfer in the lead.');

// Golden digests calculated from accepted Increment 2 (a8560b5) before editing.
// Every legal annual portfolio and every two-year pair must keep the same bands
// and buyer interest, at default, retuned, and edge calibrations. No calibration
// file is written by these tests.
const allocations=[];
for(let uptime=0;uptime<=3;uptime++)for(let capacity=0;capacity<=3;capacity++)for(let connect=0;connect<=3;connect++)for(let features=0;features<=3;features++){
  const a={run:9-uptime-capacity-connect-features,uptime,capacity,connect,features};if(S.validateAllocation(a).ok)allocations.push(a);
}
assert.equal(allocations.length,150);
const calibrations=[
  [S.DEFAULT_THRESHOLDS,'4d09aa4790052f8b8ba2026e600542f6c05f48634fec59c9723b6d2b38c4d7c6'],
  [{...S.DEFAULT_THRESHOLDS,year1ConnectStrong:3,heatUptimeStrong:4,heatUptimeMiddle:1,competitorConnectStrong:5,competitorConnectPilotMin:1,competitorConnectPilotMax:4,year3ConnectStrong:6,year3CapacityStrong:3,year3ConnectPilotMin:2,year3ConnectPilotMax:5},'919484198797f1832245d65c4a39c239ab9b98463717895cd45c572ec4260eb3'],
  [{...S.DEFAULT_THRESHOLDS,year1ConnectStrong:1,heatUptimeStrong:1,heatUptimeMiddle:0,competitorConnectStrong:2,competitorConnectPilotMin:0,competitorConnectPilotMax:1,year3ConnectStrong:2,year3CapacityStrong:0,year3ConnectPilotMin:0,year3ConnectPilotMax:1},'f3a80ddf5eae7b6a1c33885fba84283f52583cc80b4f4ba197eface67cb37e93']
];
const bands=new Set();let transfers=0;
for(const [t,expected] of calibrations){
  assert.equal(S.validateThresholds(t).ok,true);
  const hash=crypto.createHash('sha256');
  for(const a of allocations)for(const b of allocations){
    const o=S.evaluateAll(a,b,t), y3=o.year3.band;bands.add(y3);
    hash.update(JSON.stringify([a,b,o.year1.band,o.year2.heat.band,o.year2.competitor.band,y3,o.buyers.carrolton.interest,o.buyers.ridge_hollow.interest,o.buyers.corven.interest])+'\n');
    assert.ok(o.year3.narrative.indexOf('Tom:')>=0 && o.year3.narrative.indexOf('Tom:')<o.year3.narrative.indexOf('Sam:'));
    assert.doesNotMatch(o.year2.competitor.narrative,/market question arrived after the architecture|decided this before we knew/);
    const d=buildClosingLesson(a,b,o,t), text=d.yourRun.join(' ');
    assert.doesNotMatch(text,/NaN|undefined|\$-\d/);
    const m=text.match(/Moving \$(\d+)M from (\w+) to (\w+) within the annual ceilings could have/);
    if(m){
      const n=Number(m[1]),from=m[2].toLowerCase(),to=m[3].toLowerCase();
      const movement=transferRoom(a,b,from,to,n);assert.equal(movement.total,n);
      const pair=[a,b].map((p,i)=>({...p,[from]:p[from]-movement.moved[i],[to]:p[to]+movement.moved[i]}));
      for(const p of pair)assert.equal(S.validateAllocation(p).ok,true);
      const alt=S.evaluateAll(...pair,t);
      if(from==='uptime')assert.equal(alt.year2.heat.band,'strong');
      if(text.includes('could have made predictive service available at scale'))assert.equal(alt.year3.band,'strong');
      else if(text.includes('could have reached the Year 3 prediction pilot'))assert.equal(alt.year3.band,'pilot');
      else if(text.includes('could have supplied the field history'))assert.equal(alt.year3.band,'data_no_room');
      else if(text.includes('could have built more'))assert.equal(alt.year3.band,y3);
      transfers++;
    }
  }
  assert.equal(hash.digest('hex'),expected,'Increment 2 engine outcome changed');
}
assert.deepEqual([...bands].sort(),['data_no_room','pilot','strong','weak']);
for(const name of Object.keys(S.DEFAULT_THRESHOLDS))assert.ok(!JSON.stringify(c).includes(name),'private thresholds leaked');
console.log(`Increment 3 checks passed: 67,500 baseline-equivalent allocation pairs; ${transfers} feasible, outcome-verified transfers; all Year 2 intros and Year 3 voices.`);
