from pathlib import Path

p=Path('sim03/api/session.js')
s=p.read_text()
# Preserve explicit/previous captains when moving one student instead of
# silently re-electing every team captain.
s=s.replace("""        const participants = await store.getParticipants(code);
        const rawAssign = b.assign && typeof b.assign === 'object' ? b.assign : {};
        for (const p of Object.values(participants)) {
          if (!p || !Object.prototype.hasOwnProperty.call(rawAssign, p.id)) continue;
          const label = String(rawAssign[p.id] || '').trim().slice(0, 40);
          const norm = label.toLowerCase().replace(/\\s+/g, '-').replace(/[^a-z0-9_-]/g, '');
          p.groupId = norm ? `team:${norm}` : `solo:${p.id}`;
          p.teamLabel = label || p.name;
        }
        const caps = captainMap(participants, b.captains || {});
""", """        const participants = await store.getParticipants(code);
        const previousCaptains = {};
        for (const p of Object.values(participants)) if (p && p.groupId && p.isCaptain) previousCaptains[p.groupId] = p.id;
        const rawAssign = b.assign && typeof b.assign === 'object' ? b.assign : {};
        for (const p of Object.values(participants)) {
          if (!p || !Object.prototype.hasOwnProperty.call(rawAssign, p.id)) continue;
          const label = String(rawAssign[p.id] || '').trim().slice(0, 40);
          if (label.startsWith('team:')) {
            const target = Object.values(participants).find(x => x && x.groupId === label);
            p.groupId = label;
            p.teamLabel = target ? (target.teamLabel || label.slice(5)) : label.slice(5);
          } else if (label === '__solo__' || !label) {
            p.groupId = `solo:${p.id}`;
            p.teamLabel = p.name;
          } else {
            const norm = label.toLowerCase().replace(/\\s+/g, '-').replace(/[^a-z0-9_-]/g, '');
            p.groupId = norm ? `team:${norm}` : `solo:${p.id}`;
            p.teamLabel = label || p.name;
          }
        }
        const caps = captainMap(participants, { ...previousCaptains, ...(b.captains || {}) });
""",1)
# Prefer the platform user id over stale localStorage ids so reloads and device
# switches reattach the same enrolled student reliably.
s=s.replace("""        let id = String(b.participantId || '').trim();
        if (!id && launched && launched.sub) id = `platform:${launched.sub}`;
""", """        let id = launched && launched.sub ? `platform:${launched.sub}` : String(b.participantId || '').trim();
""",1)
p.write_text(s)

p=Path('sim03/public/index.html')
s=p.read_text()
# Only mark the strategic view committed after a successful shared save.
s=s.replace("""    S.strategicView=v;S.viewCommitted=true;
    try{if(S.canSubmit)await saveRun({strategicView:v});next()}catch(e){alert(e.message)}
""", """    S.strategicView=v;
    try{if(S.canSubmit)await saveRun({strategicView:v});S.viewCommitted=true;next()}catch(e){alert(e.message)}
""",1)
p.write_text(s)

p=Path('sim03/public/instructor.html')
s=p.read_text()
# Do not let the two-second poll destroy projector mode.
s=s.replace("""async function refresh(){if(!code)return;try{state=await api({action:'faculty_state',code});if(safeToRerender())render()}catch(e){error=e.message}}
""", """async function refresh(){if(!code)return;try{state=await api({action:'faculty_state',code});if(!document.body.classList.contains('present')&&safeToRerender())render()}catch(e){error=e.message}}
""",1)
# Move controls carry the real group id, preserving the student-authored team label.
s=s.replace("""${groups.filter(g=>g!==p.groupId).map(g=>`<option value=\"${esc(g.replace(/^team:/,''))}\">${esc((ps.find(x=>x.groupId===g)?.teamLabel)||g)}</option>`).join('')}<option value=\"solo\">Solo</option>""", """${groups.filter(g=>g!==p.groupId).map(g=>`<option value=\"${esc(g)}\">${esc((ps.find(x=>x.groupId===g)?.teamLabel)||g)}</option>`).join('')}<option value=\"__solo__\">Solo</option>""",1)
s=s.replace("""const assign={[x.dataset.pid]:x.value==='solo'?'':x.value};""", """const assign={[x.dataset.pid]:x.value};""",1)
p.write_text(s)

p=Path('sim03/tools/team-flow-check.js')
s=p.read_text()
if "previousCaptains" not in s:
    s=s.replace("assert(session.includes('next.finishedBy'));","assert(session.includes('next.finishedBy'));assert(session.includes('previousCaptains'));assert(session.includes('platform:${launched.sub}'));",1)
if "classList.contains('present')" not in s:
    s=s.replace("assert(instructor.includes('startPresent'));","assert(instructor.includes('startPresent'));assert(instructor.includes(\"classList.contains('present')\"));",1)
p.write_text(s)
