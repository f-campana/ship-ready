import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { dryRunFixFromPlan } from "../src/fix/dryRunFix";
import { planFixesFromResults } from "../src/plan/planFixes";
import { createUiReport, createUiReportFromResults, mapAuditCheckToUiSeverity } from "../src/report/createUiReport";
import { inspectRepo } from "../src/repo/inspectRepo";
import type {
  AuditCheck,
  AuditResult,
  ComparisonField,
  ExtractedPageMetadata,
} from "../src/types/audit";
import { UiReportSchema } from "../src/types/uiReport";

const fixtureRoot = join(import.meta.dirname, "fixtures", "repos");
const finalUrl = "https://example.com/";

describe("UI report normalization", () => {
  it("maps a clean report to ready with no changes needed", () => {
    const report = createUiReportFromResults({
      url: finalUrl,
      generatedAt: "2026-06-15T00:00:00.000Z",
      audit: auditWithChecks(cleanChecks(), 100, "good"),
    });

    expect(report.readiness.label).toBe("ready");
    expect(report.workflow.currentRecommendedStep).toBe("no_changes_needed");
    expect(report.workflow.availableNextActions[0]).toMatchObject({
      action: "none",
      primary: true,
    });
    expect(report.previews.crawlerView.renderOnlyWarnings).toEqual([]);
    expect(UiReportSchema.parse(report).schemaVersion).toBe("ui-report-v1");
  });

  it("downshifts missing JSON-LD to recommended", () => {
    const check = critical("schema.jsonld.missing", "No JSON-LD detected", "No structured data script tags were found.");
    const report = createUiReportFromResults({
      url: finalUrl,
      audit: auditWithChecks([check]),
    });

    expect(mapAuditCheckToUiSeverity(check)).toBe("recommended");
    expect(report.readiness.topIssues.find((issue) => issue.id === "schema.jsonld.missing")).toMatchObject({
      userSeverity: "recommended",
      technicalSeverity: "critical",
    });
  });

  it("maps invalid sitemap to important", () => {
    const report = createUiReportFromResults({
      url: finalUrl,
      audit: auditWithChecks([
        warning("crawl.sitemap.invalid", "sitemap.xml is not a valid sitemap", "The sitemap URL returned app HTML."),
      ]),
    });

    expect(report.readiness.topIssues[0]).toMatchObject({
      id: "crawl.sitemap.invalid",
      userSeverity: "important",
    });
  });

  it("maps render-only metadata to important crawler warnings, not blocking issues", () => {
    const check = critical(
      "crawl.raw_render.title_description_render_only",
      "Title and description appear only after JavaScript rendering",
      "Some crawlers and social preview bots may not reliably see metadata that is absent from the initial HTML.",
    );
    const report = createUiReportFromResults({
      url: finalUrl,
      audit: auditWithChecks([check]),
    });

    expect(mapAuditCheckToUiSeverity(check)).toBe("important");
    expect(report.readiness.topIssues[0]).toMatchObject({
      id: "crawl.raw_render.title_description_render_only",
      userSeverity: "important",
      technicalSeverity: "critical",
    });
  });

  it("prioritizes and limits readiness top issues", () => {
    const report = createUiReportFromResults({
      url: finalUrl,
      audit: auditWithChecks([
        warning("metadata.favicon.missing", "No favicon links found", "No favicon links were detected."),
        warning("social.twitter.image_missing", "Missing twitter:image", "Twitter image metadata is missing."),
        warning("metadata.lang.missing", "Missing language", "The HTML lang attribute is missing."),
        warning("metadata.viewport.missing", "Missing viewport", "The viewport meta tag is missing."),
        warning("metadata.theme_color.missing", "Theme color is not set", "No theme color was detected."),
        critical("metadata.canonical.missing", "Missing canonical URL", "The raw HTML does not include a canonical link."),
        warning("crawl.sitemap.invalid", "sitemap.xml is not a valid sitemap", "The sitemap URL returned app HTML."),
      ]),
    });

    expect(report.readiness.topIssues).toHaveLength(5);
    expect(report.readiness.topIssues.map((issue) => issue.id).slice(0, 2)).toEqual([
      "metadata.canonical.missing",
      "crawl.sitemap.invalid",
    ]);
    expect(report.readiness.topIssues.some((issue) => issue.id === "metadata.theme_color.missing")).toBe(false);
    expect(report.readiness.summary).toContain("6 issue(s)");
  });

  it("maps eligible missing robots and sitemap dry-run files to safe apply", () => {
    const repoRoot = fixture("next-app-router-dry-run");
    const plan = planFixesFromResults(
      auditWithChecks([
        warning("crawl.robots_txt.missing", "robots.txt not found", "No robots.txt file was found."),
        warning("crawl.sitemap.missing", "sitemap.xml not found", "No sitemap.xml file was found."),
      ]),
      inspectRepo(repoRoot),
    );
    const dryRun = dryRunFixFromPlan(plan, { repoRoot, generatedAt: "2026-06-15T00:00:00.000Z" });
    const report = createUiReportFromResults({
      url: finalUrl,
      repoPath: repoRoot,
      audit: auditWithChecks(plan.actions.flatMap(() => [])),
      repoInspection: inspectRepo(repoRoot),
      fixPlan: plan,
      dryRun,
      repoRoot,
    });

    expect(report.safeApply?.available).toBe(true);
    expect(report.safeApply?.eligibleFiles.sort()).toEqual([
      "src/app/robots.ts",
      "src/app/sitemap.ts",
    ]);
    expect(report.actionGroups?.safeToApply.map((action) => action.targetLabel).sort()).toEqual([
      "src/app/robots.ts",
      "src/app/sitemap.ts",
    ]);
    expect(report.patchPreview?.fileChanges.every((change) => change.eligibleForWrite)).toBe(true);
    expect(report.safeApply?.safetyNotes).toEqual(
      expect.arrayContaining([
        "ShipReady will not overwrite existing files in V1 safe apply.",
        "ShipReady will not edit metadata, JSON-LD, page content, package files, or configuration in V1 safe apply.",
        "ShipReady will not run Git operations, create commits, push, or deploy.",
      ]),
    );
  });

  it("maps metadata update previews to review, not safe apply", () => {
    const repoRoot = fixture("vite-react");
    const audit = auditWithChecks([
      critical("metadata.canonical.missing", "Missing canonical URL", "The raw HTML does not include a canonical link."),
    ]);
    const repoInspection = inspectRepo(repoRoot);
    const plan = planFixesFromResults(audit, repoInspection);
    const dryRun = dryRunFixFromPlan(plan, { repoRoot, generatedAt: "2026-06-15T00:00:00.000Z" });
    const report = createUiReportFromResults({
      url: finalUrl,
      repoPath: repoRoot,
      audit,
      repoInspection,
      fixPlan: plan,
      dryRun,
      repoRoot,
    });

    expect(report.actionGroups?.safeToApply).toEqual([]);
    expect(report.actionGroups?.needsReview.some((action) => action.targetLabel === "index.html")).toBe(true);
    expect(report.patchPreview?.fileChanges.find((change) => change.path === "index.html")).toMatchObject({
      eligibleForWrite: false,
      changeType: "update",
    });
  });

  it("maps unknown repositories to manual-only state", () => {
    const repoRoot = fixture("unknown");
    const audit = auditWithChecks([
      critical("metadata.title.missing", "Missing title", "The initial HTML does not include a title."),
    ]);
    const repoInspection = inspectRepo(repoRoot);
    const plan = planFixesFromResults(audit, repoInspection);
    const dryRun = dryRunFixFromPlan(plan, { repoRoot });
    const report = createUiReportFromResults({
      url: finalUrl,
      repoPath: repoRoot,
      audit,
      repoInspection,
      fixPlan: plan,
      dryRun,
      repoRoot,
    });

    expect(report.project?.detected).toBe(false);
    expect(report.actionGroups?.manualOnly.length).toBeGreaterThan(0);
    expect(report.workflow.currentRecommendedStep).toBe("manual_review_required");
  });

  it("does not add unknown-repo manual noise when the audit plan is clean", () => {
    const repoRoot = fixture("unknown");
    const audit = auditWithChecks(cleanChecks(), 100, "good");
    const repoInspection = inspectRepo(repoRoot);
    const plan = planFixesFromResults(audit, repoInspection);
    const dryRun = dryRunFixFromPlan(plan, { repoRoot });
    const report = createUiReportFromResults({
      url: finalUrl,
      repoPath: repoRoot,
      audit,
      repoInspection,
      fixPlan: plan,
      dryRun,
      repoRoot,
    });

    expect(report.workflow.currentRecommendedStep).toBe("no_changes_needed");
    expect(report.actionGroups?.manualOnly).toEqual([]);
  });

  it("URL-only reports skip repo stages and recommend selecting a project folder when issues exist", () => {
    const report = createUiReportFromResults({
      url: finalUrl,
      audit: auditWithChecks([
        critical("metadata.description.missing", "Missing meta description", "The initial HTML does not include a meta description."),
      ]),
    });

    expect(report.workflow.completedStages).toEqual(["audit"]);
    expect(report.workflow.currentRecommendedStep).toBe("connect_repo");
    expect(report.workflow.availableNextActions[0]).toMatchObject({ action: "select_repo" });
    expect(report.actionGroups).toBeUndefined();
  });

  it("preview cards use raw metadata before rendered metadata", () => {
    const audit = auditWithChecks([], 100, "good", {
      raw: snapshot({
        title: "Raw title",
        description: "Raw description for preview cards.",
      }),
      rendered: snapshot({
        source: "rendered",
        title: "Rendered title",
        description: "Rendered description.",
      }),
    });
    const report = createUiReportFromResults({ url: finalUrl, audit });

    expect(report.previews.google).toMatchObject({
      title: "Raw title",
      description: "Raw description for preview cards.",
      source: "raw",
    });
  });

  it("preview cards warn when rendered metadata is used as a fallback", () => {
    const audit = auditWithChecks(
      [
        warning(
          "crawl.raw_render.metadata_render_only",
          "Metadata appears only after JavaScript rendering",
          "Some metadata is absent from initial HTML.",
        ),
      ],
      80,
      "needs_work",
      {
        raw: snapshot({ title: "Raw title" }),
        rendered: snapshot({
          source: "rendered",
          title: "Raw title",
          description: "Rendered description appears later.",
        }),
        comparisonFields: [
          {
            field: "description",
            renderedValue: "Rendered description appears later.",
            status: "present_after_render_only",
          },
        ],
      },
    );
    const report = createUiReportFromResults({ url: finalUrl, audit });

    expect(report.previews.google.description).toBe("Rendered description appears later.");
    expect(report.previews.google.source).toBe("rendered");
    expect(report.previews.crawlerView.renderOnlyWarnings.some((issue) => issue.id.includes("description"))).toBe(true);
    expect(report.previews.crawlerView.renderOnlyWarnings.every((issue) => issue.userSeverity === "important")).toBe(true);
  });

  it("does not infer safe apply from the plan when dry-run has no eligible file changes", () => {
    const repoRoot = fixture("next-app-router-dry-run");
    const audit = auditWithChecks([
      warning("crawl.robots_txt.missing", "robots.txt not found", "No robots.txt file was found."),
    ]);
    const repoInspection = inspectRepo(repoRoot);
    const plan = planFixesFromResults(audit, repoInspection);
    const report = createUiReportFromResults({
      url: finalUrl,
      repoPath: repoRoot,
      audit,
      repoInspection,
      fixPlan: plan,
      repoRoot,
    });

    expect(report.safeApply?.available).toBe(false);
    expect(report.actionGroups?.safeToApply).toEqual([]);
    expect(report.actionGroups?.needsReview.some((action) => action.title.includes("robots"))).toBe(true);
  });

  it("includes local-versus-live messaging when a repo path is used", () => {
    const repoRoot = fixture("vite-react");
    const report = createUiReportFromResults({
      url: finalUrl,
      repoPath: repoRoot,
      audit: auditWithChecks(cleanChecks(), 100, "good"),
      repoInspection: inspectRepo(repoRoot),
    });

    expect(report.liveVsLocal.localChangesAffectLiveSite).toBe(false);
    expect(report.liveVsLocal.message).toContain("live site");
  });

  it("includes raw developer details", () => {
    const audit = auditWithChecks(cleanChecks(), 100, "good");
    const report = createUiReportFromResults({ url: finalUrl, audit });

    expect(report.developerDetails.rawAudit).toEqual(audit);
  });

  it("normalizes invalid URL errors without running the audit", async () => {
    const report = await createUiReport({
      url: "not-a-url",
      generatedAt: "2026-06-15T00:00:00.000Z",
    });

    expect(report.errors[0]).toMatchObject({
      stage: "audit",
      code: "invalid_url",
      retryable: false,
    });
    expect(report.readiness.label).toBe("needs_attention");
  });
});

function fixture(name: string): string {
  return join(fixtureRoot, name);
}

function auditWithChecks(
  checks: AuditCheck[],
  score = checks.every((check) => check.severity === "passed") ? 100 : 62,
  status: AuditResult["status"] = checks.every((check) => check.severity === "passed") ? "good" : "needs_work",
  options: {
    raw?: ExtractedPageMetadata;
    rendered?: ExtractedPageMetadata;
    comparisonFields?: ComparisonField[];
  } = {},
): AuditResult {
  const raw = options.raw ?? snapshot();
  const rendered = options.rendered ?? snapshot({ source: "rendered" });
  return {
    url: finalUrl,
    finalUrl,
    auditedAt: "2026-06-15T00:00:00.000Z",
    httpStatus: 200,
    score,
    status,
    raw,
    rendered,
    comparison: { fields: options.comparisonFields ?? [] },
    checks,
    resources: {
      robotsTxt: {
        url: "https://example.com/robots.txt",
        exists: checks.some((check) => check.id === "crawl.robots_txt.found"),
        ok: checks.some((check) => check.id === "crawl.robots_txt.found"),
        statusCode: checks.some((check) => check.id === "crawl.robots_txt.found") ? 200 : 404,
      },
      sitemapXml: {
        url: "https://example.com/sitemap.xml",
        exists: checks.some((check) => check.id === "crawl.sitemap.found"),
        ok: checks.some((check) => check.id === "crawl.sitemap.found"),
        statusCode: checks.some((check) => check.id === "crawl.sitemap.found") ? 200 : 404,
      },
    },
  };
}

function snapshot(input: {
  source?: "raw" | "rendered";
  title?: string;
  description?: string;
  canonical?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  ogUrl?: string;
  twitterCard?: string;
  twitterTitle?: string;
  twitterDescription?: string;
  twitterImage?: string;
  jsonLdCount?: number;
} = {}): ExtractedPageMetadata {
  return {
    source: input.source ?? "raw",
    url: finalUrl,
    metadata: {
      title: input.title,
      description: input.description,
      canonical: input.canonical,
      faviconLinks: [],
      openGraph: {
        title: input.ogTitle,
        description: input.ogDescription,
        image: input.ogImage,
        url: input.ogUrl,
      },
      twitter: {
        card: input.twitterCard,
        title: input.twitterTitle,
        description: input.twitterDescription,
        image: input.twitterImage,
      },
    },
    headings: { h1: [], all: [] },
    images: { total: 0, missingAlt: 0, items: [] },
    links: { total: 0, missingAccessibleText: 0, items: [] },
    jsonLd: Array.from({ length: input.jsonLdCount ?? 0 }, (_, index) => ({
      raw: `{"@type":"Thing","index":${index}}`,
      valid: true,
      parsed: { "@type": "Thing", index },
      types: ["Thing"],
    })),
  };
}

function cleanChecks(): AuditCheck[] {
  return [
    passed("crawl.status.ok", "Page returns HTTP success", "The audited URL returned a 2xx HTTP status."),
    passed("metadata.title.present", "Title present", "Raw title: Example"),
    passed("metadata.description.present", "Meta description present", "Raw meta description is present."),
    passed("metadata.canonical.present", "Canonical URL present", finalUrl),
    passed("metadata.robots.indexable", "Page is not marked noindex", "No noindex robots meta directive was detected."),
    passed("social.og.image_present", "og:image present", "https://example.com/og.png"),
    passed("social.twitter.card_present", "twitter:card present", "summary_large_image"),
    passed("schema.jsonld.valid", "Valid JSON-LD detected", "Valid blocks: 1"),
    passed("crawl.robots_txt.found", "robots.txt found", "https://example.com/robots.txt"),
    passed("crawl.sitemap.found", "sitemap.xml found", "https://example.com/sitemap.xml"),
    passed("crawl.raw_render.consistent", "Key metadata present in raw HTML", "No render-only metadata fields were detected."),
  ];
}

function critical(id: string, title: string, description: string): AuditCheck {
  return check(id, title, description, "critical");
}

function warning(id: string, title: string, description: string): AuditCheck {
  return check(id, title, description, "warning");
}

function passed(id: string, title: string, description: string): AuditCheck {
  return check(id, title, description, "passed");
}

function check(
  id: string,
  title: string,
  description: string,
  severity: AuditCheck["severity"],
): AuditCheck {
  return {
    id,
    title,
    description,
    severity,
    category: id.startsWith("social.")
      ? "social"
      : id.startsWith("schema.")
        ? "schema"
        : id.startsWith("crawl.")
          ? "crawlability"
          : id.startsWith("structure.")
            ? "structure"
            : id.startsWith("a11y.")
              ? "accessibility"
              : "metadata",
    confidence: "high",
    fixability: severity === "passed" ? "not_fixable" : "plan_only",
  };
}
