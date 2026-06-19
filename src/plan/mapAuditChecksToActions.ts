import type { AuditCheck, AuditResult } from "../types/audit";
import type {
  FixPlanAction,
  FixPlanCategory,
  FixPlanConfidence,
  FixPlanPriority,
  FixPlanRisk,
  NoActionCheck,
} from "../types/fixPlan";
import type { FrameworkId, MetadataLocation, RepoInspectionResult } from "../types/repoInspection";

type ActionDraft = Omit<FixPlanAction, "sourceCheckIds"> & {
  sourceCheckIds: Set<string>;
};

const REQUIRED_METADATA_CHECKS = new Set([
  "metadata.title.missing",
  "metadata.description.missing",
  "metadata.canonical.missing",
  "social.og.title_missing",
  "social.og.description_missing",
  "social.og.image_missing",
  "social.og.url_missing",
  "social.og.type_missing",
  "social.twitter.card_missing",
  "social.twitter.title_missing",
  "social.twitter.description_missing",
  "social.twitter.image_missing",
]);

const WEAK_METADATA_CHECKS = new Set([
  "metadata.title.too_short",
  "metadata.title.too_long",
  "metadata.title.generic",
  "metadata.description.too_short",
  "metadata.description.too_long",
  "metadata.canonical.invalid",
  "metadata.canonical.host_mismatch",
  "metadata.robots.noindex",
  "metadata.robots.nofollow",
  "metadata.lang.missing",
  "metadata.lang.invalid",
  "metadata.viewport.missing",
  "metadata.favicon.missing",
]);

const JSON_LD_CHECKS = new Set([
  "schema.jsonld.missing",
  "schema.jsonld.invalid_json",
  "schema.jsonld.context_missing",
  "schema.jsonld.type_missing",
]);

const H1_CHECKS = new Set([
  "structure.h1.missing",
  "structure.h1.multiple",
  "structure.h1.generic",
]);

export function mapAuditChecksToActions(
  audit: AuditResult,
  repo: RepoInspectionResult,
): { actions: FixPlanAction[]; noActionChecks: NoActionCheck[]; optionalNotes: string[] } {
  const drafts: ActionDraft[] = [];
  const actionableChecks = audit.checks.filter(
    (check) => check.severity === "critical" || check.severity === "warning",
  );

  for (const check of actionableChecks) {
    const draft = draftForCheck(check, audit, repo);
    if (draft) {
      mergeDraft(drafts, draft, check.id);
    }
  }

  return {
    actions: drafts.map(finalizeDraft),
    noActionChecks: audit.checks
      .filter((check) => check.severity === "passed")
      .map((check) => ({
        checkId: check.id,
        title: check.title,
        reason: "This audit check passed, so ShipReady is not proposing a change.",
      })),
    optionalNotes: audit.checks
      .filter((check) => check.severity === "info")
      .map((check) => `${check.title}: ${check.description}`),
  };
}

function draftForCheck(
  check: AuditCheck,
  audit: AuditResult,
  repo: RepoInspectionResult,
): ActionDraft | undefined {
  const frameworkId = repo.framework.id;

  if (REQUIRED_METADATA_CHECKS.has(check.id)) {
    return metadataDraft(check, repo, "missing");
  }

  if (WEAK_METADATA_CHECKS.has(check.id)) {
    return metadataDraft(check, repo, "weak");
  }

  if (JSON_LD_CHECKS.has(check.id)) {
    return jsonLdDraft(check, repo);
  }

  if (check.id === "crawl.robots_txt.missing" || check.id === "crawl.robots_txt.blocks_page") {
    return robotsDraft(check, repo);
  }

  if (check.id === "crawl.sitemap.missing" || check.id === "crawl.sitemap.invalid" || check.id === "crawl.sitemap.url_missing") {
    return sitemapDraft(check, audit, repo);
  }

  if (
    check.id === "crawl.raw_render.title_description_render_only" ||
    check.id === "crawl.raw_render.metadata_render_only" ||
    check.id === "crawl.raw_render.canonical_changed"
  ) {
    return renderOnlyDraft(check, repo);
  }

  if (H1_CHECKS.has(check.id)) {
    return contentSemanticsDraft(check, repo, "heading");
  }

  if (check.id === "a11y.image.alt_missing") {
    return contentSemanticsDraft(check, repo, "image_alt");
  }

  if (check.id === "a11y.link.text_missing") {
    return contentSemanticsDraft(check, repo, "link_text");
  }

  if (frameworkId === "unknown") {
    return manualUnknownDraft(check, repo);
  }

  return manualUnknownDraft(check, repo);
}

function metadataDraft(
  check: AuditCheck,
  repo: RepoInspectionResult,
  mode: "missing" | "weak",
): ActionDraft {
  const frameworkId = repo.framework.id;
  const targetFiles = metadataTargetFiles(repo);
  const targetLocations = metadataTargetLocations(repo);

  if (frameworkId === "static_html" && mode === "missing") {
    return draft({
      id: "metadata.static_html_head",
      title: "Add missing static metadata",
      description: "Add missing title, description, canonical, and share-preview tags to the HTML head.",
      category: "safe_automated_later",
      priority: priorityFromCheck(check),
      risk: "low",
      confidence: confidenceFromRepo(repo),
      frameworkStrategy: "Update static <head> tags directly in the relevant HTML file.",
      targetFiles,
      targetLocations,
      canAutomate: true,
      requiresHumanReview: false,
      automationReason: "Static HTML head tags can usually be inserted deterministically when the target page is clear.",
    });
  }

  if (frameworkId === "unknown") {
    return manualUnknownDraft(check, repo);
  }

  const title =
    mode === "missing"
      ? metadataActionTitle(frameworkId)
      : "Review and improve weak metadata";

  return draft({
    id: `${frameworkId}.metadata_review`,
    title,
    description:
      mode === "missing"
        ? "Add missing metadata in the framework's server-visible metadata surface."
        : "Review weak or risky metadata before changing production copy or crawler signals.",
    category: "automated_with_review",
    priority: priorityFromCheck(check),
    risk: "medium",
    confidence: confidenceFromRepo(repo),
    frameworkStrategy: metadataStrategy(frameworkId),
    targetFiles,
    targetLocations,
    canAutomate: true,
    requiresHumanReview: true,
    automationReason: "Metadata changes affect production copy and crawler/share-preview signals, so generated changes should be reviewed.",
  });
}

function jsonLdDraft(check: AuditCheck, repo: RepoInspectionResult): ActionDraft {
  if (repo.framework.id === "unknown") {
    return manualUnknownDraft(check, repo);
  }

  return draft({
    id: `${repo.framework.id}.json_ld_review`,
    title: check.id === "schema.jsonld.invalid_json" ? "Fix invalid JSON-LD" : "Add JSON-LD with review",
    description: "Add or fix conservative structured data only after confirming schema type and business facts.",
    category: "automated_with_review",
    priority: priorityFromCheck(check, "medium"),
    risk: "medium",
    confidence: confidenceFromRepo(repo),
    frameworkStrategy: jsonLdStrategy(repo.framework.id),
    targetFiles: metadataTargetFiles(repo),
    targetLocations: metadataTargetLocations(repo),
    canAutomate: true,
    requiresHumanReview: true,
    automationReason: "Structured data must be factually accurate; ShipReady should not invent schema facts without review.",
  });
}

function robotsDraft(check: AuditCheck, repo: RepoInspectionResult): ActionDraft {
  if (repo.framework.id === "unknown") {
    return manualUnknownDraft(check, repo);
  }

  const safeRepo = repo.framework.confidence === "high" || repo.framework.id === "static_html";
  const safe = safeRepo && check.id === "crawl.robots_txt.missing";
  return draft({
    id: `${repo.framework.id}.robots`,
    title: robotsTitle(repo.framework.id),
    description:
      check.id === "crawl.robots_txt.blocks_page"
        ? "Review robots rules because the deployed site appears to block the audited page."
        : "Add a robots file or framework route so crawlers can discover the intended crawl policy.",
    category: safe ? "safe_automated_later" : "automated_with_review",
    priority: check.id === "crawl.robots_txt.blocks_page" ? "critical" : "medium",
    risk: check.id === "crawl.robots_txt.blocks_page" ? "medium" : "low",
    confidence: confidenceFromRepo(repo),
    frameworkStrategy: robotsStrategy(repo.framework.id),
    targetFiles: crawlTargetFiles(repo, "robots"),
    targetLocations: crawlTargetLocations(repo, "robots"),
    canAutomate: safe,
    requiresHumanReview: !safe,
    automationReason: safe
      ? "The framework and likely robots target are clear."
      : "Crawler-blocking rules or lower-confidence repo detection should be reviewed before changing crawl policy.",
  });
}

function sitemapDraft(check: AuditCheck, audit: AuditResult, repo: RepoInspectionResult): ActionDraft {
  if (repo.framework.id === "unknown") {
    return manualUnknownDraft(check, repo);
  }

  const safeRepo = repo.framework.confidence === "high" || repo.framework.id === "static_html";
  const safe = safeRepo && check.id === "crawl.sitemap.missing";
  const canAutomateWithReview = safe || safeRepo;
  return draft({
    id: `${repo.framework.id}.sitemap`,
    title: sitemapTitle(repo.framework.id, check.id),
    description:
      check.id === "crawl.sitemap.url_missing"
        ? "Update the sitemap so it includes the audited URL."
        : check.id === "crawl.sitemap.invalid"
          ? "Replace the invalid sitemap response with a valid sitemap."
        : "Add a sitemap so crawlers can discover the public URL set.",
    category: safe ? "safe_automated_later" : "automated_with_review",
    priority: check.id === "crawl.sitemap.url_missing" ? "medium" : "high",
    risk: "low",
    confidence: confidenceFromRepo(repo),
    frameworkStrategy: `${sitemapStrategy(repo.framework.id)} Use audited URL ${audit.finalUrl}.`,
    targetFiles: crawlTargetFiles(repo, "sitemap"),
    targetLocations: crawlTargetLocations(repo, "sitemap"),
    canAutomate: canAutomateWithReview,
    requiresHumanReview: !safe,
    automationReason: safe
      ? "The framework and likely sitemap target are clear."
      : "The URL set or lower-confidence repo detection should be reviewed before generating sitemap changes.",
  });
}

function renderOnlyDraft(check: AuditCheck, repo: RepoInspectionResult): ActionDraft {
  const frameworkId = repo.framework.id;
  if (frameworkId === "unknown") {
    return manualUnknownDraft(check, repo, {
      priority: "high",
      risk: "high",
      title: "Review server-rendered metadata strategy",
    });
  }

  if (frameworkId === "vite_react") {
    return draft({
      id: "vite_react.rendering_strategy",
      title: "Review rendering or prerendering strategy",
      description: "Key metadata appears only after JavaScript rendering; client-side injection is not enough for every crawler or preview bot.",
      category: "manual_recommendation",
      priority: "high",
      risk: "high",
      confidence: confidenceFromRepo(repo),
      frameworkStrategy: "Consider prerendering, SSG, SSR, or static fallback metadata instead of relying only on client-side metadata.",
      targetFiles: metadataTargetFiles(repo),
      targetLocations: metadataTargetLocations(repo),
      canAutomate: false,
      requiresHumanReview: true,
      automationReason: "Changing rendering architecture is not safe to automate in this planning pass.",
    });
  }

  return draft({
    id: `${frameworkId}.server_metadata`,
    title: "Move key metadata into server-visible output",
    description: "Some metadata is missing from raw HTML and appears only after rendering.",
    category: "automated_with_review",
    priority: "high",
    risk: "medium",
    confidence: confidenceFromRepo(repo),
    frameworkStrategy: metadataStrategy(frameworkId),
    targetFiles: metadataTargetFiles(repo),
    targetLocations: metadataTargetLocations(repo),
    canAutomate: true,
    requiresHumanReview: true,
    automationReason: "Server-visible metadata changes are framework-specific and should be reviewed before patching.",
  });
}

function contentSemanticsDraft(
  check: AuditCheck,
  repo: RepoInspectionResult,
  kind: "heading" | "image_alt" | "link_text",
): ActionDraft {
  const title =
    kind === "heading"
      ? "Review page heading structure"
      : kind === "image_alt"
        ? "Review image alt text"
        : "Review link accessible text";

  return draft({
    id: `${repo.framework.id}.${kind}`,
    title,
    description: check.description,
    category: repo.framework.id === "unknown" ? "manual_recommendation" : "automated_with_review",
    priority: priorityFromCheck(check, "medium"),
    risk: "medium",
    confidence: confidenceFromRepo(repo),
    frameworkStrategy: "Locate the relevant page or component and make semantic/content changes with review.",
    targetFiles: routeTargetFiles(repo),
    targetLocations: repo.routes.map((route) => route.path),
    canAutomate: repo.framework.id !== "unknown",
    requiresHumanReview: true,
    automationReason: "Content and accessibility text changes require human review for accuracy.",
  });
}

function manualUnknownDraft(
  check: AuditCheck,
  repo: RepoInspectionResult,
  overrides: Partial<Pick<ActionDraft, "priority" | "risk" | "title">> = {},
): ActionDraft {
  return draft({
    id: `manual.${check.id}`,
    title: overrides.title ?? `Manual review: ${check.title}`,
    description: check.description,
    category: "manual_recommendation",
    priority: overrides.priority ?? priorityFromCheck(check),
    risk: overrides.risk ?? "high",
    confidence: "low",
    frameworkStrategy: "Inspect the project manually before planning automated changes.",
    targetFiles: [],
    targetLocations: repo.metadataLocations.map((location) => location.path),
    canAutomate: false,
    requiresHumanReview: true,
    automationReason: "The project framework or target files are not clear enough for automation.",
  });
}

function draft(input: {
  id: string;
  title: string;
  description: string;
  category: FixPlanCategory;
  priority: FixPlanPriority;
  risk: FixPlanRisk;
  confidence: FixPlanConfidence;
  frameworkStrategy: string;
  targetFiles: string[];
  targetLocations: string[];
  canAutomate: boolean;
  requiresHumanReview: boolean;
  automationReason: string;
}): ActionDraft {
  return {
    id: input.id,
    title: input.title,
    description: input.description,
    sourceCheckIds: new Set(),
    category: input.category,
    priority: input.priority,
    risk: input.risk,
    confidence: input.confidence,
    frameworkStrategy: input.frameworkStrategy,
    targetFiles: Array.from(new Set(input.targetFiles)),
    targetLocations: Array.from(new Set(input.targetLocations)),
    futureAutomation: {
      canAutomate: input.canAutomate,
      requiresHumanReview: input.requiresHumanReview,
      reason: input.automationReason,
    },
  };
}

function mergeDraft(drafts: ActionDraft[], next: ActionDraft, checkId: string): void {
  const existing = drafts.find((draftItem) => draftItem.id === next.id);
  if (!existing) {
    next.sourceCheckIds.add(checkId);
    drafts.push(next);
    return;
  }

  existing.sourceCheckIds.add(checkId);
  existing.priority = strongerPriority(existing.priority, next.priority);
  existing.risk = strongerRisk(existing.risk, next.risk);
  existing.targetFiles = Array.from(new Set([...existing.targetFiles, ...next.targetFiles]));
  existing.targetLocations = Array.from(new Set([...existing.targetLocations, ...next.targetLocations]));
}

function finalizeDraft(draftItem: ActionDraft): FixPlanAction {
  return {
    ...draftItem,
    sourceCheckIds: Array.from(draftItem.sourceCheckIds).sort(),
  };
}

function priorityFromCheck(check: AuditCheck, warningDefault: FixPlanPriority = "medium"): FixPlanPriority {
  if (check.severity === "critical") {
    return "critical";
  }
  return warningDefault;
}

function confidenceFromRepo(repo: RepoInspectionResult): FixPlanConfidence {
  return repo.framework.confidence;
}

function strongerPriority(a: FixPlanPriority, b: FixPlanPriority): FixPlanPriority {
  const order: FixPlanPriority[] = ["low", "medium", "high", "critical"];
  return order.indexOf(a) > order.indexOf(b) ? a : b;
}

function strongerRisk(a: FixPlanRisk, b: FixPlanRisk): FixPlanRisk {
  const order: FixPlanRisk[] = ["low", "medium", "high"];
  return order.indexOf(a) > order.indexOf(b) ? a : b;
}

function metadataTargetFiles(repo: RepoInspectionResult): string[] {
  if (repo.framework.id === "static_html") {
    return repo.metadataLocations
      .filter((location) => location.path.endsWith(".html"))
      .map((location) => location.path)
      .slice(0, 5);
  }

  const existing = repo.metadataLocations
    .filter((location) => location.exists && location.kind !== "directory")
    .map((location) => location.path);

  if (existing.length > 0) {
    return existing.slice(0, 5);
  }

  if (repo.framework.id === "next_app_router") {
    return firstLikely(repo.metadataLocations, ["layout.tsx", "layout.jsx", "page.tsx"]) ?? [];
  }

  if (repo.framework.id === "vite_react") {
    return firstLikely(repo.metadataLocations, ["index.html"]) ?? [];
  }

  return repo.metadataLocations
    .filter((location) => location.kind === "file")
    .map((location) => location.path)
    .slice(0, 5);
}

function metadataTargetLocations(repo: RepoInspectionResult): string[] {
  return repo.metadataLocations.map((location) => location.path).slice(0, 8);
}

function routeTargetFiles(repo: RepoInspectionResult): string[] {
  return repo.routes.map((route) => route.path).slice(0, 5);
}

function crawlTargetFiles(repo: RepoInspectionResult, kind: "robots" | "sitemap"): string[] {
  const needle = kind === "robots" ? "robots" : "sitemap";
  return repo.metadataLocations
    .filter((location) => location.path.includes(needle))
    .map((location) => location.path)
    .slice(0, 3);
}

function crawlTargetLocations(repo: RepoInspectionResult, kind: "robots" | "sitemap"): string[] {
  const files = crawlTargetFiles(repo, kind);
  return files.length > 0 ? files : metadataTargetLocations(repo);
}

function firstLikely(locations: MetadataLocation[], suffixes: string[]): string[] | undefined {
  const match = locations.find((location) => suffixes.some((suffix) => location.path.includes(suffix)));
  return match ? [match.path] : undefined;
}

function metadataActionTitle(frameworkId: FrameworkId): string {
  if (frameworkId === "next_app_router") return "Add or update root metadata export";
  if (frameworkId === "next_pages_router") return "Add or update next/head metadata";
  if (frameworkId === "vite_react") return "Add fallback metadata to index.html";
  if (frameworkId === "astro") return "Add or update Astro metadata";
  if (frameworkId === "remix") return "Add or update Remix meta exports";
  return "Add missing metadata";
}

function metadataStrategy(frameworkId: FrameworkId): string {
  if (frameworkId === "next_app_router") return "Use App Router metadata exports, route-level metadata, or generateMetadata in server-rendered files.";
  if (frameworkId === "next_pages_router") return "Use next/head in route files or shared layout wrappers without duplicating existing tags.";
  if (frameworkId === "vite_react") return "Update index.html for crawler-visible fallback metadata; route-specific metadata may need prerendering or SSR.";
  if (frameworkId === "astro") return "Update layout-level or page-level .astro metadata.";
  if (frameworkId === "remix") return "Update root or route meta exports.";
  if (frameworkId === "static_html") return "Edit static HTML head tags directly.";
  return "Manual project-specific metadata strategy required.";
}

function jsonLdStrategy(frameworkId: FrameworkId): string {
  if (frameworkId === "next_app_router") return "Add a reviewed JSON-LD script or component in an App Router layout/page.";
  if (frameworkId === "next_pages_router") return "Add a reviewed JSON-LD script through next/head or the relevant page.";
  if (frameworkId === "vite_react") return "Add static JSON-LD only when it accurately describes the app shell.";
  if (frameworkId === "astro") return "Add reviewed JSON-LD in the page or shared layout.";
  if (frameworkId === "remix") return "Add reviewed JSON-LD in root or route modules.";
  if (frameworkId === "static_html") return "Add reviewed JSON-LD script tags to the HTML head.";
  return "Manual schema strategy required.";
}

function robotsTitle(frameworkId: FrameworkId): string {
  return frameworkId === "next_app_router" ? "Add robots.ts" : "Add robots.txt";
}

function sitemapTitle(frameworkId: FrameworkId, checkId: string): string {
  if (checkId === "crawl.sitemap.missing") {
    return frameworkId === "next_app_router" ? "Add sitemap.ts" : "Add sitemap.xml";
  }
  return frameworkId === "next_app_router" ? "Update sitemap.ts" : "Update sitemap.xml";
}

function robotsStrategy(frameworkId: FrameworkId): string {
  if (frameworkId === "next_app_router") return "Add an App Router robots.ts route.";
  if (frameworkId === "static_html") return "Add a root robots.txt file.";
  return "Add a public robots.txt file using the framework's static asset convention.";
}

function sitemapStrategy(frameworkId: FrameworkId): string {
  if (frameworkId === "next_app_router") return "Add an App Router sitemap.ts route.";
  if (frameworkId === "static_html") return "Add a root sitemap.xml file.";
  return "Add a public sitemap.xml file using the framework's static asset convention.";
}
