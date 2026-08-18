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
//
// The list below is checked case-insensitively and in fragments, because a
// previous version tested for 'Q3 cost review' while the bundle actually
// shipped 'q3|cost review|overrul|...' — different wording, so the check passed
// on a file that leaked. Match on the smallest distinctive piece, not on a
// phrase someone might reword.
// Distinctive fragments only. Avoid anything that is a substring of an ordinary
// word — 'knowledge' matches 'acknowledge', for instance. FW-2231 is absent
// deliberately: it is named on the opening screens as part of Kate's exposure.
const forbidden = [
  'svc-bkp-legacy', 'san-07', 'crm-db',
  'cost review', 'was overruled', 'edr coverage', 'coverage was cut',
  'ground_truth', 'prohibitions:', 'tier 2', 'tier 1',
  'dwell time', 'firmware fault caused', 'staging directory'
];
const hay = out.toLowerCase();
const leaked = forbidden.filter(t => hay.includes(t));
if (leaked.length) {
  console.error('REFUSING: scenario content reached the client bundle:', leaked.join(', '));
  console.error('Anything a student can read must not tell them what the sim is watching for.');
  process.exit(1);
}
console.log(`scenario audit: clean (${forbidden.length} markers checked)`);
