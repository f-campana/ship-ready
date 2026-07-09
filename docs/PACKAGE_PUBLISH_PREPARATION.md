# Package Publish Preparation

Checkpoint date: 2026-07-10

ShipReady remains unpublished and `private: true`, but it is now prepared for a future npm publish execution plan. This pass incorporated owner publish decisions, selected MIT, added package smoke automation, and kept actual publication blocked.

## Current status

Current supported usage remains repository-local:

```bash
cd /Users/fabiencampana/Documents/ship-ready && pnpm shipready ...
pnpm --dir /Users/fabiencampana/Documents/ship-ready shipready ...
```

Future intended npm usage, after publish approval and post-publish smoke, is:

```bash
pnpm dlx @shipready/cli audit https://example.com
```

Do not claim this works yet. The package is not published.

## Goals

- Keep accidental npm publication blocked with `private: true`.
- Prepare public metadata for an eventual early-preview CLI package.
- Keep ShipReady CLI-only.
- Keep browser installation explicit and side-effect-free.
- Add repeatable local/CI package smoke without putting it in normal `pnpm test`.
- Keep package contents focused on runtime resources.
- Preserve all product safety boundaries.

## Non-goals

- Publish to npm.
- Run `npm publish`, `npm login`, or token-based commands.
- Create a GitHub release or release tag.
- Upload artifacts.
- Add hosted SaaS behavior, remote MCP, telemetry, auth/accounts/billing, OAuth/token storage, provider writes, live GitHub behavior, deployment, live Search Console, social platform APIs, or DNS writes.
- Broaden `WRITE_POLICY_V1`.
- Change product safety behavior.
- Mutate Fodmapp.

## Package metadata audit

Current package metadata after this pass:

| Field | Value | Decision |
|---|---|---|
| `name` | `shipready` | Kept for now because package-root lookup expects it. Future publish should change to `@shipready/cli` only with lookup updates and smoke. |
| `version` | `0.1.0` | Kept as likely first public SemVer version. |
| `description` | `Local launch-readiness CLI for generated websites.` | Added for npm-facing clarity. |
| `private` | `true` | Kept; publication remains blocked. |
| `license` | `MIT` | Changed from `UNLICENSED` after owner open-source decision. |
| `bin.shipready` | `./dist/index.js` | Kept. |
| `main` / `exports` | absent | Kept absent; no public JS import API is claimed. |
| `repository` | `git+https://github.com/f-campana/ship-ready.git` | Kept. |
| `bugs` | GitHub issues URL | Added for public issues. |
| `homepage` | GitHub README URL | Added. |
| `engines.node` | `>=20` | Kept. |
| `scripts.package:smoke` | `node scripts/package-smoke.mjs` | Added; not part of normal `pnpm test`. |
| `scripts.postinstall` | absent | Kept absent; browser install remains explicit. |
| `files` | focused whitelist including `LICENSE` | Updated for MIT package contents. |

## Files to include

The package whitelist includes:

- `dist/`
- `LICENSE`
- `README.md`
- `docs/`
- `skills/shipready-launch-readiness/SKILL.md`
- `skills/shipready-launch-readiness/agents/`
- `skills/shipready-launch-readiness/examples/`
- `validation/contracts/`

These cover the built CLI, public docs, MIT license, agent skill resources, and deterministic contract fixtures.

## Files to exclude

The whitelist excludes:

- `src/`
- `tests/`
- `coverage/`
- `node_modules/`
- `.git/`
- untracked `validation/e2e-project-review/`
- validation screenshots, videos, local run logs, and demo media outside `validation/contracts/`
- `.env` and secret files
- generated package tarballs

## Runtime resource requirements

Runtime resources currently resolve from the installed package root by walking upward from the compiled entrypoint until `package.json` with `name: "shipready"` is found. Because of that, this pass does not change `package.json.name` to `@shipready/cli`.

Before publish execution, update the lookup to accept the approved final package name and rerun packed-package smoke.

Required package-root resources:

- `README.md`
- `LICENSE`
- canonical docs under `docs/`
- `skills/shipready-launch-readiness/SKILL.md`
- skill agent/example resources
- `validation/contracts/*.json`

## CLI smoke matrix

The repeatable smoke path is now:

```bash
pnpm package:smoke
```

It runs:

- `pnpm build`
- `pnpm pack` into a temp directory
- clean temp consumer install from the tarball
- `shipready --version`
- `shipready status --json`
- `shipready doctor --json`
- `shipready audit <local fixture URL> --no-render --json`
- `shipready tui --url <local fixture URL> --no-render` with `CI=true`
- repository tarball check before and after smoke

The audit/TUI URL is a deterministic local fixture server, not a network-sensitive live site.

## TUI packaging behavior

The TUI is bundled into `dist/index.js`, has no extra asset directory, and falls back to plain output when CI or non-TTY streams are detected. Package smoke exercises that fallback.

## GUI packaging behavior

GUI code remains bundled into `dist/index.js`. Package smoke does not start the GUI because the current publish-readiness requirement focuses on the lightweight CLI path. Prior packed smoke verified GUI startup; future publish execution can add GUI smoke if it remains needed.

## MCP packaging behavior

MCP code remains bundled into `dist/index.js`, stdio-only, with fifteen read-only tools and one guarded write tool. Package smoke does not start MCP in this pass. Future publish execution should re-smoke MCP after the final package name is selected because canonical resource lookup depends on package-root resolution.

## Playwright/browser story

No `postinstall` browser download exists.

Rendered checks require explicit Playwright Chromium installation. `doctor` reports browser availability. `audit --no-render --json` remains the lightweight path for CI and eventual `pnpm dlx` use. The package smoke workflow installs Chromium explicitly before running `pnpm package:smoke`; the script itself does not perform browser installation.

Graceful raw-only fallback when Chromium is missing remains a future publish-ergonomics improvement candidate. This pass does not change audit behavior.

## Security and mutation boundaries

This preparation pass did not change product safety behavior:

- No npm publish.
- No npm login or token use.
- No GitHub release, release tag, or artifact upload.
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

This pass adds the automated smoke script and workflow. The current local validation command for this pass is:

```bash
pnpm package:smoke
```

Expected behavior:

- tarball is created only in a temp directory;
- temp consumer install uses the packed tarball;
- JSON commands parse;
- TUI non-TTY fallback exits;
- temp directories are removed;
- `find . -maxdepth 3 -name "*.tgz"` prints nothing afterward.

## Remaining publish blockers

- Actual npm publish remains unauthorized.
- `private` remains `true`.
- Preferred `@shipready` npm scope ownership is not confirmed.
- `package.json.name` remains `shipready`; final package-name transition needs lookup changes.
- Trusted publishing is not wired as an active publish workflow.
- Changelog or release notes are required.
- Published-package browser install behavior must be verified.
- Post-publish smoke cannot run until publication is approved.
- GitHub tag/release creation is not approved.

See [PACKAGE_PUBLISH_BLOCKERS.md](PACKAGE_PUBLISH_BLOCKERS.md).

## Recommendation

Keep ShipReady unpublished. Treat this pass as publish readiness closure plus smoke automation, not publish execution.

## Next step

Recommended next pass: **Publish workflow wiring**.

That pass should confirm/control the `@shipready` npm scope, update package-root lookup for the final package name if needed, prepare a gated trusted-publishing workflow, draft release notes, and keep publication blocked until owner approval names the exact release.
