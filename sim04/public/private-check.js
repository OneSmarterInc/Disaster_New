'use strict';
const BASE = (location.pathname.match(/^\/sim-?\d+/) || [''])[0];
const $ = id => document.getElementById(id);
const token = new URLSearchParams(location.hash.slice(1)).get('lt') || sessionStorage.getItem('m04-faculty-lt');
$('room').value = new URLSearchParams(location.search).get('session') || sessionStorage.getItem('m04-faculty-room') || '';
$('faculty').value = sessionStorage.getItem('m04-faculty-code') || '';
if (token) $('facultyField').hidden = true;
$('check').onclick = async () => {
  $('error').textContent = ''; $('results').replaceChildren();
  const r = await fetch(BASE + '/api/session', { method: 'POST', cache: 'no-store',
    headers: { 'content-type': 'application/json', ...(token ? { 'x-launch-token': token } : { 'x-faculty-code': $('faculty').value }) },
    body: JSON.stringify({ action: 'private_check', code: $('room').value, facultyCode: $('faculty').value }) });
  const data = await r.json();
  if (!r.ok) { $('error').textContent = data.message || data.error; return; }
  for (const c of data.checks) {
    const item = document.createElement('div'); item.className = 'status-item';
    const title = document.createElement('strong'); title.textContent = c.label;
    const result = document.createElement('span'); result.className = c.status === 'ok' ? 'success mono' : 'mono';
    result.textContent = c.status === 'none' ? 'No number reported' : c.status === 'ok'
      ? `${c.number}% · Matches its sheet` : `${c.number}% · Check calculation; sheet gives ${c.correct.toFixed(1)}%`;
    item.append(title, result); $('results').append(item);
  }
};
