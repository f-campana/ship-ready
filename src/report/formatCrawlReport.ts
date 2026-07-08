import {
  CrawlJsonContractSchema,
  type CrawlJsonContract,
} from "../types/contracts";
import {
  formatJsonMoreLine,
  formatTerminalReviewHeader,
  truncateTerminalValue,
  type TerminalReviewStatus,
} from "./terminalReview";

export function formatCrawlJson(result: CrawlJsonContract): string {
  return `${JSON.stringify(CrawlJsonContractSchema.parse(result), null, 2)}\n`;
}

export function formatCrawlHuman(result: CrawlJsonContract): string {
  const lines = [
    ...formatTerminalReviewHeader("ShipReady bounded crawl", {
      target: result.startUrl,
      mode: `${result.mode}; source ${result.options.source}; rendered ${result.options.rendered ? "yes" : "no"}`,
      status: formatStatus(result.summary.status),
      next: result.nextActions[0],
    }),
    `Origin: ${result.origin}`,
    `Limits: maxPages ${result.options.maxPages}, maxDepth ${result.options.maxDepth}`,
    "",
    "Summary",
    `  Status: ${result.summary.status}`,
    `  Pages checked: ${result.summary.pagesChecked}`,
    `  Pages discovered: ${result.summary.pagesDiscovered}`,
    `  Pages skipped: ${result.summary.pagesSkipped}`,
    `  Critical issues: ${result.summary.criticalIssues}`,
    `  Warnings: ${result.summary.warnings}`,
    `  Repeated findings: ${result.summary.repeatedIssues}`,
    "",
    "Pages checked",
  ];

  if (result.pages.length === 0) {
    lines.push("  None checked.");
  } else {
    for (const page of result.pages) {
      const score = page.score === undefined ? "n/a" : String(page.score);
      const top = page.issueSummary.topIssueTitles.length > 0
        ? `; top: ${truncateTerminalValue(page.issueSummary.topIssueTitles.join("; "), 120)}`
        : "";
      lines.push(`  - ${page.status} score ${score} depth ${page.depth}: ${page.url}${top}`);
    }
  }

  lines.push("", "Repeated findings");
  if (result.repeatedFindings.length === 0) {
    lines.push("  None in the bounded sample.");
  } else {
    for (const finding of result.repeatedFindings) {
      lines.push(`  - ${finding.severity}: ${finding.title} on ${finding.count} pages`);
    }
  }

  lines.push("", "Metadata consistency");
  if (result.consistency.issues.length === 0) {
    lines.push("  No repeated metadata consistency issue was detected in the bounded sample.");
  } else {
    for (const issue of result.consistency.issues) {
      lines.push(`  - ${issue.severity}: ${issue.title} (${issue.affectedPages.length} pages)`);
    }
  }
  if (result.consistency.canonicalHosts.length > 0) {
    lines.push(`  Canonical hosts: ${result.consistency.canonicalHosts.map((host) => `${host.host} (${host.count})`).join(", ")}`);
  }

  lines.push("", "Skipped URLs / limits");
  if (result.skipped.length === 0) {
    lines.push("  No skipped URL candidates were reported.");
  } else {
    for (const skipped of result.skipped.slice(0, 6)) {
      lines.push(`  - ${skipped.reason}: ${skipped.url ?? "unreported URL"}${skipped.discoveredFrom ? ` from ${skipped.discoveredFrom}` : ""}`);
    }
    if (result.skipped.length > 6) lines.push(`  - ${result.skipped.length - 6} more skipped candidate(s) available with --json.`);
  }

  lines.push("", "Safety");
  lines.push("  - Bounded same-origin sample. Not exhaustive site coverage, monitoring, indexing evidence, or a write path.");
  lines.push("  - No files, DNS records, Search Console state, social platforms, GitHub, Git, or deployments are changed.");

  lines.push("", "Limitations");
  for (const limitation of result.limitations) {
    lines.push(`  - ${limitation}`);
  }

  lines.push("", "Next actions");
  for (const action of result.nextActions) {
    lines.push(`  - ${action}`);
  }

  lines.push("", formatJsonMoreLine());
  lines.push("");
  return lines.join("\n");
}

function formatStatus(status: CrawlJsonContract["summary"]["status"]): TerminalReviewStatus {
  if (status === "ready") return "Ready";
  if (status === "needs_attention") return "Needs attention";
  return "Unknown";
}
