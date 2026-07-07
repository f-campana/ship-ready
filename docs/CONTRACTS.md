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
| `recheck [path] --url <url> --json` | Yes | `shipready.recheck.v1` | V1 post-write follow-up boundary | Network/optional local read only |
| `inspect-repo <path> --json` | Yes | `shipready.repoInspection.v1` | V1 CLI boundary | Local read only |
| `plan-fixes <path> --url <url> --json` | Yes | `shipready.fixPlan.v1` | V1 CLI boundary | Network/local read only |
| `fix <path> --url <url> --dry-run --json` | Yes | `shipready.dryRunFix.v1` | V1 CLI boundary | Network/local read only |
| `fix <path> --url <url> --write --allow-create --json` | Yes | `shipready.writeFix.v1` | V1 CLI boundary, policy-bound mutation | Creation-only crawl-file write |
| `ui-report [path] --url <url> --json` | Yes | `shipready.uiReport.v1` | V1 CLI boundary plus `ui-report-v1` model | Network/optional local read only |
| `search-console status --url <url> --json` | Yes | `shipready.searchConsoleStatus.v1` | V1 mock prototype boundary | Deterministic local read only |
| `dns status --url <url> --json` | Yes | `shipready.dnsStatus.v1` | V1 DNS readiness boundary | Read-only DNS/optional HTTP evidence |
| `social-preview --url <url> --json` | Yes | `shipready.socialPreview.v1` | V1 simulated preview boundary | Network read only or deterministic local mock |
| `smells <path> --json` | Yes | `shipready.generatedSiteSmells.v1` | V1 implementation-smell boundary | Local read only or optional network read with `--url` |
| `crawl --url <url> --json` | Yes | `shipready.crawl.v1` | V1 bounded crawl boundary | Network read only or deterministic local mock |
| JSON command failure | When the invoked command accepted `--json` | `shipready.error.v1` | V1 error boundary; Commander parse gaps remain | No additional effects |

The authoritative mapping and CLI contract schemas are in `src/types/contracts.ts`.

## `shipready.searchConsoleStatus.v1`

Pass 9 implements this contract for `search-console status --json` and the read-only MCP tool `shipready.search_console_status`. The current provider emits only `mode: "mock"`; `mode: "live"` is reserved for a future separately reviewed provider and is never emitted in Pass 9.

Top-level keys are `contract`, `generatedAt`, `mode`, `requestedUrl`, `authorization`, `propertyMatch`, `sitemaps`, `inspection`, `limitations`, and `nextActions`. Authorization, property matching, sitemap records, and optional indexed-version inspection remain separate state machines. Optional Google-shaped fields remain absent when not reported; they are not converted to negative results. The schema excludes tokens, account identity, referring URLs, request headers, verification data, and raw provider payloads.

`propertyMatch.strategy` and property `type` are ShipReady-derived. Documented Google enum fields use the Pass 8 values plus an explicit `UNKNOWN` fallback reserved for a future adapter, so unrecognized future values do not become invented semantics. Sitemap `contents[].indexed` is intentionally rejected because Google deprecated it. Mock inspection exists only when `--inspect` is explicit; it is mock indexed-version evidence, never a live-page test.

Canonical fixtures cover `not_configured`, `unauthorized`, `property_not_found`, `ready_sitemap_ok`, `ready_sitemap_warning`, `inspection_canonical_mismatch`, and `inspection_not_indexed`. All use a fixed timestamp and synthetic `example.com` values. The mock provider makes no network request and has no credential interface.

The MCP tool accepts only `{ url, mock?, inspect? }`, needs no repository path, and returns this exact contract. It does not alter the sole MCP write tool, stdio-only transport, `WRITE_POLICY_V1`, GUI behavior, or `POST /api/fix = 404` boundary.

## `shipready.dnsStatus.v1`

Pass 11 implements this contract for `dns status --json` and the read-only MCP tool `shipready.dns_status`.

Top-level keys are `contract`, `url`, `checkedAt`, `mode`, `domain`, `hosts`, `canonical`, `dnssec`, `caa`, `verification`, `verdict`, `limitations`, and `nextActions`. `mode` is `live` for read-only Node DNS lookups and `mock` for deterministic scenarios. `url` is normalized without query strings or fragments. `domain` is derived conservatively from the URL host; v1 does not use a public suffix list.

Each host records `host`, role (`apex`, `www`, or `other`), redacted record evidence, resolution status (`ok`, `nxdomain`, `nodata`, `timeout`, `error`, or `not_checked`), and optional bounded CNAME-chain evidence. The records object may include A, AAAA, CNAME, redacted TXT, CAA, and NS arrays. TXT verification tokens are matched internally and redacted from output.

`canonical` is `not_checked` unless `--check-http` is used or a deterministic canonical mock scenario supplies evidence. Canonical evidence is HTTP-adjacent, not a DNS failure. `dnssec` is currently `not_checked`. `caa` reports present/not-present/unknown evidence only; it does not claim certificate issuance. `verification.searchConsoleTxt` checks only a caller-supplied expected TXT token and does not verify Search Console ownership.

The verdict is advisory: `ready`, `needs_attention`, `blocked`, or `unknown`. `ready` means the configured v1 checks did not observe a blocking issue; it does not guarantee propagation, certificate issuance, crawling, indexing, ranking, provider changes, or Google/Search Console state.

Canonical fixtures cover `ready`, `apex-ok-www-missing`, `www-cname-ok`, `nxdomain`, `nodata`, `timeout`, `cname-chain-issue`, `caa-present`, `txt-found`, `txt-missing`, and `canonical-mismatch`. All use a fixed timestamp and synthetic `example.com` values. The live resolver uses Node built-ins only; no DNS package, DNS provider SDK, provider credential, or DNS write interface is added.

The MCP tool accepts `{ url, expectedCanonicalHost?, expectedWwwMode?, expectedSearchConsoleVerificationTxt?, checkHttp?, mock? }`, needs no repository path, and returns this exact contract. It does not alter the sole MCP write tool, stdio-only transport, `WRITE_POLICY_V1`, GUI behavior, or `POST /api/fix = 404` boundary.

## `shipready.recheck.v1`

Pass 12 implements this contract for `recheck [path] --url <url> --json` and the read-only MCP tool `shipready.recheck`.

Top-level keys are `contract`, `url`, `checkedAt`, `mode`, `live`, optional `local`, `deployment`, `verdict`, `limitations`, and `nextActions`. `mode` is `url_only` or `repo_backed`. `live.robots` and `live.sitemap` each preserve a separate status: `present`, `missing`, `invalid`, `unreachable`, or `unknown`, with optional URL/HTTP evidence and a conservative message. A successful reused audit identifies `auditContract: "shipready.audit.v1"`.

Repo-backed output includes `repoPath`, detected `framework`, inferred V1-safe `expectedFiles`, and `inspectionContract: "shipready.repoInspection.v1"`. Expected paths are limited to the same static HTML, Vite React, and Next.js App Router conventions already allowed by `WRITE_POLICY_V1`; unsupported frameworks do not invent paths.

Deployment status is one of `not_checked`, `appears_deployed`, `appears_not_deployed`, `partially_deployed`, or `unknown`. URL-only mode always uses `not_checked`. Repo-backed classifications compare local presence with public conventional crawl-resource evidence, using “appears” language because ShipReady does not observe a hosting provider deployment event. Verdict is `ready`, `needs_deploy`, `needs_attention`, or `unknown`. Network failure is normally an `unreachable`/`unknown` result, not proof of absence.

The command disables the rendered browser pass because only public crawl-resource evidence is needed. It never calls write mode, deployment tooling, provider APIs, Git/GitHub, DNS writes, or Search Console. Positive live evidence does not guarantee crawling, indexing, propagation, or future availability.

Canonical fixtures cover URL-only ready/needs-attention, repo-backed appears-deployed/needs-deploy/partial, and unknown evidence. All use fixed timestamps and mocked audit/inspection inputs; no fixture generation uses the network.

## `shipready.socialPreview.v1`

Pass 13 implements this contract for `social-preview --json` and the read-only MCP tool `shipready.social_preview`.

Top-level keys are `contract`, `url`, `checkedAt`, `mode`, `sourceMode`, optional `canonicalUrl`, `previews`, `fields`, `image`, `warnings`, `limitations`, `comparison`, `verdict`, and `nextActions`. `mode` is `live` or `mock`; `sourceMode` is `raw`, `rendered`, or `both`. The default `both` mode prefers raw HTML values, then reports rendered HTML only as fallback evidence because raw metadata is usually safer for preview bots.

`fields` maps observed metadata names to raw/rendered values and constrained statuses: `present`, `missing`, `fallback`, or `unknown`. Source field names are fixed to `title`, `meta description`, `canonical`, Open Graph fields (`og:title`, `og:description`, `og:url`, `og:image`, `og:type`, `og:site_name`), and Twitter fields (`twitter:card`, `twitter:title`, `twitter:description`, `twitter:image`).

`previews` contains five simulated surfaces: `google_search`, `generic_social`, `x_twitter`, `slack_discord`, and `linkedin`. Google-style output uses title, meta description, and canonical URL. Generic social, Slack/Discord-style, and LinkedIn-style output prefer Open Graph fields with documented fallbacks. X/Twitter output prefers Twitter fields and falls back to Open Graph where practical. Each surface includes field statuses and warnings for missing primary fields, fallback use, rendered-only metadata, and image/description gaps.

`image.assetStatus` is `not_checked`, `reachable`, `unreachable`, or `unknown`. Live mode does not call platform APIs or arbitrary image-validation services; when image checking is not safe, it reports `not_checked`. Deterministic mocks may report reachable/unreachable evidence without network calls.

`comparison.rawVsRendered` preserves raw-versus-rendered metadata differences for the supported source field names. `verdict.status` is `ready`, `needs_attention`, or `unknown`; it is a review classification for observed preview inputs, not a promise about third-party rendering.

Canonical fixtures cover `complete`, `missing-image`, `rendered-only-metadata`, `twitter-fallback`, `missing-description`, `missing-og-url`, `raw-rendered-different`, `image-unreachable`, and `minimal-title-only`. All use fixed timestamps and synthetic `example.com` values. Fixture generation makes no external requests.

The CLI and MCP tool do not write files, require a repository path, call social platform APIs, scrape platform preview endpoints, render screenshots, generate images, deploy, mutate DNS/Search Console, use OAuth, store tokens, or broaden `WRITE_POLICY_V1`.

## `shipready.generatedSiteSmells.v1`

Pass 14 implements this contract for `smells <path> --json` and the read-only MCP tool `shipready.generated_site_smells`.

Top-level keys are `contract`, `checkedAt`, `mode`, `repoPath`, optional `url`, `framework`, `summary`, `findings`, `scanned`, `limitations`, and `nextActions`. `mode` is `repo_only`, `repo_plus_url`, or `mock`. URL mode strips query strings from output before reporting and reuses the existing single-page audit/social-preview evidence; it is not a crawler.

`framework` reports the same detected framework kind/name/confidence/evidence shape used by repo inspection. `summary.status` is `clean`, `needs_attention`, `manual_review`, or `unknown`, with constrained severity counts for `high`, `medium`, `low`, and `info`. Findings use constrained categories: `metadata`, `crawlability`, `preview`, `routing`, `assets`, `content_placeholders`, `configuration`, `framework`, `generated_boilerplate`, and `unknown`.

Each finding includes `id`, `title`, `category`, `severity`, `confidence`, `status`, bounded `evidence`, `whyItMatters`, `nextAction`, `relatedCommands`, and `relatedContracts`. Evidence is repo-relative where it references files and may include line numbers, fields, short redacted value previews, and source tags (`repo`, `audit`, `social_preview`, `scanner`, or `mock`). It must not contain raw full-file content, environment values, provider credentials, or sensitive query strings.

`scanned` reports files, bytes, skipped files, truncation, and limits. The scanner is intentionally practical and bounded: it reads likely source/config/public text files and skips dependency directories, build output, lockfiles, binary files, large media, and environment files. It is not a linter framework, security scanner, content quality grader, full SEO audit, multi-page crawler, or authorship classifier.

Canonical fixtures cover `clean`, `vite-client-only-metadata`, `placeholder-content`, `missing-social-assets`, `hardcoded-localhost`, `unsupported-framework`, and `repo-plus-url-rendered-only`. All use deterministic local mocks and fixed timestamps. The mock provider makes no network request and writes no files.

The CLI and MCP tool do not apply fixes, mutate repositories, call deploy/Git/GitHub/provider APIs, mutate DNS/Search Console, call social platform APIs, use OAuth, store tokens, or broaden `WRITE_POLICY_V1`. Findings are heuristic implementation signals that commonly appear in generated sites; they are not proof of authorship, generator identity, or site quality.

## `shipready.crawl.v1`

Pass 15 implements this contract for `crawl --url <url> --json` and the read-only MCP tool `shipready.crawl_site`.

Top-level keys are `contract`, `checkedAt`, `mode`, `startUrl`, `origin`, `options`, `summary`, `pages`, `repeatedFindings`, `consistency`, `skipped`, `limitations`, and `nextActions`. `mode` is `live` or `mock`. `options` preserves the effective bounded limits after caps are applied: `maxPages <= 25`, `maxDepth <= 2`, `source` as `sitemap`, `links`, or `both`, and the rendered audit switch.

`pages` contains compact per-page summaries only: URL, depth, discovery source, status, HTTP status, score, title, description, canonical URL, issue counts, top issues, and `auditContract` when the existing single-page audit completed. Full audit payloads and raw HTML are intentionally excluded. Page status is `ready`, `needs_attention`, `critical`, or `unknown`. Overall summary status is `ready`, `needs_attention`, or `unknown`.

Discovery is same-origin and HTTP(S)-only. Fragment identifiers are ignored. Query-string candidates are skipped or normalized without exposing query values. Unsupported protocols, outside-origin URLs, asset URLs, duplicates, depth/page-limit overflows, and errors are represented in `skipped` with constrained reasons. Sitemap seeding is limited to conventional `/sitemap.xml`, small XML, direct URL entries, and same-origin pages; recursive sitemap-index expansion is not performed in V1.

`repeatedFindings` groups repeated non-passing single-page audit checks by stable check ID/title and reports affected pages with review language. `consistency` reports canonical host observations, duplicate or missing title patterns, repeated missing metadata fields, and metadata consistency issues. These are bounded sample observations, not site-wide conclusions.

Canonical fixtures cover `clean-small-site`, `missing-descriptions`, `canonical-inconsistent`, `social-images-missing`, `start-unreachable`, `limit-reached`, and `mixed-readiness`. All use fixed timestamps and synthetic `example.com` values. Mock fixture generation makes no external requests.

The CLI and MCP tool do not require a local repository, write files, mutate DNS/Search Console, call social platform APIs, use OAuth, store tokens, run Git/GitHub/deploy behavior, broaden `WRITE_POLICY_V1`, or claim full-site crawling, complete SEO audit coverage, ranking analysis, traffic improvement, indexing, monitoring, or complete broken-link/security/accessibility scanning.

## Exact success shapes

All outputs are one JSON object followed by a newline and do not use a generic success envelope. `shipready.doctor.v1` has an `ok` readiness boolean because failed local checks are part of its valid report model; that field is not a data wrapper.

### `shipready.status.v1`

Top-level keys: `contract`, `version`, `mode`, `capabilities`, `writePolicy`, `integrations`, `demos`, `nextRecommendedCommand`, and `nextRecommendedPass`.

Stable posture fields report `cliFirst: true`, `mcpSecond: true`, `guiThird: true`, local stdio MCP with `remoteTransport: false`, exactly one MCP write tool (`shipready.write_safe_crawl_files`), and a local GUI with `writeEndpoint: false`. Search Console is `mock_prototype`; DNS is `read_only_status`; post-write recheck is `read_only`; DNS/provider writes, GitHub, deployment, deployment automation, and deploy-provider integrations remain `not_implemented`. `writePolicy.id` remains `creation_only_robots_sitemap_v1`; this report does not redefine policy semantics.

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

### `shipready.socialPreview.v1`

Top-level keys: `contract`, `url`, `checkedAt`, `mode`, `sourceMode`, optional `canonicalUrl`, `previews`, `fields`, `image`, `warnings`, `limitations`, `comparison`, `verdict`, and `nextActions`.

Internal source and formatter: `src/socialPreview/socialPreview.ts` and `src/report/formatSocialPreviewReport.ts`. Exit behavior: `0` after an emitted simulated preview; `1` for invalid URL/source/mock/timeout; `2` for operational or contract failure.

Consumers: CLI users, MCP clients, contract fixtures, tests, and future report/GUI work. Current GUI and HTML report surfaces do not consume this contract.

### `shipready.generatedSiteSmells.v1`

Top-level keys: `contract`, `checkedAt`, `mode`, `repoPath`, optional `url`, `framework`, `summary`, `findings`, `scanned`, `limitations`, and `nextActions`.

Internal source and formatter: `src/smells/generatedSiteSmells.ts`, `src/smells/repoSmellScanner.ts`, `src/smells/mockGeneratedSiteSmells.ts`, and `src/report/formatGeneratedSiteSmellsReport.ts`. Exit behavior: `0` after an emitted smell report, including clean, manual-review, and needs-attention results; `1` for invalid repo path, invalid URL, unsupported mock, invalid timeout, or invalid scan-limit input; `2` for operational or contract failure.

Consumers: CLI users, MCP clients, contract fixtures, tests, and future report/GUI work. Current GUI and HTML report surfaces do not consume this contract.

### `shipready.crawl.v1`

Top-level keys: `contract`, `checkedAt`, `mode`, `startUrl`, `origin`, `options`, `summary`, `pages`, `repeatedFindings`, `consistency`, `skipped`, `limitations`, and `nextActions`.

Internal source and formatter: `src/crawl/crawl.ts`, `src/crawl/linkDiscovery.ts`, `src/crawl/mockCrawl.ts`, and `src/report/formatCrawlReport.ts`. Exit behavior: `0` after an emitted bounded crawl result, including `needs_attention` or `unknown`; `1` for invalid URL/source/mock/timeout/limit input; `2` for operational or contract failure.

Consumers: CLI users, MCP clients, contract fixtures, tests, and future report/GUI work. Current GUI and HTML report surfaces do not consume this contract.

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
- `crawl.clean-small-site.json`
- `crawl.missing-descriptions.json`
- `crawl.canonical-inconsistent.json`
- `crawl.social-images-missing.json`
- `crawl.start-unreachable.json`
- `crawl.limit-reached.json`
- `crawl.mixed-readiness.json`
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
- `search-console.not-configured.json`
- `search-console.unauthorized.json`
- `search-console.property-not-found.json`
- `search-console.ready-sitemap-ok.json`
- `search-console.ready-sitemap-warning.json`
- `search-console.inspection-canonical-mismatch.json`
- `search-console.inspection-not-indexed.json`
- `dns.ready.json`
- `dns.apex-ok-www-missing.json`
- `dns.www-cname-ok.json`
- `dns.nxdomain.json`
- `dns.nodata.json`
- `dns.timeout.json`
- `dns.cname-chain-issue.json`
- `dns.caa-present.json`
- `dns.txt-found.json`
- `dns.txt-missing.json`
- `dns.canonical-mismatch.json`
- `error.invalid-url.json`
- `status.default.json`
- `doctor.default.json`
- `recheck.url-only-ready.json`
- `recheck.url-only-needs-attention.json`
- `recheck.repo-backed-appears-deployed.json`
- `recheck.repo-backed-needs-deploy.json`
- `recheck.repo-backed-partial.json`
- `recheck.unknown.json`
- `social-preview.complete.json`
- `social-preview.missing-image.json`
- `social-preview.rendered-only-metadata.json`
- `social-preview.twitter-fallback.json`
- `social-preview.missing-description.json`
- `social-preview.missing-og-url.json`
- `social-preview.raw-rendered-different.json`
- `social-preview.image-unreachable.json`
- `social-preview.minimal-title-only.json`
- `generated-site-smells.clean.json`
- `generated-site-smells.vite-client-only-metadata.json`
- `generated-site-smells.placeholder-content.json`
- `generated-site-smells.missing-social-assets.json`
- `generated-site-smells.hardcoded-localhost.json`
- `generated-site-smells.unsupported-framework.json`
- `generated-site-smells.repo-plus-url-rendered-only.json`

Regenerate them from local test repositories and deterministic in-memory audit results:

```bash
pnpm contracts:fixtures
```

The generator is `scripts/validation/generateContractFixtures.ts`. It makes no external requests. The write fixtures run `writeFixFromDryRun` only against temporary copies under the operating-system temp directory, record the returned results, and remove the copies. They never target a real repository. Fixed timestamps and repository display paths keep fixtures reproducible.

Focused drift coverage includes `tests/contracts.test.ts`, `tests/crawl.test.ts`, `tests/crawlCli.test.ts`, `tests/mcp.crawl.test.ts`, `tests/socialPreview.test.ts`, `tests/socialPreviewCli.test.ts`, `tests/mcp.socialPreview.test.ts`, `tests/generatedSiteSmells.test.ts`, `tests/generatedSiteSmellsCli.test.ts`, `tests/mcp.generatedSiteSmells.test.ts`, `tests/recheck.test.ts`, `tests/recheckCli.test.ts`, `tests/mcp.recheck.test.ts`, `tests/status.test.ts`, and `tests/doctor.test.ts`. Tests validate every fixture and formatter discriminator, constrained crawl/social-preview/recheck/generated-site smell states, mocked local/live comparisons, no-mutation behavior, allowed-root enforcement, status/doctor posture, and existing safety boundaries.

## Downstream consumers

- Planning: audit plus repo inspection feed `planFixesFromResults`.
- Preview/write: fix plans feed dry-run generation; write mode regenerates and validates dry-run candidates.
- UI normalization: internal results feed `createUiReport`; it does not parse CLI JSON.
- Static HTML: renders the internal `UiReport` model.
- GUI: serves the internal `UiReport` model through a local API; it does not execute write mode.
- Demo tooling: drives the GUI server surface and captures report artifacts.
- MCP: wraps the named CLI contracts through the existing application functions and JSON formatters; it does not expose ad-hoc internal models.

## MCP mapping

The implemented MCP specification is [MCP_PLAN.md](MCP_PLAN.md). Eleven contract-backed read-only tools preserve their top-level CLI contract objects; two canonical-read tools expose validated fixtures and allowlisted documents. `shipready.write_safe_crawl_files` returns `shipready.writeFix.v1` and is the only MCP write tool.

`shipready.preview_fixes` still returns `shipready.dryRunFix.v1`; when current V1-eligible crawl-file creations exist, the MCP layer adds an agent-facing `previewReceipt` to the tool payload. The receipt is not a CLI contract field and is not write authority by itself. It is a signed, short-lived MCP precondition binding the normalized URL, authorized canonical repository path, policy, eligible paths, and stable dry-run/candidate digests.

The MCP write call must supply the same URL and repo path, the fresh receipt, and `confirmation: "CREATE_SAFE_CRAWL_FILES_ONLY"`. The server re-authorizes and recomputes current candidates before writing, then validates and serializes the existing write result through `WriteFixJsonContractSchema`.

Ready now:

- Fourteen implemented JSON-capable command surfaces have explicit V1 contract names.
- Success outputs retain their existing fields and add stable discriminators.
- Action-level JSON errors have stable codes/messages and preserve the legacy `error` field.
- Deterministic local fixtures and focused drift tests cover success, failure, dry-run, write, UI, Search Console, DNS, recheck, social preview, generated-site smell, and bounded crawl states.
- Creation-only write evidence remains explicit and policy-bound.
- Human CLI, HTML file, and GUI server surfaces are clearly separated from CLI JSON contracts.

The compatible `shipready.error.v1` enum now also covers MCP boundary codes: `path_not_authorized`, `fixture_not_found`, `doc_not_found`, `network_error`, `render_error`, `timeout`, `cancelled`, `contract_error`, `write_forbidden`, `unsupported_command`, and `internal_error`. Optional `retryable` and safe `details` fields are additive; `error === message` remains required.

No other MCP write tool is registered. The GUI remains preview/copy-only, and `POST /api/fix` remains absent.
