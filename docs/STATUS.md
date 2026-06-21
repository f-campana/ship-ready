# Status

## Position

ShipReady is a CLI-first, agent-friendly launch-readiness engine for generated websites. **CLI first. MCP second. GUI third.** Agents are the primary operational audience; the GUI explains stable engine output to humans.

## What exists

- Public single-page audit with raw and Playwright-rendered metadata comparison.
- Crawl-resource, metadata, social-preview, structure, accessibility, and launch-hygiene checks.
- Bounded read-only repository inspection.
- Read-only fix planning and exact dry-run previews.
- Strict V1 creation-only writes for eligible missing crawl files.
- Human and Zod-validated JSON outputs.
- Versioned `ui-report-v1` normalization and self-contained HTML reports.
- Local GUI with `POST /api/ui-report`; safe apply is preview/copy-only and no write endpoint exists.
- Fodmapp demo scripts, approved silent/captioned media, optional approved voiced media, thumbnail, captions, and review evidence.

## What is not built

- MCP server or client tools.
- Search Console or DNS integration.
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

Read-only inspection and preview are the default. The only product write surface requires `fix --write --allow-create` and is governed by [WRITE_POLICY_V1.md](WRITE_POLICY_V1.md). It is creation-only, exact-allowlist, no-overwrite, and all-or-nothing. The GUI never executes it. Claims follow [CLAIMS_POLICY.md](CLAIMS_POLICY.md). GUI direction remains in [LOCAL_FIRST_GUI_SPEC.md](LOCAL_FIRST_GUI_SPEC.md).

## Next pass

**Pass 3: CLI contract hardening.** Add explicit versions/envelopes, stable error codes, compatibility rules, and CLI-level contract tests before specifying MCP.
