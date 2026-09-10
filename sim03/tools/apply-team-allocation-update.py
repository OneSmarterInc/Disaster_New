#!/usr/bin/env python3
from pathlib import Path
import json

ROOT = Path(__file__).resolve().parents[1]


def read(rel):
    return (ROOT / rel).read_text(encoding='utf-8')


def write(rel, text):
    (ROOT / rel).write_text(text, encoding='utf-8')


def replace_once(text, old, new, label):
    if old not in text:
        raise RuntimeError(f'missing patch marker: {label}')
    return text.replace(old, new, 1)


def replace_range(text, start, end, replacement, label):
    i = text.find(start)
    if i < 0:
        raise RuntimeError(f'missing start marker: {label}')
    j = text.find(end, i + len(start))
    if j < 0:
        raise RuntimeError(f'missing end marker: {label}')
    return text[:i] + replacement + text[j:]


# Idempotence: the automation commits once, then its own push reruns with no diff.
if "case 'rename_team':" in read('api/session.js') and 'Auto split teams' in read('public/instructor.html') and 'Waiting for team assignment' in read('public/index.html'):
    print('Sim03 team allocation update is already applied.')
    raise SystemExit(0)

# -------------------- API/session contract --------------------
session = read('api/session.js')

new_group_block = r'''      case 'group': {
        const who = whoIsFaculty(req, b);
        if (!who) return res.status(401).json({ error: 'faculty_authorization_required' });
        const sess = await store.getSession(code);
        if (!sess) return res.status(404).json({ error: 'no_such_session' });
        if (!ownsSession(who, sess)) return res.status(403).json({ error: 'not_your_session' });
        if (sess.mode !== 'team') return res.status(409).json({ error: 'not_team_mode' });

        const participants = await store.getParticipants(code);
        const previousCaptains = {};
        for (const p of Object.values(participants)) if (p && p.groupId && p.isCaptain) previousCaptains[p.groupId] = p.id;
        const rawAssign = b.assign && typeof b.assign === 'object' ? b.assign : {};
        for (const p of Object.values(participants)) {
          if (!p || !Object.prototype.hasOwnProperty.call(rawAssign, p.id)) continue;
          const label = String(rawAssign[p.id] || '').trim().slice(0, 40);
          if (label === '__unassigned__' || !label) {
            p.groupId = null;
            p.teamLabel = '';
            p.isCaptain = false;
          } else if (label.startsWith('team:')) {
            const target = Object.values(participants).find(x => x && x.groupId === label);
            if (!target) return res.status(404).json({ error: 'no_such_team' });
            p.groupId = label;
            p.teamLabel = target.teamLabel || label.slice(5);
          } else if (label === '__solo__') {
            p.groupId = `solo:${p.id}`;
            p.teamLabel = p.name;
          } else {
            const norm = label.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9_-]/g, '');
            if (!norm) return res.status(400).json({ error: 'team_name_required' });
            p.groupId = `team:${norm}`;
            p.teamLabel = label;
          }
        }
        const caps = captainMap(participants, { ...previousCaptains, ...(b.captains || {}) });
        for (const p of Object.values(participants)) {
          if (!p) continue;
          p.isCaptain = !!(p.groupId && caps[p.groupId] === p.id);
          await store.setParticipant(code, p.id, p);
        }
        return res.status(200).json({ ok: true, captains: caps });
      }

      case 'rename_team': {
        const who = whoIsFaculty(req, b);
        if (!who) return res.status(401).json({ error: 'faculty_authorization_required' });
        const sess = await store.getSession(code);
        if (!sess) return res.status(404).json({ error: 'no_such_session' });
        if (!ownsSession(who, sess)) return res.status(403).json({ error: 'not_your_session' });
        if (sess.mode !== 'team') return res.status(409).json({ error: 'not_team_mode' });
        const groupId = String(b.groupId || '').trim();
        const teamLabel = String(b.teamLabel || '').trim().slice(0, 40);
        if (!groupId || !teamLabel) return res.status(400).json({ error: 'team_name_required' });
        const participants = await store.getParticipants(code);
        const members = Object.values(participants).filter(p => p && p.groupId === groupId);
        if (!members.length) return res.status(404).json({ error: 'no_such_team' });
        for (const p of members) {
          p.teamLabel = teamLabel;
          await store.setParticipant(code, p.id, p);
        }
        return res.status(200).json({ ok: true, groupId, teamLabel });
      }

'''
session = replace_range(session, "      case 'group': {", "      case 'set_captain': {", new_group_block, 'group + rename_team')

new_control_block = r'''      case 'control': {
        const who = whoIsFaculty(req, b);
        if (!who) return res.status(401).json({ error: 'faculty_authorization_required' });
        const sess = await store.getSession(code);
        if (!sess) return res.status(404).json({ error: 'no_such_session' });
        if (!ownsSession(who, sess)) return res.status(403).json({ error: 'not_your_session' });

        if (b.set === 'start') {
          if (sess.mode === 'team') {
            const participants = await store.getParticipants(code);
            const all = Object.values(participants).filter(Boolean);
            if (!all.length) {
              return res.status(409).json({ error: 'participants_required', message: 'At least one student must join before a team session can start.' });
            }
            const unassigned = all.filter(p => !p.groupId);
            if (unassigned.length) {
              return res.status(409).json({
                error: 'unassigned_participants',
                count: unassigned.length,
                participantIds: unassigned.map(p => p.id),
                message: `${unassigned.length} student${unassigned.length === 1 ? ' is' : 's are'} still unassigned. Assign every student to a team before starting.`
              });
            }
            const groups = {};
            for (const p of all) (groups[p.groupId] ||= []).push(p);
            const missingLead = Object.entries(groups).filter(([, members]) => !members.some(p => p.isCaptain)).map(([gid]) => gid);
            if (missingLead.length) {
              return res.status(409).json({ error: 'team_lead_required', groupIds: missingLead, message: 'Every team must have one team lead before the session starts.' });
            }
          }
          sess.state = 'running';
          sess.startedAt = Date.now();
        }
        if (b.set === 'pause') sess.paused = true;
        if (b.set === 'resume') sess.paused = false;
        if (b.set === 'close') sess.state = 'closed';
        await store.putSession(code, sess);
        return res.status(200).json({ session: sess });
      }

'''
session = replace_range(session, "      case 'control': {", "      case 'join': {", new_control_block, 'team start validation')

new_join_block = r'''      case 'join': {
        const sess = await store.getSession(code);
        if (!sess) return res.status(404).json({ error: 'no_such_session' });
        if (sess.state === 'closed') return res.status(410).json({ error: 'session_closed' });

        const name = String(b.name || '').slice(0, 60).trim();
        if (!name) return res.status(400).json({ error: 'name_required' });
        const all = await store.getParticipants(code);
        const key = x => String(x || '').trim().toLowerCase();
        const lt = req.headers['x-launch-token'] || b.launchToken;
        const launched = lt ? verifyLaunch(String(lt)) : null;
        let id = launched && launched.sub ? `platform:${launched.sub}` : String(b.participantId || '').trim();
        if (!id || !all[id]) {
          const match = Object.values(all).find(p => p && key(p.name) === key(name));
          id = match ? match.id : (id || newId());
        }
        const existing = all[id];

        let groupId = existing ? existing.groupId : null;
        let teamLabel = existing ? (existing.teamLabel || '') : '';
        if (sess.mode === 'individual') {
          groupId = `individual:${id}`;
          teamLabel = name;
        } else if (!existing) {
          // Team sessions are instructor-managed. New students always enter the
          // unassigned pool; the faculty console creates teams and chooses leads.
          groupId = null;
          teamLabel = '';
        }

        const participant = {
          id,
          name,
          groupId,
          teamLabel,
          isCaptain: existing ? !!existing.isCaptain : sess.mode === 'individual',
          joinedAt: existing ? existing.joinedAt : Date.now()
        };
        await store.addParticipant(code, id, participant);
        return res.status(200).json({ participantId: id, session: publicSession(sess), me: participant });
      }

'''
session = replace_range(session, "      case 'join': {", "      case 'state': {", new_join_block, 'instructor-managed join')
write('api/session.js', session)

# -------------------- Student UI --------------------
student = read('public/index.html')
new_join_ui = r'''function renderJoin(){
  shell(`<section class="joinbox"><div class="eyebrow">Facilitated session</div><h2>Join Midland Equipment</h2><p class="lede">Enter your name and the session code shown by your instructor. Your instructor will place you on a team if this is a team session.</p>
  ${S.error?notice(S.error,true):''}
  <div class="field"><label>Name</label><input id="joinName" autocomplete="name" placeholder="Your name"></div>
  <div class="field"><label>Session code</label><input id="joinCode" class="mono" maxlength="5" value="${esc(S.sessionCode)}" placeholder="ABCDE"></div>
  <div class="actions"><button class="btn pri" id="joinBtn">Join session</button></div></section>`);
  document.getElementById('joinBtn').onclick=joinSession;
}
async function joinSession(){
  const name=document.getElementById('joinName').value.trim();
  const code=document.getElementById('joinCode').value.trim().toUpperCase();
  try{
    const d=await sessionApi({action:'join',code,name,participantId:S.participantId||undefined});
    S.sessionCode=code;S.participantId=d.participantId;S.session=d.session;S.me=d.me;
    localStorage.setItem('m03-pid',S.participantId);S.error='';
    await pollSession(true);startPolling();render();
  }catch(e){S.error=e.message;renderJoin()}
}
'''
student = replace_range(student, 'function renderJoin(){', 'function startPolling(){', new_join_ui, 'student join UI')

new_team_banner = r'''function teamBanner(){
  if(!S.session)return '';
  const mode=S.session.mode==='team'?'Team':'Individual';
  if(S.session.mode!=='team')return `<div class="team"><b>${mode} session ${esc(S.session.code)}</b><br>You can commit this run.</div>`;
  if(!S.me?.groupId)return `<div class="team"><b>Waiting for team assignment · session ${esc(S.session.code)}</b><br>Your instructor will place you on a team and choose the team lead. Stay on this page; it updates automatically.</div>`;
  const teamName=esc(S.me?.teamLabel||'Your team');
  const roster=S.mates.length?S.mates.map(x=>esc(x.name)+(x.isCaptain?' (team lead)':'')).join(' · '):'Waiting for teammates';
  const commit=S.teamRun?.year1?`Year 1 committed${S.teamRun.updatedAt?' · '+new Date(S.teamRun.updatedAt).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}):''}`:'Year 1 not committed yet';
  const control=S.canSubmit?'You are the team lead and commit the shared allocation.':'Your team lead commits the shared allocation.';
  return `<div class="team"><b>${teamName} · session ${esc(S.session.code)}</b><br>${roster}<br>${esc(commit)} · ${esc(control)}</div>`;
}
'''
student = replace_range(student, 'function teamBanner(){', 'function notice(', new_team_banner, 'student team banner')
student = replace_once(student,
    "function blocked(){return !!(S.session&&(S.session.state!=='running'||S.session.paused))}",
    "function blocked(){return !!(S.session&&(S.session.state!=='running'||S.session.paused||(S.session.mode==='team'&&!S.me?.groupId)))}",
    'student unassigned gate')
write('public/index.html', student)

# -------------------- Instructor UI --------------------
instructor = read('public/instructor.html')
instructor = replace_once(instructor,
    ".thresholds{display:grid;grid-template-columns:repeat(2,1fr);gap:8px}",
    ".thresholds{display:grid;grid-template-columns:repeat(2,1fr);gap:8px}.team-tools{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:16px 0}.team-tool{border:1px solid var(--l);background:var(--p2);padding:14px}.team-tool .field{margin-top:10px}.team-tool-row{display:flex;gap:8px;align-items:end;flex-wrap:wrap}.team-tool-row .field{flex:1;min-width:120px}.team-board{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-top:14px}.team-card{border:1px solid var(--l2);background:var(--p2);padding:15px}.team-head{display:grid;grid-template-columns:1fr minmax(180px,.8fr);gap:12px;align-items:start}.team-head h3{margin:2px 0 0}.team-members{display:grid;gap:7px;margin-top:13px}.member-row{display:grid;grid-template-columns:1fr minmax(160px,.7fr);gap:10px;align-items:center;border-top:1px solid var(--l);padding-top:8px}.member-name b{display:block;font-weight:500;color:var(--b)}.member-name span{font:9px var(--m);letter-spacing:.08em;text-transform:uppercase;color:var(--dd)}.unassigned-block{border:1px solid #7d4553;background:rgba(206,124,141,.05);padding:14px;margin-top:14px}.unassigned-block h4{font-size:18px;font-weight:400;margin:0 0 8px}.unassigned-row{display:grid;grid-template-columns:1fr minmax(180px,.7fr);gap:10px;align-items:center;border-top:1px solid var(--l);padding:8px 0}.team-ready{border-left-color:var(--g)}",
    'team allocation CSS')
instructor = replace_once(instructor,
    "<b>Team</b><span>Students name teams; one captain commits the shared decisions.</span>",
    "<b>Team</b><span>Students join unassigned; you create teams and choose one team lead.</span>",
    'team mode copy')
instructor = replace_once(instructor,
    "Students name their own teams when they join. You can move anyone or hand off captaincy at any time.",
    "In Team mode, students join unassigned. You assign teams and choose one team lead for each team before starting.",
    'create screen team notice')
instructor = replace_once(instructor,
    "Students self-select teams at join. You can move members or hand off captaincy at any time.",
    "Students join unassigned. You create teams, move members, and choose one team lead per team.",
    'console team summary')

new_team_functions = r'''function teamGroups(ps){const by={};ps.filter(p=>p&&p.groupId).forEach(p=>{const g=by[p.groupId]||(by[p.groupId]={groupId:p.groupId,label:p.teamLabel||String(p.groupId).replace(/^team:/,'')||'Team',members:[]});if(p.teamLabel)g.label=p.teamLabel;g.members.push(p)});return Object.values(by).sort((a,b)=>String(a.label).localeCompare(String(b.label)))}
function teamReadiness(ps){const unassigned=ps.filter(p=>p&&!p.groupId),groups=teamGroups(ps),missingLead=groups.filter(g=>!g.members.some(m=>m.isCaptain));return {unassigned,groups,missingLead,ok:ps.length>0&&unassigned.length===0&&groups.length>0&&missingLead.length===0}}
function controls(s){if(s.state==='lobby'){if(s.mode==='team'){const ready=teamReadiness(participants());return `<button class="btn pri" data-control="start" ${ready.ok?'':'disabled'}>Start</button>`}return '<button class="btn pri" data-control="start">Start</button>'}if(s.state==='running'&&!s.paused)return '<button class="btn" data-control="pause">Pause</button><button class="btn danger" data-control="close">Close</button>';if(s.state==='running'&&s.paused)return '<button class="btn pri" data-control="resume">Resume</button><button class="btn danger" data-control="close">Close</button>';return ''}
function teamTargetOptions(groups,current){return `<option value="">Keep</option>${groups.filter(g=>g.groupId!==current).map(g=>`<option value="${esc(g.groupId)}">${esc(g.label)}</option>`).join('')}<option value="__unassigned__">Unassigned</option>`}
function teams(ps,s){const info=teamReadiness(ps),groups=info.groups,lobby=s.state==='lobby';let readiness='';if(!ps.length)readiness=notice('Waiting for students to join. Start will become available after teams are assigned.',true);else if(info.unassigned.length)readiness=notice(`${info.unassigned.length} student${info.unassigned.length===1?' is':'s are'} still unassigned. Assign everyone before Start.`,true);else if(info.missingLead.length)readiness=notice(`${info.missingLead.length} team${info.missingLead.length===1?' needs':'s need'} a team lead before Start.`,true);else readiness=`<div class="notice team-ready">${groups.length} team${groups.length===1?' is':'s are'} ready. Every student is assigned and every team has one lead.</div>`;const candidates=(info.unassigned.length?info.unassigned:ps).slice().sort((a,b)=>(a.joinedAt||0)-(b.joinedAt||0));const tool=`<div class="team-tools"><div class="team-tool"><div class="meta">Quick setup</div><h3>Auto split teams</h3><div class="team-tool-row"><div class="field"><label>Number of teams</label><input id="teamCount" type="number" min="1" max="${Math.max(1,ps.length)}" value="${Math.min(Math.max(1,Math.ceil(ps.length/4)),4)}"></div><button class="btn" id="autoSplit" ${!lobby||!ps.length?'disabled':''}>Auto split teams</button></div><p>Evenly distributes everyone who has joined. You can move people and change leads afterwards.</p></div><div class="team-tool"><div class="meta">Manual setup</div><h3>Create team</h3><div class="field"><label>Team name</label><input id="newTeamName" maxlength="40" placeholder="Team 1"></div><div class="field"><label>First member</label><select id="newTeamMember"><option value="">Choose student</option>${candidates.map(p=>`<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('')}</select></div><div class="actions"><button class="btn" id="createTeam" ${!lobby||!ps.length?'disabled':''}>Create team</button></div></div></div>`;const unassigned=info.unassigned.length?`<div class="unassigned-block"><h4>Unassigned students · ${info.unassigned.length}</h4>${info.unassigned.map(p=>`<div class="unassigned-row"><div class="member-name"><b>${esc(p.name)}</b><span>Not assigned</span></div><select class="assign-member" data-pid="${esc(p.id)}" ${groups.length?'':'disabled'}><option value="">Assign to…</option>${groups.map(g=>`<option value="${esc(g.groupId)}">${esc(g.label)}</option>`).join('')}</select></div>`).join('')}</div>`:'';const cards=groups.map(g=>{const lead=g.members.find(m=>m.isCaptain);return `<div class="team-card"><div class="team-head"><div><div class="meta">Team</div><h3>${esc(g.label)}</h3></div><div class="field"><label>Team lead</label><select class="team-lead" data-gid="${esc(g.groupId)}">${g.members.map(m=>`<option value="${esc(m.id)}" ${m.isCaptain?'selected':''}>${esc(m.name)}</option>`).join('')}</select></div></div><div class="team-members">${g.members.map(m=>`<div class="member-row"><div class="member-name"><b>${esc(m.name)}</b><span>${m.isCaptain?'Team lead':'Member'}</span></div><select class="move-member" data-pid="${esc(m.id)}">${teamTargetOptions(groups,g.groupId)}</select></div>`).join('')}</div><div class="actions"><button class="btn rename-team" data-gid="${esc(g.groupId)}" data-label="${esc(g.label)}">Rename team</button></div></div>`}).join('');return `<section class="card full"><div class="meta">Team allocation</div><h3>Who is on each team, and who leads it?</h3><p>Students only join the session. You control team membership and select exactly one team lead for each team.</p>${readiness}${tool}${unassigned}${cards?`<div class="team-board">${cards}</div>`:''}</section>`}
'''
instructor = replace_range(instructor, 'function controls(s){', 'function calibrate(s){', new_team_functions, 'instructor team allocation functions')

new_wire = r'''function wire(){document.getElementById('copy').onclick=()=>navigator.clipboard.writeText(document.getElementById('join').value);document.querySelectorAll('[data-control]').forEach(b=>b.onclick=async()=>{try{await api({action:'control',code,set:b.dataset.control});await refresh()}catch(e){alert(e.message)}});document.querySelectorAll('.team-lead').forEach(x=>x.onchange=async()=>{try{await api({action:'set_captain',code,participantId:x.value});await refresh()}catch(e){alert(e.message)}});document.querySelectorAll('.move-member,.assign-member').forEach(x=>x.onchange=async()=>{if(!x.value)return;try{await api({action:'group',code,assign:{[x.dataset.pid]:x.value}});await refresh()}catch(e){alert(e.message)}});const auto=document.getElementById('autoSplit');if(auto)auto.onclick=async()=>{const n=Math.max(1,Math.min(participants().length,Number(document.getElementById('teamCount')?.value||1))),sorted=participants().slice().sort((a,b)=>(a.joinedAt||0)-(b.joinedAt||0)),assign={};sorted.forEach((p,i)=>assign[p.id]=`Team ${(i%n)+1}`);try{await api({action:'group',code,assign});await refresh()}catch(e){alert(e.message)}};const createTeam=document.getElementById('createTeam');if(createTeam)createTeam.onclick=async()=>{const label=(document.getElementById('newTeamName')?.value||'').trim(),pid=document.getElementById('newTeamMember')?.value||'';if(!label)return alert('Enter a team name.');if(!pid)return alert('Choose the first member of the team.');if(teamGroups(participants()).some(g=>g.label.trim().toLowerCase()===label.toLowerCase()))return alert('That team name is already in use.');try{await api({action:'group',code,assign:{[pid]:label}});await refresh()}catch(e){alert(e.message)}};document.querySelectorAll('.rename-team').forEach(b=>b.onclick=async()=>{const label=window.prompt('Rename team',b.dataset.label||'');if(label===null||!label.trim())return;try{await api({action:'rename_team',code,groupId:b.dataset.gid,teamLabel:label.trim()});await refresh()}catch(e){alert(e.message)}});let sc=document.getElementById('saveCal');if(sc)sc.onclick=saveCal;let aa=document.getElementById('as'),bb=document.getElementById('bs');if(aa){aa.value=aSel;aa.onchange=()=>{aSel=aa.value;render()}}if(bb){bb.value=bSel;bb.onchange=()=>{bSel=bb.value;render()}}document.querySelectorAll('.buyer-run').forEach(b=>b.onclick=()=>{aSel=b.dataset.run;render()});let ex=document.getElementById('export');if(ex)ex.onclick=exportCsv;let pb=document.getElementById('presentBtn');if(pb)pb.onclick=startPresent}
'''
instructor = replace_range(instructor, 'function wire(){', 'function startPresent(){', new_wire, 'instructor team wiring')
instructor = replace_once(instructor,
    "@media(max-width:900px){.card,.third{grid-column:1/-1}.kpis{grid-template-columns:repeat(2,1fr)}.contrast,.thresholds,.modes{grid-template-columns:1fr}}",
    "@media(max-width:900px){.card,.third{grid-column:1/-1}.kpis{grid-template-columns:repeat(2,1fr)}.contrast,.thresholds,.modes,.team-tools,.team-board{grid-template-columns:1fr}.team-head,.member-row,.unassigned-row{grid-template-columns:1fr}}",
    'team responsive CSS')
write('public/instructor.html', instructor)

# -------------------- Build/test assertions --------------------
build = read('build.js')
build = replace_once(build,
    "'Join a facilitated session', 'Team name <span', 'function safeToRerender()', 'Team allocation is read-only for non-captains',",
    "'Join a facilitated session', 'Waiting for team assignment', 'function safeToRerender()', 'Team allocation is read-only for non-captains',",
    'build student team marker')
build = replace_once(build,
    "for (const marker of ['Resume session code','Students self-select teams at join',\"action:'set_captain'\",'function startPresent()','dotcount','the annual cap is the wall'])",
    "for (const marker of ['Resume session code','Auto split teams','Unassigned students','Team lead',\"action:'set_captain'\",\"action:'rename_team'\",'function startPresent()','dotcount','the annual cap is the wall'])",
    'build instructor team markers')
build = replace_once(build,
    "for (const marker of ['m03-faculty-lt','Faculty authorization received from RapidSims.','Your faculty authorization has expired. Return to RapidSims and click Run a session again.'])",
    "if (index.includes('id=\\\"teamName\\\"')) refuse('student team-name input returned; team allocation must stay instructor-managed');\nfor (const marker of ['m03-faculty-lt','Faculty authorization received from RapidSims.','Your faculty authorization has expired. Return to RapidSims and click Run a session again.'])",
    'build forbid student team input')
write('build.js', build)

team_flow = r'''#!/usr/bin/env node
const assert=require('assert'),fs=require('fs'),path=require('path');const root=path.join(__dirname,'..');
const session=fs.readFileSync(path.join(root,'api','session.js'),'utf8'),finish=fs.readFileSync(path.join(root,'api','finish.js'),'utf8'),student=fs.readFileSync(path.join(root,'public','index.html'),'utf8'),instructor=fs.readFileSync(path.join(root,'public','instructor.html'),'utf8'),scenario=fs.readFileSync(path.join(root,'lib','scenario.js'),'utf8'),health=fs.readFileSync(path.join(root,'api','health.js'),'utf8');
assert(!student.includes('id="teamName"'));assert(!session.includes('const asked = String(b.teamName'));assert(session.includes("case 'set_captain':"));assert(session.includes("case 'rename_team':"));assert(session.includes("label === '__unassigned__'"));assert(session.includes("error: 'unassigned_participants'"));assert(session.includes("error: 'team_lead_required'"));assert(session.includes('wantsSharedDecision'));assert(session.includes('next.reflections = map'));assert(session.includes('next.finishedBy'));assert(session.includes('previousCaptains'));assert(session.includes('platform:${launched.sub}'));assert(finish.includes('reflections[sr.pid]'));assert(student.includes('Join a facilitated session'));assert(student.includes('Waiting for team assignment'));assert(student.includes('safeToRerender'));assert(student.includes('viewCommitted'));assert(instructor.includes('Resume session code'));assert(instructor.includes('Auto split teams'));assert(instructor.includes('Create team'));assert(instructor.includes('Unassigned students'));assert(instructor.includes('Team lead'));assert(instructor.includes("action:'rename_team'"));assert(instructor.includes('safeToRerender'));assert(instructor.includes('startPresent'));assert(instructor.includes("classList.contains('present')"));assert(instructor.includes('dotcount'));assert(instructor.includes('r.reflections?.[p.id]'));assert(instructor.includes('const savedCode='));assert(instructor.includes('Classroom readiness'));assert(instructor.includes('First-section baseline: keep 5'));assert(instructor.includes('Perfect-run debrief'));assert(instructor.includes('one real facilitated Team-mode rehearsal'));assert(!student.includes('Valuation pending authored rule'));assert(scenario.includes("band: 'data_no_room'"));assert(!scenario.includes('calibrationGap'));assert(!scenario.includes('unresolved_calibration'));assert(health.includes('not set (standalone access closed)'));console.log('RapidSim 03 instructor-managed team/classroom flow checks passed.');
'''
write('tools/team-flow-check.js', team_flow)

team_handler = r'''const assert = require('assert');
const store = require('../lib/store.js');
const handler = require('../api/session.js');

const originalEnv = { FACULTY_CODE: process.env.FACULTY_CODE, FACULTY_CODES: process.env.FACULTY_CODES, LAUNCH_SECRET: process.env.LAUNCH_SECRET };
const originalStore = { configured: store.configured, putSession: store.putSession, getSession: store.getSession, getParticipants: store.getParticipants, getRuns: store.getRuns, setParticipant: store.setParticipant, addParticipant: store.addParticipant, setRun: store.setRun };
const sessions = new Map(), participants = new Map(), runs = new Map();
store.configured = () => true;
store.putSession = async (code, value) => { sessions.set(code, { ...value }); return value; };
store.getSession = async code => sessions.get(code) || null;
store.getParticipants = async code => participants.get(code) || {};
store.getRuns = async code => runs.get(code) || {};
store.setParticipant = async (code, pid, value) => { const all = participants.get(code) || {}; all[pid] = { ...value }; participants.set(code, all); };
store.addParticipant = store.setParticipant;
store.setRun = async (code, rid, value) => { const all = runs.get(code) || {}; all[rid] = { ...value }; runs.set(code, all); };
async function invoke(body, headers = {}) { const req = { method: 'POST', headers, body }; const res = { statusCode: 200, payload: null, status(n) { this.statusCode = n; return this; }, json(payload) { this.payload = payload; return payload; }, end() { return null; } }; await handler(req, res); return { status: res.statusCode, body: res.payload }; }
const y1 = { run: 3, uptime: 2, capacity: 1, connect: 2, features: 1 };
const y2 = { run: 3, uptime: 1, capacity: 1, connect: 2, features: 2 };

(async () => {
  try {
    process.env.FACULTY_CODE = 'faculty-secret'; delete process.env.FACULTY_CODES; delete process.env.LAUNCH_SECRET;
    let r = await invoke({ action: 'create', name: 'Team regression', mode: 'team', facultyCode: 'faculty-secret' });
    assert.equal(r.status, 200); const code = r.body.session.code;

    r = await invoke({ action: 'join', code, name: 'Ann', participantId: 'ann' });
    assert.equal(r.status, 200); assert.equal(r.body.me.groupId, null); assert.equal(r.body.me.isCaptain, false);
    r = await invoke({ action: 'join', code, name: 'Ben', participantId: 'ben' });
    assert.equal(r.status, 200); assert.equal(r.body.me.groupId, null);

    r = await invoke({ action: 'control', code, set: 'start', facultyCode: 'faculty-secret' });
    assert.equal(r.status, 409); assert.equal(r.body.error, 'unassigned_participants'); assert.equal(r.body.count, 2);

    r = await invoke({ action: 'group', code, assign: { ann: 'Alpha', ben: 'Alpha' }, facultyCode: 'faculty-secret' });
    assert.equal(r.status, 200); let roster = participants.get(code);
    assert.equal(roster.ann.groupId, 'team:alpha'); assert.equal(roster.ann.isCaptain, true); assert.equal(roster.ben.isCaptain, false);

    r = await invoke({ action: 'rename_team', code, groupId: 'team:alpha', teamLabel: 'Architecture A', facultyCode: 'faculty-secret' });
    assert.equal(r.status, 200); roster = participants.get(code); assert.equal(roster.ann.groupId, 'team:alpha'); assert.equal(roster.ann.teamLabel, 'Architecture A'); assert.equal(roster.ben.teamLabel, 'Architecture A');

    r = await invoke({ action: 'set_captain', code, participantId: 'ben', facultyCode: 'faculty-secret' });
    assert.equal(r.status, 200); roster = participants.get(code); assert.equal(roster.ben.isCaptain, true); assert.equal(roster.ann.isCaptain, false);

    r = await invoke({ action: 'control', code, set: 'start', facultyCode: 'faculty-secret' });
    assert.equal(r.status, 200);

    r = await invoke({ action: 'join', code, name: 'Cal', participantId: 'cal' });
    assert.equal(r.status, 200, 'late joiner should be admitted after start'); assert.equal(r.body.me.groupId, null, 'late joiner stays unassigned until faculty places them');
    r = await invoke({ action: 'group', code, assign: { cal: 'team:alpha' }, facultyCode: 'faculty-secret' });
    assert.equal(r.status, 200); roster = participants.get(code); assert.equal(roster.cal.groupId, 'team:alpha'); assert.equal(roster.ben.isCaptain, true, 'adding a member must preserve the selected lead');

    r = await invoke({ action: 'join', code, name: 'Ann', participantId: 'new-device' });
    assert.equal(r.status, 200); assert.equal(r.body.participantId, 'ann', 'same-name return should reuse existing identity'); assert.equal(r.body.me.groupId, 'team:alpha');

    r = await invoke({ action: 'submit', code, participantId: 'ann', strategicView: 'Ann should not commit this.' });
    assert.equal(r.status, 403); assert.equal(r.body.error, 'captain_only');
    r = await invoke({ action: 'submit', code, participantId: 'ben', strategicView: 'Build a resilient service platform.' }); assert.equal(r.status, 200);
    r = await invoke({ action: 'submit', code, participantId: 'ben', year1: y1 }); assert.equal(r.status, 200);
    r = await invoke({ action: 'submit', code, participantId: 'ben', year2: y2 }); assert.equal(r.status, 200);

    r = await invoke({ action: 'submit', code, participantId: 'ann', reflection1: 'Ann one', reflection2: 'Ann two', done: true }); assert.equal(r.status, 200);
    let teamRun = (runs.get(code) || {})['team:alpha']; assert.equal(teamRun.done, false);
    r = await invoke({ action: 'group', code, assign: { cal: '__unassigned__' }, facultyCode: 'faculty-secret' }); assert.equal(r.status, 200); roster = participants.get(code); assert.equal(roster.cal.groupId, null); assert.equal(roster.ben.isCaptain, true);
    r = await invoke({ action: 'submit', code, participantId: 'ben', reflection1: 'Ben one', reflection2: 'Ben two', done: true }); assert.equal(r.status, 200);
    teamRun = (runs.get(code) || {})['team:alpha']; assert.equal(teamRun.done, true, 'shared run completes when every current assigned member is finished');

    r = await invoke({ action: 'state', code, participantId: 'ann' }); assert.equal(r.status, 200); assert.equal(r.body.run.reflection1, 'Ann one'); assert.equal(r.body.run.done, true);
    console.log('RapidSim 03 instructor-managed team handler regression checks passed.');
  } finally {
    for (const [k, v] of Object.entries(originalEnv)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
    Object.assign(store, originalStore);
  }
})().catch((e) => { console.error(e); process.exit(1); });
'''
write('tools/team-handler-check.js', team_handler)

pkg = json.loads(read('package.json'))
pkg['scripts']['test'] = 'node tools/check.js && node tools/session-auth-check.js && node tools/session-commit-check.js && node tools/team-flow-check.js && node tools/team-handler-check.js'
write('package.json', json.dumps(pkg, indent=2) + '\n')

print('Applied Sim03 instructor-managed team allocation update.')
