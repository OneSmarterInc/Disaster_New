# Sim03 review assets

These files are retained for design and implementation review only.

- `harness.html` is a generated standalone review build.
- `harness.template.html` is its source template.
- `observation-preview.html` is a visual review artifact.

They are excluded from Vercel deployment by `sim-03/.vercelignore`.
Do not move them into `public/` or expose them through production routes.
The harness embeds simulation logic that must remain server-side in production.

The canonical source copies remain under `sim-plus-01/`.
