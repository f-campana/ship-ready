# Fodmapp demo recording V2

`final-demo.mp4` is a 55.56-second, silent, 1280×720 H.264 demo of the local ShipReady UI against `https://fodmapp.fr` and `/Users/fabiencampana/Documents/fodmapp/apps/marketing`.

The recording shows the launch-readiness decision, safe crawl-file plan for `app/robots.ts` and `app/sitemap.ts`, the guarded creation-only command, deterministic successful copy confirmation, trust boundaries, and a local-vs-live ending. Browser-rendered captions are baked into the video; `captions.srt` remains available as a valid sidecar.

Verification passed: 142 tests, TypeScript typecheck, production build, `POST /api/fix` returns 404, the GUI fetches only `/api/ui-report`, and the target Fodmapp marketing tree hash is unchanged.
