import type { DryRunFileChange, DryRunFixResult, SkippedFixAction } from "../types/dryRunFix";
import {
  formatJsonMoreLine,
  formatTerminalReviewHeader,
  truncateTerminalValue,
  type TerminalReviewStatus,
} from "./terminalReview";

export function formatDryRunFixHumanReport(result: DryRunFixResult): string {
  const creates = result.fileChanges.filter((change) => change.changeType === "create");
  const updates = result.fileChanges.filter((change) => change.changeType === "update");
  const nextStep = formatRecommendedNextStep(result);
  const safetyNotes = uniqueList([
    "Dry-run only. No files were modified.",
    "Safe write is limited to eligible missing robots/sitemap file creation under WRITE_POLICY_V1.",
    "Review-required previews are not write authorization.",
    ...result.safetyNotes,
  ]);
  const lines: string[] = [
    ...formatTerminalReviewHeader("ShipReady dry-run fix preview", {
      target: result.url,
      repo: result.repoPath,
      status: formatDryRunStatus(result),
      next: nextStep,
    }),
    "",
    "Summary",
    `- Audit score: ${result.planSummary.auditScore}/100`,
    `- Audit status: ${formatAuditStatus(result.planSummary.auditStatus)}`,
    `- Framework: ${result.planSummary.frameworkName}`,
    `- Files that would be changed: ${result.fileChanges.length}`,
    "- Files actually changed: 0",
    "",
    "Top changes",
    ...formatTopChanges(result.fileChanges),
    "",
    "Would create:",
    ...formatFileList(creates),
    "",
    "Would update:",
    ...formatFileList(updates),
    "",
    "Skipped:",
    ...formatSkippedActions(result.skippedActions),
    "",
    "Diff preview",
    ...formatDiffs(result.fileChanges),
    "",
    "Safety",
    ...formatList(safetyNotes),
    "",
    formatJsonMoreLine(),
  ];

  return `${lines.join("\n")}\n`;
}

function formatTopChanges(changes: DryRunFileChange[]): string[] {
  if (changes.length === 0) {
    return ["- No file changes were proposed."];
  }

  const visible = changes.slice(0, 5).map((change) =>
    `- ${change.path}: ${change.changeType}; risk ${change.risk}; ${formatReviewStatus(change.reviewStatus)}`);
  return [
    ...visible,
    ...(changes.length > 5 ? [`- ${changes.length - 5} more change(s) available with --json.`] : []),
  ];
}

function formatFileList(changes: DryRunFileChange[]): string[] {
  if (changes.length === 0) {
    return ["- None"];
  }

  return changes.map(
    (change) =>
      `- ${change.path} (${truncateTerminalValue(change.reason, 112)}; risk: ${change.risk}; ${formatReviewStatus(change.reviewStatus)})`,
  );
}

function formatSkippedActions(actions: SkippedFixAction[]): string[] {
  if (actions.length === 0) {
    return ["- None"];
  }

  return actions.map((action) => `- ${action.title}: ${action.reason}`);
}

function formatDiffs(changes: DryRunFileChange[]): string[] {
  if (changes.length === 0) {
    return ["- None"];
  }

  return changes.flatMap((change, index) => [
    ...(index === 0 ? [] : [""]),
    change.diff,
  ]);
}

function formatList(values: string[]): string[] {
  if (values.length === 0) {
    return ["- None"];
  }

  return values.map((value) => `- ${value}`);
}

function uniqueList(values: string[]): string[] {
  return [...new Set(values)];
}

function formatAuditStatus(status: DryRunFixResult["planSummary"]["auditStatus"]): string {
  if (status === "good") return "Good";
  if (status === "needs_work") return "Needs work";
  return "Critical";
}

function formatRecommendedNextStep(result: DryRunFixResult): string {
  if (result.recommendedNextStep === "review_patch_preview") {
    return "Review the preview; no files were changed by this dry-run.";
  }
  if (result.recommendedNextStep === "no_changes_needed") return "No changes needed; keep this as a baseline.";
  if (result.recommendedNextStep === "manual_review_required") return "Manual review required before using any patch outside ShipReady.";
  return "Unsupported project; inspect manually before attempting changes.";
}

function formatReviewStatus(status: DryRunFileChange["reviewStatus"]): string {
  return status === "review_required" ? "review required" : "safe candidate";
}

function formatDryRunStatus(result: DryRunFixResult): TerminalReviewStatus {
  if (result.fileChanges.length === 0 && result.skippedActions.length === 0) return "Ready";
  if (result.fileChanges.some((change) => change.reviewStatus === "review_required" || change.requiresHumanReview)) {
    return "Manual review";
  }
  if (result.skippedActions.length > 0) return "Manual review";
  return "Needs attention";
}
