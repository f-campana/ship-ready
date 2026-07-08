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

## V0 Release Position

ShipReady v0 is a **local/agent release candidate**. It is a local, skill-guided launch-readiness engine for generated websites. It audits, explains, previews, exports, and hands off safe review artifacts while preserving strict mutation boundaries.

Do not present v0 as hosted SaaS, production SaaS, fully automated SEO repair, deployment automation, live GitHub automation, live Search Console integration, DNS management, social platform preview authority, or a general site editor.

## Next Roadmap Candidates

These candidates are future work only. None is implemented by the closed roadmap unless explicitly listed above.

1. TUI viewer feasibility / implementation for a true interactive terminal interface, with dependency, non-TTY fallback, accessibility, snapshot, and maintenance review.
2. npm/package publish preparation with the checklist in [DISTRIBUTION.md](DISTRIBUTION.md), packed-tarball smoke tests, and explicit publish authorization.
3. Standalone binary exploration, including Playwright/browser, GUI asset, MCP stdio, artifact, and signing implications.
4. Live GitHub integration with explicit opt-in, GitHub auth/token design, Git worktree safety checks, and mutation tests.
5. Live Search Console integration with explicit OAuth/token custody design and read-only scope review.
6. Hosted SaaS exploration with separate auth, data custody, remote execution, billing, and account-boundary design.
7. More framework support, without broadening `WRITE_POLICY_V1` by default.
8. Stronger demo/reporting package for the local/agent release story.

## Future-Pass Rules

- Update [STATUS.md](STATUS.md), [COMMANDS.md](COMMANDS.md), [CONTRACTS.md](CONTRACTS.md), applicable policy, tests, and validation evidence when a future pass ships.
- Label every planned command or integration as future until implemented and validated.
- Do not broaden `WRITE_POLICY_V1` incidentally.
- Preserve the GUI read-only boundary and `POST /api/fix = 404` unless a separate, explicit product decision changes that boundary.
- Preserve stdio-only MCP unless a remote-transport threat model and implementation pass is approved.
