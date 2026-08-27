#!/usr/bin/env node
// Assembles public/index.html from src/. The client is one self-contained file
// so it loads in a single request with no build step at deploy time.
//
// The audit below is the reason this script exists at all. Sim 01 shipped a
// forbidden-terms list that had drifted from the regex meant to enforce it, so
// the check passed on a bundle that leaked. Here the list IS the check — one
// array, used once. Do not add a second copy anywhere.

const fs = require('fs');
const path = require('path');

const src = (f) => fs.readFileSync(path.join(__dirname, 'src', f), 'utf8');

const out = src('shell.html').replace('/*__CLIENT__*/', src('client.js'));

const dest = path.join(__dirname, 'public', 'index.html');
fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.writeFileSync(dest, out);
console.log(`built ${path.relative(process.cwd(), dest)} — ${out.length} bytes`);

// ---------------------------------------------------------------------------
// Scenario audit
//
// Every term here is something the participant must not be able to read out of
// the bundle. The action ids are included deliberately: a participant who can
// see that one action is tagged `inspect` knows there is something to inspect,
// which is the entire discovery the sim is built around.
//
// Terms are matched on the smallest distinctive fragment. Matching a phrase
// means a reworded bundle passes while still leaking.
// ---------------------------------------------------------------------------
const forbidden = [
  'downstreameffects', 'harmthreshold', 'strainband', 'strain',
  'clear_fast', 'bench_test', 'call_field', 'reissue',
  'okonjo', 'first-time-fix', 'field engineering',
  'lag', 'inspect', 'harm', 'verdict', 'debrieffor',
  'process =', 'stations:', 'availablefrom'
];

const hay = out.toLowerCase();
const leaked = forbidden.filter(t => hay.includes(t));
if (leaked.length) {
  console.error('REFUSING: scenario content reached the client bundle:', leaked.join(', '));
  console.error('Anything a participant can read must not tell them what the sim is watching for.');
  process.exit(1);
}
console.log(`scenario audit: clean (${forbidden.length} markers checked)`);

// The catalogue copy is published on a public page, so it must not give the
// ending away either. This checks the one thing that would ruin the sim for
// somebody who read the description before playing.
const S = require('./lib/scenario.js');
const blurb = [S.META.tagline, S.META.description, S.META.detail.turn, S.META.detail.after].join(' ').toLowerCase();
const spoilers = ['wrong part', 'symptom code', 'second visit', 'performance review'];
const spoiled = spoilers.filter(t => blurb.includes(t));
if (spoiled.length) {
  console.error('REFUSING: catalogue copy gives away the mechanism:', spoiled.join(', '));
  process.exit(1);
}
console.log('catalogue audit: clean');
