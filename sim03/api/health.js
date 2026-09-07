const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { announce } = require('../lib/launch.js');
const store = require('../lib/store.js');
const S = require('../lib/scenario.js');

const BUILD = (() => {
  const sha = process.env.VERCEL_GIT_COMMIT_SHA;
  if (sha) {
    const ref = process.env.VERCEL_GIT_COMMIT_REF;
    return sha.slice(0, 7) + (ref ? ' on ' + ref : '');
  }
  try {
    return 'local, ' + fs.statSync(path.join(__dirname, '../public/index.html')).mtime.toISOString();
  } catch { return 'unknown'; }
})();

const fingerprint = (v) => v
  ? crypto.createHash('sha256').update(String(v)).digest('hex').slice(0, 8)
  : null;

function holdsTheSecret(req) {
  const given = String(req.headers['x-health-key'] || (req.query && req.query.key) || '');
  const want = String(process.env.LAUNCH_SECRET || '');
  return !!want && given === want;
}

module.exports = async (req, res) => {
  try {
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    await announce(S.META, process.env.SIM_URL || (host ? `https://${host}` : ''));
  } catch {}

  const secret = process.env.LAUNCH_SECRET;
  res.setHeader('Cache-Control', 'no-store, max-age=0, must-revalidate');
  return res.status(200).json({
    sim: S.META.id,
    build: BUILD,
    accessCode: process.env.ACCESS_CODE ? 'configured' : 'not set (open)',
    sessions: store.configured() ? 'configured' : 'MISSING',
    launchSecret: secret ? 'configured' : 'MISSING',
    launchSecretFingerprint: holdsTheSecret(req) ? fingerprint(secret) : 'hidden',
    platformUrl: process.env.PLATFORM_URL || 'MISSING (registration/completions disabled)',
    registersAs: process.env.SIM_URL
      || ((req.headers['x-forwarded-host'] || req.headers.host)
        ? `https://${req.headers['x-forwarded-host'] || req.headers.host} (SIM_URL not set)`
        : 'MISSING'),
    catalogueRevision: S.META.catalogueRevision,
    replaces: S.META.replaces,
    features: [
      'launch-token',
      'self-register',
      'completion-report',
      'deterministic-outcomes',
      'individual-session-mode',
      'team-session-mode',
      'faculty-calibration',
      'instructor-analytics'
    ]
  });
};
