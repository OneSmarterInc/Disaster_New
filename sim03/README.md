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

## Authored Year 3 and buyer content

The formerly open Year 3 calibration case is now authored as `data_no_room` when
Connect reaches the strong threshold but Capacity does not. The buyer stage is also
authored: Carrolton Systems, Ridge Hollow Partners and Corven Building Systems each
return a deterministic `high`, `qualified` or `low` interest verdict without a
dollar valuation, total, ranking or winner.

## Endpoints

- `GET /api/health` — deployment/configuration diagnostics and catalogue announce
- `GET /api/config` — public, non-outcome UI copy and metadata
- `POST /api/outcome` — server-side deterministic outcome evaluation
- `POST /api/session` — facilitated session/team/instructor state
- `POST /api/finish` — completion report to the platform
