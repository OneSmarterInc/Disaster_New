from pathlib import Path

INDEX = Path('sim03/public/index.html')
INSTRUCTOR = Path('sim03/public/instructor.html')
ACCOUNT_TEST = Path('platform/tools/sim03-account-entry-browser-check.js')


def replace_once(text, old, new, label):
    if old not in text:
        raise SystemExit(f'missing anchor: {label}')
    return text.replace(old, new, 1)

# 1) When faculty start a facilitated session from inside Midland, go back
# through the platform launch endpoint. That mints a fresh signed session-mode
# token from the faculty's authenticated RapidSims session instead of reusing
# the play token that happened to open this page.
h = INDEX.read_text()
old = "  const runEntry=document.getElementById('runSessionEntry');if(runEntry)runEntry.onclick=()=>location.assign(BASE+'/instructor.html#lt='+encodeURIComponent(LAUNCH_TOKEN));"
new = """  const runEntry=document.getElementById('runSessionEntry');if(runEntry)runEntry.onclick=()=>{\n    const platform=(C?.platformUrl||'https://rapidsims.flexee.org').replace(/\\/$/,'');\n    const q=new URLSearchParams({sim:C?.meta?.id||'rapid-03-midland',mode:'session'});\n    if(LAUNCH?.course)q.set('course',LAUNCH.course);\n    location.assign(platform+'/api/launch?'+q.toString());\n  };"""
h = replace_once(h, old, new, 'faculty Run a facilitated session click')
INDEX.write_text(h)

# 2) Never let the instructor surface issue an unauthenticated create request.
# Platform-launched faculty have LT and need no code; standalone faculty may
# type their configured facilitator code. A direct/stale instructor URL now
# explains the recovery path instead of showing the raw backend error.
i = INSTRUCTOR.read_text()
old = "async function api(x){const h={'Content-Type':'application/json'};if(LT)h['x-launch-token']=LT;const r=await fetch(BASE+'/api/session',{method:'POST',headers:h,body:JSON.stringify({...x,facultyCode,launchToken:LT})});let d={};try{d=await r.json()}catch{}if(!r.ok){if(d.error==='faculty_authorization_required'&&LT){sessionStorage.removeItem(FACULTY_TOKEN_KEY);LT=null;throw new Error('Your faculty authorization has expired. Return to RapidSims and click Run a session again.')}throw new Error(d.message||d.error||`Server error ${r.status}`)}return d}"
new = """function facultyAuthorizationMessage(){return 'Faculty authorization is required. Return to RapidSims, open your course, and choose Run a session. If this is a standalone deployment, enter its configured facilitator code.'}\nasync function api(x){const h={'Content-Type':'application/json'};if(LT)h['x-launch-token']=LT;const r=await fetch(BASE+'/api/session',{method:'POST',headers:h,body:JSON.stringify({...x,facultyCode,launchToken:LT})});let d={};try{d=await r.json()}catch{}if(!r.ok){if(d.error==='faculty_authorization_required'){if(LT){sessionStorage.removeItem(FACULTY_TOKEN_KEY);LT=null;throw new Error('Your faculty authorization has expired. Return to RapidSims, open your course, and click Run a session again.')}throw new Error(facultyAuthorizationMessage())}throw new Error(d.message||d.error||`Server error ${r.status}`)}return d}"""
i = replace_once(i, old, new, 'instructor authorization error mapping')

i = replace_once(
    i,
    "${LT?notice('Faculty authorization received from RapidSims.'):'<div class=\"field\"><label>Facilitator code, if required</label><input id=\"fc\" type=\"password\"></div>'}",
    "${LT?notice('Faculty authorization received from RapidSims.'):notice('This instructor page was opened without RapidSims faculty authorization. Open Faculty → your course → Run a session, or enter the standalone facilitator code below.',true)+'<div class=\"field\"><label>Standalone facilitator code</label><input id=\"fc\" type=\"password\" value=\"'+esc(facultyCode)+'\"></div>'}",
    'instructor authorization notice'
)
i = replace_once(
    i,
    "<div class=\"actions\"><button class=\"btn pri\" id=\"create\" ${mode?'':'disabled'}>Create session</button></div>",
    "<div class=\"actions\"><button class=\"btn pri\" id=\"create\" ${mode&&(LT||facultyCode)?'':'disabled'}>Create session</button></div>",
    'create session authorization gate'
)
old = "document.querySelectorAll('[data-mode]').forEach(x=>x.onclick=()=>{mode=x.dataset.mode;render()});document.getElementById('create').onclick=create;document.getElementById('resumeBtn').onclick=resumeSession}"
new = """document.querySelectorAll('[data-mode]').forEach(x=>x.onclick=()=>{mode=x.dataset.mode;render()});const fc=document.getElementById('fc'),createBtn=document.getElementById('create');if(fc)fc.oninput=()=>{facultyCode=fc.value.trim();createBtn.disabled=!mode||!facultyCode};document.getElementById('create').onclick=create;document.getElementById('resumeBtn').onclick=resumeSession}"""
i = replace_once(i, old, new, 'facilitator code button wiring')
INSTRUCTOR.write_text(i)

# 3) Extend the real Chromium account-entry test to use the exact path that
# failed in the classroom: faculty play launch -> in-sim Run a facilitated
# session -> fresh platform session launch -> Team -> Create session.
t = ACCOUNT_TEST.read_text()
old = """  // Faculty creates exactly the Team session from the UI, then copies its link.\n  const teacher=await page('teacher');await signIn(teacher,'teacher@example.test');\n  const launched=await teacher.context().request.get(platform+'/api/launch?sim='+f.sim.id+'&course=course-a&mode=session&format=json');\n  const launchData=await launched.json();\n  equal(launched.status(),200,'faculty cookie authorizes session launch: '+JSON.stringify(launchData.error||''));\n  await teacher.goto(launchData.url);\n  await teacher.locator('[data-mode=\"team\"]').click();\n  await teacher.locator('#create').click();"""
new = """  // A direct/stale instructor URL must not be able to fire an anonymous\n  // create request. This is the screenshot failure mode we are guarding.\n  const noAuth=await page('teacher-no-auth');\n  await noAuth.goto(platform+'/sim03/instructor.html');\n  await noAuth.locator('[data-mode=\"team\"]').click();\n  equal(await noAuth.locator('#create').isDisabled(),true,'direct instructor page cannot create without faculty authorization');\n  equal((await noAuth.locator('body').innerText()).includes('opened without RapidSims faculty authorization'),true,'direct instructor page explains how to recover');\n\n  // Exercise the exact real user path: faculty first opens Midland as a normal\n  // play launch, then clicks Run a facilitated session inside the simulation.\n  // That click must return through the platform to mint a fresh session-mode\n  // token before the instructor creates a Team session.\n  const teacher=await page('teacher');await signIn(teacher,'teacher@example.test');\n  const playLaunch=await teacher.context().request.get(platform+'/api/launch?sim='+f.sim.id+'&course=course-a&format=json');\n  const playData=await playLaunch.json();\n  equal(playLaunch.status(),200,'faculty cookie authorizes ordinary Midland launch: '+JSON.stringify(playData.error||''));\n  await teacher.goto(playData.url);\n  await teacher.locator('#runSessionEntry').click();\n  await teacher.locator('[data-mode=\"team\"]').waitFor();\n  equal(new URL(teacher.url()).pathname.endsWith('/instructor.html'),true,'in-sim Run a facilitated session reaches instructor surface');\n  equal(await teacher.locator('#fc').count(),0,'fresh platform session launch carries faculty authorization');\n  equal((await teacher.locator('body').innerText()).includes('faculty_authorization_required'),false,'raw faculty authorization error is not shown');\n  await teacher.locator('[data-mode=\"team\"]').click();\n  await teacher.locator('#create').click();"""
t = replace_once(t, old, new, 'account browser faculty launch flow')
ACCOUNT_TEST.write_text(t)

print('Applied production faculty reauthorization hardening.')
