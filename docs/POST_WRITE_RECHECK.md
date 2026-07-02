# Post-write recheck

ShipReady can create eligible missing crawl files locally under `WRITE_POLICY_V1`. Those files do not affect the public site until the owner deploys them through an external workflow.

After that external deployment, run a read-only recheck:

```bash
pnpm shipready recheck --url https://example.com
pnpm shipready recheck --url https://example.com --json
pnpm shipready recheck /path/to/repo --url https://example.com --json
```

URL-only mode reports current live `robots.txt` and `sitemap.xml` evidence without inferring deployment status. Repo-backed mode also runs bounded repository inspection, infers only the current V1-safe expected crawl-file paths, and compares their local presence with the live conventional URLs.

Positive comparison language remains conservative: local files and live resources may **appear deployed** or **partially deployed**. A timeout or unreachable endpoint is classified as unknown evidence, not as a missing file. An unsupported framework produces an unknown comparison with a manual next action.

`recheck` never writes files, invokes write mode, deploys, stages or commits Git changes, calls hosting-provider APIs, writes DNS, or uses Search Console. Visible crawl files do not guarantee crawling, indexing, propagation, or any third-party outcome.

The MCP equivalent is the read-only `shipready.recheck` tool with `{ url, repoPath? }`. A supplied `repoPath` must pass existing allowed-root authorization; URL-only calls require no repository authorization.
