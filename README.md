# ShipReady

ShipReady is a CLI-first, agent-friendly launch-readiness engine for generated websites. It audits a public URL, inspects a local repository, plans fixes, previews file changes, and can create a narrow set of missing crawl files under an explicit V1 policy. **CLI first. MCP second. GUI third.** The CLI is the source of truth; future MCP clients should wrap stable CLI contracts, while the GUI explains the engine to humans.

## Current status

Implemented: CLI audit and repo inspection, fix planning, dry-run previews, guarded creation-only writes, UI and static HTML reports, a local preview/copy-only GUI, and Fodmapp demo tooling. MCP, Search Console, DNS, GitHub, deployment, accounts, billing, and hosted SaaS integrations are not built.

## Core commands

```bash
pnpm install
pnpm shipready audit https://example.com
pnpm shipready inspect-repo .
pnpm shipready plan-fixes . --url https://example.com
pnpm shipready fix . --url https://example.com --dry-run
pnpm shipready ui-report . --url https://example.com --json
pnpm shipready html-report . --url https://example.com --output validation/example.html
pnpm shipready gui
```

Use `--json` with `audit`, `inspect-repo`, `plan-fixes`, `fix`, and `ui-report` for structured output. See [docs/COMMANDS.md](docs/COMMANDS.md) for exact flags and behavior.

## Safe-write boundary

`fix --dry-run` writes nothing. The only implemented product write mode is:

```bash
pnpm shipready fix <path> --url <url> --write --allow-create
```

This guarded command may create only eligible, missing crawl files. It does not overwrite existing files or write metadata, content, JSON-LD, packages, configuration, Git state, or deployments. Read [docs/WRITE_POLICY_V1.md](docs/WRITE_POLICY_V1.md) before any write-related work. Preview first; do not run write mode without explicit instruction and a reviewed target.

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

1. [Agent runbook](docs/AGENT_RUNBOOK.md) — operating contract and required reading order.
2. [Commands](docs/COMMANDS.md) — implemented CLI and demo command reference.
3. [Contracts](docs/CONTRACTS.md) — JSON/report types, consumers, and MCP hardening gaps.
4. [Write policy V1](docs/WRITE_POLICY_V1.md) — canonical creation-only write policy.
5. [Claims policy](docs/CLAIMS_POLICY.md) — approved and prohibited product language.
6. [Demo](docs/DEMO.md) — approved artifacts and recording workflow.
7. [Status](docs/STATUS.md) — implemented scope, omissions, and next pass.
8. [Roadmap](docs/ROADMAP.md) — ordered 18-pass sequence.
9. [Local-first GUI spec](docs/LOCAL_FIRST_GUI_SPEC.md) — canonical GUI direction.

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
