# ShipReady

ShipReady is a CLI-first, agent-friendly launch-readiness engine for generated websites. It audits a public URL, inspects a local repository, plans fixes, previews file changes, and can create a narrow set of missing crawl files under an explicit V1 policy. **CLI first. MCP second. GUI third.** The CLI is the source of truth; the local stdio MCP server wraps stable CLI contracts and exposes exactly one guarded V1 write tool, while the GUI explains the engine to humans.

For an agent-ready operating workflow, use the repository-local [ShipReady Launch Readiness skill](skills/shipready-launch-readiness/SKILL.md). It packages current commands, MCP tools, safety gates, reporting guidance, and concise examples without expanding product behavior.

## Current status

Implemented: read-only `status` and `doctor` diagnostics, CLI audit and repo inspection, fix planning, dry-run previews, guarded creation-only writes, a read-only post-write recheck, UI and static HTML reports, a local preview/copy-only GUI, a local stdio MCP server, Fodmapp demo tooling, a deterministic mock-backed Search Console status prototype, and read-only DNS readiness status. MCP exposes ten read-only tools and exactly one guarded write tool for the same creation-only crawl-file policy. Live Search Console/OAuth, DNS provider writes/integrations, deployment automation/provider integrations, GitHub, accounts, billing, hosted SaaS, and remote MCP are not built.

## Core commands

```bash
pnpm install
pnpm shipready status
pnpm shipready doctor
pnpm shipready search-console status --url https://example.com --mock ready_sitemap_ok --json
pnpm shipready dns status --url https://example.com --mock ready --json
pnpm shipready audit https://example.com
pnpm shipready recheck --url https://example.com --json
pnpm shipready inspect-repo .
pnpm shipready plan-fixes . --url https://example.com
pnpm shipready fix . --url https://example.com --dry-run
pnpm shipready ui-report . --url https://example.com --json
pnpm shipready html-report . --url https://example.com --output validation/example.html
pnpm shipready gui
```

Use `--json` with `status`, `doctor`, `search-console status`, `dns status`, `recheck`, `audit`, `inspect-repo`, `plan-fixes`, `fix`, and `ui-report` for structured output. `recheck` is network-read-only and can optionally compare V1-safe local expected crawl files with live evidence; it never deploys. `search-console status` is mock-backed, deterministic, read-only, and makes no Google API or OAuth call. `dns status` uses read-only DNS lookups by default and deterministic mocks for CI/tests; it never writes DNS records or calls provider APIs. `status` is a static capability/safety inventory. `doctor` performs bounded local checks only and requires no network or deployment credentials. Neither status/doctor command deploys or proves indexing/DNS outcomes. See [docs/COMMANDS.md](docs/COMMANDS.md) for exact flags and behavior.

## Safe-write boundary

`fix --dry-run` writes nothing. The only implemented product write mode is:

```bash
pnpm shipready fix <path> --url <url> --write --allow-create
```

This guarded command may create only eligible, missing crawl files. It does not overwrite existing files or write metadata, content, JSON-LD, packages, configuration, Git state, or deployments. Read [docs/WRITE_POLICY_V1.md](docs/WRITE_POLICY_V1.md) before any write-related work. Preview first; do not run write mode without explicit instruction and a reviewed target.

After a permitted local write, deploy through the owner's normal external workflow. Then use [`recheck`](docs/POST_WRITE_RECHECK.md) to compare live evidence, optionally with the repository path. ShipReady does not perform that deployment.

## Local GUI

```bash
pnpm shipready gui
```

Open `http://127.0.0.1:4317`. The GUI calls `POST /api/ui-report`; it has no write endpoint and remains preview/copy-only. GUI direction lives in [docs/LOCAL_FIRST_GUI_SPEC.md](docs/LOCAL_FIRST_GUI_SPEC.md).

## Approved demo artifacts

- Canonical silent/captioned fallback: `validation/demo-fodmapp-voiceover-final/final-demo-silent.mp4`
- Optional approved voiced version: `validation/demo-fodmapp-voiceover-final/final-demo-with-voice.mp4`
- Final thumbnail and captions: `validation/demo-fodmapp-voiceover-final/thumbnail.png`, `validation/demo-fodmapp-voiceover-final/captions.srt`
- Approved share package: `validation/demo-fodmapp-share/`

See [docs/DEMO.md](docs/DEMO.md) for provenance, reproduction commands, and recording boundaries.

## Documentation index

1. [ShipReady Launch Readiness skill](skills/shipready-launch-readiness/SKILL.md) — agent operating workflow, boundaries, reports, and examples.
2. [Agent runbook](docs/AGENT_RUNBOOK.md) — repository operating contract and required reading order.
3. [Commands](docs/COMMANDS.md) — implemented CLI and demo command reference.
4. [Contracts](docs/CONTRACTS.md) — JSON/report types, consumers, and MCP hardening gaps.
5. [Write policy V1](docs/WRITE_POLICY_V1.md) — canonical creation-only write policy.
6. [Claims policy](docs/CLAIMS_POLICY.md) — approved and prohibited product language.
7. [Demo](docs/DEMO.md) — approved artifacts and recording workflow.
8. [Status](docs/STATUS.md) — implemented scope, omissions, and next pass.
9. [Roadmap](docs/ROADMAP.md) — ordered pass sequence.
10. [Local-first GUI spec](docs/LOCAL_FIRST_GUI_SPEC.md) — canonical GUI direction.
11. [Search Console readiness spec](docs/SEARCH_CONSOLE_READINESS_SPEC.md) — mock prototype contract and deferred live OAuth/provider boundary.
12. [DNS readiness spec](docs/DNS_READINESS_SPEC.md) — read-only DNS status checks and DNS claim boundaries.
13. [Post-write recheck](docs/POST_WRITE_RECHECK.md) — external deployment handoff and conservative live verification.

## What ShipReady is not

ShipReady is not an SEO dashboard, Lighthouse clone, Search Console replacement, deployment system, or unrestricted site editor. It does not promise crawler behavior, indexing, or ranking outcomes.

## Validation

```bash
pnpm test
pnpm typecheck
pnpm build
git diff --check
```

For documentation-only changes, `git diff --check` and focused path/claims checks are the minimum. Run tests, typecheck, and build whenever source, scripts, package behavior, generated behavior, or product contracts change.
