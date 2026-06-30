import { execFile } from "node:child_process";
import { join } from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import {
  CliErrorContractSchema,
  DnsStatusJsonContractSchema,
} from "../src/types/contracts";

const execFileAsync = promisify(execFile);
const root = join(import.meta.dirname, "..");
const tsx = join(root, "node_modules", ".bin", "tsx");

describe("dns status CLI", () => {
  it("returns safe human output for a deterministic mock scenario", async () => {
    const { stdout, stderr } = await run(["dns", "status", "--url", "https://example.com", "--mock", "ready"]);
    expect(stderr).toBe("");
    expect(stdout).toContain("DNS readiness");
    expect(stdout).toContain("Mode: mock (read-only)");
    expect(stdout).toContain("provider API");
  });

  it("returns the stable JSON contract with mock ready", async () => {
    const { stdout, stderr } = await run([
      "dns", "status", "--url", "https://example.com", "--mock", "ready", "--json",
    ]);
    const status = DnsStatusJsonContractSchema.parse(JSON.parse(stdout));
    expect(stderr).toBe("");
    expect(status).toMatchObject({
      contract: "shipready.dnsStatus.v1",
      mode: "mock",
      verdict: { status: "ready" },
    });
  });

  it("supports blocked and TXT verification mock scenarios without token leakage", async () => {
    const nxdomain = await run([
      "dns", "status", "--url", "https://example.com", "--mock", "nxdomain", "--json",
    ]);
    const txt = await run([
      "dns", "status", "--url", "https://example.com", "--mock", "txt-found",
      "--expected-search-console-txt", "redacted-example-token", "--json",
    ]);

    expect(DnsStatusJsonContractSchema.parse(JSON.parse(nxdomain.stdout)).verdict.status).toBe("blocked");
    expect(DnsStatusJsonContractSchema.parse(JSON.parse(txt.stdout)).verification?.searchConsoleTxt?.status).toBe("found");
    expect(txt.stdout).not.toContain("redacted-example-token");
    expect(txt.stdout).toContain("google-site-verification=<redacted>");
  });

  it("omits URL query strings from structured output", async () => {
    const { stdout } = await run([
      "dns", "status", "--url", "https://example.com/path?secret=value", "--mock", "ready", "--json",
    ]);
    const status = DnsStatusJsonContractSchema.parse(JSON.parse(stdout));
    expect(status.url).toBe("https://example.com/path");
    expect(stdout).not.toContain("secret=value");
  });

  it.each([
    [["dns", "status", "--url", "not-a-url", "--mock", "ready", "--json"], "invalid_url"],
    [["dns", "status", "--url", "https://example.com", "--mock", "missing", "--json"], "invalid_mode"],
    [["dns", "status", "--url", "https://example.com", "--expected-www-mode", "both", "--json"], "invalid_mode"],
  ] as const)("returns shipready.error.v1 for rejected input", async (args, code) => {
    try {
      await run([...args]);
      throw new Error("Expected command to fail.");
    } catch (error) {
      const failure = error as { code?: number; stdout?: string; stderr?: string };
      expect(failure.code).toBe(1);
      expect(failure.stderr).toBe("");
      expect(CliErrorContractSchema.parse(JSON.parse(failure.stdout ?? ""))).toMatchObject({ code });
    }
  });
});

function run(args: string[]) {
  return execFileAsync(tsx, [join(root, "src/cli/index.ts"), ...args], {
    cwd: root,
    timeout: 10_000,
  });
}
