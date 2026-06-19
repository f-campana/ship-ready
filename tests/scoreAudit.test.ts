import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { compareMetadata } from "../src/audit/compareMetadata";
import { extractMetadata } from "../src/audit/extractMetadata";
import { scoreAudit } from "../src/audit/scoreAudit";
import type { AuditResources } from "../src/types/audit";

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

describe("scoreAudit", () => {
  it("returns 100 for a complete fixture", () => {
    const raw = extractMetadata(fixture("complete-head.html"), {
      source: "raw",
      url: baseUrl,
    });
    const rendered = raw;

    expect(scoreAudit({ raw, rendered, comparison: compareMetadata(raw, rendered), resources })).toBe(100);
  });

  it("penalizes missing description deterministically", () => {
    const raw = extractMetadata(fixture("missing-description.html"), {
      source: "raw",
      url: baseUrl,
    });
    const rendered = raw;

    const score = scoreAudit({ raw, rendered, comparison: compareMetadata(raw, rendered), resources });

    expect(score).toBeLessThan(100);
    expect(score).toBeGreaterThanOrEqual(0);
  });
});

