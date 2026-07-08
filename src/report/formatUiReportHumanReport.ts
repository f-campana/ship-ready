import type { UiReport } from "../types/uiReport";
import {
  formatJsonMoreLine,
  formatTerminalReviewHeader,
  type TerminalReviewStatus,
} from "./terminalReview";

export function formatUiReportHumanReport(report: UiReport): string {
  const next = report.workflow.availableNextActions.find((action) => action.primary)
    ?? report.workflow.availableNextActions[0];
  const lines = [
    ...formatTerminalReviewHeader("ShipReady UI report", {
      target: report.input.url,
      ...(report.input.repoPath ? { repo: report.input.repoPath } : {}),
      mode: report.input.mode === "url_and_repo" ? "URL + repo" : "URL only",
      status: formatReadinessStatus(report.readiness.label, report.errors.length),
      next: next?.label ?? "Use --json for structured GUI data.",
    }),
    "",
    "Summary",
    `- ${report.readiness.title}`,
    `- ${report.readiness.summary}`,
    `- Completed stages: ${report.workflow.completedStages.join(", ") || "none"}`,
    "",
    "Top findings",
    ...formatTopIssues(report),
    "",
    "Evidence",
    `- Preview cards: google, social, twitter, crawler view`,
    `- Safe apply available: ${report.safeApply?.available ? "yes" : "no"}`,
    `- Local changes affect live site now: ${report.liveVsLocal.localChangesAffectLiveSite ? "yes" : "no"}`,
    "",
    "Safety",
    "- Read-only UI data. No files were modified and no GUI write endpoint is used.",
    "- Safe crawl-file creation, patch export, and PR draft handoff remain copy/review workflows outside this command.",
    "",
    formatJsonMoreLine(),
    "",
  ];

  return lines.join("\n");
}

function formatTopIssues(report: UiReport): string[] {
  if (report.errors.length > 0) {
    return report.errors.slice(0, 5).map((error) => `- ${error.stage}: ${error.title} - ${error.message}`);
  }

  if (report.readiness.topIssues.length === 0) {
    return ["- No top readiness issues in the UI report."];
  }

  return report.readiness.topIssues.slice(0, 5).map((issue) => `- ${issue.userSeverity}: ${issue.title}`);
}

function formatReadinessStatus(label: UiReport["readiness"]["label"], errorCount: number): TerminalReviewStatus {
  if (errorCount > 0) return "Unknown";
  if (label === "ready") return "Ready";
  if (label === "almost_ready" || label === "needs_attention") return "Needs attention";
  return "Unknown";
}
