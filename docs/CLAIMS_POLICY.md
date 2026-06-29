# Claims Policy

ShipReady reports evidence and prepares bounded local work. It can detect launch-readiness gaps and safely prepare certain missing crawl files under the V1 policy. It cannot guarantee crawler behavior, indexing, ranking, deployment, or any third-party platform response.

## Allowed language

- **launch-readiness** — the product’s operating category.
- **crawler visibility** — what the fetched HTML and crawl resources expose.
- **preview-bot visibility** — what social and link-preview consumers may receive.
- **safe crawl files** — only eligible V1 `robots`/`sitemap` creations.
- **metadata completeness** — observed presence or absence, not outcome prediction.
- **structured data recommendation** — advice that requires factual review.
- **review-required change** — previewed but not eligible for V1 write.
- **preview first** — inspect proposed effects before any authorized action.
- **guarded command** — an explicit CLI command with policy gates.
- **local changes require deployment** — local files do not alter the live site by themselves.
- **reported by Search Console** — future authenticated evidence attributed to the matched property and authorized account.
- **indexed-version inspection** — future URL Inspection API evidence; Google documents that the API does not test the live URL. [Google URL Inspection API](https://developers.google.com/webmaster-tools/v1/urlInspection.index/inspect)
- **accessible property** — a property returned for the authorized account; not proof that no other property or owner exists.

Prefer measurable wording: “detected,” “missing,” “present in raw HTML,” “appears after rendering,” “previewed,” “eligible under V1,” and “requires review.”

## Forbidden or risky language

The following are forbidden claims, except when quoted here or clearly labeled as prohibited:

- “rank higher”
- “SEO boost”
- “guaranteed indexing”
- “guaranteed crawling”
- “instant Google indexing” or “instant indexing”
- “fix everything”
- “automatic deploy”
- “automatic Search Console registration”
- “automatic DNS fix”
- “Google approval”
- “URL Inspection tested the live page”

Do not use close paraphrases that imply the same certainty or capability.

## Required qualification

- Crawl files can express intent; crawlers decide whether and when to fetch.
- Metadata and structured data can improve completeness; external systems decide display and eligibility.
- Indexing and ranking depend on third parties and factors outside ShipReady.
- A preview is not a write. A local write is not a deployment. A deployment is not proof that live resources changed until re-checked.
- Only deterministic mock-backed Search Console status is implemented; live Google Search Console/OAuth and DNS are not implemented. MCP remains local stdio with one guarded write tool. Future live work must remain visibly labeled **Planned** until shipped and validated.
- Future Search Console output must distinguish live unauthenticated checks, authenticated Google-reported status, and ownership verification. “No accessible property” must be scoped to the authorized account.

See [SEARCH_CONSOLE_READINESS_SPEC.md](SEARCH_CONSOLE_READINESS_SPEC.md) for the Pass 8 source-backed claim and authority boundaries.

Apply this policy to CLI copy, GUI copy, generated reports, demos, documentation, issue text, and release notes.
