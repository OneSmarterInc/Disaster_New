'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../public/student.js'), 'utf8');
const token = Buffer.from(JSON.stringify({ sub: 'student-04', role: 'student', course: 'course-04' })).toString('base64url') + '.signature';
const ownSheet = ['Read the records.', 'Report a number.'];
const initial = { participantId: 'platform:student-04', session: { code: 'ABCDE', solo: true },
  view: { solo: true, stage: 0, state: 'running', group: 'Your report', canCommit: true,
    canSoloAdvance: false, clock: { remaining: 1500, expired: false },
    data: { sheet: { lines: ownSheet }, startingMrrInScope: 10800, plans: { Solo: 79 },
      accounts: [{ account_id: 'A1' }], tickets: [{ ticket_id: 'T1' }] } }, debrief: null };
const settle = () => new Promise(resolve => setTimeout(resolve, 10));

async function run({ search = '', guest = false, saved = new Map() } = {}) {
  const elements = new Map(), requests = [], urls = [];
  const makeElement = () => ({ hidden: false, value: '', textContent: '', children: [], disabled: false,
    classList: { toggle() {} }, addEventListener(name, fn) { this['on' + name] = fn; },
    querySelector() { return this.button ||= { disabled: false }; },
    replaceChildren(...children) { this.children = children; }, append(...children) { this.children.push(...children); },
    createTHead() { return this; }, createTBody() { return this; },
    insertRow() { const child = makeElement(); this.append(child); return child; },
    insertCell() { const child = makeElement(); this.append(child); return child; } });
  const element = id => {
    if (!elements.has(id)) elements.set(id, makeElement());
    return elements.get(id);
  };
  let response = structuredClone(initial);
  const fetch = async (url, options) => {
    requests.push({ url, options });
    if (url.endsWith('/api/config')) return { ok: true, json: async () => ({ briefing: 'Use these records.', warningMinutes: 2 }) };
    const b = JSON.parse(options.body);
    if (!['solo', 'state', 'commit', 'solo_advance', 'solo_report'].includes(b.action)) throw new Error('Unexpected action: ' + b.action);
    if (b.action === 'commit') {
      response.view.commit = { number: '90.0', confidence: 4 };
      response.view.canCommit = false; response.view.canSoloAdvance = true;
    }
    if (b.action === 'solo_advance') {
      response.view.stage++;
      response.debrief = { numbers: [{ label: 'Example 1', number: '90.0' }] };
      if (response.view.stage >= 2) response.debrief.definitions = [{ label: 'Example 1', lines: ownSheet,
        department: 'Sales', purpose: 'Example purpose', derivation: ['Worked calculation'], assigned: true }];
      if (response.view.stage === 3) { response.view.state = 'complete'; response.view.canSoloAdvance = false; }
    }
    return { ok: true, json: async () => structuredClone(response) };
  };
  vm.runInNewContext(source, {
    location: { pathname: '/sim04/index.html', search, hash: guest ? '' : '#lt=' + token },
    document: { getElementById: element, createElement: makeElement },
    sessionStorage: { getItem: key => saved.get(key) || null, setItem: (key, value) => saved.set(key, value) },
    URLSearchParams, fetch, atob: value => Buffer.from(value, 'base64').toString('binary'),
    history: { replaceState(_state, _unused, url) { urls.push(url); } }, setInterval() {}, confirm: () => true
  });
  await settle();
  return { element, requests, urls, saved };
}

(async () => {
  const direct = await run();
  assert(direct.requests.some(r => JSON.parse(r.options.body || '{}').action === 'solo'));
  assert(!direct.requests.some(r => ['course_sessions', 'join', 'start'].includes(JSON.parse(r.options.body || '{}').action)),
    'normal entry never looks for a faculty room or waits for it');
  assert.equal(direct.element('entry').hidden, true);
  assert.equal(direct.element('materials').hidden, false);
  assert.doesNotMatch(source, /Awaiting instructor|waitingHelp|joinForm/);
  assert.equal(direct.element('sheet').children.length, 2);
  assert.equal(direct.element('clock').textContent, '25:00');
  assert.equal(direct.element('soloReview').hidden, true);
  assert.match(direct.urls[0], /solo=1/);
  assert.match(direct.urls[0], /#lt=/);

  direct.element('number').value = '90.0'; direct.element('confidence').value = '4';
  await direct.element('commitForm').onsubmit({ preventDefault() {} });
  assert.equal(direct.element('soloReview').hidden, false);
  assert.equal(direct.element('soloAdvance').textContent, 'View the numbers');
  await direct.element('soloAdvance').onclick();
  assert.equal(direct.element('soloAdvance').textContent, 'View the explanation');
  assert.equal(direct.element('soloReviewBody').children.length, 1);
  await direct.element('soloAdvance').onclick();
  assert.equal(direct.element('soloAdvance').textContent, 'Finish simulation');
  assert.equal(direct.element('soloReviewBody').children.length, 3);
  await direct.element('soloAdvance').onclick();
  assert.equal(direct.element('soloAdvance').hidden, true);
  assert.equal(direct.element('statePill').textContent, 'Complete');

  const resume = await run({ search: '?session=ABCDE&solo=1', saved: direct.saved });
  assert(!resume.requests.some(r => JSON.parse(r.options.body || '{}').action === 'solo'), 'refresh does not create a new session');
  assert(resume.requests.some(r => JSON.parse(r.options.body || '{}').action === 'state'));
  const oldClassLink = await run({ search: '?session=OLD23' });
  assert(oldClassLink.requests.some(r => JSON.parse(r.options.body || '{}').action === 'solo'),
    'old room invitations also start a private run without faculty');
  assert(!oldClassLink.requests.some(r => JSON.parse(r.options.body || '{}').action === 'join'));
  assert.equal(oldClassLink.element('materials').hidden, false);
  const guest = await run({ search: '?guest=1', guest: true });
  assert.equal(guest.element('startForm').hidden, false);
  assert.equal(guest.requests.length, 0);
  await guest.element('startForm').onsubmit({ preventDefault() {} });
  assert.equal(guest.element('materials').hidden, false);
  console.log('PASS Sim04 self-paced entry UI: immediate play, student debrief, completion, refresh, and guests');
})().catch(error => { console.error(error); process.exit(1); });
