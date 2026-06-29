# Agent Runbook

## Project identity

ShipReady is **a CLI-first, agent-friendly launch-readiness engine for generated websites**.

Operating hierarchy: **CLI first. MCP second. GUI third. The CLI is the source of truth. MCP wraps stable CLI contracts. The GUI makes the engine understandable to humans.**

Primary readers are Codex, Claude Code, Cursor, and future MCP clients; human developers and product reviewers follow. Keep changes operational, bounded, testable, and compatible with limited agent context.

## Current architecture

- `src/cli/index.ts`: implemented commands, flags, modes, and exit behavior.
- `src/audit/`: public-URL fetch, rendered pass, metadata/crawl checks, and scoring.
- `src/repo/`: bounded read-only repository inspection.
- `src/plan/`: audit-to-fix planning.
- `src/fix/`: dry-run previews and guarded V1 creation-only writes.
- `src/types/`: Zod schemas and TypeScript result contracts.
- `src/report/`: human, JSON, UI, and static HTML formatting.
- `src/ui/`: normalized `ui-report-v1` creation.
- `src/gui/`: local server and preview/copy-only browser UI.
- `src/mcp/`: local stdio adapter, eight read-only tools, one guarded safe-write tool, preview receipts, canonical reads, prompts, authorization, errors, and deadlines.
- `src/status/` and `src/doctor/`: static capability posture and bounded local readiness diagnostics.
- `src/searchConsole/`: stable read-only status boundary and deterministic mock provider; no OAuth, tokens, or live Google client.
- `scripts/demo/`: Fodmapp recording, captions, optional voice, and composition.
- `validation/`: contract fixtures, reports, reviews, and approved demo artifacts.

## Recommended reading order

1. `README.md`
2. `docs/AGENT_RUNBOOK.md`
3. `docs/STATUS.md`
4. `docs/COMMANDS.md`
5. `docs/CONTRACTS.md`
6. `docs/MCP_PLAN.md` before any MCP work
7. `docs/WRITE_POLICY_V1.md` for any fix or write work
8. `docs/CLAIMS_POLICY.md` for UI, demo, report, or public copy
9. `docs/SEARCH_CONSOLE_READINESS_SPEC.md` before any Search Console or Google OAuth work
10. `docs/LOCAL_FIRST_GUI_SPEC.md` for GUI direction
11. `docs/DEMO.md` for demo work
12. `docs/ROADMAP.md` for sequencing

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

## Main commands

```bash
pnpm shipready status --json
pnpm shipready doctor --json
pnpm shipready search-console status --url https://example.com --mock ready_sitemap_ok --json
pnpm shipready audit <url> --json
pnpm shipready inspect-repo <path> --json
pnpm shipready plan-fixes <path> --url <url> --json
pnpm shipready fix <path> --url <url> --dry-run --json
pnpm shipready ui-report [path] --url <url> --json
pnpm shipready html-report [path] --url <url> --output <file>
pnpm shipready gui
pnpm shipready mcp --allow-root /absolute/workspace
```

Use `status` before assuming a capability or integration exists. Use `doctor` after installation and before workflows that require Playwright or MCP canonical content. Both are read-only, non-networked, require no target path, and must not be treated as evidence of indexing, DNS/Search Console state, deployment state, or live-site readiness.

The guarded write command exists but is not a routine validation command. Use it only with explicit instruction and the checks in the canonical write policy.

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

## Safety boundaries

- Default to read-only commands and `fix --dry-run`.
- Treat any filesystem write, external mutation, secret use, Git action, or deployment as a separate authorization boundary.
- Never execute a copied guarded command merely because the GUI displays it.
- Never call `shipready.write_safe_crawl_files` without a same-session preview receipt and exact confirmation phrase.
- Never use the Fodmapp marketing repository as a write target for demos or validation.
- The GUI may generate reports and copy a command; it cannot execute writes.
- Local changes do not affect a live site until the owner deploys them through their normal workflow.

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
- deployments;
- DNS writes;
- Search Console mutation;
- secret handling;
- API key commits;
- SEO ranking claims;
- guaranteed indexing claims.

Even with explicit instruction, work must remain within the active policy, repository scope, and tested command contract.

## Actions never allowed without explicit instruction

- Run `fix --write --allow-create` against any repository.
- Modify another checkout, including `/Users/fabiencampana/Documents/fodmapp/apps/marketing`.
- Change Git state, open a PR, publish, deploy, or call a mutating third-party API.
- Add or expose credentials.
- Expand writable file types or convert review-required previews into writable changes.
- Present a planned interface as implemented.

`search-console status` and `shipready.search_console_status` are implemented only through deterministic mock scenarios. Do not describe them as live Google support, pass credentials to them, or add a live provider before a separate OAuth/token-custody design and security review.
