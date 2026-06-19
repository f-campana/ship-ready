import { load, type CheerioAPI } from "cheerio";
import type {
  ExtractedHeadings,
  ExtractedImages,
  ExtractedLinks,
  ExtractedPageMetadata,
  JsonLdBlock,
  PageMetadata,
} from "../types/audit";
import { resolveMaybeUrl } from "../utils/url";

type ExtractOptions = {
  source: "raw" | "rendered";
  url: string;
};

export function extractMetadata(html: string, options: ExtractOptions): ExtractedPageMetadata {
  const $ = load(html);

  return {
    source: options.source,
    url: options.url,
    metadata: extractPageMetadata($, options.url),
    headings: extractHeadings($),
    images: extractImages($),
    links: extractLinks($),
    jsonLd: extractJsonLd($),
  };
}

function extractPageMetadata($: CheerioAPI, baseUrl: string): PageMetadata {
  const faviconLinks = extractFaviconLinks($, baseUrl);
  const canonical = resolveMaybeUrl(linkHrefByRel($, "canonical"), baseUrl);

  const openGraphImage = metaContent($, "og:image");
  const openGraphUrl = metaContent($, "og:url");
  const twitterImage = metaContent($, "twitter:image");

  return {
    htmlLang: clean($("html").first().attr("lang")),
    title: clean($("title").first().text()),
    description: metaContent($, "description"),
    viewport: metaContent($, "viewport"),
    robots: metaContent($, "robots"),
    canonical,
    favicon: faviconLinks[0],
    faviconLinks,
    themeColor: metaContent($, "theme-color"),
    openGraph: {
      title: metaContent($, "og:title"),
      description: metaContent($, "og:description"),
      image: resolveMaybeUrl(openGraphImage, baseUrl),
      url: resolveMaybeUrl(openGraphUrl, baseUrl),
      type: metaContent($, "og:type"),
      siteName: metaContent($, "og:site_name"),
    },
    twitter: {
      card: metaContent($, "twitter:card"),
      title: metaContent($, "twitter:title"),
      description: metaContent($, "twitter:description"),
      image: resolveMaybeUrl(twitterImage, baseUrl),
    },
  };
}

function extractHeadings($: CheerioAPI): ExtractedHeadings {
  const all: ExtractedHeadings["all"] = [];

  $("h1,h2,h3,h4,h5,h6").each((_, element) => {
    const tagName = element.tagName.toLowerCase();
    const level = Number(tagName.slice(1)) as 1 | 2 | 3 | 4 | 5 | 6;
    const text = normalizeWhitespace($(element).text());
    all.push({ level, text });
  });

  return {
    h1: all.filter((heading) => heading.level === 1).map((heading) => heading.text),
    all,
  };
}

function extractImages($: CheerioAPI): ExtractedImages {
  const items: ExtractedImages["items"] = [];

  $("img").each((_, element) => {
    const item = {
      src: clean($(element).attr("src")),
      alt: clean($(element).attr("alt")),
      role: clean($(element).attr("role")),
      ariaHidden: $(element).attr("aria-hidden")?.toLowerCase() === "true" || undefined,
    };
    items.push(item);
  });

  const missingAlt = items.filter((item) => {
    if (item.ariaHidden || item.role === "presentation" || item.role === "none") {
      return false;
    }

    return item.alt === undefined;
  }).length;

  return {
    total: items.length,
    missingAlt,
    items,
  };
}

function extractLinks($: CheerioAPI): ExtractedLinks {
  const items: ExtractedLinks["items"] = [];

  $("a").each((_, element) => {
    const link = $(element);
    const text = normalizeWhitespace(link.text());
    const ariaLabel = clean(link.attr("aria-label"));
    const title = clean(link.attr("title"));
    const imageAlt = clean(link.find("img[alt]").first().attr("alt"));

    items.push({
      href: clean(link.attr("href")),
      text: text || imageAlt || "",
      ariaLabel,
      title,
    });
  });

  return {
    total: items.length,
    missingAccessibleText: items.filter(
      (item) => !item.text && !item.ariaLabel && !item.title,
    ).length,
    items,
  };
}

function extractJsonLd($: CheerioAPI): JsonLdBlock[] {
  const blocks: JsonLdBlock[] = [];

  $("script").each((_, element) => {
    const type = clean($(element).attr("type"))?.toLowerCase();
    if (!type || !type.includes("application/ld+json")) {
      return;
    }

    const raw = $(element).text().trim();
    try {
      const parsed = JSON.parse(raw) as unknown;
      blocks.push({
        raw,
        valid: true,
        parsed,
        types: extractJsonLdTypes(parsed),
      });
    } catch (error) {
      blocks.push({
        raw,
        valid: false,
        error: error instanceof Error ? error.message : "Invalid JSON-LD.",
        types: [],
      });
    }
  });

  return blocks;
}

function extractJsonLdTypes(value: unknown): string[] {
  const found = new Set<string>();
  collectJsonLdTypes(value, found);
  return Array.from(found);
}

function collectJsonLdTypes(value: unknown, found: Set<string>): void {
  if (Array.isArray(value)) {
    for (const item of value) {
      collectJsonLdTypes(item, found);
    }
    return;
  }

  if (!value || typeof value !== "object") {
    return;
  }

  const record = value as Record<string, unknown>;
  const type = record["@type"];
  if (typeof type === "string" && type.trim()) {
    found.add(type.trim());
  } else if (Array.isArray(type)) {
    for (const item of type) {
      if (typeof item === "string" && item.trim()) {
        found.add(item.trim());
      }
    }
  }

  if (Array.isArray(record["@graph"])) {
    collectJsonLdTypes(record["@graph"], found);
  }
}

function metaContent($: CheerioAPI, key: string): string | undefined {
  const wanted = key.toLowerCase();
  let value: string | undefined;

  $("meta").each((_, element) => {
    if (value) {
      return;
    }

    const name = clean($(element).attr("name"))?.toLowerCase();
    const property = clean($(element).attr("property"))?.toLowerCase();
    const httpEquiv = clean($(element).attr("http-equiv"))?.toLowerCase();
    if (name === wanted || property === wanted || httpEquiv === wanted) {
      value = clean($(element).attr("content"));
    }
  });

  return value;
}

function linkHrefByRel($: CheerioAPI, relName: string): string | undefined {
  const wanted = relName.toLowerCase();
  let value: string | undefined;

  $("link").each((_, element) => {
    if (value) {
      return;
    }

    const relTokens = clean($(element).attr("rel"))
      ?.toLowerCase()
      .split(/\s+/)
      .filter(Boolean);

    if (relTokens?.includes(wanted)) {
      value = clean($(element).attr("href"));
    }
  });

  return value;
}

function extractFaviconLinks($: CheerioAPI, baseUrl: string): string[] {
  const hrefs: string[] = [];

  $("link").each((_, element) => {
    const rel = clean($(element).attr("rel"))?.toLowerCase() ?? "";
    const href = clean($(element).attr("href"));
    if (!href) {
      return;
    }

    const isIcon =
      rel.split(/\s+/).includes("icon") ||
      rel.includes("shortcut icon") ||
      rel.includes("apple-touch-icon") ||
      rel.includes("mask-icon");

    if (isIcon) {
      const resolved = resolveMaybeUrl(href, baseUrl);
      if (resolved) {
        hrefs.push(resolved);
      }
    }
  });

  return Array.from(new Set(hrefs));
}

function clean(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? normalizeWhitespace(trimmed) : undefined;
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

