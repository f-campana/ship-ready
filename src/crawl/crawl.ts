import { auditUrl } from "../audit/auditUrl";
import type { AuditCheck, AuditResult } from "../types/audit";
import {
  CONTRACT_NAMES,
  CrawlJsonContractSchema,
  type CrawlJsonContract,
} from "../types/contracts";
import { DEFAULT_USER_AGENT, NetworkError } from "../utils/http";
import { normalizeAuditUrl } from "../utils/url";
import {
  discoverLinksFromAudit,
  discoverSitemapUrls,
  normalizeCrawlPageUrl,
} from "./linkDiscovery";
import { getMockCrawl } from "./mockCrawl";
import {
  CRAWL_SOURCE_MODES,
  DEFAULT_CRAWL_MAX_DEPTH,
  DEFAULT_CRAWL_MAX_PAGES,
  HARD_CRAWL_MAX_DEPTH,
  HARD_CRAWL_MAX_PAGES,
  MAX_SKIPPED_URLS_REPORTED,
  CrawlError,
  type CrawlPageObservation,
  type CrawlPageQueueItem,
  type CrawlSiteInput,
  type CrawlSkippedUrl,
  type NormalizedCrawlOptions,
} from "./crawlTypes";

type SkippedCollector = {
  reported: CrawlSkippedUrl[];
  total: number;
  truncated: boolean;
};

const SEVERITY_RANK: Record<AuditCheck["severity"], number> = {
  critical: 0,
  warning: 1,
  info: 2,
  passed: 3,
};

export async function crawlSite(input: CrawlSiteInput): Promise<CrawlJsonContract> {
  const options = normalizeCrawlOptions(input);
  if (input.mock) {
    return getMockCrawl(options, input.mock);
  }
  return crawlLive(options);
}

export function normalizeCrawlOptions(input: CrawlSiteInput): NormalizedCrawlOptions {
  const startUrl = normalizeCrawlStartUrl(input.url);
  const parsed = new URL(startUrl);
  const source = input.source ?? "both";
  if (!CRAWL_SOURCE_MODES.includes(source as never)) {
    throw new CrawlError(
      "invalid_mode",
      `Unsupported crawl source: ${source}. Use sitemap, links, or both.`,
    );
  }

  const maxPages = normalizePositiveIntegerOption(
    input.maxPages,
    DEFAULT_CRAWL_MAX_PAGES,
    HARD_CRAWL_MAX_PAGES,
    "maxPages",
  );
  const maxDepth = normalizeNonnegativeIntegerOption(
    input.maxDepth,
    DEFAULT_CRAWL_MAX_DEPTH,
    HARD_CRAWL_MAX_DEPTH,
    "maxDepth",
  );
  const timeoutMs = input.timeoutMs ?? 15000;
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new CrawlError("invalid_timeout", "Invalid timeout. Provide a positive number of milliseconds.");
  }

  return {
    startUrl,
    origin: parsed.origin,
    maxPages,
    maxDepth,
    source: source as NormalizedCrawlOptions["source"],
    rendered: input.rendered ?? true,
    timeoutMs,
    userAgent: input.userAgent ?? DEFAULT_USER_AGENT,
    checkedAt: input.checkedAt,
  };
}

export function normalizeCrawlStartUrl(input: string): string {
  const normalized = normalizeAuditUrl(input);
  const url = new URL(normalized);
  url.search = "";
  url.hash = "";
  return url.toString();
}

export function createCrawlResult(input: {
  mode: "live" | "mock";
  options: NormalizedCrawlOptions;
  observations: CrawlPageObservation[];
  discoveredCount: number;
  skipped: CrawlSkippedUrl[];
  skippedCount: number;
  limitations: string[];
}): CrawlJsonContract {
  const pages = input.observations.map(pageSummaryFromObservation);
  const repeatedFindings = aggregateRepeatedFindings(input.observations);
  const consistency = summarizeConsistency(input.observations);
  const criticalIssues = input.observations.reduce(
    (total, page) => total + page.checks.filter((check) => check.severity === "critical").length,
    0,
  );
  const warnings = input.observations.reduce(
    (total, page) => total + page.checks.filter((check) => check.severity === "warning").length,
    0,
  );

  const limitations = dedupeStrings([
    "This is a bounded same-origin launch-readiness sample, not a full-site crawl or complete SEO audit.",
    "Only compact page summaries are returned; raw HTML and full audit payloads are not embedded.",
    ...input.limitations,
  ]);

  const status = summarizeStatus({
    pages,
    repeatedFindings,
    consistencyIssues: consistency.issues,
    limitations,
  });

  return CrawlJsonContractSchema.parse({
    contract: CONTRACT_NAMES.crawl,
    checkedAt: input.options.checkedAt ?? new Date().toISOString(),
    mode: input.mode,
    startUrl: input.options.startUrl,
    origin: input.options.origin,
    options: {
      maxPages: input.options.maxPages,
      maxDepth: input.options.maxDepth,
      source: input.options.source,
      rendered: input.options.rendered,
    },
    summary: {
      status,
      pagesChecked: pages.length,
      pagesDiscovered: input.discoveredCount,
      pagesSkipped: input.skippedCount,
      criticalIssues,
      warnings,
      repeatedIssues: repeatedFindings.length,
    },
    pages,
    repeatedFindings,
    consistency,
    skipped: input.skipped.slice(0, MAX_SKIPPED_URLS_REPORTED),
    limitations,
    nextActions: nextActionsForStatus(status, repeatedFindings.length, consistency.issues.length),
  });
}

async function crawlLive(options: NormalizedCrawlOptions): Promise<CrawlJsonContract> {
  const queue: CrawlPageQueueItem[] = [{
    url: options.startUrl,
    depth: 0,
    source: "start",
  }];
  const enqueued = new Set([options.startUrl]);
  const discovered = new Set([options.startUrl]);
  const skipped = createSkippedCollector();
  const limitations: string[] = [];

  const sitemap = await discoverSitemapUrls(options.startUrl, options.origin, options.source, {
    timeoutMs: options.timeoutMs,
    userAgent: options.userAgent,
  });
  limitations.push(...sitemap.limitations);
  for (const item of sitemap.skipped) pushSkipped(skipped, item);
  for (const url of sitemap.urls) {
    discovered.add(url);
    enqueueCandidate(queue, enqueued, skipped, {
      url,
      depth: 1,
      source: "sitemap",
      discoveredFrom: sitemapOrigin(options.startUrl),
    }, options);
  }

  const observations: CrawlPageObservation[] = [];
  while (queue.length > 0 && observations.length < options.maxPages) {
    const item = queue.shift()!;
    if (item.depth > options.maxDepth) {
      pushSkipped(skipped, {
        url: item.url,
        source: item.source === "start" ? undefined : item.source,
        discoveredFrom: item.discoveredFrom,
        reason: "limit_reached",
        message: `Skipped because maxDepth ${options.maxDepth} was reached.`,
      });
      continue;
    }

    const observation = await auditQueueItem(item, options);
    observations.push(observation);

    if (!observation.audit || options.source === "sitemap" || item.depth >= options.maxDepth) {
      continue;
    }

    for (const href of discoverLinksFromAudit(observation.audit)) {
      const normalized = normalizeCrawlPageUrl(href, observation.audit.finalUrl, options.origin, {
        allowQuery: false,
      });
      if (!normalized.ok) {
        pushSkipped(skipped, {
          url: normalized.url,
          source: "links",
          discoveredFrom: observation.url,
          reason: normalized.reason,
          message: normalized.message,
        });
        continue;
      }
      discovered.add(normalized.url);
      enqueueCandidate(queue, enqueued, skipped, {
        url: normalized.url,
        depth: item.depth + 1,
        source: "links",
        discoveredFrom: observation.url,
      }, options);
    }
  }

  if (queue.length > 0) {
    limitations.push(`The crawl stopped at maxPages ${options.maxPages}; additional same-origin candidates were not audited.`);
    for (const item of queue.splice(0)) {
      pushSkipped(skipped, {
        url: item.url,
        source: item.source === "start" ? undefined : item.source,
        discoveredFrom: item.discoveredFrom,
        reason: "limit_reached",
        message: `Skipped because maxPages ${options.maxPages} was reached.`,
      });
    }
  }
  if (skipped.truncated) {
    limitations.push(`Skipped URL details were capped at ${MAX_SKIPPED_URLS_REPORTED} entries.`);
  }
  if (observations.some((page) => page.depth === options.maxDepth) && options.maxDepth < HARD_CRAWL_MAX_DEPTH) {
    limitations.push(`Discovery stopped at maxDepth ${options.maxDepth}.`);
  }

  return createCrawlResult({
    mode: "live",
    options,
    observations,
    discoveredCount: discovered.size,
    skipped: skipped.reported,
    skippedCount: skipped.total,
    limitations,
  });
}

async function auditQueueItem(
  item: CrawlPageQueueItem,
  options: NormalizedCrawlOptions,
): Promise<CrawlPageObservation> {
  try {
    const audit = await auditUrl(item.url, {
      timeoutMs: options.timeoutMs,
      userAgent: options.userAgent,
      render: options.rendered,
    });
    const status = audit.status === "good"
      ? "ready"
      : audit.status === "critical"
        ? "critical"
        : "needs_attention";
    return {
      ...item,
      url: safeUrl(audit.finalUrl) ?? item.url,
      status,
      audit,
      httpStatus: audit.httpStatus,
      score: audit.score,
      title: compactText(audit.raw.metadata.title, 180),
      description: compactText(audit.raw.metadata.description, 240),
      canonicalUrl: safeUrl(audit.raw.metadata.canonical),
      ogImage: safeUrl(audit.raw.metadata.openGraph.image),
      checks: audit.checks,
    };
  } catch (error) {
    const message = error instanceof NetworkError
      ? "The page could not be read during this bounded crawl."
      : "The page audit could not complete during this bounded crawl.";
    const check: AuditCheck = {
      id: "crawl.page.unreachable",
      category: "crawlability",
      severity: "critical",
      title: "Page could not be audited",
      description: message,
      recommendation: "Verify that this public URL is reachable, then run the bounded crawl again.",
      confidence: "medium",
      fixability: "manual",
    };
    return {
      ...item,
      status: "unknown",
      checks: [check],
    };
  }
}

function enqueueCandidate(
  queue: CrawlPageQueueItem[],
  enqueued: Set<string>,
  skipped: SkippedCollector,
  item: CrawlPageQueueItem,
  options: NormalizedCrawlOptions,
): void {
  if (enqueued.has(item.url)) {
    pushSkipped(skipped, {
      url: item.url,
      source: item.source === "start" ? undefined : item.source,
      discoveredFrom: item.discoveredFrom,
      reason: "duplicate",
      message: "Skipped a duplicate normalized URL.",
    });
    return;
  }
  if (item.depth > options.maxDepth) {
    pushSkipped(skipped, {
      url: item.url,
      source: item.source === "start" ? undefined : item.source,
      discoveredFrom: item.discoveredFrom,
      reason: "limit_reached",
      message: `Skipped because maxDepth ${options.maxDepth} was reached.`,
    });
    return;
  }
  enqueued.add(item.url);
  queue.push(item);
}

function pageSummaryFromObservation(page: CrawlPageObservation) {
  const topIssues = page.checks
    .filter((check) => check.severity !== "passed")
    .sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] || a.id.localeCompare(b.id))
    .slice(0, 5)
    .map((check) => ({
      id: check.id,
      title: check.title,
      severity: check.severity === "critical" ? "critical" as const : check.severity === "warning" ? "warning" as const : "info" as const,
      category: check.category,
    }));

  return {
    url: page.url,
    depth: page.depth,
    discoveredFrom: page.discoveredFrom,
    source: page.source,
    status: page.status,
    httpStatus: page.httpStatus,
    score: page.score,
    title: page.title,
    description: page.description,
    canonicalUrl: page.canonicalUrl,
    issueSummary: {
      critical: page.checks.filter((check) => check.severity === "critical").length,
      warnings: page.checks.filter((check) => check.severity === "warning").length,
      topIssueTitles: topIssues.map((issue) => issue.title).slice(0, 5),
    },
    topIssues,
    auditContract: page.audit ? CONTRACT_NAMES.audit : undefined,
  };
}

function aggregateRepeatedFindings(observations: CrawlPageObservation[]) {
  const groups = new Map<string, {
    id: string;
    title: string;
    category: string;
    severity: "critical" | "warning" | "info";
    pages: Set<string>;
  }>();

  for (const page of observations) {
    for (const check of page.checks) {
      if (check.severity === "passed") continue;
      const severity = check.severity === "critical" ? "critical" : check.severity === "warning" ? "warning" : "info";
      const group = groups.get(check.id) ?? {
        id: check.id,
        title: check.title,
        category: check.category,
        severity,
        pages: new Set<string>(),
      };
      if (SEVERITY_RANK[check.severity] < SEVERITY_RANK[group.severity]) {
        group.severity = severity;
      }
      group.pages.add(page.url);
      groups.set(check.id, group);
    }
  }

  return [...groups.values()]
    .filter((group) => group.pages.size >= 2)
    .sort((a, b) =>
      severitySortValue(a.severity) - severitySortValue(b.severity) ||
      b.pages.size - a.pages.size ||
      a.id.localeCompare(b.id))
    .slice(0, 20)
    .map((group) => {
      const affectedPages = [...group.pages].sort();
      return {
        id: group.id,
        title: group.title,
        category: group.category,
        severity: group.severity,
        count: affectedPages.length,
        affectedPages,
        message: `${group.title} appears on ${affectedPages.length}/${observations.length} checked pages; review recommended.`,
      };
    });
}

function summarizeConsistency(observations: CrawlPageObservation[]): CrawlJsonContract["consistency"] {
  const canonicalHostMap = new Map<string, string[]>();
  const titleMap = new Map<string, string[]>();
  const missing = {
    title: [] as string[],
    description: [] as string[],
    canonical: [] as string[],
    "og:image": [] as string[],
  };

  for (const page of observations) {
    if (page.title) {
      const key = page.title.trim().toLowerCase();
      titleMap.set(key, [...(titleMap.get(key) ?? []), page.url]);
    } else {
      missing.title.push(page.url);
    }
    if (!page.description) missing.description.push(page.url);
    if (!page.canonicalUrl) {
      missing.canonical.push(page.url);
    } else {
      try {
        const host = new URL(page.canonicalUrl).host.toLowerCase();
        canonicalHostMap.set(host, [...(canonicalHostMap.get(host) ?? []), page.url]);
      } catch {
        missing.canonical.push(page.url);
      }
    }
    if (!page.ogImage) missing["og:image"].push(page.url);
  }

  const canonicalHosts = [...canonicalHostMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([host, urls]) => ({ host, count: urls.length, urls: urls.sort() }));

  const duplicateTitles = [...titleMap.entries()]
    .filter(([, urls]) => urls.length > 1)
    .map(([title, urls]) => ({
      title: compactText(observations.find((page) => page.title?.trim().toLowerCase() === title)?.title, 180) ?? title,
      count: urls.length,
      urls: urls.sort(),
    }));

  const missingMetadata = Object.entries(missing)
    .filter(([, urls]) => urls.length > 0)
    .map(([field, urls]) => ({
      field: field as "title" | "description" | "canonical" | "og:image",
      count: urls.length,
      urls: urls.sort(),
    }));

  const issues: CrawlJsonContract["consistency"]["issues"] = [];
  if (canonicalHosts.length > 1) {
    issues.push({
      id: "metadata.canonical.host_inconsistent",
      title: "Canonical hosts vary across checked pages",
      severity: "warning",
      message: "The bounded sample exposed more than one canonical host; review whether that is intentional.",
      affectedPages: canonicalHosts.flatMap((host) => host.urls).sort(),
    });
  }
  for (const item of missingMetadata) {
    if (item.count >= 2) {
      issues.push({
        id: `metadata.${item.field.replace(":", ".")}.missing_repeated`,
        title: `Repeated missing ${item.field}`,
        severity: item.field === "description" || item.field === "canonical" ? "critical" : "warning",
        message: `${item.field} is missing on ${item.count}/${observations.length} checked pages.`,
        affectedPages: item.urls,
      });
    }
  }
  for (const duplicate of duplicateTitles) {
    issues.push({
      id: "metadata.title.duplicate",
      title: "Repeated page title",
      severity: "warning",
      message: `The title "${duplicate.title}" appears on ${duplicate.count} checked pages.`,
      affectedPages: duplicate.urls,
    });
  }

  return {
    canonicalHosts,
    titlePatterns: {
      duplicateTitles,
      missingTitles: missing.title.length,
    },
    missingMetadata,
    issues: issues.slice(0, 20),
  };
}

function summarizeStatus(input: {
  pages: CrawlJsonContract["pages"];
  repeatedFindings: CrawlJsonContract["repeatedFindings"];
  consistencyIssues: CrawlJsonContract["consistency"]["issues"];
  limitations: string[];
}): CrawlJsonContract["summary"]["status"] {
  if (input.pages.length === 0 || input.pages[0]?.status === "unknown") return "unknown";
  if (
    input.pages.some((page) => page.status !== "ready") ||
    input.repeatedFindings.length > 0 ||
    input.consistencyIssues.length > 0 ||
    input.limitations.some((limitation) => limitation.includes("maxPages"))
  ) {
    return "needs_attention";
  }
  return "ready";
}

function nextActionsForStatus(
  status: CrawlJsonContract["summary"]["status"],
  repeatedFindings: number,
  consistencyIssues: number,
): string[] {
  const actions: string[] = [];
  if (status === "ready") {
    actions.push("Keep the bounded sample as launch-readiness evidence and re-run after meaningful site changes.");
  } else if (status === "unknown") {
    actions.push("Verify the starting public URL is reachable, then run the bounded crawl again.");
  } else {
    actions.push("Review page-level top issues before changing metadata or crawl resources.");
  }
  if (repeatedFindings > 0) {
    actions.push("Prioritize repeated findings because the same launch-readiness issue appears on multiple checked pages.");
  }
  if (consistencyIssues > 0) {
    actions.push("Review metadata consistency across the checked same-origin pages.");
  }
  actions.push("Use single-page `shipready audit --json` for full details on any individual page that needs review.");
  return actions;
}

function normalizePositiveIntegerOption(
  value: number | undefined,
  defaultValue: number,
  hardMax: number,
  name: string,
): number {
  if (value === undefined) return defaultValue;
  if (!Number.isInteger(value) || value <= 0) {
    throw new CrawlError("invalid_mode", `Invalid ${name}. Provide a positive integer.`);
  }
  return Math.min(value, hardMax);
}

function normalizeNonnegativeIntegerOption(
  value: number | undefined,
  defaultValue: number,
  hardMax: number,
  name: string,
): number {
  if (value === undefined) return defaultValue;
  if (!Number.isInteger(value) || value < 0) {
    throw new CrawlError("invalid_mode", `Invalid ${name}. Provide a non-negative integer.`);
  }
  return Math.min(value, hardMax);
}

function createSkippedCollector(): SkippedCollector {
  return { reported: [], total: 0, truncated: false };
}

function pushSkipped(collector: SkippedCollector, item: CrawlSkippedUrl): void {
  collector.total += 1;
  if (collector.reported.length < MAX_SKIPPED_URLS_REPORTED) {
    collector.reported.push(item);
  } else {
    collector.truncated = true;
  }
}

function safeUrl(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    url.username = "";
    url.password = "";
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return undefined;
  }
}

function compactText(value: string | undefined, maxLength: number): string | undefined {
  const normalized = value?.replace(/\s+/g, " ").trim();
  if (!normalized) return undefined;
  return normalized.length <= maxLength ? normalized : `${normalized.slice(0, maxLength - 3)}...`;
}

function dedupeStrings(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function severitySortValue(value: "critical" | "warning" | "info"): number {
  if (value === "critical") return 0;
  if (value === "warning") return 1;
  return 2;
}

function sitemapOrigin(startUrl: string): string {
  return new URL("/sitemap.xml", startUrl).toString();
}
