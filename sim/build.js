#!/usr/bin/env node
// Assembles public/index.html from the three source files in src/.
// The client is a single self-contained file so it loads in one request and has
// no build step at deploy time — this script is just how it gets stitched.
const fs = require('fs');
const path = require('path');

const src = (f) => fs.readFileSync(path.join(__dirname, 'src', f), 'utf8');

const out = src('shell.html')
  .replace('/*__SCENARIO__*/', src('client-scenario.js'))
  .replace('/*__ENGINE__*/', src('engine.js'));

const dest = path.join(__dirname, 'public', 'index.html');
fs.writeFileSync(dest, out);
console.log(`built ${path.relative(process.cwd(), dest)} — ${out.length} bytes`);

// Guard: the scenario must never end up in the browser bundle.
const forbidden = ['svc-bkp-legacy', 'SAN-07', 'Q3 cost review', 'GROUND_TRUTH', 'KNOWLEDGE'];
const leaked = forbidden.filter(t => out.includes(t));
if (leaked.length) {
  console.error('REFUSING: scenario content leaked into the client bundle:', leaked.join(', '));
  process.exit(1);
}
console.log('scenario audit: clean');
