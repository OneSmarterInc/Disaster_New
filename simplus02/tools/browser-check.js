'use strict';
// Disposable HTTP/Redis/platform fixture; runs the shipped pages in Chromium.
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { chromium } = require('playwright');
const { store, keys } = require('../lib/store');
const C = require('../data/config');
const L = require('../lib/launch');
process.env.LAUNCH_SECRET = 'browser-fixture-secret';
process.env.ACCESS_CODE = 'browser-guest-code';
process.env.FACULTY_CODES = 'Fixture:browser-faculty-code';
const db = new Map(), reports = new Map(), errors = [], requests = [];
Object.assign(store, {
  configured: () => true,
  get: async k => db.has(k) ? JSON.parse(db.get(k)) : null,
  getMany: async ks => ks.map(k => db.has(k) ? JSON.parse(db.get(k)) : null),
  cas: async (k, previous, next) => {
    if ((db.get(k) || '') !== (previous == null ? '' : JSON.stringify(previous))) return false;
    db.set(k, JSON.stringify(next)); return true;
  },
});
const handlers = { '/api/session': require('../api/session'), '/api/finish': require('../api/finish'), '/api/health': require('../api/health') };
const registrations = [];
const server = http.createServer(async (req, res) => {
  try {
    let raw = ''; for await (const chunk of req) raw += chunk;
    req.body = raw ? JSON.parse(raw) : {};
    const url = new URL(req.url, 'http://fixture');
    res.status = n => { res.statusCode = n; return res; };
    res.json = value => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(value)); };
    if (url.pathname.startsWith('/platform/api/')) {
      const p = L.verifyLaunch(req.body.token); assert.ok(p);
      if (url.pathname.endsWith('/register')) { registrations.push(p); return res.json({ ok: true }); }
      assert.equal(p.sim, C.id); assert.equal(p.course, 'class1');
      reports.set(p.sub, (reports.get(p.sub) || 0) + 1);
      return res.status(reports.get(p.sub) === 1 ? 503 : 200).json({ ok: reports.get(p.sub) > 1 });
    }
    const mounted = url.pathname.replace(/^\/simplus02(?=\/|$)/, '') || '/';
    if (handlers[mounted]) return await handlers[mounted](req, res);
    const file = mounted === '/' ? 'index.html' : mounted.slice(1);
    if (!['index.html', 'console.html', 'common.js', 'style.css'].includes(file)) return res.status(404).end();
    res.setHeader('Content-Type', file.endsWith('.html') ? 'text/html' : file.endsWith('.js') ? 'application/javascript' : 'text/css');
    res.end(fs.readFileSync(path.join(__dirname, '../public', file)));
  } catch (e) { errors.push(e.message); res.statusCode = 500; res.end('fixture failed'); }
});
function token(sub, role = 'student', mode = 'play') {
  const raw = Buffer.from(JSON.stringify({ sim: C.id, sub, role, mode, course: 'class1', name: sub, iat: Date.now(), exp: Date.now() + 3600000 })).toString('base64url');
  return raw + '.' + crypto.createHmac('sha256', process.env.LAUNCH_SECRET).update(raw).digest('base64url');
}
let browser;
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  process.env.PLATFORM_URL = origin + '/platform'; process.env.SIM_URL = origin + '/simplus02';
  browser = await chromium.launch({ headless: true });
  async function page() {
    const context = await browser.newContext();
    await context.route(/https:\/\/fonts\./, route => route.fulfill({ status: 200, body: '' }));
    const p = await context.newPage();
    p.on('pageerror', error => errors.push(error.message));
    p.on('request', request => { if (request.url().includes('/api/')) requests.push(request.url()); });
    return p;
  }
  const faculty = await page();
  await faculty.goto(origin + '/simplus02#lt=' + token('teacher', 'faculty', 'session'));
  await faculty.getByRole('button', { name: 'Start a new session' }).waitFor();
  assert.match(faculty.url(), /\/simplus02\/console\.html$/);
  assert.equal(await faculty.locator('#f').count(), 0, 'signed faculty never sees a faculty-code prompt');
  await faculty.locator('#new').click();
  await faculty.locator('.big').waitFor();
  const code = (await faculty.locator('.big').innerText()).trim();
  assert.match(code, /^[A-Z2-9]{5}$/);
  const students = [];
  for (let i = 0; i < 4; i++) {
    const student = await page(); students.push(student);
    await student.goto(origin + '/simplus02#lt=' + token('student' + i));
    await student.getByRole('heading', { name: 'What this proceeding decides' }).waitFor();
    assert.equal(await student.locator('#clock').count(), 0, 'walkthrough has no running clock');
    assert.equal(await student.locator('#c').count(), 0, 'course entry joins without a classroom-code prompt');
  }
  assert.equal(Object.keys(await store.get(keys.roster(code))).length, 4);
  for (const step of [1, 2]) {
    await students[0].locator('#walk-next').click();
    await students[0].waitForFunction(expected => view.walkthrough.step === expected, step);
  }
  const recovered = await page();
  await recovered.goto(origin + '/simplus02/?session=' + code + '#lt=' + token('student0'));
  await recovered.getByRole('heading', { name: 'What the deadline does' }).waitFor();
  await recovered.locator('#walk-back').click();
  await recovered.getByRole('heading', { name: 'How the term sheet works' }).waitFor();
  await recovered.locator('#walk-next').click();
  await recovered.getByRole('heading', { name: 'What the deadline does' }).waitFor();
  assert.equal(Object.keys(await store.get(keys.roster(code))).length, 4, 'fresh-tab account recovery does not duplicate seats');
  await students[0].context().close(); students[0] = recovered;
  await faculty.reload();
  await faculty.locator('.big').waitFor();
  assert.equal(await faculty.locator('#f').count(), 0, 'console reload retains its scoped launch token');
  await faculty.locator('#seat').click();
  await faculty.getByRole('button', { name: 'Start briefing' }).waitFor();
  assert.equal(await faculty.locator('#next').isEnabled(), false, 'faculty cannot start the timed briefing while students are reading');
  assert.equal((await store.get(keys.session(code))).phaseEndsAt, null);
  async function finishWalkthrough(student) {
    for (let step = (await student.evaluate(() => view.walkthrough.step)) + 1; step <= 4; step++) {
      await student.locator('#walk-next').click();
      await student.waitForFunction(expected => view.walkthrough.step === expected, step);
    }
    await student.getByText('Walkthrough complete.', { exact: false }).waitFor();
  }
  for (const student of students) await finishWalkthrough(student);
  await faculty.waitForFunction(() => c.walkthrough.finished === 4);
  assert.equal(await faculty.locator('#next').isEnabled(), true);
  for (const phase of ['briefing', 'openings', 'negotiation']) {
    await faculty.locator('#next').click();
    await faculty.waitForFunction(expected => c && c.phase === expected, phase);
  }
  for (const student of students) {
    await student.locator('select[data-dial="top"]').waitFor();
    assert.equal(await student.locator('select[data-dial="top"]').isEnabled(), true);
  }
  await students[0].locator('select[data-dial="top"]').selectOption('75');
  await students[0].waitForFunction(() => view && view.sheet.dials.top === 75);
  faculty.once('dialog', dialog => dialog.accept());
  await faculty.locator('#close').click();
  await faculty.waitForFunction(() => c && c.phase === 'closed');
  for (const student of students) {
    await student.getByRole('heading', { name: 'What happens next' }).waitFor();
    await student.waitForFunction(() => reported === true);
    await student.evaluate(() => poll());
  }
  assert.equal(reports.size, 4);
  assert.ok([...reports.values()].every(n => n === 2), 'each failed report retries once, then stops');
  assert.ok(requests.every(u => u.startsWith(origin + '/simplus02/api/')), 'mounted APIs stay under the platform prefix');
  const standalone = await fetch(origin + '/api/session', {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-faculty-code': 'browser-faculty-code' },
    body: JSON.stringify({ action: 'create' }),
  });
  assert.equal(standalone.status, 200);
  const standaloneCode = (await standalone.json()).code;
  const guest = await page();
  await guest.goto(origin + '/?guest=1');
  await guest.locator('#a').waitFor();
  assert.equal(await guest.locator('#c').count(), 1, 'standalone guests retain the classroom join form');
  await guest.locator('#c').fill(standaloneCode);
  await guest.locator('#n').fill('Guest');
  await guest.locator('#a').fill('browser-guest-code');
  await guest.locator('#go').click();
  await guest.getByRole('heading', { name: 'What this proceeding decides' }).waitFor();
  assert.equal(new URL(guest.url()).searchParams.get('guest'), '1');
  assert.equal(new URL(guest.url()).searchParams.get('code'), standaloneCode);
  await guest.locator('#walk-next').click();
  await guest.getByRole('heading', { name: 'How the term sheet works' }).waitFor();
  await guest.reload();
  await guest.getByRole('heading', { name: 'How the term sheet works' }).waitFor();
  await finishWalkthrough(guest);
  assert.ok(requests.some(u => u === origin + '/api/session'), 'own-domain root uses root APIs');
  assert.ok(registrations.some(p => p.sim === C.id && p.number === 102));
  assert.deepEqual(errors, [], 'shipped pages and handlers have no uncaught errors');
  console.log('PASS SimPlus-02 Chromium flow: faculty launch/reload, four account joins, untimed walkthrough/resume/readiness, negotiation, close, completion retries, standalone entry and mounted assets/APIs.');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  if (browser) await browser.close();
  server.close();
});
