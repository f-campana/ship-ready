# ShipReady Fodmapp Demo Runbook

## Goal

Deliver a repeatable 60–90 second launch-readiness demo showing what crawlers and preview bots see, then present a narrow, preview-first path for two safe crawl files.

## Prerequisites

- Work from `/Users/fabiencampana/Documents/ship-ready`.
- Use Node.js and pnpm compatible with `package.json` and the lockfile.
- Confirm port `4317` is free.
- Confirm `/Users/fabiencampana/Documents/fodmapp/apps/marketing` exists and is readable.
- Use a desktop browser at 100% zoom and a width of at least 1280px.
- Open DevTools and clear the console before recording.
- Do not run the guarded write command unless the recording explicitly demonstrates CLI safety.

## Preflight

Run each command from the ShipReady checkout:

```bash
pnpm test
pnpm typecheck
pnpm build
pnpm shipready gui --port 4317
```

Open `http://127.0.0.1:4317/` after the final command starts the server.

## Exact demo input

```txt
URL: https://fodmapp.fr
Repo: /Users/fabiencampana/Documents/fodmapp/apps/marketing
```

Expected result:

- Readiness: **Needs attention before launch**
- Safe apply is available only for `app/robots.ts` and `app/sitemap.ts`
- Guarded command:

```bash
pnpm shipready fix /Users/fabiencampana/Documents/fodmapp/apps/marketing --url https://fodmapp.fr/ --write --allow-create
```

## Ten demo beats

1. Open on the clean ShipReady connection screen.
2. State the pain: a site can look ready while crawlers and preview bots see gaps.
3. Enter `https://fodmapp.fr` in the URL field.
4. Enter `/Users/fabiencampana/Documents/fodmapp/apps/marketing` in the repo field.
5. Click **Check site** and allow the result to settle before speaking.
6. Show **Needs attention before launch** and frame it as launch-readiness, not a ranking promise.
7. Show the two safe crawl files: `app/robots.ts` and `app/sitemap.ts`.
8. Explain the boundary: preview first, creation-only, no overwrites, no metadata/content/config writes, no commits, and no deploys.
9. Copy the guarded command and pause on the copy confirmation; do not execute it during the standard demo.
10. Close: review the local files, deploy intentionally, then re-check what the live site serves.

## Cleanup

1. Stop the GUI with `Ctrl-C` in its terminal.
2. Confirm no server remains on port `4317`.
3. Confirm `POST /api/fix` was not introduced and returns `404` while the server is running.
4. Confirm the GUI still calls only `POST /api/ui-report` for report generation.
5. Optionally verify the target app is unchanged:

```bash
git -C /Users/fabiencampana/Documents/fodmapp status --short -- apps/marketing
test ! -e /Users/fabiencampana/Documents/fodmapp/apps/marketing/app/robots.ts
test ! -e /Users/fabiencampana/Documents/fodmapp/apps/marketing/app/sitemap.ts
```

The standard demo must leave the target repo unchanged.
