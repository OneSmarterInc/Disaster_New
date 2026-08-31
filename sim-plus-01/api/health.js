const { announceOnce, META } = require('../lib/guard.js');
const { MemoryStore } = require('../src/store');
const R = require('../lib/run.js');

module.exports = async (req, res) => {
  announceOnce(req);
  let kv = 'unconfigured';
  try { kv = R.store() instanceof MemoryStore ? 'memory (sessions will not survive a restart)' : 'kv'; }
  catch (e) { kv = 'error: ' + e.message; }
  res.status(200).json({
    ok: true,
    sim: META.id,
    version: require('../package.json').version,
    storage: kv,
    platform: process.env.PLATFORM_URL ? 'configured' : 'unset',
    secret: process.env.LAUNCH_SECRET ? 'set' : 'unset'
  });
};
