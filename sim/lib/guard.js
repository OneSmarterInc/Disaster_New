// Shared guards for every endpoint. Server only.

function checkAccess(req, res) {
  const required = process.env.ACCESS_CODE;
  if (!required) return true;
  if (req.headers['x-access-code'] !== required) {
    res.status(401).json({ error: 'access_code_required' });
    return false;
  }
  return true;
}

function requireKey(res) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    res.status(500).json({ error: 'Server is missing ANTHROPIC_API_KEY. Set it in the Vercel project settings.' });
    return null;
  }
  return key;
}

async function anthropic(key, { system, messages, max_tokens }) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: Math.min(Math.max(parseInt(max_tokens, 10) || 400, 1), 1000),
      system, messages
    })
  });
  const data = await r.json();
  if (!r.ok) {
    const msg = (data && data.error && data.error.message) || 'Upstream error';
    const err = new Error(msg); err.status = r.status; throw err;
  }
  return (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n').trim();
}

function body(req) {
  let b = req.body;
  if (typeof b === 'string') { try { b = JSON.parse(b); } catch { b = null; } }
  return b || {};
}

module.exports = { checkAccess, requireKey, anthropic, body };
