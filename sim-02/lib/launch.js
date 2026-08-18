// Verifies launch tokens issued by the platform. The sim never mints one and
// never talks to the platform — it just checks a signature with a shared secret.
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

// Signs a message back to the platform — same secret, opposite direction.
function signBack(payload) {
  const secret = process.env.LAUNCH_SECRET;
  if (!secret) return null;
  const bodyPart = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const mac = crypto.createHmac('sha256', secret).update(bodyPart).digest('base64url');
  return bodyPart + '.' + mac;
}

// Tells the platform someone finished. Best effort: if it fails, the student's
// run is unaffected and nobody sees an error — the debrief has already happened.
async function reportCompletion({ launch, summary, metrics }) {
  const base = (process.env.PLATFORM_URL || '').replace(/\/$/, '');
  if (!base || !launch || !launch.sub) return;
  const token = signBack({
    sub: launch.sub,
    sim: launch.sim,
    course: launch.course || null,
    duration: launch.iat ? Math.round((Date.now() - launch.iat) / 1000) : null,
    summary: summary || null,
    metrics: metrics || null,
    iat: Date.now(),
    exp: Date.now() + 5 * 60000
  });
  if (!token) return;
  try {
    const r = await fetch(base + '/api/complete', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token }),
      signal: AbortSignal.timeout(6000)
    });
    if (!r.ok) {
      let why = '';
      try { why = JSON.stringify(await r.json()); } catch (e) {}
      console.error('completion refused', r.status, why);
    } else {
      console.log('completion reported for', launch.sub, 'on', launch.sim);
    }
  } catch (e) {
    // Never let this spoil the debrief the student is waiting for.
    console.error('completion report failed', e.message);
  }
}

// Tells the platform this simulation exists, once per cold start. The platform
// creates a catalogue entry — unpublished, so nobody sees it until an
// administrator decides — and thereafter only refreshes the technical facts,
// leaving anything they have edited alone.
//
// Deliberately fire-and-forget and never awaited by a request: if it fails, a
// student's run is unaffected and the next cold start tries again.
let announced = false;
function announce(meta, selfUrl) {
  if (announced) return;
  announced = true;
  const base = (process.env.PLATFORM_URL || '').replace(/\/$/, '');
  if (!base || !meta) return;
  const token = signBack({
    kind: 'register',
    sim: meta.id,
    title: meta.title,
    tagline: meta.tagline,
    description: meta.description,
    minutes: meta.minutes,
    launchUrl: selfUrl || '',
    iat: Date.now(),
    exp: Date.now() + 5 * 60000
  });
  if (!token) return;
  fetch(base + '/api/register', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ token }),
    signal: AbortSignal.timeout(6000)
  }).then(r => {
    if (!r.ok) console.error('announce refused', r.status);
  }).catch(e => console.error('announce failed', e.message));
}

module.exports = { verifyLaunch, signBack, reportCompletion, announce };
