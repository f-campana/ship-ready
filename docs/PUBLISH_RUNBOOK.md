# Publish Runbook

Checkpoint date: 2026-07-10

This is a future execution runbook. It is not authorization to publish. Do not run publish commands, create tags, create GitHub releases, upload artifacts, or remove `private: true` unless the owner explicitly approves the exact release.

## Intended release shape

- Package: `@ship-ready/cli`, if the owner controls the `@ship-ready` npm scope.
- Fallback: `@f-campana/shipready`.
- Bin: `shipready`.
- Version: likely `0.1.0`.
- License: MIT.
- Posture: experimental / early preview.
- First audience: early users with generated websites.
- Package type: CLI-only; no public JavaScript import API.
- Browser story: no `postinstall`; explicit Playwright Chromium install for rendered checks; `--no-render` for lightweight and `pnpm dlx`-friendly checks.
- Publish mechanism: GitHub Actions trusted publishing if feasible.

## Pre-approval checklist

Before any execution pass:

1. Owner approves the exact package name, version, license, and release timing.
2. Owner confirms `@ship-ready` scope ownership or approves fallback package.
3. Owner approves removal of `private: true` for the publish commit.
4. Owner approves trusted publishing or the fallback credential process.
5. Owner approves whether a GitHub tag/release will be created.
6. Release notes or changelog are prepared.
7. Public package safety review passes.

## Metadata checklist

Verify before publish execution:

- `package.json.name` is the approved package name.
- Package-root resource lookup works with the approved package name.
- `bin.shipready` points to `./dist/index.js`.
- `private` removal is explicitly approved for the release commit.
- `license` is `MIT`.
- `LICENSE` is packaged.
- `repository`, `bugs`, and `homepage` point to `f-campana/ship-ready`.
- `main` and `exports` remain absent unless a public import API has been designed.
- `files` whitelist excludes source-only, test, validation media, secret, and tarball artifacts.
- No `postinstall` script exists.

## Required validation

Run before publish execution:

```bash
pnpm test
pnpm typecheck
pnpm build
git diff --check
pnpm shipready status --json
pnpm shipready doctor --json
pnpm package:smoke
find . -maxdepth 3 -name "*.tgz"
```

The final `find` command must print nothing. Any generated tarball must stay in a temp directory and must not be committed.

## Trusted publishing plan

Preferred future approach:

- Create or control the `@ship-ready` npm organization/scope, or explicitly approve `@f-campana/shipready` as the fallback.
- Authenticate to npm outside the repository and confirm the selected package/scope account; do not add credentials to product code or committed files.
- In npm, configure a trusted publisher for GitHub repository `f-campana/ship-ready` and the exact future release workflow filename and environment.
- Use a protected release environment with required owner approval if practical.
- Keep workflow permissions minimal and grant trusted-publishing permissions only to the future release job that needs them.
- Require explicit owner approval naming package, version, timing, workflow, and environment.
- Run `.github/workflows/publish-preflight.yml` successfully before preparing any release commit.
- Remove `private: true` only in the approved publish execution commit.
- Publish only from the separately approved release workflow.
- Run clean registry-backed post-publish smoke before changing docs to claim installed usage.
- Do not store npm tokens in product code.
- Do not print secrets or registry credentials.
- Do not publish from pull-request workflows.

This pass intentionally adds no active publish job. `.github/workflows/publish-preflight.yml` and `.github/workflows/package-smoke.yml` validate readiness only, with read-only repository permissions and no trusted-publishing permission, release job, tag, upload, or registry credential.

## Owner actions outside this repository

The owner must complete and record these actions before any publish execution plan can be approved:

1. Reconfirm the authenticated npm identity and `@ship-ready` organization ownership immediately before any separately approved execution.
2. Preserve `@f-campana/shipready` only as the documented fallback.
3. Configure npm trusted publishing for `f-campana/ship-ready`, restricted to the exact future release workflow and protected environment.
4. Approve the exact package name, `0.1.0` version, MIT license, release timing, publish mechanism, and whether any GitHub tag/release is separately authorized.
5. Separately approve removal of `private: true` only in a future execution commit; the package-name transition is already complete.

If any item is missing, stop. The repository preflight is evidence, not approval.

## Execution outline

Only after explicit owner approval:

1. Run publish preflight and re-run read-only npm scope and package checks.
2. Update package name only if approved, then rerun package-root tests and packed-install smoke.
3. Remove `private: true` only in the approved publish execution commit.
4. Run the required validation matrix.
5. Inspect packed contents.
6. Publish through the approved trusted-publishing workflow.
7. Run post-publish smoke from a fresh environment.
8. Update installed-usage docs only after post-publish smoke passes.
9. Create a GitHub tag/release only if separately approved.

## Post-publish smoke

After publication, verify from a clean environment:

```bash
pnpm dlx @ship-ready/cli --version
pnpm dlx @ship-ready/cli status --json
pnpm dlx @ship-ready/cli doctor --json
pnpm dlx @ship-ready/cli audit https://example.com --no-render --json
pnpm dlx @ship-ready/cli tui --url https://example.com --no-render
```

Rendered audit claims require explicit Playwright Chromium install verification before they are documented as supported.

## Stop conditions

Stop and do not publish if:

- owner approval is incomplete;
- `@ship-ready` scope control cannot be reconfirmed immediately before an approved execution;
- validation fails;
- package contents include secrets, local artifacts, validation media, generated tarballs, or private data;
- package behavior expands write surfaces;
- public docs overclaim live GitHub, deployment, DNS provider, live Search Console, social platform, hosted, telemetry, auth, billing, or remote MCP behavior;
- any npm command would require login or token handling outside the approved release mechanism.
