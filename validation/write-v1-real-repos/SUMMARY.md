# ShipReady V1 Write Mode Validation: Copied Real Repos

Date: 2026-06-15

## Question Answered

Yes. On the copied real repo structures validated here, `--write --allow-create` safely created only eligible missing robots/sitemap files and left everything else untouched.

- Clean Next.js repo: wrote nothing.
- Next.js App Router repo with eligible missing robots/sitemap routes: created exactly `app/robots.ts` and `app/sitemap.ts`.
- Vite React repo with review-required sitemap and metadata changes: wrote nothing and reported blocked changes.

No metadata/content/package/config/lockfile files were edited. No existing files were overwritten. No source repos were targeted.

## Standard Checks

Initial checks before validation:

- `pnpm test`: passed, 10 files / 86 tests.
- `pnpm typecheck`: passed.
- `pnpm build`: passed.

Final checks after validation artifacts:

- `pnpm test`: passed, 10 files / 86 tests.
- `pnpm typecheck`: passed.
- `pnpm build`: passed.

## Copy Strategy

Copied repos into `validation/write-v1-real-repos/tmp/`.

Excluded directories:

- `node_modules`
- `.next`
- `dist`
- `build`
- `.vercel`
- `.turbo`
- `.cache`
- `.git`

Copy command used `rsync -a --safe-links`; copied symlink count was 0.

Manifest-based verification was used instead of Git diff. Source and copy manifests are saved as `*.sha256`, with parsed deltas in `*.delta.json` and `*.source-delta.json`.

The temporary copies were removed after the command outputs and manifests were captured. This prevents the parent repo's `pnpm test` from discovering copied repo test files under `validation/`.

## Repos Validated

### imageforge-site

- Source: `/Users/fabiencampana/Documents/imageforge-site`
- Copy: `validation/write-v1-real-repos/tmp/imageforge-site`
- URL: `https://imageforge.dev`
- Detected framework: Next.js App Router, high confidence.

Result:

- Human write command exited 0.
- JSON write command exited 0.
- `wroteFiles`: false.
- Created files: none.
- Blocked changes: none.
- Skipped actions: none.
- Copy delta: 0 created, 0 modified, 0 deleted.
- Source delta: 0 created, 0 modified, 0 deleted.
- Dry-run after write: 0 changes.

Conclusion: already clean; write mode made no changes.

### fodmapp-marketing

- Source: `/Users/fabiencampana/Documents/fodmapp/apps/marketing`
- Copy: `validation/write-v1-real-repos/tmp/fodmapp-marketing`
- URL: `https://fodmapp.fr`
- Detected framework: Next.js App Router, high confidence.

Pre-write dry-run proposed two automation candidates:

- `app/robots.ts`
- `app/sitemap.ts`

Human write result:

- Human write command exited 0.
- Files actually changed: 2.
- Blocked changes: none.
- Policy: `creation_only_robots_sitemap_v1`.

Created files:

- `app/robots.ts`: 226 bytes, SHA-256 `67bc0ae0b62e438ea9a738dbc1ec98ffe3f62b786ffed83e3d45a320f6a01514`
- `app/sitemap.ts`: 220 bytes, SHA-256 `be94df2d42ac33697661795d00e2f2524bbe7297eed8d48507c1430018e96d82`

Skipped non-write actions:

- Metadata review was skipped because existing metadata export merging is outside the current safe write path.
- JSON-LD was skipped because it requires reviewed structured-data details.

Idempotency:

- The following JSON write command ran after the human write and exited 0.
- It wrote no files and reported existing `app/robots.ts` and `app/sitemap.ts` as skipped for manual review rather than overwriting them.
- Dry-run after write proposed 0 creates and 0 updates.

Filesystem verification:

- Copy delta: 2 created, 0 modified, 0 deleted.
- Created paths match exactly the two expected App Router metadata route files.
- Source delta: 0 created, 0 modified, 0 deleted.

Conclusion: write mode created only eligible missing robots/sitemap files and did not touch metadata, content, package, config, or lockfiles.

### mon-guide-fodmap-2

- Source: `/Users/fabiencampana/Documents/jade/mon-guide-fodmap-2`
- Copy: `validation/write-v1-real-repos/tmp/mon-guide-fodmap-2`
- URL: `https://mon-guide-fodmap.com`
- Detected framework: Vite React, high confidence.

Pre-write dry-run proposed:

- Create `public/sitemap.xml`, risk low, review required.
- Update `index.html` with fallback metadata and JSON-LD preview, risk medium, review required.
- Skipped H1/content review.

Write result:

- Human write command exited 1.
- JSON write command exited 1.
- This was an intentional safety block: no files were written because at least one creation candidate failed write safety validation.
- Files actually changed: 0.
- `wroteFiles`: false.
- Policy: `creation_only_robots_sitemap_v1`.

Blocked changes:

- `index.html`: blocked because HTML, metadata, and config updates are outside V1 write policy.
- `public/sitemap.xml`: blocked because review status was `review_required`, not `auto_candidate`.

Idempotency / after state:

- Dry-run after write still proposes the same review-required changes because write mode intentionally wrote nothing.
- No duplicate files were created.
- No existing files were overwritten.

Filesystem verification:

- Copy delta: 0 created, 0 modified, 0 deleted.
- Source delta: 0 created, 0 modified, 0 deleted.

Conclusion: Vite metadata/content remained untouched. The sitemap was not created because it was not eligible for automatic write.

## Skipped Repos

None. All suggested source paths existed.

## Source Repo Safety

No real source repo was modified. Source manifest deltas:

- `imageforge-site`: 0 created, 0 modified, 0 deleted.
- `fodmapp-marketing`: 0 created, 0 modified, 0 deleted.
- `mon-guide-fodmap-2`: 0 created, 0 modified, 0 deleted.

Write commands targeted only paths under `validation/write-v1-real-repos/tmp/`.

## Artifact Inventory

Per repo artifacts saved under `validation/write-v1-real-repos/`:

- `*.inspect.txt`
- `*.inspect.json`
- `*.plan.txt`
- `*.plan.json`
- `*.dry-run-before.txt`
- `*.dry-run-before.json`
- `*.write.txt`
- `*.write.json`
- `*.dry-run-after.txt`
- `*.dry-run-after.json`
- `*.before.sha256`
- `*.after.sha256`
- `*.delta.json`
- `*.source-before.sha256`
- `*.source-after.sha256`
- `*.source-delta.json`

Additional artifact:

- `copied-symlinks.txt`

## Implementation Changes

None.

## Recommendation

Proceed with a design task before broadening write behavior. The strongest next task is the local-first GUI product spec, followed by Git worktree warning before writes and post-write re-audit guidance.
