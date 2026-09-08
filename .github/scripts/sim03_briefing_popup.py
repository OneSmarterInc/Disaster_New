from pathlib import Path

SCENARIO = Path('sim03/lib/scenario.js')
INDEX = Path('sim03/public/index.html')


def replace_once(text, old, new, label):
    if old not in text:
        raise SystemExit(f'missing anchor: {label}')
    return text.replace(old, new, 1)

# Keep the briefing packet content in the server-owned public config so the
# allocation reference panel and the first-page modal share one source.
s = SCENARIO.read_text()
s = replace_once(s,
"""    briefing: {
      title: 'Midland Equipment — Briefing & exhibits',
      note: 'Reference copy of the pre-class packet. It is collapsed by default so the simulation does not reteach the briefing.',
      company: [
""",
"""    briefing: {
      title: 'Midland Equipment — Briefing & exhibits',
      note: 'Reference copy of the pre-class packet. It is collapsed by default so the simulation does not reteach the briefing.',
      intro: [
        'Read this before Tuesday. It is the only preparation for the class.',
        'You are about to take over technology decisions at Midland Equipment. On Tuesday your team will spend three years of the company’s money in eighty minutes. Nobody will re-explain this packet in class, and the teams that read it carefully will run the room. It should take you about six minutes.'
      ],
      company: [
""", 'briefing intro')

s = replace_once(s,
"""      ]
    },
    coldOpen: [
""",
"""      ],
      people: [
        { role: 'The CFO', quote: 'Six million dollars a year keeps the lights on and produces nothing new. Every conversation we have should start with getting that number down.' },
        { role: 'The VP of Service', quote: 'I do not need software. I need eight more technicians. Every dollar you spend on a system is a dollar that did not go to a truck.' },
        { role: 'The CEO', quote: 'In eighteen months I have to stand in front of the board and show them something. I do not care what it is. I care that it is real.' },
        { role: 'A technician, 22 years at Midland', quote: 'Those machines have been telling us they were about to fail for years. There has never been anywhere to put what they say.' }
      ],
      peopleNote: 'All four of them are reasonable. None of them is going to tell you the answer, and if you ask any of them what you should do, you will get a confident reply shaped by the part of the company they are responsible for.',
      whatHappens: [
        'Your team runs Midland’s technology for three years. Each year you get $9 million, you spend all of it across five lines, and then you find out what happened that year.',
        'You do not get to save money. Come with a view about what this company should become. You will be asked for it early, in one sentence.'
      ]
    },
    coldOpen: [
""", 'briefing people and close')
SCENARIO.write_text(s)

h = INDEX.read_text()

css_anchor = ".notice{border-left:2px solid var(--amber);padding:11px 14px;background:rgba(240,166,60,.05);color:#CBC8C0;margin:18px 0}.error{border-left-color:var(--red);color:#E3B9C2}\n.hidden{display:none!important}"
css_new = ".notice{border-left:2px solid var(--amber);padding:11px 14px;background:rgba(240,166,60,.05);color:#CBC8C0;margin:18px 0}.error{border-left-color:var(--red);color:#E3B9C2}\n" + r""".briefing-prep{margin:20px 0 0;border:1px solid var(--line2);background:rgba(22,30,46,.78);display:flex;align-items:center;justify-content:space-between;gap:18px;padding:15px 16px}.briefing-prep-copy{font-size:14px;color:#C8C5BD;line-height:1.55}.briefing-prep-copy b{color:var(--bone);font-weight:500}.briefing-prep-copy .small{display:block;font:10px var(--mono);letter-spacing:.08em;text-transform:uppercase;color:var(--dimmer);margin-bottom:4px}
.briefing-modal{position:fixed;inset:0;z-index:100;display:none;align-items:center;justify-content:center;padding:28px;background:rgba(5,9,17,.78);backdrop-filter:blur(5px)}.briefing-modal.open{display:flex}.briefing-dialog{width:min(900px,100%);max-height:88vh;background:var(--panel);border:1px solid var(--line2);box-shadow:0 26px 90px rgba(0,0,0,.55);display:flex;flex-direction:column}.briefing-dialog-head{display:flex;align-items:flex-start;gap:18px;padding:20px 22px;border-bottom:1px solid var(--line);background:var(--panel2)}.briefing-dialog-head .grow{flex:1}.briefing-dialog-kicker{font:10px var(--mono);letter-spacing:.15em;text-transform:uppercase;color:var(--amber)}.briefing-dialog-title{font-size:30px;font-weight:400;letter-spacing:-.015em;margin:3px 0 4px}.briefing-dialog-meta{font:10px var(--mono);letter-spacing:.08em;text-transform:uppercase;color:var(--dimmer)}.briefing-dialog-close{width:36px;height:36px;border:1px solid var(--line2);background:transparent;color:var(--dim);font:20px var(--mono);line-height:1}.briefing-dialog-close:hover{border-color:var(--bone);color:var(--bone)}.briefing-dialog-body{padding:22px;overflow:auto;scrollbar-color:var(--line2) var(--panel)}.briefing-dialog-intro{border-left:2px solid var(--amber);padding:12px 14px;background:rgba(240,166,60,.05);color:#D0CDC5;margin-bottom:22px}.briefing-dialog-section{padding-top:20px;margin-top:20px;border-top:1px solid var(--line)}.briefing-dialog-section:first-of-type{border-top:0;margin-top:0;padding-top:0}.briefing-dialog-section h3{font-size:24px;font-weight:400;margin:0 0 10px}.briefing-dialog-section p{color:#C8C5BD;margin:8px 0}.briefing-dialog-table{overflow:auto;border:1px solid var(--line);margin-top:10px}.briefing-dialog-table table{width:100%;border-collapse:collapse;font-size:14px}.briefing-dialog-table th,.briefing-dialog-table td{padding:10px 11px;border-bottom:1px solid var(--line);text-align:left;vertical-align:top}.briefing-dialog-table tr:last-child td{border-bottom:0}.briefing-dialog-table th{font:9px var(--mono);letter-spacing:.09em;text-transform:uppercase;color:var(--dimmer);background:var(--panel2)}.briefing-person{padding:12px 0;border-bottom:1px solid var(--line)}.briefing-person:last-child{border-bottom:0}.briefing-person b{color:var(--bone);font-weight:500}.briefing-dialog-foot{padding:14px 22px;border-top:1px solid var(--line);background:var(--panel2);display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap}.briefing-dialog-foot .hint{font:10px var(--mono);letter-spacing:.08em;text-transform:uppercase;color:var(--dimmer);margin:0}
.hidden{display:none!important}"""
h = replace_once(h, css_anchor, css_new, 'briefing modal css')

mobile_anchor = "@media(max-width:760px){.page{width:min(100% - 26px,980px);padding-top:34px}h2{font-size:31px}.alloc-wrap{grid-template-columns:1fr}.budget{position:static}.events,.buyers,.summary{grid-template-columns:1fr}.running{grid-template-columns:repeat(2,1fr)}header{padding:11px 14px}.pills{order:3;width:100%}.joinbox .row{grid-template-columns:1fr}}"
mobile_new = "@media(max-width:760px){.page{width:min(100% - 26px,980px);padding-top:34px}h2{font-size:31px}.alloc-wrap{grid-template-columns:1fr}.budget{position:static}.events,.buyers,.summary{grid-template-columns:1fr}.running{grid-template-columns:repeat(2,1fr)}header{padding:11px 14px}.pills{order:3;width:100%}.joinbox .row{grid-template-columns:1fr}.briefing-prep{align-items:flex-start;flex-direction:column}.briefing-modal{padding:10px}.briefing-dialog{max-height:94vh}.briefing-dialog-body{padding:16px}.briefing-dialog-title{font-size:25px}}"
h = replace_once(h, mobile_anchor, mobile_new, 'briefing modal mobile css')

helpers = r'''function briefingPacketModal(){
  const b=C?.briefing;if(!b)return '';
  const intro=(b.intro||[]).map((x,i)=>`${i===0?'<b>':''}${esc(x)}${i===0?'</b>':''}`).join('<br>');
  const exhibits=(b.exhibits||[]).map(ex=>{
    const body=(ex.body||[]).map(x=>`<p>${esc(x)}</p>`).join('');
    const table=ex.rows?.length?`<div class="briefing-dialog-table"><table><thead>${ex.columns?.length?`<tr>${ex.columns.map(c=>`<th>${esc(c)}</th>`).join('')}</tr>`:''}</thead><tbody>${ex.rows.map(r=>`<tr>${r.map(c=>`<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`:'';
    return `<section class="briefing-dialog-section"><h3>${esc(ex.title)}</h3>${body}${table}${ex.note?`<p><b>${esc(ex.note)}</b></p>`:''}</section>`;
  }).join('');
  const people=(b.people||[]).map(p=>`<div class="briefing-person"><b>${esc(p.role)}.</b> “${esc(p.quote)}”</div>`).join('');
  return `<div class="briefing-modal" id="briefingPacketModal" aria-hidden="true"><section class="briefing-dialog" role="dialog" aria-modal="true" aria-labelledby="briefingPacketTitle">
    <div class="briefing-dialog-head"><div class="grow"><div class="briefing-dialog-kicker">Pre-class briefing · about 6 minutes</div><div class="briefing-dialog-title" id="briefingPacketTitle">Midland Equipment — Briefing</div><div class="briefing-dialog-meta">Reference copy · read before starting the simulation</div></div><button class="briefing-dialog-close" id="closeBriefingPacket" aria-label="Close briefing">×</button></div>
    <div class="briefing-dialog-body"><div class="briefing-dialog-intro">${intro}</div>
      <section class="briefing-dialog-section"><h3>The company</h3>${(b.company||[]).map(x=>`<p>${esc(x)}</p>`).join('')}</section>
      ${exhibits}
      ${people?`<section class="briefing-dialog-section"><h3>Four people you work with</h3>${people}${b.peopleNote?`<p>${esc(b.peopleNote)}</p>`:''}</section>`:''}
      ${(b.whatHappens||[]).length?`<section class="briefing-dialog-section"><h3>What happens Tuesday</h3>${b.whatHappens.map(x=>`<p>${esc(x)}</p>`).join('')}</section>`:''}
    </div>
    <div class="briefing-dialog-foot"><span class="hint">You can reopen this packet later from the allocation screens.</span><button class="btn pri" id="doneBriefingPacket">Done reading</button></div>
  </section></div>`;
}
function wireBriefingPacketModal(){
  const modal=document.getElementById('briefingPacketModal');
  const openBtn=document.getElementById('openBriefingPacket');
  if(!modal||!openBtn)return;
  const closeBtn=document.getElementById('closeBriefingPacket');
  const doneBtn=document.getElementById('doneBriefingPacket');
  let lastFocus=null;
  const escHandler=e=>{if(e.key==='Escape')close()};
  const open=()=>{lastFocus=document.activeElement;modal.classList.add('open');modal.setAttribute('aria-hidden','false');document.body.style.overflow='hidden';document.addEventListener('keydown',escHandler);closeBtn?.focus()};
  const close=()=>{modal.classList.remove('open');modal.setAttribute('aria-hidden','true');document.body.style.overflow='';document.removeEventListener('keydown',escHandler);lastFocus?.focus()};
  openBtn.onclick=open;if(closeBtn)closeBtn.onclick=close;if(doneBtn)doneBtn.onclick=close;
  modal.onclick=e=>{if(e.target===modal)close()};
}

'''
h = replace_once(h, 'function renderBrief(){\n', helpers + 'function renderBrief(){\n', 'briefing modal helpers')

old_brief = '''function renderBrief(){
  shell(`<div class="eyebrow">Cold open</div><h2>Some decisions arrive years before their evidence.</h2>
  <div class="cold">${C.coldOpen.map(x=>`<div class="line">${esc(x)}</div>`).join('')}</div>
  <p class="lede">There is no score, rank, grade or hidden correct allocation. You will find out what happened, not how you "did."</p>
  <p class="hint" style="margin-top:12px">This sim assumes you have read the briefing packet your instructor posted before class.</p>
  ${sessionGate()}${!S.session?'<div class="actions"><button class="btn" id="joinSessionEntry">Join a facilitated session</button></div>':''}${nav({backOk:false,disabled:blocked()})}`);
  const joinEntry=document.getElementById('joinSessionEntry');if(joinEntry)joinEntry.onclick=()=>{S.error='';renderJoin()};
  wireNav(next,false);
}'''
new_brief = '''function renderBrief(){
  shell(`<div class="eyebrow">Cold open</div><h2>Some decisions arrive years before their evidence.</h2>
  <div class="cold">${C.coldOpen.map(x=>`<div class="line">${esc(x)}</div>`).join('')}</div>
  <p class="lede">There is no score, rank, grade or hidden correct allocation. You will find out what happened, not how you "did."</p>
  <div class="briefing-prep"><div class="briefing-prep-copy"><span class="small">Before you continue</span><b>This sim assumes you have read the briefing packet your instructor posted before class.</b> If you have not read it yet, read the full packet here before starting.</div><button class="btn" id="openBriefingPacket">Read briefing packet</button></div>
  ${briefingPacketModal()}
  ${sessionGate()}${!S.session?'<div class="actions"><button class="btn" id="joinSessionEntry">Join a facilitated session</button></div>':''}${nav({backOk:false,disabled:blocked()})}`);
  wireBriefingPacketModal();
  const joinEntry=document.getElementById('joinSessionEntry');if(joinEntry)joinEntry.onclick=()=>{S.error='';renderJoin()};
  wireNav(next,false);
}'''
h = replace_once(h, old_brief, new_brief, 'first-page briefing prompt')

INDEX.write_text(h)

# Simple safety assertions for the intended UI and shared briefing source.
for needle in [
    'Read briefing packet', 'briefingPacketModal', 'Done reading',
    'Four people you work with', 'What happens Tuesday'
]:
    if needle not in INDEX.read_text() and needle not in SCENARIO.read_text():
        raise SystemExit(f'missing expected output: {needle}')
