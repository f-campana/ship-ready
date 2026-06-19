import type {
  AuditCheck,
  AuditResources,
  ExtractedPageMetadata,
  RawRenderedComparison,
} from "../types/audit";

export type CheckMetadataInput = {
  url: string;
  finalUrl: string;
  httpStatus?: number;
  raw: ExtractedPageMetadata;
  rendered: ExtractedPageMetadata;
  comparison: RawRenderedComparison;
  resources: AuditResources;
};

const GENERIC_TITLES = new Set([
  "home",
  "untitled",
  "vite + react",
  "react app",
  "new project",
  "lovable",
  "document",
]);

export function checkMetadata(input: CheckMetadataInput): AuditCheck[] {
  const checks: AuditCheck[] = [];
  const raw = input.raw.metadata;
  const rendered = input.rendered.metadata;

  if (input.httpStatus && input.httpStatus >= 200 && input.httpStatus < 300) {
    checks.push(passed("crawl.status.ok", "Page returns HTTP success", "The audited URL returned a 2xx HTTP status."));
  } else {
    checks.push({
      id: "crawl.status.non_200",
      category: "crawlability",
      severity: "critical",
      title: "Audited URL did not return HTTP 200",
      description: "The page should return a successful HTTP status for reliable crawler access.",
      evidence: { httpStatus: input.httpStatus },
      recommendation: "Fix the deployment or redirect target so the final page returns a 2xx status.",
      confidence: "high",
      fixability: "manual",
    });
  }

  if (!raw.title) {
    checks.push({
      id: "metadata.title.missing",
      category: "metadata",
      severity: "critical",
      title: "Missing title in raw HTML",
      description: "The initial HTML does not include a title tag.",
      recommendation: "Add a meaningful page title to the server-rendered HTML.",
      confidence: "high",
      fixability: "auto_fixable",
      fixStrategy: "Add or update the page title in the source project metadata.",
    });
  } else {
    checks.push(passed("metadata.title.present", "Title present", `Raw title: ${raw.title}`));
    const titleLength = raw.title.length;
    if (titleLength < 10) {
      checks.push(warning("metadata.title.too_short", "Title is very short", "A very short title may not explain the page clearly.", { title: raw.title }));
    }
    if (titleLength > 65) {
      checks.push(warning("metadata.title.too_long", "Title is long", "Long titles may be truncated in previews.", { title: raw.title, length: titleLength }));
    }
    if (GENERIC_TITLES.has(raw.title.trim().toLowerCase())) {
      checks.push(warning("metadata.title.generic", "Title is generic", "Generic titles make the page harder to identify in browser tabs and previews.", { title: raw.title }));
    }
  }

  if (!raw.description) {
    checks.push({
      id: "metadata.description.missing",
      category: "metadata",
      severity: "critical",
      title: "Missing meta description in raw HTML",
      description: "The initial HTML does not include a meta description.",
      recommendation: "Add a concise, factual meta description to the server-rendered HTML.",
      confidence: "high",
      fixability: "auto_fixable",
      fixStrategy: "Add a meta description in the source project metadata.",
    });
  } else {
    checks.push(passed("metadata.description.present", "Meta description present", "Raw meta description is present."));
    if (raw.description.length < 50) {
      checks.push(warning("metadata.description.too_short", "Meta description is short", "Short descriptions may not give share previews enough context.", { description: raw.description, length: raw.description.length }));
    }
    if (raw.description.length > 170) {
      checks.push(warning("metadata.description.too_long", "Meta description is long", "Long descriptions may be truncated in previews.", { length: raw.description.length }));
    }
  }

  if (!raw.canonical) {
    checks.push({
      id: "metadata.canonical.missing",
      category: "metadata",
      severity: "critical",
      title: "Missing canonical URL",
      description: "The raw HTML does not include a canonical link.",
      recommendation: "Add a canonical link that points to the preferred public URL for this page.",
      confidence: "high",
      fixability: "auto_fixable",
      fixStrategy: "Add a canonical link in the page head or framework metadata config.",
    });
  } else {
    try {
      const canonical = new URL(raw.canonical);
      checks.push(passed("metadata.canonical.present", "Canonical URL present", canonical.toString()));
      const finalHost = new URL(input.finalUrl).host;
      if (canonical.host !== finalHost) {
        checks.push(warning("metadata.canonical.host_mismatch", "Canonical host differs from final URL host", "This may be intentional, but it should be reviewed.", { canonical: canonical.toString(), finalUrl: input.finalUrl }));
      }
    } catch {
      checks.push(warning("metadata.canonical.invalid", "Canonical URL is invalid", "The canonical value could not be parsed as a URL.", { canonical: raw.canonical }));
    }
  }

  const robotsMeta = raw.robots ?? rendered.robots;
  if (robotsMeta?.toLowerCase().includes("noindex")) {
    checks.push({
      id: "metadata.robots.noindex",
      category: "crawlability",
      severity: "critical",
      title: "Page is marked noindex",
      description: "The robots meta tag tells crawlers not to index this page.",
      evidence: { robots: robotsMeta },
      recommendation: "Remove noindex if this public page should be discoverable.",
      confidence: "high",
      fixability: "manual",
    });
  } else {
    checks.push(passed("metadata.robots.indexable", "Page is not marked noindex", "No noindex robots meta directive was detected."));
  }

  if (robotsMeta?.toLowerCase().includes("nofollow")) {
    checks.push(warning("metadata.robots.nofollow", "Page is marked nofollow", "The robots meta tag asks crawlers not to follow links from this page.", { robots: robotsMeta }));
  }

  if (!raw.htmlLang) {
    checks.push(warning("metadata.lang.missing", "HTML lang attribute is missing", "The html element should include a language code.", undefined, "Add a lang attribute such as en to the html element."));
  } else if (!/^[a-z]{2,3}(-[a-z0-9]{2,8})*$/i.test(raw.htmlLang)) {
    checks.push(warning("metadata.lang.invalid", "HTML lang value looks invalid", "The lang attribute should look like a BCP 47 language code.", { htmlLang: raw.htmlLang }));
  } else {
    checks.push(passed("metadata.lang.present", "HTML lang attribute present", raw.htmlLang));
  }

  if (!raw.viewport) {
    checks.push(warning("metadata.viewport.missing", "Viewport meta tag is missing", "Responsive pages should define a viewport meta tag."));
  } else {
    checks.push(passed("metadata.viewport.present", "Viewport present", raw.viewport));
  }

  if (raw.themeColor) {
    checks.push(passed("metadata.theme_color.present", "Theme color present", raw.themeColor));
  } else if (!rendered.themeColor) {
    checks.push(info(
      "metadata.theme_color.missing",
      "Theme color is not set",
      "Optional theme-color metadata was not found in the initial HTML.",
      undefined,
      "Add a theme-color meta tag if you want branded browser UI on supported surfaces.",
    ));
  }

  if (!raw.faviconLinks.length) {
    checks.push(warning("metadata.favicon.missing", "No favicon links found", "Favicons and app icons help the site look complete in tabs, bookmarks, and device surfaces."));
  } else {
    checks.push(passed("metadata.favicon.present", "Favicon link found", raw.faviconLinks[0] ?? "favicon present"));
  }

  addSocialChecks(checks, input.raw);
  addJsonLdChecks(checks, input.raw);
  addStructureChecks(checks, input.raw);
  addResourceChecks(checks, input.resources);
  addRawRenderedChecks(checks, input.comparison);

  return checks;
}

function addSocialChecks(checks: AuditCheck[], snapshot: ExtractedPageMetadata): void {
  const { openGraph, twitter } = snapshot.metadata;

  if (!openGraph.title) {
    checks.push(warning("social.og.title_missing", "Missing og:title", "Open Graph previews should include a title."));
  } else {
    checks.push(passed("social.og.title_present", "og:title present", openGraph.title));
  }

  if (!openGraph.description) {
    checks.push(warning("social.og.description_missing", "Missing og:description", "Open Graph previews should include a description."));
  } else {
    checks.push(passed("social.og.description_present", "og:description present", "Open Graph description is present."));
  }

  if (!openGraph.image) {
    checks.push({
      id: "social.og.image_missing",
      category: "social",
      severity: "critical",
      title: "Missing og:image",
      description: "Social previews usually need an Open Graph image.",
      recommendation: "Add an absolute, public og:image URL for share previews.",
      confidence: "high",
      fixability: "plan_only",
    });
  } else {
    checks.push(passed("social.og.image_present", "og:image present", openGraph.image));
  }

  if (!openGraph.url) {
    checks.push(warning("social.og.url_missing", "Missing og:url", "Open Graph metadata should include the canonical page URL."));
  } else {
    checks.push(passed("social.og.url_present", "og:url present", openGraph.url));
  }

  if (!openGraph.type) {
    checks.push(warning("social.og.type_missing", "Missing og:type", "Open Graph metadata should include a type such as website."));
  } else {
    checks.push(passed("social.og.type_present", "og:type present", openGraph.type));
  }

  if (openGraph.siteName) {
    checks.push(passed("social.og.site_name_present", "og:site_name present", openGraph.siteName));
  }

  if (!twitter.card) {
    checks.push(warning("social.twitter.card_missing", "Missing twitter:card", "Twitter/X cards should declare a card type."));
  } else {
    checks.push(passed("social.twitter.card_present", "twitter:card present", twitter.card));
  }

  if (!twitter.title) {
    checks.push(warning("social.twitter.title_missing", "Missing twitter:title", "Twitter/X cards should include a title."));
  } else {
    checks.push(passed("social.twitter.title_present", "twitter:title present", twitter.title));
  }

  if (!twitter.description) {
    checks.push(warning("social.twitter.description_missing", "Missing twitter:description", "Twitter/X cards should include a description."));
  } else {
    checks.push(passed("social.twitter.description_present", "twitter:description present", "Twitter/X description is present."));
  }

  if (!twitter.image) {
    checks.push(warning("social.twitter.image_missing", "Missing twitter:image", "Twitter/X cards should include an image when possible."));
  } else {
    checks.push(passed("social.twitter.image_present", "twitter:image present", twitter.image));
  }
}

function addJsonLdChecks(checks: AuditCheck[], snapshot: ExtractedPageMetadata): void {
  if (snapshot.jsonLd.length === 0) {
    checks.push({
      id: "schema.jsonld.missing",
      category: "schema",
      severity: "critical",
      title: "No JSON-LD detected",
      description: "No structured data script tags were found in the raw HTML.",
      recommendation: "Add conservative, factual JSON-LD such as WebSite or Organization when appropriate.",
      confidence: "high",
      fixability: "plan_only",
    });
    return;
  }

  const validBlocks = snapshot.jsonLd.filter((block) => block.valid);
  for (const [index, block] of snapshot.jsonLd.entries()) {
    if (!block.valid) {
      checks.push({
        id: "schema.jsonld.invalid_json",
        category: "schema",
        severity: "critical",
        title: "Invalid JSON-LD detected",
        description: "A JSON-LD script tag could not be parsed as JSON.",
        evidence: { index, error: block.error },
        recommendation: "Fix the JSON syntax or remove the invalid structured data block.",
        confidence: "high",
        fixability: "auto_fixable",
      });
    }
  }

  if (validBlocks.length === 0) {
    return;
  }

  checks.push(passed("schema.jsonld.valid", "Valid JSON-LD detected", `Valid blocks: ${validBlocks.length}`));

  for (const [index, block] of validBlocks.entries()) {
    if (!hasJsonLdContext(block.parsed)) {
      checks.push(warning("schema.jsonld.context_missing", "JSON-LD @context missing", "Structured data should include an @context value.", { index }));
    }
    if (block.types.length === 0) {
      checks.push(warning("schema.jsonld.type_missing", "JSON-LD @type missing", "Structured data should include at least one @type value.", { index }));
    }
  }
}

function addStructureChecks(checks: AuditCheck[], snapshot: ExtractedPageMetadata): void {
  const h1 = snapshot.headings.h1;
  if (h1.length === 0) {
    checks.push(warning("structure.h1.missing", "No H1 found", "The page should have one clear H1."));
  } else if (h1.length > 1) {
    checks.push(warning("structure.h1.multiple", "Multiple H1 elements found", "Most pages should have one primary H1.", { h1 }));
  } else {
    checks.push(passed("structure.h1.single", "Single H1 found", h1[0] ?? ""));
  }

  for (const value of h1) {
    if (GENERIC_TITLES.has(value.trim().toLowerCase())) {
      checks.push(warning("structure.h1.generic", "H1 is generic", "The primary heading should describe the page.", { h1: value }));
    }
  }

  if (snapshot.images.missingAlt > 0) {
    checks.push(warning("a11y.image.alt_missing", "Images missing alt text", "Some images do not include alt text. Decorative images should use empty alt text intentionally.", { missingAlt: snapshot.images.missingAlt, total: snapshot.images.total }));
  }

  if (snapshot.links.missingAccessibleText > 0) {
    checks.push(warning("a11y.link.text_missing", "Links missing accessible text", "Some links do not have visible text, aria-label, title, or image alt text.", { missingAccessibleText: snapshot.links.missingAccessibleText, total: snapshot.links.total }));
  }
}

function addResourceChecks(checks: AuditCheck[], resources: AuditResources): void {
  const robots = resources.robotsTxt;
  if (!robots.exists) {
    checks.push(warning("crawl.robots_txt.missing", "robots.txt not found", "No robots.txt file was found at the origin root.", { url: robots.url, statusCode: robots.statusCode }));
  } else if (robots.blocksPage) {
    checks.push({
      id: "crawl.robots_txt.blocks_page",
      category: "crawlability",
      severity: "critical",
      title: "robots.txt appears to block this page",
      description: "The robots.txt rules appear to disallow the audited URL path.",
      evidence: { url: robots.url },
      recommendation: "Review robots.txt before publishing this page.",
      confidence: "medium",
      fixability: "manual",
    });
  } else {
    checks.push(passed("crawl.robots_txt.found", "robots.txt found", robots.url));
  }

  const sitemap = resources.sitemapXml;
  if (!sitemap.exists) {
    const hasSuccessfulResponse = sitemap.statusCode !== undefined && sitemap.statusCode >= 200 && sitemap.statusCode < 300;
    checks.push(
      hasSuccessfulResponse
        ? warning("crawl.sitemap.invalid", "sitemap.xml is not a valid sitemap", "The sitemap.xml URL returned a success response, but the body did not look like an XML sitemap.", { url: sitemap.url, statusCode: sitemap.statusCode, error: sitemap.error })
        : warning("crawl.sitemap.missing", "sitemap.xml not found", "No sitemap.xml file was found at the origin root.", { url: sitemap.url, statusCode: sitemap.statusCode }),
    );
  } else {
    checks.push(passed("crawl.sitemap.found", "sitemap.xml found", sitemap.url));
    if (sitemap.includesAuditedUrl === false) {
      checks.push(warning("crawl.sitemap.url_missing", "sitemap.xml may not include this URL", "The sitemap was found, but the audited URL was not detected in it.", { sitemap: sitemap.url }));
    }
  }
}

function addRawRenderedChecks(
  checks: AuditCheck[],
  comparison: RawRenderedComparison,
): void {
  const renderOnly = comparison.fields.filter(
    (field) => field.status === "present_after_render_only",
  );

  const titleRenderOnly = renderOnly.some((field) => field.field === "title");
  const descriptionRenderOnly = renderOnly.some((field) => field.field === "description");

  if (titleRenderOnly && descriptionRenderOnly) {
    checks.push({
      id: "crawl.raw_render.title_description_render_only",
      category: "crawlability",
      severity: "critical",
      title: "Title and description appear only after JavaScript rendering",
      description: "Some crawlers and social preview bots may not reliably see metadata that is absent from the initial HTML.",
      evidence: { fields: ["title", "description"] },
      recommendation: "Move key metadata into the server-rendered or static HTML output.",
      confidence: "high",
      fixability: "plan_only",
    });
  } else if (renderOnly.length > 0) {
    checks.push(warning(
      "crawl.raw_render.metadata_render_only",
      "Metadata appears only after JavaScript rendering",
      "Some crawlers and social preview bots may not reliably see metadata that is absent from the initial HTML.",
      { fields: renderOnly.map((field) => field.field) },
      "Move key metadata into the server-rendered or static HTML output.",
    ));
  } else {
    checks.push(passed("crawl.raw_render.consistent", "Key metadata present in raw HTML", "No render-only metadata fields were detected."));
  }

  const canonical = comparison.fields.find((field) => field.field === "canonical");
  if (canonical?.status === "changed_after_render") {
    checks.push(warning("crawl.raw_render.canonical_changed", "Canonical URL changes after render", "Canonical changes can create inconsistent crawler signals.", { rawValue: canonical.rawValue, renderedValue: canonical.renderedValue }));
  }
}

function hasJsonLdContext(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.some(hasJsonLdContext);
  }

  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as Record<string, unknown>;
  if (typeof record["@context"] === "string" && record["@context"].trim()) {
    return true;
  }

  return Array.isArray(record["@graph"]) && record["@graph"].some(hasJsonLdContext);
}

function warning(
  id: string,
  title: string,
  description: string,
  evidence?: Record<string, unknown>,
  recommendation?: string,
): AuditCheck {
  return {
    id,
    category: categoryFromId(id),
    severity: "warning",
    title,
    description,
    evidence,
    recommendation,
    confidence: "high",
    fixability: "plan_only",
  };
}

function info(
  id: string,
  title: string,
  description: string,
  evidence?: Record<string, unknown>,
  recommendation?: string,
): AuditCheck {
  return {
    id,
    category: categoryFromId(id),
    severity: "info",
    title,
    description,
    evidence,
    recommendation,
    confidence: "high",
    fixability: "plan_only",
  };
}

function passed(id: string, title: string, description: string): AuditCheck {
  return {
    id,
    category: categoryFromId(id),
    severity: "passed",
    title,
    description,
    confidence: "high",
    fixability: "not_fixable",
  };
}

function categoryFromId(id: string): AuditCheck["category"] {
  if (id.startsWith("social.")) return "social";
  if (id.startsWith("schema.")) return "schema";
  if (id.startsWith("crawl.") || id.startsWith("metadata.robots.")) return "crawlability";
  if (id.startsWith("structure.")) return "structure";
  if (id.startsWith("a11y.")) return "accessibility";
  return "metadata";
}
