import { describe, expect, it, vi } from "vitest";
import {
  formatDnsStatusHuman,
  formatDnsStatusJson,
  getDnsStatus,
} from "../src/dns/dnsStatus";
import { DNS_MOCK_CHECKED_AT } from "../src/dns/mockDnsResolver";
import { DNS_MOCK_SCENARIOS } from "../src/dns/dnsTypes";
import { DnsStatusJsonContractSchema } from "../src/types/contracts";

describe("DNS status", () => {
  it.each(DNS_MOCK_SCENARIOS)("returns valid deterministic mock scenario %s", async (scenario) => {
    const first = await getDnsStatus({
      url: "https://example.com/path?secret=value#fragment",
      mock: scenario,
      expectedSearchConsoleTxt: scenario.startsWith("txt-") ? "redacted-example-token" : undefined,
      expectedCanonicalHost: scenario === "canonical-mismatch" ? "example.com" : undefined,
      expectedWwwMode: scenario === "cname-chain-issue" ? "www" : undefined,
    });
    const second = await getDnsStatus({
      url: "https://example.com/path?secret=value#fragment",
      mock: scenario,
      expectedSearchConsoleTxt: scenario.startsWith("txt-") ? "redacted-example-token" : undefined,
      expectedCanonicalHost: scenario === "canonical-mismatch" ? "example.com" : undefined,
      expectedWwwMode: scenario === "cname-chain-issue" ? "www" : undefined,
    });

    expect(DnsStatusJsonContractSchema.parse(first)).toEqual(second);
    expect(first.mode).toBe("mock");
    expect(first.checkedAt).toBe(DNS_MOCK_CHECKED_AT);
    expect(first.url).toBe("https://example.com/path");
    expect(JSON.stringify(first)).not.toContain("secret=value");
    expect(JSON.stringify(first)).not.toMatch(/access[_-]?token|refresh[_-]?token|client[_-]?secret/i);
  });

  it("classifies ready, nxdomain, nodata, and timeout scenarios conservatively", async () => {
    const ready = await getDnsStatus({ url: "https://example.com", mock: "ready" });
    const nxdomain = await getDnsStatus({ url: "https://example.com", mock: "nxdomain" });
    const nodata = await getDnsStatus({ url: "https://example.com", mock: "nodata" });
    const timeout = await getDnsStatus({ url: "https://example.com", mock: "timeout" });

    expect(ready.verdict.status).toBe("ready");
    expect(nxdomain).toMatchObject({ verdict: { status: "blocked" } });
    expect(nodata).toMatchObject({ verdict: { status: "blocked" } });
    expect(timeout).toMatchObject({ verdict: { status: "unknown" } });
  });

  it("reports TXT found and missing without exposing the expected token", async () => {
    const found = await getDnsStatus({
      url: "https://example.com",
      mock: "txt-found",
      expectedSearchConsoleTxt: "redacted-example-token",
    });
    const missing = await getDnsStatus({
      url: "https://example.com",
      mock: "txt-missing",
      expectedSearchConsoleTxt: "redacted-example-token",
    });

    expect(found.verification?.searchConsoleTxt?.status).toBe("found");
    expect(missing.verification?.searchConsoleTxt?.status).toBe("missing");
    expect(missing.verdict.status).toBe("needs_attention");
    expect(JSON.stringify([found, missing])).not.toContain("redacted-example-token");
    expect(JSON.stringify([found, missing])).toContain("google-site-verification=<redacted>");
  });

  it("surfaces CNAME chain issues, CAA records, and canonical mismatches", async () => {
    const cname = await getDnsStatus({
      url: "https://example.com",
      mock: "cname-chain-issue",
      expectedWwwMode: "www",
    });
    const caa = await getDnsStatus({ url: "https://example.com", mock: "caa-present" });
    const canonical = await getDnsStatus({
      url: "https://example.com",
      mock: "canonical-mismatch",
      expectedCanonicalHost: "example.com",
    });

    expect(cname.hosts.flatMap((host) => host.cnameChain ?? [])).toEqual([
      expect.objectContaining({ status: "target_missing" }),
      expect.objectContaining({ status: "target_missing" }),
    ]);
    expect(cname.verdict.status).toBe("blocked");
    expect(caa.caa?.status).toBe("present");
    expect(canonical).toMatchObject({
      canonical: { status: "mismatch", observedFinalUrl: "https://www.example.com/" },
      verdict: { status: "needs_attention" },
    });
  });

  it("does not use live fetch for ordinary DNS-only mock checks", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network forbidden"));
    try {
      const status = await getDnsStatus({ url: "https://example.com", mock: "ready" });
      expect(status.verdict.status).toBe("ready");
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it("formats concise human and stable JSON output", async () => {
    const status = await getDnsStatus({ url: "https://example.com", mock: "ready" });
    expect(formatDnsStatusHuman(status)).toContain("DNS readiness");
    expect(DnsStatusJsonContractSchema.parse(JSON.parse(formatDnsStatusJson(status)))).toEqual(status);
  });

  it("rejects unsupported scenarios and modes cleanly", async () => {
    await expect(getDnsStatus({ url: "https://example.com", mock: "provider-write" }))
      .rejects.toMatchObject({ code: "invalid_mode" });
    await expect(getDnsStatus({ url: "https://example.com", expectedWwwMode: "both" }))
      .rejects.toMatchObject({ code: "invalid_mode" });
  });
});
