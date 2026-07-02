# Post-write recheck

User request: “I deployed the crawl files created locally. Check whether they appear live.”

```bash
pnpm shipready recheck /path/to/repo --url https://example.com --json
```

Without the repository, use `pnpm shipready recheck --url https://example.com --json`; deployment status remains `not_checked` because local evidence is unknown.

Report the local expected file presence, live `robots.txt`/`sitemap.xml` evidence, deployment classification, limitations, and next actions. Use “appears” language. An unreachable resource is unknown evidence, not proof that it is missing. Do not deploy, invoke write mode, call provider APIs, or imply crawling or indexing.
