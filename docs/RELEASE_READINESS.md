# Release Readiness

Checkpoint date: 2026-07-10

Classification: **v0 local/agent release candidate**.

ShipReady is a local launch-readiness CLI for generated websites. It checks what crawlers and preview bots can see before launch, explains safe next actions, and preserves strict mutation boundaries.

## Current product shape

- CLI first: `pnpm shipready ...` is the source of truth.
- MCP second: local stdio MCP wraps stable CLI contracts.
- GUI third: loopback-only read-only review cockpit.
- TUI viewer: implemented read-only over `ui-report-v1`.
- Decision: `Implement minimal TUI now`.
- Write policy: `WRITE_POLICY_V1` remains limited to creation-only missing robots/sitemap files.
- Distribution: repository-local now; future npm direction is `@shipready/cli` with bin `shipready`, but publication remains blocked. Package publish preparation is documented in [PACKAGE_PUBLISH_PREPARATION.md](PACKAGE_PUBLISH_PREPARATION.md). See also [DISTRIBUTION.md](DISTRIBUTION.md), [PACKAGE_PUBLISH_DECISION.md](PACKAGE_PUBLISH_DECISION.md), [PACKAGE_PUBLISH_BLOCKERS.md](PACKAGE_PUBLISH_BLOCKERS.md), [PUBLIC_PACKAGE_SAFETY_REVIEW.md](PUBLIC_PACKAGE_SAFETY_REVIEW.md), and [PUBLISH_RUNBOOK.md](PUBLISH_RUNBOOK.md).

## Implemented surfaces

- `status` and `doctor`.
- Single-page URL audit with raw/rendered metadata comparison and `--no-render`.
- Bounded same-origin crawl.
- Repository inspection.
- Fix planning and dry-run previews.
- Guarded CLI write for V1-eligible missing crawl files only.
- Review-only patch export.
- Review-only GitHub PR draft handoff.
- Read-only post-write recheck.
- Read-only social preview simulator.
- Read-only generated-site implementation smell detector.
- Mock-backed Search Console status prototype.
- Read-only DNS readiness status.
- `ui-report`, `html-report`, local GUI, TUI, and stdio MCP.
- Repository-local ShipReady Launch Readiness skill.
- Package readiness docs, MIT license, package smoke script, and package-smoke workflow.

## Command matrix

Run from this checkout:

```bash
cd /Users/fabiencampana/Documents/ship-ready
pnpm shipready status
pnpm shipready doctor
pnpm shipready audit https://example.com
pnpm shipready audit https://example.com --no-render --json
pnpm shipready tui --url https://example.com
pnpm --dir /Users/fabiencampana/Documents/ship-ready shipready status
```

Future installed usage remains blocked until publish approval and smoke:

```bash
pnpm dlx @shipready/cli audit https://example.com
```

| Command | Class | Status |
|---|---|---|
| `status`, `doctor` | local read-only | Implemented |
| `audit`, `crawl`, `social-preview`, `dns status`, `search-console status`, `recheck` | network/mock read-only | Implemented |
| `inspect-repo`, `smells` | local read-only | Implemented |
| `plan-fixes`, `fix --dry-run`, `ui-report`, `tui` | read-only planning/review | Implemented |
| `fix --write --allow-create` | guarded target-repo write | Implemented under `WRITE_POLICY_V1` |
| `patch-export`, `github-pr-draft`, `html-report` | explicit review artifact output | Implemented |
| `gui` | local read-only HTTP surface | Implemented |
| `mcp` | local stdio server | Implemented |

## Contract matrix

Versioned JSON contracts remain the machine boundary:

- `shipready.status.v1`
- `shipready.doctor.v1`
- `shipready.audit.v1`
- `shipready.crawl.v1`
- `shipready.repoInspection.v1`
- `shipready.fixPlan.v1`
- `shipready.dryRunFix.v1`
- `shipready.writeFix.v1`
- `shipready.uiReport.v1`
- `shipready.searchConsoleStatus.v1`
- `shipready.dnsStatus.v1`
- `shipready.recheck.v1`
- `shipready.socialPreview.v1`
- `shipready.generatedSiteSmells.v1`
- `shipready.patchExport.v1`
- `shipready.githubPrDraft.v1`
- `shipready.error.v1`

Contract fixtures live under `validation/contracts/` and are included in the package whitelist.

## MCP surface

MCP remains local stdio-only. It exposes fifteen read-only tools and one write tool:

- Sole write tool: `shipready.write_safe_crawl_files`.
- Repo-capable tools require allowed-root authorization.
- The write tool requires a fresh preview receipt, same URL, same authorized canonical repo path, exact confirmation, and regenerated validation.
- No remote transport, arbitrary file path write, OAuth, provider credential, hosted endpoint, or telemetry exists.

## GUI surface

- Runs only on loopback hosts.
- Serves `/`, `POST /api/review`, and compatibility `POST /api/ui-report`.
- `POST /api/fix` remains `404`.
- Safe crawl-file creation, patch export, and PR draft are shown as copyable CLI handoffs only.
- No GUI write execution, deploy, Git/GitHub, DNS provider, Google, social platform, OAuth, token storage, metadata write, content write, JSON-LD write, package write, or config write exists.

## Write policy

`docs/WRITE_POLICY_V1.md` remains canonical and unchanged. The only product write mode can create eligible missing robots/sitemap files at framework-aware allowlisted paths. It cannot overwrite existing files or write metadata, content, JSON-LD, package files, configuration, Git state, deployments, DNS, Search Console, or provider state.

## Safety boundaries

- GUI local/read-only; `POST /api/fix = 404`.
- TUI read-only/human-only.
- MCP stdio-only with exactly one target-repo write tool.
- Patch export review-only.
- GitHub PR draft review-only; no GitHub or Git execution.
- Search Console mock-backed only.
- DNS read-only.
- Recheck read-only and no deploy.
- Social preview platform-API-free.
- Smells heuristic/authorship-neutral.
- Crawl bounded/non-exhaustive.
- No hosted SaaS, remote MCP, telemetry, auth/accounts/billing, OAuth/token storage, live GitHub behavior, deployments, DNS writes, live Search Console, social platform APIs, or `WRITE_POLICY_V1` broadening.

## Known limitations

- No published npm package yet.
- No verified installed `pnpm dlx @shipready/cli` behavior yet.
- `package.json.name` remains `shipready` until final package-root lookup work.
- `@shipready` npm scope ownership is not confirmed.
- No standalone binary, hosted wrapper, remote MCP transport, auto-update behavior, aggregate `review` command, or default global install exists.
- Live URL, DNS, and rendered checks remain environment/network dependent.

## Validation status

Required validation for this pass:

```bash
pnpm test
pnpm typecheck
pnpm build
git diff --check
pnpm shipready status --json
pnpm shipready doctor --json
pnpm package:smoke
find . -maxdepth 3 -name "*.tgz"
```

The final tarball check must print nothing.

## Demo / dogfood commands

```bash
pnpm shipready status --json
pnpm shipready doctor --json
pnpm shipready audit https://example.com --no-render --json
pnpm shipready tui --url https://example.com
pnpm shipready gui
pnpm --dir /Users/fabiencampana/Documents/ship-ready --silent shipready mcp --allow-root /Users/fabiencampana/Documents/ship-ready
```

Use disposable temp repositories for patch export, PR draft, and write validation. Do not use Fodmapp as a write target.

## Release blockers

Product safety is not the current blocker. Publish blockers are:

- owner approval for the exact release;
- `@shipready` scope ownership;
- `package.json.name` and package-root lookup transition;
- active trusted-publishing workflow;
- release notes/changelog;
- published browser-install and post-publish smoke verification;
- GitHub tag/release approval.

## Release recommendation

Present ShipReady as an early-preview local launch-readiness CLI for generated websites. Issues are welcome and support is limited. Do not describe it as hosted SaaS, deployment automation, live GitHub automation, live Search Console integration, DNS management, social platform preview authority, or an unrestricted site editor.

## Next roadmap

1. npm scope control confirmation and package-name transition planning.
2. Publish execution plan, after workflow/scope blockers are closed.
3. Manual TUI polish without dependencies.
4. Live GitHub integration only with explicit opt-in, auth, Git worktree safety, and mutation tests.
5. Live Search Console integration only with explicit OAuth/token design and read-only scope review.
6. Hosted SaaS exploration with separate auth, data custody, and remote execution design.
7. More framework support without broadening `WRITE_POLICY_V1` by default.

## Recommended immediate next pass

npm scope control confirmation and package-name transition planning. Package-root readiness, non-publishing preflight gates, and unreleased notes are complete. Confirm authenticated control of `@shipready` or approve the fallback, then explicitly authorize any package-name transition. Do not publish until owner approval names the exact package, version, and release mechanism.
