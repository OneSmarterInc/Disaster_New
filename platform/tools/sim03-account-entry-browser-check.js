const assert = require('node:assert/strict');
const http = require('node:http');
const https = require('node:https');
const os = require('node:os');
const fs = require('node:fs/promises');
const path = require('node:path');
const { promisify } = require('node:util');
const { execFile } = require('node:child_process');
const { chromium } = require('playwright');
const f = require('./sim03-account-fixture.js');
const exec = promisify(execFile);
const root = path.resolve(__dirname, '../..');
const artifacts = path.resolve('browser-artifacts/account-entry');
let browser, platform, simulation, tls, certDir, checks=0;
const servers=[], contexts=[], failures=[];
const equal=(a,b,label)=>{assert.deepEqual(a,b,label);checks++;console.log('PASS:',label);};
async function listen(fn, secure=true) {
  const handler=(req,res)=>fn(req,res).catch(error=>{
    failures.push(error.stack);res.writeHead(500);res.end('Test server error');
  });
  const server=secure?https.createServer(tls,handler):http.createServer(handler);
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));servers.push(server);
  return `${secure?'https':'http'}://127.0.0.1:${server.address().port}`;
}
async function file(res,relative) {
  const content=await fs.readFile(path.join(root,relative));
  res.writeHead(200,{'content-type':relative.endsWith('.js')?'text/javascript':relative.endsWith('.css')?'text/css':'text/html','cache-control':'no-store'});res.end(content);
}
async function invoke(name,req,res,url) {
  const chunks=[]; for await(const chunk of req) chunks.push(chunk);
  const body=chunks.length?JSON.parse(Buffer.concat(chunks).toString()):{};
  const r=await f.call(name,body,{headers:req.headers,query:Object.fromEntries(url.searchParams),method:req.method});
  Object.entries(r.headers).forEach(([k,v])=>res.setHeader(k,v));
  res.statusCode=r.statusCode;
  if(r.url){res.setHeader('Location',r.url);return res.end();}
  res.setHeader('content-type',typeof r.payload==='string'?'text/html':'application/json');
  res.end(typeof r.payload==='string'?r.payload:JSON.stringify(r.payload));
}
async function simRoute(req,res,url) {
  let pathname=url.pathname.replace(/^\/sim03(?=\/|$)/,'')||'/';
  if(pathname.startsWith('/api/')) return invoke(pathname.slice(5),req,res,url);
  if(pathname==='/')pathname='/launch.html';
  if(!['/launch.html','/index.html','/instructor.html'].includes(pathname)){res.statusCode=404;return res.end();}
  return file(res,'sim03/public'+pathname);
}
async function page(name) {
  const context=await browser.newContext({viewport:{width:1366,height:900},ignoreHTTPSErrors:true});contexts.push(context);
  await context.route(/https:\/\/fonts\.(googleapis|gstatic)\.com\//,route=>route.abort());
  const p=await context.newPage();p.setDefaultTimeout(12000);
  p.on('pageerror',error=>failures.push(name+': '+error.stack));
  return p;
}
async function signIn(p,email) {
  const response=await p.context().request.post(platform+'/api/auth',{data:{action:'signin',email,password:'password123'}});
  equal(response.status(),200,'sign-in cookie created for '+email);
}
async function joined(p,id) {
  await p.waitForFunction(id=>typeof S!=='undefined'&&S.hasSessionState&&S.me?.id===id,id);
  equal(await p.locator('#code').count(),0,'student sees no standalone access-code gate');
}
async function shot(p,name){await p.screenshot({path:path.join(artifacts,name+'.png'),fullPage:true});}
(async()=>{
  await fs.mkdir(artifacts,{recursive:true});
  // The production cookie is Secure. Exercise it over HTTPS rather than
  // stripping that flag to make an HTTP-only test appear authenticated.
  certDir=await fs.mkdtemp(path.join(os.tmpdir(),'sim03-entry-tls-'));
  const key=path.join(certDir,'key.pem'),cert=path.join(certDir,'cert.pem');
  await exec('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-keyout',key,'-out',cert,'-days','1','-subj','/CN=localhost','-addext','subjectAltName=IP:127.0.0.1,DNS:localhost']);
  tls={key:await fs.readFile(key),cert:await fs.readFile(cert)};
  simulation=await listen((req,res)=>simRoute(req,res,new URL(req.url,simulation)));
  const platformRoute=async(req,res)=>{
    const url=new URL(req.url,platform);
    if(url.pathname.startsWith('/sim03'))return simRoute(req,res,url);
    if(url.pathname==='/api/register'){res.writeHead(200,{'content-type':'application/json'});return res.end('{}');}
    if(url.pathname.startsWith('/api/'))return invoke(url.pathname.slice(5),req,res,url);
    if(['/session.html','/session-entry.js','/app.css'].includes(url.pathname))return file(res,'platform/public'+url.pathname);
    res.writeHead(404);res.end('Not found');
  };
  platform=await listen(platformRoute);
  const smoke=await listen(platformRoute,false);
  process.env.PLATFORM_URL=platform;process.env.SIM_URL=simulation;
  f.sim.launch_url=simulation;
  // Verify the running test server with agent-browser before proceeding.
  assert.ok(process.env.AGENT_BROWSER_BIN,'AGENT_BROWSER_BIN required');
  await exec(process.env.AGENT_BROWSER_BIN,['--session','account-entry-check','open',smoke+'/session.html?sim=rapid-03-midland&session=ABCDE&course=course-a']);
  const snapshot=await exec(process.env.AGENT_BROWSER_BIN,['--session','account-entry-check','snapshot','-i']);
  assert.match(snapshot.stdout,/Create account and join/i);checks++;
  await exec(process.env.AGENT_BROWSER_BIN,['--session','account-entry-check','close']);
  browser=await chromium.launch({headless:true});
  // Faculty creates exactly the Team session from the UI, then copies its link.
  const teacher=await page('teacher');await signIn(teacher,'teacher@example.test');
  const launched=await teacher.context().request.get(platform+'/api/launch?sim='+f.sim.id+'&course=course-a&mode=session&format=json');
  const launchData=await launched.json();
  equal(launched.status(),200,'faculty cookie authorizes session launch: '+JSON.stringify(launchData.error||''));
  await teacher.goto(launchData.url);
  await teacher.locator('[data-mode="team"]').click();
  await teacher.locator('#create').click();
  await teacher.waitForFunction(()=>document.getElementById('join')?.value.includes('/session.html'));
  const invite=await teacher.locator('#join').inputValue();const code=new URL(invite).searchParams.get('session');
  equal(new URL(invite).origin,platform,'generated invite uses platform account origin');
  equal(new URL(invite).searchParams.get('course'),'course-a','generated invite carries class');
  equal(new URL(invite).hash,'','no teacher token copied');await shot(teacher,'01-faculty-session-link');
  await teacher.locator('[data-enrolled-id="platform:pending"]').filter({hasText:'Waiting for access release'}).waitFor();
  equal((await teacher.locator('#courseAccess').getAttribute('href')).includes('course=course-a'),true,'faculty release link targets the current course');
  // Selecting the read-only share link must not freeze the live participant UI.
  await teacher.locator('#join').focus();

  const alice=await page('alice');await signIn(alice,'alice@example.test');
  await alice.goto(invite);await joined(alice,'platform:alice');
  equal(await alice.evaluate(()=>S.sessionCode),code,'already signed-in student reaches original session');
  await shot(alice,'02-signed-in-student');
  await teacher.waitForFunction(()=>document.querySelector('.kpi b')?.textContent==='1');
  await teacher.locator('[data-enrolled-id="platform:alice"]').filter({hasText:'In this session'}).waitFor();checks++;
  // A read-only enrolment refresh must not wipe an unfinished team name.
  await teacher.locator('#newTeamName').fill('My unfinished team');

  await alice.reload();await joined(alice,'platform:alice');
  equal(Object.keys(f.participants.get(code)).length,1,'reload does not create duplicate participant');
  const loggedOut=await page('logged-out');await loggedOut.goto(invite);
  await loggedOut.locator('#name').waitFor();await shot(loggedOut,'03-create-account');
  await loggedOut.locator('#switch-account').click();
  await loggedOut.locator('#email').fill('bob@example.test');await loggedOut.locator('#password').fill('wrong');
  await loggedOut.locator('#continue').click();await loggedOut.locator('#err').filter({hasText:"don't match"}).waitFor();
  equal(await loggedOut.locator('#continue').isEnabled(),true,'bad password can be corrected without losing invite');
  await loggedOut.locator('#password').fill('password123');await loggedOut.locator('#continue').click();
  await joined(loggedOut,'platform:bob');
  equal(await loggedOut.evaluate(()=>S.sessionCode),code,'sign-in retains session');
  equal(Object.keys(f.participants.get(code)).length,2,'same-name students stay separate');
  const fresh=await page('new-account');await fresh.goto(invite);
  await fresh.locator('#name').fill('New Student');await fresh.locator('#email').fill('fresh@example.test');
  await fresh.locator('#password').fill('password123');await fresh.locator('#continue').click();
  await fresh.getByRole('heading',{name:'Waiting on your instructor'}).waitFor();
  equal(await fresh.locator('#code').count(),0,'new enrollee sees release status, not an access code');
  await shot(fresh,'04-awaiting-release');
  const user=[...f.users.values()].find(u=>u.email==='fresh@example.test');
  equal(!!user,true,'existing signup API created a real hashed account in test DB');
  await teacher.locator('[data-enrolled-id="platform:'+user.id+'"]').filter({hasText:'Waiting for access release'}).waitFor();
  equal(await teacher.locator('#newTeamName').inputValue(),'My unfinished team','new enrolment becomes visible without losing the focused team draft');
  equal(!!f.participants.get(code)['platform:'+user.id],false,'roster visibility does not bypass launch authorization');
  await shot(teacher,'05-faculty-enrolment-before-release');
  f.enrolments.find(e=>e.student_id===user.id).paid=true;
  // No refresh or Check again click: the waiting page resumes on its own.
  await joined(fresh,'platform:'+user.id);
  await teacher.locator('[data-enrolled-id="platform:'+user.id+'"]').filter({hasText:'In this session'}).waitFor();
  checks++;

  equal(await fresh.evaluate(()=>S.sessionCode),code,'after faculty release newcomer enters same session');
  // An old direct simulator URL still works, on both root and platform prefix.
  await alice.goto(simulation+'/launch.html?session='+code);await joined(alice,'platform:alice');
  f.sim.launch_url=platform+'/sim03';
  await alice.goto(platform+'/sim03/index.html?session='+code);await joined(alice,'platform:alice');
  equal(new URL(alice.url()).pathname,'/sim03/index.html','prefixed deployment returns to correct simulation');
  // Change account in the same browser where a different participant is cached.
  await signIn(alice,'bob@example.test');await alice.goto(invite);await joined(alice,'platform:bob');
  equal(await alice.evaluate(()=>S.me.name),'Alex Student','account switching replaces remembered participant');
  const pending=await page('unreleased');await signIn(pending,'pending@example.test');await pending.goto(invite);
  await pending.getByRole('heading',{name:'Waiting on your instructor'}).waitFor();checks++;
  equal(failures,[],'no browser JavaScript errors or unexpected server errors');
  const result={status:'passed',assertions:checks,scope:'Real account, launch and session handlers plus real HTML in Chromium; in-memory SQL/session adapters; no production data'};
  await fs.writeFile(path.join(artifacts,'results.json'),JSON.stringify(result,null,2));
  console.log('ACCOUNT_ENTRY_BROWSER_PASSED',JSON.stringify(result));
})().catch(async error=>{
  console.error(error);process.exitCode=1;
  for(let i=0;i<contexts.length;i++){
    const p=contexts[i].pages()[0];if(!p)continue;
    console.error('FAILED_PAGE',i,p.url(),await p.locator('body').innerText().catch(()=>''));
    await shot(p,'failure-'+i).catch(()=>{});
  }
}).finally(async()=>{
  if(process.env.AGENT_BROWSER_BIN)await exec(process.env.AGENT_BROWSER_BIN,['--session','account-entry-check','close']).catch(()=>{});
  await Promise.all(contexts.map(c=>c.close().catch(()=>{})));
  if(browser)await browser.close();
  await Promise.all(servers.map(s=>new Promise(resolve=>s.close(resolve))));
  if(certDir)await fs.rm(certDir,{recursive:true,force:true});
});
