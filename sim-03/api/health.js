// Liveness plus enough configuration detail to diagnose a bad deployment
// without opening the Vercel dashboard. Says what is missing, never what it is.
//
// The fingerprint is the useful part. Launches are rejected when this sim and
// the platform hold different LAUNCH_SECRET values, and the symptom of that is
// indistinguishable from half a dozen other faults. Comparing eight characters
// across two /api/health responses settles it in seconds without either side
// revealing the secret. Sim 01 and the platform already print it; this one
// did not, which would have left no way to check a value that cannot be read
// back out of Vercel.

const crypto = require('crypto');
const store = require('../lib/store.js');
const S = require('../lib/scenario.js');

const fingerprint = (v) => v
  ? crypto.createHash('sha256').update(String(v)).digest('hex').slice(0, 8)
  : null;

module.exports = async (req, res) => {
  const secret = process.env.LAUNCH_SECRET || '';
  const missing = [];
  if (!store.configured()) missing.push('KV_REST_API_URL / KV_REST_API_TOKEN');
  if (!secret) missing.push('LAUNCH_SECRET');
  if (!process.env.PLATFORM_URL) missing.push('PLATFORM_URL');

  res.status(missing.length ? 503 : 200).json({
    ok: missing.length === 0,
    sim: S.META.id,
    title: S.META.title,
    rounds: S.PROCESS.rounds,
    missing,

    // Compare against the platform's /api/health. Matching means launches will
    // be trusted; different means they never will, however correct everything
    // else looks.
    launchSecretFingerprint: fingerprint(secret),

    // Whether this deployment can tell the catalogue it exists. Without both,
    // the sim plays perfectly and never appears on the home page — its own
    // confusing failure, so name it here rather than leaving it to be guessed.
    canAnnounce: !!(secret && process.env.PLATFORM_URL),

    // No model in this sim. Worth stating, because 01 and 02 both need an
    // ANTHROPIC_API_KEY and somebody will assume this does too.
    needsModelKey: false
  });
};
