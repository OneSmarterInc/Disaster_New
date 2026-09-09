'use strict';
const crypto = require('crypto');
const store = require('../lib/store');
const { META } = require('../lib/meta');

const fingerprint = (v) => v
  ? crypto.createHash('sha256').update(String(v)).digest('hex').slice(0, 8)
  : null;

function hasHealthAccess(req) {
  const want = String(process.env.HEALTH_SECRET || '');
  const given = String(req.headers['x-health-key'] || '');
  if (!want || !given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(want);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store, max-age=0, must-revalidate');

  // Public probes disclose only liveness and the catalogue identity.
  if (!hasHealthAccess(req)) {
    return res.status(200).json({ ok: true, sim: META.id });
  }

  const missing = [];
  if (!store.configured()) missing.push('KV_REST_API_URL / KV_REST_API_TOKEN');
  if (!process.env.LAUNCH_SECRET) missing.push('LAUNCH_SECRET');
  if (!process.env.PLATFORM_URL) missing.push('PLATFORM_URL');
  if (!process.env.SIM_URL) missing.push('SIM_URL');

  return res.status(missing.length ? 503 : 200).json({
    ok: !missing.length,
    sim: META.id,
    diagnostic: true,
    title: META.title,
    missing,
    launchSecret: process.env.LAUNCH_SECRET ? 'configured' : 'MISSING',
    launchSecretFingerprint: fingerprint(process.env.LAUNCH_SECRET),
    registersAs: process.env.SIM_URL || null,
    platformUrl: process.env.PLATFORM_URL || null,
    sessions: store.configured() ? 'configured' : 'MISSING',
    canAnnounce: !!(process.env.LAUNCH_SECRET && process.env.PLATFORM_URL),
    needsModelKey: false
  });
};
