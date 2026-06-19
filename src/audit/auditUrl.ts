import { AuditResultSchema, type AuditResult } from "../types/audit";
import { DEFAULT_USER_AGENT } from "../utils/http";
import { normalizeAuditUrl } from "../utils/url";
import { checkCrawlabilityResources } from "./checkCrawlability";
import { checkMetadata } from "./checkMetadata";
import { compareMetadata } from "./compareMetadata";
import { extractMetadata } from "./extractMetadata";
import { fetchRawHtml } from "./fetchRawHtml";
import { renderHtml } from "./renderHtml";
import { classifyAuditStatus, scoreAudit } from "./scoreAudit";

export type AuditUrlOptions = {
  timeoutMs?: number;
  userAgent?: string;
  render?: boolean;
};

export async function auditUrl(
  inputUrl: string,
  options: AuditUrlOptions = {},
): Promise<AuditResult> {
  const url = normalizeAuditUrl(inputUrl);
  const timeoutMs = options.timeoutMs ?? 15000;
  const userAgent = options.userAgent ?? DEFAULT_USER_AGENT;

  const rawHtml = await fetchRawHtml(url, { timeoutMs, userAgent });
  const raw = extractMetadata(rawHtml.html, {
    source: "raw",
    url: rawHtml.finalUrl,
  });

  const renderedHtml =
    options.render === false
      ? { finalUrl: rawHtml.finalUrl, statusCode: rawHtml.statusCode, html: rawHtml.html }
      : await renderHtml(rawHtml.finalUrl, { timeoutMs, userAgent });

  const rendered = extractMetadata(renderedHtml.html, {
    source: "rendered",
    url: renderedHtml.finalUrl,
  });

  const finalUrl = renderedHtml.finalUrl || rawHtml.finalUrl;
  const resources = await checkCrawlabilityResources(finalUrl, {
    timeoutMs,
    userAgent,
  });
  const comparison = compareMetadata(raw, rendered);
  const checks = checkMetadata({
    url,
    finalUrl,
    httpStatus: rawHtml.statusCode,
    raw,
    rendered,
    comparison,
    resources,
  });
  const score = scoreAudit({ raw, rendered, comparison, resources });
  const status = classifyAuditStatus(score, checks);

  return AuditResultSchema.parse({
    url,
    finalUrl,
    auditedAt: new Date().toISOString(),
    httpStatus: rawHtml.statusCode,
    score,
    status,
    raw,
    rendered,
    comparison,
    checks,
    resources,
  });
}

