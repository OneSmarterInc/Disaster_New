#!/usr/bin/env node
// Every question mark must have something behind it, and nothing should be
// written that no question mark reveals.
const fs=require('fs');
for (const f of ['admin.html','faculty.html']) {
  const html=fs.readFileSync(require('path').join(__dirname,'../public',f),'utf8');
  const keys=[...new Set([...html.matchAll(/helpBtn\('([^']+)'/g)].map(m=>m[1]))];
  const explains=[...new Set([...html.matchAll(/explain\('([^']+)'/g)].map(m=>m[1]))];
  const orphanButtons = keys.filter(k => !explains.some(e => e === k || (k.includes("'+") && e.includes("'+"))));
  const orphanText = explains.filter(e => !keys.some(k => k === e || (e.includes("'+") && k.includes("'+"))));
  console.log(`  ${f}`);
  console.log(`    question marks : ${keys.join(', ')}`);
  console.log(`    explanations   : ${explains.join(', ')}`);
  console.log(`    ${orphanButtons.length||orphanText.length ? 'MISMATCH' : 'every question mark has an answer'}`);
}
