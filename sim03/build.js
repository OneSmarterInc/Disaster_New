#!/usr/bin/env node
// RapidSim 03 ships a prebuilt, dependency-free client. This build step applies
// presentation-only conformance rewrites, then refuses to deploy if deterministic
// rules leak into the browser, path-prefixing is broken, client JavaScript does
// not parse, or the scenario/session contract tests fail.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { execFileSync } = require('child_process');
const S = require('./lib/scenario.js');
const clientOverrides = require('./tools/client-overrides.js');
const instructorOverrides = require('./tools/instructor-overrides.js');

const file = (name) => path.join(__dirname, 'public', name);
const read = (name) => fs.readFileSync(file(name), 'utf8');

function replaceRequired(source, from, to, label) {
  if (!source.includes(from)) {
    if (source.includes(to)) return source;
    throw new Error(`student/instructor conformance rewrite missing: ${label}`);
  }
  return source.replace(from, to);
}

function replaceFunction(source, name, fn) {
  const marker = `function ${name}(`;
  const start = source.indexOf(marker);
  if (start < 0) throw new Error(`student conformance rewrite missing function: ${name}`);
  const next = source.indexOf('\nfunction ', start + marker.length);
  if (next < 0) throw new Error(`student conformance rewrite could not find end of function: ${name}`);
  return source.slice(0, start) + fn.toString() + source.slice(next);
}

let index = read('index.html');
let instructor = read('instructor.html');
const launcher = read('launch.html');

index = replaceRequired(
  index,
  '  <div class="card" style="margin-top:10px"><h3>The wall</h3><p>Run cannot go below $3M. Each of the other four lines cannot exceed $3M in a year. Your total must be exactly $9M.</p></div>\n',
  '',
  'remove The wall card'
);
index = replaceRequired(
  index,
  "${l.id==='run'?'minimum 3 · no upper cap':'maximum 3 per year'}",
  "${l.id==='run'?'<span title=\"Run must stay at $3M or more to keep current operations functioning.\" aria-label=\"Why Run cannot go lower\">ⓘ</span>':''}",
  'replace static allocator constraint labels'
);

index = replaceRequired(
  index,
  '<div class="outcome"><div class="band">${esc(o.band)}</div><h3>',
  '<div class="outcome"><h3>',
  'hide Year 1/Year 3 raw band label'
);
index = index.replace('<div class="outcome"><div class="band">${esc(o.band)}</div><h3>', '<div class="outcome"><h3>');
index = replaceRequired(
  index,
  '<div class="events"><div class="outcome"><div class="band">${esc(o.heat.band)}</div><h3>',
  '<div class="events"><div class="outcome"><h3>',
  'hide heat-wave raw band label'
);
index = replaceRequired(
  index,
  '<div class="outcome"><div class="band">${esc(o.competitor.band)}</div><h3>',
  '<div class="outcome"><h3>',
  'hide competitor raw band label'
);

index = replaceRequired(
  index,
  "reflection1:'',reflection2:'',finished:false,",
  "reflection1:'',reflection2:'',finished:false,year2Event:0,",
  'add Year 2 sequential-event state'
);
index = replaceRequired(
  index,
  '${nav({nextLabel:left===0?',
  '${nav({backOk:year===1,nextLabel:left===0?',
  'remove Back from Year 2 allocation after Year 1 commitment'
);
for (const name of ['renderYear1Outcome','renderYear2Events','renderYear3','renderBuyers','renderClose']) {
  index = replaceFunction(index, name, clientOverrides[name]);
}

index = replaceRequired(
  index,
  '@media print{header,.actions,.team{display:none}.page{width:100%;padding:0}body{background:white;color:black}.card,.outcome,.run-cell{background:white;border-color:#aaa;color:black}}',
  '@media print{header,.actions,.team{display:none!important}.page{width:100%!important;padding:0!important}body{background:#fff!important;background-image:none!important;color:#000!important}.page,.page *{color:#000!important}.card,.outcome,.run-cell,.mini div{background:#fff!important;border-color:#999!important;color:#000!important}.eyebrow,.hint,.run-cell .k,.mini span{color:#222!important}.card,.outcome{break-inside:avoid}.summary{break-inside:avoid}}',
  'make printed summary high-contrast'
);

instructor = replaceRequired(
  instructor,
  "heatUptimeMiddle:'Heat wave middle ='",
  "heatUptimeMiddle:'Heat wave middle starts at ≥'",
  'clarify heat middle calibration label'
);
instructor = replaceFunction(instructor, 'sentences', instructorOverrides.sentences);

fs.writeFileSync(file('index.html'), index);
fs.writeFileSync(file('instructor.html'), instructor);

const leaked = Object.keys(S.DEFAULT_THRESHOLDS).filter(k => index.includes(k));
if (leaked.length) {
  console.error('REFUSING: outcome threshold names reached the student bundle:', leaked.join(', '));
  process.exit(1);
}
for (const narrative of [
  'Report produced in a day.',
  'Four days down in the hottest week.',
  'Match it. You know which units are healthy',
  'Nothing to predict from.'
]) {
  if (index.includes(narrative)) {
    console.error('REFUSING: future outcome copy reached the student bundle:', narrative);
    process.exit(1);
  }
}
if (index.includes('<h3>The wall</h3>')) {
  console.error('REFUSING: student bundle explains the allocation wall before the debrief');
  process.exit(1);
}
for (const marker of ['${esc(o.band)}', '${esc(o.heat.band)}', '${esc(o.competitor.band)}']) {
  if (index.includes(marker)) {
    console.error('REFUSING: grade-like outcome band label reached the student UI:', marker);
    process.exit(1);
  }
}
for (const marker of ['Continue to the second event','Your summary','Print / save PDF','nav({backOk:false})','backOk:year===1']) {
  if (!index.includes(marker)) {
    console.error('REFUSING: linear-flow/print conformance marker missing:', marker);
    process.exit(1);
  }
}
if (!instructor.includes('Anonymous run ${i+1}')) {
  console.error('REFUSING: projector-friendly opening sentence cards are missing');
  process.exit(1);
}

for (const [name, source] of [['student', index], ['instructor', instructor]]) {
  if (/fetch\s*\(\s*['"]\/api\//.test(source)) {
    console.error(`REFUSING: ${name} client contains an unprefixed /api fetch`);
    process.exit(1);
  }
  if (!source.includes("location.pathname.match(/^\\/sim-?\\d+/)")) {
    console.error(`REFUSING: ${name} client is missing the simulation path-prefix detector`);
    process.exit(1);
  }
}
if (!launcher.includes("location.pathname.match(/^\\/sim-?\\d+/)")) {
  console.error('REFUSING: launch router is missing the simulation path-prefix detector');
  process.exit(1);
}

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
  console.error('REFUSING: browser JavaScript does not parse:', e.message);
  process.exit(1);
}

execFileSync(process.execPath, [path.join(__dirname, 'tools', 'check.js')], { stdio: 'inherit' });
execFileSync(process.execPath, [path.join(__dirname, 'tools', 'session-auth-check.js')], { stdio: 'inherit' });
console.log('RapidSim 03 build guards passed.');
