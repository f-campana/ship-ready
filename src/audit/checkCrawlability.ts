import type { AuditResources, ResourceCheck } from "../types/audit";
import { fetchText } from "../utils/http";
import { originResourceUrl, withoutTrailingSlash } from "../utils/url";

export async function checkCrawlabilityResources(
  finalUrl: string,
  options: { timeoutMs: number; userAgent?: string },
): Promise<AuditResources> {
  const [robotsTxt, sitemapXml] = await Promise.all([
    checkRobotsTxt(finalUrl, options),
    checkSitemapXml(finalUrl, options),
  ]);

  return { robotsTxt, sitemapXml };
}

async function checkRobotsTxt(
  auditedUrl: string,
  options: { timeoutMs: number; userAgent?: string },
): Promise<ResourceCheck> {
  const url = originResourceUrl(auditedUrl, "/robots.txt");

  try {
    const response = await fetchText(url, {
      timeoutMs: options.timeoutMs,
      userAgent: options.userAgent,
      accept: "text/plain,*/*;q=0.5",
    });

    const exists = response.statusCode >= 200 && response.statusCode < 300;
    return {
      url,
      finalUrl: response.finalUrl,
      exists,
      ok: exists,
      statusCode: response.statusCode,
      blocksPage: exists ? robotsTxtBlocksUrl(response.body, auditedUrl) : false,
    };
  } catch (error) {
    return {
      url,
      exists: false,
      ok: false,
      error: error instanceof Error ? error.message : "Failed to fetch robots.txt.",
    };
  }
}

async function checkSitemapXml(
  auditedUrl: string,
  options: { timeoutMs: number; userAgent?: string },
): Promise<ResourceCheck> {
  const url = originResourceUrl(auditedUrl, "/sitemap.xml");

  try {
    const response = await fetchText(url, {
      timeoutMs: options.timeoutMs,
      userAgent: options.userAgent,
      accept: "application/xml,text/xml,text/plain,*/*;q=0.5",
    });

    const hasSuccessfulResponse = response.statusCode >= 200 && response.statusCode < 300;
    const exists = hasSuccessfulResponse && isSitemapXmlContent(response.body);
    return {
      url,
      finalUrl: response.finalUrl,
      exists,
      ok: exists,
      statusCode: response.statusCode,
      includesAuditedUrl: exists ? sitemapIncludesUrl(response.body, auditedUrl) : false,
      error: hasSuccessfulResponse && !exists ? "Response did not look like an XML sitemap." : undefined,
    };
  } catch (error) {
    return {
      url,
      exists: false,
      ok: false,
      error: error instanceof Error ? error.message : "Failed to fetch sitemap.xml.",
    };
  }
}

export function robotsTxtBlocksUrl(content: string, targetUrl: string): boolean {
  const target = new URL(targetUrl);
  const groups = parseRobotsGroups(content);
  const applicable = groups.filter((group) =>
    group.agents.some((agent) => agent === "*" || agent.includes("shipready")),
  );

  for (const group of applicable) {
    const matchingRules = group.rules
      .filter((rule) => target.pathname.startsWith(rule.path))
      .sort((a, b) => b.path.length - a.path.length);

    const strongestRule = matchingRules[0];
    if (strongestRule?.directive === "disallow") {
      return true;
    }
  }

  return false;
}

type RobotsGroup = {
  agents: string[];
  rules: Array<{ directive: "allow" | "disallow"; path: string }>;
};

function parseRobotsGroups(content: string): RobotsGroup[] {
  const groups: RobotsGroup[] = [];
  let current: RobotsGroup | undefined;

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.split("#", 1)[0]?.trim();
    if (!line) {
      continue;
    }

    const separator = line.indexOf(":");
    if (separator === -1) {
      continue;
    }

    const directive = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();

    if (directive === "user-agent") {
      if (!current || current.rules.length > 0) {
        current = { agents: [], rules: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      continue;
    }

    if ((directive === "allow" || directive === "disallow") && current) {
      if (value) {
        current.rules.push({
          directive,
          path: value,
        });
      }
    }
  }

  return groups;
}

export function isSitemapXmlContent(content: string): boolean {
  const body = content.trim();
  if (!body) return false;

  const start = body.slice(0, 512).toLowerCase();
  if (start.startsWith("<!doctype html") || start.startsWith("<html")) {
    return false;
  }

  return /<(urlset|sitemapindex)(\s|>)/i.test(body);
}

function sitemapIncludesUrl(content: string, auditedUrl: string): boolean {
  const variants = new Set<string>();
  variants.add(auditedUrl);
  variants.add(withoutTrailingSlash(auditedUrl));

  const withSlash = `${withoutTrailingSlash(auditedUrl)}/`;
  variants.add(withSlash);

  for (const variant of variants) {
    if (content.includes(variant)) {
      return true;
    }
  }

  return false;
}
