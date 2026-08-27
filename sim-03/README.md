# RapidSim 03 — The Bench Is Clear

Local optimization against system outcome. Twenty minutes, played alone.

    npm run check    # build, 45 tests, 11 design invariants, end-to-end boot

Built and tested on Node v22. No model in the loop, so no ANTHROPIC_API_KEY —
01 and 02 both need one and somebody will assume this does too.

## What it is

You run the diagnosis bench at Harlow Instruments. Units arrive with a fault
code, you decide what is wrong, and a field engineer drives out and fits
whatever you called. Your scoreboard is units cleared and cycle time. Both are
honest. Neither shows you Dev Okonjo, who is two stations downstream fitting
your calls, and whose month gets worse every time you clear from the symptom
code instead of bench-testing.

There is a way to find out. It costs four bench points and returns a sentence.

## Getting in

Two ways, same as 01 and 02. A launch token signed by the platform, which also
says who is playing, or the shared `ACCESS_CODE` for standalone use. The code
can arrive as `?code=` or `#code=` in the link, or be typed into the gate.

Set no `ACCESS_CODE` and the deployment is open to anyone with the address.

## Layout

    lib/engine.js             session, clock, deferred effects, harm, tokens
    lib/scenario.js           SERVER ONLY — process, costs, brief, debrief
    lib/store.js              KV over REST, same as 01 and 02, plus raw keys
    lib/guard.js lib/launch.js  access and platform handshake, shared with 02
    api/run.js                the whole run loop — brief, start, act, resume, debrief
    api/health.js api/meta.js liveness and catalogue
    src/ build.js public/     client, assembled to one file, audited on build
    tools/design-guard.js     invariants a process definition must satisfy
    tools/boot-check.js       plays a full run through the real handlers
    test/                     engine and scenario suites

## The rule that matters

Nothing in `lib/scenario.js` ships to the browser. `visible()` is an allow-list,
so a state field added later is hidden by default rather than leaked by default.

Action ids are opaque per-run tokens. `call_field` announces that there is a
field to call and `clear_fast` announces which option the sim thinks is fast —
a participant with the network tab open would have the shape of the sim before
their first decision. The tokens are random per run, so two people comparing
screens learn nothing either.

`PROTECTED_KEYS` in the engine and `forbidden` in `build.js` are each one array
used once. Sim 01 shipped a forbidden-terms list that had drifted from the regex
meant to enforce it, so the check never fired. Do not keep two copies.

## Things that will bite you

**Tuning the costs is tuning the lesson.** `design-guard.js` asserts the greedy
path outscores the careful one and that looking is never free. The scenario
tests assert the full gradient: the run that harms Dev scores 51, the run that
protects him scores -8. If that inverts, the sim stops working.

**Deferral is not decoration.** `lag < 1` is rejected at validation. A
same-round downstream effect teaches the mapping and the sim collapses into an
optimisation puzzle.

**Readings are prose, and the bands are coarse on purpose.** Strain of 2 still
reads as "nothing unusual". That is the point — a participant who looks early
is told everything is fine, and it is true when they ask. Anything deciding
what a participant "knew" must compare the TEXT they read against the calm
band, never the number behind it. Comparing against zero produced a debrief
that accused people of ignoring warnings they never received.

**Eight endings, and they are not decorative.** `test/scenario.test.js` pins
each one to a play plan. Two of them — `looked-too-early` and `acted-blind` —
exist because the obvious three-verdict version described runs that had not
happened.
