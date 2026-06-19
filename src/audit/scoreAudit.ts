import type {
  AuditCheck,
  AuditResources,
  ExtractedPageMetadata,
  RawRenderedComparison,
} from "../types/audit";

export type ScoreAuditInput = {
  raw: ExtractedPageMetadata;
  rendered: ExtractedPageMetadata;
  comparison: RawRenderedComparison;
  resources: AuditResources;
};

export function scoreAudit(input: ScoreAuditInput): number {
  const metadata = input.raw.metadata;
  let score = 0;

  score += scoreTitle(input);
  score += scoreDescription(input);
  score += metadata.canonical ? 8 : renderOnlyPoints(input, "canonical", 3);
  score += scoreOpenGraph(input);
  score += scoreTwitter(input);
  score += metadata.faviconLinks.length > 0 ? 5 : 0;
  score += (metadata.htmlLang ? 3 : 0) + (metadata.viewport ? 3 : 0);
  score += scoreH1(input.raw);
  score += scoreJsonLd(input.raw);
  score += input.resources.robotsTxt.exists && !input.resources.robotsTxt.blocksPage ? 5 : 0;
  score += input.resources.sitemapXml.exists ? 5 : 0;
  score += scoreRawRenderedConsistency(input.comparison);

  return Math.max(0, Math.min(100, Math.round(score)));
}

export function classifyAuditStatus(
  score: number,
  checks: AuditCheck[],
): "good" | "needs_work" | "critical" {
  const criticalCount = checks.filter((check) => check.severity === "critical").length;
  if (score >= 85 && criticalCount === 0) {
    return "good";
  }

  if (score >= 50) {
    return "needs_work";
  }

  return "critical";
}

function scoreTitle(input: ScoreAuditInput): number {
  const title = input.raw.metadata.title;
  if (!title) {
    return renderOnlyPoints(input, "title", 4);
  }

  if (title.length < 10 || title.length > 65 || isGeneric(title)) {
    return 6;
  }

  return 10;
}

function scoreDescription(input: ScoreAuditInput): number {
  const description = input.raw.metadata.description;
  if (!description) {
    return renderOnlyPoints(input, "description", 4);
  }

  if (description.length < 50 || description.length > 170) {
    return 6;
  }

  return 10;
}

function scoreOpenGraph(input: ScoreAuditInput): number {
  const openGraph = input.raw.metadata.openGraph;
  return (
    fieldPoints(openGraph.title, input, "og:title", 3, 1) +
    fieldPoints(openGraph.description, input, "og:description", 3, 1) +
    fieldPoints(openGraph.image, input, "og:image", 5, 2) +
    fieldPoints(openGraph.url, input, "og:url", 2, 1) +
    fieldPoints(openGraph.type, input, "og:type", 2, 1)
  );
}

function scoreTwitter(input: ScoreAuditInput): number {
  const twitter = input.raw.metadata.twitter;
  return (
    fieldPoints(twitter.card, input, "twitter:card", 2, 1) +
    fieldPoints(twitter.title, input, "twitter:title", 2, 1) +
    fieldPoints(twitter.description, input, "twitter:description", 2, 1) +
    fieldPoints(twitter.image, input, "twitter:image", 2, 1)
  );
}

function scoreH1(snapshot: ExtractedPageMetadata): number {
  const h1 = snapshot.headings.h1;
  if (h1.length === 1) {
    return isGeneric(h1[0] ?? "") ? 5 : 8;
  }

  if (h1.length > 1) {
    return 4;
  }

  return 0;
}

function scoreJsonLd(snapshot: ExtractedPageMetadata): number {
  if (snapshot.jsonLd.length === 0) {
    return 0;
  }

  const valid = snapshot.jsonLd.filter((block) => block.valid);
  if (valid.length === 0) {
    return 2;
  }

  return valid.some((block) => block.types.length > 0) ? 10 : 7;
}

function scoreRawRenderedConsistency(comparison: RawRenderedComparison): number {
  let score = 10;

  for (const field of comparison.fields) {
    if (field.status === "present_after_render_only") {
      score -= field.field === "title" || field.field === "description" ? 3 : 2;
    }
  }

  const canonical = comparison.fields.find((field) => field.field === "canonical");
  if (canonical?.status === "changed_after_render") {
    score -= 3;
  }

  return Math.max(0, score);
}

function fieldPoints(
  rawValue: string | undefined,
  input: ScoreAuditInput,
  field: string,
  fullPoints: number,
  renderOnlyPointsValue: number,
): number {
  return rawValue ? fullPoints : renderOnlyPoints(input, field, renderOnlyPointsValue);
}

function renderOnlyPoints(
  input: ScoreAuditInput,
  field: string,
  points: number,
): number {
  return input.comparison.fields.some(
    (comparisonField) =>
      comparisonField.field === field &&
      comparisonField.status === "present_after_render_only",
  )
    ? points
    : 0;
}

function isGeneric(value: string): boolean {
  return ["home", "untitled", "vite + react", "react app", "new project", "lovable", "document"].includes(
    value.trim().toLowerCase(),
  );
}

