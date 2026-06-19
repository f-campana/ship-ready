# ShipReady Fodmapp Demo

This demo shows ShipReady checking a generated, local-first website for launch-readiness. The live site looks usable, but the check reveals missing crawler-facing files and connects those gaps to safe, creation-only changes in the local project.

## Scenario

URL: `https://fodmapp.fr`

Repo: `/Users/fabiencampana/Documents/fodmapp/apps/marketing`

ShipReady reports that the site needs attention before launch and finds two safe crawl-file creations:

- `app/robots.ts`
- `app/sitemap.ts`

The GUI previews these files and displays the guarded CLI command. It does not execute the command or write files.

## Run

```bash
pnpm shipready gui --port 4317
```

Open `http://127.0.0.1:4317`, enter the URL and repo above, then click **Check site**.

## Expected result

- Decision: **Needs attention before launch**
- Project: **Next.js App Router**, good match
- Safe apply: available for `app/robots.ts` and `app/sitemap.ts`
- Guarded command:

  ```bash
  pnpm shipready fix /Users/fabiencampana/Documents/fodmapp/apps/marketing --url https://fodmapp.fr/ --write --allow-create
  ```

## Demo beats

1. Enter the URL and repo path.
2. Click **Check site**.
3. Show the launch-readiness decision and crawler/preview-bot view.
4. Show Next.js project detection.
5. Show the two safe crawl-file previews.
6. Show the guarded CLI command and copy it.
7. Emphasize: preview first, no overwrites, no metadata or content edits, no Git commits, and no deploys.
8. Show the local-versus-live warning.

## Important

ShipReady does not promise rankings or guaranteed indexing. It identifies launch-readiness gaps and narrowly scoped safe crawl-file creations.

The GUI does not write files in this demo. The user must run the guarded CLI command separately, review the created files, and deploy the project before the live website changes.
