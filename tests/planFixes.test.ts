import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { inspectRepo } from "../src/repo/inspectRepo";
import { formatFixPlanHumanReport } from "../src/report/formatFixPlanHumanReport";
import { formatFixPlanJsonReport } from "../src/report/formatFixPlanJsonReport";
import { planFixesFromResults } from "../src/plan/planFixes";
import type { AuditCheck, AuditResult, ExtractedPageMetadata } from "../src/types/audit";
import { FixPlanResultSchema } from "../src/types/fixPlan";

const fixtureRoot = join(import.meta.dirname, "fixtures", "repos");

function repo(name: string) {
  return inspectRepo(join(fixtureRoot, name));
}

describe("planFixesFromResults", () => {
  it("does not propose required actions for a clean audit and supported repo", () => {
    const plan = planFixesFromResults(cleanAudit(), repo("next-app-router"));

    expect(plan.recommendedNextStep).toBe("no_changes_needed");
    expect(plan.actions).toHaveLength(0);
    expect(plan.noActionChecks.map((check) => check.checkId)).toEqual(
      expect.arrayContaining(["metadata.title.present", "crawl.sitemap.found"]),
    );
  });

  it("maps missing metadata in Next.js App Router to a reviewed metadata action", () => {
    const plan = planFixesFromResults(
      auditWithChecks([
        critical("metadata.title.missing", "Missing title in raw HTML", "The initial HTML does not include a title tag."),
        critical("metadata.description.missing", "Missing meta description in raw HTML", "The initial HTML does not include a meta description."),
        critical("metadata.canonical.missing", "Missing canonical URL", "The raw HTML does not include a canonical link."),
      ]),
      repo("next-app-router"),
    );

    expect(plan.recommendedNextStep).toBe("review_plan");
    expect(plan.actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "next_app_router.metadata_review",
          category: "automated_with_review",
          priority: "critical",
          risk: "medium",
          targetFiles: expect.arrayContaining(["src/app/layout.tsx"]),
        }),
      ]),
    );
  });

  it("maps missing robots and sitemap in Next.js App Router to safe later actions", () => {
    const plan = planFixesFromResults(
      auditWithChecks([
        warning("crawl.robots_txt.missing", "robots.txt not found", "No robots.txt file was found at the origin root."),
        warning("crawl.sitemap.missing", "sitemap.xml not found", "No sitemap.xml file was found at the origin root."),
      ]),
      repo("next-app-router"),
    );

    expect(plan.actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "next_app_router.robots",
          title: "Add robots.ts",
          category: "safe_automated_later",
          risk: "low",
        }),
        expect.objectContaining({
          id: "next_app_router.sitemap",
          title: "Add sitemap.ts",
          category: "safe_automated_later",
          priority: "high",
        }),
      ]),
    );
  });

  it("maps invalid sitemap responses to reviewed sitemap updates for supported repos", () => {
    const plan = planFixesFromResults(
      auditWithChecks([
        warning("crawl.sitemap.invalid", "sitemap.xml is not a valid sitemap", "The sitemap.xml URL returned a success response, but the body did not look like an XML sitemap."),
      ]),
      repo("vite-react"),
    );

    expect(plan.actions[0]).toMatchObject({
      id: "vite_react.sitemap",
      title: "Update sitemap.xml",
      category: "automated_with_review",
      priority: "high",
      risk: "low",
      futureAutomation: {
        canAutomate: true,
        requiresHumanReview: true,
      },
    });
  });

  it("maps missing JSON-LD to automation with review", () => {
    const plan = planFixesFromResults(
      auditWithChecks([
        critical("schema.jsonld.missing", "No JSON-LD detected", "No structured data script tags were found in the raw HTML."),
      ]),
      repo("next-app-router"),
    );

    expect(plan.actions[0]).toMatchObject({
      id: "next_app_router.json_ld_review",
      category: "automated_with_review",
      futureAutomation: {
        canAutomate: true,
        requiresHumanReview: true,
      },
    });
  });

  it("maps JS-only metadata in Vite React to a manual high-risk recommendation", () => {
    const plan = planFixesFromResults(
      auditWithChecks([
        critical(
          "crawl.raw_render.title_description_render_only",
          "Title and description appear only after JavaScript rendering",
          "Some crawlers and social preview bots may not reliably see metadata that is absent from the initial HTML.",
        ),
      ]),
      repo("vite-react"),
    );

    expect(plan.recommendedNextStep).toBe("manual_review_required");
    expect(plan.actions[0]).toMatchObject({
      id: "vite_react.rendering_strategy",
      category: "manual_recommendation",
      priority: "high",
      risk: "high",
      futureAutomation: {
        canAutomate: false,
        requiresHumanReview: true,
      },
    });
  });

  it("keeps unknown frameworks manual-only", () => {
    const plan = planFixesFromResults(
      auditWithChecks([
        critical("metadata.title.missing", "Missing title in raw HTML", "The initial HTML does not include a title tag."),
      ]),
      repo("unknown"),
    );

    expect(plan.recommendedNextStep).toBe("unsupported_project");
    expect(plan.actions).toHaveLength(1);
    expect(plan.actions[0]).toMatchObject({
      category: "manual_recommendation",
      futureAutomation: {
        canAutomate: false,
        requiresHumanReview: true,
      },
    });
  });

  it("maps static HTML missing metadata to safe later actions", () => {
    const plan = planFixesFromResults(
      auditWithChecks([
        critical("metadata.title.missing", "Missing title in raw HTML", "The initial HTML does not include a title tag."),
        critical("metadata.description.missing", "Missing meta description in raw HTML", "The initial HTML does not include a meta description."),
      ]),
      repo("static-html"),
    );

    expect(plan.actions[0]).toMatchObject({
      id: "metadata.static_html_head",
      category: "safe_automated_later",
      risk: "low",
      futureAutomation: {
        canAutomate: true,
        requiresHumanReview: false,
      },
    });
    expect(plan.actions[0]?.targetFiles).toEqual(expect.arrayContaining(["index.html"]));
  });

  it("emits JSON matching the fix plan schema", () => {
    const plan = planFixesFromResults(cleanAudit(), repo("next-app-router"));
    const parsed = JSON.parse(formatFixPlanJsonReport(plan)) as unknown;

    expect(() => FixPlanResultSchema.parse(parsed)).not.toThrow();
  });

  it("formats a readable human fix plan", () => {
    const plan = planFixesFromResults(
      auditWithChecks([
        warning("crawl.sitemap.missing", "sitemap.xml not found", "No sitemap.xml file was found at the origin root."),
      ]),
      repo("next-app-router"),
    );
    const report = formatFixPlanHumanReport(plan);

    expect(report).toContain("ShipReady fix plan");
    expect(report).toContain("Status: Needs attention");
    expect(report).toContain("Safe candidates");
    expect(report).toContain("Add sitemap.ts");
    expect(report).toContain("Next: Review the plan");
  });
});

function cleanAudit(): AuditResult {
  return auditWithChecks([
    passed("metadata.title.present", "Title present", "Raw title: Example"),
    passed("metadata.description.present", "Meta description present", "Raw meta description is present."),
    passed("metadata.canonical.present", "Canonical URL present", "https://example.com/"),
    passed("social.og.image_present", "og:image present", "https://example.com/og.png"),
    passed("social.twitter.card_present", "twitter:card present", "summary_large_image"),
    passed("schema.jsonld.valid", "Valid JSON-LD detected", "Valid blocks: 1"),
    passed("crawl.robots_txt.found", "robots.txt found", "https://example.com/robots.txt"),
    passed("crawl.sitemap.found", "sitemap.xml found", "https://example.com/sitemap.xml"),
  ], 100, "good");
}

function auditWithChecks(
  checks: AuditCheck[],
  score = 62,
  status: AuditResult["status"] = "needs_work",
): AuditResult {
  const snapshot = pageSnapshot();
  return {
    url: "https://example.com/",
    finalUrl: "https://example.com/",
    auditedAt: "2026-06-14T00:00:00.000Z",
    httpStatus: 200,
    score,
    status,
    raw: snapshot,
    rendered: snapshot,
    comparison: { fields: [] },
    checks,
    resources: {
      robotsTxt: {
        url: "https://example.com/robots.txt",
        exists: false,
        ok: false,
        statusCode: 404,
      },
      sitemapXml: {
        url: "https://example.com/sitemap.xml",
        exists: false,
        ok: false,
        statusCode: 404,
      },
    },
  };
}

function pageSnapshot(): ExtractedPageMetadata {
  return {
    source: "raw",
    url: "https://example.com/",
    metadata: {
      faviconLinks: [],
      openGraph: {},
      twitter: {},
    },
    headings: { h1: [], all: [] },
    images: { total: 0, missingAlt: 0, items: [] },
    links: { total: 0, missingAccessibleText: 0, items: [] },
    jsonLd: [],
  };
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
