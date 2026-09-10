from pathlib import Path

SESSION=Path('sim03/api/session.js')
OUTCOME=Path('sim03/api/outcome.js')
INDEX=Path('sim03/public/index.html')
INSTRUCTOR=Path('sim03/public/instructor.html')
FLOW=Path('sim03/tools/team-flow-check.js')
HANDLER=Path('sim03/tools/team-handler-check.js')

def rep(text, old, new, label):
    if old not in text:
        raise SystemExit(f'missing anchor: {label}')
    return text.replace(old,new,1)

# 1) Students may choose which member is the team's single runner while in lobby.
s=SESSION.read_text()
anchor="""      case 'set_captain': {
        const who = whoIsFaculty(req, b);"""
insert="""      case 'claim_lead': {
        const sess = await store.getSession(code);
        if (!sess) return res.status(404).json({ error: 'no_such_session' });
        if (sess.mode !== 'team') return res.status(409).json({ error: 'not_team_mode' });
        if (sess.state !== 'lobby') {
          return res.status(409).json({ error: 'team_lead_locked', message: 'The team runner is locked once the session starts. Ask the instructor if a handoff is needed.' });
        }
        const participants = await store.getParticipants(code);
        const pid = String(b.participantId || '');
        const chosen = participants[pid];
        if (!chosen) return res.status(404).json({ error: 'no_such_participant' });
        if (!chosen.groupId) return res.status(409).json({ error: 'team_not_assigned', message: 'Wait for the instructor to place you on a team first.' });
        for (const p of Object.values(participants)) {
          if (!p || p.groupId !== chosen.groupId) continue;
          p.isCaptain = p.id === pid;
          await store.setParticipant(code, p.id, p);
        }
        return res.status(200).json({ ok: true, groupId: chosen.groupId, captainId: pid });
      }

      case 'set_captain': {
        const who = whoIsFaculty(req, b);"""
s=rep(s,anchor,insert,'student claim_lead action')
SESSION.write_text(s)

# 2) Non-runners cannot fetch live outcome stages directly. They still receive
# the shared run state and can submit their own reflections when the runner finishes.
o=OUTCOME.read_text()
anchor="""  const me = participants[pid];
  if (!me) { res.status(403).json({ error: 'not_joined' }); return true; }

  const rid = sess.mode === 'individual' ? `individual:${me.id}` : me.groupId;"""
insert="""  const me = participants[pid];
  if (!me) { res.status(403).json({ error: 'not_joined' }); return true; }
  if (sess.mode === 'team' && !me.isCaptain) {
    res.status(403).json({ error: 'team_lead_only', message: 'Only the selected team runner opens and advances the simulation.' });
    return true;
  }

  const rid = sess.mode === 'individual' ? `individual:${me.id}` : me.groupId;"""
o=rep(o,anchor,insert,'outcome team-lead enforcement')
OUTCOME.write_text(o)

# 3) Student UI: one active runner. Teammates wait and later get reflection-only UI.
h=INDEX.read_text()
h=rep(h,
"""    captain_only:'Only your team captain can commit this choice.',
    not_joined:'Rejoin the session before continuing.'""",
"""    captain_only:'Only your team lead can commit this choice.',
    team_lead_only:'Only the selected team runner opens and advances the simulation.',
    team_lead_locked:'The team runner is locked once play starts. Ask the instructor if a handoff is needed.',
    not_joined:'Rejoin the session before continuing.'""",
'friendly team-runner errors')

h=rep(h,
"""  const control=S.canSubmit?'You are the team lead and commit the shared allocation.':'Your team lead commits the shared allocation.';
  return `<div class=\"team\"><b>${teamName} · session ${esc(S.session.code)}</b><br>${roster}<br>${esc(commit)} · ${esc(control)}</div>`;""",
"""  const control=S.canSubmit?'You are the team lead and the one person running this simulation.':'Only your team lead runs the simulation; work together on that device.';
  return `<div class=\"team\"><b>${teamName} · session ${esc(S.session.code)}</b><br>${roster}<br>${esc(commit)} · ${esc(control)}</div>`;""",
'team banner single-runner wording')

h=rep(h,
"""    if(S.teamRun.outcomes)S.allOutcomes=S.teamRun.outcomes;
  }
  if(redraw||(changed&&safeToRerender()))render();""",
"""    if(S.teamRun.outcomes)S.allOutcomes=S.teamRun.outcomes;
    if(S.session?.mode==='team'&&S.teamRun.done)S.finished=true;
  }
  if(redraw||(changed&&safeToRerender()))render();""",
'restore finished teammate state')

h=rep(h,
"""  if(!S.canSubmit&&shared)throw new Error('Your team captain commits this choice.');""",
"""  if(!S.canSubmit&&shared)throw new Error('Only your team lead runs and commits the shared simulation.');""",
'shared-decision error wording')

anchor="""function render(){
  if(!C)return;
  switch(S.step){"""
insert="""function teamLead(){return (S.mates||[]).find(x=>x.isCaptain)||null}
function teamProgressText(){
  const r=S.teamRun||{};
  if((r.phase||0)>=3)return 'The shared run has reached the close. Your individual reflection is ready.';
  if(r.year2)return 'Year 2 is committed. Your team lead is moving through the final consequences.';
  if(r.year1)return 'Year 1 is committed. Your team lead is continuing the shared run.';
  if(r.strategicView)return 'The opening view is committed. Your team lead is working on Year 1.';
  return 'The shared run has not committed its opening view yet.';
}
async function claimTeamLead(){
  try{await sessionApi({action:'claim_lead',code:S.sessionCode,participantId:S.participantId});await pollSession(true)}catch(e){alert(e.message)}
}
function renderTeamLobby(){
  const lead=teamLead(),teamName=S.me?.teamLabel||'Your team';
  shell(`<div class=\"eyebrow\">Team lobby</div><h2>${esc(teamName)} chooses one runner.</h2>
    <p class=\"lede\">Work as a group, but only one student's browser will run Midland. Decide who will operate the simulation for the team before the instructor starts the session.</p>
    <div class=\"card\" style=\"margin-top:22px\"><h3>Current team runner</h3><p>${lead?`<b>${esc(lead.name)}</b> is selected.`:'No runner selected yet.'}</p><p class=\"hint\">Everyone can discuss every decision. The selected runner is the only person who advances screens and commits the shared choices.</p></div>
    ${S.me?.isCaptain?notice('You are currently the team runner. If the group wants someone else, that student can choose “I will run this team” on their own screen.'):`<div class=\"actions\"><button class=\"btn pri\" id=\"claimLeadBtn\">I will run this team</button></div>`}
    ${sessionGate()}`);
  const b=document.getElementById('claimLeadBtn');if(b)b.onclick=claimTeamLead;
}
function renderTeamMemberWaiting(){
  const lead=teamLead(),teamName=S.me?.teamLabel||'Your team',leadName=lead?.name||'your team lead';
  shell(`<div class=\"eyebrow\">Team mode</div><h2>${esc(leadName)} is running ${esc(teamName)}.</h2>
    <p class=\"lede\">Only one browser runs this simulation. Stay with your team and make the decisions together on ${esc(leadName)}'s screen. This browser will not advance through Midland.</p>
    ${notice(teamProgressText())}
    <div class=\"card\"><h3>Your role</h3><p>Discuss, challenge, and help decide. When the team runner reaches the close, your own reflection questions will appear here automatically.</p></div>`);
}
function renderTeamMemberReflection(){
  shell(`<div class=\"eyebrow\">Your reflection</div><h2>The shared team run is complete.</h2>
    <p class=\"lede\">You worked through the decisions with your team on one runner's screen. Now answer these two questions in your own words.</p>
    <div class=\"field\"><label>${esc(C.reflectionPrompts[0])}</label><textarea id=\"r1\" maxlength=\"1500\">${esc(S.reflection1)}</textarea><div class=\"hint reflection-note\">Your instructor can see this response and may read it aloud in the debrief. It is not scored.</div></div>
    <div class=\"field\"><label>${esc(C.reflectionPrompts[1])}</label><textarea id=\"r2\" maxlength=\"1500\">${esc(S.reflection2)}</textarea><div class=\"hint reflection-note\">Your instructor can see this response and may read it aloud in the debrief. It is not scored.</div></div>
    <div class=\"actions\"><button class=\"btn pri\" id=\"memberFinishBtn\">Submit my reflection</button></div>`);
  document.getElementById('memberFinishBtn').onclick=finish;
}
function render(){
  if(!C)return;
  if(S.session?.mode==='team'&&S.me?.groupId){
    if(S.finished)return renderClose();
    if(S.session.state==='lobby')return renderTeamLobby();
    if(!S.me.isCaptain){
      if((S.teamRun?.phase||0)>=3)return renderTeamMemberReflection();
      return renderTeamMemberWaiting();
    }
  }
  switch(S.step){"""
h=rep(h,anchor,insert,'team runner render gate')
INDEX.write_text(h)

# 4) Instructor wording: teams decide the runner; faculty can override if needed.
i=INSTRUCTOR.read_text()
repls=[
("Students join unassigned; you create teams and choose one team lead.","Students join unassigned; you create teams, then each team decides who will run the simulation."),
("In Team mode, students join unassigned. You assign teams and choose one team lead for each team before starting.","In Team mode, students join unassigned. You assign teams; each team decides which one member will run. You can override the runner if needed."),
("Students join unassigned. You create teams, move members, and choose one team lead per team.","Students join unassigned. You create teams and move members; each team chooses one runner."),
("Who is on each team, and who leads it?","Who is on each team, and who runs it?"),
("Students only join the session. You control team membership and select exactly one team lead for each team.","You control team membership. Students decide which one member runs the simulation; use the Team lead selector only if you need to override their choice."),
("<label>Team lead</label>","<label>Team lead / runner</label>")
]
for old,new in repls:
    if old not in i:
        raise SystemExit(f'missing instructor wording anchor: {old}')
    i=i.replace(old,new,1)
INSTRUCTOR.write_text(i)

# 5) Regression checks.
f=FLOW.read_text()
f=rep(f,
"""const session=fs.readFileSync(path.join(root,'api','session.js'),'utf8'),finish=fs.readFileSync(path.join(root,'api','finish.js'),'utf8'),student=fs.readFileSync(path.join(root,'public','index.html'),'utf8'),instructor=fs.readFileSync(path.join(root,'public','instructor.html'),'utf8'),scenario=fs.readFileSync(path.join(root,'lib','scenario.js'),'utf8'),health=fs.readFileSync(path.join(root,'api','health.js'),'utf8');""",
"""const session=fs.readFileSync(path.join(root,'api','session.js'),'utf8'),outcome=fs.readFileSync(path.join(root,'api','outcome.js'),'utf8'),finish=fs.readFileSync(path.join(root,'api','finish.js'),'utf8'),student=fs.readFileSync(path.join(root,'public','index.html'),'utf8'),instructor=fs.readFileSync(path.join(root,'public','instructor.html'),'utf8'),scenario=fs.readFileSync(path.join(root,'lib','scenario.js'),'utf8'),health=fs.readFileSync(path.join(root,'api','health.js'),'utf8');""",'flow check outcome source')
f=f.replace("assert(session.includes(\"case 'set_captain':\"));","assert(session.includes(\"case 'claim_lead':\"));assert(session.includes(\"case 'set_captain':\"));",1)
f=f.replace("assert(student.includes('Waiting for team assignment'));","assert(student.includes('Waiting for team assignment'));assert(student.includes('I will run this team'));assert(student.includes('This browser will not advance through Midland'));assert(student.includes('your own reflection questions will appear here automatically'));",1)
f=f.replace("assert(instructor.includes('Team lead'));","assert(instructor.includes('Team lead / runner'));assert(instructor.includes('Students decide which one member runs the simulation'));",1)
f=f.replace("assert(finish.includes('reflections[sr.pid]'));","assert(finish.includes('reflections[sr.pid]'));assert(outcome.includes(\"error: 'team_lead_only'\"));",1)
f=f.replace("instructor-managed team/classroom flow checks passed","single-runner team/classroom flow checks passed",1)
FLOW.write_text(f)

th=HANDLER.read_text()
anchor="""    r = await invoke({ action: 'group', code, assign: { ann: 'Alpha', ben: 'Alpha' }, facultyCode: 'faculty-secret' });
    assert.equal(r.status, 200); let roster = participants.get(code);
    assert.equal(roster.ann.groupId, 'team:alpha'); assert.equal(roster.ann.isCaptain, true); assert.equal(roster.ben.isCaptain, false);

    r = await invoke({ action: 'rename_team', code, groupId: 'team:alpha', teamLabel: 'Architecture A', facultyCode: 'faculty-secret' });"""
insert="""    r = await invoke({ action: 'group', code, assign: { ann: 'Alpha', ben: 'Alpha' }, facultyCode: 'faculty-secret' });
    assert.equal(r.status, 200); let roster = participants.get(code);
    assert.equal(roster.ann.groupId, 'team:alpha'); assert.equal(roster.ann.isCaptain, true); assert.equal(roster.ben.isCaptain, false);

    // The team can decide which student will be the one runner. A student may
    // claim the team lead role for themselves while the session is in the lobby.
    r = await invoke({ action: 'claim_lead', code, participantId: 'ben' });
    assert.equal(r.status, 200); roster = participants.get(code);
    assert.equal(roster.ben.isCaptain, true); assert.equal(roster.ann.isCaptain, false);

    r = await invoke({ action: 'rename_team', code, groupId: 'team:alpha', teamLabel: 'Architecture A', facultyCode: 'faculty-secret' });"""
th=rep(th,anchor,insert,'claim lead behavior test')

anchor="""    r = await invoke({ action: 'set_captain', code, participantId: 'ben', facultyCode: 'faculty-secret' });
    assert.equal(r.status, 200); roster = participants.get(code); assert.equal(roster.ben.isCaptain, true); assert.equal(roster.ann.isCaptain, false);

    r = await invoke({ action: 'control', code, set: 'start', facultyCode: 'faculty-secret' });
    assert.equal(r.status, 200);
"""
insert="""    // Faculty retains an override for recovery/setup, but the team can reclaim
    // its agreed runner before Start.
    r = await invoke({ action: 'set_captain', code, participantId: 'ann', facultyCode: 'faculty-secret' });
    assert.equal(r.status, 200); roster = participants.get(code); assert.equal(roster.ann.isCaptain, true);
    r = await invoke({ action: 'claim_lead', code, participantId: 'ben' });
    assert.equal(r.status, 200); roster = participants.get(code); assert.equal(roster.ben.isCaptain, true); assert.equal(roster.ann.isCaptain, false);

    r = await invoke({ action: 'control', code, set: 'start', facultyCode: 'faculty-secret' });
    assert.equal(r.status, 200);
    r = await invoke({ action: 'claim_lead', code, participantId: 'ann' });
    assert.equal(r.status, 409); assert.equal(r.body.error, 'team_lead_locked');
"""
th=rep(th,anchor,insert,'lead lock after start test')
th=th.replace('instructor-managed team handler regression checks passed','single-runner team handler regression checks passed',1)
HANDLER.write_text(th)
