# Package Publish Decision

Checkpoint date: 2026-07-10

ShipReady is moving toward an eventual public npm release, but this pass is **publish readiness only**. It records owner decisions, updates package metadata for an eventual open-source CLI, adds repeatable smoke automation, and keeps npm publication blocked. It did not publish, reserve names, log in to npm, use npm tokens, create a GitHub release, create a tag, upload artifacts, or add product behavior.

## Current state

Current supported usage remains repository-local:

```bash
cd /Users/fabiencampana/Documents/ship-ready && pnpm shipready ...
pnpm --dir /Users/fabiencampana/Documents/ship-ready shipready ...
```

Future intended package usage, after an approved publish execution pass, is:

```bash
pnpm dlx @shipready/cli audit https://example.com
```

That future command is not live yet. The package still has `private: true`; publication is blocked. `package.json.name` remains `shipready` because `@shipready` control and exact owner approval are not confirmed. Runtime package-root lookup is now hardened for the current, preferred future, and fallback names, but an approved name transition still requires packed-install verification.

## Decision summary

- Publish ShipReady to npm eventually, but do not publish in this pass.
- Keep `private: true`.
- Use MIT for the open-source license; no concrete reason to prefer Apache-2.0 was found.
- Add `LICENSE` with `Copyright (c) 2026 Fabien Campana`.
- Keep the CLI-only package shape: bin `shipready`; no `main` or `exports`.
- Preferred future package name: `@shipready/cli`.
- Fallback package name if the `@shipready` scope cannot be controlled soon: `@f-campana/shipready`.
- Avoid `@imageforge/*` because ImageForge remains separate and is not ShipReady's umbrella brand.
- Avoid unscoped `shipready` for the first public release to avoid spending the brand name too early.
- First public version remains likely `0.1.0`; use SemVer from day one.
- Mark the first npm release as experimental / early preview.
- Keep the prepared `0.1.0 - Unreleased` changelog unreleased until publish execution.
- Prefer GitHub Actions trusted publishing if feasible, but do not add an active publish workflow here.
- Require owner-only approval for actual publish for now.
- Public issues are acceptable; package metadata points to GitHub issues.

## Name / scope options

Option A - `@shipready/cli`:

Pros:

- Best product-brand alignment.
- Keeps the package name and desired command clear.
- Separates ShipReady from ImageForge.
- Keeps executable ergonomics clean with bin `shipready`.

Cons:

- Requires creating or controlling the `@shipready` npm scope.
- Current npm auth did not prove org or scope ownership.
- Requires changing `package.json.name` and package-root lookup safely before publish.

Decision: preferred future package name, assuming owner controls the scope before publish.

Option B - `@f-campana/shipready`:

Pros:

- Clear fallback tied to the current GitHub repository owner.
- Lower collision risk than an unscoped package.
- Keeps bin `shipready`.

Cons:

- Less clean as a product brand than `@shipready/cli`.
- Still requires npm account/scope ownership confirmation.

Decision: fallback if `@shipready` cannot be controlled soon.

Option C - unscoped `shipready`:

Pros:

- Cleanest package name if available.

Cons:

- Higher brand/support expectations.
- More painful to unwind if the first public release is too early.
- Availability is not ownership.

Decision: avoid for the first public release.

Option D - `@imageforge/*`:

Decision: avoid unless ImageForge is explicitly turned into an umbrella brand later.

## npm registry check

Read-only npm checks were run at `2026-07-09T23:01Z`. No `npm login`, token use, owner mutation, org mutation, access mutation, publish, tag, release, or upload command was run.

| Check | Result | Interpretation |
|---|---|---|
| `npm whoami` | Failed with `E401 Unauthorized`. | Local npm auth appears invalid; do not assume publish authority. |
| `npm owner ls @imageforge/cli` | Succeeded and showed existing package ownership for `@imageforge/cli`. | Confirms ImageForge package ownership evidence only; does not imply `@shipready` control. |
| `npm org ls imageforge --json` | Failed with `E401`. | ImageForge org membership/ownership not confirmed in this pass. |
| `npm org ls shipready --json` | Failed with `E401`. | `@shipready` org/scope ownership not confirmed; owner must create/control it before publish. |
| `npm view @shipready/cli --json` | Failed with `E404`. | Package document was not found or not accessible at check time; this is not scope ownership. |
| `npm view @f-campana/shipready --json` | Failed with `E404`. | Package document was not found or not accessible at check time; ownership still must be confirmed. |
| `npm view shipready --json` | Failed with `E404`. | Unscoped package document was not found or not accessible at check time; still not recommended first. |

These results are time-bound and advisory. They do not reserve a name or prove durable availability.

## Recommended package name

Recommended future package name: `@shipready/cli`.

Recommended future bin name: `shipready`.

Fallback: `@f-campana/shipready`.

Reasoning:

- `@shipready/cli` matches ShipReady as its own product brand.
- It keeps ImageForge separate.
- It avoids spending the unscoped `shipready` package name on the first early-preview release.
- It still gives users the clean executable: `shipready`.

Do not change `package.json.name` to `@shipready/cli` until scope ownership is confirmed and package-root resource lookup is updated and smoke-tested.

## License decision

Decision: MIT.

Rationale:

- Owner explicitly wants open source and is comfortable with forking, modification, and redistribution.
- MIT matches that permissive distribution intent.
- No concrete patent-grant requirement or dependency constraint was found that would make Apache-2.0 clearly preferable.

This pass changes package metadata from `UNLICENSED` to `MIT` while keeping `private: true`, and adds the MIT `LICENSE` file with the provided fallback copyright holder.

## Browser install decision

Decision: keep no `postinstall` browser download.

Rendered checks require Playwright Chromium. Source-checkout and future installed-package docs should use an explicit browser install step when rendered checks are needed. `audit --no-render --json` remains the lightweight path for CI and eventual `pnpm dlx` usage.

Do not claim rendered `pnpm dlx` behavior until the package is published and verified. Graceful raw-only fallback when Chromium is missing remains a publish-ergonomics improvement candidate, but this pass only documents it as a blocker rather than changing audit behavior.

## CLI-only / import API decision

ShipReady remains CLI-only for now.

Keep `main` and `exports` absent until a supported import API is designed. MCP resources, docs, contracts, skills, GUI, TUI, and patch/PR-draft features remain packaged CLI resources, not public JavaScript imports.

## Publish authority

Actual publish requires owner-only approval for now. Approval must name:

- exact package name;
- exact version;
- exact license;
- npm account or organization scope owner;
- publish mechanism;
- post-publish smoke matrix;
- rollback/deprecate criteria;
- whether a GitHub tag or release is authorized.

Preferred mechanism: GitHub Actions trusted publishing / OIDC if feasible. Do not use or store npm tokens in product code. If trusted publishing is not feasible, a granular npm token may be used only through an approved secret manager or CI secret in a future execution pass.

## Publish process

A future publish execution plan must, at minimum:

1. Confirm owner approval for the exact package/version/license.
2. Confirm `@shipready` scope ownership or choose the approved fallback.
3. Update `package.json.name` only after lookup-readiness tests pass, with confirmed scope control, explicit owner approval, and packed-install smoke under the selected name.
4. Confirm `private` removal is explicitly approved for the publish commit.
5. Confirm `license`, `bin`, `files`, `repository`, `bugs`, `homepage`, `engines`, and CLI-only `main`/`exports`.
6. Run public package safety review.
7. Run `pnpm test`, `pnpm typecheck`, `pnpm build`, `git diff --check`, `pnpm shipready status --json`, and `pnpm shipready doctor --json`.
8. Run `pnpm package:smoke`.
9. Inspect package contents and confirm no secrets, local artifacts, validation media, `.env`, npm tokens, generated tarballs, or private data are included.
10. Finalize the prepared changelog or release notes without marking the release published early.
11. Wire or execute trusted publishing only after explicit approval.
12. Create GitHub tag/release only in the actual publish execution pass if explicitly authorized.
13. Run post-publish smoke from a fresh environment before public docs claim installed usage works.

## Rollback / deprecate process

Do not rely on rollback as the primary safety mechanism. Prevent bad publishes through packed-package smoke, package-content review, safety review, and explicit owner approval.

Deprecate or otherwise withdraw guidance for a published version if any of these are true:

- package contains secrets, private data, local validation evidence, or unintended artifacts;
- package name, scope, version, license, or `private` setting is wrong;
- install or `pnpm dlx` smoke fails in a clean environment;
- browser installation guidance is wrong or causes unwanted install-time side effects;
- package behavior violates the source-checkout safety boundaries;
- docs falsely claim live GitHub, deployment, DNS, Search Console, social API, auth, hosted, telemetry, or remote MCP behavior;
- `POST /api/fix`, MCP write policy, or target-repo mutation boundaries regress.

## CI package smoke decision

Decision: keep `pnpm package:smoke`, the package-smoke workflow, and a separate non-publishing publish-preflight workflow.

The smoke script:

- uses temporary directories;
- runs `pnpm build`;
- runs `pnpm pack` into a temp destination;
- installs the tarball into a clean temp consumer with install scripts ignored;
- runs `shipready --version`;
- runs `shipready status --json`;
- runs `shipready doctor --json`;
- runs `shipready audit <local fixture URL> --no-render --json`;
- runs `shipready tui --url <local fixture URL> --no-render` in non-TTY/CI fallback mode;
- verifies no `.tgz` tarball remains in the repository;
- does not publish, upload, require npm auth, mutate Fodmapp, or add product write behavior.

The workflow runs on `pull_request` and `workflow_dispatch`. It installs dependencies, typechecks, tests, builds, explicitly installs Playwright Chromium, and runs `pnpm package:smoke`. It has read-only repository permissions and no npm token or publish job.

## Remaining blockers

- Actual npm publish remains unauthorized.
- `private` remains `true`.
- `@shipready` npm scope ownership is not confirmed.
- Local npm auth is invalid; `npm whoami` and org checks returned `E401`.
- `package.json.name` is still `shipready`; changing it needs confirmed scope control, owner approval, and transition smoke even though lookup is now ready.
- Trusted publishing is documented but not wired as an active publish workflow.
- `CHANGELOG.md` is prepared as `0.1.0 - Unreleased`; it must not be marked released before execution.
- Browser install behavior for published `pnpm dlx` rendered checks must be verified after publication.
- Public installed-usage docs must remain future-labeled until post-publish smoke passes.
- GitHub tag/release policy remains publish-execution-only and owner-approved.

## Recommendation

Keep ShipReady private and unpublished for this pass. Do not publish now. Prepare the next pass as npm scope control confirmation and package-name transition planning, not publish execution.

Target package: `@shipready/cli` with bin `shipready`, MIT license, SemVer `0.1.0`, early-preview positioning, no `postinstall`, CLI-only metadata, trusted publishing if feasible, package smoke automation, and public safety review before publish.

## Next step

Recommended next pass: **npm scope control confirmation and package-name transition planning**. Confirm authenticated control of `@shipready` or approve the fallback before authorizing any package metadata transition. Actual npm publication remains a later pass requiring exact owner approval.
