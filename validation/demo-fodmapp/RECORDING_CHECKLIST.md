# ShipReady Fodmapp Recording Checklist

## Before recording

- [ ] Run `pnpm test`, `pnpm typecheck`, and `pnpm build` successfully.
- [ ] Start `pnpm shipready gui --port 4317`.
- [ ] Use a desktop window at least 1280px wide and browser zoom at 100%.
- [ ] Close unrelated tabs, notifications, overlays, and autofill prompts.
- [ ] Open DevTools, clear the console, and confirm it is clean.
- [ ] Load a fresh connection screen at `http://127.0.0.1:4317/`.
- [ ] Have the exact URL ready: `https://fodmapp.fr`.
- [ ] Have the exact repo ready: `/Users/fabiencampana/Documents/fodmapp/apps/marketing`.
- [ ] Confirm the target repo is unchanged and the two crawl files do not exist.
- [ ] Rehearse the 60–90 second script once with a timer.

## During recording

- [ ] Enter the exact URL and repo path without improvising.
- [ ] Navigate and scroll slowly; pause after the report loads.
- [ ] Show **Needs attention before launch** clearly.
- [ ] Confirm safe apply lists only `app/robots.ts` and `app/sitemap.ts`.
- [ ] State that safe apply is preview-first and creation-only.
- [ ] State that there are no overwrites, metadata/content/config writes, commits, or deploys.
- [ ] Click **Copy command** and hold on the visible copy confirmation.
- [ ] Do not run the write command unless explicitly recording a separate CLI safety demonstration.
- [ ] Warn that local changes do not affect the live site until an intentional deployment.
- [ ] Avoid claims about ranking improvements, SEO boosts, or guaranteed indexing.

## After recording

- [ ] Stop the GUI server with `Ctrl-C`.
- [ ] Confirm port `4317` is no longer serving the GUI.
- [ ] Confirm the browser console remained free of warnings and errors.
- [ ] Confirm the guarded command shown was exact.
- [ ] Confirm the target repo remains unchanged.
- [ ] Review the recording for readable text, steady navigation, and a clear copy confirmation.
- [ ] Verify the spoken runtime is between 60 and 90 seconds.
- [ ] Keep the local-versus-live warning in the final cut.
