from pathlib import Path

INSTRUCTOR = Path('sim03/public/instructor.html')
LAUNCHER = Path('sim03/public/launch.html')
INDEX = Path('sim03/public/index.html')
AUTH_TEST = Path('sim03/tools/session-auth-check.js')
BUILD = Path('sim03/build.js')


def once(text, old, new, label):
    if old not in text:
        raise SystemExit(f'missing anchor: {label}')
    return text.replace(old, new, 1)

# Instructor: keep the signed faculty launch token in tab-scoped sessionStorage.
# instructor.html intentionally removes the token from the URL, but previously
# did not persist it first, so a refresh lost faculty authorization and create
# returned faculty_authorization_required.
h = INSTRUCTOR.read_text()
h = once(
    h,
    "const BASE=(location.pathname.match(/^\\/sim-?\\d+/)||[''])[0];let LT=(location.hash+location.search).match(/lt=([^&]+)/);LT=LT?decodeURIComponent(LT[1]):null;if(LT){let p=new URLSearchParams(location.search);p.delete('lt');history.replaceState(null,'',location.pathname+(p.toString()?'?'+p:''))}",
    """const BASE=(location.pathname.match(/^\\/sim-?\\d+/)||[''])[0];
const FACULTY_TOKEN_KEY='m03-faculty-lt';
const incomingLTMatch=(location.hash+location.search).match(/lt=([^&]+)/);
const incomingLT=incomingLTMatch?decodeURIComponent(incomingLTMatch[1]):null;
let LT=incomingLT||sessionStorage.getItem(FACULTY_TOKEN_KEY)||null;
if(incomingLT)sessionStorage.setItem(FACULTY_TOKEN_KEY,incomingLT);
if(incomingLT){let p=new URLSearchParams(location.search);p.delete('lt');history.replaceState(null,'',location.pathname+(p.toString()?'?'+p:''))}""",
    'instructor launch token bootstrap'
)
h = once(
    h,
    "async function api(x){const h={'Content-Type':'application/json'};if(LT)h['x-launch-token']=LT;const r=await fetch(BASE+'/api/session',{method:'POST',headers:h,body:JSON.stringify({...x,facultyCode,launchToken:LT})});let d={};try{d=await r.json()}catch{}if(!r.ok)throw new Error(d.message||d.error||`Server error ${r.status}`);return d}",
    """async function api(x){const h={'Content-Type':'application/json'};if(LT)h['x-launch-token']=LT;const r=await fetch(BASE+'/api/session',{method:'POST',headers:h,body:JSON.stringify({...x,facultyCode,launchToken:LT})});let d={};try{d=await r.json()}catch{}if(!r.ok){if(d.error==='faculty_authorization_required'&&LT){sessionStorage.removeItem(FACULTY_TOKEN_KEY);LT=null;throw new Error('Your faculty authorization has expired. Return to RapidSims and click Run a session again.')}throw new Error(d.message||d.error||`Server error ${r.status}`)}return d}""",
    'instructor api auth failure handling'
)
old_create = "function createView(){app.innerHTML=`<div class=\"ey\">New facilitated session</div><h2>Choose how this room will play.</h2><p class=\"lede\">Individual and team are both first-class modes. There is deliberately no default.</p>${error?notice(error,true):''}<div class=\"grid\"><section class=\"card\"><h3>Session</h3><div class=\"field\"><label>Class / session name</label><input id=\"name\" value=\"Midland Equipment\"></div><div class=\"field\"><label>Play mode — required</label><div class=\"modes\"><div class=\"mode ${mode==='individual'?'on':''}\" data-mode=\"individual\"><b>Individual</b><span>Every student commits a portfolio.</span></div><div class=\"mode ${mode==='team'?'on':''}\" data-mode=\"team\"><b>Team</b><span>Students name teams; one captain commits the shared decisions.</span></div></div></div><div class=\"field\"><label>Facilitator code, if required</label><input id=\"fc\" type=\"password\"></div><div class=\"actions\"><button class=\"btn pri\" id=\"create\" ${mode?'':'disabled'}>Create session</button></div><div class=\"field\"><label>Resume session code</label><input id=\"resumeCode\" maxlength=\"5\" value=\"${esc(savedCode)}\" placeholder=\"ABCDE\"></div><div class=\"actions\"><button class=\"btn\" id=\"resumeBtn\">Resume session</button></div></section><section class=\"card\"><h3>Instructor surface</h3><p>Join code, teams, captains, calibration, live progress, Year 1 distributions, Year 3 bands, Connect vs Uptime, anonymous contrasting runs, opening views and CSV export.</p>${notice(mode==='team'?'Students name their own teams when they join. You can move anyone or hand off captaincy at any time.':'Thresholds can change while this session is in the lobby. They lock when play starts.')}</section></div>`;document.querySelectorAll('[data-mode]').forEach(x=>x.onclick=()=>{mode=x.dataset.mode;render()});document.getElementById('create').onclick=create;document.getElementById('resumeBtn').onclick=resumeSession}"
new_create = "function createView(){app.innerHTML=`<div class=\"ey\">New facilitated session</div><h2>Choose how this room will play.</h2><p class=\"lede\">Individual and team are both first-class modes. There is deliberately no default.</p>${error?notice(error,true):''}<div class=\"grid\"><section class=\"card\"><h3>Session</h3><div class=\"field\"><label>Class / session name</label><input id=\"name\" value=\"Midland Equipment\"></div><div class=\"field\"><label>Play mode — required</label><div class=\"modes\"><div class=\"mode ${mode==='individual'?'on':''}\" data-mode=\"individual\"><b>Individual</b><span>Every student commits a portfolio.</span></div><div class=\"mode ${mode==='team'?'on':''}\" data-mode=\"team\"><b>Team</b><span>Students name teams; one captain commits the shared decisions.</span></div></div></div>${LT?notice('Faculty authorization received from RapidSims.'):'<div class=\"field\"><label>Facilitator code, if required</label><input id=\"fc\" type=\"password\"></div>'}<div class=\"actions\"><button class=\"btn pri\" id=\"create\" ${mode?'':'disabled'}>Create session</button></div><div class=\"field\"><label>Resume session code</label><input id=\"resumeCode\" maxlength=\"5\" value=\"${esc(savedCode)}\" placeholder=\"ABCDE\"></div><div class=\"actions\"><button class=\"btn\" id=\"resumeBtn\">Resume session</button></div></section><section class=\"card\"><h3>Instructor surface</h3><p>Join code, teams, captains, calibration, live progress, Year 1 distributions, Year 3 bands, Connect vs Uptime, anonymous contrasting runs, opening views and CSV export.</p>${notice(mode==='team'?'Students name their own teams when they join. You can move anyone or hand off captaincy at any time.':'Thresholds can change while this session is in the lobby. They lock when play starts.')}</section></div>`;document.querySelectorAll('[data-mode]').forEach(x=>x.onclick=()=>{mode=x.dataset.mode;render()});document.getElementById('create').onclick=create;document.getElementById('resumeBtn').onclick=resumeSession}"
h = once(h, old_create, new_create, 'instructor create view')
h = once(
    h,
    "async function create(){facultyCode=document.getElementById('fc').value.trim();try{let d=await api({action:'create',name:document.getElementById('name').value.trim(),mode});",
    "async function create(){facultyCode=document.getElementById('fc')?.value.trim()||'';try{let d=await api({action:'create',name:document.getElementById('name').value.trim(),mode});",
    'instructor create optional faculty code'
)
INSTRUCTOR.write_text(h)

# Launch router: persist the platform faculty token before redirecting to the
# instructor page, so even an intervening reload does not discard authorization.
l = LAUNCHER.read_text()
l = once(
    l,
    "const faculty=launch&&(launch.role==='faculty'||launch.role==='faculty_preview')&&launch.mode==='session';\nconst params=",
    "const faculty=launch&&(launch.role==='faculty'||launch.role==='faculty_preview')&&launch.mode==='session';\nif(faculty&&token)sessionStorage.setItem('m03-faculty-lt',token);\nconst params=",
    'launch router faculty token persistence'
)
LAUNCHER.write_text(l)

# Student/faculty play surface: when a faculty token exists, retain it in this
# tab before offering the Run a facilitated session transition.
i = INDEX.read_text()
i = once(
    i,
    "if(LAUNCH_TOKEN){try{LAUNCH=JSON.parse(atob(LAUNCH_TOKEN.split('.')[0].replace(/-/g,'+').replace(/_/g,'/')))}catch{}}\nconst initialParams=",
    "if(LAUNCH_TOKEN){try{LAUNCH=JSON.parse(atob(LAUNCH_TOKEN.split('.')[0].replace(/-/g,'+').replace(/_/g,'/')))}catch{}}\nif(LAUNCH_TOKEN&&LAUNCH&&(LAUNCH.role==='faculty'||LAUNCH.role==='faculty_preview'))sessionStorage.setItem('m03-faculty-lt',LAUNCH_TOKEN);\nconst initialParams=",
    'index faculty token persistence'
)
INDEX.write_text(i)

# Authorization regression: use the platform's real launchToken implementation
# and prove the Sim03 session handler accepts a Team session without FACULTY_CODE.
t = AUTH_TEST.read_text()
t = once(
    t,
    "const handler = require('../api/session.js');\n",
    "const handler = require('../api/session.js');\nconst { launchToken } = require('../../platform/lib/launch.js');\n",
    'auth test platform launch import'
)
anchor = "    assert.equal(r.body.error, 'faculty_authorization_required');\n\n    process.env.FACULTY_CODES = 'Instructor:faculty-secret';"
insert = """    assert.equal(r.body.error, 'faculty_authorization_required');

    process.env.LAUNCH_SECRET = 'shared-test-secret';
    const token = launchToken({
      userId: 'faculty-1', name: 'Instructor', role: 'faculty',
      simId: 'rapid-03-midland', mode: 'session', minutes: 60
    });
    r = await invoke({ action: 'create', name: 'Platform team smoke', mode: 'team' }, { 'x-launch-token': token });
    assert.equal(r.status, 200, 'signed platform faculty token should create a team session');
    assert.equal(r.body.session.mode, 'team');
    r = await invoke({ action: 'create', name: 'Platform body-token smoke', mode: 'team', launchToken: token });
    assert.equal(r.status, 200, 'instructor body fallback should accept the same signed token');
    assert.equal(r.body.session.mode, 'team');

    delete process.env.LAUNCH_SECRET;
    process.env.FACULTY_CODES = 'Instructor:faculty-secret';"""
t = once(t, anchor, insert, 'auth test signed platform token cases')
AUTH_TEST.write_text(t)

# Build guards lock in the browser-side persistence and user-facing state.
b = BUILD.read_text()
anchor = "for (const marker of ['Resume session code','Students self-select teams at join',\"action:'set_captain'\",'function startPresent()','dotcount','the annual cap is the wall'])"
replacement = "for (const marker of ['m03-faculty-lt','Faculty authorization received from RapidSims.','Your faculty authorization has expired. Return to RapidSims and click Run a session again.']) if (!instructor.includes(marker)) refuse('faculty authorization persistence marker missing: ' + marker);\nif (!launcher.includes(\"sessionStorage.setItem('m03-faculty-lt',token)\")) refuse('launch router does not persist faculty authorization');\nif (!index.includes(\"sessionStorage.setItem('m03-faculty-lt',LAUNCH_TOKEN)\")) refuse('faculty play surface does not persist faculty authorization');\n" + anchor
b = once(b, anchor, replacement, 'build faculty auth persistence guards')
BUILD.write_text(b)
