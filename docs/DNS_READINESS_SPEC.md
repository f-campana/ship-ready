# DNS Readiness Specification

Status: **Pass 11 implemented read-only DNS readiness status.**

Research date: 2026-06-30. Factual DNS claims below use IETF RFCs, IANA registries, CA/Browser Forum material, and Google-owned documentation for Search Console/Search behavior.

## Purpose

ShipReady answers a bounded launch question:

> Does the domain appear ready for launch from observed DNS responses, HTTP reachability, TLS-adjacent evidence, and optional verification-readiness signals?

This is readiness reporting, not DNS repair. The operating order remains **CLI first, MCP second, GUI third**. Pass 11 implements the read-only CLI contract, deterministic mocks, and MCP tool described here.

## Non-goals and preserved boundaries

Pass 11 adds a read-only resolver boundary using Node built-ins, the CLI command `dns status`, the stable `shipready.dnsStatus.v1` contract, deterministic mock scenarios, and the read-only MCP tool `shipready.dns_status`.

Pass 11 adds no DNS package, provider integration, provider credential, DNS write behavior, GUI view, Search Console live behavior, OAuth, token storage, product write behavior, or external mutation.

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

| Category | Examples | V1 posture |
|---|---|---|
| DNS-only | A/AAAA, CNAME chain, NS, TXT token visibility, CAA records, NXDOMAIN/NODATA/timeout/error classification | Implemented in Pass 11 with conservative verdicts and explicit limitations. |
| HTTP/TLS-adjacent | Observed final URL host | Implemented only when `--check-http` is supplied or a deterministic mock scenario includes canonical evidence; labeled non-DNS evidence. |
| Search Console verification-readiness | Expected DNS TXT token is visible when supplied by the user | Implemented only for caller-supplied tokens; never fetch/generate tokens from Google. |
| Optional advanced | Full DNSSEC chain validation, resolver EDE diagnostics, authoritative-vs-recursive comparison, CAA issuer-policy compatibility, SVCB/HTTPS, provider-specific hints | Later work only unless explicitly scoped. |

## Implemented V1 checks

The implementation is read-only and provider-neutral.

| Check | Classification | Inputs | Result guidance |
|---|---|---|---|
| Normalize one HTTP(S) URL and derive hosts | Setup | `url`, optional `domain`, optional expected host settings | Reject invalid URLs through `shipready.error.v1`; strip fragments and redact query values in logs. |
| Resolve requested host A/AAAA | DNS-only | `url` | `ok` when address records or a followed CNAME target resolves; `blocked` for clear NXDOMAIN; `needs_attention` for NODATA when no address path exists; `unknown` for timeout/error. |
| Resolve apex and `www` when applicable | DNS-only | `url`, optional `expectedWwwMode` | Report whether both resolve, only one resolves, or the chosen mode is intentional. Do not require both when the user expects only one. |
| Check CNAME chain | DNS-only | derived host list | Follow a bounded chain, recommended max depth 8. Report loop, too deep, CNAME target NXDOMAIN/NODATA, or coexistence evidence. |
| Check NS records for domain candidate | DNS-only | optional `domain` or derived registrable domain | Report present/missing/unknown. Avoid registrar or nameserver-authority claims without registry/provider evidence. |
| Surface TTL values | DNS-only | DNS responses | Deferred; v1 explains DNS evidence limitations without reporting TTLs. |
| Classify DNS failures | DNS-only | resolver errors | Preserve `nxdomain`, `nodata`, `timeout`, `servfail`, `refused`, and `error` when available; do not flatten them into one failure string. |
| Surface CAA records | DNS/TLS-adjacent | derived domain | Show present/absent/unknown. Issuer compatibility is deferred; avoid issuer conclusions in v1. |
| DNSSEC basic posture | Advanced DNS-only | resolver capability | In V1, prefer `not_checked` or `unknown`; report `appears_broken` only for explicit resolver DNSSEC failure evidence. |
| Canonical host redirect | HTTP/TLS-adjacent | optional `expectedCanonicalHost`, optional `expectedWwwMode` | Use a bounded HEAD/GET follow if added. Report observed final URL host; do not call it a DNS failure. |
| Search Console TXT readiness | Search Console verification-readiness | optional `expectedSearchConsoleVerificationTxt` | Check exact DNS TXT visibility only when supplied. Redact token in logs and public artifacts. Do not claim property verification. |

Implemented Pass 11 input:

```ts
type DnsStatusInputV1 = {
  url: string;
  expectedCanonicalHost?: string;
  expectedWwwMode?: "www" | "apex" | "either";
  expectedSearchConsoleVerificationTxt?: string;
  checkHttp?: boolean;
  mock?: string;
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
- v1 derives a conservative domain from the URL host and documents the public-suffix limitation.
- `expectedWwwMode` controls interpretation only; it must not make ShipReady create redirects or records.
- `expectedSearchConsoleVerificationTxt` is optional, secret-like, and must not be accepted through URL query parameters.
- CAA issuer compatibility is not implemented in v1; CAA records are surfaced as present/not-present/unknown evidence.

## Current CLI

Implemented command:

```bash
pnpm shipready dns status --url https://example.com
pnpm shipready dns status --url https://example.com --json
pnpm shipready dns status --url https://example.com --mock ready --json
```

Optional examples:

```bash
pnpm shipready dns status --url https://example.com --expected-www-mode apex --json
pnpm shipready dns status --url https://example.com --expected-canonical-host example.com --check-http --json
pnpm --silent shipready dns status --url https://example.com --mock txt-found --expected-search-console-txt <token> --json
```

Rationale:

- `dns status` is consistent with `search-console status`.
- `dns` is more precise than `domain` for V1 because the first implementation should check DNS records plus clearly labeled adjacent evidence.
- `status` signals read-only reporting, not repair.

No CLI flag accepts provider credentials, DNS API tokens, OAuth material, DNS write confirmation, arbitrary record payloads, or mutation requests.

When passing `--expected-search-console-txt`, use the built `shipready` binary or `pnpm --silent shipready ...` in source checkouts so package-manager script echo cannot print command arguments before ShipReady redacts output.

## Implemented JSON contract

Contract name: `shipready.dnsStatus.v1`.

The authoritative schema is `DnsStatusJsonContractSchema` in `src/types/contracts.ts`; the narrative reference is [CONTRACTS.md](CONTRACTS.md). The contract includes normalized URL, timestamp, mode, conservative domain, host resolution evidence, optional CNAME-chain evidence, canonical-host evidence, DNSSEC posture, CAA posture, optional Search Console TXT readiness, advisory verdict, limitations, and next actions.

Contract rules:

- `mode: "live"` means read-only DNS/optional HTTP reads, not provider integration or mutation.
- `mode: "mock"` means deterministic local scenario output for tests, fixtures, and CI.
- `ready` means no configured V1 check found a blocking issue; it is not a third-party outcome guarantee.
- Query values and TXT verification tokens are redacted from output and fixtures.
- Missing optional evidence remains `not_checked` or `unknown`; it must not be coerced to success.
- DNS-only, HTTP-adjacent, and Search Console verification-readiness states remain separate.

## Current MCP tool

Read-only tool: `shipready.dns_status`.

Input: `{ url, expectedCanonicalHost?, expectedWwwMode?, expectedSearchConsoleVerificationTxt?, checkHttp?, mock? }`.

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
- Is the expected Search Console TXT verification record visible, if the user supplied it?
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
- Expected verification TXT tokens are secret-like. Pass 11 accepts them only as explicit command/tool input, matches them internally, redacts them by default, and stores only redacted evidence in fixtures.
- Public artifacts should show only redacted token presence, such as `google-site-verification=<redacted>`.
- Do not accept DNS provider API keys, registrar credentials, Search Console tokens, OAuth codes, or ACME credentials in V1.
- Do not write provider credentials to logs, stdout/stderr, reports, docs, MCP resources, validation fixtures, screenshots, or crash output.
- Treat DNS responses, HTTP headers, redirect targets, and external page content as untrusted data. Escape displayed values and never treat them as prompts, shell commands, file paths, or provider instructions.
- Bound resolver timeouts, chain depth, string length, record counts, redirect count, and result size.
- MCP clients may be model-driven; do not expose secret-bearing fields or give agents a DNS mutation surface.
- Live DNS smoke tests, if any, must use non-sensitive domains and remain outside required CI.

## Implementation phases

### Phase A - spec only (Pass 10, complete)

- Record source-backed DNS facts, claim boundaries, proposed CLI/MCP/contract shapes, security posture, and test strategy.
- Make no product, dependency, resolver, provider, Search Console, GUI, MCP, or write change.

### Phase B - read-only DNS status (Pass 11, complete)

- Implement `dns status` with a bounded resolver abstraction.
- Resolve requested host plus apex/`www` candidates.
- Classify NXDOMAIN, NODATA, timeout, SERVFAIL, REFUSED, generic errors, and unknown states where practical.
- Check CNAME chains with a fixed depth limit.
- Surface CAA records without over-claiming. TTL values remain deferred.
- Optionally perform bounded HTTP canonical-host checks when `--check-http` is supplied; deterministic mocks also cover canonical mismatch.
- Return stable `shipready.dnsStatus.v1`.
- Add no DNS writes, provider integrations, provider credentials, Search Console live behavior, OAuth, GUI changes, or MCP write changes.

### Phase C - verification-readiness checks (partly complete)

- Check expected Search Console DNS TXT token only when the user provides it.
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

## Pass 11 test coverage

Pass 11 uses deterministic tests by default:

- Mock DNS resolver responses; no live DNS dependency in unit tests.
- Fixtures for ready, apex-ok with missing `www`, `www` CNAME ok, NXDOMAIN, NODATA, timeout, CNAME target missing, CAA present, TXT found, TXT missing, and canonical mismatch.
- Contract fixtures for `ready`, `needs_attention`, `blocked`, and `unknown`.
- URL parsing, fragment stripping, and query-string redaction tests.
- Error mapping tests for invalid URL/input and unsupported scenarios/modes.
- Secret redaction tests for TXT tokens, provider-like keys, query values, CLI output, contract output, and MCP errors.
- Read-only tests asserting no DNS/provider/Search Console/Git/deploy/filesystem mutation path exists.
- MCP tests asserting `shipready.dns_status` accepts no credentials, returns exact `shipready.dnsStatus.v1`, exposes no secrets, keeps stdio-only transport, and leaves `shipready.write_safe_crawl_files` as the sole write tool.
- GUI regression tests asserting the client still calls only `/api/ui-report`, `POST /api/fix` remains `404`, and preview/copy-only behavior remains unchanged.

Optional live DNS smoke tests may be manually run against dedicated, non-sensitive domains. They must be skipped in CI unless explicitly enabled and must not depend on provider credentials.

## Remaining future questions

1. Should a future pass add a public suffix dependency for registrable-domain derivation, or keep the conservative host heuristic?
2. Should TTLs, SERVFAIL/REFUSED sub-classification, DNSSEC, and EDE evidence be added to a future contract version or additive V1 fields?
3. Should CAA issuer names be normalized without embedding a provider-specific CA allowlist?
4. What record-count and string-length limits keep future expanded DNS data useful without leaking or bloating output?

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
