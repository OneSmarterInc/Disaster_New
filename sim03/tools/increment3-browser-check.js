'use strict';
// Run with Playwright available via NODE_PATH. Uses real config/outcome/finish
// handlers on loopback; never contacts a classroom datastore or production.
const assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright');
process.env.ACCESS_CODE='midland-local-browser-test';
delete process.env.PLATFORM_URL;delete process.env.PLATFORM_API_URL;delete process.env.LAUNCH_SECRET;
const root=path.join(__dirname,'..');
const handlers={config:require('../api/config.js'),outcome:require('../api/outcome.js'),finish:require('../api/finish.js')};
const captured=[];
const server=http.createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,'http://localhost'),relative=url.pathname.replace(/^\/sim03/,'');
  if(relative.startsWith('/api/')){
   const action=relative.slice(5),handler=handlers[action];if(!handler){res.writeHead(404);return res.end();}
   let text='';for await(const chunk of req)text+=chunk;req.body=text?JSON.parse(text):{};
   captured.push({action,body:req.body});res.status=n=>{res.statusCode=n;return res;};res.json=value=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify(value));return res;};
   await handler(req,res);return;
  }
  const filename=relative==='/'?'index.html':relative.slice(1);
  if(!['index.html','launch.html'].includes(filename)){res.writeHead(404);return res.end();}
  res.setHeader('Content-Type','text/html; charset=utf-8');res.end(fs.readFileSync(path.join(root,'public',filename)));
 }catch(e){res.writeHead(500);res.end(e.stack);}
});
const evidence=process.env.MIDLAND_SCREENSHOTS||path.join(process.cwd(),'midland-browser-evidence');fs.mkdirSync(evidence,{recursive:true});
const results=[];
async function test(name,fn){try{await fn();results.push({name,status:'PASS'});console.log('PASS '+name);}catch(e){results.push({name,status:'FAIL',error:e.message});throw e;}}
const noConnect={run:3,uptime:3,capacity:3,connect:0,features:0};
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin=`http://127.0.0.1:${server.address().port}`;
 const browser=await chromium.launch({headless:true});const errors=[];
 try{
  const context=await browser.newContext({viewport:{width:1366,height:768}});
  await context.addInitScript(()=>sessionStorage.setItem('m03-access','midland-local-browser-test'));
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto(origin+'/sim03/index.html');await page.waitForSelector('#nextBtn');await page.evaluate(()=>document.fonts.ready);
  await test('Brief company paragraphs stay together; Continue is above laptop fold',async()=>{
   const text=await page.locator('.copy').innerText();assert.ok(text.indexOf('main office system')<text.indexOf('most of the profit'));assert.ok(text.indexOf('most of the profit')<text.indexOf('take over'));
   const box=await page.locator('#nextBtn').boundingBox();assert.ok(box.y+box.height<=768,JSON.stringify(box));await page.screenshot({path:path.join(evidence,'brief-1366.png')});
  });
  await test('Packet names all four people and removes schedule-specific copy',async()=>{
   await page.locator('[data-open-briefing]').last().click();const packet=page.locator('#briefingPacketModal');await packet.waitFor({state:'visible'});
   const text=await packet.innerText();for(const name of ['Dale Brenner','Renata Oyelaran','Tom Vasquez','Sam Achterberg'])assert.ok(text.includes(name));assert.match(text,/thirty minutes/);assert.doesNotMatch(text,/Tuesday|eighty minutes/);assert.match(text,/\$290/);
   await page.locator('#doneBriefingPacket').click();
  });
  await test('Brief, Room, Position, and View navigation works',async()=>{
   await page.locator('#nextBtn').click();assert.match(await page.locator('main').innerText(),/Four people, one budget/);
   await page.locator('#nextBtn').click();assert.match(await page.locator('main').innerText(),/\$3 million annual ceiling/);assert.match(await page.locator('main').innerText(),/No one in the room speaks for this line/);
   await page.locator('#nextBtn').click();for(const name of ['Dale','Renata','Tom','Sam'])assert.ok((await page.locator('main').innerText()).includes(name));
   await page.locator('#viewText').fill('Midland should keep service moving before funding new offers.');await page.locator('#nextBtn').click();
  });
  await test('Year 1 has one advocate block per line, explicit Capacity silence and no repeated paraphrases',async()=>{
   assert.equal(await page.locator('.alloc').count(),5);assert.equal(await page.locator('.alloc .advocate-reminder').count(),5);assert.equal(await page.locator('.alloc .constraint,.alloc .alloc-rule').count(),0);
   assert.match(await page.locator('.capacity-silence').innerText(),/No one in the room speaks/);assert.match(await page.locator('.alloc').first().innerText(),/sixty-two technicians/);
   assert.equal(await page.locator('#nextBtn').isDisabled(),true);
  });
  await test('Budget updates, exact-$9M commit rule, minimum and cap enforcement',async()=>{
   assert.equal(await page.locator('[data-line="run"][data-delta="-1"]').isDisabled(),true);
   for(const line of ['uptime','capacity'])for(let i=0;i<3;i++)await page.locator(`[data-line="${line}"][data-delta="1"]`).click();
   assert.match(await page.locator('.budget-live').innerText(),/\$0M remaining/);assert.equal(await page.locator('#nextBtn').isEnabled(),true);
   assert.equal(await page.locator('[data-line="uptime"][data-delta="1"]').isDisabled(),true);
  });
  await test('Year 1 commit confirmation can be cancelled, then accepted',async()=>{
   page.once('dialog',d=>d.dismiss());await page.locator('#nextBtn').click();assert.equal(await page.locator('.alloc').count(),5);
   page.once('dialog',d=>d.accept());await page.locator('#nextBtn').click();await page.waitForFunction(()=>S.step===5);
  });
  await test('Year 1 outcome tells story before portfolio and identifies Connect at zero',async()=>{
   assert.match(await page.locator('.outcome-near-miss').innerText(),/Connect allocation was \$0M/);
   const outcome=await page.locator('.outcome').boundingBox(),strip=await page.locator('.running').boundingBox();assert.ok(outcome.y<strip.y);
   await page.locator('#nextBtn').click();await page.waitForFunction(()=>S.step===6);
  });
  await test('Year 2 split starts collapsed; short quotes and band-specific intro are shown',async()=>{
   assert.equal(await page.locator('.year2-split').getAttribute('open'),null);assert.match(await page.locator('main>.lede').innerText(),/renewed on price/);
   const year2=await page.locator('.alloc').first().innerText();assert.match(year2,/Bring the operating bill down/);assert.doesNotMatch(year2,/Six million dollars a year/);
   const first=await page.locator('.alloc').first().boundingBox();assert.ok(first.y<600,JSON.stringify(first));
  });
  await test('Split table expands with correct arithmetic and remains open during an edit',async()=>{
   await page.locator('.year2-split>summary').click();await page.waitForFunction(()=>year2SplitOpen===true);
   await page.locator('[data-line="uptime"][data-delta="1"]').click();assert.notEqual(await page.locator('.year2-split').getAttribute('open'),null);
   const rows=await page.locator('.year2-breakdown-row').allInnerTexts();assert.match(rows[2],/\$3M[\s\S]*\$1M[\s\S]*\$4M/);
   await page.locator('.year2-split>summary').click();await page.waitForFunction(()=>year2SplitOpen===false);
   for(let i=0;i<2;i++)await page.locator('[data-line="uptime"][data-delta="1"]').click();for(let i=0;i<3;i++)await page.locator('[data-line="capacity"][data-delta="1"]').click();
  });
  await test('Sticky budget and commit remain visible alongside Features while scrolled',async()=>{
   await page.locator('.alloc').last().scrollIntoViewIfNeeded();await page.evaluate(()=>scrollTo(0,document.body.scrollHeight));
   const feature=await page.locator('.alloc').last().boundingBox(),dock=await page.locator('.allocation-dock').boundingBox(),button=await page.locator('#nextBtn').boundingBox();
   assert.ok(feature.y>=0&&feature.y+feature.height<=dock.y+2,JSON.stringify({feature,dock}));assert.ok(button.y>=0&&button.y+button.height<=768);
   await page.screenshot({path:path.join(evidence,'year2-features-and-commit.png')});
   page.once('dialog',d=>d.accept());await page.locator('#nextBtn').click();await page.waitForFunction(()=>S.step===7);
  });
  await test('Heat-wave near miss explains $6M versus $3M and narrative precedes portfolio',async()=>{
   assert.match(await page.locator('.outcome-near-miss').innerText(),/\$6M/);assert.match(await page.locator('.outcome-near-miss').innerText(),/needed \$3M/);
   const outcome=await page.locator('.events').boundingBox(),strip=await page.locator('.running').boundingBox();assert.ok(outcome.y<strip.y);
   await page.locator('#nextBtn').click();assert.doesNotMatch(await page.locator('.events').innerText(),/we decided this before|The market question arrived after/i);assert.match(await page.locator('.events').innerText(),/whole board window/);
   await page.locator('#nextBtn').click();await page.waitForFunction(()=>S.step===8);
  });
  await test('Year 3 has no allocator, Tom reacts, and Sam closes',async()=>{
   const text=await page.locator('main').innerText();assert.match(text,/There is no allocation in Year 3/);assert.equal(await page.locator('.stepper').count(),0);
   const story=await page.locator('.outcome').innerText();assert.ok(story.indexOf('Tom:')>=0&&story.indexOf('Tom:')<story.indexOf('Sam:'));await page.locator('#nextBtn').click();
  });
  await test('All buyers have footnotes and Ridge Hollow high interest explains post-sale cutting',async()=>{
   assert.equal(await page.locator('.buyer-room-link').count(),3);const ridge=await page.locator('.buyer').nth(1).innerText();assert.match(ridge,/high/i);assert.match(ridge,/cut costs further/);await page.locator('#nextBtn').click();
  });
  await test('First reflection has separate answer boxes; the reconsideration cannot be skipped',async()=>{
   assert.equal(await page.locator('textarea').count(),3);await page.locator('#r1').fill('Sam’s argument for hearing the field machines.');
   const count=captured.filter(x=>x.action==='finish').length;await page.locator('#finishBtn').click();assert.equal(captured.filter(x=>x.action==='finish').length,count);assert.equal(await page.evaluate(()=>document.activeElement.id),'r1FollowUp');
   await page.locator('#r1FollowUp').fill('No. Dispatch needed only half of what I gave it; I would fund field connections.');await page.locator('#r2').fill('Move one million from Uptime to Connect in Year 1.');
   await page.locator('#finishBtn').click();await page.waitForSelector('.run-complete');
  });
  await test('Completion preserves both answers and leads with the real opportunity cost',async()=>{
   const finish=captured.filter(x=>x.action==='finish').at(-1);assert.match(finish.body.reflection1,/Sam’s argument/);assert.match(finish.body.reflection1,/After Year 3/);assert.match(finish.body.reflection1,/No\. Dispatch/);assert.ok(finish.body.reflection1.length<=1500);
   const run=await page.locator('.closing-run').innerText();assert.match(run,/twice what this heat wave needed/);assert.match(run,/Sam/);assert.match(run,/Moving \$3M/);assert.match(run,/pilot/);
   await page.screenshot({path:path.join(evidence,'closing-opportunity-cost.png')});
  });
  for(const viewport of [{width:1366,height:768},{width:1280,height:720},{width:390,height:844}]){
   await page.setViewportSize(viewport);
   await test(`Brief and allocator layout at ${viewport.width}x${viewport.height}`,async()=>{
    await page.evaluate(()=>{S.step=0;S.session=null;S.finished=false;render();scrollTo(0,0);});
    if(viewport.width>=1000){const button=await page.locator('#nextBtn').boundingBox();assert.ok(button.y+button.height<=viewport.height,'Brief Continue below fold: '+JSON.stringify(button));}
    for(const step of [4,6]){
     await page.evaluate(({step,a})=>{S.step=step;S.year1={...a};S.year2={...a};S.canSubmit=true;year2SplitOpen=false;render();scrollTo(0,0);},{step,a:noConnect});
     assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,'horizontal overflow');
     const first=await page.locator('.alloc').first().boundingBox();if(viewport.width>=1000)assert.ok(first.y<viewport.height-120,'allocator below fold: '+JSON.stringify(first));
     await page.evaluate(()=>scrollTo(0,document.body.scrollHeight));const feature=await page.locator('.alloc').last().boundingBox(),dock=await page.locator('.allocation-dock').boundingBox();assert.ok(feature.y+feature.height<=dock.y+2,'Features obscured: '+JSON.stringify({feature,dock}));
     const button=await page.locator('#nextBtn').boundingBox();assert.ok(button.y>=0&&button.y+button.height<=viewport.height+1);
     await page.screenshot({path:path.join(evidence,`allocator-${step}-${viewport.width}.png`)});
    }
   });
  }
  await test('Read-only team allocator preserves permissions and uses the shorter Year 2 copy',async()=>{
   await page.setViewportSize({width:1366,height:768});await page.evaluate(a=>{S.session={mode:'team',state:'running',code:'LOCAL'};S.me={groupId:'team:local',teamLabel:'Local test'};S.mates=[{name:'Lead',isCaptain:true}];S.canSubmit=false;S.teamRun={year1:a,year2:a};S.step=6;render();},noConnect);
   assert.equal(await page.locator('.step').count(),0);assert.match(await page.locator('.alloc').first().innerText(),/Bring the operating bill down/);assert.match(await page.locator('.locked').innerText(),/read-only/);
  });
  await test('No JavaScript errors occurred',async()=>assert.deepEqual(errors,[]));
  console.log(`Midland Increment 3 browser verification: ${results.length} checks passed.`);
 }finally{fs.writeFileSync(path.join(evidence,'results.json'),JSON.stringify(results,null,2));await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(e=>{console.error(e.stack);process.exitCode=1;server.close();});
