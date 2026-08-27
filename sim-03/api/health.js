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
  // Not fatal on its own — a sim reachable at its own root does not need it —
  // but behind a platform path prefix it is the difference between a working
  // launch and a student landing on the catalogue.
  if (!process.env.SIM_URL) missing.push('SIM_URL (needed when served under /simNN)');

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

    // The address this sim tells the platform to send people to, and the one
    // the platform builds every launch link from. Getting this wrong is nearly
    // invisible: the sim plays perfectly and launches land somewhere else.
    //
    // It must be set explicitly when the sim is served behind a path prefix.
    // The rewrite strips /sim03 before the request arrives, so the host header
    // says rapidsims.flexee.org and nothing says which sim — announce would
    // register the platform's own root, and every launch would bounce students
    // to the catalogue. Sim 01 sets SIM_URL for exactly this reason.
    registersAs: process.env.SIM_URL || 'derived from the request host — WRONG behind a path prefix, set SIM_URL',

    // Whether this deployment can tell the catalogue it exists. Without both,
    // the sim plays perfectly and never appears on the home page — its own
    // confusing failure, so name it here rather than leaving it to be guessed.
    canAnnounce: !!(secret && process.env.PLATFORM_URL),

    // No model in this sim. Worth stating, because 01 and 02 both need an
    // ANTHROPIC_API_KEY and somebody will assume this does too.
    needsModelKey: false
  });
};
