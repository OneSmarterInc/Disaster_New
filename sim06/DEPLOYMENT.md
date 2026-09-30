# Deployment checklist

1. Create a Vercel project from `OneSmarterInc/Disaster_New` with Root Directory `sim06`.
2. Set `LAUNCH_SECRET` (identical to the platform), `PLATFORM_URL`, and `SIM_URL=https://rapidsims.flexee.org/sim06`. Do not rely on the request host.
3. Connect the Upstash Redis integration (`KV_REST_API_URL`, `KV_REST_API_TOKEN`). Every run needs it.
4. Optional: `FACULTY_CODES` for direct instructor access, `ACCESS_CODE` for standalone students.
5. Platform: apply `platform-session-sims.patch` so `/session.html` and `/api/launch` accept `rapid-06-switch` session links, and add the `/sim06`, `/sim06/` and `/sim06/:path*` rewrites to this project's stable alias (read from Settings → Domains).
6. Open `/api/health` with the health key and confirm `launchSecret`, `sessions`, `platformUrl` and `registersAs`.
7. Confirm the catalogue registration arrives as `rapid-06-switch`, unpublished.
8. Playtest one individual session and one team session end to end before publication.
