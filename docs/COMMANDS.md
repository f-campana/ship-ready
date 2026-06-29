# Commands

Run source commands from the repository with `pnpm shipready`. The built binary name is `shipready`. `--timeout` defaults to `15000` milliseconds. `--no-render` skips Playwright rendering; `--user-agent <ua>` overrides the default user agent.

## `status`

```bash
pnpm shipready status
pnpm shipready status --json
```

- Purpose: report the installed version, CLI/MCP/GUI ordering, implemented command/tool surfaces, write-policy posture, absent integrations, demo artifact locations, and a copyable next command.
- Behavior: reads no target repository, makes no network request, starts no server, and writes nothing.
- JSON contract: `shipready.status.v1`; fixture: [`status.default.json`](../validation/contracts/status.default.json).
- Exit behavior: `0` after the status report is emitted.
- Agent use: run before selecting a ShipReady workflow or assuming an integration exists; follow with `pnpm shipready doctor` when local readiness matters.
- Boundary: status does not verify a live URL, Google indexing, DNS, Search Console, GitHub, or deployment state.

## `doctor`

```bash
pnpm shipready doctor
pnpm shipready doctor --json
```

- Purpose: check local runtime readiness without requiring a URL or repository path.
- Checks: Node.js, pnpm, the Playwright Chromium executable, optional FFmpeg, package content, MCP SDK/configurability, parsed contract fixtures, canonical docs, `WRITE_POLICY_V1`, `LOCAL_FIRST_GUI_SPEC`, and expected demo artifacts.
- Behavior: uses bounded local executable/file/dependency probes only. It does not access the network, inspect an arbitrary repository, start the MCP/GUI server, or mutate files.
- Classification: every check is `pass`, `warn`, `fail`, or `skip`. Missing optional FFmpeg/demo artifacts warn rather than fail. `ok` is true exactly when no required check fails.
- JSON contract: `shipready.doctor.v1`; normalized fixture: [`doctor.default.json`](../validation/contracts/doctor.default.json).
- Exit behavior: `0` when required checks pass, including warning-only reports; `1` when one or more required checks fail. A valid doctor report is still emitted.
- Agent use: run after `status`, after installation, and before rendered audit/MCP work. Resolve failed checks using their messages.
- Boundary: doctor does not prove live-site readiness, crawler behavior, indexing, DNS, Search Console, GitHub, or deployment state.

## `audit`

```bash
pnpm shipready audit <url> [--json] [--timeout <ms>] [--no-render] [--user-agent <ua>]
pnpm shipready audit https://example.com --json
```

- Purpose: audit one public HTTP(S) page, including metadata, raw/rendered differences, structure, accessibility signals, `robots.txt`, and `sitemap.xml`.
- Behavior: reads network resources; writes no files.
- JSON contract: `shipready.audit.v1`; representative fixtures: [`audit.clean.json`](../validation/contracts/audit.clean.json) and [`audit.needs-work.json`](../validation/contracts/audit.needs-work.json).
- Output: human report by default; the existing `AuditResult` fields plus `contract` with `--json`.
- Exit behavior: `0` when an audit result is emitted regardless of readiness status, `1` for invalid input, `2` for operational failure. JSON action errors use `shipready.error.v1`.
- Agent use: first live-site check and source for downstream planning.
- Safety: this is a single-page check, not a crawler; private/authenticated pages are out of scope.

## `inspect-repo`

```bash
pnpm shipready inspect-repo <path> [--json]
pnpm shipready inspect-repo . --json
```

- Purpose: detect framework, package manager, important files, routes, metadata locations, supported fixes, warnings, and limitations.
- Behavior: reads a bounded local repository scan; writes nothing.
- JSON contract: `shipready.repoInspection.v1`; fixtures: [`inspect-repo.next-app.json`](../validation/contracts/inspect-repo.next-app.json) and [`inspect-repo.vite.json`](../validation/contracts/inspect-repo.vite.json).
- Output: human report or the existing `RepoInspectionResult` fields plus `contract`.
- Exit behavior: `0` when an inspection is emitted, including unknown projects; `1` for invalid repository input; `2` for unexpected failure.
- Agent use: establish repository facts before planning or implementation.
- Safety: convention-based inspection is not full AST analysis or exact route-to-URL mapping.

## `plan-fixes`

```bash
pnpm shipready plan-fixes <path> --url <url> [--json] [--timeout <ms>] [--no-render] [--user-agent <ua>]
pnpm shipready plan-fixes . --url https://example.com --json
```

- Purpose: combine a live audit and repo inspection into prioritized, risk- and confidence-labeled actions.
- Behavior: reads the URL and repository; writes nothing.
- JSON contract: `shipready.fixPlan.v1`; fixtures: [`plan-fixes.safe-apply.json`](../validation/contracts/plan-fixes.safe-apply.json) and [`plan-fixes.review-required.json`](../validation/contracts/plan-fixes.review-required.json).
- Output: human report or the existing `FixPlanResult` fields plus `contract`.
- Exit behavior: `0` when a plan is emitted, including manual-review/unsupported recommendations; `1` for invalid input; `2` for operational failure.
- Agent use: decide which changes are safe candidates, review-required, manual, or unsupported.
- Safety: plan automation fields describe capability; they do not execute changes.

## `fix --dry-run`

```bash
pnpm shipready fix <path> --url <url> --dry-run [--json] [--timeout <ms>] [--no-render] [--user-agent <ua>]
pnpm shipready fix . --url https://example.com --dry-run --json
```

- Purpose: generate exact create/update previews, diffs, skipped actions, and safety notes.
- Behavior: reads the URL and repository; `mode` is `dry_run`, `wroteFiles` is `false`; writes nothing.
- JSON contract: `shipready.dryRunFix.v1`; fixtures: [`fix-dry-run.safe-apply.json`](../validation/contracts/fix-dry-run.safe-apply.json), [`fix-dry-run.review-required.json`](../validation/contracts/fix-dry-run.review-required.json), and [`fix-dry-run.skipped.json`](../validation/contracts/fix-dry-run.skipped.json).
- Output: human report or the existing `DryRunFixResult` fields plus `contract`.
- Exit behavior: `0` when a dry-run result is emitted; `1` for a missing/conflicting mode or invalid input; `2` for operational failure.
- Agent use: mandatory preview before considering any write.
- Safety: metadata, content, and JSON-LD may appear as review-required previews; preview presence does not make them writable.

`--dry-run` and `--write` conflict. One explicit mode is required.

## `fix --write --allow-create`

```bash
pnpm shipready fix <path> --url <url> --write --allow-create [--json] [--timeout <ms>] [--no-render] [--user-agent <ua>]
pnpm shipready fix ./fixture-copy --url https://example.com --write --allow-create --json
```

- Purpose: create eligible missing crawl files under `creation_only_robots_sitemap_v1`.
- Behavior: writes only after regenerating the preview and passing all V1 gates; may create multiple eligible files atomically.
- JSON contract: `shipready.writeFix.v1`; deterministic temp-copy fixtures: [`fix-write.safe-create.json`](../validation/contracts/fix-write.safe-create.json), [`fix-write.blocked.json`](../validation/contracts/fix-write.blocked.json), and [`fix-write.skipped.json`](../validation/contracts/fix-write.skipped.json).
- Output: human report or the existing `WriteFixResult` fields plus `contract`; validation/execution errors use `shipready.error.v1` and include a nested versioned write result.
- Exit behavior: `0` for a completed result, including a no-op; `1` for mode/input/validation failure; `2` for execution or operational failure.
- Agent use: only when the user explicitly authorizes the exact target after preview review.
- Safety: `--write` without `--allow-create` is rejected. Existing files, overwrites, review-required changes, unsupported paths, metadata/content/JSON-LD, Git, and deployment are excluded. Read [WRITE_POLICY_V1.md](WRITE_POLICY_V1.md) first.

The example target is intentionally a fixture copy. Never replace it with a real repository or infer authorization from a copied command.

## `ui-report`

```bash
pnpm shipready ui-report [path] --url <url> [--json] [--timeout <ms>] [--no-render] [--user-agent <ua>]
pnpm shipready ui-report . --url https://example.com --json
pnpm shipready ui-report --url https://example.com --json
```

- Purpose: normalize URL-only or URL-plus-repo results into `ui-report-v1`.
- Behavior: reads network/repo inputs; writes nothing.
- JSON contract: `shipready.uiReport.v1`, retaining `schemaVersion: "ui-report-v1"`; fixtures: [`ui-report.safe-apply.json`](../validation/contracts/ui-report.safe-apply.json) and [`ui-report.url-only.json`](../validation/contracts/ui-report.url-only.json).
- Output: structured report with `--json`; otherwise a short generation message.
- Exit behavior: `0` when `errors` is empty; `1` when a report is emitted with normalized stage errors. Invalid timeout/action failures use `shipready.error.v1`.
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
- Surface type: explicit HTML file output plus a human stdout path; no `--json` option and no JSON contract.
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
- Surface type: local HTTP server plus a human stdout URL; the command has no `--json` option. `POST /api/ui-report` returns an internal GUI JSON envelope, not a named CLI contract.
- Output: server URL, then the process remains active until stopped.
- Agent use: human review, GUI validation, and recording.
- Safety: no GUI write endpoint exists. Safe apply is preview/copy-only.

The GUI client fetches only `/api/ui-report`. `POST /api/fix` is not implemented and returns `404`.

## JSON errors

Command-action failures under `--json` use `shipready.error.v1`. See [`error.invalid-url.json`](../validation/contracts/error.invalid-url.json). The stable fields are `contract`, `ok: false`, `code`, `message`, and the legacy compatibility alias `error`. Commander failures that occur before the command action starts, such as missing required arguments, remain a documented normalization gap.

## `search-console status`

Pass 9 implements a deterministic, mock-backed, read-only surface:

```bash
pnpm shipready search-console status --url https://example.com
pnpm shipready search-console status --url https://example.com --json
pnpm shipready search-console status --url https://example.com --mock ready_sitemap_ok --json
pnpm shipready search-console status --url https://example.com --mock inspection_canonical_mismatch --inspect --json
```

- Required: `--url <http-or-https-url>`.
- Optional: `--mock <scenario>`, `--provider mock`, `--inspect`, and `--json`.
- Scenarios: `not_configured`, `unauthorized`, `property_not_found`, `ready_sitemap_ok`, `ready_sitemap_warning`, `inspection_canonical_mismatch`, and `inspection_not_indexed`.
- Default: without `--mock`, returns a valid `not_configured` mock status and clearly states that live integration is unavailable.
- Output: concise human sections or one `shipready.searchConsoleStatus.v1` object. Invalid URL, scenario, or provider input returns `shipready.error.v1`; unsupported providers fail rather than pretending to connect.
- Safety: no network is needed for these scenarios. The command does not implement Google OAuth, read/store tokens, call Google, create/verify properties, submit sitemaps, request indexing, change DNS, or write files.
- `--inspect`: includes one deterministic mock indexed-version section only; it never calls the live URL Inspection API.

The future live provider remains deferred. It would require a separately reviewed local OAuth/token-custody boundary and only Google's documented [`webmasters.readonly` scope](https://developers.google.com/webmaster-tools/v1/how-tos/authorizing). See [SEARCH_CONSOLE_READINESS_SPEC.md](SEARCH_CONSOLE_READINESS_SPEC.md).

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

## `mcp`

```bash
pnpm shipready mcp --allow-root /Users/fabiencampana/Documents
pnpm shipready mcp --allow-root /absolute/workspace-a --allow-root /absolute/workspace-b
SHIPREADY_MCP_ALLOWED_ROOTS='["/absolute/workspace-a","/absolute/workspace-b"]' pnpm shipready mcp
```

- Purpose: start the local MCP stdio server. Stdout is reserved for MCP protocol frames.
- Authorization: at least one explicit root is required. Repeat `--allow-root` for multiple roots; CLI roots replace the JSON-array environment fallback. Relative, missing, home, filesystem-root, traversal, and symlink-escape paths fail closed.
- Surface: eight read-only tools, one guarded write tool, ten canonical documentation resources plus allowlisted contract fixtures, and five prompt templates. `shipready.search_console_status` wraps the same deterministic mock boundary, accepts no repository-path input, and performs no repository-path authorization; the server's existing allowed-root startup requirement remains unchanged. See [MCP_PLAN.md](MCP_PLAN.md) for the exact lists.
- Safe write tool: `shipready.write_safe_crawl_files` can create only current V1-eligible missing robots/sitemap files. Required flow: call `shipready.preview_fixes`, review `shipready.dryRunFix.v1` and its fresh `previewReceipt`, then call the write tool with the same URL, same authorized repo path, that receipt, and `confirmation: "CREATE_SAFE_CRAWL_FILES_ONLY"`.
- Safety: the write tool re-authorizes the path, validates the receipt signature/expiry/bindings, regenerates the current dry-run, revalidates `WRITE_POLICY_V1`, and returns `shipready.writeFix.v1`. It never accepts arbitrary file paths or client-supplied file lists as authority. The server does not start the GUI or write an HTML report.
- Limitation: request deadlines and client cancellation are bounded at the MCP boundary. Existing synchronous repository scans and application operations do not yet accept `AbortSignal`, so already-started underlying work may finish its own bounded cleanup after the MCP response.

HTTP, SSE, remote auth, live Search Console/OAuth, timeout overrides, broader MCP writes, GUI write execution, Git/GitHub, deploy, and DNS are not implemented.
