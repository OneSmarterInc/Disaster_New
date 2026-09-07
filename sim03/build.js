#!/usr/bin/env node
// RapidSim 03 ships a prebuilt, dependency-free client. This build step is a
// production guard: it refuses to deploy if deterministic rules leak into the
// browser, path-prefixing is broken, or the scenario contract tests fail.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const S = require('./lib/scenario.js');

const index = fs.readFileSync(path.join(__dirname, 'public', 'index.html'), 'utf8');
const faculty = fs.readFileSync(path.join(__dirname, 'public', 'faculty.html'), 'utf8');

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

// When proxied by rapidsims.flexee.org, browser calls must preserve /sim03.
// Absolute "/api" fetches would silently hit the platform instead.
for (const [name, source] of [['student', index], ['faculty', faculty]]) {
  if (/fetch\s*\(\s*['"]\/api\//.test(source)) {
    console.error(`REFUSING: ${name} client contains an unprefixed /api fetch`);
    process.exit(1);
  }
  if (!source.includes("location.pathname.match(/^\\/sim-?\\d+/)")) {
    console.error(`REFUSING: ${name} client is missing the simulation path-prefix detector`);
    process.exit(1);
  }
}

execFileSync(process.execPath, [path.join(__dirname, 'tools', 'check.js')], { stdio: 'inherit' });
console.log('RapidSim 03 build guards passed.');
