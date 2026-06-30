# DNS Readiness Specification

Status: **Pass 10 specification only. DNS checks are not implemented.**

Research date: 2026-06-30. Factual DNS claims below use IETF RFCs, IANA registries, CA/Browser Forum material, and Google-owned documentation for Search Console/Search behavior.

## Purpose

ShipReady should eventually answer a bounded launch question:

> Does the domain appear ready for launch from observed DNS responses, HTTP reachability, TLS-adjacent evidence, and optional verification-readiness signals?

This is readiness reporting, not DNS repair. The operating order remains **CLI first, MCP second, GUI third**. Pass 10 creates the source-backed specification for a future read-only implementation in Pass 11.

## Non-goals and preserved boundaries

Pass 10 adds no DNS resolver, DNS dependency, provider integration, command, MCP tool, GUI view, Search Console live behavior, OAuth, token storage, product write behavior, or external mutation.

The current boundaries remain unchanged:

- `POST /api/fix` returns `404`; the GUI calls only `POST /api/ui-report` and remains preview/copy-only.
- MCP remains local stdio only.
- MCP has exactly one write tool: `shipready.write_safe_crawl_files`.
- [WRITE_POLICY_V1.md](WRITE_POLICY_V1.md) remains canonical and permits only guarded creation of eligible missing crawl files.
- No metadata, content, JSON-LD, existing-file, Git, GitHub, deployment, Search Console, DNS, registrar, nameserver, or provider mutation is authorized.

## Official-source research summary

| Topic | Source-backed fact | ShipReady implication |
|---|---|---|
| Address records | The DNS RR type registry defines `A` as a host address, and RFC 3596 defines `AAAA` as the IPv6 address record. [IANA DNS Parameters](https://www.iana.org/assignments/dns-parameters), [RFC 3596](https://datatracker.ietf.org/doc/html/rfc3596) | Query A/AAAA as observed address evidence for launch hosts, but do not require IPv6 unless the user or environment expects it. |
| TTL | A resource-record TTL is the number of seconds an RR may be cached before discard. [RFC 1035](https://datatracker.ietf.org/doc/html/rfc1035) | Surface TTLs as cache timing evidence, not as propagation guarantees. |
| CNAME exclusivity | A CNAME owner name is an alias; if a CNAME RR is present at a node, no other data should be present. [RFC 1034](https://datatracker.ietf.org/doc/html/rfc1034) | Flag obvious CNAME coexistence problems when observable; do not recommend a standards CNAME at the zone apex. |
| CNAME chains | DNS software should follow CNAME chains and signal CNAME loops as errors. [RFC 1034](https://datatracker.ietf.org/doc/html/rfc1034) | Follow CNAME chains with a fixed depth limit and report loops or broken targets. |
| Alias clarification | RFC 2181 clarifies that a DNS name is either an alias with permitted DNSSEC metadata or has other data, but not both. [RFC 2181](https://www.rfc-editor.org/info/rfc2181/) | Keep CNAME diagnostics conservative and standards-based. |
| Negative answers | RFC 2308 defines negative caching and distinguishes name errors from no-data responses; later terminology calls NODATA a NOERROR response with no relevant answers. [RFC 2308](https://datatracker.ietf.org/doc/html/rfc2308), [RFC 9499](https://datatracker.ietf.org/doc/html/rfc9499) | Classify `nxdomain`, `nodata`, `timeout`, and generic `error` separately where the resolver exposes enough detail. |
| DNS response codes | IANA maintains DNS RCODE and RR type registries. [IANA DNS Parameters](https://www.iana.org/assignments/dns-parameters) | Use registry names such as `NOERROR` and `NXDOMAIN` only when derived from resolver evidence. |
| Nameservers | NS is an authoritative-name-server RR type in the DNS registry. [IANA DNS Parameters](https://www.iana.org/assignments/dns-parameters) | Check NS records for the supplied or derived domain, but avoid claiming registrar configuration correctness without provider/registry evidence. |
| DNSSEC | DNSSEC adds origin authentication and data integrity for DNS data and has explicit capability limits. [RFC 4033](https://datatracker.ietf.org/doc/html/rfc4033), [RFC 9364](https://www.rfc-editor.org/info/rfc9364/) | Treat DNSSEC as advanced. V1 may only report `unknown` or an explicit resolver-observed validation failure. |
| Extended DNS errors | Extended DNS Errors can add cause detail, including for SERVFAIL/DNSSEC cases, without changing RCODE processing. [RFC 8914](https://www.rfc-editor.org/info/rfc8914/) | Future implementations may include safe EDE details if the resolver exposes them; V1 must not depend on them. |
| CAA | CAA lets a domain holder specify CAs authorized to issue certificates and is intended to reduce certificate mis-issuance risk. [RFC 8659](https://www.rfc-editor.org/info/rfc8659/) | Surface CAA records and, only when an expected issuer is provided, identify a possible issuer mismatch. Do not claim certificate issuance will succeed. |
| TLS certificate policy | CA/Browser Forum Baseline Requirements govern public TLS server certificate issuance, and the latest requirements page is the current reference point. [CA/Browser Forum TLS Baseline Requirements](https://cabforum.org/working-groups/server/baseline-requirements/requirements/) | CAA evidence is TLS-adjacent risk context, not a certificate-ordering or renewal tool. |
| Search Console Domain properties | A Search Console Domain property covers protocols and subdomains and requires DNS record verification except for some Google-hosted products. [Google Search Console property types](https://support.google.com/webmasters/answer/34592) | DNS TXT/CNAME visibility can support verification readiness, but cannot prove Search Console ownership state. |
| Verification records | Google documents DNS TXT and DNS CNAME verification record details as Search Console ownership methods. [Google Search Console ownership verification](https://support.google.com/webmasters/answer/9008080) | If the user supplies an expected token, ShipReady can check whether it is visible in DNS and redact it from logs/results. |
| Crawling and indexing limits | Google says sitemaps help discovery but do not guarantee crawling/indexing, and Search does not guarantee crawling, indexing, serving, or rank. [Google sitemap overview](https://developers.google.com/search/docs/crawling-indexing/sitemaps/overview), [How Google Search works](https://developers.google.com/search/docs/fundamentals/how-search-works) | DNS readiness must not become a crawling, indexing, approval, or ranking guarantee. |

## Check categories

| Category | Future examples | V1 posture |
|---|---|---|
| DNS-only | A/AAAA, CNAME chain, NS, TXT token visibility, CAA records, TTLs, NXDOMAIN/NODATA/timeout/error classification | Recommended for Pass 11, with conservative verdicts and explicit limitations. |
| HTTP/TLS-adjacent | HTTP reachability, apex/www redirect consistency, observed final URL host, TLS handshake/certificate errors surfaced by fetch/browser APIs | Optional in Pass 11 if it reuses existing bounded HTTP behavior; must be labeled non-DNS evidence. |
| Search Console verification-readiness | Expected DNS TXT/CNAME token is visible when supplied by the user | Deferred within or after Pass 11; never fetch/generate tokens from Google. |
| Optional advanced | Full DNSSEC chain validation, resolver EDE diagnostics, authoritative-vs-recursive comparison, CAA issuer-policy compatibility, SVCB/HTTPS, provider-specific hints | Later work only unless explicitly scoped. |

## Recommended V1 checks

The first implementation should be read-only and provider-neutral.

| Check | Classification | Inputs | Result guidance |
|---|---|---|---|
| Normalize one HTTP(S) URL and derive hosts | Setup | `url`, optional `domain`, optional expected host settings | Reject invalid URLs through `shipready.error.v1`; strip fragments and redact query values in logs. |
| Resolve requested host A/AAAA | DNS-only | `url` | `ok` when address records or a followed CNAME target resolves; `blocked` for clear NXDOMAIN; `needs_attention` for NODATA when no address path exists; `unknown` for timeout/error. |
| Resolve apex and `www` when applicable | DNS-only | `url`, optional `expectedWwwMode` | Report whether both resolve, only one resolves, or the chosen mode is intentional. Do not require both when the user expects only one. |
| Check CNAME chain | DNS-only | derived host list | Follow a bounded chain, recommended max depth 8. Report loop, too deep, CNAME target NXDOMAIN/NODATA, or coexistence evidence. |
| Check NS records for domain candidate | DNS-only | optional `domain` or derived registrable domain | Report present/missing/unknown. Avoid registrar or nameserver-authority claims without registry/provider evidence. |
| Surface TTL values | DNS-only | DNS responses | Include TTLs per answer set where available; explain that cached resolvers may continue serving prior answers until their cache rules expire. |
| Classify DNS failures | DNS-only | resolver errors | Preserve `nxdomain`, `nodata`, `timeout`, `servfail`, `refused`, and `error` when available; do not flatten them into one failure string. |
| Surface CAA records | DNS/TLS-adjacent | optional `expectedCertificateIssuer` | Show present/absent/unknown. If an expected issuer is supplied, classify `possible_issue` only when records appear not to authorize that issuer; otherwise avoid issuer conclusions. |
| DNSSEC basic posture | Advanced DNS-only | resolver capability | In V1, prefer `not_checked` or `unknown`; report `appears_broken` only for explicit resolver DNSSEC failure evidence. |
| Canonical host redirect | HTTP/TLS-adjacent | optional `expectedCanonicalHost`, optional `expectedWwwMode` | Use a bounded HEAD/GET follow if added. Report observed final URL host; do not call it a DNS failure. |
| Search Console TXT readiness | Search Console verification-readiness | optional `expectedSearchConsoleVerificationTxt` | Check exact DNS TXT visibility only when supplied. Redact token in logs and public artifacts. Do not claim property verification. |

Minimum Pass 11 input should be:

```ts
type DnsStatusInputV1 = {
  url: string;
  domain?: string;
  expectedCanonicalHost?: string;
  expectedWwwMode?: "www" | "apex" | "either";
  expectedSearchConsoleVerificationTxt?: string;
  expectedCertificateIssuer?: string;
  timeoutMs?: number;
};
```

`url` is required. Other fields are optional and should narrow the interpretation rather than unlock writes or provider access.

## Explicitly out of scope

- DNS writes, record creation, record deletion, nameserver changes, registrar operations, provider API calls, provider API-key handling, or provider-specific account management.
- Cloudflare, Route 53, Vercel, Netlify, Google Domains, registrar, nameserver, hosting, or CDN API integrations.
- Automatic remediation, provider-specific instructions that require account access, and any mutation-bearing DNS workflow.
- Zone transfers, bulk scanning, active security scanning, monitoring, alerting, or hosted account management.
- Certificate issuance, renewal automation, ACME account management, or private key/certificate storage.
- Live Search Console OAuth, Site Verification API calls, property creation, ownership verification, sitemap submission, URL inspection, or indexing requests.
- DMARC, SPF, DKIM, MX, BIMI, and email deliverability checks unless a later roadmap pass expands product scope.
- Remote MCP transport, GUI write execution, Git/GitHub/deploy behavior, or writes to `/Users/fabiencampana/Documents/fodmapp/apps/marketing`.

## Claim boundaries

Allowed formulations:

- "Observed DNS response for `example.com` returned A records."
- "`www.example.com` follows a CNAME chain that resolves to address records."
- "The expected Search Console TXT token was not observed in the queried TXT records."
- "CAA records may need review before using the expected certificate issuer."
- "The requested URL redirects to the apex host."
- "TTL values are cache timing evidence, not a completion timer."

Forbidden examples, included here only as prohibited language:

- "rank higher"
- "SEO boost"
- "guaranteed indexing"
- "instant indexing"
- "fix everything"
- "automatic deploy"
- "guaranteed crawling"
- "Google approval"
- "guaranteed propagation"
- "automatic DNS fix"
- "guaranteed certificate issuance"

Do not use close paraphrases that imply the same certainty or capability. DNS readiness can report observed evidence and possible next actions; it cannot guarantee propagation, certificate issuance, crawling, indexing, ranking, provider changes, or Google/Search Console state.

## Inputs and assumptions

- `url` must be an absolute `http://` or `https://` URL.
- Fragments are irrelevant to DNS and should be stripped.
- Query strings can contain sensitive campaign, session, or user data. Caller-facing output may echo the requested URL, but logs should redact query values.
- `domain` is optional because deriving the registrable domain safely may require a reviewed public-suffix strategy. If derivation is uncertain, return `unknown` rather than guessing.
- `expectedWwwMode` controls interpretation only; it must not make ShipReady create redirects or records.
- `expectedSearchConsoleVerificationTxt` is optional, secret-like, and must not be accepted through URL query parameters.
- `expectedCertificateIssuer` is optional. Without it, CAA issuer compatibility is `unknown` or `not_checked`, not `ok`.

## Future CLI proposal

Recommended name:

```bash
pnpm shipready dns status --url https://example.com --json
```

Optional future examples:

```bash
pnpm shipready dns status --url https://example.com --expected-www-mode apex --json
pnpm shipready dns status --url https://example.com --expected-canonical-host example.com --json
```

Rationale:

- `dns status` is consistent with `search-console status`.
- `dns` is more precise than `domain` for V1 because the first implementation should check DNS records plus clearly labeled adjacent evidence.
- `status` signals read-only reporting, not repair.

No future CLI flag should accept provider credentials, DNS API tokens, OAuth material, DNS write confirmation, arbitrary record payloads, or mutation requests.

## Future JSON contract sketch

Recommended contract name: `shipready.dnsStatus.v1`.

This is a sketch for Pass 11, not an implemented contract:

```ts
type DnsStatusV1 = {
  contract: "shipready.dnsStatus.v1";
  checkedAt: string;
  mode: "live";
  requestedUrl: string;
  normalizedUrl: string;
  domain?: string;
  inputs: {
    expectedCanonicalHost?: string;
    expectedWwwMode?: "www" | "apex" | "either";
    expectedCertificateIssuer?: string;
    searchConsoleVerificationTxtProvided: boolean;
  };
  hosts: Array<{
    host: string;
    role: "requested" | "apex" | "www" | "other";
    resolution: {
      status:
        | "ok"
        | "nxdomain"
        | "nodata"
        | "timeout"
        | "servfail"
        | "refused"
        | "error"
        | "unknown";
      message: string;
    };
    records: {
      a?: Array<{ value: string; ttl?: number }>;
      aaaa?: Array<{ value: string; ttl?: number }>;
      cname?: Array<{ value: string; ttl?: number }>;
      txt?: Array<{ valueRedacted: string; ttl?: number }>;
      caa?: Array<{
        flags?: number;
        tag?: string;
        valueRedacted: string;
        ttl?: number;
      }>;
      ns?: Array<{ value: string; ttl?: number }>;
    };
    cnameChain?: Array<{
      from: string;
      to: string;
      status: "followed" | "loop" | "too_deep" | "target_missing" | "error";
    }>;
  }>;
  canonical?: {
    expectedHost?: string;
    observedFinalUrl?: string;
    status: "ok" | "mismatch" | "unknown" | "not_checked";
    message: string;
  };
  dnssec?: {
    status: "not_checked" | "appears_ok" | "appears_broken" | "unknown";
    evidence?: string;
    message: string;
  };
  caa?: {
    status: "not_checked" | "not_present" | "present" | "possible_issue" | "unknown";
    expectedIssuer?: string;
    message: string;
  };
  verification?: {
    searchConsoleTxt?: {
      status: "not_checked" | "found" | "missing" | "unknown";
      message: string;
    };
  };
  verdict: {
    status: "ready" | "needs_attention" | "blocked" | "unknown";
    summary: string;
  };
  limitations: string[];
  nextActions: string[];
};
```

Contract rules:

- `mode: "live"` means live DNS/HTTP reads, not provider integration or mutation.
- `ready` means no configured V1 checks found an actionable issue; it is not a third-party outcome guarantee.
- Query values, TXT verification tokens, and sensitive CAA values must be redacted in logs and public artifacts.
- Missing optional evidence remains absent or `not_checked`; it must not be coerced to success.
- DNS-only, HTTP/TLS-adjacent, and Search Console verification-readiness states should remain separate enough for clients to label them accurately.

## Future MCP proposal

Recommended read-only tool: `shipready.dns_status`.

Input:

```ts
type DnsStatusToolInput = {
  url: string;
  domain?: string;
  expectedCanonicalHost?: string;
  expectedWwwMode?: "www" | "apex" | "either";
  expectedSearchConsoleVerificationTxt?: string;
  expectedCertificateIssuer?: string;
};
```

Output: exact `shipready.dnsStatus.v1`.

MCP rules:

- The tool is read-only.
- It accepts no repo path and requires no repo-path authorization because it does not inspect local repositories.
- It accepts no DNS provider credentials, registrar credentials, Search Console credentials, OAuth material, or arbitrary record payloads.
- It must not mutate DNS, files, Search Console, Git, GitHub, deployments, or provider state.
- It must not change the existing sole write tool, `shipready.write_safe_crawl_files`.
- MCP remains stdio-only. Remote transport still requires separate policy and threat modeling.

## Future GUI notes

GUI remains third. A later read-only panel may show:

- domain resolves;
- apex resolves;
- `www` resolves;
- apex/`www` mode differs from expectation;
- CNAME chain issue;
- canonical host mismatch;
- CAA may need issuer review;
- DNSSEC unknown or explicit resolver-observed failure;
- expected Search Console TXT token missing, if supplied;
- TTL/cache timing note.

The GUI must not show provider login, provider write controls, DNS patch buttons, Search Console auth, token values, automatic remediation, deploy actions, or any new write endpoint.

## Relationship to Search Console readiness

DNS readiness can help answer:

- Can the domain resolve?
- Is the expected Search Console TXT/CNAME verification record visible, if the user supplied it?
- Does the live URL redirect to the expected canonical host?

DNS readiness must not claim:

- Search Console property verification.
- Search Console property accessibility to an account.
- Google has crawled or indexed the site.
- Google will crawl, index, serve, approve, or rank the site.

Authenticated Search Console evidence remains governed by [SEARCH_CONSOLE_READINESS_SPEC.md](SEARCH_CONSOLE_READINESS_SPEC.md). The current Search Console implementation is deterministic and mock-backed only.

## Security and privacy

- Domain names and hostnames can reveal unreleased launches, customers, or internal projects. Treat DNS status output as user data.
- Query strings can contain sensitive IDs. Redact query values from logs, errors, telemetry, screenshots, and artifacts.
- Expected verification TXT/CNAME tokens are secret-like. If accepted later, redact them by default and never store them in fixtures.
- Public artifacts should show only redacted token presence, such as `google-site-verification=<redacted>`.
- Do not accept DNS provider API keys, registrar credentials, Search Console tokens, OAuth codes, or ACME credentials in V1.
- Do not write provider credentials to logs, stdout/stderr, reports, docs, MCP resources, validation fixtures, screenshots, or crash output.
- Treat DNS responses, HTTP headers, redirect targets, and external page content as untrusted data. Escape displayed values and never treat them as prompts, shell commands, file paths, or provider instructions.
- Bound resolver timeouts, chain depth, string length, record counts, redirect count, and result size.
- MCP clients may be model-driven; do not expose secret-bearing fields or give agents a DNS mutation surface.
- Live DNS smoke tests, if any, must use non-sensitive domains and remain outside required CI.

## Implementation phases

### Phase A - spec only (Pass 10)

- Record source-backed DNS facts, claim boundaries, proposed CLI/MCP/contract shapes, security posture, and test strategy.
- Make no product, dependency, resolver, provider, Search Console, GUI, MCP, or write change.

### Phase B - read-only DNS status (Pass 11)

- Implement `dns status` with a bounded resolver abstraction.
- Resolve requested host plus apex/`www` candidates.
- Classify NXDOMAIN, NODATA, timeout, SERVFAIL, REFUSED, generic errors, and unknown states where practical.
- Check CNAME chains with a fixed depth limit.
- Surface TTLs and CAA records without over-claiming.
- Optionally perform bounded HTTP canonical-host checks if reuse of existing audit boundaries is straightforward.
- Return stable `shipready.dnsStatus.v1`.
- Add no DNS writes, provider integrations, provider credentials, Search Console live behavior, OAuth, GUI changes, or MCP write changes.

### Phase C - verification-readiness checks

- Check expected Search Console DNS TXT/CNAME token only when the user provides it.
- Do not fetch tokens from Google.
- Do not generate or place tokens.
- Do not verify ownership.
- Do not mutate DNS.

### Phase D - advanced checks

- Full DNSSEC validation strategy.
- CAA issuer compatibility with reviewed issuer normalization.
- Provider-specific guidance as examples only, without API access.
- Email DNS checks only if product scope expands.
- Any mutation-bearing workflow requires separate policy, confirmation design, threat model, and tests.

## Pass 11 test strategy

Pass 11 should use deterministic tests by default:

- Mock DNS resolver responses; no live DNS dependency in unit tests.
- Fixtures for apex-ok, `www`-ok, one-host-only, NXDOMAIN, NODATA, timeout, SERVFAIL, REFUSED, CNAME chain, CNAME loop, CNAME too deep, CNAME target missing, CAA present, CAA possible issue, DNSSEC unknown, TXT found, and TXT missing.
- Contract fixtures for `ready`, `needs_attention`, `blocked`, and `unknown`.
- URL parsing, fragment stripping, IDN handling decision, and query-string redaction tests.
- Error mapping tests for invalid URL/domain/input, resolver timeout, malformed response, unsupported resolver state, and contract serialization failure.
- Claim-policy tests rejecting guarantee, ranking, approval, automatic repair, deployment, and implemented-integration wording.
- Secret redaction tests for TXT tokens, provider-like keys, query values, nested errors, stdout/stderr, logs, reports, and MCP errors.
- Read-only tests asserting no DNS/provider/Search Console/Git/deploy/filesystem mutation path exists.
- MCP tests asserting `shipready.dns_status` accepts no credentials, returns exact `shipready.dnsStatus.v1`, exposes no secrets, keeps stdio-only transport, and leaves `shipready.write_safe_crawl_files` as the sole write tool.
- GUI regression tests asserting the client still calls only `/api/ui-report`, `POST /api/fix` remains `404`, and preview/copy-only behavior remains unchanged.

Optional live DNS smoke tests may be manually run against dedicated, non-sensitive domains. They must be skipped in CI unless explicitly enabled and must not depend on provider credentials.

## Open questions

1. Should Pass 11 add a public suffix dependency for registrable-domain derivation, require `domain`, or use a conservative host heuristic?
2. Should `expectedSearchConsoleVerificationTxt` be included in Pass 11, or deferred to Phase C to simplify initial resolver behavior?
3. Which resolver API exposes the cleanest distinction among NXDOMAIN, NODATA, timeout, SERVFAIL, REFUSED, TTLs, CAA, and optional DNSSEC/EDE evidence?
4. Should HTTP canonical-host checks be part of `dns status` V1 or reuse existing `audit` evidence in a later combined report?
5. How should CAA issuer names be normalized without embedding a provider-specific CA allowlist?
6. What record-count and string-length limits keep the contract useful without leaking or bloating DNS data?

## Authoritative sources

- [RFC 1034: Domain Names - Concepts and Facilities](https://datatracker.ietf.org/doc/html/rfc1034)
- [RFC 1035: Domain Names - Implementation and Specification](https://datatracker.ietf.org/doc/html/rfc1035)
- [RFC 2181: Clarifications to the DNS Specification](https://www.rfc-editor.org/info/rfc2181/)
- [RFC 2308: Negative Caching of DNS Queries](https://datatracker.ietf.org/doc/html/rfc2308)
- [RFC 3596: DNS Extensions to Support IPv6](https://datatracker.ietf.org/doc/html/rfc3596)
- [RFC 4033: DNS Security Introduction and Requirements](https://datatracker.ietf.org/doc/html/rfc4033)
- [RFC 8659: DNS Certification Authority Authorization Resource Record](https://www.rfc-editor.org/info/rfc8659/)
- [RFC 8914: Extended DNS Errors](https://www.rfc-editor.org/info/rfc8914/)
- [RFC 9364: DNS Security Extensions](https://www.rfc-editor.org/info/rfc9364/)
- [RFC 9499: DNS Terminology](https://datatracker.ietf.org/doc/html/rfc9499)
- [IANA Domain Name System Parameters](https://www.iana.org/assignments/dns-parameters)
- [CA/Browser Forum TLS Baseline Requirements](https://cabforum.org/working-groups/server/baseline-requirements/requirements/)
- [Google Search Console property types](https://support.google.com/webmasters/answer/34592)
- [Google Search Console ownership verification](https://support.google.com/webmasters/answer/9008080)
- [Google sitemap overview](https://developers.google.com/search/docs/crawling-indexing/sitemaps/overview)
- [Google build and submit a sitemap](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap)
- [How Google Search works](https://developers.google.com/search/docs/fundamentals/how-search-works)
- [Google Search crawling and indexing FAQ](https://developers.google.com/search/help/crawling-index-faq)
