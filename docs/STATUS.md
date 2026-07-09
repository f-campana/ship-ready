# Status

## Position

ShipReady is a CLI-first, agent-friendly launch-readiness engine for generated websites. **CLI first. MCP second. GUI third.** Agents are the primary operational audience; the GUI explains stable engine output to humans.

Release classification: **v0 local/agent release candidate**. The original 18-pass roadmap is closed; see [RELEASE_READINESS.md](RELEASE_READINESS.md) for the checkpoint, command matrix, contract matrix, validation status, and next roadmap.

Distribution classification: **source-checkout-only v0**. ShipReady is not published to npm, `pnpm dlx shipready` is not expected to work, and default global installation is not part of v0. The package preparation pass made ShipReady packable and locally smoke-testable from a tarball without authorizing publication; see [PACKAGE_PUBLISH_PREPARATION.md](PACKAGE_PUBLISH_PREPARATION.md) and [DISTRIBUTION.md](DISTRIBUTION.md).

## What exists

- Public single-page audit with raw and Playwright-rendered metadata comparison.
- Read-only bounded multi-page crawl with `shipready.crawl.v1`, same-origin discovery, strict max page/depth limits, repeated findings, metadata consistency summaries, skipped URL reasons, and deterministic mock scenarios.
- Read-only `status` capability inventory and bounded local `doctor` readiness checks, each with stable human and JSON output.
- Polished terminal review output for existing human CLI commands: verdict/target/next action first, compact top findings, summarized passed checks, truncated long metadata, and visible safety/limitation labels.
- TUI viewer: implemented read-only. `pnpm shipready tui --url https://example.com` and `pnpm shipready tui <path> --url https://example.com` reuse `ui-report-v1`, provide CI/non-TTY fallback to the plain UI report, and do not change JSON contracts or write behavior.
- Crawl-resource, metadata, social-preview, structure, accessibility, and launch-hygiene checks.
- Read-only `social-preview` simulator with `shipready.socialPreview.v1`, raw/rendered source modes, deterministic mock scenarios, and simulated Google/social/X/Slack/Discord/LinkedIn-style surfaces.
- Read-only generated-site implementation smell detector with `shipready.generatedSiteSmells.v1`, bounded repo scanning, optional single-page URL cross-check evidence, deterministic mock scenarios, and heuristic implementation signals rather than authorship identification.
- Bounded read-only repository inspection.
- Read-only fix planning and exact dry-run previews.
- Review-only patch export with `shipready.patchExport.v1`, unified-diff artifacts generated from the current dry-run, explicit output path/stdout modes, outside-target output guard, and MCP inline export.
- Review-only GitHub PR draft / PR handoff with `shipready.githubPrDraft.v1`, PR title/body/checklists, patch references, copyable command strings, explicit output path/stdout modes, outside-target output guard, and MCP inline output.
- Strict V1 creation-only writes for eligible missing crawl files.
- Read-only `recheck` in URL-only and repo-backed modes, with conservative local expected-file versus live crawl-resource evidence.
- Human and Zod-validated JSON outputs.
- Versioned `ui-report-v1` normalization and self-contained HTML reports.
- Local read-only GUI review cockpit with `POST /api/review`, compatibility `POST /api/ui-report`, on-demand social preview, bounded crawl, project smells, DNS, Search Console mock status, and recheck sections; safe crawl-file creation is copy-only and no write endpoint exists.
- Local MCP stdio server with fifteen read-only tools, one guarded safe-write tool for V1 crawl-file creations, canonical docs/fixtures, five prompts, explicit allowed roots, stable errors, preview receipts, and bounded deadlines.
- Fodmapp demo scripts, approved silent/captioned media, optional approved voiced media, thumbnail, captions, and review evidence.
- Stable `shipready.searchConsoleStatus.v1`, `search-console status`, seven deterministic mock scenarios, opt-in mock indexed-version inspection, and the read-only `shipready.search_console_status` MCP tool.
- Official-source-backed [Search Console readiness specification](SEARCH_CONSOLE_READINESS_SPEC.md) defining claim boundaries and the future live provider/OAuth boundary.
- Stable `shipready.dnsStatus.v1`, `dns status`, eleven deterministic DNS mock scenarios, redacted Search Console TXT-readiness checks, optional canonical-host evidence, and the read-only `shipready.dns_status` MCP tool.
- Official-source-backed [DNS readiness specification](DNS_READINESS_SPEC.md) defining read-only DNS checks and DNS claim boundaries.
- Repository-local [ShipReady Launch Readiness skill](../skills/shipready-launch-readiness/SKILL.md) packaging current CLI, MCP, GUI/report, Search Console mock, DNS, write-policy, claims, reporting, and troubleshooting workflows for agents.
- Practical [post-write recheck guide](POST_WRITE_RECHECK.md) that keeps deployment external and classifies network uncertainty without overclaiming.
- Source-checkout distribution decision with from-anywhere `pnpm --dir /Users/fabiencampana/Documents/ship-ready shipready ...` usage and a verified developer-local `pnpm link --global` path after `pnpm build`.
- Package publish preparation with conservative package metadata, no `postinstall` browser download, a reviewed `files` whitelist, and local packed-tarball smoke evidence while keeping v0 source-checkout-only.
- TUI framework evaluation in [TUI_FRAMEWORK_EVALUATION.md](TUI_FRAMEWORK_EVALUATION.md): current dependency-free TUI should receive one manual polish pass before any Ink/OpenTUI prototype.

When present, `validation/e2e-project-review/` supplies preserved end-to-end evidence for earlier surfaces, including its summary, feature matrix, safety report, and screenshot index. Treat [RELEASE_READINESS.md](RELEASE_READINESS.md) plus the latest validation run as the current v0 checkpoint. The skill references validation evidence without treating disposable-fixture writes as authorization for real repositories.

## What is not built

- Any MCP write tool beyond `shipready.write_safe_crawl_files`, or any remote MCP transport.
- Live Google Search Console/OAuth/token custody, DNS provider writes, or DNS provider integrations. Search Console remains a local deterministic mock prototype; DNS readiness is read-only resolver evidence only.
- Live GitHub PR creation, Git command execution, branch creation, commit/push, deployment execution, deployment automation, or deploy-provider integration.
- GUI write execution.
- Patch application.
- Broader safe apply or writes to metadata, content, JSON-LD, packages, configuration, or existing files.
- Exhaustive crawler, monitoring/scheduled crawl, or aggregate terminal `review` command.
- Authorship identification, generator/vendor attribution, or auto-fixes from generated-site smell findings.
- Social platform APIs, platform-specific preview scraping endpoints, screenshot rendering, image generation, and third-party rendering guarantees for preview simulation.
- Authentication, accounts, billing, hosted SaaS, or secret-management product features.
- npm package publication, `pnpm dlx` usage, standalone binaries, remote MCP, hosted wrappers, auto-update behavior, or a default global install path.

## Latest approved demo artifacts

- Silent/captioned canonical fallback: `validation/demo-fodmapp-voiceover-final/final-demo-silent.mp4`
- Optional approved voice version: `validation/demo-fodmapp-voiceover-final/final-demo-with-voice.mp4`
- Thumbnail and captions: `validation/demo-fodmapp-voiceover-final/thumbnail.png`, `validation/demo-fodmapp-voiceover-final/captions.srt`
- Approved share package: `validation/demo-fodmapp-share/`

See [DEMO.md](DEMO.md) for reproduction and safety details.

## Safety posture

Read-only inspection and preview are the default. CLI write mode requires `fix --write --allow-create` and is governed by [WRITE_POLICY_V1.md](WRITE_POLICY_V1.md). The MCP write wrapper is stricter: `shipready.write_safe_crawl_files` requires an authorized repo path, a fresh signed preview receipt from `shipready.preview_fixes`, exact confirmation text `CREATE_SAFE_CRAWL_FILES_ONLY`, re-authorization, and regenerated current write validation before creating only missing robots/sitemap files. The GUI never executes writes, never deploys, and never calls Git/GitHub, DNS provider, Google, social platform, or hosting-provider mutation APIs. Claims follow [CLAIMS_POLICY.md](CLAIMS_POLICY.md). GUI direction remains in [LOCAL_FIRST_GUI_SPEC.md](LOCAL_FIRST_GUI_SPEC.md).

## Next pass

**npm package name / publish authorization decision.** The package is packable and locally smoke-testable from a tarball, but ShipReady v0 remains source-checkout-only. The next pass should decide package name/scope, publish authorization, license, npm token/provenance handling, browser install instructions, rollback criteria, post-publish smoke checks, and whether CLI-only metadata should continue without `main`/`exports`. Do not publish, claim `pnpm dlx`, adopt Ink or OpenTUI, broaden `WRITE_POLICY_V1`, or change JSON/write/product behavior without a separate approved pass.
