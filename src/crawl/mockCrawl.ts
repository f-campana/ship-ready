import type { AuditCheck } from "../types/audit";
import type { CrawlJsonContract } from "../types/contracts";
import { CrawlError, type CrawlPageObservation, type NormalizedCrawlOptions } from "./crawlTypes";
import { createCrawlResult } from "./crawl";

export const CRAWL_MOCK_SCENARIOS = [
  "clean-small-site",
  "missing-descriptions",
  "canonical-inconsistent",
  "social-images-missing",
  "start-unreachable",
  "limit-reached",
  "mixed-readiness",
] as const;

const FIXED_AT = "2026-06-21T12:00:00.000Z";

export type CrawlMockScenario = (typeof CRAWL_MOCK_SCENARIOS)[number];

export function getMockCrawl(
  options: NormalizedCrawlOptions,
  scenario: string,
): CrawlJsonContract {
  if (!CRAWL_MOCK_SCENARIOS.includes(scenario as never)) {
    throw new CrawlError(
      "invalid_mode",
      `Unsupported crawl mock scenario: ${scenario}. Use one of: ${CRAWL_MOCK_SCENARIOS.join(", ")}.`,
    );
  }

  const fixedOptions = { ...options, checkedAt: options.checkedAt ?? FIXED_AT };
  if (scenario === "start-unreachable") {
    const observations = [mockPage(fixedOptions, "/", {
      status: "unknown",
      score: undefined,
      httpStatus: undefined,
      title: undefined,
      description: undefined,
      canonicalUrl: undefined,
      ogImage: undefined,
      checks: [issue("crawl.page.unreachable", "Page could not be audited", "critical", "crawlability")],
    })];
    return createCrawlResult({
      mode: "mock",
      options: fixedOptions,
      observations,
      discoveredCount: 1,
      skipped: [],
      skippedCount: 0,
      limitations: ["Mock scenario represents an unreachable starting URL."],
    });
  }

  if (scenario === "limit-reached") {
    const observations = Array.from({ length: fixedOptions.maxPages }, (_, index) =>
      mockPage(fixedOptions, index === 0 ? "/" : `/page-${index + 1}`, {
        title: `Launch page ${index + 1}`,
        description: `Deterministic bounded crawl page ${index + 1}.`,
      }));
    const skipped = [
      {
        url: urlFor(fixedOptions, `/page-${fixedOptions.maxPages + 1}`),
        discoveredFrom: fixedOptions.startUrl,
        source: "links" as const,
        reason: "limit_reached" as const,
        message: `Skipped because maxPages ${fixedOptions.maxPages} was reached.`,
      },
    ];
    return createCrawlResult({
      mode: "mock",
      options: fixedOptions,
      observations,
      discoveredCount: fixedOptions.maxPages + 4,
      skipped,
      skippedCount: 4,
      limitations: [`The crawl stopped at maxPages ${fixedOptions.maxPages}; additional same-origin candidates were not audited.`],
    });
  }

  const observations = pagesForScenario(fixedOptions, scenario as CrawlMockScenario);
  return createCrawlResult({
    mode: "mock",
    options: fixedOptions,
    observations,
    discoveredCount: observations.length,
    skipped: [],
    skippedCount: 0,
    limitations: ["Mock scenario uses deterministic same-origin page summaries and performs no network requests."],
  });
}

function pagesForScenario(
  options: NormalizedCrawlOptions,
  scenario: CrawlMockScenario,
): CrawlPageObservation[] {
  if (scenario === "clean-small-site") {
    return [
      mockPage(options, "/", { title: "Example Home", description: "A complete launch-readiness fixture for the home page." }),
      mockPage(options, "/about", { title: "About Example", description: "A complete launch-readiness fixture for the about page." }),
      mockPage(options, "/pricing", { title: "Example Pricing", description: "A complete launch-readiness fixture for the pricing page." }),
    ];
  }

  if (scenario === "missing-descriptions") {
    return [
      mockPage(options, "/", { description: undefined, checks: [issue("metadata.description.missing", "Missing meta description in raw HTML", "critical", "metadata")] }),
      mockPage(options, "/about", { description: undefined, checks: [issue("metadata.description.missing", "Missing meta description in raw HTML", "critical", "metadata")] }),
      mockPage(options, "/pricing", { description: undefined, checks: [issue("metadata.description.missing", "Missing meta description in raw HTML", "critical", "metadata")] }),
      mockPage(options, "/contact", { description: undefined, checks: [issue("metadata.description.missing", "Missing meta description in raw HTML", "critical", "metadata")] }),
    ];
  }

  if (scenario === "canonical-inconsistent") {
    return [
      mockPage(options, "/", { canonicalUrl: urlFor(options, "/") }),
      mockPage(options, "/about", { canonicalUrl: `${options.origin.replace("://", "://www.")}/about` }),
      mockPage(options, "/pricing", { canonicalUrl: `${options.origin.replace("://", "://www.")}/pricing` }),
    ];
  }

  if (scenario === "social-images-missing") {
    return [
      mockPage(options, "/", { ogImage: undefined, checks: [issue("social.og.image_missing", "Missing og:image", "critical", "social")] }),
      mockPage(options, "/about", { ogImage: undefined, checks: [issue("social.og.image_missing", "Missing og:image", "critical", "social")] }),
      mockPage(options, "/pricing", { ogImage: undefined, checks: [issue("social.og.image_missing", "Missing og:image", "critical", "social")] }),
    ];
  }

  return [
    mockPage(options, "/", { title: "Example Home", description: "A complete launch-readiness fixture for the home page." }),
    mockPage(options, "/about", {
      description: undefined,
      checks: [issue("metadata.description.missing", "Missing meta description in raw HTML", "critical", "metadata")],
    }),
    mockPage(options, "/pricing", {
      canonicalUrl: undefined,
      checks: [issue("metadata.canonical.missing", "Missing canonical URL", "critical", "metadata")],
    }),
    mockPage(options, "/blog", {
      ogImage: undefined,
      checks: [issue("social.og.image_missing", "Missing og:image", "critical", "social")],
    }),
  ];
}

function mockPage(
  options: NormalizedCrawlOptions,
  path: string,
  overrides: Partial<CrawlPageObservation> = {},
): CrawlPageObservation {
  const url = urlFor(options, path);
  const baseChecks = overrides.status === "unknown"
    ? []
    : [
        passed("metadata.title.present", "Title present", "metadata"),
        passed("metadata.description.present", "Meta description present", "metadata"),
        passed("metadata.canonical.present", "Canonical URL present", "metadata"),
        passed("social.og.image_present", "og:image present", "social"),
        passed("crawl.robots_txt.found", "robots.txt found", "crawlability"),
        passed("crawl.sitemap.found", "sitemap.xml found", "crawlability"),
      ];
  const issueChecks = overrides.checks ?? [];
  const status = overrides.status ?? (issueChecks.some((check) => check.severity === "critical") ? "needs_attention" : "ready");
  return {
    url,
    depth: path === "/" ? 0 : 1,
    source: path === "/" ? "start" : "links",
    discoveredFrom: path === "/" ? undefined : options.startUrl,
    status,
    httpStatus: overrides.httpStatus ?? (status === "unknown" ? undefined : 200),
    score: overrides.score ?? (status === "ready" ? 96 : status === "unknown" ? undefined : 68),
    title: overrides.title ?? titleFromPath(path),
    description: "description" in overrides ? overrides.description : `Deterministic bounded crawl fixture for ${path}.`,
    canonicalUrl: "canonicalUrl" in overrides ? overrides.canonicalUrl : url,
    ogImage: "ogImage" in overrides ? overrides.ogImage : urlFor(options, "/share.png"),
    checks: [...baseChecks.filter((check) => !issueChecks.some((issue) => sameField(check.id, issue.id))), ...issueChecks],
  };
}

function issue(
  id: string,
  title: string,
  severity: "critical" | "warning" | "info",
  category: AuditCheck["category"],
): AuditCheck {
  return {
    id,
    title,
    category,
    severity,
    description: `Deterministic crawl mock evidence for ${title}.`,
    recommendation: "Review this repeated launch-readiness signal before changing site metadata.",
    confidence: "high",
    fixability: "manual",
  };
}

function passed(
  id: string,
  title: string,
  category: AuditCheck["category"],
): AuditCheck {
  return {
    id,
    title,
    category,
    severity: "passed",
    description: `Deterministic crawl mock pass for ${title}.`,
    confidence: "high",
    fixability: "not_fixable",
  };
}

function sameField(passId: string, issueId: string): boolean {
  return passId.split(".").slice(0, 2).join(".") === issueId.split(".").slice(0, 2).join(".");
}

function titleFromPath(path: string): string {
  if (path === "/") return "Example Home";
  return path
    .replace(/^\//, "")
    .split("-")
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function urlFor(options: NormalizedCrawlOptions, path: string): string {
  return new URL(path, options.origin).toString();
}
