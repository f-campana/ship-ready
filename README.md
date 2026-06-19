# ShipReady

ShipReady is a local TypeScript CLI proof-of-core for auditing production-readiness hygiene on AI-generated websites.

The current proof-of-core implements:

```bash
shipready audit <url>
shipready audit <url> --json
shipready inspect-repo <path>
shipready inspect-repo <path> --json
shipready plan-fixes <path> --url <url>
shipready plan-fixes <path> --url <url> --json
shipready fix <path> --url <url> --dry-run
shipready fix <path> --url <url> --write --allow-create
shipready ui-report [path] --url <url> --json
shipready html-report [path] --url <url> --output <file>
```

It does not open GitHub pull requests, deploy, or run as a SaaS. Write mode is limited to V1 creation-only crawl files.

## Install

```bash
pnpm install
```

`pnpm install` downloads Chromium for the Playwright rendered metadata pass. If your environment skips install scripts, run `pnpm playwright:install` before auditing live URLs.

## Usage

```bash
pnpm shipready audit https://example.com
pnpm shipready audit https://example.com --json
pnpm shipready audit https://example.com --timeout 20000
pnpm shipready inspect-repo .
pnpm shipready inspect-repo . --json
pnpm shipready plan-fixes . --url https://example.com
pnpm shipready plan-fixes . --url https://example.com --json
pnpm shipready fix . --url https://example.com --dry-run
pnpm shipready fix . --url https://example.com --write --allow-create
pnpm shipready ui-report . --url https://example.com --json
pnpm shipready html-report . --url https://example.com --output validation/example.html
pnpm shipready html-report --url https://example.com --output validation/example-url-only.html
```

By default, ShipReady prints a founder-readable report with critical issues, warnings, passed checks, and a raw-vs-rendered metadata summary.

`--json` prints a typed audit result containing:

- original URL and final URL
- audit timestamp
- score and status
- raw metadata extraction
- rendered metadata extraction
- raw/rendered comparison
- checks and resource results
- `robots.txt` and `sitemap.xml` checks

## What Works

- URL validation for `http://` and `https://` URLs.
- Raw HTML fetch using normal HTTP.
- Playwright rendering with a fresh browser context.
- Metadata extraction from raw and rendered HTML.
- Raw-vs-rendered comparison for key metadata fields.
- Checks for titles, descriptions, canonical URLs, robots meta, language, viewport, favicons, Open Graph, Twitter/X cards, H1 structure, JSON-LD, image alt text, accessible link text, `robots.txt`, and `sitemap.xml`.
- Deterministic first-pass score out of 100.
- Structured JSON validated with Zod.
- Fixture-based Vitest coverage for extraction, comparison, checks, and scoring.
- Read-only local repository inspection for framework, package manager, route, metadata-location, and future-fix planning signals.
- Read-only fix planning that combines URL audit findings with repo inspection and classifies future changes by priority, risk, confidence, target, and automation safety.
- Static self-contained HTML reports generated from the `ui-report-v1` contract for URL-only and URL + repo flows.

## Known Limitations

- Only one URL is audited. There is no crawl mode yet.
- `robots.txt` parsing is intentionally simple and does not fully implement every precedence edge case.
- `sitemap.xml` checking only looks for the audited URL in the root sitemap response.
- JSON-LD validation only checks presence, JSON parseability, `@context`, and `@type`.
- The CLI does not claim ranking improvements or guaranteed indexing.
- Private or authenticated pages are not a target for this spike.
- Repo inspection uses bounded filesystem scanning and convention-based detection. It does not perform full AST analysis or route-to-URL mapping.
- HTML reports are static files. They do not apply changes and do not include a GUI runtime.

## Next Recommended Implementation Step

Manually review generated HTML reports before deciding whether to build a small local-first interactive GUI prototype.

## Development

```bash
pnpm test
pnpm typecheck
pnpm build
```
