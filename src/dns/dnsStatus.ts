import { fetchText, NetworkError } from "../utils/http";
import { normalizeAuditUrl } from "../utils/url";
import { CONTRACT_NAMES, DnsStatusJsonContractSchema, type DnsStatusJsonContract } from "../types/contracts";
import { DnsStatusError } from "./dnsErrors";
import { createLiveDnsResolver, DEFAULT_DNS_TIMEOUT_MS } from "./dnsResolver";
import { createMockDnsResolver, DNS_MOCK_CHECKED_AT, parseDnsMockScenario } from "./mockDnsResolver";
import {
  EXPECTED_WWW_MODES,
  type DnsCaaRecord,
  type DnsResolver,
  type DnsStatus,
  type DnsStatusInput,
  type ExpectedWwwMode,
} from "./dnsTypes";

type ResolutionStatus = DnsStatus["hosts"][number]["resolution"]["status"];
type HostRole = DnsStatus["hosts"][number]["role"];
type HostStatus = DnsStatus["hosts"][number];
type QueryResult<T> = {
  status: ResolutionStatus;
  records: T[];
  message: string;
};
type CnameChainEntry = NonNullable<HostStatus["cnameChain"]>[number];
type SearchConsoleTxtStatus = NonNullable<NonNullable<DnsStatus["verification"]>["searchConsoleTxt"]>;
type VerificationSummary = { searchConsoleTxt: SearchConsoleTxtStatus };
type InspectedHost = {
  status: HostStatus;
  txtTokenFound: boolean;
  txtChecked: boolean;
};

const MAX_CNAME_DEPTH = 8;

export async function getDnsStatus(
  input: DnsStatusInput,
  resolverOverride?: DnsResolver,
): Promise<DnsStatusJsonContract> {
  const normalizedUrl = normalizeDnsStatusUrl(input.url);
  const parsedUrl = new URL(normalizedUrl);
  const requestedHost = normalizeHost(parsedUrl.hostname);
  const domain = deriveDomain(requestedHost);
  const expectedWwwMode = parseExpectedWwwMode(input.expectedWwwMode);
  const mockScenario = input.mock ? parseDnsMockScenario(input.mock) : undefined;
  const resolver = resolverOverride
    ?? (mockScenario
      ? createMockDnsResolver(mockScenario, domain, input.expectedSearchConsoleTxt)
      : createLiveDnsResolver(input.timeoutMs ?? DEFAULT_DNS_TIMEOUT_MS));
  const mode = mockScenario ? "mock" : "live";
  const checkedAt = input.checkedAt ?? (mockScenario ? DNS_MOCK_CHECKED_AT : new Date().toISOString());

  const hostNames = orderedHosts(requestedHost, domain);
  const txtHosts = input.expectedSearchConsoleTxt
    ? new Set([domain, requestedHost])
    : new Set<string>();

  const hostInspections = await Promise.all(hostNames.map((host) =>
    inspectHost({
      host,
      role: roleForHost(host, domain),
      domain,
      resolver,
      includeTxt: txtHosts.has(host),
      expectedSearchConsoleTxt: input.expectedSearchConsoleTxt,
    })));
  const hostResults = hostInspections.map((host) => host.status);

  const canonical = await getCanonicalStatus({
    url: normalizedUrl,
    expectedHost: normalizeOptionalHost(input.expectedCanonicalHost) ?? requestedHost,
    checkHttp: Boolean(input.checkHttp) || mockScenario === "canonical-mismatch",
    mockCanonicalMismatch: mockScenario === "canonical-mismatch",
    timeoutMs: input.timeoutMs ?? DEFAULT_DNS_TIMEOUT_MS,
  });
  const caa = summarizeCaa(hostResults, domain);
  const verification = summarizeVerification(hostInspections, input.expectedSearchConsoleTxt);
  const verdict = summarizeVerdict({
    hosts: hostResults,
    requestedHost,
    domain,
    expectedWwwMode,
    canonical,
    verification: verification.searchConsoleTxt,
  });
  const limitations = limitationsFor(
    mode,
    canonical.status !== "not_checked",
    input.expectedSearchConsoleTxt,
  );
  const nextActions = nextActionsFor(verdict.status, {
    canonical,
    verification: verification.searchConsoleTxt,
    expectedWwwMode,
  });

  return DnsStatusJsonContractSchema.parse({
    contract: CONTRACT_NAMES.dnsStatus,
    url: normalizedUrl,
    checkedAt,
    mode,
    domain,
    hosts: hostResults,
    canonical,
    dnssec: {
      status: "not_checked",
      message: "DNSSEC validation is not checked by ShipReady DNS readiness v1.",
    },
    caa,
    verification,
    verdict,
    limitations,
    nextActions,
  });
}

export function formatDnsStatusJson(status: DnsStatusJsonContract): string {
  return `${JSON.stringify(DnsStatusJsonContractSchema.parse(status), null, 2)}\n`;
}

export function formatDnsStatusHuman(status: DnsStatusJsonContract): string {
  const lines = [
    "DNS readiness",
    `Mode: ${status.mode} (read-only)`,
    `URL: ${status.url}`,
    `Domain: ${status.domain}`,
    "",
    "Resolution",
  ];

  for (const host of status.hosts) {
    const addresses = [
      ...(host.records.a ?? []),
      ...(host.records.aaaa ?? []),
    ];
    const addressText = addresses.length > 0 ? `; ${addresses.length} address record(s)` : "";
    const cnameText = host.records.cname?.length ? `; CNAME ${host.records.cname.join(" -> ")}` : "";
    lines.push(`  ${host.host} (${host.role}): ${host.resolution.status}${addressText}${cnameText}`);
    lines.push(`    ${host.resolution.message}`);
  }

  lines.push(
    "",
    "CAA",
    `  ${status.caa?.status ?? "not_checked"}: ${status.caa?.message ?? "CAA was not checked."}`,
    "",
    "Verification TXT",
    `  ${status.verification?.searchConsoleTxt?.status ?? "not_checked"}: ${status.verification?.searchConsoleTxt?.message ?? "No expected Search Console TXT token was provided."}`,
    "",
    "Canonical host",
    `  ${status.canonical?.status ?? "not_checked"}: ${status.canonical?.message ?? "HTTP canonical host was not checked."}`,
    "",
    "Verdict",
    `  ${status.verdict.status}: ${status.verdict.summary}`,
    "",
    "Limitations",
    ...status.limitations.map((item) => `  - ${item}`),
    "",
    "Next actions",
    ...status.nextActions.map((item) => `  - ${item}`),
    "",
  );

  return lines.join("\n");
}

function normalizeDnsStatusUrl(input: string): string {
  const normalized = normalizeAuditUrl(input);
  const parsed = new URL(normalized);
  parsed.search = "";
  parsed.hash = "";
  return parsed.toString();
}

function normalizeHost(host: string): string {
  return host.replace(/\.$/, "").toLowerCase();
}

function normalizeOptionalHost(host: string | undefined): string | undefined {
  const trimmed = host?.trim();
  return trimmed ? normalizeHost(trimmed) : undefined;
}

function deriveDomain(host: string): string {
  return host.startsWith("www.") ? host.slice(4) : host;
}

function orderedHosts(requestedHost: string, domain: string): string[] {
  return [...new Set([requestedHost, domain, `www.${domain}`])];
}

function roleForHost(host: string, domain: string): HostRole {
  if (host === domain) return "apex";
  if (host === `www.${domain}`) return "www";
  return "other";
}

function parseExpectedWwwMode(value: string | undefined): ExpectedWwwMode {
  if (!value) return "either";
  if ((EXPECTED_WWW_MODES as readonly string[]).includes(value)) return value as ExpectedWwwMode;
  throw new DnsStatusError(
    "invalid_mode",
    `Unsupported expected www mode: ${value}. Use one of: ${EXPECTED_WWW_MODES.join(", ")}.`,
  );
}

async function inspectHost(input: {
  host: string;
  role: HostRole;
  domain: string;
  resolver: DnsResolver;
  includeTxt: boolean;
  expectedSearchConsoleTxt?: string;
}): Promise<InspectedHost> {
  const [a, aaaa, cname, ns, caa, txt] = await Promise.all([
    queryRecords(() => input.resolver.resolveA(input.host), "A", input.host),
    queryRecords(() => input.resolver.resolveAAAA(input.host), "AAAA", input.host),
    queryRecords(() => input.resolver.resolveCNAME(input.host), "CNAME", input.host),
    input.host === input.domain
      ? queryRecords(() => input.resolver.resolveNS(input.domain), "NS", input.domain)
      : notChecked<string>(),
    input.host === input.domain
      ? queryRecords(() => input.resolver.resolveCAA(input.domain), "CAA", input.domain)
      : notChecked<DnsCaaRecord>(),
    input.includeTxt
      ? queryRecords(() => input.resolver.resolveTXT(input.host), "TXT", input.host)
      : notChecked<string[]>(),
  ]);
  const chain = await resolveCnameChain(input.host, input.resolver, cname.records);
  const records: HostStatus["records"] = {};

  if (a.records.length > 0) records.a = a.records;
  if (aaaa.records.length > 0) records.aaaa = aaaa.records;
  if (cname.records.length > 0) records.cname = cname.records.map(normalizeHost);
  if (ns.records.length > 0) records.ns = ns.records.map(normalizeHost);
  if (caa.records.length > 0) records.caa = caa.records;
  const rawTxtRecords = txt.records.map((chunks) => chunks.join(""));
  if (rawTxtRecords.length > 0) {
    records.txt = rawTxtRecords.map((value) => redactTxtValue(value, input.expectedSearchConsoleTxt));
  }

  const resolution = resolutionFor({ host: input.host, a, aaaa, cname, chain });
  return {
    status: {
      host: input.host,
      role: input.role,
      records,
      resolution,
      ...(chain.length > 0 ? { cnameChain: chain } : {}),
    },
    txtTokenFound: Boolean(input.expectedSearchConsoleTxt)
      && rawTxtRecords.some((value) => value.includes(input.expectedSearchConsoleTxt!)),
    txtChecked: input.includeTxt && (txt.status === "ok" || txt.status === "nodata"),
  };
}

async function queryRecords<T>(
  query: () => Promise<T[]>,
  recordType: string,
  host: string,
): Promise<QueryResult<T>> {
  try {
    const records = await query();
    return records.length > 0
      ? { status: "ok", records, message: `${recordType} records observed for ${host}.` }
      : { status: "nodata", records: [], message: `No ${recordType} records were observed for ${host}.` };
  } catch (error) {
    const status = classifyDnsError(error);
    return {
      status,
      records: [],
      message: messageForDnsStatus(status, recordType, host),
    };
  }
}

function notChecked<T>(): QueryResult<T> {
  return { status: "not_checked", records: [], message: "Not checked." };
}

function classifyDnsError(error: unknown): Exclude<ResolutionStatus, "ok" | "not_checked"> {
  const code = typeof (error as { code?: unknown })?.code === "string"
    ? String((error as { code: string }).code).toUpperCase()
    : "";
  if (code === "ENOTFOUND") return "nxdomain";
  if (code === "ENODATA") return "nodata";
  if (code === "ETIMEOUT" || code === "EAI_AGAIN") return "timeout";
  return "error";
}

function messageForDnsStatus(
  status: Exclude<ResolutionStatus, "ok" | "not_checked">,
  recordType: string,
  host: string,
): string {
  if (status === "nxdomain") return `${host} did not resolve while checking ${recordType} records.`;
  if (status === "nodata") return `No ${recordType} records were observed for ${host}.`;
  if (status === "timeout") return `${recordType} lookup for ${host} timed out.`;
  return `${recordType} lookup for ${host} returned an unclassified resolver error.`;
}

async function resolveCnameChain(
  startHost: string,
  resolver: DnsResolver,
  firstRecords: string[],
): Promise<CnameChainEntry[]> {
  const chain: CnameChainEntry[] = [];
  const seen = new Set([startHost]);
  let current = startHost;
  let records = firstRecords.map(normalizeHost);

  for (let depth = 0; records.length > 0; depth += 1) {
    const target = normalizeHost(records[0]!);
    if (seen.has(target)) {
      chain.push({ from: current, to: target, status: "loop" });
      return chain;
    }
    if (depth >= MAX_CNAME_DEPTH) {
      chain.push({ from: current, to: target, status: "too_deep" });
      return chain;
    }

    chain.push({ from: current, to: target, status: "followed" });
    seen.add(target);
    current = target;

    const targetA = await queryRecords(() => resolver.resolveA(current), "A", current);
    const targetAAAA = await queryRecords(() => resolver.resolveAAAA(current), "AAAA", current);
    if (targetA.records.length === 0 && targetAAAA.records.length === 0) {
      if (
        targetA.status === "nxdomain" ||
        targetAAAA.status === "nxdomain" ||
        targetA.status === "nodata" ||
        targetAAAA.status === "nodata"
      ) {
        chain[chain.length - 1] = { from: chain[chain.length - 1]!.from, to: target, status: "target_missing" };
        return chain;
      }
    }

    const next = await queryRecords(() => resolver.resolveCNAME(current), "CNAME", current);
    if (next.records.length === 0) return chain;
    records = next.records.map(normalizeHost);
  }

  return chain;
}

function resolutionFor(input: {
  host: string;
  a: QueryResult<string>;
  aaaa: QueryResult<string>;
  cname: QueryResult<string>;
  chain: CnameChainEntry[];
}): HostStatus["resolution"] {
  if (input.a.records.length > 0 || input.aaaa.records.length > 0) {
    return {
      status: "ok",
      message: `${input.host} has observed address records.`,
    };
  }

  const brokenCname = input.chain.find((entry) =>
    entry.status === "loop" || entry.status === "too_deep" || entry.status === "target_missing");
  if (brokenCname) {
    return {
      status: brokenCname.status === "target_missing" ? "nxdomain" : "error",
      message: `CNAME chain for ${input.host} is ${brokenCname.status.replace("_", " ")}.`,
    };
  }

  if (input.cname.records.length > 0 && input.chain.length > 0) {
    return {
      status: "ok",
      message: `${input.host} has a CNAME chain and no obvious broken target was observed.`,
    };
  }

  if (input.a.status === "nxdomain" || input.aaaa.status === "nxdomain") {
    return {
      status: "nxdomain",
      message: `${input.host} did not resolve to address records.`,
    };
  }
  if (input.a.status === "timeout" || input.aaaa.status === "timeout") {
    return {
      status: "timeout",
      message: `Address lookup for ${input.host} timed out.`,
    };
  }
  if (input.a.status === "error" || input.aaaa.status === "error") {
    return {
      status: "error",
      message: `Address lookup for ${input.host} returned an unclassified resolver error.`,
    };
  }
  return {
    status: "nodata",
    message: `No address records were observed for ${input.host}.`,
  };
}

async function getCanonicalStatus(input: {
  url: string;
  expectedHost: string;
  checkHttp: boolean;
  mockCanonicalMismatch: boolean;
  timeoutMs: number;
}): Promise<NonNullable<DnsStatus["canonical"]>> {
  if (!input.checkHttp) {
    return {
      expectedHost: input.expectedHost,
      status: "not_checked",
      message: "HTTP canonical host check was not requested.",
    };
  }

  if (input.mockCanonicalMismatch) {
    const requested = new URL(input.url);
    const observed = new URL(input.url);
    observed.hostname = requested.hostname.startsWith("www.")
      ? requested.hostname.slice(4)
      : `www.${requested.hostname}`;
    return {
      expectedHost: input.expectedHost,
      observedFinalUrl: redactUrlForOutput(observed.toString()),
      status: "mismatch",
      message: "Mock HTTP canonical evidence ended on a different host.",
    };
  }

  try {
    const response = await fetchText(input.url, {
      timeoutMs: input.timeoutMs,
      accept: "text/html,*/*;q=0.5",
    });
    const observedFinalUrl = redactUrlForOutput(response.finalUrl);
    const observedHost = normalizeHost(new URL(observedFinalUrl).hostname);
    return {
      expectedHost: input.expectedHost,
      observedFinalUrl,
      status: observedHost === input.expectedHost ? "ok" : "mismatch",
      message: observedHost === input.expectedHost
        ? "Observed HTTP final URL host matches the expected host."
        : "Observed HTTP final URL host differs from the expected host.",
    };
  } catch (error) {
    const message = error instanceof NetworkError
      ? "HTTP canonical host check could not read the URL."
      : "HTTP canonical host check returned an unknown error.";
    return {
      expectedHost: input.expectedHost,
      status: "unknown",
      message,
    };
  }
}

function summarizeCaa(hosts: HostStatus[], domain: string): NonNullable<DnsStatus["caa"]> {
  const apex = hosts.find((host) => host.host === domain);
  const records = apex?.records.caa ?? [];
  if (records.length > 0) {
    return {
      status: "present",
      message: `${records.length} CAA record(s) were observed. Review issuer policy separately if certificate issuance is planned.`,
    };
  }
  if (!apex) {
    return { status: "unknown", message: "CAA could not be summarized because the apex host was not checked." };
  }
  if (apex.resolution.status === "timeout" || apex.resolution.status === "error") {
    return { status: "unknown", message: "CAA status is unknown because DNS lookup did not complete cleanly." };
  }
  return {
    status: "not_present",
    message: "No CAA records were observed by the configured resolver.",
  };
}

function summarizeVerification(
  hosts: InspectedHost[],
  expectedSearchConsoleTxt: string | undefined,
): VerificationSummary {
  if (!expectedSearchConsoleTxt) {
    return {
      searchConsoleTxt: {
        status: "not_checked",
        message: "No expected Search Console TXT token was provided.",
      },
    };
  }

  const found = hosts.some((host) => host.txtTokenFound);
  const txtChecked = hosts.some((host) => host.txtChecked);
  if (found) {
    return {
      searchConsoleTxt: {
        status: "found",
        message: "The expected Search Console TXT token was observed in redacted TXT output.",
      },
    };
  }
  if (txtChecked) {
    return {
      searchConsoleTxt: {
        status: "missing",
        message: "The expected Search Console TXT token was not observed.",
      },
    };
  }
  return {
    searchConsoleTxt: {
      status: "unknown",
      message: "TXT lookup did not return usable evidence for the expected token.",
    },
  };
}

function summarizeVerdict(input: {
  hosts: HostStatus[];
  requestedHost: string;
  domain: string;
  expectedWwwMode: ExpectedWwwMode;
  canonical: NonNullable<DnsStatus["canonical"]>;
  verification: SearchConsoleTxtStatus;
}): DnsStatus["verdict"] {
  const requiredHosts = new Set([input.requestedHost]);
  if (input.expectedWwwMode === "apex") requiredHosts.add(input.domain);
  if (input.expectedWwwMode === "www") requiredHosts.add(`www.${input.domain}`);

  const required = input.hosts.filter((host) => requiredHosts.has(host.host));
  if (required.some((host) => host.resolution.status === "timeout" || host.resolution.status === "error")) {
    return {
      status: "unknown",
      summary: "One or more required DNS lookups were inconclusive.",
    };
  }
  if (required.some((host) =>
    host.resolution.status === "nxdomain" ||
    host.resolution.status === "nodata" ||
    host.resolution.status === "not_checked")) {
    return {
      status: "blocked",
      summary: "A required launch host does not currently have observed address resolution.",
    };
  }
  if (input.canonical.status === "mismatch" || input.verification.status === "missing") {
    return {
      status: "needs_attention",
      summary: "DNS address resolution appears present, but an optional readiness check needs attention.",
    };
  }
  if (input.verification.status === "unknown" || input.canonical.status === "unknown") {
    return {
      status: "unknown",
      summary: "DNS address resolution appears present, but optional evidence is inconclusive.",
    };
  }
  return {
    status: "ready",
    summary: "Required DNS address checks returned observed records and no configured V1 check found a blocking issue.",
  };
}

function limitationsFor(
  mode: "live" | "mock",
  checkHttp: boolean | undefined,
  expectedSearchConsoleTxt: string | undefined,
): string[] {
  return [
    mode === "mock"
      ? "Deterministic mock DNS data only; no live DNS resolver or provider API was used."
      : "Live mode uses read-only recursive DNS lookups from the local Node.js runtime; it does not query provider accounts.",
    "DNS readiness is advisory evidence only and does not guarantee propagation, certificate issuance, crawling, indexing, ranking, or third-party approval.",
    "Registrable-domain derivation is conservative and does not use a public suffix list in v1.",
    checkHttp
      ? "HTTP canonical evidence is adjacent to DNS and may vary by cache, redirect policy, or application behavior."
      : "HTTP canonical host checking was not requested.",
    expectedSearchConsoleTxt
      ? "Search Console TXT evidence checks only whether a caller-supplied token appears in DNS; it does not verify Search Console ownership."
      : "Search Console TXT verification readiness was not checked because no expected token was provided.",
  ];
}

function nextActionsFor(
  status: DnsStatus["verdict"]["status"],
  input: {
    canonical: NonNullable<DnsStatus["canonical"]>;
    verification: SearchConsoleTxtStatus;
    expectedWwwMode: ExpectedWwwMode;
  },
): string[] {
  const actions: string[] = [];
  if (status === "ready") {
    actions.push("Review the observed DNS evidence and keep provider-side changes outside ShipReady.");
  }
  if (status === "blocked") {
    actions.push("Review the required host records with your DNS provider or registrar outside ShipReady.");
  }
  if (status === "unknown") {
    actions.push("Repeat the read-only check later or from another network if resolver evidence stayed inconclusive.");
  }
  if (input.canonical.status === "mismatch") {
    actions.push("Review application redirects or canonical host settings outside the DNS readiness command.");
  }
  if (input.verification.status === "missing") {
    actions.push("If Search Console verification is intended, review the DNS TXT record in the provider console outside ShipReady.");
  }
  if (input.expectedWwwMode !== "either") {
    actions.push(`Expected www mode was ${input.expectedWwwMode}; compare that with the launch host plan.`);
  }
  return actions.length > 0 ? actions : ["Review inconclusive DNS evidence before launch-sensitive decisions."];
}

function redactTxtValue(value: string, expectedSearchConsoleTxt: string | undefined): string {
  let redacted = expectedSearchConsoleTxt
    ? value.split(expectedSearchConsoleTxt).join("<redacted>")
    : value;
  redacted = redacted.replace(/(google-site-verification=)[^\s"']+/ig, "$1<redacted>");
  return redacted;
}

function redactUrlForOutput(value: string): string {
  const parsed = new URL(value);
  parsed.search = "";
  parsed.hash = "";
  return parsed.toString();
}
