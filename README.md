# Flexee Rapid Sims

Two deployments in one repository.

## sim/

Rapid Sim 01 — Disaster or Breach? A twenty-minute simulation where students run
an IT incident and take advice from four AI characters whose professional
exposure runs in opposite directions.

The scenario lives server-side in `lib/scenario.js` and never reaches the
browser: the ground truth, every character's knowledge and prohibitions, and the
debrief. A student who reads the page source learns nothing about how it ends.

Runs standalone, or as a facilitated session with join codes, grouping, a shared
clock the instructor can freeze, and a side-by-side comparison of every group's
positions.

Needs `ANTHROPIC_API_KEY`, `ACCESS_CODE`, `FACULTY_CODES`, and an Upstash Redis
store for session state.

## platform/

Catalogue, faculty accounts, courses, student enrolment and entitlement.

The platform never hosts a sim. It signs a short-lived launch token saying who
someone is and in what capacity; the sim verifies it with a shared secret. That's
the whole contract between them, which is what lets each sim stay a small
independent deployment.

Payment is handled outside the system. A faculty member marks a student or a
whole section as paid, and that flag is what unlocks a launch.

Needs Postgres, `LAUNCH_SECRET`, and `PUBLIC_BASE_URL`.

## Deploying

Two Vercel projects against the same repository, each with its Root Directory set
— one to `sim`, one to `platform`. Each redeploys only when its own folder
changes.
