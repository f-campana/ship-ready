# URL-only readiness check

User request: “Check whether `https://example.com` is ready to share. I do not have the repository.”

```bash
pnpm shipready doctor --json
pnpm shipready status --json
pnpm shipready audit https://example.com --json
pnpm shipready ui-report --url https://example.com --json
```

Report observed metadata, crawl resources, raw/rendered differences, preview-bot inputs, and limitations. State that the audit is single-page and URL-only. Do not plan, preview, or claim local fixes without a repository path.
