import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { extractMetadata } from "../src/audit/extractMetadata";

const baseUrl = "https://example.com/";

function fixture(name: string): string {
  return readFileSync(join(import.meta.dirname, "fixtures", name), "utf8");
}

describe("extractMetadata", () => {
  it("extracts static page metadata", () => {
    const result = extractMetadata(fixture("complete-head.html"), {
      source: "raw",
      url: baseUrl,
    });

    expect(result.metadata.htmlLang).toBe("en");
    expect(result.metadata.title).toBe("ShipReady Launch Checklist");
    expect(result.metadata.description).toContain("metadata correctness");
    expect(result.metadata.viewport).toBe("width=device-width, initial-scale=1");
    expect(result.metadata.canonical).toBe("https://example.com/");
    expect(result.metadata.faviconLinks).toEqual(["https://example.com/favicon.ico"]);
    expect(result.metadata.themeColor).toBe("#111111");
  });

  it("extracts Open Graph metadata", () => {
    const result = extractMetadata(fixture("complete-head.html"), {
      source: "raw",
      url: baseUrl,
    });

    expect(result.metadata.openGraph).toMatchObject({
      title: "ShipReady Launch Checklist",
      description: "Audit generated websites before launch.",
      image: "https://example.com/og.png",
      url: "https://example.com/",
      type: "website",
      siteName: "ShipReady",
    });
  });

  it("extracts Twitter card metadata", () => {
    const result = extractMetadata(fixture("complete-head.html"), {
      source: "raw",
      url: baseUrl,
    });

    expect(result.metadata.twitter).toMatchObject({
      card: "summary_large_image",
      title: "ShipReady Launch Checklist",
      description: "Audit generated websites before launch.",
      image: "https://example.com/og.png",
    });
  });

  it("parses valid JSON-LD", () => {
    const result = extractMetadata(fixture("complete-head.html"), {
      source: "raw",
      url: baseUrl,
    });

    expect(result.jsonLd).toHaveLength(1);
    expect(result.jsonLd[0]?.valid).toBe(true);
    expect(result.jsonLd[0]?.types).toEqual(["WebSite"]);
  });

  it("reports invalid JSON-LD parse failures", () => {
    const result = extractMetadata(fixture("invalid-jsonld.html"), {
      source: "raw",
      url: baseUrl,
    });

    expect(result.jsonLd).toHaveLength(1);
    expect(result.jsonLd[0]?.valid).toBe(false);
    expect(result.jsonLd[0]?.error).toBeTruthy();
  });

  it("detects H1 count and text values", () => {
    const result = extractMetadata(fixture("multiple-h1.html"), {
      source: "raw",
      url: baseUrl,
    });

    expect(result.headings.h1).toEqual(["Home", "Launch faster"]);
    expect(result.headings.all).toHaveLength(2);
  });
});

