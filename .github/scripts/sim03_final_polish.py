from pathlib import Path
import re

# Final polish after the main Sim03 conformance/team patch.
# Idempotent enough for the one-time branch workflow.

p=Path('sim03/public/index.html')
s=p.read_text()
s=s.replace("""  reflection1:'',reflection2:'',finished:false,year2Event:0,
""", """  reflection1:'',reflection2:'',finished:false,year2Event:0,viewCommitted:false,
""", 1)
s=s.replace("const committed=!!(S.teamRun?.strategicView||S.year1Outcome||S.year1);",
            "const committed=!!(S.viewCommitted||S.teamRun?.strategicView||S.year1Outcome);")
s=s.replace("""    S.strategicView=v;
    try{if(S.canSubmit)await saveRun({strategicView:v});next()}catch(e){alert(e.message)}
""", """    S.strategicView=v;S.viewCommitted=true;
    try{if(S.canSubmit)await saveRun({strategicView:v});next()}catch(e){alert(e.message)}
""", 1)
s=s.replace("""    if(S.teamRun.strategicView)S.strategicView=S.teamRun.strategicView;
""", """    if(S.teamRun.strategicView){S.strategicView=S.teamRun.strategicView;S.viewCommitted=true}
""", 1)
p.write_text(s)

p=Path('sim03/public/instructor.html')
s=p.read_text()
old="""let facultyCode='',mode='',code=(location.hash||'').replace('#','')||localStorage.getItem('m03-faculty-session')||'',state=null,poll=null,error='',aSel='',bSel='',presentIndex=0;
"""
new="""const savedCode=(location.hash||'').replace('#','')||localStorage.getItem('m03-faculty-session')||'';let facultyCode='',mode='',code='',state=null,poll=null,error='',aSel='',bSel='',presentIndex=0;
"""
if old in s:s=s.replace(old,new,1)
elif new not in s:raise SystemExit('instructor saved-code state marker missing')
s=s.replace("""<div class=\"field\"><label>Resume session code</label><input id=\"resumeCode\" maxlength=\"5\" placeholder=\"ABCDE\"></div>""",
            """<div class=\"field\"><label>Resume session code</label><input id=\"resumeCode\" maxlength=\"5\" value=\"${esc(savedCode)}\" placeholder=\"ABCDE\"></div>""",1)
s=s.replace("""async function resumeSession(){const v=(document.getElementById('resumeCode')?.value||code||'').trim().toUpperCase();if(!v)return;code=v;location.hash=code;localStorage.setItem('m03-faculty-session',code);try{state=await api({action:'faculty_state',code});startPoll();render()}catch(e){error=e.message;code='';render()}}
""", """async function resumeSession(){facultyCode=document.getElementById('fc')?.value.trim()||facultyCode;const v=(document.getElementById('resumeCode')?.value||savedCode||'').trim().toUpperCase();if(!v)return;code=v;location.hash=code;localStorage.setItem('m03-faculty-session',code);try{state=await api({action:'faculty_state',code});startPoll();render()}catch(e){error=e.message;code='';render()}}
""",1)
pat=re.compile(r"function exportCsv\(\)\{.*?\}render\(\);",re.S)
new_export="""function exportCsv(){const cols=['participant','team','run','strategic_view','y1_run','y1_uptime','y1_capacity','y1_connect','y1_features','y2_run','y2_uptime','y2_capacity','y2_connect','y2_features','year3_band','reflection_1','reflection_2'];const q=v=>'\"'+String(v??'').replaceAll('\"','\"\"')+'\"';const out=[];const rs=runs();if(state?.session?.mode==='team'){participants().forEach((p,i)=>{const r=rs.find(x=>x.runId===p.groupId)||{},mine=r.reflections?.[p.id]||{};out.push([p.name,p.teamLabel||p.groupId,i+1,r.strategicView,r.year1?.run,r.year1?.uptime,r.year1?.capacity,r.year1?.connect,r.year1?.features,r.year2?.run,r.year2?.uptime,r.year2?.capacity,r.year2?.connect,r.year2?.features,r.outcomes?.year3?.band,mine.reflection1,mine.reflection2].map(q).join(','))})}else{rs.forEach((r,i)=>out.push(['','',i+1,r.strategicView,r.year1?.run,r.year1?.uptime,r.year1?.capacity,r.year1?.connect,r.year1?.features,r.year2?.run,r.year2?.uptime,r.year2?.capacity,r.year2?.connect,r.year2?.features,r.outcomes?.year3?.band,r.reflection1,r.reflection2].map(q).join(',')))}const nl=String.fromCharCode(10),blob=new Blob([[cols.join(','),...out].join(nl)],{type:'text/csv'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`midland-${code}.csv`;a.click();URL.revokeObjectURL(a.href)}render();"""
if not pat.search(s):raise SystemExit('exportCsv block missing')
s=pat.sub(new_export,s,count=1)
p.write_text(s)

p=Path('sim03/build.js')
s=p.read_text()
s=s.replace("const committed=!!(S.teamRun?.strategicView||S.year1Outcome||S.year1)","const committed=!!(S.viewCommitted||S.teamRun?.strategicView||S.year1Outcome)")
needle="""  'the annual cap is the wall'
]) {
"""
if needle in s:
    s=s.replace(needle,"""  'the annual cap is the wall',
  'const savedCode=',
  'r.reflections?.[p.id]'
]) {
""",1)
p.write_text(s)

p=Path('sim03/tools/team-flow-check.js')
s=p.read_text()
if "viewCommitted" not in s:
    s=s.replace("assert(student.includes('safeToRerender'));","assert(student.includes('safeToRerender'));assert(student.includes('viewCommitted'));",1)
if "r.reflections?.[p.id]" not in s:
    s=s.replace("assert(instructor.includes('dotcount'));","assert(instructor.includes('dotcount'));assert(instructor.includes('r.reflections?.[p.id]'));assert(instructor.includes('const savedCode='));",1)
p.write_text(s)
