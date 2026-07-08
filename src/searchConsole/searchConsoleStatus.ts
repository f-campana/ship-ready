import {
  SearchConsoleStatusJsonContractSchema,
  type SearchConsoleStatusJsonContract,
} from "../types/contracts";
import {
  formatJsonMoreLine,
  formatTerminalReviewHeader,
  type TerminalReviewStatus,
} from "../report/terminalReview";
import { normalizeAuditUrl } from "../utils/url";
import { mockSearchConsoleProvider } from "./mockSearchConsoleProvider";
import type { SearchConsoleStatusProvider } from "./searchConsoleTypes";

export type GetSearchConsoleStatusInput = {
  url: string;
  mock?: string;
  inspect?: boolean;
};

export async function getSearchConsoleStatus(
  input: GetSearchConsoleStatusInput,
  provider: SearchConsoleStatusProvider = mockSearchConsoleProvider,
): Promise<SearchConsoleStatusJsonContract> {
  const url = normalizeAuditUrl(input.url);
  const status = await provider.getStatus({
    url,
    inspect: input.inspect ?? false,
    scenario: input.mock ?? "not_configured",
  });
  return SearchConsoleStatusJsonContractSchema.parse(status);
}

export function formatSearchConsoleStatusJson(status: SearchConsoleStatusJsonContract): string {
  return `${JSON.stringify(SearchConsoleStatusJsonContractSchema.parse(status), null, 2)}\n`;
}

export function formatSearchConsoleStatusHuman(status: SearchConsoleStatusJsonContract): string {
  const lines = [
    ...formatTerminalReviewHeader("ShipReady Search Console status", {
      target: status.requestedUrl,
      mode: `${status.mode} (read-only)`,
      status: formatTerminalStatus(status),
      next: status.nextActions[0],
    }),
    "",
    "Connection",
    `  ${formatAuthorization(status.authorization.status)}`,
    "",
    "Property",
    status.propertyMatch.property
      ? `  ${status.propertyMatch.status}: ${status.propertyMatch.property.siteUrl} (${status.propertyMatch.property.type}, ${status.propertyMatch.property.permissionLevel})`
      : `  ${status.propertyMatch.status}`,
    "",
    "Sitemap",
    `  ${status.sitemaps.status}; ${status.sitemaps.entries.length} record(s)`,
  ];

  for (const sitemap of status.sitemaps.entries) {
    lines.push(`  ${sitemap.path} (warnings: ${sitemap.warnings ?? "not reported"}, errors: ${sitemap.errors ?? "not reported"})`);
  }

  lines.push(
    "",
    "URL inspection",
    `  ${status.inspection.status}${status.inspection.requested ? " (mock indexed-version data)" : ""}`,
  );
  if (status.inspection.result) {
    lines.push(`  Verdict: ${status.inspection.result.verdict ?? "not reported"}`);
    lines.push(`  Coverage: ${status.inspection.result.coverageState ?? "not reported"}`);
    if (status.inspection.result.userCanonical || status.inspection.result.googleCanonical) {
      lines.push(`  User canonical: ${status.inspection.result.userCanonical ?? "not reported"}`);
      lines.push(`  Google canonical: ${status.inspection.result.googleCanonical ?? "not reported"}`);
    }
  }

  lines.push(
    "",
    "Safety",
    "  - Mock-backed only. No live Google API, OAuth, token storage, property changes, sitemap submission, indexing request, or DNS write.",
    "",
    "Limitations",
    ...status.limitations.map((item) => `  - ${item}`),
  );
  lines.push("", "Next actions", ...status.nextActions.map((item) => `  - ${item}`), "");
  lines.push(formatJsonMoreLine(), "");
  return lines.join("\n");
}

function formatAuthorization(status: SearchConsoleStatusJsonContract["authorization"]["status"]): string {
  if (status === "not_configured") {
    return "Search Console live integration is not configured in ShipReady yet. This prototype is mock-backed.";
  }
  return `${status} (deterministic mock state; no live Google authorization was used)`;
}

function formatTerminalStatus(status: SearchConsoleStatusJsonContract): TerminalReviewStatus {
  if (status.authorization.status === "not_configured") return "Unknown";
  if (status.propertyMatch.status === "matched" && status.sitemaps.status === "available") return "Ready";
  if (status.propertyMatch.status === "not_accessible" || status.sitemaps.status === "error") return "Needs attention";
  return "Manual review";
}
