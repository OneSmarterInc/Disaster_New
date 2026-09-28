'use strict';
const { spawnSync } = require('node:child_process');
for (const file of ['gate-data.test.js', 'flow.test.js']) {
  const result = spawnSync(process.execPath, [require('node:path').join(__dirname, file)], { stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status || 1);
}
