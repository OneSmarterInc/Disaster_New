const { verifyLaunch, announce } = require('./launch.js');
const S = require('./scenario.js');

function announceOnce(req) {
  try {
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    const proto = req.headers['x-forwarded-proto'] || 'https';
    announce(S.META, process.env.SIM_URL || (host ? `${proto}://${host}` : ''));
  } catch {}
}

function checkAccess(req, res) {
  announceOnce(req);
  const lt = req.headers['x-launch-token'];
  if (lt) {
    const p = verifyLaunch(String(lt));
    if (!p) {
      res.status(401).json({ error: 'launch_token_invalid' });
      return false;
    }
    // A token for another sim must never be reusable merely because the deployments
    // share LAUNCH_SECRET.
    if (p.sim && p.sim !== S.META.id) {
      res.status(403).json({ error: 'launch_token_wrong_sim' });
      return false;
    }
    req.launch = p;
    return true;
  }
  const required = process.env.ACCESS_CODE;
  if (!required) return true;
  if (req.headers['x-access-code'] !== required) {
    res.status(401).json({ error: 'access_code_required' });
    return false;
  }
  return true;
}

function body(req) {
  let b = req.body;
  if (typeof b === 'string') {
    try { b = JSON.parse(b); } catch { b = null; }
  }
  return b || {};
}

module.exports = { checkAccess, body, announceOnce };
