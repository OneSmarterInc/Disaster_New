# RapidSim 03 — design note

**Status:** built. Scenario, client and API complete; full check green.
Not yet playtested with people, and not yet deployed.

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

**The instructor transcript view.** This sim needs it more than 01 or 02 do.
The failure is invisible by construction: a participant who plays the local
scoreboard finishes with the best numbers in the room and every signal they
were given said so. Without the transcript on screen, the debrief is one
person's word against their own memory of a scoreboard that told them they
were winning. `api/run.js` already returns the whole day-by-day timeline, so
the adapter is a reshape rather than new logic. The platform spec exists.

**A faculty page.** 01 and 02 have `public/faculty.html`. This sim is played
alone with no session code, so there is nothing to facilitate mid-run — but a
faculty member still needs to see who finished and which of the seven endings
they got, and that is the same transcript view.

**Deployment.** No Vercel project, no KV store attached, no routing under
`/sim03`. Nothing here has run against real Redis.

## Answered during the build

**The early-look trap is real, and it was nearly a bug.** A participant who
calls the field desk on day 3 is told Dev is closing his calls, because what
they sent him has not arrived yet. They reasonably conclude that looking costs
four points and returns nothing, and they never look again. The first version
of the debrief told those people they had been warned and ignored it, which
was false. It now has its own ending, and it is the most uncomfortable one the
sim produces: they did the right thing once, it appeared not to work, and the
appearance was an artefact of the two-day lag.

**Acting without evidence needed its own ending too.** A participant who
reissues corrections having never seen a bad reading is not lucky. They
reasoned from the structure — they knew what clearing from a symptom code was,
and they knew somebody downstream was fitting their calls. That is harder than
responding to a warning and almost nobody does it.

**Eight rounds fits.** Ninety seconds each gives twelve minutes of play, which
leaves three for the brief and five for the debrief inside the twenty.

## Open questions for playtest with people

Whether the clock at ninety seconds is pressure or panic. The client defaults
to the first option when it expires, which is the fast one, and that is a
deliberate claim about what happens to a decision nobody has time to make. It
may be too harsh.

Whether the scoreboard needs a comparison against other people on the bench to
make the pressure real, and whether that tips it from pressure into coercion.

Whether anyone reads the brief closely enough to notice Dev is named in it. If
they do not, the harm lands as a twist rather than as something they were told
about and did not think to protect.
