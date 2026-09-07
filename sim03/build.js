#!/usr/bin/env node
// RapidSim 03 ships committed source HTML. This build step is assertion-only:
// it never rewrites source files. It refuses deployment if student-facing
// ambiguity leaks, path-prefixing breaks, browser JavaScript does not parse,
// access gating regresses, or scenario/session contracts fail.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { execFileSync } = require('child_process');
const S = require('./lib/scenario.js');

const read = (name) => fs.readFileSync(path.join(__dirname, 'public', name), 'utf8');
const index = read('index.html');
const instructor = read('instructor.html');
const launcher = read('launch.html');
const configApi = fs.readFileSync(path.join(__dirname, 'api', 'config.js'), 'utf8');

function refuse(message) {
  console.error('REFUSING:', message);
  process.exit(1);
}

const leaked = Object.keys(S.DEFAULT_THRESHOLDS).filter(k => index.includes(k));
if (leaked.length) refuse('outcome threshold names reached the student bundle: ' + leaked.join(', '));

for (const narrative of [
  'Report produced in a day.',
  'Four days down in the hottest week.',
  'Match it. You know which units are healthy',
  'Nothing to predict from.'
]) {
  if (index.includes(narrative)) refuse('future outcome copy reached the student bundle: ' + narrative);
}

if (index.includes('<h3>The wall</h3>')) {
  refuse('student bundle explains the allocation wall before the debrief');
}
for (const marker of ['${esc(o.band)}', '${esc(o.heat.band)}', '${esc(o.competitor.band)}']) {
  if (index.includes(marker)) refuse('grade-like outcome band label reached the student UI: ' + marker);
}

for (const marker of [
  'Continue to the second event',
  'Your summary',
  'Print / save PDF',
  'nav({backOk:false})',
  'backOk:year===1',
  'function friendlyError(code,status)',
  'briefing packet your instructor posted before class',
  "sessionStorage.getItem('m03-access')"
]) {
  if (!index.includes(marker)) refuse('required student conformance marker missing: ' + marker);
}

for (const raw of ['strategic_view_locked','year1_locked','year2_locked']) {
  if (!index.includes(raw)) refuse('friendly error mapping missing for: ' + raw);
}

if (!instructor.includes('Anonymous run ${i+1}')) {
  refuse('projector-friendly opening sentence cards are missing');
}
if (!instructor.includes("Heat wave middle starts at ≥")) {
  refuse('instructor calibration label does not describe the middle-band lower bound');
}

for (const [name, source] of [['student', index], ['instructor', instructor]]) {
  if (/fetch\s*\(\s*['"]\/api\//.test(source)) refuse(`${name} client contains an unprefixed /api fetch`);
  if (!source.includes("location.pathname.match(/^\\/sim-?\\d+/)")) {
    refuse(`${name} client is missing the simulation path-prefix detector`);
  }
}
if (!launcher.includes("location.pathname.match(/^\\/sim-?\\d+/)")) {
  refuse('launch router is missing the simulation path-prefix detector');
}
for (const marker of ['Access code','x-access-code',"sessionStorage.setItem('m03-access'","sessionStorage.removeItem('m03-access')",'/api/config']) {
  if (!launcher.includes(marker)) refuse('standalone access-code gate missing marker: ' + marker);
}
if (launcher.includes('if(remembered)verify()')) {
  refuse('access gate auto-submits remembered codes and can create a refresh loop');
}
if (launcher.includes('#code=')) {
  refuse('standalone access code must stay in sessionStorage rather than the URL fragment');
}
if (!configApi.includes('checkAccess(req, res)')) {
  refuse('public config bootstrap is not protected by the shared access guard');
}
if (index.includes("location.replace(BASE+'/')")) {
  refuse('student access failure automatically redirects to the gate and can loop');
}
if (!index.includes('Enter access code')) {
  refuse('student access failure does not offer a stable manual return to the gate');
}
if (!index.includes("location.assign(BASE+'/launch.html')")) {
  refuse('student access button does not target the explicit launch gate');
}

for (const marker of [
  'Join a facilitated session', 'Team name <span', 'function safeToRerender()',
  "if(S.session)await saveRun({reflection1:S.reflection1,reflection2:S.reflection2,done:true})",
  "C.buyers?.authored===false", "const committed=!!(S.viewCommitted||S.teamRun?.strategicView||S.year1Outcome)"
]) if (!index.includes(marker)) refuse('team/conformance student marker missing: ' + marker);
for (const marker of ['Resume session code','Students self-select teams at join',"action:'set_captain'",'function startPresent()','dotcount','the annual cap is the wall'])
  if (!instructor.includes(marker)) refuse('team/projector instructor marker missing: ' + marker);
if (index.includes('Valuation pending authored rule')) refuse('unauthored buyer placeholder reached the student bundle');
if (index.includes('authored calibration does not yet define')) refuse('Year 3 calibration scaffolding reached the student bundle');

function checkScripts(name, source) {
  const scripts = [...source.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)].map(m => m[1]);
  if (!scripts.length) throw new Error(`${name}: no inline script found`);
  scripts.forEach((code, i) => new vm.Script(code, { filename: `${name}:script-${i + 1}` }));
}
try {
  checkScripts('index.html', index);
  checkScripts('instructor.html', instructor);
  checkScripts('launch.html', launcher);
} catch (e) {
  refuse('browser JavaScript does not parse: ' + e.message);
}

execFileSync(process.execPath, [path.join(__dirname, 'tools', 'check.js')], { stdio: 'inherit' });
execFileSync(process.execPath, [path.join(__dirname, 'tools', 'session-auth-check.js')], { stdio: 'inherit' });
execFileSync(process.execPath, [path.join(__dirname, 'tools', 'session-commit-check.js')], { stdio: 'inherit' });
execFileSync(process.execPath, [path.join(__dirname, 'tools', 'access-check.js')], { stdio: 'inherit' });
execFileSync(process.execPath, [path.join(__dirname, 'tools', 'team-flow-check.js')], { stdio: 'inherit' });
execFileSync(process.execPath, [path.join(__dirname, 'tools', 'team-handler-check.js')], { stdio: 'inherit' });

console.log('RapidSim 03 build guards passed.');
