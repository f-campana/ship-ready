import { describe, expect, it } from "vitest";
import { formatSocialPreviewHuman, formatSocialPreviewJson } from "../src/report/formatSocialPreviewReport";
import { getSocialPreview } from "../src/socialPreview/socialPreview";
import { SocialPreviewJsonContractSchema, type SocialPreviewJsonContract } from "../src/types/contracts";

describe("social preview simulator", () => {
  it("classifies the complete mock scenario as ready", async () => {
    const result = await getSocialPreview({
      url: "https://example.com",
      mock: "complete",
    });

    expect(SocialPreviewJsonContractSchema.parse(result)).toMatchObject({
      contract: "shipready.socialPreview.v1",
      mode: "mock",
      sourceMode: "both",
      verdict: { status: "ready" },
      image: { assetStatus: "reachable" },
    });
    expect(result.warnings).toEqual([]);
  });

  it("flags missing image and missing description scenarios", async () => {
    const missingImage = await getSocialPreview({
      url: "https://example.com",
      mock: "missing-image",
    });
    const missingDescription = await getSocialPreview({
      url: "https://example.com",
      mock: "missing-description",
    });

    expect(missingImage.verdict.status).toBe("needs_attention");
    expect(missingImage.previews.generic_social.fields.image?.status).toBe("missing");
    expect(missingImage.warnings.join("\n")).toContain("No image URL");
    expect(missingDescription.verdict.status).toBe("needs_attention");
    expect(missingDescription.previews.google_search.fields.description.status).toBe("missing");
  });

  it("warns when Twitter fields fall back to Open Graph metadata", async () => {
    const result = await getSocialPreview({
      url: "https://example.com",
      mock: "twitter-fallback",
    });

    expect(result.previews.x_twitter.fields.title.status).toBe("fallback");
    expect(result.previews.x_twitter.warnings.join("\n")).toContain("uses a fallback");
  });

  it("represents rendered-only metadata and raw-rendered differences", async () => {
    const renderedOnly = await getSocialPreview({
      url: "https://example.com",
      mock: "rendered-only-metadata",
      source: "both",
    });
    const different = await getSocialPreview({
      url: "https://example.com",
      mock: "raw-rendered-different",
    });

    expect(renderedOnly.warnings.join("\n")).toContain("appears only after rendering");
    expect(renderedOnly.comparison.rawVsRendered).toEqual(
      expect.arrayContaining([expect.objectContaining({
        field: "og:title",
        status: "present_after_render_only",
      })]),
    );
    expect(different.comparison.rawVsRendered).toEqual(
      expect.arrayContaining([expect.objectContaining({
        field: "title",
        status: "changed_after_render",
      })]),
    );
  });

  it("truncates long human values while JSON preserves full values", async () => {
    const result = await getSocialPreview({
      url: "https://example.com",
      mock: "complete",
    });
    const longTitle = "A".repeat(180);
    const modified: SocialPreviewJsonContract = {
      ...result,
      previews: {
        ...result.previews,
        google_search: {
          ...result.previews.google_search,
          fields: {
            ...result.previews.google_search.fields,
            title: {
              ...result.previews.google_search.fields.title,
              value: longTitle,
            },
          },
        },
      },
    };

    const human = formatSocialPreviewHuman(modified);
    const json = formatSocialPreviewJson(modified);

    expect(human).toContain(`${"A".repeat(93)}...`);
    expect(human).not.toContain(longTitle);
    expect(json).toContain(longTitle);
  });
});
