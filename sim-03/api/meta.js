// The catalogue reads this. Public by design — everything in META is written
// to be read by someone deciding whether to run the sim, and gives away
// nothing about what it is watching for.
const S = require('../lib/scenario.js');
module.exports = async (req, res) => res.status(200).json({ meta: S.META });
