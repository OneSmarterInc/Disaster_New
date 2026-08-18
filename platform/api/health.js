// Mirror of the sim's health check. Compare launchSecretFingerprint across the
// two deployments: same eight characters means launches will be trusted.
const crypto = require('crypto');
const { baseUrl } = require('../lib/urls.js');

const fingerprint = (v) => v
  ? crypto.createHash('sha256').update(String(v)).digest('hex').slice(0, 8)
  : null;

module.exports = async (req, res) => {
  const secret = process.env.LAUNCH_SECRET;
  return res.status(200).json({
    service: 'flexee-platform',
    database: (process.env.DATABASE_URL || process.env.POSTGRES_URL) ? 'configured' : 'MISSING',
    launchSecret: secret ? 'configured' : 'MISSING',
    launchSecretFingerprint: fingerprint(secret),
    // Links follow the address in use unless PUBLIC_BASE_URL pins one.
    linksWillUse: baseUrl(req) || 'nothing — no request host and no PUBLIC_BASE_URL',
    publicBaseUrl: process.env.PUBLIC_BASE_URL || 'not set — links follow whichever address is used',
    setupKeyStillPresent: process.env.SETUP_KEY ? 'yes — delete it now that setup is done' : 'no'
  });
};
