# Release Readiness

Checkpoint date: 2026-07-08

Classification: **v0 local/agent release candidate**.

ShipReady v0 is a local, skill-guided launch-readiness engine for generated websites. It audits, explains, previews, exports, and hands off safe review artifacts while preserving strict mutation boundaries. It is not a hosted SaaS product, deployment system, DNS manager, Search Console integration, GitHub bot, or fully automated SEO fixer.

## Current product shape

- CLI first: `pnpm shipready ...` is the source of truth.
- MCP second: the local stdio MCP server wraps stable CLI contracts and has exactly one guarded V1 crawl-file write tool.
- GUI third: the loopback-only review cockpit makes the engine understandable to humans and remains read-only.
- Write policy: `WRITE_POLICY_V1` is canonical and remains limited to creation-only missing robots/sitemap files.
- Release posture: ready to present as a v0 local/agent release candidate after the validation matrix in this checkpoint passed.

`agents/openai.yaml` was requested for inspection but is absent in this checkout. No agent integration file was added during this closure pass.

## Implemented surfaces

- `status` and `doctor` local diagnostics.
- Single-page public URL audit.
- Bounded same-origin multi-page crawl.
- Repository inspection.
- Fix planning and exact dry-run previews.
- Guarded CLI write for V1-eligible missing crawl files only.
- Review-only patch export.
- Review-only GitHub PR draft handoff.
- Read-only post-write recheck.
- Read-only social preview simulator.
- Read-only generated-site implementation smell detector.
- Mock-backed Search Console status prototype.
- Read-only DNS readiness status.
- `ui-report` JSON normalization and static `html-report` output.
- Local read-only GUI review cockpit.
- Local stdio MCP server with read-only tools, canonical reads, prompts, and one safe-write wrapper.
- Repository-local ShipReady Launch Readiness skill.

## Command matrix

Use ShipReady from this repository checkout:

```bash
cd /Users/fabiencampana/Documents/ship-ready && pnpm shipready <command>
pnpm --dir /Users/fabiencampana/Documents/ship-ready shipready <command>
```

Do not imply `pnpm dlx`, global installation, or package publishing for this checkout.

| Command | Purpose | Read/write class | Contract | Network behavior | Repo behavior and safety boundary | Status |
|---|---|---|---|---|---|---|
| `status` | Static capability and safety inventory | Local read-only | `shipready.status.v1` with `--json` | None | Reads no target repo; writes nothing | Implemented |
| `doctor` | Bounded local runtime/content readiness checks | Local read-only | `shipready.doctor.v1` with `--json` | None | Reads package/docs/fixtures/dependencies only; writes nothing | Implemented |
| `audit <url>` | Audit one public HTTP(S) page | Network read-only | `shipready.audit.v1` with `--json` | Fetches URL, crawl resources, optional rendered pass | No repo required; not a crawler or outcome guarantee | Implemented |
| `inspect-repo <path>` | Detect local project shape and supported fix surfaces | Local read-only | `shipready.repoInspection.v1` with `--json` | None | Bounded scan; no writes | Implemented |
| `plan-fixes <path> --url <url>` | Combine audit and repo inspection into fix plan | Network/local read-only | `shipready.fixPlan.v1` with `--json` | Reads URL and optional rendered page | Reads repo; plan fields are not authorization | Implemented |
| `fix <path> --url <url> --dry-run` | Generate exact file-change previews | Network/local read-only | `shipready.dryRunFix.v1` with `--json` | Reads URL and optional rendered page | Reads repo; `wroteFiles: false`; mandatory before any write | Implemented |
| `fix <path> --url <url> --write --allow-create` | Create only eligible missing crawl files | Guarded target-repo write | `shipready.writeFix.v1` with `--json` | Reads URL while regenerating preview | Writes only V1-eligible missing robots/sitemap files; no overwrites, metadata, content, JSON-LD, Git, deploy, DNS, or provider mutation | Implemented |
| `patch-export <path> --url <url>` | Export dry-run changes as review-only patch text/file | Artifact write or stdout; no target repo mutation | `shipready.patchExport.v1` with `--json` | Reads URL while regenerating dry-run | Requires output outside inspected repo or `--stdout`; never applies patches | Implemented |
| `github-pr-draft <path> --url <url>` | Generate PR title/body/checklists and copyable command text | Artifact write or stdout; no target repo mutation | `shipready.githubPrDraft.v1` with `--json` | Reads URL while regenerating dry-run/patch evidence | Requires output outside inspected repo or `--stdout`; no GitHub API, `gh`, Git, branch, commit, push, PR, deploy, or patch application | Implemented |
| `recheck [path] --url <url>` | Compare live crawl-resource evidence with optional local expected files after external deployment | Network/optional local read-only | `shipready.recheck.v1` with `--json` | Reads live crawl resources | Optional repo inspection; never writes or deploys | Implemented |
| `search-console status --url <url>` | Deterministic Search Console status prototype | Mock-backed local read-only | `shipready.searchConsoleStatus.v1` with `--json` | No Google API calls | No repo required; no OAuth, tokens, property mutation, sitemap submission, or indexing request | Implemented mock |
| `dns status --url <url>` | DNS readiness observations | Read-only DNS/optional HTTP evidence | `shipready.dnsStatus.v1` with `--json` | Node DNS reads by default; optional HTTP canonical check; mocks for CI | No repo required; no provider credentials or DNS writes | Implemented |
| `social-preview --url <url>` | Simulate likely preview inputs from observed metadata | Network read-only or deterministic mock | `shipready.socialPreview.v1` with `--json` | Reads one URL unless mock-backed | No repo required; no platform APIs, screenshots, image generation, tokens, writes, or exact rendering guarantee | Implemented |
| `smells <path>` | Detect heuristic generated-site implementation signals | Local read-only or optional network read | `shipready.generatedSiteSmells.v1` with `--json` | Optional one-page URL evidence | Bounded repo scan; not authorship proof and no auto-fixes | Implemented |
| `crawl --url <url>` | Sample a small same-origin set of launch-readiness pages | Network read-only or deterministic mock | `shipready.crawl.v1` with `--json` | Bounded URL/sitemap/link reads | No repo required; not exhaustive, not monitoring, not indexing evidence | Implemented |
| `ui-report [path] --url <url>` | Normalize URL-only or repo-backed evidence for UI consumers | Network/optional local read-only | `shipready.uiReport.v1` with `--json` | Reads URL | Optional repo read; no writes | Implemented |
| `html-report [path] --url <url> --output <file>` | Write a self-contained static HTML review artifact | Explicit report-file write | None | Reads URL | Writes only requested HTML output path; does not mutate inspected repo | Implemented |
| `gui` | Start local review cockpit | Local HTTP read-only surface | None | GUI-triggered review reads URL/on-demand evidence | Loopback-only; `POST /api/review` and compatibility `POST /api/ui-report`; no write endpoint; `POST /api/fix` returns 404 | Implemented |
| `mcp --allow-root <path>` | Start local stdio MCP server | Stdio server with read-only tools plus one guarded write tool | Tool outputs preserve named contracts | Tool-dependent | Allowed-root required for repo tools; stdio-only; no remote transport | Implemented |

## Contract matrix

| Contract | Producer command/tool | Consumers | Stability notes | Read/write behavior | Fixture coverage |
|---|---|---|---|---|---|
| `shipready.status.v1` | `status --json` | CLI users, status tests, fixtures | V1 static capability boundary | Local read-only | `status.default.json` |
| `shipready.doctor.v1` | `doctor --json` | CLI users, doctor tests, fixtures | V1 local readiness boundary | Local read-only | `doctor.default.json` |
| `shipready.audit.v1` | `audit --json`, MCP `shipready.audit_site` | Planning, UI normalization, MCP, fixtures | V1 page audit boundary | Network read-only | `audit.clean.json`, `audit.needs-work.json` |
| `shipready.repoInspection.v1` | `inspect-repo --json`, MCP `shipready.inspect_repo` | Planning, UI normalization, MCP, fixtures | V1 repo inspection boundary | Local read-only | `inspect-repo.next-app.json`, `inspect-repo.vite.json` |
| `shipready.fixPlan.v1` | `plan-fixes --json`, MCP `shipready.plan_fixes` | Dry-run, UI normalization, MCP, fixtures | V1 planning boundary | Network/local read-only | `plan-fixes.safe-apply.json`, `plan-fixes.review-required.json` |
| `shipready.dryRunFix.v1` | `fix --dry-run --json`, MCP `shipready.preview_fixes` | Write validation, patch export, PR draft, UI, MCP | V1 dry-run boundary; MCP adds non-CLI `previewReceipt` when eligible | Network/local read-only | `fix-dry-run.*.json` |
| `shipready.writeFix.v1` | `fix --write --allow-create --json`, MCP `shipready.write_safe_crawl_files` | Write reports, MCP safe-write wrapper, fixtures | V1 policy-bound mutation result | Creation-only crawl-file writes | `fix-write.*.json` |
| `shipready.uiReport.v1` | `ui-report --json`, MCP `shipready.get_ui_report` | GUI, static HTML, MCP, fixtures | V1 CLI boundary plus `schemaVersion: "ui-report-v1"` | Network/optional local read-only | `ui-report.safe-apply.json`, `ui-report.url-only.json` |
| `shipready.searchConsoleStatus.v1` | `search-console status --json`, MCP `shipready.search_console_status` | CLI/MCP users, fixtures, GUI on-demand review | V1 mock prototype boundary | Mock-backed local read-only | `search-console.*.json` |
| `shipready.dnsStatus.v1` | `dns status --json`, MCP `shipready.dns_status` | CLI/MCP users, fixtures, GUI on-demand review | V1 DNS readiness boundary | DNS/optional HTTP read-only or mock | `dns.*.json` |
| `shipready.recheck.v1` | `recheck --json`, MCP `shipready.recheck` | CLI/MCP users, fixtures, GUI on-demand review | V1 post-write follow-up boundary | Network/optional local read-only | `recheck.*.json` |
| `shipready.socialPreview.v1` | `social-preview --json`, MCP `shipready.social_preview` | CLI/MCP users, fixtures, GUI on-demand review | V1 simulated preview boundary | Network read-only or mock | `social-preview.*.json` |
| `shipready.generatedSiteSmells.v1` | `smells --json`, MCP `shipready.generated_site_smells` | CLI/MCP users, fixtures, GUI on-demand review | V1 heuristic smell boundary | Local read-only, optional URL read, or mock | `generated-site-smells.*.json` |
| `shipready.crawl.v1` | `crawl --json`, MCP `shipready.crawl_site` | CLI/MCP users, fixtures, GUI on-demand review | V1 bounded crawl boundary | Network read-only or mock | `crawl.*.json` |
| `shipready.patchExport.v1` | `patch-export --json`, MCP `shipready.export_patch` | CLI/MCP users, PR draft, fixtures | V1 review export boundary | Explicit CLI artifact write or stdout; MCP inline no-write | `patch-export.*.json` |
| `shipready.githubPrDraft.v1` | `github-pr-draft --json`, MCP `shipready.github_pr_draft` | CLI/MCP users, fixtures, copy-only GUI handoff text | V1 review handoff boundary | Explicit CLI artifact write or stdout; MCP inline no-write | `github-pr-draft.*.json` |
| `shipready.error.v1` | JSON action failures and MCP boundary errors | CLI/MCP users, tests, fixtures | V1 error boundary; Commander pre-action gaps documented | No additional effects | `error.invalid-url.json` |

## MCP surface

MCP remains local stdio-only. It does not expose HTTP, SSE, remote auth, remote transport, provider credentials, OAuth, or arbitrary write paths.

Read-only tools:

- `shipready.audit_site`
- `shipready.crawl_site`
- `shipready.search_console_status`
- `shipready.dns_status`
- `shipready.recheck`
- `shipready.social_preview`
- `shipready.generated_site_smells`
- `shipready.export_patch`
- `shipready.github_pr_draft`
- `shipready.inspect_repo`
- `shipready.plan_fixes`
- `shipready.preview_fixes`
- `shipready.get_ui_report`
- `shipready.get_contract_fixture`
- `shipready.get_policy_doc`

Sole write tool:

- `shipready.write_safe_crawl_files`

Repo-capable tools require allowed-root authorization before local inspection or inline review artifacts are produced. The safe-write wrapper also requires a fresh `shipready.preview_fixes` receipt, same URL, same authorized canonical repo path, and exact confirmation `CREATE_SAFE_CRAWL_FILES_ONLY`. The wrapper regenerates the current dry-run and validates `WRITE_POLICY_V1` before creating only eligible missing robots/sitemap files.

## GUI surface

- Runs only on loopback hosts (`127.0.0.1`, `localhost`, or `::1`).
- Serves `/`, static local CSS/JS, `POST /api/review`, and compatibility `POST /api/ui-report`.
- `POST /api/review` returns a compact `ui-review-v1` aggregate and drives the client.
- `POST /api/ui-report` remains available for `ui-report-v1` compatibility.
- `POST /api/fix` is absent and must return 404.
- Social preview, bounded crawl, generated-site smells, DNS, Search Console mock status, and recheck are on-demand read-only sections.
- Safe crawl-file creation, patch export, and PR draft handoff are copy-only CLI handoffs in the GUI. The GUI does not execute them.
- No GUI write execution, deploy, Git, GitHub API, provider API, DNS write, Search Console live call, social platform API, OAuth, token storage, metadata write, content write, JSON-LD write, package write, or config write is implemented.

## Write policy

`docs/WRITE_POLICY_V1.md` remains canonical and unchanged in meaning. The only product write mode is creation-only and may create eligible missing robots/sitemap files at exact framework-aware allowlisted paths. Patch export and PR draft handoff are separate review artifacts. They do not apply patches, create PRs, run Git, create branches, commit, push, deploy, or authorize target-repo mutation.

## Safety boundaries

- GUI remains local and read-only.
- `POST /api/fix` remains 404.
- GUI may copy guarded commands but must not execute writes.
- MCP remains stdio-only.
- MCP has exactly one target-repo write tool: `shipready.write_safe_crawl_files`.
- MCP write remains limited to creation-only robots/sitemap files.
- Patch export is review-only and does not apply patches.
- GitHub PR draft is review-only and does not call GitHub or Git.
- No metadata/content/JSON-LD writes are applied.
- No live GitHub PR creation, branch creation, commit, push, or target-repo Git execution is implemented.
- No deployments or deploy-provider integrations are implemented.
- No Search Console live behavior, OAuth, token storage, provider mutation, or DNS writes are implemented.
- Search Console remains mock-backed only.
- DNS readiness is read-only.
- Post-write recheck is read-only and does not deploy.
- Social preview simulator is read-only and platform-API-free.
- Generated-site smell detector is read-only, heuristic, and authorship-neutral.
- Bounded crawl is read-only, same-origin, capped, and non-exhaustive.
- Fodmapp is not a write target for validation or demos.

## Known limitations

- No package distribution decision is complete for global or `pnpm dlx` usage.
- No hosted SaaS, accounts, billing, auth, or remote workspace model exists.
- No live Search Console provider exists.
- No DNS provider integration or DNS mutation exists.
- No live GitHub PR creation exists.
- No deployment automation exists.
- No metadata/content/JSON-LD write mode exists.
- No exhaustive crawler, scheduled monitoring, rank tracking, backlink analysis, traffic forecasting, or broad SEO dashboard exists.
- Social previews are approximations from observed metadata.
- Smell findings are heuristic implementation signals, not authorship or generator identity proof.
- Live URL, DNS, and rendered checks remain environment/network dependent.

## Validation status

Release-readiness validation for this checkpoint passed on 2026-07-08:

| Check | Status |
|---|---|
| `pnpm test` | Passed, 47 files and 400 tests |
| `pnpm typecheck` | Passed |
| `pnpm build` | Passed |
| `git diff --check` | Passed before staging; staged check required before commit |
| `pnpm shipready status --json` | Passed; reports next pass as `Packaging / distribution decision` |
| `pnpm shipready doctor --json` | Passed; `ok: true`, 20 pass, 0 warn/fail/skip |
| Representative CLI smokes | Passed: `audit`, `social-preview`, `crawl`, `smells`, `patch-export --stdout`, and `github-pr-draft --stdout` |
| MCP smoke | Passed: initialized stdio server, listed 16 tools, verified 15 read-only and sole write tool, called `shipready.crawl_site` |
| GUI smoke | Passed: `GET /`, `POST /api/review`, `POST /api/ui-report`, and `POST /api/fix = 404` |
| Claims scan | Passed with occurrences confined to forbidden-example lists, tests, or explicit negated limitations |
| Contract fixture validation | Passed through `pnpm test` and `doctor` fixture parsing |
| Target repo mutation guard | Passed: disposable patch-export/PR-draft repo hash unchanged |
| Fodmapp unchanged confirmation | Passed: `apps/marketing` status showed no changes |

## Demo / dogfood commands

Run from the repository checkout:

```bash
cd /Users/fabiencampana/Documents/ship-ready && pnpm shipready status --json
cd /Users/fabiencampana/Documents/ship-ready && pnpm shipready doctor --json
cd /Users/fabiencampana/Documents/ship-ready && pnpm shipready audit https://example.com --json
cd /Users/fabiencampana/Documents/ship-ready && pnpm shipready social-preview --url https://example.com --mock complete --json
cd /Users/fabiencampana/Documents/ship-ready && pnpm shipready crawl --url https://example.com --mock clean-small-site --json
cd /Users/fabiencampana/Documents/ship-ready && pnpm shipready smells . --mock clean --json
pnpm --dir /Users/fabiencampana/Documents/ship-ready shipready patch-export <temp-repo> --url https://example.com --stdout
pnpm --dir /Users/fabiencampana/Documents/ship-ready shipready github-pr-draft <temp-repo> --url https://example.com --stdout
pnpm --dir /Users/fabiencampana/Documents/ship-ready shipready gui
pnpm --dir /Users/fabiencampana/Documents/ship-ready --silent shipready mcp --allow-root /Users/fabiencampana/Documents/ship-ready
```

Use disposable temp repositories for patch export and PR draft validation. Do not use Fodmapp as a write target.

## Release blockers

No product-scope release blocker is known in the current codebase. The validation matrix passed and the existing safety boundaries were preserved.

## Release recommendation

Recommend presenting ShipReady as a **v0 local/agent release candidate**:

> ShipReady v0 is a local, skill-guided launch-readiness engine for generated websites. It audits, explains, previews, exports, and hands off safe review artifacts while preserving strict mutation boundaries.

Do not describe v0 as hosted SaaS, production SaaS, fully automated SEO repair, deployment automation, live GitHub automation, live Search Console integration, DNS management, or social platform preview authority.

## Next roadmap

1. Packaging / distribution decision.
2. Terminal output polish / TUI viewer.
3. Live GitHub integration with explicit opt-in, auth, Git worktree safety, and mutation tests.
4. Live Search Console integration with explicit OAuth/token design and read-only scope review.
5. Hosted SaaS exploration with a separate auth, data custody, and remote execution design.
6. More framework support without broadening `WRITE_POLICY_V1` by default.
7. Stronger demo/reporting package for the local/agent release story.

## Recommended immediate next pass

Packaging / distribution decision. Decide whether v0 stays source-checkout-only, ships a packaged binary, supports `pnpm dlx`, or exposes another installation path. Do this before implying global install, package publish, hosted access, or remote agent availability.
