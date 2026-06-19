import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { checkMetadata } from "../src/audit/checkMetadata";
import { compareMetadata } from "../src/audit/compareMetadata";
import { extractMetadata } from "../src/audit/extractMetadata";
import type { AuditResources } from "../src/types/audit";

const baseUrl = "https://example.com/";

function fixture(name: string): string {
  return readFileSync(join(import.meta.dirname, "fixtures", name), "utf8");
}

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

describe("checkMetadata", () => {
  it("detects missing meta description", () => {
    const raw = extractMetadata(fixture("missing-description.html"), {
      source: "raw",
      url: baseUrl,
    });
    const rendered = raw;
    const checks = checkMetadata({
      url: baseUrl,
      finalUrl: baseUrl,
      httpStatus: 200,
      raw,
      rendered,
      comparison: compareMetadata(raw, rendered),
      resources,
    });

    expect(checks.some((check) => check.id === "metadata.description.missing" && check.severity === "critical")).toBe(true);
  });

  it("detects invalid JSON-LD", () => {
    const raw = extractMetadata(fixture("invalid-jsonld.html"), {
      source: "raw",
      url: baseUrl,
    });
    const rendered = raw;
    const checks = checkMetadata({
      url: baseUrl,
      finalUrl: baseUrl,
      httpStatus: 200,
      raw,
      rendered,
      comparison: compareMetadata(raw, rendered),
      resources,
    });

    expect(checks.some((check) => check.id === "schema.jsonld.invalid_json" && check.severity === "critical")).toBe(true);
  });

  it("reports complete social metadata and theme color as passed checks", () => {
    const raw = extractMetadata(fixture("complete-head.html"), {
      source: "raw",
      url: baseUrl,
    });
    const rendered = raw;
    const checks = checkMetadata({
      url: baseUrl,
      finalUrl: baseUrl,
      httpStatus: 200,
      raw,
      rendered,
      comparison: compareMetadata(raw, rendered),
      resources,
    });

    expect(checks.some((check) => check.id === "metadata.theme_color.present" && check.severity === "passed")).toBe(true);
    expect(checks.some((check) => check.id === "social.og.url_present" && check.severity === "passed")).toBe(true);
    expect(checks.some((check) => check.id === "social.og.type_present" && check.severity === "passed")).toBe(true);
    expect(checks.some((check) => check.id === "social.og.site_name_present" && check.severity === "passed")).toBe(true);
    expect(checks.some((check) => check.id === "social.twitter.title_present" && check.severity === "passed")).toBe(true);
    expect(checks.some((check) => check.id === "social.twitter.description_present" && check.severity === "passed")).toBe(true);
    expect(checks.some((check) => check.id === "social.twitter.image_present" && check.severity === "passed")).toBe(true);
  });

  it("reports successful non-sitemap responses as invalid sitemap warnings", () => {
    const raw = extractMetadata(fixture("complete-head.html"), {
      source: "raw",
      url: baseUrl,
    });
    const checks = checkMetadata({
      url: baseUrl,
      finalUrl: baseUrl,
      httpStatus: 200,
      raw,
      rendered: raw,
      comparison: compareMetadata(raw, raw),
      resources: {
        ...resources,
        sitemapXml: {
          url: "https://example.com/sitemap.xml",
          exists: false,
          ok: false,
          statusCode: 200,
          includesAuditedUrl: false,
          error: "Response did not look like an XML sitemap.",
        },
      },
    });

    expect(checks.some((check) => check.id === "crawl.sitemap.invalid" && check.severity === "warning")).toBe(true);
    expect(checks.some((check) => check.id === "crawl.sitemap.found")).toBe(false);
  });
});
