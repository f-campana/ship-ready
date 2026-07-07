# Status

## Position

ShipReady is a CLI-first, agent-friendly launch-readiness engine for generated websites. **CLI first. MCP second. GUI third.** Agents are the primary operational audience; the GUI explains stable engine output to humans.

## What exists

- Public single-page audit with raw and Playwright-rendered metadata comparison.
- Read-only bounded multi-page crawl with `shipready.crawl.v1`, same-origin discovery, strict max page/depth limits, repeated findings, metadata consistency summaries, skipped URL reasons, and deterministic mock scenarios.
- Read-only `status` capability inventory and bounded local `doctor` readiness checks, each with stable human and JSON output.
- Crawl-resource, metadata, social-preview, structure, accessibility, and launch-hygiene checks.
- Read-only `social-preview` simulator with `shipready.socialPreview.v1`, raw/rendered source modes, deterministic mock scenarios, and simulated Google/social/X/Slack/Discord/LinkedIn-style surfaces.
- Read-only generated-site implementation smell detector with `shipready.generatedSiteSmells.v1`, bounded repo scanning, optional single-page URL cross-check evidence, deterministic mock scenarios, and heuristic implementation signals rather than authorship identification.
- Bounded read-only repository inspection.
- Read-only fix planning and exact dry-run previews.
- Strict V1 creation-only writes for eligible missing crawl files.
- Read-only `recheck` in URL-only and repo-backed modes, with conservative local expected-file versus live crawl-resource evidence.
- Human and Zod-validated JSON outputs.
- Versioned `ui-report-v1` normalization and self-contained HTML reports.
- Local read-only GUI review cockpit with `POST /api/review`, compatibility `POST /api/ui-report`, on-demand social preview, bounded crawl, project smells, DNS, Search Console mock status, and recheck sections; safe crawl-file creation is copy-only and no write endpoint exists.
- Local MCP stdio server with thirteen read-only tools, one guarded safe-write tool for V1 crawl-file creations, canonical docs/fixtures, five prompts, explicit allowed roots, stable errors, preview receipts, and bounded deadlines.
- Fodmapp demo scripts, approved silent/captioned media, optional approved voiced media, thumbnail, captions, and review evidence.
- Stable `shipready.searchConsoleStatus.v1`, `search-console status`, seven deterministic mock scenarios, opt-in mock indexed-version inspection, and the read-only `shipready.search_console_status` MCP tool.
- Official-source-backed [Search Console readiness specification](SEARCH_CONSOLE_READINESS_SPEC.md) defining claim boundaries and the future live provider/OAuth boundary.
- Stable `shipready.dnsStatus.v1`, `dns status`, eleven deterministic DNS mock scenarios, redacted Search Console TXT-readiness checks, optional canonical-host evidence, and the read-only `shipready.dns_status` MCP tool.
- Official-source-backed [DNS readiness specification](DNS_READINESS_SPEC.md) defining read-only DNS checks and DNS claim boundaries.
- Repository-local [ShipReady Launch Readiness skill](../skills/shipready-launch-readiness/SKILL.md) packaging current CLI, MCP, GUI/report, Search Console mock, DNS, write-policy, claims, reporting, and troubleshooting workflows for agents.
- Practical [post-write recheck guide](POST_WRITE_RECHECK.md) that keeps deployment external and classifies network uncertainty without overclaiming.

When present, `validation/e2e-project-review/` supplies current end-to-end evidence for these surfaces, including its summary, feature matrix, safety report, and screenshot index. The skill references this evidence without treating disposable-fixture writes as authorization for real repositories.

## What is not built

- Any MCP write tool beyond `shipready.write_safe_crawl_files`, or any remote MCP transport.
- Live Google Search Console/OAuth/token custody, DNS provider writes, or DNS provider integrations. Search Console remains a local deterministic mock prototype; DNS readiness is read-only resolver evidence only.
- GitHub/PR integration, deployment execution, deployment automation, or deploy-provider integration.
- GUI write execution.
- Broader safe apply or writes to metadata, content, JSON-LD, packages, configuration, or existing files.
- Exhaustive crawler, monitoring/scheduled crawl, terminal output polish/TUI viewer, or patch export.
- Authorship identification, generator/vendor attribution, or auto-fixes from generated-site smell findings.
- Social platform APIs, platform-specific preview scraping endpoints, screenshot rendering, image generation, and third-party rendering guarantees for preview simulation.
- Authentication, accounts, billing, hosted SaaS, or secret-management product features.

## Latest approved demo artifacts

- Silent/captioned canonical fallback: `validation/demo-fodmapp-voiceover-final/final-demo-silent.mp4`
- Optional approved voice version: `validation/demo-fodmapp-voiceover-final/final-demo-with-voice.mp4`
- Thumbnail and captions: `validation/demo-fodmapp-voiceover-final/thumbnail.png`, `validation/demo-fodmapp-voiceover-final/captions.srt`
- Approved share package: `validation/demo-fodmapp-share/`

See [DEMO.md](DEMO.md) for reproduction and safety details.

## Safety posture

Read-only inspection and preview are the default. CLI write mode requires `fix --write --allow-create` and is governed by [WRITE_POLICY_V1.md](WRITE_POLICY_V1.md). The MCP write wrapper is stricter: `shipready.write_safe_crawl_files` requires an authorized repo path, a fresh signed preview receipt from `shipready.preview_fixes`, exact confirmation text `CREATE_SAFE_CRAWL_FILES_ONLY`, re-authorization, and regenerated current write validation before creating only missing robots/sitemap files. The GUI never executes writes, never deploys, and never calls Git/GitHub, DNS provider, Google, social platform, or hosting-provider mutation APIs. Claims follow [CLAIMS_POLICY.md](CLAIMS_POLICY.md). GUI direction remains in [LOCAL_FIRST_GUI_SPEC.md](LOCAL_FIRST_GUI_SPEC.md).

## Next pass

**Pass 17: Patch export.** Introduce explicit reviewed patch artifacts after the read-only GUI cockpit.
