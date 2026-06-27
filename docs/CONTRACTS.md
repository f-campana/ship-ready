# CLI JSON Contracts

The CLI is the source of truth. Future MCP tools should invoke or faithfully wrap these named CLI boundaries rather than exposing internal helper return values.

## Hardening decision

This pass chose **Path A: small runtime hardening**.

Every successful `--json` formatter now adds one additive top-level `contract` discriminator while retaining the previous result shape. JSON errors now add `contract`, `code`, and `message` while retaining the previous `ok: false` and `error` string. Success results were not forced into a generic `{ ok, data }` envelope. Internal audit, planning, fix, UI, HTML, and GUI API models remain unchanged.

This was low risk because CLI JSON formatting already had a dedicated Zod-validated boundary, consumers use named result fields, and an additive discriminator does not rename or nest existing data. It also avoids making the GUI or static renderer depend on a CLI-only envelope.

## Command-to-contract map

| CLI surface | `--json` | Named contract | Stability | Read/write |
|---|---:|---|---|---|
| `status --json` | Yes | `shipready.status.v1` | V1 CLI boundary | Static/local read only |
| `doctor --json` | Yes | `shipready.doctor.v1` | V1 CLI boundary | Bounded local read only |
| `audit <url> --json` | Yes | `shipready.audit.v1` | V1 CLI boundary | Network read only |
| `inspect-repo <path> --json` | Yes | `shipready.repoInspection.v1` | V1 CLI boundary | Local read only |
| `plan-fixes <path> --url <url> --json` | Yes | `shipready.fixPlan.v1` | V1 CLI boundary | Network/local read only |
| `fix <path> --url <url> --dry-run --json` | Yes | `shipready.dryRunFix.v1` | V1 CLI boundary | Network/local read only |
| `fix <path> --url <url> --write --allow-create --json` | Yes | `shipready.writeFix.v1` | V1 CLI boundary, policy-bound mutation | Creation-only crawl-file write |
| `ui-report [path] --url <url> --json` | Yes | `shipready.uiReport.v1` | V1 CLI boundary plus `ui-report-v1` model | Network/optional local read only |
| JSON command failure | When the invoked command accepted `--json` | `shipready.error.v1` | V1 error boundary; Commander parse gaps remain | No additional effects |

The authoritative mapping and CLI contract schemas are in `src/types/contracts.ts`.

## Exact success shapes

All outputs are one JSON object followed by a newline and do not use a generic success envelope. `shipready.doctor.v1` has an `ok` readiness boolean because failed local checks are part of its valid report model; that field is not a data wrapper.

### `shipready.status.v1`

Top-level keys: `contract`, `version`, `mode`, `capabilities`, `writePolicy`, `integrations`, `demos`, `nextRecommendedCommand`, and `nextRecommendedPass`.

Stable posture fields report `cliFirst: true`, `mcpSecond: true`, `guiThird: true`, local stdio MCP with `remoteTransport: false`, exactly one MCP write tool (`shipready.write_safe_crawl_files`), and a local GUI with `writeEndpoint: false`. Search Console, DNS, GitHub, and deployment are explicitly `not_implemented`. `writePolicy.id` remains `creation_only_robots_sitemap_v1`; this report does not redefine policy semantics.

Internal source and formatter: `src/status/status.ts`. Exit behavior: `0`. The command is static/read-only, makes no network request, and does not inspect a target repository.

### `shipready.doctor.v1`

Top-level keys: `contract`, `ok`, `checks`, and `summary`. Every check has `id`, `label`, `status`, and `message`, with optional machine-readable `details`. Status is one of `pass`, `warn`, `fail`, or `skip`. Summary counts must exactly match checks, and `ok` is true exactly when `fail` is zero.

Internal source and formatter: `src/doctor/doctor.ts`. Exit behavior: `0` with no failed required check and `1` otherwise; both paths emit the valid report. Runtime version and optional-tool results are machine-specific. The fixture is therefore a normalized deterministic example, while runtime tests use targeted assertions.

### `shipready.audit.v1`

Top-level keys: `url`, `finalUrl`, `auditedAt`, optional `httpStatus`, `score`, `status`, `raw`, `rendered`, `comparison`, `checks`, `resources`, and `contract`.

Internal source: `AuditResultSchema` / `AuditResult` in `src/types/audit.ts`. CLI formatter: `src/report/formatJsonReport.ts`.

Exit behavior: `0` after an emitted audit result, including `needs_work` or `critical`; `1` for invalid URL/timeout input; `2` for operational audit failure.

Consumers: fix planning, UI normalization, human/JSON reports, validation fixtures.

### `shipready.repoInspection.v1`

Top-level keys: `path`, `inspectedAt`, `packageManager`, `framework`, `importantFiles`, `routes`, `metadataLocations`, `supportedFixes`, `limitations`, `warnings`, and `contract`.

Internal source: `RepoInspectionResultSchema` / `RepoInspectionResult` in `src/types/repoInspection.ts`. CLI formatter: `src/report/formatRepoInspectionJsonReport.ts`.

Exit behavior: `0` after an emitted inspection, including unknown frameworks; `1` for an invalid repository path; `2` for an unexpected inspection failure.

Consumers: fix planning, UI normalization, reports, tests, validation fixtures.

### `shipready.fixPlan.v1`

Top-level keys: `url`, `repoPath`, `plannedAt`, `auditSummary`, `repoSummary`, `actions`, `noActionChecks`, `optionalNotes`, `limitations`, `recommendedNextStep`, and `contract`.

Internal source: `FixPlanResultSchema` / `FixPlanResult` in `src/types/fixPlan.ts`. CLI formatter: `src/report/formatFixPlanJsonReport.ts`.

Exit behavior: `0` after an emitted plan, including manual-review or unsupported-project recommendations; `1` for invalid URL/path/timeout input; `2` for an operational failure.

Consumers: dry-run generation, UI normalization, reports, tests, validation fixtures.

### `shipready.dryRunFix.v1`

Top-level keys: `url`, `repoPath`, `generatedAt`, `mode`, `wroteFiles`, `planSummary`, `fileChanges`, `skippedActions`, `safetyNotes`, `recommendedNextStep`, and `contract`.

Stable discriminators are `mode: "dry_run"` and `wroteFiles: false`. `fileChanges[].reviewStatus` distinguishes `auto_candidate` from `review_required`; `skippedActions[]` records non-previewed actions separately.

Internal source: `DryRunFixResultSchema` / `DryRunFixResult` in `src/types/dryRunFix.ts`. CLI formatter: `src/report/formatDryRunFixJsonReport.ts`.

Exit behavior: `0` after an emitted dry-run result; `1` for a missing/conflicting mode or invalid URL/path/timeout input; `2` for an operational failure.

Consumers: UI patch and safe-apply summaries, reports, tests, validation fixtures.

### `shipready.writeFix.v1`

Top-level keys: `url`, `repoPath`, `generatedAt`, `mode`, `wroteFiles`, `policy`, `createdFiles`, `skippedActions`, `blockedChanges`, `safetyChecks`, optional `rollback`, `recommendedNextStep`, and `contract`.

Stable discriminators are `mode: "write"` and `policy: "creation_only_robots_sitemap_v1"`. Effects remain explicit: `createdFiles` are written, `skippedActions` are not previewed/written, and `blockedChanges` are reported but not written. `wroteFiles` is true only when at least one eligible file was created.

Internal source: `WriteFixResultSchema` / `WriteFixResult` / `WRITE_POLICY_V1` in `src/types/writeFix.ts`. CLI formatter: `src/report/formatWriteFixJsonReport.ts`. Mutation rules remain canonical in `docs/WRITE_POLICY_V1.md`.

Exit behavior: `0` for an emitted write result, including a successful no-op; `1` for invalid modes/input or write validation failure; `2` for operational/write execution failure. Write validation/execution errors include a nested `result` with its own `shipready.writeFix.v1` discriminator.

Consumers: reports, tests, creation-only safety validation fixtures. The GUI does not execute this command.

### `shipready.uiReport.v1`

Top-level keys: `schemaVersion`, `generatedAt`, `input`, `workflow`, `readiness`, `previews`, optional `project`, optional `actionGroups`, optional `patchPreview`, optional `safeApply`, `liveVsLocal`, `errors`, `developerDetails`, and `contract`.

Both discriminators are stable: `contract: "shipready.uiReport.v1"` identifies the CLI boundary and `schemaVersion: "ui-report-v1"` identifies the UI model.

Internal source: `UiReportSchema` / `UiReport` in `src/types/uiReport.ts`; normalization in `src/report/createUiReport.ts`; CLI formatter in `src/report/formatUiReportJsonReport.ts`.

Exit behavior: `0` when `errors` is empty; `1` when a valid UI report is emitted with one or more normalized stage errors. Invalid timeout input emits `shipready.error.v1` and exits `1`; an unexpected top-level failure exits `1` or `2` according to the common command classifier.

Consumers: CLI users, the normalized model used by the local GUI and static HTML renderer, tests, demos, validation fixtures.

## Error contract

`shipready.error.v1` has required keys:

```json
{
  "contract": "shipready.error.v1",
  "ok": false,
  "code": "invalid_url",
  "message": "Invalid URL. Provide an absolute http:// or https:// URL.",
  "error": "Invalid URL. Provide an absolute http:// or https:// URL."
}
```

`error` is a compatibility alias for existing consumers and equals `message`. Stable codes are `invalid_url`, `invalid_timeout`, `invalid_repo_path`, `invalid_mode`, `write_validation_failed`, `write_execution_failed`, and `command_failed`. A write validation/execution error may also contain `result: shipready.writeFix.v1`.

Known gap: errors raised by Commander before a command action runs, such as missing required arguments or an unknown option, still use Commander's stderr text and are not guaranteed to emit `shipready.error.v1`. Exit `5` remains reserved for an uncaught `parseAsync` failure and is also plain stderr.

## Non-CLI surfaces

`html-report` has no `--json` option and exposes no JSON contract. It is a file surface: it writes one explicitly named, self-contained HTML file derived from `ui-report-v1`, then prints the resolved path. Its source is `src/report/renderHtmlReport.ts` and `src/report/writeHtmlReport.ts`.

`gui` has no `--json` option. The command starts a local HTTP server and prints its URL. The server has a machine-readable local endpoint, `POST /api/ui-report`, whose success shape is `{ "ok": true, "report": UiReport }` and whose API/parse errors use `{ "ok": false, "error": { ... } }`. This is a GUI server surface, not one of the named CLI JSON contracts. The report inside that envelope retains `schemaVersion: "ui-report-v1"`; the GUI API does not add the CLI-only `contract` field. `POST /api/fix` is absent and returns `404`.

Sources: `src/gui/guiApi.ts`, `src/gui/startGuiServer.ts`, and `src/gui/guiClient.ts`. The client fetches only `/api/ui-report`.

## Compatibility policy

- A V1 `contract` value, existing required top-level key, discriminator, or field meaning must not be removed, renamed, or repurposed without a new contract version.
- New optional fields may be additive within V1 after downstream-consumer review and fixture/test updates.
- Enum additions require explicit compatibility review because exhaustive clients may treat them as breaking.
- Timestamps, paths, check/action lists, evidence, recommendations, scores, and generated file hashes are data, not golden constants.
- Human output is intentionally separate and is not covered by these JSON contracts.
- Diagnostics for JSON commands must not be mixed into stdout JSON.
- Write eligibility and effects are not contract-format decisions; they remain governed by `docs/WRITE_POLICY_V1.md`.

## Contract fixtures and provenance

Deterministic fixtures live in `validation/contracts/`:

- `audit.clean.json`
- `audit.needs-work.json`
- `inspect-repo.next-app.json`
- `inspect-repo.vite.json`
- `plan-fixes.safe-apply.json`
- `plan-fixes.review-required.json`
- `fix-dry-run.safe-apply.json`
- `fix-dry-run.review-required.json`
- `fix-dry-run.skipped.json`
- `fix-write.safe-create.json`
- `fix-write.blocked.json`
- `fix-write.skipped.json`
- `ui-report.safe-apply.json`
- `ui-report.url-only.json`
- `error.invalid-url.json`
- `status.default.json`
- `doctor.default.json`

Regenerate them from local test repositories and deterministic in-memory audit results:

```bash
pnpm contracts:fixtures
```

The generator is `scripts/validation/generateContractFixtures.ts`. It makes no external requests. The write fixtures run `writeFixFromDryRun` only against temporary copies under the operating-system temp directory, record the returned results, and remove the copies. They never target a real repository. Fixed timestamps and repository display paths keep fixtures reproducible.

Focused drift coverage is in `tests/contracts.test.ts`, `tests/status.test.ts`, and `tests/doctor.test.ts`. Tests validate every fixture, every formatter discriminator, status/doctor posture and summaries, error code/message compatibility, UI report dual discriminators, dry-run state separation, write effect fields, the command mapping, and an invalid-URL CLI exit.

## Downstream consumers

- Planning: audit plus repo inspection feed `planFixesFromResults`.
- Preview/write: fix plans feed dry-run generation; write mode regenerates and validates dry-run candidates.
- UI normalization: internal results feed `createUiReport`; it does not parse CLI JSON.
- Static HTML: renders the internal `UiReport` model.
- GUI: serves the internal `UiReport` model through a local API; it does not execute write mode.
- Demo tooling: drives the GUI server surface and captures report artifacts.
- MCP: wraps the named CLI contracts through the existing application functions and JSON formatters; it does not expose ad-hoc internal models.

## MCP mapping

The implemented Pass 6 specification is [MCP_PLAN.md](MCP_PLAN.md). Six contract-backed tools preserve their top-level CLI contract objects; two canonical-read tools expose validated fixtures and allowlisted documents. `shipready.write_safe_crawl_files` returns `shipready.writeFix.v1` and is the only MCP write tool.

`shipready.preview_fixes` still returns `shipready.dryRunFix.v1`; when current V1-eligible crawl-file creations exist, the MCP layer adds an agent-facing `previewReceipt` to the tool payload. The receipt is not a CLI contract field and is not write authority by itself. It is a signed, short-lived MCP precondition binding the normalized URL, authorized canonical repository path, policy, eligible paths, and stable dry-run/candidate digests.

The MCP write call must supply the same URL and repo path, the fresh receipt, and `confirmation: "CREATE_SAFE_CRAWL_FILES_ONLY"`. The server re-authorizes and recomputes current candidates before writing, then validates and serializes the existing write result through `WriteFixJsonContractSchema`.

Ready now:

- Eight implemented JSON-capable command surfaces have explicit V1 contract names.
- Success outputs retain their existing fields and add stable discriminators.
- Action-level JSON errors have stable codes/messages and preserve the legacy `error` field.
- Deterministic local fixtures and focused drift tests cover success, failure, dry-run, write, and UI states.
- Creation-only write evidence remains explicit and policy-bound.
- Human CLI, HTML file, and GUI server surfaces are clearly separated from CLI JSON contracts.

The compatible `shipready.error.v1` enum now also covers MCP boundary codes: `path_not_authorized`, `fixture_not_found`, `doc_not_found`, `network_error`, `render_error`, `timeout`, `cancelled`, `contract_error`, `write_forbidden`, `unsupported_command`, and `internal_error`. Optional `retryable` and safe `details` fields are additive; `error === message` remains required.

No other MCP write tool is registered. The GUI remains preview/copy-only, and `POST /api/fix` remains absent.
