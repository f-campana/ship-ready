# Package Publish Blockers

Checkpoint date: 2026-07-10

This ledger tracks what is closed, what remains blocked, and what must stay out of scope before any npm publish execution. It is readiness evidence only; it does not authorize publishing.

## Closed in this pass

- Owner decision recorded: publish ShipReady to npm eventually, but not in this pass.
- Product brand decision recorded: ShipReady is its own brand; ImageForge is separate.
- Preferred future package recorded: `@shipready/cli`.
- Fallback package recorded: `@f-campana/shipready`.
- First public audience recorded: early users.
- First public release posture recorded: experimental / early preview.
- First public version direction recorded: likely `0.1.0`, SemVer from day one.
- Bin decision preserved: `shipready`.
- Package remains CLI-only; `main` and `exports` stay absent.
- MIT license selected; `LICENSE` added.
- `package.json` license changed to `MIT` while `private: true` remains.
- GitHub issues URL and homepage metadata added.
- No `postinstall` browser download preserved.
- Repeatable local package smoke script added: `pnpm package:smoke`.
- Pull-request/manual package smoke workflow added with no publish job or npm token.
- Public package safety review checklist added in [PUBLIC_PACKAGE_SAFETY_REVIEW.md](PUBLIC_PACKAGE_SAFETY_REVIEW.md).
- Publish runbook added in [PUBLISH_RUNBOOK.md](PUBLISH_RUNBOOK.md), with actual publish still blocked.
- Package-root lookup now accepts only `shipready`, `@shipready/cli`, or `@f-campana/shipready` when the ShipReady bin and canonical runtime markers are present.
- Focused tests cover current, preferred future, fallback, unrelated-name, canonical-resource allowlist, and incomplete-package lookup behavior.
- Non-publishing publish preflight workflow added for pull requests and manual dispatch with read-only repository permissions.
- `CHANGELOG.md` now contains experimental `0.1.0 - Unreleased` notes and explicit product limitations.
- Trusted-publishing owner actions and stop gates are documented without adding an active publish job.

## Still blocking publish

- Actual owner approval for the exact publish has not been granted.
- Actual npm publish remains unauthorized.
- `private` remains `true`.
- `@shipready` npm scope ownership is not confirmed.
- Local npm auth is invalid; `npm whoami` and `npm org ls shipready --json` returned `E401`.
- `package.json.name` remains `shipready`; changing it to `@shipready/cli` still requires confirmed scope control, exact owner approval, and a package-name-transition packed-install smoke.
- Trusted publishing is not wired as an active release workflow.
- Published-package browser install guidance and rendered `pnpm dlx` behavior are not verified.
- Post-publish smoke from the registry is not executable until publication is approved.
- GitHub tag/release creation is not approved.

## npm verification summary

Read-only checks were re-run at `2026-07-10T09:58Z`:

- `npm owner ls @imageforge/cli` succeeded and showed existing `@imageforge/cli` ownership evidence.
- `npm view @shipready/cli --json` returned `E404`.
- `npm view @f-campana/shipready --json` returned `E404`.
- `npm view shipready --json` returned `E404`.
- `npm whoami` and `npm org ls shipready --json` returned `E401`.

An `E404` package view is not ownership. An ImageForge ownership result is not `@shipready` authorization.

## Safety gates before publish

- Keep GUI local/read-only and `POST /api/fix` returning `404`.
- Keep TUI read-only and human-only.
- Keep MCP stdio-only with exactly one target-repo write tool: `shipready.write_safe_crawl_files`.
- Keep `WRITE_POLICY_V1` canonical and limited to creation-only missing robots/sitemap files.
- Keep Patch export review-only.
- Keep GitHub PR draft review-only with no GitHub/Git execution.
- Keep Search Console mock-backed only.
- Keep DNS read-only.
- Keep social preview platform-API-free.
- Keep crawl bounded and non-exhaustive.
- Keep no telemetry, auth/accounts/billing, OAuth/token storage, hosted SaaS behavior, remote MCP, deployment automation, provider writes, or live GitHub behavior.
- Keep package contents free of secrets, `.env`, npm tokens, local validation media, generated tarballs, and private artifacts.
- Keep Fodmapp unchanged.

## Recommendation

Do not publish yet. The next safe pass is **npm scope control confirmation and package-name transition planning**: the owner authenticates outside the repository, proves control of `@shipready` or approves the fallback, and explicitly decides whether to authorize a separate package-name transition pass. Actual publish execution remains a later, separately approved pass.
