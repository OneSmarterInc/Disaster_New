// Liveness plus enough configuration detail to diagnose a bad deployment
// without opening the Vercel dashboard. Says what is missing, never what it is.
const store = require('../lib/store.js');
const S = require('../lib/scenario.js');

module.exports = async (req, res) => {
  const missing = [];
  if (!store.configured()) missing.push('KV_REST_API_URL / KV_REST_API_TOKEN');
  if (!process.env.LAUNCH_SECRET) missing.push('LAUNCH_SECRET');

  res.status(missing.length ? 503 : 200).json({
    ok: missing.length === 0,
    sim: S.META.id,
    title: S.META.title,
    rounds: S.PROCESS.rounds,
    missing,
    // No model in this sim, so no API key is required. Worth stating, because
    // 01 and 02 both need one and somebody will assume this does too.
    needsModelKey: false
  });
};
