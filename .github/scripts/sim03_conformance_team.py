from pathlib import Path
import re

# One-time patcher; deleted before merge.

p = Path('sim03/lib/scenario.js')
s = p.read_text()
old = """  // The authored build spec has no row for Connect >= strong with Capacity below
  // the strong capacity requirement. Keep this explicit until content is authored.
  return {
    band: 'unresolved_calibration',
    title: 'The CEO wants AI failure prediction',
    narrative:
      'This portfolio reaches a combination the authored calibration does not yet define. ' +
      'The instructor view flags it for resolution rather than inventing an outcome.',
    cumulative: c
  };
"""
new = """  // The authored build spec has no row for Connect >= strong with Capacity below
  // the strong capacity requirement. Students must never see development
  // scaffolding, so use the nearest authored non-success narrative while
  // retaining a separate calibrationGap flag for the instructor console.
  return {
    band: 'pilot',
    calibrationGap: true,
    internalBand: 'unresolved_calibration',
    title: 'The CEO wants AI failure prediction',
    narrative: COPY.year3.pilot,
    cumulative: c
  };
"""
if old not in s: raise SystemExit('scenario unresolved Year 3 block not found')
s = s.replace(old, new, 1)
p.write_text(s)

p = Path('sim03/api/health.js')
s = p.read_text().replace("accessCode: process.env.ACCESS_CODE ? 'configured' : 'not set (open)',", "accessCode: process.env.ACCESS_CODE ? 'configured' : 'not set (standalone access closed)',")
p.write_text(s)

p = Path('sim03/api/session.js')
s = p.read_text()
s = s.replace("""    reflection2: run.reflection2 || '',
    outcomes: run.outcomes || null,
    done: !!run.done,
""", """    reflection2: run.reflection2 || '',
    outcomes: run.outcomes || null,
    done: !!run.done,
    finishedBy: run.finishedBy || {},
""", 1)
s = s.replace("""        if (sess.mode !== 'team') return res.status(409).json({ error: 'not_team_mode' });
        if (sess.state !== 'lobby') {
          return res.status(409).json({ error: 'session_already_started', message: 'Team assignments lock when the session starts.' });
        }

        const participants = await store.getParticipants(code);
""", """        if (sess.mode !== 'team') return res.status(409).json({ error: 'not_team_mode' });

        const participants = await store.getParticipants(code);
""", 1)
s = s.replace("""          const gid = String(rawAssign[p.id] || '').trim().slice(0, 40);
          p.groupId = gid || null;
""", """          const label = String(rawAssign[p.id] || '').trim().slice(0, 40);
          const norm = label.toLowerCase().replace(/\\s+/g, '-').replace(/[^a-z0-9_-]/g, '');
          p.groupId = norm ? `team:${norm}` : `solo:${p.id}`;
          p.teamLabel = label || p.name;
""", 1)
marker = """      case 'control': {
"""
insert = """      case 'set_captain': {
        const who = whoIsFaculty(req, b);
        if (!who) return res.status(401).json({ error: 'faculty_authorization_required' });
        const sess = await store.getSession(code);
        if (!sess) return res.status(404).json({ error: 'no_such_session' });
        if (!ownsSession(who, sess)) return res.status(403).json({ error: 'not_your_session' });
        if (sess.mode !== 'team') return res.status(409).json({ error: 'not_team_mode' });
        const participants = await store.getParticipants(code);
        const pid = String(b.participantId || '');
        const chosen = participants[pid];
        if (!chosen || !chosen.groupId) return res.status(404).json({ error: 'no_such_participant' });
        for (const p of Object.values(participants)) {
          if (!p || p.groupId !== chosen.groupId) continue;
          p.isCaptain = p.id === pid;
          await store.setParticipant(code, p.id, p);
        }
        return res.status(200).json({ ok: true, groupId: chosen.groupId, captainId: pid });
      }

"""
if marker not in s: raise SystemExit('control marker missing')
s = s.replace(marker, insert + marker, 1)
join_start = s.index("      case 'join': {")
join_end = s.index("      case 'state': {", join_start)
new_join = """      case 'join': {
        const sess = await store.getSession(code);
        if (!sess) return res.status(404).json({ error: 'no_such_session' });
        if (sess.state === 'closed') return res.status(410).json({ error: 'session_closed' });

        const name = String(b.name || '').slice(0, 60).trim();
        if (!name) return res.status(400).json({ error: 'name_required' });
        const all = await store.getParticipants(code);
        const key = x => String(x || '').trim().toLowerCase();
        const lt = req.headers['x-launch-token'] || b.launchToken;
        const launched = lt ? verifyLaunch(String(lt)) : null;
        let id = String(b.participantId || '').trim();
        if (!id && launched && launched.sub) id = `platform:${launched.sub}`;
        if (!id || !all[id]) {
          const match = Object.values(all).find(p => p && key(p.name) === key(name));
          id = match ? match.id : (id || newId());
        }
        const existing = all[id];

        let groupId = existing ? existing.groupId : null;
        let teamLabel = existing ? (existing.teamLabel || existing.name) : '';
        if (sess.mode === 'individual') {
          groupId = `individual:${id}`;
          teamLabel = name;
        } else if (!groupId) {
          const asked = String(b.teamName || '').trim().slice(0, 40);
          const norm = key(asked).replace(/\\s+/g, '-').replace(/[^a-z0-9_-]/g, '');
          groupId = norm ? `team:${norm}` : `solo:${id}`;
          teamLabel = asked || name;
        }

        const members = Object.values(all).filter(p => p && p.groupId === groupId);
        const participant = {
          id,
          name,
          groupId,
          teamLabel,
          isCaptain: existing ? !!existing.isCaptain
            : (sess.mode === 'individual' || !members.some(m => m.isCaptain)),
          joinedAt: existing ? existing.joinedAt : Date.now()
        };
        await store.addParticipant(code, id, participant);
        return res.status(200).json({ participantId: id, session: publicSession(sess), me: participant });
      }

"""
s = s[:join_start] + new_join + s[join_end:]
s = s.replace("""        if (b.set === 'start') {
          if (sess.mode === 'team') {
            const participants = await store.getParticipants(code);
            const unassigned = Object.values(participants).filter(p => p && !p.groupId);
            if (unassigned.length) {
              return res.status(409).json({
                error: 'unassigned_participants',
                count: unassigned.length,
                message: 'Every participant must be assigned to a team before starting.'
              });
            }
          }
          sess.state = 'running';
""", """        if (b.set === 'start') {
          sess.state = 'running';
""", 1)
state_old = """        const runs = await store.getRuns(code);
        const rid = runIdFor(sess, me);
        return res.status(200).json({
          session: publicSession(sess),
          me,
          mates,
          canSubmit: sess.mode === 'individual' || !!me.isCaptain,
          run: publicRun(rid ? runs[rid] : null)
        });
"""
state_new = """        const runs = await store.getRuns(code);
        const rid = runIdFor(sess, me);
        const rawRun = rid ? runs[rid] : null;
        const run = publicRun(rawRun);
        if (run && rawRun && rawRun.reflections && rawRun.reflections[pid]) {
          run.reflection1 = rawRun.reflections[pid].reflection1 || '';
          run.reflection2 = rawRun.reflections[pid].reflection2 || '';
        }
        if (run && sess.mode === 'team') run.done = !!(rawRun && rawRun.finishedBy && rawRun.finishedBy[pid]);
        return res.status(200).json({
          session: publicSession(sess),
          me,
          mates,
          canSubmit: sess.mode === 'individual' || !!me.isCaptain,
          run
        });
"""
if state_old not in s: raise SystemExit('state response block missing')
s = s.replace(state_old, state_new, 1)
s = s.replace("""        if (sess.mode === 'team' && !me.groupId) return res.status(409).json({ error: 'team_not_assigned' });
        if (sess.mode === 'team' && !me.isCaptain) return res.status(403).json({ error: 'captain_only' });

        const rid = runIdFor(sess, me);
        const runs = await store.getRuns(code);
        const current = runs[rid] || { runId: rid, phase: 0, done: false, createdAt: Date.now() };
        if (current.done) return res.status(409).json({ error: 'run_already_completed' });

        const next = { ...current };
""", """        if (sess.mode === 'team' && !me.groupId) return res.status(409).json({ error: 'team_not_assigned' });
        const wantsSharedDecision = b.strategicView !== undefined || b.year1 !== undefined || b.year2 !== undefined;
        if (sess.mode === 'team' && wantsSharedDecision && !me.isCaptain) {
          return res.status(403).json({ error: 'captain_only' });
        }

        const rid = runIdFor(sess, me);
        const runs = await store.getRuns(code);
        const current = runs[rid] || { runId: rid, phase: 0, done: false, createdAt: Date.now() };
        if (current.done && (wantsSharedDecision || sess.mode === 'individual')) {
          return res.status(409).json({ error: 'run_already_completed' });
        }

        const next = { ...current };
""", 1)
s = s.replace("""        if (b.reflection1 !== undefined) next.reflection1 = String(b.reflection1 || '').slice(0, 1500);
        if (b.reflection2 !== undefined) next.reflection2 = String(b.reflection2 || '').slice(0, 1500);

        if (next.year1 && next.year2) {
""", """        if (b.reflection1 !== undefined || b.reflection2 !== undefined) {
          const map = { ...(current.reflections || {}) };
          const mine = map[pid] || {};
          map[pid] = {
            participantId: pid,
            name: me.name,
            reflection1: b.reflection1 !== undefined ? String(b.reflection1 || '').slice(0, 1500) : (mine.reflection1 || ''),
            reflection2: b.reflection2 !== undefined ? String(b.reflection2 || '').slice(0, 1500) : (mine.reflection2 || ''),
            at: Date.now()
          };
          next.reflections = map;
          if (sess.mode === 'individual' || me.isCaptain) {
            next.reflection1 = map[pid].reflection1;
            next.reflection2 = map[pid].reflection2;
          }
        }

        if (next.year1 && next.year2) {
""", 1)
s = s.replace("""        if (b.done) {
          if (!next.year1 || !next.year2) return res.status(409).json({ error: 'allocations_incomplete' });
          next.done = true;
          next.phase = 3;
          next.completedAt = Date.now();
        }
""", """        if (b.done) {
          if (!next.year1 || !next.year2) return res.status(409).json({ error: 'allocations_incomplete' });
          if (sess.mode === 'team') {
            next.finishedBy = { ...(current.finishedBy || {}), [pid]: Date.now() };
            const members = Object.values(participants).filter(p => p && p.groupId === rid);
            next.done = members.length > 0 && members.every(m => next.finishedBy[m.id]);
          } else {
            next.done = true;
          }
          next.phase = 3;
          if (next.done) next.completedAt = Date.now();
        }
""", 1)
p.write_text(s)

p = Path('sim03/api/finish.js')
s = p.read_text().replace("""  return { sess, run };
""", """  return { sess, run, participants, me, rid, code, pid };
""", 1)
s = s.replace("""      summary = {
        strategicView: sr.run.strategicView || '',
        year1: y1,
        year2: y2,
        reflection1: sr.run.reflection1 || '',
        reflection2: sr.run.reflection2 || '',
        year3Band: outcomes.year3.band
      };
""", """      const reflection1 = String(b.reflection1 || '').slice(0, 1500);
      const reflection2 = String(b.reflection2 || '').slice(0, 1500);
      const reflections = { ...(sr.run.reflections || {}) };
      reflections[sr.pid] = { participantId: sr.pid, name: sr.me.name, reflection1, reflection2, at: Date.now() };
      const finishedBy = { ...(sr.run.finishedBy || {}), [sr.pid]: Date.now() };
      const members = Object.values(sr.participants).filter(p => p && p.groupId === sr.rid);
      const allDone = sr.sess.mode === 'individual' || (members.length > 0 && members.every(m => finishedBy[m.id]));
      const updated = { ...sr.run, reflections, finishedBy, done: allDone, phase: 3, updatedAt: Date.now() };
      if (allDone) updated.completedAt = Date.now();
      if (sr.sess.mode === 'individual' || sr.me.isCaptain) {
        updated.reflection1 = reflection1;
        updated.reflection2 = reflection2;
      }
      await store.setRun(sr.code, sr.rid, updated);
      summary = {
        strategicView: sr.run.strategicView || '',
        year1: y1,
        year2: y2,
        reflection1,
        reflection2,
        year3Band: outcomes.year3.band
      };
""", 1)
p.write_text(s)

p = Path('sim03/public/index.html')
s = p.read_text()
s = s.replace("""  const pills=STEPS.map((x,i)=>`<span class=\"pill ${i===S.step?'on':i<S.step?'done':''}\">${i+1}. ${x}</span>`).join('');
""", """  const visibleSteps=STEPS.map((x,i)=>({x,i})).filter(o=>C?.buyers?.authored!==false||o.i!==8);
  const pills=visibleSteps.map((o,j)=>`<span class=\"pill ${o.i===S.step?'on':o.i<S.step?'done':''}\">${j+1}. ${o.x}</span>`).join('');
""", 1)
s = s.replace("""function next(){S.step=Math.min(9,S.step+1);render()}
function back(){S.step=Math.max(0,S.step-1);render()}
""", """function next(){let n=Math.min(9,S.step+1);if(n===8&&C?.buyers?.authored===false)n=9;S.step=n;render()}
function back(){let n=Math.max(0,S.step-1);if(n===8&&C?.buyers?.authored===false)n=7;S.step=n;render()}
function safeToRerender(){const el=document.activeElement;return !el||!['INPUT','TEXTAREA','SELECT'].includes(el.tagName)}
""", 1)
s = s.replace("""  const mode=S.session.mode==='team'?'Team':'Individual';
  const mate=S.session.mode==='team'&&S.mates.length?` · ${S.mates.map(x=>esc(x.name)+(x.isCaptain?' (captain)':'')).join(', ')}`:'';
  const control=S.session.mode==='team'&&!S.canSubmit?'Your team captain commits. Your screen follows the submitted team state.':'You can commit this run.';
  return `<div class=\"team\"><b>${mode} session ${esc(S.session.code)}</b>${mate}<br>${esc(control)}</div>`;
""", """  const mode=S.session.mode==='team'?'Team':'Individual';
  if(S.session.mode!=='team')return `<div class=\"team\"><b>${mode} session ${esc(S.session.code)}</b><br>You can commit this run.</div>`;
  const teamName=esc(S.me?.teamLabel||'Your team');
  const roster=S.mates.length?S.mates.map(x=>esc(x.name)+(x.isCaptain?' (captain)':'')).join(' · '):'Waiting for teammates';
  const commit=S.teamRun?.year1?`Year 1 committed${S.teamRun.updatedAt?' · '+new Date(S.teamRun.updatedAt).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}):''}`:'Year 1 not committed yet';
  const control=S.canSubmit?'You are the captain and commit the shared allocation.':'Your captain commits the shared allocation.';
  return `<div class=\"team\"><b>${teamName} · session ${esc(S.session.code)}</b><br>${roster}<br>${esc(commit)} · ${esc(control)}</div>`;
""", 1)
s = s.replace("""  <p class=\"hint\" style=\"margin-top:12px\">This sim assumes you have read the briefing packet your instructor posted before class.</p>
  ${sessionGate()}${nav({backOk:false,disabled:blocked()})}`);
  wireNav(next,false);
}
""", """  <p class=\"hint\" style=\"margin-top:12px\">This sim assumes you have read the briefing packet your instructor posted before class.</p>
  ${sessionGate()}<div class=\"actions\"><button class=\"btn\" id=\"joinSessionEntry\">Join a facilitated session</button></div>${nav({backOk:false,disabled:blocked()})}`);
  document.getElementById('joinSessionEntry').onclick=()=>{S.error='';renderJoin()};
  wireNav(next,false);
}
""", 1)
s = s.replace("""  <div class=\"field\"><label>Session code</label><input id=\"joinCode\" class=\"mono\" maxlength=\"5\" value=\"${esc(S.sessionCode)}\" placeholder=\"ABCDE\"></div>
  <div class=\"actions\"><button class=\"btn pri\" id=\"joinBtn\">Join session</button></div></section>`);
""", """  <div class=\"field\"><label>Session code</label><input id=\"joinCode\" class=\"mono\" maxlength=\"5\" value=\"${esc(S.sessionCode)}\" placeholder=\"ABCDE\"></div>
  <div class=\"field\"><label>Team name <span class=\"hint\">(team sessions only)</span></label><input id=\"teamName\" maxlength=\"40\" placeholder=\"Agree a short name with your table\"></div>
  <div class=\"actions\"><button class=\"btn pri\" id=\"joinBtn\">Join session</button></div></section>`);
""", 1)
s = s.replace("""  const code=document.getElementById('joinCode').value.trim().toUpperCase();
  try{
    const d=await sessionApi({action:'join',code,name,participantId:S.participantId||undefined});
""", """  const code=document.getElementById('joinCode').value.trim().toUpperCase();
  const teamName=document.getElementById('teamName')?.value.trim()||'';
  try{
    const d=await sessionApi({action:'join',code,name,teamName,participantId:S.participantId||undefined});
""", 1)
s = s.replace("""  if(redraw||changed)render();
""", """  if(redraw||(changed&&safeToRerender()))render();
""", 1)
s = s.replace("""async function saveRun(patch){
  if(!S.session)return {ok:true};
  if(!S.canSubmit)throw new Error('Your team captain commits this choice.');
  return sessionApi({action:'submit',code:S.sessionCode,participantId:S.participantId,...patch});
}
""", """async function saveRun(patch){
  if(!S.session)return {ok:true};
  const shared=patch.strategicView!==undefined||patch.year1!==undefined||patch.year2!==undefined;
  if(!S.canSubmit&&shared)throw new Error('Your team captain commits this choice.');
  return sessionApi({action:'submit',code:S.sessionCode,participantId:S.participantId,...patch});
}
""", 1)
view_old = """function renderView(){
  shell(`<div class=\"eyebrow\">Commit a view</div><h2>What should this company become?</h2><p class=\"lede\">Write one sentence before you see the first allocation outcome.</p>
  <div class=\"field\"><label>Your sentence</label><textarea id=\"viewText\" maxlength=\"500\" placeholder=\"${esc(C.viewPrompt)}\">${esc(S.strategicView)}</textarea><div class=\"hint\">${esc(C.viewDisclosure)}</div></div>
  ${nav({nextLabel:S.canSubmit?'Commit view':'Waiting for captain',disabled:blocked()||(!S.canSubmit&&!S.teamRun?.strategicView)})}`);
  wireNav(async()=>{
    const v=document.getElementById('viewText').value.trim();
    if(!v)return document.getElementById('viewText').focus();
    S.strategicView=v;
    try{if(S.canSubmit)await saveRun({strategicView:v});next()}catch(e){alert(e.message)}
  });
}
"""
view_new = """function renderView(){
  const committed=!!(S.teamRun?.strategicView||S.year1Outcome||S.year1);
  shell(`<div class=\"eyebrow\">Commit a view</div><h2>What should this company become?</h2><p class=\"lede\">Write one sentence before you see the first allocation outcome.</p>
  <div class=\"field\"><label>Your sentence</label><textarea id=\"viewText\" maxlength=\"500\" placeholder=\"${esc(C.viewPrompt)}\" ${committed?'readonly':''}>${esc(S.strategicView)}</textarea><div class=\"hint\">${committed?'This opening view is already committed.':esc(C.viewDisclosure)}</div></div>
  ${nav({nextLabel:committed?'Continue':(S.canSubmit?'Commit view':'Waiting for captain'),disabled:blocked()||(!S.canSubmit&&!S.teamRun?.strategicView)})}`);
  wireNav(async()=>{
    if(committed)return next();
    const v=document.getElementById('viewText').value.trim();
    if(!v)return document.getElementById('viewText').focus();
    S.strategicView=v;
    try{if(S.canSubmit)await saveRun({strategicView:v});next()}catch(e){alert(e.message)}
  });
}
"""
if view_old not in s: raise SystemExit('renderView block missing')
s = s.replace(view_old, view_new, 1)
s = s.replace("""<div class=\"constraint\">${l.id==='run'?'<span title=\"Run must stay at $3M or more to keep current operations functioning.\" aria-label=\"Why Run cannot go lower\">ⓘ</span>':''}</div>""", """<div class=\"constraint\">${l.id==='run'&&n<=min?'Run floor: $3M keeps current operations functioning.':''}</div>""", 1)
s = s.replace("""  ${nav({backOk:false,nextLabel:'See the three buyers'})}`);wireNav(next,false);
}
""", """  ${nav({backOk:false,nextLabel:C.buyers?.authored===false?'Continue to close':'See the three buyers'})}`);wireNav(next,false);
}
""", 1)
s = s.replace("""  ${o?.band==='unresolved_calibration'?notice('This is a known authored-calibration gap, not a random failure. The instructor view flags the run.') : ''}
""", "", 1)
s = s.replace("""    if(S.session&&S.canSubmit)await saveRun({reflection1:S.reflection1,reflection2:S.reflection2,done:true});
""", """    if(S.session)await saveRun({reflection1:S.reflection1,reflection2:S.reflection2,done:true});
""", 1)
p.write_text(s)

p = Path('sim03/public/instructor.html')
s = p.read_text()
s = s.replace(""".thresholds{display:grid;grid-template-columns:repeat(2,1fr);gap:8px}@media(max-width:900px)""", """.thresholds{display:grid;grid-template-columns:repeat(2,1fr);gap:8px}.presentbar{display:flex;gap:8px;align-items:center;margin:12px 0}.present{position:fixed;inset:0;z-index:50;background:var(--n);padding:5vh 6vw;overflow:auto}.present .card{display:none;border:0;background:transparent;padding:0}.present .card.present-on{display:block!important}.present h2{font-size:64px}.present h3{font-size:44px}.present .scatter{height:58vh}.dotcount{position:absolute;transform:translate(-50%,50%);display:flex;align-items:center;justify-content:center;border-radius:50%;background:var(--a);color:#191206;font:600 11px var(--m);border:2px solid var(--n)}@media(max-width:900px)""", 1)
s = s.replace("""let facultyCode='',mode='',code='',state=null,poll=null,error='',aSel='',bSel='';
""", """let facultyCode='',mode='',code=(location.hash||'').replace('#','')||localStorage.getItem('m03-faculty-session')||'',state=null,poll=null,error='',aSel='',bSel='',presentIndex=0;
function safeToRerender(){const el=document.activeElement;return !el||!['INPUT','TEXTAREA','SELECT'].includes(el.tagName)}
""", 1)
s = s.replace("""<div class=\"actions\"><button class=\"btn pri\" id=\"create\" ${mode?'':'disabled'}>Create session</button></div></section><section class=\"card\"><h3>Instructor surface</h3><p>Join code, teams, captains, calibration, live progress, Year 1 distributions, Year 3 bands, Connect vs Uptime, anonymous contrasting runs, opening views and CSV export.</p>${notice('Thresholds can change while this session is in the lobby. They lock when play starts.')}</section></div>`;document.querySelectorAll('[data-mode]').forEach(x=>x.onclick=()=>{mode=x.dataset.mode;render()});document.getElementById('create').onclick=create}
""", """<div class=\"actions\"><button class=\"btn pri\" id=\"create\" ${mode?'':'disabled'}>Create session</button></div><div class=\"field\"><label>Resume session code</label><input id=\"resumeCode\" maxlength=\"5\" placeholder=\"ABCDE\"></div><div class=\"actions\"><button class=\"btn\" id=\"resumeBtn\">Resume session</button></div></section><section class=\"card\"><h3>Instructor surface</h3><p>Join code, teams, captains, calibration, live progress, Year 1 distributions, Year 3 bands, Connect vs Uptime, anonymous contrasting runs, opening views and CSV export.</p>${notice(mode==='team'?'Students name their own teams when they join. You can move anyone or hand off captaincy at any time.':'Thresholds can change while this session is in the lobby. They lock when play starts.')}</section></div>`;document.querySelectorAll('[data-mode]').forEach(x=>x.onclick=()=>{mode=x.dataset.mode;render()});document.getElementById('create').onclick=create;document.getElementById('resumeBtn').onclick=resumeSession}
""", 1)
s = s.replace("""async function create(){facultyCode=document.getElementById('fc').value.trim();try{let d=await api({action:'create',name:document.getElementById('name').value.trim(),mode});code=d.session.code;state={session:d.session,participants:{},runs:{},defaultThresholds:d.session.thresholds};startPoll();render()}catch(e){error=e.message;render()}}
function startPoll(){clearInterval(poll);poll=setInterval(refresh,2000);refresh()}async function refresh(){if(!code)return;try{state=await api({action:'faculty_state',code});render()}catch(e){error=e.message}}
""", """async function create(){facultyCode=document.getElementById('fc').value.trim();try{let d=await api({action:'create',name:document.getElementById('name').value.trim(),mode});code=d.session.code;location.hash=code;localStorage.setItem('m03-faculty-session',code);state={session:d.session,participants:{},runs:{},defaultThresholds:d.session.thresholds};startPoll();render()}catch(e){error=e.message;render()}}
async function resumeSession(){const v=(document.getElementById('resumeCode')?.value||code||'').trim().toUpperCase();if(!v)return;code=v;location.hash=code;localStorage.setItem('m03-faculty-session',code);try{state=await api({action:'faculty_state',code});startPoll();render()}catch(e){error=e.message;code='';render()}}
function startPoll(){clearInterval(poll);poll=setInterval(refresh,2000);refresh()}async function refresh(){if(!code)return;try{state=await api({action:'faculty_state',code});if(safeToRerender())render()}catch(e){error=e.message}}
""", 1)
s = s.replace("""<p>${s.mode==='team'?'Assign every participant to a team before start; one captain commits.':'Each participant owns one run.'}</p>""", """<p>${s.mode==='team'?'Students self-select teams at join. You can move members or hand off captaincy at any time.':'Each participant owns one run.'}</p>""", 1)
s = s.replace("""${s.mode==='team'?teams(ps,s):''}${calibrate(s)}${analytics(rs)}</div>`;wire()}""", """${s.mode==='team'?teams(ps,s):''}${calibrate(s)}<div class=\"presentbar\"><button class=\"btn pri\" id=\"presentBtn\">Present debrief</button><span class=\"meta\">Projector mode · arrow keys page panels</span></div>${analytics(rs)}</div>`;wire()}""", 1)
team_pat = re.compile(r"function teams\(ps,s\)\{return `.*?`\}\nfunction calibrate", re.S)
team_new = """function teams(ps,s){const groups=[...new Set(ps.map(p=>p.groupId).filter(Boolean))];return `<section class=\"card full\"><div class=\"meta\">Team roster</div><h3>Teams and captains</h3><p>Students name their own teams at join. Faculty can move a student or hand off captaincy before or after start.</p>${ps.length?`<table><thead><tr><th>Participant</th><th>Team</th><th>Captain</th><th>Move</th></tr></thead><tbody>${ps.map(p=>`<tr><td>${esc(p.name)}</td><td>${esc(p.teamLabel||p.groupId||'Solo')}</td><td><input type=\"radio\" name=\"cap-${esc(p.groupId||p.id)}\" class=\"cap\" data-pid=\"${p.id}\" ${p.isCaptain?'checked':''}></td><td><select class=\"move\" data-pid=\"${p.id}\"><option value=\"\">Keep</option>${groups.filter(g=>g!==p.groupId).map(g=>`<option value=\"${esc(g.replace(/^team:/,''))}\">${esc((ps.find(x=>x.groupId===g)?.teamLabel)||g)}</option>`).join('')}<option value=\"solo\">Solo</option></select></td></tr>`).join('')}</tbody></table>`:notice('Waiting for participants to join.')}</section>`}
function calibrate"""
if not team_pat.search(s): raise SystemExit('instructor teams function not found')
s = team_pat.sub(team_new, s, count=1)
s = s.replace("""${notice('Authored gap: Year 3 is not defined in the supplied spec for Connect ≥ 5 with Capacity < 2. Such runs are flagged; the app does not invent an outcome.')}""", """${notice('Calibration note: Connect at the strong threshold with Capacity below the strong threshold is shown to students with the nearest authored pilot narrative and flagged here for review.')}""", 1)
s = s.replace("""rs.filter(r=>r.outcomes?.year3?.band==='unresolved_calibration').length""", """rs.filter(r=>r.outcomes?.year3?.calibrationGap||r.outcomes?.year3?.band==='unresolved_calibration').length""", 1)
s = s.replace("""function bands(rs){let c={strong:0,pilot:0,weak:0,unresolved_calibration:0};rs.forEach(r=>{let b=r.outcomes?.year3?.band;if(b)c[b]=(c[b]||0)+1});return `<div class=\"bands\">${Object.entries(c).map(([k,n])=>`<div class=\"band\"><span class=\"${k==='unresolved_calibration'?'warn':''}\">${esc(k.replaceAll('_',' '))}</span><b class=\"${k==='unresolved_calibration'?'warn':''}\">${n}</b></div>`).join('')}</div>`}
""", """function bands(rs){let c={strong:0,pilot:0,weak:0},gaps=0;rs.forEach(r=>{let b=r.outcomes?.year3?.band;if(b)c[b]=(c[b]||0)+1;if(r.outcomes?.year3?.calibrationGap)gaps++});return `<div class=\"bands\">${Object.entries(c).map(([k,n])=>`<div class=\"band\"><span>${esc(k)}</span><b>${n}</b></div>`).join('')}${gaps?`<div class=\"band\"><span class=\"warn\">calibration review</span><b class=\"warn\">${gaps}</b></div>`:''}</div>`}
""", 1)
scatter_pat = re.compile(r"function scatter\(rs\)\{.*?\}\nfunction mini", re.S)
scatter_new = """function scatter(rs){const raw=rs.filter(r=>r.outcomes?.year3?.cumulative).map(r=>r.outcomes.year3.cumulative);if(!raw.length)return notice('No Year 3 outcomes yet.');const groups={};raw.forEach(c=>{const k=`${c.connect}:${c.uptime}`;(groups[k]||={c,n:0}).n++});const p=Object.values(groups);return `<div class=\"scatter\"><span class=\"axis x\">Cumulative Connect →</span><span class=\"axis y\">Cumulative Uptime →</span>${p.map(x=>{const size=18+Math.min(34,(x.n-1)*6);return `<span class=\"dotcount\" aria-label=\"${x.n} runs at Connect ${x.c.connect}, Uptime ${x.c.uptime}\" style=\"width:${size}px;height:${size}px;left:${x.c.connect/6*100}%;bottom:${x.c.uptime/6*100}%\">${x.n}</span>`}).join('')}</div>`}
function mini"""
if not scatter_pat.search(s): raise SystemExit('scatter function not found')
s = scatter_pat.sub(scatter_new, s, count=1)
wire_pat = re.compile(r"function wire\(\)\{.*?\}\nasync function saveTeams\(\).*?async function saveCal", re.S)
wire_new = """function wire(){document.getElementById('copy').onclick=()=>navigator.clipboard.writeText(document.getElementById('join').value);document.querySelectorAll('[data-control]').forEach(b=>b.onclick=async()=>{try{await api({action:'control',code,set:b.dataset.control});await refresh()}catch(e){alert(e.message)}});document.querySelectorAll('.cap').forEach(x=>x.onchange=async()=>{if(!x.checked)return;try{await api({action:'set_captain',code,participantId:x.dataset.pid});await refresh()}catch(e){alert(e.message)}});document.querySelectorAll('.move').forEach(x=>x.onchange=async()=>{if(!x.value)return;const assign={[x.dataset.pid]:x.value==='solo'?'':x.value};try{await api({action:'group',code,assign});await refresh()}catch(e){alert(e.message)}});let sc=document.getElementById('saveCal');if(sc)sc.onclick=saveCal;let aa=document.getElementById('as'),bb=document.getElementById('bs');if(aa){aa.value=aSel;aa.onchange=()=>{aSel=aa.value;render()}}if(bb){bb.value=bSel;bb.onchange=()=>{bSel=bb.value;render()}}let ex=document.getElementById('export');if(ex)ex.onclick=exportCsv;let pb=document.getElementById('presentBtn');if(pb)pb.onclick=startPresent}
function startPresent(){document.body.classList.add('present');const cards=[...document.querySelectorAll('#app .card')].filter(x=>/Projector view|Year 3 bands|Connect vs Uptime|Contrasting runs/.test(x.textContent));if(!cards.length)return;presentIndex=Math.min(presentIndex,cards.length-1);const show=()=>{cards.forEach((c,i)=>c.classList.toggle('present-on',i===presentIndex))};show();const key=e=>{if(!document.body.classList.contains('present'))return;if(e.key==='Escape'){document.body.classList.remove('present');cards.forEach(c=>c.classList.remove('present-on'));document.removeEventListener('keydown',key);return}if(e.key==='ArrowRight'||e.key==='ArrowDown'){presentIndex=(presentIndex+1)%cards.length;show()}if(e.key==='ArrowLeft'||e.key==='ArrowUp'){presentIndex=(presentIndex-1+cards.length)%cards.length;show()}};document.addEventListener('keydown',key)}
async function saveCal"""
if not wire_pat.search(s): raise SystemExit('wire/saveTeams block not found')
s = wire_pat.sub(wire_new, s, count=1)
s = s.replace("""function analytics(rs){return `<section class=\"card full\"><div class=\"meta\">Projector view</div><h2>What the room chose</h2>${distribution(rs)}</section>""", """function analytics(rs){return `<section class=\"card full\"><div class=\"meta\">Projector view</div><h2>What the room chose</h2><p class=\"lede\">Debrief cue: the annual cap is the wall. Every million above Run displaced an architecture choice somewhere else.</p>${distribution(rs)}</section>""", 1)
p.write_text(s)

p = Path('sim03/build.js')
s = p.read_text()
extra = """
for (const marker of [
  'Join a facilitated session', 'Team name <span', 'function safeToRerender()',
  "if(S.session)await saveRun({reflection1:S.reflection1,reflection2:S.reflection2,done:true})",
  "C.buyers?.authored===false", "const committed=!!(S.teamRun?.strategicView||S.year1Outcome||S.year1)"
]) if (!index.includes(marker)) refuse('team/conformance student marker missing: ' + marker);
for (const marker of ['Resume session code','Students self-select teams at join',"action:'set_captain'",'function startPresent()','dotcount','the annual cap is the wall'])
  if (!instructor.includes(marker)) refuse('team/projector instructor marker missing: ' + marker);
if (index.includes('Valuation pending authored rule')) refuse('unauthored buyer placeholder reached the student bundle');
if (index.includes('authored calibration does not yet define')) refuse('Year 3 calibration scaffolding reached the student bundle');
"""
needle = """function checkScripts(name, source) {
"""
if needle not in s: raise SystemExit('build guard insertion marker missing')
s = s.replace(needle, extra + "\n" + needle, 1)
s = s.replace("""execFileSync(process.execPath, [path.join(__dirname, 'tools', 'access-check.js')], { stdio: 'inherit' });
""", """execFileSync(process.execPath, [path.join(__dirname, 'tools', 'access-check.js')], { stdio: 'inherit' });
execFileSync(process.execPath, [path.join(__dirname, 'tools', 'team-flow-check.js')], { stdio: 'inherit' });
""", 1)
p.write_text(s)

Path('sim03/tools/team-flow-check.js').write_text(r'''#!/usr/bin/env node
const assert=require('assert'),fs=require('fs'),path=require('path');const root=path.join(__dirname,'..');
const session=fs.readFileSync(path.join(root,'api','session.js'),'utf8'),finish=fs.readFileSync(path.join(root,'api','finish.js'),'utf8'),student=fs.readFileSync(path.join(root,'public','index.html'),'utf8'),instructor=fs.readFileSync(path.join(root,'public','instructor.html'),'utf8'),scenario=fs.readFileSync(path.join(root,'lib','scenario.js'),'utf8'),health=fs.readFileSync(path.join(root,'api','health.js'),'utf8');
assert(session.includes('teamName'));assert(session.includes("case 'set_captain':"));assert(!session.includes("error: 'team_session_already_started'"));assert(!session.includes("error: 'unassigned_participants'"));assert(session.includes('wantsSharedDecision'));assert(session.includes('next.reflections = map'));assert(session.includes('next.finishedBy'));assert(finish.includes('reflections[sr.pid]'));assert(student.includes('Join a facilitated session'));assert(student.includes('safeToRerender'));assert(instructor.includes('Resume session code'));assert(instructor.includes('safeToRerender'));assert(instructor.includes('startPresent'));assert(instructor.includes('dotcount'));assert(!student.includes('Valuation pending authored rule'));assert(scenario.includes('calibrationGap: true'));assert(health.includes('not set (standalone access closed)'));console.log('RapidSim 03 team/classroom flow checks passed.');
''')
