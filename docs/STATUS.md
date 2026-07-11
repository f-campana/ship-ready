# Status

## Position

ShipReady is a local launch-readiness CLI for generated websites. It checks what crawlers and preview bots can see before launch and shows safe next actions. **CLI first. MCP second. GUI third.**

Release classification: **v0 local/agent release candidate**.

Distribution classification: **repository-local now; npm-ready direction documented, not published**. ShipReady is not yet published to npm. Current usage is source checkout. Future preferred package usage is `pnpm dlx @ship-ready/cli audit https://example.com`, but that remains blocked until publish approval and post-publish smoke pass.

## What exists

- Public single-page audit with raw/rendered metadata comparison and `--no-render`.
- Read-only bounded multi-page crawl.
- Read-only `status` and `doctor`.
- Polished terminal review output and read-only TUI viewer.
- Crawl-resource, metadata, social-preview, structure, accessibility, and launch-hygiene checks.
- Read-only social preview simulator.
- Read-only generated-site implementation smell detector.
- Bounded read-only repository inspection.
- Read-only fix planning and exact dry-run previews.
- Review-only patch export.
- Review-only GitHub PR draft / PR handoff.
- Strict V1 creation-only writes for eligible missing crawl files.
- Read-only post-write recheck.
- Versioned `ui-report-v1` and self-contained HTML reports.
- Local read-only GUI review cockpit with `POST /api/review`; `POST /api/fix` remains `404`.
- Local MCP stdio server with fifteen read-only tools and one guarded safe-write tool.
- Mock-backed Search Console status prototype.
- Read-only DNS readiness status.
- Repository-local ShipReady Launch Readiness skill.
- MIT license and public package metadata while `private: true` remains.
- Package smoke script and package-smoke GitHub Actions workflow.
- Non-publishing publish-preflight workflow with explicit metadata, workflow, and tarball stop gates.
- Validation-only publish release gate using stable `publish.yml` / `npm-publish` identity; it cannot publish.
- Package-root lookup readiness for `shipready`, `@ship-ready/cli`, and `@f-campana/shipready` with fail-closed runtime markers.
- `0.1.0 - Unreleased` experimental preview changelog.
- Public package safety review and publish runbook.

## What is not built

- Published npm package.
- Verified installed `pnpm dlx @ship-ready/cli` path.
- Active npm publish workflow.
- Any MCP write tool beyond `shipready.write_safe_crawl_files`.
- Remote MCP transport.
- Live Google Search Console/OAuth/token custody.
- DNS provider writes or provider integrations.
- Live GitHub PR creation, Git execution, branch creation, commits, pushes, deployments, or provider integrations.
- GUI write execution.
- Patch application.
- Metadata, content, JSON-LD, package/config, or existing-file writes.
- Exhaustive crawler or monitoring.
- Authorship identification, generator/vendor attribution, or smell-detector auto-fixes.
- Social platform APIs or exact third-party preview rendering.
- Authentication, accounts, billing, hosted SaaS, telemetry, OAuth/token storage, or secret-management product features.

## Package position

- Preferred future package: `@ship-ready/cli`.
- Fallback: `@f-campana/shipready`.
- Avoid: `@imageforge/*` and first public release as unscoped `shipready`.
- Bin remains `shipready`.
- License is MIT.
- `private` remains `true`.
- `package.json.name` is `@ship-ready/cli`; `private: true` still blocks publication.
- First public version likely remains `0.1.0` and should be marked experimental / early preview.

## Safety posture

Read-only inspection and preview are the default. CLI write mode requires `fix --write --allow-create` and is governed by [WRITE_POLICY_V1.md](WRITE_POLICY_V1.md). The MCP write wrapper is stricter: `shipready.write_safe_crawl_files` requires an authorized repo path, a fresh preview receipt, exact confirmation text `CREATE_SAFE_CRAWL_FILES_ONLY`, re-authorization, and regenerated current write validation before creating only missing robots/sitemap files.

The public package safety review recommends keeping the guarded write command enabled if the checklist still passes. Do not broaden the write policy or add new write surfaces for publish.

## Next pass

**Owner trusted-publisher setup.** Configure npm trusted publishing for `@ship-ready/cli` with GitHub Actions, repository `f-campana/ship-ready`, workflow `publish.yml`, and environment `npm-publish`, without changing the validation-only workflow. See [PUBLISH_EXECUTION_PLAN.md](PUBLISH_EXECUTION_PLAN.md). Only after setup is confirmed and exact owner approvals are recorded should a later pass become publish execution approval.
