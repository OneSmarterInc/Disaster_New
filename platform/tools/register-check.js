#!/usr/bin/env node
// A simulation announces itself and appears in the catalogue, unpublished. On
// any later announcement only its address and duration are refreshed — an
// administrator's wording must survive a redeploy.
// facts refreshed, never an administrator's words.
const path=require('path');
const P = (x) => path.join(__dirname, '../..', x);
process.env.LAUNCH_SECRET = 'shared';
const DB = { sims: [] };
require.cache[require.resolve(P('platform/lib/db.js'))] = { exports: {
  sql: () => (strings, ...v) => {
    const q = strings.join('?').replace(/\s+/g,' ').trim();
    if (q.startsWith('SELECT * FROM sims WHERE id')) return Promise.resolve(DB.sims.filter(s=>s.id===v[0]));
    if (q.includes('number IS NOT NULL')) return Promise.resolve(DB.sims.filter(s=>s.number));
    if (q.startsWith('INSERT INTO sims')) { DB.sims.push({ id:v[0],number:v[1],title:v[2],tagline:v[3],description:v[4],minutes:v[5],launch_url:v[6],published:v[7] }); return Promise.resolve([]); }
    if (q.startsWith('UPDATE sims SET launch_url')) { DB.sims.find(s=>s.id===v[1]).launch_url=v[0]; return Promise.resolve([]); }
    if (q.startsWith('UPDATE sims SET minutes')) { DB.sims.find(s=>s.id===v[1]).minutes=v[0]; return Promise.resolve([]); }
    if (q.startsWith('UPDATE sims SET tagline')) { DB.sims.find(s=>s.id===v[1]).tagline=v[0]; return Promise.resolve([]); }
    if (q.startsWith('UPDATE sims SET description')) { DB.sims.find(s=>s.id===v[1]).description=v[0]; return Promise.resolve([]); }
    return Promise.resolve([]);
  }, id: p=>p+'_1', joinCode:()=>'X' }};
const h = require(P('platform/api/register.js'));
const { signBack } = require(P('sim/lib/launch.js'));
const call = b => new Promise(res => {
  const r={_c:200,status(c){this._c=c;return this;},json(d){res({status:this._c,body:d});},setHeader(){},end(){res({status:this._c});}};
  h({method:'POST',body:b,headers:{}},r);
});
const announce = (o) => signBack(Object.assign({ kind:'register', exp: Date.now()+60000 }, o));

(async () => {
  let r = await call({ token: announce({ sim:'rapid-01-disaster', title:'Disaster or Breach?',
    tagline:'From the sim.', description:'Written by the developer.', minutes:20, launchUrl:'https://sim1.test' }) });
  console.log('  first announcement      :', r.status, '| created', r.body.created, '| number', r.body.number);
  console.log('    published on arrival  :', DB.sims[0].published, '(must be false)');

  r = await call({ token: announce({ sim:'rapid-02-relay', title:'What Did It Tell Them?', minutes:20, launchUrl:'https://sim2.test' }) });
  console.log('  a second simulation     :', r.status, '| number', r.body.number);

  // an administrator rewrites the words
  DB.sims[0].title = 'Disaster or Breach? (exec)';
  DB.sims[0].tagline = 'Rewritten by the administrator.';
  DB.sims[0].published = true;

  r = await call({ token: announce({ sim:'rapid-01-disaster', title:'Disaster or Breach?',
    tagline:'From the sim.', description:'Written by the developer.', minutes:25, launchUrl:'https://sim1-new.test' }) });
  console.log('  announcing again        :', r.status, '| created', r.body.created);
  console.log('    title kept            :', DB.sims[0].title);
  console.log('    tagline kept          :', DB.sims[0].tagline);
  console.log('    address refreshed     :', DB.sims[0].launch_url);
  console.log('    duration refreshed    :', DB.sims[0].minutes);
  console.log('    still published       :', DB.sims[0].published);

  r = await call({ token: 'forged.nonsense' });
  console.log('  forged                  :', r.status, r.body.error);
  r = await call({ token: announce({ sim:'x', launchUrl:'not-a-url' }) });
  console.log('  no real address         :', r.status, r.body.error);
})();
