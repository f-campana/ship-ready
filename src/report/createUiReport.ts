import { resolve } from "node:path";
import { auditUrl, type AuditUrlOptions } from "../audit/auditUrl";
import { dryRunFixFromPlan } from "../fix/dryRunFix";
import { validateWriteCandidates } from "../fix/writeFix";
import { planFixesFromResults } from "../plan/planFixes";
import { inspectRepo, type InspectRepoOptions } from "../repo/inspectRepo";
import type { AuditCheck, AuditResult, ExtractedPageMetadata } from "../types/audit";
import type { DryRunFileChange, DryRunFixResult, SkippedFixAction } from "../types/dryRunFix";
import type { FixPlanAction, FixPlanResult } from "../types/fixPlan";
import type { RepoInspectionResult } from "../types/repoInspection";
import {
  type UiActionGroups,
  type UiError,
  type UiFixAction,
  type UiIssue,
  type UiLiveVsLocalState,
  type UiNextAction,
  type UiPatchPreviewSummary,
  type UiPreviewCards,
  type UiPreviewSource,
  type UiProjectSummary,
  type UiReadiness,
  type UiReport,
  type UiSafeApplySummary,
  type UiWorkflow,
  type UiWorkflowStage,
} from "../types/uiReport";
import { WRITE_POLICY_V1 } from "../types/writeFix";
import { normalizeAuditUrl } from "../utils/url";

export type CreateUiReportInput = AuditUrlOptions & {
  url: string;
  repoPath?: string;
  repo?: InspectRepoOptions;
  generatedAt?: string;
};

export type CreateUiReportFromResultsInput = {
  url: string;
  repoPath?: string;
  generatedAt?: string;
  audit?: AuditResult;
  repoInspection?: RepoInspectionResult;
  fixPlan?: FixPlanResult;
  dryRun?: DryRunFixResult;
  errors?: UiError[];
  repoRoot?: string;
};

type ValueCandidate = {
  field: string;
  value?: string;
  source: UiPreviewSource;
};

type SelectedValue = {
  field: string;
  value?: string;
  source?: UiPreviewSource;
};

type WriteEligibility = {
  eligiblePaths: Set<string>;
  blockReasons: Map<string, string>;
};

const FRIENDLY_COPY: Record<string, { title: string; explanation: string; whyItMatters: string }> = {
  "metadata.canonical.missing": {
    title: "Search engines do not have a clear preferred URL.",
    explanation:
      "This page is missing a canonical URL, which helps search engines understand the main address for this content.",
    whyItMatters:
      "Without it, duplicate or alternate URLs can be harder to consolidate.",
  },
  "crawl.sitemap.invalid": {
    title: "Your sitemap address does not return a real sitemap.",
    explanation:
      "The sitemap URL exists, but it appears to return a normal app page instead of sitemap XML.",
    whyItMatters:
      "A valid sitemap helps crawlers discover the pages you want indexed.",
  },
  "schema.jsonld.missing": {
    title: "Your site does not describe itself in structured data yet.",
    explanation:
      "Structured data helps search and AI tools understand what your site represents.",
    whyItMatters:
      "This is useful for clarity, but it usually needs factual review before ShipReady should write it.",
  },
  "crawl.raw_render.title_description_render_only": {
    title: "Some page information appears only after the app loads.",
    explanation:
      "The browser can see this information after JavaScript runs, but some preview bots may only read the first HTML response.",
    whyItMatters:
      "This can make link previews or crawler interpretation less reliable.",
  },
  "crawl.raw_render.metadata_render_only": {
    title: "Some page information appears only after the app loads.",
    explanation:
      "The browser can see this information after JavaScript runs, but some preview bots may only read the first HTML response.",
    whyItMatters:
      "This can make link previews or crawler interpretation less reliable.",
  },
  "crawl.raw_render.canonical_changed": {
    title: "Crawler-visible metadata changes after the app loads.",
    explanation:
      "The canonical URL in the first HTML response does not match what the rendered browser view sees.",
    whyItMatters:
      "Preview bots and search crawlers can interpret the page differently when raw and rendered metadata disagree.",
  },
  "crawl.robots_txt.missing": {
    title: "Your site does not have crawl instructions yet.",
    explanation:
      "A robots file gives crawlers basic instructions and can point them to your sitemap.",
    whyItMatters:
      "For supported projects, ShipReady can safely create this file without changing existing code.",
  },
  "crawl.sitemap.missing": {
    title: "Your site does not have a sitemap yet.",
    explanation:
      "A sitemap lists the pages you want crawlers to discover.",
    whyItMatters:
      "For supported projects, ShipReady can safely create a simple sitemap file.",
  },
  "metadata.title.missing": {
    title: "The page title is missing from the first HTML response.",
    explanation:
      "The initial HTML does not include a page title that crawlers and preview bots can read immediately.",
    whyItMatters:
      "Titles are a primary signal for browser tabs, search results, and link previews.",
  },
  "metadata.description.missing": {
    title: "The page description is missing from the first HTML response.",
    explanation:
      "The initial HTML does not include a meta description that crawlers and preview bots can read immediately.",
    whyItMatters:
      "Descriptions help previews and search snippets explain the page before a visitor opens it.",
  },
  "social.og.image_missing": {
    title: "Shared links do not have a preview image.",
    explanation:
      "The first HTML response does not include an Open Graph image for social and messaging previews.",
    whyItMatters:
      "A preview image makes shared links easier to recognize and trust.",
  },
  "structure.h1.missing": {
    title: "The page does not have a clear main heading.",
    explanation:
      "ShipReady did not find an H1 in the page content.",
    whyItMatters:
      "A clear H1 helps visitors, assistive technology, and search engines understand the page topic.",
  },
};

const IMPORTANT_CHECKS = new Set([
  "metadata.canonical.missing",
  "metadata.canonical.invalid",
  "metadata.canonical.host_mismatch",
  "crawl.raw_render.title_description_render_only",
  "crawl.raw_render.metadata_render_only",
  "crawl.sitemap.missing",
  "crawl.sitemap.invalid",
  "crawl.sitemap.url_missing",
  "social.og.title_missing",
  "social.og.description_missing",
  "social.og.image_missing",
  "social.og.url_missing",
  "social.og.type_missing",
  "structure.h1.missing",
  "schema.jsonld.invalid_json",
]);

const RECOMMENDED_CHECKS = new Set([
  "schema.jsonld.missing",
  "schema.jsonld.context_missing",
  "schema.jsonld.type_missing",
  "social.twitter.card_missing",
  "social.twitter.title_missing",
  "social.twitter.description_missing",
  "social.twitter.image_missing",
  "metadata.title.too_short",
  "metadata.title.too_long",
  "metadata.title.generic",
  "metadata.description.too_short",
  "metadata.description.too_long",
  "metadata.lang.missing",
  "metadata.lang.invalid",
  "metadata.favicon.missing",
  "metadata.viewport.missing",
  "metadata.robots.nofollow",
  "crawl.robots_txt.missing",
  "structure.h1.multiple",
  "structure.h1.generic",
  "a11y.image.alt_missing",
  "a11y.link.text_missing",
]);

const BLOCKING_CHECKS = new Set([
  "crawl.status.non_200",
  "metadata.robots.noindex",
  "crawl.robots_txt.blocks_page",
]);

export async function createUiReport(input: CreateUiReportInput): Promise<UiReport> {
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const errors: UiError[] = [];
  let normalizedUrl: string;

  try {
    normalizedUrl = normalizeAuditUrl(input.url);
  } catch (error) {
    return createUiReportFromResults({
      url: input.url,
      repoPath: input.repoPath,
      generatedAt,
      errors: [normalizeUiError("audit", error)],
    });
  }

  let repoInspection: RepoInspectionResult | undefined;
  let repoRoot: string | undefined;
  if (input.repoPath) {
    repoRoot = resolve(input.repo?.cwd ?? process.cwd(), input.repoPath);
    try {
      repoInspection = inspectRepo(input.repoPath, input.repo);
    } catch (error) {
      errors.push(normalizeUiError("repo_inspection", error));
    }
  }

  let audit: AuditResult | undefined;
  try {
    audit = await auditUrl(normalizedUrl, {
      timeoutMs: input.timeoutMs,
      userAgent: input.userAgent,
      render: input.render,
    });
  } catch (error) {
    errors.push(normalizeUiError("audit", error));
    return createUiReportFromResults({
      url: normalizedUrl,
      repoPath: input.repoPath,
      generatedAt,
      repoInspection,
      errors,
      repoRoot,
    });
  }

  let fixPlan: FixPlanResult | undefined;
  let dryRun: DryRunFixResult | undefined;
  if (repoInspection) {
    try {
      fixPlan = planFixesFromResults(audit, repoInspection);
    } catch (error) {
      errors.push(normalizeUiError("fix_plan", error));
    }

    if (fixPlan && repoRoot) {
      try {
        dryRun = dryRunFixFromPlan(fixPlan, { repoRoot });
      } catch (error) {
        errors.push(normalizeUiError("dry_run", error));
      }
    }
  }

  return createUiReportFromResults({
    url: normalizedUrl,
    repoPath: input.repoPath,
    generatedAt,
    audit,
    repoInspection,
    fixPlan,
    dryRun,
    errors,
    repoRoot,
  });
}

export function createUiReportFromResults(input: CreateUiReportFromResultsInput): UiReport {
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const issues = input.audit?.checks.map(toUiIssue) ?? [];
  const writeEligibility = computeWriteEligibility(input.dryRun, input.repoRoot);
  const patchPreview = input.dryRun ? buildPatchPreview(input.dryRun, writeEligibility) : undefined;
  const safeApply = buildSafeApply(input.dryRun, patchPreview);
  const actionGroups = buildActionGroups({
    issues,
    fixPlan: input.fixPlan,
    dryRun: input.dryRun,
    writeEligibility,
    repoPath: input.repoPath,
    repoInspection: input.repoInspection,
    errors: input.errors ?? [],
  });
  const readiness = buildReadiness(input.audit, issues, input.errors ?? []);
  const workflow = buildWorkflow({
    audit: input.audit,
    repoPath: input.repoPath,
    repoInspection: input.repoInspection,
    fixPlan: input.fixPlan,
    dryRun: input.dryRun,
    readiness,
    actionGroups,
    safeApply,
    errors: input.errors ?? [],
  });

  return {
    schemaVersion: "ui-report-v1",
    generatedAt,
    input: {
      url: input.audit?.url ?? input.url,
      repoPath: input.repoPath,
      mode: input.repoPath ? "url_and_repo" : "url_only",
    },
    workflow,
    readiness,
    previews: buildPreviewCards(input.audit, input.url),
    project: input.repoInspection ? buildProjectSummary(input.repoInspection) : undefined,
    actionGroups,
    patchPreview,
    safeApply,
    liveVsLocal: buildLiveVsLocal(input.repoPath, input.fixPlan, input.dryRun),
    errors: input.errors ?? [],
    developerDetails: {
      rawAudit: input.audit,
      rawRepoInspection: input.repoInspection,
      rawFixPlan: input.fixPlan,
      rawDryRun: input.dryRun,
    },
  };
}

export function mapAuditCheckToUiSeverity(check: AuditCheck): UiIssue["userSeverity"] {
  if (check.severity === "passed") {
    return "ready";
  }

  if (check.id === "metadata.theme_color.missing") {
    return "optional_polish";
  }

  if (check.id === "schema.jsonld.missing") {
    return "recommended";
  }

  if (BLOCKING_CHECKS.has(check.id)) {
    return "blocking";
  }

  if (check.id === "metadata.title.missing" || check.id === "metadata.description.missing") {
    return check.severity === "critical" ? "blocking" : "important";
  }

  if (IMPORTANT_CHECKS.has(check.id)) {
    return "important";
  }

  if (RECOMMENDED_CHECKS.has(check.id)) {
    return "recommended";
  }

  if (check.severity === "critical") {
    return "important";
  }

  if (check.severity === "warning") {
    return "recommended";
  }

  return "optional_polish";
}

function toUiIssue(check: AuditCheck): UiIssue {
  const copy = FRIENDLY_COPY[check.id];
  return {
    id: check.id,
    title: copy?.title ?? check.title,
    explanation: copy?.explanation ?? check.description,
    whyItMatters:
      copy?.whyItMatters ??
      check.recommendation ??
      "This signal helps ShipReady decide whether the page is easy for crawlers, previews, and visitors to understand.",
    userSeverity: mapAuditCheckToUiSeverity(check),
    technicalSeverity: check.severity,
    sourceCheckIds: [check.id],
    developerDetails: {
      rawTitle: check.title,
      rawDescription: check.description,
      category: check.category,
      confidence: check.confidence,
      fixability: check.fixability,
      fixStrategy: check.fixStrategy,
      evidence: check.evidence,
      recommendation: check.recommendation,
    },
  };
}

function buildReadiness(
  audit: AuditResult | undefined,
  issues: UiIssue[],
  errors: UiError[],
): UiReadiness {
  if (!audit) {
    return {
      label: "needs_attention",
      title: "ShipReady could not complete the audit.",
      summary: errors[0]?.message ?? "Run the audit again after fixing the reported input or network issue.",
      topIssues: [],
      passedHighlights: [],
      optionalPolish: [],
    };
  }

  const passedHighlights = issues.filter((issue) => issue.userSeverity === "ready");
  const optionalPolish = issues.filter((issue) => issue.userSeverity === "optional_polish");
  const actionableIssues = issues.filter(
    (issue) => issue.userSeverity !== "ready" && issue.userSeverity !== "optional_polish",
  );
  const sortedActionableIssues = [...actionableIssues].sort(compareIssuePriority);
  const topIssues = sortedActionableIssues.slice(0, 5);
  const hasBlockingOrImportant = actionableIssues.some(
    (issue) => issue.userSeverity === "blocking" || issue.userSeverity === "important",
  );
  const label: UiReadiness["label"] =
    errors.length > 0 || hasBlockingOrImportant
      ? "needs_attention"
      : actionableIssues.length > 0
        ? "almost_ready"
        : "ready";

  return {
    label,
    title: readinessTitle(label),
    summary: readinessSummary(label, actionableIssues.length, optionalPolish.length),
    score: audit.score,
    topIssues,
    passedHighlights,
    optionalPolish,
  };
}

function compareIssuePriority(left: UiIssue, right: UiIssue): number {
  return issuePriority(left) - issuePriority(right);
}

function issuePriority(issue: UiIssue): number {
  if (issue.userSeverity === "blocking") return 0;
  if (issue.userSeverity === "important") return 1;
  if (issue.userSeverity === "recommended") return 2;
  if (issue.userSeverity === "optional_polish") return 3;
  return 4;
}

function readinessTitle(label: UiReadiness["label"]): string {
  if (label === "ready") return "Ready to ship";
  if (label === "almost_ready") return "Almost ready";
  return "Needs attention before launch";
}

function readinessSummary(
  label: UiReadiness["label"],
  topIssueCount: number,
  optionalPolishCount: number,
): string {
  if (label === "ready") {
    return optionalPolishCount > 0
      ? `Core launch checks look good. ${optionalPolishCount} optional polish item(s) remain.`
      : "Core launch checks look good and no changes are needed.";
  }

  if (label === "almost_ready") {
    return `${topIssueCount} recommended improvement(s) remain before this page is fully polished.`;
  }

  return `${topIssueCount} issue(s) need review before this page should be considered launch-ready.`;
}

function buildPreviewCards(audit: AuditResult | undefined, inputUrl: string): UiPreviewCards {
  if (!audit) {
    return emptyPreviewCards(inputUrl);
  }

  const raw = audit.raw.metadata;
  const rendered = audit.rendered.metadata;
  const googleTitle = selectValue("title", [
    { field: "title", value: raw.title, source: "raw" },
    { field: "title", value: rendered.title, source: "rendered" },
  ]);
  const googleDescription = selectValue("description", [
    { field: "description", value: raw.description, source: "raw" },
    { field: "description", value: rendered.description, source: "rendered" },
  ]);
  const googleValues = [googleTitle, googleDescription];

  const socialTitle = selectValue("title", [
    { field: "og:title", value: raw.openGraph.title, source: "raw" },
    { field: "title", value: raw.title, source: "raw" },
    { field: "og:title", value: rendered.openGraph.title, source: "rendered" },
    { field: "title", value: rendered.title, source: "rendered" },
  ]);
  const socialDescription = selectValue("description", [
    { field: "og:description", value: raw.openGraph.description, source: "raw" },
    { field: "description", value: raw.description, source: "raw" },
    { field: "og:description", value: rendered.openGraph.description, source: "rendered" },
    { field: "description", value: rendered.description, source: "rendered" },
  ]);
  const socialImage = selectValue("image", [
    { field: "og:image", value: raw.openGraph.image, source: "raw" },
    { field: "og:image", value: rendered.openGraph.image, source: "rendered" },
  ]);
  const socialUrl = selectValue("url", [
    { field: "og:url", value: raw.openGraph.url, source: "raw" },
    { field: "og:url", value: rendered.openGraph.url, source: "rendered" },
    { field: "finalUrl", value: audit.finalUrl, source: "fallback" },
  ]);
  const socialValues = [socialTitle, socialDescription, socialImage, socialUrl];

  const twitterCard = selectValue("card", [
    { field: "twitter:card", value: raw.twitter.card, source: "raw" },
    { field: "twitter:card", value: rendered.twitter.card, source: "rendered" },
  ]);
  const twitterTitle = selectValue("title", [
    { field: "twitter:title", value: raw.twitter.title, source: "raw" },
    { field: "og:title", value: raw.openGraph.title, source: "raw" },
    { field: "title", value: raw.title, source: "raw" },
    { field: "twitter:title", value: rendered.twitter.title, source: "rendered" },
    { field: "og:title", value: rendered.openGraph.title, source: "rendered" },
    { field: "title", value: rendered.title, source: "rendered" },
  ]);
  const twitterDescription = selectValue("description", [
    { field: "twitter:description", value: raw.twitter.description, source: "raw" },
    { field: "og:description", value: raw.openGraph.description, source: "raw" },
    { field: "description", value: raw.description, source: "raw" },
    { field: "twitter:description", value: rendered.twitter.description, source: "rendered" },
    { field: "og:description", value: rendered.openGraph.description, source: "rendered" },
    { field: "description", value: rendered.description, source: "rendered" },
  ]);
  const twitterImage = selectValue("image", [
    { field: "twitter:image", value: raw.twitter.image, source: "raw" },
    { field: "og:image", value: raw.openGraph.image, source: "raw" },
    { field: "twitter:image", value: rendered.twitter.image, source: "rendered" },
    { field: "og:image", value: rendered.openGraph.image, source: "rendered" },
  ]);
  const twitterValues = [twitterCard, twitterTitle, twitterDescription, twitterImage];

  return {
    google: {
      title: googleTitle.value,
      url: audit.finalUrl,
      description: googleDescription.value,
      missingFields: missingFields(googleValues),
      source: previewSource(googleValues),
    },
    social: {
      title: socialTitle.value,
      description: socialDescription.value,
      image: socialImage.value,
      url: socialUrl.value,
      missingFields: missingFields([socialTitle, socialDescription, socialImage]),
      source: previewSource(socialValues),
    },
    twitter: {
      card: twitterCard.value,
      title: twitterTitle.value,
      description: twitterDescription.value,
      image: twitterImage.value,
      missingFields: missingFields(twitterValues),
      source: previewSource(twitterValues),
    },
    crawlerView: {
      rawHtmlSummary: summarizeSnapshot(audit.raw),
      renderedHtmlSummary: summarizeSnapshot(audit.rendered),
      renderOnlyWarnings: renderOnlyWarnings(audit, [
        ...googleValues,
        ...socialValues,
        ...twitterValues,
      ]),
    },
  };
}

function emptyPreviewCards(url: string): UiPreviewCards {
  return {
    google: {
      url,
      missingFields: ["title", "description"],
      source: "fallback",
    },
    social: {
      url,
      missingFields: ["title", "description", "image"],
      source: "fallback",
    },
    twitter: {
      missingFields: ["card", "title", "description", "image"],
      source: "fallback",
    },
    crawlerView: {
      rawHtmlSummary: "Raw HTML was not available because the audit did not complete.",
      renderedHtmlSummary: "Rendered HTML was not available because the audit did not complete.",
      renderOnlyWarnings: [],
    },
  };
}

function selectValue(field: string, candidates: ValueCandidate[]): SelectedValue {
  for (const candidate of candidates) {
    const value = candidate.value?.replace(/\s+/g, " ").trim();
    if (value) {
      return { field, value, source: candidate.source };
    }
  }

  return { field };
}

function previewSource(values: SelectedValue[]): UiPreviewSource {
  if (values.some((value) => value.source === "rendered")) {
    return "rendered";
  }

  if (values.some((value) => value.source === "raw")) {
    return "raw";
  }

  return "fallback";
}

function missingFields(values: SelectedValue[]): string[] {
  return values.filter((value) => !value.value).map((value) => value.field);
}

function summarizeSnapshot(snapshot: ExtractedPageMetadata): string {
  const metadata = snapshot.metadata;
  const ogCount = Object.values(metadata.openGraph).filter(Boolean).length;
  const twitterCount = Object.values(metadata.twitter).filter(Boolean).length;
  const present = [
    metadata.title ? "title" : undefined,
    metadata.description ? "description" : undefined,
    metadata.canonical ? "canonical" : undefined,
    metadata.htmlLang ? "language" : undefined,
  ].filter(Boolean);

  return `${capitalize(snapshot.source)} HTML includes ${present.length > 0 ? present.join(", ") : "no core metadata"}, ${ogCount} Open Graph field(s), ${twitterCount} Twitter/X field(s), and ${snapshot.jsonLd.length} JSON-LD block(s).`;
}

function renderOnlyWarnings(audit: AuditResult, selectedValues: SelectedValue[]): UiIssue[] {
  const warnings = new Map<string, UiIssue>();
  for (const check of audit.checks) {
    if (check.id.startsWith("crawl.raw_render.") && check.severity !== "passed") {
      const issue = toUiIssue(check);
      warnings.set(issue.id, issue);
    }
  }

  const renderedFields = new Set(
    selectedValues
      .filter((value) => value.source === "rendered")
      .map((value) => value.field),
  );
  for (const field of renderedFields) {
    const id = `render_only.${field}`;
    warnings.set(id, {
      id,
      title: FRIENDLY_COPY["crawl.raw_render.metadata_render_only"].title,
      explanation:
        `${field} was missing from raw HTML and was only available after JavaScript rendering.`,
      whyItMatters: FRIENDLY_COPY["crawl.raw_render.metadata_render_only"].whyItMatters,
      userSeverity: "important",
      technicalSeverity: "warning",
      sourceCheckIds: ["crawl.raw_render.metadata_render_only"],
      developerDetails: { field },
    });
  }

  for (const field of audit.comparison.fields) {
    if (field.status === "present_after_render_only") {
      const id = `render_only.${field.field}`;
      warnings.set(id, {
        id,
        title: FRIENDLY_COPY["crawl.raw_render.metadata_render_only"].title,
        explanation:
          `${field.field} is missing from raw HTML and appears only after the app renders.`,
        whyItMatters: FRIENDLY_COPY["crawl.raw_render.metadata_render_only"].whyItMatters,
        userSeverity: "important",
        technicalSeverity: "warning",
        sourceCheckIds: ["crawl.raw_render.metadata_render_only"],
        developerDetails: { comparison: field },
      });
    }
  }

  return Array.from(warnings.values());
}

function buildProjectSummary(repo: RepoInspectionResult): UiProjectSummary {
  return {
    detected: repo.framework.id !== "unknown",
    frameworkLabel: repo.framework.name,
    confidenceLabel:
      repo.framework.confidence === "high"
        ? "good_match"
        : repo.framework.confidence === "medium"
          ? "likely_match"
          : "manual_review",
    explanation:
      repo.framework.id === "unknown"
        ? "ShipReady could not confidently detect a supported project type."
        : `ShipReady detected ${repo.framework.name} from local project files.`,
    importantFiles: repo.importantFiles.map((file) => file.path),
    supportedFixes: repo.supportedFixes.map((fix) => fix.title),
    limitations: Array.from(new Set([...repo.limitations, ...repo.warnings])),
  };
}

function computeWriteEligibility(
  dryRun: DryRunFixResult | undefined,
  repoRoot: string | undefined,
): WriteEligibility {
  const eligibility: WriteEligibility = {
    eligiblePaths: new Set(),
    blockReasons: new Map(),
  };

  if (!dryRun) {
    return eligibility;
  }

  if (!repoRoot) {
    for (const change of dryRun.fileChanges) {
      eligibility.blockReasons.set(change.path, "A local repository path is required before ShipReady can validate V1 write eligibility.");
    }
    return eligibility;
  }

  try {
    const validation = validateWriteCandidates(dryRun, repoRoot);
    if (validation.ok) {
      for (const candidate of validation.candidates) {
        eligibility.eligiblePaths.add(candidate.path);
      }
    }

    for (const blockedChange of validation.blockedChanges) {
      eligibility.blockReasons.set(blockedChange.path, blockedChange.reason);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Write eligibility validation failed.";
    for (const change of dryRun.fileChanges) {
      eligibility.blockReasons.set(change.path, message);
    }
  }

  for (const change of dryRun.fileChanges) {
    if (!eligibility.eligiblePaths.has(change.path) && !eligibility.blockReasons.has(change.path)) {
      eligibility.blockReasons.set(change.path, fallbackWriteBlockReason(change));
    }
  }

  return eligibility;
}

function fallbackWriteBlockReason(change: DryRunFileChange): string {
  if (change.changeType !== "create") {
    return "Only new robots/sitemap files can be created in V1; existing files are never overwritten.";
  }

  if (change.risk !== "low") {
    return `Only low-risk file creations are writable in V1; this preview is ${change.risk} risk.`;
  }

  if (change.requiresHumanReview || change.reviewStatus !== "auto_candidate") {
    return "This preview requires human review before it can be applied.";
  }

  if (!change.sourceActionIds.some(isRobotsOrSitemapAction)) {
    return "Only robots/sitemap file creations are writable in V1.";
  }

  return "This preview is outside the V1 creation-only robots/sitemap write policy.";
}

function buildPatchPreview(
  dryRun: DryRunFixResult,
  eligibility: WriteEligibility,
): UiPatchPreviewSummary {
  return {
    hasPreview: dryRun.fileChanges.length > 0 || dryRun.skippedActions.length > 0,
    fileChanges: dryRun.fileChanges.map((change) => ({
      path: change.path,
      changeType: change.changeType,
      title: `${capitalize(change.changeType)} ${change.path}`,
      risk: change.risk,
      reviewStatus: change.reviewStatus,
      eligibleForWrite: eligibility.eligiblePaths.has(change.path),
      writePolicy: WRITE_POLICY_V1,
      writeBlockReason: eligibility.eligiblePaths.has(change.path)
        ? undefined
        : eligibility.blockReasons.get(change.path) ?? fallbackWriteBlockReason(change),
      sourceActionIds: change.sourceActionIds,
      diff: change.diff,
    })),
    skippedActions: dryRun.skippedActions.map((action) => ({
      title: action.title,
      reason: action.reason,
    })),
  };
}

function buildSafeApply(
  dryRun: DryRunFixResult | undefined,
  patchPreview: UiPatchPreviewSummary | undefined,
): UiSafeApplySummary {
  const eligibleFiles = patchPreview?.fileChanges
    .filter((change) => change.eligibleForWrite)
    .map((change) => change.path) ?? [];
  const blockedFiles = patchPreview?.fileChanges
    .filter((change) => !change.eligibleForWrite)
    .map((change) => ({
      path: change.path,
      reason: change.writeBlockReason ?? "This change is outside the V1 safe-apply policy.",
    })) ?? [];

  return {
    available: eligibleFiles.length > 0,
    buttonLabel: eligibleFiles.length > 0 ? "Create safe crawl files" : "No safe automatic fixes",
    explanation:
      eligibleFiles.length > 0
        ? "ShipReady can create the listed missing robots/sitemap files, but this report does not apply them automatically."
        : "No dry-run file change currently qualifies for V1 safe apply.",
    eligibleFiles,
    blockedFiles,
    policy: WRITE_POLICY_V1,
    safetyNotes: Array.from(new Set([
      "This ui-report command never writes files.",
      "V1 safe apply is limited to creation-only robots/sitemap files.",
      "ShipReady will not overwrite existing files in V1 safe apply.",
      "ShipReady will not edit metadata, JSON-LD, page content, package files, or configuration in V1 safe apply.",
      "ShipReady will not run Git operations, create commits, push, or deploy.",
      ...(dryRun?.safetyNotes ?? []),
    ])),
  };
}

function buildActionGroups(input: {
  issues: UiIssue[];
  fixPlan?: FixPlanResult;
  dryRun?: DryRunFixResult;
  writeEligibility: WriteEligibility;
  repoPath?: string;
  repoInspection?: RepoInspectionResult;
  errors: UiError[];
}): UiActionGroups | undefined {
  if (!input.fixPlan && !input.dryRun && !input.repoPath && input.errors.length === 0) {
    return undefined;
  }

  const safeToApply: UiFixAction[] = [];
  const needsReview: UiFixAction[] = [];
  const manualOnly: UiFixAction[] = [];
  const coveredActionIds = new Set<string>();
  const actionsById = new Map(input.fixPlan?.actions.map((action) => [action.id, action]) ?? []);

  for (const change of input.dryRun?.fileChanges ?? []) {
    const eligible = input.writeEligibility.eligiblePaths.has(change.path);
    const uiAction = fileChangeToFixAction(
      change,
      eligible,
      input.writeEligibility.blockReasons.get(change.path),
    );
    for (const actionId of change.sourceActionIds) {
      coveredActionIds.add(actionId);
    }

    if (eligible) {
      safeToApply.push(uiAction);
    } else {
      needsReview.push(uiAction);
    }
  }

  for (const skipped of input.dryRun?.skippedActions ?? []) {
    if (coveredActionIds.has(skipped.actionId)) {
      continue;
    }

    coveredActionIds.add(skipped.actionId);
    const planAction = actionsById.get(skipped.actionId);
    const uiAction = skippedActionToFixAction(skipped, planAction);
    if (skipped.reasonKind === "unsupported" || planAction?.category === "manual_recommendation") {
      manualOnly.push(uiAction);
    } else {
      needsReview.push(uiAction);
    }
  }

  for (const action of input.fixPlan?.actions ?? []) {
    if (coveredActionIds.has(action.id)) {
      continue;
    }

    if (action.category === "manual_recommendation") {
      manualOnly.push(planActionToFixAction(action, "manual_only", false));
      continue;
    }

    const reviewReason =
      action.category === "safe_automated_later"
        ? "The fix plan marked this as a safe candidate, but the dry-run did not produce an eligible V1 file creation."
        : action.futureAutomation.reason;
    needsReview.push(planActionToFixAction(action, "needs_review", false, reviewReason));
  }

  const hasRepoDependentWork =
    (input.fixPlan?.actions.length ?? 0) > 0 ||
    (input.dryRun?.fileChanges.length ?? 0) > 0 ||
    (input.dryRun?.skippedActions.length ?? 0) > 0;

  if (input.repoPath && input.repoInspection?.framework.id === "unknown" && hasRepoDependentWork) {
    manualOnly.push({
      id: "manual.unsupported_repo",
      title: "Review this project manually before patching.",
      explanation: "ShipReady could not confidently detect a supported project framework.",
      targetLabel: input.repoPath,
      affectsLiveSiteAfterDeploy: true,
      safety: "manual_only",
      canApplyInV1: false,
      reviewReason: "Unsupported or unknown repositories are outside automated V1 writes.",
      sourceActionIds: [],
    });
  }

  for (const error of input.errors.filter((item) => item.stage === "repo_inspection")) {
    manualOnly.push({
      id: `manual.${error.code}`,
      title: error.title,
      explanation: error.message,
      targetLabel: input.repoPath,
      affectsLiveSiteAfterDeploy: false,
      safety: "manual_only",
      canApplyInV1: false,
      reviewReason: error.suggestedAction,
      sourceActionIds: [],
      developerDetails: { error },
    });
  }

  return {
    safeToApply: dedupeFixActions(safeToApply),
    needsReview: dedupeFixActions(needsReview),
    manualOnly: dedupeFixActions(manualOnly),
    alreadyGood: input.issues.filter((issue) => issue.userSeverity === "ready"),
    optionalPolish: input.issues.filter((issue) => issue.userSeverity === "optional_polish"),
  };
}

function fileChangeToFixAction(
  change: DryRunFileChange,
  eligible: boolean,
  blockReason: string | undefined,
): UiFixAction {
  return {
    id: `file.${change.path}`,
    title: `${capitalize(change.changeType)} ${change.path}`,
    explanation: change.reason,
    targetLabel: change.path,
    affectsLiveSiteAfterDeploy: true,
    safety: eligible ? "safe_to_apply" : "needs_review",
    canApplyInV1: eligible,
    reviewReason: eligible ? undefined : blockReason ?? fallbackWriteBlockReason(change),
    sourceActionIds: change.sourceActionIds,
    developerDetails: {
      changeType: change.changeType,
      risk: change.risk,
      reviewStatus: change.reviewStatus,
      requiresHumanReview: change.requiresHumanReview,
    },
  };
}

function skippedActionToFixAction(
  skipped: SkippedFixAction,
  planAction: FixPlanAction | undefined,
): UiFixAction {
  return {
    id: `skipped.${skipped.actionId}`,
    title: skipped.title,
    explanation: planAction?.description ?? skipped.reason,
    targetLabel: targetLabel(planAction),
    affectsLiveSiteAfterDeploy: true,
    safety: skipped.reasonKind === "unsupported" || planAction?.category === "manual_recommendation"
      ? "manual_only"
      : "needs_review",
    canApplyInV1: false,
    reviewReason: skipped.reason,
    sourceActionIds: skipped.sourceActionIds,
    developerDetails: {
      reasonKind: skipped.reasonKind,
      risk: skipped.risk,
      planAction,
    },
  };
}

function planActionToFixAction(
  action: FixPlanAction,
  safety: UiFixAction["safety"],
  canApplyInV1: boolean,
  reviewReason = action.futureAutomation.reason,
): UiFixAction {
  return {
    id: `plan.${action.id}`,
    title: action.title,
    explanation: action.description,
    targetLabel: targetLabel(action),
    affectsLiveSiteAfterDeploy: true,
    safety,
    canApplyInV1,
    reviewReason,
    sourceActionIds: action.sourceCheckIds,
    developerDetails: {
      category: action.category,
      priority: action.priority,
      risk: action.risk,
      confidence: action.confidence,
      frameworkStrategy: action.frameworkStrategy,
      futureAutomation: action.futureAutomation,
    },
  };
}

function targetLabel(action: FixPlanAction | undefined): string | undefined {
  if (!action) return undefined;
  if (action.targetFiles.length > 0) return action.targetFiles.join(", ");
  if (action.targetLocations.length > 0) return action.targetLocations.join(", ");
  return undefined;
}

function dedupeFixActions(actions: UiFixAction[]): UiFixAction[] {
  const seen = new Set<string>();
  const deduped: UiFixAction[] = [];
  for (const action of actions) {
    if (seen.has(action.id)) {
      continue;
    }
    seen.add(action.id);
    deduped.push(action);
  }
  return deduped;
}

function buildWorkflow(input: {
  audit?: AuditResult;
  repoPath?: string;
  repoInspection?: RepoInspectionResult;
  fixPlan?: FixPlanResult;
  dryRun?: DryRunFixResult;
  readiness: UiReadiness;
  actionGroups?: UiActionGroups;
  safeApply: UiSafeApplySummary;
  errors: UiError[];
}): UiWorkflow {
  const completedStages: UiWorkflowStage[] = [];
  if (input.audit) completedStages.push("audit");
  if (input.repoInspection) completedStages.push("repo_inspection");
  if (input.fixPlan) completedStages.push("fix_plan");
  if (input.dryRun) completedStages.push("dry_run");

  const nextActions = nextActionsFor(input);
  return {
    currentRecommendedStep: currentStepFor(nextActions[0]),
    completedStages,
    availableNextActions: nextActions,
  };
}

function nextActionsFor(input: {
  audit?: AuditResult;
  repoPath?: string;
  repoInspection?: RepoInspectionResult;
  readiness: UiReadiness;
  actionGroups?: UiActionGroups;
  safeApply: UiSafeApplySummary;
  errors: UiError[];
}): UiNextAction[] {
  const blockingError = input.errors.find((error) => error.stage === "audit");
  if (blockingError) {
    return [{
      label: "Retry audit",
      action: "retry",
      primary: true,
      enabled: true,
      explanation: blockingError.suggestedAction,
    }];
  }

  if (input.readiness.label === "ready") {
    return [{
      label: "No changes needed",
      action: "none",
      primary: true,
      enabled: true,
    }];
  }

  if (!input.repoPath || !input.repoInspection) {
    return [{
      label: "Select project folder",
      action: "select_repo",
      primary: true,
      enabled: true,
      explanation: "Connect the local project before previewing or applying fixes.",
    }];
  }

  if (input.safeApply.available) {
    const actions: UiNextAction[] = [{
      label: "Create safe crawl files",
      action: "write_safe_fixes",
      primary: true,
      enabled: true,
      explanation: "Only V1-eligible robots/sitemap creations qualify.",
    }];

    if ((input.actionGroups?.needsReview.length ?? 0) > 0 || (input.actionGroups?.manualOnly.length ?? 0) > 0) {
      actions.push({
        label: "Review remaining fixes",
        action: "review_manual",
        primary: false,
        enabled: true,
      });
    }

    return actions;
  }

  if ((input.actionGroups?.needsReview.length ?? 0) > 0) {
    return [{
      label: "Review patch preview",
      action: "review_patch_preview",
      primary: true,
      enabled: true,
      explanation: "Generated previews require human review before any future write path.",
    }];
  }

  if ((input.actionGroups?.manualOnly.length ?? 0) > 0) {
    return [{
      label: "Review manual fixes",
      action: "review_manual",
      primary: true,
      enabled: true,
    }];
  }

  return [{
    label: "Review readiness",
    action: "review_readiness",
    primary: true,
    enabled: true,
  }];
}

function currentStepFor(nextAction: UiNextAction | undefined): UiWorkflow["currentRecommendedStep"] {
  if (!nextAction) return "review_readiness";
  if (nextAction.action === "select_repo") return "connect_repo";
  if (nextAction.action === "none") return "no_changes_needed";
  if (nextAction.action === "write_safe_fixes") return "apply_safe_fixes";
  if (nextAction.action === "review_patch_preview") return "review_patch_preview";
  if (nextAction.action === "review_fix_plan") return "review_fix_plan";
  if (nextAction.action === "review_project") return "review_project";
  if (nextAction.action === "deploy_then_recheck") return "deploy_then_recheck";
  if (nextAction.action === "review_manual" || nextAction.action === "retry") {
    return "manual_review_required";
  }
  return "review_readiness";
}

function buildLiveVsLocal(
  repoPath: string | undefined,
  fixPlan: FixPlanResult | undefined,
  dryRun: DryRunFixResult | undefined,
): UiLiveVsLocalState {
  if (!repoPath) {
    return {
      localChangesAffectLiveSite: false,
      deploymentRequired: false,
      message:
        "This report audits the live URL only. Select a local project folder before previewing local changes.",
    };
  }

  const hasProposedLocalWork =
    (fixPlan?.actions.length ?? 0) > 0 ||
    (dryRun?.fileChanges.length ?? 0) > 0 ||
    (dryRun?.skippedActions.length ?? 0) > 0;

  return {
    localChangesAffectLiveSite: false,
    deploymentRequired: hasProposedLocalWork,
    message: hasProposedLocalWork
      ? "Local changes will not affect the live site until this repository is deployed and the URL is re-checked."
      : "A local repository was inspected, but no local changes are proposed. Future local changes still require deployment before affecting the live site.",
  };
}

function normalizeUiError(stage: UiError["stage"], error: unknown): UiError {
  const message = error instanceof Error ? error.message : "Unexpected ShipReady failure.";
  const code = errorCodeFor(stage, message);
  return {
    stage,
    code,
    title: errorTitle(stage, code),
    message,
    suggestedAction: suggestedActionFor(stage, code),
    retryable: code === "network_error" || code === "timeout" || code === "unknown",
    developerDetails: error instanceof Error
      ? { name: error.name, message: error.message, stack: error.stack }
      : error,
  };
}

function errorCodeFor(stage: UiError["stage"], message: string): UiError["code"] {
  if (message.startsWith("Invalid URL")) return "invalid_url";
  if (message.startsWith("Repository path")) return "invalid_repo_path";
  if (/timeout|timed out/i.test(message)) return "timeout";
  if (/fetch|network|ENOTFOUND|ECONNREFUSED|ECONNRESET|EAI_AGAIN/i.test(message)) return "network_error";
  if (stage === "repo_inspection" && /unsupported/i.test(message)) return "unsupported_repo";
  if (message) return "command_failed";
  return "unknown";
}

function errorTitle(stage: UiError["stage"], code: UiError["code"]): string {
  if (code === "invalid_url") return "The URL is not valid.";
  if (code === "invalid_repo_path") return "The project folder could not be inspected.";
  if (code === "timeout") return "ShipReady timed out during this stage.";
  if (code === "network_error") return "ShipReady could not reach the URL.";
  if (code === "unsupported_repo") return "The local project is not supported yet.";
  if (stage === "fix_plan") return "ShipReady could not build a fix plan.";
  if (stage === "dry_run") return "ShipReady could not build a patch preview.";
  return "ShipReady could not complete this stage.";
}

function suggestedActionFor(stage: UiError["stage"], code: UiError["code"]): string {
  if (code === "invalid_url") return "Enter an absolute http:// or https:// URL and run the report again.";
  if (code === "invalid_repo_path") return "Select an existing local project folder and run the report again.";
  if (code === "timeout") return "Retry with a longer timeout or check whether the site is responding.";
  if (code === "network_error") return "Check the URL and network connection, then retry the audit.";
  if (stage === "repo_inspection") return "Inspect the project manually or select a different folder.";
  if (stage === "fix_plan") return "Review the audit and repo inspection details before retrying.";
  if (stage === "dry_run") return "Review the fix plan details before retrying the patch preview.";
  return "Review the developer details and retry when the underlying issue is resolved.";
}

function isRobotsOrSitemapAction(actionId: string): boolean {
  return actionId.endsWith(".robots") || actionId.endsWith(".sitemap");
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
