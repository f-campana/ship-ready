import type { FixPlanAction, FixPlanCategory, FixPlanResult, NoActionCheck } from "../types/fixPlan";

export function formatFixPlanHumanReport(result: FixPlanResult): string {
  const lines: string[] = [
    "ShipReady fix plan",
    `URL: ${result.url}`,
    `Repo: ${result.repoPath}`,
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
    "",
    "Recommended next step",
    `- ${formatRecommendedNextStep(result.recommendedNextStep)}`,
  ];

  lines.push("", "Safe automated later", ...formatActions(result.actions, "safe_automated_later"));
  lines.push("", "Automated with review", ...formatActions(result.actions, "automated_with_review"));
  lines.push("", "Manual recommendations", ...formatActions(result.actions, "manual_recommendation"));
  lines.push("", "No action", ...formatNoAction(result.noActionChecks));
  lines.push("", "Optional polish", ...formatOptionalNotes(result.optionalNotes));
  lines.push("", "Limitations", ...formatList(result.limitations));

  return `${lines.join("\n")}\n`;
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
    lines.push(`   Reason: ${action.description}`);
    lines.push(`   Strategy: ${action.frameworkStrategy}`);
    lines.push(`   Future automation: ${formatFutureAutomation(action)}`);
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

  return checks.map((check) => `- ${check.title}`);
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

function formatRecommendedNextStep(step: FixPlanResult["recommendedNextStep"]): string {
  if (step === "no_changes_needed") return "No changes needed";
  if (step === "review_plan") return "Review plan before generating patches";
  if (step === "manual_review_required") return "Manual review required before patching";
  return "Unsupported project; inspect manually before attempting automated fixes";
}
