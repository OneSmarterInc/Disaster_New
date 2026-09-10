'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const engine=require('../lib/scenario.js');
const {buildClosingLesson}=require('../lib/closingLesson.js');
const root=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(root,'public/index.html'),'utf8');
const config=engine.publicConfig();
let checks=0;
function check(name,fn){fn();checks++;console.log('PASS '+name);}
const names=['Dale Brenner','Renata Oyelaran','Tom Vasquez','Sam Achterberg'];
check('Packet and Room share four named people, roles, and exact quotes',()=>{
 assert.deepEqual(config.briefing.people,config.room.cast.map(({name,role,quote})=>({name,role,quote})));
 assert.deepEqual(config.briefing.people.map(p=>p.name),names);
 for(const person of config.briefing.people){assert.ok(person.role);assert.ok(person.quote);}
 assert.match(config.briefing.people[3].quote,/Nineteen percent/);assert.match(config.briefing.people[3].quote,/\$290/);
 assert.match(config.briefing.people[0].quote,/sixty-two technicians/);
});
check('Packet is course-neutral and describes the actual 30-minute two-allocation structure',()=>{
 const text=JSON.stringify(config.briefing);
 assert.doesNotMatch(text,/\b(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|semester|eighty minutes)\b/i);
 assert.match(text,/thirty minutes/);assert.match(text,/individually/);assert.match(text,/team/);
 assert.match(text,/no third allocation/);assert.equal(engine.META.minutes,30);
 assert.doesNotMatch(html,/What happens Tuesday|instructor posted before class/);
});
check('Full first-year voices, brief second-year wants, neutral Capacity slot',()=>{
 for(const line of config.lines){if(line.id==='capacity')continue;const cast=config.room.cast.find(p=>p.line===line.label);assert.equal(line.advocate.want,cast.quote);assert.ok(line.advocate.shortWant.length<line.advocate.want.length);}
 assert.match(config.lines.find(p=>p.id==='capacity').description,/No one in the room speaks for this line/);
 assert.match(html,/capacity-silence/);assert.match(html,/lineAdvocate\(l,year\)/);
 const allocator=html.slice(html.indexOf('function readOnlyAllocationHTML'),html.indexOf('function changeAlloc'));
 assert.doesNotMatch(allocator,/class="constraint"|class="alloc-rule"/);
});
check('Position states caps; View connects to the four competing voices',()=>{
 assert.match(config.position,/Run needs at least \$3 million/);assert.match(config.position,/\$3 million annual ceiling/);
 for(const name of ['Dale','Renata','Tom','Sam'])assert.ok(config.viewIntro.includes(name));assert.match(config.viewIntro,/fifth/);
});
check('Three reflection questions use the existing two persisted response fields',()=>{
 assert.doesNotMatch(config.reflectionPrompts[0],/same call/);assert.match(config.reflectionFollowUp,/same call/);
 assert.match(html,/id="r1FollowUp" maxlength="900" required/);assert.match(html,/splitFirstReflection/);
 assert.match(html,/Look back at your choices/);assert.doesNotMatch(html,/What changed your mind\?/);
 assert.match(html,/saveRun\(\{reflection1:S.reflection1,reflection2:S.reflection2,done:true\}\)/);
 const divider='\n\nAfter Year 3 — would I make the same call?\n';assert.ok(500+divider.length+900<=1500);
});
check('Outcome narrative precedes portfolio; Year 3 explicitly has no allocation',()=>{
 const y1=html.slice(html.indexOf('function renderYear1Outcome'),html.indexOf('function renderYear2Events'));
 const y2=html.slice(html.indexOf('function renderYear2Events'),html.indexOf('function renderYear3'));
 assert.ok(y1.indexOf('class="outcome"')<y1.indexOf("runningHTML(S.year1"));
 assert.ok(y2.indexOf('class="events"')<y2.indexOf("runningHTML(cum"));
 assert.match(html,/There is no allocation in Year 3/);assert.doesNotMatch(html,/The architecture underneath it is the one built over the previous two years/);
 assert.match(html,/allocation-dock/);assert.match(html,/position:sticky;bottom:0/);assert.match(html,/details class="year2-split"/);
 assert.match(config.coldOpen[1],/main office system/);assert.match(config.coldOpen[2],/most of the profit/);assert.match(config.coldOpen[3],/take over/);
});
const allocations=[];
for(let run=3;run<=9;run++)for(let uptime=0;uptime<=3;uptime++)for(let capacity=0;capacity<=3;capacity++)for(let connect=0;connect<=3;connect++)for(let features=0;features<=3;features++)if(run+uptime+capacity+connect+features===9)allocations.push({run,uptime,capacity,connect,features});
assert.equal(allocations.length,150);
check('All three earned Year 1 outcomes carry correct band-specific Year 2 intros',()=>{
 const representatives=[{run:3,uptime:2,capacity:2,connect:0,features:2},{run:3,uptime:2,capacity:1,connect:1,features:2},{run:3,uptime:1,capacity:1,connect:2,features:2}];
 const expected=[/renewed on price.*week spent on roofs/,/renewed, grudgingly.*late report/,/renewed early.*Sam’s report/];
 representatives.forEach((a,i)=>assert.match(engine.evaluateYear1(a).year2Intro,expected[i]));
 assert.match(engine.evaluateYear1(representatives[0]).nearMiss,/Connect allocation was \$0M/);
 assert.match(engine.evaluateYear1(representatives[0]).nearMiss,/Moving \$1M/);
 assert.match(engine.evaluateYear1(representatives[1]).nearMiss,/Moving \$1M/);
});
check('Near-miss arithmetic follows current calibration and never leaks into config',()=>{
 const a={run:3,uptime:3,capacity:3,connect:0,features:0};
 assert.match(engine.evaluateYear2(a,a).heat.nearMiss,/\$6M/);assert.match(engine.evaluateYear2(a,a).heat.nearMiss,/needed \$3M/);
 const custom={...engine.DEFAULT_THRESHOLDS,year1ConnectStrong:3,heatUptimeStrong:4,heatUptimeMiddle:2};
 assert.match(engine.evaluateYear2(a,a,custom).heat.nearMiss,/needed \$4M/);
 assert.match(engine.evaluateYear1({run:3,uptime:1,capacity:1,connect:2,features:2},custom).nearMiss,/Moving \$1M/);
 for(const key of Object.keys(engine.DEFAULT_THRESHOLDS))assert.ok(!JSON.stringify(config).includes(key));
 assert.ok(!JSON.stringify(config).includes('nearMiss'));
});
check('All Year 3 bands let Tom react before Sam closes; buyer footnotes are complete',()=>{
 const seen=new Set();
 for(const a of allocations)for(const b of allocations){const o=engine.evaluateAll(a,b);if(!seen.has(o.year3.band)){assert.ok(o.year3.narrative.indexOf('Tom:')>=0);assert.ok(o.year3.narrative.indexOf('Tom:')<o.year3.narrative.indexOf('Sam:'));seen.add(o.year3.band);}assert.doesNotMatch(o.year2.competitor.narrative,/we decided this before|The market question arrived after/i);}
 assert.equal(seen.size,4);
 const b=engine.evaluateBuyers({run:3,uptime:3,capacity:3,connect:0,features:0},{run:3,uptime:3,capacity:3,connect:0,features:0});
 for(const key of ['carrolton','ridge_hollow','corven'])assert.ok(b[key].roomLink);
 assert.equal(b.ridge_hollow.interest,'high');assert.match(b.ridge_hollow.reason,/cut costs further/);assert.match(b.ridge_hollow.reason,/not an endorsement/);
});
let trades=0;
check('All 22,500 valid portfolios get focused explanations and feasible opportunity costs',()=>{
 for(const a of allocations)for(const b of allocations){
  const outcomes=engine.evaluateAll(a,b),lesson=buildClosingLesson(a,b,outcomes,engine.DEFAULT_THRESHOLDS);
  assert.ok(lesson.yourRun.length<=3);assert.doesNotMatch(lesson.yourRun.join(' '),/NaN|undefined|\$-\d/);
  if(lesson.tradeoff){trades++;const trade=lesson.tradeoff;assert.ok(engine.validateAllocation(trade.year1).ok);assert.ok(engine.validateAllocation(trade.year2).ok);assert.equal(engine.evaluateAll(trade.year1,trade.year2).year2.heat.band,outcomes.year2.heat.band);assert.ok(trade.amount>0);}
 }
 const a={run:3,uptime:3,capacity:3,connect:0,features:0};const lesson=buildClosingLesson(a,a,engine.evaluateAll(a,a));
 assert.equal(lesson.tradeoff.amount,3);assert.equal(lesson.tradeoff.target,'connect');assert.match(lesson.yourRun[0],/twice what this heat wave needed/);assert.match(lesson.yourRun[0],/Sam/);assert.match(lesson.yourRun[0],/Year 3 pilot/);
});
if(process.env.MIDLAND_BASELINE){check('Against accepted baseline: all 22,500 default outcomes and calibrated bands are unchanged',()=>{
 const baseline=require(path.resolve(process.env.MIDLAND_BASELINE,'lib/scenario.js'));
 assert.deepEqual(engine.DEFAULT_THRESHOLDS,baseline.DEFAULT_THRESHOLDS);
 const projection=o=>[o.year1.band,o.year2.heat.band,o.year2.competitor.band,o.year3.band,o.buyers.carrolton.interest,o.buyers.ridge_hollow.interest,o.buyers.corven.interest,o.year3.cumulative];
 const calibrations=[undefined,{...engine.DEFAULT_THRESHOLDS,year1ConnectStrong:3,heatUptimeStrong:4,heatUptimeMiddle:2,competitorConnectStrong:5,competitorConnectPilotMin:2,competitorConnectPilotMax:4,year3ConnectStrong:4,year3ConnectPilotMax:3,year3CapacityStrong:3}];
 for(const t of calibrations)for(const a of allocations)for(const b of allocations)assert.deepEqual(projection(engine.evaluateAll(a,b,t)),projection(baseline.evaluateAll(a,b,t)));
 for(const file of ['public/instructor.html','api/session.js','api/finish.js','lib/store.js','config/thresholds.json'])assert.deepEqual(fs.readFileSync(path.join(root,file)),fs.readFileSync(path.resolve(process.env.MIDLAND_BASELINE,file)),file+' must stay unchanged');
});}
check('Student browser scripts parse',()=>{for(const m of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi))new vm.Script(m[1]);});
console.log(`RapidSim 03 Increment 3: ${checks} suites passed; 22,500 portfolios; ${trades} feasible opportunity-cost checks.`);
