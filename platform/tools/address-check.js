#!/usr/bin/env node
// No deployment address should be written into the code. Links are built from
// whatever address the platform is reached at, so a hard-coded one is either
// dead or about to be — and it will be sent to somebody before anyone notices.
//
// Documentation and examples may name an address; code may not.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const SKIP = new Set(['.git', 'node_modules', 'docs']);
// what a deployment address looks like
const HOSTS = /https?:\/\/[a-z0-9-]+\.(vercel\.app|flexee\.org)/gi;
const found = [];

function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { walk(p); continue; }
    if (!/\.(js|html)$/.test(e.name)) continue;
    if (/\.env|README|OPERATIONS/.test(e.name)) continue;
    if (p.includes(path.join('platform', 'tools'))) continue;   // examples in checks
    const s = fs.readFileSync(p, 'utf8');
    s.split('\n').forEach((line, i) => {
      if (/^\s*(\/\/|\*|<!--|#)/.test(line)) return;             // a comment may cite one
      if (/placeholder=|\.env|example/i.test(line)) return;
      const hits = line.match(HOSTS);
      if (hits) found.push(`${path.relative(ROOT, p)}:${i + 1}  ${hits.join(', ')}`);
    });
  }
}
walk(ROOT);

if (found.length) {
  found.forEach(f => console.log('  ' + f));
  console.error(`\n${found.length} hard-coded address${found.length === 1 ? '' : 'es'}. Links should follow the request.`);
  process.exit(1);
}
console.log('address check: no deployment address written into the code');
