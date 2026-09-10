from pathlib import Path

SESSION=Path('sim03/api/session.js')
FINISH=Path('sim03/api/finish.js')
INDEX=Path('sim03/public/index.html')
FLOW=Path('sim03/tools/team-flow-check.js')
HANDLER=Path('sim03/tools/team-handler-check.js')

def rep(text, old, new, label):
    if old not in text:
        raise SystemExit(f'missing anchor: {label}')
    return text.replace(old,new,1)

# Non-runners may submit reflections only after the runner has reached the close.
s=SESSION.read_text()
anchor="""        const rid = runIdFor(sess, me);
        const runs = await store.getRuns(code);
        const current = runs[rid] || { runId: rid, phase: 0, done: false, createdAt: Date.now() };
        if (current.done && (wantsSharedDecision || sess.mode === 'individual')) {"""
insert="""        const rid = runIdFor(sess, me);
        const runs = await store.getRuns(code);
        const current = runs[rid] || { runId: rid, phase: 0, done: false, createdAt: Date.now() };
        if (sess.mode === 'team' && !me.isCaptain && b.done && Number(current.phase || 0) < 3) {
          return res.status(409).json({ error: 'team_run_not_complete', message: 'Wait for your team runner to reach the close before submitting your reflection.' });
        }
        if (current.done && (wantsSharedDecision || sess.mode === 'individual')) {"""
s=rep(s,anchor,insert,'non-runner reflection sequencing')
SESSION.write_text(s)

# The finish endpoint gets the same server-side sequencing guard so a direct
# request cannot skip the waiting state.
f=FINISH.read_text()
anchor="""  const run = rid ? (await store.getRuns(code))[rid] : null;
  if (!run || !run.year1 || !run.year2) {
    const e = new Error('allocations_incomplete'); e.status = 409; throw e;
  }
  return { sess, run, participants, me, rid, code, pid };"""
insert="""  const run = rid ? (await store.getRuns(code))[rid] : null;
  if (!run || !run.year1 || !run.year2) {
    const e = new Error('allocations_incomplete'); e.status = 409; throw e;
  }
  if (sess.mode === 'team' && !me.isCaptain && Number(run.phase || 0) < 3) {
    const e = new Error('team_run_not_complete'); e.status = 409; throw e;
  }
  return { sess, run, participants, me, rid, code, pid };"""
f=rep(f,anchor,insert,'finish non-runner reflection sequencing')
FINISH.write_text(f)

# Align student copy and error handling with the student-chosen runner flow.
h=INDEX.read_text()
h=rep(h,
"""    team_lead_locked:'The team runner is locked once play starts. Ask the instructor if a handoff is needed.',
    not_joined:'Rejoin the session before continuing.'""",
"""    team_lead_locked:'The team runner is locked once play starts. Ask the instructor if a handoff is needed.',
    team_run_not_complete:'Wait for your team runner to reach the close before submitting your reflection.',
    not_joined:'Rejoin the session before continuing.'""",
'friendly team-run-not-complete error')
h=rep(h,
"""  if(!S.me?.groupId)return `<div class=\"team\"><b>Waiting for team assignment · session ${esc(S.session.code)}</b><br>Your instructor will place you on a team and choose the team lead. Stay on this page; it updates automatically.</div>`;""",
"""  if(!S.me?.groupId)return `<div class=\"team\"><b>Waiting for team assignment · session ${esc(S.session.code)}</b><br>Your instructor will place you on a team. Once assigned, your team can decide which one student will run the simulation. Stay on this page; it updates automatically.</div>`;""",
'unassigned team wording')
INDEX.write_text(h)

# Behavioral test: a non-runner cannot finish early; runner reaches the close
# first; then teammates can submit their individual reflections.
t=HANDLER.read_text()
old="""    r = await invoke({ action: 'submit', code, participantId: 'ann', reflection1: 'Ann one', reflection2: 'Ann two', done: true }); assert.equal(r.status, 200);
    let teamRun = (runs.get(code) || {})['team:alpha']; assert.equal(teamRun.done, false);
    r = await invoke({ action: 'group', code, assign: { cal: '__unassigned__' }, facultyCode: 'faculty-secret' }); assert.equal(r.status, 200); roster = participants.get(code); assert.equal(roster.cal.groupId, null); assert.equal(roster.ben.isCaptain, true);
    r = await invoke({ action: 'submit', code, participantId: 'ben', reflection1: 'Ben one', reflection2: 'Ben two', done: true }); assert.equal(r.status, 200);
    teamRun = (runs.get(code) || {})['team:alpha']; assert.equal(teamRun.done, true, 'shared run completes when every current assigned member is finished');

    r = await invoke({ action: 'state', code, participantId: 'ann' }); assert.equal(r.status, 200); assert.equal(r.body.run.reflection1, 'Ann one'); assert.equal(r.body.run.done, true);"""
new="""    r = await invoke({ action: 'submit', code, participantId: 'ann', reflection1: 'Ann early', reflection2: 'Too early', done: true });
    assert.equal(r.status, 409); assert.equal(r.body.error, 'team_run_not_complete');
    r = await invoke({ action: 'group', code, assign: { cal: '__unassigned__' }, facultyCode: 'faculty-secret' }); assert.equal(r.status, 200); roster = participants.get(code); assert.equal(roster.cal.groupId, null); assert.equal(roster.ben.isCaptain, true);
    r = await invoke({ action: 'submit', code, participantId: 'ben', reflection1: 'Ben one', reflection2: 'Ben two', done: true }); assert.equal(r.status, 200);
    let teamRun = (runs.get(code) || {})['team:alpha']; assert.equal(teamRun.phase, 3); assert.equal(teamRun.done, false, 'runner reaching the close unlocks teammate reflections but does not finish them');
    r = await invoke({ action: 'submit', code, participantId: 'ann', reflection1: 'Ann one', reflection2: 'Ann two', done: true }); assert.equal(r.status, 200);
    teamRun = (runs.get(code) || {})['team:alpha']; assert.equal(teamRun.done, true, 'shared run completes when every current assigned member is finished');

    r = await invoke({ action: 'state', code, participantId: 'ann' }); assert.equal(r.status, 200); assert.equal(r.body.run.reflection1, 'Ann one'); assert.equal(r.body.run.done, true);"""
t=rep(t,old,new,'runner-first reflection behavior test')
HANDLER.write_text(t)

# Static coverage for the new server-side sequencing guard and corrected copy.
q=FLOW.read_text()
q=q.replace("assert(finish.includes('reflections[sr.pid]'));assert(outcome.includes(\"error: 'team_lead_only'\"));",
            "assert(finish.includes('reflections[sr.pid]'));assert(finish.includes('team_run_not_complete'));assert(session.includes('team_run_not_complete'));assert(outcome.includes(\"error: 'team_lead_only'\"));",1)
q=q.replace("assert(student.includes('Waiting for team assignment'));",
            "assert(student.includes('Waiting for team assignment'));assert(student.includes('your team can decide which one student will run the simulation'));",1)
FLOW.write_text(q)
