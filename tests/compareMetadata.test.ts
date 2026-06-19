import { describe, expect, it } from "vitest";
import { compareMetadata } from "../src/audit/compareMetadata";
import type { ExtractedPageMetadata } from "../src/types/audit";

describe("compareMetadata", () => {
  it("classifies raw vs rendered metadata statuses", () => {
    const raw = snapshot({
      title: "Example",
      canonical: "https://example.com/",
    });
    const rendered = snapshot({
      title: "Example",
      description: "Launch your product faster with complete metadata.",
      canonical: "https://www.example.com/",
    });

    const comparison = compareMetadata(raw, rendered);

    expect(comparison.fields.find((field) => field.field === "title")?.status).toBe("present_in_raw");
    expect(comparison.fields.find((field) => field.field === "description")?.status).toBe("present_after_render_only");
    expect(comparison.fields.find((field) => field.field === "canonical")?.status).toBe("changed_after_render");
    expect(comparison.fields.find((field) => field.field === "og:image")?.status).toBe("missing_in_both");
  });
});

function snapshot(metadata: Partial<ExtractedPageMetadata["metadata"]>): ExtractedPageMetadata {
  return {
    source: "raw",
    url: "https://example.com/",
    metadata: {
      faviconLinks: [],
      openGraph: {},
      twitter: {},
      ...metadata,
    },
    headings: { h1: [], all: [] },
    images: { total: 0, missingAlt: 0, items: [] },
    links: { total: 0, missingAccessibleText: 0, items: [] },
    jsonLd: [],
  };
}

