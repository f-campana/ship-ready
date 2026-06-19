import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { extractMetadata } from "../audit/extractMetadata";
import { planFixes, type PlanFixesOptions } from "../plan/planFixes";
import {
  nextRobotsTsForUrl,
  nextSitemapTsForUrl,
  robotsTxtForUrl,
  sitemapXmlForUrl,
} from "./generatedCrawlFiles";
import {
  DryRunFixResultSchema,
  type DryRunFileChange,
  type DryRunFixResult,
  type SkippedFixAction,
} from "../types/dryRunFix";
import type { FixPlanAction, FixPlanResult, FixPlanRisk } from "../types/fixPlan";

export type DryRunFixOptions = PlanFixesOptions;

type DryRunFixFromPlanOptions = {
  repoRoot: string;
  generatedAt?: string;
};

type MutableFileChange = Omit<DryRunFileChange, "sourceActionIds" | "diff" | "reviewStatus"> & {
  sourceActionIds: Set<string>;
  reasons: Set<string>;
};

type PreviewContext = {
  plan: FixPlanResult;
  repoRoot: string;
  changes: Map<string, MutableFileChange>;
  skippedActions: SkippedFixAction[];
  safetyNotes: Set<string>;
};

type HtmlPreview = {
  after: string;
  reason: string;
  risk: FixPlanRisk;
  requiresHumanReview: boolean;
  addedFields: string[];
};

type NextAppRoot = {
  root: "src/app" | "app";
  layoutPath?: string;
};

type NextMetadataPreview = {
  after: string;
  reason: string;
  skippedFields: string[];
};

const MAX_PREVIEW_FILE_BYTES = 256 * 1024;
const REVIEW_REQUIRED_TODO = "TODO(shipready)";

export async function dryRunFix(
  repoPath: string,
  url: string,
  options: DryRunFixOptions = {},
): Promise<DryRunFixResult> {
  const plan = await planFixes(repoPath, url, options);
  const repoRoot = resolve(options.repo?.cwd ?? process.cwd(), repoPath);
  return dryRunFixFromPlan(plan, { repoRoot });
}

export function dryRunFixFromPlan(
  plan: FixPlanResult,
  options: DryRunFixFromPlanOptions,
): DryRunFixResult {
  const context: PreviewContext = {
    plan,
    repoRoot: options.repoRoot,
    changes: new Map(),
    skippedActions: [],
    safetyNotes: new Set(["Dry-run only. No files were modified."]),
  };

  if (plan.actions.length === 0) {
    context.safetyNotes.add("No file changes were generated because the fix plan has no required actions.");
  }

  if (plan.actions.length > 0) {
    switch (plan.repoSummary.frameworkId) {
      case "static_html":
        previewStaticHtml(context);
        break;
      case "vite_react":
        previewViteReact(context);
        break;
      case "next_app_router":
        previewNextAppRouter(context);
        break;
      case "unknown":
        context.safetyNotes.add("Unsupported or unknown frameworks are manual recommendations only.");
        skipAllActions(context, "unsupported", "Unknown framework patch previews are not supported.");
        break;
      case "next_pages_router":
        context.safetyNotes.add("Next.js patch previews are intentionally skipped in this first dry-run pass.");
        skipAllActions(context, "not_in_scope", "Next.js patch previews are not implemented in this first dry-run pass.");
        break;
      default:
        skipAllActions(context, "unsupported", `${plan.repoSummary.frameworkName} patch previews are not supported yet.`);
        break;
    }
  }

  const fileChanges = Array.from(context.changes.values()).map(finalizeFileChange);
  const result: DryRunFixResult = {
    url: plan.url,
    repoPath: plan.repoPath,
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    mode: "dry_run",
    wroteFiles: false,
    planSummary: {
      auditScore: plan.auditSummary.score,
      auditStatus: plan.auditSummary.status,
      frameworkId: plan.repoSummary.frameworkId,
      frameworkName: plan.repoSummary.frameworkName,
      recommendedNextStep: plan.recommendedNextStep,
    },
    fileChanges,
    skippedActions: context.skippedActions,
    safetyNotes: Array.from(context.safetyNotes),
    recommendedNextStep: recommendedNextStep(plan, fileChanges, context.skippedActions),
  };

  return DryRunFixResultSchema.parse(result);
}

function previewStaticHtml(context: PreviewContext): void {
  for (const action of context.plan.actions) {
    if (action.id === "metadata.static_html_head") {
      const target = staticHtmlTargetForUrl(context.plan.url, action.targetFiles);
      if (!target) {
        skipAction(context, action, "requires_more_information", "No static HTML file could be confidently mapped to the audited URL.");
        continue;
      }
      previewHtmlMetadata(context, action, target, "Add missing static metadata.");
      continue;
    }

    if (action.id === "static_html.json_ld_review") {
      const target = staticHtmlTargetForUrl(context.plan.url, action.targetFiles);
      if (!target) {
        skipAction(context, action, "requires_more_information", "No static HTML file could be confidently mapped to the audited URL.");
        continue;
      }
      previewJsonLd(context, action, target);
      continue;
    }

    if (action.id === "static_html.robots") {
      previewRobotsTxt(context, action, "robots.txt");
      continue;
    }

    if (action.id === "static_html.sitemap") {
      previewSitemapXml(context, action, "sitemap.xml");
      continue;
    }

    skipUnsupportedKnownAction(context, action);
  }
}

function previewViteReact(context: PreviewContext): void {
  context.safetyNotes.add(
    "This is fallback metadata for the app shell. Route-specific metadata may require prerendering, SSR, or a later framework-specific strategy.",
  );

  for (const action of context.plan.actions) {
    if (action.id === "vite_react.metadata_review") {
      previewHtmlMetadata(context, action, "index.html", "Add or update Vite app-shell fallback metadata.");
      continue;
    }

    if (action.id === "vite_react.json_ld_review") {
      previewJsonLd(context, action, "index.html");
      continue;
    }

    if (action.id === "vite_react.robots") {
      previewRobotsTxt(context, action, "public/robots.txt");
      continue;
    }

    if (action.id === "vite_react.sitemap") {
      previewSitemapXml(context, action, "public/sitemap.xml");
      continue;
    }

    skipUnsupportedKnownAction(context, action);
  }
}

function previewNextAppRouter(context: PreviewContext): void {
  context.safetyNotes.add(
    "Next.js App Router previews are conservative and read-only; dynamic metadata and component changes are skipped.",
  );

  if (context.plan.repoSummary.confidence !== "high") {
    skipAllActions(context, "requires_more_information", "Next.js App Router preview requires high-confidence repository detection.");
    return;
  }

  for (const action of context.plan.actions) {
    if (action.id === "next_app_router.robots") {
      previewNextRobotsRoute(context, action);
      continue;
    }

    if (action.id === "next_app_router.sitemap") {
      previewNextSitemapRoute(context, action);
      continue;
    }

    if (action.id === "next_app_router.metadata_review") {
      previewNextRootMetadata(context, action);
      continue;
    }

    if (action.id === "next_app_router.json_ld_review") {
      skipAction(
        context,
        action,
        "requires_more_information",
        "Next.js App Router JSON-LD preview requires a reviewed structured-data component and factual schema details.",
      );
      continue;
    }

    skipUnsupportedKnownAction(context, action);
  }
}

function previewHtmlMetadata(
  context: PreviewContext,
  action: FixPlanAction,
  path: string,
  reason: string,
): void {
  const file = readCurrentFile(context, path);
  if (!file.exists || file.current === undefined) {
    skipAction(context, action, "requires_more_information", `${path} was not found in the local repository.`);
    return;
  }

  const preview = buildHtmlMetadataPreview(file.current, context.plan.url, action);
  if (!preview) {
    skipAction(context, action, "requires_more_information", `No eligible missing metadata tags were found in ${path}.`);
    return;
  }

  recordFileChange(context, {
    path,
    before: file.before,
    after: preview.after,
    reason,
    action,
    risk: preview.risk,
    requiresHumanReview: preview.requiresHumanReview,
  });

  if (preview.requiresHumanReview) {
    context.safetyNotes.add("TODO placeholder metadata is for preview only and must be replaced before any future write.");
  }
}

function previewJsonLd(context: PreviewContext, action: FixPlanAction, path: string): void {
  const file = readCurrentFile(context, path);
  if (!file.exists || file.current === undefined) {
    skipAction(context, action, "requires_more_information", `${path} was not found in the local repository.`);
    return;
  }

  const preview = buildJsonLdPreview(file.current, context.plan.url);
  if (!preview) {
    skipAction(
      context,
      action,
      "requires_more_information",
      "JSON-LD preview needs an existing page title and description; ShipReady will not invent schema facts.",
    );
    return;
  }

  recordFileChange(context, {
    path,
    before: file.before,
    after: preview.after,
    reason: "Add conservative WebSite JSON-LD for human review.",
    action,
    risk: "medium",
    requiresHumanReview: true,
  });
  context.safetyNotes.add("JSON-LD previews use only conservative WebSite schema and require human confirmation.");
}

function previewRobotsTxt(context: PreviewContext, action: FixPlanAction, path: string): void {
  if (!action.sourceCheckIds.includes("crawl.robots_txt.missing")) {
    skipAction(context, action, "unsafe", "Changing existing robots rules requires manual review.");
    return;
  }

  const file = readCurrentFile(context, path);
  if (file.exists) {
    skipAction(context, action, "requires_more_information", `${path} already exists locally; verify deployment wiring before changing it.`);
    return;
  }

  recordFileChange(context, {
    path,
    before: undefined,
    after: robotsTxtForUrl(context.plan.url),
    reason: "Create a public robots.txt that allows crawling and points to the sitemap.",
    action,
    risk: "low",
    requiresHumanReview: action.futureAutomation.requiresHumanReview,
  });
}

function previewSitemapXml(context: PreviewContext, action: FixPlanAction, path: string): void {
  const file = readCurrentFile(context, path);
  const after = sitemapXmlForUrl(context.plan.url);
  const reason = file.exists
    ? "Replace or update sitemap.xml with a valid single-URL sitemap preview."
    : "Create a valid single-URL sitemap.xml preview.";

  recordFileChange(context, {
    path,
    before: file.before,
    after,
    reason,
    action,
    risk: action.risk,
    requiresHumanReview: action.futureAutomation.requiresHumanReview,
  });
}

function previewNextRobotsRoute(context: PreviewContext, action: FixPlanAction): void {
  if (!action.sourceCheckIds.includes("crawl.robots_txt.missing")) {
    skipAction(context, action, "unsafe", "Changing existing robots behavior requires manual review.");
    return;
  }

  const path = nextAppGeneratedRoutePath(context, action, "robots");
  if (!path) {
    skipAction(context, action, "requires_more_information", "No App Router root could be confidently selected for robots.ts.");
    return;
  }

  const file = readCurrentFile(context, path);
  if (file.exists) {
    skipAction(context, action, "requires_more_information", `${path} already exists locally; verify deployment wiring before changing it.`);
    return;
  }

  recordFileChange(context, {
    path,
    before: undefined,
    after: nextRobotsTsForUrl(context.plan.url),
    reason: "Create an App Router robots.ts route that allows crawling and points to the sitemap.",
    action,
    risk: "low",
    requiresHumanReview: action.futureAutomation.requiresHumanReview,
  });
}

function previewNextSitemapRoute(context: PreviewContext, action: FixPlanAction): void {
  const path = nextAppGeneratedRoutePath(context, action, "sitemap");
  if (!path) {
    skipAction(context, action, "requires_more_information", "No App Router root could be confidently selected for sitemap.ts.");
    return;
  }

  const file = readCurrentFile(context, path);
  if (file.exists) {
    skipAction(context, action, "requires_more_information", `${path} already exists locally; existing sitemap routes require manual review.`);
    return;
  }

  recordFileChange(context, {
    path,
    before: undefined,
    after: nextSitemapTsForUrl(context.plan.url),
    reason: "Create an App Router sitemap.ts route for the audited URL.",
    action,
    risk: action.risk,
    requiresHumanReview: action.futureAutomation.requiresHumanReview,
  });
}

function previewNextRootMetadata(context: PreviewContext, action: FixPlanAction): void {
  const layoutPath = nextAppLayoutPath(context, action);
  if (!layoutPath) {
    skipAction(context, action, "requires_more_information", "No root App Router layout file could be confidently selected.");
    return;
  }

  if (!layoutPath.endsWith(".tsx")) {
    skipAction(context, action, "requires_more_information", `${layoutPath} is not a .tsx layout; TypeScript metadata insertion is skipped.`);
    return;
  }

  const file = readCurrentFile(context, layoutPath);
  if (!file.exists || file.current === undefined) {
    skipAction(context, action, "requires_more_information", `${layoutPath} was not found in the local repository.`);
    return;
  }

  if (hasUseClientDirective(file.current)) {
    skipAction(context, action, "unsafe", `${layoutPath} is a client component; App Router metadata exports must stay in server components.`);
    return;
  }

  if (hasGenerateMetadataExport(file.current)) {
    skipAction(context, action, "requires_more_information", "Existing generateMetadata found; dynamic metadata should be reviewed manually.");
    return;
  }

  if (hasMetadataExport(file.current)) {
    skipAction(context, action, "requires_more_information", "Existing metadata export found; merging metadata is skipped until a tested merge path exists.");
    return;
  }

  if (hasLocalMetadataBinding(file.current) && !hasNextMetadataImport(file.current)) {
    skipAction(context, action, "unsafe", "A local Metadata binding already exists; adding the Next.js Metadata type could conflict.");
    return;
  }

  const preview = buildNextMetadataPreview(file.current, context.plan.url, action);
  if (!preview) {
    skipAction(
      context,
      action,
      "requires_more_information",
      "No deterministic missing metadata fields could be previewed without inventing product facts.",
    );
    return;
  }

  if (preview.skippedFields.length > 0) {
    context.safetyNotes.add(`Skipped Next.js metadata fields that require factual assets or copy: ${preview.skippedFields.join(", ")}.`);
  }

  recordFileChange(context, {
    path: layoutPath,
    before: file.before,
    after: preview.after,
    reason: preview.reason,
    action,
    risk: strongerRisk(action.risk, "medium"),
    requiresHumanReview: true,
  });
}

function buildHtmlMetadataPreview(
  html: string,
  finalUrl: string,
  action: FixPlanAction,
): HtmlPreview | undefined {
  const extracted = extractMetadata(html, { source: "raw", url: finalUrl });
  const metadata = extracted.metadata;
  const insertions: string[] = [];
  const addedFields: string[] = [];
  let requiresHumanReview = action.futureAutomation.requiresHumanReview;

  const title = metadata.title?.trim();
  const description = metadata.description?.trim();
  const titleForReuse = title ?? "TODO: Page title";
  const descriptionForReuse = description ?? "TODO: Page description";
  const imageForReuse = "TODO: Absolute image URL";

  if (!title) {
    insertions.push(`  <!-- ${REVIEW_REQUIRED_TODO}: Review and replace with a specific page title. -->`);
    insertions.push(`  <title>${escapeHtmlText(titleForReuse)}</title>`);
    addedFields.push("title");
    requiresHumanReview = true;
  }

  if (!description) {
    insertions.push(`  <!-- ${REVIEW_REQUIRED_TODO}: Review and replace with a concise page description. -->`);
    insertions.push(`  <meta name="description" content="${escapeHtmlAttribute(descriptionForReuse)}" />`);
    addedFields.push("meta description");
    requiresHumanReview = true;
  }

  if (!metadata.canonical) {
    insertions.push(`  <link rel="canonical" href="${escapeHtmlAttribute(finalUrl)}" />`);
    addedFields.push("canonical");
  }

  if (!metadata.openGraph.title) {
    if (!title) {
      insertions.push(`  <!-- ${REVIEW_REQUIRED_TODO}: Replace placeholder Open Graph title before applying. -->`);
      requiresHumanReview = true;
    }
    insertions.push(`  <meta property="og:title" content="${escapeHtmlAttribute(titleForReuse)}" />`);
    addedFields.push("og:title");
  }

  if (!metadata.openGraph.description) {
    if (!description) {
      insertions.push(`  <!-- ${REVIEW_REQUIRED_TODO}: Replace placeholder Open Graph description before applying. -->`);
      requiresHumanReview = true;
    }
    insertions.push(`  <meta property="og:description" content="${escapeHtmlAttribute(descriptionForReuse)}" />`);
    addedFields.push("og:description");
  }

  if (!metadata.openGraph.url) {
    insertions.push(`  <meta property="og:url" content="${escapeHtmlAttribute(finalUrl)}" />`);
    addedFields.push("og:url");
  }

  if (!metadata.openGraph.type) {
    insertions.push(`  <meta property="og:type" content="website" />`);
    addedFields.push("og:type");
  }

  if (!metadata.openGraph.image) {
    insertions.push(`  <!-- ${REVIEW_REQUIRED_TODO}: Replace with an absolute public share image URL. -->`);
    insertions.push(`  <meta property="og:image" content="${escapeHtmlAttribute(imageForReuse)}" />`);
    addedFields.push("og:image");
    requiresHumanReview = true;
  }

  if (!metadata.twitter.card) {
    insertions.push(`  <meta name="twitter:card" content="summary_large_image" />`);
    addedFields.push("twitter:card");
  }

  if (!metadata.twitter.title) {
    if (!title) {
      insertions.push(`  <!-- ${REVIEW_REQUIRED_TODO}: Replace placeholder Twitter/X title before applying. -->`);
      requiresHumanReview = true;
    }
    insertions.push(`  <meta name="twitter:title" content="${escapeHtmlAttribute(titleForReuse)}" />`);
    addedFields.push("twitter:title");
  }

  if (!metadata.twitter.description) {
    if (!description) {
      insertions.push(`  <!-- ${REVIEW_REQUIRED_TODO}: Replace placeholder Twitter/X description before applying. -->`);
      requiresHumanReview = true;
    }
    insertions.push(`  <meta name="twitter:description" content="${escapeHtmlAttribute(descriptionForReuse)}" />`);
    addedFields.push("twitter:description");
  }

  if (!metadata.twitter.image) {
    insertions.push(`  <!-- ${REVIEW_REQUIRED_TODO}: Replace with an absolute public Twitter/X image URL. -->`);
    insertions.push(`  <meta name="twitter:image" content="${escapeHtmlAttribute(imageForReuse)}" />`);
    addedFields.push("twitter:image");
    requiresHumanReview = true;
  }

  if (insertions.length === 0) {
    return undefined;
  }

  const after = insertIntoHead(html, insertions.join("\n"));
  if (!after || after === html) {
    return undefined;
  }

  return {
    after,
    reason: `Add missing metadata fields: ${addedFields.join(", ")}.`,
    risk: requiresHumanReview ? strongerRisk(action.risk, "medium") : action.risk,
    requiresHumanReview,
    addedFields,
  };
}

function buildJsonLdPreview(html: string, finalUrl: string): { after: string } | undefined {
  const extracted = extractMetadata(html, { source: "raw", url: finalUrl });
  if (extracted.jsonLd.length > 0) {
    return undefined;
  }

  const title = extracted.metadata.title?.trim();
  const description = extracted.metadata.description?.trim();
  if (!title || !description || isShipReadyPlaceholder(title) || isShipReadyPlaceholder(description)) {
    return undefined;
  }

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: title,
    url: finalUrl,
  };
  const block = [
    "  <!-- TODO(shipready): Confirm this structured data before applying. -->",
    "  <script type=\"application/ld+json\">",
    JSON.stringify(jsonLd, null, 2)
      .split("\n")
      .map((line) => `    ${line}`)
      .join("\n"),
    "  </script>",
  ].join("\n");

  const after = insertIntoHead(html, block);
  return after && after !== html ? { after } : undefined;
}

function buildNextMetadataPreview(
  source: string,
  finalUrl: string,
  action: FixPlanAction,
): NextMetadataPreview | undefined {
  const fields = buildNextMetadataFields(finalUrl, action.sourceCheckIds);
  if (fields.lines.length === 0) {
    return undefined;
  }

  const needsImport = !hasNextMetadataImport(source);
  const exportBlock = [
    "export const metadata: Metadata = {",
    ...fields.lines,
    "};",
  ].join("\n");
  const after = insertTopLevelNextMetadata(source, exportBlock, needsImport);

  return {
    after,
    reason: `Add root App Router metadata export for missing fields: ${fields.addedFields.join(", ")}.`,
    skippedFields: fields.skippedFields,
  };
}

function buildNextMetadataFields(
  finalUrl: string,
  sourceCheckIds: string[],
): { lines: string[]; addedFields: string[]; skippedFields: string[] } {
  const checks = new Set(sourceCheckIds);
  const lines: string[] = [];
  const addedFields: string[] = [];
  const skippedFields: string[] = [];
  const titlePlaceholder = "TODO: Page title";
  const descriptionPlaceholder = "TODO: Page description";

  if (checks.has("metadata.title.missing")) {
    lines.push(`  // ${REVIEW_REQUIRED_TODO}: Replace with the factual page title before applying.`);
    lines.push(`  title: ${quoteTsString(titlePlaceholder)},`);
    addedFields.push("title");
  }

  if (checks.has("metadata.description.missing")) {
    lines.push(`  // ${REVIEW_REQUIRED_TODO}: Replace with the factual page description before applying.`);
    lines.push(`  description: ${quoteTsString(descriptionPlaceholder)},`);
    addedFields.push("description");
  }

  if (checks.has("metadata.canonical.missing")) {
    lines.push("  alternates: {");
    lines.push(`    canonical: ${quoteTsString(finalUrl)},`);
    lines.push("  },");
    addedFields.push("canonical");
  }

  const openGraphLines: string[] = [];
  if (checks.has("social.og.title_missing")) {
    openGraphLines.push(`    // ${REVIEW_REQUIRED_TODO}: Replace with the factual Open Graph title before applying.`);
    openGraphLines.push(`    title: ${quoteTsString(titlePlaceholder)},`);
    addedFields.push("openGraph.title");
  }
  if (checks.has("social.og.description_missing")) {
    openGraphLines.push(`    // ${REVIEW_REQUIRED_TODO}: Replace with the factual Open Graph description before applying.`);
    openGraphLines.push(`    description: ${quoteTsString(descriptionPlaceholder)},`);
    addedFields.push("openGraph.description");
  }
  if (checks.has("social.og.url_missing")) {
    openGraphLines.push(`    url: ${quoteTsString(finalUrl)},`);
    addedFields.push("openGraph.url");
  }
  if (checks.has("social.og.type_missing")) {
    openGraphLines.push("    type: \"website\",");
    addedFields.push("openGraph.type");
  }
  if (checks.has("social.og.image_missing")) {
    skippedFields.push("openGraph.images");
  }
  if (openGraphLines.length > 0) {
    lines.push("  openGraph: {");
    lines.push(...openGraphLines);
    lines.push("  },");
  }

  const twitterLines: string[] = [];
  if (checks.has("social.twitter.card_missing")) {
    twitterLines.push("    card: \"summary_large_image\",");
    addedFields.push("twitter.card");
  }
  if (checks.has("social.twitter.title_missing")) {
    twitterLines.push(`    // ${REVIEW_REQUIRED_TODO}: Replace with the factual Twitter/X title before applying.`);
    twitterLines.push(`    title: ${quoteTsString(titlePlaceholder)},`);
    addedFields.push("twitter.title");
  }
  if (checks.has("social.twitter.description_missing")) {
    twitterLines.push(`    // ${REVIEW_REQUIRED_TODO}: Replace with the factual Twitter/X description before applying.`);
    twitterLines.push(`    description: ${quoteTsString(descriptionPlaceholder)},`);
    addedFields.push("twitter.description");
  }
  if (checks.has("social.twitter.image_missing")) {
    skippedFields.push("twitter.images");
  }
  if (twitterLines.length > 0) {
    lines.push("  twitter: {");
    lines.push(...twitterLines);
    lines.push("  },");
  }

  return { lines, addedFields, skippedFields };
}

function insertIntoHead(html: string, snippet: string): string | undefined {
  const indentedCloseMatch = /(\n[ \t]*)<\/head>/i.exec(html);
  if (indentedCloseMatch) {
    const closePrefix = indentedCloseMatch[1] ?? "\n";
    const closeIndent = closePrefix.slice(1);
    const childIndent = closeIndent.length > 0 ? `${closeIndent}  ` : "  ";
    const beforeHeadClose = html.slice(0, indentedCloseMatch.index);
    const formattedSnippet = reindentHeadSnippet(snippet, childIndent);
    const separator = beforeHeadClose.endsWith("\n") ? "" : "\n";
    const closeTagAndRest = html.slice(indentedCloseMatch.index + closePrefix.length);
    return `${beforeHeadClose}${separator}${formattedSnippet}${closePrefix}${closeTagAndRest}`;
  }

  const closeMatch = /<\/head>/i.exec(html);
  if (closeMatch) {
    const beforeHeadClose = html.slice(0, closeMatch.index);
    const leadingBreak = beforeHeadClose.endsWith("\n") ? "" : "\n";
    return `${beforeHeadClose}${leadingBreak}${snippet}\n${html.slice(closeMatch.index)}`;
  }

  const match = /<head\b[^>]*>/i.exec(html);
  if (!match) {
    return undefined;
  }

  const insertionPoint = match.index + match[0].length;
  return `${html.slice(0, insertionPoint)}\n${snippet}\n${html.slice(insertionPoint)}`;
}

function reindentHeadSnippet(snippet: string, childIndent: string): string {
  return snippet
    .split("\n")
    .map((line) => {
      if (line.length === 0) {
        return line;
      }

      return line.startsWith("  ") ? `${childIndent}${line.slice(2)}` : `${childIndent}${line}`;
    })
    .join("\n");
}

function nextAppGeneratedRoutePath(
  context: PreviewContext,
  action: FixPlanAction,
  route: "robots" | "sitemap",
): string | undefined {
  const fromAction = action.targetFiles.find((path) => path === `src/app/${route}.ts` || path === `app/${route}.ts`);
  if (fromAction) {
    return fromAction;
  }

  const appRoot = detectNextAppRoot(context);
  return appRoot ? `${appRoot.root}/${route}.ts` : undefined;
}

function nextAppLayoutPath(context: PreviewContext, action: FixPlanAction): string | undefined {
  const targetLayout = action.targetFiles.find((path) => /^src\/app\/layout\.(tsx|jsx|ts|js)$/.test(path) || /^app\/layout\.(tsx|jsx|ts|js)$/.test(path));
  if (targetLayout) {
    return targetLayout;
  }

  return detectNextAppRoot(context)?.layoutPath;
}

function detectNextAppRoot(context: PreviewContext): NextAppRoot | undefined {
  for (const root of ["src/app", "app"] as const) {
    for (const extension of ["tsx", "jsx", "ts", "js"]) {
      const layoutPath = `${root}/layout.${extension}`;
      if (relativeFileExists(context, layoutPath)) {
        return { root, layoutPath };
      }
    }
  }

  for (const root of ["src/app", "app"] as const) {
    if (relativeDirectoryExists(context, root)) {
      return { root };
    }
  }

  return undefined;
}

function readCurrentFile(
  context: PreviewContext,
  path: string,
): { exists: boolean; before?: string; current?: string } {
  const existingChange = context.changes.get(path);
  if (existingChange) {
    return {
      exists: existingChange.changeType === "update",
      before: existingChange.before,
      current: existingChange.after,
    };
  }

  const absolutePath = safeResolve(context.repoRoot, path);
  if (!absolutePath || !existsSync(absolutePath)) {
    return { exists: false };
  }

  const stats = statSync(absolutePath);
  if (!stats.isFile() || stats.size > MAX_PREVIEW_FILE_BYTES) {
    return { exists: false };
  }

  const before = readFileSync(absolutePath, "utf8");
  return { exists: true, before, current: before };
}

function relativeFileExists(context: PreviewContext, path: string): boolean {
  const absolutePath = safeResolve(context.repoRoot, path);
  if (!absolutePath || !existsSync(absolutePath)) {
    return false;
  }

  return statSync(absolutePath).isFile();
}

function relativeDirectoryExists(context: PreviewContext, path: string): boolean {
  const absolutePath = safeResolve(context.repoRoot, path);
  if (!absolutePath || !existsSync(absolutePath)) {
    return false;
  }

  return statSync(absolutePath).isDirectory();
}

function recordFileChange(
  context: PreviewContext,
  input: {
    path: string;
    before?: string;
    after: string;
    reason: string;
    action: FixPlanAction;
    risk: FixPlanRisk;
    requiresHumanReview: boolean;
  },
): void {
  if (input.before === input.after) {
    return;
  }

  const existing = context.changes.get(input.path);
  if (!existing) {
    if (input.requiresHumanReview) {
      context.safetyNotes.add("Review generated changes before applying.");
    }

    context.changes.set(input.path, {
      path: input.path,
      changeType: input.before === undefined ? "create" : "update",
      reason: input.reason,
      reasons: new Set([input.reason]),
      sourceActionIds: new Set([input.action.id]),
      risk: input.risk,
      requiresHumanReview: input.requiresHumanReview,
      before: input.before,
      after: input.after,
    });
    return;
  }

  existing.after = input.after;
  existing.risk = strongerRisk(existing.risk, input.risk);
  existing.requiresHumanReview = existing.requiresHumanReview || input.requiresHumanReview;
  if (input.requiresHumanReview) {
    context.safetyNotes.add("Review generated changes before applying.");
  }
  existing.sourceActionIds.add(input.action.id);
  existing.reasons.add(input.reason);
  existing.reason = Array.from(existing.reasons).join(" ");
}

function finalizeFileChange(change: MutableFileChange): DryRunFileChange {
  const sourceActionIds = Array.from(change.sourceActionIds).sort();
  return {
    path: change.path,
    changeType: change.changeType,
    reason: change.reason,
    sourceActionIds,
    risk: change.risk,
    requiresHumanReview: change.requiresHumanReview,
    reviewStatus: change.requiresHumanReview ? "review_required" : "auto_candidate",
    before: change.before,
    after: change.after,
    diff: unifiedDiff(change.path, change.before, change.after),
  };
}

function skipAllActions(
  context: PreviewContext,
  reasonKind: SkippedFixAction["reasonKind"],
  reason: string,
): void {
  for (const action of context.plan.actions) {
    skipAction(context, action, reasonKind, reason);
  }
}

function skipUnsupportedKnownAction(context: PreviewContext, action: FixPlanAction): void {
  if (action.id.endsWith(".heading")) {
    skipAction(context, action, "requires_more_information", "H1 review is a content change and requires human review.");
    return;
  }

  if (action.id.endsWith(".metadata_review")) {
    skipAction(
      context,
      action,
      "requires_more_information",
      "Weak or risky metadata changes require human-authored copy review; dry-run only previews deterministic missing-tag inserts.",
    );
    return;
  }

  if (action.id.endsWith(".image_alt") || action.id.endsWith(".link_text")) {
    skipAction(context, action, "requires_more_information", "Accessibility text changes require human-authored content.");
    return;
  }

  if (action.category === "manual_recommendation" || !action.futureAutomation.canAutomate) {
    skipAction(context, action, "unsafe", action.futureAutomation.reason);
    return;
  }

  skipAction(context, action, "not_in_scope", "This action is not eligible for patch preview in the first dry-run pass.");
}

function skipAction(
  context: PreviewContext,
  action: FixPlanAction,
  reasonKind: SkippedFixAction["reasonKind"],
  reason: string,
): void {
  context.skippedActions.push({
    actionId: action.id,
    title: action.title,
    reasonKind,
    reason,
    sourceActionIds: action.sourceCheckIds,
    risk: action.risk,
  });
}

function staticHtmlTargetForUrl(finalUrl: string, targetFiles: string[]): string | undefined {
  const routePath = staticHtmlPathForUrl(finalUrl);
  if (targetFiles.includes(routePath)) {
    return routePath;
  }

  if (routePath.endsWith("/index.html")) {
    const flatPath = routePath.replace(/\/index\.html$/, ".html");
    if (targetFiles.includes(flatPath)) {
      return flatPath;
    }
  }

  if (targetFiles.includes("index.html")) {
    return "index.html";
  }

  return targetFiles.find((path) => path.endsWith(".html"));
}

function staticHtmlPathForUrl(finalUrl: string): string {
  const url = new URL(finalUrl);
  const decoded = decodeURIComponent(url.pathname);
  const trimmed = decoded.replace(/^\/+/, "").replace(/\/+$/, "");
  if (!trimmed) {
    return "index.html";
  }

  if (trimmed.endsWith(".html")) {
    return trimmed;
  }

  return `${trimmed}.html`;
}

function recommendedNextStep(
  plan: FixPlanResult,
  fileChanges: DryRunFileChange[],
  skippedActions: SkippedFixAction[],
): DryRunFixResult["recommendedNextStep"] {
  if (fileChanges.length > 0) {
    return "review_patch_preview";
  }

  if (plan.recommendedNextStep === "no_changes_needed") {
    return "no_changes_needed";
  }

  if (plan.repoSummary.frameworkId === "unknown") {
    return "unsupported_project";
  }

  if (skippedActions.some((action) => action.reasonKind === "unsupported")) {
    return "unsupported_project";
  }

  return "manual_review_required";
}

function safeResolve(repoRoot: string, relativePath: string): string | undefined {
  if (relativePath.startsWith("/") || relativePath.split("/").includes("..")) {
    return undefined;
  }

  const resolved = resolve(repoRoot, relativePath);
  if (resolved !== repoRoot && !resolved.startsWith(`${repoRoot}/`)) {
    return undefined;
  }

  return resolved;
}

function unifiedDiff(path: string, before: string | undefined, after: string): string {
  if (before === undefined) {
    return [
      "--- /dev/null",
      `+++ ${path}`,
      "@@",
      ...after.split("\n").map((line) => `+${line}`),
    ].join("\n");
  }

  const beforeLines = before.split("\n");
  const afterLines = after.split("\n");
  const prefixLineCount = commonPrefixLineCount(beforeLines, afterLines);
  const suffixLineCount = commonSuffixLineCount(beforeLines, afterLines, prefixLineCount);
  const contextLines = 3;
  const beforeChangeStart = prefixLineCount;
  const beforeChangeEnd = beforeLines.length - suffixLineCount;
  const afterChangeStart = prefixLineCount;
  const afterChangeEnd = afterLines.length - suffixLineCount;
  const beforeHunkStart = Math.max(0, beforeChangeStart - contextLines);
  const afterHunkStart = Math.max(0, afterChangeStart - contextLines);
  const beforeHunkEnd = Math.min(beforeLines.length, beforeChangeEnd + contextLines);
  const afterHunkEnd = Math.min(afterLines.length, afterChangeEnd + contextLines);
  const beforeHunkLength = beforeHunkEnd - beforeHunkStart;
  const afterHunkLength = afterHunkEnd - afterHunkStart;
  const lines = [
    `--- ${path}`,
    `+++ ${path}`,
    `@@ -${beforeHunkStart + 1},${beforeHunkLength} +${afterHunkStart + 1},${afterHunkLength} @@`,
  ];

  for (let index = beforeHunkStart; index < beforeChangeStart; index += 1) {
    lines.push(` ${beforeLines[index]}`);
  }

  for (let index = beforeChangeStart; index < beforeChangeEnd; index += 1) {
    lines.push(`-${beforeLines[index]}`);
  }

  for (let index = afterChangeStart; index < afterChangeEnd; index += 1) {
    lines.push(`+${afterLines[index]}`);
  }

  for (let index = beforeChangeEnd; index < beforeHunkEnd; index += 1) {
    lines.push(` ${beforeLines[index]}`);
  }

  if (lines.length > 3) {
    return lines.join("\n");
  }

  return [
    `--- ${path}`,
    `+++ ${path}`,
    "@@",
    ...beforeLines.map((line) => `-${line}`),
    ...afterLines.map((line) => `+${line}`),
  ].join("\n");
}

function commonPrefixLineCount(beforeLines: string[], afterLines: string[]): number {
  const maxLength = Math.min(beforeLines.length, afterLines.length);
  let index = 0;
  while (index < maxLength && beforeLines[index] === afterLines[index]) {
    index += 1;
  }

  return index;
}

function commonSuffixLineCount(
  beforeLines: string[],
  afterLines: string[],
  prefixLineCount: number,
): number {
  const maxLength = Math.min(beforeLines.length, afterLines.length) - prefixLineCount;
  let count = 0;
  while (
    count < maxLength &&
    beforeLines[beforeLines.length - 1 - count] === afterLines[afterLines.length - 1 - count]
  ) {
    count += 1;
  }

  return count;
}

function strongerRisk(a: FixPlanRisk, b: FixPlanRisk): FixPlanRisk {
  const order: FixPlanRisk[] = ["low", "medium", "high"];
  return order.indexOf(a) > order.indexOf(b) ? a : b;
}

function escapeHtmlAttribute(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("\"", "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function escapeHtmlText(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function quoteTsString(value: string): string {
  return JSON.stringify(value);
}

function isShipReadyPlaceholder(value: string): boolean {
  return value.trim().toLowerCase().startsWith("todo:");
}

function hasUseClientDirective(source: string): boolean {
  return /^\s*["']use client["'];?/.test(source);
}

function hasGenerateMetadataExport(source: string): boolean {
  return /\bexport\s+(?:async\s+)?function\s+generateMetadata\b/.test(source) ||
    /\bexport\s+(?:const|let|var)\s+generateMetadata\b/.test(source);
}

function hasMetadataExport(source: string): boolean {
  return /\bexport\s+(?:const|let|var)\s+metadata\b/.test(source) ||
    /\bexport\s*\{[^}]*\bmetadata\b[^}]*\}/.test(source);
}

function hasNextMetadataImport(source: string): boolean {
  return /import\s+type\s+\{[^}]*\bMetadata\b[^}]*\}\s+from\s+["']next["']/.test(source) ||
    /import\s+\{[^}]*\btype\s+Metadata\b[^}]*\}\s+from\s+["']next["']/.test(source) ||
    /import\s+\{[^}]*\bMetadata\b[^}]*\}\s+from\s+["']next["']/.test(source);
}

function hasLocalMetadataBinding(source: string): boolean {
  return /\b(?:type|interface|class|const|let|var|function)\s+Metadata\b/.test(source);
}

function insertTopLevelNextMetadata(source: string, exportBlock: string, needsImport: boolean): string {
  const lines = source.split("\n");
  const insertLine = lineIndexAfterImportBlock(lines);
  const before = lines.slice(0, insertLine).join("\n").trimEnd();
  const after = lines.slice(insertLine).join("\n").trimStart();
  const statements = needsImport
    ? `import type { Metadata } from "next";\n\n${exportBlock}`
    : exportBlock;

  if (before.length === 0) {
    return after.length === 0 ? `${statements}\n` : `${statements}\n\n${after}`;
  }

  return after.length === 0
    ? `${before}\n\n${statements}\n`
    : `${before}\n\n${statements}\n\n${after}`;
}

function lineIndexAfterImportBlock(lines: string[]): number {
  let index = 0;
  let lastImportLine = -1;
  let inImport = false;

  while (index < lines.length) {
    const trimmed = lines[index]?.trim() ?? "";
    if (inImport) {
      lastImportLine = index;
      if (trimmed.endsWith(";")) {
        inImport = false;
      }
      index += 1;
      continue;
    }

    if (trimmed.length === 0 && lastImportLine === -1) {
      index += 1;
      continue;
    }

    if (trimmed.startsWith("import ")) {
      lastImportLine = index;
      inImport = !trimmed.endsWith(";");
      index += 1;
      continue;
    }

    if (trimmed.length === 0 && lastImportLine !== -1) {
      index += 1;
      continue;
    }

    break;
  }

  return lastImportLine === -1 ? 0 : index;
}
