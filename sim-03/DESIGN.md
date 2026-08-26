# RapidSim 03 — design note

**Status:** engine built and tested. No scenario. Not deployable.

## The competency

Local optimization against system outcome. A participant owns one station of a
process, improves it, and pushes the cost downstream where they cannot see it.

This is deliberately not the lesson in 01 or 02. Both of those teach sequencing
under irreversibility — a single decision-maker facing a sequence, where the
question is what you do before the door shuts. RapidSim+ 01 teaches question
formulation under scarce access. This one is the third distinct competency and
it is the one BPM actually owns, since local optimization is the failure that
process redesign exists to correct.

## Why it needed a different engine

01, 02 and RapidSim+ 01 all put the participant in front of everything that
matters. The information is available; the question is what they do with it,
or whether they ask for it well. Here the information is structurally absent.
The participant sees their own station and nothing else, and the consequence
accrues in a place the interface does not render.

That means hiding is an engine property, not a UI property. `visible()` is an
allow-list, so a state field added later defaults to hidden rather than
defaulting to leaked. The action list ships id, label and local price only —
never the downstream effects, never which action is the inspect action.

## The three things that make it teach

**Deferral.** Downstream effects land at least one round after the action that
caused them, and in practice two. If the cost showed in the same breath, the
participant would learn the mapping by round three and the sim would collapse
into an optimisation puzzle. The lag is what lets local reasoning look correct
for long enough to commit to it. The definition validator rejects `lag < 1`.

**The trap has to pay.** The guard asserts that the locally greedy path
outscores the careful one on the local scoreboard. If the right answer is also
the locally optimal answer there is no dilemma and nothing is being taught.

**A way out that costs something.** There is an inspect action that reads
downstream state and returns a sentence — never a number, because a number is
a gauge the participant can optimise to zero. It is priced so that a
participant who uses it will not top the local scoreboard. Paying attention
downstream costs you locally, and that is precisely why people don't. Without
this the sim is a trick.

Readings are prose for the same reason harm lands on a named person rather
than a metric: the participant should come away knowing that someone at the
next step is not coping, not holding a strain figure.

## What is not built

**The scenario.** Deliberately. The house process runs a full paper playtest
before the build, and inventing a company and its characters inside a code
commit is how placeholder people reach production. The engine runs against a
synthetic fixture in `test/` with flat generic names precisely so nobody
mistakes it for scenario content.

Scenario work needs to decide: the process and its stations, who owns the
station downstream and what happens to them, the real action set and its
costs, and the round count against the twenty-minute clock. The fixture uses
eight rounds as a placeholder, which is a guess, not a finding.

**Everything client-facing.** No `api/`, no `src/`, no build step, no
`vercel.json`. There is no point assembling a client around an engine whose
scenario does not exist.

**The debrief.** This sim needs the instructor transcript view more than 01 or
02 do, and arguably more than RapidSim+ 01. The failure is invisible by
construction: a participant who plays the local scoreboard has a good run by
every signal they were shown. Without the transcript on screen, the debrief is
one person's word against their own memory of a scoreboard that told them they
were winning. The platform spec already exists.

## Open questions for playtest

Whether eight rounds is right against twenty minutes, or whether the deferral
lag needs to shrink to keep the arc inside the clock.

Whether a participant who inspects early and finds nothing wrong — because
nothing is wrong yet — concludes the inspect action is worthless and stops
paying for it. That is realistic behaviour and it may be the most interesting
thing the sim produces, or it may make the sim unwinnable in practice.

Whether the local scoreboard needs a visible comparison against peers to make
the pressure real, and whether that tips it from pressure into coercion.
