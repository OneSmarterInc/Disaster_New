// Tells you what this deployment has been configured with, without revealing
// any of it. Useful when a launch is being rejected and you need to know
// whether the two systems actually share a secret.
const crypto = require('crypto');

const fingerprint = (v) => v
  ? crypto.createHash('sha256').update(String(v)).digest('hex').slice(0, 8)
  : null;

module.exports = async (req, res) => {
  const secret = process.env.LAUNCH_SECRET;
  return res.status(200).json({
    sim: 'rapid-02-relay',
    characters: process.env.ANTHROPIC_API_KEY ? 'configured' : 'MISSING',
    accessCode: process.env.ACCESS_CODE ? 'configured' : 'not set (open)',
    sessions: (process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL) ? 'configured' : 'MISSING',
    launchSecret: secret ? 'configured' : 'MISSING',
    // Same secret on both sides gives the same eight characters. Different
    // values give different ones, and neither reveals the secret itself.
    launchSecretFingerprint: fingerprint(secret),
    platformUrl: process.env.PLATFORM_URL || 'MISSING (completions will not be reported)'
  });
};
