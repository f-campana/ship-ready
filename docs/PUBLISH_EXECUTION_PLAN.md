# Publish Execution Plan

Checkpoint date: 2026-07-11

## Current posture

This pass does not publish. ShipReady remains repository-local and unpublished. `package.json` is still `@ship-ready/cli` version `0.1.0`, exposes the `shipready` bin, uses the MIT license, and retains `private: true`. `.github/workflows/publish.yml` remains a manual validation-only gate with read-only permissions; it cannot publish. Installed usage, including `pnpm dlx @ship-ready/cli audit https://example.com`, remains future-labeled.

## Owner approvals required

Before a publish execution pass, the owner must explicitly approve:

1. Publishing package `@ship-ready/cli` at version `0.1.0` under the MIT license as an experimental / early preview.
2. The release timing and the exact publish execution commit.
3. Removing `private: true` in that execution commit.
4. Converting `publish.yml` to the reviewed trusted-publishing workflow described below.
5. GitHub environment `npm-publish` and the npm trusted-publisher setup.
6. Whether GitHub tag or release creation is authorized. Without separate approval, neither may be created.
7. Marking changelog version `0.1.0` released only during publish execution.

Approval of this plan is not approval to publish.

## Exact release target

- Package: `@ship-ready/cli`
- Bin: `shipready`
- Version: `0.1.0`
- License: MIT
- Posture: experimental / early preview
- Mechanism: npm trusted publishing from GitHub Actions

## Pre-execution owner setup

Before actual publish execution, configure npm trusted publishing in the npm UI with this exact identity:

- Package/scope: `@ship-ready/cli`
- Provider: GitHub Actions
- Repository: `f-campana/ship-ready`
- Workflow filename: `publish.yml`
- Environment: `npm-publish`

Protect the GitHub `npm-publish` environment with required owner approval where practical. Do not add `NPM_TOKEN` or `NODE_AUTH_TOKEN`. Completing this setup does not publish: the current workflow intentionally has only `contents: read`, no trusted-publishing permission, and no publication command.

## Proposed release diff

The later, separately approved publish execution pass would apply exactly this release-enabling diff; none of it is applied now:

1. Remove `private: true` from `package.json`. Prefer absence over `private: false`; use `false` only if the chosen package-manager validation requires that shape.
2. Convert `.github/workflows/publish.yml` from its validation-only gate to the approved manual release workflow.
3. Add `id-token: write` only to the release job that publishes.
4. Keep `contents: read` unless tag or GitHub release creation receives separate approval.
5. Add `npm publish --access public` only inside the approved release job.
6. Keep the workflow free of `NPM_TOKEN` and `NODE_AUTH_TOKEN` when using trusted publishing.
7. Change `CHANGELOG.md` from `0.1.0 - Unreleased` to the actual release date only during publish execution.
8. Do not update README installed usage until registry-backed post-publish smoke passes.

No dependency change, public import API, `postinstall`, or product behavior change is proposed.

## Proposed publish workflow change

The likely workflow remains manual-only with `workflow_dispatch` inputs `confirm_publish` and `version`. Before its release job can publish, it must enforce all of these gates:

- `confirm_publish` exactly equals `PUBLISH @ship-ready/cli 0.1.0`.
- `package.json.name` equals `@ship-ready/cli`.
- `package.json.version` equals the supplied `version` input and `0.1.0` for this release.
- `package.json.private` is absent or `false`, and only in the approved publish execution commit.
- `package.json.license` equals `MIT`.
- `pnpm package:smoke` passes.
- `pnpm publish:preflight` passes before publication, updated in the execution commit to validate the approved release posture rather than require `private: true`.
- The packed-tarball content and prohibited-content search pass.
- [PUBLIC_PACKAGE_SAFETY_REVIEW.md](PUBLIC_PACKAGE_SAFETY_REVIEW.md) is rechecked and passes.

The release job alone receives `id-token: write`. If tag/release creation is not separately approved, the workflow must not create a tag, GitHub release, or artifact upload.

## Proposed package metadata change

The only proposed package metadata change is removal of `private: true` (or explicit `private: false` only if required). Name, version, bin, license, repository, bugs, homepage, engines, files whitelist, and no-`postinstall` posture remain unchanged.

## Pre-publish validation

Run from a clean, reviewed publish execution commit:

```bash
pnpm test
pnpm typecheck
pnpm build
git diff --check
pnpm shipready status --json
pnpm shipready doctor --json
pnpm package:smoke
pnpm publish:preflight
find . -maxdepth 3 -name "*.tgz"
```

The final command must print nothing. Inspect the temporary packed contents and confirm no secrets, environment files, tokens, private data, local validation media, or generated tarballs are included.

## Publish execution sequence

1. Confirm the npm trusted-publisher identity and protected GitHub environment are configured.
2. Record all exact owner approvals listed above.
3. Prepare and review the narrowly scoped release diff.
4. Run every pre-publish validation and stop on any discrepancy.
5. Merge or select the exact approved execution commit on `main` without creating a tag or release unless separately authorized.
6. Manually dispatch `publish.yml` with version `0.1.0` and confirmation `PUBLISH @ship-ready/cli 0.1.0`.
7. Verify the workflow gates complete and the trusted-publishing release job succeeds.
8. Run registry-backed post-publish smoke from a clean environment before changing installed-usage documentation.

## Post-publish smoke

Only after a verified publication, run from a clean environment:

```bash
pnpm dlx @ship-ready/cli --version
pnpm dlx @ship-ready/cli status --json
pnpm dlx @ship-ready/cli doctor --json
pnpm dlx @ship-ready/cli audit https://example.com --no-render --json
pnpm dlx @ship-ready/cli tui --url https://example.com --no-render
```

Require version `0.1.0`, parseable JSON where requested, and successful lightweight CLI execution. Rendered/browser checks remain separate until explicit browser-install behavior is verified. Do not claim global installation or rendered checks work based on this lightweight smoke.

## Docs switch after post-publish smoke

Do not switch README installed usage or state that `pnpm dlx @ship-ready/cli` works until all registry-backed smoke commands above pass. After they pass, a separate docs commit may replace repository-local-only wording with the verified commands and retain explicit Playwright browser-install guidance. Failed smoke leaves current future-labeled wording unchanged.

## Stop conditions

Stop before publication if any approval is missing; trusted-publisher identity differs; branch or version differs; `private` was changed outside the approved execution commit; metadata, smoke, preflight, safety review, tarball inspection, or tests fail; a token-based flow appears; unexpected tag/release/upload behavior appears; the worktree is not clean and understood; or installed usage would be documented before smoke.

## Rollback / deprecate plan

An npm publication cannot be treated as atomically reversible. For a bad release, stop documentation changes and further publishes, assess impact, and prefer publishing a corrected patch. If the package is unsafe or misleading, use npm deprecation with an owner-approved message directing users to a safe version. Unpublish only if npm policy, timing, and owner approval make it appropriate. Tag or GitHub release rollback is out of scope unless those artifacts were separately authorized and created.

## Recommendation

Keep publication disabled. The recommended next pass is owner trusted-publisher setup. Only after setup is confirmed and every exact approval is recorded should the next pass become publish execution approval. This plan itself grants no publish authority.
