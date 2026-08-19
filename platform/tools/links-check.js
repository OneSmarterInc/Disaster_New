#!/usr/bin/env node
// Every internal link must point at a page that exists. A link to a file that
// was renamed looks fine in the markup and dead-ends the person who follows it.
const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, '..', 'public');
const files = fs.readdirSync(dir);
let bad = 0;

for (const f of files.filter(x => x.endsWith('.html'))) {
  const s = fs.readFileSync(path.join(dir, f), 'utf8');
  const targets = new Set();
  [...s.matchAll(/href="(\/[^"#?]*)"/g)].forEach(m => targets.add(m[1]));
  [...s.matchAll(/location\.href\s*=\s*'(\/[^'?#]*)'/g)].forEach(m => targets.add(m[1]));
  [...s.matchAll(/location\.replace\('(\/[^'?#]*)'/g)].forEach(m => targets.add(m[1]));

  for (const t of targets) {
    if (t === '/') continue;                         // the catalogue itself
    if (t.startsWith('/api/')) continue;             // handled by functions
    const file = t.replace(/^\//, '');
    if (!files.includes(file)) { bad++; console.log(`  ${f} → ${t} does not exist`); }
  }
}
if (bad) { console.error(`\n${bad} dead link${bad === 1 ? '' : 's'}.`); process.exit(1); }
console.log('link check: every internal link points at a page that exists');
