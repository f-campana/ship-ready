import { execFile } from "node:child_process";
import { join } from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import {
  CliErrorContractSchema,
  SearchConsoleStatusJsonContractSchema,
} from "../src/types/contracts";

const execFileAsync = promisify(execFile);
const root = join(import.meta.dirname, "..");
const tsx = join(root, "node_modules", ".bin", "tsx");

describe("search-console status CLI", () => {
  it("returns safe human output without an explicit mock scenario", async () => {
    const { stdout, stderr } = await run(["search-console", "status", "--url", "https://example.com"]);
    expect(stderr).toBe("");
    expect(stdout).toContain("Search Console status");
    expect(stdout).toContain("live integration is not configured");
    expect(stdout).toContain("mock-backed");
  });

  it("returns the stable JSON contract by default", async () => {
    const { stdout, stderr } = await run(["search-console", "status", "--url", "https://example.com", "--json"]);
    expect(stderr).toBe("");
    expect(SearchConsoleStatusJsonContractSchema.parse(JSON.parse(stdout))).toMatchObject({
      contract: "shipready.searchConsoleStatus.v1",
      mode: "mock",
      authorization: { status: "not_configured" },
    });
  });

  it("supports sitemap and opt-in inspection scenarios", async () => {
    const sitemap = await run([
      "search-console", "status", "--url", "https://example.com", "--mock", "ready_sitemap_ok", "--json",
    ]);
    const inspection = await run([
      "search-console", "status", "--url", "https://example.com", "--provider", "mock",
      "--mock", "inspection_canonical_mismatch", "--inspect", "--json",
    ]);
    expect(SearchConsoleStatusJsonContractSchema.parse(JSON.parse(sitemap.stdout)).sitemaps.status).toBe("available");
    expect(SearchConsoleStatusJsonContractSchema.parse(JSON.parse(inspection.stdout)).inspection.status).toBe("available");
  });

  it.each([
    [["search-console", "status", "--url", "not-a-url", "--json"], "invalid_url"],
    [["search-console", "status", "--url", "https://example.com", "--mock", "missing", "--json"], "invalid_mode"],
    [["search-console", "status", "--url", "https://example.com", "--provider", "google", "--json"], "invalid_mode"],
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
