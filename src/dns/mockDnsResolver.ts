import { DnsStatusError } from "./dnsErrors";
import {
  DNS_MOCK_SCENARIOS,
  type DnsCaaRecord,
  type DnsMockScenario,
  type DnsResolver,
} from "./dnsTypes";

type MockRecords = {
  a?: string[];
  aaaa?: string[];
  cname?: string[];
  ns?: string[];
  txt?: string[][];
  caa?: DnsCaaRecord[];
};

type MockZone = Record<string, MockRecords>;

export const DNS_MOCK_CHECKED_AT = "2026-06-30T12:00:00.000Z";

export function parseDnsMockScenario(value: string): DnsMockScenario {
  if ((DNS_MOCK_SCENARIOS as readonly string[]).includes(value)) {
    return value as DnsMockScenario;
  }
  throw new DnsStatusError(
    "invalid_mode",
    `Unsupported DNS mock scenario: ${value}. Use one of: ${DNS_MOCK_SCENARIOS.join(", ")}.`,
  );
}

export function createMockDnsResolver(
  scenario: DnsMockScenario,
  domain: string,
  expectedSearchConsoleTxt?: string,
): DnsResolver {
  const zone = createMockZone(scenario, domain, expectedSearchConsoleTxt);

  return {
    resolveA: (host) => readRecords(zone, scenario, host, "a"),
    resolveAAAA: (host) => readRecords(zone, scenario, host, "aaaa"),
    resolveCNAME: (host) => readRecords(zone, scenario, host, "cname"),
    resolveNS: (host) => readRecords(zone, scenario, host, "ns"),
    resolveTXT: (host) => readRecords(zone, scenario, host, "txt"),
    resolveCAA: (host) => readRecords(zone, scenario, host, "caa"),
  };
}

function createMockZone(
  scenario: DnsMockScenario,
  domain: string,
  expectedSearchConsoleTxt: string | undefined,
): MockZone {
  const apex = domain;
  const www = `www.${domain}`;
  const target = `hosting.${domain}`;
  const token = expectedSearchConsoleTxt ?? "mock-search-console-token";
  const base: MockZone = {
    [apex]: {
      a: ["203.0.113.10"],
      aaaa: ["2001:db8::10"],
      ns: [`ns1.${domain}`, `ns2.${domain}`],
    },
    [www]: {
      cname: [target],
      a: ["203.0.113.10"],
      aaaa: ["2001:db8::10"],
    },
    [target]: {
      a: ["203.0.113.10"],
      aaaa: ["2001:db8::10"],
    },
  };

  if (scenario === "apex-ok-www-missing") {
    return { [apex]: base[apex]! };
  }

  if (scenario === "www-cname-ok") {
    return base;
  }

  if (scenario === "nodata") {
    return {
      [apex]: { ns: base[apex]!.ns },
      [www]: {},
    };
  }

  if (scenario === "cname-chain-issue") {
    return {
      [apex]: {
        cname: [`missing.${domain}`],
        ns: base[apex]!.ns,
      },
      [www]: {
        cname: [`missing.${domain}`],
      },
    };
  }

  if (scenario === "caa-present") {
    return {
      ...base,
      [apex]: {
        ...base[apex]!,
        caa: [{ flags: 0, tag: "issue", value: "letsencrypt.org" }],
      },
    };
  }

  if (scenario === "txt-found") {
    return {
      ...base,
      [apex]: {
        ...base[apex]!,
        txt: [[`google-site-verification=${token}`]],
      },
    };
  }

  if (scenario === "txt-missing") {
    return {
      ...base,
      [apex]: {
        ...base[apex]!,
        txt: [["google-site-verification=other-token"]],
      },
    };
  }

  return base;
}

async function readRecords<K extends keyof MockRecords>(
  zone: MockZone,
  scenario: DnsMockScenario,
  host: string,
  key: K,
): Promise<NonNullable<MockRecords[K]>> {
  if (scenario === "timeout") throw dnsError("ETIMEOUT");
  if (scenario === "nxdomain") throw dnsError("ENOTFOUND");

  const records = zone[host.toLowerCase()]?.[key];
  if (!records || records.length === 0) throw dnsError("ENODATA");
  return records as NonNullable<MockRecords[K]>;
}

function dnsError(code: string): Error {
  const error = new Error(code);
  Object.assign(error, { code });
  return error;
}
