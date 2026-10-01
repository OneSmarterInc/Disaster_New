# Who Pays for the Wire? — RapidSim+ 02

Simulation ID `rapidsimplus-02`, number `102`, repository folder `simplus02/`, platform route `/simplus02`.

## Vercel project

Create a project from `OneSmarterInc/Disaster_New`, production branch `main`, root directory `simplus02`, framework preset **Other**. The checked-in configuration uses `node tools/build-gate.js` as its build command and `public` as its output directory. Git deployments must remain enabled.

The simulation is instructor-led and needs at least four students per table. Additional students share seats as co-counsel. Its original engine, calibration, timing and confidential seat briefs are retained.

## Environment variables

| Variable | Value |
| --- | --- |
| `SIM_URL` | `https://rapidsims.flexee.org/simplus02`; set explicitly. |
| `PLATFORM_URL` | `https://rapidsims.flexee.org` |
| `LAUNCH_SECRET` | Same secret as the platform and other simulations. |
| `HEALTH_SECRET` | Same dedicated diagnostic secret as the platform; separate from `LAUNCH_SECRET`. |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | Existing `rapidsim-sessions` store; `KV_REST_API_*` names also work. |
| `FACULTY_CODES` | Optional comma-separated `Name:code` pairs for standalone instructor access. |
| `ACCESS_CODE` | Optional standalone student code. Omitting it closes standalone student access. |

Never commit secret values. Platform accounts do not need the standalone codes. Rooms are bound to their creating instructor and course; account rejoining retains the original seat. Completions include the student account, course, seat, settled groups and imposed terms, with failed callbacks retried.

## Platform rewrites

Read the owned production alias from the new project's **Settings → Domains**. Do not assume a generic shared `vercel.app` name belongs to this project.

In `platform/vercel.json`, add three rewrites before broader rules:

| Source | Destination |
| --- | --- |
| `/simplus02` | `https://OWNED-ALIAS/` |
| `/simplus02/` | `https://OWNED-ALIAS/` |
| `/simplus02/:path*` | `https://OWNED-ALIAS/:path*` |

Replace `OWNED-ALIAS` with the verified project domain. Add an `X-Robots-Tag: noindex` header for `/simplus02/(.*)`, consistent with the other simulation routes. Commit these changes and let the platform redeploy. These rewrites are pending until the owned project alias is confirmed.

## Registration and readiness

Self-registration is wired in. A normal session API request sends a signed registration to the platform once per cold start; a failed announcement retries. Registration creates catalogue row `rapidsimplus-02` as **unpublished** with number `102`, authored metadata and the configured `SIM_URL`.

After the project and rewrites are deployed:

1. Check `/simplus02/api/health`. Public output is only `{"ok":true,"sim":"rapidsimplus-02"}`.
2. Use the platform administrator health probe, which sends `HEALTH_SECRET` in `X-Health-Key`. Verify configured storage/signing, the matching launch-secret fingerprint, platform URL, canonical `registersAs` and `self-register` capability. Health never registers or writes data.
3. Open the standalone instructor console and make a normal session request, or POST `{"action":"entry"}` to `/simplus02/api/session`, to trigger registration. An unsigned entry request returns `401`; registration itself uses the server's signing secret.
4. Confirm the catalogue row remains unpublished. Grant a faculty preview or attach it to a test course, then use **Run a session**. Signed faculty enter the console; students find the course's open room or join its invitation.

## Publication requirement

`data/reveal.js` still has `verified: false`. Verify every historical figure against the original order before setting that flag and publishing the catalogue row. The build emits a warning while it is false; the upload's unverified facts have not been marked verified.

## Checks and screens

`npm test` and `npm run build` run calibration, content, table, API, integration and browser-script syntax checks. `simplus02-checks` additionally runs the complete four-student class flow in Chromium against disposable fixtures, including fresh-tab rejoining and failed completion retries. To run that browser check locally, install Playwright and Chromium, then run `node tools/browser-check.js` with Playwright available on `NODE_PATH`.

Students open `/simplus02/`; the instructor console is `/simplus02/console.html`. Both work on the simulation's own domain and through the platform prefix.
