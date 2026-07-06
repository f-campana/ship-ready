---
name: shipready-launch-readiness
description: Use ShipReady to check whether a generated website is ready to share, crawl, preview, and safely prepare for deployment. Use for live URL audits, local repository inspection, fix planning, dry-run previews, guarded crawl-file creation, post-write rechecks after external deployment, UI or HTML reports, stdio MCP workflows, mock-backed Search Console status, read-only DNS checks, metadata or crawlability review, link-preview diagnosis, and launch-readiness reporting.
---

# ShipReady Launch Readiness

Treat ShipReady as a CLI-first, agent-friendly launch-readiness engine for generated websites. Keep this order: CLI first, MCP second, GUI third. Preview before writing, permit only policy-approved safe writes, avoid outcome claims, and never hide deployment boundaries.

## Choose the workflow

Use this skill when reviewing a generated site, checking metadata or crawl resources, diagnosing weak link-preview inputs, safely creating eligible missing robots/sitemap files, or preparing a launch-readiness report with DNS and Search Console context.

Do not use ShipReady for keyword research, rank tracking, backlink analysis, general SEO strategy, deployment, DNS writes, live Search Console mutation, GitHub pull requests, broad content rewriting, or metadata/content writes. Do not present it as an SEO suite, deployment system, DNS manager, Search Console automation system, PR bot, or SaaS dashboard.

## Establish prerequisites

1. Work from an installed ShipReady checkout after `pnpm install`.
2. Obtain a public HTTP(S) URL.
3. Obtain a repository path only for repo inspection, planning, previews, or guarded creation.
4. Run `pnpm shipready doctor --json` when local readiness is uncertain.
5. Run `pnpm shipready status --json` before assuming a capability exists.
6. Require explicit user approval before any guarded write.

## Distinguish capability states

| State | Current capability |
|---|---|
| Implemented | Single-page audit; bounded repo inspection; social preview simulator; planning; dry-run; status/doctor; versioned JSON; UI and HTML reports; local GUI; stdio MCP |
| Mock-backed | Search Console status only; no Google OAuth, tokens, or live API calls |
| Read-only | Audit, inspection, social preview simulation, planning, dry-run, post-write recheck, UI report, GUI, Search Console mocks, and DNS status; live DNS uses resolver observations only |
| Write-guarded | CLI and the sole MCP write tool may create only eligible missing robots/sitemap files under `WRITE_POLICY_V1` |
| Future | Generated-site smell detector, bounded multi-page crawl, GUI revisit, terminal output polish/TUI viewer, patch export, and GitHub PR integration |

Never infer future behavior from a roadmap name. A current audit covers one page. The current social preview simulator is a metadata-based approximation, not platform output.

## Run the canonical CLI workflow

Start read-only and preserve structured output:

```bash
pnpm shipready doctor --json
pnpm shipready status --json
pnpm shipready audit <url> --json
pnpm shipready recheck --url <url> --json
pnpm shipready inspect-repo <path> --json
pnpm shipready plan-fixes <path> --url <url> --json
pnpm shipready fix <path> --url <url> --dry-run --json
pnpm shipready dns status --url <url> --json
pnpm shipready social-preview --url <url> --json
pnpm shipready search-console status --url <url> --json
pnpm shipready ui-report <path> --url <url> --json
pnpm shipready html-report <path> --url <url> --output shipready-report.html
```

- Use URL-only `audit` and `ui-report` when no repository is available; do not claim local fixes can be planned.
- Use repo-backed commands for framework evidence, fix classification, and exact previews.
- Treat `plan-fixes` automation fields as capability descriptions, not authorization.
- Treat `social-preview` as a simulated preview from observed metadata, not a precise third-party rendering result.
- Treat `fix --dry-run` as mandatory before a write; it writes nothing.
- Treat JSON `contract` discriminators as versioned public boundaries. See [CONTRACTS.md](../../docs/CONTRACTS.md).
- Separate safe candidates, review-required changes, manual actions, already-good checks, limitations, and local-versus-live state.

## Guard the only CLI write workflow

Read [WRITE_POLICY_V1.md](../../docs/WRITE_POLICY_V1.md) before considering:

```bash
pnpm shipready fix <path> --url <url> --write --allow-create
```

Permit this command only for eligible missing robots/sitemap files. Never use it for metadata, content, JSON-LD, H1, alt text, package files, configuration, existing files, Git, GitHub, deployment, DNS, or Search Console.

Confirm every item before writing:

1. Record explicit approval for safe crawl-file creation against the exact target.
2. Review the current dry-run.
3. Verify every candidate is `changeType: "create"`.
4. Verify every candidate is `risk: "low"`.
5. Verify every candidate is `requiresHumanReview: false`.
6. Verify every candidate is `reviewStatus: "auto_candidate"` under the current contract.
7. Verify each path is in the framework-specific V1 allowlist and absent at write time.
8. Avoid real production repositories unless the user explicitly requested that exact target.
9. Exclude metadata, content, configuration, Git, deployment, and all other forbidden effects.

Stop if any check fails. Never run guarded write mode merely to validate this skill. After a permitted write, report exact local creations, tell the user to deploy through their external workflow, and then use `shipready recheck` for read-only live evidence. Do not deploy.

## Recheck after external deployment

```bash
pnpm shipready recheck --url <url> --json
pnpm shipready recheck <path> --url <url> --json
```

Use URL-only mode when local state is unavailable. Use repo-backed mode to compare current V1-safe local expected crawl-file presence with live `robots.txt` and `sitemap.xml` evidence. Treat `appears_deployed`, `appears_not_deployed`, and `partially_deployed` as evidence classifications, not guarantees. An unreachable result is unknown, not missing. Recheck never invokes write mode, Git, deployment, provider APIs, DNS writes, or Search Console.

## Simulate social previews

```bash
pnpm shipready social-preview --url https://example.com
pnpm shipready social-preview --url https://example.com --json
pnpm shipready social-preview --url https://example.com --source raw|rendered|both
pnpm shipready social-preview --url https://example.com --mock complete --json
```

Use this read-only command to inspect likely input fields for Google-style search snippets and generic social, X/Twitter, Slack/Discord, and LinkedIn-style link cards. It reports title, description, URL, card type, image URL presence, image asset status, raw-versus-rendered differences, warnings, limitations, and next actions.

Prefer `--source both` unless you have a specific diagnostic reason. It prefers raw HTML values and reports rendered-only fallbacks because raw HTML is usually safer for preview bots.

Use deterministic mocks for examples/tests: `complete`, `missing-image`, `rendered-only-metadata`, `twitter-fallback`, `missing-description`, `missing-og-url`, `raw-rendered-different`, `image-unreachable`, and `minimal-title-only`.

No social platform APIs are used. Do not present the output as a precise LinkedIn, X, Slack, Discord, Google, or browser rendering result. It does not call platform preview endpoints, generate screenshots/images, deploy, mutate DNS/Search Console, use OAuth, store tokens, or write repository files.

## Use MCP safely

Start the local stdio server with at least one explicit allowed root:

```bash
pnpm --silent shipready mcp --allow-root /absolute/workspace
```

Use these read-only tools by their exact names:

- `shipready.audit_site`
- `shipready.inspect_repo`
- `shipready.plan_fixes`
- `shipready.preview_fixes`
- `shipready.get_ui_report`
- `shipready.get_contract_fixture`
- `shipready.get_policy_doc`
- `shipready.search_console_status`
- `shipready.dns_status`
- `shipready.recheck`
- `shipready.social_preview`

Treat `shipready.write_safe_crawl_files` as the only MCP write tool. Before calling it, require an authorized repository path, a fresh receipt from `shipready.preview_fixes`, the same normalized URL and canonical repo path, and exact confirmation `CREATE_SAFE_CRAWL_FILES_ONLY`. The server must re-authorize and revalidate current V1 candidates.

MCP remains stdio-only. Do not add or imply remote transport, arbitrary file writes, client-supplied write paths, or DNS, Search Console, GitHub, Git, or deployment mutation. Read [MCP_PLAN.md](../../docs/MCP_PLAN.md) for schemas, resources, prompts, and failure behavior.

## Produce GUI and HTML reports

```bash
pnpm shipready gui
pnpm shipready html-report <path> --url <url> --output report.html
```

Use the GUI for local human review. Keep it preview/copy-only: it writes no project files, and `POST /api/fix` remains unavailable with `404`. Treat copied guarded commands as text, not authorization.

Use HTML reports as explicit, self-contained static artifacts. The command writes only the named report file; it does not modify the inspected repository.

## Handle Search Console and DNS evidence

Use deterministic Search Console mocks until a separately reviewed live integration exists:

```bash
pnpm shipready search-console status --url https://example.com --mock ready_sitemap_ok --json
```

Do not imply Google OAuth, token custody, live API calls, property verification, sitemap submission, or indexing requests. Without `--mock`, the command still returns a mock-backed `not_configured` result.

Use DNS status for read-only observations:

```bash
pnpm shipready dns status --url https://example.com --json
```

Do not imply provider APIs, record writes, registrar/nameserver mutation, propagation guarantees, or Search Console ownership. Use deterministic `--mock` scenarios for tests; live mode performs resolver reads and optional explicitly requested HTTP canonical-host observation.

## Apply the claims policy

Use: launch-readiness, crawler visibility, preview-bot visibility, safe crawl files, metadata completeness, readiness signal, review-required change, and local changes require deployment.

Label the following only as forbidden examples: rank higher, SEO boost, guaranteed indexing, guaranteed crawling, instant indexing, Google approval, automatic deploy, automatic DNS fix, guaranteed propagation, guaranteed certificate issuance, and fix everything. Never use close paraphrases that promise third-party outcomes. Read [CLAIMS_POLICY.md](../../docs/CLAIMS_POLICY.md).

## Report results

Use this template and omit only inapplicable sections:

```md
# ShipReady Launch Readiness Report

## Global status
...
## Commands run
...
## What passed
...
## Needs attention
...
## Safe to apply
...
## Needs review
...
## Manual only
...
## DNS readiness
...
## Search Console readiness
...
## Local vs live warning
...
## Artifacts
...
## Safety confirmation
...
## Next actions
...
```

State whether each command was URL-only, repo-backed, mock-backed, or live read-only. Attribute observations to their source. Never convert a readiness signal into an indexing, ranking, propagation, deployment, or provider guarantee.

## Troubleshoot safely

| Condition | Response |
|---|---|
| Invalid URL | Require an absolute `http://` or `https://` URL. |
| Invalid repo path | Resolve the intended path; do not broaden scope or guess. |
| Unsupported framework | Report limitations and keep changes manual. |
| No safe automatic fix | Report review/manual items; do not force a write. |
| Review-required changes only | Preview them and require human implementation/review outside V1. |
| Search Console not configured | Explain that the current provider is mock-backed only. |
| DNS timeout or NXDOMAIN | Preserve the distinct status and recommend manual investigation; do not promise remediation. |
| GUI retains an earlier report after invalid URL | Treat the error as current and the visible prior report as stale context. |
| MCP path not authorized | Restart/configure the server with the exact allowed root; do not bypass authorization. |
| MCP receipt expired or mismatched | Run a fresh preview and review it again; never reuse or alter the receipt. |

## Load examples and evidence as needed

- Read [url-only-check.md](examples/url-only-check.md) for a public-URL-only review.
- Read [generated-site-review.md](examples/generated-site-review.md) for a combined repo, DNS, Search Console mock, and report workflow.
- Read [safe-crawl-files.md](examples/safe-crawl-files.md) only when explicit crawl-file creation is being considered.
- Read [post-write-recheck.md](examples/post-write-recheck.md) after local crawl-file creation and external deployment.

Use the latest `validation/e2e-project-review/` package when present as evidence of current behavior, especially `SUMMARY.md`, `FEATURE_MATRIX.md`, `SAFETY_REPORT.md`, and `SCREENSHOT_INDEX.md`. Do not regenerate that package for routine use and do not treat validation writes on disposable fixtures as authority to write a real repository.
