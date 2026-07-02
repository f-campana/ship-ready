import {
  RecheckJsonContractSchema,
  type RecheckJsonContract,
} from "../types/contracts";

export function formatRecheckJson(result: RecheckJsonContract): string {
  return `${JSON.stringify(RecheckJsonContractSchema.parse(result), null, 2)}\n`;
}

export function formatRecheckHuman(result: RecheckJsonContract): string {
  const report = RecheckJsonContractSchema.parse(result);
  const lines = [
    "ShipReady post-write recheck",
    `URL: ${report.url}`,
    `Mode: ${report.mode === "repo_backed" ? "repo-backed" : "URL-only"}`,
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
    `Verdict: ${report.verdict.status}`,
    `  ${report.verdict.summary}`,
    "",
    "Next actions",
    ...report.nextActions.map((action) => `  - ${action}`),
    "",
    "Limitations",
    ...report.limitations.map((limitation) => `  - ${limitation}`),
    "",
  );
  return lines.join("\n");
}
