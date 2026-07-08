import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { checkMetadata } from "../src/audit/checkMetadata";
import { compareMetadata } from "../src/audit/compareMetadata";
import { extractMetadata } from "../src/audit/extractMetadata";
import { formatHumanReport } from "../src/report/formatHumanReport";
import type { AuditResources, AuditResult } from "../src/types/audit";

const baseUrl = "https://example.com/";

const resources: AuditResources = {
  robotsTxt: {
    url: "https://example.com/robots.txt",
    exists: true,
    ok: true,
    statusCode: 200,
    blocksPage: false,
  },
  sitemapXml: {
    url: "https://example.com/sitemap.xml",
    exists: true,
    ok: true,
    statusCode: 200,
    includesAuditedUrl: true,
  },
};

function fixture(name: string): string {
  return readFileSync(join(import.meta.dirname, "fixtures", name), "utf8");
}

describe("formatHumanReport", () => {
  it("does not recommend metadata fixes for a clean audit", () => {
    const raw = extractMetadata(fixture("complete-head.html"), {
      source: "raw",
      url: baseUrl,
    });
    const rendered = raw;
    const comparison = compareMetadata(raw, rendered);
    const checks = checkMetadata({
      url: baseUrl,
      finalUrl: baseUrl,
      httpStatus: 200,
      raw,
      rendered,
      comparison,
      resources,
    });

    const result: AuditResult = {
      url: baseUrl,
      finalUrl: baseUrl,
      auditedAt: "2026-06-14T00:00:00.000Z",
      httpStatus: 200,
      score: 100,
      status: "good",
      raw,
      rendered,
      comparison,
      checks,
      resources,
    };

    const report = formatHumanReport(result);

    expect(report).toContain("ShipReady audit");
    expect(report).toContain(`Target: ${baseUrl}`);
    expect(report).toContain("Status: Ready");
    expect(report).toContain("Next: No immediate metadata or crawlability action is needed.");
    expect(report).toContain("No immediate metadata or crawlability action is needed.");
    expect(report).not.toContain("Fix missing or render-only metadata");
    expect(report).toContain("Passed checks");
    expect(report).toContain("Remaining passed checks are available with --json.");
    expect(report).toContain("- robots meta: raw/rendered=index,follow");
    expect(report).toContain("- theme-color: raw/rendered=#111111");
    expect(report).toContain("More: Run with --json for full contract output.");
  });

  it("truncates long raw and rendered values in terminal output", () => {
    const raw = extractMetadata(fixture("complete-head.html"), {
      source: "raw",
      url: baseUrl,
    });
    const rendered = raw;
    const comparison = compareMetadata(raw, rendered);
    const checks = checkMetadata({
      url: baseUrl,
      finalUrl: baseUrl,
      httpStatus: 200,
      raw,
      rendered,
      comparison,
      resources,
    });
    const longTitle = "Launch readiness ".repeat(12);

    const result: AuditResult = {
      url: baseUrl,
      finalUrl: baseUrl,
      auditedAt: "2026-06-14T00:00:00.000Z",
      httpStatus: 200,
      score: 100,
      status: "good",
      raw,
      rendered,
      comparison: {
        fields: comparison.fields.map((field) =>
          field.field === "title"
            ? {
                field: "title",
                rawValue: longTitle,
                renderedValue: longTitle,
                status: "present_in_raw",
              }
            : field),
      },
      checks,
      resources,
    };

    const report = formatHumanReport(result);

    expect(report).toContain("- title: raw/rendered=Launch readiness Launch readiness Launch readiness Launch readiness Launch readiness ...");
    expect(report).not.toContain(longTitle);
  });
});
