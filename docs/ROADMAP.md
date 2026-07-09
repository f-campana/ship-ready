# Roadmap

## Original Roadmap Status

The original 18-pass ShipReady roadmap is **complete and closed**. The closure/release-readiness pass is complete as the v0 checkpoint in [RELEASE_READINESS.md](RELEASE_READINESS.md), and the v0 packaging/distribution decision is complete in [DISTRIBUTION.md](DISTRIBUTION.md).

Order remains contractual for future work: harden CLI interfaces before wrapping them, ship read-only integrations before mutation, and defer broader write surfaces until policy and evidence exist. “Write-bearing” means a future pass can create project artifacts or mutate external state after explicit design and authorization; it does not authorize that work now.

## Completed Passes

| Pass | Status | Goal | Risk | Prior dependency |
|---:|---|---|---|---|
| 1 | Complete | Close the voiceover decision and preserve the silent fallback. | Read-only/media | None |
| 2 | Complete | Consolidate agent-first operational documentation. | Read-only/docs | Pass 1 |
| 3 | Complete | Harden CLI JSON, errors, versions, and compatibility contracts. | Read-only contract | Pass 2 |
| 4 | Complete | Specify MCP tools, schemas, authorization, failure behavior, lifecycle, and tests in [MCP_PLAN.md](MCP_PLAN.md). | Read-only/spec | Pass 3 |
| 5 | Complete | Implement the strictly read-only MCP tools, resources, and prompts specified in [MCP_PLAN.md](MCP_PLAN.md). | Read-only | Pass 4 |
| 6 | Complete | Wrap the existing guarded V1 write through MCP. | Write-bearing | Pass 5 |
| 7 | Complete | Polish CLI UX and define `doctor`/`status` contracts. | Read-only | Pass 3 |
| 8 | Complete | Research and specify Search Console readiness boundaries in [SEARCH_CONSOLE_READINESS_SPEC.md](SEARCH_CONSOLE_READINESS_SPEC.md). | Read-only/spec | Pass 7 |
| 9 | Complete | Prototype mock-backed read-only Search Console status. | Read-only | Pass 8 |
| 10 | Complete | Specify DNS readiness checks and provider-neutral evidence in [DNS_READINESS_SPEC.md](DNS_READINESS_SPEC.md). | Read-only/spec | Pass 7 |
| 11 | Complete | Implement read-only DNS checks. | Read-only | Pass 10 |
| 12A | Complete | Package current capabilities as the repository-local [ShipReady Launch Readiness skill](../skills/shipready-launch-readiness/SKILL.md). | Read-only/docs | Pass 11 |
| 12 | Complete | Implement the external deployment handoff and read-only live recheck in [POST_WRITE_RECHECK.md](POST_WRITE_RECHECK.md). | Read-only | Pass 6 |
| 13 | Complete | Add a social preview simulator. | Read-only | Pass 3 |
| 14 | Complete | Detect generated-site implementation smells. | Read-only | Pass 3 |
| 15 | Complete | Add a bounded multi-page crawl. | Read-only | Pass 3 |
| 16 | Complete | Revisit and polish the GUI. | Read-only | Passes 7, 13-15 |
| 17 | Complete | Export reviewed patches as explicit artifacts. | Write-bearing artifact | Passes 6, 16 |
| 18 | Complete | Add GitHub PR draft / PR handoff artifacts. | Read-only artifact | Pass 17 |
| Closure | Complete | Add the v0 release-readiness checkpoint and align docs/status with current product state. | Read-only/docs | Pass 18 |
| Distribution | Complete | Decide v0 remains source-checkout-only, document from-anywhere usage, verify developer-local linking, and defer npm/binary/hosted distribution. | Read-only/docs | Closure |
| Terminal output polish | Complete | Polish existing human terminal output with verdict/target/next-action headers, compact findings, safety labels, and source-checkout-friendly plain text. No new dependency, aggregate command, or interactive TUI was added. | Read-only | Distribution |
| TUI viewer | Complete | Implement a minimal dependency-free terminal review viewer over `ui-report-v1` with CI/non-TTY fallback, optional read-only includes, safety sections, and no JSON contract or write-policy changes. | Read-only | Terminal output polish |
| TUI framework evaluation | Complete | Evaluate whether to keep the current dependency-free TUI, improve it manually, or adopt Ink/OpenTUI. Recommendation: improve the current TUI manually before any framework adoption. | Read-only/docs | TUI viewer |
| Package publish preparation | Complete | Add package metadata, MIT license posture, package files whitelist, local package-smoke automation, and publish blockers while keeping publication blocked. | Read-only/package/docs | Distribution |
| Package publish decision | Complete | Incorporate owner publish decisions: prefer `@shipready/cli`, keep bin `shipready`, use MIT, keep CLI-only/no-postinstall/private posture, add package-smoke workflow, and keep publish execution blocked. | Read-only/docs | Package publish preparation |
| Publish readiness closure | Complete | Add blocker ledger, public package safety review, publish runbook, package smoke script, and package-smoke CI workflow without publishing. | Read-only/package/docs/CI | Package publish decision |

## TUI Feasibility Decision

Decision: `Implement minimal TUI now`.

The terminal output polish pass already solved the immediate readability issue for non-interactive logs. The TUI implementation shipped only because it stayed small, dependency-free, read-only, testable, backed by `ui-report-v1`, and safe in CI/non-TTY contexts. It does not add a new readiness engine, aggregate `review` command, JSON contract, GUI/browser behavior, write executor, deploy path, Git/GitHub behavior, DNS writes, live Search Console behavior, social platform APIs, telemetry, auth/accounts/billing, remote MCP, or any broadening of `WRITE_POLICY_V1`.

## TUI Framework Evaluation

Decision: `Improve current TUI manually`.

[TUI_FRAMEWORK_EVALUATION.md](TUI_FRAMEWORK_EVALUATION.md) evaluated the existing dependency-free TUI, Ink, and OpenTUI. The current TUI is safe and functional but still visually close to a plain terminal report. A second manual pass should improve layout, section rendering, borders, spacing, keyboard handling, and render snapshots without adding dependencies or changing product behavior.

Ink is the plausible future conservative framework if manual polish hits a ceiling, but it would add React and a larger terminal-rendering dependency graph. OpenTUI has the strongest premium layout upside, but its native Zig core, TypeScript bindings, Bun examples, and Node FFI requirements make it too risky before an accepted package distribution story exists. Do not adopt either framework before a separate approved prototype.

## V0 Release Position

ShipReady v0 is a **local/agent release candidate**. It is a local, skill-guided launch-readiness engine for generated websites. It audits, explains, previews, exports, and hands off safe review artifacts while preserving strict mutation boundaries.

Do not present v0 as hosted SaaS, production SaaS, fully automated SEO repair, deployment automation, live GitHub automation, live Search Console integration, DNS management, social platform preview authority, or a general site editor.

## Next Roadmap Candidates

These candidates are future work only. None is implemented by the closed roadmap unless explicitly listed above.

1. Publish workflow wiring: confirm/control `@shipready`, update package-root lookup for the final package name if needed, draft release notes, and prepare an explicitly gated trusted-publishing workflow. This should not publish by default.
2. Publish execution plan, only after workflow/scope blockers are closed and owner approval names the exact release.
3. Manual TUI polish without dependencies, using the evaluation in [TUI_FRAMEWORK_EVALUATION.md](TUI_FRAMEWORK_EVALUATION.md).
4. Standalone binary exploration, including Playwright/browser, GUI asset, MCP stdio, artifact, and signing implications.
5. Live GitHub integration with explicit opt-in, GitHub auth/token design, Git worktree safety checks, and mutation tests.
6. Live Search Console integration with explicit OAuth/token custody design and read-only scope review.
7. Hosted SaaS exploration with separate auth, data custody, remote execution, billing, and account-boundary design.
8. More framework support, without broadening `WRITE_POLICY_V1` by default.
9. Stronger demo/reporting package for the local/agent release story.

## Future-Pass Rules

- Update [STATUS.md](STATUS.md), [COMMANDS.md](COMMANDS.md), [CONTRACTS.md](CONTRACTS.md), applicable policy, tests, and validation evidence when a future pass ships.
- Label every planned command or integration as future until implemented and validated.
- Do not broaden `WRITE_POLICY_V1` incidentally.
- Preserve the GUI read-only boundary and `POST /api/fix = 404` unless a separate, explicit product decision changes that boundary.
- Preserve stdio-only MCP unless a remote-transport threat model and implementation pass is approved.
