from pathlib import Path

INSTRUCTOR = Path('sim03/public/instructor.html')
CHECK = Path('sim03/tools/team-flow-check.js')


def replace_once(text, old, new, label):
    if old not in text:
        raise SystemExit(f'missing anchor: {label}')
    return text.replace(old, new, 1)

h = INSTRUCTOR.read_text()

# Add a read-only instructor readiness block. This deliberately does not alter
# simulation state, thresholds, navigation, session actions, or outcome logic.
h = replace_once(
    h,
    "${s.mode==='team'?teams(ps,s):''}${calibrate(s)}<div class=\"presentbar\">",
    "${s.mode==='team'?teams(ps,s):''}${calibrate(s)}${readiness(s)}<div class=\"presentbar\">",
    'readiness placement'
)

anchor = "function analytics(rs){"
readiness = """function readiness(s){const t=s.thresholds||state.defaultThresholds||{},y3=Number(t.year3ConnectStrong??5);return `<section class=\"card full\"><div class=\"meta\">Classroom readiness</div><h3>First-section decisions and debrief notes</h3><div class=\"contrast\"><div class=\"runbox\"><div class=\"meta\">Year 3 Connect threshold</div><p><b>Current session: ${y3}</b>. First-section baseline: keep 5. If you intentionally lower strong Connect to 4, set Year 3 pilot max to 3 before saving.</p></div><div class=\"runbox\"><div class=\"meta\">Perfect-run debrief</div><p>They did not necessarily ship nothing visible. The stronger answer is: they built an architecture that passed every test, but almost all discretionary investment went into connectivity, resilience and capacity. At most $2M could have gone into visible Features. The management problem is that much of what made the architecture work was hard for the CEO to see until later consequences arrived.</p></div></div><div class=\"notice\"><b>Before class:</b> post the briefing packet about one week out. Also run one real facilitated Team-mode rehearsal with 2–3 devices so platform launch, Upstash session state, captain commits, completion reporting and the instructor console are exercised together.</div></section>`}\n"""
if readiness.strip() in h:
    raise SystemExit('readiness block already present')
h = replace_once(h, anchor, readiness + anchor, 'readiness function')
INSTRUCTOR.write_text(h)

c = CHECK.read_text()
needle = "assert(instructor.includes('const savedCode='));"
replacement = needle + "assert(instructor.includes('Classroom readiness'));assert(instructor.includes('First-section baseline: keep 5'));assert(instructor.includes('Perfect-run debrief'));assert(instructor.includes('one real facilitated Team-mode rehearsal'));"
c = replace_once(c, needle, replacement, 'readiness regression markers')
CHECK.write_text(c)
