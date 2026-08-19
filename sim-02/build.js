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
// Checked case-insensitively on distinctive fragments. A previous version of the
// Rapid Sim 01 guard tested for a phrase the bundle had reworded, so it passed on
// a file that leaked — match on the smallest distinctive piece instead. The
// figures 260 and Ridgeline are absent deliberately, as is 'superseded': all
// three appear in the opening screens, which state both explanations upfront by
// design — the sim tests what a student does about that, not whether they spot it.
const forbidden = [
  'deflection', 'revision c', 'rev c', 'week three', '02:00',
  'ground_truth', 'prohibitions:', 'tier 2', 'tier 1',
  'ingestion job', 'routing threshold',
  'knowledgefor', 'systemPromptFor'.toLowerCase()
];
const hay = out.toLowerCase();
const leaked = forbidden.filter(t => hay.includes(t));
if (leaked.length) {
  console.error('REFUSING: scenario content reached the client bundle:', leaked.join(', '));
  console.error('Anything a student can read must not tell them what the sim is watching for.');
  process.exit(1);
}
console.log(`scenario audit: clean (${forbidden.length} markers checked)`);

// The catalogue copy is published on a public page, so it must give nothing
// away either. Same markers, checked against what this simulation says about
// itself — a description that names the answer is worse than no description.
{
  const { META } = require('./lib/scenario.js');
  const blurb = JSON.stringify(META || {}).toLowerCase();
  const told = forbidden.filter(t => blurb.includes(t));
  if (told.length) {
    console.error('REFUSING: the catalogue copy gives away scenario content:', told.join(', '));
    process.exit(1);
  }
  console.log('catalogue audit: clean');
}
