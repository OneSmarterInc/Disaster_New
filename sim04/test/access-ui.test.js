'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const launch = fs.readFileSync(path.join(__dirname, '../public/launch.html'), 'utf8')
  .match(/<script>([\s\S]*?)<\/script>/)[1];
const instructor = fs.readFileSync(path.join(__dirname, '../public/instructor.js'), 'utf8');
const student = fs.readFileSync(path.join(__dirname, '../public/student.js'), 'utf8');

function page(source, pathname, search = '') {
  const values = new Map(), calls = [];
  const element = id => {
    if (!values.has(id)) values.set(id, {
      hidden: ['gate', 'create', 'reopen', 'signIn'].includes(id), value: '', textContent: '',
      classList: { toggle() {} }, addEventListener() {}, focus() {}
    });
    return values.get(id);
  };
  const storage = new Map();
  const location = { pathname, search, hash: '', replace(url) { this.destination = url; } };
  const fetch = async (url, options) => {
    calls.push({ url, options });
    const isTeacher = options?.body && JSON.parse(options.body).action === 'faculty_access';
    const allowed = !isTeacher || JSON.parse(options.body).facultyCode === 'teacher-only';
    return { ok: allowed, status: allowed ? 200 : 401,
      json: async () => allowed ? { ok: true } : { error: 'faculty_authorization_required' } };
  };
  vm.runInNewContext(source, { location, fetch, document: { getElementById: element },
    sessionStorage: { getItem: k => storage.get(k) || null, setItem: (k, v) => storage.set(k, v),
      removeItem: k => storage.delete(k) }, URLSearchParams, setInterval() {} });
  return { element, location, calls, storage };
}

function studentEntryHelp(token, search = '') {
  const values = new Map();
  const source = student.slice(0, student.indexOf('function headers()'));
  vm.runInNewContext(source, {
    location: { pathname: '/sim04/index.html', search, hash: token ? '#lt=' + token : '' },
    document: { getElementById: id => { if (!values.has(id)) values.set(id, { textContent: '' }); return values.get(id); } },
    sessionStorage: { getItem: () => null, setItem() {} }, URLSearchParams,
    atob: value => Buffer.from(value, 'base64').toString('binary')
  });
  return values.get('entryHelp')?.textContent || '';
}

(async () => {
  const studentToken = Buffer.from(JSON.stringify({ role: 'student' })).toString('base64url') + '.signature';
  assert.match(studentEntryHelp(studentToken), /student sign-in is valid/i);
  assert.match(studentEntryHelp(studentToken), /do not need a faculty code/i);

  const student = page(launch, '/sim04/launch.html');
  assert.equal(student.element('instructorLink').href, '/sim04/instructor.html');
  student.element('code').value = 'student-only';
  await student.element('open').onclick();
  assert.equal(student.location.destination, '/sim04/index.html');
  assert.equal(student.calls[0].options.headers['x-access-code'], 'student-only');
  assert.equal(student.calls[0].options.headers['x-faculty-code'], undefined);

  const invitation = page(launch, '/sim04/launch.html', '?session=ABCDE');
  assert.equal(invitation.location.destination, '/sim04/api/join?session=ABCDE');
  const standalone = page(launch, '/sim04/launch.html', '?session=ABCDE&standalone=1');
  assert.equal(standalone.location.destination, undefined);
  standalone.element('code').value = 'student-only';
  await standalone.element('open').onclick();
  assert.equal(standalone.location.destination, '/sim04/index.html?session=ABCDE');
  assert.equal(standalone.calls[0].url, '/sim04/api/config');

  const teacher = page(instructor, '/sim04/instructor.html');
  assert.equal(teacher.element('signIn').hidden, false);
  assert.equal(teacher.element('create').hidden, true);
  teacher.element('facultyCode').value = 'student-only';
  await teacher.element('saveCode').onclick();
  assert.equal(teacher.element('create').hidden, true);
  teacher.element('facultyCode').value = 'teacher-only';
  await teacher.element('saveCode').onclick();
  assert.equal(teacher.element('signIn').hidden, true);
  assert.equal(teacher.element('create').hidden, false);
  assert.equal(teacher.element('reopen').hidden, false);
  assert.equal(teacher.calls.at(-1).options.headers['x-faculty-code'], 'teacher-only');
  console.log('4 access UI paths passed, 0 failed');
})().catch(e => { console.error('FAIL', e.stack); process.exitCode = 1; });
