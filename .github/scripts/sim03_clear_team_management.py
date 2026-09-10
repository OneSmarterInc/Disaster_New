from pathlib import Path

INSTRUCTOR = Path('sim03/public/instructor.html')
INDEX = Path('sim03/public/index.html')
BUILD = Path('sim03/build.js')


def replace_once(text, old, new, label):
    if old not in text:
        raise SystemExit(f'missing anchor: {label}')
    return text.replace(old, new, 1)

h = INSTRUCTOR.read_text()

# Make the roster read as actual teams rather than a participant table with
# unexplained radio buttons and a "Keep" select.
css_old = ".thresholds{display:grid;grid-template-columns:repeat(2,1fr);gap:8px}.presentbar"
css_new = ".thresholds{display:grid;grid-template-columns:repeat(2,1fr);gap:8px}.team-help{margin:14px 0 18px;padding:13px 15px;border-left:2px solid var(--a);background:rgba(240,166,60,.05);color:#cbc8c0}.team-help b{color:var(--b);font-weight:500}.team-help ol{margin:8px 0 0 20px;padding:0}.team-help li{margin:5px 0}.team-groups{display:grid;gap:12px;margin-top:14px}.team-card{border:1px solid var(--l2);background:var(--p2)}.team-card-head{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:13px 15px;border-bottom:1px solid var(--l)}.team-card-head h4{font-size:21px;font-weight:400;margin:2px 0 0}.team-count{font:10px var(--m);letter-spacing:.1em;text-transform:uppercase;color:var(--dd)}.team-captain-line{padding:10px 15px;border-bottom:1px solid var(--l);font-size:14px;color:var(--d)}.team-captain-line b{color:var(--a);font-weight:500}.team-member{display:grid;grid-template-columns:minmax(180px,1fr) minmax(320px,1.4fr);gap:14px;align-items:center;padding:12px 15px;border-bottom:1px solid var(--l)}.team-member:last-child{border-bottom:0}.team-member-name b{display:block;font-size:17px;font-weight:500;color:var(--b)}.team-member-name span{display:block;font-size:12px;color:var(--dd);margin-top:2px}.team-member-actions{display:flex;justify-content:flex-end;align-items:end;gap:10px;flex-wrap:wrap}.captain-badge{display:inline-flex;align-items:center;min-height:36px;padding:7px 10px;border:1px solid #8A6427;background:rgba(240,166,60,.08);font:600 9px var(--m);letter-spacing:.1em;text-transform:uppercase;color:var(--a)}.team-move{min-width:220px}.team-move span{display:block;font:9px var(--m);letter-spacing:.08em;text-transform:uppercase;color:var(--dd);margin-bottom:4px}.team-move select{width:100%;background:var(--n);border:1px solid var(--l2);padding:8px 9px;color:var(--b)}@media(max-width:760px){.team-member{grid-template-columns:1fr}.team-member-actions{justify-content:flex-start}.team-move{min-width:100%;width:100%}}.presentbar"
h = replace_once(h, css_old, css_new, 'team management styles')

old_teams = "function teams(ps,s){const groups=[...new Set(ps.map(p=>p.groupId).filter(Boolean))];return `<section class=\"card full\"><div class=\"meta\">Team roster</div><h3>Teams and captains</h3><p>Students name their own teams at join. Faculty can move a student or hand off captaincy before or after start.</p>${ps.length?`<table><thead><tr><th>Participant</th><th>Team</th><th>Captain</th><th>Move</th></tr></thead><tbody>${ps.map(p=>`<tr><td>${esc(p.name)}</td><td>${esc(p.teamLabel||p.groupId||'Solo')}</td><td><input type=\"radio\" name=\"cap-${esc(p.groupId||p.id)}\" class=\"cap\" data-pid=\"${p.id}\" ${p.isCaptain?'checked':''}></td><td><select class=\"move\" data-pid=\"${p.id}\"><option value=\"\">Keep</option>${groups.filter(g=>g!==p.groupId).map(g=>`<option value=\"${esc(g)}\">${esc((ps.find(x=>x.groupId===g)?.teamLabel)||g)}</option>`).join('')}<option value=\"__solo__\">Solo</option></select></td></tr>`).join('')}</tbody></table>`:notice('Waiting for participants to join.')}</section>`}"
new_teams = """function teams(ps,s){
  const groups=[...new Set(ps.map(p=>p.groupId).filter(Boolean))];
  if(!ps.length)return `<section class=\"card full\"><div class=\"meta\">Team roster</div><h3>Build the teams</h3>${notice('Waiting for participants to join.')}</section>`;
  const labelFor=g=>ps.find(x=>x.groupId===g)?.teamLabel||g.replace(/^team:/,'')||'Team';
  const cards=groups.map((g,i)=>{
    const members=ps.filter(p=>p.groupId===g),captain=members.find(p=>p.isCaptain),label=labelFor(g);
    const rows=members.map(p=>{
      const other=groups.filter(x=>x!==g).map(x=>`<option value=\"${esc(x)}\">Move to ${esc(labelFor(x))}</option>`).join('');
      const leader=p.isCaptain
        ? '<span class=\"captain-badge\">Captain · commits for team</span>'
        : `<button class=\"btn make-cap\" data-pid=\"${esc(p.id)}\">Make captain</button>`;
      return `<div class=\"team-member\"><div class=\"team-member-name\"><b>${esc(p.name)}</b><span>${p.isCaptain?'Leads and commits the shared decisions':'Team member · discusses and follows the shared decisions'}</span></div><div class=\"team-member-actions\">${leader}<label class=\"team-move\"><span>Change team for ${esc(p.name)}</span><select class=\"move\" data-pid=\"${esc(p.id)}\"><option value=\"\">Stay in ${esc(label)}</option>${other}<option value=\"__new__\">Create a new team…</option><option value=\"__solo__\">Move to own team</option></select></label></div></div>`;
    }).join('');
    return `<div class=\"team-card\"><div class=\"team-card-head\"><div><div class=\"meta\">Team ${i+1}</div><h4>${esc(label)}</h4></div><div class=\"team-count\">${members.length} student${members.length===1?'':'s'}</div></div><div class=\"team-captain-line\">Captain: <b>${esc(captain?.name||'not assigned')}</b> · the captain is the only student who commits the team's shared view and allocations.</div>${rows}</div>`;
  }).join('');
  return `<section class=\"card full\"><div class=\"meta\">Team setup</div><h3>Who is together, and who leads?</h3><div class=\"team-help\"><b>How team mode works</b><ol><li>Students who enter the same team name are grouped together automatically.</li><li>Each team has one captain. The captain is the only person who commits the shared decisions.</li><li>Use <b>Make captain</b> to change the leader. Use <b>Change team</b> to move a student or create another team.</li></ol></div><div class=\"team-groups\">${cards}</div></section>`;
}"""
h = replace_once(h, old_teams, new_teams, 'teams roster')

old_wire = "document.querySelectorAll('.cap').forEach(x=>x.onchange=async()=>{if(!x.checked)return;try{await api({action:'set_captain',code,participantId:x.dataset.pid});await refresh()}catch(e){alert(e.message)}});document.querySelectorAll('.move').forEach(x=>x.onchange=async()=>{if(!x.value)return;const assign={[x.dataset.pid]:x.value};try{await api({action:'group',code,assign});await refresh()}catch(e){alert(e.message)}});"
new_wire = "document.querySelectorAll('.make-cap').forEach(x=>x.onclick=async()=>{try{await api({action:'set_captain',code,participantId:x.dataset.pid});await refresh()}catch(e){alert(e.message)}});document.querySelectorAll('.move').forEach(x=>x.onchange=async()=>{let target=x.value;if(!target)return;if(target==='__new__'){const name=window.prompt('Name the new team');if(!name||!name.trim()){x.value='';return}target=name.trim().slice(0,40)}const assign={[x.dataset.pid]:target};try{await api({action:'group',code,assign});await refresh()}catch(e){alert(e.message);x.value=''}});"
h = replace_once(h, old_wire, new_wire, 'team management wiring')
INSTRUCTOR.write_text(h)

# Clarify the student-side rule without changing join behavior.
i = INDEX.read_text()
old_join = '<div class="field"><label>Team name <span class="hint">(team sessions only)</span></label><input id="teamName" maxlength="40" placeholder="Agree a short name with your table"></div>'
new_join = '<div class="field"><label>Team name <span class="hint">(team sessions only)</span></label><input id="teamName" maxlength="40" placeholder="Agree a short name with your table"><div class="hint">Students who enter the same team name join the same group. One member will be the captain.</div></div>'
i = replace_once(i, old_join, new_join, 'student team-name hint')
INDEX.write_text(i)

# Lock the clarity cues into the build without changing gameplay tests.
b = BUILD.read_text()
anchor = "for (const marker of ['Resume session code','Students self-select teams at join',\"action:'set_captain'\",'function startPresent()','dotcount','the annual cap is the wall'])\n  if (!instructor.includes(marker)) refuse('team/projector instructor marker missing: ' + marker);"
replacement = anchor + "\nfor (const marker of ['How team mode works','Captain · commits for team','Make captain','Change team for','Create a new team…','Who is together, and who leads?'])\n  if (!instructor.includes(marker)) refuse('clear team-management marker missing: ' + marker);\nif (!index.includes('Students who enter the same team name join the same group. One member will be the captain.')) refuse('student team grouping explanation missing');"
b = replace_once(b, anchor, replacement, 'build team clarity guards')
BUILD.write_text(b)
