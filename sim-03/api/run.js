// The run loop. One endpoint, action-switched, the way 02 does it.
//
// The contract with the browser is deliberately thin: it sends an action id and
// gets back a rendered view. It never sends state and it never receives state
// it was not meant to have. Every decision about what is legal, what it costs
// and what it does downstream happens here.
//
// If this file grew a `state` parameter accepted from the client, the sim would
// be over — a participant could post themselves a finished run with a perfect
// score. State lives in the store, keyed by a run id, and nowhere else.

const { checkAccess, body } = require('../lib/guard.js');
const store = require('../lib/store.js');
const { Session } = require('../lib/engine.js');
const S = require('../lib/scenario.js');
const { reportCompletion } = require('../lib/launch.js');

const newId = () => Math.random().toString(36).slice(2, 12);

// Runs live alongside sessions in the same store, under their own prefix.
const runKey = (id) => `run03:${id}`;

async function loadRun(id) {
  if (!id) return null;
  const raw = await store.getRaw(runKey(id));
  if (!raw) return null;
  return Session.fromJSON(S.PROCESS, raw);
}

async function saveRun(id, session) {
  await store.putRaw(runKey(id), session.toJSON());
}

module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  if (!checkAccess(req, res)) return;

  if (!store.configured()) {
    return res.status(503).json({
      error: 'no_store',
      message: 'Session storage is not set up on this deployment. Add a KV store in the Vercel dashboard and redeploy.'
    });
  }

  const b = body(req);
  const action = String(b.action || '');

  try {
    switch (action) {

      // Hand the browser the opening brief. No run exists yet.
      case 'brief': {
        return res.status(200).json({
          brief: S.BRIEF,
          rounds: S.PROCESS.rounds,
          station: S.PROCESS.stations.find(s => s.id === S.PROCESS.participantStation).name
        });
      }

      case 'start': {
        const id = newId();
        const s = new Session(S.PROCESS);
        // Remember who launched this run. The launch token is short-lived and
        // this sim takes twelve minutes to play, so by the time the debrief is
        // reached the token has expired and req.launch is gone. Reading it at
        // the end meant no completion was ever reported and faculty saw every
        // run as started and never finished.
        if (req.launch) s.launch = req.launch;
        await saveRun(id, s);
        return res.status(200).json({ runId: id, view: s.visible() });
      }

      // One decision. The whole sim is repeated calls to this.
      case 'act': {
        const id = String(b.runId || '');
        const s = await loadRun(id);
        if (!s) return res.status(404).json({ error: 'no_such_run' });
        if (s.finished) return res.status(409).json({ error: 'run_over' });

        let result;
        try {
          result = s.act(String(b.choice || ''));
        } catch (e) {
          // An unavailable action is a client bug or somebody poking at the
          // API, not a server failure. Say so plainly and change nothing.
          return res.status(400).json({ error: 'illegal_action', message: e.message });
        }

        await saveRun(id, s);
        return res.status(200).json({
          view: result.visible,
          reading: result.reading,   // null unless they paid to look
          finished: s.finished
        });
      }

      // Resume after a lost tab or a break between class sessions. Faculty run
      // these across a coffee break and a participant who loses their run has
      // lost the exercise with no way back.
      case 'resume': {
        const id = String(b.runId || '');
        const s = await loadRun(id);
        if (!s) return res.status(404).json({ error: 'no_such_run' });
        return res.status(200).json({ view: s.visible(), finished: s.finished });
      }

      // Assembled server-side. The browser is never given the material to
      // assemble it itself, because that material is the answer key.
      case 'debrief': {
        const id = String(b.runId || '');
        const s = await loadRun(id);
        if (!s) return res.status(404).json({ error: 'no_such_run' });
        if (!s.finished) return res.status(409).json({ error: 'run_not_finished' });

        const d = S.debriefFor(s);

        // Best effort. If the platform is unreachable the participant's
        // debrief is unaffected — they are looking at it right now.
        // Prefer what was stored when the run began. req.launch is only there
        // if the token is somehow still valid, which for a twelve-minute sim
        // it usually is not.
        const who = s.launch || req.launch;
        if (who) {
          reportCompletion({
            launch: who,
            summary: d.title,
            metrics: {
              verdict: d.verdict,
              localScore: d.localScore,
              harmed: !!d.harm,
              timesLooked: d.counts.timesLooked
            }
          });
        }

        return res.status(200).json({ debrief: d });
      }

      default:
        return res.status(400).json({ error: 'unknown_action' });
    }
  } catch (e) {
    if (e.code === 'NO_STORE') return res.status(503).json({ error: 'no_store', message: e.message });
    console.error('run failure', action, e.message);
    return res.status(500).json({ error: 'server_error' });
  }
};
