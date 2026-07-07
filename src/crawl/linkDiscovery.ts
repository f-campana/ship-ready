import { load } from "cheerio";
import type { AuditResult } from "../types/audit";
import { fetchText } from "../utils/http";
import { originResourceUrl } from "../utils/url";
import {
  MAX_SITEMAP_URLS_CONSIDERED,
  type CrawlSkippedReason,
  type CrawlSkippedUrl,
  type CrawlSourceMode,
} from "./crawlTypes";

const ASSET_EXTENSION_RE = /\.(?:avif|bmp|css|csv|doc|docx|eot|gif|ico|jpeg|jpg|js|json|map|mp3|mp4|ogg|otf|pdf|png|svg|ttf|txt|webm|webmanifest|webp|woff|woff2|xml|zip)$/i;
const UNSUPPORTED_PROTOCOLS = new Set([
  "mailto:",
  "tel:",
  "javascript:",
  "data:",
  "blob:",
  "file:",
  "ftp:",
]);
const MAX_SITEMAP_BYTES = 200_000;

export type NormalizedCandidate =
  | { ok: true; url: string }
  | { ok: false; reason: CrawlSkippedReason; url?: string; message: string };

export type LinkCandidate = {
  href: string;
  source: "links" | "sitemap";
  discoveredFrom?: string;
};

export type SitemapDiscoveryResult = {
  urls: string[];
  skipped: CrawlSkippedUrl[];
  limitations: string[];
};

export function normalizeCrawlPageUrl(
  value: string,
  baseUrl: string,
  origin: string,
  options: { allowQuery: boolean },
): NormalizedCandidate {
  const trimmed = value.trim();
  if (!trimmed) {
    return {
      ok: false,
      reason: "error",
      message: "Skipped an empty URL candidate.",
    };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed, baseUrl);
  } catch {
    return {
      ok: false,
      reason: "error",
      message: "Skipped a URL candidate that could not be parsed.",
    };
  }

  if (UNSUPPORTED_PROTOCOLS.has(parsed.protocol) || (parsed.protocol !== "http:" && parsed.protocol !== "https:")) {
    return {
      ok: false,
      reason: "unsupported_protocol",
      message: "Skipped a non-HTTP(S) URL candidate.",
    };
  }

  if (parsed.username || parsed.password) {
    parsed.username = "";
    parsed.password = "";
    parsed.search = "";
    parsed.hash = "";
    return {
      ok: false,
      reason: "unsupported_protocol",
      url: parsed.toString(),
      message: "Skipped a URL candidate with embedded credentials.",
    };
  }

  parsed.hash = "";

  if (parsed.origin !== origin) {
    parsed.search = "";
    return {
      ok: false,
      reason: "outside_origin",
      url: parsed.toString(),
      message: "Skipped a URL outside the starting origin.",
    };
  }

  if (ASSET_EXTENSION_RE.test(parsed.pathname)) {
    parsed.search = "";
    return {
      ok: false,
      reason: "asset",
      url: parsed.toString(),
      message: "Skipped an asset URL rather than treating it as a page.",
    };
  }

  if (parsed.search && !options.allowQuery) {
    parsed.search = "";
    return {
      ok: false,
      reason: "query_skipped",
      url: parsed.toString(),
      message: "Skipped a query-string URL to keep the crawl bounded and avoid exposing query values.",
    };
  }

  parsed.search = "";
  return { ok: true, url: parsed.toString() };
}

export function discoverLinksFromAudit(audit: AuditResult): string[] {
  const hrefs = new Set<string>();
  for (const snapshot of [audit.raw, audit.rendered]) {
    for (const link of snapshot.links.items) {
      if (link.href) hrefs.add(link.href);
    }
  }
  return [...hrefs];
}

export async function discoverSitemapUrls(
  startUrl: string,
  origin: string,
  source: CrawlSourceMode,
  options: { timeoutMs: number; userAgent?: string },
): Promise<SitemapDiscoveryResult> {
  if (source === "links") {
    return { urls: [], skipped: [], limitations: [] };
  }

  const sitemapUrl = originResourceUrl(startUrl, "/sitemap.xml");
  const skipped: CrawlSkippedUrl[] = [];
  const limitations: string[] = [];

  try {
    const response = await fetchText(sitemapUrl, {
      timeoutMs: options.timeoutMs,
      userAgent: options.userAgent,
      accept: "application/xml,text/xml,text/plain,*/*;q=0.5",
    });
    if (!response.ok) {
      limitations.push("Conventional /sitemap.xml was not available, so sitemap seeding was limited.");
      return { urls: [], skipped, limitations };
    }
    if (Buffer.byteLength(response.body, "utf8") > MAX_SITEMAP_BYTES) {
      limitations.push("Conventional /sitemap.xml exceeded the V1 sitemap-size limit and was not parsed.");
      return { urls: [], skipped, limitations };
    }

    const $ = load(response.body, { xmlMode: true });
    const sitemapIndexLocs = $("sitemap > loc")
      .map((_, element) => $(element).text().trim())
      .get()
      .filter(Boolean);
    if (sitemapIndexLocs.length > 0) {
      limitations.push("Sitemap index expansion is not performed in V1; only direct URL entries in /sitemap.xml are considered.");
    }

    const urls: string[] = [];
    const locs = $("url > loc")
      .map((_, element) => $(element).text().trim())
      .get()
      .filter(Boolean)
      .slice(0, MAX_SITEMAP_URLS_CONSIDERED);

    if (locs.length === MAX_SITEMAP_URLS_CONSIDERED) {
      limitations.push(`Only the first ${MAX_SITEMAP_URLS_CONSIDERED} sitemap URL entries were considered.`);
    }

    for (const loc of locs) {
      const normalized = normalizeCrawlPageUrl(loc, sitemapUrl, origin, { allowQuery: false });
      if (normalized.ok) {
        urls.push(normalized.url);
      } else {
        skipped.push({
          url: normalized.url,
          source: "sitemap",
          discoveredFrom: sitemapUrl,
          reason: normalized.reason,
          message: normalized.message,
        });
      }
    }

    return { urls: [...new Set(urls)], skipped, limitations };
  } catch {
    return {
      urls: [],
      skipped,
      limitations: ["Conventional /sitemap.xml could not be read; link discovery still used when enabled."],
    };
  }
}
