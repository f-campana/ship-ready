# Package Publish Decision

Checkpoint date: 2026-07-09

ShipReady remains a **v0 local/agent release candidate** and **source-checkout-only**. This pass decides the npm publication posture, preferred package name path, license posture, browser install story, CLI-only metadata posture, publish authority, rollback criteria, and package smoke requirement. It does not publish, reserve a name, log in to npm, use npm tokens, create a GitHub release, create a tag, upload artifacts, or change package metadata.

## Current state

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

The package publish preparation pass proved that ShipReady can be built, packed, installed into a clean temp consumer, and smoke-tested from a local tarball. That is publish-readiness evidence only. The package still has `private: true`, `license: "UNLICENSED"`, no `postinstall`, and no `main` or `exports`.

## Decision summary

- Do not publish ShipReady to npm in v0.
- Keep `private: true`.
- Keep `license: "UNLICENSED"` until the owner explicitly approves a public distribution license.
- Keep the v0 distribution story source-checkout-only.
- Treat all registry availability checks as advisory and time-bound. They do not prove ownership, authorization, or durable availability.
- If public npm publication is later approved, prefer a scoped first package: `@f-campana/shipready`, with the CLI bin still named `shipready`.
- Do not use a `postinstall` browser download. Use explicit Playwright Chromium installation and `--no-render` fallback.
- Keep the package CLI-only. Do not add `main` or `exports` until a supported import API is designed.
- Require a separate package publish blockers closure pass before any publish execution plan.
- Require local or CI packed-package smoke automation before any npm publish execution.

## Name / scope options

Option A - Keep source-checkout-only for now:

Pros:

- Lowest risk.
- No public package support expectations.
- No npm scope, token, provenance, license, rollback, or browser-install process required.
- Matches the current v0 local/agent posture.

Cons:

- Poor normal-user ergonomics.
- `pnpm dlx` still fails.
- Harder to demonstrate as a standard installed CLI.

Decision: keep this as the active v0 distribution model.

Option B - Publish unscoped `shipready`:

Pros:

- Best command and discoverability if the name remains available.
- Natural package name for future docs and demos.

Cons:

- Higher public-support and brand-expectation risk.
- More painful to reverse if the first public package is not ready.
- Availability is not ownership or approval.

Decision: do not use this as the first publish path for v0. Reconsider only after license, support, docs, and publish process are fully approved.

Option C - Publish a scoped package:

Examples:

- `@f-campana/shipready`
- `@f-campana/shipready-cli`
- `@shipready/cli`

Pros:

- Lower collision risk.
- Clearer ownership signal.
- Keeps public package ownership tied to a known npm user or organization scope.
- Still allows a CLI bin named `shipready`.

Cons:

- Less elegant package command.
- Scope ownership and npm organization setup must be confirmed.
- Public package expectations still apply.

Decision: if a future public npm publish is approved, prefer `@f-campana/shipready` first.

Option D - Do not publish; improve local-link or tarball docs:

Pros:

- Keeps the package private.
- Lets reviewers test installed shape without registry publication.

Cons:

- Not a real public distribution path.
- Does not solve `pnpm dlx` expectations.

Decision: useful only as interim evidence. It is not the recommended public distribution endpoint.

## npm registry check

Registry check method: unauthenticated HTTPS `GET` to the npm registry package document endpoint. A `404` response means the package document was not found at check time. It does not prove package ownership, scope ownership, reservation, publish authorization, legal clearance, or future availability.

Checked at: `2026-07-09T20:58:01.782Z`

| Package | Result | Source | Risk | Recommendation |
|---|---|---|---|---|
| `shipready` | Appears available; registry returned HTTP 404. | `https://registry.npmjs.org/shipready` | High brand and support expectations; availability can change; unscoped name may be harder to unwind. | Do not publish first under this name. Reconsider after a mature public-release posture exists. |
| `@shipready/cli` | Appears available; registry returned HTTP 404. | `https://registry.npmjs.org/@shipready%2Fcli` | Requires ownership or creation of the `@shipready` npm scope and a stronger brand decision. | Defer until a ShipReady npm organization exists and ownership is approved. |
| `@f-campana/shipready` | Appears available; registry returned HTTP 404. | `https://registry.npmjs.org/@f-campana%2Fshipready` | Requires confirming npm account or scope ownership; availability can change. | Recommended future first public package name if publication is approved. |
| `@f-campana/shipready-cli` | Appears available; registry returned HTTP 404. | `https://registry.npmjs.org/@f-campana%2Fshipready-cli` | Clear CLI label but more verbose; may imply `@f-campana/shipready` is reserved for a library later. | Keep as fallback if `@f-campana/shipready` is unavailable or intentionally reserved. |

No name was published, reserved, claimed, or logged into during this pass.

## Recommended package name

Recommended future package name: `@f-campana/shipready`.

Recommended future bin name: `shipready`.

Reasoning:

- The scoped package lowers collision and ownership ambiguity compared with unscoped `shipready`.
- It keeps the CLI name clean once installed.
- It matches the current repository ownership signal better than a new `@shipready` organization scope.
- It leaves unscoped `shipready` as a future brand decision instead of spending it on a v0 release candidate.

This recommendation does not authorize changing `package.json`, removing `private: true`, or publishing. A future pass must recheck registry state and npm scope ownership before any metadata change.

## License decision

Current metadata remains:

```json
{
  "private": true,
  "license": "UNLICENSED"
}
```

Decision for this pass: keep `UNLICENSED` and block npm publication until a license is explicitly approved.

Practical recommendation for a future public package:

- Use MIT if ShipReady is intended to be a permissive open-source CLI.
- Use Apache-2.0 if an explicit patent grant is important.
- Use a custom/source-available or commercial license only if ShipReady is intentionally not open source.
- Do not publish a public package with ambiguous license posture.

No license file was added or changed in this pass.

## Browser install decision

Decision: no `postinstall` browser download.

Rationale:

- Install-time browser downloads are heavy and surprising.
- They are awkward for `pnpm dlx`, CI, and locked-down environments.
- ShipReady already supports explicit Playwright Chromium installation.
- `audit --no-render` remains available when a browser is absent.
- `doctor` can report missing Chromium with actionable guidance.

Current source-checkout command remains:

```bash
pnpm playwright:install
```

Future installed-package docs must verify exact npm and pnpm commands before claiming them. The intended story is:

- install package or run the published package only after publication is approved;
- run an explicit Playwright Chromium install command when rendered checks are needed;
- use `shipready doctor --json` to confirm browser availability;
- use `shipready audit <url> --no-render --json` when rendered checks are not available.

Do not add `postinstall`.

## CLI-only / import API decision

Decision: ShipReady remains a CLI-only package.

Keep `main` and `exports` absent until there is a supported import API. The package may contain generated declaration output as a build artifact, but v0 does not claim library support. Adding `exports` only for metadata neatness would create a public import contract without a design.

## Publish authority

Publishing requires explicit approval in a future pass from the repository owner or a clearly delegated release maintainer. That approval must name:

- exact package name;
- exact version;
- exact license;
- npm account or organization scope owner;
- publish mechanism;
- post-publish smoke matrix;
- rollback/deprecate criteria;
- whether a GitHub tag or release is authorized.

Credential/process decision:

- Prefer npm trusted publishing with OIDC from an approved CI workflow, because npm documents it as token-free and provenance-generating for supported CI providers.
- If trusted publishing is not available, use a granular npm access token only through a secret manager or CI secret, never committed and never stored in ShipReady product code.
- Require npm account 2FA or the npm-published equivalent required by the registry at execution time.
- Do not run `npm login`, use npm tokens, or publish from this decision pass.

Reference docs for the future process:

- `https://docs.npmjs.com/trusted-publishers/`
- `https://docs.npmjs.com/generating-provenance-statements/`
- `https://docs.npmjs.com/requiring-2fa-for-package-publishing-and-settings-modification/`
- `https://docs.npmjs.com/creating-and-publishing-scoped-public-packages/`

## Publish process

A future publish execution plan must, at minimum:

1. Recheck registry availability and npm scope ownership.
2. Confirm the approved license and update metadata/license files in a separate reviewed change.
3. Confirm package metadata, including `name`, `version`, `private`, `license`, `bin`, `files`, `engines`, and CLI-only `main`/`exports` posture.
4. Confirm no `postinstall` browser download exists.
5. Run `pnpm test`, `pnpm typecheck`, `pnpm build`, `git diff --check`, `pnpm shipready status --json`, and `pnpm shipready doctor --json`.
6. Run a deterministic packed-package smoke from a clean temp consumer.
7. Inspect package contents with a pack dry run or tarball listing and confirm no secrets, source-only artifacts, validation media, local paths, `.env`, npm tokens, or generated tarballs are included.
8. Confirm installed usage docs are truthful and separate source-checkout, local link, package install, and `pnpm dlx` paths.
9. Confirm the browser install docs and `--no-render` fallback from a clean environment.
10. Confirm the MCP stdio launch story from an installed package.
11. Apply a SemVer version bump only when the exact publish is approved.
12. Prepare changelog or release notes before publishing.
13. Decide whether a GitHub tag or release is authorized. Do not create one automatically.
14. Publish only through the approved process.
15. Run post-publish smoke from a fresh environment before changing public docs to say installed usage works.

For a scoped public package, the future command would likely require public access publication, but the exact npm command must be validated against the npm CLI version and registry rules at execution time.

## Rollback / deprecate process

Do not rely on rollback as the primary safety mechanism. Prevent bad publishes through packed-package smoke, package-content review, and explicit approval first.

Deprecate or otherwise withdraw guidance for a published version if any of these are true:

- package contains secrets, private data, local validation evidence, or unintended artifacts;
- package name, scope, version, or license is wrong;
- `private` was removed without approval;
- install or `pnpm dlx` smoke fails in a clean environment;
- browser installation guidance is wrong or causes unwanted install-time side effects;
- package behavior violates source-checkout safety boundaries;
- docs falsely claim live GitHub, deployment, DNS, Search Console, social API, auth, hosted, telemetry, or remote MCP behavior;
- `POST /api/fix`, MCP write policy, or target-repo mutation boundaries regress.

Preferred response:

1. Stop promoting the affected install path.
2. Deprecate the bad version with a clear message when supported by npm policy.
3. Publish a fixed patch version only after the full publish process passes again.
4. Rotate credentials if any secret exposure is suspected.
5. Update docs and release notes with the affected version and corrected path.
6. Remove or amend any GitHub release/tag only if one was explicitly created and the release owner approves the correction.

## CI package smoke decision

Decision: require package smoke automation before publication, but do not add it in this decision pass.

Reasoning:

- This pass is meant to make the publish decision explicit, not add a new release workflow.
- Manual packed-tarball smoke already exists as evidence from the package preparation pass.
- Publication should still be blocked until a repeatable local or CI smoke script exists.

Required future script behavior:

- build;
- pack locally;
- install the tarball into a clean temporary consumer;
- run `shipready --version`, `shipready status --json`, `shipready doctor --json`, and at least one no-render audit smoke;
- smoke TUI non-TTY fallback and MCP startup when practical;
- verify browser-missing behavior and `--no-render` fallback;
- delete tarball and temporary directories;
- leave the repository clean;
- never publish, upload, tag, create a release, or create persistent artifacts.

## Remaining blockers

- Publication is not approved.
- `private` remains `true`.
- License remains `UNLICENSED`; no public license is approved.
- npm scope ownership for `@f-campana/shipready` is not confirmed.
- Registry availability can change before any future pass.
- No npm trusted-publishing or token process is configured.
- No package smoke script or CI job is wired.
- Installed usage docs are not ready to claim npm or `pnpm dlx`.
- Browser install commands for npm and `pnpm dlx` must be verified after the final package name is chosen.
- Post-publish smoke criteria are not yet executable.
- GitHub tag/release policy is not approved.

## Recommendation

Keep ShipReady v0 source-checkout-only. Do not publish now.

If npm publication becomes a product goal, pursue a scoped package path first: `@f-campana/shipready` with bin `shipready`, a separately approved MIT license unless a different business decision is made, no `postinstall`, CLI-only package metadata, trusted publishing/provenance when available, packed-package smoke automation, and post-publish smoke before any docs claim installed usage.

## Next step

Recommended next pass: **Package publish blockers closure**.

That pass should not publish by default. It should close or explicitly defer the remaining blockers: license approval, npm scope ownership, exact package metadata change plan, trusted-publishing or token process, local/CI packed-package smoke automation, installed usage docs, browser install verification, rollback/deprecate checklist, and GitHub tag/release policy. Only after that should a separate publish execution plan be considered.
