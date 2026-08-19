#!/usr/bin/env node
// Behind the platform's domain this simulation is served under /sim01, and
// every request it makes has to carry that prefix. Defining BASE and then not
// using it looks fine to a syntax check and to a boot check — the page loads,
// and every call lands on the platform instead. That is what happened.
const fs = require('fs');
const path = require('path');

const targets = [
  ['the built bundle', path.join(__dirname, '../public/index.html')],
  ['the session console', path.join(__dirname, '../public/faculty.html')]
];
let bad = 0;

for (const [name, file] of targets) {
  const s = fs.readFileSync(file, 'utf8');
  if (!s.includes('const BASE')) { bad++; console.log(`  ${name}: does not work out where it is served from`); continue; }

  // any call that starts at the root and does not carry the prefix
  const bare = [
    ...s.matchAll(/fetch\(\s*'(\/[^']*)'/g),
    ...s.matchAll(/location\.replace\(\s*'(\/[^']*)'/g),
    ...s.matchAll(/location\.href\s*=\s*'(\/[^']*)'/g)
  ].map(m => m[1]).filter(u => !u.startsWith('//'));

  if (bare.length) {
    bad += bare.length;
    console.log(`  ${name}: ${bare.length} request(s) ignore the prefix — ${[...new Set(bare)].join(', ')}`);
  }
}

if (bad) {
  console.error('\nUnder /sim01 these would land on the platform, which answers 404.');
  process.exit(1);
}
console.log('prefix check: every request carries the path it was served from');
