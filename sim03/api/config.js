const { announceOnce } = require('../lib/guard.js');
const S = require('../lib/scenario.js');

module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'GET or POST only' });
  }
  // This endpoint contains presentation copy only. Outcome thresholds and future
  // branches stay server-side, so the public bootstrap can be fetched safely.
  announceOnce(req);
  res.setHeader('Cache-Control', 'no-store, max-age=0, must-revalidate');
  return res.status(200).json(S.publicConfig());
};
