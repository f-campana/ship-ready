# ShipReady Notes

## Implemented

- `shipready audit <url>`
- `shipready audit <url> --json`
- Raw HTML fetch and Playwright render pass.
- Metadata, social tag, heading, JSON-LD, alt text, link text, robots, and sitemap checks.
- Raw vs rendered metadata comparison.
- Deterministic score out of 100.
- Zod-validated JSON output.
- Basic fixture-based tests.

## Intentionally Not Implemented

- Repository inspection.
- Fix planning.
- File patching or writes.
- GitHub integration.
- SaaS UI, auth, billing, database, monitoring, or deployment.
- Multi-page crawling.
- Full Schema.org validation.
- SEO ranking claims.

## Recommended Next Task

Implement `shipready inspect-repo <path>` with framework detection and tests for Next.js App Router, Vite React, and plain static HTML. Keep it read-only so it can feed a later dry-run fix planner.

