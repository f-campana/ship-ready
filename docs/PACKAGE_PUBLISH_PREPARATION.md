# Package Publish Preparation

Checkpoint date: 2026-07-09

ShipReady remains a **v0 local/agent release candidate** and **source-checkout-only**. This pass prepares and smokes a local tarball so future npm or `pnpm dlx shipready` claims can be decided from evidence. It does not authorize publication.

## Current status

ShipReady can be built, packed, installed into a clean temp consumer, and run through the core local smoke matrix from the packed tarball after this pass. The packed package contains the built CLI, package metadata, README, canonical docs, the ShipReady skill resources, and deterministic contract fixtures.

Current supported usage remains:

```bash
cd /Users/fabiencampana/Documents/ship-ready && pnpm shipready ...
pnpm --dir /Users/fabiencampana/Documents/ship-ready shipready ...
```

Current unsupported usage remains:

- `pnpm dlx shipready`
- `npm install -g shipready`
- published npm package
- standalone binary
- hosted app
- remote MCP
- auto-update

## Goals

- Verify that ShipReady can be packaged without source-checkout-only layout assumptions.
- Keep `private: true` and prevent accidental npm publication.
- Include runtime resources needed by doctor, MCP canonical reads, docs, contract fixtures, skill workflows, TUI, and GUI.
- Exclude source, tests, local validation artifacts, screenshots, videos, temp files, logs, secrets, and untracked validation evidence from the tarball.
- Smoke the built CLI from a clean tarball consumer.
- Document blockers before any npm publish or `pnpm dlx` claim.

## Non-goals

- Publish to npm.
- Create a GitHub release, release tag, or uploaded artifact.
- Commit a tarball.
- Add hosted SaaS behavior.
- Add remote MCP transport.
- Add telemetry.
- Add auth, accounts, billing, OAuth, token storage, or package-publish automation.
- Add live GitHub, deployment, DNS provider, Search Console, or social platform behavior.
- Broaden `WRITE_POLICY_V1`.
- Change product safety behavior.
- Mutate Fodmapp.

## Package metadata audit

Current package metadata after this pass:

| Field | Value | Publish-prep decision |
|---|---|---|
| `name` | `shipready` | Kept. Future pass must confirm npm name availability and ownership. |
| `version` | `0.1.0` | Kept. Future publish may need a versioning decision. |
| `private` | `true` | Kept. This pass does not enable npm publication. |
| `license` | `UNLICENSED` | Added conservatively because no open-source license has been approved. Future publish needs an explicit license decision. |
| `type` | `module` | Kept. |
| `bin.shipready` | `./dist/index.js` | Kept and smoke-tested from the tarball. |
| `scripts.shipready` | `tsx src/cli/index.ts` | Kept for source-checkout usage. |
| `scripts.build` | `tsup` | Kept. |
| `scripts.test` | `vitest run` | Kept. |
| `scripts.typecheck` | `tsc --noEmit` | Kept. |
| `scripts.playwright:install` | `playwright install chromium` | Kept as the explicit browser install command. |
| `scripts.postinstall` | absent | Removed to avoid install-time browser downloads and other package-manager side effects. |
| `dependencies` | `@modelcontextprotocol/sdk`, `cheerio`, `commander`, `playwright`, `zod` | Kept. No dependency was added. |
| `devDependencies` | `@types/node`, `tsup`, `tsx`, `typescript`, `vitest` | Kept. |
| `packageManager` | `pnpm@10.28.2` | Kept. |
| `repository` | `git+https://github.com/f-campana/ship-ready.git` | Added from the configured origin. |
| `engines.node` | `>=20` | Added to match doctor and runtime support. |
| `files` | focused whitelist | Added and smoke-tested. |
| `main` | absent | Still omitted. ShipReady is a CLI package today; no supported import API is claimed. |
| `exports` | absent | Still omitted. ShipReady is a CLI package today; no supported import API is claimed. |

## Files to include

The package whitelist includes:

- `dist/`
- `README.md`
- `docs/`
- `skills/shipready-launch-readiness/SKILL.md`
- `skills/shipready-launch-readiness/agents/`
- `skills/shipready-launch-readiness/examples/`
- `validation/contracts/`

These cover:

- CLI entrypoint and bundled runtime code.
- README and canonical docs used by MCP resources and doctor checks.
- The repository-local skill file and example resources.
- Contract fixtures used by doctor and MCP canonical resource reads.
- GUI and TUI code, because both are bundled into `dist/index.js`.

## Files to exclude

The whitelist excludes:

- `src/`
- `tests/`
- `coverage/`
- `node_modules/`
- `.git/`
- `validation/e2e-project-review/`
- validation screenshots, videos, local run logs, and demo media outside `validation/contracts/`
- local absolute-path demos and temporary artifacts
- `.env` and secret files
- `*.log`
- generated package tarballs

The initial dry-run without a whitelist would have included source, tests, screenshots, demo videos, and the pre-existing untracked `validation/e2e-project-review/` tree. The whitelist fixes that package-shape blocker.

## Runtime resource requirements

Runtime resources currently resolve from the installed package root by walking upward from the compiled entrypoint until `package.json` with `name: "shipready"` is found.

Required package-root resources:

- `README.md`
- canonical docs exposed as MCP resources:
  - `docs/WRITE_POLICY_V1.md`
  - `docs/CLAIMS_POLICY.md`
  - `docs/COMMANDS.md`
  - `docs/CONTRACTS.md`
  - `docs/AGENT_RUNBOOK.md`
  - `docs/STATUS.md`
  - `docs/ROADMAP.md`
  - `docs/DISTRIBUTION.md`
  - `docs/MCP_PLAN.md`
  - `docs/SEARCH_CONSOLE_READINESS_SPEC.md`
  - `docs/DNS_READINESS_SPEC.md`
  - `docs/POST_WRITE_RECHECK.md`
- `docs/LOCAL_FIRST_GUI_SPEC.md`
- `skills/shipready-launch-readiness/SKILL.md`
- `validation/contracts/*.json`

Source checkout, built `dist`, and clean packed install all satisfy these runtime resource requirements after the whitelist. Linked package behavior should follow the same package root lookup because the global bin resolves back to the checkout.

Optional demo media under `validation/demo-fodmapp-share/` and `validation/demo-fodmapp-voiceover-final/` are intentionally excluded from the package. In a packed install, doctor may warn that optional demo artifacts are absent; that does not block core CLI, TUI, GUI, MCP, docs, fixtures, or skill resources.

## CLI smoke matrix

| Command | Source checkout | Packed tarball | Notes |
|---|---|---|---|
| `shipready --version` | Pass | Pass | Confirms `bin.shipready` points at built CLI. |
| `shipready status --json` | Pass | Pass | Confirms package status contract works outside checkout. |
| `shipready doctor --json` | Pass | Pass with 19 pass / 1 warn when demo media is absent | Required docs, skill, fixtures, MCP SDK, and browser checks survive packaging. |
| `shipready audit https://example.com --json` | Pass | Pass | Uses installed dependency graph and local Playwright browser cache. |
| `shipready audit https://example.com --no-render --json` | Pass | Pass | Works without launching Chromium. |
| `shipready tui --url https://example.com` | Pass | Pass | Non-TTY smoke falls back to plain UI report. |
| `shipready gui` | Pass | Pass | Starts loopback-only server. |
| `shipready mcp --allow-root <temp-repo>` | Pass | Pass | Starts stdio server without stdout pollution when invoked directly through `pnpm exec`. |

## TUI packaging behavior

The TUI command is bundled into `dist/index.js` and needs no external assets or additional runtime dependency. In non-TTY smoke it does not enter raw terminal mode; it prints the normal human `ui-report` output and exits with the UI report exit code. It has no JSON contract and optional sections are not run unless requested with `--include`.

## GUI packaging behavior

The GUI is bundled into `dist/index.js`; HTML, CSS, and JS are compiled string modules. No separate GUI static asset directory is required. Packed smoke verifies:

- `GET /` returns the local cockpit HTML.
- `POST /api/review` returns a read-only review envelope.
- `POST /api/fix` remains `404`.
- The server binds to `127.0.0.1` by default.

## MCP packaging behavior

The MCP server is bundled into `dist/index.js` and resolves canonical docs and contract fixtures from the installed package root. Packed smoke verifies startup with an explicit `--allow-root` temp repository. The MCP surface remains local stdio-only with exactly one write tool, `shipready.write_safe_crawl_files`, and canonical resources available from the packaged docs and fixtures.

For package-manager-launched MCP sessions, keep using `--silent` when a package manager could print script banners to stdout. Direct `pnpm exec shipready mcp ...` smoke did not add package-manager output before MCP startup.

## Playwright/browser story

ShipReady depends on Playwright for rendered audits, TUI base reports, GUI review, and browser-backed checks. This pass intentionally avoids postinstall side effects:

- No `postinstall` browser download remains.
- Source-checkout users can run `pnpm playwright:install`.
- Tarball consumers can run the package's `playwright:install` script from their package manager if Chromium is missing.
- `doctor` reports a missing Chromium executable as a required failure with the install guidance.
- `--no-render` audit paths remain available without launching Chromium.

Future publish docs must explain the browser install step for npm, pnpm, CI, and `pnpm dlx` if publication is approved.

## Security and mutation boundaries

This preparation pass did not change product safety behavior:

- No npm publish.
- No GitHub release.
- No release tag.
- No artifact upload.
- No hosted behavior.
- No remote MCP.
- No telemetry.
- No auth, accounts, billing, OAuth, or token storage.
- No live GitHub behavior.
- No Git command execution in target repositories.
- No branch, commit, push, or pull request creation in target repositories.
- No deployment behavior.
- No DNS writes.
- No live Search Console.
- No social platform APIs.
- No `WRITE_POLICY_V1` broadening.
- No new product write surface.
- Fodmapp was not mutated.

## Local tarball smoke results

Smoke environment:

- Source repo: `/Users/fabiencampana/Documents/ship-ready`
- Clean temp consumer: `/tmp/shipready-pack-smoke`
- Package manager: `pnpm@10.28.2`
- Node runtime in this environment: Node.js 25.8.1

Results recorded during this pass:

| Step | Result |
|---|---|
| `pnpm build` | Pass |
| `pnpm pack` | Pass; tarball created locally for smoke only |
| `pnpm add /path/to/shipready-0.1.0.tgz` in clean temp consumer | Pass |
| `pnpm exec shipready --version` | Pass |
| `pnpm exec shipready status --json` | Pass |
| `pnpm exec shipready doctor --json` | Pass with `ok: true`, 19 pass, 1 warn; optional demo artifact warning is expected because demo media is excluded |
| `pnpm exec shipready audit https://example.com --json` | Pass |
| `pnpm exec shipready audit https://example.com --no-render --json` | Pass |
| `pnpm exec shipready tui --url https://example.com` | Pass; non-TTY fallback emitted plain UI report |
| `pnpm exec shipready gui --port <temp-port>` | Pass; loopback-only startup, `GET /`, `POST /api/review`, and `POST /api/fix = 404` verified |
| `pnpm exec shipready mcp --allow-root <temp-repo>` | Pass; startup smoke and process stop verified |
| Browser-unavailable story | Pass: with an empty `PLAYWRIGHT_BROWSERS_PATH`, `doctor` fails actionably with `pnpm playwright:install` guidance and `audit --no-render --json` still passes |
| Tarball cleanup | Tarball deleted before commit |

## Remaining publish blockers

- `private` remains `true`; publishing is intentionally disabled.
- npm package name availability and ownership are not decided.
- Open-source/commercial license choice is not decided; package currently says `UNLICENSED`.
- Publish authorization, npm token handling, provenance, rollback, unpublish/deprecate criteria, and post-publish smoke process are not designed.
- Installed-usage docs are not written because v0 remains source-checkout-only.
- Browser install guidance needs a dedicated publish-path decision, especially for `pnpm dlx`.
- `main`/`exports` remain intentionally omitted until a supported import API is approved or explicitly rejected for publication.
- CI package smoke is not wired into the default test suite; current tarball smoke is manual/local evidence.

## Recommendation

Keep ShipReady v0 source-checkout-only. The package is now packable and locally smoke-testable from a tarball, but that should be treated as publish-readiness evidence, not publish authorization.

Do not claim `pnpm dlx shipready`, npm global install, npm package availability, standalone binaries, hosted app, remote MCP, or auto-update behavior until a separate publish decision approves those claims and runs post-publish smoke checks.

## Next step

Recommended next pass: **npm package name / publish authorization decision**.

That pass should decide the package name/scope, license, publish authority, npm token/provenance process, browser install instructions, CI tarball smoke, rollback criteria, and whether to keep CLI-only metadata without `main`/`exports`.
