# RapidSim 04 — Whose Number Is Right?

The complete specification and the original handover are in this folder. The
account data, five sheets and calculation engine are copied unchanged from the
handover. `node test/gate-data.test.js` checks those source materials.

## Flow

1. A facilitator creates a room, explicitly choosing team or individual mode
   and at least three groups. The clock defaults to 25 minutes.
2. Participants use the signed platform invitation. In team mode, the
   facilitator assigns each joined participant to a group before starting.
   In individual mode, one person occupies each numbered slot. Sheets are
   assigned A, E, D, C, B and repeat in that order.
3. Students see the briefing, sortable records, CSV downloads, and only their
   own assigned definition. A percentage to one decimal and confidence from 1
   to 5 lock atomically; a second submission cannot change it.
4. Once everyone commits or the clock expires, the facilitator reveals all
   figures at once. The next stage reveals each sheet, department and worked
   calculation. Two groups can be compared side by side.
5. The private calculation check is `/private-check.html?session=ROOMCODE`.
   It is intentionally absent from the projected console. Completing the room
   reports launched participants to the platform; the instructor can retry a
   failed callback.

## Checks

Run `npm test` and `npm run build` from `sim04/`. These use Node 20 or later
and install no dependencies. The test covers the full three-group flow and
the seven-group sheet cycle. The build checks student bundle leaks, forbidden
terms, config and deployment wiring. Runtime diagnostics are available through
`/api/health` with `x-health-key` when `HEALTH_SECRET` is set.

## Deployment

Create a separate Vercel project with **Root Directory `sim04`** and stable
alias `sim04.vercel.app`. Set the variables in `.env.example`: an explicit
`SIM_URL=https://rapidsims.flexee.org/sim04`, matching `LAUNCH_SECRET`,
`PLATFORM_URL`, Upstash Redis REST credentials and `HEALTH_SECRET` are required
for platform sessions. Use a dedicated `ACCESS_CODE` and `FACULTY_CODE` (or
`FACULTY_CODES`) only if direct access is needed. The platform rewrite is
prepared in `platform/vercel.json`. Registration creates Sim 04 as unpublished;
an administrator publishes it after reviewing the catalogue and verifying
there is no preexisting `rapid-04-whose-number` row.

The source ZIP asked for a Next.js front end, while current RapidSims projects
use dependency-free static pages and Vercel Node functions. This implementation
uses the existing deployment convention, so the shared launch and session
contract remains consistent. It does not change the locked data or copy.
