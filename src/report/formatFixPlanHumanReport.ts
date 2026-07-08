import type { FixPlanAction, FixPlanCategory, FixPlanResult, NoActionCheck } from "../types/fixPlan";
import {
  formatCountSummary,
  formatJsonMoreLine,
  formatTerminalReviewHeader,
  truncateTerminalValue,
  type TerminalReviewStatus,
} from "./terminalReview";

export function formatFixPlanHumanReport(result: FixPlanResult): string {
  const nextStep = formatRecommendedNextStep(result.recommendedNextStep, result);
  const lines: string[] = [
    ...formatTerminalReviewHeader("ShipReady fix plan", {
      target: result.url,
      repo: result.repoPath,
      status: formatPlanStatus(result),
      next: nextStep,
    }),
    "",
    "Top findings",
    ...formatTopActions(result.actions),
    "",
    "Audit summary",
    `- Score: ${result.auditSummary.score}/100`,
    `- Status: ${formatStatus(result.auditSummary.status)}`,
    `- Critical issues: ${result.auditSummary.criticalCount}`,
    `- Warnings: ${result.auditSummary.warningCount}`,
    `- Notes: ${result.auditSummary.noteCount}`,
    "",
    "Repo summary",
    `- Framework: ${result.repoSummary.frameworkName}`,
    `- Confidence: ${result.repoSummary.confidence}`,
    `- Package manager: ${result.repoSummary.packageManager}`,
  ];

  lines.push("", "Safe candidates", ...formatActions(result.actions, "safe_automated_later"));
  lines.push("", "Review required", ...formatActions(result.actions, "automated_with_review"));
  lines.push("", "Manual recommendations", ...formatActions(result.actions, "manual_recommendation"));
  lines.push("", "Passed checks", ...formatNoAction(result.noActionChecks));
  lines.push("", "Optional polish", ...formatOptionalNotes(result.optionalNotes));
  lines.push(
    "",
    "Safety",
    "- Plan only. No files were modified and no patches were generated.",
    "- Safe-write eligibility still requires a fresh dry-run and WRITE_POLICY_V1 validation.",
    "",
    "Limitations",
    ...formatList(result.limitations),
    "",
    formatJsonMoreLine(),
  );

  return `${lines.join("\n")}\n`;
}

function formatTopActions(actions: FixPlanAction[]): string[] {
  const ordered = [
    ...actions.filter((action) => action.category === "safe_automated_later"),
    ...actions.filter((action) => action.category === "automated_with_review"),
    ...actions.filter((action) => action.category === "manual_recommendation"),
  ].slice(0, 5);

  if (ordered.length === 0) {
    return ["- No launch-readiness actions were recommended."];
  }

  return ordered.map((action) =>
    `- ${formatCategoryLabel(action.category)}: ${action.title} (${action.priority}; ${action.risk}; ${formatTargets(action)})`);
}

function formatActions(actions: FixPlanAction[], category: FixPlanCategory): string[] {
  const filtered = actions.filter((action) => action.category === category);
  if (filtered.length === 0) {
    return ["- None"];
  }

  const lines: string[] = [];
  for (const [index, action] of filtered.entries()) {
    lines.push(`${index + 1}. ${action.title}`);
    lines.push(`   Priority: ${action.priority}`);
    lines.push(`   Risk: ${action.risk}`);
    lines.push(`   Confidence: ${action.confidence}`);
    lines.push(`   Target: ${formatTargets(action)}`);
    lines.push(`   Reason: ${truncateTerminalValue(action.description, 116)}`);
    lines.push(`   Strategy: ${truncateTerminalValue(action.frameworkStrategy, 116)}`);
    lines.push(`   Safety label: ${formatFutureAutomation(action)}`);
  }

  return lines;
}

function formatTargets(action: FixPlanAction): string {
  if (action.targetFiles.length > 0) {
    return action.targetFiles.join(", ");
  }

  if (action.targetLocations.length > 0) {
    return action.targetLocations.join(", ");
  }

  return "manual inspection required";
}

function formatFutureAutomation(action: FixPlanAction): string {
  if (!action.futureAutomation.canAutomate) {
    return `manual only; ${action.futureAutomation.reason}`;
  }

  if (action.futureAutomation.requiresHumanReview) {
    return `possible with review; ${action.futureAutomation.reason}`;
  }

  return `likely safe later; ${action.futureAutomation.reason}`;
}

function formatNoAction(checks: NoActionCheck[]): string[] {
  if (checks.length === 0) {
    return ["- None"];
  }

  const visible = checks.slice(0, 5).map((check) => `- ${check.title}`);
  return [
    `- ${formatCountSummary(checks.length, "passed", 5)}`,
    ...visible,
    ...(checks.length > 5 ? ["- Remaining passed checks are available with --json."] : []),
  ];
}

function formatOptionalNotes(notes: string[]): string[] {
  if (notes.length === 0) {
    return ["- None"];
  }

  return notes.map((note) => `- ${note}`);
}

function formatList(values: string[]): string[] {
  if (values.length === 0) {
    return ["- None"];
  }

  return values.map((value) => `- ${value}`);
}

function formatStatus(status: FixPlanResult["auditSummary"]["status"]): string {
  if (status === "good") return "Good";
  if (status === "needs_work") return "Needs work";
  return "Critical";
}

function formatRecommendedNextStep(
  step: FixPlanResult["recommendedNextStep"],
  result: FixPlanResult,
): string {
  if (step === "no_changes_needed") return "No changes needed; keep this as a baseline and rerun before launch.";
  if (step === "review_plan") return `Review the plan, then run: pnpm shipready fix ${result.repoPath} --url ${result.url} --dry-run`;
  if (step === "manual_review_required") return "Manual review required before generating or applying any patch outside ShipReady.";
  return "Unsupported project; inspect manually before attempting automated fixes";
}

function formatPlanStatus(result: FixPlanResult): TerminalReviewStatus {
  if (result.recommendedNextStep === "no_changes_needed") return "Ready";
  if (
    result.actions.some((action) =>
      action.category === "automated_with_review" || action.category === "manual_recommendation")
  ) {
    return "Manual review";
  }
  if (result.actions.length > 0 || result.auditSummary.status !== "good") return "Needs attention";
  return "Unknown";
}

function formatCategoryLabel(category: FixPlanCategory): string {
  if (category === "safe_automated_later") return "safe candidate";
  if (category === "automated_with_review") return "review required";
  return "manual";
}
