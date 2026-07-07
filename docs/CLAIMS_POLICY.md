# Claims Policy

ShipReady reports evidence and prepares bounded local work. It can detect launch-readiness gaps and safely prepare certain missing crawl files under the V1 policy. It cannot guarantee crawler behavior, indexing, ranking, deployment, or any third-party platform response.

## Allowed language

- **launch-readiness** — the product’s operating category.
- **crawler visibility** — what the fetched HTML and crawl resources expose.
- **preview-bot visibility** — what social and link-preview consumers may receive.
- **simulated preview** — a ShipReady approximation based on observed metadata, not an official platform output.
- **observed preview inputs** — title, description, URL, card type, and image metadata found in raw or rendered HTML.
- **safe crawl files** — only eligible V1 `robots`/`sitemap` creations.
- **metadata completeness** — observed presence or absence, not outcome prediction.
- **structured data recommendation** — advice that requires factual review.
- **review-required change** — previewed but not eligible for V1 write.
- **preview first** — inspect proposed effects before any authorized action.
- **guarded command** — an explicit CLI command with policy gates.
- **local changes require deployment** — local files do not alter the live site by themselves.
- **appears deployed / appears not deployed / partially deployed** — conservative comparison of local expected crawl-file presence with live observed conventional URLs, not provider-event evidence.
- **reported by Search Console** — future authenticated evidence attributed to the matched property and authorized account.
- **indexed-version inspection** — future URL Inspection API evidence; Google documents that the API does not test the live URL. [Google URL Inspection API](https://developers.google.com/webmaster-tools/v1/urlInspection.index/inspect)
- **accessible property** — a property returned for the authorized account; not proof that no other property or owner exists.
- **DNS readiness** — read-only reporting about observed DNS responses and adjacent reachability evidence, not provider repair or third-party outcome prediction.
- **observed DNS response** — the answer, negative answer, timeout, or error returned by a resolver for the checked name/type.
- **bounded multi-page crawl** — a small same-origin launch-readiness sample with strict page/depth limits, not exhaustive site coverage.
- **bounded sample** — the pages ShipReady selected under the current crawl limits.
- **observed metadata consistency** — consistency signals across checked pages, not a site-wide conclusion.
- **repeated finding** — the same launch-readiness issue observed on multiple checked pages, with affected pages listed for review.
- **heuristic implementation signals** — bounded repository patterns that may need launch-readiness review; not proof of authorship, generator identity, or quality.
- **generated-site implementation smell** — a practical review signal for fragile metadata, preview, crawlability, asset, placeholder, boilerplate, framework, or configuration patterns commonly seen in generated sites.

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
- “guaranteed propagation”
- “guaranteed certificate issuance”
- “URL Inspection tested the live page”
- “guaranteed social preview”
- “exact social preview”
- “official LinkedIn preview”
- “official X preview”
- “official Slack preview”

Do not use close paraphrases that imply the same certainty or capability.

## Required qualification

- Crawl files can express intent; crawlers decide whether and when to fetch.
- Metadata and structured data can improve completeness; external systems decide display and eligibility.
- Indexing and ranking depend on third parties and factors outside ShipReady.
- A preview is not a write. A local write is not a deployment. A deployment is not proof that live resources changed until re-checked.
- A positive recheck is public crawl-file evidence only; it does not guarantee provider state, propagation, crawling, indexing, or future availability. An unreachable recheck is unknown, not proof of absence.
- Only deterministic mock-backed Search Console status is implemented; live Google Search Console/OAuth is not implemented. DNS readiness is implemented as read-only resolver evidence; DNS provider writes and provider integrations are not implemented. MCP remains local stdio with one guarded write tool. Future live Search Console or mutation-bearing work must remain visibly labeled **Planned** until shipped and validated.
- Future Search Console output must distinguish live unauthenticated checks, authenticated Google-reported status, and ownership verification. “No accessible property” must be scoped to the authorized account.
- DNS readiness output must distinguish DNS-only evidence, HTTP-adjacent evidence, and Search Console verification-readiness. Visible records are observations, not propagation, certificate, crawling, indexing, or approval guarantees.
- Social preview simulator output must use approximation language. It can report likely input fields from observed metadata and raw-versus-rendered caveats, but it must not claim platform-specific rendering, cache behavior, share-card refresh, or official preview API results.
- Generated-site smell output must use heuristic and review language. It can report evidence-backed implementation smells and why they may affect crawler, preview, sharing, and launch-readiness behavior, but it must not identify an authoring tool, infer who produced the site, grade quality because a site appears generated, or apply fixes automatically.
- Bounded crawl output must use sample and limit language. It can report same-origin page summaries, repeated findings, skipped candidates, and observed metadata consistency across checked pages, but it must not claim exhaustive coverage, broad analytics, traffic forecasting, indexing evidence, monitoring, complete broken-link scanning, security scanning, accessibility auditing, or any write/remediation behavior.
- GUI copy must describe the local UI as a read-only review cockpit and command-copy handoff. It may say social previews are simulated from observed metadata, crawl evidence is bounded, smell findings are heuristic implementation signals, DNS is read-only, Search Console is mock-backed, and recheck requires external deployment. It must not imply GUI write execution, deployment, provider mutation, official platform rendering, authorship detection, or guaranteed third-party outcomes.

See [SEARCH_CONSOLE_READINESS_SPEC.md](SEARCH_CONSOLE_READINESS_SPEC.md) for the Pass 8 source-backed claim and authority boundaries.
See [DNS_READINESS_SPEC.md](DNS_READINESS_SPEC.md) for the Pass 10/11 source-backed DNS claim and authority boundaries.

Apply this policy to CLI copy, GUI copy, generated reports, demos, documentation, issue text, and release notes.
