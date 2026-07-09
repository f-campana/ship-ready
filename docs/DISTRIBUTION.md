# Distribution

Checkpoint date: 2026-07-10

## Current truth

ShipReady is currently a repository-local tool. Humans and agents run it from this source checkout with pnpm. It is not published to npm, is not globally installed by default, and installed usage remains future-labeled until a publish execution pass is approved and post-publish smoke passes.

Current package metadata contains:

- `name`: `shipready`
- `version`: `0.1.0`
- `description`: `Local launch-readiness CLI for generated websites.`
- `private`: `true`
- `license`: `MIT`
- `bin.shipready`: `./dist/index.js`
- `repository`: `git+https://github.com/f-campana/ship-ready.git`
- `bugs`: `https://github.com/f-campana/ship-ready/issues`
- `homepage`: `https://github.com/f-campana/ship-ready#readme`
- `engines.node`: `>=20`
- `files`: focused whitelist for built output, license, docs, skill resources, and contract fixtures
- no `main` or `exports`
- no `postinstall`

Preferred future package: `@shipready/cli`.

Fallback package: `@f-campana/shipready`.

Preferred future command after publication:

```bash
pnpm dlx @shipready/cli audit https://example.com
```

Do not claim this works yet.

## User-facing problem

Early users need a simple command eventually, but the public package is not live. A local `bin` field does not make `pnpm dlx` work. The current trustworthy path remains source checkout, local link for developers, or packed tarball smoke for release validation.

## Goals

- Make current source-checkout usage clear.
- Keep future npm usage visible but labeled as future.
- Preserve CLI-only package shape.
- Document why `@shipready/cli` is preferred and why unscoped/ImageForge names are avoided.
- Keep browser install explicit.
- Keep package smoke automation separate from normal tests.
- Preserve safety boundaries and avoid publish execution.

## Non-goals

- Publish to npm.
- Create a GitHub release or tag.
- Upload artifacts.
- Build standalone binaries.
- Add hosted SaaS behavior, remote MCP, auto-update, telemetry, auth/accounts/billing, OAuth/token storage, provider writes, live GitHub behavior, deployment, live Search Console, social platform APIs, or DNS writes.
- Broaden `WRITE_POLICY_V1`.

## Options considered

Option A - Source-checkout-only current usage:

```bash
cd /Users/fabiencampana/Documents/ship-ready
pnpm install
pnpm shipready status
pnpm shipready audit https://example.com
```

From anywhere:

```bash
pnpm --dir /Users/fabiencampana/Documents/ship-ready shipready audit https://example.com
```

Decision: current supported usage.

Option B - Local developer link:

```bash
cd /Users/fabiencampana/Documents/ship-ready
pnpm install
pnpm build
pnpm link --global
shipready status
```

Decision: acceptable developer-local convenience, not distribution.

Option C - Public npm package:

Preferred future:

```bash
pnpm dlx @shipready/cli audit https://example.com
```

Decision: future execution only. Requires owner approval, `@shipready` scope control, package-root lookup update, `private` removal approval, trusted-publishing wiring, release notes, package safety review, package smoke, and post-publish smoke.

Option D - Standalone binary:

Decision: future exploration only.

Option E - Hosted/local app wrapper:

Decision: future exploration only; not part of npm publish readiness.

## Recommendation

ShipReady remains repository-local until a publish execution pass is explicitly approved. Prepare for `@shipready/cli` but keep current docs honest: source checkout works now; installed npm usage is future.

## Source-checkout usage

Current usage:

```bash
cd /Users/fabiencampana/Documents/ship-ready
pnpm install
pnpm shipready status
pnpm shipready doctor
pnpm shipready audit https://example.com
pnpm shipready audit https://example.com --no-render --json
pnpm shipready tui --url https://example.com
```

From anywhere:

```bash
pnpm --dir /Users/fabiencampana/Documents/ship-ready shipready status
pnpm --dir /Users/fabiencampana/Documents/ship-ready shipready audit https://example.com
```

Rendered checks require Playwright Chromium:

```bash
pnpm playwright:install
```

Use `--no-render` for lightweight checks when Chromium is not installed or not desired.

## Local link / global developer usage

Developer-local link usage:

```bash
cd /Users/fabiencampana/Documents/ship-ready
pnpm install
pnpm build
pnpm link --global
shipready status
```

This is a symlink to the checkout. It is not npm publication and should not be used as evidence that public installed usage works.

## npm / pnpm dlx readiness

ShipReady is not yet ready to claim npm installed usage.

Prepared:

- MIT license and `LICENSE`.
- npm-facing description, issues URL, homepage, repository, keywords, and engines.
- Preferred package direction: `@shipready/cli`.
- Fallback package direction: `@f-campana/shipready`.
- `pnpm package:smoke`.
- Pull-request/manual package-smoke workflow.
- Public package safety review checklist.
- Publish runbook.

Blocked:

- `private` remains `true`.
- `@shipready` scope ownership is not confirmed.
- Local npm auth returned `E401`.
- `package.json.name` remains `shipready` because package-root lookup expects it.
- Active trusted-publishing workflow is not wired.
- Release notes/changelog are not prepared.
- Post-publish smoke cannot run yet.

Do not claim installed usage works until publication and post-publish smoke pass.

## Standalone binary readiness

Standalone binaries are not implemented. A future pass would need browser handling, GUI assets, MCP stdio behavior, checksums, signing, and release artifact policy.

## MCP installation considerations

For current usage, launch MCP from the source checkout:

```bash
pnpm --dir /Users/fabiencampana/Documents/ship-ready --silent shipready mcp --allow-root /path/to/repo
```

`--silent` matters for stdio MCP because package-manager output must not corrupt JSON-RPC traffic. MCP remains local stdio-only.

## GUI launch considerations

For current usage, launch the GUI from the source checkout:

```bash
pnpm --dir /Users/fabiencampana/Documents/ship-ready shipready gui
```

The GUI is loopback-only and read-only. `POST /api/fix` remains absent and must return `404`.

## Security and mutation boundaries

Distribution work does not change product behavior:

- No npm publish.
- No GitHub release, tag, or upload.
- No hosted behavior.
- No remote MCP.
- No telemetry.
- No auth, accounts, billing, OAuth, or token storage.
- No live GitHub behavior.
- No target-repo Git command execution, branch creation, commit, push, or PR creation.
- No deployment behavior.
- No DNS writes.
- No live Search Console.
- No social platform APIs.
- No `WRITE_POLICY_V1` broadening.
- No new product write surface.

## Release checklist before publishing

Before npm publication or installed CLI claims:

- Confirm owner approval for exact package, version, license, and publish mechanism.
- Confirm `@shipready` scope ownership or choose approved fallback.
- Update `package.json.name` and package-root lookup together.
- Remove `private: true` only with explicit approval.
- Confirm `bin`, `files`, `repository`, `bugs`, `homepage`, `engines`, `license`, and CLI-only `main`/`exports`.
- Confirm no `postinstall`.
- Run public package safety review.
- Run `pnpm test`, `pnpm typecheck`, `pnpm build`, `git diff --check`, `pnpm shipready status --json`, `pnpm shipready doctor --json`, and `pnpm package:smoke`.
- Inspect package contents for secrets, `.env`, npm tokens, local artifacts, validation media, private data, and generated tarballs.
- Prepare changelog or release notes.
- Use trusted publishing if feasible.
- Run post-publish smoke before updating docs to installed usage.

## Decision

Current distribution remains source checkout plus pnpm. Future public npm direction is `@shipready/cli` with bin `shipready`, MIT license, early-preview positioning, explicit browser install, no `postinstall`, CLI-only metadata, and trusted publishing if feasible. Actual publication remains blocked.
