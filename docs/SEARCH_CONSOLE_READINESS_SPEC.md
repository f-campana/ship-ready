# Search Console Readiness Specification

Status: **Pass 9 mock-backed read-only prototype implemented. Live Google integration remains deferred.**

Research date: 2026-06-27. Factual claims below use Google-owned documentation only.

## Purpose

ShipReady should eventually answer a bounded question:

> Is this site accessible through the authorized user's Google Search Console account, what sitemap and selected-URL status does Google report, and what is the next safe action?

This is evidence and readiness reporting. It is not an indexing fix, ranking product, ownership automation service, or Search Console replacement. The operating order remains **CLI first, MCP second, GUI third**.

## Pass 9 local prototype decision

Pass 9 does not implement live Google OAuth. Pass 9 does not store or read tokens. Pass 9 does not call live Google APIs. It uses a provider boundary and deterministic mock fixtures for the CLI and read-only MCP tool. Live OAuth and token custody are deferred to a separate pass.

This boundary is required because Search Console access involves Google account identity, site ownership, property permissions, and OAuth token custody. The shipped prototype therefore exposes no credential input, Google client dependency, account identity, live property inventory, or mutation path.

## Non-goals and preserved boundaries

Pass 8 changes documentation only. It adds no Search Console code, OAuth flow, Google dependency, DNS behavior, CLI command, MCP registration, GUI behavior, remote transport, or product write.

The following current boundaries remain unchanged:

- `POST /api/fix` returns `404`; the GUI uses only `POST /api/ui-report` and remains preview/copy-only.
- MCP remains local stdio only and has exactly one write tool: `shipready.write_safe_crawl_files`.
- [WRITE_POLICY_V1.md](WRITE_POLICY_V1.md) remains canonical and permits only guarded creation of eligible missing crawl files.
- No metadata, content, JSON-LD, existing-file, Git, GitHub, deployment, DNS, or Search Console write is authorized.

## Three evidence and authority boundaries

| Boundary | Credential | What ShipReady may report | What it does not prove |
|---|---|---|---|
| Unauthenticated website check | None | Current HTTP responses and fetched page/crawl-resource content | What Google has crawled, indexed, selected, or associated with an account |
| Authenticated Search Console check | User-authorized OAuth token with read-only scope | Properties accessible to that user, permission level, submitted sitemap records, and optional indexed-version URL inspection | Ownership by the user, current live-page behavior, future crawling/indexing, or rank |
| Ownership verification | Separate Google verification flow and authority over site/DNS/account configuration | Whether Google records ownership, only if a separately scoped verification API is deliberately used | Permission to write DNS/site files or automate verification |

These states must never be collapsed. In particular, “no accessible matching property” means only that the authorized account's API response did not expose a match. It does not prove that no property exists for another Google account.

Google documents OAuth authorization for Search Console user data, permission-bearing site resources, and ownership verification as distinct mechanisms. [Google: Search Console authorization](https://developers.google.com/webmaster-tools/v1/how-tos/authorizing), [Google: Sites resource](https://developers.google.com/webmaster-tools/v1/sites), [Google: ownership verification](https://support.google.com/webmasters/answer/9008080)

## Official-source research summary

### Unauthenticated website evidence

ShipReady can fetch and parse the public site without Google authorization:

- Fetch the requested URL, record status and redirect chain, and compare the final URL. Google documents permanent server redirects as a strong canonical signal, but an HTTP check only observes the current server response. [Google: redirects and Google Search](https://developers.google.com/search/docs/crawling-indexing/301-redirects)
- Fetch `/robots.txt`, check its root location and syntax, evaluate applicable rules, and find fully qualified `Sitemap:` lines. Google fetches `robots.txt` from the site root and supports `user-agent`, `allow`, `disallow`, and `sitemap` fields. [Google: robots.txt interpretation](https://developers.google.com/crawling/docs/robots-txt/robots-txt-spec)
- Fetch a discovered or conventional sitemap URL and validate XML, encoding, absolute URLs, URL count/size limits, and internal consistency. Google supports sitemap protocol formats, requires absolute URLs, and limits one sitemap to 50 MB uncompressed or 50,000 URLs. [Google: build and submit a sitemap](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap)
- Inspect raw and rendered HTML plus response headers for `noindex`. Google recognizes `noindex` in a robots meta tag or `X-Robots-Tag`, but the rule can be seen and followed only when crawling is allowed. [Google: robots meta and X-Robots-Tag](https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag)
- Read declared canonicals and compare them with the requested/final URL. A declared canonical is a signal, not a command; Google can select another canonical. [Google: canonical URL methods](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls)

These checks establish live, observable readiness. They cannot report whether Google downloaded a sitemap, last crawled a URL, indexed it, or chose the declared canonical.

### Authenticated Search Console evidence

Every Search Console API request must be authorized by an authenticated user. Google provides `https://www.googleapis.com/auth/webmasters.readonly` for read-only access and `https://www.googleapis.com/auth/webmasters` for read/write access. The prototype must request only the read-only scope. [Google: authorize Search Console API requests](https://developers.google.com/webmaster-tools/v1/how-tos/authorizing)

With that authorization, a future read-only implementation can:

- List properties accessible to the authorized user. Each site resource has `siteUrl` and one documented `permissionLevel`: `siteOwner`, `siteFullUser`, `siteRestrictedUser`, or `siteUnverifiedUser`. [Google: Sites resource](https://developers.google.com/webmaster-tools/v1/sites)
- Match the requested URL to an accessible URL-prefix or Domain property. Google represents URL-prefix properties as full prefixes and Domain properties as `sc-domain:example.com`; the URL Inspection request requires the inspected URL to be under the supplied property. [Google: URL Inspection request](https://developers.google.com/webmaster-tools/v1/urlInspection.index/inspect)
- List sitemap entries submitted for a matched property using the read-only scope. [Google: Sitemaps list](https://developers.google.com/webmaster-tools/v1/sitemaps/list)
- Report documented sitemap fields: `path`, `lastSubmitted`, `lastDownloaded`, `isPending`, `isSitemapsIndex`, `type`, `warnings`, `errors`, and `contents[].type`/`contents[].submitted`. `contents[].indexed` is deprecated and must not appear in ShipReady's contract. [Google: Sitemap resource](https://developers.google.com/webmaster-tools/v1/sitemaps)
- Optionally inspect one URL and report the documented index-status fields: `verdict`, `coverageState`, `robotsTxtState`, `indexingState`, `lastCrawlTime`, `pageFetchState`, `googleCanonical`, `userCanonical`, `crawledAs`, and known sitemap URLs. Fields may be absent. The API reports the version in Google's index and explicitly cannot test the live URL. [Google: URL Inspection method](https://developers.google.com/webmaster-tools/v1/urlInspection.index/inspect), [Google: URL Inspection result](https://developers.google.com/webmaster-tools/v1/urlInspection.index/UrlInspectionResult)

The URL Inspection endpoint uses HTTP `POST`, but `index.inspect` is a read operation: it returns indexed-version status and does not request indexing. ShipReady must describe the semantic effect, not infer mutation from the HTTP verb. URL inspection should be opt-in and limited to one URL per invocation. Google currently documents per-site inspection limits of 2,000 queries/day and 600 queries/minute, so bulk inspection is excluded. [Google: Search Console API usage limits](https://developers.google.com/webmaster-tools/limits)

`sites.list` answers which properties the authenticated user can access; it is not a global property-existence lookup. Its `siteOwner` enum also does not expose whether ownership is verified or delegated, even though Search Console distinguishes those owner types. ShipReady must therefore report the exact permission enum and must not translate it to “verified owner.” [Google: Sites list](https://developers.google.com/webmaster-tools/v1/sites/list), [Google: owners, users, and permissions](https://support.google.com/webmasters/answer/7687615)

### Ownership verification is separate

Search Console supports URL-prefix and Domain properties. A URL-prefix property covers only its specified protocol/host/path prefix; a Domain property covers protocols and subdomains and requires DNS verification. [Google: add a website property](https://support.google.com/webmasters/answer/34592)

URL-prefix verification may use an HTML file, HTML tag, Google Analytics, Google Tag Manager, a domain provider, or supported Google-hosted-site mechanisms. Domain properties use DNS verification. Verification persists only while Google can confirm a valid verification token. [Google: verify site ownership](https://support.google.com/webmasters/answer/9008080)

The Site Verification API can generate verification tokens for methods including `FILE`, `META`, `ANALYTICS`, `TAG_MANAGER`, `DNS_TXT`, and `DNS_CNAME`, then verify a resource after the token has been placed. Its scopes are separate from Search Console: `siteverification` can read existing verified sites and verify new ones; `siteverification.verify_only` can verify new sites but cannot read existing verified sites. [Google: Site Verification getToken](https://developers.google.com/site-verification/v1/webResource/getToken), [Google: Site Verification authorization](https://developers.google.com/site-verification/v1/getting_started)

The Site Verification `webResource.list` method can list verified sites owned by the authenticated user, but it requires the full `siteverification` scope, which also carries the ability to verify new sites. The first prototype must not request that broader authority merely to enrich a status label. [Google: Site Verification list](https://developers.google.com/site-verification/v1/webResource/list), [Google: Site Verification scopes](https://developers.google.com/site-verification/v1/getting_started)

That API is not part of the first prototype. Generating or placing a verification token, editing an HTML file/tag, modifying Analytics or Tag Manager, writing DNS, calling `webResource.insert`, adding a Search Console property, or delegating ownership changes external state or authority and needs a separate policy. Google notes that a verification insert records ownership and that ownership information can be visible to other owners. [Google: Site Verification insert](https://developers.google.com/site-verification/v1/webResource/insert)

## Proposed read-only capability

The first implementation may perform only this sequence:

1. Validate and normalize one public HTTP(S) URL; strip fragments.
2. Determine local authorization state without printing credentials.
3. Use `webmasters.readonly` to list properties accessible to the authorized user.
4. If `--property` is supplied, require an exact accessible property match and confirm the URL is in scope.
5. Otherwise, derive all accessible in-scope matches and choose the most specific URL-prefix match; prefer an equally applicable URL-prefix property over a Domain property because its scope is narrower. If a deterministic unique match cannot be selected, return `ambiguous` with a next action instead of guessing.
6. Report the matched property's exact Search Console `permissionLevel`; derive property type only from `siteUrl` syntax.
7. List submitted sitemap records for the matched property.
8. Only with explicit `--inspect`, inspect the requested URL once and report indexed-version fields with missing values preserved as absent.
9. Return limitations and safe next actions. Perform no mutation.

Property matching is ShipReady-derived logic, not a Google verdict. The output must identify it as such. A sitemap reachable on the live site but absent from the Sitemaps API is “not listed as submitted for this matched property,” not “missing from Google.” A Search Console sitemap record is not proof that every listed URL was crawled or indexed: Google says sitemap submission is a hint and does not guarantee download or use. [Google: build and submit a sitemap](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap)

## Explicitly out of scope

- OAuth implementation, token persistence, Google client dependencies, or a live API adapter in Pass 8.
- Search Console property creation or removal. `sites.add` is a write operation requiring the read/write scope. [Google: Sites add](https://developers.google.com/webmaster-tools/v1/sites/add)
- Ownership verification, Site Verification API calls, verification-token placement, owner delegation, or verification-method management.
- DNS reads or writes.
- Sitemap submission or deletion. Submission requires `webmasters` and a mutating `PUT`; it is not allowed by the read-only prototype. [Google: Sitemaps submit](https://developers.google.com/webmaster-tools/v1/sitemaps/submit)
- Bulk URL inspection, scheduled monitoring, rank/keyword tracking, Search Analytics dashboards, or account-wide exports.
- Requesting indexing or recrawling. Google states that crawl requests do not guarantee inclusion or immediate results. [Google: ask Google to recrawl](https://developers.google.com/search/docs/crawling-indexing/ask-google-to-recrawl)
- Indexing API integration. Google limits that API to pages with `JobPosting` or `BroadcastEvent` embedded in `VideoObject`; it is not a general site-indexing mechanism. [Google: Indexing API quickstart](https://developers.google.com/search/apis/indexing-api/v3/quickstart)
- Remote hosted account management, remote MCP transport, GUI auth, or GUI execution.

Any later sitemap submission or other Search Console write must be a new roadmap pass with a separate write policy, read/write scope review, explicit user confirmation, idempotency/replay analysis, audit evidence, and tests. It must not be added to `WRITE_POLICY_V1` incidentally.

## Claim boundaries

Allowed formulations:

- “Search Console reports this property as accessible to the authorized account.”
- “Search Console reports this sitemap record with 2 warnings.”
- “Google's indexed-version inspection reports this URL as …”
- “The live page declares X; Google's indexed version reports Y.”
- “No matching property was accessible to the authorized account.”

Never claim or imply:

- guaranteed indexing or guaranteed crawling;
- instant indexing, ranking improvement, an SEO boost, or Google approval;
- that a sitemap submission forces download, crawling, or indexing;
- that `verdict: PASS` guarantees future inclusion or rank;
- automatic Search Console registration, property creation, ownership verification, DNS verification, deployment, or remediation;
- that an absent API field means a negative result;
- that URL Inspection tested the current live page;
- that a property inaccessible to one account does not exist.

Google explicitly says a sitemap does not guarantee crawling/indexing and a recrawl request does not guarantee inclusion. [Google: sitemap overview](https://developers.google.com/search/docs/crawling-indexing/sitemaps/overview), [Google: recrawl requests](https://developers.google.com/search/docs/crawling-indexing/ask-google-to-recrawl)

## Authentication, security, and privacy model

### Least authority

- Request only `webmasters.readonly` for the prototype. Do not request `webmasters`, Site Verification scopes, identity scopes, or offline access until a reviewed need exists.
- Treat the Google account, accessible property list, permission levels, URLs, sitemap contents, inspection results, and issue text as user data.
- A read-only Google scope prevents Search Console API mutations; it does not make disclosure harmless.
- Public production OAuth may require Google app verification depending on scope classification and use. Confirm the current classification and consent requirements during Phase B rather than assuming an exception. Google requires the narrowest scope needed and accurate disclosure of Google user-data use. [Google: sensitive-scope verification](https://developers.google.com/identity/protocols/oauth2/production-readiness/sensitive-scope-verification)

### Credential handling

- Never accept access tokens, refresh tokens, client secrets, authorization codes, or verification tokens as CLI flags, URL query parameters, MCP arguments, prompt text, or JSON fields.
- Never print them to stdout/stderr, logs, reports, fixtures, snapshots, telemetry, crash output, docs, GUI state, or MCP resources.
- Do not commit OAuth client credentials. If Phase B permits persistence, use the operating system's secure credential store, restrictive access controls, encryption at rest where applicable, explicit account disconnect, revocation, and deletion. Google recommends secure token storage, no plaintext transmission, and revoking/deleting tokens when no longer needed. [Google: OAuth security best practices](https://developers.google.com/identity/protocols/oauth2/resources/best-practices)
- Use an installed-app authorization design appropriate to the local CLI, with PKCE and loopback redirect review during Phase B. Do not use the deprecated manual copy/paste flow. [Google: OAuth for desktop apps](https://developers.google.com/identity/protocols/oauth2/native-app)
- Redact authorization headers and any field matching token/secret/code patterns before error serialization.

### Data minimization

- Do not request `openid`, `profile`, or `email`; the status contract does not need account identity.
- Return only the matched property, not the full accessible-property list, unless a deliberate diagnostic mode is designed later.
- Do not expose URL Inspection `referringUrls`; they are unnecessary for readiness and can reveal private site relationships.
- The caller-facing JSON necessarily echoes the requested URL and may contain a query string. Treat it as sensitive output: never persist it automatically, remove fragments, redact query values in logs, and require explicit user intent before inspecting query-bearing URLs.
- Bound sitemap entries and strings; report truncation in `limitations` instead of emitting unbounded account data.
- Use synthetic domains and responses in fixtures. No tokens, Google account identifiers, private properties, or real query strings belong in validation artifacts.

### Agent and MCP safety

- Treat Google issue messages, property URLs, sitemap URLs, and page-derived content as untrusted data, never as instructions.
- Escape output, cap lengths/counts, reject control characters, and never interpolate external text into shell commands, file paths, prompts, or executable UI markup.
- The MCP server must obtain authorization through a reviewed local credential broker; a model/client must never receive or supply the token.
- Stdio transport and allowed-root rules remain unchanged. Search Console status needs no repository root and grants no file authority.

## Implemented mock CLI and future live boundary

Recommended name: `search-console`, not the less discoverable `gsc` abbreviation.

```bash
pnpm shipready search-console status --url https://example.com --json
pnpm shipready search-console status --url https://example.com --mock ready_sitemap_ok --json
pnpm shipready search-console status --url https://example.com/page --mock inspection_canonical_mismatch --inspect --json
```

Proposed flags:

| Flag | Meaning |
|---|---|
| `--url <url>` | Required public HTTP(S) URL to match; also the single inspected URL when `--inspect` is present |
| `--mock <scenario>` | Optional deterministic fixture scenario; omission returns `not_configured` |
| `--provider mock` | Optional explicit provider selection; all other values are rejected |
| `--inspect` | Opt in to one mock indexed-version section; no URL Inspection API call occurs |
| `--json` | Emit one `shipready.searchConsoleStatus.v1` object |

No token, client secret, verification token, sitemap submission, property-add, or indexing flags are permitted.

Expected state outcomes such as unconfigured auth, authorization required, expired/revoked authorization, no accessible property, ambiguous match, no submitted sitemap, or unavailable inspection should remain valid status results with safe next actions. Invalid CLI input should use `shipready.error.v1` and exit `1`. A total network/Google API failure that prevents a report should use `shipready.error.v1` and exit `2`. A section-specific failure or quota response may remain in the status contract with that section marked `error` or `quota_exceeded` and no invented data.

## Implemented JSON contract

This is the shipped `shipready.searchConsoleStatus.v1` boundary. The code uses `mode: "mock" | "live"` instead of the earlier `mode: "read_only"` sketch: Pass 9 emits only `mock`, while both current and future modes remain read-only. Optional API-shaped fields remain optional; missing is not converted to false, zero, or an empty verdict. Google-named fields and enums come from the official [Sites](https://developers.google.com/webmaster-tools/v1/sites), [Sitemaps](https://developers.google.com/webmaster-tools/v1/sitemaps), and [URL Inspection](https://developers.google.com/webmaster-tools/v1/urlInspection.index/UrlInspectionResult) resources.

```ts
type SearchConsoleStatus = {
  contract: "shipready.searchConsoleStatus.v1";
  generatedAt: string;
  mode: "mock" | "live";
  requestedUrl: string;
  authorization: {
    status:
      | "not_configured"
      | "authorization_required"
      | "authorized"
      | "expired"
      | "revoked";
    scope?: "https://www.googleapis.com/auth/webmasters.readonly";
  };
  propertyMatch: {
    status: "not_checked" | "matched" | "not_accessible" | "ambiguous";
    strategy: "explicit" | "most_specific_accessible";
    property?: {
      siteUrl: string;
      type: "domain" | "url_prefix"; // ShipReady-derived from siteUrl syntax
      permissionLevel:
        | "siteOwner"
        | "siteFullUser"
        | "siteRestrictedUser"
        | "siteUnverifiedUser";
    };
  };
  sitemaps: {
    status: "not_checked" | "none_submitted" | "available" | "error";
    entries: Array<{
      path: string;
      lastSubmitted?: string;
      lastDownloaded?: string;
      isPending?: boolean;
      isSitemapsIndex?: boolean;
      type?: "atomFeed" | "notSitemap" | "patternSitemap" | "rssFeed" | "sitemap" | "urlList";
      warnings?: number;
      errors?: number;
      contents?: Array<{
        type: "androidApp" | "image" | "iosApp" | "mobile" | "news" | "pattern" | "video" | "web";
        submitted?: number;
      }>;
    }>;
  };
  inspection: {
    requested: boolean;
    status: "not_requested" | "not_checked" | "available" | "quota_exceeded" | "error";
    source: "google_index";
    result?: {
      verdict?: "VERDICT_UNSPECIFIED" | "PASS" | "PARTIAL" | "FAIL" | "NEUTRAL";
      coverageState?: string;
      robotsTxtState?: "ROBOTS_TXT_STATE_UNSPECIFIED" | "ALLOWED" | "DISALLOWED";
      indexingState?:
        | "INDEXING_STATE_UNSPECIFIED"
        | "INDEXING_ALLOWED"
        | "BLOCKED_BY_META_TAG"
        | "BLOCKED_BY_HTTP_HEADER"
        | "BLOCKED_BY_ROBOTS_TXT";
      lastCrawlTime?: string;
      pageFetchState?:
        | "PAGE_FETCH_STATE_UNSPECIFIED"
        | "SUCCESSFUL"
        | "SOFT_404"
        | "BLOCKED_ROBOTS_TXT"
        | "NOT_FOUND"
        | "ACCESS_DENIED"
        | "SERVER_ERROR"
        | "REDIRECT_ERROR"
        | "ACCESS_FORBIDDEN"
        | "BLOCKED_4XX"
        | "INTERNAL_CRAWL_ERROR"
        | "INVALID_URL";
      googleCanonical?: string;
      userCanonical?: string;
      crawledAs?: "CRAWLING_USER_AGENT_UNSPECIFIED" | "DESKTOP" | "MOBILE";
      sitemaps?: string[];
    };
  };
  limitations: string[];
  nextActions: string[];
};
```

Contract rules:

- `authorization`, `propertyMatch`, `sitemaps`, and `inspection` are separate state machines; no top-level “connected” boolean obscures them.
- `strategy` and property `type` are ShipReady-derived. All other Google-named values above map to documented API fields/enums.
- Preserve unknown future Google enum values safely at the adapter boundary rather than crashing or silently coercing. V1 reserves the explicit `UNKNOWN` fallback for Google enum fields; the mock fixtures use only documented values.
- Never include tokens, account email, full property inventory, referring URLs, raw Google responses, request headers, or verification details.
- Compare `userCanonical` and `googleCanonical` only when both exist. Absence is “not reported,” not mismatch.
- A separate `shipready.searchConsoleAuthStatus.v1` is not recommended initially; it would duplicate authorization state. Revisit only if auth becomes an independently useful CLI surface.

## Implemented mock MCP tool and future live boundary

Implemented read-only tool: `shipready.search_console_status`.

```ts
type SearchConsoleStatusInput = {
  url: string;
  mock?: string;
  inspect?: boolean;
};
```

It returns the exact `shipready.searchConsoleStatus.v1` object produced by the CLI application boundary. It accepts no repo path and performs no path authorization because it reads no repository. It rejects OAuth material, verification material, arbitrary Google API methods, sitemap URLs to submit, and mutation confirmation. A future live adapter must not be registered until a local credential broker, redaction, cancellation/deadline behavior, and separate security review are complete.

This tool would be read-only and would not change the existing sole MCP write tool. MCP stays stdio-only; no HTTP/SSE transport, hosted account proxy, or remote token custody is introduced.

## Future GUI notes

GUI work is later than the CLI and MCP contract. A future read-only panel may show:

- “Search Console authorization required” or “Authorization expired.”
- “Matching property accessible” with the permission reported by Search Console.
- “No matching property accessible to this account,” without claiming nonexistence.
- submitted sitemap count, pending state, last submitted/downloaded times, warnings, and errors;
- optional indexed-version inspection, explicitly timestamped and labeled as not a live test;
- declared canonical versus Google-selected canonical only when both are reported;
- “Deploy and re-check the live site first” when local work has not been deployed.

It must never render tokens, raw API payloads, account identity, referring URLs, or unescaped external text. It must not add an auth flow, write endpoint, property creation, verification, sitemap submission, indexing request, DNS action, deploy action, or automatic remediation as part of the status panel. Current GUI behavior remains unchanged.

## Phased implementation

### Phase A — specification only (Pass 8)

- Record official API facts, claims, authority boundaries, proposed interfaces, privacy posture, and tests.
- Make no product or external-state change.

### Phase B — local auth design gate (deferred beyond Pass 9)

- Confirm current OAuth scope classification, consent-screen requirements, installed-app flow, PKCE/loopback behavior, secure-store support, revocation, expiry, account switching, and redaction.
- Decide whether a future live pass uses an ephemeral token with no persistence or reviewed OS credential storage.
- Define a credential-provider interface so tests never depend on a live account.
- Do not proceed to live integration until a threat review accepts token custody and disconnect behavior.

### Phase C — mock-backed read-only prototype (complete in Pass 9)

- Implement the CLI boundary and stable V1 contract.
- Emit deterministic property, sitemap, and optional one-URL indexed-version mock states through a provider interface.
- Keep all fixtures synthetic and timestamps fixed.
- Add the MCP tool only around the same mock application boundary. GUI remains unchanged.
- Make no OAuth request, token read/storage, Google API call, Site Verification call, or mutation.

### Phase D — optional mutation-bearing work (future, not near-term)

- Separately evaluate sitemap submission, property creation, or verification guidance.
- Require a new write policy, read/write scope, explicit authorization, preview/confirmation, replay controls, security review, contract/tests, and roadmap pass.
- URL Inspection does not request indexing. Do not invent a “request inspection” write action.

## Pass 9 shipped test strategy

Pass 9 ships only with deterministic tests and synthetic fixtures. The broader list below remains the gate for any future live provider:

- Inject a fake credential provider and fake Google client; unit/contract tests make no live Google API or OAuth calls.
- Contract fixtures: `not_configured`, `authorization_required`, `authorized_no_property`, `ambiguous_property`, `matched_domain`, `matched_url_prefix`, `siteUnverifiedUser`, `no_sitemaps`, `sitemap_ok`, `sitemap_pending`, `sitemap_warning_error`, `inspection_not_requested`, `inspection_indexed`, `inspection_canonical_mismatch`, `inspection_absent_fields`, `inspection_quota_exceeded`, `token_expired`, `token_revoked`, and operational error.
- Property matching tests cover protocol, port, subdomain, path-prefix boundaries, trailing slash, `sc-domain:` syntax, IDNs, explicit override, and no cross-property leakage.
- Schema tests preserve absent fields and reject deprecated `contents[].indexed`, tokens, account emails, referring URLs, and raw responses.
- Redaction tests cover authorization headers, access/refresh tokens, client secrets, authorization codes, verification tokens, query values, nested Google errors, stdout/stderr, logs, and MCP errors.
- Security tests treat external strings as data: control characters, HTML, Markdown, shell fragments, path traversal, and prompt-like text never execute or become instructions.
- Error mapping tests cover invalid input, 401/403, revoked/expired credentials, inaccessible property, 404, 429/quota, 5xx, timeout, cancellation, malformed response, and unknown enum values.
- Claim-policy tests reject guarantee, ranking, approval, automatic registration/verification/deploy, and live-test wording.
- Read-only tests assert only property list/get, sitemap list, and optional `index.inspect` calls occur; `sites.add/delete`, `sitemaps.submit/delete`, Site Verification, Indexing API, DNS, Git, deploy, and filesystem writes are unreachable.
- MCP tests assert the tool accepts no credential fields, returns no secrets, preserves stdio-only transport, and leaves `shipready.write_safe_crawl_files` as the sole write tool.
- GUI regression tests assert the client still calls only `/api/ui-report`, `POST /api/fix` remains `404`, and preview/copy-only behavior remains unchanged.

A manually authorized smoke test may be designed only after Phase B, must use a dedicated test property/account, make no mutation, record no credentials or real payloads, and remain outside automated CI.

## Open questions for a future live provider

1. Can a future live provider be useful without persistent refresh-token storage, or is reviewed OS keychain support required?
2. Should `--inspect` be excluded from the first prototype until property/sitemap status is stable?
3. How should the public schema preserve future unknown Google enum values without weakening V1 validation?
4. What maximum sitemap-entry count and string lengths balance usefulness with account-data minimization?
5. Should exact query-bearing URL inspection require an additional confirmation or be rejected initially?
6. Does the production distribution model trigger Google OAuth app verification, and what privacy-policy/user-data disclosures are required at that time?

## Authoritative sources

- [Search Console API authorization](https://developers.google.com/webmaster-tools/v1/how-tos/authorizing)
- [Search Console Sites resource](https://developers.google.com/webmaster-tools/v1/sites) and [Sites list](https://developers.google.com/webmaster-tools/v1/sites/list)
- [Search Console Sitemaps resource](https://developers.google.com/webmaster-tools/v1/sitemaps), [list](https://developers.google.com/webmaster-tools/v1/sitemaps/list), and [submit](https://developers.google.com/webmaster-tools/v1/sitemaps/submit)
- [URL Inspection method](https://developers.google.com/webmaster-tools/v1/urlInspection.index/inspect), [result fields](https://developers.google.com/webmaster-tools/v1/urlInspection.index/UrlInspectionResult), and [usage limits](https://developers.google.com/webmaster-tools/limits)
- [Search Console property types](https://support.google.com/webmasters/answer/34592), [ownership verification](https://support.google.com/webmasters/answer/9008080), and [permissions](https://support.google.com/webmasters/answer/7687615)
- [Site Verification API overview](https://developers.google.com/site-verification/v1/getting_started), [verified-resource list](https://developers.google.com/site-verification/v1/webResource/list), [token generation](https://developers.google.com/site-verification/v1/webResource/getToken), and [verification insert](https://developers.google.com/site-verification/v1/webResource/insert)
- [Google robots.txt specification](https://developers.google.com/crawling/docs/robots-txt/robots-txt-spec), [sitemap guidance](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap), [robots meta rules](https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag), [canonical guidance](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls), and [redirect guidance](https://developers.google.com/search/docs/crawling-indexing/301-redirects)
- [Google OAuth security best practices](https://developers.google.com/identity/protocols/oauth2/resources/best-practices), [desktop OAuth](https://developers.google.com/identity/protocols/oauth2/native-app), and [sensitive-scope verification](https://developers.google.com/identity/protocols/oauth2/production-readiness/sensitive-scope-verification)
- [Google recrawl guidance](https://developers.google.com/search/docs/crawling-indexing/ask-google-to-recrawl) and [Indexing API scope](https://developers.google.com/search/apis/indexing-api/v3/quickstart)
