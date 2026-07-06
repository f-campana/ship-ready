import { compareMetadata } from "../audit/compareMetadata";
import {
  AuditResultSchema,
  type AuditResult,
  type ExtractedPageMetadata,
  type PageMetadata,
} from "../types/audit";
import { resolveMaybeUrl } from "../utils/url";
import {
  SOCIAL_PREVIEW_MOCK_SCENARIOS,
  SocialPreviewError,
  type SocialPreviewMockScenario,
} from "./socialPreviewTypes";

export const SOCIAL_PREVIEW_MOCK_CHECKED_AT = "2026-07-06T12:00:00.000Z";

export type SocialPreviewMockAudit = {
  audit: AuditResult;
  checkedAt: string;
  imageAssetStatus?: "not_checked" | "reachable" | "unreachable" | "unknown";
};

export function parseSocialPreviewMockScenario(value: string): SocialPreviewMockScenario {
  if ((SOCIAL_PREVIEW_MOCK_SCENARIOS as readonly string[]).includes(value)) {
    return value as SocialPreviewMockScenario;
  }
  throw new SocialPreviewError(
    "invalid_mode",
    `Unsupported social preview mock scenario: ${value}. Use one of: ${SOCIAL_PREVIEW_MOCK_SCENARIOS.join(", ")}.`,
  );
}

export function createMockSocialPreviewAudit(
  scenario: SocialPreviewMockScenario,
  url: string,
): SocialPreviewMockAudit {
  const completeDescription = "A complete deterministic preview description for sharing.";
  const completeRaw = metadata({
    title: "Complete Launch Page",
    description: completeDescription,
    canonical: url,
    openGraph: {
      title: "Complete Launch Page",
      description: completeDescription,
      url,
      image: "/social-preview.png",
      type: "website",
      siteName: "ShipReady Fixture",
    },
    twitter: {
      card: "summary_large_image",
      title: "Complete Launch Page",
      description: completeDescription,
      image: "/social-preview.png",
    },
  }, url);

  let raw = completeRaw;
  let rendered = completeRaw;
  let imageAssetStatus: SocialPreviewMockAudit["imageAssetStatus"] = "reachable";

  if (scenario === "missing-image") {
    raw = metadata({
      ...completeRaw,
      openGraph: { ...completeRaw.openGraph, image: undefined },
      twitter: { ...completeRaw.twitter, image: undefined },
    }, url);
    rendered = raw;
    imageAssetStatus = "unknown";
  } else if (scenario === "rendered-only-metadata") {
    raw = metadata({
      title: undefined,
      description: undefined,
      canonical: undefined,
      openGraph: {},
      twitter: {},
    }, url);
    rendered = completeRaw;
  } else if (scenario === "twitter-fallback") {
    raw = metadata({
      ...completeRaw,
      twitter: {},
    }, url);
    rendered = raw;
  } else if (scenario === "missing-description") {
    raw = metadata({
      ...completeRaw,
      description: undefined,
      openGraph: { ...completeRaw.openGraph, description: undefined },
      twitter: { ...completeRaw.twitter, description: undefined },
    }, url);
    rendered = raw;
  } else if (scenario === "missing-og-url") {
    raw = metadata({
      ...completeRaw,
      openGraph: { ...completeRaw.openGraph, url: undefined },
    }, url);
    rendered = raw;
  } else if (scenario === "raw-rendered-different") {
    raw = metadata({
      ...completeRaw,
      title: "Raw Launch Page",
      description: "Raw description from the initial HTML.",
      openGraph: {
        ...completeRaw.openGraph,
        title: "Raw OG Title",
        description: "Raw OG description.",
        image: "/raw-social.png",
      },
      twitter: {
        ...completeRaw.twitter,
        title: "Raw Twitter Title",
      },
    }, url);
    rendered = metadata({
      ...completeRaw,
      title: "Rendered Launch Page",
      description: "Rendered description after the app loads.",
      openGraph: {
        ...completeRaw.openGraph,
        title: "Rendered OG Title",
        description: "Rendered OG description.",
        image: "/rendered-social.png",
      },
      twitter: {
        ...completeRaw.twitter,
        title: "Rendered Twitter Title",
      },
    }, url);
  } else if (scenario === "image-unreachable") {
    raw = completeRaw;
    rendered = raw;
    imageAssetStatus = "unreachable";
  } else if (scenario === "minimal-title-only") {
    raw = metadata({
      title: "Minimal Title Only",
      description: undefined,
      canonical: undefined,
      openGraph: {},
      twitter: {},
    }, url);
    rendered = raw;
    imageAssetStatus = "unknown";
  }

  const rawSnapshot = pageSnapshot("raw", url, raw);
  const renderedSnapshot = pageSnapshot("rendered", url, rendered);

  return {
    audit: AuditResultSchema.parse({
      url,
      finalUrl: url,
      auditedAt: SOCIAL_PREVIEW_MOCK_CHECKED_AT,
      httpStatus: 200,
      score: scenario === "complete" ? 100 : 72,
      status: scenario === "complete" ? "good" : "needs_work",
      raw: rawSnapshot,
      rendered: renderedSnapshot,
      comparison: compareMetadata(rawSnapshot, renderedSnapshot),
      checks: [],
      resources: {
        robotsTxt: resource(`${new URL(url).origin}/robots.txt`),
        sitemapXml: resource(`${new URL(url).origin}/sitemap.xml`),
      },
    }),
    checkedAt: SOCIAL_PREVIEW_MOCK_CHECKED_AT,
    imageAssetStatus,
  };
}

function metadata(input: Partial<PageMetadata>, baseUrl: string): PageMetadata {
  return {
    htmlLang: input.htmlLang ?? "en",
    title: input.title,
    description: input.description,
    canonical: input.canonical ? resolveMaybeUrl(input.canonical, baseUrl) : undefined,
    faviconLinks: [],
    openGraph: {
      title: input.openGraph?.title,
      description: input.openGraph?.description,
      url: input.openGraph?.url ? resolveMaybeUrl(input.openGraph.url, baseUrl) : undefined,
      image: input.openGraph?.image ? resolveMaybeUrl(input.openGraph.image, baseUrl) : undefined,
      type: input.openGraph?.type,
      siteName: input.openGraph?.siteName,
    },
    twitter: {
      card: input.twitter?.card,
      title: input.twitter?.title,
      description: input.twitter?.description,
      image: input.twitter?.image ? resolveMaybeUrl(input.twitter.image, baseUrl) : undefined,
    },
  };
}

function pageSnapshot(
  source: "raw" | "rendered",
  url: string,
  pageMetadata: PageMetadata,
): ExtractedPageMetadata {
  return {
    source,
    url,
    metadata: pageMetadata,
    headings: { h1: [pageMetadata.title ?? "Example"], all: [{ level: 1, text: pageMetadata.title ?? "Example" }] },
    images: { total: 0, missingAlt: 0, items: [] },
    links: { total: 0, missingAccessibleText: 0, items: [] },
    jsonLd: [],
  };
}

function resource(url: string) {
  return {
    url,
    finalUrl: url,
    exists: true,
    ok: true,
    statusCode: 200,
  };
}
