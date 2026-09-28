'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const launch = fs.readFileSync(path.join(__dirname, '../public/launch.html'), 'utf8')
  .match(/<script>([\s\S]*?)<\/script>/)[1];
const entry = fs.readFileSync(path.join(__dirname, '../public/index.html'), 'utf8');
const entryRedirect = entry.match(/<script id="platform-entry-redirect">([\s\S]*?)<\/script>/)[1];
const student = fs.readFileSync(path.join(__dirname, '../public/student.js'), 'utf8');

function redirectDestination({ hostname = 'sim04.vercel.app', search = '', hash = '', stored = {} } = {}) {
  let destination;
  const storage = new Map(Object.entries(stored));
  vm.runInNewContext(entryRedirect, {
    location: { hostname, search, hash, replace(url) { destination = url; } },
    sessionStorage: { getItem: key => storage.get(key) || null }, URLSearchParams, URL
  });
  return destination;
}

function launchPage(pathname, search = '', hash = '', result = { status: 'not_entitled', message: 'Not enrolled' }) {
  const values = new Map(); let destination;
  const element = id => {
    if (!values.has(id)) values.set(id, { hidden: false, textContent: '', href: '', addEventListener() {} });
    return values.get(id);
  };
  vm.runInNewContext(launch, {
    location: { pathname, search, hash, replace(url) { destination = url; } },
    document: { getElementById: element }, sessionStorage: { setItem() {} },
    URLSearchParams, atob: text => Buffer.from(text, 'base64').toString('binary'),
    platformLaunch: async () => result
  });
  return new Promise(resolve => setTimeout(() => resolve({ element, destination }), 0));
}

(async () => {
  assert.equal(redirectDestination(), 'https://rapidsims.flexee.org/sim04/',
    'a bare production Sim04 page goes through the signed RapidSims launch');
  assert.equal(redirectDestination({ search: '?session=wn26h&course=course-123' }),
    'https://rapidsims.flexee.org/session.html?sim=rapid-04-whose-number&session=WN26H&course=course-123',
    'an old room link resumes through the account-bound class invitation');
  assert.equal(redirectDestination({ search: '?standalone=1' }), 'https://rapidsims.flexee.org/sim04/',
    'the standalone query cannot expose a student room-code path');
  assert.equal(redirectDestination({ stored: { 'm04-access': 'entered' } }), 'https://rapidsims.flexee.org/sim04/',
    'a saved legacy code cannot bypass the signed course launch');
  assert.equal(redirectDestination({ hash: '#lt=signed-token' }), undefined,
    'signed launches stay on Sim04');
  assert.equal(redirectDestination({ hostname: 'localhost' }), undefined,
    'local development does not redirect to production');

  assert.doesNotMatch(entry, /Classroom code|Enter a room code instead|five-character room code/,
    'the student entry page does not render a classroom-code prompt');
  assert.doesNotMatch(launch, /Student access code|standalone-toggle|Use a standalone access code/,
    'the launch page does not render an access-code prompt');
  assert.doesNotMatch(student, /manual-room-toggle|Enter a room code instead/,
    'the student script has no manual room-code fallback');

  const direct = await launchPage('/launch.html');
  assert.equal(direct.destination, 'https://rapidsims.flexee.org/sim04/',
    'opening the Sim04 host always hands off to the signed course launch');
  const oldDirectInvite = await launchPage('/launch.html', '?session=wn26h&course=course-123');
  assert.equal(oldDirectInvite.destination,
    'https://rapidsims.flexee.org/session.html?sim=rapid-04-whose-number&session=WN26H&course=course-123',
    'a direct room invitation enters through the account-bound session page');
  const coursePage = await launchPage('/sim04/launch.html');
  assert.equal(coursePage.element('message').textContent, 'Not enrolled');
  assert.equal(coursePage.element('course-link').hidden, false);
  console.log('PASS Sim04 student access UI: signed course launch only, no classroom or access-code prompt');
})().catch(error => { console.error(error); process.exit(1); });
