# RapidSim 03 — engine

Local optimization against system outcome. Server-side only.

    npm test     # 22 engine tests
    npm run guard # 11 process-definition invariants
    npm run check # both

Built and tested on Node v22.

## Status

Engine only. There is no scenario, no client, and nothing deployable here.
`test/fixture-process.js` is a synthetic process used to exercise mechanics —
it is not scenario content and its names are flat on purpose. See `DESIGN.md`
for what is deliberately not built and why.

## Files

    lib/engine.js             session, clock, deferred effects, harm, transcript
    guard.js                  invariants a process definition must satisfy
    test/engine.test.js       leak, deferral, winnability, persistence
    test/fixture-process.js   synthetic process, TESTS ONLY
    DESIGN.md                 competency, mechanic, open questions

## The rule that matters

Nothing here ships to the browser. `visible()` is an allow-list, so a state
field added later is hidden by default rather than leaked by default. The
action list carries id, label and local price only — never the downstream
effects, never which action inspects.

`PROTECTED_KEYS` is one array used as both the written list and the detector.
Sim 01 shipped a forbidden-terms list that had drifted from the regex meant to
enforce it, so the check never fired. Do not keep two copies.

## Things that will bite you

**Tuning the costs is tuning the lesson.** The guard asserts the greedy path
outscores the careful one and that inspecting is not free. Both are load-
bearing. If the right answer becomes locally optimal there is no dilemma.

**Deferral is not decoration.** `lag < 1` is rejected at validation. A
same-round downstream effect teaches the mapping and the sim stops working.

**Readings are prose, not numbers.** A figure is a gauge the participant will
optimise against. A sentence is a thing they have to interpret.

**Do not name a station after a protected field.** The leak detector matches
key position specifically for this reason, but a station called `rework` will
still make every grep in this directory harder to read.
