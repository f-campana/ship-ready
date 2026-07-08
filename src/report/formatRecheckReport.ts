import {
  RecheckJsonContractSchema,
  type RecheckJsonContract,
} from "../types/contracts";
import {
  formatJsonMoreLine,
  formatTerminalReviewHeader,
  type TerminalReviewStatus,
} from "./terminalReview";

export function formatRecheckJson(result: RecheckJsonContract): string {
  return `${JSON.stringify(RecheckJsonContractSchema.parse(result), null, 2)}\n`;
}

export function formatRecheckHuman(result: RecheckJsonContract): string {
  const report = RecheckJsonContractSchema.parse(result);
  const lines = [
    ...formatTerminalReviewHeader("ShipReady post-write recheck", {
      target: report.url,
      mode: report.mode === "repo_backed" ? "repo-backed" : "URL-only",
      status: formatStatus(report.verdict.status),
      next: report.nextActions[0],
    }),
    "",
    "Live evidence",
    `  robots.txt: ${report.live.robots.status} — ${report.live.robots.message}`,
    `  sitemap.xml: ${report.live.sitemap.status} — ${report.live.sitemap.message}`,
  ];

  if (report.local) {
    lines.push("", "Local expected files", `  Repo: ${report.local.repoPath}`, `  Framework: ${report.local.framework ?? "unknown"}`);
    if (report.local.expectedFiles.length === 0) {
      lines.push("  No V1-safe expected crawl-file paths could be inferred.");
    } else {
      for (const file of report.local.expectedFiles) {
        lines.push(`  ${file.exists ? "present" : "missing"}: ${file.path}`);
      }
    }
  }

  lines.push(
    "",
    `Deployment: ${report.deployment.status}`,
    `  ${report.deployment.message}`,
    `Recheck verdict: ${report.verdict.status}`,
    `  ${report.verdict.summary}`,
    "",
    "Safety",
    "  - Read-only. No deploy, Git, provider, DNS, Search Console, or repository write is performed.",
    "  - Local files affect the live site only after external deployment.",
    "",
    "Next actions",
    ...report.nextActions.map((action) => `  - ${action}`),
    "",
    "Limitations",
    ...report.limitations.map((limitation) => `  - ${limitation}`),
    "",
    formatJsonMoreLine(),
    "",
  );
  return lines.join("\n");
}

function formatStatus(status: RecheckJsonContract["verdict"]["status"]): TerminalReviewStatus {
  if (status === "ready") return "Ready";
  if (status === "needs_attention" || status === "needs_deploy") return "Needs attention";
  return "Unknown";
}
