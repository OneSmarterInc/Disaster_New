'use strict';
const BASE = (location.pathname.match(/^\/sim-?\d+/) || [''])[0];
const $ = id => document.getElementById(id);
const query = new URLSearchParams(location.search);
const token = new URLSearchParams(location.hash.slice(1)).get('lt') || sessionStorage.getItem('m04-faculty-lt');
if (token) sessionStorage.setItem('m04-faculty-lt', token);
let facultyCode = sessionStorage.getItem('m04-faculty-code') || '';
let code = (query.get('session') || sessionStorage.getItem('m04-faculty-room') || '').trim().toUpperCase();
let state = null, lastSignature = '', pollAt = 0;
function headers() { return { 'content-type': 'application/json', ...(token ? { 'x-launch-token': token } : { 'x-faculty-code': facultyCode }) }; }
async function api(action, extra = {}) {
  const r = await fetch(BASE + '/api/session', { method: 'POST', headers: headers(), cache: 'no-store', body: JSON.stringify({ action, code, facultyCode, ...extra }) });
  const body = await r.json();
  if (!r.ok) throw new Error(body.message || body.error || 'Please try again.');
  return body;
}
function say(text, success = false) { $('message').textContent = text || ''; $('message').classList.toggle('success', success); }
function time() {
  if (!state) return;
  let seconds = state.projector.clock.remaining;
  if (seconds !== null) seconds = Math.max(0, seconds - Math.floor((Date.now() - pollAt) / 1000));
  $('clock').textContent = seconds === null ? '--:--' : `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
  $('clock').classList.toggle('warn', seconds !== null && seconds <= 120);
}
function el(name, className, text) {
  const node = document.createElement(name); if (className) node.className = className;
  if (text != null) node.textContent = text; return node;
}
function statusList(groups) {
  const grid = el('div', 'status-list');
  for (const g of groups) {
    const item = el('div', 'status-item');
    item.append(el('strong', '', g.label), el('span', g.committed ? 'success mono' : 'muted mono', g.committed ? 'Committed' : 'Not committed'));
    grid.append(item);
  }
  return grid;
}
function reportList(numbers) {
  const grid = el('div', 'status-list');
  for (const n of numbers) {
    const item = el('div', 'status-item');
    item.append(el('strong', '', n.label), el('span', 'clock', n.number === null ? 'No number reported' : `${n.number}%`));
    if (n.confidence) item.append(el('small', 'muted mono', `Confidence ${n.confidence}/5`));
    grid.append(item);
  }
  return grid;
}
function revealCard(group) {
  const card = el('article', 'reveal-card');
  card.append(el('div', 'department', `${group.department} · Definition ${group.sheetId}`),
    el('h3', '', group.groups.map(g => g.label).join(', ')), el('p', 'muted', group.purpose));
  const list = el('ol', 'definition');
  group.lines.forEach((line, i) => list.append(el('li', i === group.contestedIndex ? 'contested' : '', line)));
  card.append(list, el('p', 'eyebrow', 'Worked derivation'));
  for (const step of group.derivation) card.append(el('p', 'quiet', step));
  const result = group.groups.map(g => `${g.label}: ${g.number === null ? 'No number reported' : g.number + '%'}`).join(' · ');
  card.append(el('p', 'mono', result));
  return card;
}
function comparison() {
  const a = $('compareA').value, b = $('compareB').value;
  const cards = state.projector.reveal || [];
  const find = id => cards.find(r => r.groups.some(g => g.id === id));
  $('comparison').replaceChildren(...[find(a), find(b)].filter(Boolean).map(revealCard));
}
function draw(data) {
  state = data; pollAt = Date.now();
  const s = data.session, p = data.projector;
  $('app').hidden = false; $('create').hidden = true; $('reopen').hidden = true;
  $('codeText').textContent = s.code; $('roomName').textContent = s.name;
  $('stage').textContent = ['Waiting to start', 'Numbers revealed', 'Definitions revealed', 'Complete'][s.stage] || 'In progress';
  if (s.stage === 0 && s.state === 'running') $('stage').textContent = 'Calculating';
  $('setup').hidden = s.state !== 'lobby';
  $('compareSection').hidden = s.stage < 2;
  $('completeSection').hidden = s.stage < 3;
  $('joinUrl').value = data.joinUrl || 'Set SIM_URL to enable invitations';
  const signature = JSON.stringify([s, p.groups, p.numbers, p.reveal, data.roster, data.slots]);
  if (signature === lastSignature) { time(); return; }
  lastSignature = signature;
  if (s.state === 'lobby') {
    $('start').textContent = `Start ${s.clockMinutes}-minute clock`;
    const roster = $('roster'); roster.replaceChildren();
    for (const member of data.roster) {
      const line = el('div', 'row'); line.append(el('span', 'mono', member.name));
      if (s.mode === 'team') {
        const select = el('select'); select.style.maxWidth = '220px';
        const empty = document.createElement('option'); empty.value = ''; empty.textContent = 'Assign group'; select.append(empty);
        for (const slot of data.slots) {
          const option = document.createElement('option'); option.value = slot.id; option.textContent = slot.label;
          if (member.group === slot.label) option.selected = true; select.append(option);
        }
        select.onchange = async () => { if (!select.value) return; try { await api('assign', { participantId: member.id, slotId: select.value }); await refresh(); } catch (e) { say(e.message); } };
        line.append(select);
      } else line.append(el('span', 'pill good', member.group || 'Awaiting slot'));
      roster.append(line);
    }
    if (!data.roster.length) roster.append(el('p', 'muted', 'No participants have joined yet. Share the invitation link.'));
  }
  const advance = $('advance'); advance.hidden = s.state === 'lobby' || s.stage === 3;
  advance.textContent = ['Reveal numbers', 'Reveal definitions', 'Complete session'][s.stage];
  advance.disabled = s.stage === 0 && !p.groups.every(g => g.committed);
  $('projectorStage').textContent = s.stage === 0 ? 'Projector · pre-reveal' : `Projector · Stage ${Math.min(s.stage, 2)}`;
  $('projectorTitle').textContent = ['Commitment status', 'One room, several numbers', 'What each number measures', 'What each number measures'][s.stage];
  $('projectorNote').textContent = s.stage === 0
    ? 'Only group names and commitment status are shown. The figures stay hidden until every report is locked.'
    : s.stage === 1 ? 'Ask two groups with far-apart figures to explain their reasoning before showing their definitions.'
    : 'The contested line, department, purpose, and calculation are shown together.';
  const body = $('projectorBody'); body.replaceChildren();
  if (s.stage === 0) body.append(statusList(p.groups));
  else if (s.stage === 1) body.append(reportList(p.numbers));
  else {
    const grid = el('div', 'grid'); p.reveal.forEach(r => grid.append(revealCard(r))); body.append(grid);
    const previousA = $('compareA').value, previousB = $('compareB').value;
    for (const id of ['compareA', 'compareB']) {
      const select = $(id); select.replaceChildren();
      p.numbers.forEach(n => { const option = document.createElement('option'); option.value = n.id; option.textContent = n.label; select.append(option); });
    }
    $('compareA').value = previousA || p.numbers[0]?.id || '';
    $('compareB').value = previousB || p.numbers[1]?.id || '';
    comparison();
  }
  time();
}
async function refresh() { if (!code) return; try { draw(await api('faculty_state')); } catch (e) { say(e.message); } }
function openRoom(value) {
  code = value.trim().toUpperCase(); sessionStorage.setItem('m04-faculty-room', code);
  history.replaceState(null, '', location.pathname + '?session=' + encodeURIComponent(code));
  refresh();
}
$('createForm').addEventListener('submit', async e => {
  e.preventDefault(); const mode = document.querySelector('input[name=mode]:checked')?.value;
  if (!mode) { say('Choose team or individual mode.'); return; }
  try { const response = await api('create', { mode, count: Number($('count').value), clockMinutes: Number($('minutes').value) }); openRoom(response.session.code); say('Room created. Share the invitation link.', true); }
  catch (err) { say(err.message); }
});
$('openRoom').onclick = () => openRoom($('roomCode').value);
$('start').onclick = async () => { try { await api('start'); await refresh(); say('Clock started.', true); } catch (e) { say(e.message); } };
$('advance').onclick = async () => {
  try { const result = await api('advance'); await refresh();
    if (result.completion) $('completionText').textContent = `${result.completion.sent} completion report(s) sent. ${result.completion.failed ? 'Some reports could not be delivered; use Retry completion delivery.' : ''}`;
  } catch (e) { say(e.message); }
};
$('retryReport').onclick = async () => { try { const r = await api('report'); $('completionText').textContent = `${r.completion.sent} additional report(s) sent; ${r.completion.failed} failed.`; } catch (e) { say(e.message); } };
$('copyLink').onclick = async () => { try { await navigator.clipboard.writeText($('joinUrl').value); say('Invitation link copied.', true); } catch { $('joinUrl').select(); say('Select and copy the invitation link.'); } };
$('compareA').onchange = comparison; $('compareB').onchange = comparison;
$('saveCode').onclick = () => { facultyCode = $('facultyCode').value.trim(); sessionStorage.setItem('m04-faculty-code', facultyCode); $('signIn').hidden = true; refresh(); };
if (!token && !facultyCode) $('signIn').hidden = false;
if (code) { $('roomCode').value = code; refresh(); }
setInterval(time, 1000); setInterval(refresh, 4000);
