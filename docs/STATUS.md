# Status

## Position

ShipReady is a CLI-first, agent-friendly launch-readiness engine for generated websites. **CLI first. MCP second. GUI third.** Agents are the primary operational audience; the GUI explains stable engine output to humans.

## What exists

- Public single-page audit with raw and Playwright-rendered metadata comparison.
- Read-only `status` capability inventory and bounded local `doctor` readiness checks, each with stable human and JSON output.
- Crawl-resource, metadata, social-preview, structure, accessibility, and launch-hygiene checks.
- Bounded read-only repository inspection.
- Read-only fix planning and exact dry-run previews.
- Strict V1 creation-only writes for eligible missing crawl files.
- Human and Zod-validated JSON outputs.
- Versioned `ui-report-v1` normalization and self-contained HTML reports.
- Local GUI with `POST /api/ui-report`; safe apply is preview/copy-only and no write endpoint exists.
- Local MCP stdio server with nine read-only tools, one guarded safe-write tool for V1 crawl-file creations, canonical docs/fixtures, five prompts, explicit allowed roots, stable errors, preview receipts, and bounded deadlines.
- Fodmapp demo scripts, approved silent/captioned media, optional approved voiced media, thumbnail, captions, and review evidence.
- Stable `shipready.searchConsoleStatus.v1`, `search-console status`, seven deterministic mock scenarios, opt-in mock indexed-version inspection, and the read-only `shipready.search_console_status` MCP tool.
- Official-source-backed [Search Console readiness specification](SEARCH_CONSOLE_READINESS_SPEC.md) defining claim boundaries and the future live provider/OAuth boundary.
- Stable `shipready.dnsStatus.v1`, `dns status`, eleven deterministic DNS mock scenarios, redacted Search Console TXT-readiness checks, optional canonical-host evidence, and the read-only `shipready.dns_status` MCP tool.
- Official-source-backed [DNS readiness specification](DNS_READINESS_SPEC.md) defining read-only DNS checks and DNS claim boundaries.

## What is not built

- Any MCP write tool beyond `shipready.write_safe_crawl_files`, or any remote MCP transport.
- Live Google Search Console/OAuth/token custody, DNS provider writes, or DNS provider integrations. Search Console remains a local deterministic mock prototype; DNS readiness is read-only resolver evidence only.
- GitHub/PR integration or deployment workflow.
- GUI write execution.
- Broader safe apply or writes to metadata, content, JSON-LD, packages, configuration, or existing files.
- Multi-page crawl, social preview simulator, smell detector, or patch export.
- Authentication, accounts, billing, hosted SaaS, or secret-management product features.

## Latest approved demo artifacts

- Silent/captioned canonical fallback: `validation/demo-fodmapp-voiceover-final/final-demo-silent.mp4`
- Optional approved voice version: `validation/demo-fodmapp-voiceover-final/final-demo-with-voice.mp4`
- Thumbnail and captions: `validation/demo-fodmapp-voiceover-final/thumbnail.png`, `validation/demo-fodmapp-voiceover-final/captions.srt`
- Approved share package: `validation/demo-fodmapp-share/`

See [DEMO.md](DEMO.md) for reproduction and safety details.

## Safety posture

Read-only inspection and preview are the default. CLI write mode requires `fix --write --allow-create` and is governed by [WRITE_POLICY_V1.md](WRITE_POLICY_V1.md). The MCP write wrapper is stricter: `shipready.write_safe_crawl_files` requires an authorized repo path, a fresh signed preview receipt from `shipready.preview_fixes`, exact confirmation text `CREATE_SAFE_CRAWL_FILES_ONLY`, re-authorization, and regenerated current write validation before creating only missing robots/sitemap files. The GUI never executes writes. Claims follow [CLAIMS_POLICY.md](CLAIMS_POLICY.md). GUI direction remains in [LOCAL_FIRST_GUI_SPEC.md](LOCAL_FIRST_GUI_SPEC.md).

## Next pass

**Pass 12: Post-write deploy/re-check workflow.** Define the post-write deployment handoff and live re-check workflow without hiding that deployment remains outside the current ShipReady write policy.
