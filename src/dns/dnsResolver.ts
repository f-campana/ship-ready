import * as dns from "node:dns/promises";
import type { DnsCaaRecord, DnsResolver } from "./dnsTypes";

export const DEFAULT_DNS_TIMEOUT_MS = 5_000;

type NodeCaaRecord = {
  critical: number;
  issue?: string;
  issuewild?: string;
  iodef?: string;
  contactemail?: string;
  contactphone?: string;
};

export function createLiveDnsResolver(timeoutMs = DEFAULT_DNS_TIMEOUT_MS): DnsResolver {
  return {
    resolveA: (host) => withDnsTimeout(dns.resolve4(host), timeoutMs),
    resolveAAAA: (host) => withDnsTimeout(dns.resolve6(host), timeoutMs),
    resolveCNAME: (host) => withDnsTimeout(dns.resolveCname(host), timeoutMs),
    resolveNS: (host) => withDnsTimeout(dns.resolveNs(host), timeoutMs),
    resolveTXT: (host) => withDnsTimeout(dns.resolveTxt(host), timeoutMs),
    resolveCAA: async (host) => {
      const records = await withDnsTimeout(dns.resolveCaa(host), timeoutMs);
      return records.map(normalizeCaaRecord);
    },
  };
}

function normalizeCaaRecord(record: NodeCaaRecord): DnsCaaRecord {
  for (const tag of ["issue", "issuewild", "iodef", "contactemail", "contactphone"] as const) {
    const value = record[tag];
    if (value) return { flags: record.critical, tag, value };
  }
  return { flags: record.critical };
}

async function withDnsTimeout<T>(operation: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        const error = new Error("DNS query timed out.");
        Object.assign(error, { code: "ETIMEOUT" });
        reject(error);
      }, timeoutMs);
    });
    return await Promise.race([operation, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
