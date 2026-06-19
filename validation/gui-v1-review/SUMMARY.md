# ShipReady GUI V1 Review Summary

Date: 2026-06-16

## Global status

Pass with small refinements. The local-first GUI is understandable enough for broader manual testing:

- Non-technical and semi-technical users can run URL-only and URL-plus-folder checks without knowing the CLI.
- Technical users can see the safety boundary: the GUI previews and copies a CLI command, but does not write files.
- The static report hierarchy is preserved: readiness first, score secondary, previews/project/fix plan/patch/safe apply below.
- Local-vs-live behavior is explicit in repo-backed flows.

## Flows reviewed

1. URL-only clean site: `https://imageforge.dev`
   - Result: ready.
   - No local project section rendered.
   - Safe apply now says no local files were inspected and that the GUI did not change files.

2. Clean Next.js repo: `https://imageforge.dev` + `/Users/fabiencampana/Documents/imageforge-site`
   - Result: ready.
   - Project detected as Next.js App Router with good match.
   - No safe apply needed.
   - Empty fix-plan groups are collapsed after refinement.

3. Safe apply available: `https://fodmapp.fr` + `/Users/fabiencampana/Documents/fodmapp/apps/marketing`
   - Result: needs attention.
   - Safe apply available for exactly:
     - `app/robots.ts`
     - `app/sitemap.ts`
   - GUI shows and copies:
     `pnpm shipready fix /Users/fabiencampana/Documents/fodmapp/apps/marketing --url https://fodmapp.fr/ --write --allow-create`
   - Trust notes visible: no overwrites, no metadata/content edits, no Git commits, no deploys.
   - Local-vs-live warning visible.

4. Review-required, no safe apply: `https://mon-guide-fodmap.com` + `/Users/fabiencampana/Documents/jade/mon-guide-fodmap-2`
   - Result: needs attention.
   - Project detected as Vite React with good match.
   - `index.html` metadata is review-required, not silently blocked.
   - `public/sitemap.xml` explains that review-required dry-run changes are not writable.
   - Manual/review work reads as guarded review work, not a system failure.

5. Invalid URL: `not-a-url`
   - Result: friendly in-app error after refinement.
   - No crash.
   - Developer details stay collapsed or absent.

6. Invalid repo path: `/path/that/does/not/exist`
   - Result: structured repo-inspection error.
   - No crash.
   - User can rerun URL-only or choose a valid folder.

## Issues found and refinements made

- Native `type=url` browser validation blocked the app's friendly invalid-URL error panel.
  - Changed the URL input to `type="text" inputmode="url"` and added `novalidate`.
  - Added client-side HTTP(S) URL validation with a calm error message.

- URL-only safe-apply copy could imply local files were evaluated.
  - Changed URL-only safe-apply section to "No local files inspected".
  - Added explicit copy that the GUI did not change files and safe apply remains a separate command after repo-based dry run.

- Clean repo fix plans showed open empty groups.
  - Changed Safe to apply / Needs review / Manual only groups to collapse when empty and open when non-empty.

No engine behavior, write behavior, Git behavior, deploy behavior, auth, billing, frontend framework, metadata/content writes, JSON-LD/package/config writes, or write endpoint were added.

## Validation artifacts

- Homepage HTML: `validation/gui-v1-review/homepage.html`
- Browser state: `validation/gui-v1-review/browser-results.final.json`
- Mobile state: `validation/gui-v1-review/browser-results.mobile.json`
- API responses:
  - `validation/gui-v1-review/case1-imageforge-url-only.api.json`
  - `validation/gui-v1-review/case2-imageforge-site.api.json`
  - `validation/gui-v1-review/case3-fodmapp-marketing.api.json`
  - `validation/gui-v1-review/case4-mon-guide-fodmap.api.json`
  - `validation/gui-v1-review/case5-invalid-url.api.json`
  - `validation/gui-v1-review/case6-invalid-repo-path.api.json`
- Screenshots:
  - `validation/gui-v1-review/screenshots/case1-url-only-ready.viewport.png`
  - `validation/gui-v1-review/screenshots/case3-fodmapp-safe-apply.command-viewport.png`
  - `validation/gui-v1-review/screenshots/case4-mon-guide-review-required.viewport-top.png`
  - `validation/gui-v1-review/screenshots/mobile-case3-fodmapp-safe-apply-390.viewport-top.png`
  - `validation/gui-v1-review/screenshots/mobile-case3-fodmapp-safe-apply-390.command-viewport.png`

Note: some full-page browser screenshots stitched repeated top content. The viewport screenshots above are the canonical visual evidence.

## Commands run

- `pnpm shipready gui --port 4317`
- Browser-driven manual flows for all six cases
- API artifact capture through `POST /api/ui-report`
- `POST /api/fix` check returned 404
- `pnpm test -- tests/guiServer.test.ts`
- `pnpm test`
- `pnpm typecheck`
- `pnpm build`

## Verification status

- `GET /`: 200
- `POST /api/ui-report`: works for success and structured-error cases
- `POST /api/fix`: 404
- Browser console warnings/errors: none in reviewed flows
- Desktop horizontal overflow: none detected
- 390px mobile horizontal overflow: none detected
- Developer details: collapsed by default
- Diffs: collapsed by default
- Copy command: verified in browser clipboard for the safe-apply case
- Server lifecycle: started and stopped cleanly
- `pnpm test`: passed, 13 files / 138 tests
- `pnpm typecheck`: passed
- `pnpm build`: passed

## Known limitations

- The GUI still uses a manually pasted local path rather than a folder picker.
- Safe apply is intentionally display/copy-only.
- The GUI does not prove that the selected local folder is deployed to the audited URL; it only reports local inspection and keeps the local-vs-live warning visible.
- Review-required metadata and content edits remain manual.

## Recommended next task

Prepare a demo scenario using `fodmapp-marketing` as the flagship "safe apply available" case.
