// Adjudicates the conversational route to the Day 2 branch. The action route
// sets the flag directly and never comes here.
//
// Runs once at the close of each of the first two moments, over that moment's
// bridge and private transcripts. One narrow question, deliberately: did the VP
// instruct anyone to stop the scheduled re-index, or to preserve the index as it
// stands. Two lines have to be drawn explicitly because both are common:
// a question is not an instruction, and holding something else is not holding
// this.
const { checkAccess, requireKey, anthropic, body } = require('../lib/guard.js');
const S = require('../lib/scenario.js');

const SYSTEM = `You are deciding one narrow question about a transcript from an incident call.

THE QUESTION: did the VP of Customer Operations instruct anyone to hold, delay, pause, freeze or otherwise stop the scheduled overnight re-index of the document library — or to preserve, snapshot, image or otherwise keep the index in its current state before that job runs?

Two lines you must draw, because both are common in these transcripts:

1. A QUESTION IS NOT AN INSTRUCTION. "What happens if we re-index?", "Does the job run tonight?", "Could we hold it?" are all false. Wondering aloud is false. Asking someone's opinion about holding it is false. Only an instruction, a decision, or a clear request to act counts.

2. HOLDING SOMETHING ELSE IS NOT HOLDING THIS. "Let's hold off on notifying the customers", "hold the statement", "pause the outreach", "don't publish anything yet" are all false. The hold has to be about the re-index, the ingestion job, the nightly job, the library sync, or preserving the index or its current contents.

Anything ambiguous is false. If they merely agreed with someone else's suggestion in a way that clearly settles it — "yes, do that" straight after a character offers to hold the job — that is true.

Reply as JSON only, no markdown fences:
{"held": true|false, "quote": "the exact sentence you matched on, or empty string"}`;

module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  if (!checkAccess(req, res)) return;

  const b = body(req);
  const phase = parseInt(b.phase, 10);
  if (!(phase === 0 || phase === 1)) {
    // Nothing to decide anywhere else.
    return res.status(200).json({ held: false, quote: '' });
  }

  const lines = [];
  const add = (label, arr) => {
    if (!Array.isArray(arr) || !arr.length) return;
    lines.push(`--- ${label} ---`);
    arr.slice(-40).forEach(m => {
      if (!m || m.who === 'system') return;
      const who = m.who === 'you' ? 'VP OF CUSTOMER OPERATIONS' : String(m.who).toUpperCase();
      lines.push(`${who}: ${String(m.text || '').slice(0, 1200)}`);
    });
  };
  add('on the call, everyone present', b.room);
  Object.entries(b.threads || {}).forEach(([who, msgs]) => add(`privately with ${who}`, msgs));

  const transcript = lines.join('\n').slice(0, 24000);
  if (!transcript.trim()) return res.status(200).json({ held: false, quote: '' });

  const key = requireKey(res); if (!key) return;

  try {
    const raw = await anthropic(key, {
      system: SYSTEM, max_tokens: 200,
      messages: [{ role: 'user', content: transcript }]
    });
    const j = JSON.parse(String(raw).replace(/```json|```/g, '').trim());
    return res.status(200).json({
      held: !!j.held,
      quote: typeof j.quote === 'string' ? j.quote.slice(0, 300) : ''
    });
  } catch (e) {
    // Defaulting to held is the kinder failure. Someone who did instruct a hold
    // and lands in the other branch experiences the sim as broken; someone who
    // didn't gets a slightly gentler Day 2 and a debrief that accuses them of
    // nothing.
    console.error('branch classifier failed, defaulting to held:', e.message);
    return res.status(200).json({ held: true, quote: '', defaulted: true });
  }
};
