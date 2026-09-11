# Midland — Increment 3 review

Based on accepted Increment 2 at `a8560b5`. This increment changes student-facing copy, layout, and explanations, not calibration or decision rules. The instructor page, APIs, session storage, and runner authorization remain unchanged.

## Acceptance map

| Items | Change |
| --- | --- |
| 1–2 | Packet uses relative preparation timing, approximately 30 minutes, two $9M allocations, and a third-year reveal. It explicitly distinguishes individual decisions from shared team decisions. |
| 3–4 | All four names, roles, and full quotes come from the same cast data used by Room; Sam retains 19% and $290. |
| 5–6 | Allocation rows show one advocate block and the constraint badge, not a description plus repeated footer. Year 2 uses concise wants. |
| 7–8 | Capacity has the same block position, with neutral text: “No one in the room speaks for this line.” Position uses that block too. |
| 9–11 | Remaining budget sits beside commit in a sticky footer. Compact laptop layout keeps Features and commit visible. Year 2's three-value split is collapsed initially, can be reopened, and stays open while editing. |
| 12–14 | Year 1 and Year 2 narrative precedes the portfolio. Brief keeps company and systems together, then business-model emphasis and takeover. Laptop Continue remains visible. |
| 15–17 | Designer narration removed from competitor and Year 3 lead. Tom discusses his board window in the competitor event; the realization appears only in Year 3 weak. |
| 18 | Position states the actual unchanged rule: Run has a $3M minimum; the other four lines have $3M annual ceilings. Run does not have a $3M maximum. |
| 19–21 | View names the four competing positions and invites a fifth. Close has a matching headline. Whose argument and whether to make the same call are separate labelled inputs. |
| 22–23 | Year 3 explicitly says there is no allocation. Tom reacts in all four outcome bands, before Sam's closing response. |
| 24–25 | Server-generated event notes name the allocation and its nearest consequence on the school-district and heat-wave screens. Notes use the current session calibration and are not sent in initial config. |
| 26 | Dale ties last year's spending to dispatch for sixty-two technicians and avoiding a return to paper; no unsupported downtime statistic is invented. |
| 27–28 | Carrolton has the same italic room-link slot as the other buyers, stating that no one in the room made its argument. Ridge Hollow's high-interest text names its post-sale cost cuts. |
| 29–30 | The closing section selects a primary consequence and a feasible allocation trade, rather than repeating several threshold comparisons. Other event summaries are collapsed. Excess Uptime is related to Sam's unfunded Connect request, with annual limits respected. |

All three original `year2Intro` bands are retained and tested against their district-renewal outcomes.

## Reflection compatibility

The first two displayed answers share the existing `reflection1` field, separated by a labelled line. The third answer remains in `reflection2`. Old unsplit answers display intact. The existing 1,500-character storage limit for `reflection1` is checked before submission, so the new second input cannot be silently truncated. Instructor storage/export contracts do not change.

## Verification

Run `npm test` and `npm run build` from `sim03`.

The Increment 3 build check compares all 150 legal annual portfolios and all 22,500 two-year pairs with golden digests generated from accepted Increment 2. It repeats this at three calibrations (67,500 comparisons), covering all outcome bands and buyer-interest classifications. It also reconstructs each suggested transfer, validates both annual budgets, and checks the claimed resulting outcome.

The browser check uses actual config, outcome, and finish handlers. It runs at 1366×768, 1280×720, and 390×844; exercises allocation buttons, caps, commit, the split table, event order, the third-year reveal, buyers, independent reflection inputs, length protection, and completed results. Screenshots and results are CI artifacts. For restricted local rendering only, `OFFLINE_RENDER=1` uses a Node transport bridge; CI uses normal browser HTTP.

The existing separate-lead/runner, authorization, locked-decision, stale-poll, and personal-reflection tests are retained. The existing real-Redis, instructor/three-student browser test is unchanged.

No production deployment or merge is implied by this review branch.
