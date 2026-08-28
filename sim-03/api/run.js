'use strict';

const crypto = require('crypto');
const { checkAccess, body } = require('../lib/guard');
const store = require('../lib/store');
const { Session, SOURCES } = require('../src/engine');
const { validate, review } = require('../src/report');
const { ROWS, DISPOSITIONS } = require('../data/report');
const { WINDOWS, AVAILABILITY, feasibleOrderings } = require('../data/calendar');
const { serialize, hydrate } = require('../lib/session');
const { reportCompletion } = require('../lib/launch');

const key = (id) => `run03:${id}`;
const id = () => crypto.randomBytes(12).toString('hex');
const load = async (runId) => { const raw = await store.getRaw(key(runId)); return raw ? hydrate(raw) : null; };
const save = (runId, session) => store.putRaw(key(runId), serialize(session));

function publicState(s) {
  const sourceId = s.currentSourceId;
  return {
    order: s.order,
    windowIndex: s.windowIndex,
    windowsTotal: WINDOWS.length,
    remaining: s.remaining,
    finishedInterviews: sourceId === null,
    source: sourceId ? { id: sourceId, name: SOURCES[sourceId].name, role: SOURCES[sourceId].role } : null,
    conversation: sourceId ? s.transcript.filter(t => t.sourceId === sourceId).map(t => ({ question: t.question, answer: t.answer })) : []
  };
}

module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  if (!checkAccess(req, res)) return;
  if (!store.configured()) return res.status(503).json({ error: 'no_store', message: 'Session storage is not configured.' });
  const b = body(req);
  try {
    if (b.action === 'brief') return res.status(200).json({
      title: 'Why Don\'t They Have Any Patience?',
      organization: 'Wexford Benefit Administrators',
      assignment: 'Document how claims are handled from arrival until adjudication. Verify handoffs, waits, outputs, provider contact, and anything the partial chart cannot establish.',
      context: [
        'Wexford administers dental claims for self-funded employer plans. Around twelve hundred claims arrive each working day.',
        'The claims platform is being replaced. The configuration team needs a verified account of what happens from arrival until adjudication.',
        'The vendor\'s chart is incomplete and came from an earlier engagement. Treat it as a starting point, not a finding.',
        'You have three fixed fifteen-minute appointments and no second visits.'
      ],
      requirements: [
        'Every point where a claim changes hands or waits',
        'What each step produces and who receives it',
        'Every point where the submitting provider is contacted, or contacts Wexford',
        'Anything on the chart that you cannot verify'
      ],
      chart: [
        { id: 'arrival', title: 'Claim arrives', detail: 'Post · fax to outside conversion vendor · fax converted here · clearinghouse', purpose: 'Intake', owner: 'Mail room', timing: 'Releases 09:00 and 14:00' },
        { id: 'log', title: 'Receipt log', detail: 'All non-electronic claims posted to a spreadsheet before onward routing', purpose: null, owner: 'Log desk', timing: 'Approx. 6 hours/day' },
        { id: 'gap', title: 'Not documented', detail: 'A step exists; no detail was recorded', purpose: null, owner: null, timing: null },
        { id: 'adjudication', title: 'Adjudication', detail: 'Out of scope', purpose: null, owner: null, timing: null }
      ],
      observation: {
        heading: 'First-pass review desk',
        instruction: 'Watch a batch move through first-pass review. Record the observed per-claim timing on your working chart.',
        finding: 'Across the observed batch, routine claims move at approximately thirty seconds per claim.'
      },
      windows: WINDOWS,
      availability: AVAILABILITY,
      orderings: feasibleOrderings(),
      sources: Object.fromEntries(Object.entries(SOURCES).map(([k, v]) => [k, {
        name: v.name,
        role: v.role,
        suggestions: {
          ray: [
            'How many claims arrive through each channel?',
            'What happens to claims that arrive after the final release?',
            'Do providers receive confirmation that a claim arrived?'
          ],
          terry: [
            'Why was the receipt log created?',
            'Who uses the receipt log now?',
            'What do providers hear when they call for status?'
          ],
          ruth: [
            'What happens when a claim looks like a duplicate?',
            'What changes when you are unavailable?',
            'What do providers hear after submitting a claim?'
          ]
        }[k]
      }])),
      rows: ROWS,
      dispositions: DISPOSITIONS
    });

    if (b.action === 'start') {
      const runId = id();
      const s = new Session().chooseOrder(b.order || []);
      s.launch = req.launch || null;
      await save(runId, s);
      return res.status(200).json({ runId, state: publicState(s) });
    }

    const runId = String(b.runId || '');
    const s = await load(runId);
    if (!s) return res.status(404).json({ error: 'no_such_run' });

    if (b.action === 'resume') return res.status(200).json({ state: publicState(s), submitted: !!s.submission });

    if (b.action === 'ask') {
      const question = String(b.question || '').trim();
      if (!question) return res.status(400).json({ error: 'question_required' });
      const turn = s.ask(question);
      if (turn.error) return res.status(409).json({ error: turn.error.toLowerCase() });
      await save(runId, s);
      return res.status(200).json({ answer: turn.answer, remaining: turn.remaining, state: publicState(s) });
    }

    if (b.action === 'advance') {
      if (!s.order || s.currentSourceId === null) return res.status(409).json({ error: 'interviews_complete' });
      const result = s.advanceWindow();
      await save(runId, s);
      return res.status(200).json({ done: result.done, state: publicState(s) });
    }

    if (b.action === 'submit') {
      if (s.currentSourceId !== null) return res.status(409).json({ error: 'interviews_not_complete' });
      const checked = validate(b.submission);
      if (!checked.ok) return res.status(400).json(checked);
      s.submission = b.submission;
      await save(runId, s);
      const result = review(s.submission, s.transcript);
      const who = s.launch || req.launch;
      if (who) await reportCompletion({ launch: who, summary: result.harmFired ? 'Recommendation caused harm' : 'Report completed', metrics: { harmFired: result.harmFired, evidenceHeld: result.evidence.held.length, loopAvailable: result.evidence.loopAvailable } });
      return res.status(200).json({ review: result });
    }

    if (b.action === 'review') {
      if (!s.submission) return res.status(409).json({ error: 'report_not_submitted' });
      return res.status(200).json({ review: review(s.submission, s.transcript) });
    }

    return res.status(400).json({ error: 'unknown_action' });
  } catch (e) {
    if (/ordering|order already/.test(e.message)) return res.status(400).json({ error: 'invalid_order', message: e.message });
    console.error('sim03', e);
    return res.status(500).json({ error: e.code === 'NO_STORE' ? 'no_store' : 'server_error', message: e.message });
  }
};
