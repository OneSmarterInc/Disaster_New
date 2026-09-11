from pathlib import Path

root = Path(__file__).resolve().parents[1]


def replace(path, old, new, label=None):
    p = root / path
    s = p.read_text()
    if old not in s:
        raise SystemExit(f'{label or path}: pattern not found')
    p.write_text(s.replace(old, new, 1))


# --- API: one runner submits the team run; the team run is complete for every member. ---
replace('sim03/api/session.js',
"""function publicRun(run) {
  if (!run) return null;
  return {
    runId: run.runId,
    phase: run.phase || 0,
    screen: screenOf(run),
    year2Event: run.year2Event || 0,
    runnerId: run.runnerId || null,
    runnerRevision: revisionOf(run),
    year1: run.year1 || null,
    year2: run.year2 || null,
    strategicView: run.strategicView || '',
    reflection1: run.reflection1 || '',
    reflection2: run.reflection2 || '',
    outcomes: run.outcomes || null,
    done: !!run.done,
    finishedBy: run.finishedBy || {},
    updatedAt: run.updatedAt || null
  };
}
""",
"""function publicRun(run) {
  if (!run) return null;
  const teamRunComplete = !!run.runId && !String(run.runId).startsWith('individual:') && Number(run.phase || 0) >= 3;
  return {
    runId: run.runId,
    phase: run.phase || 0,
    screen: screenOf(run),
    year2Event: run.year2Event || 0,
    runnerId: run.runnerId || null,
    runnerRevision: revisionOf(run),
    year1: run.year1 || null,
    year2: run.year2 || null,
    strategicView: run.strategicView || '',
    reflection1: run.reflection1 || '',
    reflection2: run.reflection2 || '',
    outcomes: run.outcomes || null,
    done: !!run.done || teamRunComplete,
    finishedBy: run.finishedBy || {},
    updatedAt: run.updatedAt || null
  };
}

function visibleFacultyRuns(sess, runs) {
  if (!sess || sess.mode !== 'team') return runs;
  return Object.fromEntries(Object.entries(runs || {}).map(([id, run]) => {
    const complete = !!run?.done || Number(run?.phase || 0) >= 3;
    return [id, complete ? { ...run, done: true, completedAt: run.completedAt || run.updatedAt || null } : run];
  }));
}
""", 'publicRun block')

replace('sim03/api/session.js',
"""        return res.status(200).json({
          session: { ...sess, joinUrl: sess.platformAuth ? accountJoinUrl(sess) : null },
          participants,
          runs,
          you: who.name,
          defaultThresholds: S.DEFAULT_THRESHOLDS
        });
""",
"""        return res.status(200).json({
          session: { ...sess, joinUrl: sess.platformAuth ? accountJoinUrl(sess) : null },
          participants,
          runs: visibleFacultyRuns(sess, runs),
          you: who.name,
          defaultThresholds: S.DEFAULT_THRESHOLDS
        });
""", 'faculty_state visible runs')

replace('sim03/api/session.js',
"""        if (run && sess.mode === 'team') {
          const mine = rawRun.reflections?.[pid] || {};
          run.reflection1 = mine.reflection1 || '';
          run.reflection2 = mine.reflection2 || '';
          run.done = !!rawRun.finishedBy?.[pid];
        }
""",
"""        if (run && sess.mode === 'team') {
          const runnerReflection = rawRun.reflections?.[runner?.id] || {};
          run.reflection1 = rawRun.reflection1 || runnerReflection.reflection1 || '';
          run.reflection2 = rawRun.reflection2 || runnerReflection.reflection2 || '';
          run.done = !!rawRun.done || Number(rawRun.phase || 0) >= 3;
        }
""", 'team state shared done')

replace('sim03/api/session.js',
"""        if (sess.mode === 'team' && wantsSharedDecision && !isRunner) {
          return res.status(403).json({ error: 'runner_only', message: 'Only the selected simulation runner can submit or advance the shared run.' });
        }
        if (sess.mode === 'team' && !isRunner && b.done && Number(current.phase || 0) < 3) {
          return res.status(409).json({ error: 'team_run_not_complete', message: 'Wait for your team runner to reach the close before submitting your reflection.' });
        }
""",
"""        if (sess.mode === 'team' && (wantsSharedDecision || b.done) && !isRunner) {
          return res.status(403).json({ error: 'runner_only', message: 'Only the selected simulation runner can submit or advance the shared run.' });
        }
""", 'non-runner submit block')

replace('sim03/api/session.js',
"""          if (sess.mode === 'team') {
            next.finishedBy = { ...(current.finishedBy || {}), [pid]: Date.now() };
            const members = Object.values(participants).filter(p => p && p.groupId === rid);
            next.done = members.length > 0 && members.every(m => next.finishedBy[m.id]);
          } else {
            next.done = true;
          }
""",
"""          if (sess.mode === 'team') {
            if (!isRunner) return res.status(403).json({ error: 'runner_only', message: 'Only the selected simulation runner can complete the shared team run.' });
            const finishedAt = Date.now();
            const members = Object.values(participants).filter(p => p && p.groupId === rid);
            next.finishedBy = { ...(current.finishedBy || {}) };
            for (const m of members) next.finishedBy[m.id] = finishedAt;
            next.done = true;
            next.completedBy = pid;
            next.completedByName = me.name;
          } else {
            next.done = true;
          }
""", 'team done block')

# --- Finish endpoint: report the same team result for every platform member who launched the team session. ---
replace('sim03/api/finish.js',
"""  const alreadySaved = beforeSession.mode === 'individual' ? beforeRun?.done : beforeRun?.finishedBy?.[pid];
""",
"""  const alreadySaved = beforeSession.mode === 'individual' ? beforeRun?.done : beforeRun?.done;
""", 'finish alreadySaved')
replace('sim03/api/finish.js',
"""  let y1, y2, outcomes, summary, lessonThresholds;
  try {
    const sr = await sessionRun(req, b);
""",
"""  let y1, y2, outcomes, summary, lessonThresholds, sr = null;
  try {
    sr = await sessionRun(req, b);
""", 'finish sr scope')
replace('sim03/api/finish.js',
"""      const mine = sr.run.reflections?.[sr.pid] || {};
      summary = {
        strategicView: sr.run.strategicView || '', year1: y1, year2: y2,
        reflection1: mine.reflection1 || '', reflection2: mine.reflection2 || '',
        year3Band: outcomes.year3.band
      };
""",
"""      const mine = sr.sess.mode === 'team'
        ? { reflection1: sr.run.reflection1 || '', reflection2: sr.run.reflection2 || '' }
        : (sr.run.reflections?.[sr.pid] || {});
      summary = {
        strategicView: sr.run.strategicView || '', year1: y1, year2: y2,
        reflection1: mine.reflection1 || '', reflection2: mine.reflection2 || '',
        teamRunId: sr.sess.mode === 'team' ? sr.rid : null,
        teamLabel: sr.sess.mode === 'team' ? (sr.me.teamLabel || sr.rid) : null,
        completedBy: sr.sess.mode === 'team' ? (sr.run.completedByName || sr.me.name) : null,
        year3Band: outcomes.year3.band
      };
""", 'finish shared summary')
replace('sim03/api/finish.js',
"""  let report = { ok: false, skipped: true };
  if (launch && (!launch.sim || launch.sim === S.META.id)) report = await reportCompletion({ launch, summary, metrics });
  return res.status(200).json({ ok: true, completionReported: !!report.ok, outcomes, closingLesson });
""",
"""  let report = { ok: false, skipped: true };
  if (launch && (!launch.sim || launch.sim === S.META.id)) {
    let subjects = [launch.sub];
    if (sr && sr.sess.mode === 'team') {
      const teamSubjects = Object.values(sr.participants || {})
        .filter(p => p && p.groupId === sr.rid && String(p.id || '').startsWith('platform:'))
        .map(p => String(p.id).slice('platform:'.length));
      if (teamSubjects.length) subjects = teamSubjects;
    }
    const reports = [];
    for (const sub of [...new Set(subjects)]) {
      reports.push(await reportCompletion({
        launch: { ...launch, sub },
        summary: sr && sr.sess.mode === 'team' ? { ...summary, completedFor: sub } : summary,
        metrics
      }));
    }
    report = { ok: reports.some(r => r.ok), reports };
  }
  return res.status(200).json({ ok: true, completionReported: !!report.ok, outcomes, closingLesson });
""", 'finish multi-member report')

# --- Student UI: non-runners see the shared result; no member reflection page. ---
p = root / 'sim03/public/index.html'
s = p.read_text()
s = s.replace("run_already_completed:'The shared run is complete. Each student can still submit their own reflection.',",
              "run_already_completed:'The shared team run is complete.',")
s = s.replace("if((r.phase||0)>=3)return 'The shared run has reached the close. Your individual reflection is ready.';",
              "if((r.phase||0)>=3)return 'The shared run is complete. The same team result is ready here.';")
s = s.replace("<div class=\"card\"><h3>Your role</h3><p>Discuss, challenge, and help decide. Your individual reflection will appear here after the runner completes the shared run.</p></div>",
              "<div class=\"card\"><h3>Your role</h3><p>Discuss, challenge, and help decide. The same team result will appear here after the runner completes the shared run.</p></div>")
s = s.replace("if((S.teamRun?.phase||0)>=3)return renderTeamMemberReflection();\n      return renderTeamMemberWaiting();",
              "return renderTeamMemberWaiting();")
s = s.replace("  if(S.finished){\n    const y1o=S.allOutcomes?.year1||S.year1Outcome||null;",
              "  if(S.finished){\n    const teamMode=S.session?.mode==='team';\n    const y1o=S.allOutcomes?.year1||S.year1Outcome||null;")
old_ref = """    <div class=\"result-section\"><div class=\"eyebrow\">Your reflections</div>
      <div class=\"card\"><h3>${esc(C.reflectionPrompts[0])}</h3><p style=\"white-space:pre-wrap\">${esc(S.reflection1||'—')}</p></div>
      <div class=\"card\" style=\"margin-top:12px\"><h3>${esc(C.reflectionPrompts[1])}</h3><p style=\"white-space:pre-wrap\">${esc(S.reflection2||'—')}</p></div>
    </div>
    ${closingLessonHTML()}
"""
new_ref = """    ${teamMode?`<div class=\"result-section\"><div class=\"eyebrow\">Team submission</div><div class=\"card\"><p>The selected runner submitted this shared result for the whole team. Every team member sees the same outcome.</p></div></div>`:`<div class=\"result-section\"><div class=\"eyebrow\">Your reflections</div>
      <div class=\"card\"><h3>${esc(C.reflectionPrompts[0])}</h3><p style=\"white-space:pre-wrap\">${esc(S.reflection1||'—')}</p></div>
      <div class=\"card\" style=\"margin-top:12px\"><h3>${esc(C.reflectionPrompts[1])}</h3><p style=\"white-space:pre-wrap\">${esc(S.reflection2||'—')}</p></div>
    </div>
    ${closingLessonHTML()}`}
"""
if old_ref not in s:
    raise SystemExit('student final reflections block not found')
s = s.replace(old_ref, new_ref, 1)
p.write_text(s)

# --- Instructor UI: stable team list ordering and less jumping while polling. ---
p = root / 'sim03/public/instructor.html'
s = p.read_text()
s = s.replace('.team-card{border:1px solid var(--l2);background:var(--p2);padding:15px}',
              '.team-card{border:1px solid var(--l2);background:var(--p2);padding:15px;min-height:150px}')
s = s.replace('.member-row{display:grid;grid-template-columns:1fr minmax(160px,.7fr);gap:10px;align-items:center;border-top:1px solid var(--l);padding-top:8px}',
              '.member-row{display:grid;grid-template-columns:1fr minmax(160px,.7fr);gap:10px;align-items:center;border-top:1px solid var(--l);padding-top:8px;min-height:54px}')
s = s.replace("const notice=(s,b=false)=>`<div class=\"notice ${b?'bad':''}\">${esc(s)}</div>`;const vals=o=>Object.values(o||{}).filter(Boolean),participants=()=>vals(state?.participants),runs=()=>vals(state?.runs);",
              "const notice=(s,b=false)=>`<div class=\"notice ${b?'bad':''}\">${esc(s)}</div>`;const vals=o=>Object.values(o||{}).filter(Boolean);function stablePeople(list){return list.slice().sort((a,b)=>(a.joinedAt||0)-(b.joinedAt||0)||String(a.name||'').localeCompare(String(b.name||''))||String(a.id||'').localeCompare(String(b.id||'')))}const participants=()=>stablePeople(vals(state?.participants)),runs=()=>vals(state?.runs).sort((a,b)=>String(a.runId||'').localeCompare(String(b.runId||'')));", 1)
old_tg = "function teamGroups(ps){const by={};ps.filter(p=>p&&p.groupId).forEach(p=>{const g=by[p.groupId]||(by[p.groupId]={groupId:p.groupId,label:p.teamLabel||String(p.groupId).replace(/^team:/,'')||'Team',members:[]});if(p.teamLabel)g.label=p.teamLabel;g.members.push(p)});return Object.values(by).sort((a,b)=>String(a.label).localeCompare(String(b.label)))}"
new_tg = "function teamGroups(ps){const by={};stablePeople(ps.filter(p=>p&&p.groupId)).forEach(p=>{const g=by[p.groupId]||(by[p.groupId]={groupId:p.groupId,label:p.teamLabel||String(p.groupId).replace(/^team:/,'')||'Team',members:[]});if(p.teamLabel)g.label=p.teamLabel;g.members.push(p)});const order=g=>{const m=String(g.label||'').match(/(\\d+)/);return m?Number(m[1]):9999};return Object.values(by).map(g=>({...g,members:stablePeople(g.members)})).sort((a,b)=>order(a)-order(b)||String(a.label).localeCompare(String(b.label))||String(a.groupId).localeCompare(String(b.groupId)))}"
if old_tg not in s:
    raise SystemExit('teamGroups block not found')
s = s.replace(old_tg, new_tg, 1)
s = s.replace("const q=v=>'\"'+String(v??'').replaceAll('\"','\"\"')+'\"';const out=[];const rs=runs();if(state?.session?.mode==='team'){participants().forEach((p,i)=>{const r=rs.find(x=>x.runId===p.groupId)||{},mine=r.reflections?.[p.id]||{};out.push([p.name,p.teamLabel||p.groupId,i+1,r.strategicView,r.year1?.run,r.year1?.uptime,r.year1?.capacity,r.year1?.connect,r.year1?.features,r.year2?.run,r.year2?.uptime,r.year2?.capacity,r.year2?.connect,r.year2?.features,r.outcomes?.year3?.band,r.outcomes?.buyers?.carrolton?.interest,r.outcomes?.buyers?.ridge_hollow?.interest,r.outcomes?.buyers?.corven?.interest,mine.reflection1,mine.reflection2].map(q).join(','))})}",
              "const q=v=>'\"'+String(v??'').replaceAll('\"','\"\"')+'\"';const out=[];const rs=runs();if(state?.session?.mode==='team'){participants().forEach((p,i)=>{const r=rs.find(x=>x.runId===p.groupId)||{},mine=r.reflections?.[r.completedBy]||{reflection1:r.reflection1,reflection2:r.reflection2};out.push([p.name,p.teamLabel||p.groupId,i+1,r.strategicView,r.year1?.run,r.year1?.uptime,r.year1?.capacity,r.year1?.connect,r.year1?.features,r.year2?.run,r.year2?.uptime,r.year2?.capacity,r.year2?.connect,r.year2?.features,r.outcomes?.year3?.band,r.outcomes?.buyers?.carrolton?.interest,r.outcomes?.buyers?.ridge_hollow?.interest,r.outcomes?.buyers?.corven?.interest,mine.reflection1,mine.reflection2].map(q).join(','))})}", 1)
p.write_text(s)

# --- Update source-level and handler/UI tests to match runner-only team completion. ---
p = root / 'sim03/tools/team-flow-check.js'
s = p.read_text()
s = s.replace("'platform:${launched.sub}', 'team_run_not_complete', 'compareAndSetRun', 'runnerRevision'",
              "'platform:${launched.sub}', 'completedBy', 'compareAndSetRun', 'runnerRevision'")
s = s.replace("assert(finish.includes('team_run_not_complete'));",
              "assert(finish.includes('teamSubjects'));\nassert(finish.includes('completedFor'));\nassert(finish.includes('beforeRun?.done'));", 1)
s = s.replace("'Your individual reflection will appear here'", "'same team result will appear here'")
s = s.replace("'r.reflections?.[p.id]'", "'r.reflections?.[r.completedBy]'")
p.write_text(s)

p = root / 'sim03/tools/team-runner-ui-check.js'
s = p.read_text()
s = s.replace("""  // Own draft reflections survive polling; submitted peer content is never used.
  run(\"S.reflectionDirty=true; S.reflection1='My unsaved draft'; S.participantId='ann'\");
  response = data({ runner: 'ben', pid: 'ann', revision: 3, shared: { ...shared, phase: 3, screen: 10, reflection1: '' } });
  await run('pollSession(true)');
  assert(html.includes('My unsaved draft'));
  assert(html.includes('id=\"memberFinishBtn\"'));
  assert(!html.includes('id=\"nextBtn\"'));
  assert.equal(alerts.length, 0);
  console.log('RapidSim 03 runner UI checks passed (selection, observer gating, handoff/reload, focus revocation, stale polls, reflection drafts).');
""",
"""  // When the runner completes, members see the same result instead of a separate reflection form.
  run(\"S.reflectionDirty=true; S.reflection1='My unsaved draft'; S.participantId='ann'\");
  response = data({ runner: 'ben', pid: 'ann', revision: 3, shared: { ...shared, phase: 3, screen: 10, done: true, reflection1: '' } });
  await run('pollSession(true)');
  assert(html.includes('Team submission'));
  assert(!html.includes('id=\"memberFinishBtn\"'));
  assert(!html.includes('id=\"nextBtn\"'));
  assert.equal(alerts.length, 0);
  console.log('RapidSim 03 runner UI checks passed (selection, observer gating, handoff/reload, focus revocation, stale polls, runner-only completion).');
""", 1)
p.write_text(s)

p = root / 'sim03/tools/team-handler-check.js'
s = p.read_text()
s = s.replace("check((await submit('ann', { done: true }, 1)).body.error, 'team_run_not_complete');\n    check((await invoke({ sessionCode: code, participantId: 'ann', done: true }, finish)).body.error, 'team_run_not_complete');",
              "check((await submit('ann', { done: true }, 1)).body.error, 'runner_only');\n    check((await invoke({ sessionCode: code, participantId: 'ann', done: true }, finish)).body.error, 'runner_only');")
s = s.replace("""    check((await state(runner)).run.done, true);
    const members = ['ann', 'ben', 'cal'].filter(id => id !== runner);
    check((await state(members[0])).run.reflection1, '', 'a teammate must never inherit the runner\\'s reflection');
    check((await state(members[0])).run.done, false);
    const reflections = await Promise.all(members.map(id => invoke({ sessionCode: code, participantId: id, reflection1: `${id} one`, reflection2: `${id} two` }, finish)));
    check(reflections.map(x => x.status), [200, 200]);
    check(runs.get(code)['team:alpha'].done, true);
    for (const id of members) check((await state(id)).run.reflection1, `${id} one`);
    check(Object.keys(runs.get(code)['team:alpha'].finishedBy).sort(), ['ann', 'ben', 'cal']);
""",
"""    check((await state(runner)).run.done, true);
    const members = ['ann', 'ben', 'cal'].filter(id => id !== runner);
    check((await state(members[0])).run.done, true, 'runner completion finishes the shared run for teammates');
    check((await state(members[0])).run.reflection1, 'Runner one', 'teammates see the same submitted team summary');
    check((await invoke({ sessionCode: code, participantId: members[0], reflection1: `${members[0]} one`, reflection2: `${members[0]} two`, done: true }, finish)).body.error, 'runner_only');
    check(runs.get(code)['team:alpha'].done, true);
    check(Object.keys(runs.get(code)['team:alpha'].finishedBy).sort(), ['ann', 'ben', 'cal']);
""", 1)
p.write_text(s)

p = root / 'sim03/tools/team-runner-browser-check.js'
s = p.read_text()
old = """  check((await api({ action: 'submit', code, participantId: calId, reflection1: 'Premature', done: true })).body.error, 'team_run_not_complete', 'Member cannot complete before runner');
  await ann.locator('#r1').fill('Ann learned why reliable service needs an information foundation.');
  await ann.locator('#r2').fill('Ann would revisit the balance between uptime and connection.');
  await ann.locator('#finishBtn').click();
  await ann.waitForFunction(() => S.finished && !!S.closingLesson);
  await ben.locator('#memberFinishBtn').waitFor({ state: 'visible' });
  await cal.locator('#memberFinishBtn').waitFor({ state: 'visible' });
  check(await ben.locator('#r1').inputValue(), '', 'Member does not inherit runner reflection');
  await ben.locator('#r1').fill('Ben personal reflection, not Ann response.');
  await ben.locator('#r2').fill('Ben second response.');
  await cal.locator('#r1').fill('Cal personal reflection, not Ben response.');
  await cal.locator('#r2').fill('Cal second response.');
  await Promise.all([ben.locator('#memberFinishBtn').click(), cal.locator('#memberFinishBtn').click()]);
  await ben.waitForFunction(() => S.finished && !!S.closingLesson);
  await cal.waitForFunction(() => S.finished && !!S.closingLesson);
  const facultyState = await api({ action: 'faculty_state', code, facultyCode: faculty });
  const run = facultyState.body.runs['team:alpha'];
  check(Object.keys(facultyState.body.runs), ['team:alpha'], 'Exactly one team run exists');
  check(run.done, true, 'Shared run completes after all personal reflections');
  check(run.reflections[benId].reflection1, 'Ben personal reflection, not Ann response.', 'Concurrent completion preserves Ben reflection');
  check(run.reflections[calId].reflection1, 'Cal personal reflection, not Ben response.', 'Concurrent completion preserves Cal reflection');
  check(Object.keys(run.finishedBy).length, 3, 'Every student is recorded as finished');
  check(evalCalls > 15, true, 'Real Redis executed the production compare-and-set Lua');
  await snapshot('04-completed-team-result', ben);
"""
new = """  check((await api({ action: 'submit', code, participantId: calId, reflection1: 'Premature', done: true })).body.error, 'runner_only', 'Member cannot complete; only the runner submits');
  await ann.locator('#r1').fill('Ann learned why reliable service needs an information foundation.');
  await ann.locator('#r2').fill('Ann would revisit the balance between uptime and connection.');
  await ann.locator('#finishBtn').click();
  await ann.waitForFunction(() => S.finished && !!S.closingLesson);
  await ben.waitForFunction(() => S.finished && !!S.teamRun?.done && document.querySelector('.result-hero'));
  await cal.waitForFunction(() => S.finished && !!S.teamRun?.done && document.querySelector('.result-hero'));
  check(await ben.locator('#memberFinishBtn').count(), 0, 'Member is not asked for a separate final reflection');
  check(await cal.locator('#memberFinishBtn').count(), 0, 'Other member is not asked for a separate final reflection');
  const annOverall = await ann.locator('.result-hero p').textContent();
  check(await ben.locator('.result-hero p').textContent(), annOverall, 'All team members see the same overall result');
  check(await cal.locator('.result-hero p').textContent(), annOverall, 'Every teammate sees the same outcome cards');
  const facultyState = await api({ action: 'faculty_state', code, facultyCode: faculty });
  const run = facultyState.body.runs['team:alpha'];
  check(Object.keys(facultyState.body.runs), ['team:alpha'], 'Exactly one team run exists');
  check(run.done, true, 'Shared run completes when the runner submits');
  check(run.reflections[annId].reflection1, 'Ann learned why reliable service needs an information foundation.', 'Runner reflection is the team completion reflection');
  check(Object.keys(run.finishedBy).length, 3, 'Every student is recorded as finished by runner submission');
  check(evalCalls > 15, true, 'Real Redis executed the production compare-and-set Lua');
  await snapshot('04-completed-team-result', ben);
"""
if old not in s:
    raise SystemExit('browser team completion block not found')
s = s.replace(old, new, 1)
s = s.replace("check(exported.includes('Ben personal reflection') && exported.includes('Cal personal reflection') && exported.includes('Ann learned'), true, 'Instructor CSV export includes all separate personal reflections');",
              "check(exported.includes('Test Ann') && exported.includes('Test Ben') && exported.includes('Test Cal') && exported.includes('Ann learned'), true, 'Instructor CSV export includes each team member with the shared result');")
p.write_text(s)

# Build marker text should no longer require the old non-runner reflection promise.
p = root / 'sim03/build.js'
s = p.read_text()
s = s.replace("'Join a facilitated session', 'Waiting for team assignment', 'function safeToRerender()', 'Team mode · read-only',",
              "'Join a facilitated session', 'Waiting for team assignment', 'function safeToRerender()', 'Team mode · read-only',")
p.write_text(s)

print('Applied runner-only team completion patch.')
