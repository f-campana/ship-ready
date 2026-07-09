# Agent Runbook

## Project identity

ShipReady is **a CLI-first, agent-friendly launch-readiness engine for generated websites**.

Operating hierarchy: **CLI first. MCP second. GUI third. The CLI is the source of truth. MCP wraps stable CLI contracts. The GUI makes the engine understandable to humans.**

Primary readers are Codex, Claude Code, Cursor, and future MCP clients; human developers and product reviewers follow. Keep changes operational, bounded, testable, and compatible with limited agent context.

For launch-readiness operations, start with the repository-local [ShipReady Launch Readiness skill](../skills/shipready-launch-readiness/SKILL.md). It provides the concise command/MCP workflow, write checklist, reporting template, troubleshooting, and examples; this runbook remains the repository maintenance contract.

## Current architecture

- `src/cli/index.ts`: implemented commands, flags, modes, and exit behavior.
- `src/audit/`: public-URL fetch, rendered pass, metadata/crawl checks, and scoring.
- `src/crawl/`: read-only bounded same-origin multi-page crawl, link/sitemap discovery, page audit summaries, metadata consistency aggregation, repeated findings, and deterministic mock scenarios.
- `src/socialPreview/`: read-only simulated preview builder and deterministic mock scenarios built from observed audit metadata.
- `src/smells/`: read-only generated-site implementation smell detector, bounded repo scanner, deterministic mocks, and no authorship identification or auto-fixes.
- `src/repo/`: bounded read-only repository inspection.
- `src/plan/`: audit-to-fix planning.
- `src/fix/`: dry-run previews and guarded V1 creation-only writes.
- `src/patchExport/`: review-only patch artifacts generated from the current dry-run preview.
- `src/githubPrDraft/`: review-only GitHub PR draft / handoff artifacts generated from dry-run and patch-export evidence.
- `src/recheck/`: read-only local-versus-live crawl-file comparison after external deployment.
- `src/types/`: Zod schemas and TypeScript result contracts.
- `src/report/`: human, JSON, UI, and static HTML formatting.
- `src/ui/`: normalized `ui-report-v1` creation.
- `src/gui/`: loopback-only local server, `ui-review-v1` GUI aggregate, and read-only preview/copy-only browser cockpit.
- `src/mcp/`: local stdio adapter, fifteen read-only tools, one guarded safe-write tool, preview receipts, canonical reads, prompts, authorization, errors, and deadlines.
- `src/status/` and `src/doctor/`: static capability posture and bounded local readiness diagnostics.
- `src/searchConsole/`: stable read-only status boundary and deterministic mock provider; no OAuth, tokens, or live Google client.
- `src/dns/`: read-only DNS readiness status, live Node DNS resolver, deterministic mock scenarios, redacted TXT evidence, and no provider integration or DNS writes.
- `scripts/demo/`: Fodmapp recording, captions, optional voice, and composition.
- `validation/`: contract fixtures, reports, reviews, and approved demo artifacts.

## Recommended reading order

1. `README.md`
2. `skills/shipready-launch-readiness/SKILL.md` for operating ShipReady
3. `docs/AGENT_RUNBOOK.md`
4. `docs/STATUS.md`
5. `docs/RELEASE_READINESS.md`
6. `docs/DISTRIBUTION.md`
7. `docs/PACKAGE_PUBLISH_DECISION.md` before any package publish planning
8. `docs/COMMANDS.md`
9. `docs/CONTRACTS.md`
10. `docs/MCP_PLAN.md` before any MCP work
11. `docs/WRITE_POLICY_V1.md` for any fix or write work
12. `docs/CLAIMS_POLICY.md` for UI, demo, report, or public copy
13. `docs/SEARCH_CONSOLE_READINESS_SPEC.md` before any Search Console or Google OAuth work
14. `docs/DNS_READINESS_SPEC.md` before any DNS/domain-readiness work
15. `docs/POST_WRITE_RECHECK.md` before post-write follow-up work
16. `docs/LOCAL_FIRST_GUI_SPEC.md` for GUI direction
17. `docs/DEMO.md` for demo work
18. `docs/ROADMAP.md` for sequencing

## Before any implementation

1. Read README.md.
2. Read docs/AGENT_RUNBOOK.md.
3. Read docs/WRITE_POLICY_V1.md before any write-related change.
4. Inspect package.json for actual commands.
5. Run targeted tests before changing behavior.
6. Preserve CLI as source of truth.
7. Do not broaden safe writes without updating policy and tests.

For MCP work, read [MCP_PLAN.md](MCP_PLAN.md) first. The implemented Pass 6 server has exactly one write tool, `shipready.write_safe_crawl_files`. It may create only current V1-eligible missing robots/sitemap files after `shipready.preview_fixes` returns a fresh signed preview receipt, the repository path is re-authorized, and the caller supplies the exact confirmation phrase `CREATE_SAFE_CRAWL_FILES_ONLY`. Do not add any other MCP write tool or broaden this wrapper.

For Search Console work, read [SEARCH_CONSOLE_READINESS_SPEC.md](SEARCH_CONSOLE_READINESS_SPEC.md) first. Pass 9 implements only a deterministic mock provider behind `shipready.searchConsoleStatus.v1`; it does not implement live OAuth, token custody, or Google API calls. Keep live unauthenticated evidence, future authorized Search Console evidence, and ownership verification separate. Mock URL inspection is opt-in and single-URL. Property creation, verification, DNS, sitemap submission, indexing requests, token exposure, and remote account custody remain outside the prototype.

For DNS readiness work, read [DNS_READINESS_SPEC.md](DNS_READINESS_SPEC.md) first. Pass 11 implements `pnpm shipready dns status --url <url> --json`, `shipready.dnsStatus.v1`, and read-only MCP tool `shipready.dns_status`. It uses Node DNS APIs and deterministic mocks; it does not add DNS writes, provider credentials, registrar/nameserver APIs, Search Console live behavior, OAuth, remote MCP, or GUI changes.

For post-write follow-up, read [POST_WRITE_RECHECK.md](POST_WRITE_RECHECK.md). Pass 12 implements read-only `recheck` and MCP `shipready.recheck`. Local files still require deployment through the owner's external workflow. Repo-backed recheck authorizes/inspects the repository and compares only inferred V1-safe expected crawl-file presence with live conventional URLs; it never writes or deploys.

For social preview work, use `pnpm shipready social-preview --url <url> --json` or MCP `shipready.social_preview`. Pass 13 implements a simulated preview from observed raw/rendered metadata only. It does not use social platform APIs, platform scraping endpoints, screenshots, image generation, deployment, OAuth, token storage, or provider integrations, and it does not provide a precise third-party rendering guarantee.

For generated-site implementation smell work, use `pnpm shipready smells <path> --json` or MCP `shipready.generated_site_smells`. Pass 14 implements heuristic implementation signals for repo-level launch-readiness risks such as client-only metadata, weak SPA raw HTML, placeholder copy, default starter boilerplate, missing referenced public assets, local/example URLs, and unclear framework shape. Findings are not proof of authorship, generator identity, or site quality. The detector is read-only, bounded, skips environment files and build/dependency output, and does not run fix mode, write files, deploy, call provider APIs, mutate DNS/Search Console, call social platform APIs, use OAuth, store tokens, or broaden `WRITE_POLICY_V1`.

For bounded multi-page crawl work, use `pnpm shipready crawl --url <url> --json` or MCP `shipready.crawl_site`. Pass 15 implements a read-only same-origin sample from one public HTTP(S) URL, capped at `maxPages <= 25` and `maxDepth <= 2`. It audits selected pages through the existing single-page audit logic, reports compact page summaries, repeated findings, metadata consistency, skipped URL reasons, limits, limitations, and next actions. It is not exhaustive coverage, monitoring, broad analytics, indexing evidence, complete broken-link scanning, security scanning, accessibility auditing, or a write surface.

For patch export work, use `pnpm shipready patch-export <path> --url <url> --output /tmp/shipready.patch --json` or MCP `shipready.export_patch`. Pass 17 implements review-only unified-diff artifacts generated from the current dry-run preview. CLI file output must be an explicit path outside the inspected repository, while `--stdout` and MCP inline output write no files. Patch export never invokes write mode, applies patches, mutates the target repository, stages/commits/pushes, opens pull requests, deploys, writes DNS, calls provider APIs, calls live Search Console, handles OAuth/tokens, or broadens `WRITE_POLICY_V1`. Review-required changes may be exported because nothing is applied; they remain human-review items.

For GitHub PR draft work, use `pnpm shipready github-pr-draft <path> --url <url> --output /tmp/shipready-pr.md --json` or MCP `shipready.github_pr_draft`. Pass 18 implements only a review-only PR draft / handoff artifact with title, body, checklists, classifications, patch reference, and copyable command strings. It did not create a PR, branch, commit, push, deployment, GitHub update, or applied fix. It does not run Git, run `gh`, call the GitHub API, require GitHub auth, store tokens, apply patches, mutate the target repository, write DNS, call live Search Console, or broaden `WRITE_POLICY_V1`.

For GUI work, preserve the Pass 16 local review cockpit. The browser client fetches only `POST /api/review`; `POST /api/ui-report` remains a compatibility endpoint. Extra evidence sections are on-demand and read-only: social preview approximation, bounded crawl sample, generated-site smell signals, DNS status, Search Console mock status, and post-deploy recheck. The GUI may copy guarded CLI commands but must not execute `fix --write`, call `shipready.write_safe_crawl_files`, deploy, run Git/GitHub behavior, write DNS, call live Search Console or social platform APIs, or write metadata/content/JSON-LD/package/config files. `POST /api/fix` must remain absent and return `404`.

For distribution or installation questions, read [DISTRIBUTION.md](DISTRIBUTION.md). For package publish planning, read [PACKAGE_PUBLISH_DECISION.md](PACKAGE_PUBLISH_DECISION.md) and [PACKAGE_PUBLISH_BLOCKERS.md](PACKAGE_PUBLISH_BLOCKERS.md). Current usage remains repository-local. Do not recommend installed npm commands as supported distribution yet. Use `pnpm --dir /Users/fabiencampana/Documents/ship-ready shipready ...` from outside the checkout. `pnpm link --global` is verified only as a developer-local symlink after `pnpm build`. If npm publication is later approved, the current recommendation is `@shipready/cli` with bin `shipready`, fallback `@f-campana/shipready`, MIT license, no `postinstall`, CLI-only metadata, trusted publishing if feasible, public safety review, and repeatable package smoke before publish.

For terminal output work, preserve JSON contracts and keep changes in human formatters or the read-only TUI viewer unless a deliberate versioned contract decision is made. Current v0 human output is a plain-text terminal review experience: target/status/next action first, compact top findings, summarized passed checks, truncated long values, visible safety labels, and `--json` pointers. The `tui` command is implemented as a dependency-free read-only viewer over `ui-report-v1`, with CI/non-TTY fallback to plain output and no JSON contract. No aggregate `review` command is implemented; treat it as future until separately designed and tested.

## Main commands

```bash
cd /Users/fabiencampana/Documents/ship-ready
pnpm install
pnpm shipready status --json
pnpm shipready doctor --json
pnpm shipready search-console status --url https://example.com --mock ready_sitemap_ok --json
pnpm shipready dns status --url https://example.com --mock ready --json
pnpm shipready social-preview --url https://example.com --mock complete --json
pnpm shipready smells . --mock clean --json
pnpm shipready crawl --url https://example.com --mock clean-small-site --json
pnpm shipready audit <url> --json
pnpm shipready recheck [path] --url <url> --json
pnpm shipready inspect-repo <path> --json
pnpm shipready plan-fixes <path> --url <url> --json
pnpm shipready fix <path> --url <url> --dry-run --json
pnpm shipready patch-export <path> --url <url> --output /tmp/shipready.patch --json
pnpm shipready github-pr-draft <path> --url <url> --output /tmp/shipready-pr.md --json
pnpm shipready ui-report [path] --url <url> --json
pnpm shipready html-report [path] --url <url> --output <file>
pnpm shipready gui
pnpm --dir /Users/fabiencampana/Documents/ship-ready shipready audit https://example.com --json
pnpm --dir /Users/fabiencampana/Documents/ship-ready --silent shipready mcp --allow-root /absolute/workspace
```

Use `status` before assuming a capability or integration exists. Use `doctor` after installation and before workflows that require Playwright or MCP canonical content. Both are read-only, non-networked, require no target path, and must not be treated as evidence of indexing, DNS/Search Console state, deployment state, or live-site readiness.

When a human asks for terminal output, start with the default human command output or `tui` when section navigation is useful. Use `--json` only when a consumer needs the full versioned contract. Do not add ANSI-only signals, dependency-heavy terminal UI behavior, or a broad aggregate command as part of routine formatting work.

`dns status` is implemented as read-only advisory evidence. Use `--mock <scenario>` for deterministic tests and fixtures. Live mode reads DNS through Node built-ins; it does not write records, call provider APIs, use provider credentials, verify Search Console ownership, deploy, or mutate repositories.

`patch-export` is implemented as review-only artifact generation. Use `--output` only outside the inspected repository, or `--stdout` when no file should be written. It is not a patch application, Git, GitHub, PR, or deployment workflow.

`github-pr-draft` is implemented as review-only handoff generation. Use `--output` only outside the inspected repository, or `--stdout` when no file should be written. Generated GitHub CLI and Git commands are text only and are not executed by ShipReady.

The guarded write command exists but is not a routine validation command. Use it only with explicit instruction and the checks in the canonical write policy.

After an authorized local write, report that deployment remains external. Once the owner deploys, use `recheck` in URL-only or repo-backed mode. Treat unreachable live evidence as unknown and use “appears” deployment wording; never convert crawl-file visibility into a crawling or indexing claim. Smell findings remain review targets and never authorize auto-fixes.

MCP safe-write flow:

1. Call `shipready.preview_fixes` with the normalized URL and authorized repository path.
2. Review the `shipready.dryRunFix.v1` result and any `previewReceipt`.
3. Call `shipready.write_safe_crawl_files` only with the same URL, same authorized repo path, fresh receipt, and `confirmation: "CREATE_SAFE_CRAWL_FILES_ONLY"`.
4. Treat missing, expired, tampered, mismatched, or stale receipts as a hard stop.

## Validation commands

```bash
pnpm test
pnpm typecheck
pnpm build
git diff --check
```

Use targeted Vitest files during implementation, then the full commands when behavior or contracts change. Documentation-only work may omit product tests if no source, scripts, package files, or generated behavior changed.

## When changing CLI JSON outputs

Treat every implemented `--json` output as a versioned public boundary:

1. Read `docs/CONTRACTS.md` and identify the command's named contract before editing a result schema or formatter.
2. Preserve the current top-level shape and human output unless a deliberate versioned compatibility decision says otherwise. Do not introduce a generic success envelope incidentally.
3. Keep `contract`, mode/policy discriminators, `ui-report-v1`, error codes/messages, and the command-to-contract mapping synchronized in `src/types/contracts.ts`.
4. Update or add deterministic fixtures under `validation/contracts/`; regenerate current fixtures with `pnpm contracts:fixtures`.
5. Use only local test repositories and deterministic inputs. Any write-contract fixture must run against an operating-system temporary copy, never a real target repository.
6. Update focused boundary tests in `tests/contracts.test.ts`. Assert stable keys and state distinctions rather than volatile full-object snapshots.
7. Update `docs/CONTRACTS.md` and the affected command section in `docs/COMMANDS.md`, including exit behavior and fixture provenance.
8. Check downstream consumers: planning, dry-run/write validation, UI normalization, static HTML, GUI API/client, and demo artifacts. Internal consumers may use result types directly and must not be assumed to parse CLI envelopes.
9. Preserve stdout as one parseable JSON object for JSON action results/errors; keep human diagnostics on the human-output path.
10. For V1 changes, treat removed/renamed required fields, discriminator changes, semantic repurposing, and unreviewed enum additions as compatibility risks requiring a new-version decision.
11. Re-run `pnpm test`, `pnpm typecheck`, `pnpm build`, and `git diff --check`.

JSON contract work never authorizes broader writes. `docs/WRITE_POLICY_V1.md` remains canonical: eligibility, target paths, effects, and authorization must not change as a side effect of formatting. The GUI remains a read-only report/preview/copy surface; do not infer that a CLI field should add GUI write execution or a new endpoint.

Patch export contract work must preserve the dry-run source boundary. Do not add target-repo writes, patch application, Git/GitHub/PR/deploy behavior, provider calls, OAuth/token handling, or output paths inside inspected repositories by default.

GitHub PR draft contract work must preserve the review-handoff boundary. Do not add live PR creation, GitHub API calls, Git command execution, branch creation, commits, pushes, deployments, token handling, patch application, target-repo mutation, or output paths inside inspected repositories by default.

## Safety boundaries

- Default to read-only commands and `fix --dry-run`.
- Use `patch-export` only for review artifacts generated from dry-run previews; do not treat it as write authorization.
- Use `github-pr-draft` only for review artifacts and copyable command strings; do not treat it as GitHub or Git authorization.
- Treat any filesystem write, external mutation, secret use, Git action, or deployment as a separate authorization boundary.
- Never execute a copied guarded command merely because the GUI displays it.
- Never add GUI write execution; the local GUI is a read-only review surface and command-copy handoff only.
- Never call `shipready.write_safe_crawl_files` without a same-session preview receipt and exact confirmation phrase.
- Never use the Fodmapp marketing repository as a write target for demos or validation.
- The GUI may generate reports and copy a command; it cannot execute writes.
- Local changes do not affect a live site until the owner deploys them through their normal workflow.
- Recheck is strictly read-only and never invokes guarded write mode or deployment automation.

## Write-policy summary

The canonical contract is [WRITE_POLICY_V1.md](WRITE_POLICY_V1.md). V1 is creation-only, all-or-nothing, and limited to eligible missing `robots` and `sitemap` files at supported framework paths. Existing files, unsafe previews, review-required changes, paths outside the repo, and targets outside the exact allowlist block writes. Metadata, content, JSON-LD, dependency, config, Git, and deployment changes are outside V1.

## Demo-tooling boundaries

Demo scripts write media and recording artifacts under `validation/demo-fodmapp-recording-v2/`; they do not authorize product writes. Browser captions and the deterministic clipboard stub exist only in the recording script. Voice generation is optional and uses external credentials at runtime. See [DEMO.md](DEMO.md).

## Claims-policy summary

Describe observable launch-readiness, crawler/preview visibility, completeness, recommendations, previews, guarded commands, and deployment boundaries. Do not promise third-party outcomes. Apply [CLAIMS_POLICY.md](CLAIMS_POLICY.md) to documentation, reports, GUI copy, demos, and examples.

## Safe future-feature workflow

1. Confirm the roadmap pass and prior dependency.
2. Inventory current CLI/types/tests before proposing an interface.
3. Specify the CLI contract, error model, and safety boundary first.
4. Label every unimplemented command or integration as **Planned**.
5. Implement read-only behavior before any mutation wrapper.
6. Add contract fixtures and targeted failure tests.
7. Update commands, contracts, status, policy, and claims docs in the same change.
8. Verify downstream GUI/demo consumers without making them the source of truth.

## Forbidden unless explicitly requested

- metadata/content writes;
- JSON-LD writes;
- GUI write execution;
- GitHub PR creation;
- GitHub API calls;
- Git command execution, branch creation, commits, or pushes;
- deployments;
- DNS writes;
- Search Console mutation;
- DNS mutation or provider integration;
- secret handling;
- API key commits;
- SEO ranking claims;
- indexing guarantee claims.

Even with explicit instruction, work must remain within the active policy, repository scope, and tested command contract.

## Actions never allowed without explicit instruction

- Run `fix --write --allow-create` against any repository.
- Modify another checkout, including `/Users/fabiencampana/Documents/fodmapp/apps/marketing`.
- Change Git state, open a PR, publish, deploy, or call a mutating third-party API.
- Add or expose credentials.
- Expand writable file types or convert review-required previews into writable changes.
- Present a planned interface as implemented.

`search-console status` and `shipready.search_console_status` are implemented only through deterministic mock scenarios. Do not describe them as live Google support, pass credentials to them, or add a live provider before a separate OAuth/token-custody design and security review.
