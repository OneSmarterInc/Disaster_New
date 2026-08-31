// One question to whoever is in the room.
//
// The classifier, the clock and the posture machine all resolve here. The
// browser sends a string and receives a string; it is never told which bucket
// the question landed in, how much of the taxonomy exists, or that a source
// has stopped volunteering anything.
const { checkAccess, whoIsPlaying, body } = require('../lib/guard.js');
const R = require('../lib/run.js');

const MAX_QUESTION = 400;

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  if (!checkAccess(req, res)) return;

  const b = body(req);
  const who = whoIsPlaying(req, b);
  if (!who) return res.status(400).json({ error: 'no_run_id' });

  const question = String(b.question || '').trim().slice(0, MAX_QUESTION);
  if (!question) return res.status(400).json({ error: 'empty_question' });

  try {
    const { session } = await R.get(who.id);
    if (!session || !session.order) return res.status(409).json({ error: 'no_run' });

    const turn = session.ask(question);
    if (turn.error) return res.status(409).json({ error: turn.error.toLowerCase(), ...R.view(session) });

    await R.put(who.id, session);

    // Deliberately thin. Everything the engine knows about what just happened
    // — the bucket, the posture change, which variant was delivered — stays
    // on this side and reaches the faculty member through the transcript.
    return res.status(200).json({
      answer: turn.answer,
      spent: turn.spent,
      remaining: Math.max(0, turn.remaining),
      ...R.view(session)
    });
  } catch (e) {
    if (e.code === 'NO_STORE') return res.status(503).json({ error: 'no_store' });
    console.error('ask failure', e.message);
    return res.status(500).json({ error: 'server_error' });
  }
};
