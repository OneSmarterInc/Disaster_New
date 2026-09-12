'use strict';

const { verifyLaunch, announce } = require('./launch');
const { META, acceptsLaunchId } = require('./meta');

function announceOnce(req) {
  try {
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    const proto = req.headers['x-forwarded-proto'] || 'https';
    announce(META, process.env.SIM_URL || (host ? `${proto}://${host}` : ''));
  } catch (_) {}
}

function checkAccess(req, res) {
  announceOnce(req);
  const token = req.headers['x-launch-token'];
  if (token) {
    const launch = verifyLaunch(String(token));
    if (launch) {
      if (!acceptsLaunchId(launch.sim)) {
        res.status(403).json({ error: 'launch_token_wrong_sim' }); return false;
      }
      req.launch = launch; return true;
    }
    res.status(401).json({ error: 'launch_token_invalid' });
    return false;
  }
  const required = process.env.ACCESS_CODE;
  if (!required || req.headers['x-access-code'] === required) return true;
  res.status(401).json({ error: 'access_code_required' });
  return false;
}

function body(req) {
  if (typeof req.body !== 'string') return req.body || {};
  try { return JSON.parse(req.body); } catch (_) { return {}; }
}

module.exports = { checkAccess, body };
