# Safe crawl-file creation

User request: “Review this site and repository, then create missing crawl files if they are eligible. I approve only that narrow creation.”

```bash
pnpm shipready inspect-repo /path/to/repo --json
pnpm shipready plan-fixes /path/to/repo --url https://example.com --json
pnpm shipready fix /path/to/repo --url https://example.com --dry-run --json
```

Confirm the exact target and record explicit approval. Verify every proposed write is a low-risk, create-only, `auto_candidate` robots/sitemap path with `requiresHumanReview: false` under `WRITE_POLICY_V1`. Stop if any gate fails.

Only after approval and review, run:

```bash
pnpm shipready fix /path/to/repo --url https://example.com --write --allow-create
```

Report exact local files created and all blocked/review-required work. State that ShipReady did not deploy; the owner must deploy through their normal workflow. After deployment, run the read-only comparison shown in [post-write-recheck.md](post-write-recheck.md).
