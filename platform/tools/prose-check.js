#!/usr/bin/env node
// Public copy should read as though somebody wrote it. This flags the two
// things that make it read otherwise: sentences that run on, and the handful of
// words that turn up when nobody is paying attention.
const fs = require('fs');
const path = require('path');

const TELLS = [
  'leverage','seamless','robust','cutting-edge','game.changer','unlock','harness',
  'delve','realm','tapestry','synergy','paradigm','next.gen','elevate','empower',
  'transformative','holistic','best.in.class','turnkey','world.class','revolutionary',
  'ensure that you','it is worth noting','in today','landscape','journey','solutions',
  'moreover','furthermore','additionally'
];

let bad = 0;

// the copy that ships on the public page
const sources = [
  ['catalogue defaults', require(path.join(__dirname, '../lib/catalogue.js')).DEFAULTS],
];
for (const d of ['sim', 'sim-02']) {
  try {
    const { META } = require(path.join(__dirname, '../..', d, 'lib/scenario.js'));
    if (META && META.detail) sources.push([META.id, META.detail]);
  } catch (e) {}
}

for (const [name, obj] of sources) {
  const complaints = [];
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v !== 'string' || !v.trim()) continue;
    for (const t of TELLS) {
      if (new RegExp('\\b' + t + '\\b', 'i').test(v)) complaints.push(`${k}: "${t}"`);
    }
    // a sentence past 35 words has usually stopped being one
    v.split(/(?<=[.!?])\s+/).forEach(sent => {
      const n = sent.trim().split(/\s+/).length;
      if (n > 35) complaints.push(`${k}: a ${n}-word sentence`);
    });
  }
  if (complaints.length) { bad += complaints.length; console.log(`  ${name}`); complaints.forEach(c => console.log(`      ${c}`)); }
}

if (bad) { console.error(`\n${bad} thing${bad === 1 ? '' : 's'} to rewrite.`); process.exit(1); }
console.log(`prose check: ${sources.length} sources, nothing overlong and none of the usual tells`);
