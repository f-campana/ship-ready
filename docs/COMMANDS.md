# Commands

Run source commands from the repository with `pnpm shipready`. The built binary name is `shipready`. `--timeout` defaults to `15000` milliseconds. `--no-render` skips Playwright rendering; `--user-agent <ua>` overrides the default user agent.

## `audit`

```bash
pnpm shipready audit <url> [--json] [--timeout <ms>] [--no-render] [--user-agent <ua>]
pnpm shipready audit https://example.com --json
```

- Purpose: audit one public HTTP(S) page, including metadata, raw/rendered differences, structure, accessibility signals, `robots.txt`, and `sitemap.xml`.
- Behavior: reads network resources; writes no files.
- Output: human report by default; `AuditResult` JSON with `--json`.
- Agent use: first live-site check and source for downstream planning.
- Safety: this is a single-page check, not a crawler; private/authenticated pages are out of scope.

## `inspect-repo`

```bash
pnpm shipready inspect-repo <path> [--json]
pnpm shipready inspect-repo . --json
```

- Purpose: detect framework, package manager, important files, routes, metadata locations, supported fixes, warnings, and limitations.
- Behavior: reads a bounded local repository scan; writes nothing.
- Output: human report or `RepoInspectionResult` JSON.
- Agent use: establish repository facts before planning or implementation.
- Safety: convention-based inspection is not full AST analysis or exact route-to-URL mapping.

## `plan-fixes`

```bash
pnpm shipready plan-fixes <path> --url <url> [--json] [--timeout <ms>] [--no-render] [--user-agent <ua>]
pnpm shipready plan-fixes . --url https://example.com --json
```

- Purpose: combine a live audit and repo inspection into prioritized, risk- and confidence-labeled actions.
- Behavior: reads the URL and repository; writes nothing.
- Output: human report or `FixPlanResult` JSON.
- Agent use: decide which changes are safe candidates, review-required, manual, or unsupported.
- Safety: plan automation fields describe capability; they do not execute changes.

## `fix --dry-run`

```bash
pnpm shipready fix <path> --url <url> --dry-run [--json] [--timeout <ms>] [--no-render] [--user-agent <ua>]
pnpm shipready fix . --url https://example.com --dry-run --json
```

- Purpose: generate exact create/update previews, diffs, skipped actions, and safety notes.
- Behavior: reads the URL and repository; `mode` is `dry_run`, `wroteFiles` is `false`; writes nothing.
- Output: human report or `DryRunFixResult` JSON.
- Agent use: mandatory preview before considering any write.
- Safety: metadata, content, and JSON-LD may appear as review-required previews; preview presence does not make them writable.

`--dry-run` and `--write` conflict. One explicit mode is required.

## `fix --write --allow-create`

```bash
pnpm shipready fix <path> --url <url> --write --allow-create [--json] [--timeout <ms>] [--no-render] [--user-agent <ua>]
```

- Purpose: create eligible missing crawl files under `creation_only_robots_sitemap_v1`.
- Behavior: writes only after regenerating the preview and passing all V1 gates; may create multiple eligible files atomically.
- Output: human report or `WriteFixResult` JSON; validation/execution failures include a structured result with `--json`.
- Agent use: only when the user explicitly authorizes the exact target after preview review.
- Safety: `--write` without `--allow-create` is rejected. Existing files, overwrites, review-required changes, unsupported paths, metadata/content/JSON-LD, Git, and deployment are excluded. Read [WRITE_POLICY_V1.md](WRITE_POLICY_V1.md) first.

No example with a real repository is provided intentionally. Never infer authorization from a copied command.

## `ui-report`

```bash
pnpm shipready ui-report [path] --url <url> [--json] [--timeout <ms>] [--no-render] [--user-agent <ua>]
pnpm shipready ui-report . --url https://example.com --json
pnpm shipready ui-report --url https://example.com --json
```

- Purpose: normalize URL-only or URL-plus-repo results into `ui-report-v1`.
- Behavior: reads network/repo inputs; writes nothing.
- Output: structured report with `--json`; otherwise a short generation message. Report-stage errors set a nonzero exit status.
- Agent use: stable current input for GUI/report consumers and contract fixtures.
- Safety: safe-apply fields describe eligibility and a guarded CLI command workflow; this command never applies changes.

## `html-report`

```bash
pnpm shipready html-report [path] --url <url> --output <file> [--timeout <ms>] [--no-render] [--user-agent <ua>]
pnpm shipready html-report . --url https://example.com --output validation/example.html
pnpm shipready html-report --url https://example.com --output validation/example-url-only.html
```

- Purpose: render a self-contained static report from `ui-report-v1`.
- Behavior: reads network/repo inputs and writes the requested HTML report file.
- Output: the resolved output path on stdout; no `--json` mode.
- Agent use: create a reviewable artifact when an interactive GUI is unnecessary.
- Safety: the only write is the explicitly named report file; it does not modify the inspected repository.

## `gui`

```bash
pnpm shipready gui [--host <host>] [--port <port>]
pnpm shipready gui
```

- Purpose: start the local human-readable UI.
- Defaults: `127.0.0.1:4317`.
- Behavior: serves `/`, static assets, and `POST /api/ui-report`; reads audit/repo inputs and writes no project files.
- Output: server URL, then the process remains active until stopped.
- Agent use: human review, GUI validation, and recording.
- Safety: no GUI write endpoint exists. Safe apply is preview/copy-only.

## Demo package scripts

These scripts create recording artifacts under `validation/demo-fodmapp-recording-v2/`; they are tooling, not product interfaces.

```bash
pnpm demo:fodmapp:captions
pnpm demo:fodmapp:record
pnpm demo:fodmapp:voice
pnpm demo:fodmapp:compose
pnpm demo:fodmapp:all
```

- `captions`: writes `storyboard.json`, `voiceover.txt`, and `captions.srt`.
- `record`: requires the GUI at `SHIPREADY_GUI_URL` or `http://127.0.0.1:4317`; writes `raw-browser-video.webm` and uses recording-only browser captions/clipboard behavior.
- `voice`: optional ElevenLabs request; requires both `ELEVENLABS_API_KEY` and `ELEVENLABS_VOICE_ID`, otherwise skips; writes `voiceover.mp3`.
- `compose`: requires raw video and captions; uses `/opt/homebrew/bin/ffmpeg` when available and writes `final-demo.mp4`, adding audio only when `voiceover.mp3` exists.
- `all`: runs captions, recording, optional voice, then composition in that order.

See [DEMO.md](DEMO.md) before recording. None of these scripts executes the displayed guarded fix command.

## Planned

No planned CLI syntax is defined in this pass. MCP, doctor/status UX, Search Console, DNS, multi-page crawl, patch export, and GitHub PR work are future roadmap items. Define their CLI contracts before documenting commands.
