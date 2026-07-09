---
name: shipready-launch-readiness
description: Use ShipReady to check whether a generated website is ready to share, crawl, preview, and safely prepare for deployment. Use for live URL audits, bounded multi-page launch-readiness crawls, local repository inspection, generated-site implementation smell detection, fix planning, dry-run previews, review-only patch export, review-only GitHub PR draft handoff, guarded crawl-file creation, post-write rechecks after external deployment, UI or HTML reports, stdio MCP workflows, mock-backed Search Console status, read-only DNS checks, metadata or crawlability review, link-preview diagnosis, and launch-readiness reporting.
---

# ShipReady Launch Readiness

Treat ShipReady as a CLI-first, agent-friendly launch-readiness engine for generated websites. Keep this order: CLI first, MCP second, GUI third. Preview before writing, permit only policy-approved safe writes, avoid outcome claims, and never hide deployment boundaries.

## Choose the workflow

Use this skill when reviewing a generated site, checking metadata or crawl resources, diagnosing weak link-preview inputs, identifying generated-site implementation smells, safely creating eligible missing robots/sitemap files, or preparing a launch-readiness report with DNS and Search Console context.

Do not use ShipReady for keyword research, rank tracking, backlink analysis, general SEO strategy, deployment, DNS writes, live Search Console mutation, live GitHub pull request creation, broad content rewriting, or metadata/content writes. Do not present it as an SEO suite, deployment system, DNS manager, Search Console automation system, PR bot, or SaaS dashboard.

## Establish prerequisites

1. Work from a source ShipReady checkout after `pnpm install`; v0 is not published to npm and `pnpm dlx shipready` is not expected to work.
2. Obtain a public HTTP(S) URL.
3. Obtain a repository path only for repo inspection, planning, previews, or guarded creation.
4. Run `pnpm playwright:install` if `doctor` reports that Playwright Chromium is missing; package install does not download browsers automatically.
5. Run `pnpm shipready doctor --json` when local readiness is uncertain.
6. Run `pnpm shipready status --json` before assuming a capability exists.
7. Require explicit user approval before any guarded write.

## Distinguish capability states

| State | Current capability |
|---|---|
| Release posture | v0 local/agent release candidate; see [RELEASE_READINESS.md](../../docs/RELEASE_READINESS.md) |
| Implemented | Single-page audit; bounded multi-page crawl; bounded repo inspection; generated-site implementation smell detector; social preview simulator; planning; dry-run; review-only patch export; review-only GitHub PR draft handoff; status/doctor; versioned JSON; UI and HTML reports; read-only TUI viewer; local read-only GUI review cockpit; stdio MCP |
| Mock-backed | Search Console status only; no Google OAuth, tokens, or live API calls |
| Read-only | Audit, bounded crawl, inspection, social preview simulation, planning, dry-run, post-write recheck, UI report, GUI, Search Console mocks, and DNS status; live DNS uses resolver observations only |
| Write-guarded | CLI and the sole MCP write tool may create only eligible missing robots/sitemap files under `WRITE_POLICY_V1` |
| Distribution | Source-checkout-only v0; `pnpm --dir /Users/fabiencampana/Documents/ship-ready shipready ...` is the supported from-anywhere form; `pnpm link --global` is developer-local only after `pnpm build`; local tarball smoke passed as publish-readiness evidence only |
| Future | npm package name / publish authorization decision, standalone binary exploration, live GitHub with explicit opt-in, live Search Console with OAuth/token design, hosted SaaS exploration, broader framework support, and stronger demos/reporting |

Never infer future behavior from a roadmap name. A single-page audit covers one page; bounded crawl covers only a small same-origin sample under strict limits. The current social preview simulator is a metadata-based approximation, not platform output.

Default human CLI output is the terminal review experience in v0. It is plain text and should surface target, status, next action, top findings, safety labels, and a `--json` pointer. Use `--json` when a stable contract is needed. The `tui` command is implemented as a read-only terminal review viewer over `ui-report-v1`; it falls back to plain output in CI/non-TTY streams and has no JSON contract. Do not infer an aggregate `review` command; it is not implemented.

## Run the canonical CLI workflow

Start read-only and preserve structured output:

```bash
pnpm shipready status --json
pnpm shipready doctor --json
pnpm shipready audit <url> --json
pnpm shipready recheck --url <url> --json
pnpm shipready inspect-repo <path> --json
pnpm shipready plan-fixes <path> --url <url> --json
pnpm shipready fix <path> --url <url> --dry-run --json
pnpm shipready patch-export <path> --url <url> --output /tmp/shipready.patch --json
pnpm shipready patch-export <path> --url <url> --stdout
pnpm shipready github-pr-draft <path> --url <url> --output /tmp/shipready-pr.md --json
pnpm shipready github-pr-draft <path> --url <url> --stdout
pnpm shipready dns status --url <url> --json
pnpm shipready social-preview --url <url> --json
pnpm shipready smells <path> --json
pnpm shipready smells <path> --url <url> --json
pnpm shipready crawl --url <url> --json
pnpm shipready search-console status --url <url> --json
pnpm shipready ui-report <path> --url <url> --json
pnpm shipready tui <path> --url <url>
pnpm shipready html-report <path> --url <url> --output shipready-report.html
```

When running from outside the checkout, use a repository-local form:

```bash
cd /Users/fabiencampana/Documents/ship-ready && pnpm shipready status --json
pnpm --dir /Users/fabiencampana/Documents/ship-ready shipready status --json
pnpm --dir /Users/fabiencampana/Documents/ship-ready shipready audit https://example.com --json
```

Do not use `pnpm dlx shipready` for v0. It is not a supported path until a future publish authorization pass approves publication and verifies post-publish behavior. See [PACKAGE_PUBLISH_PREPARATION.md](../../docs/PACKAGE_PUBLISH_PREPARATION.md) for tarball smoke evidence and remaining publish blockers.

- Use URL-only `audit` and `ui-report` when no repository is available; do not claim local fixes can be planned.
- Use repo-backed commands for framework evidence, fix classification, and exact previews.
- Treat `plan-fixes` automation fields as capability descriptions, not authorization.
- Treat `social-preview` as a simulated preview from observed metadata, not a precise third-party rendering result.
- Treat `crawl` as a bounded same-origin sample, not exhaustive site coverage or broad analytics.
- Treat `fix --dry-run` as mandatory before a write; it writes nothing.
- Treat `patch-export` as a review-only dry-run artifact; it does not apply patches, mutate the target repository, commit, push, open pull requests, or deploy.
- Treat `github-pr-draft` as a review-only PR draft handoff; it did not create a PR, call a GitHub API, run Git commands, create a branch, commit, push, deploy, apply patches, or mutate the target repository.
- Treat `tui` as a human-only read-only viewer over `ui-report-v1`. It does not write files, start the GUI server, produce JSON, change contracts, apply patches, call Git/GitHub, deploy, write DNS, call live Search Console, call social platform APIs, or broaden `WRITE_POLICY_V1`.
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

## Export review patches

```bash
pnpm shipready patch-export <path> --url https://example.com --output /tmp/shipready.patch
pnpm shipready patch-export <path> --url https://example.com --output /tmp/shipready.patch --json
pnpm shipready patch-export <path> --url https://example.com --stdout
```

Use patch export when a human or external tool needs the proposed dry-run file changes without letting ShipReady write to the inspected repository. The command regenerates the current `shipready.dryRunFix.v1` preview, converts included file changes into a unified-diff artifact, and returns `shipready.patchExport.v1` with exported/skipped changes, review status, output hash, limitations, and next actions.

Rules:

1. Require a repository path and URL.
2. Require exactly one of `--output` or `--stdout`.
3. Prefer `--output` outside the inspected repository.
4. Reject output paths inside the inspected repository by default.
5. Use `--stdout` when no file should be written.
6. Keep review-required changes clearly marked.
7. Review the artifact before using it with other tools.

Patch export is not write mode. It never invokes `fix --write`, applies patches, mutates the target repository, stages/commits/pushes, opens pull requests, deploys, writes DNS, calls provider APIs, calls live Search Console, handles OAuth/tokens, or broadens `WRITE_POLICY_V1`.

## Prepare a GitHub PR draft handoff

```bash
pnpm shipready github-pr-draft <path> --url https://example.com --patch /tmp/shipready.patch --output /tmp/shipready-pr.md
pnpm shipready github-pr-draft <path> --url https://example.com --output /tmp/shipready-pr.md --json
pnpm shipready github-pr-draft <path> --url https://example.com --stdout
```

Use PR draft handoff when a human needs a PR-ready review artifact after ShipReady dry-run and patch-export evidence. The artifact includes PR title, PR body, proposed-change summary, safe/review-required/manual classifications, patch artifact reference, review checklist, validation checklist, copyable GitHub CLI command strings when requested, copyable manual Git command strings, and safety limitations.

Rules:

1. Require a repository path and URL.
2. Require exactly one of `--output` or `--stdout`.
3. Prefer `--output` outside the inspected repository.
4. Reject output paths inside the inspected repository by default.
5. Use `--patch` to reference an existing review-only patch artifact; otherwise ShipReady regenerates patch-export evidence internally without writing a patch file.
6. Treat `--github-repo`, `--base`, `--branch`, and `--include-gh-command` as generated-text metadata only.
7. Review the draft and patch before running any copied command outside ShipReady.

PR draft handoff is not GitHub automation. ShipReady did not create a PR, branch, commit, push, deployment, GitHub update, or applied fix. There is no GitHub API call, no `gh` execution, no Git command execution, no GitHub auth requirement, no token storage, no patch application, no target-repository mutation, no DNS write, no live Search Console call, and no `WRITE_POLICY_V1` broadening.

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

## Detect generated-site implementation smells

```bash
pnpm shipready smells <path>
pnpm shipready smells <path> --json
pnpm shipready smells <path> --url https://example.com --json
pnpm shipready smells <path> --mock clean --json
```

Use this read-only detector to identify heuristic implementation signals that commonly appear in generated sites and may need launch-readiness review: metadata only injected client-side, weak SPA raw HTML, missing crawl files, placeholder copy, default starter boilerplate, missing referenced public assets, hardcoded local/example URLs, generic metadata, and unclear framework shape.

Without `--url`, the command performs a bounded local repo scan only. With `--url`, it adds ShipReady's existing single-page audit/social-preview evidence for raw-versus-rendered metadata cross-checks. Mock scenarios are deterministic: `clean`, `vite-client-only-metadata`, `placeholder-content`, `missing-social-assets`, `hardcoded-localhost`, `unsupported-framework`, `repo-plus-url-rendered-only`, and `multiple-smells`.

Treat every finding as a review target, not a conclusion about authorship, generator identity, or site quality. The detector is not an authorship-identification system and does not apply fixes. It writes no files, runs no `fix` mode, deploys nothing, calls no Git/GitHub/provider APIs, performs no DNS/Search Console mutation, calls no social platform APIs, uses no OAuth, stores no tokens, and does not broaden `WRITE_POLICY_V1`.

## Run a bounded multi-page crawl

```bash
pnpm shipready crawl --url https://example.com
pnpm shipready crawl --url https://example.com --json
pnpm shipready crawl --url https://example.com --max-pages 8 --max-depth 1 --source both --json
pnpm shipready crawl --url https://example.com --mock clean-small-site --json
```

Use this read-only command to sample a small same-origin set of public HTTP(S) pages and ask whether important pages expose basic launch-readiness metadata and crawl resources consistently. It starts from one URL, discovers bounded same-origin candidates from links and/or conventional `/sitemap.xml`, audits selected pages with ShipReady's existing single-page audit logic, and reports page summaries, repeated findings, metadata consistency, skipped URL reasons, limits, limitations, and next actions.

Defaults are `--max-pages 8`, `--max-depth 1`, `--source both`, and rendered audit enabled. Hard caps are `maxPages <= 25` and `maxDepth <= 2`; larger values are capped. Use `--no-render` to skip rendered page audits. Mock scenarios are deterministic: `clean-small-site`, `missing-descriptions`, `canonical-inconsistent`, `social-images-missing`, `start-unreachable`, `limit-reached`, and `mixed-readiness`.

Treat crawl results as bounded sample evidence only. It is not exhaustive site coverage, broad analytics, indexing evidence, traffic forecasting, complete broken-link scanning, security scanning, accessibility auditing, monitoring, write mode, DNS/Search Console/social-platform integration, Git/GitHub workflow, or deployment path. It writes no files, requires no local repo, uses no OAuth, stores no tokens, and does not broaden `WRITE_POLICY_V1`.

## Use MCP safely

Start the local stdio server with at least one explicit allowed root:

```bash
pnpm --dir /Users/fabiencampana/Documents/ship-ready --silent shipready mcp --allow-root /absolute/workspace
```

Use `--silent` for stdio MCP so package-manager script output cannot corrupt JSON-RPC traffic.

Use these read-only tools by their exact names:

- `shipready.audit_site`
- `shipready.crawl_site`
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
- `shipready.generated_site_smells`
- `shipready.export_patch`
- `shipready.github_pr_draft`

Treat `shipready.write_safe_crawl_files` as the only MCP write tool. Before calling it, require an authorized repository path, a fresh receipt from `shipready.preview_fixes`, the same normalized URL and canonical repo path, and exact confirmation `CREATE_SAFE_CRAWL_FILES_ONLY`. The server must re-authorize and revalidate current V1 candidates.

`shipready.export_patch` is read-only and returns inline `shipready.patchExport.v1` content with `wroteArtifact: false`; it writes no artifact file and still requires allowed-root authorization for `repoPath`.

`shipready.github_pr_draft` is read-only and returns inline `shipready.githubPrDraft.v1` content with `wroteArtifact: false`; it writes no artifact file, runs no Git, calls no GitHub API, and still requires allowed-root authorization for `repoPath`.

MCP remains stdio-only. Do not add or imply remote transport, arbitrary file writes, client-supplied write paths, detector auto-fixes, patch application, live PR creation, or DNS, Search Console, GitHub, Git, or deployment mutation. Read [MCP_PLAN.md](../../docs/MCP_PLAN.md) for schemas, resources, prompts, and failure behavior.

## Produce TUI, GUI, and HTML reports

```bash
pnpm shipready tui <path> --url <url>
pnpm shipready tui --url <url> --include social-preview,crawl --mock-profile demo
pnpm --dir /Users/fabiencampana/Documents/ship-ready shipready gui
pnpm shipready html-report <path> --url <url> --output report.html
```

Use `tui` for a local terminal review viewer when a human wants section navigation. It reuses `ui-report-v1`; default mode runs only the base UI report, and optional sections run only when named with `--include`. In CI or non-TTY streams it prints the plain UI report and exits without raw terminal mode.

Use the GUI for local human review. Keep it read-only and preview/copy-only: it writes no project files, and `POST /api/fix` remains unavailable with `404`. The browser client uses `POST /api/review`, while `POST /api/ui-report` remains available for compatibility. The main review loads first; social preview, bounded crawl, generated-site smells, DNS status, Search Console mock status, and recheck are on-demand read-only sections. Treat copied guarded commands and copied PR draft commands as text, not authorization.

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

Use `validation/e2e-project-review/` when present as preserved validation evidence, especially `SUMMARY.md`, `FEATURE_MATRIX.md`, `SAFETY_REPORT.md`, and `SCREENSHOT_INDEX.md`, but prefer [RELEASE_READINESS.md](../../docs/RELEASE_READINESS.md) plus the latest validation run for the current v0 checkpoint. Do not regenerate that package for routine use and do not treat validation writes on disposable fixtures as authority to write a real repository.
