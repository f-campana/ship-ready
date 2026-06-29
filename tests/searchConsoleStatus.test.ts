import { describe, expect, it, vi } from "vitest";
import {
  formatSearchConsoleStatusHuman,
  formatSearchConsoleStatusJson,
  getSearchConsoleStatus,
} from "../src/searchConsole/searchConsoleStatus";
import { SEARCH_CONSOLE_MOCK_SCENARIOS } from "../src/searchConsole/searchConsoleTypes";
import { SearchConsoleStatusJsonContractSchema } from "../src/types/contracts";

describe("Search Console mock status provider", () => {
  it.each(SEARCH_CONSOLE_MOCK_SCENARIOS)("returns valid deterministic scenario %s", async (scenario) => {
    const first = await getSearchConsoleStatus({
      url: "https://example.com/path#fragment",
      mock: scenario,
      inspect: scenario.startsWith("inspection_"),
    });
    const second = await getSearchConsoleStatus({
      url: "https://example.com/path#fragment",
      mock: scenario,
      inspect: scenario.startsWith("inspection_"),
    });

    expect(SearchConsoleStatusJsonContractSchema.parse(first)).toEqual(second);
    expect(first.mode).toBe("mock");
    expect(first.requestedUrl).toBe("https://example.com/path");
    expect(JSON.stringify(first)).not.toMatch(/access[_-]?token|refresh[_-]?token|client[_-]?secret/i);
  });

  it("defaults safely to not_configured and makes no network request", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network forbidden"));
    try {
      const status = await getSearchConsoleStatus({ url: "https://example.com" });
      expect(status.authorization.status).toBe("not_configured");
      expect(status.propertyMatch.status).toBe("not_checked");
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it("only includes mock inspection evidence after explicit --inspect intent", async () => {
    const omitted = await getSearchConsoleStatus({
      url: "https://example.com",
      mock: "inspection_canonical_mismatch",
    });
    const included = await getSearchConsoleStatus({
      url: "https://example.com",
      mock: "inspection_canonical_mismatch",
      inspect: true,
    });

    expect(omitted.inspection).toEqual({ requested: false, status: "not_requested", source: "google_index" });
    expect(included.inspection).toMatchObject({
      requested: true,
      status: "available",
      result: {
        userCanonical: "https://example.com/",
        googleCanonical: "https://example.com/canonical/",
      },
    });
  });

  it("formats concise human and stable JSON output", async () => {
    const status = await getSearchConsoleStatus({ url: "https://example.com" });
    expect(formatSearchConsoleStatusHuman(status)).toContain("This prototype is mock-backed.");
    expect(SearchConsoleStatusJsonContractSchema.parse(JSON.parse(formatSearchConsoleStatusJson(status)))).toEqual(status);
  });

  it("rejects unsupported scenarios cleanly", async () => {
    await expect(getSearchConsoleStatus({
      url: "https://example.com",
      mock: "live_google",
    })).rejects.toMatchObject({ code: "invalid_mode" });
  });

  it("rejects deprecated sitemap fields and secret-bearing contract additions", async () => {
    const status = await getSearchConsoleStatus({
      url: "https://example.com",
      mock: "ready_sitemap_ok",
    });
    const deprecated = structuredClone(status) as unknown as Record<string, any>;
    deprecated.sitemaps.entries[0].contents[0].indexed = 12;
    const secretBearing = { ...status, accessToken: "not-allowed" };
    expect(SearchConsoleStatusJsonContractSchema.safeParse(deprecated).success).toBe(false);
    expect(SearchConsoleStatusJsonContractSchema.safeParse(secretBearing).success).toBe(false);
  });
});
