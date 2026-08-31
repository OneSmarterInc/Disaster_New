#!/usr/bin/env python3
"""Generate a standalone HTML review harness from the real engine sources.

The harness is a REVIEW build, not a deployable one: it ships the
phrasing bank and the fact contracts to the browser, which is precisely
what the production build must not do. It exists so the sim can be
played and judged before any of it is wired to a server.

Generated from source rather than hand-copied so the harness cannot
drift from the engine it is meant to demonstrate.
"""
import io, os, re, sys

ROOT = os.path.dirname(os.path.abspath(__file__))

ORDER = [
    'data/phrasings.js',
    'data/contracts.js',
    'data/calendar.js',
    'data/report.js',
    'src/classifier.js',
    'src/engine.js',
    'src/report.js',
]

def strip(path):
    src = io.open(os.path.join(ROOT, path), encoding='utf-8').read()
    src = re.sub(r"^'use strict';\n", '', src, flags=re.M)
    src = re.sub(r"^const .*= require\(.*\);\n", '', src, flags=re.M)
    if path == 'data/phrasings.js':
        if 'module.exports = [' not in src:
            sys.exit('phrasings.js export shape changed')
        src = src.replace('module.exports = [', 'const BANK = [')
    else:
        before = src
        src = re.sub(r"^module\.exports = \{[^\n]*\};\n", '', src, flags=re.M)
        if src == before:
            sys.exit('could not strip export from ' + path)
    return src.strip()

bundle = '\n\n'.join(
    '/* ===== %s ===== */\n%s' % (p, strip(p)) for p in ORDER
)

# Sanity: nothing CommonJS may survive into the browser bundle.
for token in ['module.exports', 'require(']:
    if token in bundle:
        sys.exit('CommonJS token survived the strip: ' + token)

TEMPLATES = [
    ('harness.template.html', 'harness.html'),
    ('interview.template.html', 'interview-preview.html'),
]

for tpl, dest_name in TEMPLATES:
    tpl_path = os.path.join(ROOT, tpl)
    if not os.path.exists(tpl_path):
        continue
    out = io.open(tpl_path, encoding='utf-8').read().replace('/*__ENGINE__*/', bundle)
    dest = os.path.join(ROOT, dest_name)
    io.open(dest, 'w', encoding='utf-8').write(out)
    print('wrote %s (%d KB) from %d modules' % (dest_name, len(out) // 1024, len(ORDER)))
