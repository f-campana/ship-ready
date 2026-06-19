import type { DryRunFileChange, DryRunFixResult, SkippedFixAction } from "../types/dryRunFix";

export function formatDryRunFixHumanReport(result: DryRunFixResult): string {
  const creates = result.fileChanges.filter((change) => change.changeType === "create");
  const updates = result.fileChanges.filter((change) => change.changeType === "update");
  const lines: string[] = [
    "ShipReady dry-run fix preview",
    `URL: ${result.url}`,
    `Repo: ${result.repoPath}`,
    "",
    "Summary",
    `- Mode: ${result.mode}`,
    `- Audit score: ${result.planSummary.auditScore}/100`,
    `- Audit status: ${formatAuditStatus(result.planSummary.auditStatus)}`,
    `- Framework: ${result.planSummary.frameworkName}`,
    `- Files that would be changed: ${result.fileChanges.length}`,
    "- Files actually changed: 0",
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
    ...formatList(result.safetyNotes),
    "",
    "Recommended next step",
    `- ${formatRecommendedNextStep(result.recommendedNextStep)}`,
  ];

  return `${lines.join("\n")}\n`;
}

function formatFileList(changes: DryRunFileChange[]): string[] {
  if (changes.length === 0) {
    return ["- None"];
  }

  return changes.map(
    (change) =>
      `- ${change.path} (${change.reason}; risk: ${change.risk}; ${formatReviewStatus(change.reviewStatus)})`,
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

function formatAuditStatus(status: DryRunFixResult["planSummary"]["auditStatus"]): string {
  if (status === "good") return "Good";
  if (status === "needs_work") return "Needs work";
  return "Critical";
}

function formatRecommendedNextStep(step: DryRunFixResult["recommendedNextStep"]): string {
  if (step === "review_patch_preview") return "Review patch preview";
  if (step === "no_changes_needed") return "No changes needed";
  if (step === "manual_review_required") return "Manual review required";
  return "Unsupported project";
}

function formatReviewStatus(status: DryRunFileChange["reviewStatus"]): string {
  return status === "review_required" ? "review required" : "automation candidate";
}
