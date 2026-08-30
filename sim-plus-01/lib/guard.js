// Shared guards for every endpoint. Server only.
//
// Nothing in data/ or src/ may ever be served to a browser: the phrasing bank
// encodes which questions are worth asking, and the contracts hold every line
// each character speaks. The client sends a string and renders a string.
const { verifyLaunch, announce } = require('./launch.js');
const META = require('./meta.js');

function announceOnce(req) {
  try {
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    const proto = req.headers['x-forwarded-proto'] || 'https';
    announce(META, process.env.SIM_URL || (host ? `${proto}://${host}` : ''));
  } catch (e) { /* never let this affect a request */ }
}

// Two ways in: a launch token signed by the platform, or the shared access
// code for standalone use. The token also tells us who is playing, which is
// what makes resuming on another machine a week later possible.
function checkAccess(req, res) {
  announceOnce(req);
  const lt = req.headers['x-launch-token'];
  if (lt) {
    const p = verifyLaunch(String(lt));
    if (p) { req.launch = p; return true; }
    res.status(401).json({ error: 'launch_token_invalid' });
    return false;
  }
  const required = process.env.ACCESS_CODE;
  if (!required) return true;
  if (req.headers['x-access-code'] !== required) {
    res.status(401).json({ error: 'access_code_required' });
    return false;
  }
  return true;
}

// Who this run belongs to. A platform launch gives a durable identity, so the
// same person returning on Thursday on a different machine finds their session.
// Standalone play has no such identity: the browser carries a run id, and
// losing it loses the run, which is the honest behaviour rather than a
// pretence of continuity.
function whoIsPlaying(req, b) {
  if (req.launch && req.launch.sub) return { id: req.launch.sub, durable: true };
  const rid = String((b && b.runId) || req.headers['x-run-id'] || '').trim();
  return rid ? { id: 'anon:' + rid.slice(0, 40), durable: false } : null;
}

function body(req) {
  let b = req.body;
  if (typeof b === 'string') { try { b = JSON.parse(b); } catch { b = null; } }
  return b || {};
}

module.exports = { checkAccess, whoIsPlaying, body, announceOnce, META };
