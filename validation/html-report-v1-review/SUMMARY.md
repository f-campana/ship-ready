# HTML Report V1 Manual Visual Review

Generated and reviewed on 2026-06-16.

## Reports Reviewed

| File | Flow | Readiness | Safe apply | Review result |
| --- | --- | --- | --- | --- |
| `imageforge-shipready-repo.html` | URL + repo | Ready to ship | Not available | Pass |
| `imageforge-site.html` | URL + repo | Ready to ship | Not available | Pass |
| `fodmapp-marketing.html` | URL + repo | Needs attention before launch | Available | Pass after refinements |
| `mon-guide-fodmap.html` | URL + repo | Needs attention before launch | Not available | Pass after refinements |
| `imageforge-url-only.html` | URL only | Ready to ship | Not available | Pass after refinements |

All five requested reports were regenerated under `validation/html-report-v1-review/`.

## Visual And Copy Issues Found

- Desktop hero metadata used equal-width columns, which made long repository paths wrap awkwardly.
- On narrow viewports, the repo metadata grid override prevented clean one-column stacking and could clip long paths.
- The fix plan expanded every `Already good` item as a full card, which made clean reports and needs-attention reports feel longer than necessary.
- Patch diffs were fully expanded by default, making developer details compete with founder-facing action guidance.
- URL-only safe-apply copy said there were no safe automatic changes, but did not clearly explain that no local files were inspected.
- The safe-apply CLI command was horizontally scrollable on narrow screens.

## Refinements Made

- Gave hero metadata explicit repo-aware and URL-only grid layouts, plus mobile/tablet overrides.
- Collapsed `Already good` and `Optional polish` fix-plan groups behind native `<details>` summaries with item counts.
- Moved patch diffs behind native `View diff` disclosures while keeping file path, risk, and review status visible.
- Added explicit URL-only safe-apply copy: no local project folder was inspected, so there are no local files to apply.
- Wrapped the safe-apply command on narrow screens.
- Added renderer tests for URL-only apply copy, collapsed quiet groups, and diff disclosures.

## Manual Review Findings

- First impression: the reports now clearly show the audited URL, readiness state, score, mode, and repo context where relevant.
- Clean reports: calm and credible; no scary warnings; URL-only does not imply local writes are possible.
- Needs-attention reports: top issues are understandable; missing JSON-LD and crawl-file issues read as actionable, not catastrophic.
- Preview cards: Google, social, X/Twitter, and raw-vs-rendered summaries are understandable and do not invent missing values.
- Project understanding: framework detection and confidence labels are clear; unknown repo handling is calm.
- Fix plan: safe, review, manual, already-good, and optional groups are separated; low-priority groups no longer dominate.
- Patch preview: file changes are easier to scan; diffs remain available but do not dominate the report.
- Safe apply: FODMAPP clearly states the eligible files, exact command, and that the report itself does not apply changes.
- Local vs live: repo-backed reports explain deployment is required; URL-only report avoids local deployment warnings.
- Developer details: raw JSON remains available behind collapsed native `<details>`.

## Remaining Concerns

- Project understanding can still feel dense on mobile when many important files and limitations are listed.
- Raw JSON keeps files around 141-211 KB. This is acceptable for V1 because it is collapsed, but the future GUI should expose debug payloads more selectively.

## Validation

- `pnpm test`: passed, 12 files / 116 tests.
- `pnpm typecheck`: passed.
- `pnpm build`: passed.
- Static scan: no emitted `<script>` tags found in regenerated HTML reports.
- Browser review: completed through local `127.0.0.1` static serving because direct `file://` browser navigation was blocked by browser policy.

## Recommendation

The static HTML report is ready as ShipReady's first visual product surface.

Recommended next task:

```txt
Build a minimal local-first interactive GUI prototype that consumes ui-report-v1.
```
