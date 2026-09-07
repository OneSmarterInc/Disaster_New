# Deployment checklist

Create a new Vercel project from `OneSmarterInc/Disaster_New` with **Root Directory `sim03`**.

Set these environment variables before first traffic reaches the deployment:

- `LAUNCH_SECRET` — exactly the same value as the RapidSims platform.
- `PLATFORM_URL` — the production RapidSims platform base URL.
- `SIM_URL` — the canonical public URL for this sim. Use the stable production URL, not a Vercel preview URL.
- KV/Upstash REST URL and token for facilitated sessions.
- Optional `ACCESS_CODE` and `FACULTY_CODES` for standalone use.

Then:

1. Run `npm test` and `npm run build` locally or confirm the `sim03-checks` workflow is green.
2. Deploy the new Vercel project.
3. Open `/api/health` and confirm `launchSecret`, `sessions`, `platformUrl`, and `registersAs` are correct.
4. Confirm the self-registration creates `rapid-03-midland` as **unpublished** in the platform catalogue.
5. Do not publish until the two authored content gaps documented in `README.md` are resolved.
6. Test one individual session and one team session end-to-end before catalogue publication.

No existing `sim`, `sim-02`, `simplus01`, or platform runtime file is changed by this branch.
