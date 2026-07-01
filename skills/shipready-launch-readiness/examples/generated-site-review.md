# Generated-site review

User request: “Review my generated site and give me a launch-readiness report.”

```bash
pnpm shipready audit https://example.com --json
pnpm shipready inspect-repo /path/to/repo --json
pnpm shipready plan-fixes /path/to/repo --url https://example.com --json
pnpm shipready fix /path/to/repo --url https://example.com --dry-run --json
pnpm shipready dns status --url https://example.com --json
pnpm shipready search-console status --url https://example.com --mock ready_sitemap_ok --json
pnpm shipready html-report /path/to/repo --url https://example.com --output shipready-report.html
```

Separate passed checks, safe candidates, review-required changes, and manual actions. Label DNS as live read-only evidence and Search Console as mock-backed. Include a local-versus-live warning and the report artifact. Make no ranking, indexing, propagation, deployment, or provider-mutation claim.
