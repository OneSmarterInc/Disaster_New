from pathlib import Path
import json

# Route the canonical platform entry points to the access gate explicitly.
p = Path('platform/vercel.json')
j = json.loads(p.read_text())
for r in j.get('rewrites', []):
    if r.get('source') in ('/sim03', '/sim03/'):
        r['destination'] = 'https://sim-03-midland.vercel.app/launch.html'
p.write_text(json.dumps(j, indent=2) + '\n')

# A direct/stale visit to index.html must never bounce back automatically.
p = Path('sim03/public/index.html')
s = p.read_text()
old = """  catch(e){
    if(e.code==='access_code_required'&&!LAUNCH_TOKEN){sessionStorage.removeItem('m03-access');location.replace(BASE+'/');return}
    app.innerHTML=`<main class=\"page\">${notice(e.message,true)}<div class=\"actions\"><button class=\"btn pri\" onclick=\"location.reload()\">Try again</button></div></main>`;
    return;
  }"""
new = """  catch(e){
    if(e.code==='access_code_required'&&!LAUNCH_TOKEN){
      sessionStorage.removeItem('m03-access');
      app.innerHTML=`<main class=\"page\">${notice('An access code is required to open Midland Equipment.',true)}<div class=\"actions\"><button class=\"btn pri\" id=\"accessBtn\">Enter access code</button></div></main>`;
      document.getElementById('accessBtn').onclick=()=>location.assign(BASE+'/');
      return;
    }
    app.innerHTML=`<main class=\"page\">${notice(e.message,true)}<div class=\"actions\"><button class=\"btn pri\" onclick=\"location.reload()\">Try again</button></div></main>`;
    return;
  }"""
if old in s:
    s = s.replace(old, new, 1)
elif new not in s:
    raise SystemExit('index access catch marker missing')
p.write_text(s)

# Make the platform integration test enforce the access gate routing.
p = Path('platform/tools/check-sim03-integration.js')
s = p.read_text()
s = s.replace("assert.equal(rewrites['/sim03'], 'https://sim-03-midland.vercel.app/');", "assert.equal(rewrites['/sim03'], 'https://sim-03-midland.vercel.app/launch.html');")
s = s.replace("assert.equal(rewrites['/sim03/'], 'https://sim-03-midland.vercel.app/');", "assert.equal(rewrites['/sim03/'], 'https://sim-03-midland.vercel.app/launch.html');")
p.write_text(s)

# Refuse future redirect-loop regressions in the Sim03 build.
p = Path('sim03/build.js')
s = p.read_text()
anchor = "if (!configApi.includes('checkAccess(req, res)')) {\n  refuse('public config bootstrap is not protected by the shared access guard');\n}\n"
extra = anchor + "if (index.includes(\"location.replace(BASE+'/')\")) {\n  refuse('student access failure automatically redirects to the gate and can loop');\n}\nif (!index.includes('Enter access code')) {\n  refuse('student access failure does not offer a stable manual return to the gate');\n}\n"
if "student access failure automatically redirects" not in s:
    if anchor not in s:
        raise SystemExit('build access guard anchor missing')
    s = s.replace(anchor, extra, 1)
p.write_text(s)
