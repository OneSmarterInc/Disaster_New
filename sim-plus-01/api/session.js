// Everything about the run itself. One endpoint, action-switched, so the
// deployment stays small — the same shape the other sims use.
const { checkAccess, whoIsPlaying, body } = require('../lib/guard.js');
const R = require('../lib/run.js');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  if (!checkAccess(req, res)) return;

  const b = body(req);
  const who = whoIsPlaying(req, b);
  if (!who) return res.status(400).json({ error: 'no_run_id' });

  try {
    const { session, stale, reason } = await R.get(who.id);

    switch (String(b.action || 'state')) {
      // Resuming is the default. A participant returning on Thursday hits
      // this and gets back exactly where they stopped.
      case 'state': {
        if (stale) return res.status(200).json({ stale: true, reason, ...R.view(null) });
        return res.status(200).json({ durable: who.durable, ...R.view(session) });
      }

      case 'choose': {
        if (session && session.order) {
          // The order is a decision, not a setting. Re-choosing after seeing
          // one source would make the sequencing choice free.
          return res.status(409).json({ error: 'order_already_chosen', ...R.view(session) });
        }
        const s = new R.Session();
        try { s.chooseOrder(Array.isArray(b.order) ? b.order : []); }
        catch (e) { return res.status(400).json({ error: 'order_not_permitted', detail: e.message }); }
        await R.put(who.id, s);
        return res.status(200).json(R.view(s));
      }

      case 'next': {
        if (!session || !session.order) return res.status(409).json({ error: 'no_run' });
        if (session.remaining > 0) return res.status(409).json({ error: 'window_still_open' });
        session.advanceWindow();
        await R.put(who.id, session);
        return res.status(200).json(R.view(session));
      }

      // Ends an appointment early. Some participants will, and a window left
      // with nine minutes unspent is worth as much at debrief as one spent badly.
      case 'leave': {
        if (!session || !session.order) return res.status(409).json({ error: 'no_run' });
        session.remaining = 0;
        await R.put(who.id, session);
        return res.status(200).json(R.view(session));
      }

      // End of a class meeting. Seals the current window for good, which is
      // what stops a participant simply finishing at home — without it the
      // availability calendar constrains nothing.
      case 'break': {
        if (!session || !session.order) return res.status(409).json({ error: 'no_run' });
        await R.endMeeting(who.id, session);
        return res.status(200).json(R.view(session));
      }

      // Faculty resetting a participant who needs to start over.
      case 'reset': {
        if (!req.launch || req.launch.role === 'student')
          return res.status(403).json({ error: 'faculty_only' });
        await R.drop(String(b.userId || who.id));
        return res.status(200).json({ ok: true });
      }

      default:
        return res.status(400).json({ error: 'unknown_action' });
    }
  } catch (e) {
    if (e.code === 'NO_STORE') return res.status(503).json({ error: 'no_store' });
    console.error('session failure', e.message);
    return res.status(500).json({ error: 'server_error' });
  }
};
