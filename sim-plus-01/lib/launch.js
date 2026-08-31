// Verifies launch tokens issued by the platform, and signs messages back.
// The sim never mints a launch token and never queries the platform — it
// checks a signature with a shared secret, which is the whole contract.
//
// Same shape as the other sims. The one addition is reportTranscript: this
// simulation's debrief depends on a faculty member reading what was asked and
// where doors closed, so the transcript is not optional the way a completion
// summary is.
const crypto = require('crypto');

function verifyLaunch(token) {
  const secret = process.env.LAUNCH_SECRET;
  if (!secret || typeof token !== 'string' || !token.includes('.')) return null;
  const [bodyPart, mac] = token.split('.');
  const expect = crypto.createHmac('sha256', secret).update(bodyPart).digest('base64url');
  const a = Buffer.from(mac || ''), b = Buffer.from(expect);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  let p;
  try { p = JSON.parse(Buffer.from(bodyPart, 'base64url').toString('utf8')); } catch (e) { return null; }
  if (!p.exp || Date.now() > p.exp) return null;
  return p;
}

function signBack(payload) {
  const secret = process.env.LAUNCH_SECRET;
  if (!secret) return null;
  const bodyPart = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const mac = crypto.createHmac('sha256', secret).update(bodyPart).digest('base64url');
  return bodyPart + '.' + mac;
}

async function post(path, payload, label) {
  const base = (process.env.PLATFORM_URL || '').replace(/\/$/, '');
  if (!base) return;
  const token = signBack(payload);
  if (!token) return;
  try {
    const r = await fetch(base + path, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token, ...(payload.envelope ? { envelope: payload.envelope } : {}) }),
      signal: AbortSignal.timeout(8000)
    });
    if (!r.ok) console.error(label + ' refused', r.status, await r.text().catch(() => ''));
  } catch (e) {
    console.error(label + ' failed', e.message);
  }
}

// Tells the platform someone finished. Best effort: a failure here must never
// reach the participant, who has already seen their report.
async function reportCompletion({ launch, summary, metrics }) {
  if (!launch || !launch.sub) return;
  return post('/api/complete', {
    sub: launch.sub,
    sim: launch.sim,
    course: launch.course || null,
    duration: launch.iat ? Math.round((Date.now() - launch.iat) / 1000) : null,
    summary: summary || null,
    metrics: metrics || null,
    iat: Date.now(),
    exp: Date.now() + 5 * 60000
  }, 'completion');
}

// Sends the instructor transcript. Separate endpoint and separate table on the
// platform, because a completion is a capped summary by design and this is
// several kilobytes of events. Awaited by the caller — a serverless function
// can be frozen the moment it responds, and fire-and-forget here would lose
// transcripts silently.
async function reportTranscript({ launch, envelope }) {
  if (!launch || !launch.sub || !envelope) return;
  return post('/api/transcript', {
    sub: launch.sub,
    sim: launch.sim,
    course: launch.course || null,
    envelope,
    iat: Date.now(),
    exp: Date.now() + 5 * 60000
  }, 'transcript');
}

// Tells the platform this simulation exists, once per cold start.
let announced = null;
function announce(meta, selfUrl) {
  if (announced) return announced;
  announced = Promise.resolve();
  const base = (process.env.PLATFORM_URL || '').replace(/\/$/, '');
  if (!base || !meta) return announced;
  const token = signBack({
    kind: 'register',
    sim: meta.id,
    title: meta.title,
    tagline: meta.tagline,
    description: meta.description,
    minutes: meta.minutes,
    detail: meta.detail || null,
    launchUrl: selfUrl || '',
    iat: Date.now(),
    exp: Date.now() + 5 * 60000
  });
  if (!token) return announced;
  announced = fetch(base + '/api/register', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ token }),
    signal: AbortSignal.timeout(6000)
  }).then(async (r) => {
    if (r.ok) console.log('announced', meta.id, 'to', base);
    else console.error('announce refused', r.status, await r.text().catch(() => ''));
  }).catch(e => console.error('announce failed', e.message));
  return announced;
}

module.exports = { verifyLaunch, signBack, reportCompletion, reportTranscript, announce };
