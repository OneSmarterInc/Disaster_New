# RapidSim+ — Why Don't They Have Any Patience?

Production integration of the supplied claims-interview simulation in the platform's Sim 03 slot.

The classifier, answer contracts, posture machine, clock and report evaluation are server-side. The browser receives only the current source, public conversation and remaining time. Upstash/Vercel KV persists runs for 48 hours.

## Verify

    npm test
    npm run playtest

## Required deployment variables

- `KV_REST_API_URL` and `KV_REST_API_TOKEN`
- `LAUNCH_SECRET`
- `PLATFORM_URL`
- `SIM_URL` when mounted under `/sim03`
- Optional `ACCESS_CODE` for standalone access

No model API key is required.
