'use strict';
const crypto = require('crypto');
const store = require('../lib/store');
const { META } = require('../lib/meta');
const fingerprint = (v) => v ? crypto.createHash('sha256').update(String(v)).digest('hex').slice(0, 8) : null;

module.exports = async (_req, res) => {
  const missing = [];
  if (!store.configured()) missing.push('KV_REST_API_URL / KV_REST_API_TOKEN');
  if (!process.env.LAUNCH_SECRET) missing.push('LAUNCH_SECRET');
  if (!process.env.PLATFORM_URL) missing.push('PLATFORM_URL');
  if (!process.env.SIM_URL) missing.push('SIM_URL (required behind /sim03)');
  res.status(missing.length ? 503 : 200).json({
    ok: !missing.length,
    sim: META.id,
    title: META.title,
    missing,
    launchSecretFingerprint: fingerprint(process.env.LAUNCH_SECRET),
    registersAs: process.env.SIM_URL || null,
    canAnnounce: !!(process.env.LAUNCH_SECRET && process.env.PLATFORM_URL),
    needsModelKey: false
  });
};
