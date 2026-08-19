// Tells you what this deployment has been configured with, without revealing
// any of it. Useful when a launch is being rejected and you need to know
// whether the two systems actually share a secret.
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Read once at cold start, not per request.
let BUILT_AT = 'unknown';
try {
  BUILT_AT = fs.statSync(path.join(__dirname, '../public/index.html')).mtime.toISOString();
} catch (e) {}

const fingerprint = (v) => v
  ? crypto.createHash('sha256').update(String(v)).digest('hex').slice(0, 8)
  : null;

const { announce } = require('../lib/launch.js');
const S = require('../lib/scenario.js');

module.exports = async (req, res) => {
  // Often the first thing anyone touches on a fresh deployment, and the one
  // place we can afford to wait for the announcement to actually land.
  try {
    // Prefer the address this simulation is meant to be reached at. Without
    // it we fall back to whichever host the request came in on — which may be
    // a deployment-specific URL frozen to one build, and registering that in
    // the catalogue would leave students on an old version for ever.
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    await announce(S.META, process.env.SIM_URL || (host ? `https://${host}` : ''));
  } catch (e) {}

  const secret = process.env.LAUNCH_SECRET;
  // Never cached. This is the one endpoint somebody reads to find out whether a
  // deployment is current, and a cached copy answers the opposite of the
  // question — it reports the build you are trying to find out you have moved on
  // from.
  res.setHeader('Cache-Control', 'no-store, max-age=0, must-revalidate');
  return res.status(200).json({
    sim: 'rapid-02-relay',
    characters: process.env.ANTHROPIC_API_KEY ? 'configured' : 'MISSING',
    accessCode: process.env.ACCESS_CODE ? 'configured' : 'not set (open)',
    sessions: (process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL) ? 'configured' : 'MISSING',
    launchSecret: secret ? 'configured' : 'MISSING',
    // Same secret on both sides gives the same eight characters. Different
    // values give different ones, and neither reveals the secret itself.
    launchSecretFingerprint: fingerprint(secret),
    platformUrl: process.env.PLATFORM_URL || 'MISSING (completions will not be reported)',
    // The address this simulation puts in the catalogue. Without SIM_URL it
    // registers whichever host the first request arrived on, which may be a
    // deployment-specific URL frozen to one build.
    registersAs: process.env.SIM_URL
      || ((req.headers['x-forwarded-host'] || req.headers.host)
          ? `https://${req.headers['x-forwarded-host'] || req.headers.host} (SIM_URL not set — whichever address is used)`
          : 'MISSING'),
    // What this build can do. The platform compares these against what it
    // expects, so a deployment left behind is spotted rather than guessed at —
    // a stale sim looks identical to a broken one from the outside.
    // When this bundle was built. The fastest way to tell a current deployment
    // from one that answers identically because nothing visible changed.
    builtAt: BUILT_AT,
    features: [
      'launch-token',        // accepts a signed token in place of an access code
      'launch-mode',         // plays or opens the session console, as asked
      'console-token',       // a faculty token opens the console without a code
      'self-register',       // tells the platform it exists
      'completion-report'    // reports a finished run back
    ]
  });
};
