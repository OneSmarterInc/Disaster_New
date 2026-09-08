# RapidSim 03 — Midland Equipment

Midland Equipment is the architecture-week RapidSim. A student allocates a fixed
technology budget across two years, then sees deterministic consequences in Year 1,
Year 2 and a final Year 3 they can no longer influence.

This folder is intentionally isolated from `sim/` and `sim-02/`. Deploy it as its own
Vercel project with **Root Directory = `sim03`**.

## Runtime contract

The deployment uses the same platform contract as the existing RapidSims:

- `LAUNCH_SECRET` verifies platform launch tokens and signs registration/completion.
- `PLATFORM_URL` is the RapidSims platform base URL.
- `SIM_URL` is the canonical address that should be stored in the catalogue.
- `ACCESS_CODE` is an optional standalone fallback.
- Upstash/Vercel KV stores facilitated sessions, teams and instructor-view data.

The sim self-registers as `rapid-03-midland`. Registration also declares
`rapid-03-bench` as a replaceable temporary alias. The platform will remove that
alias only when it has **zero** course, launch, completion, preview or access history;
otherwise it is left alone.

## Play modes

Faculty must choose **Individual** or **Team** when creating a facilitated session.

- Individual: each participant owns one run.
- Team: faculty assign participants to teams. One captain per team can commit;
  every team member can see the committed team state.

Direct platform launches remain supported and run as an individual entitlement unless
a future platform token supplies a session/mode.

## Calibration

Outcome thresholds are server-side. A faculty member can edit them in the session
console while the session is still in the lobby. The chosen calibration is stored
with that session, so thresholds can be changed between class sections without a
deploy.

For the first classroom section, keep the Year 3 strong Connect threshold at **5**.
If a later section intentionally lowers it to **4**, Year 3 pilot maximum must also
move from **4** to **3** before the calibration can be saved.

## Authored Year 3 and buyer content

The formerly open Year 3 calibration case is now authored as `data_no_room` when
Connect reaches the strong threshold but Capacity does not. The buyer stage is also
authored: Carrolton Systems, Ridge Hollow Partners and Corven Building Systems each
return a deterministic `high`, `qualified` or `low` interest verdict without a
dollar valuation, total, ranking or winner.

## Classroom readiness

Before a class uses this sim, run one real facilitated **Team** session with two or
three devices. Exercise the platform launch, Upstash-backed session state, captain
commit behavior, pause/resume, completion reporting, student result return and the
instructor console together. The production health endpoint confirms that the
configuration is present; this rehearsal confirms that the whole path actually works.

Post the briefing packet about a week before class. The app gives students a reference
copy, but the teaching design still assumes they arrive having read it.

For a run that clears every event, do not say the team necessarily "shipped nothing."
The stronger debrief is that almost all discretionary investment had to go into
connectivity, resilience and capacity; at most $2M could have gone into visible
Features. The architecture worked, but much of what made it work was difficult for
the CEO to see until the later consequences arrived.

## Endpoints

- `GET /api/health` — deployment/configuration diagnostics and catalogue announce
- `GET /api/config` — public, non-outcome UI copy and metadata
- `POST /api/outcome` — server-side deterministic outcome evaluation
- `POST /api/session` — facilitated session/team/instructor state
- `POST /api/finish` — completion report to the platform
