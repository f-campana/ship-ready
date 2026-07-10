# Public Package Safety Review

Checkpoint date: 2026-07-10

This review must pass before any public npm publish execution. Current result after the publish-preflight wiring pass: **pass with blockers unrelated to product safety**. The product write surface remains acceptable for an early-preview package if all checklist items below stay true.

## Recommendation

Keep `fix --write --allow-create` enabled for v0 if this review still passes during the publish execution pass. Do not hide it behind an environment flag now. The current double explicitness (`--write --allow-create`) plus `WRITE_POLICY_V1` is enough for v0 because the only allowed writes are creation-only missing robots/sitemap files at allowlisted paths, with no overwrites.

## Product safety checklist

- GUI is local/read-only.
- `POST /api/fix` returns `404`.
- TUI is read-only, human-only, and has no JSON/write contract.
- MCP remains stdio-only.
- MCP exposes exactly one target-repo write tool: `shipready.write_safe_crawl_files`.
- MCP write requires allowed-root authorization, a fresh preview receipt, exact confirmation, and regenerated validation.
- `WRITE_POLICY_V1` remains canonical.
- Writes are limited to creation-only missing robots/sitemap files.
- Existing files are never overwritten, deleted, renamed, or formatted.
- Metadata, content, JSON-LD, package files, configuration, and lockfiles are not written.
- Patch export is review-only and does not apply patches.
- GitHub PR draft is review-only and does not call GitHub, `gh`, or Git.
- No live GitHub PR creation, branch creation, commit, push, target-repo Git execution, deployment, or provider mutation exists.
- Search Console remains mock-backed only; no Google API, OAuth, token storage, sitemap submission, or indexing request exists.
- DNS readiness is read-only; no DNS provider credentials or writes exist.
- Recheck is read-only and does not deploy.
- Social preview is platform-API-free and does not scrape platform preview endpoints.
- Generated-site smells are heuristic and authorship-neutral.
- Bounded crawl is same-origin, capped, non-exhaustive, and read-only.
- No hosted SaaS behavior, remote MCP, telemetry, auth/accounts/billing, OAuth/token storage, or provider account custody exists.
- Public docs do not promise indexing, ranking, deployment, exact third-party previews, or automated repair outcomes.
- Package contents exclude secrets, `.env`, npm tokens, local validation artifacts, generated tarballs, and private data.

## Public wording checklist

Approved public promise:

> ShipReady is a local launch-readiness CLI for generated websites. It checks what crawlers and preview bots can see before launch and shows safe next actions.

Required public posture:

- Say early preview.
- Say issues are welcome and support is limited.
- Say generated websites are the first audience.
- Focus npm-facing docs on `doctor`, `audit`, `audit --no-render`, `tui`, and `status`.
- Mention GUI, MCP, patch export, PR draft, and guarded safe crawl-file creation as advanced.
- Keep installed usage future-labeled until publication and post-publish smoke pass.
- Avoid claiming live GitHub, deployment, DNS provider, Search Console live, social platform, hosted, telemetry, auth, billing, or remote MCP behavior.

## Package-content checklist

Before publish execution, inspect the packed contents and confirm only intended package resources are present:

- `dist/`
- `CHANGELOG.md`
- `LICENSE`
- `README.md`
- `docs/`
- `skills/shipready-launch-readiness/`
- `validation/contracts/`
- `package.json`

Confirm these are absent:

- `src/`
- `tests/`
- `.env`
- npm tokens or credentials
- generated `.tgz` tarballs
- local screenshots, videos, logs, and validation-only media
- untracked `validation/e2e-project-review/`
- private data or local machine paths that are not intentional documentation examples

## Current result

The current product safety boundary passes re-review. Package-root and preflight changes add no product write surface and leave `WRITE_POLICY_V1` unchanged. Remaining publish blockers are process and ownership blockers: owner approval, `@ship-ready` scope control or fallback approval, `package.json.name` transition, active trusted-publishing release wiring, published browser-install verification, post-publish smoke, and GitHub tag/release approval. Release notes are prepared but remain explicitly unreleased.
