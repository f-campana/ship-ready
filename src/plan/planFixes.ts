import { auditUrl, type AuditUrlOptions } from "../audit/auditUrl";
import { inspectRepo, type InspectRepoOptions } from "../repo/inspectRepo";
import type { AuditResult } from "../types/audit";
import { FixPlanResultSchema, type FixPlanResult } from "../types/fixPlan";
import type { RepoInspectionResult } from "../types/repoInspection";
import { mapAuditChecksToActions } from "./mapAuditChecksToActions";

export type PlanFixesOptions = AuditUrlOptions & {
  repo?: InspectRepoOptions;
};

export async function planFixes(
  repoPath: string,
  url: string,
  options: PlanFixesOptions = {},
): Promise<FixPlanResult> {
  const [audit, repo] = await Promise.all([
    auditUrl(url, {
      timeoutMs: options.timeoutMs,
      userAgent: options.userAgent,
      render: options.render,
    }),
    Promise.resolve(inspectRepo(repoPath, options.repo)),
  ]);

  return planFixesFromResults(audit, repo);
}

export function planFixesFromResults(
  audit: AuditResult,
  repo: RepoInspectionResult,
): FixPlanResult {
  const criticalCount = audit.checks.filter((check) => check.severity === "critical").length;
  const warningCount = audit.checks.filter((check) => check.severity === "warning").length;
  const noteCount = audit.checks.filter((check) => check.severity === "info").length;
  const mapped = mapAuditChecksToActions(audit, repo);

  return FixPlanResultSchema.parse({
    url: audit.finalUrl,
    repoPath: repo.path,
    plannedAt: new Date().toISOString(),
    auditSummary: {
      score: audit.score,
      status: audit.status,
      criticalCount,
      warningCount,
      noteCount,
    },
    repoSummary: {
      frameworkId: repo.framework.id,
      frameworkName: repo.framework.name,
      confidence: repo.framework.confidence,
      packageManager: repo.packageManager,
    },
    actions: mapped.actions,
    noActionChecks: mapped.noActionChecks,
    optionalNotes: mapped.optionalNotes,
    limitations: planLimitations(repo),
    recommendedNextStep: recommendedNextStep({
      actionCount: mapped.actions.length,
      criticalCount,
      warningCount,
      frameworkId: repo.framework.id,
      repoConfidence: repo.framework.confidence,
      manualActionCount: mapped.actions.filter((action) => action.category === "manual_recommendation").length,
    }),
  });
}

function recommendedNextStep(input: {
  actionCount: number;
  criticalCount: number;
  warningCount: number;
  frameworkId: string;
  repoConfidence: "high" | "medium" | "low";
  manualActionCount: number;
}): FixPlanResult["recommendedNextStep"] {
  if (input.actionCount === 0 && input.criticalCount === 0 && input.warningCount === 0) {
    return "no_changes_needed";
  }

  if (input.frameworkId === "unknown") {
    return "unsupported_project";
  }

  if (input.repoConfidence === "low" || input.manualActionCount > 0) {
    return "manual_review_required";
  }

  return "review_plan";
}

function planLimitations(repo: RepoInspectionResult): string[] {
  return Array.from(new Set([
    "This is a read-only plan. No files were modified and no patches were generated.",
    "Future automation must re-check the repo before writing changes.",
    ...repo.limitations,
  ]));
}
