import type { AuditCheck, AuditResult } from "../types/audit";
import type { CliErrorCode, CrawlJsonContract } from "../types/contracts";

export const CRAWL_SOURCE_MODES = ["sitemap", "links", "both"] as const;
export type CrawlSourceMode = (typeof CRAWL_SOURCE_MODES)[number];

export const DEFAULT_CRAWL_MAX_PAGES = 8;
export const HARD_CRAWL_MAX_PAGES = 25;
export const DEFAULT_CRAWL_MAX_DEPTH = 1;
export const HARD_CRAWL_MAX_DEPTH = 2;
export const MAX_SITEMAP_URLS_CONSIDERED = 50;
export const MAX_SKIPPED_URLS_REPORTED = 50;

export type CrawlSiteInput = {
  url: string;
  maxPages?: number;
  maxDepth?: number;
  source?: string;
  rendered?: boolean;
  mock?: string;
  timeoutMs?: number;
  userAgent?: string;
  checkedAt?: string;
};

export type NormalizedCrawlOptions = {
  startUrl: string;
  origin: string;
  maxPages: number;
  maxDepth: number;
  source: CrawlSourceMode;
  rendered: boolean;
  timeoutMs: number;
  userAgent?: string;
  checkedAt?: string;
};

export type CrawlPageQueueItem = {
  url: string;
  depth: number;
  source: "start" | "links" | "sitemap";
  discoveredFrom?: string;
};

export type CrawlSkippedReason =
  CrawlJsonContract["skipped"][number]["reason"];

export type CrawlSkippedUrl = CrawlJsonContract["skipped"][number];
export type CrawlPageSummary = CrawlJsonContract["pages"][number];
export type CrawlTopIssue = CrawlPageSummary["topIssues"][number];

export type CrawlPageObservation = CrawlPageQueueItem & {
  status: CrawlPageSummary["status"];
  audit?: AuditResult;
  httpStatus?: number;
  score?: number;
  title?: string;
  description?: string;
  canonicalUrl?: string;
  ogImage?: string;
  checks: AuditCheck[];
};

export class CrawlError extends Error {
  constructor(
    readonly code: CliErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "CrawlError";
  }
}
