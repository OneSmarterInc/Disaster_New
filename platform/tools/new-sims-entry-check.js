const assert=require('assert/strict'),fs=require('fs'),vm=require('vm');
const F=require('./new-sims-entry-fixture.js');
const path=require('node:path'),root=path.resolve(__dirname,'../..');
const storage=()=>{const m=new Map();return {getItem:k=>m.get(k)||null,setItem:(k,v)=>m.set(k,String(v)),removeItem:k=>m.delete(k)}};
const escape=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
let checks=0;function ok(v,msg){assert.ok(v,msg);checks++}
async function page(n,kind='index',url='',saved={}){
 const elements=new Map(),timers=new Map(),timeouts=new Map(),requests=[];let next=0;
 class El{
  constructor(id=''){this.id=id;this.value='';this._html='';this._text='';this.children=[];this.hidden=false;this.classList={toggle(){}}}
  set innerHTML(s){for(const id of this.children)elements.delete(id);this.children=[];this._html=String(s);for(const m of this._html.matchAll(/<[^>]+\bid="([^"]+)"[^>]*>/g)){const el=new El(m[1]);el.value=(m[0].match(/\bvalue="([^"]*)"/)||[])[1]||'';elements.set(el.id,el);this.children.push(el.id)}}
  get innerHTML(){return this._html||escape(this._text)}
  set textContent(s){this._text=String(s);this._html=''}get textContent(){return this._text}
  querySelectorAll(){return []}querySelector(){return null}focus(){}addEventListener(){}
 }
 const dom={getElementById:id=>elements.get(id)||null,createElement:()=>new El(),querySelectorAll:()=>[],querySelector:()=>null};
 const html=fs.readFileSync(path.join(root,`sim${n}/public/${kind}.html`),'utf8');
 for(const m of html.split('<script>')[0].matchAll(/\bid="([^"]+)"/g))elements.set(m[1],new El(m[1]));
 let target=new URL(url||`http://fixture/sim${n}/${kind}.html`);let redirect=null;
 const location={get pathname(){return target.pathname},get search(){return target.search},get hash(){return target.hash},replace:u=>{redirect=new URL(u,target).href},assign:u=>{redirect=new URL(u,target).href},reload(){}};
 const ss=saved.ss||storage(),ls=saved.ls||storage();
 const ctx=vm.createContext({document:dom,location,history:{replaceState(_,__,u){target=new URL(u,target)}},sessionStorage:ss,localStorage:ls,TextDecoder,Uint8Array,URLSearchParams,Date,console,scrollTo(){},matchMedia:()=>({matches:false}),performance:{now:()=>0},atob:t=>Buffer.from(t,'base64').toString('binary'),setInterval:f=>{timers.set(++next,f);return next},clearInterval:id=>timers.delete(id),setTimeout:f=>{timeouts.set(++next,f);return next},clearTimeout:id=>timeouts.delete(id)});
 ctx.window={addEventListener(){}};
 ctx.fetch=async(u,opt={})=>{
  const targetURL=new URL(u,target),name=targetURL.pathname.split('/').at(-1);requests.push(targetURL.pathname+targetURL.search);
  const req={method:opt.method||'GET',headers:opt.headers||{},query:Object.fromEntries(targetURL.searchParams),body:opt.body?JSON.parse(opt.body):{}};
  const r=await F.api(n,name,req);return {ok:r.status>=200&&r.status<300,status:r.status,json:async()=>r.body};
 };
 let js=html.match(/<script>([\s\S]*?)<\/script>/)[1];
 if(kind==='index')js=n==='07'?js.replace('// ---- boot ----\n(async()=>{','// ---- boot ----\nglobalThis.ready=(async()=>{'):js.replace(/init\(\);\s*$/, 'globalThis.ready=init();');
 vm.runInContext(js,ctx);if(ctx.ready)await ctx.ready;
 const drain=async()=>{for(let i=0;i<5;i++)await Promise.resolve()};
 return {ctx,ss,ls,elements,requests,dom,body:()=>elements.get('app')?.innerHTML||'',redirect:()=>redirect,run:s=>vm.runInContext(s,ctx),click:async id=>{const el=elements.get(id);assert.ok(el&&el.onclick,`button ${id} exists`);await el.onclick();await drain()},tick:async()=>{for(const fn of [...timers.values()])await fn();await drain()},retry:async()=>{const fns=[...timeouts.values()];timeouts.clear();for(const fn of fns)await fn();await drain()}};
}

(async()=>{
 for(const n of ['07','08']){
  const key=n==='07'?'w07':'m08';
  const gate=await page(n,'launch');gate.elements.get('code').value='entry-test';await gate.click('open');
  ok(gate.redirect().endsWith('/index.html'),`${n}: access code opens student page`);
  let p=await page(n,'index','',gate);
  ok(!p.body().includes('Session code'),`${n}: direct play needs no session code`);
  ok(p.run(n==='07'?'S.solo&&!!S.soloClosesAt':'S.solo&&!!S.view'),`${n}: standalone play starts`);
  const student=F.tok(n),faculty=F.tok(n,{sub:'teacher-'+n,role:'faculty',mode:'session'});
  const router=await page(n,'launch',`http://fixture/sim${n}#lt=${encodeURIComponent(student)}`);
  ok(router.redirect().includes(`/sim${n}/index.html#lt=`),`${n}: signed Play goes directly to student page`);
  const instructor=await page(n,'launch',`http://fixture/sim${n}#lt=${encodeURIComponent(faculty)}`);
  ok(instructor.redirect().includes(`/sim${n}/instructor.html#lt=`),`${n}: faculty Run a session opens console`);

  // A stale platform solo token cannot attach a later direct guest run to it.
  gate.ss.setItem(key+'-lt:solo',student);
  const clean=await page(n,'launch','',gate);
  ok(clean.ss.getItem(key+'-lt:solo')===null,`${n}: direct entry clears previous solo account token`);
  const guest=(await F.invoke(n,{action:'create',mode:'individual',facultyCode:'faculty-test'})).body.session.code;
  const jr=await F.api(n,'join',{method:'GET',query:{session:guest},headers:{}});
  ok(jr.redirect===`../index.html?session=${guest}`,`${n}: guest invitation stays on this sim`);
  p=await page(n,'index',`http://fixture/sim${n}/index.html?session=${guest}`);
  ok(p.body().includes('Join'),`${n}: guest sees join form without access code`);
  p.elements.get(n==='07'?'nm':'jn').value='Class Guest';await p.click(n==='07'?'join':'jb');
  ok(Object.keys(await F.fixtures[n].store.getParticipants(guest)).length===1,`${n}: guest joins faculty room`);
  p=await page(n,'index',`http://fixture/sim${n}/index.html?session=${guest}`,p);
  ok(p.body().includes("You're in."),`${n}: guest refresh stays in class`);

  const room=(await F.invoke(n,{action:'create',mode:'individual',launchToken:faculty})).body.session.code;
  const plain=await page(n,'index',`http://fixture/sim${n}/index.html?session=${room}`);
  ok(plain.redirect()?.includes('/api/join?session='),`${n}: unsigned platform class goes to account entry`);
  p=await page(n,'index',`http://fixture/sim${n}/index.html?session=${room}#lt=${encodeURIComponent(student)}`);
  ok(Object.keys(await F.fixtures[n].store.getParticipants(room)).includes('platform:student-'+n),`${n}: signed student auto-joins own account`);
  p=await page(n,'index',`http://fixture/sim${n}/index.html?session=${room}`,p);
  ok(!p.redirect()&&p.body().includes("You're in."),`${n}: signed token survives refresh`);
  ok(p.requests.every(x=>x.startsWith(`/sim${n}/api/`)),`${n}: all APIs use platform path prefix`);
  await F.invoke(n,{action:'control',set:'start',code:room,launchToken:faculty});await p.tick();
  if(n==='07'){
    p.run("S.choice='buy';S.text='The acquisition gives us an affordable option for a different way of doing business.'");
    await p.run('submitDecision({disabled:false})');await p.run("submitRecognition('no')");
    await F.invoke(n,{action:'control',set:'end_decisions',code:room,launchToken:faculty});F.advance(21000);
    for(const stage of [1,2,3])await F.invoke(n,{action:'control',set:'release',stage,code:room,launchToken:faculty});
  }else F.advance(1800000);
  F.fail();await p.tick();await p.retry();await p.tick();await p.retry();
  const reports=F.reports.filter(r=>r.n===n&&r.launch.sub==='student-'+n);
  ok(reports.length===1,`${n}: a failed completion callback is retried and then stops`);
  ok(reports[0].launch.course==='course-'+n,`${n}: completion belongs to correct faculty course`);
  console.log(`Sim ${n}: client flow checks passed`);
 }
 console.log(`${checks} client flow assertions passed (Node VM; no live browser)`);
})().catch(e=>{console.error(e);process.exitCode=1});
