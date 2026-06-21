# Contract Map

**MCP should wrap stable CLI contracts, not internal ad-hoc behavior.** Today, JSON outputs are Zod-validated and used by reports, GUI, demos, tests, and validation fixtures. Only `ui-report-v1` has an explicit schema version; the other results need hardening before they become MCP contracts.

| Contract | Source type/schema | CLI JSON exposure | Current consumers | Readiness |
|---|---|---|---|---|
| Audit result | `AuditResultSchema`, `AuditResult` in `src/types/audit.ts` | `audit <url> --json` | fix planning, UI normalization, human/JSON reports, fixtures | Proven current output; unversioned, harden before MCP |
| Repo inspection result | `RepoInspectionResultSchema`, `RepoInspectionResult` in `src/types/repoInspection.ts` | `inspect-repo <path> --json` | fix planning, UI normalization, reports, fixtures | Proven current output; unversioned, harden before MCP |
| Fix plan result | `FixPlanResultSchema`, `FixPlanResult` in `src/types/fixPlan.ts` | `plan-fixes <path> --url <url> --json` | dry-run generation, UI normalization, reports, fixtures | Proven current output; unversioned, harden before MCP |
| Dry-run result | `DryRunFixResultSchema`, `DryRunFixResult` in `src/types/dryRunFix.ts` | `fix <path> --url <url> --dry-run --json` | UI patch/safe-apply summaries, reports, fixtures | Stable enough for current GUI/demo use; unversioned, harden before MCP |
| Write result | `WriteFixResultSchema`, `WriteFixResult`, `WRITE_POLICY_V1` in `src/types/writeFix.ts` | `fix <path> --url <url> --write --allow-create --json` | human/JSON reports, safety validation fixtures | Policy-bound and tested; mutation/error semantics require MCP hardening |
| UI report V1 | `UiReportSchema`, `UiReport` in `src/types/uiReport.ts` | `ui-report [path] --url <url> --json` | local GUI API, static HTML renderer, demo, contract fixtures | Explicit `schemaVersion: "ui-report-v1"`; stable enough for GUI/demo use, not yet an MCP guarantee |

## Important shapes

### Audit result

Top-level fields: `url`, `finalUrl`, `auditedAt`, optional `httpStatus`, `score`, `status`, `raw`, `rendered`, `comparison`, `checks`, and `resources`. Checks include category, severity, evidence, confidence, and fixability. No `schemaVersion` or success envelope exists.

### Repo inspection result

Top-level fields: `path`, `inspectedAt`, `packageManager`, `framework`, `importantFiles`, `routes`, `metadataLocations`, `supportedFixes`, `limitations`, and `warnings`. Results are convention-based and bounded, not a full semantic model.

### Fix plan result

Top-level fields: `url`, `repoPath`, `plannedAt`, audit/repo summaries, `actions`, `noActionChecks`, `optionalNotes`, `limitations`, and `recommendedNextStep`. Actions carry category, priority, risk, confidence, target locations, and future-automation guidance.

### Dry-run result

Discriminators are `mode: "dry_run"` and `wroteFiles: false`. `fileChanges` includes `path`, create/update type, risk, review status, before/after content, and diff. `skippedActions`, `safetyNotes`, and the next step remain part of the result.

### Write result

Discriminator is `mode: "write"`; policy is `creation_only_robots_sitemap_v1`. The result records `wroteFiles`, created-file hashes/byte counts, skipped and blocked changes, safety checks, optional rollback, and next step. JSON validation or execution failures use `{ ok: false, error, result }`; other CLI errors use `{ ok: false, error }`.

### `ui-report-v1`

Top-level fields are `schemaVersion`, generation/input/workflow data, readiness, previews, optional project/action/patch/safe-apply sections, live-vs-local state, errors, and developer details. It normalizes lower-level results for screens. The GUI API wraps successful reports as `{ ok: true, report }` and errors as `{ ok: false, error }`.

## Report and consumer paths

- JSON formatters: `src/report/format*JsonReport.ts`.
- Human formatters: `src/report/format*HumanReport.ts` and `src/report/formatHumanReport.ts`.
- UI normalization: `src/ui/createUiReport.ts`.
- Static HTML: `src/report/renderHtmlReport.ts`, `src/report/writeHtmlReport.ts`.
- Local GUI API: `src/gui/guiApi.ts`, served by `src/gui/startGuiServer.ts`.
- Contract evidence: `validation/ui-report-v1-contract/`, `validation/next-real-dry-run/`, `validation/write-v1/`, and other command-specific validation directories.

## Required hardening before MCP

1. Add explicit versions or a versioned envelope for every exposed result.
2. Define stable error codes, exit-code mapping, and success/error envelopes.
3. Specify compatibility rules for optional fields, enum additions, and removals.
4. Separate machine output from progress and diagnostics.
5. Add CLI-level golden contract tests for success and failure modes.
6. Define timeouts, cancellation, path normalization, and secret-redaction rules.
7. Keep mutation authorization and write-policy evidence explicit in write responses.

Do not expose internal helper return values directly through MCP. Harden the CLI boundary first, then wrap it.
