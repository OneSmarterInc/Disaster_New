# RapidSim 05 and 06 integration

The two simulations live in independent Vercel projects with Root Directory
`sim05` and `sim06`. Their catalogue IDs are `rapid-05-approve` and
`rapid-06-switch`. The platform launch and session-entry code recognizes both,
and registration creates new catalogue records as unpublished.

Before traffic or publication, create the Vercel projects and configure each
project's `LAUNCH_SECRET` (the same value as the platform), `PLATFORM_URL`,
`SIM_URL` (`https://rapidsims.flexee.org/sim05` or `/sim06`), and Upstash REST
credentials. Use the actual stable project aliases from Vercel Settings →
Domains for the platform rewrites:

- `/sim05`, `/sim05/` -> `https://<sim05 alias>/launch.html`
- `/sim05/:path*` -> `https://<sim05 alias>/:path*`
- `/sim06`, `/sim06/` -> `https://<sim06 alias>/launch.html`
- `/sim06/:path*` -> `https://<sim06 alias>/:path*`

Copy the `/sim03/(.*)` noindex/no-store header block for both prefixes.
Do not guess these aliases. The platform routes are intentionally deferred
until the actual project domains exist.

Check each `/api/health` with the health key, confirm the shared launch-secret
fingerprint and canonical `registersAs` URL, and confirm each record appears
unpublished. Run an individual and a team session through the platform join
links, including timeout, pause/resume, completion reporting and instructor
views. Publication remains an administrator action after review.
