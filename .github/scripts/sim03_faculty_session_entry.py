from pathlib import Path

INDEX = Path('sim03/public/index.html')
BUILD = Path('sim03/build.js')

h = INDEX.read_text()
old = '''  ${sessionGate()}${!S.session?'<div class="actions"><button class="btn" id="joinSessionEntry">Join a facilitated session</button></div>':''}${nav({backOk:false,disabled:blocked()})}`);
  const joinEntry=document.getElementById('joinSessionEntry');if(joinEntry)joinEntry.onclick=()=>{S.error='';renderJoin()};
  wireNav(next,false);'''
new = '''  ${sessionGate()}${!S.session?(LAUNCH&&(LAUNCH.role==='faculty'||LAUNCH.role==='faculty_preview')?'<div class="actions"><button class="btn" id="runSessionEntry">Run a facilitated session</button></div>':'<div class="actions"><button class="btn" id="joinSessionEntry">Join a facilitated session</button></div>'):''}${nav({backOk:false,disabled:blocked()})}`);
  const runEntry=document.getElementById('runSessionEntry');if(runEntry)runEntry.onclick=()=>location.assign(BASE+'/instructor.html#lt='+encodeURIComponent(LAUNCH_TOKEN));
  const joinEntry=document.getElementById('joinSessionEntry');if(joinEntry)joinEntry.onclick=()=>{S.error='';renderJoin()};
  wireNav(next,false);'''
if old not in h:
    raise SystemExit('renderBrief session-entry anchor not found')
h = h.replace(old, new, 1)
INDEX.write_text(h)

b = BUILD.read_text()
anchor = "if (!index.includes('Join a facilitated session')) refuse('team/conformance student marker missing: Join a facilitated session');"
if anchor in b:
    insert = anchor + "\nfor (const marker of ['runSessionEntry','Run a facilitated session',\"BASE+'/instructor.html#lt='\",\"LAUNCH.role==='faculty'\"]) if (!index.includes(marker)) refuse('faculty session-entry marker missing: ' + marker);"
    b = b.replace(anchor, insert, 1)
else:
    anchor2 = "for (const marker of [\n  'Join a facilitated session', 'Team name <span'"
    if anchor2 not in b:
        raise SystemExit('build guard anchor not found')
    b = b.replace(anchor2, "for (const marker of ['runSessionEntry','Run a facilitated session',\"BASE+'/instructor.html#lt='\",\"LAUNCH.role==='faculty'\"]) if (!index.includes(marker)) refuse('faculty session-entry marker missing: ' + marker);\nfor (const marker of [\n  'Join a facilitated session', 'Team name <span'", 1)
BUILD.write_text(b)
