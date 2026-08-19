# Configuration

Two Vercel projects from this repository, each with a different Root Directory.

## sim/ — RapidSim 01

Root Directory `sim`. Serves the simulation and its facilitator session console.

| Variable | Needed | What it does |
|---|---|---|
| `ANTHROPIC_API_KEY` | yes | Generates the characters. Store as sensitive. |
| `ACCESS_CODE` | for standalone use | What someone types to open the sim directly. Not needed when everyone arrives from the platform. |
| `FACULTY_CODES` | for live sessions | `Name:code` per person, comma separated. Gates the session console. |
| `LAUNCH_SECRET` | to accept platform launches | Must match the platform's exactly. |
| `PLATFORM_URL` | to report completions | Where to post when a student finishes. |
| `KV_REST_API_URL` / `KV_REST_API_TOKEN` | for live sessions | Set by the Upstash Redis integration. Do not set by hand. |

## platform/ — catalogue, courses, entitlement

Root Directory `platform`.

| Variable | Needed | What it does |
|---|---|---|
| `DATABASE_URL` | yes | Postgres. Set by the Neon integration. |
| `LAUNCH_SECRET` | yes | Must match every sim it launches into. |
| `PUBLIC_BASE_URL` | yes | Its own address, used to build invitation and enrolment links. No trailing slash. |
| `SETUP_KEY` | first run only | Guards `/setup.html`. Delete it once setup is done. |
| `RAPID_01_URL` | optional | Seeds the catalogue during setup. |

## Checking a deployment

Both projects answer at `/api/health`, reporting what is configured without revealing it. Each prints an eight-character fingerprint of its launch secret — matching fingerprints mean launches will be trusted, different ones mean they never will.

## After a release that changes the schema

Admin console, Catalogue tab, "Bring the database up to date". Every statement is create-if-missing, so running it repeatedly is harmless and it never drops anything.

## Things that have caught us out

Vercel only bundles files it can see being required, so nothing may be read from disk at runtime. The schema lives in `lib/schema.js`, generated from `schema.sql` by `lib/build-schema.js`.

The neon driver is a tagged-template function with no `.query()` method, and its templates cannot be nested — write two statements rather than composing one.

Vercel refuses to build commits whose author email does not match a GitHub account.

Changing Root Directory needs a redeploy with the build cache disabled, or the old output is served.

`sim/public/index.html` is generated. Edit `sim/src/` and run `node build.js`, which refuses to write a bundle containing scenario content.
