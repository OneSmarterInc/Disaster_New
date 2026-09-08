from pathlib import Path

INDEX = Path('sim03/public/index.html')
BUILD = Path('sim03/build.js')


def replace_once(text, old, new, label):
    if old not in text:
        raise SystemExit(f'missing anchor: {label}')
    return text.replace(old, new, 1)

h = INDEX.read_text()

# Give the Brief status pill a restrained clickable treatment without changing
# the rest of the step navigation.
css_old = ".pills{display:flex;gap:5px;flex-wrap:wrap}.pill{font:10px var(--mono);letter-spacing:.09em;text-transform:uppercase;padding:5px 9px;border:1px solid var(--line);color:var(--dimmer)}.pill.on{color:var(--amber);border-color:#8A6427;background:rgba(240,166,60,.07)}.pill.done{color:var(--dim);border-color:var(--line2)}"
css_new = css_old + ".pill.brief-link{cursor:pointer}.pill.brief-link:hover{color:var(--amber);border-color:#8A6427;background:rgba(240,166,60,.07)}"
h = replace_once(h, css_old, css_new, 'brief pill css')

shell_old = '''function shell(content){
  const visibleSteps=STEPS.map((x,i)=>({x,i})).filter(o=>C?.buyers?.authored!==false||o.i!==8);
  const pills=visibleSteps.map((o,j)=>`<span class="pill ${o.i===S.step?'on':o.i<S.step?'done':''}">${j+1}. ${o.x}</span>`).join('');
  app.innerHTML=`<header><div class="brand"><h1>Midland Equipment</h1><div class="sub">Flexee RapidSim 03 · architecture</div></div><div class="pills">${pills}</div><div class="timer">20 MIN</div></header><main class="page">${teamBanner()}${content}</main>`;
}'''
shell_new = '''function shell(content){
  const visibleSteps=STEPS.map((x,i)=>({x,i})).filter(o=>C?.buyers?.authored!==false||o.i!==8);
  const pills=visibleSteps.map((o,j)=>o.i===0
    ? `<button type="button" class="pill brief-link ${o.i===S.step?'on':o.i<S.step?'done':''}" data-open-briefing title="Open briefing packet">${j+1}. ${o.x}</button>`
    : `<span class="pill ${o.i===S.step?'on':o.i<S.step?'done':''}">${j+1}. ${o.x}</span>`).join('');
  app.innerHTML=`<header><div class="brand"><h1>Midland Equipment</h1><div class="sub">Flexee RapidSim 03 · architecture</div></div><div class="pills">${pills}</div><div class="timer">20 MIN</div></header><main class="page">${teamBanner()}${content}</main>${briefingPacketModal()}`;
  wireBriefingPacketModal();
}'''
h = replace_once(h, shell_old, shell_new, 'global brief pill')

safe_old = "function safeToRerender(){const el=document.activeElement;return !el||!['INPUT','TEXTAREA','SELECT'].includes(el.tagName)}"
safe_new = "function safeToRerender(){if(document.getElementById('briefingPacketModal')?.classList.contains('open'))return false;const el=document.activeElement;return !el||!['INPUT','TEXTAREA','SELECT'].includes(el.tagName)}"
h = replace_once(h, safe_old, safe_new, 'modal-safe polling')

wire_old = '''function wireBriefingPacketModal(){
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
}'''
wire_new = '''function wireBriefingPacketModal(){
  const modal=document.getElementById('briefingPacketModal');
  const openBtns=[...document.querySelectorAll('[data-open-briefing]')];
  if(!modal||!openBtns.length)return;
  const closeBtn=document.getElementById('closeBriefingPacket');
  const doneBtn=document.getElementById('doneBriefingPacket');
  let lastFocus=null;
  const escHandler=e=>{if(e.key==='Escape')close()};
  const open=()=>{lastFocus=document.activeElement;modal.classList.add('open');modal.setAttribute('aria-hidden','false');document.body.style.overflow='hidden';document.addEventListener('keydown',escHandler);closeBtn?.focus()};
  const close=()=>{modal.classList.remove('open');modal.setAttribute('aria-hidden','true');document.body.style.overflow='';document.removeEventListener('keydown',escHandler);lastFocus?.focus()};
  openBtns.forEach(btn=>btn.onclick=open);if(closeBtn)closeBtn.onclick=close;if(doneBtn)doneBtn.onclick=close;
  modal.onclick=e=>{if(e.target===modal)close()};
}'''
h = replace_once(h, wire_old, wire_new, 'multi-trigger briefing modal')

brief_old = '''  <div class="briefing-prep"><div class="briefing-prep-copy"><span class="small">Before you continue</span><b>This sim assumes you have read the briefing packet your instructor posted before class.</b> If you have not read it yet, read the full packet here before starting.</div><button class="btn" id="openBriefingPacket">Read briefing packet</button></div>
  ${briefingPacketModal()}
  ${sessionGate()}${!S.session?'<div class="actions"><button class="btn" id="joinSessionEntry">Join a facilitated session</button></div>':''}${nav({backOk:false,disabled:blocked()})}`);
  wireBriefingPacketModal();'''
brief_new = '''  <div class="briefing-prep"><div class="briefing-prep-copy"><span class="small">Before you continue</span><b>This sim assumes you have read the briefing packet your instructor posted before class.</b> If you have not read it yet, read the full packet here before starting.</div><button class="btn" data-open-briefing>Read briefing packet</button></div>
  ${sessionGate()}${!S.session?'<div class="actions"><button class="btn" id="joinSessionEntry">Join a facilitated session</button></div>':''}${nav({backOk:false,disabled:blocked()})}`);'''
h = replace_once(h, brief_old, brief_new, 'first-page trigger only')

INDEX.write_text(h)

b = BUILD.read_text()
marker_old = "  'briefing packet your instructor posted before class',\n  \"sessionStorage.getItem('m03-access')\""
marker_new = "  'briefing packet your instructor posted before class',\n  'data-open-briefing',\n  'Open briefing packet',\n  \"document.querySelectorAll('[data-open-briefing]')\",\n  \"sessionStorage.getItem('m03-access')\""
b = replace_once(b, marker_old, marker_new, 'brief pill build guards')
BUILD.write_text(b)

# Explicitly ensure the step state is not changed by the Brief button handler.
text = INDEX.read_text()
assert 'o.i===0' in text
assert 'data-open-briefing' in text
assert '${briefingPacketModal()}' in text
assert 'openBtns.forEach(btn=>btn.onclick=open)' in text
assert "S.step=0" not in text
