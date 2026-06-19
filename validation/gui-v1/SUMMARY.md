# ShipReady GUI V1 Validation

Generated: 2026-06-16

## Commands

- `pnpm test` passed: 13 files, 138 tests.
- `pnpm typecheck` passed.
- `pnpm build` passed.
- `pnpm shipready gui --port 4317` started at `http://127.0.0.1:4317`.

## Smoke Results

- `GET /` returned HTTP 200 and was saved to `homepage.html`.
- `POST /api/ui-report` URL-only for `https://imageforge.dev` returned HTTP 200, `ok: true`, mode `url_only`, readiness `ready`.
- `POST /api/ui-report` for `https://imageforge.dev` + `/Users/fabiencampana/Documents/imageforge-site` returned HTTP 200, `ok: true`, mode `url_and_repo`, readiness `ready`.
- `POST /api/ui-report` for `https://fodmapp.fr` + `/Users/fabiencampana/Documents/fodmapp/apps/marketing` returned HTTP 200, `ok: true`, mode `url_and_repo`, readiness `needs_attention`.
- `POST /api/ui-report` for `https://mon-guide-fodmap.com` + `/Users/fabiencampana/Documents/jade/mon-guide-fodmap-2` returned HTTP 200, `ok: true`, mode `url_and_repo`, readiness `needs_attention`.

All optional local repo paths existed and were included.

## Browser Pass

- In-app browser opened `http://127.0.0.1:4317/`.
- URL-only flow submitted `https://imageforge.dev` and rendered the report.
- Rendered report included decision panel, readiness, preview cards, fix plan, patch preview, safe apply, and developer details.
- Developer details remained collapsed.
- Browser console had no warnings or errors during the checked flow.
- Mobile viewport check at 390px wide had no horizontal overflow.

## Artifacts

- `homepage.html`
- `imageforge-url-only.api.json`
- `imageforge-site.api.json`
- `fodmapp-marketing.api.json`
- `mon-guide-fodmap.api.json`
- `SUMMARY.md`

## Notes

- The GUI does not execute safe apply. It only displays the `pnpm shipready fix ... --write --allow-create` command when eligible.
- The GUI/API added no write endpoint and no file browsing.
- The local API calls the existing internal `createUiReport` path and does not broaden engine or write behavior.
