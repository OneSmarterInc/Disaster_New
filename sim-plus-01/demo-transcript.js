'use strict';
// Renders two sessions side by side: an informed run and one that closed
// the analyst in the first two minutes. The comparison is the teaching
// move, which is why the spec argues for it in v1.
const { Session } = require('./src/engine');
const { review } = require('./src/report');
const { buildEnvelope, makeResolver } = require('./src/transcript');
const { renderPage } = require('./src/render-transcript');
const fs = require('fs');

const J = 'Recorded during the interview windows.';
const form = (rows, rc) => ({ rootCause: rc, rows: Object.fromEntries(
  Object.entries(rows).map(([k, d]) => [k, { disposition: d, justification: J }])) });

// --- run one: informed, and still fires the harm ---------------------
const a = new Session().chooseOrder(['terry','ray','ruth']);
['Why does the log exist?','Who reads the log?','Have you ever seen anyone pull it up?',
 'What do you tell them when they call?'].forEach(q => a.ask(q));
a.advanceWindow();
['How many claims a day?','Do we send anything back to them?',
 'What is the turnaround from the vendor?'].forEach(q => a.ask(q));
a.advanceWindow();
['Is there anything you catch that nothing else would?','Why do they send it again?',
 'How long is the gap between copies?'].forEach(q => a.ask(q));
const subA = form({intake:'automate',log:'eliminate',vendor:'cannot_assess',review:'automate'},
  'Providers re-send because nothing acknowledges receipt. The repeat volume is ours.');

// --- run two: closed her at 00:02 ------------------------------------
const b = new Session().chooseOrder(['ruth','terry','ray']);
['So what do you do here?','How much of this could the new system handle?',
 'Do you get many repeat claims?','What happens when you are out sick?'].forEach(q => b.ask(q));
b.advanceWindow();
['Why does the log exist?','Who reads the log?'].forEach(q => b.ask(q));
b.advanceWindow();
['How many claims a day?','Do we send anything back to them?'].forEach(q => b.ask(q));
const subB = form({intake:'keep',log:'keep',vendor:'keep',review:'automate'},
  'Manual duplicate matching is the main constraint on throughput.');

const envA = buildEnvelope(a, review(subA, a.transcript),
  { sessionId:'s-a', participant:{ id:'p1', displayName:'Participant A' }, cohortId:'c-1',
    observationSeconds: 30 });
const envB = buildEnvelope(b, review(subB, b.transcript),
  { sessionId:'s-b', participant:{ id:'p2', displayName:'Participant B' }, cohortId:'c-1',
    observationSeconds: 12 });

fs.writeFileSync('transcript.html', renderPage([envA, envB], makeResolver()));
fs.writeFileSync('envelope-sample.json', JSON.stringify(envA, null, 2));

const line = (e) => `  ${e.participant.displayName}: ${e.outcome.severity.padEnd(7)} ` +
  `reached ${e.reachability.filter(r=>r.held).length}/${e.reachability.length}` +
  `  irreversible: ${e.transitions.filter(t=>t.kind==='irreversible').length}` +
  `  observed: ${e.observation.estimateSeconds}s (${e.observation.reading.band})`;
console.log('\nwrote transcript.html and envelope-sample.json\n');
console.log(line(envA));
console.log(line(envB));
