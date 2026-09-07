from pathlib import Path
import json


def require_replace(text, old, new, label):
    if old in text:
        return text.replace(old, new, 1)
    if new in text:
        return text
    raise SystemExit(f'{label} marker missing')


# platform/vercel.json
p = Path('platform/vercel.json')
j = json.loads(p.read_text())
target = 'https://sim-03-midland.vercel.app'
wanted = [
    {'source': '/sim03', 'destination': target + '/'},
    {'source': '/sim03/', 'destination': target + '/'},
    {'source': '/sim03/:path*', 'destination': target + '/:path*'},
]
by_source = {x.get('source'): x for x in j.setdefault('rewrites', [])}
for item in wanted:
    if item['source'] in by_source:
        by_source[item['source']]['destination'] = item['destination']
    else:
        j['rewrites'].append(item)
header = {
    'source': '/sim03/(.*)',
    'headers': [
        {'key': 'X-Robots-Tag', 'value': 'noindex, nofollow'},
        {'key': 'Cache-Control', 'value': 'no-store, max-age=0, must-revalidate'},
    ],
}
headers = j.setdefault('headers', [])
existing = next((x for x in headers if x.get('source') == header['source']), None)
if existing:
    existing['headers'] = header['headers']
else:
    insert_at = next((i for i, x in enumerate(headers) if x.get('source') == '/(.*)'), len(headers))
    headers.insert(insert_at, header)
p.write_text(json.dumps(j, indent=2) + '\n')

# platform catalogue list facts
p = Path('platform/public/index.html')
s = p.read_text()
helper = """function catalogueFactsHTML(s) {
  const d = s.detail || {};
  const custom = Array.isArray(d.catalogueFacts)
    ? d.catalogueFacts.filter(x => x && x.value).slice(0, 6)
    : [];
  if (!custom.length) {
    return '<span>played <b>individually</b></span>' +
           '<span><b>no</b> preparation</span>' +
           '<span><b>not</b> marked</span>';
  }
  return custom.map(x => `<span>${x.label ? esc(x.label) + ' ' : ''}<b>${esc(x.value)}</b></span>`).join('');
}

"""
if 'function catalogueFactsHTML(s)' not in s:
    marker = 'function cardHTML(s) {'
    if marker not in s:
        raise SystemExit('cardHTML marker missing')
    s = s.replace(marker, helper + marker, 1)
old = """        <span>played <b>individually</b></span>
        <span><b>no</b> preparation</span>
        <span><b>not</b> marked</span>"""
if '${catalogueFactsHTML(s)}' not in s:
    if old not in s:
        raise SystemExit('catalogue facts block missing')
    s = s.replace(old, '        ${catalogueFactsHTML(s)}', 1)
p.write_text(s)

# shared public/faculty detail renderer
p = Path('platform/public/sim-detail.js')
s = p.read_text()
if 'const customFacts =' not in s:
    marker = "    const num = s.number ? String(s.number).padStart(2, '0') : null;\n"
    inject = marker + """    const customFacts = Array.isArray(d.catalogueFacts)
      ? d.catalogueFacts.filter(x => x && x.value).slice(0, 6)
      : [];
    const factsHTML = customFacts.length
      ? customFacts.map(x => `<span>${x.label ? esc(x.label) + ' ' : ''}<b>${esc(x.value)}</b></span>`).join('')
      : '<span>played <b>individually</b></span><span><b>no</b> preparation</span><span><b>not</b> marked</span>';
    const customGlance = Array.isArray(d.atAGlance)
      ? d.atAGlance.filter(x => x && x.label && x.value).slice(0, 8)
      : [];
    const glanceHTML = customGlance.length
      ? customGlance.map(x => `<div class="line"><span>${esc(x.label)}</span><b>${esc(x.value)}</b></div>`).join('')
      : '<div class="line"><span>Decisions</span><b>Three</b></div>' +
        '<div class="line"><span>Quantitative</span><b>None</b></div>' +
        '<div class="line"><span>Played</span><b>Individually</b></div>' +
        '<div class="line"><span>Session</span><b>About an hour</b></div>';
"""
    if marker not in s:
        raise SystemExit('sim detail num marker missing')
    s = s.replace(marker, inject, 1)
old = """        <span>played <b>individually</b></span>
        <span><b>no</b> preparation</span>
        <span><b>not</b> marked</span>"""
if '${factsHTML}' not in s:
    if old not in s:
        raise SystemExit('sim detail facts block missing')
    s = s.replace(old, '        ${factsHTML}', 1)
old = """          <div class="line"><span>Decisions</span><b>Three</b></div>
          <div class="line"><span>Quantitative</span><b>None</b></div>
          <div class="line"><span>Played</span><b>Individually</b></div>
          <div class="line"><span>Session</span><b>About an hour</b></div>"""
if '${glanceHTML}' not in s:
    if old not in s:
        raise SystemExit('sim detail glance block missing')
    s = s.replace(old, '          ${glanceHTML}', 1)
p.write_text(s)

# preserve per-sim catalogue metadata through effective() normalization
p = Path('platform/lib/catalogue.js')
s = p.read_text()
marker = "  out.beats = Array.isArray(d.beats) ? d.beats : [];\n"
addition = marker + "  out.catalogueFacts = Array.isArray(d.catalogueFacts) ? d.catalogueFacts : [];\n  out.atAGlance = Array.isArray(d.atAGlance) ? d.atAGlance : [];\n"
if 'out.catalogueFacts = ' not in s:
    if marker not in s:
        raise SystemExit('catalogue effective marker missing')
    s = s.replace(marker, addition, 1)
p.write_text(s)

# Sim03 registration/detail metadata
p = Path('sim03/lib/scenario.js')
s = p.read_text()
if 'catalogueFacts:' not in s:
    old = """    sessionShape:
      'About twenty minutes to play. The debrief is designed for the rest of the class hour.',
    cast: [],
    beats: [
      { label: 'Year 1', text: 'Commit a technology portfolio before the first consequence appears.' },
      { label: 'Year 2', text: 'Allocate again with Year 1 totals still visible, then face two events.' },
      { label: 'Year 3', text: 'No more allocation. The accumulated architecture now answers for you.' }
    ]"""
    new = """    sessionShape:
      'About twenty minutes to play. The debrief is designed for the rest of the class hour.',
    catalogueFacts: [
      { label: 'played', value: 'individual or team' },
      { label: 'preparation', value: 'briefing packet before class' },
      { label: 'assessment', value: 'not marked' }
    ],
    atAGlance: [
      { label: 'Decisions', value: 'Two annual allocations' },
      { label: 'Quantitative', value: 'Five-line $9M budget' },
      { label: 'Played', value: 'Individual or team' },
      { label: 'Session', value: 'About an hour' }
    ],
    cast: [],
    beats: [
      { at: 'Year 1', what: 'Commit a technology portfolio before the first consequence appears.' },
      { at: 'Year 2', what: 'Allocate again with Year 1 totals still visible, then face two events.' },
      { at: 'Year 3', what: 'No more allocation. The accumulated architecture now answers for you.' }
    ]"""
    if old not in s:
        raise SystemExit('sim03 detail block missing')
    s = s.replace(old, new, 1)
p.write_text(s)

# canonical launch URL: platform route first, direct host only as fallback
p = Path('sim03/lib/guard.js')
s = p.read_text()
if 'function canonicalUrl(req)' not in s:
    old = """function announceOnce(req) {
  try {
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    const proto = req.headers['x-forwarded-proto'] || 'https';
    announce(S.META, process.env.SIM_URL || (host ? `${proto}://${host}` : ''));
  } catch {}
}
"""
    new = """function canonicalUrl(req) {
  if (process.env.SIM_URL) return String(process.env.SIM_URL).replace(/\\/+$/, '');
  if (process.env.PLATFORM_URL) return String(process.env.PLATFORM_URL).replace(/\\/+$/, '') + '/sim03';
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const proto = req.headers['x-forwarded-proto'] || 'https';
  return host ? `${proto}://${host}` : '';
}

function announceOnce(req) {
  try { announce(S.META, canonicalUrl(req)); } catch {}
}
"""
    if old not in s:
        raise SystemExit('guard announceOnce block missing')
    s = s.replace(old, new, 1)
    s = s.replace('module.exports = { checkAccess, body, announceOnce };',
                  'module.exports = { checkAccess, body, announceOnce, canonicalUrl };')
p.write_text(s)

p = Path('sim03/api/health.js')
s = p.read_text()
if "require('../lib/guard.js')" not in s:
    s = s.replace("const S = require('../lib/scenario.js');\n",
                  "const S = require('../lib/scenario.js');\nconst { canonicalUrl } = require('../lib/guard.js');\n", 1)
s = s.replace("    const host = req.headers['x-forwarded-host'] || req.headers.host;\n    await announce(S.META, process.env.SIM_URL || (host ? `https://${host}` : ''));",
              "    await announce(S.META, canonicalUrl(req));")
old = """    registersAs: process.env.SIM_URL
      || ((req.headers['x-forwarded-host'] || req.headers.host)
        ? `https://${req.headers['x-forwarded-host'] || req.headers.host} (SIM_URL not set)`
        : 'MISSING'),"""
if old in s:
    s = s.replace(old, "    registersAs: canonicalUrl(req) || 'MISSING',", 1)
p.write_text(s)

# deployment and platform docs
p = Path('sim03/DEPLOYMENT.md')
s = p.read_text()
s = s.replace('- `SIM_URL` — the canonical public URL for this sim. Use the stable production URL, not a Vercel preview URL.',
              '- `SIM_URL` — recommended: `https://rapidsims.flexee.org/sim03`. If omitted, `PLATFORM_URL` is used to derive that canonical route.')
if '## Platform integration' not in s:
    s += """

## Platform integration

The production platform proxies `/sim03`, `/sim03/`, and `/sim03/:path*` to `https://sim-03-midland.vercel.app`. Keep `LAUNCH_SECRET` identical on both deployments. Sim03 self-registers as `rapid-03-midland`; registration is unpublished until an administrator explicitly publishes it. Before publication, confirm the catalogue metadata says `individual or team`, `briefing packet before class`, and `not marked`, and run one faculty launch plus one student completion through `https://rapidsims.flexee.org/sim03`.
"""
p.write_text(s)

p = Path('platform/README.md')
s = p.read_text()
if '## Adding a new RapidSim deployment' not in s:
    s += """

## Adding a new RapidSim deployment

Each simulation remains an independent Vercel project and self-registers with the platform using the shared `LAUNCH_SECRET`. The platform owns the public catalogue, course assignment, launch tokens, and completion records. RapidSim 03 (Midland Equipment) uses the canonical route `/sim03`, proxied to `https://sim-03-midland.vercel.app`. Registration remains unpublished by default; publish from the admin console only after authored content and classroom calibration are approved.
"""
p.write_text(s)
