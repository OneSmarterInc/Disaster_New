'use strict';
const BASE = (location.pathname.match(/^\/sim-?\d+/) || [''])[0];
const $ = id => document.getElementById(id);
const params = new URLSearchParams(location.search);
const guest = params.get('guest') === '1';
let code = (params.get('session') || '').trim().toUpperCase();
let launch = guest ? null : new URLSearchParams(location.hash.slice(1)).get('lt') || null;
if (launch) sessionStorage.setItem('m04-lt:' + code, launch);
else if (!guest) launch = sessionStorage.getItem('m04-lt:' + code);
let participantId = sessionStorage.getItem('m04-participant:' + code) || null;
let config = null, view = null, pollAt = 0, renderedPack = false, renderedCommit = '', renderedDebrief = '';

function headers() {
  return { 'content-type': 'application/json', ...(launch ? { 'x-launch-token': launch }
    : { 'x-access-code': sessionStorage.getItem('m04-access') || '' }) };
}
async function api(path, payload) {
  const response = await fetch(BASE + '/api/' + path, {
    method: payload ? 'POST' : 'GET', headers: headers(),
    ...(payload ? { body: JSON.stringify(payload) } : {}), cache: 'no-store'
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.message || result.error || 'Please try again.');
  return result;
}
function warnAt() { return (config?.warningMinutes ?? 2) * 60; }
function error(id, message) { $(id).textContent = message || ''; }
function time() {
  if (!view) return;
  let remaining = view.clock.remaining;
  if (remaining !== null) remaining = Math.max(0, remaining - Math.floor((Date.now() - pollAt) / 1000));
  $('clock').textContent = remaining === null ? 'Not started' : `${String(Math.floor(remaining / 60)).padStart(2, '0')}:${String(remaining % 60).padStart(2, '0')}`;
  $('clock').classList.toggle('warn', remaining !== null && remaining <= warnAt());
  const pill = $('statePill');
  pill.textContent = view.state === 'complete' ? 'Complete' : view.commit ? 'Report locked' : remaining === 0 ? 'Time ended' : 'Decision open';
  pill.classList.toggle('good', !!view.commit);
  pill.classList.toggle('warn', !view.commit && remaining !== null && remaining <= warnAt());
}
function table(target, records, columns) {
  const sort = { key: columns[0], direction: 1 };
  function paint() {
    const table = document.createElement('table'), thead = table.createTHead(), row = thead.insertRow();
    for (const key of columns) {
      const th = document.createElement('th'), button = document.createElement('button');
      button.type = 'button'; button.textContent = key.replaceAll('_', ' ') + (key === sort.key ? (sort.direction > 0 ? ' ↑' : ' ↓') : '');
      button.onclick = () => { sort.direction = sort.key === key ? -sort.direction : 1; sort.key = key; paint(); };
      th.append(button); row.append(th);
    }
    const body = table.createTBody();
    const ordered = [...records].sort((a, b) => {
      const x = a[sort.key] ?? '', y = b[sort.key] ?? '';
      return sort.direction * (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), undefined, { numeric: true }));
    });
    for (const item of ordered) {
      const tr = body.insertRow();
      for (const key of columns) tr.insertCell().textContent = item[key] == null ? '—' : String(item[key]);
    }
    $(target).replaceChildren(table);
  }
  paint();
}
function csv(records, name) {
  const columns = Object.keys(records[0] || {});
  const cell = v => '"' + String(v ?? '').replace(/^[=+@-]/, "'$&").replaceAll('"', '""') + '"';
  const text = [columns.map(cell).join(','), ...records.map(row => columns.map(k => cell(row[k])).join(','))].join('\r\n');
  const url = URL.createObjectURL(new Blob(['\ufeff' + text], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a'); a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function draw(result) {
  if (!result.view?.solo) throw new Error('Could not open your session. Reload and try again.');
  view = result.view; pollAt = Date.now();
  $('entry').hidden = true; $('play').hidden = false;
  $('group').textContent = view.group || 'Your report';
  $('materials').hidden = !view.data;
  if (view.data && !renderedPack) {
    renderedPack = true;
    $('briefing').textContent = config.briefing;
    for (const line of view.data.sheet.lines) {
      const li = document.createElement('li'); li.textContent = line; $('sheet').append(li);
    }
    $('scope').textContent = `Starting monthly revenue in scope: $${Number(view.data.startingMrrInScope).toLocaleString('en-US')}`;
    $('plans').textContent = Object.entries(view.data.plans).map(([tier, price]) => `${tier} $${price}/month`).join(' · ');
    const accountColumns = Object.keys(view.data.accounts[0]);
    table('accountsTable', view.data.accounts, accountColumns);
    table('ticketsTable', view.data.tickets, Object.keys(view.data.tickets[0]));
    $('downloadAccounts').onclick = () => csv(view.data.accounts, 'ridgeway-accounts.csv');
    $('downloadTickets').onclick = () => csv(view.data.tickets, 'ridgeway-tickets.csv');
  }
  const key = JSON.stringify([view.commit, view.canCommit, view.clock.expired, view.state]);
  if (key !== renderedCommit) {
    renderedCommit = key;
    $('commitForm').hidden = !view.canCommit;
    $('locked').hidden = !view.commit;
    if (view.commit) {
      $('lockedNumber').textContent = view.commit.number + '%';
      $('lockedConfidence').textContent = `Confidence ${view.commit.confidence}/5`;
    }
    if (!view.commit && view.clock.expired) error('commitError', 'Time ended. No number reported.');
  }
  drawSoloReview(result.debrief);
  time();
}
function node(tag, text, className) {
  const item = document.createElement(tag);
  if (text != null) item.textContent = text;
  if (className) item.className = className;
  return item;
}
function drawSoloReview(debrief) {
  $('soloReview').hidden = !view.solo || (view.stage === 0 && !view.canSoloAdvance);
  if (!view.solo) return;
  $('soloAdvance').hidden = view.stage === 3;
  $('soloAdvance').textContent = ['View the numbers', 'View the explanation', 'Finish simulation'][view.stage] || 'Continue';
  $('soloAdvance').disabled = !view.canSoloAdvance;
  $('soloReviewTitle').textContent = ['Your report is locked', 'The numbers', 'What each number measures', 'Session complete'][view.stage];
  $('soloReviewNote').textContent = view.stage === 0 ? 'Continue when you are ready.'
    : 'Worked examples calculated from the same account records. Keep your submitted report for comparison.';
  $('soloCompletion').textContent = view.stage === 3
    ? view.completionPending ? 'Your session is complete. Saving completion to your course is pending.' : 'Your session is complete.' : '';
  $('soloRetryReport').hidden = !view.completionPending;
  const signature = JSON.stringify(debrief);
  if (signature === renderedDebrief) return;
  renderedDebrief = signature;
  const body = $('soloReviewBody'); body.replaceChildren();
  for (const example of debrief?.numbers || []) {
    const row = node('div', null, 'status-item');
    row.append(node('strong', example.label), node('span', example.number + '%', 'clock'));
    body.append(row);
  }
  for (const example of debrief?.definitions || []) {
    const card = node('article', null, 'reveal-card');
    card.append(node('h3', example.label + (example.assigned ? ' · Your definition' : '')),
      node('p', example.department, 'department'), node('p', example.purpose, 'muted'));
    const lines = node('ol', null, 'definition');
    example.lines.forEach(line => lines.append(node('li', line)));
    card.append(lines, node('p', 'Worked calculation', 'eyebrow'));
    example.derivation.forEach(step => card.append(node('p', step, 'quiet')));
    body.append(card);
  }
  if (debrief?.definitions) body.append(node('p', 'Think of a number you are judged by. What definition does it use, and what does that definition leave out?', 'note'));
}
async function refresh() {
  if (!code || !participantId) return;
  try { draw(await api('session', { action: 'state', code, participantId })); }
  catch (e) {
    error('commitError', e.message);
  }
}
async function beginSolo(event) {
  event?.preventDefault();
  $('startForm').querySelector('button').disabled = true;
  error('entryError', '');
  $('entryHelp').textContent = 'Starting your session…';
  try {
    config = await api('config');
    const result = await api('session', { action: 'solo', name: $('soloName').value.trim() });
    code = result.session.code; participantId = result.participantId;
    sessionStorage.setItem('m04-participant:' + code, participantId);
    if (launch) sessionStorage.setItem('m04-lt:' + code, launch);
    history.replaceState(null, '', location.pathname + '?session=' + encodeURIComponent(code) + '&solo=1'
      + (guest ? '&guest=1' : '') + (launch ? '#lt=' + encodeURIComponent(launch) : ''));
    draw(result);
  } catch (e) {
    $('entryHelp').textContent = 'Your session could not start. Try again.';
    error('entryError', e.message);
    $('startForm').hidden = false;
  } finally { $('startForm').querySelector('button').disabled = false; }
}
async function resumeSolo() {
  try {
    config = await api('config');
    const result = await api('session', { action: 'state', code, participantId });
    if (!result.view?.solo) throw new Error('Open this class session from its invitation.');
    draw(result);
  } catch (e) {
    $('entryHelp').textContent = 'Your saved session could not be opened.';
    error('entryError', e.message);
  }
}
$('startForm').addEventListener('submit', beginSolo);
$('soloAdvance').onclick = async () => {
  error('soloError', ''); $('soloAdvance').disabled = true;
  try { draw(await api('session', { action: 'solo_advance', code, participantId })); }
  catch (e) { error('soloError', e.message); await refresh(); }
};
$('soloRetryReport').onclick = async () => {
  error('soloError', '');
  try { draw(await api('session', { action: 'solo_report', code, participantId })); }
  catch (e) { error('soloError', e.message); }
};
$('commitForm').addEventListener('submit', async event => {
  event.preventDefault(); error('commitError', '');
  const n = Number($('number').value).toFixed(1), confidence = $('confidence').value;
  if (!confirm(`Lock ${n}% with confidence ${confidence}/5? This cannot be changed.`)) return;
  try { draw(await api('session', { action: 'commit', code, participantId, number: $('number').value, confidence })); }
  catch (e) { error('commitError', e.message); await refresh(); }
});
if (code && params.get('solo') === '1') resumeSolo();
else if (code && (launch || guest)) beginSolo();
else if (launch) beginSolo();
else if (guest) {
  $('startForm').hidden = false;
  $('entryHelp').textContent = 'Start your own session. The timer begins as soon as you start.';
}
setInterval(time, 1000); setInterval(refresh, 4000);
