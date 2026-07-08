# Distribution

Checkpoint date: 2026-07-08

## Current truth

ShipReady v0 is a repository-local tool. Humans and agents run it from a source checkout with pnpm. It is not published to npm, is not globally installed by default, and `pnpm dlx shipready` is not expected to work.

The current package metadata contains:

- `name`: `shipready`
- `version`: `0.1.0`
- `private`: `true`
- `type`: `module`
- `bin.shipready`: `./dist/index.js`
- scripts for `shipready`, `build`, `test`, `typecheck`, contract fixtures, Playwright install, and demo tooling
- `packageManager`: `pnpm@10.28.2`

The current package metadata does not contain publish-ready `files`, `main`, `exports`, `license`, `repository`, or `engines` fields. There is no `pnpm-workspace.yaml` in this checkout. The build output is `dist/index.js` plus `dist/index.d.ts`.

## User-facing problem

Users can reasonably try:

```bash
pnpm shipready audit https://imageforge.dev
```

from outside the checkout and hit pnpm's package-manifest requirement for the current directory. They can also try:

```bash
pnpm dlx shipready audit https://imageforge.dev
```

and fail because ShipReady is not published as an npm package. A `bin` field in the local package is not enough to make `pnpm dlx` or global install workflows work.

## Goals

- Make source-checkout usage impossible to miss.
- Give humans and agents a reliable from-anywhere command form.
- Separate verified developer-local linking from npm distribution.
- Document what must be true before npm, `pnpm dlx`, standalone binaries, MCP packaging, or GUI packaging can be claimed.
- Preserve the current local/agent v0 safety boundary.

## Non-goals

- Publish to npm.
- Create a GitHub release.
- Upload release artifacts.
- Build standalone binaries.
- Add hosted SaaS behavior.
- Add remote MCP transport.
- Add auto-update behavior.
- Add telemetry.
- Add auth, accounts, billing, OAuth, token storage, or package-publish automation.
- Add live GitHub, deployment, DNS provider, Search Console, social platform, or provider mutation behavior.
- Broaden `WRITE_POLICY_V1`.
- Change product safety behavior.

## Options considered

Option A - Source-checkout-only v0:

```bash
cd /path/to/ship-ready
pnpm install
pnpm shipready status
pnpm shipready audit https://example.com
```

From anywhere:

```bash
pnpm --dir /path/to/ship-ready shipready audit https://example.com
```

Pros: lowest risk, matches current behavior, avoids new packaging/security surface, works well for internal dogfood and agent use.

Cons: not friendly for normal users, `pnpm dlx` does not work, and users cannot treat ShipReady as a normal installed CLI.

Option B - Local developer link:

```bash
cd /path/to/ship-ready
pnpm install
pnpm build
pnpm link --global
shipready status
```

This was verified in the current checkout after `pnpm build`: `shipready status --json` and `shipready --version` worked outside the repository. This is a developer-local linked command, not npm distribution. It depends on the user's pnpm global bin setup and the linked checkout remaining present.

Option C - npm package / pnpm dlx:

Future preparation only. Do not publish in v0. Before this path can be claimed, ShipReady needs a package-name and ownership decision, publish metadata, a reviewed `files` whitelist, license and repository metadata, Node engine requirements, packed-tarball smoke tests, a Playwright/browser install story, MCP stdio launch guidance, GUI asset packaging checks, publish authorization, rollback planning, and package docs that distinguish installed usage from source-checkout usage.

Option D - Standalone binary:

Future exploration only. This path would need single-file or platform-specific build decisions, Playwright/browser handling, GUI static asset inclusion, MCP stdio behavior, release artifact generation, checksums, and later codesigning/notarization where relevant. Do not implement binary packaging for v0.

Option E - Hosted/local app wrapper:

Future only. A hosted or app-wrapped experience would require separate product, auth, data custody, remote workspace, billing, update, telemetry, and security designs. Do not implement it for v0.

## Recommendation

ShipReady v0 remains source-checkout-only. Document `pnpm --dir /path/to/ship-ready ...` as the supported from-anywhere usage. Document `pnpm link --global` only as a verified developer-local convenience after `pnpm build`. Treat npm, `pnpm dlx`, standalone binaries, hosted app wrappers, remote MCP, and package auto-update behavior as future work.

## Source-checkout usage

Current v0 usage:

```bash
cd /Users/fabiencampana/Documents/ship-ready
pnpm install
pnpm shipready status
pnpm shipready audit https://example.com
```

From anywhere:

```bash
pnpm --dir /Users/fabiencampana/Documents/ship-ready shipready status
pnpm --dir /Users/fabiencampana/Documents/ship-ready shipready audit https://example.com
```

Use this form for humans and agents that are not already inside the checkout. It avoids relying on the caller's current directory, global pnpm links, or npm publication.

Human terminal output is optimized for this source-checkout flow. It is plain text with no ANSI color requirement, so `pnpm --dir /Users/fabiencampana/Documents/ship-ready shipready ...` remains usable from other directories, CI logs, redirected files, and agent terminals. This terminal review polish does not add an installed CLI, `pnpm dlx` path, standalone binary, hosted app, remote MCP transport, aggregate `review` command, or interactive TUI.

## Local link / global developer usage

Verified developer-local path:

```bash
cd /Users/fabiencampana/Documents/ship-ready
pnpm install
pnpm build
pnpm link --global
shipready status
shipready audit https://example.com
```

Use this only when a developer explicitly wants a local global command backed by this checkout. It is not npm distribution, does not prove package publish readiness, and should not be used in docs or reports where the reader may assume a published CLI.

If you just created this local link and need to remove it:

```bash
pnpm remove --global shipready
```

## npm / pnpm dlx readiness

ShipReady is not ready for npm publication or `pnpm dlx` usage in v0.

Current blockers and unknowns:

- `private` is `true`.
- Package name ownership and availability are not decided here.
- License and repository metadata are absent.
- `files`, `main`, `exports`, and `engines` are absent.
- `bin.shipready` points to the built CLI, but packed-tarball behavior has not been accepted as a release path.
- Playwright Chromium installation and cache behavior need an explicit package story.
- MCP stdio launch from an installed package needs smoke tests.
- GUI static assets and canonical docs/fixtures need packed-package smoke tests.
- Publish credentials, npm token handling, CI/release workflow, and rollback plan are not designed.
- Public docs must separate installed usage from source-checkout usage before publish.

Do not claim `pnpm dlx shipready ...` works until the package is published and verified from a clean environment.

## Standalone binary readiness

Standalone binaries are not implemented for v0. A future pass should evaluate:

- target platforms and architectures;
- whether to bundle or separately install Playwright browsers;
- whether GUI HTML/CSS/JS, docs, and contract fixtures are embedded or external;
- MCP stdio startup behavior from a binary;
- artifact checksums and provenance;
- upgrade and rollback story;
- macOS codesigning/notarization and Windows signing requirements if distributed beyond internal dogfood.

## MCP installation considerations

For v0, launch MCP from the source checkout:

```bash
pnpm --dir /Users/fabiencampana/Documents/ship-ready --silent shipready mcp --allow-root /path/to/repo
```

`--silent` matters for stdio MCP because package-manager script output must not appear on stdout before or during MCP JSON-RPC traffic. MCP remains local stdio-only. There is no remote MCP transport, hosted MCP endpoint, token-based MCP auth, or arbitrary write path.

## GUI launch considerations

For v0, launch the GUI from the source checkout:

```bash
pnpm --dir /Users/fabiencampana/Documents/ship-ready shipready gui
```

The GUI is loopback-only and local. It is not hosted SaaS, has no accounts, no remote workspace, no auth, no billing, no telemetry, no deployment controls, and no write endpoint. `POST /api/fix` remains absent and must return `404`.

## Security and mutation boundaries

This distribution decision does not change product behavior.

- No npm publish.
- No GitHub release.
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

## Release checklist before publishing

Before npm publication or an installed CLI claim:

- Confirm package name availability, ownership, and npm scope.
- Decide and add license metadata.
- Add repository and issue metadata.
- Add `engines` and confirm supported Node versions.
- Add a reviewed `files` whitelist that includes built CLI output, required docs, fixtures, GUI assets, and skills, and excludes secrets, local validation artifacts, local paths, and development-only files.
- Confirm `bin.shipready` points to the built CLI in a packed package.
- Decide `main` and `exports`, or explicitly document why CLI-only distribution omits them.
- Verify the build includes GUI assets, canonical docs, contract fixtures, and skill content needed by doctor/MCP.
- Define Playwright Chromium install/cache behavior for npm, CI, and `pnpm dlx`.
- Verify MCP stdio launch from a packed package, including `--silent` guidance where a package manager is involved.
- Smoke test from a packed tarball in a clean temporary directory: `shipready --version`, `shipready status --json`, `shipready doctor --json`, `shipready audit https://example.com --json`, `shipready gui` startup, and `shipready mcp --allow-root <temp-repo>`.
- Confirm no secrets, `.env`, local absolute paths, validation-only artifacts, npm tokens, or private data are in the package.
- Update docs to distinguish installed CLI usage from source-checkout usage.
- Confirm claims policy still passes.
- Define publish authorization, npm token handling, provenance, rollback, unpublish/deprecate criteria, and post-publish smoke checks.

## Decision

For ShipReady v0, the supported installation/run model is source checkout plus pnpm. The supported from-anywhere form is `pnpm --dir /Users/fabiencampana/Documents/ship-ready shipready ...`. A verified local developer link is acceptable for developer convenience after `pnpm build`, but it is not distribution. npm, `pnpm dlx`, standalone binaries, hosted wrappers, remote MCP, auto-update behavior, and package-publish automation remain future work.
